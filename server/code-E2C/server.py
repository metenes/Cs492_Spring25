# ========================= inference_server2_chat.py (on EC2) =========================
from datetime import datetime
from fastapi import logger
from flask import Flask, request, jsonify, Blueprint
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

# Multiple devices server
import concurrent.futures
import threading
from queue import Queue
import time
from functools import lru_cache

# Import additional required libraries at the top
from sklearn.preprocessing import MultiLabelBinarizer
from fastapi import HTTPException
import threading
import time


# Global variable for model cache with timeout
# Format: {user_id: (model, timestamp)}
MODEL_CACHE = {}
CACHE_LOCK = threading.Lock()
CACHE_TIMEOUT = 300  # 5 minutes

# Queue for background tasks
TASK_QUEUE = Queue()
MAX_WORKERS = 4  # Adjust based on CPU cores

# Lock for rate limiting
RATE_LIMIT_LOCK = threading.Lock()
REQUEST_COUNTS = {}  # {ip: (count, timestamp)}
MAX_REQUESTS = 100
RATE_WINDOW = 20  # 1 minute

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

def get_mindfulness_tip(emotion, tone):
    emotion = emotion.lower()
    tone = tone.lower()

    tips = {
        "admiration": {
            "supportive": "It's wonderful to recognize and appreciate others. Try expressing it to them—it can brighten both your days.",
            "motivational": "Let admiration inspire your own growth. What qualities do you want to cultivate in yourself?",
            "mindfulness": "Take a moment to reflect on what specifically moved you. Stay present with that positive feeling."
        },
        "amusement": {
            "supportive": "Laughter is healing—let yourself enjoy these light moments fully.",
            "motivational": "Let this joy carry you forward. Share the fun—it spreads positivity!",
            "mindfulness": "Notice how your body feels when you laugh. That’s the joy of being in the moment."
        },
        "anger": {
            "supportive": "Anger is valid. Take some time alone to breathe and reflect without judgment.",
            "motivational": "Channel that energy into something constructive. You have the power to create change.",
            "mindfulness": "Try progressive muscle relaxation to let tension go slowly, one body part at a time."
        },
        "annoyance": {
            "supportive": "It's okay to feel irritated. Try identifying what’s triggering it.",
            "motivational": "You’re in control of how you respond. A calm pause can shift your entire day.",
            "mindfulness": "Notice the sensation of frustration. Label it, breathe into it, then let it pass."
        },
        "approval": {
            "supportive": "It's nice to feel aligned with someone or something. Let that comfort sink in.",
            "motivational": "Let this sense of alignment guide your actions going forward.",
            "mindfulness": "Feel your breath and notice how your body reacts to affirmation. Stay with that calm."
        },
        "caring": {
            "supportive": "Your empathy is powerful. Make sure you're also showing care to yourself.",
            "motivational": "Let compassion lead you—but remember, refueling your own heart is part of caring.",
            "mindfulness": "Breathe deeply and send warmth to someone you care about through a loving-kindness meditation."
        },
        "confusion": {
            "supportive": "It’s okay not to have all the answers. You’re allowed to take your time.",
            "motivational": "Every question is a step toward clarity. Keep going—answers will come.",
            "mindfulness": "Take a pause. Focus on your breath for 2 minutes. Let your mind settle before returning to the problem."
        },
        "curiosity": {
            "supportive": "Your curiosity is a gift—follow it gently and see where it leads.",
            "motivational": "This is the seed of growth. Let yourself explore without pressure.",
            "mindfulness": "Sit with your curiosity. Ask questions inwardly and just notice where your thoughts go."
        },
        "desire": {
            "supportive": "Desire can be a compass. Acknowledge it with honesty and care.",
            "motivational": "Let your goals inspire you, but remember to balance ambition with wellbeing.",
            "mindfulness": "Close your eyes and picture your desire. Breathe into it without clinging—just observe it."
        },
        "disappointment": {
            "supportive": "Disappointment is tough. It’s okay to feel let down. Let yourself rest.",
            "motivational": "This setback isn’t the end. It’s a redirection—learn from it and continue onward.",
            "mindfulness": "Breathe and name the feeling. Accept it as temporary and watch it pass gently."
        },
        "disapproval": {
            "supportive": "It’s hard when things don’t align with your values. Honor your boundaries kindly.",
            "motivational": "Use this moment to assert what matters to you clearly and respectfully.",
            "mindfulness": "Feel into what triggered your response. Can you observe without reacting?"
        },
        "disgust": {
            "supportive": "This feeling often protects us. Let it be information, not judgment.",
            "motivational": "What boundaries is this emotion highlighting? Let that guide your choices.",
            "mindfulness": "Notice where disgust sits in your body. Breathe deeply and allow space around it."
        },
        "embarrassment": {
            "supportive": "Everyone makes mistakes—it’s part of being human. You’re not alone.",
            "motivational": "Own your story. Confidence comes from self-acceptance, not perfection.",
            "mindfulness": "Place your hand on your heart. Breathe slowly and remind yourself it’s okay to feel exposed."
        },
        "excitement": {
            "supportive": "Let yourself feel the joy! Your energy is contagious.",
            "motivational": "Ride that wave of excitement—channel it into something meaningful!",
            "mindfulness": "Close your eyes and savor the feeling. Let it fill your body like sunlight."
        },
        "fear": {
            "supportive": "You are safe right now. Breathe and stay grounded.",
            "motivational": "Fear often shows us where growth lies. You’re stronger than you know.",
            "mindfulness": "Try grounding: feel your feet on the floor, name 5 things you can see, 4 you can touch..."
        },
        "gratitude": {
            "supportive": "Gratitude brings peace. Take a moment to say 'thank you' internally.",
            "motivational": "Start a gratitude journal—just 3 things daily can rewire your outlook.",
            "mindfulness": "Breathe and visualize something you're grateful for. Let that warmth spread."
        },
        "grief": {
            "supportive": "Your pain is real and valid. Take your time. You don’t have to be okay right now.",
            "motivational": "Healing isn’t linear, but every step forward matters—even tears.",
            "mindfulness": "Place both hands over your heart. Breathe and say: 'It’s okay to grieve.'"
        },
        "joy": {
            "supportive": "Bask in this moment. Let yourself truly feel it.",
            "motivational": "Celebrate your wins—no matter how small!",
            "mindfulness": "Close your eyes and say: 'I’m here. I’m joyful. I am enough.'"
        },
        "love": {
            "supportive": "Love connects us. Let yourself feel it deeply and fully.",
            "motivational": "Lead with love—it’s the most powerful force you carry.",
            "mindfulness": "Send loving-kindness thoughts: 'May I be happy. May they be safe. May we feel peace.'"
        },
        "nervousness": {
            "supportive": "It’s okay to be nervous. It means you care. You’ve got this.",
            "motivational": "Transform nerves into energy. Breathe, focus, and move forward.",
            "mindfulness": "Try the 5-4-3-2-1 technique to ground: list 5 things you see, 4 you feel, and so on."
        },
        "optimism": {
            "supportive": "Your hope is a light. Keep nurturing it gently.",
            "motivational": "Let that spark drive your next steps—keep going!",
            "mindfulness": "Focus on the good you’re seeing. Let it fill your attention without clinging to it."
        },
        "pride": {
            "supportive": "You’ve earned this. Let yourself enjoy your progress.",
            "motivational": "Use this pride to fuel your next goal. You’re capable of more!",
            "mindfulness": "Say: 'I am proud of myself' while breathing deeply. Let it land."
        },
        "realization": {
            "supportive": "New insights can be overwhelming. Give yourself time to adjust.",
            "motivational": "This realization is a gift—use it to grow with purpose.",
            "mindfulness": "Sit with your realization. Feel it in your body. Let it become part of you."
        },
        "relief": {
            "supportive": "It’s okay to exhale. Let go. You've come through.",
            "motivational": "Now that the storm has passed, what can you do to take care of yourself?",
            "mindfulness": "Breathe into that feeling of safety and ease. Stay present with the peace."
        },
        "remorse": {
            "supportive": "Everyone makes mistakes. It’s okay to acknowledge and grow.",
            "motivational": "Turn regret into learning. Forgive yourself and move forward.",
            "mindfulness": "Breathe slowly and say: 'I am learning. I release guilt.'"
        },
        "sadness": {
            "supportive": "You’re not alone. Let yourself feel and be gentle with yourself.",
            "motivational": "Sadness shows you care. Let it fuel your healing and self-love.",
            "mindfulness": "Feel your breath. Say: 'This too shall pass.' Rest in that knowing."
        },
        "surprise": {
            "supportive": "Unexpected things can be gifts. Let curiosity guide you.",
            "motivational": "Use the surprise as a spark—what can you do with this moment?",
            "mindfulness": "Anchor yourself in the now. Let the surprise pass through like a wave."
        },
        "neutral": {
            "supportive": "Calm days matter too. Not everything needs intensity.",
            "motivational": "Use this moment of calm to reflect, rest, or gently plan ahead.",
            "mindfulness": "Close your eyes. Just breathe. No judgment—just being."
        }
    }

    return tips.get(emotion, {}).get(tone, "")

