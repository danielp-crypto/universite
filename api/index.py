from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
import requests
import os
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')


# Deepgram Transcription Configuration
DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY', '')
DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen'


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
    token = _get_bearer_token()
    if not token:
        return False, ("missing_auth", 401)

    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        alg = unverified.get('alg', 'RS256')
        
        if alg == 'HS256':
            signing_key = SUPABASE_ANON_KEY
        else:
            jwk_client = _get_jwks_client()
            signing_key = jwk_client.get_signing_key_from_jwt(token).key
        
        decoded = jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
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

def call_supabase_rpc(function_name, params):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return {"error": "SUPABASE_URL/SUPABASE_ANON_KEY not configured on backend"}

    token = getattr(g, "supabase_access_token", None)
    if not token:
        return {"error": "missing_auth"}

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{function_name}",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=params,
        timeout=15,
    )
    if resp.status_code >= 400:
        return {"error": f"rpc_failed", "details": resp.text}
    try:
        return resp.json()
    except Exception:
        return {"error": "rpc_invalid_json", "details": resp.text}

def execute_supabase_query(query, params=None):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise Exception("SUPABASE_URL/SUPABASE_ANON_KEY not configured on backend")

    token = getattr(g, "supabase_access_token", None)
    if not token:
        raise Exception("missing_auth")

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/execute_sql",
        headers=headers,
        json={"query": query, "params": params},
        timeout=15,
    )

    if resp.status_code >= 400:
        raise Exception(f"Query failed: {resp.text}")
    
    try:
        return resp.json()
    except Exception:
        return []

def consume_quota(action: str, amount: int = 1):
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

# Static files are served by Vercel, not Flask

@app.route('/chat', methods=['POST'])
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
        
        conversation_history = ''
        if messages:
            recent_messages = messages[-6:]
            conversation_history = '\n\nRecent conversation:\n'
            for msg in recent_messages:
                sender_label = 'Student' if msg.get('sender') == 'user' else 'Assistant'
                conversation_history += f"{sender_label}: {msg.get('content', '')}\n"
        
        full_prompt = system_prompt + conversation_history + f"\n\nStudent: {user_message}\nAssistant:"
        
        response = requests.post(
            HUGGINGFACE_API_URL,
            json={
                'inputs': full_prompt,
                'parameters': {
                    'max_length': 500,
                    'temperature': 0.7,
                    'do_sample': True,
                    'top_p': 0.9,
                    'return_full_text': False
                }
            },
            headers={
                'Authorization': f'Bearer {HUGGINGFACE_API_KEY}',
                'Content-Type': 'application/json'
            }
        )
        
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'error': 'Hugging Face API error'
            }), 500
        
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            response_text = result[0].get('generated_text', '')
            return jsonify({
                'success': True,
                'response': response_text.strip()
            })
        
        return jsonify({
            'success': False,
            'error': 'Failed to parse response'
        }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/generate-flashcards', methods=['POST'])
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
            HUGGINGFACE_API_URL,
            json={
                'inputs': prompt,
                'parameters': {
                    'max_length': 1000,
                    'temperature': 0.7,
                    'do_sample': True,
                    'top_p': 0.9,
                    'return_full_text': False
                }
            },
            headers={
                'Authorization': f'Bearer {HUGGINGFACE_API_KEY}',
                'Content-Type': 'application/json'
            }
        )
        
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'error': 'Failed to generate flashcards'
            }), response.status_code
        
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            response_text = result[0].get('generated_text', '')
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

