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
from utils.database import users_collection

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

from datetime import datetime

def insert_test_user():
    user_id = ObjectId()
    users_collection.insert_one({
        "_id": user_id,
        "email": "test@example.com",
        "password": "old_hashed_pw",
        "created_at": datetime.utcnow()
    })
    return str(user_id)

""" def insert_test_user():
    user_id = ObjectId()
    users_collection.insert_one({
        "_id": user_id,
        "email": "test@example.com",
        "password": "old_hashed_pw"
    })
    return str(user_id) """

def test_password_reset_success(client):
    with app.app_context():
        user_id = insert_test_user()
        token = create_access_token(identity=user_id)

    response = client.post(
        "/user/reset-password",
        json={"token": token, "newPassword": "newpass123"}
    )
    assert response.status_code == 200
    assert response.json["message"] == "Password reset successful"

def test_password_reset_invalid_token(client):
    response = client.post(
        "/user/reset-password",
        json={"token": "invalid.token.here", "newPassword": "newpass123"}
    )
    assert response.status_code == 400

def test_password_reset_short_password(client):
    with app.app_context():
        user_id = insert_test_user()
        token = create_access_token(identity=user_id)

    response = client.post(
        "/user/reset-password",
        json={"token": token, "newPassword": "123"}  # Too short
    )
    assert response.status_code == 400
    assert "Password must be at least 6 characters" in response.json["error"]
