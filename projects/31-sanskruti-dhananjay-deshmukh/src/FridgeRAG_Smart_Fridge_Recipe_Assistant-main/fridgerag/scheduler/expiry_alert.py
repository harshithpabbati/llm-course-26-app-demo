from __future__ import annotations

import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from services.fridge_store import get_expiring_soon
from services.groq_service import generate_expiry_alert


class ExpiryAlertScheduler:
    def __init__(self, bot):
        self.bot = bot
        self.scheduler = AsyncIOScheduler(timezone="America/New_York")
        self.scheduler.add_job(self.send_expiry_alert, "cron", hour=8, minute=0)

    def start(self) -> None:
        if not self.scheduler.running:
            self.scheduler.start()

    def shutdown(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    async def send_expiry_alert(self) -> None:
        channel_id_raw = os.getenv("DISCORD_ALERT_CHANNEL_ID", "").strip()
        if not channel_id_raw.isdigit():
            return

        expiring_items = get_expiring_soon(days=2)
        if not expiring_items:
            return

        message = await generate_expiry_alert(expiring_items)
        channel = self.bot.get_channel(int(channel_id_raw))
        if channel is not None:
            await channel.send(message)
