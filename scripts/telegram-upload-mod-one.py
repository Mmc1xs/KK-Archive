import argparse
import json
import os
import sys
import time
from pathlib import Path

from telethon import TelegramClient
from telethon.sessions import StringSession


def emit(payload: dict) -> None:
    # Use ASCII-escaped JSON to avoid Windows cp932 console encoding failures
    # when paths/errors contain CJK characters.
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def resolve_session_file(session_override: str | None) -> str:
    if session_override:
        return str(Path(session_override).resolve())
    default_file = Path("db image") / "koikatu_session.session"
    if default_file.exists():
        return str(default_file.resolve())
    return os.environ.get("TG_SESSION", "koikatu_session").strip() or "koikatu_session"


def build_link(entity, message_id: int) -> str:
    username = getattr(entity, "username", None)
    if username:
        return f"https://t.me/{username}/{message_id}"
    peer = getattr(entity, "id", None)
    if peer is None:
        return ""
    peer_str = str(peer)
    if peer_str.startswith("-100"):
        peer_str = peer_str[4:]
    return f"https://t.me/c/{peer_str}/{message_id}"


async def run_upload(args: argparse.Namespace) -> int:
    api_id_raw = os.environ.get("TG_API_ID", "").strip()
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_id_raw or not api_hash:
        emit(
            {
                "type": "error",
                "ok": False,
                "error": "Missing TG_API_ID or TG_API_HASH in environment."
            }
        )
        return 2

    try:
        api_id = int(api_id_raw)
    except ValueError:
        emit({"type": "error", "ok": False, "error": "TG_API_ID must be an integer."})
        return 2

    file_path = Path(args.file).resolve()
    if not file_path.exists() or not file_path.is_file():
        emit({"type": "error", "ok": False, "error": f"File not found: {file_path}"})
        return 2

    session_source = resolve_session_file(args.session_file)
    if os.path.isfile(session_source):
        session_for_client = session_source
    else:
        session_for_client = StringSession(session_source)

    last_sample = {"ts": time.time(), "sent": 0}
    started_at = time.time()
    last_emit_ts = 0.0
    emit_interval_sec = max(0.05, float(args.progress_interval_ms) / 1000.0)

    def on_progress(sent: int, total: int) -> None:
        nonlocal last_emit_ts
        now = time.time()
        if sent < total and (now - last_emit_ts) < emit_interval_sec:
            return
        elapsed = max(now - started_at, 1e-6)
        delta_t = now - last_sample["ts"]
        delta_b = sent - last_sample["sent"]
        instant_speed = (delta_b / delta_t) if delta_t > 0 else 0.0
        avg_speed = sent / elapsed
        emit(
            {
                "type": "progress",
                "sent": sent,
                "total": total,
                "percent": round((sent / total) * 100.0, 2) if total > 0 else 0.0,
                "instantBps": int(max(0, instant_speed)),
                "avgBps": int(max(0, avg_speed))
            }
        )
        last_sample["ts"] = now
        last_sample["sent"] = sent
        last_emit_ts = now

    part_size_kb = int(args.part_size_kb)
    if part_size_kb < 32:
        part_size_kb = 32
    if part_size_kb > 512:
        part_size_kb = 512

    file_size = file_path.stat().st_size

    async with TelegramClient(
        session_for_client,
        api_id,
        api_hash,
        connection_retries=5,
        request_retries=5,
        auto_reconnect=True,
        flood_sleep_threshold=60
    ) as client:
        entity = await client.get_entity(args.channel)
        uploaded = await client.upload_file(
            file=str(file_path),
            part_size_kb=part_size_kb,
            file_size=file_size,
            progress_callback=on_progress
        )
        message = await client.send_file(
            entity=entity,
            file=uploaded,
            caption=""
        )
        message_id = int(message.id)
        link = build_link(entity, message_id)
        emit(
            {
                "type": "result",
                "ok": True,
                "messageId": message_id,
                "link": link,
                "file": str(file_path),
                "partSizeKb": part_size_kb
            }
        )
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload one mod file to Telegram and emit JSON progress.")
    parser.add_argument("--channel", required=True, help="Target Telegram channel username or link.")
    parser.add_argument("--file", required=True, help="Local file path to upload.")
    parser.add_argument(
        "--session-file",
        default="",
        help="Optional explicit .session path. Defaults to db image/koikatu_session.session if present."
    )
    parser.add_argument(
        "--part-size-kb",
        type=int,
        default=int(os.environ.get("TG_UPLOAD_PART_SIZE_KB", "512") or "512"),
        help="Upload chunk size in KB (32~512)."
    )
    parser.add_argument(
        "--progress-interval-ms",
        type=int,
        default=int(os.environ.get("TG_UPLOAD_PROGRESS_INTERVAL_MS", "200") or "200"),
        help="Minimum interval for emitting progress logs."
    )
    args = parser.parse_args()

    try:
        import asyncio

        return asyncio.run(run_upload(args))
    except Exception as exc:  # pragma: no cover
        emit({"type": "error", "ok": False, "error": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
