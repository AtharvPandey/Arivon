"""
Central place for all app configuration.
Pydantic's BaseSettings automatically reads values from a `.env` file
or from real environment variables (env vars always win in production).
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./arivon.db"
    secret_key: str = "dev-only-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


# Import `settings` anywhere in the app to access these values.
settings = Settings()
