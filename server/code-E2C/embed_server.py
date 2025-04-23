# ========================= emved_server.py (on EC2) =========================
"""
For word2vec embeding for the journal entries, 
guided journal entries and check-ins 

Helper models for the general sentiment analysis 

"""

from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModel,  Wav2Vec2ForCTC, Wav2Vec2Tokenizer
import torch, io
import torchaudio
from multimodal_utils import analyze_audio_emotion

app = Flask(__name__)
model_name = "sentence-transformers/all-MiniLM-L6-v2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

@app.route("/embed", methods=["POST"])
def embed():
    try:
        texts = request.json.get("texts", [])
        inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            model_output = model(**inputs)
        embeddings = model_output.last_hidden_state.mean(dim=1).tolist()
        return jsonify({"embeddings": embeddings})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
