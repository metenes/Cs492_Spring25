from flask import Blueprint, request, jsonify
from bson import ObjectId
from utils.database import check_in_collection, users_collection, sentiments_collection, prompt_collection
from datetime import datetime

# Initialize Blueprint for check-in routes
check_bp = Blueprint("check_bp", __name__)

# Route to submit a new check-in entry using PyMongo
@check_bp.route('/submit', methods=['POST'])
def create_check_in():
    try:
        data = request.get_json()
        
        # Ensure required fields exist
        if not data.get('user_id') or not data.get('sentiments') or not data.get('causes'):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Validate user exists
        user = users_collection.find_one({"_id": ObjectId(data['user_id'])})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Get the last entry_id and increment
        last_entry = check_in_collection.find_one(sort=[("entry_id", -1)])
        new_entry_id = 1 if not last_entry else last_entry['entry_id'] + 1
        
        # Store sentiments and causes as plain text
        new_check_in = {
            "entry_id": new_entry_id,
            "user_id": ObjectId(data["user_id"]),
            "sentiments": data["sentiments"],  # Store as list of strings
            "causes": data["causes"],  # Store as list of strings
            "comments": data.get("comments", []),
            "created_at": datetime.utcnow()
        }
        
        # Insert check-in into MongoDB
        check_in_collection.insert_one(new_check_in)

        return jsonify({
            "success": True,
            "message": "Check-in submitted successfully",
            "entry_id": new_entry_id
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Route to get check-in history for a user
@check_bp.route('/history/<user_id>', methods=['GET'])
def get_check_in_history(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        entries = check_in_collection.find({"user_id": ObjectId(user_id)})

        # Convert entries to JSON format
        history = []
        for entry in entries:
            history.append({
                "entry_id": entry["entry_id"],
                "user_id": str(entry["user_id"]),
                "sentiments": entry["sentiments"],  # No need to convert objects
                "causes": entry["causes"],
                "comments": entry.get("comments", []),
                "created_at": entry.get("created_at").isoformat() if entry.get("created_at") else None
            })

        return jsonify({"history": history}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Route to get a specific check-in entry
@check_bp.route('/<int:entry_id>', methods=['GET'])
def get_check_in_entry(entry_id):
    try:
        entry = check_in_collection.find_one({"entry_id": entry_id})
        if not entry:
            return jsonify({"error": "Check-in entry not found"}), 404
        
        entry_data = {
            "entry_id": entry["entry_id"],
            "user_id": str(entry["user_id"]),
            "sentiments": entry["sentiments"],
            "causes": entry["causes"],
            "comments": entry.get("comments", []),
            "created_at": entry.get("created_at").isoformat() if entry.get("created_at") else None
        }

        return jsonify(entry_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
