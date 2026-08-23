from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO

ROOT = Path.cwd()
UP_MOD = ROOT / "db mods" / "up_mod"
TABLE = ROOT / "db mods" / "mods_table.json"
STATE = ROOT / "db mods" / "up_mod_intake_state.json"
SEVEN_ZIP = Path(r"C:\Program Files\7-Zip\7z.exe")
APPLY = "--apply" in sys.argv


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text("utf-8-sig"))
    except FileNotFoundError:
        return fallback


def write_json_atomic(path: Path, value) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", "utf-8")
    temp.replace(path)


def find_text(root: ET.Element, *names: str) -> str:
    wanted = {name.lower() for name in names}
    for node in root.iter():
        tag = node.tag.split("}", 1)[-1].lower()
        if tag in wanted and node.text and node.text.strip():
            return node.text.strip()
    return ""


def manifest_from_zip_bytes(data: bytes):
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            manifest_name = next(
                (name for name in archive.namelist() if name.lower().endswith("manifest.xml")),
                None,
            )
            if not manifest_name:
                return None
            xml_root = ET.fromstring(archive.read(manifest_name))
        manifest = {
            "Name": find_text(xml_root, "name"),
            "Version": find_text(xml_root, "version"),
            "Author": find_text(xml_root, "author"),
            "Guid": find_text(xml_root, "guid"),
        }
        if not manifest["Guid"]:
            raise RuntimeError("manifest Guid is empty")
        return manifest
    except zipfile.BadZipFile:
        return None


def nested_mods(data: bytes, depth: int = 0):
    if depth > 2:
        return [], ["nested archive depth exceeded"]
    direct = manifest_from_zip_bytes(data)
    if direct:
        return [(None, data, direct)], []
    found = []
    ignored = []
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            names = [
                name
                for name in archive.namelist()
                if not name.endswith("/") and Path(name).suffix.lower() in {".zip", ".zipmod"}
            ]
            for name in names:
                child_data = archive.read(name)
                child_found, child_ignored = nested_mods(child_data, depth + 1)
                if child_found:
                    for _, payload, manifest in child_found:
                        found.append((Path(name).name, payload, manifest))
                else:
                    ignored.append(Path(name).name)
                ignored.extend(child_ignored)
    except zipfile.BadZipFile:
        pass
    return found, ignored


def list_rar_entries(path: Path):
    result = subprocess.run(
        [str(SEVEN_ZIP), "l", "-slt", str(path)],
        capture_output=True,
        check=True,
    )
    text = result.stdout.decode("utf-8", errors="replace")
    entries = []
    for line in text.splitlines():
        if not line.startswith("Path = "):
            continue
        value = line[7:].strip()
        if value == str(path) or value.lower().endswith(".rar"):
            continue
        if Path(value.replace("\\", "/")).suffix.lower() in {".zip", ".zipmod"}:
            entries.append(value)
    return entries


def read_rar_entry(path: Path, entry: str):
    basename = Path(entry.replace("\\", "/")).name
    result = subprocess.run(
        [str(SEVEN_ZIP), "x", "-so", str(path), f"*{basename}"],
        capture_output=True,
        check=True,
    )
    if not result.stdout:
        raise RuntimeError(f"empty RAR entry: {basename}")
    return basename, result.stdout


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    if not UP_MOD.is_dir():
        raise RuntimeError(f"up_mod folder not found: {UP_MOD}")
    if not SEVEN_ZIP.is_file():
        raise RuntimeError(f"7-Zip not found: {SEVEN_ZIP}")

    rows = read_json(TABLE, [])
    if not isinstance(rows, list):
        raise RuntimeError("mods_table.json is not an array")
    existing = {
        (row.get("Guid", ""), row.get("Version", "") or "", row.get("Filename", ""))
        for row in rows
    }

    candidates = []
    containers = []
    errors = []
    ignored = []

    source_files = sorted(path for path in UP_MOD.iterdir() if path.is_file())
    for source in source_files:
        suffix = source.suffix.lower()
        try:
            if suffix in {".zip", ".zipmod"}:
                data = source.read_bytes()
                direct = manifest_from_zip_bytes(data)
                if direct:
                    candidates.append((source.name, data, direct, source.name))
                    continue
                found, child_ignored = nested_mods(data)
                if not found:
                    errors.append({"filename": source.name, "error": "no manifest-bearing mod found"})
                    continue
                produced = []
                for child_name, payload, manifest in found:
                    target_name = child_name or source.name
                    candidates.append((target_name, payload, manifest, source.name))
                    produced.append(target_name)
                containers.append({"filename": source.name, "produced": sorted(set(produced))})
                ignored.extend({"container": source.name, "filename": name} for name in child_ignored)
                continue

            if suffix == ".rar":
                produced = []
                for entry in list_rar_entries(source):
                    entry_name, data = read_rar_entry(source, entry)
                    found, child_ignored = nested_mods(data)
                    if not found:
                        ignored.append({"container": source.name, "filename": entry_name})
                        continue
                    for child_name, payload, manifest in found:
                        target_name = child_name or entry_name
                        candidates.append((target_name, payload, manifest, source.name))
                        produced.append(target_name)
                    ignored.extend({"container": source.name, "filename": name} for name in child_ignored)
                if not produced:
                    errors.append({"filename": source.name, "error": "no manifest-bearing mod found"})
                    continue
                containers.append({"filename": source.name, "produced": sorted(set(produced))})
                continue

            errors.append({"filename": source.name, "error": f"unsupported extension: {suffix}"})
        except Exception as error:
            errors.append({"filename": source.name, "error": str(error)})

    by_target = {}
    for filename, payload, manifest, container in candidates:
        previous = by_target.get(filename)
        if previous and sha256(previous[0]) != sha256(payload):
            errors.append({"filename": filename, "error": "two different payloads resolve to the same filename"})
            continue
        by_target[filename] = (payload, manifest, container)

    proposed = []
    extracted = []
    for filename in sorted(by_target):
        payload, manifest, container = by_target[filename]
        target = UP_MOD / filename
        source_is_target = container == filename
        if not source_is_target:
            if target.exists() and sha256(target.read_bytes()) != sha256(payload):
                errors.append({"filename": filename, "error": "target exists with a different SHA-256"})
                continue
            extracted.append({
                "filename": filename,
                "container": container,
                "bytes": len(payload),
                "sha256": sha256(payload),
            })
        row = {
            **manifest,
            "Filename": filename,
            "Location": str(target.resolve()),
            "MessageLink": "",
        }
        key = (row["Guid"], row["Version"] or "", row["Filename"])
        if key not in existing:
            proposed.append((row, payload, source_is_target))
            existing.add(key)

    summary = {
        "mode": "apply" if APPLY else "dry-run",
        "sourceFiles": len(source_files),
        "manifestMods": len(by_target),
        "newRows": len(proposed),
        "containers": containers,
        "extracted": extracted,
        "ignored": ignored,
        "errors": errors,
        "rows": [row for row, _, _ in proposed],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if errors:
        raise RuntimeError("intake blocked because one or more source files could not be validated")
    if not APPLY:
        return

    for row, payload, source_is_target in proposed:
        if source_is_target:
            continue
        target = Path(row["Location"])
        if not target.exists():
            target.write_bytes(payload)

    rows.extend(row for row, _, _ in proposed)
    write_json_atomic(TABLE, rows)
    write_json_atomic(
        STATE,
        {
            "version": 1,
            "updatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "containers": containers,
            "ignored": ignored,
        },
    )
    print(json.dumps({"applied": len(proposed), "tableRows": len(rows)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"[fatal] {error}", file=sys.stderr)
        raise SystemExit(1)
