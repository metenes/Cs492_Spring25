from mongoengine import Document, ReferenceField, IntField, FloatField
from models.emotion import Emotion
from models.sentiment import Sentiment

class SentimentEmotions(Document):
    emotion_id = ReferenceField(Emotion, required=True)
    sentiment_id = ReferenceField(Sentiment, required=True)
    percentage = FloatField(required=True)
    
    def to_json(self):
        return {
            "emotion_id": str(self.emotion_id.id),
            "sentiment_id": str(self.sentiment_id.id),
            "percentage": self.percentage
        }

    meta = {'collection': 'sentiment_emotions'}
