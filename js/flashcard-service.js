class FlashcardService {
  constructor(geminiApiKey) {
    this.apiKey = geminiApiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-1.5-flash';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Generate flashcards from transcript segment
   */
  async generateFlashcardsFromSegment(segment, context = {}) {
    try {
      const prompt = this.buildFlashcardPrompt(segment, context);
      
      const requestData = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      };

      const response = await this.callGeminiAPI(requestData);
      
      if (response.success) {
        const flashcards = this.parseFlashcardResponse(response.text);
        return {
          success: true,
          flashcards: flashcards,
          segmentId: segment.id
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      return {
        success: false,
        error: error.message,
        segmentId: segment.id
      };
    }
  }

  /**
   * Build prompt for flashcard generation
   */
  buildFlashcardPrompt(segment, context) {
    const { lectureTitle, lectureDescription, previousSegments } = context;
    
    let prompt = `Based on the following transcript segment from a lecture, generate 5-8 high-quality flashcards for studying.

LECTURE: ${lectureTitle || 'Unknown Lecture'}
${lectureDescription ? `DESCRIPTION: ${lectureDescription}` : ''}

TRANSCRIPT SEGMENT:
Time: ${segment.start_time_seconds}s - ${segment.end_time_seconds}s
Content: "${segment.content}"
${segment.title ? `Topic: ${segment.title}` : ''}

${previousSegments && previousSegments.length > 0 ? 
`PREVIOUS CONTEXT: ${previousSegments.slice(-2).map(s => s.content).join(' ')}` : ''}

Generate flashcards that:
1. Test key concepts, definitions, and relationships
2. Include different types (definition, concept, application, calculation)
3. Are clear and concise
4. Have accurate answers
5. Include time references for review

Format your response as JSON:
{
  "flashcards": [
    {
      "front": "Clear question or prompt",
      "back": "Accurate answer or explanation",
      "type": "definition|concept|application|calculation",
      "difficulty": "easy|medium|hard",
      "time_reference": "${segment.start_time_seconds}s",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Only return the JSON, no additional text.`;

    return prompt;
  }

  /**
   * Parse flashcard response from Gemini
   */
  parseFlashcardResponse(responseText) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize structure
      if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
        throw new Error('Invalid flashcard structure');
      }
      
      return parsed.flashcards.map((card, index) => ({
        id: `card_${Date.now()}_${index}`,
        front: card.front || '',
        back: card.back || '',
        type: card.type || 'concept',
        difficulty: card.difficulty || 'medium',
        time_reference: card.time_reference || '',
        tags: Array.isArray(card.tags) ? card.tags : [],
        created_at: new Date().toISOString(),
        review_count: 0,
        last_reviewed: null,
        mastery_level: 0 // 0-5 scale
      }));
    } catch (error) {
      console.error('Error parsing flashcard response:', error);
      // Return fallback flashcard
      return this.generateFallbackFlashcard();
    }
  }

  /**
   * Generate fallback flashcard if parsing fails
   */
  generateFallbackFlashcard() {
    return [
      {
        id: `card_fallback_${Date.now()}`,
        front: "What was the main concept discussed in this segment?",
        back: "The main concept was covered in the transcript content.",
        type: "concept",
        difficulty: "medium",
        time_reference: "",
        tags: ["general"],
        created_at: new Date().toISOString(),
        review_count: 0,
        last_reviewed: null,
        mastery_level: 0
      }
    ];
  }

  /**
   * Generate flashcards for entire lecture
   */
  async generateLectureFlashcards(lecture, segments) {
    try {
      const allFlashcards = [];
      
      // Generate flashcards for each segment
      for (const segment of segments) {
        const context = {
          lectureTitle: lecture.title,
          lectureDescription: lecture.description,
          previousSegments: allFlashcards.length > 0 ? segments.slice(0, segments.indexOf(segment)) : []
        };
        
        const result = await this.generateFlashcardsFromSegment(segment, context);
        if (result.success) {
          allFlashcards.push(...result.flashcards);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return {
        success: true,
        flashcards: allFlashcards,
        totalCards: allFlashcards.length
      };
    } catch (error) {
      console.error('Error generating lecture flashcards:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Call Gemini API
   */
  async callGeminiAPI(requestData) {
    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return {
            success: true,
            text: candidate.content.parts[0].text
          };
        }
      }

      throw new Error('No response generated');

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get flashcards by difficulty
   */
  getFlashcardsByDifficulty(flashcards, difficulty) {
    return flashcards.filter(card => card.difficulty === difficulty);
  }

  /**
   * Get flashcards by type
   */
  getFlashcardsByType(flashcards, type) {
    return flashcards.filter(card => card.type === type);
  }

  /**
   * Get flashcards by tags
   */
  getFlashcardsByTags(flashcards, tags) {
    return flashcards.filter(card => 
      tags.some(tag => card.tags.includes(tag))
    );
  }

  /**
   * Update flashcard review progress
   */
  updateFlashcardProgress(flashcardId, rating) {
    try {
      const flashcards = this.getStoredFlashcards();
      const card = flashcards.find(c => c.id === flashcardId);
      
      if (card) {
        card.review_count = (card.review_count || 0) + 1;
        card.last_reviewed = new Date().toISOString();
        
        // Update mastery level based on spaced repetition algorithm
        const currentLevel = card.mastery_level || 0;
        const newLevel = this.calculateMasteryLevel(currentLevel, rating);
        card.mastery_level = newLevel;
        
        this.saveFlashcards(flashcards);
        return { success: true, card: card };
      }
      
      return { success: false, error: 'Flashcard not found' };
    } catch (error) {
      console.error('Error updating flashcard progress:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate mastery level using spaced repetition
   */
  calculateMasteryLevel(currentLevel, rating) {
    // Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    let newLevel = currentLevel;
    
    switch (rating) {
      case 1: // Again
        newLevel = Math.max(0, currentLevel - 1);
        break;
      case 2: // Hard
        newLevel = Math.max(0, currentLevel - 0.5);
        break;
      case 3: // Good
        newLevel = Math.min(5, currentLevel + 0.5);
        break;
      case 4: // Easy
        newLevel = Math.min(5, currentLevel + 1);
        break;
    }
    
    return Math.round(newLevel * 2) / 2; // Round to nearest 0.5
  }

  /**
   * Get next review time based on mastery level
   */
  getNextReviewTime(masteryLevel) {
    const now = new Date();
    const hours = {
      0: 0,      // Again - review immediately
      0.5: 0.5,  // 30 minutes
      1: 1,      // 1 hour
      1.5: 3,    // 3 hours
      2: 6,      // 6 hours
      2.5: 12,   // 12 hours
      3: 24,     // 1 day
      3.5: 48,   // 2 days
      4: 96,     // 4 days
      4.5: 168,  // 1 week
      5: 336     // 2 weeks
    };
    
    const reviewHours = hours[masteryLevel] || 1;
    const reviewTime = new Date(now.getTime() + (reviewHours * 60 * 60 * 1000));
    
    return reviewTime;
  }

  /**
   * Get flashcards due for review
   */
  getFlashcardsDueForReview(flashcards) {
    const now = new Date();
    
    return flashcards.filter(card => {
      if (!card.last_reviewed) {
        return true; // Never reviewed
      }
      
      const nextReview = this.getNextReviewTime(card.mastery_level || 0);
      return nextReview <= now;
    });
  }

  /**
   * Store flashcards in localStorage
   */
  saveFlashcards(flashcards) {
    try {
      localStorage.setItem('universite_flashcards', JSON.stringify(flashcards));
    } catch (error) {
      console.error('Error saving flashcards:', error);
    }
  }

  /**
   * Get stored flashcards
   */
  getStoredFlashcards() {
    try {
      const stored = localStorage.getItem('universite_flashcards');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting stored flashcards:', error);
      return [];
    }
  }

  /**
   * Get study session statistics
   */
  getStudyStats() {
    try {
      const flashcards = this.getStoredFlashcards();
      
      const stats = {
        totalCards: flashcards.length,
        reviewedToday: 0,
        masteredCards: 0,
        cardsDueForReview: 0,
        averageMastery: 0,
        studyStreak: 0
      };
      
      const today = new Date().toDateString();
      
      flashcards.forEach(card => {
        // Cards reviewed today
        if (card.last_reviewed && new Date(card.last_reviewed).toDateString() === today) {
          stats.reviewedToday++;
        }
        
        // Mastered cards (level 4+)
        if (card.mastery_level >= 4) {
          stats.masteredCards++;
        }
        
        // Average mastery
        stats.averageMastery += card.mastery_level || 0;
      });
      
      // Calculate average mastery
      if (flashcards.length > 0) {
        stats.averageMastery = Math.round((stats.averageMastery / flashcards.length) * 10) / 10;
      }
      
      // Cards due for review
      stats.cardsDueForReview = this.getFlashcardsDueForReview(flashcards).length;
      
      return stats;
    } catch (error) {
      console.error('Error getting study stats:', error);
      return {
        totalCards: 0,
        reviewedToday: 0,
        masteredCards: 0,
        cardsDueForReview: 0,
        averageMastery: 0,
        studyStreak: 0
      };
    }
  }

  /**
   * Create study session with spaced repetition
   */
  createStudySession(flashcards, options = {}) {
    const {
      maxCards = 20,
      prioritizeNew = true,
      prioritizeDifficult = true
    } = options;
    
    const dueCards = this.getFlashcardsDueForReview(flashcards);
    let sessionCards = [...dueCards];
    
    // Add new cards if needed
    if (sessionCards.length < maxCards && prioritizeNew) {
      const newCards = flashcards.filter(card => 
        !card.last_reviewed && !sessionCards.includes(card)
      ).slice(0, maxCards - sessionCards.length);
      sessionCards.push(...newCards);
    }
    
    // Sort by difficulty and mastery level
    if (prioritizeDifficult) {
      sessionCards.sort((a, b) => {
        const aPriority = (5 - (a.mastery_level || 0)) + (a.difficulty === 'hard' ? 2 : a.difficulty === 'medium' ? 1 : 0);
        const bPriority = (5 - (b.mastery_level || 0)) + (b.difficulty === 'hard' ? 2 : b.difficulty === 'medium' ? 1 : 0);
        return bPriority - aPriority;
      });
    }
    
    return sessionCards.slice(0, maxCards);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlashcardService;
} else {
  window.FlashcardService = FlashcardService;
}
