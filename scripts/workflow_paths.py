from __future__ import annotations

import os
from pathlib import Path


SITE_ROOT = Path.cwd().resolve()


def resolve_workflow_root() -> Path:
    configured = os.environ.get("KK_WORKFLOW_ROOT", "").strip()
    if configured:
        return Path(configured).resolve()

    sibling_root = (SITE_ROOT.parent / "KK Diction").resolve()
    return sibling_root if sibling_root.exists() else SITE_ROOT


WORKFLOW_ROOT = resolve_workflow_root()
DB_IMAGE_ROOT = WORKFLOW_ROOT / "db image"
CUT_ROOT = DB_IMAGE_ROOT / "cut"
DB_MODS_ROOT = WORKFLOW_ROOT / "db mods"
