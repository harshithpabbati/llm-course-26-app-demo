from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.fridge_store import add_items, load_fridge
from services.gemini_service import extract_receipt

router = APIRouter()

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


@router.post("/receipt")
async def post_receipt(image: UploadFile = File(...)) -> dict:
    filename = (image.filename or "").lower()
    if not any(filename.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use png/jpg/jpeg/webp.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        extracted = await extract_receipt(image_bytes)
        updated = add_items(extracted)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Receipt parsing failed: {exc}") from exc

    return {
        "success": True,
        "items_added": len(extracted),
        "fridge_total": len(updated.get("items", [])),
    }
