"""积分和成就模型"""

from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text, ForeignKey
from app.models.base import BaseModel


class UserPoints(BaseModel):
    """用户积分账户"""
    __tablename__ = "user_points"

    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)


class PointTransaction(BaseModel):
    """积分流水"""
    __tablename__ = "point_transactions"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    type = Column(String(30), nullable=False)              # task_complete | streak_bonus | milestone | penalty | redeem
    source_task_id = Column(String(36), default=None)      # 关联的任务 ID


class Achievement(BaseModel):
    """成就定义"""
    __tablename__ = "achievements"

    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    icon = Column(String(50), default="🏆")
    condition_json = Column(JSON, default=None)             # {"type": "streak", "days": 7}
    points_reward = Column(Integer, default=0)


class UserAchievement(BaseModel):
    """用户获得的成就"""
    __tablename__ = "user_achievements"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(String(36), ForeignKey("achievements.id"), nullable=False)
    unlocked_at = Column(DateTime, default=None)


class CustomReward(BaseModel):
    """用户自定义的奖励（奖池）"""
    __tablename__ = "custom_rewards"

    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    star_cost = Column(Integer, nullable=False)             # 兑换所需星星数
    icon = Column(String(50), default="🎁")
    is_active = Column(Boolean, default=True)
