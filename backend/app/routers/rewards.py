"""积分与奖励 API"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.rewards import UserPoints, PointTransaction, CustomReward
from app.routers.auth import get_current_user
from app.services.reward_service import (
    get_user_points,
    get_transactions,
    list_rewards,
    create_reward,
    update_reward,
    delete_reward,
    redeem_reward,
)

router = APIRouter(prefix="/api/rewards", tags=["积分与奖励"])


# ── Schemas ──

class BalanceResponse(BaseModel):
    balance: int
    total_earned: int

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: str
    amount: int
    type: str
    source_task_id: str | None = None
    created_at: str

    class Config:
        from_attributes = True


class RewardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    star_cost: int = Field(..., gt=0)
    icon: str = "🎁"


class RewardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    star_cost: int | None = None
    icon: str | None = None


class RewardResponse(BaseModel):
    id: str
    name: str
    description: str
    star_cost: int
    icon: str
    is_active: bool

    class Config:
        from_attributes = True


class RedeemRequest(BaseModel):
    reward_id: str


# ── Endpoints ──

@router.get("/balance", response_model=BalanceResponse)
def get_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    points = get_user_points(db, current_user.id)
    return BalanceResponse(balance=points.balance, total_earned=points.total_earned)


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    txs = get_transactions(db, current_user.id, limit=limit)
    return [
        TransactionResponse(
            id=t.id,
            amount=t.amount,
            type=t.type,
            source_task_id=t.source_task_id,
            created_at=str(t.created_at),
        )
        for t in txs
    ]


@router.get("/shop", response_model=list[RewardResponse])
def get_shop(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rewards = list_rewards(db, current_user.id)
    return [RewardResponse.model_validate(r) for r in rewards]


@router.post("/shop", response_model=RewardResponse, status_code=201)
def add_reward(
    data: RewardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        reward = create_reward(
            db, current_user.id,
            name=data.name,
            star_cost=data.star_cost,
            description=data.description,
            icon=data.icon,
        )
        db.commit()
        return RewardResponse.model_validate(reward)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/shop/{reward_id}", response_model=RewardResponse)
def edit_reward(
    reward_id: str,
    data: RewardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        reward = update_reward(
            db, current_user.id, reward_id,
            **data.model_dump(exclude_none=True),
        )
        db.commit()
        return RewardResponse.model_validate(reward)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/shop/{reward_id}")
def remove_reward(
    reward_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        delete_reward(db, current_user.id, reward_id)
        db.commit()
        return {"detail": "奖励已删除"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/redeem")
def do_redeem(
    data: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = redeem_reward(db, current_user.id, data.reward_id)
        db.commit()
        return {
            "success": True,
            "message": f"成功兑换 {result['reward_name']}！消耗 {result['star_cost']}⭐",
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
