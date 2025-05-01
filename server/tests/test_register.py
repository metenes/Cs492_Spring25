import requests

BASE_URL = "http://192.168.1.16:5000"  # Replace with your local IP

def test_duplicate_email_registration():
    test_email = "testduplicate@example.com"
    test_password = "testpass123"
    test_dob = "2000-01-01"

    payload = {
        "email": test_email,
        "password": test_password,
        "dob": test_dob,
    }

    # First registration (should succeed or already exist)
    r1 = requests.post(f"{BASE_URL}/user/register", json=payload)
    assert r1.status_code in [201, 400]  # 400 if the user already exists

    # Second registration (should fail)
    r2 = requests.post(f"{BASE_URL}/user/register", json=payload)
    assert r2.status_code == 400

    data = r2.json()
    assert "error" in data
    assert "already" in data["error"].lower()
