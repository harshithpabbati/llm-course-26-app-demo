from __future__ import annotations

import httpx


def register_remove_command(bot, api_base_url: str) -> None:
    @bot.tree.command(name="remove", description="Remove an item from fridge by name")
    async def remove(interaction, item_name: str):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(f"{api_base_url}/fridge/{item_name}")

            if response.status_code == 404:
                await interaction.response.send_message(f"I could not find {item_name} in your fridge.")
                return

            response.raise_for_status()
            await interaction.response.send_message(f"🗑️ Removed {item_name} from your fridge")
        except Exception:
            await interaction.response.send_message("Failed to remove the item. Please try again.", ephemeral=True)
