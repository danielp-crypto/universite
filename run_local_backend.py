#!/usr/bin/env python3
"""
Local Backend Runner for Universite
Sets up environment and starts Flask development server
"""

import os
import sys
from pathlib import Path

def setup_environment():
    """Setup environment variables from .env file or user input"""
    
    # Try to load from .env file
    env_file = Path('.env')
    if env_file.exists():
        print("Loading environment from .env file...")
        with open(env_file, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key.strip()] = value.strip()
    else:
        print("WARNING: .env file not found. Please set up environment variables:")
        setup_interactive_env()
    
def setup_interactive_env():
    """Interactive environment setup"""
    print("\nSetting up environment variables:")
    
    # Required variables
    required_vars = {
        'SUPABASE_URL': 'Your Supabase project URL (e.g., https://your-project.supabase.co)',
        'SUPABASE_ANON_KEY': 'Your Supabase anon/public key',
        'GEMINI_API_KEY': 'Your Google Gemini API key'
    }
    
    for var, description in required_vars.items():
        value = input(f"{description}:\n> ")
        os.environ[var] = value.strip()
    
    # Optional variable
    google_creds = input("Path to Google Cloud service account JSON (optional, press Enter to skip):\n> ")
    if google_creds.strip():
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = google_creds.strip()

def verify_environment():
    """Verify required environment variables are set"""
    required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GEMINI_API_KEY']
    missing = [var for var in required if not os.environ.get(var)]
    
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        return False
    
    print("SUCCESS: Environment variables verified")
    return True

def start_backend():
    """Start the Flask backend server"""
    try:
        print("\nStarting local backend server...")
        print(f"Server will run on: http://localhost:5000")
        print(f"API endpoints available at: http://localhost:5000/api")
        print("\nAvailable endpoints:")
        print("  • POST /api/chat - Q&A generation")
        print("  • POST /api/generate-flashcards - Flashcard generation") 
        print("  • POST /api/transcribe - Audio transcription")
        print("  • GET  /health - Health check")
        print("\nPress Ctrl+C to stop the server")
        print("=" * 50)
        
        # Import and run the Flask app
        from api import app
        port = int(os.environ.get('PORT', 5000))
        app.run(host='0.0.0.0', port=port, debug=True)
        
    except ImportError as e:
        print(f"ERROR: Failed to import api.py: {e}")
        print("Make sure api.py is in the same directory")
        return False
    except Exception as e:
        print(f"ERROR: Failed to start server: {e}")
        return False

def main():
    """Main setup and start function"""
    print("Universite Local Backend Setup")
    print("=" * 40)
    
    setup_environment()
    
    if not verify_environment():
        print("\nERROR: Please fix missing environment variables and try again.")
        sys.exit(1)
    
    start_backend()

if __name__ == '__main__':
    main()
