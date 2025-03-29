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
from flask import Flask, request, jsonify
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

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Personalized Model Chatbot API")

#  CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Specify allowed origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables and configuration
JWT_SECRET = os.getenv("JWT_SECRET", "sentioSecretKey")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 24  # 24 hours

# AWS Configuration
AWS_REGION = os.getenv("AWS_REGION", "eu-north-1")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "AKIAXGZAMH3HUVQSPNED")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "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")
S3_BUCKET = os.getenv("S3_BUCKET", "user-models-bucket")
SAGEMAKER_ENDPOINT = os.getenv("SAGEMAKER_ENDPOINT", "user-model-endpoint")
# DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "user-model-metadata") # Not using the DYNAMODB_TABLE
BASE_MODEL_PATH = os.getenv("BASE_MODEL_PATH", "base-models/base-model.pt")
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"
client = None

# Initialize AWS clients
try:
    s3_client = boto3.client(
        's3', 
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    # Mongo DD
    client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000,tlsCAFile=certifi.where())   
    db = client["mydb"]
    print("✅ Chatbot - Connected to MongoDB successfully!")
    print("✅ Chatbot - Available collections:", db.list_collection_names())
    users_collection = db["users"]
    sentiments_collection = db["sentiments"]  # db sentiments 
    activities_collection = db["activities"]
    #print("✅ users_collection, sentiments_collection, activities_collection lists extracted from MongoDB successfully!")

    sagemaker_runtime = boto3.client(
        'sagemaker-runtime',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    
    sagemaker_client = boto3.client(
        'sagemaker',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    
    lambda_client = boto3.client(
        'lambda',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    
    logger.info("✅ AWS and DB clients initialized successfully")
        
except Exception as e:
    logger.error(f"❌ Error initializing AWS clients: {e}")
    raise

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

# Security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Utility functions
def get_password_hash(password: str) -> str:
    """Simple password hashing (use a proper library in production)"""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Validate token and get current user"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        token_data = TokenData(user_id=user_id)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    # Get user from DynamoDB
    try:
        user = users_collection.find_one(Key={"_id": token_data.user_id})
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except Exception as e:
        logger.error(f"Error retrieving user from DynamoDB: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Model Management Functions
async def initialize_user_model(user_id: str):
    """Initialize a new model for a user based on the base model"""
    try:
        user_model_path = f"user-models/{user_id}/model_v1.pt"
        
        # Copy base model to user's folder
        s3_client.copy_object(
            Bucket=S3_BUCKET,
            CopySource=f"{S3_BUCKET}/{BASE_MODEL_PATH}",
            Key=user_model_path
        )
        
        # Update user metadata in MongoDB
        users_collection.update_one(
            Key={"_id": user_id},
            UpdateExpression="SET model_path = :p, model_version = :v, last_updated = :t",
            ExpressionAttributeValues={
                ":p": user_model_path,
                ":v": 1,
                ":t": datetime.now()
            }
        )
        
        logger.info(f"Initialized model for user {user_id}")
        return user_model_path
    except Exception as e:
        logger.error(f"Error initializing user model: {e}")
        raise

async def get_user_model_path(user_id: str):
    """Get the path to the user's current model, initializing if needed"""
    try:
        # Get user metadata from MongoDB
        user = users_collection.get_one(Key={"_id": user_id})
        
        if not user or not user.get("model_path"):
            # Initialize user model if it doesn't exist
            return await initialize_user_model(user_id)
        
        return user.get("model_path")
    except Exception as e:
        logger.error(f"Error getting user model path: {e}")
        raise

async def update_user_model(user_id: str, chat_data: Dict):
    """Update the user's model based on chat interaction using Lambda function"""
    try:
        # Get current model path and version
        user = users_collection.get_one(Key={"_id": user_id})

        if not user or not user.get("model_path"):
            raise HTTPException(status_code=404, detail="User model not found")
        
        current_model_path = user.get("model_path")
        current_version = user.get("model_version", 1)
        new_version = current_version + 1
        new_model_path = f"user-models/{user_id}/model_v{new_version}.pt"
        
        # Invoke Lambda function for model update
        # This Lambda function would run the update logic asynchronously
        payload = {
            "user_id": user_id,
            "current_model_path": current_model_path,
            "new_model_path": new_model_path,
            "chat_data": chat_data,
            "model_version": new_version,
            "s3_bucket": S3_BUCKET
        }
        
        lambda_client.invoke(
            FunctionName="update-user-model",
            InvocationType="Event",  # Asynchronous
            Payload=json.dumps(payload)
        )
        
        # Update metadata immediately (actual model update happens asynchronously)
        model_metadata_table.update_item(
            Key={"user_id": user_id},
            UpdateExpression="SET model_path = :p, model_version = :v, last_updated = :t, updating = :u",
            ExpressionAttributeValues={
                ":p": new_model_path,
                ":v": new_version,
                ":t": datetime.now().isoformat(),
                ":u": True
            }
        )
        
        logger.info(f"Initiated model update for user {user_id} to version {new_version}")
        return new_model_path, new_version
    except Exception as e:
        logger.error(f"Error updating user model: {e}")
        raise

async def invoke_user_model(user_id: str, message: str, context: Dict = None):
    """Invoke the user's personalized model for inference"""
    try:
        # Get user model path
        model_path = await get_user_model_path(user_id)
        
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
    except Exception as e:
        logger.error(f"Error invoking user model: {e}")
        raise HTTPException(status_code=500, detail=f"Error invoking model: {str(e)}")

# Conversation management
conversations = {}  # In-memory storage, use a database in production

async def log_conversation(user_id: str, conversation_id: str, message: str, response: str):
    """Log conversation to memory and optionally to persistent storage"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    conversations[conversation_id].append({
        "timestamp": time.time(),
        "user_id": user_id,
        "message": message,
        "response": response
    })
    
    # In production, you'd store this in DynamoDB or another database

# API Endpoints
@app.post("/register", response_model=Token)
async def register_user(user: User):
    """Register a new user and initialize their model"""
    try:
        user_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        
        # Create user record in DynamoDB
        users_collection.insert_one(
            Item={
                "_id": user_id,
                "username": user.username,
                "email": user.email,
                "hashed_password": get_password_hash(user.password),
                "created_at": created_at,
                "model_version": 0
            },
            ConditionExpression="attribute_not_exists(user_id)"
        )
        
        # Initialize user model
        await initialize_user_model(user_id)
        
        # Create access token
        access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
        access_token = create_access_token(
            data={"sub": user_id}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer", "user_id": user_id}
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise HTTPException(status_code=400, detail="User already exists")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint to get JWT token using MongoDB"""
    try:
        # Query MongoDB for user by username
        user = users_collection.find_one({"username": form_data.username})
        
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        # Verify password
        if not verify_password(form_data.password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        # Create JWT token
        access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user["_id"])}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer", "user_id": str(user["_id"])}
    
    except HTTPException:
        raise  # Keep existing HTTP error responses
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Chat endpoint that uses the user's personalized model"""
    try:
        user_id = current_user["user_id"]
        conversation_id = f"conv_{user_id}_{int(time.time())}"
        
        # Get model version
        model_version = current_user.get("model_version", 1)
        
        # Invoke user's model
        response_text, inference_time = await invoke_user_model(
            user_id=user_id,
            message=request.message,
            context=request.context
        )
        
        # Log conversation
        background_tasks.add_task(
            log_conversation,
            user_id=user_id,
            conversation_id=conversation_id,
            message=request.message,
            response=response_text
        )
        
        # Update model if requested
        model_updated = False
        if request.update_model:
            chat_data = {
                "user_message": request.message,
                "model_response": response_text,
                "context": request.context,
                "timestamp": time.time()
            }
            
            _, new_version = await update_user_model(user_id, chat_data)
            model_version = new_version
            model_updated = True
        
        return ChatResponse(
            response=response_text,
            conversation_id=conversation_id,
            model_version=model_version,
            model_updated=model_updated,
            inference_time=inference_time
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@app.post("/train", response_model=ModelTrainingResponse)
async def train_model(
    request: ModelTrainingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Endpoint to trigger specific training for a user's model"""
    try:
        user_id = current_user["user_id"]
        
        # Get current model path
        model_path = current_user.get("model_path")
        if not model_path:
            model_path = await initialize_user_model(user_id)
        
        # Prepare SageMaker training job
        job_name = f"train-user-model-{user_id}-{int(time.time())}"
        
        # Configure training job parameters
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
            "HyperParameters": request.hyperparameters or {}
        }
        
        # First, save the training data to S3
        training_data_key = f"training-data/{user_id}/training_data_{int(time.time())}.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=training_data_key,
            Body=json.dumps(request.training_data),
            ContentType="application/json"
        )
        
        # Create SageMaker training job
        response = sagemaker_client.create_training_job(**training_params)
        
        # Update user metadata in DynamoDB to include training job
        model_metadata_table.update_item(
            Key={"user_id": user_id},
            UpdateExpression="SET training_jobs = list_append(if_not_exists(training_jobs, :empty_list), :job)",
            ExpressionAttributeValues={
                ":empty_list": [],
                ":job": [{
                    "job_id": job_name,
                    "status": "InProgress",
                    "started_at": datetime.now().isoformat()
                }]
            }
        )
        
        return ModelTrainingResponse(
            job_id=job_name,
            status="InProgress",
            estimated_completion_time=(datetime.now() + timedelta(hours=1)).isoformat()
        )
    except Exception as e:
        logger.error(f"Error starting training job: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting training: {str(e)}")

@app.get("/model/status", response_model=ModelStatus)
async def get_model_status(current_user: dict = Depends(get_current_user)):
    """Get the status of a user's model"""
    try:
        user_id = current_user["user_id"]
        
        # Get full user metadata from DynamoDB
        response = model_metadata_table.get_item(Key={"user_id": user_id})
        user = response.get("Item")
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # If model doesn't exist, initialize it
        if not user.get("model_path"):
            model_path = await initialize_user_model(user_id)
            user["model_path"] = model_path
            user["model_version"] = 1
        
        # Get performance metrics if available
        performance_metrics = user.get("performance_metrics", {})
        
        # Update status of any training jobs
        training_jobs = user.get("training_jobs", [])
        updated_jobs = []
        
        for job in training_jobs:
            if job["status"] == "InProgress":
                try:
                    # Check status with SageMaker
                    job_response = sagemaker_client.describe_training_job(
                        TrainingJobName=job["job_id"]
                    )
                    job["status"] = job_response["TrainingJobStatus"]
                    
                    if job["status"] == "Completed":
                        job["completed_at"] = datetime.now().isoformat()
                        
                        # Update model version and path if training completed successfully
                        new_version = user["model_version"] + 1
                        new_model_path = f"user-models/{user_id}/model_v{new_version}.pt"
                        
                        # Copy the trained model to the user's model path
                        output_path = job_response["ModelArtifacts"]["S3ModelArtifacts"]
                        s3_client.copy_object(
                            Bucket=S3_BUCKET,
                            CopySource=output_path,
                            Key=new_model_path
                        )
                        
                        # Update user metadata
                        model_metadata_table.update_item(
                            Key={"user_id": user_id},
                            UpdateExpression="SET model_path = :p, model_version = :v, last_updated = :t",
                            ExpressionAttributeValues={
                                ":p": new_model_path,
                                ":v": new_version,
                                ":t": datetime.now().isoformat()
                            }
                        )
                        
                        user["model_path"] = new_model_path
                        user["model_version"] = new_version
                except Exception as e:
                    logger.error(f"Error updating job status: {e}")
                    # Keep the job as is
            
            updated_jobs.append(job)
        
        return ModelStatus(
            user_id=user_id,
            model_path=user["model_path"],
            model_version=user["model_version"],
            last_updated=user.get("last_updated", user["created_at"]),
            training_jobs=updated_jobs,
            performance_metrics=performance_metrics
        )
    except Exception as e:
        logger.error(f"Error getting model status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting model status: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check AWS services
        s3_client.list_buckets()
        model_metadata_table.describe_table()
        return {"status": "healthy", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}, 500

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)







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
    model.load_state_dict(torch.load(model, map_location=torch.device("cpu")))
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
    




















    # Models
class ChatMessage(BaseModel):
    role: str = "user"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatHistory(BaseModel):
    messages: List[Dict[str, Any]] = []

class ChatRequest(BaseModel):
    message: str
    update_model: bool = False  # Whether to update the user's model with this interaction
    context_window: int = 10  # Number of previous messages to consider for context

class ChatResponse(BaseModel):
    message: str
    model_updated: bool = False
    model_version: str = "1.0"
    processed_at: datetime = Field(default_factory=datetime.utcnow)

# Helper Functions
async def get_user_model_path(user_id: str) -> str:
    """
    Determine if the user has a personalized model, and return the S3 path.
    If no model exists, return the base model path.
    """
    user_model_key = f"user_models/{user_id}/model.pt"
    
    try:
        # Check if user model exists in S3
        s3_client.head_object(Bucket=S3_BUCKET, Key=user_model_key)
        return user_model_key
    except Exception:
        # If user model doesn't exist, return base model
        return BASE_MODEL_PATH

async def download_model_from_s3(model_path: str, local_path: str):
    """Download model from S3 to local file system"""
    try:
        s3_client.download_file(S3_BUCKET, model_path, local_path)
        logger.info(f"Downloaded model from s3://{S3_BUCKET}/{model_path} to {local_path}")
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        raise

async def upload_model_to_s3(local_path: str, model_path: str):
    """Upload model from local path to S3"""
    try:
        s3_client.upload_file(local_path, S3_BUCKET, model_path)
        logger.info(f"Uploaded model to s3://{S3_BUCKET}/{model_path}")
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise

async def load_user_model(user_id: str):
    """Load or create a model for the specified user"""
    # Get model path
    model_path = await get_user_model_path(user_id)
    local_model_path = f"/tmp/{user_id}_model.pt"
    
    # Download model from S3
    await download_model_from_s3(model_path, local_model_path)
    
    # Initialize the model architecture
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
    
    # Load the model state dict
    model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
    model.to(DEVICE)
    model.eval()
    
    return model, local_model_path

async def get_chat_history(user_id: str, limit: int = 10):
    """Get the most recent chat history for a user"""
    cursor = db.chat_history.find({"user_id": user_id}).sort("timestamp", -1).limit(limit)
    history = await cursor.to_list(length=limit)
    return history[::-1]  # Reverse to get chronological order

async def update_user_model(user_id: str, message: str, response: str, local_model_path: str):
    """
    Update the user's model based on the current interaction.
    This would typically involve some form of continual learning or fine-tuning.
    """
    try:
        # Load the current model
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
        model.train()
        
        # Prepare the training data from this interaction
        inputs = tokenizer(message, return_tensors="pt").to(DEVICE)
        labels = tokenizer(response, return_tensors="pt").input_ids.to(DEVICE)
        
        # Simple learning step (in production, you'd use proper fine-tuning approaches)
        # This is just an illustration - actual implementation would be more complex
        optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
        
        # Forward pass
        outputs = model(**inputs, labels=labels)
        loss = outputs.loss
        
        # Backward pass and optimization
        loss.backward()
        optimizer.step()
        
        # Save the updated model
        torch.save(model.state_dict(), local_model_path)
        
        # Upload back to S3
        user_model_key = f"user_models/{user_id}/model.pt"
        await upload_model_to_s3(local_model_path, user_model_key)
        
        # Update model metadata in MongoDB
        await db.user_models.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "last_updated": datetime.utcnow(),
                    "update_count": await db.user_models.count_documents({"user_id": user_id}) + 1
                },
                "$inc": {"version": 0.1}  # Increment version number
            },
            upsert=True
        )
        
        return True
    except Exception as e:
        logger.error(f"Error updating model: {e}")
        return False

