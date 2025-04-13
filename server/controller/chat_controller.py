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
# Device for PyTorch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Create chat blueprint
chat_bp = Blueprint("chat_bp", __name__)

model_bp = Blueprint("model_bp", __name__)

# AWS Configuration
AWS_REGION = "eu-north-1"
AWS_ACCESS_KEY = "AKIAXGZAMH3HUVQSPNED"
AWS_SECRET_KEY = "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"
S3_BUCKET = "sentiobucket"
SAGEMAKER_ENDPOINT = "sentio-user-model-endpoint"
# sentio-user-model-endpoint 
BASE_MODEL_PATH = "models/model.pt"
USER_MODEL_PATH = "sagemaker-eu-north-1-495599763151/pytorch-inference-2025-04-13-15-46-53-994"
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"
BASE_MODEL_TAR_PATH = "models/model.tar.gz"

# Define the emotion labels
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory conversation store (use DB in production)
conversations = {}
    # Set up the SageMaker session
sagemaker_session = sagemaker.Session(default_bucket=S3_BUCKET)
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


   # Check if the model exists
try:
        response = sagemaker_client.describe_model(ModelName='sentio-user-model')
        logger.info("✅ Model already exists.")
except sagemaker_client.exceptions.ClientError as e:
        if 'ModelNotFound' in str(e):
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

    # Check if the endpoint configuration exists
try:
        response = sagemaker_client.describe_endpoint_config(EndpointConfigName='sentio-config')
        logger.info("✅ Endpoint configuration already exists.")
except sagemaker_client.exceptions.ClientError as e:
        if 'EndpointConfigNotFound' in str(e):
            logger.info("❌ Endpoint configuration not found, creating configuration...")
            response = sagemaker_client.create_endpoint_config(
                EndpointConfigName='sentio-config',
                ProductionVariants=[
                    {
                        'VariantName': 'AllTraffic',
                        'ModelName': 'sentio-user-model',
                        'InitialInstanceCount': 1,
                        'InstanceType': 'ml.t2.medium',
                    },
                ]
            )
            logger.info("✅ Endpoint configuration created.")

    # Check if the endpoint exists
try:
        response = sagemaker_client.describe_endpoint(EndpointName='sentio-user-endpoint')
        logger.info("✅ Endpoint already exists.")
except sagemaker_client.exceptions.ClientError as e:
        if 'EndpointNotFound' in str(e):
            logger.info("❌ Endpoint not found, creating endpoint...")
            response = sagemaker_client.create_endpoint(
                EndpointName='sentio-user-endpoint',
                EndpointConfigName='sentio-config'
            )
            logger.info("✅ Endpoint created.")


# ---------------------------------------
#  ** Chat Endpoints - Test/Send
# ---------------------------------------
@chat_bp.route("/perchat", methods=["POST"])
@jwt_required()
def personalized_chat():
    """Chat endpoint that uses the user's personalized model"""
    try:
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
        conversation_id = data.get("conversation_id", f"conv_{user_id}_{int(time.time())}")
        
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
                create_user_model(user_id)
            except Exception as model_create_error:
                logger.error(f"Failed to create user model: {model_create_error}")
                return jsonify({"error": "Could not create personalized model"}), 500

        # Invoke the user's model
        try:
            response_text, inference_time = invoke_user_model(
                user_id=user_id,
                message=chat_request.message,
                context=chat_request.context or {}
            )
        except Exception as inference_error:
            logger.error(f"Model inference error: {inference_error}")
            return jsonify({"error": "Failed to process with personalized model"}), 500

        # Log the conversation
        try:
            log_conversation(
                user_id=user_id,
                conversation_id=conversation_id,
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
            conversation_id=conversation_id,
            model_version=str(model_version),
            model_updated=model_updated,
            inference_time=inference_time
        )
        
        return jsonify(response.dict())
        
    except Exception as e:
        logger.error(f"Unhandled error in personalized chat: {str(e)}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred"}), 500


