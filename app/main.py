import uuid
import json
import redis
import logging
import os
import aiohttp
from fastapi import FastAPI, Request, Response, Depends, HTTPException, Cookie
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, HTMLResponse
from pathlib import Path
from typing import Optional, Dict, List

from .models import Product, SessionData, PRODUCTS, BonusRequest, Order
from .config import settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="WaveShop", docs_url=None, redoc_url=None, openapi_url=None)

templates = Jinja2Templates(directory="templates")

redis_client = redis.Redis(host=settings.redis_host, port=settings.redis_port, decode_responses=True)

def get_or_create_session(session_id: Optional[str] = Cookie(None)) -> tuple[SessionData, bool]:
    if not session_id or not redis_client.exists(f"session:{session_id}"):
        session_id = str(uuid.uuid4())
        session_data = SessionData(session_id=session_id, balance=0, bonus_received=False)
        redis_client.setex(
            f"session:{session_id}",
            settings.session_ttl,
            json.dumps(session_data.model_dump())
        )
        logger.info(f"Created new session: {session_id}")
        return session_data, True

    session_json = redis_client.get(f"session:{session_id}")
    session_dict = json.loads(session_json)
    redis_client.expire(f"session:{session_id}", settings.session_ttl)
    logger.info(f"Retrieved existing session: {session_id}")
    return SessionData(**session_dict), False

def get_existing_session(session_id: Optional[str] = Cookie(None)) -> SessionData:
    if not session_id or not redis_client.exists(f"session:{session_id}"):
        logger.warning("Attempt to access protected endpoint without valid session")
        raise HTTPException(status_code=401, detail="No active session")

    session_json = redis_client.get(f"session:{session_id}")
    session_dict = json.loads(session_json)
    redis_client.expire(f"session:{session_id}", settings.session_ttl)
    logger.info(f"Retrieved existing session: {session_id}")
    return SessionData(**session_dict)

def update_session(session_data: SessionData):
    redis_client.setex(
        f"session:{session_data.session_id}",
        settings.session_ttl,
        json.dumps(session_data.model_dump())
    )
    logger.info(f"Updated session: {session_data.session_id}")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, session_data: tuple = Depends(get_or_create_session)):
    session, is_new = session_data
    response = templates.TemplateResponse(
        "index.html", 
        {"request": request, "products": PRODUCTS, "session": session}
    )
    if is_new:
        response.set_cookie(
            key="session_id",
            value=session.session_id,
            httponly=False,      # 1. Разрешает чтение JS
            samesite="Lax",      # 2. Защита от CSRF
            secure=False,        # Для HTTP
            max_age=settings.session_ttl
        )
    return response

@app.post("/api/apply-bonus")
async def apply_bonus(bonus_data: BonusRequest, session: SessionData = Depends(get_existing_session)):
    if session.bonus_received:
        logger.warning(f"Bonus already applied for session {session.session_id}")
        raise HTTPException(status_code=400, detail="Bonus already applied")
    
    # 3. Исправленная проверка бонуса
    try:
        # Pydantic модель ожидает str, JS отправляет число/строку.
        # На всякий случай чистим ввод и преобразуем.
        amount_str = str(bonus_data.bonus_amount).strip()
        bonus_value = float(amount_str)
        
        if not (1 <= bonus_value <= 999):
            raise HTTPException(status_code=400, detail="Bonus amount must be between 1 and 999")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bonus amount")
    
    session.balance += bonus_value
    session.bonus_received = True
    update_session(session)
    
    logger.info(f"Bonus applied: {bonus_value} for session {session.session_id}")
    return {"success": True, "balance": session.balance}

@app.get("/api/session")
async def get_session_info(session_data: tuple = Depends(get_or_create_session)):
    session, is_new = session_data
    response = JSONResponse(content=session.model_dump())
    if is_new:
        response.set_cookie(
            key="session_id",
            value=session.session_id,
            httponly=False,      # 1. Разрешает чтение JS
            samesite="Lax",      # 2. Защита от CSRF
            secure=False,        # Для HTTP
            max_age=settings.session_ttl
        )
    return response

@app.post("/api/checkout")
async def checkout(order: Order, request: Request, session: SessionData = Depends(get_existing_session)):
    total_amount = 0
    flag_product_id = 12
    flag_purchased = False

    for item in order.items:
        product = next((p for p in PRODUCTS if p.id == item.product_id), None)
        if not product:
            raise HTTPException(status_code=400, detail=f"Product with id {item.product_id} not found")
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity of product must be positive")
        total_amount += product.price * item.quantity

        if item.product_id == flag_product_id:
            flag_purchased = True

    if session.balance < total_amount:
        logger.warning(f"Insufficient balance: {session.balance} < {total_amount}")
        raise HTTPException(status_code=400, detail="Insufficient balance")

    session.balance -= total_amount
    update_session(session)

    response_data = {"success": True, "balance": session.balance, "total": total_amount}

    if flag_purchased:
        FLAG = os.getenv("FLAG", "alfa{***REDACTED***}")
        response_data["flag"] = FLAG

    return response_data

@app.post("/api/logout")
async def logout(response: Response, session_id: Optional[str] = Cookie(None)):
    if session_id and redis_client.exists(f"session:{session_id}"):
        redis_client.delete(f"session:{session_id}")
        logger.info(f"Session {session_id} deleted")
    response.delete_cookie(key="session_id")
    return JSONResponse(content={"success": True})

@app.get("/api/products")
async def get_products():
    return [product.model_dump() for product in PRODUCTS]