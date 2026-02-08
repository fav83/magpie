# Magpie — Transcript API Implementation Plan

**Document Version:** 1.0
**Last Updated:** 2026-02-08

---

## Prerequisites

- Python 3.12+ installed locally (for development)
- Docker and Docker Compose installed locally (for containerized runs)
- exe.dev VM (Docker is pre-installed)
- Azure Application Insights resource (connection string)
- (Optional) A subdomain CNAME pointed at `vmname.exe.xyz` for a custom domain

---

## Phase 1: Project Scaffolding

### 1.1 Create directory structure

```
magpie/api/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── auth.py
│   ├── transcript.py
│   └── config.py
├── tests/
│   ├── __init__.py
│   ├── test_main.py
│   └── test_transcript.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

### 1.2 Create `requirements.txt`

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
youtube-transcript-api==1.*
azure-monitor-opentelemetry==1.*
pydantic-settings==2.*
pytest==8.*
httpx==0.28.*
```

- `pydantic-settings` — loads config from environment variables with type validation
- `httpx` — async HTTP client used by FastAPI's test client

### 1.3 Create `.env.example`

```env
# JSON array of valid API keys
API_KEYS=["your-api-key-1","your-api-key-2"]

# Azure Application Insights connection string
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=xxx;IngestionEndpoint=https://xxx

# Uvicorn settings
HOST=0.0.0.0
PORT=8000
```

---

## Phase 2: Core Application

### 2.1 Configuration (`app/config.py`)

Use `pydantic-settings` to load and validate environment variables:

- `API_KEYS: list[str]` — parsed from JSON array env var (e.g., `["key1","key2"]`)
- `APPLICATIONINSIGHTS_CONNECTION_STRING: str | None` — optional, telemetry disabled if absent
- `HOST: str` — default `0.0.0.0`
- `PORT: int` — default `8000`

### 2.2 Authentication (`app/auth.py`)

Create a FastAPI dependency that:

1. Reads the `X-API-Key` header from the request
2. Checks it against the configured `API_KEYS` list
3. Returns `401 Unauthorized` if missing or invalid
4. Use `fastapi.security.APIKeyHeader` for OpenAPI docs integration

### 2.3 Transcript fetching (`app/transcript.py`)

Create a function `fetch_transcript(video_id: str) -> list[dict]` that:

1. Instantiates `YouTubeTranscriptApi()` and calls `ytt_api.fetch(video_id, languages=['en'])`
2. If that raises `NoTranscriptFound`, retry with `ytt_api.list(video_id)` and pick the first available transcript (manual preferred over auto-generated)
3. Return the raw segments via `fetched.to_raw_data()`: `[{"text": str, "start": float, "duration": float}, ...]`

Create a function `format_transcript(segments: list[dict]) -> str` that converts segments into timestamped plain text matching the extension's format:
```
[0:18] We're no strangers to love
[0:21] You know the rules and so do I
```
4. Map library exceptions to appropriate HTTP errors:
   - `TranscriptsDisabled` → 404 with message "Transcripts are disabled for this video"
   - `NoTranscriptFound` → 404 with message "No transcript available for this video"
   - `VideoUnavailable` → 404 with message "Video not found"
   - Other exceptions → 500

### 2.4 YouTube URL parsing

Create a helper function `extract_video_id(url: str) -> str | None` that handles:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`

Return `None` for invalid URLs (results in 400 response).

### 2.5 Main application (`app/main.py`)

1. Initialize FastAPI app with title, version, and description
2. Configure Azure Monitor OpenTelemetry (if connection string is present)
3. Define endpoints:

**`GET /health`** — No auth, returns `{"status": "ok"}`

**`GET /transcript`** — Requires API key:
  - Validate `url` query parameter
  - Extract video ID (400 if invalid)
  - Fetch transcript (404 if unavailable)
  - Return `{"video_id": str, "transcript": str}` (formatted plain text with timestamps)

4. Add exception handlers for consistent error response format:
```json
{
  "error": "Human-readable error message"
}
```

---

## Phase 3: Testing

### 3.1 Unit tests (`tests/test_transcript.py`)

- Test `extract_video_id` with all supported URL formats
- Test `extract_video_id` with invalid URLs returns `None`
- Test `fetch_transcript` with mocked `YouTubeTranscriptApi` — happy path
- Test `fetch_transcript` with mocked exceptions (disabled, not found, unavailable)
- Test language fallback: English not available → falls back to first available

### 3.2 Integration tests (`tests/test_main.py`)

Use FastAPI's `TestClient` (backed by `httpx`):

- Test `GET /health` returns 200
- Test `GET /transcript` without API key returns 401
- Test `GET /transcript` with invalid API key returns 401
- Test `GET /transcript` with valid key but missing `url` returns 422 (FastAPI validation)
- Test `GET /transcript` with valid key and invalid URL returns 400
- Test `GET /transcript` with valid key and valid URL returns 200 (mock the library)
- Test `GET /transcript` with video that has no transcript returns 404 (mock the library)

### 3.3 Run tests

```bash
cd api
pytest tests/ -v
```

---

## Phase 4: Docker

### 4.1 Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Key decisions:
- `python:3.12-slim` — small image, production-ready
- No dev dependencies in the image
- Non-root user can be added later for hardening

### 4.2 docker-compose.yml

```yaml
services:
  api:
    build: .
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env
    restart: unless-stopped
