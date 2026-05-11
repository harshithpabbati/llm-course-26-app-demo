from __future__ import annotations

import httpx
from discord import app_commands


def register_cook_command(bot, api_base_url: str) -> None:
    @bot.tree.command(name="cook", description="Get 3 recipe ideas from your current fridge")
    async def cook(interaction):
        await interaction.response.defer(thinking=True)
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{api_base_url}/cook")
            if response.status_code == 400:
                await interaction.followup.send("🧊 Your fridge is empty! Upload a receipt photo first.")
                return
            response.raise_for_status()
            recipes = response.json().get("recipes", "No recipes returned.")
            await interaction.followup.send(recipes)
        except Exception:
            await interaction.followup.send("I hit an issue while generating recipes. Please try again in a moment.")
