# test/test_no_auth_access.py
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
from app import app  # adjust import if needed

@pytest.fixture
def client():
    return app.test_client()

def test_protected_endpoint_without_token(client):
    # Try calling a protected endpoint (e.g., saving a journal entry)
    response = client.post("/journal/save-journal-entry", json={
        "entryContent": "Should not be allowed",
        "entryDate": "2025-05-01T15:00:00Z",
        "images": [],
        "category": "freeform",
        "prompt": "Unauthorized test"
    })

    assert response.status_code == 401
    assert "error" in response.json or "msg" in response.json  # Flask-JWT might return 'msg'
