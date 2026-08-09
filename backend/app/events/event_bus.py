"""事件总线 —— 预留扩展机制。

当前版本只记录事件（为后续积分/成就系统做准备）。
后续加功能只需注册新的监听器，无需改动现有业务代码。

使用方式：
    from app.events.event_bus import emit, Event

    emit(Event("task_completed", {"task_id": "xxx", "user_id": "xxx"}))
"""

import logging
from typing import Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# 事件类型常量
TASK_COMPLETED = "task_completed"
TASK_DELAYED = "task_delayed"
TASK_SKIPPED = "task_skipped"
GOAL_CREATED = "goal_created"
GOAL_BREAKDOWN_DONE = "goal_breakdown_done"
ADJUSTMENT_DONE = "adjustment_done"
STREAK_MILESTONE = "streak_milestone"  # 预留：连签里程碑
TASK_ASSIGNED = "task_assigned"        # 队长分配任务给成员
TASK_ACCEPTED = "task_accepted"        # 成员接受任务
TASK_REJECTED = "task_rejected"        # 成员拒绝任务
MEMBER_JOINED = "member_joined"        # 新成员加入团队


@dataclass
class Event:
    name: str
    data: dict
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# 监听器注册表：{ event_name: [handler1, handler2, ...] }
_listeners: dict[str, list[Callable]] = {}


def on(event_name: str):
    """装饰器：注册事件监听器

    @on(TASK_COMPLETED)
    def handle_task_completed(event: Event):
        # 未来：奖励积分
        pass
    """
    def decorator(func: Callable):
        if event_name not in _listeners:
            _listeners[event_name] = []
        _listeners[event_name].append(func)
        return func
    return decorator


def emit(event: Event):
    """发送事件 —— 同步调用所有注册的监听器"""
    handlers = _listeners.get(event.name, [])
    if not handlers:
        logger.debug(f"Event '{event.name}' emitted but no listeners registered")
        return

    for handler in handlers:
        try:
            handler(event)
        except Exception:
            logger.exception(f"Error in event handler '{handler.__name__}' for event '{event.name}'")