def _transcribe_audio(audio_content: bytes, content_type: str) -> str:
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY not set")

    import io
    audio_file = io.BytesIO(audio_content)
    
    filename = 'audio'
    if content_type:
        if 'wav' in content_type.lower():
            filename += '.wav'
        elif 'mp3' in content_type.lower():
            filename += '.mp3'
        elif 'webm' in content_type.lower():
            filename += '.webm'
        elif 'flac' in content_type.lower():
            filename += '.flac'
        else:
            filename += '.audio'

    files = {
        'file': (filename, audio_file, content_type or 'audio/wav')
    }

    data = {
        'model': 'nova-2',
        'language': 'en-US',
        'punctuate': 'true',
        'utterances': 'true'
    }

    max_retries = 3
    retry_delay = 1

    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.post(
                DEEPGRAM_API_URL,
                headers={
                    'Authorization': f'Token {DEEPGRAM_API_KEY}'
                },
                files=files,
                data=data,
                timeout=300
            )

            if response.status_code == 200:
                result = response.json()
                
                if result.get('results') and len(result['results']) > 0:
                    transcripts = []
                    for r in result['results']:
                        if r.get('alternatives') and len(r['alternatives']) > 0:
                            transcripts.append(r['alternatives'][0].get('transcript', ''))
                    
                    transcript_text = ' '.join(transcripts).strip()
                    return transcript_text if transcript_text else ""
                else:
                    return ""
            else:
                last_error = f"Deepgram API error: {response.status_code} - {response.text}"
                
        except Exception as e:
            last_error = str(e)

        if attempt < max_retries - 1:
            import time
            time.sleep(retry_delay)
            retry_delay *= 2

    raise RuntimeError(f"Transcription failed after {max_retries} attempts: {last_error}")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        qok, qdata = consume_quota("lecture_uploads", 1)
        if qok and qdata.get("ok") is False:
            return jsonify({
                "success": False,
                "error": "quota_exceeded",
                "message": "Monthly lecture upload limit reached.",
                "quota": qdata,
            }), 402

        audio_file = request.files.get("audio")
        if not audio_file:
            return jsonify({"success": False, "error": "missing_audio"}), 400

        audio_content = audio_file.read()
        if not audio_content:
            return jsonify({"success": False, "error": "empty_audio"}), 400

        content_type = (audio_file.content_type or "").strip().lower()

        try:
            transcript_text = _transcribe_audio(audio_content, content_type)
        except RuntimeError as e:
            if "DEEPGRAM_API_KEY" in str(e):
                return jsonify({
                    "success": False,
                    "error": "Transcription not configured. Set DEEPGRAM_API_KEY to your Deepgram API key.",
                }), 503
            raise
        except Exception as e:
            return jsonify({
                "success": False,
                "error": "Transcription failed.",
                "detail": str(e),
            }), 502

        if not transcript_text:
            return jsonify({
                "success": False,
                "error": "No speech detected in audio.",
            }), 422

        return jsonify({
            "success": True,
            "transcript": transcript_text,
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
        }), 500

@app.route('/process-lecture', methods=['POST'])
def process_lecture():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

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

