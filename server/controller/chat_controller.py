import os
import pymongo
import certifi
import torch
import boto3
import json
import logging
import time
import jwt
from flask import Flask, request, jsonify, Blueprint
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from flask_mail import Mail
from bson.objectid import ObjectId
from bson import ObjectId
from transformers import BertTokenizer, BertForSequenceClassification
import requests

# Sagamaker AI
import sagemaker
from sagemaker.pytorch import PyTorchModel
from sagemaker import get_execution_role

# User token 
from functools import wraps
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from botocore.exceptions import ClientError
import boto3
import pymongo
import certifi
from transformers import BertTokenizer

# utils 
from models.chat import Chat, Message, ChatRequest, ChatResponse, ModelTrainingRequest, ModelTrainingResponse  # Import the Chat model
from utils.database import db, chat_collection, users_collection, activities_collection, sentiments_collection, model_collection
from utils.load_model import model, tokenizer
from utils.jwt_config import * 
from ml.chat_emotion_model import load_model, predict_emotions, predict_emotions_with_segments   # Import the module

# Create chat blueprint
chat_bp = Blueprint("chat_bp", __name__)
# Create cloud-model blueprint
model_bp = Blueprint("model_bp", __name__)

# Device for PyTorch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# AWS Configuration
AWS_REGION = "eu-north-1"
AWS_ACCESS_KEY = "AKIAXGZAMH3HUVQSPNED"
AWS_SECRET_KEY = "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"
# S3 
S3_BUCKET = "sentiobucket"
# SAGAMAKER
SAGEMAKER_ENDPOINT = "sentio-user-endpoint"
# sentio-user-model-endpoint sentio-user-endpoint
BASE_MODEL_PATH = "models/model.pt"
USER_MODEL_PATH = "sagemaker-eu-north-1-495599763151/pytorch-inference-2025-04-13-15-46-53-994"
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"
BASE_MODEL_TAR_PATH = "models/model.tar.gz"
# E2c Model 
E2C_IP = "56.228.3.31" # E2C Distance Server Public IP - NEED TO CHANGE EVERY TIME WE GET NEW SERVER OPEN/CLOSE

# Define the emotion labels - Local 
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Mindfullness exercises 
MINDFULNESS_EXERCISES = {
    "deep_breathing": {
        "title": "Deep Breathing",
        "description": "Close your eyes. Inhale for 4, hold for 4, exhale for 4. Repeat 5 times.",
    },
    "body_scan": {
        "title": "Body Scan",
        "description": "Mentally scan your body from head to toe. Release tension as you go.",
    },
    "gratitude_journal": {
        "title": "Gratitude Journal",
        "description": "List 3 things you're grateful for today.",
    },
    "grounding_5_4_3_2_1": {
        "title": "5-4-3-2-1 Grounding",
        "description": "Identify 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.",
    }
}


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory conversation store 
conversations = {}

boto_session = boto3.session.Session(region_name="eu-north-1")
sagemaker_session = sagemaker.Session(boto_session=boto_session, default_bucket=S3_BUCKET)
role = "arn:aws:iam::495599763151:role/service-role/AmazonSageMaker-ExecutionRole-20250302T091470"

model_data_location = f's3://{S3_BUCKET}/{BASE_MODEL_TAR_PATH}'

