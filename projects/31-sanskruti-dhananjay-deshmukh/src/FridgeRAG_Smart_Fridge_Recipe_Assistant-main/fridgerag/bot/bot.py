from __future__ import annotations

import os

import discord
import httpx
from discord.ext import commands

from bot.commands.cook import register_cook_command
from bot.commands.fridge import register_fridge_command
from bot.commands.remove import register_remove_command

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def create_bot(api_base_url: str = "http://localhost:8000") -> commands.Bot:
    intents = discord.Intents.default()
    intents.message_content = True

    bot = commands.Bot(command_prefix="!", intents=intents)

    register_cook_command(bot, api_base_url)
    register_fridge_command(bot, api_base_url)
    register_remove_command(bot, api_base_url)

    @bot.event
    async def on_ready():
        await bot.tree.sync()
        print(f"Logged in as {bot.user}")

    @bot.event
    async def on_message(message: discord.Message):
        if message.author.bot:
            return

        if not message.attachments:
            await bot.process_commands(message)
            return

        attachment = message.attachments[0]
        filename = (attachment.filename or "").lower()
        if not any(filename.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
            await bot.process_commands(message)
            return

        try:
            image_bytes = await attachment.read()
            files = {"image": (attachment.filename, image_bytes, "application/octet-stream")}

            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(f"{api_base_url}/receipt", files=files)
            response.raise_for_status()

            payload = response.json()
            n = payload.get("items_added", 0)
            msg = (
                f"✅ Added {n} items to your fridge! Type /cook to get recipe ideas. "
                "Expiry dates are AI estimates."
            )
            await message.reply(msg)
        except Exception:
            await message.reply("I could not process that receipt image. Please try another photo.")
        finally:
            await bot.process_commands(message)

    return bot


if __name__ == "__main__":
    token = os.getenv("DISCORD_TOKEN", "").strip()
    if not token:
        raise RuntimeError("DISCORD_TOKEN is missing")

    app = create_bot()
    app.run(token)
