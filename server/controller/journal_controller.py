from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models.journal_entry import JournalEntry  # Import the JournalEntry model
from utils.database import journal_entries_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from utils.load_model import model

journal_bp = Blueprint("journal_bp", __name__)


@journal_bp.route("/save-journal-entry", methods=["POST"])
@jwt_required()
def save_journal_entry():
    try:
        user_id = get_jwt_identity()
        data = request.json
        print(user_id)

        if not data.get("content"):
            return jsonify({"error": "Journal entry cannot be empty"}), 400

        journal_entry = {
            "user_id": ObjectId(user_id),
            "content": data["content"],
            "images": data.get("images", []),  # Save images if available
            "category": data.get("category", "Freeform Journal"),
            "timestamp": datetime.utcnow()
        }

        # Insert into MongoDB
        inserted_entry = journal_entries_collection.insert_one(journal_entry)
        journal_entry["_id"] = str(inserted_entry.inserted_id)  # Convert ObjectId to string for response
        journal_entry["user_id"] = str(journal_entry["user_id"]) 

        return jsonify({"message": "Journal entry saved successfully", "entry": journal_entry}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@journal_bp.route("/get-journal-entries", methods=["GET"])
@jwt_required()
def get_journal_entries():
    try:
        user_id = get_jwt_identity()
        print("Fetching journal entries for user:", user_id)

        # Retrieve user's journal entries from MongoDB
        journal_entries = journal_entries_collection.find({"user_id": ObjectId(user_id)})

        # Convert entries to a list and serialize ObjectIds
        entries_list = []
        for entry in journal_entries:
            entry["_id"] = str(entry["_id"])  # Convert ObjectId to string
            entry["user_id"] = str(entry["user_id"])  # Convert user_id to string
            entries_list.append(entry)

        entries_list.reverse()

        print("Fetched entries:", entries_list)  # Debugging

        if not entries_list:
            return jsonify({"message": "No journal entries found"}), 200

        return jsonify({"entries": entries_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ---------------------------------------
#  **Sentiment Analysis**
# ---------------------------------------
@journal_bp.route("/analyze", methods=["POST"])
def analyze_sentiment():
    try:
        text = request.json.get("text", "")
        if not text:
            return jsonify({"error": "No text provided"}), 400
        result = model(text)
        return jsonify(result[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500