from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.auth import require_api_key
from app.config import settings
from app.transcript import extract_video_id, fetch_transcript, format_transcript

if settings.APPLICATIONINSIGHTS_CONNECTION_STRING:
    from azure.monitor.opentelemetry import configure_azure_monitor

    configure_azure_monitor(
        connection_string=settings.APPLICATIONINSIGHTS_CONNECTION_STRING
    )

app = FastAPI(
    title="Magpie Transcript API",
    version="1.0.0",
    description="Fetches YouTube video transcripts",
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "details": exc.errors()},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/transcript")
async def get_transcript(
    url: str = Query(..., description="YouTube video URL"),
    _api_key: str = Depends(require_api_key),
):
    video_id = extract_video_id(url)
    if not video_id:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid YouTube URL"},
        )

    segments = fetch_transcript(video_id)
    return {
        "video_id": video_id,
        "transcript": format_transcript(segments),
    }
