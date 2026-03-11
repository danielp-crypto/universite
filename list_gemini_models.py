#!/usr/bin/env python3
"""
List available Gemini models
"""

import requests
import json

def list_available_models():
    """List available Gemini models"""
    
    api_key = 'AIzaSyAqpapZgs2z9oussNPp68ssXeVGIRf25qo'
    
    print("Listing available Gemini models...")
    print(f"API Key: {api_key[:20]}...")
    
    # Try ListModels endpoint for different versions
    test_configs = [
        {
            'name': 'v1beta ListModels',
            'url': f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}'
        },
        {
            'name': 'v1 ListModels',
            'url': f'https://generativelanguage.googleapis.com/v1/models?key={api_key}'
        }
    ]
    
    for config in test_configs:
        print(f"\nTesting: {config['name']}")
        print(f"URL: {config['url'][:50]}...")
        
        try:
            response = requests.get(config['url'], timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'models' in data:
                    print(f"Available models ({len(data['models'])} total):")
                    for model in data['models']:
                        print(f"  - {model.get('name', 'Unknown')} (supported: {model.get('supportedGenerationMethods', [])})")
                else:
                    print("No models found in response")
            else:
                print(f"HTTP {response.status_code}: {response.text[:200]}")
                
        except requests.exceptions.RequestException as e:
            print(f"Network error: {e}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    list_available_models()