```

- Bind to `127.0.0.1:8000` — exe.dev's proxy forwards traffic to this port
- `restart: unless-stopped` — auto-restart on crash or VM reboot

### 4.3 Local verification

```bash
cd api
docker compose up --build
curl http://localhost:8000/health
curl -H "X-API-Key: test-key" "http://localhost:8000/transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## Phase 5: exe.dev Deployment

### 5.1 Deploy the container

1. Copy `api/` directory to the VM: `scp -r api/ vmname.exe.xyz:~/api/`
2. SSH into the VM: `ssh vmname.exe.xyz`
3. Create `.env` file with production API keys and Application Insights connection string
4. Run `docker compose up -d --build`
5. Verify with `curl http://localhost:8000/health`

### 5.2 Configure exe.dev proxy

Point exe.dev's HTTPS proxy to the Docker container port:

```bash
ssh exe.dev share port vmname 8000
```

The API is now available at `https://vmname.exe.xyz/`. exe.dev handles TLS termination and certificate management automatically.

### 5.3 (Optional) Custom domain

To use a custom domain like `api.yourdomain.com`, add a CNAME record at your DNS provider:

```
api.yourdomain.com  →  CNAME  →  vmname.exe.xyz
```

exe.dev automatically issues TLS certificates for custom domains.

### 5.4 Verify end-to-end

```bash
curl https://vmname.exe.xyz/health
curl -H "X-API-Key: your-key" "https://vmname.exe.xyz/transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## Phase 6: Application Insights

### 6.1 Setup

In `app/main.py`, before creating the FastAPI app:

```python
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor(
    connection_string=settings.APPLICATIONINSIGHTS_CONNECTION_STRING
)
```

This auto-instruments:
- All incoming FastAPI requests (latency, status, URL)
- All outgoing HTTP calls (youtube-transcript-api's requests to YouTube)
- Unhandled exceptions (full stack traces)

### 6.2 Verify in Azure Portal

After deploying, check:
- **Live Metrics** — real-time request flow
- **Transaction Search** — individual request details
- **Failures** — exception drill-down
- **Performance** — latency percentiles

---

## Implementation Order Summary

| Step | Description | Depends On |
|------|-------------|------------|
| 1 | Project scaffolding (directories, requirements, .env.example) | — |
| 2 | `config.py` — settings from environment | Step 1 |
| 3 | `auth.py` — API key dependency | Step 2 |
| 4 | `transcript.py` — URL parsing + transcript fetching | Step 2 |
| 5 | `main.py` — FastAPI app, endpoints, error handlers | Steps 3, 4 |
| 6 | Tests — unit + integration | Step 5 |
| 7 | Dockerfile + docker-compose.yml | Step 5 |
| 8 | Local Docker verification | Steps 6, 7 |
| 9 | exe.dev deployment + proxy configuration | Step 8 |
| 10 | Application Insights integration + verification | Step 9 |

---

## Estimated File Count

| File | Purpose |
|------|---------|
| `app/__init__.py` | Package marker |
| `app/main.py` | FastAPI app + endpoints (~60 lines) |
| `app/auth.py` | API key validation (~20 lines) |
| `app/transcript.py` | Transcript fetching + URL parsing (~70 lines) |
| `app/config.py` | Settings (~15 lines) |
| `tests/__init__.py` | Package marker |
| `tests/test_main.py` | Endpoint tests (~80 lines) |
| `tests/test_transcript.py` | Unit tests (~60 lines) |
| `Dockerfile` | Container build (~10 lines) |
| `docker-compose.yml` | Compose config (~10 lines) |
| `requirements.txt` | Dependencies (~7 lines) |
| `.env.example` | Environment template (~5 lines) |

**Total: ~12 files, ~400 lines of code**
