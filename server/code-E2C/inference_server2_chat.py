# ========================= inference_server2_chat.py (on EC2) =========================
from flask import Flask, request, jsonify
from botocore.exceptions import ClientError
# LLM
import traceback
import os, json, torch, boto3, traceback
import numpy as np
from transformers import (
    BertTokenizer, BertForSequenceClassification,
    AutoTokenizer, AutoModelForCausalLM, pipeline,
    AutoModelForSeq2SeqLM
)
from botocore.exceptions import ClientError
# Best THERSHOLDS
EMOTION_THRESHOLDS = {  "admiration": 0.5636809468269348,
                        "amusement": 0.455887109041214,
                        "anger": 0.5269321203231812,
                        "annoyance": 0.36041176319122314,
                        "approval": 0.38077831268310547,
                        "caring": 0.3923538029193878,
                        "confusion": 0.45215746760368347,
                        "curiosity": 0.4687836766242981,
                        "desire": 0.6101184487342834,
                        "disappointment": 0.4222204387187958,
                        "disapproval": 0.3825962245464325,
                        "disgust": 0.535349428653717,
                        "embarrassment": 0.48492151498794556,
                        "excitement": 0.38570845127105713,
                        "fear": 0.32441622018814087,
                        "gratitude": 0.660706639289856,
                        "grief": 0.39133381843566895,
                        "joy": 0.44913506507873535,
                        "love": 0.39080554246902466,
                        "nervousness": 0.570563793182373,
                        "optimism": 0.5039885640144348,
                        "pride": 0.5252490639686584,
                        "realization": 0.4292587637901306,
                        "relief": 0.4243277311325073,
                        "remorse": 0.4213601350784302,
                        "sadness": 0.43017059564590454,
                        "surprise": 0.35856375098228455,
                        "neutral": 0.37793856859207153  }

EMOTIONS = ["admiration",
            "amusement",
            "anger",
            "annoyance",
            "approval",
            "caring",
            "confusion",
            "curiosity",
            "desire",
            "disappointment",
            "disapproval",
            "disgust",
            "embarrassment",
            "excitement",
            "fear",
            "gratitude",
            "grief",
            "joy",
            "love",
            "nervousness",
            "optimism",
            "pride",
            "realization",
            "relief",
            "remorse",
            "sadness",
            "surprise",
            "neutral" ]

app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"

# AWS S3
s3 = boto3.client("s3")

# Tokenizers & Models
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
# chat_tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-small", trust_remote_code=True)
# chat_model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-small", trust_remote_code=True)

# print("Loading DialoGPT model...")
# chat_tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-small")
# chat_model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-small")
# chat_pipeline = pipeline("text-generation", model=chat_model, tokenizer=chat_tokenizer, device=0 if torch.cuda.is_available() else -1)

# Initialize the chat model
print("Loading GODEL model...")
device = 0 if torch.cuda.is_available() else -1

# Using GODEL model for better dialogue capabilities
chat_tokenizer = AutoTokenizer.from_pretrained("microsoft/GODEL-v1_1-large-seq2seq")
# chat_model = AutoModelForCausalLM.from_pretrained("microsoft/GODEL-v1_1-large-seq2seq")
chat_model = AutoModelForSeq2SeqLM.from_pretrained("microsoft/GODEL-v1_1-large-seq2seq")
# Model caching
last_user_id, cached_model = None, None

def generate_response(user_message, emotion_context):
    """Generate response using GODEL with proper formatting for mental health support"""
    # Format instruction for GODEL (knowledge grounded open-domain dialogue)
    print("Generate response using GODEL with proper formatting for mental health support")
    instruction = "Respond helpfully, kind, detailed and long as a supportive mental health assistant. Give a moti "
    knowledge = "The user appears to be feeling: {} ".format(emotion_context)
    # GODEL expects input in this format
    prompt = "Instruction: {}\nKnowledge: {}\nDialogue:\nHuman: {}\nAssistant:".format(instruction, knowledge, user_message)       
    print(prompt)
    # Tokenize input
    inputs = chat_tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
    # Move inputs to GPU if available
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
    # Generate response
    output_ids = chat_model.generate(
        inputs["input_ids"],
        attention_mask=inputs["attention_mask"],
        max_length=512,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
        num_return_sequences=1,
       # pad_token_id=chat_tokenizer.eos_token_id
    )
    # Decode the response
    response = chat_tokenizer.decode(output_ids[0], skip_special_tokens=True)
    # Extract only the assistant's response
    if "Assistant:" in response:
        response = response.split("Assistant:")[-1].strip()
    else:
        response = response.strip()
    print(response)
    return response


