import os
import pymongo
import certifi
import torch
import boto3
import json
import logging
import time
import uuid
import jwt
from flask import Flask, request, jsonify, Blueprint
from ml.sentiment_model import load_model, predict_sentiment
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from flask_mail import Mail, Message
from bson.objectid import ObjectId
from bson import ObjectId

# User token 
from functools import wraps
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from botocore.exceptions import ClientError

# utils 
from models.chat import Chat, ChatRequest, ChatResponse, ModelTrainingRequest, ModelTrainingResponse  # Import the Chat model
from utils.database import db, chat_collection, users_collection, activities_collection, sentiments_collection
from utils.load_model import model, tokenizer
from utils.jwt_config import * 

# Device for PyTorch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Create chat blueprint
chat_bp = Blueprint("chat_bp", __name__)

# AWS Configuration
AWS_REGION = os.getenv("AWS_REGION", "eu-north-1")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "AKIAXGZAMH3HUVQSPNED")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "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")
S3_BUCKET = os.getenv("S3_BUCKET", "user-models-bucket")
SAGEMAKER_ENDPOINT = os.getenv("SAGEMAKER_ENDPOINT", "user-model-endpoint")
BASE_MODEL_PATH = os.getenv("BASE_MODEL_PATH", "base-models/base-model.pt")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt2")  # Default model architecture
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory conversation store (use DB in production)
conversations = {}

# Initialize AWS clients
try:
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
    
    # Lambda client
    lambda_client = boto3.client(
        'lambda',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    
    # Initialize tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    logger.info("✅ AWS and DB clients initialized successfully")
        
except Exception as e:
    logger.error(f"❌ Error initializing AWS clients: {e}")
    raise

# Helper function for authentication
def get_current_user(token):
    """Validate token and get current user"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        # Get user from MongoDB
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        return user
    except Exception as e:
        logger.error(f"Error validating token: {e}")
        return None

# Chat endpoints
@chat_bp.route("/test", methods=["POST"])
def chat_basic():
    """Basic chat endpoint for testing"""
    data = request.json
    message = data.get("message", "")

    print("HERE IN TEST CHAT ... ", data)
    try:
        # Encode input with attention mask and pad token
        inputs = tokenizer(message, return_tensors="pt", padding=True, truncation=True)
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}  # Move inputs to device

        with torch.no_grad():
            outputs = model.generate(
                inputs["input_ids"],
                attention_mask=inputs["attention_mask"],
                max_length=100,
                num_return_sequences=1,
                do_sample=True,
                temperature=0.7,
                pad_token_id=tokenizer.eos_token_id  # Fix warning
            )

        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return jsonify({"response": response})

    except Exception as e:
        logger.error(f"Error in basic chat: {e}")
        return jsonify({"error": str(e)}), 500
    
@chat_bp.route("/chat", methods=["POST"])
@jwt_required()
def personalized_chat():
    """Chat endpoint that uses the user's personalized model"""
    data = request.json
    chat_request = ChatRequest(**data)
    user_id = get_jwt_identity()
    
    try:
        # Generate conversation ID if new conversation
        conversation_id = data.get("conversation_id", f"conv_{user_id}_{int(time.time())}")
        
        # Get user info
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Get model version
        # model_info = db.user_models.find_one({"user_id": user_id})
        # model_version = model_info.get("version", "1.0") if model_info else "1.0"
        
        # Invoke user's model or create if doesn't exist
        response_text, inference_time = invoke_user_model(
            user_id=user_id,
            message=chat_request.message,
            context=chat_request.context
        )
        
        # Log conversation
        log_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
            message=chat_request.message,
            response=response_text
        )
        
        # Update model if requested
        model_updated = False
        if chat_request.update_model:
            chat_data = {
                "user_message": chat_request.message,
                "model_response": response_text,
                "context": chat_request.context or {},
                "timestamp": time.time()
            }
            
            _, new_version = update_user_model(user_id, chat_data)
            model_version = new_version
            model_updated = True
        
        # Prepare and return response
        response = ChatResponse(
            response=response_text,
            conversation_id=conversation_id,
            model_version=str(model_version),
            model_updated=model_updated,
            inference_time=inference_time
        )
        
        return jsonify(response.dict())
    except Exception as e:
        logger.error(f"Error in personalized chat: {e}")
        return jsonify({"error": str(e)}), 500

