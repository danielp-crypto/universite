/**
 * Deepgram Transcription Service
 * Free alternative to Google Speech-to-Text
 */

class DeepgramService {
  constructor(apiKey, model = 'nova-2') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.deepgram.com/v1';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async transcribeAudio(audioFile, options = {}) {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', this.model);
    formData.append('language', options.language || 'en-US');
    formData.append('punctuate', 'true');
    formData.append('utterances', 'true');

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/listen`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.apiKey}`
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.results && result.results.length > 0) {
            const transcript = result.results
              .map(result => result.alternatives[0]?.transcript || '')
              .join(' ');
            
            return {
              success: true,
              transcript: transcript,
              confidence: result.results[0]?.alternatives[0]?.confidence || 0,
              duration: result.metadata?.duration || 0,
              model: this.model
            };
          } else {
            return {
              success: false,
              error: 'No transcription results returned'
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeepgramService;
}
