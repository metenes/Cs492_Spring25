from flask import Flask, request, jsonify
from ml.sentiment_model import load_model, predict_sentiment
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
# import bcrypt
from flask_mail import Mail, Message
from bson.objectid import ObjectId
import os
import pymongo
import certifi
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from flask import Flask, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta
# Face Analysis
import cv2
import numpy as np
import base64
from deepface import DeepFace
# User token 
from functools import wraps
from flask import request


app = Flask(__name__)
CORS(app)

SECRET_KEY = "sentioSecretKey"
# Load ML Model
model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
# if we need to use own fine tuning 
# model = pipeline("sentiment-analysis", model="./fine_tuned_model")
# JWT Config
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)
# datetime.timedelta(days=1)

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

# bcrypt.init_app(app) 
# MongoDB Connection (Using `retryWrites=true&w=majority` for SSL fix)
# MONGO_URI = "mongodb+srv://sentioanalysisco:9o2Y9o20jmgNziQi@cluster0.dx4f7.mongodb.net/mydb?retryWrites=true&w=majority&tls=true&tlsCAFile=<path_to_ca_file>"
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"

try:
    client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000,tlsCAFile=certifi.where())   
    db = client["mydb"]
    print("✅ Connected to MongoDB successfully!")
    print("✅ Available collections:", db.list_collection_names())
    users_collection = db["users"]
    sentiments_collection = db["sentiments"]  # db sentiments 
    activities_collection = db["activities"]
    #print("✅ users_collection, sentiments_collection, activities_collection lists extracted from MongoDB successfully!")
except Exception as e:
    print(f"❌ Error connecting to MongoDB: {e}")
    exit(1)


# ---------------------------------------
#  User Token check 
# ---------------------------------------

# Middleware to verify token
def token_required(f):
    @wraps(f)
    def decorator(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token is missing"}), 403

        try:
            # Decode the token using the SECRET_KEY
            token = token.split(" ")[1]  # Extract token from "Bearer token" format
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = decoded  # Store decoded data in request for access in route
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return decorator


# ---------------------------------------
#  Time classification 
# ---------------------------------------
def get_period_of_day(timestamp):
    hour = timestamp.hour
    if hour < 12:
        return 'Morning'
    elif hour < 17:
        return 'Afternoon'
    return 'Evening'

# ---------------------------------------
# Function to create a JWT token
# ---------------------------------------

#def create_access_token(user_id):
#    payload = {
#        'user_id': user_id,
#        'exp': datetime.utcnow() + timedelta(hours=1)  # Token expiration time (1 hour)
#    }
#    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
#    return token

# ---------------------------------------
#  **Fixing Register Endpoint**
# ---------------------------------------

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        email = data.get('email')
        password = data.get('password')
        dob = data.get('dob')
        
        if not email or not password or not dob:
            return jsonify({"error": "Missing required fields (email, password, or dob)"}), 400

        # Check if email already exists
        if users_collection.find_one({"email": email}):
            return jsonify({"error": "Email already in use"}), 400

        # Hash password - DO NOT USE
        # For py-bcrypt: --> REMOVE EVERY INSTANCE OF THIS IF EXIST, RE-START SERVER DO NOT RELOAD EXPO
        # import bcrypt
        # hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        # OR for flask-bcrypt:
        #from flask_bcrypt import Bcrypt
        #bcrypt = Bcrypt(app)
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

        # Set default preferences
        preferences = "default"  # This was undefined in your original code

        # Create user document
        user = {
            "email": email,
            "password": hashed_password,
            "dob": dob,
            "preferences": preferences,
            "profile_picture": "",
            "last_login": datetime.now(),
            "created_at": datetime.now(),
            "role": "user",
            "account_status": "active",
            "two_factor_enabled": False
        }

        # Insert into MongoDB
        result = users_collection.insert_one(user)

        # Create JWT token
        # Create JWT token - using the proper method
        # Option 1: If using PyJWT directly
        # token = jwt.encode_key_loader({"user_id": str(result.inserted_id)}, SECRET_KEY, algorithm="HS256")
        token = create_access_token(identity=str(result.inserted_id))

        # If token is returned as bytes (depends on jwt version), decode it
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        return jsonify({
            "access_token": token,
            "user": {
                "email": email,
                "profile_picture": "",
                "preferences": preferences,
                "last_login": str(datetime.now()),  # Convert datetime to string for JSON serialization
            }
        }), 201
        
    except Exception as e:
        # Log the error for debugging
        print(f"Registration error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ---------------------------------------
#  **Fixing Login Endpoint**
# ---------------------------------------

@app.route('/login', methods=['POST'])
def login_user():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or Content-Type header missing"}), 400
        email = data.get('email')
        password = data.get('password')

        print(email)
        print(password)

        if not email or not password:
            return jsonify({"error": "Email and password are required"})
        
        user = users_collection.find_one({"email": email})
        if not user or not bcrypt.check_password_hash(user['password'].encode('utf-8'),password):
            return jsonify({"error": "Invalid email or password"}), 400

        # Generate JWT token using Flask-JWT-Extended
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(user['_id']))

        # Update last login time
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": str(datetime.now())}}
        )

        response = jsonify({
            "access_token": token,
            "user": {
                "email": user['email'],
                "profile_picture": user.get('profile_picture', ''),
                "preferences": user.get('preferences', {}),
                "last_login": str(datetime.now()),
            }
        })
            # Force content type
        response.headers['Content-Type'] = 'application/json'
        return response
    except Exception as e:
            # Log the error server-side
            print(f"Login error: {str(e)}")
            # Return a proper JSON error response instead of letting Flask handle it
            return jsonify({"error": "Server error during login", "details": str(e)}), 500

