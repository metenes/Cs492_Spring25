from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models.sentiment import Sentiment  # Import the Sentiment model
from utils.database import sentiments_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from utils.load_model import model, tokenizer
import torch
import torch.nn.functional as F

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
                    segment_probabilities = torch.sigmoid(outputs.logits).squeeze().tolist()
                
                # Store emotions for this segment
                for idx, prob in enumerate(segment_probabilities):
                    if prob > 0.2:  # threshold
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
                probabilities = torch.sigmoid(outputs.logits).squeeze().tolist()
            
            max_idx = probabilities.index(max(probabilities))
            all_emotions.append({
                "code": max_idx,
                "label": EMOTIONS[max_idx],
                "score": float(probabilities[max_idx])
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