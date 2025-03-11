from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models.journal_entry import JournalEntry  # Import the JournalEntry model
from utils.database import journal_entries_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

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
    

@journal_bp.route("/api/journal-entries", methods=["GET"])
@jwt_required()
def journal_entries_endpoint():
    try:
        # Get the user ID from the JWT token and validate it.
        user_id = get_jwt_identity()
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        user_id = ObjectId(user_id)

        # Retrieve and validate query parameters.
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Parse the start and end dates.
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        # Adjust the end date to include the entire day.
        end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Build the aggregation pipeline:
        pipeline = [
            # Select the user's document.
            {"$match": {"userId": user_id}},
            # Unwind the journalEntries array so that each entry is processed individually.
            {"$unwind": "$journalEntries"},
            # Filter entries by entryDate within the given period.
            {"$match": {
                "journalEntries.entryDate": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }},
            # Project only the fields you need.
            {"$project": {
                "_id": 0,
                "entryContent": "$journalEntries.entryContent",
                "entryDate": "$journalEntries.entryDate",
                "images": "$journalEntries.images",
                "journalSentiments": "$journalEntries.journalSentiments"
            }},
            # Group by a unique key (here we use entryContent and entryDate).
            {"$group": {
                "_id": {
                    "entryContent": "$entryContent",
                    "entryDate": "$entryDate"
                },
                "images": {"$first": "$images"},
                "journalSentiments": {"$first": "$journalSentiments"}
            }},
            # Re-project the grouped fields.
            {"$project": {
                "_id": 0,
                "entryContent": "$_id.entryContent",
                "entryDate": "$_id.entryDate",
                "images": 1,
                "journalSentiments": 1
            }}
        ]

        entries = list(journal_entries_collection.aggregate(pipeline))

        response_data = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "entries": entries
        }
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@journal_bp.route("/api/sentiment-analysis", methods=["GET"])
@jwt_required()
def sentiment_analysis():
    try:
        # Get and validate the user ID from the JWT token.
        user_id = get_jwt_identity()
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        user_id = ObjectId(user_id)

        # Retrieve and validate query parameters.
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        interval = request.args.get("interval", "monthly")  # default interval is monthly
        emotions_param = request.args.get("emotions")  # Optional: comma-separated list (e.g., "1,2,3")

        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Parse dates and adjust end_date to include the entire day.
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        # If provided, convert the emotions parameter into a list of integers.
        emotion_filter = None
        if emotions_param:
            try:
                emotion_filter = [int(e.strip()) for e in emotions_param.split(",") if e.strip().isdigit()]
            except Exception:
                return jsonify({"error": "Invalid emotions parameter"}), 400

        # Build the aggregation pipeline.
        pipeline = [
            # Match the user's document.
            {"$match": {"userId": user_id}},
            # Unwind the journalEntries array.
            {"$unwind": "$journalEntries"},
            # Filter journal entries by entryDate within the given period.
            {"$match": {
                "journalEntries.entryDate": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }}
        ]

        # If an emotion filter is provided, match only those journal entries that have at least one sentiment matching.
        if emotion_filter:
            pipeline.append({
                "$match": {
                    "journalEntries.journalSentiments.emotion": {"$in": emotion_filter}
                }
            })

        # Unwind the nested journalSentiments array so that each sentiment is processed individually.
        pipeline.append({"$unwind": "$journalEntries.journalSentiments"})

        # Determine the grouping key based on the requested interval.
        if interval == "daily":
            group_time = {
                "$dateToString": {
                    "format": "%Y-%m-%d",
                    "date": {"$toDate": "$journalEntries.entryDate"}
                }
            }
        elif interval == "weekly":
            # For weekly grouping, add fields for ISO week and year.
            pipeline.append({
                "$addFields": {
                    "weekYear": {"$isoWeekYear": {"$toDate": "$journalEntries.entryDate"}},
                    "isoWeek": {"$isoWeek": {"$toDate": "$journalEntries.entryDate"}}
                }
            })
            group_time = {
                "$concat": [
                    {"$toString": "$weekYear"},
                    "-W",
                    {"$toString": "$isoWeek"}
                ]
            }
        elif interval == "yearly":
            group_time = {
                "$dateToString": {
                    "format": "%Y",
                    "date": {"$toDate": "$journalEntries.entryDate"}
                }
            }
        else:  # Default to monthly.
            group_time = {
                "$dateToString": {
                    "format": "%Y-%m",
                    "date": {"$toDate": "$journalEntries.entryDate"}
                }
            }

        # Group by the computed time period and the sentiment emotion.
        pipeline.append({
            "$group": {
                "_id": {
                    "time_period": group_time,
                    "emotion": "$journalEntries.journalSentiments.emotion"
                },
                "total_percentage": {"$sum": "$journalEntries.journalSentiments.percentage"},
                "entry_count": {"$sum": 1}
            }
        })

        # Project the final fields.
        pipeline.append({
            "$project": {
                "_id": 0,
                "time_period": "$_id.time_period",
                "emotion": "$_id.emotion",
                "total_percentage": 1,
                "entry_count": 1
            }
        })

        # Sort by time period ascending.
        pipeline.append({"$sort": {"time_period": 1}})

        results = list(journal_entries_collection.aggregate(pipeline))

        response_data = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "interval": interval,
            "emotion_analysis": results
        }
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@journal_bp.route("/delete-journal-entry/<entry_id>", methods=["DELETE"])
@jwt_required()
def delete_journal_entry(entry_id):
    try:
        user_id = get_jwt_identity()  # Get the user ID

        if not ObjectId.is_valid(entry_id):
            return jsonify({"error": "Invalid journal entry ID"}), 400

        # Find and delete the journal entry
        result = journal_entries_collection.delete_one({"_id": ObjectId(entry_id), "user_id": ObjectId(user_id)})

        if result.deleted_count == 0:
            return jsonify({"error": "Journal entry not found or unauthorized"}), 404

        return jsonify({"message": "Journal entry deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500