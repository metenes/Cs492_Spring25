import torch
from transformers import BertTokenizer, BertForSequenceClassification
import numpy as np

# Load the model and tokenizer
model_path = "best_model.pt"  # Path to the saved model
model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
model.load_state_dict(torch.load(model_path))
model.eval()  # Set model to evaluation mode

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# Define the emotion labels
emotion_labels = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

# Function to predict emotions
def predict_emotions(text):
    # Tokenize the input text
    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)

    # Get model predictions
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().numpy()  # Apply sigmoid for multi-label probabilities

    # Define a threshold to determine emotion presence
    threshold = 0.3
    predictions = probabilities > threshold

    # Map predictions to emotion labels
    predicted_emotions = [emotion_labels[i] for i in range(len(predictions)) if predictions[i]]

    # Create a sorted list of emotions and their probabilities
    emotion_probability_mapping = [(emotion_labels[i], probabilities[i]) for i in range(len(probabilities))]
    sorted_emotions = sorted(emotion_probability_mapping, key=lambda x: x[1], reverse=True)

    return predicted_emotions, probabilities, sorted_emotions

# Provide the text directly in the script
if __name__ == "__main__":
    # Replace this with your text
    text = """
       Today was one of those days where everything seemed to fall into place, and I feel so grateful for it. I woke up feeling refreshed, and the sunlight streaming through my window was the perfect start to the morning. It reminded me how beautiful life can be when you take a moment to pause and appreciate the little things.

I had a productive day tackling my to-do list. It feels so satisfying to check off each item and know I'm moving closer to my goals. I even made progress on some challenging tasks that I had been putting off, which made me feel capable and resilient. It’s amazing how a small step forward can reignite motivation.

During lunch, I caught up with an old friend, and we had the best conversation. It’s so heartwarming to have people in my life who truly understand me. We laughed about silly memories and shared our dreams for the future—it was such a reminder of how important it is to nurture meaningful connections.

I also spent some time outdoors, enjoying the crisp air and the calming sounds of nature. It reminded me of how grounding it can be to simply be present in the moment. The trees looked so majestic with their branches swaying in the breeze, and I felt a deep sense of peace.

One of the highlights of my day was reflecting on how much I’ve grown. Life isn’t always easy, but I’m proud of how far I’ve come. I’ve learned to handle challenges with grace and to focus on the things that truly matter to me. I feel stronger, wiser, and more aligned with my purpose.

As the evening settles in, I feel a profound sense of contentment. There’s still so much I want to achieve, but I know I’m on the right path. I’m grateful for my health, my loved ones, and the opportunities ahead of me. Life feels full of promise, and I’m excited for what tomorrow might bring.

For now, I’m going to wind down with a good book and some tea—two of my favorite simple joys. I hope I can hold on to this feeling of gratitude and carry it with me into the days ahead.

Here’s to many more days like this!

       """

    # Predict emotions
    emotions, probs, sorted_emotions = predict_emotions(text)
    print("\nText:", text.strip())
    print("\nPredicted Emotions:", emotions)
    print("\nProbabilities:")
    for label, prob in zip(emotion_labels, probs):
        print(f"{label}: {prob:.4f}")

    print("\nSorted Emotion Probabilities:")
    for emotion, prob in sorted_emotions:
        print(f"{emotion}: {prob:.4f}")
