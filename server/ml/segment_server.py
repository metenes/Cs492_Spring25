import torch
from transformers import BertTokenizer, BertForSequenceClassification
import numpy as np

# Load the model and tokenizer
model_path = "best_model.pt"  # Path to the saved model
model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
model.eval()  # Set model to evaluation mod

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# Define the emotion labels
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Standardized function for predicting emotions
def predict_emotions(text, threshold=0.3):
    """
    Predicts emotions for the input text.

    Args:
        text (str): Input text to analyze.
        threshold (float): Probability threshold for detecting an emotion.

    Returns:
        dict: Standardized structured output.
    """
    # Tokenize input text
    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)

    # Get model predictions
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().tolist()  # Convert to Python list

    # Identify emotions above the threshold
    detected_emotions = [emotion_labels[i] for i, prob in enumerate(probabilities) if prob > threshold]

    # Store probabilities in a dictionary format
    emotion_probabilities = {emotion_labels[i]: round(probabilities[i], 4) for i in range(len(probabilities))}

    # Sort top emotions
    sorted_emotions = sorted(emotion_probabilities.items(), key=lambda x: x[1], reverse=True)

    return {
        "input_text": text,
        "predicted_emotions": detected_emotions,
        "sorted_top_emotions": {emotion: prob for emotion, prob in sorted_emotions[:5]},  # Top 5 as dict
        "all_emotion_probabilities": emotion_probabilities
    }


# Standardized function with segmentation
def predict_emotions_with_segments(text, threshold=0.3):
    """
    Predicts emotions for segmented text (sentence-level analysis).

    Args:
        text (str): Input text to analyze.
        threshold (float): Probability threshold for detecting an emotion.

    Returns:
        dict: Standardized results with per-sentence emotions and overall detected emotions.
    """
    # Split text into segments (sentence-based)
    segments = text.split(". ")
    sentence_results = []  # Store sentence-level emotions
    aggregated_emotions = set()  # Track unique emotions across sentences

    for segment in segments:
        if segment.strip():  # Ignore empty segments
            result = predict_emotions(segment, threshold)
            sentence_results.append({
                "sentence": segment,
                "predicted_emotions": result["predicted_emotions"],
                "sorted_top_emotions": result["sorted_top_emotions"]
            })
            aggregated_emotions.update(result["predicted_emotions"])

    return {
        "input_text": text,
        "overall_predicted_emotions": list(aggregated_emotions),  # Unique emotions
        "sentence_level_predictions": sentence_results
    }


# Test entries
test_entries = [
    "I can't believe it! I finally got the promotion I’ve been working so hard for. "
    "When my boss called me into her office, I thought I was in trouble, but then she broke the news, and I couldn't stop smiling. "
    "Tonight, I'm going to celebrate with my family and friends—this is such a big milestone for me. Life feels amazing right now!"
]

# Predict emotions for each entry
if __name__ == "__main__":
    for i, entry in enumerate(test_entries, 1):
        print(f"\n--- Journal Entry {i} ---\n{entry}\n")

        # Without segmentation (standardized output)
        result = predict_emotions(entry)
        print("\nWithout Segmentation:")
        print(f"Predicted Emotions: {result['predicted_emotions']}")
        print("\nTop 5 Emotions with Probabilities:")
        for emotion, prob in result["sorted_top_emotions"].items():
            print(f"{emotion}: {prob:.4f}")

        # With segmentation (standardized output)
        segmented_result = predict_emotions_with_segments(entry)
        print("\nWith Segmentation:")
        print(f"Overall Predicted Emotions: {segmented_result['overall_predicted_emotions']}")
        print("\nSentence-Level Predictions:")
        for sentence_info in segmented_result["sentence_level_predictions"]:
            print(f"Sentence: {sentence_info['sentence']}")
            print(f"Predicted Emotions: {sentence_info['predicted_emotions']}")
            print(f"Top Emotions: {sentence_info['sorted_top_emotions']}\n")
