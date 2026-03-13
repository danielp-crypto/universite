#!/usr/bin/env python3
"""
Simple test to check if backend is working
"""

import requests
import json

def test_backend():
    try:
        print("Testing backend connection...")
        
        # Test health endpoint
        response = requests.get('http://localhost:5000/health', timeout=5)
        print(f"Health endpoint: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Backend is running!")
            return True
        else:
            print(f"❌ Backend returned: {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Backend connection timeout")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend - is it running?")
        return False
    except Exception as e:
        print(f"❌ Backend error: {e}")
        return False

if __name__ == "__main__":
    if test_backend():
        print("\n🚀 Backend is ready!")
        print("Open: http://localhost:3000/assistant.html")
    else:
        print("\n🔧 Start backend with: python api.py")
