import os
import pymongo
import certifi
import torch
import json
import logging
import time
import uuid
# User token 
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any, Union
from flask import Flask, request, jsonify
from transformers import pipeline
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
# import bcrypt
from flask_mail import Mail, Message
from bson.objectid import ObjectId
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from pydantic import BaseModel, Field
import os

import torch
from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta
from datetime import timedelta
# Face Analysis
import cv2
import numpy as np
import base64
from deepface import DeepFace
# User token 
from flask import request
import jwt

# importing the controller blueprints
from controller.user_controller import user_bp
from controller.sentiments_controller import sentiments_bp
from controller.activities_controller import activities_bp
from controller.journal_controller import journal_bp
from controller.chat_controller import chat_bp
# importing the database and mail configurations
from utils.database import db, journal_entries_collection
from utils.mail_config import mail
from utils.load_model import model
from utils.jwt_config import jwt_manager, SECRET_KEY
from datetime import datetime
from bson import ObjectId
from botocore.exceptions import ClientError
# Chat API from chat.py
from chat import *

# Models
class User(BaseModel):
    username: str
    email: str
    password: str

class UserInDB(User):
    hashed_password: str
    user_id: str
    created_at: str
    model_path: Optional[str] = None
    model_version: int = 0

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

class ChatMessage(BaseModel):
    role: str = "user"
    content: str

class ChatHistory(BaseModel):
    messages: List[ChatMessage] = []

class ChatRequest(BaseModel):
    message: str
    update_model: bool = False  # Whether to update the model based on this interaction
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    model_version: int
    model_updated: bool = False
    inference_time: float = 0.0

class ModelTrainingRequest(BaseModel):
    training_data: List[Dict[str, str]]
    hyperparameters: Optional[Dict[str, Any]] = None

class ModelTrainingResponse(BaseModel):
    job_id: str
    status: str
    estimated_completion_time: Optional[str] = None

class ModelStatus(BaseModel):
    user_id: str
    model_path: str
    model_version: int
    last_updated: str
    training_jobs: List[Dict[str, Any]] = []
    performance_metrics: Optional[Dict[str, float]] = None


app = Flask(__name__)
CORS(app)

JWT_SECRET = os.getenv("JWT_SECRET", "sentioSecretKey")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 24  # 24 hours
# Load ML Model

model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
# if we need to use own fine tuning 
# model = pipeline("sentiment-analysis", model="./fine_tuned_model")
# JWT Config
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", JWT_SECRET)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)
# datetime.timedelta(days=1)

# Mail Config (Hide Credentials in Environment Variables)
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "sentiooffical@gmail.com")
app.config["MAIL_PASSWORD"] = "dpgn mvbv kias nmtx"
# app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "1234SR714567SR33")

app.config["MAIL_DEFAULT_SENDER"] = ("Sentio App", os.getenv("MAIL_USERNAME", "sentiooffical@gmail.com"))
app.config["MAIL_MAX_EMAILS"] = 5
app.config["MAIL_USE_SSL"] = False
app.config["MAIL_ASCII_ATTACHMENTS"] = False

# app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "sentioanalysis.co@gmail.com")
# app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "1234SR71456.")
mail.init_app(app)
jwt_manager.init_app(app)
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
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
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


# 1. First define the route
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
            "createdAt": datetime.now()
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

# 2. THEN register all blueprints
app.register_blueprint(user_bp, url_prefix="/user")
app.register_blueprint(sentiments_bp, url_prefix="/sentiment")
app.register_blueprint(activities_bp, url_prefix="/activity")
app.register_blueprint(journal_bp, url_prefix="/journal")
app.register_blueprint(chat_bp, url_prefix="/chat")


# ---------------------------------------
#  **Protected Route**
# this is a protected route that requires a valid JWT token to access
# ---------------------------------------
@app.route("/protected", methods=["GET"])
@jwt_required()
def protected():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({"error": "Token is missing"}), 401
    
    try:
        # Decode the token
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload['user_id']
        return jsonify({"message": f"Welcome user {user_id}!"}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401


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
