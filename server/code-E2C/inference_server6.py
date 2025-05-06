# ========================= inference_server2_chat.py =========================
from flask import Flask, request, jsonify
from botocore.exceptions import ClientError
import traceback
import numpy as np
import os, json, torch, boto3
from transformers import (
    BertTokenizer, BertForSequenceClassification,
    AutoTokenizer, AutoModelForCausalLM
)

# Emotion threshold definitions
EMOTION_THRESHOLDS = {
    "admiration": 0.5636, "amusement": 0.4558, "anger": 0.5269, "annoyance": 0.3604,
    "approval": 0.3807, "caring": 0.3923, "confusion": 0.4521, "curiosity": 0.4687,
    "desire": 0.6101, "disappointment": 0.4222, "disapproval": 0.3825, "disgust": 0.5353,
    "embarrassment": 0.4849, "excitement": 0.3857, "fear": 0.3244, "gratitude": 0.6607,
    "grief": 0.3913, "joy": 0.4491, "love": 0.3908, "nervousness": 0.5705,
    "optimism": 0.5039, "pride": 0.5252, "realization": 0.4292, "relief": 0.4243,
    "remorse": 0.4213, "sadness": 0.4301, "surprise": 0.3585, "neutral": 0.3779
}
EMOTIONS = list(EMOTION_THRESHOLDS.keys())

