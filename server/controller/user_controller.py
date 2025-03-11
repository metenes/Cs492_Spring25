from flask import Blueprint, request, jsonify, current_app
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
from datetime import datetime, timedelta
from models.user import User  # Import the User model
from utils.database import users_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from flask_mail import Message
from utils.mail_config import mail
from utils.jwt_config import decode_token

# Initialize Blueprint for user routes
user_bp = Blueprint("user_bp", __name__)

# Initialize bcrypt instance
bcrypt = Bcrypt()

# ---------------------------------------
#  **User Registration**
# ---------------------------------------
@user_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            print("Email and password are required")
            return jsonify({"error": "Email and password are required"}), 400

        # Check if the user already exists
        if users_collection.find_one({"email": email}):
            return jsonify({"error": "User already exists"}), 400

        # Hash password before saving
        registration_time = datetime.now()
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        new_user = {
            "email": email,
            "password": hashed_password,
            "created_at": registration_time,
        }
        users_collection.insert_one(new_user)
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
#  **User Login**
# ---------------------------------------
@user_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

        print(f"🔹 Login Attempt: email={email}, password={password}")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Fetch user from MongoDB
        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401

        # Check password
        if not bcrypt.check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid credentials"}), 401

        # Generate JWT token
        access_token = create_access_token(identity=str(user["_id"]))  # You can pass user ID as string
        print(f"LOGIN {access_token}")

        return jsonify({"access_token": access_token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
#  **Profile Route**
# ---------------------------------------
@user_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    token = request.headers.get('Authorization').split(" ")[1]
    try:
        user_id = decode_token(token)
        user = users_collection.find_one({"_id": ObjectId(user_id)})

        if user:
            return jsonify({
                "email": user['email'],
                "profile_picture": user.get('profile_picture', ''),
                "preferences": user.get('preferences', {}),
                "last_login": user.get('last_login', datetime.now()),
                "role": user.get('role', 'user'),
                "account_status": user.get('account_status', 'active')
            })
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
#  **Forgot Password**
# ---------------------------------------
@user_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    try:
        email = request.json.get("email")
        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "User not found"}), 404

        reset_token = create_access_token(identity=str(user["_id"]), expires_delta=timedelta(minutes=15))
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}"

        msg = Message("Password Reset Request", sender=current_app.config["MAIL_USERNAME"], recipients=[email])
        msg.body = f"Click the link to reset your password: {reset_link}"
        mail.send(msg)

        return jsonify({"message": "Password reset email sent"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# Trend analysis 
@user_bp.route('/community-trends', methods=['GET'])
def community_trends():
    pipeline = [
        {"$group": {
            "_id": "$sentiments.emotion",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    stats = list(users_collection.aggregate(pipeline))
    return jsonify(stats)

@user_bp.route("/delete-user", methods=["DELETE"])
@jwt_required()
def delete_user():
    try:
        user_id = get_jwt_identity()  # Get user ID from JWT token

        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400

        # Find and delete the user from the database
        result = users_collection.delete_one({"_id": ObjectId(user_id)})

        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404

        # delete related journal entries for the user
        from utils.database import journal_entries_collection
        journal_entries_collection.delete_many({"user_id": user_id})
        
        return jsonify({"message": "User account deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
