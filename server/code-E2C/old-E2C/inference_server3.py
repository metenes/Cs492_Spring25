# ========================= inference_server2_chat.py (on EC2) =========================
from flask import Flask, request, jsonify
from botocore.exceptions import ClientError
import traceback
import os, json, torch, boto3
from transformers import (
    BertTokenizer, BertForSequenceClassification,
    AutoTokenizer, AutoModelForCausalLM
)

# Best THERSHOLDS
EMOTION_THRESHOLDS = {
    "admiration": 0.5636, "amusement": 0.4558, "anger": 0.5269, "annoyance": 0.3604,
    "approval": 0.3807, "caring": 0.3923, "confusion": 0.4521, "curiosity": 0.4687,
    "desire": 0.6101, "disappointment": 0.4222, "disapproval": 0.3825, "disgust": 0.5353,
    "embarrassment": 0.4849, "excitement": 0.3857, "fear": 0.3244, "gratitude": 0.6607,
    "grief": 0.3913, "joy": 0.4491, "love": 0.3908, "nervousness": 0.5705,
    "optimism": 0.5039, "pride": 0.5252, "realization": 0.4292, "relief": 0.4243,
    "remorse": 0.4213, "sadness": 0.4301, "surprise": 0.3585, "neutral": 0.3779
}

EMOTIONS = list(EMOTION_THRESHOLDS.keys())

app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"
s3 = boto3.client("s3")

# Load Tokenizer & Chat Model (TinyLlama)
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
chat_tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")
chat_model = AutoModelForCausalLM.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
chat_model = chat_model.to(device)

# Model caching
last_user_id, cached_model = None, None

def generate_response(user_message, emotion_context):
    print("Generating supportive response based on emotion...")
    prompt = (
        "You are a compassionate and knowledgeable mental health assistant. "
        "Your goal is to provide thoughtful, emotionally supportive, and deeply helpful responses. "
        f"Given the emotion of the user '{emotion_context}', support the user who said: '{user_message}'. "
        "Respond in a warm, long, and detailed way."
    )
    inputs = chat_tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
    inputs = {k: v.to(device) for k, v in inputs.items()}
    output_ids = chat_model.generate(
        inputs["input_ids"],
        max_new_tokens=150,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
        pad_token_id=chat_tokenizer.eos_token_id
    )
    response = chat_tokenizer.decode(output_ids[0], skip_special_tokens=True)
    if "Assistant:" in response:
        response = response.split("Assistant:")[-1].strip()
    return response.strip()

@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    global last_user_id, cached_model
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        raw_message = data.get("message", "").strip()
        chat_id = data.get("chat_id")

        # Extract message
        message = ""
        for line in reversed(raw_message.split("\n")):
            if line.startswith("User:"):
                message = line.replace("User:", "").strip()
                break
        if not message:
            message = raw_message
        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400

        model_key = f"models/{user_id}/model.pt"
        local_path = f"/tmp/{user_id}_model.pt"

        print("Model fetch initiated...")
        if last_user_id != user_id or cached_model is None:
            try:
                s3.download_file(BUCKET, model_key, local_path)
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    print("Custom model not found. Using base model...")
                    s3.copy_object(Bucket=BUCKET, CopySource=f"{BUCKET}/{BASE_MODEL_KEY}", Key=model_key)
                    s3.download_file(BUCKET, model_key, local_path)
                else:
                    raise

            cached_model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(EMOTIONS))
            cached_model.load_state_dict(torch.load(local_path, map_location=device))
            cached_model.to(device)
            cached_model.eval()
            last_user_id = user_id

        # Tokenize input
        inputs = tokenizer(message, return_tensors="pt", truncation=True, padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = cached_model(**inputs)
            scores = torch.softmax(outputs.logits, dim=1).squeeze().cpu().numpy()

        emotion_scores = {emotion: float(score) for emotion, score in zip(EMOTIONS, scores)}
        predicted_emotion = max(emotion_scores, key=lambda e: emotion_scores[e])
        confidence = emotion_scores[predicted_emotion]
        print(f"Predicted emotion: {predicted_emotion} ({confidence:.2f})")

        response_text = generate_response(message, predicted_emotion)

        return jsonify({
            "user_id": user_id,
            "chat_id": chat_id,
            "message": message,
            "predicted_emotion": predicted_emotion,
            "confidence": confidence,
            "response": response_text,
            "scores": emotion_scores
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Exception occurred", "details": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)