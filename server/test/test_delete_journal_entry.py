import warnings
warnings.filterwarnings(
    "ignore",
    message='Field name "json" in "MonitoringDatasetFormat"',
    category=UserWarning,
)
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pytest
from bson import ObjectId
from flask_jwt_extended import create_access_token
from app import app
from utils.database import journal_entries_collection

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def test_delete_journal_entry(client):
    with app.app_context():
        user_object_id = ObjectId()
        user_id = str(user_object_id)  # use this for JWT

        access_token = create_access_token(identity=user_id)

        # ➤ Step 1: Insert a dummy entry manually into DB
        entry_id = ObjectId()
        dummy_entry = {
            "_id": entry_id,
            "entryContent": "Test entry to be deleted",
            "entryDate": "2025-05-01T14:00:00Z",
            "images": [],  # avoid triggering S3 delete for simplicity
            "journalSentiments": [],
            "createdAt": "2025-05-01T14:00:00Z",
            "category": "freeform",
            "prompt": "Temporary entry"
        }

        journal_entries_collection.insert_one({
            "_id": user_object_id,
            "journalEntries": [dummy_entry]
        })


        # ➤ Step 2: Send DELETE request
        response = client.delete(
            f"/journal/delete-journal-entry/{entry_id}",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        # ➤ Step 3: Check response and DB
        assert response.status_code == 200
        updated_doc = journal_entries_collection.find_one({"_id": ObjectId(user_id)})
        assert all(str(entry["_id"]) != str(entry_id) for entry in updated_doc["journalEntries"])
