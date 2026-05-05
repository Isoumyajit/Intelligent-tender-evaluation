from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
