import pymongo
import certifi
import os

import mongoengine
# MongoDB Connection URI
MONGO_URI = "mongodb+srv://sentiooffical:o03TiLebpxrbIS0D@cluster0.0nh7y.mongodb.net/"

# Initialize MongoDB connection
def get_database():
    try:
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
        #mongoengine.connect("mydb", host=MONGO_URI, alias="default")
        db = client["mydb"]
        print("✅ Connected to MongoDB successfully!")
        print("✅ Available collections:", db.list_collection_names())
        return db
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")
        exit(1)

# YOU NEED TO IMPORT THE COLLECTIONS YOU WANT TO USE IN YOUR CONTROLLERS
# Get collections
db = get_database()
users_collection = db["users"]
sentiments_collection = db["sentiments"]
activities_collection = db["activities"]
journal_entries_collection = db["journal_entries"]
chat_collection = db["chats"]
check_in_collection = db["check_in"]
prompt_collection = db["prompt"]
notification_tokens_collection = db["notification_tokens"]