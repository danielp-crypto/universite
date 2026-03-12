/**
 * Transcription Service using Deepgram
 * Free alternative to Google Speech-to-Text
 */

class TranscriptionService {
  constructor(deepgramApiKey, model = 'nova-2') {
    this.deepgramService = new DeepgramService(deepgramApiKey, model);
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async transcribeAudio(audioFile, options = {}) {
    try {
      const result = await this.deepgramService.transcribeAudio(audioFile, {
        language: options.language || 'en-US',
        punctuate: true,
        utterances: true
      });
      
      return {
        success: true,
        transcript: result.transcript,
        confidence: result.confidence,
        duration: result.duration,
        model: this.deepgramService.model
      };
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async transcribeFromBlob(audioBlob, options = {}) {
    try {
      const result = await this.deepgramService.transcribeFromBlob(audioBlob, {
        language: options.language || 'en-US',
        punctuate: true,
        utterances: true
      });
      
      return {
        success: true,
        transcript: result.transcript,
        confidence: result.confidence,
        duration: result.duration,
        model: this.deepgramService.model
      };
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async transcribeFromBase64(base64Audio, options = {}) {
    try {
      const result = await this.deepgramService.transcribeFromBase64(base64Audio, {
        language: options.language || 'en-US',
        punctuate: true,
        utterances: true
      });
      
      return {
        success: true,
        transcript: result.transcript,
        confidence: result.confidence,
        duration: result.duration,
        model: this.deepgramService.model
      };
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptionService;
}
