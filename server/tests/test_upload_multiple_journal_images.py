import pytest
from PIL import Image
import os
import requests

API_URL = "http://localhost:5000"  # Change if necessary
REGISTER_URL = f"{API_URL}/user/register"
LOGIN_URL = f"{API_URL}/user/login"
UPLOAD_IMAGE_URL = f"{API_URL}/journal/upload-image"

TEST_EMAIL = "test_multi_upload@example.com"
TEST_PASSWORD = "test12345"
IMAGE_COUNT = 3
IMAGE_PATHS = [f"test_image_{i}.jpg" for i in range(1, IMAGE_COUNT + 1)]


def create_multiple_test_images():
    for path in IMAGE_PATHS:
        if not os.path.exists(path):
            image = Image.new("RGB", (100, 100), color=(255, 255, 255))
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


def test_upload_multiple_images():
    create_multiple_test_images()
    register_test_user()
    token = login_test_user()

    for path in IMAGE_PATHS:
        with open(path, "rb") as img:
            files = { "image": (os.path.basename(path), img, "image/jpeg") }
            headers = { "Authorization": f"Bearer {token}" }

            response = requests.post(UPLOAD_IMAGE_URL, files=files, headers=headers)
            assert response.status_code == 200, f"Upload failed for {path}: {response.text}"
            data = response.json()
            assert "signedUrl" in data, f"Response missing signedUrl for {path}"
            print(f"✅ Image uploaded successfully: {data['signedUrl']}")
