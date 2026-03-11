#!/usr/bin/env python3
"""
Test script for Gemini API integration
Run this to verify your Gemini API key is working properly
"""

import requests
import json
import os
import sys

def test_gemini_api():
    """Test Gemini API directly"""
    
    # Get API key from environment or use the one from config
    api_key = os.environ.get('GEMINI_API_KEY', 'AIzaSyAqpapZgs2z9oussNPp68ssXeVGIRf25qo')
    
    if not api_key or api_key == 'YOUR_GEMINI_API_KEY':
        print("ERROR: Gemini API key not configured")
        return False
    
    print(f"Testing Gemini API with key: {api_key[:20]}...")
    
    # Test basic API call
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    test_data = {
        "contents": [{
            "parts": [{
                "text": "Hello! Please respond with 'API working' to confirm the connection."
            }]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "topK": 32,
            "topP": 0.95,
            "maxOutputTokens": 100
        }
    }
    
    try:
        print("Sending test request to Gemini API...")
        response = requests.post(url, json=test_data, timeout=30)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'candidates' in data and len(data['candidates']) > 0:
                candidate = data['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    text = candidate['content']['parts'][0]['text']
                    print(f"SUCCESS: Gemini API working! Response: {text.strip()}")
                    return True
                else:
                    print("ERROR: Unexpected response format")
                    print(f"Response data: {json.dumps(data, indent=2)}")
                    return False
            else:
                print("ERROR: No candidates in response")
                print(f"Response data: {json.dumps(data, indent=2)}")
                return False
        else:
            print(f"ERROR: API request failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON decode error: {e}")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        return False

def test_backend_integration():
    """Test Gemini API through the local backend"""
    
    print("\nTesting Gemini API through local backend...")
    
    backend_url = "http://localhost:5000"
    
    # Test data for chat endpoint
    test_data = {
        "message": "Hello! Please respond with 'Backend working' to confirm the integration.",
        "currentLecture": {
            "title": "Test Lecture",
            "description": "Testing backend integration"
        },
        "messages": []
    }
    
    try:
        print(f"Sending test request to {backend_url}/api/chat...")
        response = requests.post(f"{backend_url}/api/chat", json=test_data, timeout=30)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                print(f"SUCCESS: Backend integration working! Response: {data.get('response', '').strip()}")
                return True
            else:
                print(f"ERROR: Backend returned error: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"ERROR: Backend request failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Cannot connect to backend. Make sure the backend is running on http://localhost:5000")
        return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON decode error: {e}")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        return False

def test_flashcard_generation():
    """Test flashcard generation through backend"""
    
    print("\nTesting flashcard generation through backend...")
    
    backend_url = "http://localhost:5000"
    
    # Test data for flashcard endpoint
    test_data = {
        "lecture": {
            "title": "Test Lecture for Flashcards",
            "description": "Testing flashcard generation",
            "keyConcepts": ["testing", "api", "integration"],
            "segments": [
                {"title": "Introduction", "content": "This is a test segment about testing APIs."},
                {"title": "Main Topic", "content": "API integration is important for connecting services."}
            ]
        }
    }
    
    try:
        print(f"Sending flashcard test request to {backend_url}/api/generate-flashcards...")
        response = requests.post(f"{backend_url}/api/generate-flashcards", json=test_data, timeout=30)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                flashcards = data.get('flashcards', [])
                print(f"SUCCESS: Flashcard generation working! Generated {len(flashcards)} flashcards")
                
                if flashcards:
                    print("Sample flashcard:")
                    card = flashcards[0]
                    print(f"  Q: {card.get('question', card.get('front', 'N/A'))}")
                    print(f"  A: {card.get('answer', card.get('back', 'N/A'))}")
                
                return True
            else:
                print(f"ERROR: Flashcard generation failed: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"ERROR: Flashcard request failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Cannot connect to backend. Make sure the backend is running on http://localhost:5000")
        return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON decode error: {e}")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        return False

def main():
    print("Gemini API Test Suite")
    print("=" * 50)
    
    # Test 1: Direct Gemini API
    print("\n1. Testing Direct Gemini API Connection")
    print("-" * 40)
    gemini_works = test_gemini_api()
    
    # Test 2: Backend integration
    print("\n2. Testing Backend Integration")
    print("-" * 40)
    backend_works = test_backend_integration()
    
    # Test 3: Flashcard generation
    print("\n3. Testing Flashcard Generation")
    print("-" * 40)
    flashcards_works = test_flashcard_generation()
    
    # Summary
    print("\nTest Summary")
    print("=" * 50)
    print(f"Direct Gemini API: {'PASS' if gemini_works else 'FAIL'}")
    print(f"Backend Integration: {'PASS' if backend_works else 'FAIL'}")
    print(f"Flashcard Generation: {'PASS' if flashcards_works else 'FAIL'}")
    
    if gemini_works and backend_works and flashcards_works:
        print("\nAll tests passed! Your Gemini API is working perfectly.")
        return 0
    elif gemini_works:
        print("\nWARNING: Gemini API works but backend has issues. Check your backend server.")
        return 1
    else:
        print("\nERROR: Gemini API is not working. Check your API key and network connection.")
        return 2

if __name__ == "__main__":
    sys.exit(main())
