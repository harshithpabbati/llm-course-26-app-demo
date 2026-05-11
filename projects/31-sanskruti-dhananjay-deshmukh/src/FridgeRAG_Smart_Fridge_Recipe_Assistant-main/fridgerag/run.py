from __future__ import annotations

import asyncio
import os
import threading
import time

import uvicorn
from dotenv import load_dotenv

from api.main import app as fastapi_app
from bot.bot import create_bot
from scheduler.expiry_alert import ExpiryAlertScheduler


def _run_api_server() -> None:
    uvicorn.run(fastapi_app, host="0.0.0.0", port=8000, log_level="info")


async def _run_bot_and_scheduler() -> None:
    token = os.getenv("DISCORD_TOKEN", "").strip()
    if not token:
        raise RuntimeError("DISCORD_TOKEN is missing")

    bot = create_bot(api_base_url="http://localhost:8000")
    expiry_scheduler = ExpiryAlertScheduler(bot)
    expiry_scheduler.start()

    try:
        await bot.start(token)
    finally:
        expiry_scheduler.shutdown()


def main() -> None:
    load_dotenv()

    api_thread = threading.Thread(target=_run_api_server, daemon=True)
    api_thread.start()

    time.sleep(1)
    asyncio.run(_run_bot_and_scheduler())


if __name__ == "__main__":
    main()
