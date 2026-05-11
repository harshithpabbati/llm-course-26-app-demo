from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import RLock
from typing import Any

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "fridge.json"
_FILE_LOCK = RLock()


def _today() -> date:
    return date.today()


def _parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _compute_days_until_expiry(expiry_date: str) -> int:
    parsed = _parse_date(expiry_date)
    if parsed is None:
        return 0
    return (parsed - _today()).days


def _ensure_shape(data: dict[str, Any]) -> dict[str, Any]:
    if "items" not in data or not isinstance(data["items"], list):
        data["items"] = []
    if "last_updated" not in data:
        data["last_updated"] = None
    return data


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "name": str(item.get("name", "")).strip(),
        "quantity": str(item.get("quantity", "1 unit")).strip(),
        "expiry_date": str(item.get("expiry_date", "")).strip(),
        "category": str(item.get("category", "other")).strip().lower() or "other",
        "added_on": str(item.get("added_on", _today().isoformat())).strip(),
    }
    normalized["days_until_expiry"] = _compute_days_until_expiry(normalized["expiry_date"])
    return normalized


def load_fridge() -> dict[str, Any]:
    with _FILE_LOCK:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        if not DATA_FILE.exists():
            empty = {"items": [], "last_updated": None}
            save_fridge(empty)
            return empty

        with DATA_FILE.open("r", encoding="utf-8-sig") as f:
            raw = json.load(f)

        data = _ensure_shape(raw)
        refreshed_items = []
        for item in data["items"]:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_item(item)
            if normalized["name"]:
                refreshed_items.append(normalized)

        data["items"] = sorted(refreshed_items, key=lambda i: i.get("days_until_expiry", 9999))
        data["last_updated"] = datetime.now().isoformat(timespec="seconds")
        save_fridge(data)
        return data


def save_fridge(data: dict[str, Any]) -> None:
    with _FILE_LOCK:
        payload = _ensure_shape(data)
        payload["last_updated"] = datetime.now().isoformat(timespec="seconds")
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

        with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=DATA_FILE.parent) as tmp:
            json.dump(payload, tmp, ensure_ascii=True, indent=2)
            temp_name = tmp.name

        os.replace(temp_name, DATA_FILE)


def add_items(items_list: list[dict[str, Any]]) -> dict[str, Any]:
    fridge = load_fridge()
    existing = {item["name"].lower(): item for item in fridge["items"] if item.get("name")}

    for raw in items_list:
        if not isinstance(raw, dict):
            continue
        item = _normalize_item(raw)
        if not item["name"]:
            continue
        existing[item["name"].lower()] = item

    fridge["items"] = sorted(existing.values(), key=lambda i: i.get("days_until_expiry", 9999))
    save_fridge(fridge)
    return fridge


def get_expiring_soon(days: int = 2) -> list[dict[str, Any]]:
    fridge = load_fridge()
    return [
        item
        for item in fridge["items"]
        if isinstance(item.get("days_until_expiry"), int) and item["days_until_expiry"] <= days
    ]


def remove_item(name: str) -> bool:
    if not name or not name.strip():
        return False

    fridge = load_fridge()
    target = name.strip().lower()
    before = len(fridge["items"])
    fridge["items"] = [item for item in fridge["items"] if item.get("name", "").lower() != target]
    after = len(fridge["items"])

    if after == before:
        return False

    save_fridge(fridge)
    return True
