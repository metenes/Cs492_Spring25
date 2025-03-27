from flask import Flask, request, jsonify
from transformers import pipeline
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
# import bcrypt
import os

import torch
from flask import Flask, jsonify, request
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


app = Flask(__name__)
CORS(app)

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

mail.init_app(app)
jwt_manager.init_app(app)
bcrypt = Bcrypt(app)

# bcrypt.init_app(app) 

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
        
        data = request.get_json()
        print(f"🔹 Received data: {data}")
        
        # Extract data from request
        entry_content = data.get('entryContent')
        entry_date = data.get('entryDate')
        images = data.get('images', [])
        journal_sentiments = data.get('journalSentiments', [])
        
        print(f"🔹 Extracted content: {entry_content[:50]}...")  # First 50 chars
        print(f"🔹 Entry date: {entry_date}")
        print(f"🔹 Number of images: {len(images)}")
        print(f"🔹 Sentiments: {journal_sentiments}")
        
        # Validate required fields
        if not entry_content:
            print("❌ No entry content provided")
            return jsonify({"error": "Entry content is required"}), 400
            
        # Create new journal entry
        new_entry = {
            "entryContent": entry_content,
            "entryDate": entry_date or datetime.utcnow().isoformat(),
            "images": images,
            "journalSentiments": journal_sentiments
        }
        print(f"🔹 Created new entry object: {new_entry}")
        
        # Update the document using $push to add to the journalEntries array
        print(f"🔹 Attempting to save to MongoDB for user {user_id}")
        result = journal_entries_collection.update_one(
            {"userId": ObjectId(user_id)},
            {
                "$push": {
                    "journalEntries": new_entry
                }
            },
            upsert=True  # Create if doesn't exist
        )
        
        print(f"✅ MongoDB update result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
        
        return jsonify({
            "message": "Journal entry saved successfully",
            "entry": new_entry
        }), 201
        
    except Exception as e:
        print(f"❌ Error saving journal entry: {str(e)}")
        import traceback
        traceback.print_exc()  # Print full stack trace
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
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
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
