import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app import app
from flask_jwt_extended import create_access_token
from bson import ObjectId
from unittest.mock import patch

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_password_reset_success(client):
    user_id = str(ObjectId())

    with app.app_context():  # ✅ fix context error
        token = create_access_token(identity=user_id)

    response = client.post(
        f"/reset-password?token={token}",
        json={"newPassword": "newpass123"}
    )
    assert response.status_code == 200
    assert response.json["message"] == "Password reset successful"

def test_password_reset_invalid_token(client):
    response = client.post(
        "/reset-password?token=invalidtoken",
        json={"newPassword": "newpass123"}
    )
    assert response.status_code == 401  # ❗Double check this matches your route's behavior

def test_password_reset_short_password(client):
    user_id = str(ObjectId())

    with app.app_context():  # ✅ fix context error
        token = create_access_token(identity=user_id)

    response = client.post(
        f"/reset-password?token={token}",
        json={"newPassword": "123"}
    )
    assert response.status_code == 400
    assert response.json["error"] == "Password must be at least 6 characters long"