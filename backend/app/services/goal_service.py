"""目标服务 —— 编排目标创建、AI拆解、动态调整的完整流程"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.goal import Goal
from app.models.task import Task, TaskLog
from app.models.adjustment import Adjustment
from app.models.chat import ChatMessage
from app.services.ai_service import breakdown_goal, adjust_plan, chat_with_goal
from app.services.rule_engine import check_delay_threshold
from app.events.event_bus import emit, Event, GOAL_CREATED, GOAL_BREAKDOWN_DONE

logger = logging.getLogger(__name__)


def create_goal_with_breakdown(
    db: Session,
    user_id: str,
    title: str,
    description: str,
    goal_type: str,
    start_date: date,
    end_date: date,
    daily_hours: float,
    rest_days_per_week: int = 0,
) -> Goal:
    """创建目标并调用 AI 拆解"""
    # 1. 创建 Goal 记录
    goal = Goal(
        user_id=user_id,
        title=title,
        description=description,
        goal_type=goal_type,
        start_date=start_date,
        end_date=end_date,
        daily_hours=str(daily_hours),
        rest_days_per_week=str(rest_days_per_week),
    )
    db.add(goal)
    db.flush()  # 获取 goal.id

    emit(Event(GOAL_CREATED, {"goal_id": goal.id, "user_id": user_id, "title": title}))

    # 2. 调用 AI 拆解
    try:
        breakdown = breakdown_goal(
            title=title,
            description=description,
            start_date=str(start_date),
            end_date=str(end_date),
            daily_hours=daily_hours,
            rest_days_per_week=rest_days_per_week,
        )
        goal.ai_breakdown = breakdown

        # 3. 将拆解结果落库为 Task 记录
        _save_breakdown_as_tasks(db, goal.id, user_id, breakdown)

        emit(Event(GOAL_BREAKDOWN_DONE, {"goal_id": goal.id, "user_id": user_id}))

    except Exception as e:
        logger.error(f"AI 拆解失败: {e}")
        goal.status = "active"  # 即使拆解失败，目标仍然创建
        goal.ai_breakdown = {"error": str(e)}
        db.flush()
        raise

    db.flush()
    return goal


def _save_breakdown_as_tasks(db: Session, goal_id: str, user_id: str, breakdown: dict):
    """将 AI 拆解的 JSON 结果转换为 Task 数据库记录"""
    tasks_to_add = []

    for milestone in breakdown.get("milestones", []):
        for week in milestone.get("weekly_goals", []):
            for day in week.get("daily_tasks", []):
                day_date = day.get("date")
                if not day_date:
                    continue

                for i, t in enumerate(day.get("tasks", [])):
                    task = Task(
                        goal_id=goal_id,
                        user_id=user_id,
                        title=t.get("title", ""),
                        description=t.get("description", ""),
                        scheduled_date=date.fromisoformat(day_date),
                        duration_minutes=t.get("duration_min", 30),
                        priority=t.get("priority", 3),
                        category=t.get("category", ""),
                        sort_order=i,
                        ai_generated=True,
                    )
                    db.add(task)
                    tasks_to_add.append(task)

    logger.info(f"从 AI 拆解结果创建了 {len(tasks_to_add)} 个任务")
    db.flush()


def trigger_adjustment(
    db: Session,
    goal_id: str,
    user_id: str,
    trigger: str = "user_request",
    user_feedback: str = "",
) -> Optional[Adjustment]:
    """触发 AI 动态调整"""
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise ValueError("目标不存在")

    # 收集上下文数据
    tasks = (
        db.query(Task)
        .filter(Task.goal_id == goal_id, Task.user_id == user_id)
        .order_by(Task.scheduled_date)
        .all()
    )

    completed = [t for t in tasks if t.status == "completed"]
    delayed = [t for t in tasks if t.status == "delayed"]
    pending = [t for t in tasks if t.status == "pending" and t.scheduled_date > date.today()]

    # 构建摘要
    completed_summary = "\n".join(
        f"- {t.scheduled_date}: {t.title} ✅" for t in completed[-20:]
    ) if completed else ""

    delayed_summary = "\n".join(
        f"- {t.scheduled_date} → {t.title}（原因：{t.delayed_reason or '未说明'}）"
        for t in delayed[-20:]
    ) if delayed else ""

    upcoming = "\n".join(
        f"- {t.scheduled_date}: {t.title} [{t.duration_minutes}分钟, 优先级{t.priority}]"
        for t in pending[:30]
    ) if pending else "（暂无排期任务）"

    # 创建调整记录
    adjustment = Adjustment(
        goal_id=goal_id,
        user_id=user_id,
        trigger=trigger,
        context_summary=json.dumps({
            "completed_count": len(completed),
            "delayed_count": len(delayed),
            "pending_count": len(pending),
        }, ensure_ascii=False),
    )
    db.add(adjustment)
    db.flush()

    # 调用 AI
    try:
        result = adjust_plan(
            goal_title=goal.title,
            goal_description=goal.description or "",
            daily_hours=float(goal.daily_hours),
            start_date=str(goal.start_date),
            end_date=str(goal.end_date),
            completed_summary=completed_summary,
            delayed_summary=delayed_summary,
            upcoming_tasks=upcoming,
            user_feedback=user_feedback,
        )
        adjustment.ai_output = result

        # 🔑 将 AI 调整真正应用到数据库
        _apply_adjustments(db, goal_id, user_id, result)

        # 🔑 更新目标的 AI 拆解结果（让导图反映最新规划）
        if result.get("updated_tasks"):
            goal.ai_breakdown = result  # 用 AI 返回的新计划替换旧的
        elif result.get("adjustments_made"):
            # AI 只返回调整项，没有完整新计划 → 从 DB 同步
            _sync_breakdown_from_db(db, goal)

        db.flush()
        return adjustment

    except Exception as e:
        logger.error(f"AI 动态调整失败: {e}")
        adjustment.ai_output = {"error": str(e)}
        db.flush()
        raise


def _apply_adjustments(db: Session, goal_id: str, user_id: str, ai_result: dict):
    """将 AI 返回的调整应用到实际任务"""
    from datetime import date as date_type

    adjustments_made = ai_result.get("adjustments_made", [])
    if not adjustments_made:
        logger.info("AI 未返回任何调整")
        return

    applied = 0
    for adj in adjustments_made:
        task_title = adj.get("task_title", "")
        original_date_str = adj.get("original_date", "")
        new_date_str = adj.get("new_date", "")
        reason = adj.get("reason", "AI 调整")

        if not task_title or not new_date_str:
            continue

        # 查找匹配的未完成任务
        task = (
            db.query(Task)
            .filter(
                Task.goal_id == goal_id,
                Task.user_id == user_id,
                Task.title == task_title,
                Task.status.in_(["pending", "delayed"]),
            )
            .first()
        )

        if not task:
            logger.warning(f"未找到可调整的任务: {task_title}")
            continue

        old_date = task.scheduled_date
        new_date = date_type.fromisoformat(new_date_str)
        task.scheduled_date = new_date
        task.status = "pending"  # 重置为待办
        task.delayed_reason = ""

        # 记录日志
        log = TaskLog(
            task_id=task.id,
            user_id=user_id,
            action="adjusted",
            old_scheduled_date=old_date,
            new_scheduled_date=new_date,
            reason=reason,
        )
        db.add(log)
        applied += 1

    logger.info(f"AI 调整已应用: {applied}/{len(adjustments_made)} 项")


def get_goal_progress(db: Session, goal_id: str, user_id: str) -> dict:
    """获取目标的整体进度"""
    tasks = (
        db.query(Task)
        .filter(Task.goal_id == goal_id, Task.user_id == user_id)
        .all()
    )
    total = len(tasks)
    if total == 0:
        return {"total": 0, "completed": 0, "delayed": 0, "pending": 0, "completion_rate": 0.0}

    completed = sum(1 for t in tasks if t.status == "completed")
    delayed = sum(1 for t in tasks if t.status == "delayed")
    pending = sum(1 for t in tasks if t.status == "pending")

    return {
        "total": total,
        "completed": completed,
        "delayed": delayed,
        "pending": pending,
        "completion_rate": round(completed / total, 2),
    }


def send_chat_message(
    db: Session,
    goal_id: str,
    user_id: str,
    message: str,
) -> ChatMessage:
    """发送聊天消息并获取 AI 教练回复"""
    # 1. 验证目标归属
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise ValueError("目标不存在")

    # 2. 收集任务上下文（复用 trigger_adjustment 的模式）
    tasks = (
        db.query(Task)
        .filter(Task.goal_id == goal_id, Task.user_id == user_id)
        .order_by(Task.scheduled_date)
        .all()
    )

    completed = [t for t in tasks if t.status == "completed"]
    delayed = [t for t in tasks if t.status == "delayed"]
    pending = [
        t for t in tasks
        if t.status == "pending" and t.scheduled_date >= date.today()
    ]

    completed_summary = "\n".join(
        f"- {t.scheduled_date}: {t.title} ✅" for t in completed[-20:]
    ) if completed else ""

    delayed_summary = "\n".join(
        f"- {t.scheduled_date} → {t.title}（原因：{t.delayed_reason or '未说明'}）"
        for t in delayed[-20:]
    ) if delayed else ""

    pending_summary = "\n".join(
        f"- {t.scheduled_date}: {t.title} [{t.duration_minutes}分钟, 优先级{t.priority}]"
        for t in pending[:30]
    ) if pending else "（暂无排期任务）"

    # 3. 获取最近对话历史
    recent_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.goal_id == goal_id, ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at)
        .limit(20)
        .all()
    )
    import json
    chat_history_json = json.dumps(
        [{"role": m.role, "content": m.content} for m in recent_messages],
        ensure_ascii=False,
    )

    # 4. 保存用户消息
    user_msg = ChatMessage(
        goal_id=goal_id,
        user_id=user_id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    db.flush()

    # 5. 调用 AI
    try:
        result = chat_with_goal(
            goal_title=goal.title,
            goal_description=goal.description or "",
            daily_hours=goal.daily_hours,
            start_date=str(goal.start_date),
            end_date=str(goal.end_date),
            completed_summary=completed_summary,
            delayed_summary=delayed_summary,
            pending_summary=pending_summary,
            chat_history_json=chat_history_json,
            user_message=message,
        )
    except Exception as e:
        logger.error(f"AI 教练对话失败: {e}")
        # 保存错误消息作为 AI 回复
        ai_msg = ChatMessage(
            goal_id=goal_id,
            user_id=user_id,
            role="ai",
            content=f"抱歉，AI 服务暂时不可用：{e}",
            ai_raw={"error": str(e)},
            suggested_adjustments=[],
            applied=True,
        )
        db.add(ai_msg)
        db.flush()
        raise RuntimeError(f"AI 回复失败: {e}") from e

    # 6. 保存 AI 回复
    reply = result.get("reply", "")
    suggested = result.get("suggested_adjustments") or []

    ai_msg = ChatMessage(
        goal_id=goal_id,
        user_id=user_id,
        role="ai",
        content=reply,
        ai_raw=result,
        suggested_adjustments=suggested if suggested else None,
        applied=len(suggested) == 0,  # 无调整建议时标记为已应用
    )
    db.add(ai_msg)
    db.flush()

    logger.info(
        f"AI 教练回复已保存，长度={len(reply)}，调整建议={len(suggested)} 项"
    )
    return ai_msg


def apply_chat_adjustment(
    db: Session,
    goal_id: str,
    user_id: str,
    message_id: str,
) -> int:
    """应用 AI 聊天消息中的调整建议"""
    # 1. 查找并验证消息
    chat_msg = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.id == message_id,
            ChatMessage.goal_id == goal_id,
            ChatMessage.user_id == user_id,
        )
        .first()
    )
    if not chat_msg:
        raise ValueError("消息不存在")
    if chat_msg.role != "ai":
        raise ValueError("只能应用 AI 消息中的调整建议")
    if chat_msg.applied:
        raise ValueError("该消息的调整建议已经应用过了")

    # 2. 获取调整建议
    adjustments = chat_msg.suggested_adjustments or []
    if not adjustments:
        raise ValueError("该消息没有可应用的调整建议")

    # 3. 包装后调用现有的 _apply_adjustments
    wrapped = {"adjustments_made": adjustments}
    _apply_adjustments(db, goal_id, user_id, wrapped)

    # 4. 同步 ai_breakdown，让导图反映最新的任务日期
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if goal and goal.ai_breakdown:
        _sync_breakdown_from_db(db, goal)

    # 5. 标记为已应用
    chat_msg.applied = True

    logger.info(f"聊天调整已应用: {len(adjustments)} 项，消息ID={message_id}")
    return len(adjustments)


def _sync_breakdown_from_db(db: Session, goal: Goal):
    """根据数据库中的实际任务日期，按周范围重建 ai_breakdown 的 daily_tasks"""
    import copy
    from collections import defaultdict

    tasks = (
        db.query(Task)
        .filter(Task.goal_id == goal.id, Task.user_id == goal.user_id)
        .order_by(Task.scheduled_date)
        .all()
    )

    # 按 DB 实际日期分组所有任务
    by_date = defaultdict(list)
    for t in tasks:
        by_date[str(t.scheduled_date)].append({
            "title": t.title,
            "description": t.description or "",
            "duration_min": t.duration_minutes,
            "priority": t.priority,
            "category": t.category or "",
        })

    breakdown = goal.ai_breakdown
    if not breakdown or not isinstance(breakdown, dict):
        return

    # 深拷贝避免在遍历的同时修改原数据导致混乱
    new_breakdown = copy.deepcopy(breakdown)

    # 遍历每个里程碑 → 周，只保留 DB 日期落在该周范围内的任务
    for milestone in new_breakdown.get("milestones", []):
        for week in milestone.get("weekly_goals", []):
            week_start = week.get("start_date", "")
            week_end = week.get("end_date", "")

            if not week_start or not week_end:
                continue

            # 找出所有实际日期落在这个周范围内的 DB 任务
            week_days = []
            tracked_dates = set()  # 记录已分配的日期

            for date_str in sorted(by_date.keys()):
                if week_start <= date_str <= week_end:
                    week_days.append({
                        "date": date_str,
                        "day_of_week": "",
                        "tasks": by_date[date_str],
                    })
                    tracked_dates.add(date_str)

            week["daily_tasks"] = week_days

    # 替换整个 breakdown
    goal.ai_breakdown = new_breakdown
    flag_modified(goal, "ai_breakdown")
