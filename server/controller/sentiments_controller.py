from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models.sentiment import Sentiment  # Import the Sentiment model
from utils.database import sentiments_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

# Initialize Blueprint for user routes
sentiments_bp = Blueprint("sentiments_bp", __name__)

@sentiments_bp.route("/api/sentiment-analysis", methods=["GET"])
@jwt_required()
def sentiment_analysis():
    try:
        user_id = get_jwt_identity()
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        
        user_id = ObjectId(user_id)
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        interval = request.args.get("interval", "monthly")
        emotions = request.args.get("emotions") #if no emotions are provided, all emotions will be considered
        
        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date are required"}), 400
        
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        
        if interval not in ["daily", "weekly", "monthly"]:
            return jsonify({"error": "Invalid interval. Use 'daily', 'weekly', or 'monthly'"}), 400
        
        emotion_filter = emotions.split(",") if emotions else None
        
        # Define grouping key for MongoDB aggregation
        if interval == "daily":
            date_group = {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}
        elif interval == "weekly":
            date_group = {"$isoWeekYear": "$timestamp", "$isoWeek": "$timestamp"}
        else:  # monthly
            date_group = {"$dateToString": {"format": "%Y-%m", "date": "$timestamp"}}
        
        pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": start_date, "$lte": end_date}}},
            {"$unwind": "$emotions"},
        ]
        
        if emotion_filter:
            pipeline.append({"$match": {"emotions.emotion_name": {"$in": emotion_filter}}})
        
        pipeline.extend([
            {"$group": {
                "_id": {"time_period": date_group, "emotion_name": "$emotions.emotion_name"},
                "total_percentage": {"$sum": "$emotions.percentage"},
                "entry_count": {"$sum": 1}
            }},
            {"$sort": {"_id.time_period": 1}}
        ])
        
        sentiment_data = list(sentiments_collection.aggregate(pipeline))
        
        response = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "interval": interval,
            "emotion_analysis": [
                {
                    "time_period": item["_id"]["time_period"],
                    "emotion_name": item["_id"]["emotion_name"],
                    "total_percentage": round(item["total_percentage"], 1),
                    "entry_count": item["entry_count"]
                }
                for item in sentiment_data
            ]
        }
        
        return jsonify(response), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

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