# App information that will be included in helper prompts
APP_INFO = """
    This app is a sentiment analysis assistant that helps users understand emotions in text.Our Sentiment-Aware Journaling Web App aims to support users in reflecting on their daily emotions and experiences through an innovative approach combining journaling and conversational AI. The. app includes two core sections: a freeform journal entry feature where users can document their
    feelings and thoughts, and a chatbot interface that engages users in conversation about their day.
    Both inputs are analyzed using natural language processing techniques to provide a detailed
    sentiment summary of the day.
    The app helps users identify recurring emotions or patterns in their thoughts, alerting them to trends
    that may require attention, such as ongoing anxiety or positivity shifts. Additionally, after each daily
    log, the app offers personalized suggestions, such as relaxation exercises or motivational activities,
    aimed at improving the user's mental well-being.

    Technologies, Frameworks, Languages, and Datasets:
    - Frontend: React.js or Vue.js for dynamic UI, Material-UI or Tailwind CSS for design.
    - Backend: Flask or Node.js for scalability, MongoDB for storing entries and emotion trends.
    - NLP: Hugging Face Transformers, GoEmotions dataset for emotion recognition, Rasa/Dialogflow
    for chatbot.

    - Recommendations: Scikit-learn for recommendation algorithms.
    - Security: JWT for authentication and SSL/TLS for secure handling.
    - Hosting: AWS, Heroku, or Google Cloud, Docker for containerization.
    Pitch:

    The Sentiment-Aware Journaling Web App blends journaling with AI-driven emotional insights and a
    conversational chatbot. Its standout feature is personalized emotional feedback, making it a
    personal mental wellness companion. By analyzing sentiment and providing actionable suggestions,
    it helps users manage stress or positivity trends, appealing to the growing self-care market.
    Features:
    - Analyze text for emotional content
    - Verify if sentiment labels match the text
    - Suggest alternative sentiment labels when needed
    - Guide users on how to use the app
    - Weekly / Monthly / Yearly Trends
    - Emotions over time
    - Percentage distributions
    - Emotion volatility based on all users' data (anonymized)
    - Topic-emotion correlation
    - General vs. specific emotional trends
    - Keyword-based emotion analysis

    App Navigation information
    - HomeScreen : Landing screen with quick access to journal, insights, and chatbot
    - JournalEntryScreen : Create, edit, or delete journal entries with emotion tagging
    - ChatScreen (Chatbot) : Emotion-aware assistant; provides motivation, coping advice, support
    - CheckInScreen : Daily mood check-ins
    - EmotionalTrendsScreen : Shows user-specific emotion trends over time
    - CommunityInsightsScreen  : Aggregated, anonymous community-wide emotional analytics
    - CameraCaptureScreen : Allows image capture for facial emotion analysis
    - SettingsScreen : Profile updates, theme toggle (dark/light), delete account, etc.
    - HelperAI (Floating Widget) : Universal floating assistant across all screens with knowledge access

    ### General App Questions
    - **What is Sentio?**: Sentio is an AI-powered journaling app that helps you understand your emotions through sentiment analysis of your journal entries and conversations.    
    - **How does Sentio work?**: The app analyzes the text you write in journal entries or conversations with our chatbot to identify emotions, patterns, and provide personalized insights and recommendations.
    - **Is Sentio free to use?**: Sentio offers a free basic version with limited entries and features. Premium features are available through subscription plans.
    - **Which devices support Sentio?**: Sentio is available on iOS and Android smartphones and tablets, with a web version accessible through most browsers.
    - **How much storage do I get?**: Free accounts include storage for 50 journal entries and 3 months of emotional data. Premium accounts have unlimited storage.
    - **Can I use Sentio offline?**: Yes, you can create journal entries offline. They will sync and be analyzed when you reconnect to the internet.

   ### User Experience
   - **How do I navigate between screens?**: Use the bottom navigation bar to access main sections. The sidebar menu (accessed by tapping the menu icon) provides access to additional features.
   - **Can I customize the app's appearance?**: Yes, you can switch between light and dark modes, select accent colors, and choose from several journal themes.
   - **How do I search my journal entries?**: Use the search icon in the Journal section to search by text, date, emotion tags, or locations.
   - **What are Insight Cards?**: These are AI-generated observations about your emotional patterns, displayed on your dashboard and in the Insights section.
   - **How do I set up reminders?**: Go to Settings > Notifications to configure journal reminders, check-in prompts, and insight alerts.
   - **Can I share my insights with others?**: You can generate shareable reports or screenshots of insights without revealing your private journal entries.

   ### Journaling Features
   - **What types of journal entries can I create?**: You can create free-form text entries, guided entries using prompts, voice entries, photo entries with captions, and quick emotion check-ins.
   - **How long can journal entries be?**: There's no character limit for journal entries. Write as much or as little as you like.
   - **Can I add formatting to my entries?**: Yes, you can use bold, italic, lists, and headings in your journal entries.
   - **How do I add photos to my entries?**: Tap the photo icon in the journal entry screen to upload photos from your gallery or take new ones.
   - **Can I create journal templates?**: Premium users can create and save custom journal templates with personalized prompts.
   - **How do I organize my journal entries?**: You can add tags, create collections, and filter entries by date, emotion, or custom categories.

   ### Emotion Analysis
   - **How accurate is the emotion analysis?**: Our AI typically identifies primary emotions with 85-90% accuracy. Secondary emotions and nuances may be less precise.
   - **What emotions can Sentio detect?**: Sentio can detect 27 distinct emotions including joy, sadness, fear, anger, surprise, disgust, anticipation, trust, plus more nuanced emotions like nostalgia, contentment, and anxiety.
   - **Can I correct misidentified emotions?**: Yes, you can manually adjust emotion tags if you feel the AI misinterpreted your entry. This feedback helps our system improve.    
   - **How does the emotion intensity scale work?**: Emotions are rated on a 1-10 scale, where 1 is barely perceptible and 10 is extremely intense.
   - **Can Sentio detect mixed emotions?**: Yes, the system identifies primary and secondary emotions in each entry, recognizing that we often experience multiple feelings simultaneously.
   - **How does Sentio handle sarcasm or humor?**: The AI is trained to recognize contextual cues for sarcasm and humor, though these can sometimes be misinterpreted. You can always correct misidentifications.

   ### Insights and Trends
   - **How are my emotional trends calculated?**: Trends are calculated by analyzing the frequency, intensity, and patterns of emotions across your entries over time.
   - **What's an Emotion Baseline?**: Your Emotion Baseline is your typical emotional state calculated from your first month of entries, used as a reference point for tracking changes.
   - **What is the Volatility Index?**: This measures how much your emotions fluctuate within a given time period, helping identify emotional stability or instability.
   - **How do Topic Correlations work?**: The system identifies topics or themes in your writing and correlates them with specific emotions to help you understand your emotional triggers.
   - **What are Emotional Cycles?**: These are recurring patterns in your emotional states, such as weekly or monthly cycles that might be influenced by external factors.
   - **How far back does my emotional data go?**: Free users can access 3 months of historical data, while premium users have unlimited historical access.

   ### Chatbot Features
  - **What can I talk about with the chatbot?**: You can discuss your feelings, day-to-day experiences, challenges, or ask for guidance on using the app.
  - **Does the chatbot remember previous conversations?**: Yes, the chatbot maintains context from recent conversations to provide more personalized responses.
  - **Is my conversation with the chatbot private?**: Yes, all conversations are private and encrypted. They're only used to provide you with insights.
  - **Can the chatbot help during emotional distress?**: The chatbot can offer coping strategies and support, but will suggest professional help for serious concerns.
  - **How do I know if I'm talking to AI or a human?**: All conversations are with our AI assistant. For human support, please use the "Contact Support" option in Settings.       
  - **Can I give feedback on chatbot responses?**: Yes, after each conversation you can rate the helpfulness of the chatbot and provide specific feedback.

  ### Recommendations
  - **How personalized are the recommendations?**: Recommendations are based on your emotional patterns, stated preferences, and activities that have positively impacted your mood in the past.
  - **What types of activities are recommended?**: Recommendations include mindfulness exercises, physical activities, creative outlets, social connections, and self-care practices.
  - **Can I customize the recommendations?**: You can rate recommendations and indicate preferences in your profile to receive more tailored suggestions.
  - **How often are new recommendations generated?**: New recommendations are generated daily based on your recent emotional state and historical patterns.
  - **Can I save recommendations for later?**: Yes, you can bookmark recommendations to a favorites list for future reference.
  - **Are there different recommendations for different emotions?**: Yes, recommendations are tailored to specific emotional states, such as calming activities for anxiety or energizing activities for low mood.

### Privacy and Security
- **Is my journal data secure?**: Yes, all journal entries are encrypted both in transit and at rest. Only you can access your private entries.
- **How is my emotional data used?**: Your emotional data is used solely to generate personal insights and recommendations. Aggregated, anonymized data may be used to improve the app's algorithms.
- **Can I delete my data?**: Yes, you can delete individual entries or your entire account and associated data at any time through Settings > Privacy > Data Management.
- **Does Sentio share my data with third parties?**: No, we do not sell or share your personal data with third parties. Anonymous, aggregated statistics may be used for research purposes if you opt in.
- **What happens if I lose my device?**: Your data is securely backed up to your account. You can recover it by signing in on a new device.
- **Is my data used for advertising?**: No, Sentio does not use your personal data for advertising purposes.

### Accessibility
- **Does Sentio work with screen readers?**: Yes, Sentio is fully compatible with screen readers like VoiceOver and TalkBack.
- **Can I use voice commands?**: Premium users can navigate the app and create journal entries using voice commands.
- **Are there keyboard shortcuts?**: Yes, the web version offers keyboard shortcuts for common actions.
- **Can I resize text in the app?**: Yes, you can adjust text size in Settings > Accessibility > Text Size.
- **Is there high contrast mode?**: Yes, enable high contrast mode in Settings > Accessibility > Display.
- **Can I use the app without typing?**: Yes, you can use voice-to-text for journal entries and chatbot conversations.

### Account Management
- **How do I create an account?**: Tap "Sign Up" on the welcome screen and follow the prompts to create an account using email or social media login.
- **Can I change my username?**: Yes, you can change your username in Settings > Account > Profile Information.
- **How do I reset my password?**: Use the "Forgot Password" link on the login screen, or go to Settings > Account > Security > Change Password.
- **Can I have multiple journals?**: Premium users can create up to 5 separate journals within one account.
- **How do I upgrade to Premium?**: Go to Settings > Subscription > Upgrade to view and select available premium plans.
- **Can I cancel my subscription?**: Yes, go to Settings > Subscription > Manage Subscription to cancel. You'll retain premium features until the end of your billing period.      

### Troubleshooting
- **The app crashed, did I lose my entry?**: No, entries are auto-saved every 30 seconds. Reopen the app to recover your draft.
- **Why isn't my emotion analysis showing up?**: Emotion analysis may take a few moments to process. If it's been over 5 minutes, try refreshing the page or restarting the app.   
- **My reminders aren't working**: Check your device notification settings to ensure Sentio has permission to send notifications.
- **The chatbot isn't responding**: If the chatbot seems unresponsive, try restarting the conversation or check your internet connection.
- **Why can't I see my photos?**: Check that Sentio has permission to access your photos in your device settings.
- **How do I report a bug?**: Go to Settings > Help & Support > Report a Problem to submit a bug report.

### Special Features
- **What is Guided Journaling?**: These are structured journaling sessions with prompts designed for specific emotional needs or personal growth areas.
- **How does the Gratitude Practice work?**: This feature prompts you to record things you're grateful for, helping to build a positive mindset.
- **What is the Crisis Support feature?**: If the app detects concerning language or patterns, it provides resources for immediate mental health support.
- **Can I use Sentio with my therapist?**: Yes, you can generate therapy reports to share with mental health professionals, highlighting key emotional trends.
- **What is the Community Forum?**: This is an optional space to connect with other Sentio users, share experiences, and discover journaling tips.
- **How does the Progress Tracking feature work?**: Set emotional wellbeing goals and track your progress through personalized metrics and milestone celebrations.

## PRACTICAL USAGE SCENARIOS

### Daily Usage Pattern
- **Morning Check-in**: Quick emotion check to start the day (2 minutes)
- **Midday Reflection**: Short journal entry about current challenges (5 minutes)
- **Evening Review**: Comprehensive journal entry reflecting on the day (10 minutes)
- **Weekly Review**: Sunday review of the week's emotional trends (15 minutes)
- **Monthly Insights**: First-of-month review of progress and patterns (20 minutes)

### Common Use Cases
- **Stress Management**: Track stress triggers and effective coping mechanisms
- **Mood Disorders**: Monitor emotional patterns relevant to depression or anxiety
- **Personal Growth**: Identify recurring themes in thoughts and behaviors
- **Therapy Supplement**: Generate insights to discuss during therapy sessions
- **Emotional Intelligence**: Develop greater awareness of emotional responses
- **Gratitude Practice**: Cultivate positive focus through regular gratitude journaling
- **Conflict Resolution**: Process interpersonal conflicts through guided reflection
- **Goal Achievement**: Track emotional states during progress toward personal goals

### Navigation Tips
- **Quick Actions**: Swipe right on the home screen for quick journal entry creation
- **Gesture Controls**: Swipe left on entries to edit, right to delete
- **Shortcuts**: Long-press the app icon for quick access to common features
- **Widget Support**: Add the Sentio widget to your home screen for one-tap journaling
- **Split Screen**: On tablets, use split screen to journal while viewing previous entries
- **Voice Commands**: Premium users can say "New entry" or "How am I feeling this week?"
- **Notification Center**: Access recent insights and reminders by pulling down from the top
- **Search Shortcuts**: Use hashtags (#) for emotions and (@) for people in search queries

### Best Practices
- **Consistency**: Journal at the same times each day to build a habit
- **Honesty**: Be candid in entries for most accurate emotional analysis
- **Specificity**: Include specific details about situations for better insights
- **Balance**: Record both positive and challenging experiences
- **Review**: Schedule time to review insights and reflect on patterns
- **Experiment**: Try different journaling styles to find what works best
- **Integrate**: Combine journaling with other wellbeing practices like meditation
- **Patience**: Allow 2-3 weeks for meaningful patterns to emerge in your data

### Feature Combinations
- **Journal + Chatbot**: Process thoughts in your journal, then discuss with the chatbot
- **Check-ins + Trends**: Use multiple daily check-ins to create detailed emotional timelines
- **Camera + Journal**: Capture meaningful moments with photos to enhance written entries
- **Community + Insights**: Compare your patterns with anonymized community trends
- **Recommendations + Calendar**: Schedule suggested activities in your calendar
- **Guided Prompts + Analytics**: Use structured prompts for more consistent analysis
- **Facial Analysis + Text Analysis**: Compare emotional expression across modalities
- **Reminders + Location**: Set location-based reminders for emotional check-ins

## HELPER GUIDANCE TIPS

When assisting users, keep these principles in mind:
- **Be Concise**: Provide clear, direct answers to questions
- **Be Supportive**: Maintain a warm, understanding tone
- **Be Informative**: Offer factual information about app features
- **Be Navigational**: Help users find what they're looking for within the app
- **Be Solution-Oriented**: Focus on resolving issues quickly
- **Be Privacy-Conscious**: Emphasize data security and privacy features
- **Be Educational**: Help users understand the potential benefits of features
- **Be Responsive**: Acknowledge specific aspects of user questions

If asked about topics outside the app's scope:
- Gently redirect to relevant app features
- Avoid giving medical, legal, or professional advice
- Suggest using the journal to explore the topic further
- Recommend appropriate in-app resources if available

"""

