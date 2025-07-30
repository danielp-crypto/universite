# STEP 1: PDF -> TEXT -> GPT-4 -> NARRATION -> MP3
# Backend script using Python (FastAPI + OpenAI + ElevenLabs)

from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel
import fitz  # PyMuPDF
import openai
import requests
import os

app = FastAPI()

# Set your keys
OPENAI_API_KEY = "your-openai-api-key"
ELEVENLABS_API_KEY = "your-elevenlabs-api-key"
VOICE_ID = "your-voice-id"  # From ElevenLabs dashboard

openai.api_key = OPENAI_API_KEY

class GPTRequest(BaseModel):
    text: str

@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    contents = await file.read()
    with open("temp.pdf", "wb") as f:
        f.write(contents)

    doc = fitz.open("temp.pdf")
    text = "\n".join([page.get_text() for page in doc])
    return {"text": text[:4000]}  # Limit for initial GPT use

@app.post("/generate-script/")
def generate_script(request: GPTRequest):
    prompt = f"""
    You're a teaching assistant. Turn the following textbook content into a short, friendly narration script for an animated video. Focus on clarity and engagement.

    Text:
    {request.text}
    """
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    return {"script": response.choices[0].message['content']}

@app.post("/generate-voice/")
def generate_voice(request: GPTRequest):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "text": request.text,
        "voice_settings": {"stability": 0.7, "similarity_boost": 0.7}
    }
    response = requests.post(url, json=data, headers=headers)
    with open("narration.mp3", "wb") as f:
        f.write(response.content)
    return {"audio_file": "narration.mp3"}