# Initialize AWS clients
try:
    # S3 client
    s3_client = boto3.client(
        's3', 
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )

    # MongoDB connection
    client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())  
    db = client.get_database("chatbot")
    logger.info("✅ Chatbot - Connected to MongoDB successfully!")
    logger.info(f"✅ Chatbot - Available collections: {db.list_collection_names()}")

    # SageMaker runtime client
    sagemaker_runtime = boto3.client(
        'sagemaker-runtime',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    
    # SageMaker client
    sagemaker_client = boto3.client(
        'sagemaker',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )

    # Lambda client (No changes here)
    lambda_client = boto3.client(
        'lambda',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )

    # Initialize tokenizer
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
    
    logger.info("✅ AWS and DB clients initialized successfully")
        
except Exception as e:
    logger.error(f"❌ Error initializing AWS clients: {e}")
    raise

logger.info("✅ Sagamaker ready")

# Check if the model exists
try:
    response = sagemaker_client.describe_model(ModelName='sentio-user-model')
    logger.info("✅ Model already exists.")
except Exception as e:
        logger.info("❌ Model not found, creating model...")
        response = sagemaker_client.create_model(
            ModelName='sentio-user-model',
            ExecutionRoleArn=role,
            PrimaryContainer={
                    'Image': '763104351884.dkr.ecr.eu-north-1.amazonaws.com/pytorch-inference:2.1.0-cpu-py310',
                    'ModelDataUrl': 's3://sagemaker-eu-north-1-495599763151/pytorch-inference-2025-04-13-13-46-50-275/model.tar.gz',
                    'Environment': {
                        'SAGEMAKER_PROGRAM': 'inference.py',
                        'SAGEMAKER_SUBMIT_DIRECTORY': 's3://sentiobucket/model-artifacts/inference_code.zip',
                    }
                }
            )
        logger.info("✅ Model created.")

logger.info("✅ Model ready.")
    # Check if the endpoint configuration exists
try:
    response = sagemaker_client.describe_endpoint_config(EndpointConfigName='sentio-config')
    logger.info("✅ Endpoint configuration already exists.")
except Exception as e:
        logger.info("❌ Endpoint configuration not found, creating configuration...")
        response = sagemaker_client.create_endpoint_config(
                EndpointConfigName='sentio-config',
                ProductionVariants=[
                    {
                        'VariantName': 'AllTraffic',
                        'ModelName': 'sentio-user-model',
                        'InitialInstanceCount': 1,
                        'InstanceType': 'ml.m5.large',
                    },
                ]
            )
        logger.info("✅ Endpoint configuration created.")

logger.info("✅ Endpoint configuration done")
    # Check if the endpoint exists
try:    
    response = sagemaker_client.describe_endpoint(EndpointName='sentio-user-endpoint')
    logger.info("✅ Endpoint already exists.")
except Exception as e:
        logger.info("❌ Endpoint not found, creating endpoint...")
        response = sagemaker_client.create_endpoint(
                EndpointName='sentio-user-endpoint',
                EndpointConfigName='sentio-config'
            )
        logger.info("✅ Endpoint created.")

logger.info("✅ Endpoint done")

# ---------------------------------------
#  ** Chat Endpoints - Test/Send
# ---------------------------------------
@chat_bp.route("/chat-message/<chat_id>", methods=["POST"])
@jwt_required()
async def personalized_chat(chat_id):
    """Chat endpoint that uses the user's personalized model"""
    try:
        print("message sending" ,chat_id)
        # Validate incoming data
        data = request.json
        if not data:
            return jsonify({"error": "Missing request data"}), 400
            
        # Extract user ID from JWT token
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "Invalid user identity"}), 401
            
        print(f"Personalized chat request - User: {user_id}")
        
        try:
            # Validate request data with your ChatRequest model
            chat_request = ChatRequest(**data)
        except Exception as validation_error:
            return jsonify({"error": f"Invalid request format: {str(validation_error)}"}), 400

        # Generate conversation ID if new conversation
        if (chat_id == None) : 
            chat_id = data.get("chat_id", f"conv_{user_id}_{int(time.time())}")
        
        # Get user info from database
        try:
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if not user:
                return jsonify({"error": "User not found"}), 404
        except Exception as db_error:
            logger.error(f"Database error when fetching user: {db_error}")
            return jsonify({"error": "Error accessing user data"}), 500

        # Check for user's model in S3
        user_model_path = f"models/{user_id}/model.pt"
        model_exists = False
        
        try:
            # Check if user model exists in S3
            s3_client.head_object(Bucket=S3_BUCKET, Key=user_model_path)
            model_exists = True
            logger.info(f"Model already exists for user {user_id} in S3.")
        except Exception as s3_error:
            logger.info(f"Model not found in S3 for user {user_id}: {s3_error}")
            
        # Create user model if it doesn't exist
        if not model_exists:
            try:
                logger.info(f"Creating new model for user: {user_id}")
                await create_user_model(user_id)
            except Exception as model_create_error:
                logger.error(f"Failed to create user model: {model_create_error}")
                return jsonify({"error": "Could not create personalized model"}), 500

        # Invoke the user's model
        try:
            response_text, inference_time, chat = await invoke_user_model(
                user_id=user_id,
                message=chat_request.message,
                context={
                    "chat_id": chat_id,
                    **(chat_request.context or {})
                }
            )
            print("Inference take time : " , inference_time); 
            print(f"chat retunred by invoke model : {chat}")
            
        except Exception as inference_error:
            # Error for the response
            # response_text = "Sorry, Something went wrong." 
            # Chat = "NAN"
            print("personalized chat - invoke return ")
            logger.error(f"Model inference error: {inference_error} chat retunred by invoke model : {chat}")
            #return jsonify({"error": "Failed to process with personalized model"}), 500

        # Log the conversation
        try:
            await log_conversation(
                user_id=user_id,
                chat_id=chat_id,
                message=chat_request.message,
                response=response_text
            )
        except Exception as log_error:
            # Non-critical error, just log it
            logger.warning(f"Failed to log conversation: {log_error}")

        # Default model version
        model_version = 1.0
        model_updated = False
        
        # Update model if requested
        if chat_request.update_model:
            try:
                chat_data = {
                    "user_message": chat_request.message,
                    "model_response": response_text,
                    "context": chat_request.context or {},
                    "timestamp": time.time()
                }
                
                update_success, new_version = update_user_model(user_id, chat_data)
                if update_success:
                    model_version = new_version
                    model_updated = True
                else:
                    logger.warning(f"Model update returned without success for user: {user_id}")
            except Exception as update_error:
                # Non-critical error, just log it
                logger.warning(f"Failed to update model: {update_error}")

        # Prepare and return response
        response = ChatResponse(
            response=response_text,
            chat_id=chat_id,
            model_version=str(model_version),
            model_updated=model_updated,
            inference_time=inference_time
        )
        
        return jsonify(response.model_dump())
        
    except Exception as e:
        logger.error(f"Unhandled error in personalized chat: {str(e)}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred"}), 500


