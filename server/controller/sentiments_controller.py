from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models.sentiment import Sentiment  # Import the Sentiment model
from utils.database import sentiments_collection, journal_entries_collection, check_in_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from utils.load_model import model, tokenizer
import torch
import torch.nn.functional as F
import numpy as np
import json
from pathlib import Path
from collections import Counter

# Initialize Blueprint for user routes
sentiments_bp = Blueprint("sentiments_bp", __name__)

# Your custom emotion labels
EMOTIONS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Load the thresholds at module level
SERVER_DIR = Path(__file__).parent.parent
THRESHOLDS_PATH = SERVER_DIR / "ml" / "best_thresholds.json"

try:
    with open(THRESHOLDS_PATH) as f:
        EMOTION_THRESHOLDS = json.load(f)
    print("✅ Loaded emotion thresholds from best_thresholds.json")
except Exception as e:
    print(f"❌ Error loading thresholds: {e}")
    EMOTION_THRESHOLDS = {emotion: 0.3 for emotion in EMOTIONS}  # fallback

# ---------------------------------------
#  **Sentiment Analysis**
# ---------------------------------------
@sentiments_bp.route("/analyze", methods=["POST"])
def analyze_sentiment():
    try:
        print("🔵 Starting sentiment analysis")
        data = request.get_json()
        text = data.get('text')
        print(f"🔹 Analyzing text: {text[:50]}...")
        
        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Split text into segments
        segments = text.split(". ")
        all_emotions = []

        # Analyze each segment
        for segment in segments:
            if segment.strip():
                # Tokenize the segment
                inputs = tokenizer(segment, return_tensors="pt", padding="max_length", 
                                truncation=True, max_length=128)
                
                # Get model prediction for segment
                with torch.no_grad():
                    outputs = model(**inputs)
                    logits = outputs.logits
                    probabilities = torch.sigmoid(logits).squeeze()
                    
                    # Convert to numpy for easier handling
                    if len(probabilities.shape) == 0:
                        probabilities = probabilities.unsqueeze(0)
                    probs_np = probabilities.cpu().numpy()
                
                # Store emotions for this segment using trained thresholds
                for idx, prob in enumerate(probs_np):
                    threshold = EMOTION_THRESHOLDS[EMOTIONS[idx]]
                    if prob > threshold:
                        all_emotions.append({
                            "code": idx,
                            "label": EMOTIONS[idx],
                            "score": float(prob)
                        })

        # If no emotions found in any segment, analyze the full text
        if not all_emotions:
            inputs = tokenizer(text, return_tensors="pt", padding="max_length", 
                            truncation=True, max_length=128)
            
            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits
                probabilities = torch.sigmoid(logits).squeeze()
                
                if len(probabilities.shape) == 0:
                    probabilities = probabilities.unsqueeze(0)
                probs_np = probabilities.cpu().numpy()
            
            # Get the emotion with highest probability relative to its threshold
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
        
        # Sort all emotions by score and remove duplicates (keep highest score for each emotion)
        seen_emotions = {}
        for emotion in all_emotions:
            label = emotion["label"]
            if label not in seen_emotions or emotion["score"] > seen_emotions[label]["score"]:
                seen_emotions[label] = emotion

        # Convert back to list and sort
        emotions = list(seen_emotions.values())
        emotions.sort(key=lambda x: x['score'], reverse=True)
        
        print(f"✅ Detected emotions: {emotions}")
        
        return jsonify({
            "text": text,
            "emotions": emotions
        })

    except Exception as e:
        print(f"❌ Error in sentiment analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to analyze sentiment"}), 500
    

