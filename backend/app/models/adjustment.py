"""调整记录模型 —— 记录每次 AI 动态调整"""

from sqlalchemy import Column, String, Text, JSON, Boolean, ForeignKey
from app.models.base import BaseModel


class Adjustment(BaseModel):
    __tablename__ = "adjustments"

    goal_id = Column(String(36), ForeignKey("goals.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # 触发方式
    trigger = Column(String(30), nullable=False)
    # user_request | auto_delay_threshold | monthly_review | new_goal_added

    # AI 决策上下文（给 AI 的输入摘要）
    context_summary = Column(Text, default="")

    # AI 返回的完整调整结果
    ai_output = Column(JSON, default=None)

    # 用户是否确认了这次调整
    confirmed_by_user = Column(Boolean, default=False)
