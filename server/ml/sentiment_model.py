from transformers import pipeline

def load_model():
    return pipeline("sentiment-analysis")

def predict_sentiment(model, text):
    return model(text)[0]
