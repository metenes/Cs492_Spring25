# ========================= inference_server.py (on EC2) =========================
import os, json, torch, boto3
from flask import Flask, request, jsonify
from transformers import BertTokenizer, BertForSequenceClassification
from botocore.exceptions import ClientError
# LLM 
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

app = Flask(__name__)
BUCKET = "sentiobucket"
BASE_MODEL_KEY = "models/model.pt"
LABELS = ["admiration", "amusement", "anger", "annoyance", "approval", "caring", "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love", "nervousness", "optimism", "pride", "realization", "relief", "remorse", "sadness", "surprise", "neutral"]

s3 = boto3.client("s3")
# Emotion model 
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# LLM 
chat_tokenizer = AutoTokenizer.from_pretrained("tiiuae/falcon-rw-1b", trust_remote_code=True)
chat_model = AutoModelForCausalLM.from_pretrained("tiiuae/falcon-rw-1b", trust_remote_code=True)
chat_pipeline = pipeline("text-generation", model=chat_model, tokenizer=chat_tokenizer, device=0 if torch.cuda.is_available() else -1)

# For fast response 
last_user_id, cached_model = None, None

@app.route("/predict", methods=["POST"])
def predict():
    print("inferene/predict started")
    global last_user_id, cached_model
    data = request.get_json()
    user_id, message, chat_id  = data.get("user_id"), data.get("message"), data.get("chat_id")
    print("message reviced to Predict : {}".format(message))
    if not user_id or not message:
        return jsonify({"error": "user_id and message required"}), 400
    model_key = "models/{}/model.pt".format(user_id)
    local_path = "/tmp/{}_model.pt".format(user_id)
    print("model fetch started")
    try:
        if (last_user_id is  None or last_user_id != user_id or cached_model is  None):
            try:
                print("downloading the model ...")
                s3.download_file(BUCKET, model_key, local_path)
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    s3.copy_object(Bucket=BUCKET, CopySource="{}/{}".format(BUCKET, BASE_MODEL_KEY), Key=model_key)
                    s3.download_file(BUCKET, model_key, local_path)
            print("model saved to the cache_model variable ...")
            model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=len(LABELS))
            state_dict = torch.load(local_path, map_location="cpu")
            model.load_state_dict(state_dict, strict=False)
            model.eval()
            cached_model = model
            last_user_id = user_id
        print("model fetch done\nstart generating respose {}".format(message))

        # cached_model.load_state_dict(state_dict, strict=False)
        inputs = tokenizer(message, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
        print("generating respose with inputs {}".format(inputs))
        with torch.no_grad():
            logits = cached_model(**inputs).logits
            probs = torch.sigmoid(logits).squeeze().numpy()
        # Define a threshold to determine emotion presence
        threshold = 0.3
        # predictions = probs > threshold
        # top = sorted([(LABELS[i], float(probs[i])) for i in range(len(probs))], key=lambda x: x[1], reverse=True)[:5]
        top = sorted([(LABELS[i], float(probs[i])) for i in range(len(probs))], key=lambda x: x[1], reverse=True)[:5]
        predicted_emotions = [LABELS[i] for i in range(len(probs)) if probs[i] > threshold]
        print("generating response done: {}".format(top))
        # emotions = [i for i, p in enumerate(probabilities) if p > 0.3]
        # predicted_emotions = [emotion_labels[i] for i in range(len(predictions)) if predictions[i]]
        # emotion_probability_mapping = [(emotion_labels[i], probs[i]) for i in range(len(probs))]
        # sorted_emotions = sorted(emotion_probability_mapping, key=lambda x: x[1], reverse=True)

        # Chat response 
        print("generating emotion respose done: {} Chat response started".format(top))
        # --------- NEW SECTION: Generate Chatbot Reply ---------
        emotions_str = ", ".join(predicted_emotions[:3]) if predicted_emotions else "neutral"
        # promt for the pre-trained 
        prompt = (
            "You are a friendly and supportive mental health assistant.\nThe user just said: \"{}\"\n.The user's emotional state includes: {}.\nHow would you support or reply to them?".format(message,emotions_str)
        )
        print("chat prompt to be given: {}".format(prompt))

        chat_output = chat_pipeline(prompt, max_new_tokens=150, do_sample=True, temperature=0.7)[0]['generated_text']
        chatbot_reply = chat_output.split("How would you support or reply to them?")[-1].strip()
        print("generating Chat response done : {}".format(chatbot_reply))

        print("generating respose done :\n emotion: {},\n chat: {}".format(top,chatbot_reply))
        return jsonify({
            "user_id": user_id,
            "input_text": message,
            "predicted_emotions": predicted_emotions,
            "emotion_probabilities": {LABELS[i]: float(probs[i]) for i in range(len(probs))},
            "top_emotions": top,
            "chat_response": chatbot_reply
        })
    
    except Exception as e:
        print("error happened {}".format(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)