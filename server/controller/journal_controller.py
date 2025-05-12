from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models.journal_entry import JournalEntry  # Import the JournalEntry model
from utils.database import journal_entries_collection, check_in_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
import boto3
from botocore.exceptions import ClientError
from config import AWS_CONFIG, S3_BUCKET
import os
from werkzeug.utils import secure_filename
import time
import random
import string
from transformers import pipeline
from collections import defaultdict

# Temporary in-memory counter for uploaded images per user
image_upload_counter = defaultdict(int)


# Define emotions array to match client-side
EMOTIONS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Initialize sentiment analysis pipeline
sentiment_analyzer = pipeline("sentiment-analysis", model="finiteautomata/bertweet-base-sentiment-analysis")

journal_bp = Blueprint("journal_bp", __name__)

# AWS S3 configuration
S3_BUCKET = "sentiobucket"
s3_client = boto3.client(
    's3',
    aws_access_key_id='AKIAXGZAMH3HUVQSPNED',
    aws_secret_access_key='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',
    region_name='eu-north-1'
) 
s3 = boto3.client("s3", **AWS_CONFIG)


@journal_bp.route("/save-journal-entry", methods=["POST"])
@jwt_required()
def save_journal_entry():
    try:
        print("🔵 Starting save_journal_entry function")
        user_id = get_jwt_identity()
        print(f"🔹 User ID: {user_id}")
        
        data = request.get_json()
        print(f"🔹 Received data: {data}")
        
        # Extract data from request
        entry_content = data.get('entryContent')
        entry_date = data.get('entryDate')
        images = data.get('images', [])
        journal_sentiments = data.get('journalSentiments', [])
        category = data.get('category')
        prompt = data.get('prompt') 

        print(f"📝 Extracted data: content={entry_content[:50]}..., images={len(images)}, sentiments={len(journal_sentiments)}")

        # Validate required fields
        if not entry_content:
            print("❌ No entry content provided")
            return jsonify({"error": "Entry content is required"}), 400
        
        # Analyze sentiment if not provided
        if not journal_sentiments and entry_content:
            print("🔍 Analyzing sentiment for journal entry")
            try:
                # Get sentiment analysis results
                sentiment_results = sentiment_analyzer(entry_content)
                # Convert to our format
                journal_sentiments = [{
                    "emotion": result["label"].lower(),
                    "percentage": result["score"]
                } for result in sentiment_results]
                print(f"✅ Analyzed sentiments: {journal_sentiments}")
            except Exception as e:
                print(f"❌ Error analyzing sentiment: {str(e)}")
                journal_sentiments = []
        
        # Create new journal entry with its own ObjectId
        new_entry = {
            "_id": ObjectId(),  # Give each entry its own ID
            "entryContent": entry_content,
            "entryDate": entry_date,
            "images": images,
            "journalSentiments": journal_sentiments,
            "createdAt": datetime.now(),
            "category": category,
            "prompt": prompt
        }
        
        print(f"📦 New entry data: {new_entry}")
        
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
            print(f"✅ Updated existing document. Modified count: {result.modified_count}")
        else:
            # Create new document with proper structure
            result = journal_entries_collection.insert_one({
                "_id": ObjectId(user_id),
                "journalEntries": [new_entry]
            })
            print(f"✅ Created new document. Inserted ID: {result.inserted_id}")
        
        print(f"✅ MongoDB operation successful")

        # ✅ Reset image upload counter after successful save
        if user_id in image_upload_counter:
            del image_upload_counter[user_id]

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
        
        #limit = int(request.args.get("limit", 30))
        #skip = int(request.args.get("skip", 0))

        #if(limit is None): 
        #    limit = 30
        #if(skip is None): 
        #    skip = 0
        
        # Ensure user_id is converted to ObjectId
        try:
            user_object_id = ObjectId(user_id)
        except Exception as e:
            print(f"❌ Invalid user ID format: {user_id}")
            return jsonify({"error": "Invalid user ID format"}), 400
        
        print(f"🔍 Running query: journal_entries_collection.find_one({{_id: ObjectId('{user_id}')}}")
        
        # The issue is here: find_one() returns a dictionary, not a cursor
        # So we can't call .limit() on it
        journal_data = journal_entries_collection.find_one({"_id": user_object_id})
        print(f"🔍 Raw journal data: {journal_data}")
        
        # Initialize empty entries list as default
        serialized_entries = []
        
        # Check if we have journal data
        if journal_data and "journalEntries" in journal_data and journal_data["journalEntries"]:
            # Convert entries to a list and serialize ObjectIds
            entries_list = journal_data["journalEntries"]
            print(f"🔍 Found {len(entries_list)} raw entries")
            
            # Sort by date descending
            entries_list = sorted(entries_list, key=lambda x: x.get("entryDate", ""), reverse=True)

            # Apply pagination and limit
            #entries_list = entries_list[skip:skip + limit]

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
            
            # Note: This second sort is redundant since we already sorted above
            # But keeping it to maintain exact functionality
            serialized_entries = sorted(serialized_entries, 
                                  key=lambda x: x.get("entryDate", ""), 
                                  reverse=True)
        else:
            if not journal_data:
                print("⚠️ No journal data found for this user at all.")
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