async def invoke_user_model(user_id: str, message: str, context: Dict = None, mode: str = "ec2"):
    """Invoke the user's personalized model from S3."""
    """ 
    # Example API USAGE 
    url = "http://13.61.141.224:8080/predict"
    payload = {
        "user_id": "test_user",
        "message": "I'm feeling really happy today because I accomplished something I've been working on for weeks!"
    }
    response = requests.post(url, json=payload)
    print(response.status_code)
    print(json.dumps(response.json(), indent=2))
    """
    """ 
    Expected retunrn form AWS Server
        return jsonify({
            "user_id": user_id,
            "input_text": message,
            "message": message,
            "emotion_probabilities": emotions,
            "top_emotions": emotions[:3], # or any top-N you prefer
            "chat_response": chat_reply,
            "chat_output": chat_output
        })
    """
    """Invoke the user's personalized model from S3, with chat_id/context support."""

    context = context or {}  # Ensure context is not None
    logger.info(f"Starting model invocation for user {user_id}")
    
    try:
        # Verify user model exists or copy from base
        user_model_path = f"models/{user_id}/model.pt"
        logger.info(f"Checking for user model at {user_model_path}")
        
        try:
            # Check if user model exists in S3
            exists = await check_s3_object_exists(S3_BUCKET, user_model_path)
            logger.info(f"User model exists: {exists}")
            
            if not exists:
                logger.info(f"Copying base model to user path {user_model_path}")
                await copy_s3_object(S3_BUCKET, "models/model.pt", S3_BUCKET, user_model_path)
                logger.info("Base model copied successfully")
        except Exception as e:
            logger.error(f"Error managing model file: {str(e)}", exc_info=True)
            return f"Error preparing your personalized model. Please try again later.", 0.0
        
        # Mode will be CLOUD based model - Server
        if(mode=="ec2") :
            
            try:
                import aiohttp
                prompt = await process_chat_for_inference(user_id, message, context)
                # payload = {"user_id": user_id, "message": prompt}
                # Update the paylod for multiple chat_id 
                payload = {
                    "user_id": user_id,
                    "message": prompt, # 
                    "chat_id": context.get("chat_id", "1")
                }
                print("payload is sent : " , payload)
                ec2_url = f"http://{E2C_IP}:8080/analyze"  # Send to cloud like this

                # ec2_url = f"http://{E2C_IP}:8080/predict"  # Send to cloud like this
                logger.info(f"Connecting to E2C Distance Servre: {E2C_IP} to {ec2_url}\nSending payload :{payload}")

                async with aiohttp.ClientSession() as session:
                    async with session.post(ec2_url, json=payload) as resp:
                        if resp.status == 200:
                            result = await resp.json()
                            emotions = ", ".join(result.get("predicted_emotions", []))
                            chat = result.get("chat_response", "NAN")

                        else:
                            raise Exception(f"EC2 returned status {resp.status}")
                        
                logger.info(f"Results from E2C Distance Servre: {E2C_IP} by {ec2_url} equals to\n result :{result}\n emotions {emotions}")
                print(f"Model returned the result\n {result}\nwhere:\n-emotions : {emotions}\n-chat: {chat}\n ")
                await analyze_and_log_sentiment(user_id, message, emotions)
                return emotions, resp.status , chat
            except Exception as ec2_error:
                logger.error(f"EC2 inference error: {ec2_error}")
                raise HTTPException(status_code=500, detail=f"EC2 inference failed: {str(ec2_error)}")

        # Mode will be CLOUD based model - Sagamaker
        elif(mode=="sagamaker") :
            # Step 2: Process with SageMaker or locally
            if SAGEMAKER_ENDPOINT and SAGEMAKER_ENDPOINT.strip():
                logger.info(f"Using SageMaker endpoint: {SAGEMAKER_ENDPOINT}")
                
                # Basic payload - only include what your endpoint expects
                payload = {
                    "user_id": user_id,
                    "message": message,
                    "chat_id": context.get("chat_id", "default")
                }

                logger.info(f"Prepared payload: {payload}")
                start_time = time.time()
                
                try:
                    if not hasattr(invoke_user_model, 'sagemaker_runtime'):
                        logger.info("Initializing SageMaker runtime client")
                        sagemaker_runtime = boto3.client('sagemaker-runtime')
                    
                    logger.info(f"Sending request to SageMaker endpoint")
                    response = sagemaker_runtime.invoke_endpoint(
                        EndpointName=SAGEMAKER_ENDPOINT,
                        ContentType='application/json',
                        Body=json.dumps(payload)
                    )
                    
                    logger.info(f"SageMaker raw response: {response}")
                    
                    # Process the response body
                    if 'Body' in response:
                        try:
                            # Read and decode the response body
                            response_content = response['Body'].read()
                            logger.info(f"Response content: {response_content}")
                            
                            response_text = response_content.decode('utf-8')
                            logger.info(f"Decoded response: {response_text}")
                            
                            # Try to parse as JSON
                            try:
                                response_json = json.loads(response_text)
                                logger.info(f"Parsed JSON response: {response_json}")
                                
                                # Extract the most relevant information based on response structure
                                if isinstance(response_json, dict):
                                    if "predicted_emotions" in response_json:
                                        result = f"Detected emotions: {', '.join(response_json['predicted_emotions'])}"
                                    elif "input_text" in response_json and "top_emotions" in response_json:
                                        emotions = [f"{e[0]} ({e[1]:.2f})" for e in response_json["top_emotions"]]
                                        result = f"For '{response_json['input_text']}', I detected: {', '.join(emotions)}"
                                    else:
                                        # Use any field that seems like output
                                        for key in ["output", "response", "result", "prediction", "text"]:
                                            if key in response_json:
                                                result = response_json[key]
                                                break
                                        else:
                                            # If no recognized field, return the whole JSON
                                            result = str(response_json)
                                else:
                                    result = str(response_json)
                            except json.JSONDecodeError:
                                logger.warning("Response is not valid JSON, using text response")
                                result = response_text
                        except Exception as decode_error:
                            logger.error(f"Error decoding response: {str(decode_error)}", exc_info=True)
                            result = "Error processing model response"
                    else:
                        logger.error("No 'Body' in SageMaker response")
                        result = "Invalid response from the model service"
                    
                    inference_time = time.time() - start_time
                    logger.info(f"Inference completed in {inference_time:.2f}s with result: {result}")
                    return result, inference_time
                    
                except Exception as sagemaker_error:
                    logger.error(f"SageMaker invocation error: {str(sagemaker_error)}", exc_info=True)
                    return f"Error processing your request. Technical details: {str(sagemaker_error)}", 0.0
            
            # Mode will be LOCAL based model 
            else:
                logger.info("Using local inference")
                local_model_path = f"/tmp/{user_id}_model.pt"
                
                try:
                    # Ensure temp directory exists
                    os.makedirs(os.path.dirname(local_model_path), exist_ok=True)
                    
                    # Download the model
                    logger.info(f"Downloading model from {user_model_path} to {local_model_path}")
                    download_model_from_s3(user_model_path, local_model_path)
                    
                    # Load the model
                    logger.info("Loading model into memory")
                    model = BertForSequenceClassification.from_pretrained(
                        "bert-base-uncased", 
                        num_labels=28
                    )
                    model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
                    model.eval()
                    
                    # Generate prediction
                    logger.info("Running inference")
                    start_time = time.time()
                    output = predict_emotions(message)
                    inference_time = time.time() - start_time
                    
                    logger.info(f"Local inference result: {output}")
                    try: 
                        logger.info(f"Local inference CHCEK with Pipieline:")
                        emotions, resp = invoke_local_inference(user_id, message, context)
                        logger.info(f"Local inference result with Pipieline: {emotions} , {resp}")
                    except Exception as local_error:
                        logger.error(f"Local inference error with Pipieline: {str(local_error)}", exc_info=True)

                    return output, inference_time
                    
                except Exception as local_error:
                    logger.error(f"Local inference error: {str(local_error)}", exc_info=True)
                    return f"Error processing your request locally. Technical details: {str(local_error)}", 0.0
    
    except Exception as e:
        logger.error(f"Unexpected error in invoke_user_model: {str(e)}", exc_info=True)
        print("invoke model error ...")
        return "I'm sorry, an unexpected error occurred while processing your request.", 0.0 , "NAN"

