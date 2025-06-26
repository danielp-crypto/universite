from flask import Flask, request, jsonify
from flask_cors import CORS
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential
import os

app = Flask(__name__)
CORS(app)

# Set up your GitHub token as an environment variable or hardcode temporarily (not recommended)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not GITHUB_TOKEN:
    raise EnvironmentError("❌ GITHUB_TOKEN is not set in environment variables.")

# Initialize the Azure Inference client
client = ChatCompletionsClient(
    endpoint="https://models.github.ai/inference",
    credential=AzureKeyCredential(GITHUB_TOKEN)
)

MODEL_NAME = "openai/gpt-4.1"

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()

        if not user_message:
            return jsonify({'reply': '⚠️ No message received.'})

        response = client.complete(
            messages=[
                SystemMessage(content="You are a helpful assistant."),
                UserMessage(content=user_message),
            ],
            temperature=1,
            top_p=1,
            model=MODEL_NAME
        )

        reply = response.choices[0].message.content.strip()
        return jsonify({'reply': reply})

    except Exception as e:
        return jsonify({'reply': f"❌ Exception occurred: {str(e)}"})


if __name__ == '__main__':
    app.run(debug=True)
