"""任务路由 —— 每日任务查询、打卡、进度统计"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.routers.auth import get_current_user
from app.schemas.task import TaskCheckin, TaskResponse, DailyTasksResponse, WeekProgress
from app.services.task_service import (
    get_daily_tasks,
    checkin_task,
    get_week_progress,
    get_overdue_tasks,
)
from app.services.reward_service import calculate_stars
from app.services import team_service
from datetime import date as date_type

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tasks", tags=["任务"])


@router.get("/daily", response_model=DailyTasksResponse)
def daily_tasks(
    target_date: Optional[str] = Query(default=None, description="日期 YYYY-MM-DD，默认今天"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取某一天的所有任务"""
    parsed_date = date.fromisoformat(target_date) if target_date else None
    result = get_daily_tasks(db, current_user.id, parsed_date)
    return DailyTasksResponse(
        date=result["date"],
        tasks=[TaskResponse.model_validate(t) for t in result["tasks"]],
        completion_rate=result["completion_rate"],
        total_minutes=result["total_minutes"],
        completed_minutes=result["completed_minutes"],
    )


@router.post("/checkin", response_model=TaskResponse)
def checkin(
    data: TaskCheckin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """任务打卡 —— 完成 / 延期 / 跳过"""
    try:
        task = checkin_task(
            db=db,
            user_id=current_user.id,
            task_id=data.task_id,
            action=data.action,
            note=data.note,
            duration_actual=data.duration_actual,
        )
        db.commit()

        # 附加目标标题和星星数
        goal = db.query(Goal).filter(Goal.id == task.goal_id).first()
        task.goal_title = goal.title if goal else ""
        task.earnable_stars = calculate_stars(
            duration_minutes=task.duration_minutes,
            priority=task.priority,
            on_time=task.scheduled_date >= date_type.today(),
        ) if task.status == "pending" else 0

        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/week", response_model=WeekProgress)
def week_progress(
    week_start: Optional[str] = Query(default=None, description="周一日期 YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取一周进度统计"""
    parsed_start = date.fromisoformat(week_start) if week_start else None
    result = get_week_progress(db, current_user.id, parsed_start)
    return WeekProgress(**result)


@router.get("/overdue", response_model=list[TaskResponse])
def overdue_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取逾期未完成的任务"""
    tasks = get_overdue_tasks(db, current_user.id)
    return [TaskResponse.model_validate(t) for t in tasks]


# ── 团队任务分配 ──

@router.get("/inbox", response_model=list[TaskResponse])
def task_inbox(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取待处理的任务分配（收件箱）"""
    tasks = team_service.get_assignment_inbox(db, current_user.id)

    # 附加元数据
    from app.models.user import User as UserModel
    from app.models.goal import Goal
    from app.models.team import Team as TeamModel

    assigner_ids = list({t.assigned_by for t in tasks if t.assigned_by})
    goal_ids = list({t.goal_id for t in tasks})
    team_ids = list({t.team_id for t in tasks if t.team_id})

    user_map = {}
    goal_map = {}
    team_map = {}
    if assigner_ids:
        users = db.query(UserModel).filter(UserModel.id.in_(assigner_ids)).all()
        user_map = {u.id: u.username for u in users}
    if goal_ids:
        goals = db.query(Goal).filter(Goal.id.in_(goal_ids)).all()
        goal_map = {g.id: g.title for g in goals}
    if team_ids:
        teams = db.query(TeamModel).filter(TeamModel.id.in_(team_ids)).all()
        team_map = {t.id: t.name for t in teams}

    result = []
    for t in tasks:
        t.goal_title = goal_map.get(t.goal_id, "")
        t.assigned_by_username = user_map.get(t.assigned_by or "", "")
        t.team_name = team_map.get(t.team_id or "", "")
        result.append(TaskResponse.model_validate(t))
    return result


@router.post("/{task_id}/accept", response_model=TaskResponse)
def accept_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """接受分配的任务"""
    try:
        task = team_service.accept_task(db, current_user.id, task_id)
        db.commit()
        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/reject", response_model=TaskResponse)
def reject_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """拒绝分配的任务"""
    try:
        task = team_service.reject_task(db, current_user.id, task_id)
        db.commit()
        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