def invoke_user_model(user_id: str, message: str, context: Dict = None):
    """Invoke the user's personalized model from S3."""
    context = context or {}  # Ensure context is not None
    logger.info(f"Starting model invocation for user {user_id}")
    
    try:
        # Step 1: Verify user model exists or copy from base
        user_model_path = f"models/{user_id}/model.pt"
        logger.info(f"Checking for user model at {user_model_path}")
        
        try:
            # Check if user model exists in S3
            exists = check_s3_object_exists(S3_BUCKET, user_model_path)
            logger.info(f"User model exists: {exists}")
            
            if not exists:
                logger.info(f"Copying base model to user path {user_model_path}")
                copy_s3_object(S3_BUCKET, "models/model.pt", S3_BUCKET, user_model_path)
                logger.info("Base model copied successfully")
        except Exception as e:
            logger.error(f"Error managing model file: {str(e)}", exc_info=True)
            return f"Error preparing your personalized model. Please try again later.", 0.0
        
        # Step 2: Process with SageMaker or locally
        if SAGEMAKER_ENDPOINT and SAGEMAKER_ENDPOINT.strip():
            logger.info(f"Using SageMaker endpoint: {SAGEMAKER_ENDPOINT}")
            
            # Basic payload - only include what your endpoint expects
            payload = {"message": message}
            
            logger.info(f"Prepared payload: {payload}")
            start_time = time.time()
            
            try:
                # Make sure sagemaker_runtime is properly initialized
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
        
        # Local inference as fallback
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
                return output, inference_time
                
            except Exception as local_error:
                logger.error(f"Local inference error: {str(local_error)}", exc_info=True)
                return f"Error processing your request locally. Technical details: {str(local_error)}", 0.0
    
    except Exception as e:
        logger.error(f"Unexpected error in invoke_user_model: {str(e)}", exc_info=True)
        return "I'm sorry, an unexpected error occurred while processing your request.", 0.0



# ------------------------------------------------------------------------ Helper Functions ------------------------------------------------------------------------
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
                    "created_at": datetime.now().isoformat(),
                    "last_updated": datetime.now().isoformat()
                }
            },
            upsert=True
        )
        print("pot af")

        return user_model_key

def download_model_from_s3(model_path: str, local_path: str):
    """Download model from S3 to local file system"""
    try:
        s3_client.download_file(S3_BUCKET, model_path, local_path)
        model = torch.load(local_path, map_location=torch.device('cpu'))
        logger.info(f"Downloaded model from s3://{S3_BUCKET}/{model_path} to {local_path}")
        return model
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error during download of model from S3: {str(e)}")

def upload_model_to_s3(local_path: str, model_path: str):
    """Upload model from local path to S3"""
    try:
        s3_client.upload_file(local_path, S3_BUCKET, model_path)
        logger.info(f"Uploaded model to s3://{S3_BUCKET}/{model_path}")
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error during upload of model to S3: {str(e)}")

def check_s3_object_exists(bucket: str, key: str) -> bool:
    """Check if an object exists in S3."""
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == "404":
            return False
        else:
            raise

def copy_s3_object(src_bucket: str, src_key: str, dest_bucket: str, dest_key: str):
    """Copy an object within S3."""
    s3_client.copy_object(
        Bucket=dest_bucket,
        CopySource={'Bucket': src_bucket, 'Key': src_key},
        Key=dest_key
    )

def create_user_model(user_id):
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

# ------------------------------------------------------------------------ Helper Functions ------------------------------------------------------------------------

def predict_emotions(text, threshold=0.3):
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


def log_conversation(user_id: str, conversation_id: str, message: str, response: str):
    """Logs a conversation into memory and MongoDB properly"""
    timestamp = datetime.now().isoformat()

    # In-memory logging
    if conversation_id not in conversations:
        conversations[conversation_id] = []

    conversations[conversation_id].append({
        "timestamp": timestamp,
        "user_id": user_id,
        "message": message,
        "response": response
    })
    print("added to conversations")

    # Store in MongoDB (chat message history)
    # Assuming chat_collection is a valid MongoDB collection
    chat_collection.insert_one({
        "conversation_id": conversation_id,
        "user_id": user_id,
        "message": message,
        "response": response,
        "timestamp": timestamp
    })
    print("added to chat_collections")
    # Fetch or create a chat document






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
            history = await get_chat_histoy(user_id, history_limit)
        
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
            model = await download_model_from_s3(model_path, local_model_path)
            # Load model
            model.to(DEVICE)
            model.eval()  # Set to evaluation mode
            
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
            "timestamp": datetime.now().isoformat(),
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
            "timestamp": datetime.now().isoformat(),
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
            {"$set": {"model_performance_metrics": metrics, "last_evaluated": datetime.now().isoformat()}}
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

# --------------------------------------- Model Analysis  ---------------------------------------
# We use AWS API 

# ---------------------------------------
#  **Sentimental Analysis Model**
# ---------------------------------------
# Define Request Model from AWS cloud, no processing to be done inside local machine


#s3 = boto3.client('s3')
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
# @app.route('/predict', methods=['POST'])
def nonpred():
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
        TrainingJobName=f"sentio-user-model-{user_id}",
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









