class LocalLectureManager {
  constructor(supabaseUrl, supabaseAnonKey, geminiApiKey, backendUrl) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.geminiApiKey = geminiApiKey;
    this.backendUrl = backendUrl || 'http://localhost:5000';
    
    // Initialize services
    this.transcriptionService = geminiApiKey ? 
      new GeminiTranscriptionService(geminiApiKey) : null;
    this.transcriptProcessor = geminiApiKey ? 
      new TranscriptProcessor(geminiApiKey) : null;
    this.audioRecorder = new AudioRecorder();
    this.currentLecture = null;
    this.isProcessing = false;
    this.storageKey = 'universite_lectures';
    
    // Set up event listeners for transcription updates
    this.setupTranscriptionEventListeners();
  }

  getAuthHeaders() {
    const token = localStorage.getItem('supabase.auth.token');
    const headers = {
      'apikey': this.supabaseAnonKey,
      'Authorization': `Bearer ${this.supabaseAnonKey}`,
      'Content-Type': 'application/json'
    };
    
    if (token) {
      try {
        const authData = JSON.parse(token);
        if (authData.access_token) {
          headers['Authorization'] = `Bearer ${authData.access_token}`;
        }
      } catch (e) {
        console.warn('Error parsing auth token:', e);
      }
    }
    
    return headers;
  }

  async getCurrentUser() {
    const token = localStorage.getItem('supabase.auth.token');
    if (!token) return null;
    
    try {
      const authData = JSON.parse(token);
      return authData.user || null;
    } catch (e) {
      console.warn('Error parsing user data:', e);
      return null;
    }
  }

  // Local storage management
  getLocalLectures() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading local lectures:', error);
      return [];
    }
  }

  saveLocalLectures(lectures) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(lectures));
    } catch (error) {
      console.error('Error saving local lectures:', error);
      // Handle storage quota exceeded
      if (error.name === 'QuotaExceededError') {
        alert('Storage space full. Please delete some old lectures.');
      }
    }
  }

  // Convert blob to base64 for local storage
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert base64 back to blob
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  // Recording management
  async startRecording(options = {}) {
    try {
      // Setup recording callbacks
      this.audioRecorder.onRecordingComplete = this.handleRecordingComplete.bind(this);
      this.audioRecorder.onError = this.handleRecordingError.bind(this);
      
      // Start recording
      await this.audioRecorder.start(options);
      
      return { success: true };
    } catch (error) {
      console.error('Error starting recording:', error);
      return { success: false, error: error.message };
    }
  }

  async stopRecording() {
    try {
      const audioBlob = await this.audioRecorder.stop();
      return { success: true, audioBlob };
    } catch (error) {
      console.error('Error stopping recording:', error);
      return { success: false, error: error.message };
    }
  }

  async handleRecordingComplete(audioBlob) {
    try {
      this.isProcessing = true;
      
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create lecture metadata
      const lectureData = {
        title: `Lecture ${new Date().toLocaleDateString()}`,
        created_at: new Date().toISOString(),
        user_id: user.id,
        duration: this.audioRecorder.getDuration(),
        status: 'processing',
        file_size: audioBlob.size,
        mime_type: audioBlob.type
      };

      // Save lecture metadata to Supabase (without audio file)
      const lectureResponse = await this.createLecture(lectureData);
      if (!lectureResponse.success) {
        throw new Error(lectureResponse.error);
      }

      const lecture = lectureResponse.lecture;
      this.currentLecture = lecture;

      // Store audio file locally as base64
      const audioBase64 = await this.blobToBase64(audioBlob);
      
      // Get existing local lectures
      const localLectures = this.getLocalLectures();
      
      // Add new lecture with local audio
      const localLecture = {
        ...lecture,
        local_audio: audioBase64,
        local_audio_size: audioBase64.length,
        stored_locally_at: new Date().toISOString()
      };
      
      localLectures.unshift(localLecture);
      
      // Save to local storage
      this.saveLocalLectures(localLectures);

      // Update lecture with local storage info
      const updateData = {
        stored_locally: true,
        local_audio_size: audioBase64.length,
        status: 'completed'
      };

      const updateResponse = await this.updateLecture(lecture.id, updateData);
      if (!updateResponse.success) {
        throw new Error(updateResponse.error);
      }

      // Start transcription if Gemini service is available
      if (this.transcriptionService) {
        await this.startTranscription(lecture.id, audioBlob);
      }

      this.isProcessing = false;

      // Dispatch completion event
      window.dispatchEvent(new CustomEvent('lectureRecordingComplete', {
        detail: {
          lecture: updateResponse.lecture,
          localAudio: true
        }
      }));

      return {
        success: true,
        lecture: updateResponse.lecture,
        localAudio: true
      };

    } catch (error) {
      this.isProcessing = false;
      console.error('Error processing recording:', error);
      window.dispatchEvent(new CustomEvent('lectureRecordingError', {
        detail: { error: error.message }
      }));
      return { success: false, error: error.message };
    }
  }

  handleRecordingError(error) {
    this.isProcessing = false;
    console.error('Recording error:', error);
    window.dispatchEvent(new CustomEvent('lectureRecordingError', {
      detail: { error: error.message }
    }));
  }

  // Supabase operations for metadata only - now using local backend
  async createLecture(lectureData) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.backendUrl}/api/lectures`, {
        method: 'POST',
        headers,
        body: JSON.stringify(lectureData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, lecture: result.lecture };
    } catch (error) {
      console.error('Error creating lecture:', error);
      return { success: false, error: error.message };
    }
  }

  async getLectures(limit = 50, offset = 0) {
    try {
      const headers = this.getAuthHeaders();
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      const response = await fetch(`${this.backendUrl}/api/lectures?${params}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Merge with local audio data
      const localLectures = this.getLocalLectures();
      const mergedLectures = result.lectures.map(lecture => {
        const localLecture = localLectures.find(l => l.id === lecture.id);
        return localLecture || lecture;
      });

      return { success: true, lectures: mergedLectures };
    } catch (error) {
      console.error('Error fetching lectures:', error);
      return { success: false, error: error.message };
    }
  }

  async getLecture(lectureId) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.backendUrl}/api/lectures/${lectureId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Check for local audio
      const localLectures = this.getLocalLectures();
      const localLecture = localLectures.find(l => l.id === lectureId);
      
      return { 
        success: true, 
        lecture: localLecture || result.lecture,
        segments: result.segments || []
      };
    } catch (error) {
      console.error('Error getting lecture:', error);
      return { success: false, error: error.message };
    }
  }

  async updateLecture(lectureId, updateData) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.backendUrl}/api/lectures/${lectureId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Update local storage if needed
      const localLectures = this.getLocalLectures();
      const localIndex = localLectures.findIndex(l => l.id === lectureId);
      if (localIndex !== -1) {
        localLectures[localIndex] = { ...localLectures[localIndex], ...updateData };
        this.saveLocalLectures(localLectures);
      }
      
      return { success: true, lecture: result.lecture };
    } catch (error) {
      console.error('Error updating lecture:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteLecture(lectureId) {
    try {
      const headers = this.getAuthHeaders();
      
      // Delete from backend
      const response = await fetch(`${this.backendUrl}/api/lectures/${lectureId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Delete from local storage
      const localLectures = this.getLocalLectures();
      const filteredLectures = localLectures.filter(l => l.id !== lectureId);
      this.saveLocalLectures(filteredLectures);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting lecture:', error);
      return { success: false, error: error.message };
    }
  }

  // Get local audio URL for playback
  getLocalAudioUrl(lectureId) {
    const localLectures = this.getLocalLectures();
    const lecture = localLectures.find(l => l.id === lectureId);
    
    if (lecture && lecture.local_audio) {
      return lecture.local_audio;
    }
    
    return null;
  }

  // Save transcription using local backend API
  async saveTranscription(lectureId, transcription, metadata = {}) {
    try {
      const headers = this.getAuthHeaders();
      
      // Update lecture with transcription
      const updateData = {
        transcription: transcription,
        transcription_status: 'completed',
        transcription_completed_at: new Date().toISOString(),
        ...metadata
      };

      const response = await fetch(`${this.backendUrl}/api/lectures/${lectureId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return { 
        success: true, 
        transcriptionId: lectureId, // Using lectureId as transcription ID for now
        transcription: transcription
      };
    } catch (error) {
      console.error('Error saving transcription:', error);
      return { success: false, error: error.message };
    }
  }

  // Get local storage usage
  getLocalStorageUsage() {
    try {
      const lectures = this.getLocalLectures();
      const totalSize = lectures.reduce((sum, lecture) => {
        return sum + (lecture.local_audio_size || 0);
      }, 0);
      
      return {
        totalLectures: lectures.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        availableSpace: this.getAvailableStorageSpace()
      };
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return { totalLectures: 0, totalSize: 0, totalSizeMB: '0.00' };
    }
  }

  // Estimate available storage space
  getAvailableStorageSpace() {
    try {
      const testKey = 'storage_test';
      const testData = 'x'.repeat(1024 * 1024); // 1MB test data
      
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      
      return 'Available (test passed)';
    } catch (error) {
      return 'Limited or full';
    }
  }

  // Clean up old local lectures if storage is full
  cleanupOldLectures(keepCount = 10) {
    try {
      const lectures = this.getLocalLectures();
      
      if (lectures.length <= keepCount) {
        return { success: true, deleted: 0 };
      }
      
      // Sort by creation date and keep the most recent ones
      const sortedLectures = lectures.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      const toKeep = sortedLectures.slice(0, keepCount);
      const toDelete = sortedLectures.slice(keepCount);
      
      // Save the filtered list
      this.saveLocalLectures(toKeep);
      
      // Also delete from Supabase if they exist there
      toDelete.forEach(async (lecture) => {
        try {
          await this.deleteLecture(lecture.id);
        } catch (error) {
          console.warn('Failed to delete lecture from Supabase:', lecture.id, error);
        }
      });
      
      return { 
        success: true, 
        deleted: toDelete.length,
        remaining: toKeep.length 
      };
    } catch (error) {
      console.error('Error cleaning up old lectures:', error);
      return { success: false, error: error.message };
    }
  }

  // Transcription methods
  setupTranscriptionEventListeners() {
    if (!this.transcriptionService) return;

    // Listen for transcription completion
    window.addEventListener('transcriptionCompleted', async (event) => {
      const { jobId, transcription } = event.detail;
      await this.handleTranscriptionCompleted(jobId, transcription);
    });

    // Listen for transcription failure
    window.addEventListener('transcriptionFailed', async (event) => {
      const { jobId, error } = event.detail;
      await this.handleTranscriptionFailed(jobId, error);
    });

    // Listen for transcription status updates
    window.addEventListener('transcriptionStatusUpdate', (event) => {
      const { jobId, status, message, progress } = event.detail;
      this.handleTranscriptionStatusUpdate(jobId, status, message, progress);
    });
  }

  async startTranscription(lectureId, audioBlob, options = {}) {
    if (!this.transcriptionService) {
      console.warn('Transcription service not available');
      return { success: false, error: 'Transcription service not available' };
    }

    try {
      // Update lecture status to transcribing
      await this.updateLecture(lectureId, {
        status: 'transcribing',
        transcription_status: 'processing'
      });

      // Start transcription job
      const result = await this.transcriptionService.createTranscriptionJob(
        lectureId, 
        audioBlob, 
        options
      );

      if (result.success) {
        console.log('Transcription job started:', result.jobId);
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('transcriptionStarted', {
          detail: {
            lectureId: lectureId,
            jobId: result.jobId
          }
        }));
      }

      return result;
    } catch (error) {
      console.error('Error starting transcription:', error);
      
      // Update lecture status to failed
      await this.updateLecture(lectureId, {
        status: 'transcription_failed',
        transcription_status: 'failed'
      });

      return { success: false, error: error.message };
    }
  }

  async handleTranscriptionCompleted(jobId, transcription) {
    try {
      console.log('Transcription completed for job:', jobId);

      // Get job metadata for processing time
      const job = this.transcriptionService.getTranscriptionJob(jobId);
      const metadata = {
        processingTimeMs: job.completedAt ? 
          new Date(job.completedAt) - new Date(job.createdAt) : null,
        modelUsed: 'gemini-1.5-flash',
        language: 'en',
        confidenceScore: null // Could be extracted from Gemini response if available
      };

      // Save transcription to Supabase with metadata
      const saveResult = await this.saveTranscription(jobId, transcription, metadata);
      
      if (saveResult.success) {
        // Update lecture status
        await this.updateLecture(jobId, {
          status: 'completed',
          transcription_status: 'completed',
          has_transcription: true
        });

        // Update local lecture with transcription
        const localLectures = this.getLocalLectures();
        const localLecture = localLectures.find(l => l.id === jobId);
        if (localLecture) {
          localLecture.transcription = transcription;
          localLecture.transcription_completed_at = new Date().toISOString();
          localLecture.transcription_id = saveResult.transcriptionId;
          this.saveLocalLectures(localLectures);
        }

        // Dispatch completion event
        window.dispatchEvent(new CustomEvent('lectureTranscriptionComplete', {
          detail: {
            lectureId: jobId,
            transcription: transcription,
            transcriptionId: saveResult.transcriptionId,
            savedToSupabase: true,
            metadata: metadata
          }
        }));
      } else {
        throw new Error(saveResult.error);
      }
    } catch (error) {
      console.error('Error handling transcription completion:', error);
      await this.handleTranscriptionFailed(jobId, error.message);
    }
  }

  async handleTranscriptionFailed(jobId, error) {
    console.error('Transcription failed for job:', jobId, error);

    try {
      // Update lecture status
      await this.updateLecture(jobId, {
        status: 'transcription_failed',
        transcription_status: 'failed',
        transcription_error: error
      });

      // Update local lecture
      const localLectures = this.getLocalLectures();
      const localLecture = localLectures.find(l => l.id === jobId);
      if (localLecture) {
        localLecture.transcription_status = 'failed';
        localLecture.transcription_error = error;
        localLecture.transcription_failed_at = new Date().toISOString();
        this.saveLocalLectures(localLectures);
      }

      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('lectureTranscriptionFailed', {
        detail: {
          lectureId: jobId,
          error: error
        }
      }));
    } catch (updateError) {
      console.error('Error updating lecture status after transcription failure:', updateError);
    }
  }

  handleTranscriptionStatusUpdate(jobId, status, message, progress) {
    // Dispatch status update for UI components
    window.dispatchEvent(new CustomEvent('lectureTranscriptionStatus', {
      detail: {
        lectureId: jobId,
        status: status,
        message: message,
        progress: progress
      }
    }));
  }

  async getTranscriptionStatus(lectureId) {
    if (!this.transcriptionService) {
      return { status: 'not_available' };
    }

    const job = this.transcriptionService.getTranscriptionJob(lectureId);
    if (!job) {
      return { status: 'not_found' };
    }

    return {
      status: job.status,
      message: job.message,
      progress: this.transcriptionService.getJobProgress(job),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      transcription: job.transcription
    };
  }

  async cancelTranscription(lectureId) {
    if (!this.transcriptionService) {
      return { success: false, error: 'Transcription service not available' };
    }

    const cancelled = this.transcriptionService.cancelTranscriptionJob(lectureId);
    
    if (cancelled) {
      // Update lecture status
      await this.updateLecture(lectureId, {
        status: 'transcription_cancelled',
        transcription_status: 'cancelled'
      });

      window.dispatchEvent(new CustomEvent('lectureTranscriptionCancelled', {
        detail: { lectureId: lectureId }
      }));
    }

    return { success: cancelled };
  }

  getTranscriptionStats() {
    if (!this.transcriptionService) {
      return {
        total: 0,
        completed: 0,
        processing: 0,
        failed: 0,
        averageDuration: 0
      };
    }

    return this.transcriptionService.getTranscriptionStats();
  }

  cleanupOldTranscriptionJobs() {
    if (this.transcriptionService) {
      this.transcriptionService.cleanupOldJobs();
    }
  }
}
