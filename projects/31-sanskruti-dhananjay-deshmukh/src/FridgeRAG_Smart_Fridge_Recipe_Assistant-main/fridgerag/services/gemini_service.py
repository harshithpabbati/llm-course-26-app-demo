from __future__ import annotations

import asyncio
import json
import os
from datetime import date, timedelta
from typing import Any

import google.generativeai as genai

_ALLOWED_CATEGORIES = {"dairy", "meat", "vegetable", "fruit", "grain"}

_PROMPT = (
    "You are a grocery receipt parser. Extract ALL food items from this receipt.\n"
    "Return ONLY a JSON array. No explanation. No markdown. Raw JSON only.\n"
    "Each item must have these exact fields:\n"
    "  name: string (clean grocery item name)\n"
    "  quantity: string (e.g. \"2 units\", \"500g\")\n"
    "  category: string (dairy/meat/vegetable/fruit/grain)\n"
    "  estimated_expiry_days: integer (realistic shelf life in days from today)\n"
    "Example: [{\"name\": \"Eggs\", \"quantity\": \"12 units\", \"category\": \"dairy\", \"estimated_expiry_days\": 21}]"
)

_MODEL_CANDIDATES = [
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
]


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    except json.JSONDecodeError:
        pass

    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start != -1 and end != -1 and start < end:
        fragment = cleaned[start : end + 1]
        parsed = json.loads(fragment)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]

    raise ValueError("Gemini did not return a valid JSON array")


def _post_process(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    today = date.today()
    normalized: list[dict[str, Any]] = []

    for item in items:
        name = str(item.get("name", "")).strip()
        if not name:
            continue

        quantity = str(item.get("quantity", "1 unit")).strip() or "1 unit"
        category = str(item.get("category", "other")).strip().lower() or "other"
        if category not in _ALLOWED_CATEGORIES:
            category = "other"

        try:
            expiry_days = int(item.get("estimated_expiry_days", 7))
        except (TypeError, ValueError):
            expiry_days = 7

        expiry_days = max(0, min(expiry_days, 365))
        expiry_date = today + timedelta(days=expiry_days)

        normalized.append(
            {
                "name": name,
                "quantity": quantity,
                "category": category,
                "expiry_date": expiry_date.isoformat(),
                "added_on": today.isoformat(),
                "days_until_expiry": expiry_days,
            }
        )

    return normalized


def _extract_sync(image_bytes: bytes) -> list[dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing")

    genai.configure(api_key=api_key)
    response = None
    last_error: Exception | None = None
    for model_name in _MODEL_CANDIDATES:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                [
                    _PROMPT,
                    {
                        "mime_type": "image/jpeg",
                        "data": image_bytes,
                    },
                ]
            )
            break
        except Exception as exc:
            last_error = exc
            continue

    if response is None:
        raise RuntimeError(f"No compatible Gemini model available: {last_error}")

    text = (response.text or "").strip()
    parsed = _extract_json_array(text)
    return _post_process(parsed)


async def extract_receipt(image_bytes: bytes) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_extract_sync, image_bytes)
