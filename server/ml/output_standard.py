import torch
from transformers import BertTokenizer, BertForSequenceClassification
import json

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


def predict_emotions(text, threshold=0.3):
    inputs = tokenizer(text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.sigmoid(logits).squeeze().numpy()

    predictions = probabilities > threshold

    predicted_emotions = [emotion_labels[i] for i in range(len(predictions)) if predictions[i]]

    emotion_probabilities = {emotion_labels[i]: float(probabilities[i]) for i in range(len(probabilities))}

    response = {
        "input_text": text,
        "predicted_emotions": predicted_emotions,
        "emotion_probabilities": emotion_probabilities,
        "top_emotions": sorted(emotion_probabilities.items(), key=lambda x: x[1], reverse=True)[:5]
    }

    return json.dumps(response, indent=4)  # Standardized JSON output


# Test entries
test_entries = [
    "I can't believe it! I finally got the promotion I’ve been working so hard for. When my boss called me into her office, I thought I was in trouble, but then she broke the news, and I couldn't stop smiling. Tonight, I'm going to celebrate with my family and friends—this is such a big milestone for me. Life feels amazing right now!",
    "I feel so heavy-hearted today. I had an argument with my best friend, and I said things I didn’t mean. I regret every word, but I’m scared to reach out and apologize. What if they don’t forgive me? I’ve been replaying the conversation in my head all day, and it just makes me feel worse. I hope I can fix this somehow.",
    "Tomorrow is the big presentation, and I feel so unprepared. My heart races every time I think about standing in front of everyone. What if I mess up? What if they ask questions I can’t answer? I keep telling myself to breathe and that I’ll be fine, but the anxiety just won’t go away.",
    "Every time I look at my partner, I feel so grateful to have them in my life. Today, they surprised me with my favorite flowers and a handwritten note. It’s not about the gifts but the thought behind them—it’s the little things they do that remind me how deeply I’m loved. I can’t wait to spend the rest of my life making them feel just as special.",
    "I can’t believe how rude some people can be. Today, a colleague took credit for my work in front of the entire team. I was so furious but didn’t want to make a scene. It’s so frustrating when people don’t respect others’ contributions. I need to find a way to address this without losing my temper.",
    "Today was a pretty average day. Nothing too exciting or disappointing happened. I worked on my usual tasks, took a short walk during lunch, and spent the evening watching TV. It was just another day in the routine of life—steady, calm, and uneventful.",
    "What a day! First, I spilled coffee all over my shirt just as I was leaving for work, making me late for the morning meeting. My boss gave me the side-eye the whole time, which made me feel so small. Then, to top it off, I accidentally deleted the presentation I had spent hours working on! I just wanted to scream in frustration. But somehow, I managed to laugh it off by the end of the day when my coworker showed me a backup file they had saved for me—thank goodness for them! Honestly, what a rollercoaster of a day.",
"This morning felt like a dream. I woke up early, made myself a cup of coffee, and enjoyed the peaceful sunrise on my balcony. Everything just felt so calm and perfect. Work started off great too—I finished a big task ahead of schedule, and my manager even complimented me during our morning meeting. I felt unstoppable, like I could handle anything. But then, in the afternoon, everything started to go wrong. I accidentally sent an email to the wrong client, and they weren’t happy about it. To make it worse, my manager called me out in front of the team, and I could feel the embarrassment creeping up my neck. By the end of the day, I felt drained and frustrated, questioning if I’m even good at my job."
]

# Predict emotions for each entry
if __name__ == "__main__":
    for i, entry in enumerate(test_entries, 1):
        print(f"\n--- Journal Entry {i} ---\n{entry}\n")
        output = predict_emotions(entry)
        print(f"Predicted Emotions: {output}")
