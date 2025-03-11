from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
# Activity tablosu yok ki?
# from models.activity import Activity  
from utils.database import activities_collection
from flask_jwt_extended import jwt_required, get_jwt_identity

# Initialize Blueprint for user routes
# buraya gelen uzantılar /activity ile başlıcak
activities_bp = Blueprint("activity_bp", __name__)

# ---------------------------------------
#  **Activity Logging**
# ---------------------------------------
@activities_bp.route("/", methods=["POST"]) # localhost:5000/activity
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
            "timestamp": datetime.datetime.utcnow()
        })

        return jsonify({"message": "Activity logged successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500