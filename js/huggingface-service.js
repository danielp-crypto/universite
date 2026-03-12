/**
 * Hugging Face AI Service
 * Free alternative to Google Gemini API
 */

class HuggingFaceService {
  constructor(apiKey, model = 'microsoft/DialoGPT-medium') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api-inference.huggingface.co/models';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async generateResponse(prompt, options = {}) {
    const requestBody = {
      inputs: prompt,
      parameters: {
        max_length: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        do_sample: true,
        top_p: options.topP || 0.9,
        return_full_text: false
      }
    };

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/${this.model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const result = await response.json();
          
          if (Array.isArray(result) && result.length > 0) {
            return {
              success: true,
              response: result[0].generated_text || '',
              model: this.model
            };
          } else {
            return {
              success: false,
              error: 'Invalid response format from Hugging Face'
            };
          }
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < this.maxRetries && lastError) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }

    return {
      success: false,
      error: lastError || 'Unknown error occurred'
    };
  }

  async answerQuestion(question, lectureContext = null, conversationHistory = []) {
    let prompt = "You are an AI learning assistant helping students study their lecture content.\n\n";
    
    if (lectureContext) {
      prompt += `Current Lecture Information:\n`;
      prompt += `Title: ${lectureContext.title || 'Unknown'}\n`;
      prompt += `Date: ${lectureContext.date || 'Unknown'}\n`;
      prompt += `Duration: ${lectureContext.duration || 'Unknown'}\n`;
      prompt += `Key Concepts: ${(lectureContext.keyConcepts || []).join(', ')}\n`;
      
      if (lectureContext.segments && lectureContext.segments.length > 0) {
        prompt += `Segments:\n`;
        lectureContext.segments.forEach(segment => {
          prompt += `- ${segment.title || 'Unknown'} (${segment.startTime || 'Unknown'}): ${(segment.concepts || []).join(', ')}\n`;
        });
      }
      prompt += "\nUse this lecture information to provide contextually relevant responses.\n\n";
    } else {
      prompt += "No lecture content is available yet. Please guide the user to record or upload a lecture.\n\n";
    }

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      prompt += "Recent conversation:\n";
      const recentMessages = conversationHistory.slice(-6); // Last 6 messages
      recentMessages.forEach(msg => {
        const senderLabel = msg.sender === 'user' ? 'Student' : 'Assistant';
        prompt += `${senderLabel}: ${msg.content}\n`;
      });
    }

    prompt += `Student: ${question}\nAssistant:`;

    return this.generateResponse(prompt);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HuggingFaceService;
}
