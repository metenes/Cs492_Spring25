import requests

BASE_URL = "http://192.168.1.16:5000"  # or your deployed backend

def test_valid_login():
    payload = {
        "email": "irem.akel@ug.bilkent.edu.tr",
        "password": "password123"
    }
    r = requests.post(f"{BASE_URL}/user/login", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data


def test_invalid_password():
    payload = {"email": "test@example.com", "password": "wrongpass"}
    r = requests.post(f"{BASE_URL}/user/login", json=payload)
    assert r.status_code == 401

def test_nonexistent_user():
    payload = {"email": "nonuser@example.com", "password": "test123"}
    r = requests.post(f"{BASE_URL}/user/login", json=payload)
    assert r.status_code == 401

def test_empty_fields():
    payload = {"email": "", "password": ""}
    r = requests.post(f"{BASE_URL}/user/login", json=payload)
    assert r.status_code in [400, 422]
