"""所有模型的基类 —— 提供 id、created_at、updated_at"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime
from app.database import Base


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class BaseModel(Base):
    __abstract__ = True

    id = Column(String(36), primary_key=True, default=_new_id)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
