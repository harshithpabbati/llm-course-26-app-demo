from __future__ import annotations

from fastapi import APIRouter, HTTPException

from services.fridge_store import load_fridge
from services.groq_service import generate_recipes

router = APIRouter()


@router.post("/cook")
async def post_cook() -> dict:
    fridge = load_fridge()
    items = fridge.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Your fridge is empty. Upload a receipt first.")

    try:
        recipes = await generate_recipes(items)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Recipe generation failed: {exc}") from exc

    return {"recipes": recipes}
