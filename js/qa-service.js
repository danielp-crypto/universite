class QAService {
  constructor(geminiApiKey) {
    this.apiKey = geminiApiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-1.5-flash';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Generate contextual Q&A from transcript segment
   */
  async generateQAFromSegment(segment, context = {}) {
    try {
      const prompt = this.buildQAPrompt(segment, context);
      
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
        const qaPairs = this.parseQAResponse(response.text);
        return {
          success: true,
          qaPairs: qaPairs,
          segmentId: segment.id
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error generating Q&A:', error);
      return {
        success: false,
        error: error.message,
        segmentId: segment.id
      };
    }
  }

  /**
   * Build prompt for Q&A generation
   */
  buildQAPrompt(segment, context) {
    const { lectureTitle, lectureDescription, previousSegments } = context;
    
    let prompt = `Based on the following transcript segment from a lecture, generate 5-8 relevant questions and answers that test understanding of the content.

LECTURE: ${lectureTitle || 'Unknown Lecture'}
${lectureDescription ? `DESCRIPTION: ${lectureDescription}` : ''}

TRANSCRIPT SEGMENT:
Time: ${segment.start_time_seconds}s - ${segment.end_time_seconds}s
Content: "${segment.content}"
${segment.title ? `Topic: ${segment.title}` : ''}

${previousSegments && previousSegments.length > 0 ? 
`PREVIOUS CONTEXT: ${previousSegments.slice(-2).map(s => s.content).join(' ')}` : ''}

Generate questions that:
1. Test key concepts from this segment
2. Connect to broader lecture themes when relevant
3. Vary in difficulty (basic recall to application)
4. Are clear and specific
5. Have accurate, concise answers

Format your response as JSON:
{
  "questions": [
    {
      "question": "Clear question text",
      "answer": "Accurate answer text",
      "difficulty": "basic|intermediate|advanced",
      "type": "recall|application|analysis",
      "time_reference": "${segment.start_time_seconds}s"
    }
  ]
}

Only return the JSON, no additional text.`;

    return prompt;
  }

  /**
   * Parse Q&A response from Gemini
   */
  parseQAResponse(responseText) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize structure
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid Q&A structure');
      }
      
      return parsed.questions.map((qa, index) => ({
        id: `qa_${Date.now()}_${index}`,
        question: qa.question || '',
        answer: qa.answer || '',
        difficulty: qa.difficulty || 'basic',
        type: qa.type || 'recall',
        time_reference: qa.time_reference || '',
        created_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error parsing Q&A response:', error);
      // Return fallback Q&A
      return this.generateFallbackQA();
    }
  }

  /**
   * Generate fallback Q&A if parsing fails
   */
  generateFallbackQA() {
    return [
      {
        id: `qa_fallback_${Date.now()}`,
        question: "What was the main topic discussed in this segment?",
        answer: "The main topic was covered in the transcript content.",
        difficulty: "basic",
        type: "recall",
        time_reference: "",
        created_at: new Date().toISOString()
      }
    ];
  }

  /**
   * Answer user question with context
   */
  async answerQuestion(question, transcript, context = {}) {
    try {
      const prompt = this.buildAnswerPrompt(question, transcript, context);
      
      const requestData = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      };

      const response = await this.callGeminiAPI(requestData);
      
      if (response.success) {
        return {
          success: true,
          answer: response.text.trim(),
          question: question,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error answering question:', error);
      return {
        success: false,
        error: error.message,
        question: question
      };
    }
  }

  /**
   * Build prompt for answering user questions
   */
  buildAnswerPrompt(question, transcript, context) {
    const { lectureTitle, relevantSegments } = context;
    
    let prompt = `Answer the following question based on the lecture transcript. Be accurate and cite specific parts of the content when helpful.

LECTURE: ${lectureTitle || 'Unknown Lecture'}

TRANSCRIPT:
${transcript}

${relevantSegments && relevantSegments.length > 0 ? 
`RELEVANT SEGMENTS:
${relevantSegments.map(s => `Time ${s.start_time_seconds}s: "${s.content}"`).join('\n')}` : ''}

QUESTION: ${question}

Provide a clear, accurate answer based on the transcript content. If the transcript doesn't contain enough information to answer the question, say so clearly. Keep your answer concise but thorough.`;

    return prompt;
  }

  /**
   * Check if user has quota for Q&A generation
   */
  async checkQAQuota() {
    try {
      const { data, error } = await supabase.rpc('get_quota_status');
      if (error) throw error;

      const qaQuota = data.qa_generations;
      return {
        hasQuota: qaQuota.unlimited || (qaQuota.used < qaQuota.limit),
        used: qaQuota.used,
        limit: qaQuota.limit,
        remaining: qaQuota.unlimited ? -1 : qaQuota.limit - qaQuota.used
      };
    } catch (error) {
      console.error('Error checking Q&A quota:', error);
      // Default to allowing if quota check fails
      return { hasQuota: true, used: 0, limit: -1, remaining: -1 };
    }
  }

  /**
   * Consume Q&A quota
   */
  async consumeQAQuota(amount = 1) {
    try {
      const { data, error } = await supabase.rpc('consume_quota', {
        p_action: 'qa_generations',
        p_amount: amount
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error consuming Q&A quota:', error);
      throw error;
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
   * Generate Q&A for entire lecture
   */
  async generateLectureQA(lecture, segments) {
    try {
      const allQA = [];
      
      // Generate Q&A for each segment
      for (const segment of segments) {
        const context = {
          lectureTitle: lecture.title,
          lectureDescription: lecture.description,
          previousSegments: allQA.length > 0 ? segments.slice(0, segments.indexOf(segment)) : []
        };
        
        const result = await this.generateQAFromSegment(segment, context);
        if (result.success) {
          allQA.push(...result.qaPairs);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return {
        success: true,
        qaPairs: allQA,
        totalQuestions: allQA.length
      };
    } catch (error) {
      console.error('Error generating lecture Q&A:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get relevant segments for a question
   */
  findRelevantSegments(question, segments, maxSegments = 3) {
    // Simple keyword matching - could be enhanced with embeddings
    const questionWords = question.toLowerCase().split(/\s+/);
    const segmentScores = segments.map(segment => {
      const content = (segment.content + ' ' + (segment.title || '')).toLowerCase();
      let score = 0;
      
      questionWords.forEach(word => {
        if (word.length > 3) { // Skip very short words
          const matches = (content.match(new RegExp(word, 'g')) || []).length;
          score += matches;
        }
      });
      
      return { segment, score };
    });
    
    // Sort by score and return top segments
    return segmentScores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSegments)
      .map(item => item.segment);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QAService;
} else {
  window.QAService = QAService;
}