# Dependency for getting current user (assumes auth is implemented elsewhere)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    # In your full app, this would validate the token and return the user
    # This is a simplified version since you mentioned auth is already implemented
    user_id = "user123"  # This would normally come from token validation
    return {"id": user_id}

# Endpoints
@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    
    try:
        # Get chat history
        history = await get_chat_history(user_id, request.context_window)
        
        # Load user's model
        model, local_model_path = await load_user_model(user_id)
        
        # Prepare the context from history + new message
        context = " ".join([msg["content"] for msg in history])
        if context:
            context += " " + request.message
        else:
            context = request.message
            
        # Generate response
        inputs = tokenizer(context, return_tensors="pt").to(DEVICE)
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
        
        # Store the interaction in MongoDB
        await db.chat_history.insert_one({
            "user_id": user_id,
            "message": request.message,
            "response": response_text,
            "timestamp": datetime.utcnow()
        })
        
        # Update the model if requested (as a background task)
        model_updated = False
        if request.update_model:
            background_tasks.add_task(
                update_user_model,
                user_id,
                request.message,
                response_text,
                local_model_path
            )
            model_updated = True
        
        # Get model version
        model_info = await db.user_models.find_one({"user_id": user_id})
        model_version = str(model_info["version"]) if model_info and "version" in model_info else "1.0"
        
        return ChatResponse(
            message=response_text,
            model_updated=model_updated,
            model_version=model_version
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.get("/model/status")
async def get_model_status(current_user: Dict = Depends(get_current_user)):
    """Get information about the user's personalized model"""
    user_id = current_user["id"]
    
    try:
        # Get model metadata from MongoDB
        model_info = await db.user_models.find_one({"user_id": user_id})
        
        if not model_info:
            return {
                "has_custom_model": False,
                "using_base_model": True,
                "base_model": MODEL_NAME
            }
        
        # Get interaction counts
        interaction_count = await db.chat_history.count_documents({"user_id": user_id})
        
        return {
            "has_custom_model": True,
            "model_version": model_info.get("version", 1.0),
            "last_updated": model_info.get("last_updated", datetime.utcnow()),
            "update_count": model_info.get("update_count", 0),
            "interaction_count": interaction_count,
            "base_model": MODEL_NAME
        }
        
    except Exception as e:
        logger.error(f"Error getting model status: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving model status: {str(e)}")

@app.post("/model/reset")
async def reset_user_model(current_user: Dict = Depends(get_current_user)):
    """Reset a user's model back to the base model"""
    user_id = current_user["id"]
    
    try:
        # Delete user model from S3
        user_model_key = f"user_models/{user_id}/model.pt"
        try:
            s3_client.delete_object(Bucket=S3_BUCKET, Key=user_model_key)
        except Exception:
            pass  # Model might not exist yet
        
        # Delete model metadata from MongoDB
        await db.user_models.delete_one({"user_id": user_id})
        
        return {
            "success": True,
            "message": "User model has been reset to base model"
        }
        
    except Exception as e:
        logger.error(f"Error resetting model: {e}")
        raise HTTPException(status_code=500, detail=f"Error resetting model: {str(e)}")

@app.post("/model/force-update")
async def force_model_update(current_user: Dict = Depends(get_current_user)):
    """Force an update of the user's model based on all chat history"""
    user_id = current_user["id"]
    
    try:
        # Get all chat history
        cursor = db.chat_history.find({"user_id": user_id}).sort("timestamp", 1)
        history = await cursor.to_list(length=1000)  # Limit to 1000 interactions
        
        if not history:
            raise HTTPException(status_code=400, detail="No chat history found for model training")
        
        # Load base model as starting point
        local_model_path = f"/tmp/{user_id}_model.pt"
        await download_model_from_s3(BASE_MODEL_PATH, local_model_path)
        
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        model.load_state_dict(torch.load(local_model_path, map_location=torch.device(DEVICE)))
        model.train()
        
        # Simple training loop (in production, you'd use more sophisticated approaches)
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
        await upload_model_to_s3(local_model_path, user_model_key)
        
        # Update metadata
        await db.user_models.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "last_updated": datetime.utcnow(),
                    "training_samples": len(history),
                    "full_retrain": True
                },
                "$inc": {"version": 1.0}  # Major version update
            },
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Model fully updated with {len(history)} interactions",
            "new_version": await db.user_models.find_one({"user_id": user_id})["version"]
        }
        
    except Exception as e:
        logger.error(f"Error forcing model update: {e}")
        raise HTTPException(status_code=500, detail=f"Error forcing model update: {str(e)}")