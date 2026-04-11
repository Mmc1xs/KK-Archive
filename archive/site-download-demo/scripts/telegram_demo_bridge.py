import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from telethon import TelegramClient
from telethon.tl.types import MessageEntityTextUrl

try:
    import cryptg  # noqa: F401

    CRYPTG_AVAILABLE = True
except Exception:
    CRYPTG_AVAILABLE = False


ROOT_DIR = Path(__file__).resolve().parents[1]
DB_IMAGE_DIR = ROOT_DIR / "db image"
TELEGRAM_LINK_HOSTS = {"t.me", "telegram.me"}
MIN_DOWNLOAD_CHUNK_SIZE = 4096
MAX_DOWNLOAD_CHUNK_SIZE = 512 * 1024
DEFAULT_DOWNLOAD_REQUEST_SIZE = MAX_DOWNLOAD_CHUNK_SIZE
DEFAULT_DOWNLOAD_CHUNK_SIZE = MAX_DOWNLOAD_CHUNK_SIZE
TARGET_LINK_PREFIX = "卡片下载"


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


def load_env() -> None:
    load_env_file(ROOT_DIR / ".env")
    load_env_file(DB_IMAGE_DIR / ".env")


def get_env_int(name: str, default: int) -> int:
    raw_value = os.environ.get(name, "").strip()
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    return value if value > 0 else default


def get_client() -> TelegramClient:
    load_env()
    api_id = int(os.environ["TG_API_ID"])
    api_hash = os.environ["TG_API_HASH"]
    session_override = os.environ.get("TG_SESSION_OVERRIDE_PATH", "").strip()
    if session_override:
        session_path = Path(session_override)
    else:
        session_name = os.environ.get("TG_SESSION", "koikatu_session").strip() or "koikatu_session"
        session_path = DB_IMAGE_DIR / session_name
    return TelegramClient(str(session_path), api_id, api_hash)


def get_download_settings() -> tuple[int, int]:
    request_size = get_env_int("TG_DOWNLOAD_REQUEST_SIZE", DEFAULT_DOWNLOAD_REQUEST_SIZE)
    chunk_size = get_env_int("TG_DOWNLOAD_CHUNK_SIZE", request_size or DEFAULT_DOWNLOAD_CHUNK_SIZE)

    request_size = max(MIN_DOWNLOAD_CHUNK_SIZE, min(MAX_DOWNLOAD_CHUNK_SIZE, request_size))
    chunk_size = max(MIN_DOWNLOAD_CHUNK_SIZE, min(MAX_DOWNLOAD_CHUNK_SIZE, chunk_size))

    request_size = max(MIN_DOWNLOAD_CHUNK_SIZE, request_size - (request_size % MIN_DOWNLOAD_CHUNK_SIZE))
    chunk_size = max(MIN_DOWNLOAD_CHUNK_SIZE, chunk_size - (chunk_size % MIN_DOWNLOAD_CHUNK_SIZE))

    return request_size, chunk_size


def entity_text(message, entity) -> str:
    text = message.raw_text or ""
    return text[entity.offset : entity.offset + entity.length]


def parse_message_link(url: str) -> tuple[str | int, int]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc not in TELEGRAM_LINK_HOSTS:
        raise ValueError("Only https://t.me or https://telegram.me links are supported")

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        raise ValueError("Telegram message link is missing its message id")

    if parts[0] == "c":
        if len(parts) < 3:
            raise ValueError("Private Telegram links must include a chat id and message id")
        return int(f"-100{parts[1]}"), int(parts[2])

    return parts[0], int(parts[1])


async def get_message_by_link(client: TelegramClient, url: str):
    chat_ref, message_id = parse_message_link(url)
    entity = await client.get_entity(chat_ref)
    message = await client.get_messages(entity, ids=message_id)
    if not message:
        raise ValueError(f"Telegram message not found for {url}")
    return entity, message


async def get_group_messages(client: TelegramClient, entity, grouped_id: int, anchor_message_id: int):
    collected = []
    min_id = max(1, anchor_message_id - 30)
    max_id = anchor_message_id + 30

    async for message in client.iter_messages(entity, min_id=min_id, max_id=max_id + 1, reverse=True):
        if getattr(message, "grouped_id", None) == grouped_id:
            collected.append(message)

    collected.sort(key=lambda item: item.id)
    return collected


def get_file_name(message) -> str:
    if getattr(message, "file", None) and getattr(message.file, "name", None):
        return message.file.name

    ext = getattr(getattr(message, "file", None), "ext", None) or ".bin"
    if ext == ".jpe":
        ext = ".jpg"
    return f"telegram_{message.id}{ext}"


