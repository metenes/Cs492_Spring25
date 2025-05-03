from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
from utils.database import check_in_collection, users_collection, sentiments_collection, prompt_collection
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

# Initialize Blueprint for check-in routes
check_bp = Blueprint("check_bp", __name__)

print("✅ check_in_controller.py loaded")

@check_bp.route("/submit", methods=["POST"])
@jwt_required()
def submit_check_in():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        sentiments = data.get("sentiments", [])
        causes = data.get("causes", [])
        comments = data.get("comments", [])
        timestamp = datetime.now()

        if not sentiments or not causes:
            return jsonify({"error": "Sentiments and causes are required."}), 400

        new_check_in = {
            "userId": user_id,
            "sentiments": sentiments,
            "causes": causes,
            "comments": comments,
            "timestamp": timestamp, 
            "lockCode" : "" # No based pin 
        }

        check_in_collection.insert_one(new_check_in)
        return jsonify({"message": "Check-in saved successfully."}), 201

    except Exception as e:
        print("❌ Error saving check-in:", str(e))
        return jsonify({"error": "Internal server error"}), 500

@check_bp.route("/fetch", methods=["GET"])
@jwt_required()
def fetch_check_ins():
    try:
        user_id = get_jwt_identity()
        entries = list(check_in_collection.find({"userId": user_id}))

        result = []
        for entry in entries:
            result.append({
                "entry_id": str(entry["_id"]),
                "user_id": str(entry["userId"]),
                "created_at": entry["timestamp"].isoformat(),
                "type": "checkin",
                "date": entry["timestamp"].strftime("%Y-%m-%d"),
                "sentiments": entry.get("sentiments", []),
                "causes": entry.get("causes", []),
                "comments": entry.get("comments", []),
                "lockCode": entry.get("lockCode", "") # for locking logic
            })

        return jsonify({"history": result}), 200
    except Exception as e:
        print("❌ Error fetching check-ins:", str(e))
        return jsonify({"error": "Internal server error"}), 500

