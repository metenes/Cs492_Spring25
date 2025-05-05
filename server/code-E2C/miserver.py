# ========================= inference_server2_chat.py (on EC2) =========================
from flask import Flask, request, jsonify
from botocore.exceptions import ClientError
# LLM 
import traceback
import os, json, torch, boto3
import numpy as np
from transformers import (
    BertTokenizer, BertForSequenceClassification,
    AutoTokenizer, AutoModelForCausalLM
)
from accelerate import init_empty_weights, load_checkpoint_and_dispatch
import gc

# Best THRESHOLDS
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
emotion_tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# Initialize the chat model - Mistral 7B (much more powerful than GODEL)
print("Loading Mistral-7B model...")
device = "cuda" if torch.cuda.is_available() else "cpu"

# Using HF device_map for efficient loading on multi-GPU systems
CHAT_MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.2"

# Model caching
last_user_id, cached_emotion_model = None, None
chat_model, chat_tokenizer = None, None

def initialize_chat_model():
    """Load the chat model with optimizations for memory efficiency"""
    global chat_model, chat_tokenizer
    
    print(f"Initializing chat model: {CHAT_MODEL_NAME}")
    
    # Load tokenizer
    chat_tokenizer = AutoTokenizer.from_pretrained(CHAT_MODEL_NAME)
    
    # Load model with optimizations
    if torch.cuda.is_available():
        # Use device_map="auto" for multi-GPU setups
        chat_model = AutoModelForCausalLM.from_pretrained(
            CHAT_MODEL_NAME,
            torch_dtype=torch.bfloat16,  # Use bfloat16 for efficiency
            device_map="auto",           # Automatically distribute across available GPUs
            use_cache=True
        )
    else:
        # For CPU-only environments, use 8-bit quantization to reduce memory
        chat_model = AutoModelForCausalLM.from_pretrained(
            CHAT_MODEL_NAME,
            load_in_8bit=True,  # 8-bit quantization for CPU
            device_map={"": device}
        )
    
    print(f"Chat model loaded successfully on {device}")
    
    return chat_model, chat_tokenizer

def generate_response(user_message, emotion_context, chat_history=None):
    """Generate response using Mistral with proper formatting for mental health support"""
    global chat_model, chat_tokenizer
    
    # Initialize model if not already done
    if chat_model is None or chat_tokenizer is None:
        chat_model, chat_tokenizer = initialize_chat_model()
    
    print("Generating response using Mistral with mental health support formatting")
    
    # Format system instruction for Mistral
    system_instruction = """You are a compassionate and knowledgeable mental health assistant. 
Your goal is to provide thoughtful, emotionally supportive, and deeply helpful responses. 
Give detailed answers, filled with empathy, guidance, and encouragement. 
Use a warm, conversational tone that feels natural and engaging.
Address the user like a trusted friend who's reaching out for support."""

    # Add emotional context to the system instruction
    system_with_context = f"{system_instruction}\n\nThe user appears to be feeling: {emotion_context}."
    
    # Format for Mistral's expected input format (using chat templates)
    messages = []
    
    # Add system message
    messages.append({"role": "system", "content": system_with_context})
    
    # Add chat history if available
    if chat_history:
        for entry in chat_history:
            messages.append({"role": entry["role"], "content": entry["content"]})
    
    # Add current user message
    messages.append({"role": "user", "content": user_message})
    
    # Apply the chat template to format the prompt according to Mistral's expected format
    prompt = chat_tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    print(f"Formatted prompt: {prompt[:200]}...")  # Print first 200 chars for debugging
    
    # Tokenize input
    inputs = chat_tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
    
    # Move inputs to appropriate device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Generate with appropriate parameters for mental health conversations
    with torch.no_grad():
        output_ids = chat_model.generate(
            inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            max_new_tokens=512,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            top_k=50,
            repetition_penalty=1.1,
            pad_token_id=chat_tokenizer.eos_token_id
        )
    
    # Get only the newly generated tokens
    new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
    response = chat_tokenizer.decode(new_tokens, skip_special_tokens=True)
    
    # Clean up the response
    response = response.strip()
    
    # Remove any potential model-specific markers
    if response.startswith("Assistant:"):
        response = response[len("Assistant:"):].strip()
    
    print(f"Generated response: {response[:100]}...")  # Print first 100 chars for debugging
    
    # Free up memory
    torch.cuda.empty_cache()
    
    return response


@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    print("inference/analyze started")
    global last_user_id, cached_emotion_model
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        raw_message = data.get("message").strip()
        chat_id = data.get("chat_id")
        chat_history = data.get("chat_history", [])
        
        # Extract user message from raw input
        lines = raw_message.split("\n")
        message = ""
        for line in reversed(lines):
            if line.startswith("User:"):
               message = line.replace("User:", "").strip()
               break
        if not message:
          message = raw_message
        print(f"Message received to predict: {message}")
        
        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400
            
        # Model properties
        model_key = f"models/{user_id}/model.pt"
        local_path = f"/tmp/{user_id}_model.pt"

        print("Emotion model fetch started")
        try:
            if last_user_id != user_id or cached_emotion_model is None:
                print("Downloading emotion model...")
                try:
                    s3.download_file(BUCKET, model_key, local_path)
                except ClientError as e:
                    if e.response['Error']['Code'] == '404':
                        print("Model not found. Copying base model...")
                        s3.copy_object(Bucket=BUCKET, CopySource=f"{BUCKET}/{BASE_MODEL_KEY}", Key=model_key)
                        s3.download_file(BUCKET, model_key, local_path)
                print("Loading emotion model into memory...")

                emotion_model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(EMOTIONS))
                state_dict = torch.load(local_path, map_location="cpu")
                emotion_model.load_state_dict(state_dict, strict=False)
                emotion_model.eval()
                cached_emotion_model = emotion_model
                last_user_id = user_id
            else:
                emotion_model = cached_emotion_model
        except Exception as e:
            print(f"Error loading emotion model: {str(e)}")
            traceback.print_exc()
            return jsonify({"error": "Emotion model loading failed"}), 500

        print("Emotion model fetch done\nStart generating response")

        # Segment-level analysis
        segments = message.split(". ")
        all_emotions = []

        for segment in segments:
            if segment.strip():
                inputs = emotion_tokenizer(segment, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
                with torch.no_grad():
                    outputs = emotion_model(**inputs)
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
            inputs = emotion_tokenizer(message, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
            with torch.no_grad():
                outputs = emotion_model(**inputs)
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

        # Generate response using Mistral
        chat_reply = generate_response(message, emotion_labels, chat_history)
        
        # If response is empty, provide a fallback response
        if not chat_reply.strip():
            if emotion_labels == "neutral":
                chat_reply = f"Hi there! I'm here to listen and support you. How can I help you today?"
            else:
                chat_reply = f"I can sense you might be feeling {emotion_labels}. I'm here for you. How can I best support you right now?"

        # Full output for debugging
        prompt = f"User: {message}\nEmotional context: {emotion_labels}"
        chat_output = f"{prompt}\nAssistant: {chat_reply}"

        print(f"✅ Detected emotions: {emotions}")
        print(f"✅ Chat reply: {chat_reply[:100]}...")
        print(f"✅ Chat output: {chat_output[:100]}...")
        
        # Clear CUDA cache after processing
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
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
        print(f"❌ Error in sentiment analysis: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Failed to analyze sentiment"}), 500

if __name__ == "__main__":
    # Initialize chat model at startup
    initialize_chat_model()
    app.run(host="0.0.0.0", port=8080)