@chat_bp.route("/model/status", methods=["GET"])
@jwt_required()
def get_model_status_endpoint():
    """Get information about the user's personalized model"""
    user_id = get_jwt_identity()
    
    try:
        # Get model metadata
        model_info = db.user_models.find_one({"user_id": user_id})
        
        if not model_info:
            return jsonify({
                "has_custom_model": False,
                "using_base_model": True,
                "base_model": MODEL_NAME
            })
        
        # Get interaction counts
        interaction_count = chat_collection.count_documents({"user_id": user_id})
        
        status = {
            "has_custom_model": True,
            "model_version": model_info.get("version", "1.0"),
            "last_updated": model_info.get("last_updated", datetime.utcnow()),
            "update_count": model_info.get("update_count", 0),
            "interaction_count": interaction_count,
            "base_model": MODEL_NAME
        }
        
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting model status: {e}")
        return jsonify({"error": str(e)}), 500

@chat_bp.route("/model/reset", methods=["POST"])
@jwt_required()
def reset_user_model_endpoint():
    """Reset a user's model back to the base model"""
    user_id = get_jwt_identity()
    
    try:
        # Delete user model from S3
        user_model_key = f"user_models/{user_id}/model.pt"
        try:
            s3_client.delete_object(Bucket=S3_BUCKET, Key=user_model_key)
        except Exception:
            pass  # Model might not exist yet
        
        # Delete model metadata from MongoDB
        db.user_models.delete_one({"user_id": user_id})
        
        return jsonify({
            "success": True,
            "message": "User model has been reset to base model"
        })
    except Exception as e:
        logger.error(f"Error resetting model: {e}")
        return jsonify({"error": str(e)}), 500

@chat_bp.route("/model/force-update", methods=["POST"])
@jwt_required()
def force_model_update_endpoint():
    """Force an update of the user's model based on all chat history"""
    user_id = get_jwt_identity()
    
    try:
        # Get all chat history
        history = list(chat_collection.find({"user_id": user_id}).sort("timestamp", 1).limit(1000))
        
        if not history:
            return jsonify({"error": "No chat history found for model training"}), 400
        
        # Load base model as starting point
        local_model_path = f"/tmp/{user_id}_model.pt"
        download_model_from_s3(BASE_MODEL_PATH, local_model_path)
        
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
        model.train()
        
        # Simple training loop
        optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
        
        for interaction in history:
            # Prepare data
            inputs = tokenizer(interaction["message"], return_tensors="pt").to(DEVICE)
            labels = tokenizer(interaction["response"], return_tensors="pt").input_ids.to(DEVICE)
            
            # Forward pass
            outputs = model(**inputs, labels=labels)
            loss = outputs.loss
            
            # Backward pass and optimization
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
        
        # Save the updated model
        torch.save(model.state_dict(), local_model_path)
        
        # Upload to S3
        user_model_key = f"user_models/{user_id}/model.pt"
        upload_model_to_s3(local_model_path, user_model_key)
        
        # Update metadata
        current_version = 1.0
        model_info = db.user_models.find_one({"user_id": user_id})
        if model_info and "version" in model_info:
            current_version = float(model_info["version"])
        
        new_version = current_version + 1.0
        
        db.user_models.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "last_updated": datetime.utcnow(),
                    "training_samples": len(history),
                    "full_retrain": True,
                    "version": str(new_version)
                }
            },
            upsert=True
        )
        
        return jsonify({
            "success": True,
            "message": f"Model fully updated with {len(history)} interactions",
            "new_version": str(new_version)
        })
    except Exception as e:
        logger.error(f"Error forcing model update: {e}")
        return jsonify({"error": str(e)}), 500

