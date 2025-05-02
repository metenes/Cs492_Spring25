import requests

LOGIN_URL = "http://192.168.1.16:5000/user/login"
REGISTER_URL = "http://192.168.1.16:5000/user/register"

TEST_EMAIL = "lockout_test4@example.com"
CORRECT_PASSWORD = "correct123"
WRONG_PASSWORD = "wrong123"

def test_account_lockout_after_failed_attempts():
    # Step 1: Register the test user (skip if already exists)
    try:
        requests.post(REGISTER_URL, json={
            "email": TEST_EMAIL,
            "password": CORRECT_PASSWORD,
            "dob": "2000-01-01"
        })
    except:
        pass  # Assume user already exists

    # Step 2: Try wrong password 7 times
    for i in range(7):
        response = requests.post(LOGIN_URL, json={
            "email": TEST_EMAIL,
            "password": WRONG_PASSWORD
        })
        if i < 4:
            # First 4 attempts: still allowed
            assert response.status_code == 401, f"❌ Attempt {i+1} should return 401"
            print(f"❌ Attempt {i+1} failed as expected (401)")
        else:
            # 5th and later: account locked
            assert response.status_code == 403, f"🔒 Attempt {i+1} should return 403 due to lockout"
            assert "locked" in response.json().get("error", "").lower(), f"❗ Expected lockout message at attempt {i+1}"
            print(f"🔒 Attempt {i+1} correctly locked out (403)")

    # Step 3: Try correct password, still locked
    response = requests.post(LOGIN_URL, json={
        "email": TEST_EMAIL,
        "password": CORRECT_PASSWORD
    })
    assert response.status_code == 403, "✅ Correct password still blocked after lockout"
    assert "locked" in response.json().get("error", "").lower(), "❗ Expected lockout message"
    print("✅ Lockout verified: correct password denied after too many failed attempts")
