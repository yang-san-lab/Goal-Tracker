"""用户模型"""

from sqlalchemy import Column, String, Float
from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    daily_available_hours = Column(Float, default=4.0)  # 每天可用时间（小时）
    timezone = Column(String(50), default="Asia/Shanghai")
