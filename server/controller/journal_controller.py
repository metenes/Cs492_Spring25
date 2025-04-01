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
        print("🔵 Starting save_journal_entry function")
        user_id = get_jwt_identity()
        print(f"🔹 User ID: {user_id}")
        
        # Validate user_id format
        try:
            user_object_id = ObjectId(user_id)
        except:
            print("❌ Invalid user ID format")
            return jsonify({"error": "Invalid user ID format"}), 400
        
        data = request.get_json()
        print(f"🔹 Received data: {data}")
        
        # Extract data from request
        entry_content = data.get('entryContent')
        entry_date = data.get('entryDate')
        images = data.get('images', [])
        journal_sentiments = data.get('journalSentiments', [])
        category = data.get('category')
        prompt = data.get('prompt') 

        # Validate required fields
        if not entry_content:
            print("❌ No entry content provided")
            return jsonify({"error": "Entry content is required"}), 400
        
        # Create new journal entry with its own ObjectId
        new_entry = {
            "_id": ObjectId(),  # Give each entry its own ID
            "entryContent": entry_content,
            "entryDate": entry_date,
            "images": images,
            "journalSentiments": journal_sentiments,
            "createdAt": datetime.now(),
            "category" : category,
            "prompt" : prompt
        }
        
        # Update the document using $push to add to the journalEntries array
        print(f"🔹 Attempting to save to MongoDB for user {user_id}")

        # First check if document exists
        existing_doc = journal_entries_collection.find_one({"_id": ObjectId(user_id)})
        print(f"🔹 Existing document: {existing_doc}")

        if existing_doc:
            # Update existing document
            result = journal_entries_collection.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$push": {
                        "journalEntries": new_entry
                    }
                }
            )
        else:
            # Create new document with proper structure
            result = journal_entries_collection.insert_one({
                "_id": ObjectId(user_id),
                "journalEntries": [new_entry]
            })
        
        print(f"✅ MongoDB operation successful")
        
        return jsonify({
            "message": "Journal entry saved successfully",
            "entry": {**new_entry, "_id": str(new_entry["_id"])}  # Convert ObjectId to string
        }), 201
        
    except Exception as e:
        print(f"❌ Error saving journal entry: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@journal_bp.route("/get-journal-entries", methods=["GET"])
@jwt_required()
def get_journal_entries():
    try:
        user_id = get_jwt_identity()
        print(f"🔍 Fetching journal entries for user: {user_id}")
        
        # Ensure user_id is converted to ObjectId
        try:
            user_object_id = ObjectId(user_id)
        except Exception as e:
            print(f"❌ Invalid user ID format: {user_id}")
            return jsonify({"error": "Invalid user ID format"}), 400
        
        # IMPORTANT FIX: The user_id from JWT is used to query the journal entries
        # But we need to make sure we're querying the correct collection
        print(f"🔍 Running query: journal_entries_collection.findOne({{_id: ObjectId('{user_id}')}}")
        
        # Retrieve user's journal entries from MongoDB
        # This should be from journal_entries_collection, not the users collection
        journal_data = journal_entries_collection.find_one({"_id": user_object_id})
        print(f"🔍 Raw journal data: {journal_data}")
        
        # Initialize empty entries list as default
        serialized_entries = []
        
        # Check if we have journal data
        if journal_data and "journalEntries" in journal_data and journal_data["journalEntries"]:
            # Convert entries to a list and serialize ObjectIds
            entries_list = journal_data["journalEntries"]
            print(f"🔍 Found {len(entries_list)} raw entries")
            
            for entry in entries_list:
                serialized_entry = {k: v for k, v in entry.items()}
                if "_id" in serialized_entry:
                    serialized_entry["_id"] = str(serialized_entry["_id"])
                # Convert any other ObjectId fields if present
                for field in serialized_entry:
                    if isinstance(serialized_entry[field], ObjectId):
                        serialized_entry[field] = str(serialized_entry[field])
                # Convert datetime objects to ISO format strings
                for field in serialized_entry:
                    if isinstance(serialized_entry[field], datetime):
                        serialized_entry[field] = serialized_entry[field].isoformat()
                        
                serialized_entries.append(serialized_entry)
            
            # Sort entries by date (latest first)
            serialized_entries = sorted(serialized_entries, 
                                  key=lambda x: x.get("entryDate", ""), 
                                  reverse=True)
        else:
            if not journal_data:
                print("⚠️ No journal data found for this user at all.")
                # This might be because the user hasn't created any journal entries yet
                print("⚠️ Creating empty journal entries document for user")
                # Optionally, you could initialize an empty document here
            elif "journalEntries" not in journal_data:
                print("⚠️ Document exists but has no journalEntries field.")
                print(f"⚠️ Document keys: {journal_data.keys()}")
            elif not journal_data["journalEntries"]:
                print("⚠️ journalEntries array exists but is empty.")
        
        print(f"✅ Fetched and processed {len(serialized_entries)} journal entries")
        return jsonify({"entries": serialized_entries}), 200
        
    except Exception as e:
        print(f"❌ Error fetching journal entries: {str(e)}")
        import traceback
        traceback.print_exc()  # Print the full stack trace
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
            # Match the user's document using _id
            {"$match": {"_id": user_id}},
            # Unwind the journalEntries array
            {"$unwind": "$journalEntries"},
            # Filter entries by entryDate within the given period
            {"$match": {
                "journalEntries.entryDate": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }},
            # Project only the needed fields
            {"$project": {
                "_id": "$journalEntries._id",
                "entryContent": "$journalEntries.entryContent",
                "entryDate": "$journalEntries.entryDate",
                "images": "$journalEntries.images",
                "journalSentiments": "$journalEntries.journalSentiments",
                "createdAt": "$journalEntries.createdAt"
            }},
            # Sort by date descending (newest first)
            {"$sort": {"entryDate": -1}}
        ]

        entries = list(journal_entries_collection.aggregate(pipeline))

        # Convert ObjectId to string in the response
        for entry in entries:
            if "_id" in entry:
                entry["_id"] = str(entry["_id"])

        response_data = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "entries": entries
        }
        
        print(f"Found {len(entries)} entries for user {user_id}")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error in journal_entries_endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@journal_bp.route("/api/sentiment-analysis", methods=["GET"])
