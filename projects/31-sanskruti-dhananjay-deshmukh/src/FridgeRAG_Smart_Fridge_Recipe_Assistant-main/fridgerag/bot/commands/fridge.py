from __future__ import annotations

import discord
import httpx


def _line_for_item(item: dict) -> str:
    days = int(item.get("days_until_expiry", 9999))
    if days <= 2:
        icon = "🔴"
    elif days <= 5:
        icon = "🟡"
    else:
        icon = "🟢"

    name = item.get("name", "Unknown")
    quantity = item.get("quantity", "1 unit")
    return f"{icon} {name} | {quantity} | expires in {days} days"


def _embed_color(items: list[dict]) -> discord.Color:
    if any(int(item.get("days_until_expiry", 9999)) <= 2 for item in items):
        return discord.Color.red()
    if any(int(item.get("days_until_expiry", 9999)) <= 5 for item in items):
        return discord.Color.gold()
    return discord.Color.green()


def register_fridge_command(bot, api_base_url: str) -> None:
    @bot.tree.command(name="fridge", description="Show current fridge inventory")
    async def fridge(interaction):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{api_base_url}/fridge")
            response.raise_for_status()
            data = response.json()
            items = data.get("items", [])

            if not items:
                await interaction.response.send_message("🧊 Your fridge is empty right now.")
                return

            lines = [_line_for_item(item) for item in items]
            description = "\n".join(lines)

            embed = discord.Embed(
                title="Current Fridge Inventory",
                description=description,
                color=_embed_color(items),
            )
            embed.set_footer(text="Expiry dates are AI estimates from receipt parsing.")
            await interaction.response.send_message(embed=embed)
        except Exception:
            await interaction.response.send_message(
                "I could not fetch your fridge right now. Please try again.", ephemeral=True
            )
