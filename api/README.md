# Magpie Transcript API

A lightweight API that accepts a YouTube video URL and returns the video's transcript.

## Setup

```bash
cp .env.example .env
# Edit .env with your API keys
pip install -r requirements.txt
```

## Run locally

```bash
uvicorn app.main:app --reload
```

## Run with Docker

```bash
docker compose up --build
```

## Run tests

```bash
pytest tests/ -v
```

## Endpoints

- `GET /health` — Health check (no auth)
- `GET /transcript?url=YOUTUBE_URL` — Fetch transcript (requires `X-API-Key` header)
