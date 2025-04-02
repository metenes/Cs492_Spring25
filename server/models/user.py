from mongoengine import Document, StringField, EmailField, DateField
from datetime import datetime


"""
// Sample MongoDB User Schema  -- MODIFY
// ----> documentation purposes
{
  "_id": ObjectId("..."),
  "email": "user@example.com",
  "password": "hashed_password",
  "name": "User Name",
  "bio": "User biography or description",
  "phone": "+1234567890",
  "location": "City, Country",
  "profileImageUrl": "https://bucket-name.s3.amazonaws.com/profile-images/user_id_filename.jpg",
  "created_at": ISODate("2025-03-30T12:00:00Z"),
  "updated_at": ISODate("2025-03-30T12:00:00Z"),
  "last_login": ISODate("2025-03-30T12:00:00Z"),
  "preferences": {
    "darkMode": false,
    "notifications": {
      "email": true,
      "push": true
    },
    "language": "en"
  },
  "account_status": "active", // active, suspended, deactivated
  "role": "user" // user, admin
}
"""

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