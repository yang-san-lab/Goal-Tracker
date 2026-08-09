"""目标相关的请求/响应模型"""

from datetime import date, datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    """用户创建目标的请求"""
    title: str = Field(..., min_length=1, max_length=200, description="你的大目标，如'考研上岸'")
    description: str = Field(default="", max_length=2000, description="详细描述你的目标和情况")
    goal_type: str = Field(default="yearly", description="yearly | monthly | custom")
    start_date: date
    end_date: date
    daily_hours: float = Field(default=2.0, ge=0.17, le=16, description="每天可用时间（小时），最小约10分钟")
    rest_days_per_week: int = Field(default=0, ge=0, le=3, description="每周休息几天：0/1/2/3")


class GoalResponse(BaseModel):
    """目标详情响应"""
    id: str
    user_id: str
    title: str
    description: str
    goal_type: str
    start_date: date
    end_date: date
    status: str
    ai_breakdown: Optional[Any] = None
    daily_hours: str
    rest_days_per_week: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalListItem(BaseModel):
    """目标列表项（不包含完整的 ai_breakdown 以节省带宽）"""
    id: str
    title: str
    goal_type: str
    start_date: date
    end_date: date
    status: str
    daily_hours: str
    rest_days_per_week: str
    created_at: datetime

    class Config:
        from_attributes = True


class OverloadCheck(BaseModel):
    """过载检查结果"""
    total_daily_hours: float
    goal_count: int
    threshold: float
    is_overloaded: bool
    warning: str


class BreakdownResponse(BaseModel):
    """AI 拆解结果"""
    goal_id: str
    breakdown: Any
    message: str


class AdjustmentTrigger(BaseModel):
    """触发 AI 动态调整"""
    goal_id: str
    trigger: str = "user_request"  # user_request | auto_delay_threshold


class AdjustmentResponse(BaseModel):
    """AI 调整结果"""
    adjustment_id: str
    goal_id: str
    adjustments_made: list
    message: str


# ── AI 教练对话 ──

class ChatMessageCreate(BaseModel):
    """用户发送聊天消息"""
    message: str = Field(..., min_length=1, max_length=2000)


class ChatMessageResponse(BaseModel):
    """单条聊天消息"""
    id: str
    goal_id: str
    role: str
    content: str
    suggested_adjustments: Optional[Any] = None
    applied: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChatApplyRequest(BaseModel):
    """应用 AI 建议的调整"""
    message_id: str
