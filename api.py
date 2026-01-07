from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Google Gemini API Configuration
# Use environment variable for API key in production, fallback to default for development
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyAqpapZgs2z9oussNPp68ssXeVGIRf25qo')
GEMINI_API_URL = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}'

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        current_lecture = data.get('currentLecture', None)
        messages = data.get('messages', [])
        
        # Build context from conversation history and lecture data
        system_prompt = "You are an AI learning assistant helping students study their lecture content. "
        
        if current_lecture:
            lecture = current_lecture
            system_prompt += f"""
Current Lecture Information:
Title: {lecture.get('title', 'Unknown')}
Date: {lecture.get('date', 'Unknown')}
Duration: {lecture.get('duration', 'Unknown')}
Key Concepts: {', '.join(lecture.get('keyConcepts', []))}
Segments:
{chr(10).join([f"- {s.get('title', 'Unknown')} ({s.get('startTime', 'Unknown')}): {', '.join(s.get('concepts', []))}" for s in lecture.get('segments', [])])}

Use this lecture information to provide contextually relevant responses."""
        else:
            system_prompt += "\n\nNo lecture content is available yet. Please guide the user to record or upload a lecture."
        
        # Build conversation history
        conversation_history = ''
        if messages:
            recent_messages = messages[-6:]  # Last 6 messages for context
            conversation_history = '\n\nRecent conversation:\n'
            for msg in recent_messages:
                sender_label = 'Student' if msg.get('sender') == 'user' else 'Assistant'
                conversation_history += f"{sender_label}: {msg.get('content', '')}\n"
        
        full_prompt = system_prompt + conversation_history + f"\n\nStudent: {user_message}\nAssistant:"
        
        # Call Google Gemini API
        response = requests.post(
            GEMINI_API_URL,
            json={
                'contents': [{
                    'parts': [{
                        'text': full_prompt
                    }]
                }]
            },
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code != 200:
            error_data = response.json()
            return jsonify({
                'success': False,
                'error': error_data.get('error', {}).get('message', 'Failed to get response from Gemini API')
            }), response.status_code
        
        result = response.json()
        
        if result.get('candidates') and len(result['candidates']) > 0:
            if result['candidates'][0].get('content'):
                response_text = result['candidates'][0]['content']['parts'][0]['text']
                return jsonify({
                    'success': True,
                    'response': response_text
                })
        
        return jsonify({
            'success': False,
            'error': 'Invalid response format from Gemini API'
        }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

