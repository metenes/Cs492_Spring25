import torch
from transformers import BertTokenizer, BertForSequenceClassification

# Define emotion labels
EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Global variables for lazy loading
_model = None
_tokenizer = None

def load_model(model_path="best_model.pt"):
    """
    Lazily loads the model and tokenizer (only when needed).
    
    Args:
        model_path (str): Path to the trained model file.

    Returns:
        model (torch.nn.Module): Loaded PyTorch model.
        tokenizer (BertTokenizer): Pre-trained tokenizer.
    """
    global _model, _tokenizer

    if _model is None or _tokenizer is None:
        _model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
        _model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
        _model.eval()

        _tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

    return _model, _tokenizer

def predict_emotions(text, threshold=0.3):
    """
    Predicts emotions for the input text.

    Args:
        text (str): Input text to analyze.
        threshold (float): Probability threshold for detecting an emotion.

    Returns:
        dict: Structured output with detected emotions and probabilities.
    """
    model, tokenizer = load_model()

    # Tokenize input text
    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)

    # Get model predictions
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().tolist()

    # Identify emotions above the threshold
    detected_emotions = [EMOTION_LABELS[i] for i, prob in enumerate(probabilities) if prob > threshold]

    # Store probabilities in a dictionary
    emotion_probabilities = {EMOTION_LABELS[i]: round(probabilities[i], 4) for i in range(len(probabilities))}

    # Sort top emotions
    sorted_emotions = sorted(emotion_probabilities.items(), key=lambda x: x[1], reverse=True)

    return {
        "input_text": text,
        "predicted_emotions": detected_emotions,
        "sorted_top_emotions": dict(sorted_emotions[:5]),  # Top 5 as dict
        "all_emotion_probabilities": emotion_probabilities
    }

def predict_emotions_with_segments(text, threshold=0.3):
    """
    Predicts emotions for segmented text (sentence-level analysis).

    Args:
        text (str): Input text to analyze.
        threshold (float): Probability threshold for detecting an emotion.

    Returns:
        dict: Structured results with per-sentence emotions and overall detected emotions.
    """
    # Split text into segments (sentence-based)
    segments = text.split(". ")
    sentence_results = []
    aggregated_emotions = set()

    for segment in segments:
        if segment.strip():
            result = predict_emotions(segment, threshold)
            sentence_results.append({
                "sentence": segment,
                "predicted_emotions": result["predicted_emotions"],
                "sorted_top_emotions": result["sorted_top_emotions"]
            })
            aggregated_emotions.update(result["predicted_emotions"])

    return {
        "input_text": text,
        "overall_predicted_emotions": list(aggregated_emotions),
        "sentence_level_predictions": sentence_results
    }
