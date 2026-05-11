from __future__ import annotations

from fastapi import FastAPI

from api.routes.cook import router as cook_router
from api.routes.fridge import router as fridge_router
from api.routes.receipt import router as receipt_router

app = FastAPI(title="FridgeRAG API", version="1.0.0")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


app.include_router(receipt_router)
app.include_router(cook_router)
app.include_router(fridge_router)