# Init Flask and AWS
app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"
s3 = boto3.client("s3")

# Load models
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Emotion detection (BERT)
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# Chat model (TinyLlama)
chat_tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")
chat_model = AutoModelForCausalLM.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0").to(device)

# Fix tokenizer if missing pad token
if chat_tokenizer.pad_token is None:
    chat_tokenizer.pad_token = chat_tokenizer.eos_token

# Model cache
last_user_id, cached_model = None, None

# ----------------------------- Chat Generator -----------------------------
def generate_response(user_message, emotion_context, tone = "neutral", prompt = None):
    print("Generating supportive response based on emotion...")

    # Construct prompt with TinyLlama chat format
    # prompt = (
    #    "<|system|>You are a compassionate and knowledgeable mental health assistant. "
    #    "Your goal is to provide thoughtful, emotionally supportive, and deeply helpful responses to user "
    #    "Always give long and detailed answers, filled with empathy, guidance, and encouragement. You answer directly to User "
    #    "Use a warm, conversational tone. Do not be short or vague. Address the user like a friend who's reaching out for support."
    #    "<|user|>The user feels " + emotion_context + " and said: \"" + user_message + "\" and you reply as\n<|assistant|>"
    #)
    # prompt
    if ( prompt is None ):
        prompt = (
         "<|system|>You are a compassionate and knowledgeable mental health assistant, who just give a response to users message with long detailed analysis."
         f"<|system|>You will answer the question with {tone} tone."
         f"<|system|>You know that user fell {emotion_context}. Give answer accordingly"
         f"<|user|>{user_message}.<|assistant|>"
        )

    print("Prompt:", prompt)

    # Use chat_tokenizer (correct tokenizer for TinyLlama)
    inputs = chat_tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=512)
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)

    output_ids = chat_model.generate(
        input_ids=input_ids,
        attention_mask=attention_mask,
        max_new_tokens=150,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
        pad_token_id=chat_tokenizer.eos_token_id
    )

    # Only decode newly generated tokens
    response = chat_tokenizer.decode(output_ids[0][input_ids.shape[-1]:], skip_special_tokens=True)
    print("Response:", response)

    return response.strip()

