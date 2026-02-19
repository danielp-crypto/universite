class ThemeManager {
  constructor() {
    this.currentTheme = 'system';
    this.listeners = [];
  }

  init() {
    // Load saved theme or default to system
    this.currentTheme = localStorage.getItem('universite_theme') || 'system';
    this.applyTheme(this.currentTheme);
    this.setupSystemThemeListener();
  }

  applyTheme(theme) {
    const html = document.documentElement;
    const body = document.body;
    
    // Remove existing theme classes
    html.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');
    
    if (theme === 'dark') {
      html.classList.add('dark');
      body.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.add('light');
      body.classList.add('light');
    } else if (theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.classList.add('dark');
        body.classList.add('dark');
      } else {
        html.classList.add('light');
        body.classList.add('light');
      }
    }
    
    this.currentTheme = theme;
    localStorage.setItem('universite_theme', theme);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(theme));
  }

  getCurrentTheme() {
    if (this.currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setTheme(theme) {
    this.applyTheme(theme);
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  setupSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Modern browsers support addEventListener on MediaQueryList
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', (e) => {
        if (this.currentTheme === 'system') {
          this.applyTheme('system');
        }
      });
    } else {
      // Fallback for older browsers
      mediaQuery.addListener((e) => {
        if (this.currentTheme === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  // Utility method to add theme styles to any page
  static injectThemeStyles() {
    const styleId = 'theme-manager-styles';
    if (document.getElementById(styleId)) {
      return; // Already injected
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Dark theme styles */
      .dark {
        background-color: #0f172a;
        color: #f1f5f9;
      }

      .dark .bg-white {
        background-color: #1e293b !important;
      }

      .dark .bg-slate-50 {
        background-color: #334155 !important;
      }

      .dark .bg-slate-100 {
        background-color: #475569 !important;
      }

      .dark .bg-gray-50 {
        background-color: #334155 !important;
      }

      .dark .bg-gray-100 {
        background-color: #475569 !important;
      }

      .dark .text-slate-800 {
        color: #f1f5f9 !important;
      }

      .dark .text-slate-700 {
        color: #e2e8f0 !important;
      }

      .dark .text-slate-600 {
        color: #cbd5e1 !important;
      }

      .dark .text-slate-500 {
        color: #94a3b8 !important;
      }

      .dark .text-slate-400 {
        color: #64748b !important;
      }

      .dark .border-slate-200 {
        border-color: #475569 !important;
      }

      .dark .border-slate-300 {
        border-color: #64748b !important;
      }

      .dark .border-gray-200 {
        border-color: #475569 !important;
      }

      .dark .border-gray-300 {
        border-color: #64748b !important;
      }

      .dark .hover\\:bg-slate-50:hover {
        background-color: #334155 !important;
      }

      .dark .hover\\:bg-slate-100:hover {
        background-color: #475569 !important;
      }

      .dark .hover\\:bg-gray-50:hover {
        background-color: #334155 !important;
      }

      .dark .hover\\:bg-gray-100:hover {
        background-color: #475569 !important;
      }

      .dark .modal-overlay {
        background-color: rgba(0, 0, 0, 0.7);
      }

      .dark .modal-content {
        background-color: #1e293b !important;
      }

      /* Smooth theme transition */
      * {
        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }
}

// Create global theme manager instance
window.themeManager = new ThemeManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.injectThemeStyles();
    window.themeManager.init();
  });
} else {
  ThemeManager.injectThemeStyles();
  window.themeManager.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
