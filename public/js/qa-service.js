/**
 * Q&A Service using Hugging Face AI
 * Generates contextual Q&A from transcript segments using free Hugging Face models
 */

class QAService {
  constructor(huggingfaceApiKey, model = 'microsoft/DialoGPT-medium') {
    this.huggingfaceService = new HuggingFaceService(huggingfaceApiKey, model);
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Generate contextual Q&A from transcript segment
   */
  async generateQAFromSegment(segment, context = {}) {
    try {
      const prompt = this.buildQAPrompt(segment, context);
      
      const response = await this.huggingfaceService.generateResponse(prompt, {
        temperature: 0.3,
        maxTokens: 2048
      });
      
      if (response.success) {
        const qaPairs = this.parseQAResponse(response.response);
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
   * Generate Q&A from multiple transcript segments
   */
  async generateQAFromSegments(segments, context = {}) {
    const allQAPairs = [];
    const errors = [];

    for (const segment of segments) {
      try {
        const result = await this.generateQAFromSegment(segment, context);
        if (result.success) {
          allQAPairs.push(...result.qaPairs);
        } else {
          errors.push({
            segmentId: segment.id,
            error: result.error
          });
        }
      } catch (error) {
        errors.push({
          segmentId: segment.id,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      qaPairs: allQAPairs,
      errors: errors,
      totalSegments: segments.length,
      processedSegments: segments.length - errors.length
    };
  }

  /**
   * Build prompt for Q&A generation
   */
  buildQAPrompt(segment, context = {}) {
    let prompt = `You are an educational content creator specializing in creating Q&A pairs for study materials.\n\n`;
    
    prompt += `Transcript Segment:\n`;
    prompt += `Title: ${segment.title || 'Untitled Segment'}\n`;
    prompt += `Content: ${segment.content || ''}\n`;
    prompt += `Key Concepts: ${(segment.concepts || []).join(', ')}\n\n`;
    
    if (context.lectureTitle) {
      prompt += `Lecture Context:\n`;
      prompt += `Lecture Title: ${context.lectureTitle}\n`;
      prompt += `Lecture Date: ${context.lectureDate || 'Unknown'}\n`;
      if (context.keyConcepts && context.keyConcepts.length > 0) {
        prompt += `Lecture Key Concepts: ${context.keyConcepts.join(', ')}\n`;
      }
      prompt += `\n`;
    }
    
    prompt += `Instructions:\n`;
    prompt += `Generate 5-8 high-quality question-answer pairs based on the transcript segment above.\n`;
    prompt += `Each pair should:\n`;
    prompt += `- Question: Clear, specific, and testable\n`;
    prompt += `- Answer: Accurate, concise, and directly addresses the question\n`;
    prompt += `- Cover the main concepts and important details\n`;
    prompt += `- Questions should vary in difficulty (basic recall to application)\n`;
    prompt += `- Include questions that require critical thinking\n\n`;
    
    prompt += `Format your response as a JSON array of objects with "question" and "answer" fields.\n`;
    prompt += `Example format: [{"question": "What is X?", "answer": "X is..."}, {"question": "How does Y work?", "answer": "Y works by..."}]\n\n`;
    prompt += `Transcript Segment:\n${segment.content || ''}`;
    
    return prompt;
  }

  /**
   * Parse Q&A response from Hugging Face
   */
  parseQAResponse(response) {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If not JSON, try to extract Q&A pairs manually
      const qaPairs = [];
      const lines = response.split('\n').filter(line => line.trim());
      
      let currentQuestion = null;
      
      for (const line of lines) {
        const questionMatch = line.match(/^(\d+[\.\)]?\s*(?:Q\.?|Question:?)\s*(.+)/i);
        const answerMatch = line.match(/^(\d+[\.\)]?\s*(?:A\.?|Answer:?)\s*(.+)/i);
        
        if (questionMatch) {
          currentQuestion = questionMatch[2].trim();
        } else if (answerMatch && currentQuestion) {
          qaPairs.push({
            question: currentQuestion,
            answer: answerMatch[2].trim()
          });
          currentQuestion = null;
        }
      }
      
      return qaPairs.length > 0 ? qaPairs : this.fallbackParse(response);
      
    } catch (error) {
      console.error('Error parsing Q&A response:', error);
      return this.fallbackParse(response);
    }
  }

  /**
   * Fallback parsing method
   */
  fallbackParse(response) {
    const qaPairs = [];
    const lines = response.split('\n').filter(line => line.trim());
    
    for (let i = 0; i < lines.length; i += 2) {
      if (i + 1 < lines.length) {
        const question = lines[i].replace(/^(\d+[\.\)]?\s*(?:Q\.?|Question:?)\s*/i, '').trim();
        const answer = lines[i + 1].replace(/^(\d+[\.\)]?\s*(?:A\.?|Answer:?)\s*/i, '').trim();
        
        if (question && answer) {
          qaPairs.push({ question, answer });
        }
      }
    }
    
    return qaPairs;
  }

  /**
   * Answer a question with context (for chat interface)
   */
  async answerQuestion(question, lectureContext = null, conversationHistory = []) {
    try {
      const response = await this.huggingfaceService.answerQuestion(question, lectureContext, conversationHistory);
      
      return {
        success: true,
        response: response.response,
        model: this.huggingfaceService.model
      };
    } catch (error) {
      console.error('Error answering question:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QAService;
}
