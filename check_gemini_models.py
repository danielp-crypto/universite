#!/usr/bin/env python3
"""
Check what Gemini models are available
"""

import requests
import json
import os

def list_gemini_models():
    """List available Gemini models"""
    
    api_key = os.environ.get('GEMINI_API_KEY', 'AIzaSyBP_X2pw5Sz4zFiaIFVBD-00opo4wksGj8')
    
    print("Testing Gemini API model availability...")
    print(f"API Key: {api_key[:20]}...")
    
    # Try different API versions and models
    test_configs = [
        {
            'name': 'v1beta - gemini-1.5-flash',
            'url': f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}'
        },
        {
            'name': 'v1beta - gemini-1.5-pro',
            'url': f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={api_key}'
        },
        {
            'name': 'v1 - gemini-1.5-flash',
            'url': f'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}'
        },
        {
            'name': 'v1 - gemini-pro',
            'url': f'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={api_key}'
        },
        {
            'name': 'v1beta - gemini-pro',
            'url': f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={api_key}'
        }
    ]
    
    test_data = {
        "contents": [{
            "parts": [{
                "text": "Hello! Please respond with 'API working' to confirm."
            }]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "topK": 32,
            "topP": 0.95,
            "maxOutputTokens": 100
        }
    }
    
    for config in test_configs:
        print(f"\nTesting: {config['name']}")
        print(f"URL: {config['url'][:50]}...")
        
        try:
            response = requests.post(config['url'], json=test_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'candidates' in data and len(data['candidates']) > 0:
                    candidate = data['candidates'][0]
                    if 'content' in candidate and 'parts' in candidate['content']:
                        text = candidate['content']['parts'][0]['text']
                        print(f"SUCCESS: {text.strip()}")
                    else:
                        print("No content in response")
                else:
                    print("No candidates in response")
            else:
                print(f"HTTP {response.status_code}: {response.text[:200]}")
                
        except requests.exceptions.RequestException as e:
            print(f"Network error: {e}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    list_gemini_models()