@chat_bp.route("/train", methods=["POST"])
@jwt_required()
def train_model_endpoint():
    """Endpoint to trigger specific training for a user's model"""
    data = request.json
    training_request = ModelTrainingRequest(**data)
    user_id = get_jwt_identity()
    
    try:
        # Get current model path or initialize if needed
        model_path = get_user_model_path(user_id)
        
        # Prepare SageMaker training job
        job_name = f"train-user-model-{user_id}-{int(time.time())}"
        
        # Save the training data to S3
        training_data_key = f"training-data/{user_id}/training_data_{int(time.time())}.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=training_data_key,
            Body=json.dumps(training_request.training_data),
            ContentType="application/json"
        )
        
        # Configure and create SageMaker training job
        training_params = {
            "TrainingJobName": job_name,
            "AlgorithmSpecification": {
                "TrainingImage": "your-training-container-image",
                "TrainingInputMode": "File"
            },
            "RoleArn": "your-sagemaker-role-arn",
            "InputDataConfig": [
                {
                    "ChannelName": "training",
                    "DataSource": {
                        "S3DataSource": {
                            "S3DataType": "S3Prefix",
                            "S3Uri": f"s3://{S3_BUCKET}/training-data/{user_id}/",
                            "S3DataDistributionType": "FullyReplicated"
                        }
                    },
                    "ContentType": "application/json"
                },
                {
                    "ChannelName": "model",
                    "DataSource": {
                        "S3DataSource": {
                            "S3DataType": "S3Prefix",
                            "S3Uri": f"s3://{S3_BUCKET}/{model_path}",
                            "S3DataDistributionType": "FullyReplicated"
                        }
                    }
                }
            ],
            "OutputDataConfig": {
                "S3OutputPath": f"s3://{S3_BUCKET}/training-output/{user_id}/"
            },
            "ResourceConfig": {
                "InstanceType": "ml.c5.xlarge",
                "InstanceCount": 1,
                "VolumeSizeInGB": 10
            },
            "StoppingCondition": {
                "MaxRuntimeInSeconds": 3600
            },
            "HyperParameters": training_request.hyperparameters or {}
        }
        
        response = sagemaker_client.create_training_job(**training_params)
        
        # Update training job info in database
        training_job = {
            "job_id": job_name,
            "status": "InProgress",
            "started_at": datetime.now().isoformat()
        }
        
        db.user_models.update_one(
            {"user_id": user_id},
            {"$push": {"training_jobs": training_job}},
            upsert=True
        )
        
        response = ModelTrainingResponse(
            job_id=job_name,
            status="InProgress",
            estimated_completion_time=(datetime.now() + timedelta(hours=1)).isoformat()
        )
        
        return jsonify(response.dict())
    except Exception as e:
        logger.error(f"Error starting training job: {e}")
        return jsonify({"error": str(e)}), 500

@chat_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        # Check AWS services
        s3_client.list_buckets()
        
        # Check MongoDB connection
        db.command("ping")
        
        return jsonify({
            "status": "healthy", 
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            "status": "unhealthy", 
            "error": str(e)
        }), 500

# Helper Functions
def get_user_model_path(user_id: str) -> str:
    """Get the path to the user's model, or initialize if needed"""
    user_model_key = f"user_models/{user_id}/model.pt"
    
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
        
        # Create model metadata
        db.user_models.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "model_path": user_model_key,
                    "version": "1.0",
                    "created_at": datetime.now().isoformat(),
                    "last_updated": datetime.now().isoformat()
                }
            },
            upsert=True
        )
        
        return user_model_key

def download_model_from_s3(model_path: str, local_path: str):
    """Download model from S3 to local file system"""
    try:
        s3_client.download_file(S3_BUCKET, model_path, local_path)
        logger.info(f"Downloaded model from s3://{S3_BUCKET}/{model_path} to {local_path}")
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        raise

def upload_model_to_s3(local_path: str, model_path: str):
    """Upload model from local path to S3"""
    try:
        s3_client.upload_file(local_path, S3_BUCKET, model_path)
        logger.info(f"Uploaded model to s3://{S3_BUCKET}/{model_path}")
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise

def invoke_user_model(user_id: str, message: str, context: Dict = None):
    """Invoke the user's personalized model for inference"""
    try:
        # Get user model path
        model_path = get_user_model_path(user_id)
        
        # For production: Use SageMaker for inference
        if SAGEMAKER_ENDPOINT:
            # Prepare payload for inference
            payload = {
                "user_id": user_id,
                "model_path": model_path,
                "message": message,
                "context": context or {}
            }
            
            # Call SageMaker runtime for inference
            start_time = time.time()
            response = sagemaker_runtime.invoke_endpoint(
                EndpointName=SAGEMAKER_ENDPOINT,
                ContentType='application/json',
                Body=json.dumps(payload)
            )
            
            # Parse response
            result = json.loads(response['Body'].read().decode())
            inference_time = time.time() - start_time
            
            return result.get("response", ""), inference_time
        
        # For development: Local inference
        else:
            # Download and load model
            local_model_path = f"/tmp/{user_id}_model.pt"
            download_model_from_s3(model_path, local_model_path)
            
            model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
            model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
            model.to(DEVICE)
            model.eval()
            
            # Generate response
            start_time = time.time()
            inputs = tokenizer(message, return_tensors="pt").to(DEVICE)
            
            with torch.no_grad():
                outputs = model.generate(
                    inputs.input_ids,
                    max_length=150,
                    num_return_sequences=1,
                    do_sample=True,
                    temperature=0.7
                )
            
            # Decode the response
            response_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            # Extract just the newly generated text (not the input context)
            response_text = response_text[len(tokenizer.decode(inputs.input_ids[0], skip_special_tokens=True)):]
            
            inference_time = time.time() - start_time
            return response_text, inference_time
            
    except Exception as e:
        logger.error(f"Error invoking user model: {e}")
        return f"I'm sorry, I encountered an error: {str(e)}", 0.0

