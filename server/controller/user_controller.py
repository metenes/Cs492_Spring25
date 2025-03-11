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


@user_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    try:
        user_id = get_jwt_identity()
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"email": user["email"], "created_at": user["created_at"]}), 200
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