app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"

s3 = boto3.client("s3")
BUCKET = "sentiobucket"
USER_MODEL_PREFIX = "models/"
GLOBAL_MODEL_KEY = "models/global_model.pt"

# Counter for aggregation triggers
AGGREGATION_COUNTER = 0
AGGREGATION_COUNTER_LOCK = threading.Lock()

# AWS S3

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

def get_cached_model(user_id):
    """Get model from cache or load it."""
    current_time = time.time()
    
    with CACHE_LOCK:
        # Clean expired models
        expired_keys = []
        for key, (_, timestamp) in MODEL_CACHE.items():
            if current_time - timestamp > CACHE_TIMEOUT:
                expired_keys.append(key)
        
        for key in expired_keys:
            del MODEL_CACHE[key]
        
        # Check if model is in cache
        if user_id in MODEL_CACHE:
            model, _ = MODEL_CACHE[user_id]
            # Update timestamp
            MODEL_CACHE[user_id] = (model, current_time)
            return model
    
    # Model not in cache, load it
    try:
        model_key = f"models/{user_id}/model.pt"
        local_path = f"/tmp/{user_id}_model.pt"
        
        if not check_s3_object_exists(BUCKET, model_key):
            # Create new user model from base
            copy_s3_object(BUCKET, BASE_MODEL_KEY, BUCKET, model_key)
        
        s3.download_file(BUCKET, model_key, local_path)
        
        model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(EMOTIONS))
        model.load_state_dict(torch.load(local_path, map_location="cpu"))
        model.eval()
        
        # Add to cache
        with CACHE_LOCK:
            MODEL_CACHE[user_id] = (model, current_time)
        
        return model
    except Exception as e:
        print(f"Error loading model for {user_id}: {str(e)}")
        raise

