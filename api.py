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

# Google Cloud Speech-to-Text: use service account from env (path to JSON key file)
GOOGLE_APPLICATION_CREDENTIALS = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', '')

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

def call_supabase_rpc(function_name, params):
    """
    Generic function to call Supabase RPC functions
    """
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
    """
    Execute a SQL query against Supabase using PostgREST
    """
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

    # For SELECT queries
    if query.strip().upper().startswith('SELECT'):
        # Convert to PostgREST format
        # This is a simplified version - in production you'd want to use the Supabase client
        # or build proper REST API calls
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/execute_sql",
            headers=headers,
            json={"query": query, "params": params},
            timeout=15,
        )
    else:
        # For INSERT/UPDATE/DELETE - use RPC
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

def _transcribe_audio(audio_content: bytes, content_type: str) -> str:
    """
    Transcribe audio using Google Cloud Speech-to-Text (service account).
    Supports webm/opus (browser MediaRecorder) and common formats.
    """
    if not GOOGLE_APPLICATION_CREDENTIALS or not os.path.isfile(GOOGLE_APPLICATION_CREDENTIALS):
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not set or file not found")

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_APPLICATION_CREDENTIALS
    from google.cloud import speech_v1 as speech

    client = speech.SpeechClient()
    # Browser MediaRecorder typically produces webm with opus
    encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
    sample_rate = 48000
    if content_type and "flac" in content_type.lower():
        encoding = speech.RecognitionConfig.AudioEncoding.FLAC
        sample_rate = 44100
    elif content_type and "wav" in content_type.lower():
        encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
        sample_rate = 16000

    config = speech.RecognitionConfig(
        encoding=encoding,
        sample_rate_hertz=sample_rate,
        language_code="en-US",
        enable_automatic_punctuation=True,
    )
    audio = speech.RecognitionAudio(content=audio_content)

    # Long-running recognize for lectures (can be several minutes)
    operation = client.long_running_recognize(config=config, audio=audio)
    response = operation.result(timeout=600)
    transcript_parts = []
    for result in response.results:
        if result.alternatives:
            transcript_parts.append(result.alternatives[0].transcript)
    return " ".join(transcript_parts).strip() if transcript_parts else ""


@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """
    Audio transcription endpoint using Google Cloud Speech-to-Text (service account).
    Expects multipart/form-data with an 'audio' file (webm, flac, or wav).
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        # Consume lecture_uploads quota when schema supports it (run supabase/lecture_uploads_migration.sql)
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
            if "GOOGLE_APPLICATION_CREDENTIALS" in str(e):
                return jsonify({
                    "success": False,
                    "error": "Transcription not configured. Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.",
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

@app.route('/api/lectures', methods=['GET'])
def get_lectures():
    """
    Get user's lectures with optional filtering
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.user_id
        filter_type = request.args.get('filter', 'all')  # all, favorites, recent
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        # Build query based on filter
        if filter_type == 'favorites':
            where_clause = "user_id = %s AND favorite = true"
        elif filter_type == 'recent':
            where_clause = "user_id = %s AND created_at >= NOW() - INTERVAL '7 days'"
        else:
            where_clause = "user_id = %s"

        query = f"""
        SELECT l.*, 
               COUNT(ls.id) as segment_count,
               CASE 
                 WHEN l.transcription IS NOT NULL AND l.transcription != '' THEN 
                   array_length(regexp_split_to_array(l.transcription, '\s'), 1)
                 ELSE 0 
               END as word_count
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

@app.route('/api/lectures', methods=['POST'])
def create_lecture():
    """
    Create a new lecture record
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        # Check quota for lecture uploads
        quota_result = call_supabase_rpc('consume_quota', {'p_action': 'lecture_uploads', 'p_amount': 1})
        if not quota_result.get('ok'):
            return jsonify({
                'success': False,
                'error': 'Monthly lecture upload limit exceeded',
                'quota': quota_result
            }), 429

        data = request.get_json()
        user_id = g.user_id

        # Validate required fields
        if not data.get('title'):
            return jsonify({
                'success': False,
                'error': 'Title is required'
            }), 400

        # Insert lecture
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

@app.route('/api/lectures/<lecture_id>', methods=['GET'])
def get_lecture(lecture_id):
    """
    Get a specific lecture with its segments
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.user_id

        # Get lecture details
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

        # Get lecture segments
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

@app.route('/api/lectures/<lecture_id>', methods=['PUT'])
def update_lecture(lecture_id):
    """
    Update lecture details
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.user_id
        data = request.get_json()

        # Check if lecture exists and belongs to user
        check_query = "SELECT id FROM lectures WHERE id = %s AND user_id = %s"
        check_result = execute_supabase_query(check_query, (lecture_id, user_id))
        
        if not check_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        # Build update query dynamically
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

@app.route('/api/lectures/<lecture_id>', methods=['DELETE'])
def delete_lecture(lecture_id):
    """
    Delete a lecture and its segments
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.user_id

        # Check if lecture exists and belongs to user
        check_query = "SELECT file_path FROM lectures WHERE id = %s AND user_id = %s"
        check_result = execute_supabase_query(check_query, (lecture_id, user_id))
        
        if not check_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        lecture = check_result[0]
        
        # Delete lecture (segments will be deleted by cascade)
        delete_query = "DELETE FROM lectures WHERE id = %s AND user_id = %s"
        execute_supabase_query(delete_query, (lecture_id, user_id))

        # TODO: Delete file from Supabase Storage if file_path exists
        # This would require additional storage client setup

        return jsonify({
            'success': True,
            'message': 'Lecture deleted successfully'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/lectures/<lecture_id>/segments', methods=['POST'])
def create_lecture_segment(lecture_id):
    """
    Create a new lecture segment
    """
    try:
        ok, err = require_supabase_user()
        if not ok:
            msg, code = err
            return jsonify({"success": False, "error": msg}), code

        user_id = g.user_id
        data = request.get_json()

        # Validate required fields
        required_fields = ['start_time_seconds', 'end_time_seconds', 'title', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'{field} is required'
                }), 400

        # Check if lecture exists and belongs to user
        check_query = "SELECT id FROM lectures WHERE id = %s AND user_id = %s"
        check_result = execute_supabase_query(check_query, (lecture_id, user_id))
        
        if not check_result:
            return jsonify({
                'success': False,
                'error': 'Lecture not found'
            }), 404

        # Insert segment
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

