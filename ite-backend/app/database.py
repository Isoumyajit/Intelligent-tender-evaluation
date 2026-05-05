import logging
import traceback

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession

from app.config import settings

logger = logging.getLogger("ite.database")

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def verify_db_connection() -> bool:
    """Attempt a lightweight connection to confirm the database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        logger.info("Database connection verified successfully")
        return True
    except Exception:
        logger.error(
            "Unable to connect to the database at %s\n%s",
            settings.database_url,
            traceback.format_exc(),
        )
        return False


async def get_db() -> AsyncSession:
    try:
        async with async_session() as session:
            yield session
    except SQLAlchemyError:
        logger.error(
            "Unable to connect to the database — a database error occurred\n%s",
            traceback.format_exc(),
        )
        raise
    except OSError:
        logger.error(
            "Unable to connect to the database — the host may be unreachable\n%s",
            traceback.format_exc(),
        )
        raise
