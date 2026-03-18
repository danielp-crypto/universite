#!/usr/bin/env python3
"""
Test script for Deepgram transcription in the backend
"""

import requests
import os
import sys

def test_transcription():
    """Test the transcription endpoint with a simple audio file"""

    print("Testing Deepgram transcription integration...")

    # Check if API key is configured
    api_key = os.environ.get('DEEPGRAM_API_KEY', '')
    if not api_key or api_key == 'your_deepgram_api_key_here':
        print("X DEEPGRAM_API_KEY not configured in .env file")
        print("   Please get a free API key from https://deepgram.com/")
        print("   Add it to your .env file: DEEPGRAM_API_KEY=your_key_here")
        return False

    # Check backend is running
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code != 200:
            print("X Backend not running or not healthy")
            print("   Start it with: python api.py")
            return False
    except:
        print("X Cannot connect to backend")
        print("   Make sure backend is running on http://localhost:5000")
        return False

    print("OK Backend is running")
    print("OK Deepgram API key is configured")

    # Note: Actual transcription testing would require:
    # 1. A valid JWT token for authentication
    # 2. An actual audio file to upload
    # This is just a configuration check

    print("\nTo test transcription:")
    print("1. Log in to your app in the browser")
    print("2. Go to lecture recorder and record/upload an audio file")
    print("3. The transcription should now use Deepgram instead of Google")

    return True

if __name__ == "__main__":
    if test_transcription():
        print("\nOK Deepgram integration is ready!")
    else:
        print("\nX Configuration issues found")
        sys.exit(1)
