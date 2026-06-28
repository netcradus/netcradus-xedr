import os


class Settings:

    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5433/sentryxdr"
    )

    secret_key = os.getenv(
        "SECRET_KEY",
        "change-this-secret-key"
    )

    algorithm = os.getenv(
        "JWT_ALGORITHM",
        "HS256"
    )

    # Short-lived access token (15 min default); refresh token handles renewal
    access_token_expire_minutes = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
    )

    # Long-lived refresh token stored in httpOnly cookie
    refresh_token_expire_days = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30")
    )

    agent_registration_token = os.getenv("AGENT_REGISTRATION_TOKEN", "")

    # SMTP for platform system emails (verification, password reset)
    # This is Netcradus's own email — NOT per-customer
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", "noreply@sentryxdr.com")

    # Frontend URL (used in email links)
    app_url = os.getenv("APP_URL", "http://localhost:5173")

    # CORS — comma-separated allowed origins
    # Production example: ALLOWED_ORIGINS=https://app.sentryxdr.com
    allowed_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    # Redis / Celery broker
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")


settings = Settings()
