import pytest
from fastapi.testclient import TestClient

from app.config import settings

# Set test API key before importing app
settings.API_KEYS = ["test-key"]

from app.main import app

client = TestClient(app)

VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
HEADERS = {"X-API-Key": "test-key"}


class TestHealth:
    def test_returns_ok(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestTranscriptAuth:
    def test_missing_api_key(self):
        response = client.get("/transcript", params={"url": VALID_URL})
        assert response.status_code == 401
        assert "error" in response.json()

    def test_invalid_api_key(self):
        response = client.get(
            "/transcript",
            params={"url": VALID_URL},
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == 401
        assert "error" in response.json()


class TestTranscriptValidation:
    def test_missing_url(self):
        response = client.get("/transcript", headers=HEADERS)
        assert response.status_code == 422

    def test_invalid_url(self):
        response = client.get(
            "/transcript",
            params={"url": "https://vimeo.com/12345"},
            headers=HEADERS,
        )
        assert response.status_code == 400
        assert "error" in response.json()


class TestTranscriptSuccess:
    def test_valid_request(self, monkeypatch):
        mock_segments = [{"text": "hello", "start": 0.0, "duration": 1.0}]
        monkeypatch.setattr(
            "app.main.fetch_transcript", lambda video_id: mock_segments
        )
        response = client.get(
            "/transcript",
            params={"url": VALID_URL},
            headers=HEADERS,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["video_id"] == "dQw4w9WgXcQ"
        assert data["transcript"] == "[0:00] hello"


class TestTranscriptErrors:
    def test_no_transcript_returns_404(self, monkeypatch):
        from fastapi import HTTPException

        def mock_fetch(video_id):
            raise HTTPException(
                status_code=404, detail="No transcript available for this video"
            )

        monkeypatch.setattr("app.main.fetch_transcript", mock_fetch)
        response = client.get(
            "/transcript",
            params={"url": VALID_URL},
            headers=HEADERS,
        )
        assert response.status_code == 404
