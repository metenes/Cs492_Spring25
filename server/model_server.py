import torch
import boto3
import json
import uvicorn
import torch.nn as nn
import torch.optim as optim
from fastapi import FastAPI
from transformers import AutoTokenizer, BertTokenizer, BertForSequenceClassification
from io import BytesIO
"""
Inference code based on our model.pt to advance itself on the run
continious inference makes personalized ML. 
This code will be uploaded to the AWS Lambada function to run on AWS

Linux : 
zip -r model_server.zip model_server.py
aws lambda create-function --function-name pytorch-inference \
  --runtime python3.8 --role YOUR_IAM_ROLE \
  --handler model_server.lambda_handler --zip-file fileb://model_server.zip

Windows : 
Compress-Archive -Path .\model_server.py -DestinationPath .\model_server.zip
aws lambda create-function --function-name pytorch-inference \
  --runtime python3.8 --role YOUR_IAM_ROLE \
  --handler model_server.lambda_handler --zip-file fileb://model_server.zip

"""
app = FastAPI() # sentio FastAPI need to be more faster query responds 
s3 = boto3.client("s3")

# AWS STORAGE S3 PATHS
S3_BUCKET = "sentiobucket"
MODEL_PATH = "models/model.pt"
BASE_MODEL_PATH = f"s3://{S3_BUCKET}/models/" 
BASE_MODEL = f"s3://{S3_BUCKET}/models/model.pt"
PERSONAL_MODELS = f"{BASE_MODEL_PATH}/personal_models/"
GLOBAL_MODELS = f"{BASE_MODEL_PATH}/global_model/"


# Load Model from S3
def load_model():
    """Download & Load PyTorch model from S3"""
    obj = s3.get_object(Bucket=S3_BUCKET, Key=MODEL_PATH)
    model_data = BytesIO(obj["Body"].read())

    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    model.load_state_dict(torch.load(model_data, map_location=torch.device("cpu")))
    model.eval()
    return model

model = load_model()
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# API Route for Emotion Prediction
@app.post("/predict")
async def predict(data: dict):
    """Make emotion predictions using the trained model"""
    text = data["text"]
    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().tolist()

    emotion_labels = [
        "admiration", "amusement", "anger", "annoyance", "approval", "caring",
        "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
        "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
        "nervousness", "optimism", "pride", "realization", "relief", "remorse",
        "sadness", "surprise", "neutral"
    ]

    sorted_emotions = sorted(
        zip(emotion_labels, probabilities), key=lambda x: x[1], reverse=True
    )

    return {
        "input_text": text,
        "predicted_emotions": [e[0] for e in sorted_emotions if e[1] > 0.3],  # Thresholding
        "top_5_emotions": sorted_emotions[:5],
    }

# Run on AWS Lambda
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
