import boto3
import json
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, BackgroundTasks
from sklearn.metrics import classification_report
import logging
from pymongo import MongoClient
from bson import ObjectId

# Initialize AWS clients
sagemaker = boto3.client('sagemaker')
s3 = boto3.client('s3')
stepfunctions = boto3.client('stepfunctions')

# Initialize MongoDB
mongo_client = MongoClient('mongodb://localhost:27017/')
db = mongo_client['sentiment_db']

class UserInteraction(BaseModel):
    user_id: str
    text: str
    sentiment: dict
    emotion: str
    timestamp: datetime = datetime.utcnow()

class TrainingPipeline:
    def __init__(self):
        self.s3_bucket = 'your-ai-bucket'
        self.base_model_path = f's3://{self.s3_bucket}/base_model/'
        self.personal_models_path = f's3://{self.s3_bucket}/personal_models/'
        
    async def collect_interaction_data(self, interaction: UserInteraction):
        """Store user interaction data for training"""
        # Store in MongoDB
        db.interactions.insert_one(interaction.dict())
        
        # Store in S3 for training
        user_data_path = f'user_data/{interaction.user_id}/{interaction.timestamp.strftime("%Y-%m")}.json'
        s3.put_object(
            Bucket=self.s3_bucket,
            Key=user_data_path,
            Body=json.dumps(interaction.dict())
        )

    async def trigger_personal_training(self, user_id: str):
        """Trigger personalized model training for a user"""
        training_job_name = f"personal-training-{user_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        # Configure SageMaker training job
        response = sagemaker.create_training_job(
            TrainingJobName=training_job_name,
            AlgorithmSpecification={
                'TrainingImage': 'your-custom-training-image',
                'TrainingInputMode': 'File'
            },
            InputDataConfig=[
                {
                    'ChannelName': 'training',
                    'DataSource': {
                        'S3DataSource': {
                            'S3Uri': f's3://{self.s3_bucket}/user_data/{user_id}/',
                            'S3DataType': 'S3Prefix'
                        }
                    }
                }
            ],
            OutputDataConfig={
                'S3OutputPath': f'{self.personal_models_path}{user_id}/'
            },
            ResourceConfig={
                'InstanceType': 'ml.m5.xlarge',
                'InstanceCount': 1,
                'VolumeSizeInGB': 30
            },
            StoppingCondition={
                'MaxRuntimeInSeconds': 3600
            },
            HyperParameters={
                'learning_rate': '0.001',
                'batch_size': '32',
                'epochs': '10'
            }
        )
        return response

    async def trigger_global_training(self):
        """Trigger global model training using all user data"""
        # Start Step Functions workflow for global training
        response = stepfunctions.start_execution(
            stateMachineArn='arn:aws:states:region:account:stateMachine:GlobalTraining',
            input=json.dumps({
                'timestamp': datetime.now().isoformat(),
                'training_type': 'global',
                'data_path': f's3://{self.s3_bucket}/user_data/'
            })
        )
        return response

class AnalyticsPipeline:
    @staticmethod
    async def get_community_trends(timeframe: str = 'week'):
        """Analyze community-wide trends"""
        pipeline = [
            {
                '$match': {
                    'timestamp': {
                        '$gte': datetime.now() - timedelta(days=7 if timeframe == 'week' else 30)
                    }
                }
            },
            {
                '$group': {
                    '_id': {
                        'emotion': '$emotion',
                        'date': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}}
                    },
                    'count': {'$sum': 1},
                    'avg_sentiment': {'$avg': '$sentiment.score'}
                }
            },
            {'$sort': {'_id.date': -1, 'count': -1}}
        ]
        
        results = list(db.interactions.aggregate(pipeline))
        return results

    @staticmethod
    async def get_user_insights(user_id: str):
        """Get personalized insights for a user"""
        pipeline = [
            {'$match': {'user_id': user_id}},
            {
                '$group': {
                    '_id': None,
                    'total_interactions': {'$sum': 1},
                    'avg_sentiment': {'$avg': '$sentiment.score'},
                    'common_emotions': {
                        '$push': '$emotion'
                    }
                }
            }
        ]
        
        results = list(db.interactions.aggregate(pipeline))
        return results[0] if results else None

# FastAPI application
app = FastAPI()
training_pipeline = TrainingPipeline()
analytics_pipeline = AnalyticsPipeline()

@app.post("/interaction")
async def record_interaction(interaction: UserInteraction):
    """Record user interaction and trigger training if needed"""
    try:
        # Store interaction data
        await training_pipeline.collect_interaction_data(interaction)
        
        # Check if personal model needs updating
        user_interactions = db.interactions.count_documents({'user_id': interaction.user_id})
        if user_interactions % 100 == 0:  # Trigger training every 100 interactions
            await training_pipeline.trigger_personal_training(interaction.user_id)
            
        # Check if global model needs updating
        total_interactions = db.interactions.count_documents({})
        if total_interactions % 1000 == 0:  # Trigger global training every 1000 interactions
            await training_pipeline.trigger_global_training()
            
        return {"status": "success", "message": "Interaction recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/trends/{timeframe}")
async def get_trends(timeframe: str):
    """Get community trends for specified timeframe"""
    try:
        trends = await analytics_pipeline.get_community_trends(timeframe)
        return {"trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/insights/{user_id}")
async def get_user_insights(user_id: str):
    """Get personalized insights for a user"""
    try:
        insights = await analytics_pipeline.get_user_insights(user_id)
        return {"insights": insights}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))