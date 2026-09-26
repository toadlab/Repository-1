"""Shared paths, config loading and small helpers for the digest pipeline."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"
STATE = DATA / "state"
DIGESTS = DATA / "digests"
NEWS = DATA / "news.json"


def load_json(path: Path, default=None):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, ValueError):
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + "\n")


def profile() -> dict:
    return load_json(CONFIG / "profile.json")


def rubric(p: dict) -> str:
    text = (CONFIG / "rubric.md").read_text()
    home = p["home"]
    return text.format(
        reader=p["reader"], profession=p["profession"], town=home["town"], county=home["county"],
        state=home["state"], metro=home["metro"], domains="; ".join(p["domains"]))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def local_now(p: dict) -> datetime:
    return now_utc().astimezone(ZoneInfo(p["timezone"]))


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value)
