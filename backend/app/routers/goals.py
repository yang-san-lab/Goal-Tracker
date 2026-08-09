"""目标路由 —— 创建目标、获取目标、触发 AI 调整、删除目标"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.models.task import Task, TaskLog
from app.routers.auth import get_current_user
from app.schemas.goal import (
    GoalCreate, GoalResponse, GoalListItem,
    BreakdownResponse, AdjustmentTrigger, AdjustmentResponse,
    OverloadCheck, ChatMessageCreate, ChatMessageResponse, ChatApplyRequest,
)
from app.schemas.task import TaskLogResponse, TaskResponse
from app.services.goal_service import (
    create_goal_with_breakdown,
    trigger_adjustment,
    get_goal_progress,
    send_chat_message,
    apply_chat_adjustment,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/goals", tags=["目标"])


@router.post("/", response_model=GoalResponse, status_code=201)
def create_goal(
    data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建新目标并触发 AI 拆解"""
    try:
        goal = create_goal_with_breakdown(
            db=db,
            user_id=current_user.id,
            title=data.title,
            description=data.description,
            goal_type=data.goal_type,
            start_date=data.start_date,
            end_date=data.end_date,
            daily_hours=data.daily_hours,
            rest_days_per_week=data.rest_days_per_week,
        )
        db.commit()
        return GoalResponse.model_validate(goal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # AI 调用失败 —— 目标已创建但无拆解
        db.commit()
        raise HTTPException(status_code=500, detail=f"目标已创建但 AI 拆解失败: {e}")


@router.get("/", response_model=list[GoalListItem])
def list_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有目标列表"""
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
        .all()
    )
    return [GoalListItem.model_validate(g) for g in goals]


@router.get("/overload-check", response_model=OverloadCheck)
def check_overload(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    new_daily_hours: float = 0,
):
    """检查所有活跃目标的总每日时长是否过载"""
    OVERLOAD_THRESHOLD = 8.0

    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id, Goal.status == "active")
        .all()
    )

    total = new_daily_hours
    for g in goals:
        try:
            total += float(g.daily_hours)
        except (ValueError, TypeError):
            pass

    is_overloaded = total > OVERLOAD_THRESHOLD
    warning = ""
    if is_overloaded:
        warning = (
            f"⚠️ 你所有活跃目标加起来每天需要 {total:.1f} 小时，"
            f"超过建议上限 {OVERLOAD_THRESHOLD} 小时。"
            f"建议减少某个目标的每日时间，或暂停一些目标，否则可能无法坚持。"
        )
    elif total > OVERLOAD_THRESHOLD * 0.8:
        warning = (
            f"💡 你当前每日总时长 {total:.1f} 小时，"
            f"接近建议上限 {OVERLOAD_THRESHOLD} 小时，请注意合理安排。"
        )

    return OverloadCheck(
        total_daily_hours=round(total, 1),
        goal_count=len(goals) + (1 if new_daily_hours > 0 else 0),
        threshold=OVERLOAD_THRESHOLD,
        is_overloaded=is_overloaded,
        warning=warning,
    )


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单个目标详情（包含 AI 拆解结果）"""
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")
    return GoalResponse.model_validate(goal)


@router.get("/{goal_id}/progress")
def get_progress(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取目标完成进度"""
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")
    return get_goal_progress(db, goal_id, current_user.id)


@router.post("/adjust", response_model=AdjustmentResponse)
def request_adjustment(
    data: AdjustmentTrigger,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发 AI 动态调整（手动请求或自动触发）"""
    try:
        adjustment = trigger_adjustment(
            db=db,
            goal_id=data.goal_id,
            user_id=current_user.id,
            trigger=data.trigger,
        )
        db.commit()

        ai_output = adjustment.ai_output or {}
        return AdjustmentResponse(
            adjustment_id=adjustment.id,
            goal_id=adjustment.goal_id,
            adjustments_made=ai_output.get("adjustments_made", []),
            message=ai_output.get("assessment", "调整完成"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"AI 调整失败: {e}")


# ── AI 教练对话 ──

@router.get("/{goal_id}/chat", response_model=list[ChatMessageResponse])
def get_chat_history(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取目标的 AI 教练对话历史"""
    from app.models.chat import ChatMessage

    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.goal_id == goal_id, ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [ChatMessageResponse.model_validate(m) for m in messages]


@router.post("/{goal_id}/chat", response_model=ChatMessageResponse)
def post_chat_message(
    goal_id: str,
    data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送聊天消息并获取 AI 教练回复"""
    try:
        ai_msg = send_chat_message(db, goal_id, current_user.id, data.message)
        db.commit()
        return ChatMessageResponse.model_validate(ai_msg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"AI 回复失败: {e}")


@router.post("/{goal_id}/chat/apply")
def apply_chat_suggestions(
    goal_id: str,
    data: ChatApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """应用 AI 教练建议的调整"""
    try:
        count = apply_chat_adjustment(db, goal_id, current_user.id, data.message_id)
        db.commit()
        return {"applied": True, "adjustments_count": count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{goal_id}/tasks", response_model=list[TaskResponse])
def get_goal_tasks(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取目标下所有任务"""
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")

    tasks = (
        db.query(Task)
        .filter(Task.goal_id == goal_id)
        .order_by(Task.scheduled_date, Task.sort_order)
        .all()
    )
    return [TaskResponse.model_validate(t) for t in tasks]


@router.delete("/{goal_id}")
def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除目标及其所有关联任务"""
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")

    # 级联删除：先删任务日志，再删任务，最后删目标
    task_ids = [
        t[0] for t in
        db.query(Task.id).filter(Task.goal_id == goal_id).all()
    ]
    if task_ids:
        db.query(TaskLog).filter(TaskLog.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(Task).filter(Task.goal_id == goal_id).delete(synchronize_session=False)

    db.query(Goal).filter(Goal.id == goal_id).delete(synchronize_session=False)
    db.commit()
    return {"detail": "目标已删除"}


@router.get("/{goal_id}/timeline", response_model=list[TaskLogResponse])
def get_goal_timeline(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取目标下所有任务的操作时间线（最近100条）"""
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")

    task_ids = [
        t[0] for t in
        db.query(Task.id).filter(Task.goal_id == goal_id).all()
    ]
    if not task_ids:
        return []

    logs = (
        db.query(TaskLog)
        .filter(TaskLog.task_id.in_(task_ids))
        .order_by(TaskLog.created_at.desc())
        .limit(100)
        .all()
    )
    return [TaskLogResponse.model_validate(log) for log in logs]


@router.get("/{goal_id}/calendar")
def get_goal_calendar(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取目标的日历热力图数据：每天的任务完成情况"""
    from collections import defaultdict
    from datetime import date

    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")

    tasks = (
        db.query(Task)
        .filter(Task.goal_id == goal_id)
        .order_by(Task.scheduled_date)
        .all()
    )

    # 按日期聚合
    by_date: dict = defaultdict(lambda: {"total": 0, "completed": 0, "delayed": 0, "skipped": 0})
    for t in tasks:
        d = str(t.scheduled_date)
        by_date[d]["total"] += 1
        if t.status == "completed":
            by_date[d]["completed"] += 1
        elif t.status == "delayed":
            by_date[d]["delayed"] += 1
        elif t.status == "skipped":
            by_date[d]["skipped"] += 1

    # 转换为列表，计算每日完成率
    calendar_data = []
    for d, stats in sorted(by_date.items()):
        rate = round(stats["completed"] / stats["total"], 2) if stats["total"] > 0 else 0
        calendar_data.append({
            "date": d,
            **stats,
            "rate": rate,
        })

    # 总体统计
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == "completed")
    delayed_tasks = sum(1 for t in tasks if t.status == "delayed")

    return {
        "goal_id": goal_id,
        "calendar": calendar_data,
        "summary": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "delayed_tasks": delayed_tasks,
            "completion_rate": round(completed_tasks / total_tasks, 2) if total_tasks > 0 else 0,
        },
    }
