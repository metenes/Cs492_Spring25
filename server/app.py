from flask import Flask, request, jsonify
from ml.sentiment_model import load_model, predict_sentiment
from transformers import pipeline
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from flask_mail import Mail, Message
from bson.objectid import ObjectId
import datetime
import os
import pymongo
import certifi
app = Flask(__name__)
CORS(app)

# Load ML Model
model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
# if we need to use own fine tuning 
# model = pipeline("sentiment-analysis", model="./fine_tuned_model")
# JWT Config
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your_secret_key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(days=1)

# Mail Config (Hide Credentials in Environment Variables)
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
# app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "sentioanalysis.co@gmail.com")
# app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "1234SR71456.")

app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "sentiooffical@gmail.com")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "1234SR71456.")


mail = Mail(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# MongoDB Connection (Using `retryWrites=true&w=majority` for SSL fix)
# MONGO_URI = "mongodb+srv://sentioanalysisco:9o2Y9o20jmgNziQi@cluster0.dx4f7.mongodb.net/mydb?retryWrites=true&w=majority&tls=true&tlsCAFile=<path_to_ca_file>"
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"
try:
    client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000,tlsCAFile=certifi.where())   
    db = client["mydb"]
    print("Connected to MongoDB successfully!")
    users_collection = db["users"]
    activities_collection = db["activities"]
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    exit(1)

# ---------------------------------------
# 🛠️ **Fixing Register Endpoint**
# ---------------------------------------
@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Check if the user already exists
        if users_collection.find_one({"email": email}):
            return jsonify({"error": "User already exists"}), 400

        # Hash password before saving
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        new_user = {
            "email": email,
            "password": hashed_password,
            "created_at": datetime.datetime.utcnow(),
        }
        users_collection.insert_one(new_user)
        print("register ended ... ")
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
# 🔑 **Fixing Login Endpoint**
# ---------------------------------------
@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

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
        access_token = create_access_token(identity=str(user["_id"]))
        return jsonify({"access_token": access_token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
# 👤 **Profile Route**
# ---------------------------------------
@app.route("/profile", methods=["GET"])
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
# 🏃 **Activity Logging**
# ---------------------------------------
@app.route("/activity", methods=["POST"])
@jwt_required()
def track_activity():
    try:
        user_id = get_jwt_identity()
        activity = request.json.get("activity")

        if not activity:
            return jsonify({"error": "Activity is required"}), 400

        activities_collection.insert_one({
            "user_id": user_id,
            "activity": activity,
            "timestamp": datetime.datetime.utcnow()
        })

        return jsonify({"message": "Activity logged successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
# 📧 **Forgot Password**
# ---------------------------------------
@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    try:
        email = request.json.get("email")
        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "User not found"}), 404

        reset_token = create_access_token(identity=str(user["_id"]), expires_delta=datetime.timedelta(minutes=15))
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}"

        msg = Message("Password Reset Request", sender=app.config["MAIL_USERNAME"], recipients=[email])
        msg.body = f"Click the link to reset your password: {reset_link}"
        mail.send(msg)

        return jsonify({"message": "Password reset email sent"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
# 📊 **Sentiment Analysis**
# ---------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    try:
        text = request.json.get("text", "")
        if not text:
            return jsonify({"error": "No text provided"}), 400
        result = model(text)
        return jsonify(result[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
