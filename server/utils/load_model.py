from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# ✅ Define model loading function
def load_model():
    try:
        TOKENIZER_NAME = "bert-base-uncased"  # Define the variable before usage
        tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_NAME)
        model = AutoModelForCausalLM.from_pretrained(TOKENIZER_NAME)

        # If using a custom fine-tuned model, uncomment the line below:
        # model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device("cpu")))

        model.eval()
        print("✅ Model Loaded Successfully!")

        return tokenizer, model
    except Exception as e:
        print(f"❌ Model Load Error: {e}")
        return None, None

# ✅ Load model when the module is imported
tokenizer, model = load_model()
