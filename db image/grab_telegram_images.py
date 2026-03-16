import os
import re
import json
import asyncio
from pathlib import Path
from typing import Optional, Iterable

from telethon import TelegramClient
from telethon.tl.types import (
    MessageEntityTextUrl,
    MessageEntityUrl,
)

# =========================
# 基本設定
# =========================
API_ID = int(os.getenv("TG_API_ID", "123456"))
API_HASH = os.getenv("TG_API_HASH", "YOUR_API_HASH")
SESSION_NAME = os.getenv("TG_SESSION", "koikatu_session")

CHANNEL = "Koikatunews"
START_ID = 3882
END_ID = 30385

OUTPUT_DIR = Path("output")
STATE_FILE = OUTPUT_DIR / "_state.json"

# 超連結顯示文字
TARGET_LINK_TEXT = "卡片下载"

# 若為 True，遇到已下載過的 grouped_id / message_id 會跳過
SKIP_EXISTING = True


# =========================
# 小工具
# =========================
def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {
        "done_grouped_ids": [],
        "done_single_ids": [],
        "errors": []
    }


def save_state(state: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def safe_name(name: str) -> str:
    return re.sub(r'[<>:"/\\\\|?*\\x00-\\x1f]', "_", name).strip() or "file"


def entity_text(message, entity) -> str:
    """
    從 message.raw_text 依 entity offset/length 擷取顯示文字
    """
    text = message.raw_text or ""
    try:
        return text[entity.offset: entity.offset + entity.length]
    except Exception:
        return ""


def has_target_link_text(message, target_text: str = TARGET_LINK_TEXT) -> bool:
    """
    判斷訊息文字或 caption 中，是否存在顯示文字為 '卡片下载' 的超連結
    """
    entities = getattr(message, "entities", None) or []
    if not entities:
        return False

    for ent in entities:
        # TextUrl = 顯示文字 + 真正 URL
        if isinstance(ent, MessageEntityTextUrl):
            visible_text = entity_text(message, ent).strip()
            if visible_text == target_text:
                return True

        # Url = 直接裸網址，這種通常不會有「卡片下载」四個字
        # 保留分支只是方便你之後擴充
        elif isinstance(ent, MessageEntityUrl):
            visible_text = entity_text(message, ent).strip()
            if visible_text == target_text:
                return True

    return False


def is_image_message(message) -> bool:
    """
    只下載圖片類媒體：
    1. photo
    2. document 但 mime_type 為 image/*
    """
    if getattr(message, "photo", None):
        return True

    doc = getattr(message, "document", None)
    if doc and getattr(doc, "mime_type", None):
        return str(doc.mime_type).startswith("image/")

    return False


def get_file_ext_from_message(message) -> str:
    """
    盡量補副檔名
    """
    if getattr(message, "photo", None):
        return ".jpg"

    doc = getattr(message, "document", None)
    if doc:
        mime = getattr(doc, "mime_type", "") or ""
        if mime == "image/png":
            return ".png"
        if mime == "image/webp":
            return ".webp"
        if mime == "image/gif":
            return ".gif"
        if mime == "image/jpeg":
            return ".jpg"

        # 從 document attributes 裡找檔名
        attrs = getattr(doc, "attributes", None) or []
        for attr in attrs:
            file_name = getattr(attr, "file_name", None)
            if file_name:
                suffix = Path(file_name).suffix
                if suffix:
                    return suffix

    return ".bin"


async def download_one_message_media(client: TelegramClient, message, folder: Path, index: int) -> Optional[str]:
    if not is_image_message(message):
        return None

    ext = get_file_ext_from_message(message)
    filename = f"{index:03d}_{message.id}{ext}"
    out_path = folder / filename

    # Telethon 支援直接從 message 下載媒體到指定路徑
    await client.download_media(message, file=str(out_path))
    return str(out_path)


async def get_group_messages(client: TelegramClient, channel, grouped_id: int, anchor_message_id: int) -> list:
    """
    由於相簿是多則 message 共用 grouped_id，這裡以前後少量範圍撈回來再過濾。
    grouped_id 為 Telethon 判斷 album 的核心欄位。:contentReference[oaicite:1]{index=1}
    """
    collected = []

    # 向前向後各撈一些，通常一組 album 不會太大
    min_id = max(1, anchor_message_id - 20)
    max_id = anchor_message_id + 20

    async for msg in client.iter_messages(channel, min_id=min_id, max_id=max_id + 1, reverse=True):
        if getattr(msg, "grouped_id", None) == grouped_id:
            collected.append(msg)

    collected.sort(key=lambda m: m.id)
    return collected


async def process_group(client: TelegramClient, channel, anchor_message, state: dict) -> None:
    grouped_id = getattr(anchor_message, "grouped_id", None)
    folder = OUTPUT_DIR / str(anchor_message.id)

    if SKIP_EXISTING and grouped_id in state["done_grouped_ids"]:
        print(f"[SKIP][GROUP] message_id={anchor_message.id} grouped_id={grouped_id}")
        return

    folder.mkdir(parents=True, exist_ok=True)

    msgs = await get_group_messages(client, channel, grouped_id, anchor_message.id)
    downloaded = []

    idx = 1
    for msg in msgs:
        saved = await download_one_message_media(client, msg, folder, idx)
        if saved:
            downloaded.append({
                "message_id": msg.id,
                "path": saved
            })
            idx += 1

    meta = {
        "mode": "group",
        "anchor_message_id": anchor_message.id,
        "grouped_id": grouped_id,
        "message_ids": [m.id for m in msgs],
        "downloaded": downloaded,
        "text": anchor_message.raw_text or ""
    }
    (folder / "_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    state["done_grouped_ids"].append(grouped_id)
    save_state(state)
    print(f"[DONE][GROUP] {anchor_message.id} -> {folder} ({len(downloaded)} files)")


async def process_single(client: TelegramClient, message, state: dict) -> None:
    folder = OUTPUT_DIR / str(message.id)

    if SKIP_EXISTING and message.id in state["done_single_ids"]:
        print(f"[SKIP][SINGLE] message_id={message.id}")
        return

    folder.mkdir(parents=True, exist_ok=True)
    downloaded = []

    saved = await download_one_message_media(client, message, folder, 1)
    if saved:
        downloaded.append({
            "message_id": message.id,
            "path": saved
        })

    meta = {
        "mode": "single",
        "anchor_message_id": message.id,
        "grouped_id": None,
        "message_ids": [message.id],
        "downloaded": downloaded,
        "text": message.raw_text or ""
    }
    (folder / "_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    state["done_single_ids"].append(message.id)
    save_state(state)
    print(f"[DONE][SINGLE] {message.id} -> {folder} ({len(downloaded)} files)")


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

    client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.start()

    channel = await client.get_entity(CHANNEL)

    # 依 message id 區間逐筆讀取
    # reverse=True 代表由小到大
    async for message in client.iter_messages(
        channel,
        min_id=START_ID - 1,
        max_id=END_ID + 1,
        reverse=True
    ):
        if not message:
            continue

        if message.id < START_ID or message.id > END_ID:
            continue

        # 規則1：內文中要有顯示文字為「卡片下载」的超連結
        if not has_target_link_text(message):
            continue

        # 規則2：有 grouped_id 就抓整組；沒有就抓單張
        grouped_id = getattr(message, "grouped_id", None)

        try:
            if grouped_id:
                await process_group(client, channel, message, state)
            else:
                # 沒 group 但本身是圖片時也下載
                if is_image_message(message):
                    await process_single(client, message, state)
                else:
                    print(f"[SKIP][NO_IMAGE] message_id={message.id}")
        except Exception as e:
            err = {
                "message_id": message.id,
                "grouped_id": grouped_id,
                "error": repr(e)
            }
            state["errors"].append(err)
            save_state(state)
            print(f"[ERROR] {err}")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())