from functools import wraps
import os
import pymongo
import certifi
import torch
import boto3
import json
import logging
import time
import uuid
# User token 
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any, Union
from flask import Flask, request, jsonify, Blueprint
from transformers import pipeline
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity, JWTManager, create_access_token
from flask_bcrypt import Bcrypt
from flask_apscheduler import APScheduler
# import bcrypt
from flask_mail import Mail, Message
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from pydantic import BaseModel, Field

from bson import ObjectId
from datetime import datetime, timedelta
# User token 
import jwt

# importing the controller blueprints
from controller.user_controller import user_bp
from controller.sentiments_controller import sentiments_bp
from controller.activities_controller import activities_bp
from controller.journal_controller import journal_bp
from controller.chat_controller import chat_bp
from controller.check_in_controller import check_bp
from controller.notification_controller import notification_bp, send_daily_reminders

# importing the database and mail configurations
from utils.database import db, journal_entries_collection
from utils.mail_config import mail
from utils.load_model import model
from utils.jwt_config import jwt_manager
from botocore.exceptions import ClientError
# Chat API from chat.py
# from chat import Chat

app = Flask(__name__)
CORS(app)

JWT_SECRET = os.getenv("JWT_SECRET", "sentioSecretKey")
JWT_ALGORITHM = "HS256"
app.config['JWT_SECRET_KEY'] = 'sentioSecretKey'  # Replace with a strong random key
app.config['SECRET_KEY'] = 'sentioSecretKey'    # If you want to use the same key for both Flask and JWT
JWT_EXPIRATION_MINUTES = 60 * 24  # 24 hours
# Load ML Model

model = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
# if we need to use own fine tuning 
# model = pipeline("sentiment-analysis", model="./fine_tuned_model")
# JWT Config

app.config["JWT_SECRET"] = os.getenv("JWT_SECRET_KEY", JWT_SECRET)
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


@app.route('/get-journal-dates', methods=['GET'])
@jwt_required()
def get_journal_dates():
    try:
        user_id = get_jwt_identity()
        print(f"🔍 Fetching journal dates for user_id: {user_id}")

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
            "createdAt": datetime.utcnow(),
            "entryDate": datetime.utcnow().strftime("%Y-%m-%d"),
            "images": [],
            "journalSentiments": []
        }

        journal_entries_collection.insert_one(new_entry)
        return jsonify({"message": "Guided journal entry saved successfully."}), 201

    except Exception as e:
        print("❌ Error saving guided entry:", str(e))
        return jsonify({"error": "Internal server error"}), 500

check_bp = Blueprint('check_in', __name__)
check_in_collection = db["check_in_entries"]

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

app.register_blueprint(user_bp, url_prefix="/user")
app.register_blueprint(sentiments_bp, url_prefix="/sentiment")
app.register_blueprint(activities_bp, url_prefix="/activity")
app.register_blueprint(journal_bp, url_prefix="/journal")
app.register_blueprint(chat_bp, url_prefix="/chat")
app.register_blueprint(check_bp, url_prefix="/check-in")
app.register_blueprint(notification_bp, url_prefix="/notification")

# --------------------------------------- Model Analysis  ---------------------------------------
# We use AWS API 

# ---------------------------------------
#  **Sentimental Analysis Model**
# ---------------------------------------
# Define Request Model from AWS cloud, no processing to be done inside local machine

s3 = boto3.client('s3')
#s3.download_file('sentiobucket', 'model.pt', '/tmp/model.pt')
#model = torch.load('/tmp/model.pt', map_location=torch.device("cpu"))

# Look db_info.txt for aws credentials
# s3 = boto3.client(
#   's3',
#    aws_access_key_id="YOUR_ACCESS_KEY",
#    aws_secret_access_key="YOUR_JWT_SECRET",
#    region_name="YOUR_REGION"
# )

# Add to upper part if necessary
# aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
# aws_JWT_SECRET = os.getenv("AWS_SECRET_ACCESS_KEY")
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

class Config:
    SCHEDULER_API_ENABLED = True

app.config.from_object(Config())

scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()

# send daily reminders at 7:30 PM
scheduler.add_job(
    id='daily_reminder_job',
    func=send_daily_reminders,
    trigger='cron',
    hour=19,
    minute=30
)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
