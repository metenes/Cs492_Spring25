from flask import Flask, jsonify, request
from pymongo import MongoClient
from datetime import datetime, timedelta
from collections import Counter
import torch

app = Flask(__name__)
mongo = MongoClient("mongodb://localhost:27017/")
db = mongo.chatbot

@app.route("/stats/summary", methods=["GET"])
def get_global_stats():
    try:
        last_30_days = datetime.utcnow() - timedelta(days=30)
        sentiments = db.sentiments.find({"timestamp": {"$gte": last_30_days.isoformat()}})

        total = 0
        user_ids = set()
        user_sentiments = []

        for s in sentiments:
            total += 1
            user_ids.add(s["user_id"])
            user_sentiments.append(s["user_sentiment"]["label"])

        counter = Counter(user_sentiments)
        trend = [{"label": k, "count": v} for k, v in counter.items()]

        return jsonify({
            "total_entries": total,
            "unique_users": len(user_ids),
            "sentiment_trends": trend
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/analyze-multimodal", methods=["POST"])
def fusion():
    try:
        audio = request.files["audio"].read()
        face = request.files.get("face")  # optional

        # 1. Transcribe
        waveform, _ = torchaudio.load(io.BytesIO(audio))
        stt = asr_tokenizer(waveform[0], return_tensors="pt")
        logits = asr_model(**stt).logits
        ids = torch.argmax(logits, dim=-1)
        transcript = asr_tokenizer.decode(ids[0])

        # 2. Tone analysis
        tone = analyze_audio_emotion(audio)

        # 3. (Optional) Face analysis
        face_emotion = detect_face_expression(face) if face else "not provided"

        return jsonify({
            "transcript": transcript,
            "vocal_tone": tone,
            "face_emotion": face_emotion
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