def background_worker():
    """Worker to process background tasks."""
    while True:
        try:
            task, args, kwargs = TASK_QUEUE.get()
            task(*args, **kwargs)
        except Exception as e:
            print(f"Error in background task: {str(e)}")
        finally:
            TASK_QUEUE.task_done()

def start_background_workers():
    """Start background worker threads."""
    for _ in range(MAX_WORKERS):
        worker = threading.Thread(target=background_worker, daemon=True)
        worker.start()

def rate_limit(func):
    """Decorator for rate limiting by IP."""
    def wrapper(*args, **kwargs):
        try:
            if request:
                ip = request.remote_addr
                current_time = time.time()
                
                with RATE_LIMIT_LOCK:
                    # Clean expired entries
                    expired_ips = []
                    for key, (_, timestamp) in REQUEST_COUNTS.items():
                        if current_time - timestamp > RATE_WINDOW:
                            expired_ips.append(key)
                    
                    for key in expired_ips:
                        del REQUEST_COUNTS[key]
                    
                    # Check rate limit
                    if ip in REQUEST_COUNTS:
                        count, _ = REQUEST_COUNTS[ip]
                        if count >= MAX_REQUESTS:
                            return jsonify({"error": "Rate limit exceeded"}), 429
                        REQUEST_COUNTS[ip] = (count + 1, current_time)
                    else:
                        REQUEST_COUNTS[ip] = (1, current_time)
        except Exception:
            # If any error in rate limiting, continue with the function
            pass
            
        return func(*args, **kwargs)
    return wrapper


