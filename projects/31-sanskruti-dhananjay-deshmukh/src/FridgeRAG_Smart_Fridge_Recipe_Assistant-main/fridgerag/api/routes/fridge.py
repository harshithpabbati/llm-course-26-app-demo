from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from services.fridge_store import get_expiring_soon, load_fridge, remove_item

router = APIRouter()


@router.get("/fridge")
async def get_fridge() -> dict:
    fridge = load_fridge()
    fridge["items"] = sorted(fridge.get("items", []), key=lambda i: i.get("days_until_expiry", 9999))
    return fridge


@router.delete("/fridge/{item_name}")
async def delete_fridge_item(item_name: str) -> dict:
    removed = remove_item(item_name)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Item '{item_name}' not found")
    return {"success": True, "removed": item_name}


@router.get("/expiring")
async def get_expiring(days: int = Query(default=2, ge=0, le=30)) -> dict:
    return {"items": get_expiring_soon(days=days), "days": days}