# ---------------------------------------
#  ** Chat APIs 
# ---------------------------------------
# Fetch chat history
async def get_chat_history(user_id: str, limit: int = 5):
    try:
        history = chat_collection.find({"user_id": user_id}).sort("timestamp", -1).limit(limit).to_list(length=limit)
        return history[::-1]  # reverse to chronological order
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        return []

# ----------------------------- Dekete/Clear Api ---------------------------------------------------------

# Delete chat != clear history, delete chat delete entire chat, 
# delete history just delete messages, not chat

@chat_bp.route("/delete-chat-all" ,methods=["DELETE"])
@jwt_required()
async def delete_chat_all():
    user_id = get_jwt_identity() 
    await chat_collection.delete_many({"user_id": user_id}) # delete the ALL of the chat
    return {"message": f"All Chat history cleared for user {user_id}"}


@chat_bp.route("/clear-history-all" ,methods=["DELETE"])
@jwt_required()
async def clear_chat_all():
    user_id = get_jwt_identity() 
    await chat_collection.delete_many({"user_id": user_id}) # delete the ALL of the chat
    return {"message": f"All Chat history cleared for user {user_id}"}

# -----------------------------------------------------------------------------------------
# Delete chat != clear history, delete chat delete entire chat, 
# delete history just delete messages, not chat

