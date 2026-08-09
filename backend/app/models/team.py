"""团队模型 —— 队长创建团队，成员通过邀请码加入"""

import random
import string

from sqlalchemy import Column, String, Text, ForeignKey
from app.models.base import BaseModel


def _gen_invite_code() -> str:
    """生成 6 位数字邀请码"""
    return ''.join(random.choices(string.digits, k=6))


class Team(BaseModel):
    __tablename__ = "teams"

    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    captain_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    invite_code = Column(String(6), default=_gen_invite_code, unique=True, index=True)
    is_active = Column(String(10), default="active")  # "active" | "inactive"


class TeamMember(BaseModel):
    __tablename__ = "team_members"

    team_id = Column(String(36), ForeignKey("teams.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(10), default="member")  # "captain" | "member"
    status = Column(String(10), default="active")  # "active" | "left"
