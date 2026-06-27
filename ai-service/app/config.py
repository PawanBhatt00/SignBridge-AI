from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8000
    model_path: str = "./models/asl_classifier.keras"
    confidence_threshold: float = 0.70
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://localhost:4000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
