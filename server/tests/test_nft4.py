import requests
import time

API_URL = "http://192.168.1.16:5000/journal/save-journal-entry"
LOGIN_URL = "http://192.168.1.16:5000/user/login"

TEST_EMAIL = "doga.ozdemir@ug.bilkent.edu.tr"
TEST_PASSWORD = "password123"

def login_user():
    response = requests.post(LOGIN_URL, json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No token returned"
    return token

def test_journal_entry_api_response_time():
    token = login_user()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    sample_entry = {
        "entryContent": "This is a sample journal entry to test performance.",
        "entryDate": "2025-05-02T00:00:00Z",
        "images": [],
        "journalSentiments": [],
        "category": "freeform",
        "prompt": None
    }

    start_time = time.time()
    response = requests.post(API_URL, json=sample_entry, headers=headers)
    end_time = time.time()

    duration_ms = (end_time - start_time) * 1000

    # ✅ Always print response time
    print(f"\n⏱️ Total API response time: {duration_ms:.2f} ms\n", flush=True)

    # Run assertions after printing
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    assert duration_ms <= 500, f"API response time exceeded 500ms: {duration_ms:.2f} ms"

# To run this directly (not just through pytest)
if __name__ == "__main__":
    try:
        test_journal_entry_api_response_time()
        print("✅ Test passed.\n", flush=True)
    except AssertionError as e:
        print(f"❌ Test failed: {e}\n", flush=True)
