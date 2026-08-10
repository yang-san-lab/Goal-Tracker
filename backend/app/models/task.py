"""任务模型 —— AI 拆解后的每日任务"""

from sqlalchemy import Column, String, Text, Date, Integer, Float, Boolean, DateTime, ForeignKey
from app.models.base import BaseModel


class Task(BaseModel):
    __tablename__ = "tasks"

    goal_id = Column(String(36), ForeignKey("goals.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    scheduled_time = Column(String(5), default=None)          # 计划执行时间 HH:MM
    reminder_minutes = Column(Integer, default=None)          # 提前 N 分钟提醒；0=准时；None=不提醒

    title = Column(String(300), nullable=False)              # 任务标题，如"背30个考研单词"
    description = Column(Text, default="")                   # 详细说明
    scheduled_date = Column(Date, nullable=False, index=True) # 计划执行日期
    duration_minutes = Column(Integer, default=30)            # 预计耗时（分钟）
    priority = Column(Integer, default=3)                     # 优先级 1-5，1最高
    category = Column(String(50), default="")                 # 分类：学习/工作/健康/生活

    status = Column(String(20), default="pending")            # pending | completed | delayed | skipped
    completed_at = Column(DateTime, default=None)
    delayed_reason = Column(Text, default="")                 # 用户填写的延期原因
    user_note = Column(Text, default="")                      # 用户打卡时的备注

    parent_task_id = Column(String(36), default=None)         # 父子任务关系（预留）
    sort_order = Column(Integer, default=0)
    ai_generated = Column(Boolean, default=True)              # 是否 AI 生成

    # ── 团队分配字段 ──
    assignment_type = Column(String(20), default="own")       # "own" | "assigned"
    assigned_by = Column(String(36), ForeignKey("users.id"), nullable=True, default=None)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True, default=None)
    team_id = Column(String(36), ForeignKey("teams.id"), nullable=True, default=None)
    assignment_status = Column(String(20), default=None)      # None | "pending_accept" | "accepted" | "rejected"


class TaskLog(BaseModel):
    """任务操作日志 —— 记录每次状态变更，用于 AI 分析用户行为模式"""
    __tablename__ = "task_logs"

    task_id = Column(String(36), ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(20), nullable=False)              # completed | delayed | skipped | adjusted
    old_scheduled_date = Column(Date, default=None)
    new_scheduled_date = Column(Date, default=None)
    reason = Column(Text, default="")                        # 变更原因