def generate_response(user_message, emotion_context):
    """Generate response using GODEL with proper formatting for mental health support"""

    # Format instruction for GODEL (knowledge grounded open-domain dialogue)
    print("Generate response using GODEL with proper formatting for mental health support")

    instruction = "Respond as a supportive mental health assistant. Give long, detailed, answer with helping and chat purpose"
    knowledge = "The user appears to be feeling: {}".format(emotion_context)

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
@rate_limit # Rate limiting for high demand
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
                MODEL_CACHE[user_id] = (model, time.time())

                last_user_id = user_id
            else:
                # model = cached_model
                model = get_cached_model(user_id)
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
        chat_reply = generate_response(message, emotion_labels, tone)
        # chat = generate_reply(input_text, emotion, user_id, tone)
        tip = get_mindfulness_tip(emotion, tone)
        full_response = f"{chat_reply}\n\nMindfulness Tip: {tip}" if tip else chat_reply
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
            "chat_response": full_response,
            "chat_output": chat_output
        })
    except Exception as e:
        print("❌ Error in sentiment analysis: {}".format(str(e)))
        traceback.print_exc()
        return jsonify({"error": "Failed to analyze sentiment"}), 500
    finally : 
        trigger_user_model_retrain(user_id) # triger the training 

        # Save this prediction as training data
        emotion_codes = [e["code"] for e in top_emotions]
        if not emotion_codes:  # If no emotions detected, use neutral
            emotion_codes = [27]  # Index for neutral
            
        # Add to background queue to avoid blocking API response
        TASK_QUEUE.put((save_user_interaction, (user_id, message, emotion_codes, chat_reply), {}))
        
        # Periodically trigger model aggregation (e.g., every 100th request)
        should_aggregate = should_trigger_aggregation()
        if should_aggregate:
            TASK_QUEUE.put((trigger_model_aggregation, (), {}))

# START CHANIGN FROM HERE, FIX ALL CODE, MAKE IT TRAIN ON THE DATA IT RECIEVES , ALSO MAKE IT COLLECT DATA FROM USERS AS MODIFY BELOW FUNCTIONS AND IMPLEMENT THE MISSING FUCNTIONS

@app.route("/retrain", methods=["POST"])
@rate_limit # Rate limit 
def retrain():
    print("retrain started")
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        chat_id = data.get("chat_id", None)
        
        if not user_id:
            return jsonify({"error": "user_id required"}), 400
            
        # Add task to background queue for async processing
        TASK_QUEUE.put((perform_retraining, (user_id, data), {}))
        
        return jsonify({
            "status": "success", 
            "message": "Training job queued successfully"
        })
        
    except Exception as e:
        print(f"Error in retrain: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to retrain model: {str(e)}"}), 500

