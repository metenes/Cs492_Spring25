from mongoengine import Document, StringField, DateTimeField, ReferenceField, IntField
from datetime import datetime
from models.user import User

class JournalEntry(Document):
    entry_id = IntField(required=True, unique=True)
    user_id = ReferenceField(User, required=True)  # Foreign key to User
    entry_type = StringField(required=True)
    entry_content = StringField(required=True)
    entry_date = DateTimeField(default=datetime.now)
    
    def to_json(self):
        return {
            "entry_id": self.entry_id,
            "user_id": str(self.user_id.id),
            "entry_type": self.entry_type,
            "entry_content": self.entry_content,
            "entry_date": self.entry_date
        }

    meta = {'collection': 'journal_entries'}
