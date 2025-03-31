from mongoengine import Document, StringField, EmailField, DateField
from datetime import datetime

class User(Document):
    name = StringField(min_length=1, max_length=50, trim=True)
    email = EmailField(required=True, unique=True)
    password = StringField(required=True, min_length=6, trim=True)
    created_at = DateField(default=datetime.now)
    
    
    def to_json(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "created_at": self.created_at
        }

    meta = { 'collection': 'users' }