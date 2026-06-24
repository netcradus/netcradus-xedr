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


settings = Settings()
