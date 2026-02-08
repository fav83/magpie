# Magpie — Transcript API Architecture

**Document Version:** 1.0
**Last Updated:** 2026-02-08

---

## 1. Overview

The Transcript API is a lightweight backend service that accepts a YouTube video URL and returns the video's transcript. It exists because the Chrome extension extracts transcripts client-side (via content scripts injected into the YouTube page), but other consumers — such as the planned mobile app — cannot inject into YouTube pages and need a server-side extraction path.

---

## 2. Technology Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| Language | Python 3.12+ | Ecosystem has the strongest YouTube transcript libraries |
| Web Framework | FastAPI | Modern, async, auto-generates OpenAPI docs, minimal boilerplate |
| ASGI Server | Uvicorn | Standard production server for FastAPI |
| Transcript Library | youtube-transcript-api | Most popular and actively maintained (6,800+ GitHub stars, ~1.7M weekly PyPI downloads, MIT license) |
| Telemetry | Azure Monitor OpenTelemetry | Application Insights integration for request tracking, error logging, and diagnostics |
| Containerization | Docker | Reproducible deployment, isolation, negligible performance overhead |
| Hosting | exe.dev | Persistent VMs with built-in HTTPS proxy and automatic TLS certificates |

---

## 3. High-Level Architecture

```
┌──────────────┐     HTTPS     ┌───────────┐     HTTP      ┌─────────────────────┐
│   Consumers  │ ───────────►  │  exe.dev  │ ────────────► │  Uvicorn + FastAPI   │
│  (Mobile,    │               │  proxy    │  :8000         │                     │
│   Extension, │               │ (TLS +   │                │  ┌───────────────┐  │
│   Other)     │               │  certs)  │                │  │  /transcript   │  │
└──────────────┘               └───────────┘                │  │   endpoint     │  │
                                                            │  └───────┬───────┘  │
                                                            │          │          │
                                                            │          ▼          │
                                                            │  ┌───────────────┐  │
                                                            │  │  youtube-      │  │
                                                            │  │  transcript-   │  │
                                                            │  │  api library   │  │
                                                            │  └───────┬───────┘  │
                                                            │          │          │
                                                            └──────────┼──────────┘
                                                                       │
                                                                       ▼
                                                            ┌──────────────────┐
                                                            │  YouTube (public  │
                                                            │  timedtext API)   │
                                                            └──────────────────┘

                       ┌──────────────────────┐
                       │  Azure Application   │
                       │  Insights             │◄──── telemetry (HTTPS)
                       │  (monitoring)         │
                       └──────────────────────┘
```

---

## 4. API Design

### 4.1 Authentication

All requests require an API key passed in the `X-API-Key` header. Keys are stored as a JSON array environment variable (`API_KEYS`). This is a simple shared-secret model — sufficient for a controlled set of known consumers.

### 4.2 Endpoints

#### `GET /transcript`

Returns the transcript for a YouTube video.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Full YouTube video URL (e.g., `https://www.youtube.com/watch?v=VIDEO_ID`) |

**Request Example:**

```
GET /transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
X-API-Key: your-api-key-here
```

**Success Response (200):**

