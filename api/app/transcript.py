import re
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException
from youtube_transcript_api import (
    CouldNotRetrieveTranscript,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeTranscriptApi,
)

ytt_api = YouTubeTranscriptApi()

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def extract_video_id(url: str) -> str | None:
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    if parsed.scheme not in ("http", "https"):
        return None

    host = parsed.hostname or ""
    host = host.lower()

    video_id: str | None = None

    # youtu.be/VIDEO_ID
    if host in ("youtu.be", "www.youtu.be"):
        video_id = parsed.path.lstrip("/").split("/")[0] or None

    # youtube.com/watch?v=VIDEO_ID
    elif host in ("youtube.com", "www.youtube.com", "m.youtube.com"):
        if parsed.path == "/watch":
            qs = parse_qs(parsed.query)
            video_id = qs.get("v", [None])[0]
        # youtube.com/embed/VIDEO_ID
        elif parsed.path.startswith("/embed/"):
            video_id = parsed.path.split("/")[2] or None

    if video_id and VIDEO_ID_PATTERN.match(video_id):
        return video_id
    return None


def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"[{hours}:{minutes:02d}:{secs:02d}]"
    return f"[{minutes}:{secs:02d}]"


def format_transcript(segments: list[dict]) -> str:
    lines = []
    for seg in segments:
        text = seg.get("text", "").strip()
        if text:
            lines.append(f"{format_timestamp(seg['start'])} {text}")
    return "\n".join(lines)


def fetch_transcript(video_id: str) -> list[dict]:
    try:
        fetched = ytt_api.fetch(video_id, languages=["en"])
        return fetched.to_raw_data()
    except NoTranscriptFound:
        pass
    except TranscriptsDisabled:
        raise HTTPException(
            status_code=404, detail="Transcripts are disabled for this video"
        )
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="Video not found")
    except CouldNotRetrieveTranscript:
        raise HTTPException(status_code=500, detail="Failed to retrieve transcript")

    # Fallback: try first available transcript (manual preferred over auto-generated)
    try:
        transcript_list = ytt_api.list(video_id)
        for transcript in transcript_list:
            if not transcript.is_generated:
                return transcript.fetch().to_raw_data()
        # No manual transcripts — take the first auto-generated one
        for transcript in transcript_list:
            return transcript.fetch().to_raw_data()
    except TranscriptsDisabled:
        raise HTTPException(
            status_code=404, detail="Transcripts are disabled for this video"
        )
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="Video not found")
    except CouldNotRetrieveTranscript:
        pass

    raise HTTPException(
        status_code=404, detail="No transcript available for this video"
    )
