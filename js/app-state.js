// Shared App State Management - user-scoped via Supabase session
(function () {
  const DEFAULT_STORAGE_KEY = 'universite_app_data';
  const SUPABASE_PROJECT_REF = 'hiruufvoyigrcdohqjkm';

  function getUserIdFromSession() {
    try {
      const key = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const token = data?.access_token;
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.sub || null;
    } catch (e) {
      return null;
    }
  }

  function getStorageKey() {
    const userId = getUserIdFromSession();
    return userId ? `universite_app_data_${userId}` : DEFAULT_STORAGE_KEY;
  }

class AppState {
  constructor() {
    this.baseKey = DEFAULT_STORAGE_KEY;
    this.storageKey = getStorageKey();
    this.init();
  }

  init() {
    this.loadFromStorage();
  }

  _refreshStorageKey() {
    const key = getStorageKey();
    if (key !== this.storageKey) {
      this.storageKey = key;
      this.loadFromStorage();
    }
  }

  // Load data from localStorage
  loadFromStorage() {
    this._refreshStorageKey();
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.lectures = data.lectures || [];
        this.settings = data.settings || this.getDefaultSettings();
        this.flashcards = data.flashcards || [];
        this.studySessions = data.studySessions || [];
      } else {
        this.lectures = [];
        this.settings = this.getDefaultSettings();
        this.flashcards = [];
        this.studySessions = [];
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
      this.lectures = [];
      this.settings = this.getDefaultSettings();
      this.flashcards = [];
      this.studySessions = [];
    }
  }

  // Save data to localStorage
  saveToStorage() {
    try {
      const data = {
        lectures: this.lectures,
        settings: this.settings,
        flashcards: this.flashcards,
        studySessions: this.studySessions,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  // Default settings
  getDefaultSettings() {
    return {
      theme: 'light',
      notifications: true,
      autoSave: true,
      audioQuality: 'high',
      dailyStudyGoal: 120, // minutes
      storageUsed: 0,
      storageLimit: 5 * 1024 * 1024 * 1024 // 5GB in bytes
    };
  }

  // Lecture management
  addLecture(lecture) {
    lecture.id = lecture.id || Date.now().toString();
    lecture.createdAt = lecture.createdAt || new Date().toISOString();
    this.lectures.unshift(lecture);
    this.saveToStorage();
    return lecture;
  }

  getLecture(id) {
    return this.lectures.find(l => l.id === id);
  }

  updateLecture(id, updates) {
    const index = this.lectures.findIndex(l => l.id === id);
    if (index !== -1) {
      this.lectures[index] = { ...this.lectures[index], ...updates };
      this.saveToStorage();
      return this.lectures[index];
    }
    return null;
  }

  deleteLecture(id) {
    this.lectures = this.lectures.filter(l => l.id !== id);
    this.saveToStorage();
  }

  getRecentLectures(limit = 10) {
    return this.lectures.slice(0, limit);
  }

  // Flashcard management
  addFlashcardSet(lectureId, flashcards) {
    const set = {
      id: Date.now().toString(),
      lectureId,
      flashcards,
      createdAt: new Date().toISOString(),
      progress: {
        mastered: 0,
        learning: 0,
        new: flashcards.length
      }
    };
    this.flashcards.push(set);
    this.saveToStorage();
    return set;
  }

  getFlashcardSet(lectureId) {
    return this.flashcards.find(f => f.lectureId === lectureId);
  }

  updateFlashcardProgress(setId, cardIndex, status) {
    const set = this.flashcards.find(f => f.id === setId);
    if (set) {
      const card = set.flashcards[cardIndex];
      if (card) {
        card.status = status;
        // Update progress
        set.progress = set.flashcards.reduce((acc, c) => {
          if (c.status === 'mastered') acc.mastered++;
          else if (c.status === 'learning') acc.learning++;
          else acc.new++;
          return acc;
        }, { mastered: 0, learning: 0, new: 0 });
        this.saveToStorage();
      }
    }
  }

  // Study session tracking
  addStudySession(session) {
    session.id = session.id || Date.now().toString();
    session.date = session.date || new Date().toISOString();
    this.studySessions.push(session);
    this.saveToStorage();
    return session;
  }

  getWeeklyStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekSessions = this.studySessions.filter(s => 
      new Date(s.date) >= weekAgo
    );
    
    const lectures = weekSessions.length;
    const hours = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
    const flashcards = this.flashcards.reduce((sum, f) => 
      sum + f.progress.mastered, 0
    );
    
    return { lectures, hours: hours.toFixed(1), flashcards };
  }

  // Settings management
  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    this.saveToStorage();
    return this.settings;
  }

  getSetting(key) {
    return this.settings[key];
  }

  // Search functionality
  searchLectures(query) {
    const lowerQuery = query.toLowerCase();
    return this.lectures.filter(lecture => 
      (lecture.title || '').toLowerCase().includes(lowerQuery) ||
      (lecture.keyConcepts || []).some(c => (c || '').toLowerCase().includes(lowerQuery)) ||
      (lecture.segments || []).some(s => 
        (s?.title || '').toLowerCase().includes(lowerQuery) ||
        (s?.concepts || []).some(c => (c || '').toLowerCase().includes(lowerQuery))
      )
    );
  }

  // Filter lectures
  filterLectures(filter) {
    const now = new Date();
    let filtered = [...this.lectures];

    switch(filter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = filtered.filter(l => new Date(l.createdAt) >= today);
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(l => new Date(l.createdAt) >= weekAgo);
        break;
      case 'favorites':
        filtered = filtered.filter(l => l.favorite);
        break;
    }

    return filtered;
  }
}

// Create global instance (user-scoped storage key)
window.appState = new AppState();
})();
