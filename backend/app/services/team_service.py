"""团队服务 —— 创建团队、加入、成员管理、任务分配"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.team import Team, TeamMember, _gen_invite_code
from app.models.user import User
from app.models.task import Task

logger = logging.getLogger(__name__)


# ── 团队 CRUD ──

def create_team(db: Session, user_id: str, name: str, description: str = "") -> Team:
    """创建团队，创建者自动成为 captain"""
    # 生成唯一邀请码（重试避免碰撞）
    invite_code = _gen_invite_code()
    for _ in range(10):
        if not db.query(Team).filter(Team.invite_code == invite_code).first():
            break
        invite_code = _gen_invite_code()

    team = Team(
        name=name,
        description=description,
        captain_id=user_id,
        invite_code=invite_code,
    )
    db.add(team)
    db.flush()

    # 创建者加入为 captain
    member = TeamMember(
        team_id=team.id,
        user_id=user_id,
        role="captain",
        status="active",
    )
    db.add(member)
    db.flush()

    logger.info(f"Team created: {team.name} (id={team.id}) by user={user_id}")
    return team


def get_user_teams(db: Session, user_id: str) -> list[dict]:
    """获取用户所属的所有活跃团队"""
    rows = (
        db.query(Team, TeamMember)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(
            TeamMember.user_id == user_id,
            TeamMember.status == "active",
            Team.is_active == "active",
        )
        .all()
    )

    result = []
    for team, member in rows:
        # 统计成员数
        member_count = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == team.id,
                TeamMember.status == "active",
            )
            .count()
        )
        team.member_count = member_count
        team.user_role = member.role
        result.append(team)

    return result


def get_team_detail(db: Session, team_id: str, user_id: str) -> dict:
    """获取团队详情（包含成员列表）"""
    team = db.query(Team).filter(Team.id == team_id, Team.is_active == "active").first()
    if not team:
        raise ValueError("团队不存在或已解散")

    # 验证用户在团队中
    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
            TeamMember.status == "active",
        )
        .first()
    )
    if not membership:
        raise ValueError("你不是该团队的成员")

    # 获取成员列表（join User 获取用户名）
    member_rows = (
        db.query(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .filter(TeamMember.team_id == team_id, TeamMember.status == "active")
        .order_by(TeamMember.role.desc(), TeamMember.created_at)
        .all()
    )

    members = []
    member_count = len(member_rows)
    for tm, user in member_rows:
        members.append({
            "id": tm.id,
            "team_id": tm.team_id,
            "user_id": tm.user_id,
            "username": user.username,
            "role": tm.role,
            "status": tm.status,
            "created_at": tm.created_at,
        })

    result = {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "captain_id": team.captain_id,
        "invite_code": team.invite_code,
        "is_active": team.is_active,
        "member_count": member_count,
        "user_role": membership.role,
        "members": members,
        "created_at": team.created_at,
    }
    return result


# ── 成员管理 ──

def join_team(db: Session, user_id: str, invite_code: str) -> TeamMember:
    """通过邀请码加入团队"""
    team = db.query(Team).filter(
        Team.invite_code == invite_code,
        Team.is_active == "active",
    ).first()
    if not team:
        raise ValueError("邀请码无效或团队不存在")

    # 检查是否已是成员
    existing = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    if existing:
        if existing.status == "active":
            raise ValueError("你已经是该团队的成员")
        else:
            # 之前退出过，重新激活
            existing.status = "active"
            existing.role = "member"
            db.flush()
            return existing

    member = TeamMember(
        team_id=team.id,
        user_id=user_id,
        role="member",
        status="active",
    )
    db.add(member)
    db.flush()
    logger.info(f"User {user_id} joined team {team.name} (id={team.id})")
    return member


def remove_member(db: Session, captain_id: str, team_id: str, member_user_id: str):
    """队长移除成员"""
    team = db.query(Team).filter(Team.id == team_id, Team.is_active == "active").first()
    if not team:
        raise ValueError("团队不存在")
    if team.captain_id != captain_id:
        raise ValueError("只有队长才能移除成员")
    if member_user_id == captain_id:
        raise ValueError("队长不能移除自己")

    member = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == member_user_id,
            TeamMember.status == "active",
        )
        .first()
    )
    if not member:
        raise ValueError("成员不在团队中")

    member.status = "left"

    # 将该成员所有 pending_accept 任务标记为 rejected
    rejected = (
        db.query(Task)
        .filter(
            Task.assigned_to == member_user_id,
            Task.team_id == team_id,
            Task.assignment_status == "pending_accept",
        )
        .update({"assignment_status": "rejected"}, synchronize_session="fetch")
    )
    db.flush()
    logger.info(f"Captain {captain_id} removed {member_user_id} from team {team_id}, rejected {rejected} pending tasks")


def leave_team(db: Session, user_id: str, team_id: str):
    """成员主动退出团队"""
    team = db.query(Team).filter(Team.id == team_id, Team.is_active == "active").first()
    if not team:
        raise ValueError("团队不存在")

    if team.captain_id == user_id:
        # 检查是否有其他成员
        other_count = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id != user_id,
                TeamMember.status == "active",
            )
            .count()
        )
        if other_count > 0:
            raise ValueError("队长不能退出团队，请先将队长转让给其他成员或移除所有成员")

    member = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
            TeamMember.status == "active",
        )
        .first()
    )
    if not member:
        raise ValueError("你不在该团队中")

    member.status = "left"

    # 将该成员所有 pending_accept 任务标记为 rejected
    db.query(Task).filter(
        Task.assigned_to == user_id,
        Task.team_id == team_id,
        Task.assignment_status == "pending_accept",
    ).update({"assignment_status": "rejected"}, synchronize_session="fetch")

    db.flush()
    logger.info(f"User {user_id} left team {team_id}")


# ── 任务分配 ──

def assign_task_to_member(
    db: Session,
    captain_id: str,
    task_id: str,
    assignee_id: str,
    team_id: str,
) -> Task:
    """队长将已有任务分配给团队成员"""
    # 验证队长身份
    team = db.query(Team).filter(Team.id == team_id, Team.is_active == "active").first()
    if not team:
        raise ValueError("团队不存在")
    if team.captain_id != captain_id:
        raise ValueError("只有队长才能分配任务")

    # 验证任务属于队长
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == captain_id).first()
    if not task:
        raise ValueError("任务不存在或不属于你")

    # 验证被分配者是团队成员
    member = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == assignee_id,
            TeamMember.status == "active",
        )
        .first()
    )
    if not member:
        raise ValueError("该用户不是团队成员")

    # 不能分配给自己
    if assignee_id == captain_id:
        raise ValueError("不能将任务分配给自己")

    task.assignment_type = "assigned"
    task.assigned_by = captain_id
    task.assigned_to = assignee_id
    task.team_id = team_id
    task.assignment_status = "pending_accept"
    db.flush()

    logger.info(f"Task {task_id} assigned to {assignee_id} by captain {captain_id}")
    return task


def get_assignment_inbox(db: Session, user_id: str) -> list[Task]:
    """获取用户待处理的任务分配"""
    tasks = (
        db.query(Task)
        .filter(
            Task.assigned_to == user_id,
            Task.assignment_status == "pending_accept",
        )
        .order_by(Task.created_at.desc())
        .all()
    )
    return tasks


def accept_task(db: Session, user_id: str, task_id: str) -> Task:
    """接受分配的任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise ValueError("任务不存在")
    if task.assigned_to != user_id:
        raise ValueError("该任务未分配给你")
    if task.assignment_status != "pending_accept":
        raise ValueError("该任务不处于待接受状态")

    task.assignment_status = "accepted"
    db.flush()
    logger.info(f"User {user_id} accepted task {task_id}")
    return task


def reject_task(db: Session, user_id: str, task_id: str) -> Task:
    """拒绝分配的任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise ValueError("任务不存在")
    if task.assigned_to != user_id:
        raise ValueError("该任务未分配给你")
    if task.assignment_status != "pending_accept":
        raise ValueError("该任务不处于待接受状态")

    task.assignment_status = "rejected"
    db.flush()
    logger.info(f"User {user_id} rejected task {task_id}")
    return task


def get_captain_tasks(db: Session, team_id: str, captain_id: str) -> list[Task]:
    """获取队长在该团队发布的所有任务"""
    tasks = (
        db.query(Task)
        .filter(
            Task.assigned_by == captain_id,
            Task.team_id == team_id,
            Task.assignment_type == "assigned",
        )
        .order_by(Task.created_at.desc())
        .limit(50)
        .all()
    )
    return tasks
