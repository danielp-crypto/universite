from flask import Flask, request, jsonify, g
from flask_cors import CORS
import requests
import os
import jwt
from jwt import PyJWKClient

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Supabase configuration (do NOT hardcode secrets; anon key is okay to ship in frontend,
# but backend reads it from env to call Supabase RPC consistently).
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# Google Gemini API Configuration
# Use environment variable for API key in production, fallback to default for development
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyAqpapZgs2z9oussNPp68ssXeVGIRf25qo')
GEMINI_API_URL = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}'

_jwks_client = None

def _get_jwks_client():
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not set")
    jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client

def _get_bearer_token():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ', 1)[1].strip()

def require_supabase_user():
    """
    Validates Supabase JWT (access token) and stores user id in flask.g.
    """
    token = _get_bearer_token()
    if not token:
        return False, ("missing_auth", 401)

    try:
        jwk_client = _get_jwks_client()
        signing_key = jwk_client.get_signing_key_from_jwt(token).key
        decoded = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
            issuer=f"{SUPABASE_URL}/auth/v1"
        )
        user_id = decoded.get('sub')
        if not user_id:
            return False, ("invalid_token", 401)
        g.supabase_user_id = user_id
        g.supabase_access_token = token
        return True, None
    except Exception as e:
        return False, (str(e), 401)

def consume_quota(action: str, amount: int = 1):
    """
    Calls Supabase RPC `consume_quota` using the user's JWT. Returns (ok, payload_or_error).
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return False, {"error": "SUPABASE_URL/SUPABASE_ANON_KEY not configured on backend"}

    token = getattr(g, "supabase_access_token", None)
    if not token:
        return False, {"error": "missing_auth"}

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/consume_quota",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"p_action": action, "p_amount": amount},
        timeout=15,
    )
    if resp.status_code >= 400:
        return False, {"error": "quota_rpc_failed", "details": resp.text}
    try:
        data = resp.json()
    except Exception:
        return False, {"error": "quota_rpc_invalid_json", "details": resp.text}
    return True, data

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        qok, qdata = consume_quota("chat_messages", 1)
        if not qok:
            return jsonify({"success": False, "error": "quota_check_failed", "details": qdata}), 503
        if not qdata.get("ok", False):
            return jsonify({
                "success": False,
                "error": "quota_exceeded",
                "quota": qdata
            }), 402

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

@app.route('/api/generate-flashcards', methods=['POST'])
def generate_flashcards():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        qok, qdata = consume_quota("flashcard_generations", 1)
        if not qok:
            return jsonify({"success": False, "error": "quota_check_failed", "details": qdata}), 503
        if not qdata.get("ok", False):
            return jsonify({
                "success": False,
                "error": "quota_exceeded",
                "quota": qdata
            }), 402

        data = request.get_json()
        lecture = data.get('lecture', {})
        
        # Use Gemini to generate flashcards from lecture content
        prompt = f"""Based on this lecture content, generate 10-15 educational flashcards in JSON format.
        
Lecture Title: {lecture.get('title', 'Unknown')}
Key Concepts: {', '.join(lecture.get('keyConcepts', []))}
Segments: {', '.join([s.get('title', '') for s in lecture.get('segments', [])])}

Generate flashcards as a JSON array with this structure:
[
  {{"question": "What is...?", "answer": "The answer is...", "category": "concept name"}},
  ...
]

Return ONLY the JSON array, no other text."""

        response = requests.post(
            GEMINI_API_URL,
            json={
                'contents': [{
                    'parts': [{'text': prompt}]
                }]
            },
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'error': 'Failed to generate flashcards'
            }), response.status_code
        
        result = response.json()
        if result.get('candidates') and len(result['candidates']) > 0:
            response_text = result['candidates'][0]['content']['parts'][0]['text']
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                import json
                flashcards = json.loads(json_match.group())
                return jsonify({
                    'success': True,
                    'flashcards': flashcards
                })
        
        return jsonify({
            'success': False,
            'error': 'Failed to parse flashcards'
        }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """
    Audio transcription endpoint - STUBBED for now
    When audio transcription API key is available, implement here
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        # This is a stub - will be implemented when transcription API key is available
        # For now, return a mock response
        
        # In production, this would:
        # 1. Receive audio file from request
        # 2. Call transcription API (e.g., Google Speech-to-Text, Whisper, etc.)
        # 3. Process and return transcript
        
        return jsonify({
            'success': False,
            'error': 'Transcription API key not configured yet. Please add your transcription API key to enable this feature.',
            'stub': True
        }), 503
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/process-lecture', methods=['POST'])
def process_lecture():
    """
    Process uploaded/recorded lecture audio
    This will call transcription and then extract concepts/segments
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        # Stub for now - will process audio when transcription is available
        return jsonify({
            'success': False,
            'error': 'Audio transcription not available yet. Please add transcription API key.',
            'stub': True
        }), 503
        
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