@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    print("inferene/analyze started")
    global last_user_id, cached_model
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        raw_message = data.get("message").strip()
        chat_id = data.get("chat_id")
        lines = raw_message.split("\n")
        message = ""
        for line in reversed(lines):
            if line.startswith("User:"):
               message  = line.replace("User:", "").strip()
               break
        if not message :
          message  = raw_message
        print("message reviced to Predict : {}".format(message))
        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400
        # Model properties
        model_key = "models/{}/model.pt".format(user_id)
        local_path = "/tmp/{}_model.pt".format(user_id)

        print("model fetch started")
        try:
            if last_user_id != user_id or cached_model is None:
                print("Downloading model ...")
                try:
                    s3.download_file(BUCKET, model_key, local_path)
                except ClientError as e:
                    if e.response['Error']['Code'] == '404':
                        print("Model not found. Copying base model ...")
                        s3.copy_object(Bucket=BUCKET, CopySource=f"{BUCKET}/{BASE_MODEL_KEY}", Key=model_key)
                        s3.download_file(BUCKET, model_key, local_path)
                print("Loading model into memory ...")

                model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(EMOTIONS))
                state_dict = torch.load(local_path, map_location="cpu")
                model.load_state_dict(state_dict, strict=False)
                model.eval()
                cached_model = model
                last_user_id = user_id
            else:
                model = cached_model
        except Exception as e:
            print("Error loading model: {}".format(str(e)))
            return jsonify({"error": "Model loading failed"}), 500

        print("Model fetch done\nStart generating response")

        # Segment-level analysis
        segments = message.split(". ")
        all_emotions = []

        for segment in segments:
            if segment.strip():
                inputs = tokenizer(segment, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
                with torch.no_grad():
                    outputs = model(**inputs)
                    logits = outputs.logits
                    probabilities = torch.sigmoid(logits).squeeze()

                    if len(probabilities.shape) == 0:
                        probabilities = probabilities.unsqueeze(0)
                    probs_np = probabilities.cpu().numpy()

                for idx, prob in enumerate(probs_np):
                    threshold = EMOTION_THRESHOLDS[EMOTIONS[idx]]
                    if prob > threshold:
                        all_emotions.append({
                            "code": idx,
                            "label": EMOTIONS[idx],
                            "score": float(prob)
                        })

        # If nothing found in segments, analyze whole message
        if not all_emotions:
            inputs = tokenizer(message, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits
                probabilities = torch.sigmoid(logits).squeeze()

                if len(probabilities.shape) == 0:
                    probabilities = probabilities.unsqueeze(0)
                probs_np = probabilities.cpu().numpy()

            threshold_adjusted_probs = [
                prob / EMOTION_THRESHOLDS[EMOTIONS[idx]]
                for idx, prob in enumerate(probs_np)
            ]
            max_idx = np.argmax(threshold_adjusted_probs)
            all_emotions.append({
                "code": int(max_idx),
                "label": EMOTIONS[max_idx],
                "score": float(probs_np[max_idx])
            })

        # Deduplicate by label and keep highest scores
        seen_emotions = {}
        for emotion in all_emotions:
            label = emotion["label"]
            if label not in seen_emotions or emotion["score"] > seen_emotions[label]["score"]:
                seen_emotions[label] = emotion

        emotions = list(seen_emotions.values())
        emotions.sort(key=lambda x: x['score'], reverse=True)

        top_emotions = emotions[:3]
        emotion_labels = ", ".join([e["label"] for e in top_emotions]) or "neutral"

        # --- Chat Generation Prompt ---
        # prompt = ("You are a caring and helpful mental health assistant.\nUser: {}\nEmotional context: {}.\nReply supportively and empathetically:".format(message , emotion_labels) )
        # print("\nprompt {}\n\n".format(prompt))
        # chat_output = chat_pipeline(prompt, max_new_tokens=150, do_sample=True, temperature=0.7)[0]['generated_text']
        # chat_reply = chat_output.split("Reply supportively and empathetically:")[-1].strip()

        # Generate response using DialoGPT
        # chat_reply = generate_response(prompt)
        chat_reply = generate_response(message, emotion_labels)
        # If response is empty, provide a fallback response
        if not chat_reply.strip():
            if emotion_labels == "neutral":
                chat_reply = f"Hi there! I'm here to listen and support you. How can I help you today?"
            else:
                chat_reply = f"I can sense you might be feeling {emotion_labels}. I'm here for you. How can I best support you right now?"

        # Full output for debugging
        prompt = "User: {}\nEmotional context: {}".format(message, emotion_labels)
        chat_output = "{}\nAssistant: {}".format(prompt, chat_reply)

        print("✅ Detected emotions: {}".format(emotions))
        print("✅ Chat reply: {}".format(chat_reply))
        print("✅ Chat output: {}".format(chat_output))

        return jsonify({
            "user_id": user_id,
            "input_text": message,
            "message": message,
            "emotion_probabilities": emotions,
            "top_emotions": emotions[:3], # or any top-N you prefer
            "chat_response": chat_reply,
            "chat_output": chat_output
        })
    except Exception as e:
        print("❌ Error in sentiment analysis: {}".format(str(e)))
        traceback.print_exc()
        return jsonify({"error": "Failed to analyze sentiment"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)