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

Make sure the `API_BASE_URL` in `assistant.html` points to your backend URL:
- Local development: `http://localhost:5000`
- Production: Update to your production server URL

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

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Environment Variables

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