@chat_bp.route("/clear-history/<chat_id>", methods=["DELETE"])
@jwt_required()
def clear_chat(chat_id):
    print("clear history chat_id :" , chat_id)
    try: 
        chat_collection.update_one(
            {"_id": chat_id}, {"$set": {"messages": []}}
        )
        return jsonify({"message": "Chat cleared."})
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        return jsonify({"message": "Chat error not cleared."})


@chat_bp.route("/delete-chat/<chat_id>", methods=["DELETE"])
@jwt_required()
def delete_chat(chat_id):
    print("delete history chat_id :" , chat_id)
    try: 
        chat_collection.delete_one(
            {"_id": chat_id}
        )
        return jsonify({"message": "Chat cleared."})
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        return jsonify({"message": "Chat error not cleared."})
    
# -----------------------------------------------------------------------------------------

@chat_bp.route("/list", methods=["GET"])
@jwt_required()
def list_chats():
    user_id = get_jwt_identity() 
    print("chat Listed for : ", user_id)
    chats = chat_collection.find({"user_id": user_id})
    #  get() method to  default value
    result = []
    for chat in chats:
        #  "Untitled Chat" if no title 
        title = chat.get("title", "Untitled Chat")
        result.append({"chat_id": chat["_id"], "title": title})
    return jsonify(result)

@chat_bp.route("/get-history/<chat_id>", methods=["GET"])
@jwt_required()
def get_chat(chat_id):
    print("get_chat history chat_id :" , chat_id)
    chat = chat_collection.find_one({"_id": chat_id})
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"message": chat["messages"]})


@chat_bp.route("/get-history", methods=["GET"])
@jwt_required()
def get_chat_all():
    user_id = get_jwt_identity() 
    print("chat history for user: ", user_id)
    chats = chat_collection.find({"user_id": user_id})
    if not chats:
        return jsonify({"error": "Chat not found"}), 404
    result = []
    for c in chats:
        result.append(c)
    return jsonify(result)

@chat_bp.route("/export/<chat_id>",  methods=["GET"])
@jwt_required()
def export_chat(chat_id):
    print("export history chat_id :" , chat_id)
    chat = chat_collection.find_one({"_id": chat_id})
    return jsonify(chat)

@chat_bp.route("/import",  methods=["POST"])
@jwt_required()
def import_chat():
    data = request.json
    data["_id"] = ObjectId()
    chat_collection.insert_one(data)
    return jsonify({"chat_id": data["_id"]})

@chat_bp.route("/new", methods=["GET"])
@jwt_required()
def create_chat():
    print("chat created : ")

    chat_id = ObjectId()
    user_id = get_jwt_identity() 
    print("chat created : ", chat_id)

    chat_collection.insert_one({
        "_id": str(chat_id),
        "title": "Untitled Chat",
        "user_id": user_id,
        "messages": [
            {"sender": "bot", "text": "Hi there! How can I help you today?"}
        ],
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    })
    
    return jsonify({"chat_id": str(chat_id)})


@chat_bp.route("/<chat_id>/send", methods=["POST"] )
@jwt_required()
def send_message(chat_id : str):
    data = request.json
    message = data.get("message")
    
    # Run inference here
    response = personalized_chat(chat_id)

    chat_collection.update_one(
        {"_id": chat_id},
        {"$push": {
            "messages": {"sender": "user", "text": message},
        }}
    )
    chat_collection.update_one(
        {"_id": chat_id},
        {"$push": {
            "messages": {"sender": "bot", "text": response},
        }}
    )
    return jsonify({"response": response})

# Rename the chat 
@chat_bp.route("/rename-chat/<chat_id>", methods=["POST"])
@jwt_required()
def rename_chat(chat_id):
    print("rename_chat chat_id:", chat_id)
    data = request.json
    name = data["name"]

    chat = chat_collection.find_one({"_id": chat_id})
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    
    # Correct the update
    chat_collection.update_one(
        {"_id": chat_id},
        {"$set": {
            "title": name
        }}
    )

    # Return the updated title
    return jsonify({"title": name})


