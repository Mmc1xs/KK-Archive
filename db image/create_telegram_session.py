import asyncio
import os
from pathlib import Path

from telethon import TelegramClient


ROOT_DIR = Path(__file__).resolve().parents[1]
DB_IMAGE_DIR = ROOT_DIR / "db image"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("$env:"):
            line = line[len("$env:") :]

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


async def main() -> None:
    load_env_file(ROOT_DIR / ".env")
    load_env_file(DB_IMAGE_DIR / ".env")

    api_id = int(os.environ["TG_API_ID"])
    api_hash = os.environ["TG_API_HASH"]
    session_name = os.environ.get("TG_SESSION", "koikatu_session").strip() or "koikatu_session"
    session_path = DB_IMAGE_DIR / session_name

    print(f"Creating Telegram session: {session_path}.session")
    print("Telethon will prompt for your phone number, login code, and password if needed.")

    client = TelegramClient(str(session_path), api_id, api_hash)
    await client.start()

    is_authorized = await client.is_user_authorized()
    await client.disconnect()

    if not is_authorized:
        raise SystemExit("Session creation did not finish successfully.")

    print(f"Telegram session saved to: {session_path}.session")


if __name__ == "__main__":
    asyncio.run(main())