# ---------------------------------------
#  **Protected Route**
# ---------------------------------------
@app.route("/protected", methods=["GET"])
@jwt_required()
def protected():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({"error": "Token is missing"}), 401
    
    try:
        # Decode the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
        return jsonify({"message": f"Welcome user {user_id}!"}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401


# ---------------------------------------
#  **Profile Route**
# ---------------------------------------
@app.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    token = request.headers.get('Authorization').split(" ")[1]
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded_token["user_id"]
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
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401


# ---------------------------------------
#  **Preferences Update**
# ---------------------------------------

@app.route('/update-preferences', methods=['POST'])
def update_preferences():
    token = request.headers.get('Authorization').split(" ")[1]
    data = request.get_json()
    preferences = data.get('preferences')

    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded_token["user_id"]
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"preferences": preferences}}
        )

        if result.modified_count > 0:
            return jsonify({"message": "Preferences updated successfully"})
        else:
            return jsonify({"error": "Failed to update preferences"}), 400
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401


# ---------------------------------------
#  **Activity Logging**
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
            "timestamp": datetime.now()
        })

        return jsonify({"message": "Activity logged successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
#  **Forgot Password**
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

@app.route("/api/sentiment-analysis", methods=["GET"])
@jwt_required()
def sentiment_analysis():
    try:
        user_id = get_jwt_identity()
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        
        user_id = ObjectId(user_id)
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        interval = request.args.get("interval", "monthly")
        emotions = request.args.get("emotions") #if no emotions are provided, all emotions will be considered
        
        if not start_date_str or not end_date_str:
            return jsonify({"error": "start_date and end_date are required"}), 400
        
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        
        if interval not in ["daily", "weekly", "monthly"]:
            return jsonify({"error": "Invalid interval. Use 'daily', 'weekly', or 'monthly'"}), 400
        
        emotion_filter = emotions.split(",") if emotions else None
        
        # Define grouping key for MongoDB aggregation
        if interval == "daily":
            date_group = {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}
        elif interval == "weekly":
            date_group = {"$isoWeekYear": "$timestamp", "$isoWeek": "$timestamp"}
        else:  # monthly
            date_group = {"$dateToString": {"format": "%Y-%m", "date": "$timestamp"}}
        
        pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": start_date, "$lte": end_date}}},
            {"$unwind": "$emotions"},
        ]
        
        if emotion_filter:
            pipeline.append({"$match": {"emotions.emotion_name": {"$in": emotion_filter}}})
        
        pipeline.extend([
            {"$group": {
                "_id": {"time_period": date_group, "emotion_name": "$emotions.emotion_name"},
                "total_percentage": {"$sum": "$emotions.percentage"},
                "entry_count": {"$sum": 1}
            }},
            {"$sort": {"_id.time_period": 1}}
        ])
        
        sentiment_data = list(sentiments_collection.aggregate(pipeline))
        
        response = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "interval": interval,
            "emotion_analysis": [
                {
                    "time_period": item["_id"]["time_period"],
                    "emotion_name": item["_id"]["emotion_name"],
                    "total_percentage": round(item["total_percentage"], 1),
                    "entry_count": item["entry_count"]
                }
                for item in sentiment_data
            ]
        }
        
        return jsonify(response), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/save-journal-entry", methods=["POST"])
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
        inserted_entry = db.journal_entries.insert_one(journal_entry)
        journal_entry["_id"] = str(inserted_entry.inserted_id)  # Convert ObjectId to string for response
        journal_entry["user_id"] = str(journal_entry["user_id"]) 

        return jsonify({"message": "Journal entry saved successfully", "entry": journal_entry}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-journal-entries", methods=["GET"])
@jwt_required()
def get_journal_entries():
    try:
        user_id = get_jwt_identity()
        print("Fetching journal entries for user:", user_id)

        # Retrieve user's journal entries from MongoDB
        journal_entries = db.journal_entries.find({"user_id": ObjectId(user_id)})

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


@app.route("/sentiment/<timeframe>", methods=["GET"])
@jwt_required()
def get_sentiment_data(timeframe):
    try:
        user_id = get_jwt_identity()

        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400

        user_id = ObjectId(user_id)
        now = datetime.utcnow()

        # Determine the time range
        if timeframe == 'day':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            date_group = {"$dateToString": {"format": "%H", "date": "$timestamp"}}
        elif timeframe == 'week':
            start_date = now - timedelta(days=7)
            date_group = {"$dateToString": {"format": "%a", "date": "$timestamp"}}  # Groups by weekday name
        elif timeframe == 'month':
            start_date = now - timedelta(days=30)
            date_group = {"$isoWeek": "$timestamp"}  # Groups by week number
        else:
            return jsonify({"error": "Invalid timeframe"}), 400

        # MongoDB Aggregation Pipeline
        pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": start_date}}},
            {"$group": {
                "_id": date_group,
                "avg_joy": {"$avg": "$joy"},
                "avg_excitement": {"$avg": "$excitement"},
                "avg_approval": {"$avg": "$approval"}
            }},
            {"$sort": {"_id": 1}}
        ]

        sentiments = list(sentiments_collection.aggregate(pipeline))

        # Format output
        result = [{"name": item["_id"], "Joy": round(item["avg_joy"], 1), 
                   "Excitement": round(item["avg_excitement"], 1), 
                   "Approval": round(item["avg_approval"], 1)} 
                  for item in sentiments]

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/sentiment/current", methods=["GET"])
@jwt_required()
def get_current_mood():
    try:
        user_id = get_jwt_identity()

        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400

        user_id = ObjectId(user_id)

        # Get the latest sentiment entry
        current_sentiment = sentiments_collection.find_one(
            {"user_id": user_id},
            projection={"joy": 1, "excitement": 1, "approval": 1, "_id": 0},
            sort=[("timestamp", -1)]
        )

        if not current_sentiment:
            return jsonify({"error": "No sentiment data found"}), 404

        # Calculate overall mood
        avg_score = (current_sentiment['joy'] + 
                    current_sentiment['excitement'] + 
                    current_sentiment['approval']) / 3

        mood = "Happiness" if avg_score >= 4 else \
               "Content" if avg_score >= 3 else \
               "Neutral" if avg_score >= 2 else "Low"

        return jsonify({
            "mood": mood,
            "description": "Joy, Excitement, and Approval",
            "scores": current_sentiment
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------------------------- Chatbot Analysis  ---------------------------------------
# We use API

# ---------------------------------------
#  **Chatbot Analysis**
# ---------------------------------------
# Define Request Model
try:
    TOKENIZER_NAME = "bert-base-uncased"  # Define the variable before usage
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_NAME)
    model = AutoModelForCausalLM.from_pretrained(TOKENIZER_NAME)
    # model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device("cpu")))
    model.eval()
    print("✅ Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Model Load Error: {e}")

# Define Request Model
class ChatRequest(BaseModel):
    user_input: str

# Chatbot API Endpoint
@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        inputs = tokenizer.encode(request.user_input, return_tensors="pt")
        output = model.generate(inputs, max_length=100, num_return_sequences=1)
        response = tokenizer.decode(output[0], skip_special_tokens=True)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {e}")


# --------------------------------------- Model Analysis  ---------------------------------------
# We use AWS API 

# ---------------------------------------
#  **Sentimental Analysis Model**
# ---------------------------------------
# Define Request Model from AWS cloud, no processing to be done inside local machine
import torch
import boto3

s3 = boto3.client('s3')
#s3.download_file('sentiobucket', 'model.pt', '/tmp/model.pt')
#model = torch.load('/tmp/model.pt', map_location=torch.device("cpu"))

# Look db_info.txt for aws credentials
# s3 = boto3.client(
#   's3',
#    aws_access_key_id="YOUR_ACCESS_KEY",
#    aws_secret_access_key="YOUR_SECRET_KEY",
#    region_name="YOUR_REGION"
# )

# Add to upper part if necessary
# aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
# aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
# aws_region = os.getenv("AWS_DEFAULT_REGION", "me-south-1") 

# Lambada Fast exec. 
def lambda_handler(event, context):
    input_text = event["text"]
    output = model(input_text)
    return {"prediction": output}
 
# Lambada Fast predict.  
@app.route('/predict', methods=['POST'])
def predict():
    user_id = request.json["user_id"]
    input_text = request.json["text"]
    # Load personalized or global model
    model_path = f"s3://sentiobucket/models/{user_id}/"
    
    model = torch.load(model_path)
    response = model(input_text)
    
    return jsonify({"response": response})

# Trend analysis 
@app.route('/community-trends', methods=['GET'])
def community_trends():
    pipeline = [
        {"$group": {
            "_id": "$sentiments.emotion",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    stats = list(db.users.aggregate(pipeline))
    return jsonify(stats)

# ---------------------------------------
#  **Continiues Trainig  Model**
# ---------------------------------------
#  Personalized AI
#  Train wth Sagamaker Pipeline on cloud 

#sagemaker = boto3.client('sagemaker')

""" def train_personal_model(user_id):
    response = sagemaker.create_training_job(
        TrainingJobName=f"user-model-{user_id}",
        AlgorithmSpecification={"TrainingImage": "your-custom-image"},
        InputDataConfig=[{"ChannelName": "train", "DataSource": {"S3DataSource": {"S3Uri": f"s3://your-bucket/{user_id}/data.json"}}}],
        OutputDataConfig={"S3OutputPath": f"s3://your-bucket/models/{user_id}/"},
        ResourceConfig={"InstanceType": "ml.m5.large", "InstanceCount": 1, "VolumeSizeInGB": 10},
        StoppingCondition={"MaxRuntimeInSeconds": 3600}
    )
    return response  """

#  Global AI
#  Train wth Sagamaker Pipeline on cloud 
#stepfunctions = boto3.client('stepfunctions')

""" def start_global_ai_training():
    response = stepfunctions.start_execution(
        stateMachineArn="arn:aws:states:us-east-1:123456789012:stateMachine:GlobalAIUpdate",
        input="{}"
    )
    return response """

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
