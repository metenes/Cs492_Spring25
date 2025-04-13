import json
import torch
import os
from transformers import BertTokenizer, BertForSequenceClassification

# Setup
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

def model_fn(model_dir):
    model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(emotion_labels))
    model_path = os.path.join(model_dir, "model.pt")
    model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
    model.eval()
    return model

def input_fn(request_body, request_content_type):
    return json.loads(request_body)

def predict_fn(input_data, model):
    text = input_data.get("message", "")
    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().numpy()
    predictions = probabilities > 0.3
    predicted_emotions = [emotion_labels[i] for i, p in enumerate(predictions) if p]
    emotion_probabilities = {emotion_labels[i]: float(probabilities[i]) for i in range(len(probabilities))}
    return {
        "input_text": text,
        "predicted_emotions": predicted_emotions,
        "emotion_probabilities": emotion_probabilities,
        "top_emotions": sorted(emotion_probabilities.items(), key=lambda x: x[1], reverse=True)[:5]
    }

def output_fn(prediction, content_type):
    return json.dumps(prediction)
