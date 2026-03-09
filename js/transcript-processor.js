class TranscriptProcessor {
  constructor(geminiApiKey) {
    this.apiKey = geminiApiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-1.5-flash';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Clean and format raw transcription text
   */
  cleanTranscription(rawText) {
    if (!rawText) return '';

    let cleaned = rawText
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Fix common punctuation issues
      .replace(/\s+([.,!?;])/g, '$1')
      .replace(/([.,!?;])(?![\s])/g, '$1 ')
      // Remove filler words and phrases
      .replace(/\b(um|uh|like|you know|I mean|actually|basically|literally)\b/gi, '')
      // Remove repeated words
      .replace(/\b(\w+)\s+\1\b/gi, '$1')
      // Fix capitalization at sentence starts
      .replace(/([.!?]\s+)([a-z])/g, (match, punctuation, letter) => 
        punctuation + letter.toUpperCase()
      )
      // Remove extra spaces around punctuation
      .replace(/\s*([.,!?;])\s*/g, '$1 ')
      // Ensure proper spacing
      .trim();

    return cleaned;
  }

  /**
   * Intelligently segment transcript based on content
   */
  async segmentTranscription(transcript, options = {}) {
    try {
      const {
        maxSegmentLength = 300, // characters
        minSegmentLength = 50,
        preferTopicBreaks = true,
        includeTimestamps = false
      } = options;

      const cleanedTranscript = this.cleanTranscription(transcript);
      
      if (preferTopicBreaks) {
        return await this.createTopicBasedSegments(cleanedTranscript, options);
      } else {
        return this.createLengthBasedSegments(cleanedTranscript, options);
      }
    } catch (error) {
      console.error('Error segmenting transcript:', error);
      return this.createLengthBasedSegments(this.cleanTranscription(transcript), options);
    }
  }

  /**
   * Create topic-based segments using AI
   */
  async createTopicBasedSegments(transcript, options = {}) {
    try {
      const prompt = `Please segment this lecture transcript into logical topic-based segments. 
      Each segment should:
      1. Focus on a single main topic or concept
      2. Be between 50-300 words
      3. Have a clear beginning and end
      4. Include a descriptive title
      
      TRANSCRIPT:
      """${transcript}"""
      
      Return your response as JSON:
      {
        "segments": [
          {
            "title": "Descriptive segment title",
            "content": "Segment content",
            "start_time": 0,
            "end_time": 120,
            "key_concepts": ["concept1", "concept2"],
            "summary": "Brief summary of this segment"
          }
        ]
      }
      
      Only return the JSON, no additional text.`;

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
          maxOutputTokens: 4096
        }
      };

      const response = await this.callGeminiAPI(requestData);
      
      if (response.success) {
        const parsed = this.parseSegmentResponse(response.text);
        return parsed.segments || this.createLengthBasedSegments(transcript, options);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error creating topic-based segments:', error);
      return this.createLengthBasedSegments(transcript, options);
    }
  }

  /**
   * Create length-based segments (fallback method)
   */
  createLengthBasedSegments(transcript, options = {}) {
    const { maxSegmentLength = 300, minSegmentLength = 50 } = options;
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segments = [];
    let currentSegment = '';
    let segmentStartTime = 0;
    const estimatedWordsPerMinute = 150;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      
      if (currentSegment.length + sentence.length > maxSegmentLength && currentSegment.length >= minSegmentLength) {
        // Create segment
        const segment = {
          id: `segment_${segments.length}`,
          title: `Segment ${segments.length + 1}`,
          content: currentSegment.trim(),
          start_time_seconds: segmentStartTime,
          end_time_seconds: segmentStartTime + (currentSegment.length / 5), // Rough estimate
          key_concepts: this.extractKeyConcepts(currentSegment),
          summary: this.createBasicSummary(currentSegment)
        };
        
        segments.push(segment);
        currentSegment = sentence;
        segmentStartTime = segment.end_time_seconds;
      } else {
        currentSegment += (currentSegment ? '. ' : '') + sentence;
      }
    }
    
    // Add final segment if there's content left
    if (currentSegment.trim().length >= minSegmentLength) {
      segments.push({
        id: `segment_${segments.length}`,
        title: `Segment ${segments.length + 1}`,
        content: currentSegment.trim(),
        start_time_seconds: segmentStartTime,
        end_time_seconds: segmentStartTime + (currentSegment.length / 5),
        key_concepts: this.extractKeyConcepts(currentSegment),
        summary: this.createBasicSummary(currentSegment)
      });
    }
    
    return segments;
  }

  /**
   * Generate comprehensive lecture summary
   */
  async generateLectureSummary(transcript, segments = []) {
    try {
      const prompt = `Please create a comprehensive summary of this lecture transcript.
      
      TRANSCRIPT:
      """${transcript}"""
      
      ${segments.length > 0 ? `
      SEGMENTS:
      ${segments.map((s, i) => `${i + 1}. ${s.title}: ${s.summary}`).join('\n')}
      ` : ''}
      
      Create a summary that includes:
      1. Main topics covered
      2. Key concepts and definitions
      3. Important takeaways
      4. Overall theme or purpose
      
      Return your response as JSON:
      {
        "main_summary": "Overall lecture summary (2-3 paragraphs)",
        "key_topics": ["Topic 1", "Topic 2", "Topic 3"],
        "key_concepts": [
          {"concept": "Concept name", "definition": "Brief definition"},
          {"concept": "Another concept", "definition": "Brief definition"}
        ],
        "main_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
        "difficulty_level": "beginner|intermediate|advanced",
        "estimated_study_time": "X minutes"
      }
      
      Only return the JSON, no additional text.`;

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
        const parsed = this.parseSummaryResponse(response.text);
        return {
          success: true,
          summary: parsed
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error generating lecture summary:', error);
      return {
        success: false,
        error: error.message,
        summary: this.createBasicSummary(transcript)
      };
    }
  }

  /**
   * Generate AI-powered flashcard suggestions
   */
  async generateFlashcardSuggestions(transcript, segments = [], existingFlashcards = []) {
    try {
      const existingCardContent = existingFlashcards.map(f => f.front).join('\n');
      
      const prompt = `Analyze this lecture transcript and suggest high-quality flashcard content that would be most valuable for studying.
      
      TRANSCRIPT:
      """${transcript}"""
      
      ${segments.length > 0 ? `
      SEGMENT TITLES:
      ${segments.map(s => s.title).join(', ')}
      ` : ''}
      
      ${existingCardContent ? `
      EXISTING FLASHCARDS (avoid duplicates):
      ${existingCardContent}
      ` : ''}
      
      Generate 8-12 flashcard suggestions that:
      1. Test the most important concepts from the lecture
      2. Cover different difficulty levels (basic recall to application)
      3. Include various question types (definitions, explanations, problem-solving)
      4. Are clear, specific, and have definitive answers
      5. Avoid duplicating existing content
      
      Return your response as JSON:
      {
        "suggestions": [
          {
            "front": "Clear question or prompt",
            "back": "Accurate answer or explanation",
            "type": "definition|concept|application|calculation",
            "difficulty": "easy|medium|hard",
            "segment_reference": "Related segment title or topic",
            "rationale": "Why this is an important concept to remember"
          }
        ]
      }
      
      Only return the JSON, no additional text.`;

      const requestData = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 3072
        }
      };

      const response = await this.callGeminiAPI(requestData);
      
      if (response.success) {
        const parsed = this.parseFlashcardSuggestionsResponse(response.text);
        return {
          success: true,
          suggestions: parsed.suggestions || []
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error generating flashcard suggestions:', error);
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  }

  /**
   * Extract key concepts from text (basic implementation)
   */
  extractKeyConcepts(text) {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just']);
    
    const wordFreq = {};
    words.forEach(word => {
      const clean = word.replace(/[^a-z0-9]/g, '');
      if (clean.length > 3 && !commonWords.has(clean)) {
        wordFreq[clean] = (wordFreq[clean] || 0) + 1;
      }
    });
    
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Create basic summary (fallback method)
   */
  createBasicSummary(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 2) return text.trim();
    
    // Take first and last sentences, plus one from the middle
    const first = sentences[0].trim();
    const middle = sentences[Math.floor(sentences.length / 2)].trim();
    const last = sentences[sentences.length - 1].trim();
    
    return `${first}. ${middle}. ${last}.`;
  }

  /**
   * Parse segment response from Gemini
   */
  parseSegmentResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing segment response:', error);
      return { segments: [] };
    }
  }

  /**
   * Parse summary response from Gemini
   */
  parseSummaryResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing summary response:', error);
      return {
        main_summary: responseText.substring(0, 500),
        key_topics: [],
        key_concepts: [],
        main_takeaways: [],
        difficulty_level: 'intermediate',
        estimated_study_time: '30'
      };
    }
  }

  /**
   * Parse flashcard suggestions response from Gemini
   */
  parseFlashcardSuggestionsResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing flashcard suggestions response:', error);
      return { suggestions: [] };
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
   * Process complete transcript (clean, segment, summarize)
   */
  async processCompleteTranscript(rawTranscript, options = {}) {
    try {
      console.log('Starting complete transcript processing...');
      
      // Step 1: Clean transcript
      const cleanedTranscript = this.cleanTranscription(rawTranscript);
      console.log('Transcript cleaned');
      
      // Step 2: Create segments
      const segments = await this.segmentTranscription(cleanedTranscript, options);
      console.log(`Created ${segments.length} segments`);
      
      // Step 3: Generate summary
      const summaryResult = await this.generateLectureSummary(cleanedTranscript, segments);
      console.log('Summary generated');
      
      // Step 4: Generate flashcard suggestions
      const flashcardResult = await this.generateFlashcardSuggestions(cleanedTranscript, segments);
      console.log('Flashcard suggestions generated');
      
      return {
        success: true,
        cleanedTranscript,
        segments,
        summary: summaryResult.success ? summaryResult.summary : null,
        flashcardSuggestions: flashcardResult.success ? flashcardResult.suggestions : [],
        processingTime: Date.now()
      };
    } catch (error) {
      console.error('Error processing complete transcript:', error);
      return {
        success: false,
        error: error.message,
        cleanedTranscript: this.cleanTranscription(rawTranscript),
        segments: this.createLengthBasedSegments(this.cleanTranscription(rawTranscript)),
        summary: null,
        flashcardSuggestions: []
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptProcessor;
} else {
  window.TranscriptProcessor = TranscriptProcessor;
}
