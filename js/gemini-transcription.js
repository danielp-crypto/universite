class GeminiTranscriptionService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-1.5-flash'; // Use flash for faster processing
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Convert audio blob to base64 for Gemini API
   */
  async audioToBase64(audioBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  /**
   * Get MIME type from audio blob
   */
  getMimeType(audioBlob) {
    return audioBlob.type || 'audio/webm';
  }

  /**
   * Create transcription job
   */
  async createTranscriptionJob(lectureId, audioBlob, options = {}) {
    try {
      const base64Audio = await this.audioToBase64(audioBlob);
      const mimeType = this.getMimeType(audioBlob);

      const jobData = {
        id: lectureId,
        status: 'processing',
        audioData: base64Audio,
        mimeType: mimeType,
        language: options.language || 'en',
        prompt: options.prompt || this.getDefaultPrompt(),
        createdAt: new Date().toISOString(),
        retryCount: 0
      };

      // Store job in localStorage for tracking
      this.saveTranscriptionJob(jobData);

      // Start async transcription
      this.processTranscriptionJob(jobData.id);

      return {
        success: true,
        jobId: lectureId,
        status: 'processing'
      };
    } catch (error) {
      console.error('Error creating transcription job:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get default transcription prompt
   */
  getDefaultPrompt() {
    return `Please transcribe this audio recording accurately. 
    Return only the transcribed text without any additional commentary or formatting.
    Include punctuation and paragraph breaks where appropriate.
    If the audio contains multiple speakers, indicate speaker changes when clear.`;
  }

  /**
   * Process transcription job asynchronously
   */
  async processTranscriptionJob(jobId) {
    const job = this.getTranscriptionJob(jobId);
    if (!job) {
      console.error('Transcription job not found:', jobId);
      return;
    }

    try {
      // Update status to processing
      this.updateJobStatus(jobId, 'processing', 'Starting transcription...');

      // Prepare request to Gemini API
      const requestData = {
        contents: [{
          parts: [
            {
              text: job.prompt
            },
            {
              inline_data: {
                mime_type: job.mimeType,
                data: job.audioData
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      };

      // Call Gemini API
      const response = await this.callGeminiAPI(requestData);

      if (response.success) {
        const transcription = response.text.trim();
        
        // Update job with successful result
        this.updateJobStatus(jobId, 'completed', 'Transcription completed', transcription);
        
        // Dispatch success event
        window.dispatchEvent(new CustomEvent('transcriptionCompleted', {
          detail: {
            jobId: jobId,
            transcription: transcription,
            duration: Date.now() - new Date(job.createdAt).getTime()
          }
        }));

      } else {
        throw new Error(response.error);
      }

    } catch (error) {
      console.error('Transcription failed:', error);
      
      // Handle retries
      if (job.retryCount < this.maxRetries) {
        job.retryCount++;
        this.saveTranscriptionJob(job);
        
        // Wait before retry
        setTimeout(() => {
          this.updateJobStatus(jobId, 'processing', `Retrying... (Attempt ${job.retryCount}/${this.maxRetries})`);
          this.processTranscriptionJob(jobId);
        }, this.retryDelay * job.retryCount);
        
      } else {
        // Mark as failed after max retries
        this.updateJobStatus(jobId, 'failed', error.message);
        
        // Dispatch failure event
        window.dispatchEvent(new CustomEvent('transcriptionFailed', {
          detail: {
            jobId: jobId,
            error: error.message,
            retryCount: job.retryCount
          }
        }));
      }
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

      throw new Error('No transcription generated');

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save transcription job to localStorage
   */
  saveTranscriptionJob(jobData) {
    try {
      const jobs = this.getAllTranscriptionJobs();
      jobs[jobData.id] = jobData;
      localStorage.setItem('gemini_transcription_jobs', JSON.stringify(jobs));
    } catch (error) {
      console.error('Error saving transcription job:', error);
    }
  }

  /**
   * Get transcription job by ID
   */
  getTranscriptionJob(jobId) {
    try {
      const jobs = this.getAllTranscriptionJobs();
      return jobs[jobId] || null;
    } catch (error) {
      console.error('Error getting transcription job:', error);
      return null;
    }
  }

  /**
   * Get all transcription jobs
   */
  getAllTranscriptionJobs() {
    try {
      const stored = localStorage.getItem('gemini_transcription_jobs');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error getting transcription jobs:', error);
      return {};
    }
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId, status, message = '', transcription = '') {
    try {
      const job = this.getTranscriptionJob(jobId);
      if (job) {
        job.status = status;
        job.message = message;
        job.transcription = transcription;
        job.updatedAt = new Date().toISOString();
        
        if (status === 'completed') {
          job.completedAt = new Date().toISOString();
        }
        
        this.saveTranscriptionJob(job);
        
        // Dispatch status update event
        window.dispatchEvent(new CustomEvent('transcriptionStatusUpdate', {
          detail: {
            jobId: jobId,
            status: status,
            message: message,
            transcription: transcription,
            progress: this.getJobProgress(job)
          }
        }));
      }
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  }

  /**
   * Get job progress percentage
   */
  getJobProgress(job) {
    switch (job.status) {
      case 'processing':
        return 50; // In progress
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Cancel transcription job
   */
  cancelTranscriptionJob(jobId) {
    try {
      const job = this.getTranscriptionJob(jobId);
      if (job && job.status === 'processing') {
        this.updateJobStatus(jobId, 'cancelled', 'Transcription cancelled');
        
        window.dispatchEvent(new CustomEvent('transcriptionCancelled', {
          detail: { jobId: jobId }
        }));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cancelling transcription job:', error);
      return false;
    }
  }

  /**
   * Clean up old completed jobs
   */
  cleanupOldJobs(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const jobs = this.getAllTranscriptionJobs();
      const now = Date.now();
      const cleanedJobs = {};
      
      Object.keys(jobs).forEach(jobId => {
        const job = jobs[jobId];
        const jobAge = now - new Date(job.createdAt).getTime();
        
        // Keep recent jobs or jobs that are still processing
        if (jobAge < maxAge || job.status === 'processing') {
          cleanedJobs[jobId] = job;
        }
      });
      
      localStorage.setItem('gemini_transcription_jobs', JSON.stringify(cleanedJobs));
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
  }

  /**
   * Get transcription statistics
   */
  getTranscriptionStats() {
    try {
      const jobs = this.getAllTranscriptionJobs();
      const stats = {
        total: 0,
        completed: 0,
        processing: 0,
        failed: 0,
        cancelled: 0,
        averageDuration: 0
      };
      
      const completedDurations = [];
      
      Object.values(jobs).forEach(job => {
        stats.total++;
        stats[job.status]++;
        
        if (job.status === 'completed' && job.completedAt) {
          const duration = new Date(job.completedAt) - new Date(job.createdAt);
          completedDurations.push(duration);
        }
      });
      
      if (completedDurations.length > 0) {
        stats.averageDuration = completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length;
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting transcription stats:', error);
      return {
        total: 0,
        completed: 0,
        processing: 0,
        failed: 0,
        cancelled: 0,
        averageDuration: 0
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiTranscriptionService;
} else {
  window.GeminiTranscriptionService = GeminiTranscriptionService;
}
