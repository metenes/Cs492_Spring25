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

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def test_invalid_login(client):
    response = client.post("/user/login", json={
        "email": "invalid@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert b"Invalid credentials" in response.data
