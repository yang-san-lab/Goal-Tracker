"""任务相关的请求/响应模型"""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class TaskCheckin(BaseModel):
    """用户打卡/反馈"""
    task_id: str
    action: str = Field(..., description="completed | delayed | skipped")
    note: str = Field(default="", max_length=500, description="备注：为什么没完成？完成了有什么感想？")
    duration_actual: Optional[int] = Field(default=None, description="实际耗时（分钟）")


class TaskUpdate(BaseModel):
    """更新任务的执行时间与提醒"""
    scheduled_time: Optional[str] = Field(default=None, description="执行时间 HH:MM，null 表示清除")
    reminder_time: Optional[str] = Field(default=None, description="提醒时间 HH:MM，null 表示清除")


class TaskResponse(BaseModel):
    """任务详情"""
    id: str
    goal_id: str
    user_id: str
    title: str
    description: str
    scheduled_date: date
    duration_minutes: int
    priority: int
    category: str
    status: str
    completed_at: Optional[datetime] = None
    scheduled_time: Optional[str] = None
    reminder_minutes: Optional[int] = None
    reminder_time: Optional[str] = None
    delayed_reason: str
    user_note: str
    sort_order: int
    ai_generated: bool
    goal_title: str = ""          # 所属目标标题
    earnable_stars: int = 0       # 完成可获得星星数
    # ── 团队分配字段 ──
    assignment_type: str = "own"
    assigned_by: Optional[str] = None
    assigned_by_username: str = ""
    assigned_to: Optional[str] = None
    assignee_name: str = ""
    team_id: Optional[str] = None
    assignment_status: Optional[str] = None
    team_name: str = ""

    class Config:
        from_attributes = True


class DailyTasksResponse(BaseModel):
    """某一天的所有任务"""
    date: date
    tasks: list[TaskResponse]
    completion_rate: float  # 0.0 - 1.0
    total_minutes: int
    completed_minutes: int


class WeekProgress(BaseModel):
    """一周进度"""
    week_start: date
    week_end: date
    total_tasks: int
    completed_tasks: int
    delayed_tasks: int
    completion_rate: float
    daily_breakdown: list[dict]  # 每天的数据


class TaskLogResponse(BaseModel):
    """任务日志"""
    id: str
    task_id: str
    action: str
    old_scheduled_date: Optional[date]
    new_scheduled_date: Optional[date]
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True
