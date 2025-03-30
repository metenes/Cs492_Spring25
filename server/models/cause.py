from mongoengine import Document, StringField, IntField

class Cause(Document):
    cause_id = IntField(required=True, unique=True)
    cause_name = StringField(required=True)
    cause_icon = StringField()  # Assuming it's a URL or file path

    meta = {'collection': 'causes'}
