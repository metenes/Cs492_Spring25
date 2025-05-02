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
from collections import Counter, defaultdict


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
        now = datetime.now()

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
    

@sentiments_bp.route("/insights", methods=["GET"])
@jwt_required()
def get_emotional_insights():
    from collections import Counter

    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400

        # 🔍 Fetch journal entries with emotions
        journal_doc = journal_entries_collection.find_one({"_id": ObjectId(user_id)})
        journal_entries = journal_doc.get("journalEntries", []) if journal_doc else []

        # 🔍 Fetch check-in entries with emotions
        checkins = list(check_in_collection.find({"userId": user_id}))

        # 🧠 Collect all emotions
        all_emotions = []

        for entry in journal_entries:
            for s in entry.get("journalSentiments", []):
                if isinstance(s, dict):
                    all_emotions.append(s.get("emotion"))
                elif isinstance(s, str):
                    all_emotions.append(s)

        for entry in checkins:
            for s in entry.get("sentiments", []):
                all_emotions.append(s)
        
        if not all_emotions:
            return jsonify({
                "insight": "No emotional data found. Start journaling or check in to build your insights!",
                "top_emotions": [],
                "mental_state": None,
                "recommendation": None,
                "emotion_cause_links": {}
            })

        # 🧮 Count and sort top 3 emotions
        emotion_counts = Counter(all_emotions)
        top_emotions_raw = emotion_counts.most_common(3)

        # Convert int codes to emotion labels if necessary
        top_emotions = []
        top_emotion_labels = []
        for emotion, count in top_emotions_raw:
            label = EMOTIONS[emotion] if isinstance(emotion, int) else emotion.lower()
            top_emotions.append((label, count))
            top_emotion_labels.append(label)

        # Top causes linked with top emotions
        aggregated = get_top_causes_by_emotion(user_id)
        emotion_cause_links = {}

        for record in aggregated:
            emotion = record["emotion"]
            if isinstance(emotion, int):
                emotion = EMOTIONS[emotion]
            emotion = emotion.lower()
            if emotion in top_emotion_labels:
                emotion_cause_links[emotion] = record["topCauses"]

        """ emotion_to_causes = defaultdict(list)
        for entry in checkins:
            sentiments = entry.get("sentiments", [])
            causes = entry.get("causes", [])
            for s in sentiments:
                label = EMOTIONS[s] if isinstance(s, int) else s
                if label in top_emotion_labels:
                    emotion_to_causes[label].extend(causes)

        emotion_cause_links = {}
        for emotion in top_emotion_labels:
            cause_counter = Counter(emotion_to_causes[emotion])
            emotion_cause_links[emotion] = cause_counter.most_common(3)
        """

        # 📚 Science-backed combinations and mental states
        combos_map = {
            frozenset(["curiosity", "fear"]): {
                "mental_state": "Navigating uncertainty",
                "recommendation": "Try grounding techniques or guided journaling to process your thoughts."
            },
            frozenset(["gratitude", "sadness"]): {
                "mental_state": "Bittersweet reflection",
                "recommendation": "Reflect on what you're thankful for while acknowledging your grief."
            },
            frozenset(["joy", "remorse"]): {
                "mental_state": "Conflicted contentment",
                "recommendation": "Write about the source of your joy and what you’d do differently next time."
            },
            frozenset(["anger", "love"]): {
                "mental_state": "Emotional ambivalence",
                "recommendation": "Consider writing a letter (even if you don’t send it) to sort through those feelings."
            },
            frozenset(["fear", "optimism"]): {
                "mental_state": "Hopeful anxiety",
                "recommendation": "Try setting small, achievable goals to regain a sense of control."
            }
        }

        matched_combo = None
        for combo in combos_map.keys():
            if combo.issubset(set(top_emotion_labels)):
                matched_combo = combo
                break

        if matched_combo:
            matched_data = combos_map[matched_combo]
            insight = f"You’ve recently felt {', '.join(matched_combo)}—a unique emotional state known as **{matched_data['mental_state']}**."
            return jsonify({
                "top_emotions": [{"label": e[0], "count": e[1]} for e in top_emotions],
                "insight": insight,
                "mental_state": matched_data["mental_state"],
                "recommendation": matched_data["recommendation"],
                "emotion_cause_links": emotion_cause_links
            })

        # Fallback: generic message
        emotion_recommendations = {
            "joy": ["Celebrate the good moments by sharing them in your journal."],
            "sadness": ["Try writing a letter to yourself expressing compassion."],
            "anger": ["Write about what triggered the anger and what you'd rather do next time."],
            "fear": ["Journaling can help reframe fearful thoughts with empowering ones."],
            "love": ["Reflect on the relationships or people you're grateful for."],
            "gratitude": ["List a few things you're thankful for today."],
            "remorse": ["Explore what led to your remorse and what you can learn from it."],
            "curiosity": ["Let your curiosity guide your writing today—ask 'why' and explore."],
            "neutral": ["Neutral states are valid too. Journaling can help add intention or direction."]
        }
        individual_recs = []
        for e in top_emotion_labels:
            if e in emotion_recommendations:
                individual_recs.extend(emotion_recommendations[e])

        fallback_insight = f"You’ve been feeling {', '.join([e[0].lower() for e in top_emotions])} more often lately. Keep an eye on your emotional patterns!"

        print("********** SO SAD ************")
        print(emotion_cause_links)
        return jsonify({
            "top_emotions": [{"label": e[0], "count": e[1]} for e in top_emotions],
            "insight": fallback_insight,
            "mental_state": None,
            "recommendation": individual_recs if individual_recs else ["Keep journaling to better understand your emotional patterns."],
            "emotion_cause_links": emotion_cause_links
        })
    

    except Exception as e:
        print("❌ Error generating insights:", e)
        return jsonify({"error": "Failed to generate emotional insights."}), 500


def get_top_causes_by_emotion(user_id):
    print("Running aggregation for user:", user_id)
    checkin_docs = list(check_in_collection.find({"userId": user_id}))
    print(f"📦 Found {len(checkin_docs)} check-in entries for aggregation")
    if checkin_docs:
        print("Example document:", checkin_docs[0])

    pipeline = [
        {"$match": {"userId": user_id}},
        {"$unwind": "$sentiments"},
        {"$unwind": "$causes"},
        {"$group": {
            "_id": {"emotion": "$sentiments", "cause": "$causes"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$group": {
            "_id": "$_id.emotion",
            "topCauses": {"$push": {"cause": "$_id.cause", "count": "$count"}}
        }},
        {"$project": {
            "emotion": "$_id",
            "topCauses": {"$slice": ["$topCauses", 2]},
            "_id": 0
        }}
    ]

    results = list(check_in_collection.aggregate(pipeline))
    print("🎯 Aggregated top causes:", results)
    return list(check_in_collection.aggregate(pipeline))
