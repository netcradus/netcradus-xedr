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

    access_token_expire_minutes = int(
        os.getenv(
            "ACCESS_TOKEN_EXPIRE_MINUTES",
            "60"
        )
    )

    agent_registration_token = os.getenv(
        "AGENT_REGISTRATION_TOKEN",
        ""
    )

    # SMTP for system emails (verification, password reset)
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", "noreply@sentryxdr.com")

    # Frontend URL (used in email links)
    app_url = os.getenv("APP_URL", "http://localhost:5173")


settings = Settings()