@journal_bp.route('/get-journal-entries-dates', methods=['GET'])
@jwt_required()
def get_journal_dates():
    try:
        user_id = get_jwt_identity()
        print(f"🔍 Fetching journal dates for user_id: {user_id}")
        # data = request.get_json()
        # limit = int(request.args.get("limit", 2)) # default 30 size limit
        # limit = data.get("limit") # for limit
        # skip = data.get("skip") # for paging 
        limit = int(request.args.get("limit", 30))
        skip = int(request.args.get("skip", 0)) 

        if(limit is None) : 
            limit = 30
        if(skip is None) : 
            skip = 0
        
        entry_doc = journal_entries_collection.find_one({"_id": ObjectId(user_id)})
        if not entry_doc or "journalEntries" not in entry_doc:
            print("ℹ️ No entries found for user")
            return jsonify([]), 200

        dates = set()
        for entry in entry_doc["journalEntries"]:
            raw_date = entry.get("entryDate")
            if not raw_date:
                continue

            if isinstance(raw_date, str):
                date_str = raw_date.split("T")[0]
            else:
                date_str = raw_date.strftime("%Y-%m-%d")
            dates.add(date_str)

        print("✅ Final list of journal dates:", dates)
        return jsonify(list(dates)), 200

    except Exception as e:
        print("❌ Error fetching journal dates:", str(e))
        return jsonify({"error": "Internal server error"}), 500
    

@journal_bp.route("/guided", methods=["POST"])
@jwt_required()
def save_guided_journal():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        entry_content = data.get("entryContent", "")
        prompt = data.get("prompt", "")
        if not entry_content or not prompt:
            return jsonify({"error": "Entry content and prompt are required."}), 400

        new_entry = {
            "userId": user_id,
            "entryContent": entry_content,
            "category": "guided",
            "prompt": prompt,
            "createdAt": datetime.now(),
            "entryDate": datetime.now().strftime("%Y-%m-%d"),
            "images": [],
            "journalSentiments": []
        }

        journal_entries_collection.insert_one(new_entry)
        return jsonify({"message": "Guided journal entry saved successfully."}), 201

    except Exception as e:
        print("❌ Error saving guided entry:", str(e))
        return jsonify({"error": "Internal server error"}), 500

@journal_bp.route("/journal-entries-with-date", methods=["GET"])
@jwt_required()
def journal_entries_with_date():
    try:
        # Get the user ID from the JWT token and validate it.
        user_id = get_jwt_identity()
        print(f"🔍 Processing request for user_id: {user_id}")
        
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        user_id = ObjectId(user_id)

        # Retrieve and validate query parameters.
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        print(f"📅 Received date range: {start_date_str} to {end_date_str}")
        
        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Parse the start and end dates.
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
            # Adjust the end date to include the entire day.
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            print(f"📅 Parsed dates - Start: {start_date}, End: {end_date}")
        except ValueError as e:
            print(f"❌ Error parsing dates: {str(e)}")
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        # First, let's check if we can find the user's journal document
        user_doc = journal_entries_collection.find_one({"_id": user_id})
        print(f"📄 Found user document: {user_doc is not None}")
        if user_doc:
            print(f"📝 Number of journal entries: {len(user_doc.get('journalEntries', []))}")

        # Build the aggregation pipeline for journal entries:
        journal_pipeline = [
            # Match the user's document using _id
            {"$match": {"_id": user_id}},
            # Unwind the journalEntries array
            {"$unwind": "$journalEntries"},
            # Convert entryDate to proper date format for comparison
            {"$addFields": {
                "journalEntries.parsedDate": {
                    "$dateFromString": {
                        "dateString": "$journalEntries.entryDate",
                        "onNull": None
                    }
                }
            }},
            # Filter entries by entryDate within the given period
            {"$match": {
                "journalEntries.parsedDate": {
                    "$gte": start_date,
                    "$lte": end_date
                }
            }},
            # Project only the needed fields
            {"$project": {
                "_id": "$journalEntries._id",
                "entryContent": "$journalEntries.entryContent",
                "entryDate": "$journalEntries.entryDate",
                "images": "$journalEntries.images",
                "journalSentiments": "$journalEntries.journalSentiments",
                "createdAt": "$journalEntries.createdAt",
                "category": "$journalEntries.category",
                "prompt": "$journalEntries.prompt",
                "type": "journal"
            }},
            # Sort by date descending (newest first)
            {"$sort": {"entryDate": -1}}
        ]

        print("🔍 Executing journal entries pipeline...")
        # Execute both pipelines
        journal_entries = list(journal_entries_collection.aggregate(journal_pipeline))
        print(f"📝 Found {len(journal_entries)} journal entries")
        if journal_entries:
            print(f"📅 Sample journal entry date: {journal_entries[0].get('entryDate')}")

        # Convert ObjectId to string in the response
        for entry in journal_entries:
            if "_id" in entry:
                entry["_id"] = str(entry["_id"])

        response_data = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "entries": journal_entries
        }
        
        print(f"✅ Returning {len(journal_entries)} total entries")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"❌ Error in journal_entries_endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@journal_bp.route("/<entry_id>", methods=["PUT"])
