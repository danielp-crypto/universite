class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.javascriptNode = null;
    this.onRecordingComplete = null;
    this.onTimeUpdate = null;
    this.onLevelUpdate = null;
  }

  async initialize() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      // Setup audio context for visualization
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.javascriptNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.fftSize = 1024;

      this.microphone.connect(this.analyser);
      this.analyser.connect(this.javascriptNode);
      this.javascriptNode.connect(this.audioContext.destination);

      this.javascriptNode.onaudioprocess = () => {
        if (this.isRecording && this.onLevelUpdate) {
          const array = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(array);
          const values = array.reduce((a, b) => a + b, 0);
          const average = values / array.length;
          this.onLevelUpdate(average);
        }
      };

      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  async startRecording() {
    if (!this.stream) {
      await this.initialize();
    }

    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.audioChunks = [];
    this.startTime = Date.now();
    this.isRecording = true;

    const options = {
      mimeType: 'audio/webm;codecs=opus'
    };

    // Check if the mimeType is supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'audio/webm';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'audio/mp4';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'audio/ogg';
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      
      if (this.onRecordingComplete) {
        this.onRecordingComplete(audioBlob, duration, this.mediaRecorder.mimeType);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms

    // Start time update interval
    this.timeUpdateInterval = setInterval(() => {
      if (this.isRecording && this.onTimeUpdate) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.onTimeUpdate(elapsed);
      }
    }, 1000);

    return true;
  }

  stopRecording() {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    this.mediaRecorder.stop();
    
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    return true;
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isRecording = false;
      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = null;
      }
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isRecording = true;
      
      // Resume time update interval
      this.timeUpdateInterval = setInterval(() => {
        if (this.isRecording && this.onTimeUpdate) {
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          this.onTimeUpdate(elapsed);
        }
      }, 1000);
    }
  }

  getRecordingState() {
    if (!this.mediaRecorder) return 'inactive';
    return this.mediaRecorder.state;
  }

  async cleanup() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isRecording = false;
    this.audioChunks = [];
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Static method to check browser support
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && MediaRecorder);
  }

  // Static method to get available audio input devices
  static async getAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioRecorder;
}