# Rename the chat 
@chat_bp.route("/save-chat/<chat_id>",  methods=["GET"])
@jwt_required()
def save_chat(chat_id):
    print("save_chat chat_id :" , chat_id)
    chat = chat_collection.find_one({"_id": chat_id})
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    
    return jsonify({"message": chat["messages"]})


# ------------------------------------------------------------------------ Helper Functions ------------------------------------------------------------------------

# ---------------------------------------
#  ** S3 Getters / Setters 
# ---------------------------------------
def get_user_model_path(user_id: str) -> str:
    """Get the path to the user's model, or initialize if needed"""
    user_model_key = f"models/{user_id}/model.pt"
    
    try:
        # Check if user model exists in S3
        s3_client.head_object(Bucket=S3_BUCKET, Key=user_model_key)
        return user_model_key
    except Exception:
        # Initialize new user model
        s3_client.copy_object(
            Bucket=S3_BUCKET,
            CopySource=f"{S3_BUCKET}/{BASE_MODEL_PATH}",
            Key=user_model_key
        )
        print("pot bef")
        # Create model metadata
        model_collection.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "model_path": user_model_key,
                    "version": "1.0",
                    "created_at": datetime.now(),
                    "last_updated": datetime.now()
                }
            },
            upsert=True
        )
        print("pot af")

        return user_model_key

# ---------------------------------------
#  ** S3 model download - upload - check HEAD
# ---------------------------------------
async def download_model_from_s3(model_path: str, local_path: str):
    """Download model from S3 to local file system"""
    try:
        s3_client.download_file(S3_BUCKET, model_path, local_path)
        model = torch.load(local_path, map_location=torch.device('cpu'))
        logger.info(f"Downloaded model from s3://{S3_BUCKET}/{model_path} to {local_path}")
        return model
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error during download of model from S3: {str(e)}")

async def upload_model_to_s3(local_path: str, model_path: str):
    """Upload model from local path to S3"""
    try:
        s3_client.upload_file(local_path, S3_BUCKET, model_path)
        logger.info(f"Uploaded model to s3://{S3_BUCKET}/{model_path}")
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error during upload of model to S3: {str(e)}")

async def check_s3_object_exists(bucket: str, key: str) -> bool:
    """Check if an object exists in S3."""
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == "404":
            return False
        else:
            raise

async def copy_s3_object(src_bucket: str, src_key: str, dest_bucket: str, dest_key: str):
    """Copy an object within S3."""
    s3_client.copy_object(
        Bucket=dest_bucket,
        CopySource={'Bucket': src_bucket, 'Key': src_key},
        Key=dest_key
    )

async def create_user_model(user_id):
    """Create model for specif user -same for register- S3"""
    user_model_path = f"models/{user_id}/model.pt"
    try:
        s3_client.copy_object(
            Bucket=S3_BUCKET,
            CopySource=f"{S3_BUCKET}/{BASE_MODEL_PATH}",
            Key=user_model_path
        )
        print(f"User model initialized at {S3_BUCKET}/{user_model_path}")
        return user_model_path
    except Exception as e:
        print(f"Error copying base model: {e}")

# ---------------------------------------
#  ** Predict emotions function - same with ML
# ---------------------------------------
async def predict_emotions(text, threshold=0.3):
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().numpy()

    predictions = probabilities > threshold

    predicted_emotions = [emotion_labels[i] for i in range(len(predictions)) if predictions[i]]

    emotion_probabilities = {emotion_labels[i]: float(probabilities[i]) for i in range(len(probabilities))}

    response = {
        "input_text": text,
        "predicted_emotions": predicted_emotions,
        "emotion_probabilities": emotion_probabilities,
        "top_emotions": sorted(emotion_probabilities.items(), key=lambda x: x[1], reverse=True)[:5]
    }

    return json.dumps(response, indent=4)  # Standardized JSON output

# ------------------------------------------------------------------------ Helper Functions ------------------------------------------------------------------------
    
def update_user_model(user_id: str, chat_data: Dict):
    """Update the user's model based on chat interaction (stored in S3)."""
    try:
        # Define model paths
        base_model_path = f"models/base_model.pt"
        user_model_path = f"models/{user_id}/model.pt"
        
        # Check if user model exists, else copy base model
        if not check_s3_object_exists(S3_BUCKET, user_model_path):
            copy_s3_object(S3_BUCKET, base_model_path, S3_BUCKET, user_model_path)

        # Download current model from S3
        local_model_path = f"/tmp/{user_id}_model.pt"
        # download_model_from_s3(user_model_path, local_model_path)

        # Load model
        model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
        model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
        # model.to(DEVICE)
        model.train()

        # Prepare training data
        user_message = chat_data["user_message"]
        model_response = chat_data["model_response"]

        optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)

        inputs = tokenizer(user_message, return_tensors="pt").to(DEVICE)
        labels = tokenizer(model_response, return_tensors="pt").input_ids.to(DEVICE)

        # Training step
        outputs = model(**inputs, labels=labels)
        loss = outputs.loss
        loss.backward()
        optimizer.step()

        # Save updated model
        torch.save(model.state_dict(), local_model_path)

        # Upload updated model to S3
        upload_model_to_s3(local_model_path, user_model_path)

        logger.info(f"Updated model for user {user_id}")

        return user_model_path, "latest"
    except Exception as e:
        logger.error(f"Error updating user model: {e}")
        raise