def perform_retraining(user_id, data):
    """Background task to perform model retraining"""
    try:
        # Define paths
        model_key = f"models/{user_id}/model.pt"
        local_model_path = f"/tmp/{user_id}_model.pt"
        data_key = f"training_data/{user_id}.json"
        local_json = f"/tmp/{user_id}_data.json"

        # Download current model and training data
        try:
            s3.download_file(BUCKET, model_key, local_model_path)
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"Model not found for {user_id}. Copying base model...")
                copy_s3_object(BUCKET, BASE_MODEL_KEY, BUCKET, model_key)
                s3.download_file(BUCKET, model_key, local_model_path)
            else:
                raise e
                
        # Get training data
        try:
            s3.download_file(BUCKET, data_key, local_json)
            with open(local_json, 'r') as f:
                training_data = json.load(f)
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                training_data = {"inputs": [], "labels": []}
            else:
                raise e

        # Add new data if provided
        new_data = data.get("training_data")
        if new_data and "inputs" in new_data and "labels" in new_data:
            training_data["inputs"].extend(new_data["inputs"])
            training_data["labels"].extend(new_data["labels"])
            
            # Save updated training data
            with open(local_json, 'w') as f:
                json.dump(training_data, f)
                
            # Upload training data to S3
            s3.upload_file(local_json, BUCKET, data_key)
        
        # Only retrain if there's data
        if training_data["inputs"] and len(training_data["inputs"]) > 0:
            print(f"Retraining model for user {user_id} with {len(training_data['inputs'])} samples")
            
            # Initialize MultiLabelBinarizer for emotions
            mlb = MultiLabelBinarizer(classes=list(range(len(EMOTIONS))))
            mlb.fit([list(range(len(EMOTIONS)))])
            
            # Prepare dataset
            inputs = training_data["inputs"]
            labels = mlb.transform(training_data["labels"])
            
            # Load model
            model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(EMOTIONS))
            model.load_state_dict(torch.load(local_model_path, map_location="cpu"))
            
            # Move to GPU if available
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model.to(device)
            
            # Create simple dataset
            encoded_inputs = tokenizer(inputs, padding="max_length", truncation=True, max_length=128, return_tensors="pt")
            dataset = []
            for i in range(len(inputs)):
                sample = {key: val[i].to(device) if torch.cuda.is_available() else val[i] for key, val in encoded_inputs.items()}
                sample["labels"] = torch.tensor(labels[i], dtype=torch.float32).to(device) if torch.cuda.is_available() else torch.tensor(labels[i], dtype=torch.float32)
                dataset.append(sample)
                
            # Training parameters
            learning_rate = 5e-5
            batch_size = 8
            epochs = 2
            
            # Setup training
            model.train()
            optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
            
            # Training loop
            for epoch in range(epochs):
                # Shuffle dataset
                import random
                random.shuffle(dataset)
                
                total_loss = 0
                
                # Process in batches
                for i in range(0, len(dataset), batch_size):
                    batch = dataset[i:i+batch_size]
                    
                    # Prepare batch data
                    batch_inputs = {
                        "input_ids": torch.stack([item["input_ids"] for item in batch]),
                        "attention_mask": torch.stack([item["attention_mask"] for item in batch]),
                    }
                    batch_labels = torch.stack([item["labels"] for item in batch])
                    
                    # Zero gradients
                    optimizer.zero_grad()
                    
                    # Forward pass
                    outputs = model(**batch_inputs)
                    logits = outputs.logits
                    
                    # Loss calculation - Binary Cross Entropy for multi-label
                    loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, batch_labels)
                    total_loss += loss.item()
                    
                    # Backward pass and optimization
                    loss.backward()
                    optimizer.step()
                    
                print(f"Epoch {epoch+1}/{epochs} completed, Loss: {total_loss/(len(dataset)//batch_size)}")
                
            # Move model back to CPU for saving
            model.to(torch.device("cpu"))
            
            # Save updated model
            torch.save(model.state_dict(), local_model_path)
            
            # Upload model to S3
            s3.upload_file(local_model_path, BUCKET, model_key)
            
            # Update model cache
            with CACHE_LOCK:
                MODEL_CACHE[user_id] = (model, time.time())
            
            print(f"Model for user {user_id} updated successfully")
    except Exception as e:
        print(f"Error in perform_retraining: {str(e)}")
        traceback.print_exc()

 # ========================= federated_server.py (on EC2) =========================

# Complete the federated learning aggregation function
@app.route("/aggregate", methods=["POST"])
@rate_limit
def aggregate_models():
    """Aggregate multiple user models for federated learning"""
    try:
        data = request.get_json()
        user_ids = data.get("user_ids", [])
        
        if not user_ids or len(user_ids) < 2:
            return jsonify({"error": "Need at least 2 valid users for aggregation"}), 400
            
        # Add to background queue
        TASK_QUEUE.put((perform_model_aggregation, (user_ids,), {}))
        
        return jsonify({
            "status": "success", 
            "message": f"Aggregation of {len(user_ids)} models queued"
        })
    except Exception as e:
        print(f"Error in aggregate_models: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to queue aggregation: {str(e)}"}), 500

