from aiohttp import ClientError
import torch
from transformers import BertTokenizer, BertForSequenceClassification
import os, json, torch, boto3
from pathlib import Path
import io
import numpy as np

# ---------------------------------------
#  **Aws Analysis** -- LOCAL
# ---------------------------------------
# Client 
s3 = boto3.client("s3")

E2C_IP = "16.16.202.113" 
# Get the absolute path to the server directory

BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model_new.pt"

SERVER_DIR = Path(__file__).parent.parent

MODEL_PATH = SERVER_DIR / "ml" / "best_model_v2.pt"
TOKENIZER_NAME = "bert-base-uncased"  # Define the variable before usage

print(f"🔹 Looking for model at: {MODEL_PATH} in local section ...")
try:
    # Initialize tokenizer
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased") # STANDART
    
    # Initialize model with CPU device specification - 
    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    
    if MODEL_PATH.exists(): # first check if model exist in local already
        print("✅ Found model file, loading...")
        # Load the state dict with proper error handling
        try:
            state_dict = torch.load(MODEL_PATH, map_location=torch.device('cpu'))
            model.load_state_dict(state_dict)
            print("✅ Custom GoEmotions model loaded successfully")
        except Exception as load_error:
            print(f"❌ Error loading model state: {str(load_error)}")
            print("⚠️ Using base BERT model as fallback")
    else: # second try to download from the server 
        print("⚠️ Model file not found at expected location")
        # Load emotion model (user-specific or fallback)
        model_key = f"models/{user_id}/model.pt"
        local_path = f"/tmp/{user_id}_model.pt"

        if last_user_id != user_id or cached_model is None:
            try:
                s3.download_file(BUCKET, model_key, local_path)
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    print("Custom model not found. Using base model...")
                    s3.copy_object(Bucket=BUCKET, CopySource=f"{BUCKET}/{BASE_MODEL_KEY}", Key=model_key)
                    s3.download_file(BUCKET, model_key, local_path)
                else:
                    raise

            cached_model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(EMOTIONS))
            cached_model.load_state_dict(torch.load(local_path, map_location=device))
            cached_model.to(device).eval()
            last_user_id = user_id

        print("⚠️ Using base BERT model for sentiment analysis")
        print("⚠️ Please ensure the model file is placed at:", MODEL_PATH)
        
    model.eval()  # Set model to evaluation mode
    print(f"✅ Model initialized with {model.num_labels} labels")

except Exception as e:  # last try to use Google Bert 
    print(f"❌ Error in model initialization: {str(e)}")
    print("⚠️ Falling back to base BERT model")
    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
    model.eval()

# Export the necessary components
__all__ = ['model', 'tokenizer']