# ---------------------------------------
#  ** Contious Training functions for ML
# ---------------------------------------
async def upload_user_training_data(user_id: str, inputs: List[str], labels: List[List[int]]):
    """
    Save user-generated data like journal/check-in/photo into S3 for future training.
    """
    try:
        timestamp = int(time.time())
        records = [{"input": text, "labels": labs} for text, labs in zip(inputs, labels)]
        payload = json.dumps(records, indent=2)
        file_key = f"training-data/{user_id}/raw_data_{timestamp}.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=payload,
            ContentType="application/json"
        )
        logger.info(f"✅ Uploaded user training data for {user_id} -> {file_key}")
    except Exception as e:
        logger.error(f"❌ Failed to upload training data: {e}")
        raise

async def trigger_user_model_retrain(user_id: str):
    """
    Call your EC2 trainer server to start retraining that user's model.
    """
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            retrain_url = "http://<your-ec2-ip>:8081/retrain"
            payload = {"user_id": user_id}
            async with session.post(retrain_url, json=payload) as resp:
                if resp.status == 200:
                    logger.info(f"✅ Retraining triggered for {user_id}")
                else:
                    logger.warning(f"⚠️ Retrain call failed with status {resp.status}")
    except Exception as e:
        logger.error(f"❌ Failed to trigger retraining for {user_id}: {e}")


async def log_conversation(user_id: str, chat_id: str, message: str, response: str):
    """Logs a conversation into memory and MongoDB properly"""
    timestamp = datetime.now()

    # In-memory logging
    if chat_id not in conversations:
        conversations[chat_id] = []

    conversations[chat_id].append({
        "timestamp": timestamp,
        "user_id": user_id,
        "message": message,
        "response": response
    })

    print("added to conversations")

    # MongoDB update
    chat_collection.update_one(
        {"_id": str(chat_id)},
        {
            "$push": {
                "messages": {
                    "$each": [
                        {
                            "sender": "user",
                            "text": message,
                            "timestamp": timestamp
                        },
                        {
                            "sender": "bot",
                            "text": response,
                            "timestamp": timestamp
                        }
                    ]
                }
            },
            "$set": {
                "updated_at": timestamp
            }
        }
    )

    print("updated chat_collection with new messages")


# 1. Inference Prompt Generator
async def process_chat_for_inference(user_id, message, context=None, history_limit=5):
    try:
        history = await get_chat_history(user_id, limit=history_limit)
        context_part = f"Context: {json.dumps(context)}\n" if context else ""
        
        # Add more robust history processing with defensive checks
        history_parts = []
        if history:
            for h in history:
                if isinstance(h, dict) and 'message' in h and 'response' in h:
                    history_parts.append(f"User: {h['message']}\nAssistant: {h['response']}")
                else:
                    # Log malformed history item for debugging
                    logger.warning(f"Skipping malformed history item for user {user_id}: {h}")
        
        history_part = "\n".join(history_parts)
        return f"{context_part}{history_part}\nUser: {message}\nAssistant:"
    except Exception as e:
        logger.error(f"Error processing chat: {e}", exc_info=True)
        raise


# 2. Local Inference Engine
async def invoke_local_inference(user_id, message, context=None, ec2_mode=True):
    try:
        start = time.time()
        prompt = await process_chat_for_inference(user_id, message, context)
        model_path = f"models/{user_id}/model.pt"
        local_model = f"/tmp/{user_id}_model.pt"
        await download_model_from_s3(model_path, local_model)

        model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
        model.load_state_dict(torch.load(local_model, map_location=DEVICE))
        model.to(DEVICE)
        model.eval()
        
        # Generate prediction
        inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=512).to(DEVICE)
        with torch.no_grad():
            output = model(**inputs).logits
        probabilities = torch.sigmoid(output).squeeze().tolist()
        emotions = [i for i, p in enumerate(probabilities) if p > 0.3]

        result = f"Predicted labels: {emotions}"
        duration = time.time() - start
        await analyze_and_log_sentiment(user_id, message, result)
        return result, duration
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