@sentiments_bp.route("/<timeframe>", methods=["GET"])
@jwt_required()
def get_sentiment_data(timeframe):
    try:
        user_id = get_jwt_identity()

        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400

        user_id = ObjectId(user_id)
        now = datetime.utcnow()

        # Determine the time range
        if timeframe == 'day':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            date_group = {"$dateToString": {"format": "%H", "date": "$timestamp"}}
        elif timeframe == 'week':
            start_date = now - timedelta(days=7)
            date_group = {"$dateToString": {"format": "%a", "date": "$timestamp"}}  # Groups by weekday name
        elif timeframe == 'month':
            start_date = now - timedelta(days=30)
            date_group = {"$isoWeek": "$timestamp"}  # Groups by week number
        else:
            return jsonify({"error": "Invalid timeframe"}), 400

        # MongoDB Aggregation Pipeline
        pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": start_date}}},
            {"$group": {
                "_id": date_group,
                "avg_joy": {"$avg": "$joy"},
                "avg_excitement": {"$avg": "$excitement"},
                "avg_approval": {"$avg": "$approval"}
            }},
            {"$sort": {"_id": 1}}
        ]

        sentiments = list(sentiments_collection.aggregate(pipeline))

        # Format output
        result = [{"name": item["_id"], "Joy": round(item["avg_joy"], 1), 
                   "Excitement": round(item["avg_excitement"], 1), 
                   "Approval": round(item["avg_approval"], 1)} 
                  for item in sentiments]

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@sentiments_bp.route("/current", methods=["GET"])
@jwt_required()
def get_current_mood():
    try:
        user_id = get_jwt_identity()

        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400

        user_id = ObjectId(user_id)

        # Get the latest sentiment entry
        current_sentiment = sentiments_collection.find_one(
            {"user_id": user_id},
            projection={"joy": 1, "excitement": 1, "approval": 1, "_id": 0},
            sort=[("timestamp", -1)]
        )

        if not current_sentiment:
            return jsonify({"error": "No sentiment data found"}), 404

        # Calculate overall mood
        avg_score = (current_sentiment['joy'] + 
                    current_sentiment['excitement'] + 
                    current_sentiment['approval']) / 3

        mood = "Happiness" if avg_score >= 4 else \
               "Content" if avg_score >= 3 else \
               "Neutral" if avg_score >= 2 else "Low"

        return jsonify({
            "mood": mood,
            "description": "Joy, Excitement, and Approval",
            "scores": current_sentiment
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

#sentiment trends and insights
@sentiments_bp.route("/insights", methods=["GET"])
@jwt_required()
def get_emotional_insights():
    try:
        user_id = get_jwt_identity()
        print("🔐 JWT user ID:", user_id)

        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        user_object_id = ObjectId(user_id)

        # Fetch the user’s journal document
        journal_data = journal_entries_collection.find_one({"_id": user_object_id})
        print(f"📓 Journal document: {journal_data.keys() if journal_data else 'None'}")

        all_emotions = []

        # If the document exists and has journal entries
        if journal_data and "journalEntries" in journal_data:
            journal_entries = journal_data["journalEntries"]
            print(f"📖 Found {len(journal_entries)} journal entries")

            for entry in journal_entries:
                sentiments = entry.get("journalSentiments", [])
                for sentiment in sentiments:
                    if isinstance(sentiment, dict):
                        all_emotions.append(sentiment.get("emotion"))
                    elif isinstance(sentiment, str):
                        all_emotions.append(sentiment)

        # Fetch check-in sentiments
        check_ins = list(check_in_collection.find({
            "userId": user_object_id,
            "sentiments": {"$exists": True, "$ne": []}
        }))
        print(f"📥 Found {len(check_ins)} check-ins")

        for checkin in check_ins:
            all_emotions.extend(checkin.get("sentiments", []))

        print(f"🎯 All emotions extracted: {all_emotions}")

        if not all_emotions:
            return jsonify({
                "insight": "No emotional data found. Start journaling or check in to build your insights!",
                "top_emotions": []
            }), 200

        # Count top emotions
        emotion_counts = Counter(all_emotions)
        top_emotions = emotion_counts.most_common(3)
        print("📈 Top emotions:", top_emotions)

        # Convert emotion codes to labels
        emotion_labels = []
        for code, _ in top_emotions:
            try:
                if isinstance(code, int) and 0 <= code < len(EMOTIONS):
                    emotion_labels.append(EMOTIONS[code].lower())
                elif isinstance(code, str):
                    emotion_labels.append(code.lower())
                else:
                    emotion_labels.append("unknown")
            except:
                emotion_labels.append("unknown")

        insight = f"You’ve been feeling {', '.join(emotion_labels)} more often lately. Keep an eye on your emotional patterns!"

        return jsonify({
            "top_emotions": [{"label": label, "count": count} for label, (_, count) in zip(emotion_labels, top_emotions)],
            "insight": insight
        })


    except Exception as e:
        print("❌ Error generating insights:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to generate emotional insights."}), 500
