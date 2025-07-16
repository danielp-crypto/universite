from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://models.github.ai/inference")
MODEL_NAME = os.getenv("MODEL_NAME", "openai/gpt-4.1")

if not GITHUB_TOKEN:
    raise EnvironmentError("❌ GITHUB_TOKEN is not set.")

client = ChatCompletionsClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(GITHUB_TOKEN)
)

@app.route('/')
def index():
    return render_template('notes.html')

@app.route('/generate-notes', methods=['POST'])
def generate_notes():
    try:
        data = request.get_json()
        topic = data.get('topic', '').strip()

        if not topic:
            return jsonify({'error': '⚠️ Topic is required.'}), 400

        response = client.complete(
            messages=[
                SystemMessage(content="You are an assistant that creates clear, structured study notes for students. Summarize content into bullet points, examples, and key takeaways."),
                UserMessage(content=f"Create detailed study notes about: {topic}"),
            ],
            temperature=0.7,
            top_p=1,
            model=MODEL_NAME
        )

        notes = response.choices[0].message.content.strip()
        return jsonify({'notes': notes})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
