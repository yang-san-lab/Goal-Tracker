"""团队相关的请求/响应模型"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 请求 ──

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)


class TeamJoin(BaseModel):
    invite_code: str = Field(..., min_length=1, max_length=20)


class TaskAssign(BaseModel):
    """队长分配任务给成员"""
    assignee_id: str  # 被分配的成员 user_id
    team_id: str      # 团队 id


class AssignmentRespond(BaseModel):
    """成员响应任务分配"""
    task_id: str
    action: str = Field(..., description="accept | reject")
    note: str = Field(default="", max_length=500)


# ── 响应 ──

class TeamMemberResponse(BaseModel):
    id: str
    team_id: str
    user_id: str
    username: str = ""
    role: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    id: str
    name: str
    description: str
    captain_id: str
    invite_code: str
    is_active: str
    member_count: int = 0
    members: list[TeamMemberResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class TeamListItem(BaseModel):
    id: str
    name: str
    description: str
    captain_id: str
    invite_code: str
    is_active: str
    member_count: int = 0
    user_role: str = "member"  # 当前用户的角色
    created_at: datetime

    class Config:
        from_attributes = True
