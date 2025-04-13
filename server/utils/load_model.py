import torch
from transformers import BertTokenizer, BertForSequenceClassification
import os
from pathlib import Path
import io

# ---------------------------------------
#  **Aws Analysis** --TODO
# ---------------------------------------

# Get the absolute path to the server directory
SERVER_DIR = Path(__file__).parent.parent
MODEL_PATH = SERVER_DIR / "ml" / "best_model_v2.pt"
TOKENIZER_NAME = "bert-base-uncased"  # Define the variable before usage

print(f"🔹 Looking for model at: {MODEL_PATH}")

try:
    # Initialize tokenizer
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
    
    # Initialize model with CPU device specification
    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    
    if MODEL_PATH.exists():
        print("✅ Found model file, loading...")
        # Load the state dict with proper error handling
        try:
            state_dict = torch.load(MODEL_PATH, map_location=torch.device('cpu'))
            model.load_state_dict(state_dict)
            print("✅ Custom GoEmotions model loaded successfully")
        except Exception as load_error:
            print(f"❌ Error loading model state: {str(load_error)}")
            print("⚠️ Using base BERT model as fallback")
    else:
        print("⚠️ Model file not found at expected location")
        print("⚠️ Using base BERT model for sentiment analysis")
        print("⚠️ Please ensure the model file is placed at:", MODEL_PATH)
        
    model.eval()  # Set model to evaluation mode
    print(f"✅ Model initialized with {model.num_labels} labels")

except Exception as e:
    print(f"❌ Error in model initialization: {str(e)}")
    print("⚠️ Falling back to base BERT model")
    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
    tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
    model.eval()

# Export the necessary components
__all__ = ['model', 'tokenizer']