# ----------------------------- sentiment model API -----------------------------

def compute_sentiment(user_id, text):
        global last_user_id, cached_model  # Add this line to access global variables
        # Load emotion model (user-specific or fallback)
        model_key = f"models/{user_id}/model_best.pt"
        local_path = f"/tmp/{user_id}_model_best.pt"

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

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Split text into segments
        segments = text.split(". ")
        all_emotions = []

        # Analyze each segment
        for segment in segments:
            if segment.strip():
                # Tokenize the segment
                inputs = tokenizer(segment, return_tensors="pt", padding="max_length",
                                truncation=True, max_length=128)

                # Get model prediction for segment
                with torch.no_grad():
                    outputs = cached_model(**inputs)
                    logits = outputs.logits
                    probabilities = torch.sigmoid(logits).squeeze()

                    # Convert to numpy for easier handling
                    if len(probabilities.shape) == 0:
                        probabilities = probabilities.unsqueeze(0)
                    probs_np = probabilities.cpu().numpy()

                # Store emotions for this segment using trained thresholds
                for idx, prob in enumerate(probs_np):
                    threshold = EMOTION_THRESHOLDS[EMOTIONS[idx]]
                    if prob > threshold:
                        all_emotions.append({
                            "code": idx,
                            "label": EMOTIONS[idx],
                            "score": float(prob)
                        })

        # If no emotions found in any segment, analyze the full text
        if not all_emotions:
            inputs = tokenizer(text, return_tensors="pt", padding="max_length",
                            truncation=True, max_length=128)

            with torch.no_grad():
                outputs = cached_model(**inputs)
                logits = outputs.logits
                probabilities = torch.sigmoid(logits).squeeze()

                if len(probabilities.shape) == 0:
                    probabilities = probabilities.unsqueeze(0)
                probs_np = probabilities.cpu().numpy()

            # Get the emotion with highest probability relative to its threshold
            threshold_adjusted_probs = [
                prob / EMOTION_THRESHOLDS[EMOTIONS[idx]]
                for idx, prob in enumerate(probs_np)
            ]
            max_idx = np.argmax(threshold_adjusted_probs)
            all_emotions.append({
                "code": int(max_idx),
                "label": EMOTIONS[max_idx],
                "score": float(probs_np[max_idx])
            })

        # Sort all emotions by score and remove duplicates (keep highest score for each emotion)
        seen_emotions = {}
        for emotion in all_emotions:
            label = emotion["label"]
            if label not in seen_emotions or emotion["score"] > seen_emotions[label]["score"]:
                seen_emotions[label] = emotion

        # Convert back to list and sort
        emotions = list(seen_emotions.values())
        emotions.sort(key=lambda x: x['score'], reverse=True)

        # return emotions
        return emotions

