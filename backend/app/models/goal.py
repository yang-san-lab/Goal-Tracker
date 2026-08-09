"""目标模型 —— 存储用户的大目标和 AI 拆解结果"""

from sqlalchemy import Column, String, Text, Date, JSON, ForeignKey
from app.models.base import BaseModel


class Goal(BaseModel):
    __tablename__ = "goals"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)          # 用户原始输入，如"考研上岸"
    description = Column(Text, default="")                # 详细描述
    goal_type = Column(String(20), default="yearly")      # yearly | monthly | custom
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="active")         # active | completed | paused | abandoned
    ai_breakdown = Column(JSON, default=None)             # AI 拆解的完整 JSON 结果
    daily_hours = Column(String(50), default="4")         # 快照：拆解时的每日可用时间
    rest_days_per_week = Column(String(10), default="0")  # 每周休息天数：0/1/2/3
