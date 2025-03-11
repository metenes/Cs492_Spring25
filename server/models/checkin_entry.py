from mongoengine import Document, ListField, ReferenceField, IntField, StringField
from models.user import User
from models.sentiment import Sentiment
from models.cause import Cause

class CheckInEntry(Document):
    entry_id = IntField(required=True, unique=True)
    user_id = ReferenceField(User, required=True)  # Foreign key to User
    sentiments = ListField(ReferenceField(Sentiment))  # References to Sentiment model
    causes = ListField(ReferenceField(Cause))  # References to Cause model
    comments = ListField(StringField())  # List of user comments

    def to_json(self):
        return {
            "entry_id": self.entry_id,
            "user_id": str(self.user_id.id),
            "sentiments": self.sentiments,
            "causes": self.causes,
            "comments": self.comments
        }
    
    meta = {'collection': 'check_in_entries'}
