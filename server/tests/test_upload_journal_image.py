import pytest
from PIL import Image
import os
import requests

API_URL = "http://localhost:5000"  # Adjust if needed
REGISTER_URL = f"{API_URL}/user/register"
LOGIN_URL = f"{API_URL}/user/login"
UPLOAD_IMAGE_URL = f"{API_URL}/journal/upload-image"

TEST_EMAIL = "test_upload@example.com"
TEST_PASSWORD = "test12345"
TEST_IMAGE_PATH = "test_image.jpg"


def create_test_image(path=TEST_IMAGE_PATH):
    if not os.path.exists(path):
        image = Image.new("RGB", (100, 100), color=(255, 0, 0))  # red square
        image.save(path)
        print(f"🖼️ Test image created at {path}")


def register_test_user():
    response = requests.post(REGISTER_URL, json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "dob": "2000-01-01"
    })
    if response.status_code == 400 and "already" in response.text:
        print("✅ User already exists.")
    else:
        assert response.status_code == 201, f"Registration failed: {response.text}"


def login_test_user():
    response = requests.post(LOGIN_URL, json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No access token returned"
    return token


def test_upload_image_to_journal_entry():
    create_test_image()
    register_test_user()
    token = login_test_user()

    with open(TEST_IMAGE_PATH, "rb") as img:
        files = { "image": ("test_image.jpg", img, "image/jpeg") }
        headers = { "Authorization": f"Bearer {token}" }

        response = requests.post(UPLOAD_IMAGE_URL, files=files, headers=headers)

        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "signedUrl" in data, "Response missing signedUrl"
        print("✅ Image upload test passed. URL:", data["signedUrl"])
