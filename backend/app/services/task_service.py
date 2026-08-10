"""任务服务 —— 每日任务查询、打卡、进度统计"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.task import Task, TaskLog
from app.models.goal import Goal
from app.models.user import User
from app.models.team import Team
from app.services.rule_engine import handle_task_delayed, check_delay_threshold
from app.services.reward_service import calculate_stars
from app.events.event_bus import emit, Event, TASK_COMPLETED, TASK_DELAYED, TASK_SKIPPED

logger = logging.getLogger(__name__)


def _actionable_task_filter(user_id: str):
    """某用户“要处理”的任务：自己的未转交任务 + 已接受的分配任务。"""
    return or_(
        and_(
            Task.user_id == user_id,
            or_(
                Task.assigned_to.is_(None),
                Task.assignment_status != "accepted",
            ),
        ),
        and_(
            Task.assigned_to == user_id,
            Task.assignment_status == "accepted",
        ),
    )


def auto_delay_overdue_tasks(db: Session, user_id: str) -> list[Task]:
    """自动将逾期的待办任务延后到最近可用日期"""
    today = date.today()
    overdue = (
        db.query(Task)
        .filter(
            _actionable_task_filter(user_id),
            Task.scheduled_date < today,
            Task.status == "pending",
        )
        .order_by(Task.scheduled_date)
        .all()
    )

    if not overdue:
        return []

    rescheduled = []
    cursor_date = today  # 从今天开始往后排

    for task in overdue:
        # 跳过周末
        while cursor_date.weekday() >= 5:  # 5=周六 6=周日
            cursor_date += timedelta(days=1)

        old_date = task.scheduled_date
        task.status = "delayed"
        task.scheduled_date = cursor_date
        task.delayed_reason = "系统自动延后（逾期未完成）"

        log = TaskLog(
            task_id=task.id,
            user_id=user_id,
            action="delayed",
            old_scheduled_date=old_date,
            new_scheduled_date=cursor_date,
            reason="逾期自动延后",
        )
        db.add(log)
        rescheduled.append(task)

        # 每天安排有限个延后任务，避免全堆在一天
        day_count = sum(
            1 for t in rescheduled
            if t.scheduled_date == cursor_date
        )
        if day_count >= 3:  # 每天最多塞 3 个延期任务
            cursor_date += timedelta(days=1)

    if rescheduled:
        db.flush()
        logger.info(f"自动延后了 {len(rescheduled)} 个逾期任务")

    return rescheduled


def get_daily_tasks(db: Session, user_id: str, target_date: Optional[date] = None) -> dict:
    """获取某一天的所有任务（含自动延后逻辑）"""
    if target_date is None:
        target_date = date.today()

    # 自动处理逾期任务
    auto_delay_overdue_tasks(db, user_id)

    tasks = (
        db.query(Task)
        .filter(
            _actionable_task_filter(user_id),
            Task.scheduled_date == target_date,
        )
        .order_by(Task.priority, Task.sort_order)
        .all()
    )

    completed = [t for t in tasks if t.status == "completed"]
    total_minutes = sum(t.duration_minutes for t in tasks)
    completed_minutes = sum(t.duration_minutes for t in completed)

    # 获取每个任务所属目标的标题
    goal_ids = list({t.goal_id for t in tasks})
    goal_map = {}
    if goal_ids:
        goals = db.query(Goal).filter(Goal.id.in_(goal_ids)).all()
        goal_map = {g.id: g.title for g in goals}

    # 获取团队任务元数据
    team_task_ids = [t.id for t in tasks if t.assignment_type == "assigned"]
    assigner_map = {}  # user_id -> username
    team_map = {}      # team_id -> team_name
    if team_task_ids:
        assigner_ids = list({t.assigned_by for t in tasks if t.assigned_by})
        team_ids = list({t.team_id for t in tasks if t.team_id})
        if assigner_ids:
            users = db.query(User).filter(User.id.in_(assigner_ids)).all()
            assigner_map = {u.id: u.username for u in users}
        if team_ids:
            teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
            team_map = {t.id: t.name for t in teams}

    # 给每个 task 附加 goal_title、earnable_stars 和团队元数据
    for t in tasks:
        t.goal_title = goal_map.get(t.goal_id, "")
        t.earnable_stars = calculate_stars(
            duration_minutes=t.duration_minutes,
            priority=t.priority,
            on_time=t.scheduled_date >= date.today(),
        ) if t.status in ("pending", "completed") else 0
        # 团队字段
        t.assignee_name = ""
        t.assigned_by_username = assigner_map.get(t.assigned_by or "", "")
        t.team_name = team_map.get(t.team_id or "", "")

    return {
        "date": target_date,
        "tasks": tasks,
        "completion_rate": round(len(completed) / len(tasks), 2) if tasks else 0.0,
        "total_minutes": total_minutes,
        "completed_minutes": completed_minutes,
    }


def checkin_task(
    db: Session,
    user_id: str,
    task_id: str,
    action: str,
    note: str = "",
    duration_actual: Optional[int] = None,
) -> Task:
    """打卡一个任务

    Args:
        action: 'completed' | 'delayed' | 'skipped'
        note: 用户备注
        duration_actual: 实际耗时
    """
    if action not in {"completed", "delayed", "skipped"}:
        raise ValueError("无效的打卡操作")

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise ValueError("任务不存在")

    can_checkin = (
        task.user_id == user_id
        and (task.assigned_to is None or task.assignment_status != "accepted")
    ) or (
        task.assigned_to == user_id
        and task.assignment_status == "accepted"
    )
    if not can_checkin:
        raise ValueError("任务不存在或无权操作")

    if action == "completed":
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        task.user_note = note

        log = TaskLog(
            task_id=task.id,
            user_id=user_id,
            action="completed",
        )
        db.add(log)

        emit(Event(TASK_COMPLETED, {
            "task_id": task.id,
            "user_id": user_id,
            "goal_id": task.goal_id,
            "on_time": task.scheduled_date >= date.today(),
            "duration_minutes": task.duration_minutes,
            "priority": task.priority,
        }))

    elif action == "delayed":
        task = handle_task_delayed(db, task, reason=note, user_id=user_id)

    elif action == "skipped":
        task.status = "skipped"
        task.user_note = note

        log = TaskLog(
            task_id=task.id,
            user_id=user_id,
            action="skipped",
            reason=note,
        )
        db.add(log)

        emit(Event(TASK_SKIPPED, {
            "task_id": task.id,
            "user_id": user_id,
            "reason": note,
        }))

    db.flush()

    # 规则引擎检查：延期率是否超过阈值
    if check_delay_threshold(db, task.goal_id, user_id):
        logger.info(f"Goal {task.goal_id} 延期率超过阈值，建议触发 AI 重排")

    return task


def get_week_progress(db: Session, user_id: str, week_start: Optional[date] = None) -> dict:
    """获取一周的进度统计"""
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())  # 本周一

    week_end = week_start + timedelta(days=6)

    tasks = (
        db.query(Task)
        .filter(
            _actionable_task_filter(user_id),
            Task.scheduled_date >= week_start,
            Task.scheduled_date <= week_end,
        )
        .all()
    )

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    delayed = sum(1 for t in tasks if t.status == "delayed")

    # 按天分组
    daily_breakdown = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        day_tasks = [t for t in tasks if t.scheduled_date == d]
        day_completed = sum(1 for t in day_tasks if t.status == "completed")
        daily_breakdown.append({
            "date": str(d),
            "total": len(day_tasks),
            "completed": day_completed,
            "rate": round(day_completed / len(day_tasks), 2) if day_tasks else 0,
        })

    return {
        "week_start": week_start,
        "week_end": week_end,
        "total_tasks": total,
        "completed_tasks": completed,
        "delayed_tasks": delayed,
        "completion_rate": round(completed / total, 2) if total else 0.0,
        "daily_breakdown": daily_breakdown,
    }


def get_overdue_tasks(db: Session, user_id: str) -> list[Task]:
    """获取所有逾期未完成的任务"""
    today = date.today()
    return (
        db.query(Task)
        .filter(
            _actionable_task_filter(user_id),
            Task.scheduled_date < today,
            Task.status.in_(["pending", "delayed"]),
        )
        .order_by(Task.scheduled_date)
        .all()
    )
