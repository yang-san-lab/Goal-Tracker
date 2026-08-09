"""应用配置 —— 所有环境变量从这里读取"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库
    DATABASE_URL: str = "sqlite:///./goal_tracker.db"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天

    # DeepSeek API
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    AI_MODEL: str = "deepseek-chat"  # deepseek-chat / deepseek-reasoner

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