@check_bp.route('/history/<user_id>', methods=['GET'])
@jwt_required()
def get_check_in_history(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Convert cursor to a list before checking length
        entries = list(check_in_collection.find({"userId": user_id}))

        if not entries:  # Corrected check
            print("here")
            return jsonify({"error": "No check-in entries found"}), 404

        # Convert entries to JSON format
        history = [
            {
                "entry_id": str(entry["_id"]),
                "user_id": str(entry["userId"]),
                "sentiments": entry["sentiments"],  
                "causes": entry["causes"],
                "comments": entry.get("comments", []),
                "created_at": entry.get("created_at") if entry.get("created_at") else None,
                "lockCode" : entry.get("lockCode", ""), 
            }
            for entry in entries
        ]

        return jsonify({"history": history}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@check_bp.route('/history', methods=['GET'])
@jwt_required()
def get_check_in_history_all():
    try:

        user_id = get_jwt_identity()
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Convert cursor to a list before checking length
        entries = list(check_in_collection.find({"userId": user_id}))

        if not entries:  # Corrected check
            print("here")
            return jsonify({"error": "No check-in entries found"}), 404

        # Convert entries to JSON format
        history = [
            {
                "entry_id": str(entry["_id"]),
                "user_id": str(entry["userId"]),
                "sentiments": entry["sentiments"],  
                "causes": entry["causes"],
                "comments": entry.get("comments", []),
                "created_at": entry.get("created_at") if entry.get("created_at") else None,
                "lockCode" : entry.get("lockCode", ""), 
            }
            for entry in entries
        ]

        return jsonify({"history": history}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# Route to get a specific check-in entry
@check_bp.route('/<int:entry_id>', methods=['GET'])
@jwt_required()
def get_check_in_entry(entry_id):
    try:
        entry = check_in_collection.find_one({"_id": entry_id})
        if not entry:
            return jsonify({"error": "Check-in entry not found"}), 404
        
        entry_data = {
            "entry_id": entry["_id"],
            "user_id": str(entry["userId"]),
            "sentiments": entry["sentiments"],
            "causes": entry["causes"],
            "comments": entry.get("comments", []),
            "created_at": entry.get("created_at") if entry.get("created_at") else None,
            "lockCode" : entry.get("lockCode", ""), 
        }

        return jsonify(entry_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@check_bp.route("/check-in/edit/<entry_id>", methods=["PUT"])
@jwt_required()
def edit_checkin(entry_id):
    try:
        data = request.json
        token = request.headers.get("Authorization").split(" ")[1]
        user_id = get_jwt_identity()

        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        update_data = {
            "sentiments": data["sentiments"],
            "causes": data["causes"],
            "comments": data.get("comments", []),
            "lockCode" : data.get("lockCode", ""),
        }

        result = check_in_collection.update_one({"_id": ObjectId(entry_id), "userId": user_id}, {"$set": update_data})

        if result.matched_count == 0:
            return jsonify({"error": "Entry not found or unauthorized"}), 404

        return jsonify({"message": "Check-in updated successfully!"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@check_bp.route("/delete/<entry_id>", methods=["DELETE"])
@jwt_required()
def delete_checkin(entry_id):
    try:
        token = request.headers.get("Authorization").split(" ")[1]
        user_id = get_jwt_identity()

        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        result = check_in_collection.delete_one({"_id": ObjectId(entry_id), "userId": user_id})

        if result.deleted_count == 0:
            return jsonify({"error": "Entry not found or unauthorized"}), 404

        return jsonify({"message": "Check-in deleted successfully!"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
    
@check_bp.route("/delete/<entry_id>", methods=["DELETE"])
@jwt_required()
def delete_checkin_entry(entry_id):
    print("🔥 check-in delete route loaded")
    try:
        user_id = get_jwt_identity()

        if not ObjectId.is_valid(entry_id):
            return jsonify({"error": "Invalid check-in ID"}), 400

        print(f"Deleting check-in with ID {entry_id} for user {user_id}")

        print("🔍 Looking for check-in document...")
        doc = check_in_collection.find_one({
            "_id": ObjectId(entry_id),
            "userId": user_id
        })
        print("📄 Found document:", doc)

        result = check_in_collection.delete_one({
            "_id": ObjectId(entry_id),
            "userId": user_id
        })

        if result.deleted_count == 0:
            return jsonify({"error": "Check-in not found or unauthorized"}), 404

        return jsonify({"message": "Check-in deleted successfully"}), 200

    except Exception as e:
        print("❌ Error deleting check-in:", str(e))
        return jsonify({"error": "Failed to delete check-in"}), 500

@check_bp.route("/update-lock-code/<entry_id>", methods=["POST"]) # /check-in/update-lock-code/
@jwt_required()
def update_lock_code(entry_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        lock_code = data.get("lockCode")
        print(user_id)
        check_in = check_in_collection.find_one({"_id": ObjectId(entry_id), "userId": user_id})
        print("user id", user_id)

        print("Check-in : ",check_in)
        if not check_in:
            return jsonify({"error": "User not found"}), 404
        
        # if lock_code is empty or None, remove the existing lock code
        if not lock_code:
            print("NOT LOCK_CODE")

            result = check_in_collection.update_one(
                {"_id": ObjectId(entry_id), "userId": user_id},
                {"$unset": {"lockCode": ""}}
            )
            if result.modified_count == 0:
                return jsonify({"error": "Failed to remove lock code"}), 500
            return jsonify({"message": "Lock code removed successfully"}), 200
                
        else:
            print(" LOCK_CODE")
            result = check_in_collection.update_one(
                    {"_id": ObjectId(entry_id), "userId": user_id},
                    {"$set": {"lockCode": lock_code}}
            )
            if result.modified_count == 0:
                return jsonify({"error": "Failed to create lock code"}), 500
            return jsonify({"message": "Lock code created successfully"}), 200

    except Exception as e:
        print(f"❌ Error updating lock code: {str(e)}")
        return jsonify({"error": str(e)}), 500

@check_bp.route("/<entry_id>", methods=["PUT"])
@jwt_required()
def update_check_in(entry_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        print("entry id :" , entry_id )
        # Validate entry_id
        if not ObjectId.is_valid(entry_id):
            return jsonify({"error": "Invalid check-in ID"}), 400

        # Find the check-in entry
        check_in = check_in_collection.find_one({
            "_id": ObjectId(entry_id),
            "userId": user_id
        })

        if not check_in:
            return jsonify({"error": "Check-in entry not found or unauthorized"}), 404

        # Update the check-in entry
        update_data = {
            "sentiments": data.get("sentiments", check_in.get("sentiments", [])),
            "causes": data.get("causes", check_in.get("causes", [])),
            "comments": data.get("comments", check_in.get("comments", [])),
            "lockCode" : data.get("lockCode", check_in.get("lockCode", "")),
            "updatedAt": datetime.now()
        }

        # Validate required fields
        if not update_data["sentiments"] or not update_data["causes"]:
            return jsonify({"error": "Sentiments and causes are required"}), 400

        # Update the document
        result = check_in_collection.update_one(
            {"_id": ObjectId(entry_id), "userId": user_id},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            return jsonify({"error": "No changes were made"}), 400

        return jsonify({
            "message": "Check-in updated successfully",
            "check_in": {
                "id": str(check_in["_id"]),
                "sentiments": update_data["sentiments"],
                "causes": update_data["causes"],
                "comments": update_data["comments"], 
                "lockCode" :  update_data["lockCode"]
            }
        }), 200

    except Exception as e:
        print("❌ Error updating check-in:", str(e))
        return jsonify({"error": "Failed to update check-in"}), 500