def update_user_model(user_id: str, chat_data: Dict):
    """Update the user's model based on chat interaction"""
    try:
        # Get current model path and version
        model_info = db.user_models.find_one({"user_id": user_id})
        
        if not model_info:
            # Initialize user model if it doesn't exist
            get_user_model_path(user_id)
            model_info = db.user_models.find_one({"user_id": user_id})
        
        current_model_path = model_info.get("model_path")
        current_version = float(model_info.get("version", "1.0"))
        new_version = current_version + 0.1  # Increment by 0.1 for minor updates
        new_model_path = f"user_models/{user_id}/model_v{new_version}.pt"
        
        # For production: Use Lambda for async model update
        if AWS_REGION:
            # Invoke Lambda function for model update
            payload = {
                "user_id": user_id,
                "current_model_path": current_model_path,
                "new_model_path": new_model_path,
                "chat_data": chat_data,
                "model_version": str(new_version),
                "s3_bucket": S3_BUCKET
            }
            
            lambda_client.invoke(
                FunctionName="update-user-model",
                InvocationType="Event",  # Asynchronous
                Payload=json.dumps(payload)
            )
        
        # For development: Update model directly
        else:
            # Download current model
            local_model_path = f"/tmp/{user_id}_model.pt"
            download_model_from_s3(current_model_path, local_model_path)
            
            # Load model and update
            model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
            model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
            model.train()
            
            # Prepare training data
            user_message = chat_data["user_message"]
            model_response = chat_data["model_response"]
            
            # Simple training step
            optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
            
            inputs = tokenizer(user_message, return_tensors="pt").to(DEVICE)
            labels = tokenizer(model_response, return_tensors="pt").input_ids.to(DEVICE)
            
            # Forward pass
            outputs = model(**inputs, labels=labels)
            loss = outputs.loss
            
            # Backward pass and optimization
            loss.backward()
            optimizer.step()
            
            # Save updated model
            torch.save(model.state_dict(), local_model_path)
            
            # Upload to S3
            upload_model_to_s3(local_model_path, new_model_path)
        
        # Update metadata in MongoDB
        db.user_models.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "model_path": new_model_path,
                    "version": str(new_version),
                    "last_updated": datetime.now().isoformat(),
                    "updating": True
                }
            },
            upsert=True
        )
        
        logger.info(f"Initiated model update for user {user_id} to version {new_version}")
        return new_model_path, str(new_version)
    except Exception as e:
        logger.error(f"Error updating user model: {e}")
        raise

def log_conversation(user_id: str, conversation_id: str, message: str, response: str):
    """Log conversation to memory and database"""
    # In-memory storage
    if conversation_id not in conversations:
        conversations[conversation_id] = []

    # Get the timestampt
    timestamp = datetime.now()
    
    # Add to in-memory store
    conversations[conversation_id].append({
        "timestamp": timestamp,
        "user_id": user_id,
        "message": message,
        "response": response
    })
    
    # Store in MongoDB
    chat_collection.insert_one({
        "conversation_id": conversation_id,
        "user_id": user_id,
        "message": message,
        "response": response,
        "timestamp": timestamp
    })
    
    # Update chat document
    chat = chat_collection.find_one({"conversation_id": conversation_id})
    if not chat:
        # Create new chat
        user_message = Message(role="user", content=message, timestamp=timestamp)
        user_message.save()
        
        assistant_message = Message(role="assistant", content=response, timestamp=timestamp)
        assistant_message.save()
        
        chat = Chat(
            user_id=user_id,
            conversation_id=conversation_id,
            messages=[user_message.id, assistant_message.id],
            started_at=timestamp,
            last_updated=timestamp
        )

        chat.save()
    else:
        # Update existing chat
        user_message = Message(role="user", content=message, timestamp=timestamp)
        user_message.save()

        assistant_message = Message(role="assistant", content=response, timestamp=timestamp)
        assistant_message.save()

        chat.user_id=user_id,
        chat.conversation_id=conversation_id,
        chat.messages=[user_message.id, assistant_message.id],
        chat.started_at=timestamp,
        chat.last_updated=timestamp

