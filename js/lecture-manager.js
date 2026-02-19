class LectureManager {
  constructor(supabaseUrl, supabaseAnonKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.storageManager = new SupabaseStorageManager(supabaseUrl, supabaseAnonKey);
    this.audioRecorder = new AudioRecorder();
    this.currentLecture = null;
    this.isProcessing = false;
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

  // Recording management
  async startRecording(options = {}) {
    try {
      // Setup recording callbacks
      this.audioRecorder.onRecordingComplete = this.handleRecordingComplete.bind(this);
      this.audioRecorder.onTimeUpdate = options.onTimeUpdate;
      this.audioRecorder.onLevelUpdate = options.onLevelUpdate;

      // Start recording
      await this.audioRecorder.startRecording();
      
      return {
        success: true,
        state: this.audioRecorder.getRecordingState()
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  stopRecording() {
    try {
      this.audioRecorder.stopRecording();
      return { success: true };
    } catch (error) {
      console.error('Error stopping recording:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  pauseRecording() {
    try {
      this.audioRecorder.pauseRecording();
      return { success: true };
    } catch (error) {
      console.error('Error pausing recording:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  resumeRecording() {
    try {
      this.audioRecorder.resumeRecording();
      return { success: true };
    } catch (error) {
      console.error('Error resuming recording:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getRecordingState() {
    return this.audioRecorder.getRecordingState();
  }

  formatTime(seconds) {
    return this.audioRecorder.formatTime(seconds);
  }

  async handleRecordingComplete(audioBlob, duration, mimeType) {
    try {
      this.isProcessing = true;
      
      // Get current user
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Generate lecture title based on timestamp
      const timestamp = new Date().toLocaleString();
      const title = `Lecture - ${timestamp}`;

      // Create lecture record first
      const lectureData = {
        title: title,
        description: '',
        duration_seconds: duration,
        status: 'processing',
        tags: []
      };

      const lectureResponse = await this.createLecture(lectureData);
      if (!lectureResponse.success) {
        throw new Error(lectureResponse.error);
      }

      const lecture = lectureResponse.lecture;
      this.currentLecture = lecture;

      // Upload audio file to storage
      const uploadResult = await this.storageManager.uploadWithProgress(
        audioBlob,
        user.id,
        lecture.id,
        (percent, loaded, total) => {
          // Dispatch progress event
          window.dispatchEvent(new CustomEvent('lectureUploadProgress', {
            detail: { percent, loaded, total }
          }));
        }
      );

      // Update lecture with file information
      const updateData = {
        file_path: uploadResult.path,
        file_size: uploadResult.size,
        mime_type: uploadResult.mimeType,
        status: 'completed'
      };

      const updateResponse = await this.updateLecture(lecture.id, updateData);
      if (!updateResponse.success) {
        throw new Error(updateResponse.error);
      }

      this.isProcessing = false;

      // Dispatch completion event
      window.dispatchEvent(new CustomEvent('lectureRecordingComplete', {
        detail: {
          lecture: updateResponse.lecture,
          audioUrl: uploadResult.fullPath
        }
      }));

      return {
        success: true,
        lecture: updateResponse.lecture,
        audioUrl: uploadResult.fullPath
      };

    } catch (error) {
      this.isProcessing = false;
      console.error('Error handling recording completion:', error);
      
      // Dispatch error event
      window.dispatchEvent(new CustomEvent('lectureRecordingError', {
        detail: { error: error.message }
      }));

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Lecture CRUD operations
  async createLecture(lectureData) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures`, {
        method: 'POST',
        headers,
        body: JSON.stringify(lectureData)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create lecture: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        lecture: result
      };
    } catch (error) {
      console.error('Error creating lecture:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getLectures(filter = 'all', limit = 50, offset = 0) {
    try {
      const headers = this.getAuthHeaders();
      
      const params = new URLSearchParams({
        filter,
        limit: limit.toString(),
        offset: offset.toString()
      });

      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures?${params}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch lectures: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        lectures: result.lectures || [],
        filter: result.filter,
        total: result.total
      };
    } catch (error) {
      console.error('Error fetching lectures:', error);
      return {
        success: false,
        error: error.message,
        lectures: []
      };
    }
  }

  async getLecture(lectureId) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures/${lectureId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch lecture: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        lecture: result.lecture,
        segments: result.segments || []
      };
    } catch (error) {
      console.error('Error fetching lecture:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateLecture(lectureId, updateData) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures/${lectureId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update lecture: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        lecture: result.lecture
      };
    } catch (error) {
      console.error('Error updating lecture:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteLecture(lectureId) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures/${lectureId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete lecture: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      console.error('Error deleting lecture:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createLectureSegment(lectureId, segmentData) {
    try {
      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures/${lectureId}/segments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(segmentData)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create segment: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        segment: result.segment
      };
    } catch (error) {
      console.error('Error creating segment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  async getAudioUrl(lectureId) {
    try {
      const lectureResult = await this.getLecture(lectureId);
      if (!lectureResult.success || !lectureResult.lecture.file_path) {
        throw new Error('Audio file not found');
      }

      const signedUrl = await this.storageManager.getSignedUrl(lectureResult.lecture.file_path);
      return signedUrl;
    } catch (error) {
      console.error('Error getting audio URL:', error);
      throw error;
    }
  }

  async toggleFavorite(lectureId) {
    try {
      const lectureResult = await this.getLecture(lectureId);
      if (!lectureResult.success) {
        throw new Error(lectureResult.error);
      }

      const newFavoriteStatus = !lectureResult.lecture.favorite;
      const updateResult = await this.updateLecture(lectureId, {
        favorite: newFavoriteStatus
      });

      return updateResult;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchLectures(query, limit = 20) {
    try {
      const headers = this.getAuthHeaders();
      
      const params = new URLSearchParams({
        search: query,
        limit: limit.toString()
      });

      const response = await fetch(`${this.supabaseUrl}/rest/v1/lectures/search?${params}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to search lectures: ${error}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        lectures: result.lectures || [],
        total: result.total
      };
    } catch (error) {
      console.error('Error searching lectures:', error);
      return {
        success: false,
        error: error.message,
        lectures: []
      };
    }
  }

  // Cleanup
  async cleanup() {
    await this.audioRecorder.cleanup();
    this.currentLecture = null;
    this.isProcessing = false;
  }

  // Static method to check browser support
  static isSupported() {
    return AudioRecorder.isSupported();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LectureManager;
}
