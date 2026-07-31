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

    # Comma-separated list of frontend origins allowed to call this API.
    # Defaults to local dev; for a deployed frontend (e.g. Vercel), set
    # CORS_ALLOWED_ORIGINS=https://your-app.vercel.app in the environment.
    cors_allowed_origins: str = "http://localhost:3000"

    # WhatsApp notifications (via Twilio). If whatsapp_enabled is False, or
    # credentials are missing, messages are printed to the console instead
    # of actually sent — this "dry run" mode lets you build and test the
    # whole feature before signing up for Twilio.
    whatsapp_enabled: bool = False
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = "whatsapp:+14155238886"  # Twilio sandbox default

    class Config:
        env_file = ".env"


# Import `settings` anywhere in the app to access these values.
settings = Settings()