def get_mime_type(message) -> str:
    if getattr(message, "file", None) and getattr(message.file, "mime_type", None):
        return message.file.mime_type

    if getattr(message, "photo", None):
        return "image/jpeg"

    return "application/octet-stream"


def get_file_size(message) -> int:
    if getattr(message, "file", None) and getattr(message.file, "size", None):
        return int(message.file.size)
    return 0


def is_media_message(message) -> bool:
    return bool(getattr(message, "media", None) and getattr(message, "file", None))


def serialize_candidate(message, target_url: str, link_label: str) -> dict:
    return {
        "targetUrl": target_url,
        "linkLabel": link_label,
        "messageId": message.id,
        "groupedId": getattr(message, "grouped_id", None),
        "fileName": get_file_name(message),
        "mimeType": get_mime_type(message),
        "byteSize": get_file_size(message),
        "caption": message.raw_text or "",
        "kind": "photo" if getattr(message, "photo", None) else "document"
    }


async def inspect_source_message(url: str) -> dict:
    client = get_client()
    await client.connect()

    try:
        if not await client.is_user_authorized():
            raise RuntimeError("Telegram session is not authorized")

        source_entity, source_message = await get_message_by_link(client, url)
        resolved_links = []
        seen_urls = set()

        for entity in source_message.entities or []:
            if not isinstance(entity, MessageEntityTextUrl):
                continue

            visible_text = entity_text(source_message, entity).strip()
            if not visible_text.startswith(TARGET_LINK_PREFIX):
                continue

            target_url = entity.url.strip()
            if not target_url or target_url in seen_urls:
                continue

            seen_urls.add(target_url)
            target_entity, target_message = await get_message_by_link(client, target_url)
            grouped_id = getattr(target_message, "grouped_id", None)
            candidate_messages = (
                await get_group_messages(client, target_entity, grouped_id, target_message.id)
                if grouped_id
                else [target_message]
            )
            candidates = [serialize_candidate(message, target_url, visible_text) for message in candidate_messages if is_media_message(message)]

            resolved_links.append(
                {
                    "label": visible_text,
                    "targetUrl": target_url,
                    "targetMessageId": target_message.id,
                    "groupedId": grouped_id,
                    "candidateCount": len(candidates),
                    "candidates": candidates
                }
            )

        return {
            "sourceUrl": url,
            "sourceMessageId": source_message.id,
            "sourceGroupedId": getattr(source_message, "grouped_id", None),
            "sourceChatId": getattr(getattr(source_message, "peer_id", None), "channel_id", None),
            "resolvedLinks": resolved_links
        }
    finally:
        await client.disconnect()


async def stream_message_media(url: str, message_id: int) -> None:
    client = get_client()
    await client.connect()

    try:
        if not await client.is_user_authorized():
            raise RuntimeError("Telegram session is not authorized")

        entity, _ = await get_message_by_link(client, url)
        target_message = await client.get_messages(entity, ids=message_id)
        if not target_message:
            raise ValueError(f"Telegram media message {message_id} was not found")
        if not is_media_message(target_message):
            raise ValueError(f"Telegram message {message_id} does not contain downloadable media")

        request_size, chunk_size = get_download_settings()

        async for chunk in client.iter_download(
            target_message.media,
            request_size=request_size,
            chunk_size=chunk_size
        ):
            sys.stdout.buffer.write(chunk)

        sys.stdout.buffer.flush()
    finally:
        await client.disconnect()


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Telegram demo bridge for KK Diction")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subparsers.add_parser("inspect-source")
    inspect_parser.add_argument("--url", required=True)

    stream_parser = subparsers.add_parser("stream-media")
    stream_parser.add_argument("--url", required=True)
    stream_parser.add_argument("--message-id", type=int, required=True)

    subparsers.add_parser("speed-info")

    args = parser.parse_args()

    if args.command == "inspect-source":
        result = await inspect_source_message(args.url)
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        return

    if args.command == "stream-media":
        await stream_message_media(args.url, args.message_id)
        return

    if args.command == "speed-info":
        request_size, chunk_size = get_download_settings()
        sys.stdout.write(
            json.dumps(
                {
                    "cryptgAvailable": CRYPTG_AVAILABLE,
                    "requestSize": request_size,
                    "chunkSize": chunk_size
                },
                ensure_ascii=False
            )
        )
        return

    raise RuntimeError("Unknown command")


def main() -> None:
    try:
        asyncio.run(main_async())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