@jwt_required()
def sentiment_analysis():
    try:
        # Get and validate user_id from JWT token
        user_id = get_jwt_identity()
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        user_id = ObjectId(user_id)  # Fixed: was trying to convert already converted ObjectId

        # Retrieve and validate query parameters
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        interval = request.args.get("interval", "monthly")
        emotions_param = request.args.get("emotions")

        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Parse dates and adjust end_date
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Parse emotions filter if provided
        emotion_filter = None
        if emotions_param:
            try:
                emotion_filter = [int(e.strip()) for e in emotions_param.split(",") if e.strip().isdigit()]
            except Exception:
                return jsonify({"error": "Invalid emotions parameter"}), 400

        # Build the aggregation pipeline
        pipeline = [
            # Match using _id
            {"$match": {"_id": user_id}},
            # Unwind the journalEntries array
            {"$unwind": "$journalEntries"},
            # Filter by date range
            {"$match": {
                "journalEntries.entryDate": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }},
            # Unwind the sentiments array
            {"$unwind": "$journalEntries.journalSentiments"}
        ]

        # Add emotion filter if provided
        if emotion_filter:
            pipeline.append({
                "$match": {
                    "journalEntries.journalSentiments.emotion": {"$in": emotion_filter}
                }
            })

        # Add time grouping based on interval
        if interval == "daily":
            group_time = {
                "$dateToString": {
                    "format": "%Y-%m-%d",
                    "date": {"$toDate": "$journalEntries.entryDate"}
                }
            }
        elif interval == "weekly":
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
        else:  # Default to monthly
            group_time = {
                "$dateToString": {
                    "format": "%Y-%m",
                    "date": {"$toDate": "$journalEntries.entryDate"}
                }
            }

        # Group by time period and emotion
        pipeline.append({
            "$group": {
                "_id": {
                    "time_period": group_time,
                    "emotion": "$journalEntries.journalSentiments.emotion"
                },
                "average_percentage": {"$avg": "$journalEntries.journalSentiments.percentage"},
                "entry_count": {"$sum": 1}
            }
        })

        # Final projection
        pipeline.append({
            "$project": {
                "_id": 0,
                "time_period": "$_id.time_period",
                "emotion": "$_id.emotion",
                "percentage": "$average_percentage",
                "count": "$entry_count"
            }
        })

        # Sort by time period
        pipeline.append({"$sort": {"time_period": 1}})

        # Execute pipeline and get results
        results = list(journal_entries_collection.aggregate(pipeline))

        # Add debug logging
        print(f"Query results: {results}")
        
        response_data = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "interval": interval,
            "emotion_analysis": results
        }
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error in sentiment_analysis: {str(e)}")
        import traceback
        traceback.print_exc()
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