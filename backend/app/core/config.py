from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://societyops:societyops_dev@localhost:5432/societyops"
    DATABASE_URL_SYNC: str = "postgresql://societyops:societyops_dev@localhost:5432/societyops"
    SECRET_KEY: str = "change-me-in-production-use-32-chars-min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    UPLOADS_DIR: str = "/uploads"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    APP_ENV: str = "development"

    # Outgoing email (forgot-password). Empty SMTP_HOST disables sending.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587  # 587 = STARTTLS, 465 = implicit TLS
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""  # defaults to SMTP_USER
    TEMP_PASSWORD_TTL_MINUTES: int = 30
    FORGOT_PASSWORD_COOLDOWN_MINUTES: int = 5

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
