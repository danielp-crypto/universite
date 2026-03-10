#!/usr/bin/env python3
"""
Quick environment setup script for lazy developers!
"""

import os
import sys

def setup_env_file():
    """Create .env file with user input"""
    
    print("🎓 Universite Quick Environment Setup")
    print("=" * 40)
    print("📝 Please enter your API keys:")
    print()
    
    # Get user input
    supabase_url = input("🔗 Supabase URL (e.g., https://your-project.supabase.co):\n> ").strip()
    supabase_key = input("🔑 Supabase Anon Key:\n> ").strip()
    gemini_key = input("🤖 Gemini API Key:\n> ").strip()
    
    print()
    google_creds = input("📄 Google Cloud credentials path (optional, press Enter to skip):\n> ").strip()
    
    # Create .env content
    env_content = f"""# Supabase Configuration
SUPABASE_URL={supabase_url}
SUPABASE_ANON_KEY={supabase_key}

# Google Gemini API Configuration
GEMINI_API_KEY={gemini_key}

# Google Cloud Speech-to-Text (for transcription)"""
    
    if google_creds:
        env_content += f"\nGOOGLE_APPLICATION_CREDENTIALS={google_creds}"
    
    env_content += """

# Flask Configuration
FLASK_ENV=development
PORT=5000"""
    
    # Write to .env file
    try:
        with open('.env', 'w') as f:
            f.write(env_content)
        
        print("✅ Environment file created successfully!")
        print("📁 File saved as: .env")
        print()
        print("🚀 You can now start the backend with:")
        print("   python run_local_backend.py")
        print("   or")
        print("   start_backend.bat")
        
    except Exception as e:
        print(f"❌ Error creating .env file: {e}")
        return False
    
    return True

if __name__ == '__main__':
    setup_env_file()
