from mongoengine import Document, IntField, ListField, DateTimeField, ReferenceField, EmbeddedDocumentField
from datetime import datetime
from models.message import Message
from models.user import User

class Chat(Document):
    chat_id = IntField(required=True, unique=True)
    user_id = ReferenceField(User, required=True)  # Foreign key to User
    started_at = DateTimeField(default=datetime.now)
    last_updated = DateTimeField(default=datetime.now)
    messages = ListField(EmbeddedDocumentField(Message))  # A list of embedded Message documents
    
    def to_json(self):
        return {
            "user_id": str(self.user_id.id),
            "started_at": self.started_at,
            "last_updated": self.last_updated,
            "messages": [message.to_json() for message in self.messages]
        }

    meta = {'collection': 'chats'}
