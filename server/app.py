from flask import Flask, request, jsonify
from ml.sentiment_model import load_model, predict_sentiment
from transformers import pipeline
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from pymongo import MongoClient
from flask_mail import Mail, Message
from bson.objectid import ObjectId
import datetime

app = Flask(__name__)
CORS(app)

# Load the ML model once
model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
# if we need to use own fine tuning 
# model = pipeline("sentiment-analysis", model="./fine_tuned_model")

# JWT Config
app.config["JWT_SECRET_KEY"] = "your_secret_key"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(days=1)
# Mail Config
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "sentioanalysis.co@gmail.com"
app.config["MAIL_PASSWORD"] = "1234SR71456."
mail = Mail(app)
# JWT 
jwt = JWTManager(app)
# Cryto Algo 
bcrypt = Bcrypt(app)

# MongoDB connection
client = MongoClient("mongodb+srv://sentioanalysisco:9o2Y9o20jmgNziQi@cluster0.dx4f7.mongodb.net/")
# mongodb+srv://sentioanalysisco:9o2Y9o20jmgNziQi@cluster0.dx4f7.mongodb.net/
db = client["mydb"]
users_collection = db["users"]
activities_collection = db["activities"]

@app.route("/register", methods=["POST"])
def register():
    email = request.json.get("email")
    password = request.json.get("password")
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400
    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    new_user = {"email": email, "password": hashed_password, "created_at": datetime.datetime.utcnow()}
    users_collection.insert_one(new_user)
    return jsonify({"message": "User registered successfully"}), 201

@app.route("/login", methods=["POST"])
def login():
    email = request.json.get("email")
    password = request.json.get("password")
    user = users_collection.find_one({"email": email})
    if user and bcrypt.check_password_hash(user["password"], password):
        access_token = create_access_token(identity=str(user["_id"]))
        return jsonify({"access_token": access_token}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_id = get_jwt_identity()
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"email": user["email"], "created_at": user["created_at"]}), 200

@app.route("/activity", methods=["POST"])
@jwt_required()
def track_activity():
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

@app.route("/activity", methods=["GET"])
@jwt_required()
def get_activities():
    user_id = get_jwt_identity()
    activities = list(activities_collection.find({"user_id": user_id}, {"_id": 0, "activity": 1, "timestamp": 1}))
    return jsonify({"activities": activities}), 200

@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    email = request.json.get("email")
    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404
    reset_token = create_access_token(identity=str(user["_id"]), expires_delta=datetime.timedelta(minutes=15))
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    msg = Message("Password Reset Request", sender="your-email@gmail.com", recipients=[email])
    msg.body = f"Click the link to reset your password: {reset_link}"
    mail.send(msg)
    return jsonify({"message": "Password reset email sent"}), 200

@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    try:
        text = request.json.get("text", "")
        if not text:
            return jsonify({"error": "No text provided"}), 400
        result = model(text)
        return jsonify(result[0])  # Return the first result
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/chat", methods=["POST"])
def chat():
    try:
        user_message = request.json.get("message", "")
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        # Simple AI chatbot logic
        response = {"reply": f"Echo: {user_message}"}
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
