# ========================= inference_server.py (on EC2) =========================
import os, json, torch, boto3
from flask import Flask, request, jsonify
from transformers import BertTokenizer, BertForSequenceClassification
from botocore.exceptions import ClientError

app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"
LABELS = ["admiration", "amusement", "anger", "annoyance", "approval", "caring", "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love", "nervousness", "optimism", "pride", "realization", "relief", "remorse", "sadness", "surprise", "neutral"]

s3 = boto3.client("s3")
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
last_user_id, cached_model = None, None

@app.route("/predict", methods=["POST"])
def predict():
    global last_user_id, cached_model
    data = request.get_json()
    user_id, message = data.get("user_id"), data.get("message")
    if not user_id or not message:
        return jsonify({"error": "user_id and message required"}), 400
    model_key = f"models/{user_id}/model.pt"
    local_path = f"/tmp/{user_id}_model.pt"

    try:
        if last_user_id != user_id:
            try:
                s3.download_file(BUCKET, model_key, local_path)
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    s3.copy_object(Bucket=BUCKET, CopySource=f"{BUCKET}/{BASE_MODEL_KEY}", Key=model_key)
                    s3.download_file(BUCKET, model_key, local_path)
            model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(LABELS))
            model.load_state_dict(torch.load(local_path, map_location="cpu"))
            model.eval()
            cached_model = model
            last_user_id = user_id

        inputs = tokenizer(message, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
        with torch.no_grad():
            logits = cached_model(**inputs).logits
            probs = torch.sigmoid(logits).squeeze().numpy()

        top = sorted([(LABELS[i], float(probs[i])) for i in range(len(probs))], key=lambda x: x[1], reverse=True)[:5]
        return jsonify({
            "user_id": user_id,
            "input_text": message,
            "predicted_emotions": [e[0] for e in top if e[1] > 0.3],
            "emotion_probabilities": {LABELS[i]: float(probs[i]) for i in range(len(probs))},
            "top_emotions": top
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)