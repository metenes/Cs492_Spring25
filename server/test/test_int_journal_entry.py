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
    app.config['TESTING'] = True
    with app.app_context():
        with app.test_client() as client:
            yield client

def test_journal_entry_saves_to_db(client):
    with app.app_context():
        user_id = str(ObjectId())
        access_token = create_access_token(identity=user_id)

        entry_payload = {
            "entryContent": "Integration test journal entry",
            "entryDate": "2025-05-01T14:00:00Z",
            "images": [],
            "category": "freeform",
            "prompt": "Integration test prompt"
        }

        response = client.post(
            "/journal/save-journal-entry",
            json=entry_payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        assert response.status_code == 201
        saved_doc = journal_entries_collection.find_one({"_id": ObjectId(user_id)})
        assert saved_doc is not None
        assert any(entry["entryContent"] == "Integration test journal entry" for entry in saved_doc["journalEntries"])