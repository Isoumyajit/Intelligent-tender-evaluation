from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db"
    sarvam_api_key: str = ""
    mock_bidder_docs: bool = True
    mock_tender_docs: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
