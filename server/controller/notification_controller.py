from flask import Blueprint, request, jsonify
from utils.database import notification_tokens_collection
from datetime import datetime

notification_bp = Blueprint("notification_bp", __name__)

@notification_bp.route("/save-push-token", methods=["POST"])
def save_push_token():
    data = request.get_json()
    token = data.get("token")
    user_id = data.get("userId")

    if not token:
        return jsonify({"error": "Push token is required"}), 400

    # Upsert token (by token value)
    notification_tokens_collection.update_one(
        {"token": token},
        {
            "$set": {
                "token": token,
                "user_id": user_id,
                "updated_at": datetime.utcnow(),
            },
            "$setOnInsert": {
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )

    return jsonify({"success": True, "message": "Push token saved."}), 200
