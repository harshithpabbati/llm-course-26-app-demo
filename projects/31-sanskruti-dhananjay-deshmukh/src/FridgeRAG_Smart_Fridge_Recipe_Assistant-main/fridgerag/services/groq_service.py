from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from groq import Groq

_MODEL_CANDIDATES = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
]

_SYSTEM_PROMPT = (
    "You are a helpful home chef assistant. You suggest practical recipes using "
    "ingredients the user already has. Always prioritize ingredients that expire "
    "soonest. Be conversational and encouraging."
)


def _client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing")
    return Groq(api_key=api_key)


def _chat_with_fallback(messages: list[dict[str, str]], max_tokens: int, temperature: float) -> str:
    client = _client()
    last_error: Exception | None = None
    for model in _MODEL_CANDIDATES:
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                messages=messages,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            last_error = exc
            continue

    raise RuntimeError(f"No compatible Groq model available: {last_error}")


def _generate_recipes_sync(fridge_items: list[dict[str, Any]]) -> str:
    sorted_items = sorted(fridge_items, key=lambda i: i.get("days_until_expiry", 9999))
    inventory_json = json.dumps(sorted_items, ensure_ascii=True, indent=2)

    user_prompt = (
        "Here is my current fridge inventory sorted by expiry:\n"
        f"{inventory_json}\n\n"
        "Suggest exactly 3 recipes I can make. For each recipe:\n"
        "1. Recipe name and emoji\n"
        "2. Which fridge items it uses (highlight expiring ones with ⚠️)\n"
        "3. Any 1-2 common pantry items needed (salt, oil, etc.)\n"
        "4. Estimated cook time\n"
        "5. One substitution tip if I'm missing an ingredient\n"
        "Format nicely for Discord with line breaks."
    )

    content = _chat_with_fallback(
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=1500,
        temperature=0.7,
    )
    return content or "I could not generate recipes right now."


def _generate_expiry_alert_sync(expiring_items: list[dict[str, Any]]) -> str:
    items_text = "\n".join(
        f"- {item.get('name', 'Unknown')} (expires in {item.get('days_until_expiry', '?')} days)"
        for item in expiring_items
    )

    prompt = (
        "The following items in my fridge expire within 2 days:\n"
        f"{items_text}\n"
        "Write a short friendly Discord alert (max 150 words) reminding me to use "
        "these items and suggest one quick meal idea."
    )

    content = _chat_with_fallback(
        messages=[
            {"role": "system", "content": "You are a warm and concise kitchen assistant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=250,
        temperature=0.7,
    )
    return content or "Heads up: some fridge items are close to expiry."


async def generate_recipes(fridge_items: list[dict[str, Any]]) -> str:
    return await asyncio.to_thread(_generate_recipes_sync, fridge_items)


async def generate_expiry_alert(expiring_items: list[dict[str, Any]]) -> str:
    return await asyncio.to_thread(_generate_expiry_alert_sync, expiring_items)
