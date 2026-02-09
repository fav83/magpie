import pytest
from fastapi import HTTPException

from app.transcript import extract_video_id, fetch_transcript, format_transcript


class TestExtractVideoId:
    def test_standard_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_no_www(self):
        assert extract_video_id("https://youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_embed_url(self):
        assert extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_mobile_url(self):
        assert extract_video_id("https://m.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_http_url(self):
        assert extract_video_id("http://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_extra_params(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42") == "dQw4w9WgXcQ"

    def test_invalid_url(self):
        assert extract_video_id("not-a-url") is None

    def test_wrong_domain(self):
        assert extract_video_id("https://vimeo.com/12345") is None

    def test_empty_string(self):
        assert extract_video_id("") is None

    def test_missing_video_id(self):
        assert extract_video_id("https://www.youtube.com/watch?v=") is None

    def test_invalid_video_id_too_short(self):
        assert extract_video_id("https://www.youtube.com/watch?v=abc") is None

    def test_youtube_no_path(self):
        assert extract_video_id("https://www.youtube.com/") is None


class TestFetchTranscript:
    def test_happy_path(self, monkeypatch):
        class FakeFetched:
            def to_raw_data(self):
                return [{"text": "hello", "start": 0.0, "duration": 1.0}]

        class FakeApi:
            def fetch(self, video_id, languages=None):
                return FakeFetched()

        monkeypatch.setattr("app.transcript.ytt_api", FakeApi())
        result = fetch_transcript("dQw4w9WgXcQ")
        assert result == [{"text": "hello", "start": 0.0, "duration": 1.0}]

    def test_transcripts_disabled(self, monkeypatch):
        from youtube_transcript_api import TranscriptsDisabled

        class FakeApi:
            def fetch(self, video_id, languages=None):
                raise TranscriptsDisabled("dQw4w9WgXcQ")

        monkeypatch.setattr("app.transcript.ytt_api", FakeApi())
        with pytest.raises(HTTPException) as exc_info:
            fetch_transcript("dQw4w9WgXcQ")
        assert exc_info.value.status_code == 404
        assert "disabled" in exc_info.value.detail.lower()

    def test_video_unavailable(self, monkeypatch):
        from youtube_transcript_api import VideoUnavailable

        class FakeApi:
            def fetch(self, video_id, languages=None):
                raise VideoUnavailable("dQw4w9WgXcQ")

        monkeypatch.setattr("app.transcript.ytt_api", FakeApi())
        with pytest.raises(HTTPException) as exc_info:
            fetch_transcript("dQw4w9WgXcQ")
        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail.lower()

    def test_fallback_to_non_english(self, monkeypatch):
        from youtube_transcript_api import NoTranscriptFound

        class FakeFetched:
            def to_raw_data(self):
                return [{"text": "hola", "start": 0.0, "duration": 1.0}]

        class FakeTranscript:
            is_generated = False
            def fetch(self):
                return FakeFetched()

        class FakeTranscriptList:
            def __iter__(self):
                return iter([FakeTranscript()])

        class FakeApi:
            def fetch(self, video_id, languages=None):
                raise NoTranscriptFound("dQw4w9WgXcQ", ["en"], None)

            def list(self, video_id):
                return FakeTranscriptList()

        monkeypatch.setattr("app.transcript.ytt_api", FakeApi())
        result = fetch_transcript("dQw4w9WgXcQ")
        assert result == [{"text": "hola", "start": 0.0, "duration": 1.0}]

    def test_fallback_prefers_manual_over_generated(self, monkeypatch):
        from youtube_transcript_api import NoTranscriptFound

        class ManualFetched:
            def to_raw_data(self):
                return [{"text": "manual", "start": 0.0, "duration": 1.0}]

        class GeneratedFetched:
            def to_raw_data(self):
                return [{"text": "generated", "start": 0.0, "duration": 1.0}]

        class ManualTranscript:
            is_generated = False
            def fetch(self):
                return ManualFetched()

        class GeneratedTranscript:
            is_generated = True
            def fetch(self):
                return GeneratedFetched()

        class FakeTranscriptList:
            def __iter__(self):
                return iter([GeneratedTranscript(), ManualTranscript()])

        class FakeApi:
            def fetch(self, video_id, languages=None):
                raise NoTranscriptFound("dQw4w9WgXcQ", ["en"], None)

            def list(self, video_id):
                return FakeTranscriptList()

        monkeypatch.setattr("app.transcript.ytt_api", FakeApi())
        result = fetch_transcript("dQw4w9WgXcQ")
        assert result == [{"text": "manual", "start": 0.0, "duration": 1.0}]


class TestFormatTranscript:
    def test_basic(self):
        segments = [
            {"text": "hello", "start": 0.0, "duration": 1.0},
            {"text": "world", "start": 1.0, "duration": 1.0},
        ]
        assert format_transcript(segments) == "[0:00] hello\n[0:01] world"

    def test_minutes(self):
        segments = [{"text": "later", "start": 125.0, "duration": 1.0}]
        assert format_transcript(segments) == "[2:05] later"

    def test_hours(self):
        segments = [{"text": "much later", "start": 3661.0, "duration": 1.0}]
        assert format_transcript(segments) == "[1:01:01] much later"

    def test_empty_text_skipped(self):
        segments = [
            {"text": "hello", "start": 0.0, "duration": 1.0},
            {"text": "", "start": 1.0, "duration": 1.0},
            {"text": "world", "start": 2.0, "duration": 1.0},
        ]
        assert format_transcript(segments) == "[0:00] hello\n[0:02] world"

    def test_empty_list(self):
        assert format_transcript([]) == ""