@app.route("/sentiment", methods=["POST"])
def sentiment():
    try:
        print("🔵 Starting sentiment analysis")
        data = request.get_json()
        text = data.get('text')
        user_id = data.get("user_id")

        if not user_id or not text:
            return jsonify({"error": "user_id and message required"}), 400

        # Sentiment analysis with new model
        emotions = compute_sentiment(user_id, text)

        print(f"✅ Detected emotions: {emotions} for text {text}")

        return jsonify({
            "text": text,
            "emotions": emotions
        })

    except Exception as e:
        print(f"❌ Error in sentiment analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to analyze sentiment"}), 500

@app.route("/analyze-last", methods=["POST"])
def analyze_sentiment_last():
    global last_user_id, cached_model
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        tone = data.get("tone")

        raw_message = data.get("message", "").strip()
        chat_id = data.get("chat_id")

        # Extract clean message
        message = ""
        for line in reversed(raw_message.split("\n")):
            if line.startswith("User:"):
                message = line.replace("User:", "").strip()
                break
        if not message:
            message = raw_message

        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400

        # Use compute_sentiment to get emotions
        emotions = compute_sentiment(user_id, message)

        if not emotions:
            return jsonify({"error": "No emotion detected"}), 200

        # Pick top emotion
        top_emotion = emotions[0]
        predicted_emotion = top_emotion["label"]
        confidence = top_emotion["score"]

        print(f"Predicted emotion: {predicted_emotion} ({confidence:.2f})")

        # Generate AI reply
        response_text = generate_response(message, predicted_emotion, tone)

        return jsonify({
            "user_id": user_id,
            "chat_id": chat_id,
            "message": message,
            "predicted_emotion": predicted_emotion,
            "confidence": confidence,
            "response": response_text,
            "scores": {e["label"]: e["score"] for e in emotions}
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Exception occurred", "details": str(e)}), 500


@app.route("/analyze-new", methods=["POST"])
def analyze_sentiment_new():
    global last_user_id, cached_model
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        raw_message = data.get("message", "").strip()
        chat_id = data.get("chat_id")

        # Extract clean message
        message = ""
        for line in reversed(raw_message.split("\n")):
            if line.startswith("User:"):
                message = line.replace("User:", "").strip()
                break
        if not message:
            message = raw_message

        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400

        # Load emotion model (user-specific or fallback)
        model_key = f"models/{user_id}/model_new.pt"
        local_path = f"/tmp/{user_id}_model_new.pt"

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

        # Predict emotion
        inputs = tokenizer(message, return_tensors="pt", truncation=True, padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = cached_model(**inputs)
            scores = torch.softmax(outputs.logits, dim=1).squeeze().cpu().numpy()

        emotion_scores = {emotion: float(score) for emotion, score in zip(EMOTIONS, scores)}
        predicted_emotion = max(emotion_scores, key=emotion_scores.get)
        confidence = emotion_scores[predicted_emotion]

        print(f"Predicted emotion: {predicted_emotion} ({confidence:.2f})")

        # Generate AI reply
        response_text = generate_response(message, predicted_emotion)

        return jsonify({
            "user_id": user_id,
            "chat_id": chat_id,
            "message": message,
            "predicted_emotion": predicted_emotion,
            "confidence": confidence,
            "response": response_text,
            "scores": emotion_scores
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Exception occurred", "details": str(e)}), 500


# ----------------------------- analyze API -----------------------------

@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    global last_user_id, cached_model
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        raw_message = data.get("message", "").strip()
        chat_id = data.get("chat_id")

        # Extract clean message
        message = ""
        for line in reversed(raw_message.split("\n")):
            if line.startswith("User:"):
                message = line.replace("User:", "").strip()
                break
        if not message:
            message = raw_message

        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400

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

        # Predict emotion
        inputs = tokenizer(message, return_tensors="pt", truncation=True, padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = cached_model(**inputs)
            scores = torch.softmax(outputs.logits, dim=1).squeeze().cpu().numpy()

        emotion_scores = {emotion: float(score) for emotion, score in zip(EMOTIONS, scores)}
        predicted_emotion = max(emotion_scores, key=emotion_scores.get)
        confidence = emotion_scores[predicted_emotion]

        print(f"Predicted emotion: {predicted_emotion} ({confidence:.2f})")

        # Generate AI reply
        response_text = generate_response(message, predicted_emotion)

        return jsonify({
            "user_id": user_id,
            "chat_id": chat_id,
            "message": message,
            "predicted_emotion": predicted_emotion,
            "confidence": confidence,
            "response": response_text,
            "scores": emotion_scores
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Exception occurred", "details": str(e)}), 500

# ----------------------------- prompt API -----------------------------

def generate_prompt_response(prompt):
    print("Generating prompt response...")
    print("Prompt:", prompt)

    # Use chat_tokenizer (correct tokenizer for TinyLlama)
    inputs = chat_tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=512)
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)

    output_ids = chat_model.generate(
        input_ids=input_ids,
        attention_mask=attention_mask,
        max_new_tokens=150,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
        pad_token_id=chat_tokenizer.eos_token_id
    )

    # Only decode newly generated tokens
    response = chat_tokenizer.decode(output_ids[0][input_ids.shape[-1]:], skip_special_tokens=True)
    print("Response:", response)

    return response.strip()

# ----------------------------- helper API -----------------------------

@app.route("/helper", methods=["POST"])
def helper_ai():
    global last_user_id, cached_model
    try:
        data = request.get_json()
        message = data.get("message")

        prompt = (
            "<|system|>You are an app navigater who guide user with respect to their question. Your role is to guide users with their questions about the app features, navigation, and functionalities."
            "<|system|>You will take a question and give answer with your knowledge"
            f"<|system|>You can use knowledge: {APP_INFO}"
            "<|system|>If you do not know answer, you can make educated guess based on app"
            "<|system|>You will only give direct answer, no other output"
            f"<|User|>  {message}."
        )
        # Generate AI reply
        print("prompt : ", prompt)
        response_text = generate_prompt_response(prompt)
        print("response : ", response_text)
        return jsonify({
            "message": message,
            "response": response_text,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Exception occurred", "details": str(e)}), 500

# ----------------------------- Validator API  -----------------------------
@app.route("/verify-sentiment-chat", methods=["POST"])
def validate_sentiment():
    try:
        data = request.get_json()
        sentiment = data.get("sentiment") # sentiment : string[]
        message = data.get("message")

        if not sentiment or not message:
            return jsonify({"error": "sentiment and message required"}), 400

        # Convert sentiment list to string for prompt
        sentiment_str = ", ".join(sentiment) if isinstance(sentiment, list) else sentiment

        prompt = (
            f"<|system|>You are a sentiment verifier who checks if given message's content and sentiments match.\n"
            f"<|system|>If sentiments and message's content match, return the same sentiments.\n"
            f"<|system|>If sentiments and message's content do not match, find and return new matching sentiments.\n"
            f"<|system|>You will only respond with sentiment labels, separated by commas if there are multiple.\n"
            f"<|user|>Message: {message}\nGiven sentiments: {sentiment_str}\n"
            f"<|assistant|>"
        )

        # Generate AI reply
        new_sentiment = generate_prompt_response(prompt)

        # Convert comma-separated response to list
        sentiment_list = [s.strip() for s in new_sentiment.split(',')]

        return jsonify({
            "message": message,
            "sentiment": sentiment_list,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Exception occurred", "details": str(e)}), 500

# ----------------------------- Entry Point -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)