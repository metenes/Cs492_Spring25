from mongoengine import Document, StringField, IntField

class Emotion(Document):
    emotion_id = IntField(required=True, unique=True)
    emotion_name = StringField(required=True, unique=True)

    def to_json(self):
        return {
            "emotion_id": self.emotion_id,
            "emotion_name": self.emotion_name
        }
        
    meta = {'collection': 'emotions'}
