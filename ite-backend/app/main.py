import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.database import verify_db_connection
from app.routes import router
from app.tender_routes import router as tender_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("ite.main")


@asynccontextmanager
async def lifespan(application: FastAPI):
    connected = await verify_db_connection()
    if not connected:
        logger.warning("Application starting WITHOUT a healthy database connection")
    yield


app = FastAPI(title="ITE API", version="0.1.0", lifespan=lifespan)

app.include_router(router)
app.include_router(tender_router)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(
        "Unable to connect to the database while handling %s %s\n%s",
        request.method,
        request.url.path,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is unavailable. Please try again later."},
    )


@app.exception_handler(OSError)
async def os_exception_handler(request: Request, exc: OSError):
    logger.error(
        "Unable to connect to the database (network error) while handling %s %s\n%s",
        request.method,
        request.url.path,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is unavailable. Please try again later."},
    )


@app.get("/health")
async def health():
    db_ok = await verify_db_connection()
    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "unreachable"},
        )
    return {"status": "ok", "database": "connected"}
