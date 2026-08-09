"""AI 对话消息模型 —— 存储用户与 AI 教练的对话记录"""

from sqlalchemy import Column, String, Text, JSON, Boolean, ForeignKey
from app.models.base import BaseModel


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    goal_id = Column(String(36), ForeignKey("goals.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(10), nullable=False)  # "user" | "ai"
    content = Column(Text, default="")  # 显示文本（用户消息原文 / AI 回复正文）
    ai_raw = Column(JSON, default=None)  # AI 完整 JSON 返回（仅 ai 消息，便于调试）
    suggested_adjustments = Column(JSON, default=None)  # 从 AI 回复中提取的调整建议
    applied = Column(Boolean, default=False)  # 用户是否已应用这些调整
