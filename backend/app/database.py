"""数据库连接和会话管理"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# SQLite: check_same_thread=False 允许跨线程访问
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：每次请求获取一个数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """创建所有表 —— 应用启动时调用"""
    Base.metadata.create_all(bind=engine)
    _ensure_task_schedule_columns()


def _ensure_task_schedule_columns():
    """为旧版 SQLite 数据库补齐任务时间/提醒字段（幂等）。"""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(tasks)"))}
        statements = []
        if "scheduled_time" not in columns:
            statements.append("ALTER TABLE tasks ADD COLUMN scheduled_time VARCHAR(5)")
        if "reminder_minutes" not in columns:
            statements.append("ALTER TABLE tasks ADD COLUMN reminder_minutes INTEGER")
        for statement in statements:
            conn.execute(text(statement))
        conn.commit()
