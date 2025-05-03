from locust import HttpUser, task, between
import random
import string

def generate_dummy_entry():
    return {
        "entryContent": ''.join(random.choices(string.ascii_letters, k=100)),
        "entryDate": "2025-05-02T12:00:00Z",
        "images": [],
        "category": "freeform",
        "prompt": "Performance test prompt"
    }

class SentioUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def save_journal_entry(self):
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NjIxMjI5MSwianRpIjoiYWU2YTlmNDktYmYxYy00NDY1LWJmYjAtNmU1ZTJhMGViMTkwIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY3ZjAwMWQ3ZjY2YTI3NGE1ZDIzMzhhYSIsIm5iZiI6MTc0NjIxMjI5MSwiY3NyZiI6IjhhN2UwNjIzLWQ4N2QtNGRiNy05ODU4LTQyNmViOGQwZWU1OCIsImV4cCI6MTc0NjI5ODY5MX0.Qs3DJ9PcV4X_v1szmXxZVbW7EUKG98758Psn7VG0enw"
        self.client.post(
            "/journal/save-journal-entry",
            headers={"Authorization": f"Bearer {token}"},
            json=generate_dummy_entry()
        )
