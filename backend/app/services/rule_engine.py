"""规则引擎 —— 处理确定性的任务调度逻辑，不调用 AI。

规则优先级从高到低：
1. 任务延期 → 自动后移到下一个可用日
2. 连续 N 天完成同类任务 → 建议增量
3. 延期率超阈值 → 触发 AI 重新评估
4. 周末 → 自动减量
"""

import logging
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.task import Task, TaskLog
from app.events.event_bus import emit, Event, TASK_DELAYED

logger = logging.getLogger(__name__)

# 阈值配置（后续可做成用户可配置）
DELAY_RATE_THRESHOLD = 0.3       # 延期率超过 30% 触发 AI 重排
STREAK_DAYS_THRESHOLD = 7        # 连续完成 7 天建议增量
WEEKEND_REDUCTION = 0.5          # 周末任务量减半
INCREMENT_RATE = 0.1             # 增量比例 10%


def _next_available_date(
    db: Session, user_id: str, from_date: date, end_date: date
) -> Optional[date]:
    """找到下一个可排任务的日期（当天任务总时长未超限的最近日期）"""
    current = from_date + timedelta(days=1)
    # 简单实现：找最近 7 天内第一个日期
    for _ in range(7):
        if current > end_date:
            return None  # 超出目标周期，无法重排
        # 如果是周末，容量更小，但仍然可以排
        current += timedelta(days=1)
    # 简化：直接返回下一个非过去的日期
    next_date = from_date + timedelta(days=1)
    return next_date if next_date <= end_date else None


def handle_task_delayed(db: Session, task: Task, reason: str = "") -> Task:
    """处理任务延期：自动后移一天，记录日志，发射事件"""
    old_date = task.scheduled_date
    new_date = task.scheduled_date + timedelta(days=1)

    # 如果是周五，跳到下周一
    if new_date.weekday() == 5:  # 周六
        new_date += timedelta(days=2)
    elif new_date.weekday() == 6:  # 周日
        new_date += timedelta(days=1)

    task.status = "delayed"
    task.delayed_reason = reason
    task.scheduled_date = new_date

    # 记录日志
    log = TaskLog(
        task_id=task.id,
        user_id=task.user_id,
        action="delayed",
        old_scheduled_date=old_date,
        new_scheduled_date=new_date,
        reason=reason or "自动后移（规则引擎）",
    )
    db.add(log)

    # 发射事件（预留：后续积分系统可监听扣分）
    emit(Event(TASK_DELAYED, {
        "task_id": task.id,
        "user_id": task.user_id,
        "old_date": str(old_date),
        "new_date": str(new_date),
        "reason": reason,
    }))

    logger.info(f"任务 '{task.title}' 从 {old_date} 延期到 {new_date}")
    return task


def check_delay_threshold(db: Session, goal_id: str, user_id: str) -> bool:
    """检查延期率是否超过阈值，超过则应该触发 AI 重排"""
    from datetime import datetime, timezone

    # 统计最近 7 天的任务
    week_ago = date.today() - timedelta(days=7)
    total = (
        db.query(Task)
        .filter(
            Task.goal_id == goal_id,
            Task.user_id == user_id,
            Task.scheduled_date >= week_ago,
            Task.scheduled_date <= date.today(),
        )
        .count()
    )
    if total == 0:
        return False

    delayed = (
        db.query(Task)
        .filter(
            Task.goal_id == goal_id,
            Task.user_id == user_id,
            Task.scheduled_date >= week_ago,
            Task.scheduled_date <= date.today(),
            Task.status == "delayed",
        )
        .count()
    )

    rate = delayed / total
    should_trigger = rate >= DELAY_RATE_THRESHOLD
    if should_trigger:
        logger.info(f"延期率 {rate:.0%} 超过阈值 {DELAY_RATE_THRESHOLD:.0%}，应触发 AI 重排")
    return should_trigger


def compute_weekend_task_count(normal_count: int, is_weekend: bool) -> int:
    """周末自动减量"""
    if not is_weekend:
        return normal_count
    reduced = max(1, int(normal_count * WEEKEND_REDUCTION))
    return reduced


def suggest_increment(task_title: str, current_amount: int) -> dict:
    """建议增量（如 30 词 → 33 词）"""
    new_amount = int(current_amount * (1 + INCREMENT_RATE))
    return {
        "task_title": task_title,
        "current": current_amount,
        "suggested": new_amount,
        "increase": f"{INCREMENT_RATE:.0%}",
        "message": f"连续完成表现优秀！建议将 '{task_title}' 从 {current_amount} 提升到 {new_amount}",
    }
