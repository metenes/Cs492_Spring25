from flask import Blueprint, request, jsonify
from bson import ObjectId
from utils.database import check_in_collection, users_collection, sentiments_collection, prompt_collection
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity

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
        timestamp = datetime.utcnow()

        if not sentiments or not causes:
            return jsonify({"error": "Sentiments and causes are required."}), 400

        new_check_in = {
            "userId": user_id,
            "sentiments": sentiments,
            "causes": causes,
            "comments": comments,
            "timestamp": timestamp
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
                "created_at": entry["timestamp"].isoformat(),
                "type": "checkin",
                "date": entry["timestamp"].strftime("%Y-%m-%d"),
                "sentiments": entry.get("sentiments", []),
                "causes": entry.get("causes", []),
                "comments": entry.get("comments", []),
            })

        

        return jsonify({"history": result}), 200
    except Exception as e:
        print("❌ Error fetching check-ins:", str(e))
        return jsonify({"error": "Internal server error"}), 500


# Route to submit a new check-in entry using PyMongo
""" @check_bp.route('/submit', methods=['POST'])
def create_check_in():
    try:
        data = request.get_json()
        print("*******SUBMIT FROM CONTROLLER********")
        
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


 """
@check_bp.route('/history/<user_id>', methods=['GET'])
def get_check_in_history(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Convert cursor to a list before checking length
        entries = list(check_in_collection.find({"user_id": ObjectId(user_id)}))

        if not entries:  # Corrected check
            print("here")
            return jsonify({"error": "No check-in entries found"}), 404

        # Convert entries to JSON format
        history = [
            {
                "entry_id": str(entry["_id"]),
                "user_id": str(entry["user_id"]),
                "sentiments": entry["sentiments"],  
                "causes": entry["causes"],
                "comments": entry.get("comments", []),
                "created_at": entry.get("created_at").isoformat() if entry.get("created_at") else None
            }
            for entry in entries
        ]

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
