"""Goal Tracker —— 目标拆分与动态调整系统  API 入口"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, goals, tasks, rewards, teams
import app.events.reward_listener  # noqa: F401 — 注册积分事件监听器

# 日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title="Goal Tracker API",
    description="目标拆分与动态调整系统",
    version="0.1.0",
)

# CORS —— 开发 + 生产环境
import os
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(goals.router)
app.include_router(tasks.router)
app.include_router(rewards.router)
app.include_router(teams.router)


@app.on_event("startup")
def on_startup():
    """应用启动：初始化数据库表"""
    logger.info("正在初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "version": "0.1.0"}
