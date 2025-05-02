import certifi
from fastapi import HTTPException, logger
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import pymongo
import torch
from utils.database import activities_collection, journal_entries_collection, check_in_collection, chat_collection, prompt_collection;
from pymongo import MongoClient, DESCENDING
from bson.regex import Regex
from collections import defaultdict
import numpy as np
from bson.objectid import ObjectId
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans

# Initialize Blueprint for user routes
activities_bp = Blueprint("activity_bp", __name__)

# Device for PyTorch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# AWS Configuration
AWS_REGION = "eu-north-1"
AWS_ACCESS_KEY = "AKIAXGZAMH3HUVQSPNED"
AWS_SECRET_KEY = "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"
# S3 
S3_BUCKET = "sentiobucket"

# sentio-user-model-endpoint sentio-user-endpoint
BASE_MODEL_PATH = "models/model.pt"
BASE_MODEL_TAR_PATH = "models/model.tar.gz"

# E2c Model 
E2C_IP = "13.60.245.250" # E2C Distance Server Public IP - NEED TO CHANGE EVERY TIME WE GET NEW SERVER OPEN/CLOSE

# MongoAPI
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"
# MongoDB connection
client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where()) 


# ---------------------------------------
#  **Activity Logging**
# ---------------------------------------
@activities_bp.route("/track-activity", methods=["POST"]) # localhost:5000/activity
@jwt_required()
def track_activity():
    try:
        user_id = get_jwt_identity()
        activity = request.json.get("activity")

        if not activity:
            return jsonify({"error": "Activity is required"}), 400

        activities_collection.insert_one({
            "user_id": user_id,
            "activity": activity,
            "timestamp": datetime.now()
        })

        return jsonify({"message": "Activity logged successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@activities_bp.route("/activity/emotion-distribution", methods=["GET"])
def get_global_emotions():
    try:
        emotion_counts = defaultdict(int)
        total_emotions = 0

        # Define helper to collect emotions from entries
        def extract_emotions(collection, field="journalSentiments"):
            entries = collection.find({field: {"$exists": True}})
            for entry in entries:
                sentiments = entry.get(field, [])
                for sentiment in sentiments:
                    label = sentiment.get("emotion")
                    score = sentiment.get("percentage", 1)
                    if label:
                        emotion_counts[label] += score
                        nonlocal total_emotions
                        total_emotions += score

        # Collect emotions from all sources
        extract_emotions(journal_entries_collection)
        extract_emotions(check_in_collection)
        extract_emotions(chat_collection, field="chatSentiments")
        extract_emotions(prompt_collection, field="journalSentiments")

        if total_emotions == 0:
            return jsonify({"error": "No emotion data found."}), 404

        percentages = {
            emotion: round((count / total_emotions) * 100, 2)
            for emotion, count in emotion_counts.items()
        }

        return jsonify({
            "total": int(total_emotions),
            "percentages": dict(sorted(percentages.items(), key=lambda x: -x[1]))
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@activities_bp.route("/activity/emotion-by-keyword", methods=["GET"])
def get_emotion_by_keyword():
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return jsonify({"error": "Missing keyword parameter"}), 400

    emotion_counts = defaultdict(int)
    total = 0

    regex = Regex(f".*{keyword}.*", "i")  # case-insensitive

    def search_with_emotions(collection, content_field, sentiment_field="journalSentiments"):
        entries = collection.find({
            content_field: {"$regex": regex},
            sentiment_field: {"$exists": True}
        })
        for entry in entries:
            sentiments = entry.get(sentiment_field, [])
            for s in sentiments:
                emotion = s.get("emotion")
                percentage = s.get("percentage", 1)
                if emotion:
                    emotion_counts[emotion] += percentage
                    nonlocal total
                    total += percentage

    search_with_emotions(journal_entries_collection, "entryContent")
    search_with_emotions(check_in_collection, "moodText")
    search_with_emotions(chat_collection, "lastMessage", sentiment_field="chatSentiments")
    search_with_emotions(prompt_collection, "entryContent")

    if total == 0:
        return jsonify({"error": "No data found for the keyword."}), 404

    percentages = {
        emotion: round((count / total) * 100, 2)
        for emotion, count in emotion_counts.items()
    }

    return jsonify({
        "keyword": keyword,
        "total_mentions": int(total),
        "percentages": dict(sorted(percentages.items(), key=lambda x: -x[1]))
    }), 200


async def call_llm(prompt, user_id):
    """ 
    # Example API USAGE 
    url = "http://13.61.141.224:8080/predict"
    payload = {
        "user_id": "test_user",
        "message": "I'm feeling really happy today because I accomplished something I've been working on for weeks!"
    }
    response = requests.post(url, json=payload)
    print(response.status_code)
    print(json.dumps(response.json(), indent=2))
    """
    try:
        import aiohttp
        # payload = {"user_id": user_id, "message": prompt}
        # Update the paylod for multiple chat_id 
        payload = {
                    "user_id": user_id,
                    "message": prompt,
        }
        ec2_url = f"http://{E2C_IP}:8080/summary"  # Send to cloud like this
        logger.info(f"Connecting to E2C Distance Servre: {E2C_IP} to {ec2_url}\nSending payload :{payload}")

        async with aiohttp.ClientSession() as session:
            async with session.post(ec2_url, json=payload) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    emotions = ", ".join(result.get("predicted_emotions", []))
                    chat = result.get("chat_response", "NAN")
                else:
                    raise Exception(f"EC2 returned status {resp.status}")
                      
        logger.info(f"Results from E2C Distance Servre: {E2C_IP} by {ec2_url} equals to\n result :{result}\n emotions {emotions}")          
        print(f"Model returned the result\n {result}\nwhere:\n-emotions : {emotions}\n-chat: {chat}\n ")
        return emotions, resp.status , chat
    except Exception as ec2_error:
                logger.error(f"EC2 inference error: {ec2_error}")
                raise HTTPException(status_code=500, detail=f"EC2 inference failed: {str(ec2_error)}")


@activities_bp.route("/activity/summary", methods=["GET"])
def global_emotional_summary():
    try:
        texts = []
        all_collections = [
            journal_entries_collection, check_in_collection,
            chat_collection, activities_collection
        ]
        for col in all_collections:
            entries = list(col.find({}))
            for entry in entries:
                if "entryContent" in entry:
                    texts.append(entry["entryContent"])
                elif "message" in entry:
                    texts.append(entry["message"])

        if not texts:
            return jsonify({"error": "No data found"}), 404

        # Text clustering
        vectorizer = TfidfVectorizer(stop_words='english')
        X = vectorizer.fit_transform(texts)
        num_clusters = 5
        model = KMeans(n_clusters=num_clusters, random_state=42)
        model.fit(X)

        clusters = {i: [] for i in range(num_clusters)}
        for i, label in enumerate(model.labels_):
            clusters[label].append(texts[i])

        summaries = []
        for i, entries in clusters.items():
            prompt = f"Summarize the emotional theme of the following {len(entries)} texts:\n" + "\n".join(entries[:10])
            summary = call_llm(prompt)
            summaries.append({"cluster": i, "summary": summary, "count": len(entries)})

        return jsonify({"clusters": summaries}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

