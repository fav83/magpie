from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(
    api_key: str | None = Security(api_key_header),
) -> str:
    if not api_key or api_key not in settings.API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return api_key
