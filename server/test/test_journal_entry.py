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
from app import app
from utils.database import journal_entries_collection
from bson import ObjectId
from flask_jwt_extended import create_access_token
from unittest.mock import patch

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.app_context():
        with app.test_client() as client:
            yield client

@patch('controller.journal_controller.sentiment_analyzer')  # ❗ Replace with the actual import path
def test_save_journal_entry_with_mock_sentiment(mock_sentiment_analyzer, client):
    # ➤ Step 1: Setup
    user_id = str(ObjectId())
    access_token = create_access_token(identity=user_id)
    
    # ➤ Step 2: Mock the sentiment analyzer output
    mock_sentiment_analyzer.return_value = [
        {"label": "joy", "score": 0.9}
    ]

    # ➤ Step 3: Prepare request data
    entry_payload = {
        "entryContent": "This is a test journal entry.",
        "entryDate": "2025-05-01T14:00:00Z",
        "images": [],
        "category": "freeform",
        "prompt": "Today I felt..."
    }

    # ➤ Step 4: Make POST request with Authorization header
    response = client.post(
        "/journal/save-journal-entry",
        json=entry_payload,
        headers={"Authorization": f"Bearer {access_token}"}
    )

    # ➤ Step 5: Assert response
    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Journal entry saved successfully"
    assert "entry" in data
    assert data["entry"]["entryContent"] == entry_payload["entryContent"]

    # ➤ Step 6: Clean up from DB after test (optional)
    journal_entries_collection.delete_one({"_id": ObjectId(user_id)})