# 3. Sentiment Logging
async def analyze_and_log_sentiment(user_id, message, response):
    try:
        analyzer = pipeline("sentiment-analysis")
        user_sentiment = analyzer(message)[0]
        bot_sentiment = analyzer(response)[0]
        log = {
            "user_id": user_id,
            "timestamp": datetime.now(),
            "user_message": message,
            "bot_response": response,
            "user_sentiment": user_sentiment,
            "bot_sentiment": bot_sentiment
        }
        sentiments_collection.insert_one(log)
        if user_sentiment["label"] == "NEGATIVE" and user_sentiment["score"] > 0.8:
            await flag_conversation_for_review(user_id, message, response, user_sentiment["score"])
        return True
    except Exception as e:
        logger.error(f"Sentiment logging failed: {e}")
        return False

# 4. Flagged Conversations
async def flag_conversation_for_review(user_id, message, response, score):
    try:
        await activities_collection.insert_one({
            "user_id": user_id,
            "timestamp": datetime.now(),
            "user_message": message,
            "bot_response": response,
            "sentiment_score": score,
            "reviewed": False,
            "priority": "high" if score > 0.9 else "medium"
        })
        logger.warning(f"Flagged conversation for review: {user_id} ({score})")
    except Exception as e:
        logger.error(f"Failed to flag review: {e}")

# 5. Model Evaluation Metrics
async def evaluate_model_performance(user_id):
    try:
        recent = await chat_collection.find({"user_id": user_id}).sort("timestamp", -1).limit(100).to_list(100)
        feedbacks = [c for c in recent if c.get("user_feedback") is not None]
        if not feedbacks:
            return {"status": "insufficient_data"}
        pos = sum(1 for f in feedbacks if f["user_feedback"] > 3)
        avg = sum(f["user_feedback"] for f in feedbacks) / len(feedbacks)
        metrics = {
            "total": len(recent),
            "with_feedback": len(feedbacks),
            "positive_rate": pos / len(feedbacks),
            "avg_score": avg
        }
        await users_collection.update_one({"_id": user_id}, {"$set": {"model_performance_metrics": metrics}})
        return {"status": "success", "metrics": metrics}
    except Exception as e:
        logger.error(f"Eval error: {e}")
        return {"status": "error", "message": str(e)}

# 6. Training Data Export
async def prepare_training_data(user_id):
    try:
        good = await chat_collection.find({"user_id": user_id, "user_feedback": {"$gt": 3}}).to_list(1000)
        if not good:
            return {"status": "insufficient_data"}
        dataset = [{"input": c["message"], "output": c["response"], "meta": c.get("timestamp") or ""} for c in good]
        file_key = f"training-data/{user_id}/train_{int(time.time())}.json"
        upload_model_to_s3(S3_BUCKET, file_key, json.dumps(dataset))
        return {"status": "success", "file": file_key, "count": len(dataset)}
    except Exception as e:
        logger.error(f"Data prep error: {e}")
        return {"status": "error", "message": str(e)}
    

# ---------------------------------------
#  ** Extra Data Collection from other utilities 
# ---------------------------------------

# Endpoint Example: Accept journal entries
@model_bp.post("/data/journal")
async def journal_entry(data: dict):
    user_id, text, labels = data.get("user_id"), data.get("text"), data.get("labels", [])
    if not user_id or not text:
        raise HTTPException(400, "Missing user_id or text")
    await upload_user_training_data(user_id, [text], [labels])
    await trigger_user_model_retrain(user_id)
    return {"message": "Journal entry received."}

# Endpoint Example: Accept check-ins
@model_bp.post("/data/checkin")
async def check_in(data: dict):
    user_id, mood, note = data.get("user_id"), data.get("mood"), data.get("note", "")
    entry = f"Mood: {mood}. Note: {note}"
    await upload_user_training_data(user_id, [entry], [[27]])  # Neutral label
    await trigger_user_model_retrain(user_id)
    return {"message": "Check-in received."}

# Endpoint Example: Accept photo context (metadata only)
@model_bp.post("/data/photo")
async def photo_metadata(data: dict):
    user_id = data.get("user_id")
    caption = data.get("caption", "")
    labels = data.get("labels", [])
    if not user_id or not caption:
        raise HTTPException(400, "Missing caption")
    await upload_user_training_data(user_id, [caption], [labels])
    await trigger_user_model_retrain(user_id)
    return {"message": "Photo metadata stored."}

# Endpoint: Inference using global model
@model_bp.post("/infer/global")
async def infer_global(data: dict):
    message = data.get("message")
    if not message:
        raise HTTPException(400, "Message required")

    global_model_path = "/tmp/global_model.pt"
    await download_model_from_s3("models/global_model.pt", global_model_path)

    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    model.load_state_dict(torch.load(global_model_path, map_location=DEVICE))
    model.eval()

    inputs = tokenizer(message, return_tensors="pt", truncation=True, padding=True, max_length=128)
    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.sigmoid(logits).squeeze().tolist()
    predictions = [i for i, p in enumerate(probs) if p > 0.3]
    return {"predicted_labels": predictions, "probabilities": probs}