@app.route('/lectures', methods=['GET'])
def get_lectures():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.supabase_user_id
        filter_type = request.args.get('filter', 'all')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        if filter_type == 'favorites':
            where_clause = "user_id = %s AND favorite = true"
        elif filter_type == 'recent':
            where_clause = "user_id = %s AND created_at >= NOW() - INTERVAL '7 days'"
        else:
            where_clause = "user_id = %s"

        query = f"""
        SELECT l.*, 
               COUNT(ls.id) as segment_count
        FROM lectures l
        LEFT JOIN lecture_segments ls ON l.id = ls.lecture_id
        WHERE {where_clause}
        GROUP BY l.id
        ORDER BY l.created_at DESC
        LIMIT %s OFFSET %s
        """

        result = execute_supabase_query(query, (user_id, limit, offset))
        
        return jsonify({
            'success': True,
            'lectures': result,
            'filter': filter_type,
            'total': len(result)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/lectures', methods=['POST'])
def create_lecture():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        quota_result = call_supabase_rpc('consume_quota', {'p_action': 'lecture_uploads', 'p_amount': 1})
        if not quota_result.get('ok'):
            return jsonify({
                'success': False,
                'error': 'Monthly lecture upload limit exceeded',
                'quota': quota_result
            }), 429

        data = request.get_json()
        user_id = g.supabase_user_id

        if not data.get('title'):
            return jsonify({
                'success': False,
                'error': 'Title is required'
            }), 400

        query = """
        INSERT INTO lectures (user_id, title, description, duration_seconds, file_path, 
                             file_size, mime_type, status, tags)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, created_at, updated_at
        """

        params = (
            user_id,
            data['title'],
            data.get('description'),
            data.get('duration_seconds'),
            data.get('file_path'),
            data.get('file_size'),
            data.get('mime_type'),
            data.get('status', 'processing'),
            data.get('tags', [])
        )

        result = execute_supabase_query(query, params)
        
        if result:
            lecture = result[0]
            return jsonify({
                'success': True,
                'lecture': {
                    'id': lecture['id'],
                    'user_id': user_id,
                    'title': data['title'],
                    'description': data.get('description'),
                    'duration_seconds': data.get('duration_seconds'),
                    'file_path': data.get('file_path'),
                    'file_size': data.get('file_size'),
                    'mime_type': data.get('mime_type'),
                    'status': data.get('status', 'processing'),
                    'tags': data.get('tags', []),
                    'created_at': lecture['created_at'],
                    'updated_at': lecture['updated_at']
                },
                'quota': quota_result
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create lecture'
            }), 500

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/lectures/<lecture_id>', methods=['GET'])
def get_lecture(lecture_id):
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.supabase_user_id

        lecture_query = """
        SELECT * FROM lectures 
        WHERE id = %s AND user_id = %s
        """
        lecture_result = execute_supabase_query(lecture_query, (lecture_id, user_id))
        
        if not lecture_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        lecture = lecture_result[0]

        segments_query = """
        SELECT * FROM lecture_segments 
        WHERE lecture_id = %s 
        ORDER BY start_time_seconds
        """
        segments_result = execute_supabase_query(segments_query, (lecture_id,))

        return jsonify({
            'success': True,
            'lecture': lecture,
            'segments': segments_result
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/lectures/<lecture_id>', methods=['PUT'])
def update_lecture(lecture_id):
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.supabase_user_id
        data = request.get_json()

        check_query = "SELECT id FROM lectures WHERE id = %s AND user_id = %s"
        check_result = execute_supabase_query(check_query, (lecture_id, user_id))
        
        if not check_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        update_fields = []
        params = []
        
        for field in ['title', 'description', 'transcription', 'summary', 'status', 'favorite']:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])

        if update_fields:
            params.extend([lecture_id, user_id])
            query = f"""
            UPDATE lectures 
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING *
            """
            
            result = execute_supabase_query(query, params)
            
            if result:
                return jsonify({
                    'success': True,
                    'lecture': result[0]
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to update lecture'
                }), 500
        else:
            return jsonify({
                'success': False,
                'error': 'No valid fields to update'
            }), 400

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/lectures/<lecture_id>', methods=['DELETE'])
def delete_lecture(lecture_id):
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.supabase_user_id

        check_query = "SELECT file_path FROM lectures WHERE id = %s AND user_id = %s"
        check_result = execute_supabase_query(check_query, (lecture_id, user_id))
        
        if not check_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        delete_query = "DELETE FROM lectures WHERE id = %s AND user_id = %s"
        execute_supabase_query(delete_query, (lecture_id, user_id))

        return jsonify({
            'success': True,
            'message': 'Lecture deleted successfully'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/lectures/<lecture_id>/segments', methods=['POST'])
def create_lecture_segment(lecture_id):
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.supabase_user_id
        data = request.get_json()

        required_fields = ['start_time_seconds', 'end_time_seconds', 'title', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'{field} is required'
                }), 400

        check_query = "SELECT id FROM lectures WHERE id = %s AND user_id = %s"
        check_result = execute_supabase_query(check_query, (lecture_id, user_id))
        
        if not check_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        query = """
        INSERT INTO lecture_segments (lecture_id, start_time_seconds, end_time_seconds, 
                                     title, content, key_concepts)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, created_at
        """

        params = (
            lecture_id,
            data['start_time_seconds'],
            data['end_time_seconds'],
            data['title'],
            data['content'],
            data.get('key_concepts', [])
        )

        result = execute_supabase_query(query, params)
        
        if result:
            segment = result[0]
            return jsonify({
                'success': True,
                'segment': {
                    'id': segment['id'],
                    'lecture_id': lecture_id,
                    'start_time_seconds': data['start_time_seconds'],
                    'end_time_seconds': data['end_time_seconds'],
                    'title': data['title'],
                    'content': data['content'],
                    'key_concepts': data.get('key_concepts', []),
                    'created_at': segment['created_at']
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create segment'
            }), 500

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/test-huggingface', methods=['POST'])
def test_huggingface():
    try:
        data = request.get_json()
        message = data.get('message', 'Hello! Please respond with "API working" to confirm.')
        
        hf_request = {
            "inputs": message,
            "parameters": {
                "max_length": 200,
                "temperature": 0.7,
                "do_sample": True,
                "top_p": 0.9,
                "return_full_text": False
            }
        }
        
        response = requests.post(HUGGINGFACE_API_URL, json=hf_request, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                text = result[0].get('generated_text', '')
                return jsonify({
                    'success': True,
                    'response': text.strip(),
                    'model': 'huggingface-dialoGPT'
                }), 200
        
        return jsonify({
            'success': False,
            'error': 'Hugging Face API error'
        }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/deepgram/test', methods=['GET'])
def test_deepgram():
    try:
        if not DEEPGRAM_API_KEY:
            return jsonify({
                'success': False,
                'error': 'DEEPGRAM_API_KEY not configured'
            }), 503
        
        return jsonify({
            'success': True,
            'message': 'Deepgram API key is configured'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Proxy error: {str(e)}'
        }), 500

@app.route('/deepgram/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        file = request.files.get('file')
        if not file:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        if not DEEPGRAM_API_KEY:
            return jsonify({
                'success': False,
                'error': 'DEEPGRAM_API_KEY not configured'
            }), 503

        deepgram_url = 'https://api.deepgram.com/v1/listen'
        headers = {
            'Authorization': f'Token {DEEPGRAM_API_KEY}'
        }
        params = {
            'model': 'nova-2',
            'language': 'en-US',
            'punctuate': 'true',
            'utterances': 'true'
        }
        
        files = {
            'file': (file.filename, file.stream, file.content_type or 'audio/wav')
        }
        
        response = requests.post(deepgram_url, headers=headers, files=files, params=params, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            return jsonify({
                'success': True,
                'transcript': result.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', ''),
                'confidence': result.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('confidence', 0),
                'duration': result.get('metadata', {}).get('duration', 0),
                'raw_response': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': f'Deepgram transcription error: {response.status_code} - {response.text}'
            }), response.status_code
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Transcription proxy error: {str(e)}'
        }), 500

# Vercel Python serverless function
# Export the Flask app as a WSGI application
application = app