# AI Model Loading and Inference Methods

async def load_model(model_path, device="cuda"):
    """Load AI model from path"""
    try:
        # Load tokenizer and model
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        
        # If a specific model path is provided, load those weights
        if model_path:
            model.load_state_dict(torch.load(model_path, map_location=torch.device(device)))
        
        model.to(device)
        model.eval()  # Set to evaluation mode
        
        logger.info(f"Model loaded successfully from {model_path}")
        return model
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise

async def generate_response(model, tokenizer, prompt, max_length=150, temperature=0.7, device="cuda"):
    """Generate response from the model"""
    try:
        # Prepare inputs
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_length=max_length,
                num_return_sequences=1,
                do_sample=True,
                temperature=temperature,
                top_p=0.95,
                repetition_penalty=1.2
            )
        
        # Decode and extract just the newly generated text
        full_response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        prompt_text = tokenizer.decode(inputs.input_ids[0], skip_special_tokens=True)
        response_only = full_response[len(prompt_text):]
        
        return response_only.strip()
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        raise

async def process_chat_for_inference(user_id, message, context=None, history_limit=5):
    """Process chat message for inference, combining context and history"""
    try:
        # Get chat history if needed
        history = []
        if history_limit > 0:
            history = await get_chat_history(user_id, history_limit)
        
        # Format context
        formatted_context = ""
        if context:
            formatted_context = f"Context: {json.dumps(context)}\n"
            
        # Format history
        formatted_history = ""
        if history:
            formatted_history = "Previous conversation:\n"
            for entry in history:
                formatted_history += f"User: {entry['message']}\nAssistant: {entry['response']}\n"
        
        # Combine everything
        prompt = f"{formatted_context}{formatted_history}User: {message}\nAssistant:"
        
        return prompt
    except Exception as e:
        logger.error(f"Error processing chat for inference: {e}")
        raise

async def invoke_inference(user_id, message, context=None, use_sagemaker=True):
    """Main inference method that either uses SageMaker or local inference"""
    try:
        start_time = time.time()
        
        if use_sagemaker:
            # Get user model path
            model_path = await get_user_model_path(user_id)
            
            # Prepare payload for SageMaker inference
            prompt = await process_chat_for_inference(user_id, message, context)
            payload = {
                "user_id": user_id,
                "model_path": model_path,
                "prompt": prompt,
                "max_length": 200,
                "temperature": 0.7
            }
            
            # Call SageMaker endpoint
            response = sagemaker_runtime.invoke_endpoint(
                EndpointName=SAGEMAKER_ENDPOINT,
                ContentType='application/json',
                Body=json.dumps(payload)
            )
            
            # Parse response
            result = json.loads(response['Body'].read().decode())
            response_text = result.get("response", "")
        else:
            # Local inference
            # Get model path
            model_path = await get_user_model_path(user_id)
            local_model_path = f"/tmp/{user_id}_model.pt"
            
            # Download model
            await download_model_from_s3(model_path, local_model_path)
            
            # Load model
            model = await load_model(local_model_path)
            
            # Process context and history
            prompt = await process_chat_for_inference(user_id, message, context)
            
            # Generate response
            response_text = await generate_response(model, tokenizer, prompt)
        
        inference_time = time.time() - start_time
        logger.info(f"Inference completed in {inference_time:.2f}s")
        
        # Log sentiment analysis
        await analyze_and_log_sentiment(user_id, message, response_text)
        
        return response_text, inference_time
    except Exception as e:
        logger.error(f"Error during inference: {e}")
        raise HTTPException(status_code=500, detail=f"Error during inference: {str(e)}")

