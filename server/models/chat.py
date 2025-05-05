from mongoengine import Document, StringField, IntField, ListField, DateTimeField, ReferenceField, EmbeddedDocumentField, BooleanField, ObjectIdField
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from bson import ObjectId

# MongoDB Models
class Message(Document):
    role = StringField(required=True, choices=["user", "assistant"])
    content = StringField(required=True)
    timestamp = DateTimeField(default=datetime.now)
    
    meta = {'collection': 'messages'}
    
    def to_json(self):
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp
        }

class Chat(Document):
    user_id = StringField(required=True)  # Reference to User
    chat_id = StringField(required=True, unique=True)
    messages = ListField(ReferenceField(Message))
    started_at = DateTimeField(default=datetime.now)
    last_updated = DateTimeField(default=datetime.now)
    model_version = StringField(default="1.0")
    model_updated = BooleanField(default=False)

    meta = {'collection': 'chats'}

    def to_json(self):
        return {
            "user_id": self.user_id,
            "chat_id": self.chat_id,
            "started_at": self.started_at,
            "last_updated": self.last_updated,
            "model_version": self.model_version,
            "model_updated": self.model_updated,
            "messages": [message.to_json() for message in self.messages]
        }

# Pydantic Models for API
class MessageSchema(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ChatRequest(BaseModel):
    message: str
    chat_id: str  # Changed from int to str
    tone: str
    context: Optional[Dict[str, Any]] = None
    update_model: bool = False
    context_window: int = 10  # Number of previous messages to include

class ChatResponse(BaseModel):
    response: str
    chat_id: str
    model_version: str
    model_updated: bool
    inference_time: float

class ModelTrainingRequest(BaseModel):
    training_data: List[Dict[str, Any]]
    hyperparameters: Optional[Dict[str, Any]] = None

class ModelTrainingResponse(BaseModel):
    job_id: str
    status: str
    estimated_completion_time: str

class ModelStatus(BaseModel):
    user_id: str
    model_path: str
    model_version: str
    last_updated: str
    training_jobs: List[Dict[str, Any]]
    performance_metrics: Dict[str, Any]