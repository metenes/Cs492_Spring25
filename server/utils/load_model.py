import torch
from transformers import BertTokenizer, BertForSequenceClassification
import os
from pathlib import Path

# ---------------------------------------
#  **Aws Analysis** --TODO
# ---------------------------------------

# Get the absolute path to the server directory
SERVER_DIR = Path(__file__).parent.parent  # Go up one level from utils to server
MODEL_PATH = SERVER_DIR / "ml" / "best_model.pt"
TOKENIZER_NAME = "bert-base-uncased"  # Define the variable before usage

print(f"🔹 Looking for model at: {MODEL_PATH}")

try:
    # Initialize tokenizer
    tokenizer = BertTokenizer.from_pretrained(TOKENIZER_NAME)
    # Initialize model
    model = BertForSequenceClassification.from_pretrained(TOKENIZER_NAME, num_labels=28)
    
    if MODEL_PATH.exists():
        print("✅ Found model file, loading...")
        model.load_state_dict(torch.load(MODEL_PATH))
        print("✅ Custom GoEmotions model loaded successfully")
    else:
        print("⚠️ Model file not found at expected location")
        print("⚠️ Using base BERT model for sentiment analysis")
        print("⚠️ Please ensure the model file is placed at:", MODEL_PATH)
        
    # Define Request Model
    model.load_state_dict(torch.load(model, map_location=torch.device("cpu")))
    model.eval()  # Set model to evaluation mode
    print(f"✅ Model initialized with {model.num_labels} labels")
    print("✅ Model Loaded Successfully!")

except Exception as e:
    print(f"❌ Error loading model: {str(e)}")
    print("⚠️ Falling back to base BERT model")
    # Initialize with base model as fallback
    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
    model.eval()