```json
{
  "video_id": "dQw4w9WgXcQ",
  "transcript": "[0:18] We're no strangers to love\n[0:21] You know the rules and so do I"
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid or missing YouTube URL |
| 401 | Missing or invalid API key |
| 404 | Video not found or has no transcript/captions |
| 500 | Unexpected server error |

#### `GET /health`

Health check endpoint (no authentication required).

**Response (200):**

```json
{
  "status": "ok"
}
```

### 4.3 Language Selection

The API follows this priority chain when selecting a transcript language:

1. English manual captions
2. English auto-generated captions
3. First available language (manual)
4. First available language (auto-generated)

This matches the extension's existing behavior.

---

## 5. Key Architectural Decisions

### 5.1 Python over TypeScript

The extension is TypeScript, but the API uses Python because:
- `youtube-transcript-api` (Python) is the most mature and actively maintained transcript library — 6,800+ stars, ~1.7M weekly downloads, updated January 2026
- The TypeScript/Node.js alternatives are either stale or have significantly fewer users
- The API is a standalone service with no shared code with the extension — language choice is independent

### 5.2 youtube-transcript-api Library

This library fetches transcripts by:
1. Requesting the YouTube video page HTML
2. Extracting the Innertube API context from embedded scripts
3. Calling YouTube's internal timedtext API to retrieve caption tracks
4. Parsing XML/JSON3 caption format into structured segments

**Important:** This uses YouTube's undocumented internal API, not the official YouTube Data API v3. The official API only allows downloading captions for videos you own. All working transcript libraries use this same undocumented approach. The library is MIT-licensed and widely used in production (including LangChain integrations).

### 5.3 No Caching

Transcripts are fetched fresh on every request. This keeps the architecture simple — no cache invalidation logic, no additional infrastructure (Redis), no stale data concerns. If performance or YouTube rate-limiting becomes an issue, an in-memory TTL cache can be added later without architectural changes.

### 5.4 Docker Deployment on exe.dev

The API runs in a Docker container on an exe.dev VM. Docker is pre-installed on exe.dev VMs and adds negligible overhead (containers share the host kernel). This provides:
- Reproducible builds across environments
- Isolation from other services on the VM
- Simple deployment via `docker compose up`

### 5.5 exe.dev as Reverse Proxy

exe.dev's built-in HTTPS proxy sits in front of the Docker container. It handles:
- HTTPS/TLS termination with automatically issued certificates
- Request forwarding to the configured port
- Custom domain support via CNAME records

No manual Nginx or certbot configuration is needed.

---

## 6. Monitoring and Observability

### Azure Application Insights

The API sends telemetry to Application Insights using the `azure-monitor-opentelemetry` SDK. This provides:

- **Request tracking** — Latency, status codes, and URLs for every API call
- **Dependency tracking** — Outgoing HTTP calls to YouTube's timedtext API
- **Exception logging** — Full stack traces for unhandled errors
- **Live metrics** — Real-time monitoring in Azure Portal

The Application Insights connection string is passed via environment variable. The VPS does not need to be hosted on Azure — telemetry is sent over HTTPS to Azure's ingestion endpoint.

---

## 7. Security

| Concern | Mitigation |
|---------|------------|
| Unauthorized access | API key required on all endpoints (except `/health`) |
| HTTPS | exe.dev proxy terminates TLS with automatically issued certificates |
| Input validation | URL validated as a proper YouTube URL before processing |
| Secret management | API keys and connection strings stored in environment variables, not in code |
| Container isolation | Docker container runs with minimal privileges |

---

## 8. Relationship to Other Components

```
┌─────────────────────────────────────────────────────────┐
│                     Magpie Ecosystem                     │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │   Extension   │   │  Mobile App  │   │  Transcript │ │
│  │  (Chrome)     │   │  (Planned)   │   │  API        │ │
│  │              │   │              │   │  (This)     │ │
│  │  Extracts    │   │  Calls API   │   │  Serves     │ │
│  │  transcripts │   │  for         │   │  transcripts│ │
│  │  client-side │   │  transcripts │   │             │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬──────┘ │
│         │                  │                   │        │
│         │                  └───────────────────┘        │
│         │                          │                    │
│         ▼                          ▼                    │
│  ┌──────────────┐         ┌──────────────┐              │
│  │  YouTube     │         │  OpenRouter  │              │
│  │  (captions)  │         │  (AI/LLM)   │              │
│  └──────────────┘         └──────────────┘              │
└─────────────────────────────────────────────────────────┘
```

- The **extension** continues to extract transcripts client-side (more reliable, uses browser session)
- The **mobile app** calls the Transcript API (cannot inject into YouTube pages)
- The **Transcript API** is a shared backend service, independent of any specific consumer

---

## 9. Project Structure (within monorepo)

```
magpie/
├── api/                          # Transcript API
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI application, endpoints
│   │   ├── auth.py               # API key validation dependency
│   │   ├── transcript.py         # Transcript fetching logic
│   │   └── config.py             # Settings (env vars, constants)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_main.py          # Endpoint tests
│   │   └── test_transcript.py    # Transcript logic tests
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── extension/                    # Chrome extension (existing)
├── landing/                      # Landing page (existing)
├── docs/                         # Documentation (existing)
└── ...
```

---

## 10. Future Considerations

- **Caching layer** — Add in-memory or Redis caching if YouTube rate-limits become an issue
- **Summarization endpoint** — Add `/summarize` that pipes transcript to an LLM via OpenRouter
- **Rate limiting** — Per-key rate limits if more consumers are added
- **Batch endpoint** — Accept multiple URLs in a single request (playlist support)
- **Language parameter** — Allow consumers to request a specific language instead of the default English-first chain

---

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
- [Azure Monitor OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=python)
- [exe.dev Documentation](https://exe.dev/docs)
- [Magpie Extension Architecture](./extension-architecture.md)
- [Magpie Mobile App Architecture](./mobile-architecture.md)
