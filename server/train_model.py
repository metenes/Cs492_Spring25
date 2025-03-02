import torch
import torch.nn as nn
import torch.optim as optim
import boto3
import json
from io import BytesIO
from transformers import BertForSequenceClassification

"""
Training code based for our model.pt to 
continious training makes ML more sharper weights . 
This code will be uploaded to the AWS Lambada function to run on AWS

to check if the models exist: aws s3 cp training_data.json s3://sentiobucket/trainData/training_data.json

sudo apt update && sudo apt install python3-pip -y
pip3 install torch boto3
python3 train_model.py

"""

# AWS STORAGE S3 PATHS
S3_BUCKET = "sentiobucket"
BASE_MODEL_PATH = f"s3://{S3_BUCKET}/models/" 
BASE_MODEL = f"s3://{S3_BUCKET}/models/model.pt"
PERSONAL_MODELS = f"{BASE_MODEL_PATH}/personal_models/"
GLOBAL_MODELS = f"{BASE_MODEL_PATH}/global_model/"
TRAINING_DATA_PATH = "training_data.json"
MODEL_PATH = "models/model.pt"


# Load model from S3
s3 = boto3.client("s3")
obj = s3.get_object(Bucket=S3_BUCKET, Key=MODEL_PATH)
model_data = BytesIO(obj["Body"].read())
model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
model.load_state_dict(torch.load(model_data))
model.train()

# Load training data
obj = s3.get_object(Bucket=S3_BUCKET, Key=TRAINING_DATA_PATH)
training_data = json.loads(obj["Body"].read().decode("utf-8"))

# Training loop - CrossEntropy
# criterion = nn.CrossEntropyLoss()
# optimizer = optim.Adam(model.parameters(), lr=0.001)

criterion = nn.BCEWithLogitsLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

for epoch in range(5):
    inputs = torch.tensor(training_data["inputs"])
    labels = torch.tensor(training_data["labels"])
    
    optimizer.zero_grad()
    outputs = model(inputs)
    loss = criterion(outputs.logits, labels)
    loss.backward()
    optimizer.step()

# Save updated model
buffer = BytesIO()
torch.save(model.state_dict(), buffer)
buffer.seek(0)
s3.put_object(Bucket=S3_BUCKET, Key=MODEL_PATH, Body=buffer.read())

print("Model retrained and updated!")
