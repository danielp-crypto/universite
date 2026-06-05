/**
 * Deepgram Transcription Service
 * Free alternative to Google Speech-to-Text
 */

class DeepgramService {
  constructor(apiKey, model = 'nova-2') {
    this.apiKey = apiKey;
    this.model = model;
    // Use proxy endpoint instead of direct API to avoid CORS issues
    this.baseUrl = window.UniversiteConfig?.CONFIG?.BACKEND?.URL || 'http://localhost:5000';
    this.transcribeEndpoint = `${this.baseUrl}/api/deepgram/transcribe`;
    this.testEndpoint = `${this.baseUrl}/api/deepgram/test`;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async transcribeAudio(audioFile, options = {}) {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', this.model);
    formData.append('language', options.language || 'en');
    formData.append('punctuate', 'true');
    formData.append('utterances', 'true');

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Use proxy endpoint instead of direct Deepgram API
        const response = await fetch(this.transcribeEndpoint, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            return {
              success: true,
              transcript: result.transcript,
              confidence: result.confidence,
              duration: result.duration,
              model: this.model,
              rawResponse: result.raw_response
            };
          } else {
            return {
              success: false,
              error: result.error || 'Transcription failed'
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

  async transcribeFromBlob(audioBlob, options = {}) {
    // Convert blob to file for Deepgram
    const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
    return this.transcribeAudio(audioFile, options);
  }

  async transcribeFromBase64(base64Audio, options = {}) {
    // Convert base64 to blob
    const byteCharacters = atob(base64Audio);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: 'audio/wav' });
    
    return this.transcribeFromBlob(audioBlob, options);
  }

  async testConnection() {
    try {
      const response = await fetch(this.testEndpoint, {
        method: 'GET'
      });
      
      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Connection test failed: ${error.message}`
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeepgramService;
}
