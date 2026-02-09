# Magpie Transcript API

A lightweight API that accepts a YouTube video URL and returns the video's transcript as formatted, timestamped plain text.

## Setup

```bash
cp .env.example .env
# Edit .env — at minimum set API_KEYS (JSON array format)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run locally

```bash
./start.sh
```

Or manually:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 5005
```

## Run with Docker

```bash
docker compose up --build
```

## Run tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

## Endpoints

- `GET /health` — Health check (no auth)
- `GET /transcript?url=YOUTUBE_URL` — Fetch transcript (requires `X-API-Key` header)

### Example

```bash
curl -H "X-API-Key: your-key" "http://localhost:5005/transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Response:

```json
{
  "video_id": "dQw4w9WgXcQ",
  "transcript": "[0:18] We're no strangers to love\n[0:21] You know the rules and so do I"
}
```

## Deploy to exe.dev

1. SSH into your VM and clone the repo:
   ```bash
   ssh vmname.exe.xyz
   git clone git@github.com:fav83/magpie.git
   cd magpie/api
   ```

2. Create `.env` with production keys:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. Build and start:
   ```bash
   docker compose up -d --build
   ```

4. Point exe.dev's proxy to port 8000 (from your local machine):
   ```bash
   ssh exe.dev share port vmname 8000
   ssh exe.dev share set-public vmname
   ```

5. Verify:
   ```bash
   curl https://vmname.exe.xyz/health
   ```

## YouTube IP blocking

YouTube blocks requests from most cloud provider IPs. If you get `"Failed to retrieve transcript"` errors, you need a residential proxy. The `youtube-transcript-api` library has built-in support for [Webshare](https://www.webshare.io/) rotating residential proxies. See the architecture docs for details.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEYS` | Yes | JSON array of valid API keys (e.g., `["key1","key2"]`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | Azure Application Insights connection string |
| `HOST` | No | Bind address (default: `0.0.0.0`) |
| `PORT` | No | Port (default: `8000`) |