async def analyze_and_log_sentiment(user_id, message, response):
    """Analyze sentiment of user message and bot response, log to DB"""
    try:
        # Initialize sentiment analyzer pipeline
        sentiment_analyzer = pipeline("sentiment-analysis")
        
        # Analyze sentiment
        user_sentiment = sentiment_analyzer(message)[0]
        bot_sentiment = sentiment_analyzer(response)[0]
        
        # Log to database
        sentiment_record = {
            "user_id": user_id,
            "timestamp": datetime.utcnow(),
            "user_message": message,
            "bot_response": response,
            "user_sentiment": {
                "label": user_sentiment["label"],
                "score": user_sentiment["score"]
            },
            "bot_sentiment": {
                "label": bot_sentiment["label"],
                "score": bot_sentiment["score"]
            }
        }
        
        await sentiments_collection.insert_one(sentiment_record)
        logger.info(f"Sentiment analysis logged for user {user_id}")
        
        # If negative sentiment detected, flag for review
        if user_sentiment["label"] == "NEGATIVE" and user_sentiment["score"] > 0.8:
            await flag_conversation_for_review(user_id, message, response, user_sentiment["score"])
            
        return True
    except Exception as e:
        logger.error(f"Error during sentiment analysis: {e}")
        return False

async def flag_conversation_for_review(user_id, message, response, sentiment_score):
    """Flag a conversation for human review if it shows strongly negative sentiment"""
    try:
        review_record = {
            "user_id": user_id,
            "timestamp": datetime.utcnow(),
            "user_message": message,
            "bot_response": response,
            "sentiment_score": sentiment_score,
            "reviewed": False,
            "review_notes": "",
            "priority": "high" if sentiment_score > 0.9 else "medium"
        }
        
        await activities_collection.insert_one(review_record)
        logger.warning(f"Conversation flagged for review - User: {user_id}, Sentiment: {sentiment_score}")
        return True
    except Exception as e:
        logger.error(f"Error flagging conversation for review: {e}")
        return False

# Model evaluation and metrics
async def evaluate_model_performance(user_id):
    """Evaluate the performance of a user's model based on recent interactions"""
    try:
        # Fetch recent conversations
        recent_conversations = await chat_collection.find(
            {"user_id": user_id},
            {"message": 1, "response": 1, "user_feedback": 1}
        ).sort("timestamp", -1).limit(100).to_list(100)
        
        # Calculate metrics
        total_conversations = len(recent_conversations)
        feedback_provided = sum(1 for c in recent_conversations if "user_feedback" in c)
        
        if feedback_provided == 0:
            return {
                "status": "insufficient_data",
                "message": "No user feedback available for evaluation"
            }
        
        positive_feedback = sum(1 for c in recent_conversations 
                               if "user_feedback" in c and c["user_feedback"] > 3)
        
        metrics = {
            "total_conversations": total_conversations,
            "feedback_provided": feedback_provided,
            "positive_feedback_rate": positive_feedback / feedback_provided if feedback_provided > 0 else 0,
            "average_feedback_score": sum(c.get("user_feedback", 0) for c in recent_conversations) / feedback_provided 
                                      if feedback_provided > 0 else 0
        }
        
        # Update model metrics in database
        await users_collection.update_one(
            {"_id": user_id},
            {"$set": {"model_performance_metrics": metrics, "last_evaluated": datetime.utcnow()}}
        )
        
        return {
            "status": "success",
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Error evaluating model performance: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

# Batch processing for model retraining
async def prepare_training_data(user_id):
    """Prepare and format training data for model retraining"""
    try:
        # Get all conversations with positive feedback
        good_conversations = await chat_collection.find(
            {"user_id": user_id, "user_feedback": {"$gt": 3}}
        ).sort("timestamp", 1).to_list(1000)
        
        if not good_conversations:
            return {
                "status": "insufficient_data",
                "message": "Not enough positive feedback data for training"
            }
        
        # Format into training samples
        training_data = []
        for conv in good_conversations:
            # Format as input-output pairs
            sample = {
                "input": conv["message"],
                "output": conv["response"],
                "metadata": {
                    "timestamp": conv["timestamp"],
                    "feedback_score": conv.get("user_feedback", 0)
                }
            }
            training_data.append(sample)
        
        # Save to S3
        training_file_key = f"training-data/{user_id}/training_data_{int(time.time())}.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=training_file_key,
            Body=json.dumps(training_data),
            ContentType="application/json"
        )
        
        return {
            "status": "success",
            "data_file": training_file_key,
            "sample_count": len(training_data)
        }
    except Exception as e:
        logger.error(f"Error preparing training data: {e}")
        return {
            "status": "error",
            "message": str(e)
        }











