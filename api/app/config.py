from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    API_KEYS: list[str] = []
    APPLICATIONINSIGHTS_CONNECTION_STRING: str | None = None
    HOST: str = "0.0.0.0"
    PORT: int = 8000


settings = Settings()
