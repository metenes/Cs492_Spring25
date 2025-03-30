from flask import Blueprint
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from models.chat import Chat  # Import the Chat model
from utils.database import chat_collection
from utils.load_model import model, tokenizer

# buraya gelen uzantılar /chat ile başlıcak
chat_bp = Blueprint("chat_bp", __name__)

# --------------- Chatbot Analysis  --------------------
# We use API
# Define Request Model

class ChatRequest(BaseModel):
    user_input: str

# Chatbot API Endpoint
@chat_bp.post("/") # localhost:5000/chat
async def chat(request: ChatRequest):
    try:
        inputs = tokenizer.encode(request.user_input, return_tensors="pt")
        output = model.generate(inputs, max_length=100, num_return_sequences=1)
        response = tokenizer.decode(output[0], skip_special_tokens=True)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {e}")