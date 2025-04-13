from mongoengine import EmbeddedDocument, StringField, IntField, DateTimeField
from datetime import datetime

class Message(EmbeddedDocument):
    message_id = IntField(required=True)
    sender = IntField(required=True)  # Assuming sender is a user_idz
    #  role =  StringField(required=True)
    content = StringField(required=True)
    timestamp = DateTimeField(default=datetime.now)

    def to_json(self):
        return {
            "message_id": self.message_id,
            "sender": self.sender,
           #  "role" : self.role,
            "content": self.content,
            "timestamp": self.timestamp
        }
        
    meta = {'collection': 'messages'}