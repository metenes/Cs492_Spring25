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
            {"$set": {"user_id": ObjectId(user_id), "updated_at": datetime.utcnow()},
            "$setOnInsert": {"created_at": datetime.utcnow(), "reminder_notification_frequency": "daily"}
            },
            upsert=True
        )

        if result.matched_count == 0:
            return jsonify({"error": "Token not found"}), 404

        return jsonify({"success": True, "message": "Push token updated with userId."}), 200

    except Exception as e:
        print(f"❌ Error in update_push_token_user: {e}")
        return jsonify({"error": str(e)}), 500


@notification_bp.route("/update-notification-preferences", methods=["PATCH"])
@jwt_required()
def update_notification_preferences():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        frequency = data.get("frequency")
        pushToken = data.get("pushToken")

        if not frequency or not pushToken:
            return jsonify({"error": "Frequency and token are required"}), 400

        user_id = get_jwt_identity()

        result = notification_tokens_collection.update_one(
            {"token": pushToken, "user_id": ObjectId(user_id)},
            {"$set": {"reminder_notification_frequency": frequency, "updated_at": datetime.utcnow()}}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Token not found"}), 404

        return jsonify({"success": True, "message": "Notification preferences updated."}), 200

    except Exception as e:
        print(f"❌ Error in update_notification_preferences: {e}")
        return jsonify({"error": str(e)}), 500
    
    
@notification_bp.route("/get-notification-preferences/<push_token>", methods=["GET"])
@jwt_required()
def get_notification_preferences(push_token):
    try:
        user_id = get_jwt_identity()
        if push_token in [None, "null", "None", ""]:
            push_token = None

        print(f"User ID: {user_id}, Push Token: {push_token}")
        token_entry = None
        if not push_token:
            print("try to find without token")
            token_entry = notification_tokens_collection.find_one({"user_id": ObjectId(user_id)})
        else:
            print("try to find with token")
            token_entry = notification_tokens_collection.find_one({"token": push_token, "user_id": ObjectId(user_id)})

        print(f"Token Entry: {token_entry}")
        if not token_entry:
            return jsonify({"error": "Token not found"}), 404

        return jsonify({
            "success": True,
            "reminder_notification_frequency": token_entry.get("reminder_notification_frequency"),
            "message": "Notification preferences retrieved."
        }), 200

    except Exception as e:
        print(f"❌ Error in get_notification_preferences: {e}")
        return jsonify({"error": str(e)}), 500


def send_journal_reminders():
    print("Running reminder job...")

    user_entries = get_all_user_push_tokens()

    for user_id, token_entry in user_entries.items():

        notification_result = should_send_reminder(token_entry)
        if not notification_result['result']: 
            continue
        
        result = send_push_to_user_id(
            user_id,
            "🌞 Keep the Streak Going!",
            notification_result['message'],
        )
        print(f" Notification Sent to {user_id}: {result}")

        notification_tokens_collection.update_one(
            {"user_id": ObjectId(user_id)},
            {"$set": {"last_reminder_notification_date": datetime.utcnow()}}
        )

    print("Reminder job completed.")

def send_analysis_notifications():
    print("Running analysis notification job...")

    user_entries = get_all_user_push_tokens()
    for user_id, token_entry in user_entries.items():
        notification_result = should_send_analysis_notification(token_entry)
        if not notification_result['result']: 
            continue
        
        result = send_push_to_user_id(
            user_id,
            "📊 Your Journal Analysis is Ready!",
            notification_result['message'],
        )

        notification_tokens_collection.update_one(
            {"user_id": ObjectId(user_id)},
            {"$set": {"last_analysis_notification_date": datetime.utcnow()}}
        )
        print(f" Notification Sent to {user_id}: {result}")

    print("Analysis notification job completed.")