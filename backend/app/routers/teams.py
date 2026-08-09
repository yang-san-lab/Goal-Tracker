"""团队路由 —— 创建团队、加入、成员管理、任务分配"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.team import (
    TeamCreate,
    TeamJoin,
    TaskAssign,
    AssignmentRespond,
    TeamResponse,
    TeamListItem,
)
from app.services import team_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/teams", tags=["团队"])


# ── 团队 CRUD ──

@router.post("/", response_model=TeamResponse, status_code=201)
def create_team(
    data: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建团队，创建者自动成为队长"""
    try:
        team = team_service.create_team(db, current_user.id, data.name, data.description)
        detail = team_service.get_team_detail(db, team.id, current_user.id)
        db.commit()
        return detail
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[TeamListItem])
def list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的所有团队"""
    teams = team_service.get_user_teams(db, current_user.id)
    result = []
    for t in teams:
        result.append({
            "id": t.id,
            "name": t.name,
            "description": t.description or "",
            "captain_id": t.captain_id,
            "invite_code": t.invite_code,
            "is_active": t.is_active,
            "member_count": getattr(t, "member_count", 0),
            "user_role": getattr(t, "user_role", "member"),
            "created_at": t.created_at,
        })
    return result


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取团队详情"""
    try:
        detail = team_service.get_team_detail(db, team_id, current_user.id)
        return detail
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 成员管理 ──

@router.post("/join", response_model=TeamResponse)
def join_team(
    data: TeamJoin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """通过邀请码加入团队"""
    try:
        member = team_service.join_team(db, current_user.id, data.invite_code)
        db.commit()
        detail = team_service.get_team_detail(db, member.team_id, current_user.id)
        return detail
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{team_id}/members/{member_user_id}")
def remove_member(
    team_id: str,
    member_user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """队长移除成员"""
    try:
        team_service.remove_member(db, current_user.id, team_id, member_user_id)
        db.commit()
        return {"ok": True, "message": "成员已移除"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{team_id}/leave")
def leave_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """退出团队"""
    try:
        team_service.leave_team(db, current_user.id, team_id)
        db.commit()
        return {"ok": True, "message": "已退出团队"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 任务分配 ──

@router.post("/{team_id}/tasks/{task_id}/assign")
def assign_task(
    team_id: str,
    task_id: str,
    data: TaskAssign,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """队长将任务分配给团队成员"""
    try:
        task = team_service.assign_task_to_member(
            db=db,
            captain_id=current_user.id,
            task_id=task_id,
            assignee_id=data.assignee_id,
            team_id=team_id,
        )
        db.commit()

        # 附加被分配者用户名
        from app.models.user import User as UserModel
        assignee = db.query(UserModel).filter(UserModel.id == data.assignee_id).first()
        task.assignee_name = assignee.username if assignee else ""

        from app.schemas.task import TaskResponse
        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{team_id}/tasks")
def get_team_tasks(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取队长在团队中发布的所有任务"""
    tasks = team_service.get_captain_tasks(db, team_id, current_user.id)

    # 附加元数据
    from app.models.user import User as UserModel
    from app.models.goal import Goal
    user_ids = list({t.assigned_to for t in tasks if t.assigned_to})
    goal_ids = list({t.goal_id for t in tasks})
    user_map = {}
    goal_map = {}
    if user_ids:
        users = db.query(UserModel).filter(UserModel.id.in_(user_ids)).all()
        user_map = {u.id: u.username for u in users}
    if goal_ids:
        goals = db.query(Goal).filter(Goal.id.in_(goal_ids)).all()
        goal_map = {g.id: g.title for g in goals}

    from app.schemas.task import TaskResponse
    result = []
    for t in tasks:
        t.goal_title = goal_map.get(t.goal_id, "")
        t.assignee_name = user_map.get(t.assigned_to or "", "")
        result.append(TaskResponse.model_validate(t))
    return result
