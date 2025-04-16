import requests
from bson import ObjectId
from utils.database import notification_tokens_collection, journal_entries_collection
from datetime import datetime
from flask import jsonify

def send_push_to_user_id(user_id, title, body):
    try:
        print(f"🔔 Sending push to user {user_id} | Title: {title} | Body: {body}")

        token_entry = get_token_from_userId(user_id)
        if not token_entry:
            print("❌ No token found")
            return {"error": "No push token found for this user"}

        token = token_entry["token"]
        if not token:
            print("❌ Token missing in entry")
            return {"error": "Token missing"}

        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body
        }

        response = requests.post("https://exp.host/--/api/v2/push/send", json=message)
        print(f"✅ Expo response: {response.status_code} - {response.text}")

        return {"status": "success", "expo_response": response.json()}

    except Exception as e:
        print(f"❌ Error in send_push_to_user_id: {e}")
        return {"error": str(e)}


def get_all_user_push_tokens():
    try:
        token_entries = notification_tokens_collection.find(
            {"user_id": {"$ne": None}},
            {"_id": 0, "user_id": 1, "token": 1}
        )

        user_token_map = {}
        for entry in token_entries:
            user_id = str(entry["user_id"])
            token = entry["token"]
            user_token_map[user_id] = token

        return user_token_map
    except Exception as e:
        print(f"❌ Error in get_all_user_push_tokens: {e}")
        return {}


def get_userId_from_token(token):
    try:

        token_entry = notification_tokens_collection.find_one({"token": token})
        print(f"Token entry: {token_entry}")
        if token_entry:
            user_id = str(token_entry["user_id"])
            return jsonify({"userId": user_id}), 200
        else:
            return jsonify({"error": "No userId found for this token"}), 404

    except Exception as e:
        print(f"❌ Error in get_userId_from_token: {e}")
        return jsonify({"error": str(e)}), 500


def get_token_from_userId(user_id):
    try:
        if not user_id:
            return jsonify({"error": "userId is required"}), 400

        token_entry = notification_tokens_collection.find_one({"user_id": ObjectId(user_id)})
        if not token_entry:
            return None
        
        token_entry["_id"] = str(token_entry["_id"])
        token_entry["user_id"] = str(token_entry["user_id"])
        print(f"Token entry: {token_entry}")

        return token_entry 

    except Exception as e:
        print(f"❌ Error in get_token_from_userId: {e}")
        return jsonify({"error": str(e)}), 500


def has_written_journal_today(user_id):
    try:
        if not user_id:
            return False
        
        user_object_id = ObjectId(user_id)
        today = datetime.utcnow().date()

        journal_doc = journal_entries_collection.find_one({"_id": user_object_id})

        if not journal_doc or "journalEntries" not in journal_doc:
            return False

        for entry in journal_doc["journalEntries"]:
            entry_date = entry.get("entryDate")

            if isinstance(entry_date, str):
                try:
                    entry_date = datetime.fromisoformat(entry_date.replace("Z", "+00:00"))
                except ValueError:
                    continue

            if isinstance(entry_date, datetime) and entry_date.date() == today:
                return True
            
        return False

    except Exception as e:
        print(f" Error checking journal for user {user_id}: {e}")
        return False