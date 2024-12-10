from flask import Flask, request, jsonify
from ml.sentiment_model import load_model, predict_sentiment

app = Flask(__name__)

# Load the ML model once
model = load_model()

@app.route("/analyze", methods=["POST"])
def analyze_sentiment():
    text = request.json.get("text", "")
    result = predict_sentiment(model, text)
    return jsonify(result)

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message", "")
    # Simple chatbot response
    response = {"reply": f"I received: {user_message}"}
    return jsonify(response)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
