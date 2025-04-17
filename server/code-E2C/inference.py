import os
import json
import torch
import boto3
from flask import Flask, request, jsonify
from transformers import BertTokenizer, BertForSequenceClassification
from botocore.exceptions import ClientError

# Setup
app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"
EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
s3 = boto3.client("s3")

# Cache
last_user_id = None
cached_model = None

def load_model_for_user(user_id):
    global last_user_id, cached_model

    if user_id == last_user_id and cached_model:
        return cached_model

    model_key = f"models/{user_id}/model.pt"
    local_path = f"/tmp/{user_id}_model.pt"

    try:
        s3.download_file(BUCKET, model_key, local_path)
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            print(f"[INFO] User model not found, copying base model...")
            s3.copy_object(
                Bucket=BUCKET,
                CopySource=f"{BUCKET}/{BASE_MODEL_KEY}",
                Key=model_key
            )
            s3.download_file(BUCKET, model_key, local_path)
        else:
            raise RuntimeError(f"[S3 Error] {str(e)}")

    model = BertForSequenceClassification.from_pretrained(
        "bert-base-uncased", num_labels=len(EMOTION_LABELS)
    )
    model.load_state_dict(torch.load(local_path, map_location="cpu"))
    model.eval()

    last_user_id = user_id
    cached_model = model
    return model

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input provided"}), 400

    user_id = data.get("user_id")
    message = data.get("message", "")

    if not user_id or not message:
        return jsonify({"error": "user_id and message required"}), 400

    try:
        model = load_model_for_user(user_id)
        inputs = tokenizer(
            message,
            return_tensors="pt",
            padding="max_length",
            truncation=True,
            max_length=128,
        )
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.sigmoid(logits).squeeze().numpy()

        predictions = probs > 0.3
        predicted_emotions = [EMOTION_LABELS[i] for i, p in enumerate(predictions) if p]
        top_emotions = sorted(
            [(EMOTION_LABELS[i], float(probs[i])) for i in range(len(probs))],
            key=lambda x: x[1],
            reverse=True
        )[:5]

        return jsonify({
            "user_id": user_id,
            "input_text": message,
            "predicted_emotions": predicted_emotions,
            "emotion_probabilities": {label: float(probs[i]) for i, label in enumerate(EMOTION_LABELS)},
            "top_emotions": top_emotions
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