@jwt_required()
def update_journal_entry(entry_id):
    try:
        print("🔵 Starting update_journal_entry function")
        user_id = get_jwt_identity()
        print(f"🔹 User ID: {user_id}, Entry ID: {entry_id}")
        
        # Validate IDs
        try:
            user_object_id = ObjectId(user_id)
            entry_object_id = ObjectId(entry_id)
        except:
            print("❌ Invalid ID format")
            return jsonify({"error": "Invalid ID format"}), 400
        
        data = request.get_json()
        print(f"🔹 Received update data: {data}")
        
        # Extract only allowed fields from request
        entry_content = data.get('entryContent')
        entry_date = data.get('entryDate')
        images = data.get('images')
        journal_sentiments = data.get('journalSentiments', [])
        
        # Find the user's document
        user_doc = journal_entries_collection.find_one({"_id": user_object_id})
        if not user_doc:
            print("❌ User document not found")
            return jsonify({"error": "User not found"}), 404
        
        # Find the specific entry
        entry_index = None
        for i, entry in enumerate(user_doc.get("journalEntries", [])):
            if str(entry["_id"]) == entry_id:
                entry_index = i
                break
        
        if entry_index is None:
            print("❌ Entry not found")
            return jsonify({"error": "Entry not found"}), 404
        
        # Prepare update fields - only include allowed fields
        update_fields = {
            "updatedAt": datetime.now()
        }
        
        if entry_content is not None:
            update_fields["entryContent"] = entry_content
        
        # Only update sentiments if they were provided in the request
        if journal_sentiments:
            update_fields["journalSentiments"] = journal_sentiments
        
        if entry_date is not None:
            update_fields["entryDate"] = entry_date

        if images is not None:
            update_fields["images"] = images
        
        # Update the specific entry
        update_operation = {"$set": {}}
        for k, v in update_fields.items():
            if k == "journalSentiments":
                # Ensure journalSentiments is properly formatted as an array
                update_operation["$set"]["journalEntries.$.journalSentiments"] = v
            else:
                update_operation["$set"][f"journalEntries.$.{k}"] = v
        
        result = journal_entries_collection.update_one(
            {"_id": user_object_id, "journalEntries._id": entry_object_id},
            update_operation
        )
        
        if result.modified_count == 0:
            print("❌ No changes made to the entry")
            return jsonify({"error": "Failed to update entry"}), 400
        
        print("✅ Journal entry updated successfully")
        
        # Fetch the updated entry
        updated_doc = journal_entries_collection.find_one(
            {"_id": user_object_id},
            {"journalEntries": {"$elemMatch": {"_id": entry_object_id}}}
        )
        updated_entry = updated_doc["journalEntries"][0] if updated_doc and "journalEntries" in updated_doc else None
        
        return jsonify({
            "message": "Journal entry updated successfully",
            "entry": {**updated_entry, "_id": str(updated_entry["_id"])}
        }), 200
        
    except Exception as e:
        print(f"❌ Error updating journal entry: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@journal_bp.route("/delete-journal-entry/<entry_id>", methods=["DELETE"])
@jwt_required()
def delete_journal_entry(entry_id):
    try:
        user_id = get_jwt_identity()
        user_object_id = ObjectId(user_id)

        # Find the user's journal document
        journal_doc = journal_entries_collection.find_one({"_id": user_object_id})
        if not journal_doc:
            return jsonify({"error": "No journal entries found for user"}), 404

        # Find the entry by _id
        target_entry = None
        for entry in journal_doc.get("journalEntries", []):
            if str(entry.get("_id")) == entry_id:
                target_entry = entry
                break

        if not target_entry:
            return jsonify({"error": "Entry not found"}), 404

        # Remove images from S3
        for image in target_entry.get("images", []):
            s3_key = image.get("fileName", "")
            if s3_key:
                s3.delete_object(Bucket="sentiobucket", Key=s3_key)

        # Remove entry from array
        result = journal_entries_collection.update_one(
            {"_id": user_object_id},
            {"$pull": {"journalEntries": {"_id": ObjectId(entry_id)}}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Failed to delete entry"}), 500

        return jsonify({"message": "Journal entry deleted successfully"}), 200

    except Exception as e:
        print("❌ Error deleting journal entry:", e)
        return jsonify({"error": "Internal server error"}), 500


@journal_bp.route("/upload-image", methods=["POST"])
@jwt_required()
def upload_journal_image():
    try:
        user_id = get_jwt_identity()
        print(f"🔍 Uploading journal image for user: {user_id}")

        # ✅ Check current upload count
        if image_upload_counter[user_id] >= 5:
            print("❌ Upload limit reached (in-memory): 5 images")
            return jsonify({"error": "Maximum image upload limit (5) reached."}), 400

        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files['image']
        if not file:
            return jsonify({"error": "No image provided"}), 400

        timestamp = int(time.time())
        random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        original_filename = secure_filename(file.filename)
        filename = f"journal-images/{user_id}/{timestamp}_{random_string}_{original_filename}"

        s3_client.upload_fileobj(
            file.stream,
            S3_BUCKET,
            filename,
            ExtraArgs={'ContentType': file.content_type or 'image/jpeg'}
        )

        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': filename},
            ExpiresIn=3600
        )

        # ✅ Increment upload count
        image_upload_counter[user_id] += 1
        print(f"✅ Upload count for {user_id}: {image_upload_counter[user_id]}")

        return jsonify({
            "message": "Journal image uploaded successfully",
            "signedUrl": signed_url
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500



@journal_bp.route("/delete-image", methods=["DELETE"])
@jwt_required()
def delete_journal_image():
    try:
        user_id = get_jwt_identity()
        print(f"🔍 Deleting journal image for user: {user_id}")
        
        data = request.get_json()
        if not data or 's3Key' not in data:
            print("❌ Missing s3Key in request data")
            return jsonify({"error": "S3 key is required"}), 400
            
        key = data['s3Key']
        print(f"🗑️ Deleting S3 object with key: {key}")
        
        # Delete from S3
        try:
            s3_client.delete_object(
                Bucket=S3_BUCKET,
                Key=key
            )
            print(f"✅ Successfully deleted image from S3: {key}")
            
            return jsonify({
                "message": "Image deleted successfully"
            }), 200
            
        except ClientError as e:
            error_message = e.response.get('Error', {}).get('Message', str(e))
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            print(f"❌ Error deleting image from S3: {error_message}")
            print(f"❌ Error code: {error_code}")
            print(f"❌ Request ID: {e.response.get('ResponseMetadata', {}).get('RequestId', 'Unknown')}")
            print(f"❌ S3 Key: {key}")
            print(f"❌ Bucket: {S3_BUCKET}")
            return jsonify({"error": f"Failed to delete image: {error_message}"}), 500
            
    except Exception as e:
        print(f"❌ Error in delete_journal_image: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500

@journal_bp.route("/update-lock-code/<entry_id>", methods=["POST"])
@jwt_required()
def update_lock_code(entry_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        lock_code = data.get("lockCode")
        user_doc = journal_entries_collection.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            return jsonify({"error": "User not found"}), 404
        
        # Find the specific journal entry in the journals array
        journal_entry = None
        journals = user_doc.get("journalEntries", [])
        
        for journal in journals:
            if str(journal.get("_id")) == entry_id:
                journal_entry = journal
                break
        if not journal_entry:
            return jsonify({"error": "Journal entry not found"}), 404

        # if lock_code is empty or None, remove the existing lock code
        if not lock_code:
            result = journal_entries_collection.update_one(
                {"_id": ObjectId(user_id), "journalEntries._id": ObjectId(entry_id)},
                {"$unset": {"journalEntries.$.lockCode": ""}}
            )
            if result.modified_count == 0:
                return jsonify({"error": "Failed to remove lock code"}), 500
            return jsonify({"message": "Lock code removed successfully"}), 200
                
        else:
            result = journal_entries_collection.update_one(
                {"_id": ObjectId(user_id), "journalEntries._id": ObjectId(entry_id)},
                {"$set": {"journalEntries.$.lockCode": lock_code}}
            )
            if result.modified_count == 0:
                return jsonify({"error": "Failed to create lock code"}), 500
        
            return jsonify({"message": "Lock code created successfully"}), 200
    
    except Exception as e:
        print(f"❌ Error updating lock code: {str(e)}")
        return jsonify({"error": str(e)}), 500