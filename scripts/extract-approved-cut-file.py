import argparse
import json
import os
from pathlib import Path
from zipfile import ZipFile


def within(base: Path, target: Path) -> bool:
    try:
        target.relative_to(base)
        return True
    except ValueError:
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--entry")
    parser.add_argument("--entry-index", type=int)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    root = Path.cwd().resolve()
    archive_roots = [
        (root / "db image" / "cut" / "_source-downloads").resolve(),
        (root / "db image" / "output").resolve(),
    ]
    cut_root = (root / "db image" / "cut").resolve()
    archive_path = (root / args.archive).resolve()
    output_path = (root / args.output).resolve()

    if not any(within(archive_root, archive_path) for archive_root in archive_roots):
        raise SystemExit("archive is outside allowed temporary source roots")
    if not within(cut_root, output_path):
        raise SystemExit("output is outside cut root")
    if not archive_path.exists():
        raise SystemExit(f"archive not found: {args.archive}")

    if (args.entry is None) == (args.entry_index is None):
        raise SystemExit("provide exactly one of --entry or --entry-index")

    output_path.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive_path) as archive:
        names = [name for name in archive.namelist() if not name.endswith("/")]
        if args.entry_index is not None:
            if args.entry_index < 0 or args.entry_index >= len(names):
                raise SystemExit(f"entry index out of range: {args.entry_index}")
            entry = names[args.entry_index]
        else:
            entry = args.entry
            if entry not in names:
                raise SystemExit(f"entry not found: {entry}")
        file_name = Path(entry).name
        target = output_path / file_name
        target.write_bytes(archive.read(entry))

    result = {
        "archive": args.archive,
        "entry": entry,
        "output": args.output,
        "file": str(target),
        "bytes": target.stat().st_size,
        "files": sorted(p.name for p in output_path.iterdir() if p.is_file()),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
