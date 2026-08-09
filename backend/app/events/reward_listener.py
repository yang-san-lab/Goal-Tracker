"""积分事件监听器 —— 订阅任务完成事件，自动发放星星奖励"""

import logging

from app.database import SessionLocal
from app.events.event_bus import on, TASK_COMPLETED, Event
from app.services.reward_service import calculate_stars, award_stars

logger = logging.getLogger(__name__)


@on(TASK_COMPLETED)
def handle_task_completed(event: Event):
    """任务完成时自动计算并发放星星"""
    data = event.data
    user_id = data.get("user_id", "")
    task_id = data.get("task_id", "")
    duration_minutes = data.get("duration_minutes", 30)
    priority = data.get("priority", 3)
    on_time = data.get("on_time", False)

    stars = calculate_stars(
        duration_minutes=duration_minutes,
        priority=priority,
        on_time=on_time,
    )

    db = SessionLocal()
    try:
        award_stars(
            db=db,
            user_id=user_id,
            amount=stars,
            tx_type="task_complete",
            source_task_id=task_id,
        )
        db.commit()
        logger.info(f"[奖励] 任务 {task_id}: +{stars}⭐ (时长={duration_minutes}分, 优先级={priority}, 准时={on_time})")
    except Exception as e:
        db.rollback()
        logger.error(f"[奖励] 发放失败: {e}")
    finally:
        db.close()