def perform_model_aggregation(user_ids):
    """Perform federated learning by aggregating models"""
    try:
        # Collect user models
        state_dicts = []
        valid_users = []
        
        for user_id in user_ids:
            try:
                model_key = f"models/{user_id}/model.pt"
                local_path = f"/tmp/{user_id}_model.pt"
                
                # Check if user model exists
                if not check_s3_object_exists(BUCKET, model_key):
                    print(f"Model for user {user_id} not found. Skipping.")
                    continue
                
                # Download model
                s3.download_file(BUCKET, model_key, local_path)
                
                # Load model weights
                weights = torch.load(local_path, map_location="cpu")
                state_dicts.append(weights)
                valid_users.append(user_id)
                
                print(f"Loaded model for user {user_id}")
            except Exception as e:
                print(f"Error loading model for user {user_id}: {str(e)}")
                continue
        
        # Check if we have enough valid models
        if len(state_dicts) < 2:
            print("Not enough valid models found for aggregation")
            return
        
        print(f"Aggregating {len(state_dicts)} models")
        
        # Initialize with the first model's weights
        agg_weights = {key: value.clone() for key, value in state_dicts[0].items()}
        
        # Add weights from other models
        for i in range(1, len(state_dicts)):
            for key in agg_weights.keys():
                if key in state_dicts[i]:
                    agg_weights[key] += state_dicts[i][key]
        
        # Average the weights
        for key in agg_weights.keys():
            agg_weights[key] = agg_weights[key] / len(state_dicts)
        
        # Save the aggregated model
        global_model_path = "/tmp/global_model.pt"
        torch.save(agg_weights, global_model_path)
        
        # Upload to S3
        s3.upload_file(global_model_path, BUCKET, GLOBAL_MODEL_KEY)
        
        print(f"Global model updated successfully from {len(valid_users)} user models")
        
        # Update base model periodically (e.g., after every 10 aggregations)
        global_version = get_global_version()
        if global_version % 10 == 0:
            print("Updating base model with new global model")
            s3.copy_object(Bucket=BUCKET, CopySource=f"{BUCKET}/{GLOBAL_MODEL_KEY}", Key=BASE_MODEL_KEY)
            
    except Exception as e:
        print(f"Error in perform_model_aggregation: {str(e)}")
        traceback.print_exc()
def should_trigger_aggregation():
    """Determine if model aggregation should be triggered"""
    global AGGREGATION_COUNTER
    with AGGREGATION_COUNTER_LOCK:
        AGGREGATION_COUNTER += 1
        should_aggregate = AGGREGATION_COUNTER % 100 == 0  # Trigger every 100 requests
        return should_aggregate

def trigger_model_aggregation():
    """Trigger model aggregation for federated learning"""
    try:
        # Get list of active users
        active_users = get_active_users()
        
        if len(active_users) < 2:
            print("Not enough active users for aggregation")
            return
            
        # Sample users for aggregation (to avoid using all users every time)
        import random
        if len(active_users) > 10:
            selected_users = random.sample(active_users, 10)
        else:
            selected_users = active_users
            
        print(f"Triggering model aggregation for {len(selected_users)} users")
        perform_model_aggregation(selected_users)
    except Exception as e:
        print(f"Error in trigger_model_aggregation: {str(e)}")
        traceback.print_exc()

def get_active_users(days=7):
    """Get list of active users from the last N days"""
    try:
        # We could use a database to track user activity
        # For now, let's just list all users with models in S3
        active_users = []
        
        # Paginator for S3 listing
        paginator = s3.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=BUCKET, Prefix="models/", Delimiter="/")
        
        for page in pages:
            if "CommonPrefixes" in page:
                for prefix in page["CommonPrefixes"]:
                    # Extract user_id from prefix
                    user_prefix = prefix.get("Prefix", "")
                    user_id = user_prefix.split("/")[1]
                    if user_id and user_id != "global_model":
                        active_users.append(user_id)
        
        return active_users
    except Exception as e:
        print(f"Error in get_active_users: {str(e)}")
        return []
    
