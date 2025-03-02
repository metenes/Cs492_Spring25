import boto3
import torch
import json
import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from pymongo import MongoClient
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from bson import ObjectId
import uvicorn
import torch.nn as nn
import torch.optim as optim
from io import BytesIO

# LOGGING SETUP
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS SERVICES SETUP
sagemaker = boto3.client('sagemaker')
s3 = boto3.client('s3')
stepfunctions = boto3.client('stepfunctions')

# MONGODB SETUP
mongo_client = MongoClient('mongodb://localhost:27017/')
db = mongo_client['ai_training_db']

# AWS STORAGE S3 PATHS
S3_BUCKET = "sentiobucket"
BASE_MODEL_PATH = f"s3://{S3_BUCKET}/models/" 
BASE_MODEL = f"s3://{S3_BUCKET}/models/model.pt"
PERSONAL_MODELS = f"{BASE_MODEL_PATH}/personal_models/"
GLOBAL_MODELS = f"{BASE_MODEL_PATH}/global_model/"
MODEL_PATH = "models/model.pt"

app = FastAPI()

def load_model():
    """Download and load PyTorch model from S3"""
    obj = s3.get_object(Bucket=S3_BUCKET, Key=MODEL_PATH)
    model_data = BytesIO(obj["Body"].read())
    
    model = torch.load(model_data, map_location=torch.device("cpu"))
    model.eval()
    return model

model = load_model()

# AI TRAINING CLASS
class AITraining:
    """Handles AI training workflows, hyperparameter tuning, and model merging"""
    
    async def trigger_training(self, model_type: str, user_id: Optional[str] = None):
        """Triggers training for personal or global AI models."""
        try:
            if model_type == 'personal' and user_id:
                await self._train_personal_model(user_id)
            elif model_type == 'global':
                await self._train_global_model()
            else:
                raise ValueError("Invalid model type or missing user_id")
        except Exception as e:
            logger.error(f"Training error: {str(e)}")
            raise

    async def _train_personal_model(self, user_id: str):
        """Triggers training for a personal AI model."""
        job_name = f"personal-model-{user_id}-{datetime.now().strftime('%Y%m%d-%H%M')}"

        training_params = {
            'TrainingJobName': job_name,
            'AlgorithmSpecification': {'TrainingImage': 'custom-training-image', 'TrainingInputMode': 'File'},
            'HyperParameters': {'learning_rate': '0.001', 'epochs': '20', 'batch_size': '32'},
            'InputDataConfig': [{'ChannelName': 'training', 'DataSource': {'S3DataSource': {'S3Uri': f"s3://{PERSONAL_MODELS}{user_id}/training/", 'S3DataType': 'S3Prefix'}}}],
            'OutputDataConfig': {'S3OutputPath': f"s3://{PERSONAL_MODELS}{user_id}/output/"},
            'ResourceConfig': {'InstanceType': 'ml.p3.2xlarge', 'InstanceCount': 1, 'VolumeSizeInGB': 50},
            'StoppingCondition': {'MaxRuntimeInSeconds': 7200}
        }

        response = sagemaker.create_training_job(**training_params)
        db.training_jobs.insert_one({'job_id': response['TrainingJobArn'], 'user_id': user_id, 'status': 'started', 'timestamp': datetime.utcnow()})
        return response['TrainingJobArn']

    async def _train_global_model(self):
        """Triggers training for a global AI model using Federated Learning."""
        job_name = f"global-model-{datetime.now().strftime('%Y%m%d-%H%M')}"

        training_params = {
            'TrainingJobName': job_name,
            'AlgorithmSpecification': {'TrainingImage': 'custom-global-training', 'TrainingInputMode': 'File'},
            'HyperParameters': {'learning_rate': '0.0005', 'epochs': '50', 'batch_size': '64'},
            'InputDataConfig': [{'ChannelName': 'training', 'DataSource': {'S3DataSource': {'S3Uri': f"s3://{GLOBAL_MODELS}training/", 'S3DataType': 'S3Prefix'}}}],
            'OutputDataConfig': {'S3OutputPath': f"s3://{GLOBAL_MODELS}output/"},
            'ResourceConfig': {'InstanceType': 'ml.p3.8xlarge', 'InstanceCount': 2, 'VolumeSizeInGB': 100},
            'StoppingCondition': {'MaxRuntimeInSeconds': 14400}
        }

        response = sagemaker.create_training_job(**training_params)
        db.training_jobs.insert_one({'job_id': response['TrainingJobArn'], 'status': 'started', 'timestamp': datetime.utcnow()})
        return response['TrainingJobArn']

# API ENDPOINTS
@app.post("/interaction")
async def record_interaction(user_id: str, text: str, sentiment: Dict[str, float], emotion: str):
    """Store user interaction data."""
    db.interactions.insert_one({'user_id': user_id, 'text': text, 'sentiment': sentiment, 'emotion': emotion, 'timestamp': datetime.utcnow()})
    
    # Trigger AI training dynamically
    total_interactions = db.interactions.count_documents({})
    if total_interactions % 1000 == 0:
        ai_training = AITraining()
        await ai_training.trigger_training('global')

    return {"status": "success", "message": "Interaction recorded"}

@app.post("/emotion")
async def record_emotion(user_id: str, type: str, emotion: str, confidence: float):
    """Store emotion data for AI training."""
    db.emotion_data.insert_one({'user_id': user_id, 'type': type, 'emotion': emotion, 'confidence': confidence, 'timestamp': datetime.utcnow()})
    return {"status": "success", "message": "Emotion data recorded"}

@app.post("/trigger-training")
async def trigger_training(model_type: str, user_id: Optional[str] = None):
    """API to manually trigger AI training."""
    ai_training = AITraining()
    await ai_training.trigger_training(model_type, user_id)
    return {"status": "success", "message": "Training job started"}

@app.get("/trends")
async def get_trends():
    """Get sentiment trends from all users."""
    trends = list(db.interactions.aggregate([{'$group': {'_id': "$emotion", 'count': {'$sum': 1}}}]))
    return {"trends": trends}

@app.get("/personal-insights/{user_id}")
async def get_user_insights(user_id: str):
    """Get AI-generated insights for a user."""
    insights = list(db.interactions.find({'user_id': user_id}, {'_id': 0, 'text': 1, 'emotion': 1}))
    return {"insights": insights}
