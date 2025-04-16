from flask import Blueprint, request, jsonify
from utils.database import notification_tokens_collection
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
import requests
from bson import ObjectId
from utils.notification_helper import *

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

@notification_bp.route("/update-push-token-user", methods=["PATCH"])
@jwt_required()
def update_push_token_user():
    try:
        data = request.get_json()
        token = data.get("token")

        if not token:
            return jsonify({"error": "Push token is required"}), 400

        user_id = get_jwt_identity()

        result = notification_tokens_collection.update_one(
            {"token": token},
            {"$set": {"user_id": ObjectId(user_id), "updated_at": datetime.utcnow()}}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Token not found"}), 404

        return jsonify({"success": True, "message": "Push token updated with userId."}), 200

    except Exception as e:
        print(f"❌ Error in update_push_token_user: {e}")
        return jsonify({"error": str(e)}), 500


def send_daily_reminders():
    print("📅 Running daily reminder job...")

    user_tokens = get_all_user_push_tokens()
    for user_id in user_tokens:
        result = send_push_to_user_id(
            user_id,
            "🌞 Daily Reminder",
            "Don't forget to check in and stay productive today!"
        )
        print(f"🔔 Sent to {user_id}: {result}")