def get_global_version():
    """Get current global model version"""
    try:
        version_key = "models/global_version.json"
        local_version = "/tmp/global_version.json"
        
        try:
            s3.download_file(BUCKET, version_key, local_version)
            with open(local_version, 'r') as f:
                version_data = json.load(f)
                current_version = version_data.get("version", 1)
        except:
            current_version = 1
        
        # Increment version
        new_version = current_version + 1
        
        # Save and upload
        with open(local_version, 'w') as f:
            json.dump({"version": new_version}, f)
        s3.upload_file(local_version, BUCKET, version_key)
        
        return new_version
    except Exception as e:
        print(f"Error in get_global_version: {str(e)}")
        return 1
    
# ---------------------------------------
#  ** S3 model download - upload - check HEAD
# ---------------------------------------

# Server Data Colloction Port
@app.route("/data/collect", methods=["POST"])
@rate_limit
def collect_training_data():
    """Collect and store user training data"""
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        texts = data.get("texts", [])
        emotions = data.get("emotions", [])
        
        if not user_id or not texts or not emotions or len(texts) != len(emotions):
            return jsonify({"error": "Invalid data format"}), 400
            
        # Add task to background queue for async processing
        TASK_QUEUE.put((upload_user_training_data, (user_id, texts, emotions), {}))
        
        return jsonify({"status": "success", "message": "Data collection queued"})
    except Exception as e:
        print(f"Error in data collection: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to collect data: {str(e)}"}), 500

def upload_user_training_data(user_id, texts, emotions_lists):
    """Store user training data in S3"""
    try:
        data_key = f"training_data/{user_id}.json"
        local_json = f"/tmp/{user_id}_data.json"
        
        # Get existing data or create new
        try:
            s3.download_file(BUCKET, data_key, local_json)
            with open(local_json, 'r') as f:
                training_data = json.load(f)
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                training_data = {"inputs": [], "labels": []}
            else:
                raise e
        
        # Add new data
        training_data["inputs"].extend(texts)
        training_data["labels"].extend(emotions_lists)
        
        # Save and upload
        with open(local_json, 'w') as f:
            json.dump(training_data, f)
        
        s3.upload_file(local_json, BUCKET, data_key)
        print(f"Training data updated for user {user_id}, total samples: {len(training_data['inputs'])}")
    except Exception as e:
        print(f"Error in upload_user_training_data: {str(e)}")
        traceback.print_exc()

# Trigger model retraining
def trigger_user_model_retrain(user_id):
    """Trigger retraining of user model"""
    try:
        # Add retraining task to queue
        TASK_QUEUE.put((perform_retraining, (user_id, {}), {}))
        print(f"Model retraining queued for user {user_id}")
    except Exception as e:
        print(f"Error in trigger_user_model_retrain: {str(e)}")
        traceback.print_exc()

async def download_model_from_s3(model_path: str, local_path: str):
    """Download model from S3 to local file system"""
    try:
        s3.download_file(BUCKET, model_path, local_path)
        model = torch.load(local_path, map_location=torch.device('cpu'))
        logger.info(f"Downloaded model from s3://{BUCKET}/{model_path} to {local_path}")
        return model
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error during download of model from S3: {str(e)}")

async def upload_model_to_s3(local_path: str, model_path: str):
    """Upload model from local path to S3"""
    try:
        s3.upload_file(local_path, BUCKET, model_path)
        logger.info(f"Uploaded model to s3://{BUCKET}/{model_path}")
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error during upload of model to S3: {str(e)}")

async def check_s3_object_exists(bucket: str, key: str) -> bool:
    """Check if an object exists in S3."""
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == "404":
            return False
        else:
            raise

async def copy_s3_object(src_bucket: str, src_key: str, dest_bucket: str, dest_key: str):
    """Copy an object within S3."""
    s3.copy_object(
        Bucket=dest_bucket,
        CopySource={'Bucket': src_bucket, 'Key': src_key},
        Key=dest_key
    )


# Multiple backgroudn workers 
start_background_workers()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
