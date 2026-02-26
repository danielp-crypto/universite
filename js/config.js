// Configuration file for Universite application
// Update these values with your actual API keys

const CONFIG = {
  // Supabase Configuration
  SUPABASE: {
    URL: 'https://hiruufvoyigrcdohqjkm.supabase.co',
    ANON_KEY: 'YOUR_SUPABASE_ANON_KEY' // Replace with your actual key
  },

  // Gemini AI Configuration
  GEMINI: {
    API_KEY: 'YOUR_GEMINI_API_KEY', // Replace with your actual key
    MODEL: 'gemini-1.5-flash', // Use 'gemini-1.5-pro' for higher quality
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    MAX_AUDIO_SIZE: 25 * 1024 * 1024, // 25MB limit for Gemini
    SUPPORTED_FORMATS: [
      'audio/webm',
      'audio/mp4', 
      'audio/mpeg',
      'audio/wav',
      'audio/ogg'
    ]
  },

  // Local Storage Configuration
  STORAGE: {
    LECTURES_KEY: 'universite_lectures',
    TRANSCRIPTION_JOBS_KEY: 'gemini_transcription_jobs',
    MAX_LOCAL_LECTURES: 50,
    CLEANUP_AGE: 24 * 60 * 60 * 1000, // 24 hours
    MAX_STORAGE_SIZE: 500 * 1024 * 1024 // 500MB local storage limit
  },

  // Application Configuration
  APP: {
    NAME: 'Universite',
    VERSION: '1.0.0',
    DEBUG: false,
    DEFAULT_LANGUAGE: 'en',
    SUPPORTED_LANGUAGES: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja']
  },

  // Recording Configuration
  RECORDING: {
    MAX_DURATION: 2 * 60 * 60, // 2 hours in seconds
    SAMPLE_RATE: 44100,
    CHANNELS: 1,
    CHUNK_SIZE: 1024,
    FORMAT: 'audio/webm'
  },

  // UI Configuration
  UI: {
    ANIMATION_DURATION: 300,
    TOAST_DURATION: 5000,
    PROGRESS_UPDATE_INTERVAL: 100,
    AUTO_REDIRECT_DELAY: 2000
  }
};

// Environment detection
const ENVIRONMENT = {
  isDevelopment: () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  isProduction: () => !window.location.hostname === 'localhost' && !window.location.hostname === '127.0.0.1',
  isMobile: () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Feature flags
const FEATURES = {
  TRANSCRIPTION: true,
  LOCAL_STORAGE: true,
  OFFLINE_MODE: false,
  ANALYTICS: false,
  DEBUG_MODE: ENVIRONMENT.isDevelopment()
};

// Validation helpers
const validateConfig = () => {
  const errors = [];

  // Check required API keys
  if (!CONFIG.SUPABASE.ANON_KEY || CONFIG.SUPABASE.ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    errors.push('Supabase anon key is not configured');
  }

  if (!CONFIG.GEMINI.API_KEY || CONFIG.GEMINI.API_KEY === 'YOUR_GEMINI_API_KEY') {
    errors.push('Gemini API key is not configured');
  }

  // Check browser support
  if (!window.MediaRecorder) {
    errors.push('MediaRecorder API is not supported in this browser');
  }

  // Check localStorage availability
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (e) {
    errors.push('localStorage is not available');
  }

  return errors;
};

// Get configuration with environment overrides
const getConfig = () => {
  const config = { ...CONFIG };

  // Override with environment variables if available
  if (typeof window !== 'undefined' && window.ENV) {
    Object.assign(config.SUPABASE, window.ENV.SUPABASE || {});
    Object.assign(config.GEMINI, window.ENV.GEMINI || {});
  }

  return config;
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    ENVIRONMENT,
    FEATURES,
    validateConfig,
    getConfig
  };
} else {
  window.UniversiteConfig = {
    CONFIG,
    ENVIRONMENT,
    FEATURES,
    validateConfig,
    getConfig
  };
}
