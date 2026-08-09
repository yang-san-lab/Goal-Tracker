"""AI 服务 —— 封装 DeepSeek API 调用，提供目标拆解和动态调整能力

DeepSeek API 兼容 OpenAI SDK，文档: https://platform.deepseek.com/api-docs
"""

import json
import logging
from typing import Any

from openai import OpenAI

from app.config import settings
from app.prompts.breakdown import SYSTEM_PROMPT as BREAKDOWN_SYSTEM, build_breakdown_prompt
from app.prompts.adjustment import SYSTEM_PROMPT as ADJUSTMENT_SYSTEM, build_adjustment_prompt
from app.prompts.chat import SYSTEM_PROMPT as CHAT_SYSTEM, build_chat_prompt

logger = logging.getLogger(__name__)


def _get_client() -> OpenAI:
    """获取 DeepSeek 客户端（OpenAI 兼容）"""
    return OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )


def _call_ai(system_prompt: str, user_message: str) -> dict:
    """调用 DeepSeek API，返回解析后的 JSON

    Raises:
        ValueError: API Key 未配置
        RuntimeError: API 调用失败
        json.JSONDecodeError: AI 返回的不是合法 JSON
    """
    if not settings.DEEPSEEK_API_KEY:
        raise ValueError("DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置")

    client = _get_client()

    try:
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            max_tokens=8192,
            temperature=0.3,  # 低温度保证输出稳定
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
    except Exception as e:
        logger.error(f"DeepSeek API 调用失败: {e}")
        raise RuntimeError(f"AI 服务调用失败: {e}") from e

    # 提取文本内容
    text = response.choices[0].message.content or ""

    # 去掉可能的 markdown 代码块包裹
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # 去掉 ```json 和结尾的 ```
        if lines[-1].strip() == "```":
            text = "\n".join(lines[1:-1])
        else:
            text = "\n".join(lines[1:])

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"AI 返回的不是合法 JSON:\n{text[:500]}")
        raise RuntimeError("AI 返回格式异常，请重试")


def breakdown_goal(
    title: str,
    description: str,
    start_date: str,
    end_date: str,
    daily_hours: float,
    rest_days_per_week: int = 0,
) -> dict:
    """将大目标拆解为月/周/日任务"""
    user_message = build_breakdown_prompt(
        title=title,
        description=description,
        start_date=start_date,
        end_date=end_date,
        daily_hours=daily_hours,
        rest_days_per_week=rest_days_per_week,
    )
    logger.info(f"开始拆解目标: {title} ({start_date} ~ {end_date})")
    result = _call_ai(BREAKDOWN_SYSTEM, user_message)
    logger.info(f"目标拆解完成，包含 {len(result.get('milestones', []))} 个月度里程碑")
    return result


def adjust_plan(
    goal_title: str,
    goal_description: str,
    daily_hours: float,
    start_date: str,
    end_date: str,
    completed_summary: str,
    delayed_summary: str,
    upcoming_tasks: str,
    user_feedback: str,
) -> dict:
    """根据执行情况动态调整后续计划"""
    user_message = build_adjustment_prompt(
        goal_title=goal_title,
        goal_description=goal_description,
        daily_hours=daily_hours,
        start_date=start_date,
        end_date=end_date,
        completed_summary=completed_summary,
        delayed_summary=delayed_summary,
        upcoming_tasks=upcoming_tasks,
        user_feedback=user_feedback,
    )
    logger.info(f"开始动态调整目标: {goal_title}")
    result = _call_ai(ADJUSTMENT_SYSTEM, user_message)
    logger.info(f"动态调整完成，包含 {len(result.get('adjustments_made', []))} 项调整")
    return result


def chat_with_goal(
    goal_title: str,
    goal_description: str,
    daily_hours: str,
    start_date: str,
    end_date: str,
    completed_summary: str,
    delayed_summary: str,
    pending_summary: str,
    chat_history_json: str,
    user_message: str,
) -> dict:
    """与 AI 教练对话，返回回复文本和可选调整建议"""
    user_message_text = build_chat_prompt(
        goal_title=goal_title,
        goal_description=goal_description,
        daily_hours=daily_hours,
        start_date=start_date,
        end_date=end_date,
        completed_summary=completed_summary,
        delayed_summary=delayed_summary,
        pending_summary=pending_summary,
        chat_history_json=chat_history_json,
        user_message=user_message,
    )
    logger.info(f"开始 AI 教练对话: {goal_title} | 用户消息: {user_message[:50]}...")
    result = _call_ai(CHAT_SYSTEM, user_message_text)
    logger.info(
        f"AI 教练回复完成，"
        f"包含 {len(result.get('suggested_adjustments', []))} 项调整建议"
    )
    return result
