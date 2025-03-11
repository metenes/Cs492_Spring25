from mongoengine import Document, StringField, IntField

class Sentiment(Document):
    sentiment_id = IntField(required=True, unique=True)
    sentiment_name = StringField(required=True)
    sentiment_icon = StringField()  # Assuming it's a URL or file path

    def to_json(self):     
        return {
            "sentiment_name": self.sentiment_name,
            "sentiment_icon": self.sentiment_icon
        }
    meta = {'collection': 'sentiments'}
