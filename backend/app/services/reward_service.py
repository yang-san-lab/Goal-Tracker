"""积分与奖励服务 —— 星星计算、积分管理、自定义奖励 CRUD、兑换"""

import math
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.rewards import UserPoints, PointTransaction, CustomReward

logger = logging.getLogger(__name__)

# ── 星星计算 ──

PRIORITY_MULTIPLIER = {
    1: 2.0,
    2: 1.5,
    3: 1.0,
    4: 0.75,
    5: 0.5,
}


def calculate_stars(duration_minutes: int, priority: int, on_time: bool) -> int:
    """根据任务时长、优先级和是否准时计算星星数"""
    base = math.ceil(duration_minutes / 15) if duration_minutes > 0 else 1
    multiplier = PRIORITY_MULTIPLIER.get(priority, 1.0)
    stars = math.ceil(base * multiplier)
    if on_time:
        stars += 1
    return max(stars, 1)  # 至少得 1 星


# ── 积分账户 ──

def get_user_points(db: Session, user_id: str) -> UserPoints:
    """获取或创建用户积分账户"""
    points = (
        db.query(UserPoints)
        .filter(UserPoints.user_id == user_id)
        .first()
    )
    if not points:
        points = UserPoints(user_id=user_id, balance=0, total_earned=0)
        db.add(points)
        db.flush()
    return points


def award_stars(
    db: Session,
    user_id: str,
    amount: int,
    tx_type: str = "task_complete",
    source_task_id: Optional[str] = None,
) -> UserPoints:
    """奖励星星：增加余额和累计获得数，写流水"""
    if amount <= 0:
        return get_user_points(db, user_id)

    points = get_user_points(db, user_id)
    points.balance += amount
    points.total_earned += amount

    tx = PointTransaction(
        user_id=user_id,
        amount=amount,
        type=tx_type,
        source_task_id=source_task_id,
    )
    db.add(tx)
    db.flush()
    logger.info(f"用户 {user_id} 获得 {amount}⭐ (类型: {tx_type})")
    return points


def spend_stars(
    db: Session,
    user_id: str,
    amount: int,
    reward_name: str = "",
) -> UserPoints:
    """消费星星：扣除余额，写流水"""
    points = get_user_points(db, user_id)
    if points.balance < amount:
        raise ValueError(f"星星不足！需要 {amount}⭐，当前余额 {points.balance}⭐")

    points.balance -= amount

    tx = PointTransaction(
        user_id=user_id,
        amount=-amount,
        type="redeem",
        source_task_id=reward_name,  # 复用字段存奖励名称
    )
    db.add(tx)
    db.flush()
    logger.info(f"用户 {user_id} 兑换消耗 {amount}⭐（奖励: {reward_name}）")
    return points


def get_transactions(db: Session, user_id: str, limit: int = 50):
    """获取积分流水"""
    return (
        db.query(PointTransaction)
        .filter(PointTransaction.user_id == user_id)
        .order_by(PointTransaction.created_at.desc())
        .limit(limit)
        .all()
    )


# ── 自定义奖励 CRUD ──

def list_rewards(db: Session, user_id: str):
    """获取用户的自定义奖励列表"""
    return (
        db.query(CustomReward)
        .filter(CustomReward.user_id == user_id, CustomReward.is_active == True)
        .order_by(CustomReward.star_cost)
        .all()
    )


def create_reward(
    db: Session,
    user_id: str,
    name: str,
    star_cost: int,
    description: str = "",
    icon: str = "🎁",
) -> CustomReward:
    """创建自定义奖励"""
    if star_cost <= 0:
        raise ValueError("兑换所需星星数必须大于 0")
    reward = CustomReward(
        user_id=user_id,
        name=name,
        description=description,
        star_cost=star_cost,
        icon=icon,
    )
    db.add(reward)
    db.flush()
    logger.info(f"用户 {user_id} 创建奖励: {name} ({star_cost}⭐)")
    return reward


def update_reward(
    db: Session,
    user_id: str,
    reward_id: str,
    **kwargs,
) -> CustomReward:
    """更新自定义奖励"""
    reward = (
        db.query(CustomReward)
        .filter(CustomReward.id == reward_id, CustomReward.user_id == user_id)
        .first()
    )
    if not reward:
        raise ValueError("奖励不存在")

    allowed = ["name", "description", "star_cost", "icon", "is_active"]
    for key, value in kwargs.items():
        if key in allowed and value is not None:
            setattr(reward, key, value)

    db.flush()
    return reward


def delete_reward(db: Session, user_id: str, reward_id: str):
    """删除（软删除）自定义奖励"""
    reward = (
        db.query(CustomReward)
        .filter(CustomReward.id == reward_id, CustomReward.user_id == user_id)
        .first()
    )
    if not reward:
        raise ValueError("奖励不存在")
    reward.is_active = False
    db.flush()


def redeem_reward(db: Session, user_id: str, reward_id: str) -> dict:
    """兑换奖励：扣星星，返回成功信息"""
    reward = (
        db.query(CustomReward)
        .filter(CustomReward.id == reward_id, CustomReward.user_id == user_id, CustomReward.is_active == True)
        .first()
    )
    if not reward:
        raise ValueError("奖励不存在或已下架")

    # 扣款
    spend_stars(db, user_id, reward.star_cost, reward_name=reward.name)
    logger.info(f"用户 {user_id} 成功兑换 {reward.name}")
    return {"reward_name": reward.name, "star_cost": reward.star_cost, "icon": reward.icon}
