# ========================= emved_server.py (on EC2) =========================
"""
For word2vec embeding for the journal entries, 
guided journal entries and check-ins 
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
import base64
from io import BytesIO
from PIL import Image
import boto3
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# --- S3 Configuration (optional) ---
app = Flask(__name__)
S3_BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"
s3_client = boto3.client("s3")  # Requires IAM config or env vars

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    user_id = data.get("user_id")
    image_b64 = data.get("image_base64")

    if not image_b64:
        return jsonify({"error": "No image provided"}), 400

    try:
        image_data = base64.b64decode(image_b64)
        image = Image.open(BytesIO(image_data)).convert("RGB")

        # Run DeepFace Emotion Analysis
        analysis = DeepFace.analyze(img_path=image, actions=["emotion"], enforce_detection=False)
        emotion_result = analysis[0]["dominant_emotion"]

        # Optional: Upload to S3
        filename = f"{user_id}_{datetime.now().isoformat()}.jpg"
        image.save(filename)
        s3_key = f"user_uploads/{user_id}/{filename}"
        s3_client.upload_file(filename, S3_BUCKET, s3_key)
        os.remove(filename)

        return jsonify({
            "emotion_result": emotion_result,
            "s3_url": f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
        })

    except Exception as e:
        print("Prediction error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
