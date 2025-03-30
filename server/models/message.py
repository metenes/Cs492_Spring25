from mongoengine import EmbeddedDocument, StringField, IntField, DateTimeField
from datetime import datetime

class Message(EmbeddedDocument):
    message_id = IntField(required=True)
    sender = IntField(required=True)  # Assuming sender is a user_id
    content = StringField(required=True)
    timestamp = DateTimeField(default=datetime.utcnow)

    def to_json(self):
        return {
            "message_id": self.message_id,
            "sender": self.sender,
            "content": self.content,
            "timestamp": self.timestamp
        }
        
    meta = {'collection': 'messages'}