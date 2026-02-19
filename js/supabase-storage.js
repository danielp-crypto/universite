class SupabaseStorageManager {
  constructor(supabaseUrl, supabaseAnonKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.storageUrl = `${supabaseUrl}/storage/v1`;
    this.bucket = 'lecture-recordings';
  }

  getAuthHeaders() {
    const token = localStorage.getItem('supabase.auth.token');
    const headers = {
      'apikey': this.supabaseAnonKey,
      'Authorization': `Bearer ${this.supabaseAnonKey}`
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

  async initializeBucket() {
    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';

      // Check if bucket exists
      const response = await fetch(`${this.storageUrl}/bucket/${this.bucket}`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        return true; // Bucket exists
      }

      // Create bucket if it doesn't exist
      const createResponse = await fetch(`${this.storageUrl}/bucket`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: this.bucket,
          public: false,
          allowed_mime_types: ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'],
          file_size_limit: 104857600, // 100MB
          cors_origins: ['http://localhost:5500', 'https://master.dopnvb05t610g.amplifyapp.com']
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Failed to create bucket: ${error}`);
      }

      return true;
    } catch (error) {
      console.error('Error initializing bucket:', error);
      throw error;
    }
  }

  generateFilePath(userId, lectureId, fileName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = fileName.split('.').pop();
    return `${userId}/${lectureId}/${timestamp}.${extension}`;
  }

  async uploadAudioFile(audioBlob, userId, lectureId, fileName = null) {
    try {
      await this.initializeBucket();

      if (!fileName) {
        fileName = `recording.${audioBlob.type.split('/')[1] || 'webm'}`;
      }

      const filePath = this.generateFilePath(userId, lectureId, fileName);
      const headers = this.getAuthHeaders();
      
      // Remove Content-Type for multipart upload
      delete headers['Content-Type'];

      const formData = new FormData();
      formData.append('file', audioBlob, fileName);

      const response = await fetch(`${this.storageUrl}/object/${this.bucket}/${filePath}`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      const result = await response.json();
      
      return {
        path: filePath,
        fullPath: `${this.storageUrl}/object/authenticated/${this.bucket}/${filePath}`,
        size: audioBlob.size,
        mimeType: audioBlob.type
      };
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw error;
    }
  }

  async getSignedUrl(filePath, expiresIn = 3600) {
    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';

      const response = await fetch(`${this.storageUrl}/object/sign/${this.bucket}/${filePath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ expiresIn })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to generate signed URL: ${error}`);
      }

      const result = await response.json();
      return result.signedURL;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  async deleteFile(filePath) {
    try {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.storageUrl}/object/${this.bucket}/${filePath}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Delete failed: ${error}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async listUserFiles(userId) {
    try {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.storageUrl}/object/list/${this.bucket}/${userId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`List failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async getFileMetadata(filePath) {
    try {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.storageUrl}/object/${this.bucket}/${filePath}`, {
        method: 'HEAD',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Metadata request failed: ${error}`);
      }

      return {
        size: response.headers.get('content-length'),
        lastModified: response.headers.get('last-modified'),
        contentType: response.headers.get('content-type'),
        cacheControl: response.headers.get('cache-control')
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  // Upload with progress tracking
  async uploadWithProgress(audioBlob, userId, lectureId, onProgress = null, fileName = null) {
    try {
      await this.initializeBucket();

      if (!fileName) {
        fileName = `recording.${audioBlob.type.split('/')[1] || 'webm'}`;
      }

      const filePath = this.generateFilePath(userId, lectureId, fileName);
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const headers = this.getAuthHeaders();
        
        // Set up request
        xhr.open('POST', `${this.storageUrl}/object/${this.bucket}/${filePath}`);
        
        // Set headers
        Object.entries(headers).forEach(([key, value]) => {
          if (key !== 'Content-Type') {
            xhr.setRequestHeader(key, value);
          }
        });

        // Progress tracking
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              onProgress(percentComplete, event.loaded, event.total);
            }
          });
        }

        // Load complete
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            resolve({
              path: filePath,
              fullPath: `${this.storageUrl}/object/authenticated/${this.bucket}/${filePath}`,
              size: audioBlob.size,
              mimeType: audioBlob.type
            });
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        });

        // Error handling
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out'));
        });

        // Create and send FormData
        const formData = new FormData();
        formData.append('file', audioBlob, fileName);
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error uploading with progress:', error);
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseStorageManager;
}
