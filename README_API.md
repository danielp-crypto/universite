# Universite AI Assistant - Python Backend

This Python backend handles Google Gemini API calls securely for the AI Learning Assistant.

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Backend Server

```bash
python api.py
```

The server will start on `http://localhost:5000` by default.

### 3. Update Frontend Configuration

Make sure the `API_BASE_URL` in `assistant.html` (and other pages like `flashcards.html`) points to your backend URL:
- Local development: `http://localhost:5000`
- Production: `https://rz1l1z65eb.execute-api.eu-north-1.amazonaws.com/prod`

## API Endpoints

### POST `/api/chat`
Send a chat message to get an AI response.

**Request Body:**
```json
{
  "message": "Explain derivatives",
  "currentLecture": {
    "title": "Introduction to Calculus",
    "date": "2024-01-15",
    "duration": "45:30",
    "keyConcepts": ["limits", "derivatives", "continuity"],
    "segments": [
      {
        "title": "Introduction to Limits",
        "startTime": "00:00",
        "concepts": ["limit definition", "approaching values"]
      }
    ]
  },
  "messages": [
    {"sender": "user", "content": "Hello"},
    {"sender": "bot", "content": "Hi there!"}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "response": "Derivatives represent the rate of change..."
}
```

### POST `/api/transcribe`
Transcribe lecture audio using Google Cloud Speech-to-Text (service account).

**Request:** `multipart/form-data` with an `audio` file (webm from browser recording, or flac/wav).

**Headers:** `Authorization: Bearer <Supabase access token>`

**Response (success):**
```json
{
  "success": true,
  "transcript": "Full text of the lecture..."
}
```

**Response (quota exceeded, 402):**
```json
{
  "success": false,
  "error": "quota_exceeded",
  "message": "Monthly lecture upload limit reached.",
  "quota": { "ok": false, "used": 3, "limit": 3 }
}
```

To enforce lecture upload quotas (e.g. 3/month on free plan), run `supabase/lecture_uploads_migration.sql` in your Supabase project.

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Environment Variables

- **PORT** – Server port (default 5000).
- **GOOGLE_APPLICATION_CREDENTIALS** – Path to the Google Cloud **service account** JSON key file used for Speech-to-Text (e.g. `project-ca44d972-cc17-42a1-9ed-432c23b5c92f.json`). If unset, the backend looks for `project-ca44d972-cc17-42a1-9ed-432c23b5c92f.json` in the same directory as `api.py` (for local dev). Do not commit the key file; add it to `.gitignore`.

You can set the `PORT` environment variable to change the server port:
```bash
export PORT=8080
python api.py
```

## Security Notes

- The Google Gemini API key is stored securely in the backend (`api.py`)
- Never commit API keys to version control in production
- Consider using environment variables for the API key in production:
  ```python
  GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'your-default-key')
  ```

## Production Deployment

For production deployment:
1. Use a production WSGI server like Gunicorn:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 api:app
   ```
2. Set up environment variables for API keys
3. Configure CORS settings for your domain
4. Use HTTPS in production
5. Update the `API_BASE_URL` in the frontend to your production server URL
6. Configure CORS to allow requests from `https://master.dopnvb05t610g.amplifyapp.com`


