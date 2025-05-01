import pytest
from PIL import Image
import os
import requests

API_URL = "http://localhost:5000"
REGISTER_URL = f"{API_URL}/user/register"
LOGIN_URL = f"{API_URL}/user/login"
UPLOAD_IMAGE_URL = f"{API_URL}/journal/upload-image"

TEST_EMAIL = "test_exceed_upload@example.com"
TEST_PASSWORD = "test12345"
TEST_IMAGE_PREFIX = "exceed_test_image_"

# Utility: Create a small red square image
def create_test_images(count=6):
    for i in range(count):
        filename = f"{TEST_IMAGE_PREFIX}{i+1}.jpg"
        if not os.path.exists(filename):
            img = Image.new("RGB", (100, 100), color=(255, 0, 0))
            img.save(filename)
            print(f"🖼️ Created test image: {filename}")

# Register a test user
def register_user():
    response = requests.post(REGISTER_URL, json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "dob": "2000-01-01"
    })
    if response.status_code == 400 and "already" in response.text:
        print("✅ User already registered.")
    else:
        assert response.status_code == 201, f"Registration failed: {response.text}"

# Login and return access token
def login_user():
    response = requests.post(LOGIN_URL, json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No token returned"
    return token

# Main test
def test_exceed_maximum_image_upload_limit():
    create_test_images(6)  # Prepare 6 test images
    register_user()
    token = login_user()

    headers = {
        "Authorization": f"Bearer {token}"
    }

    success_count = 0
    for i in range(6):
        filename = f"{TEST_IMAGE_PREFIX}{i+1}.jpg"
        with open(filename, "rb") as img_file:
            files = { "image": (filename, img_file, "image/jpeg") }
            response = requests.post(UPLOAD_IMAGE_URL, files=files, headers=headers)

            if i < 5:
                assert response.status_code == 200, f"Image {i+1} failed: {response.text}"
                print(f"✅ Image {i+1} uploaded.")
                success_count += 1
            else:
                assert response.status_code != 200, f"❌ Image {i+1} should have been rejected"
                assert "Maximum of 5 images allowed" in response.text or "limit" in response.text.lower(), \
                    f"Expected error message not found in: {response.text}"
                print(f"✅ Image {i+1} correctly rejected.")

    assert success_count == 5, "Only the first 5 images should be uploaded"
