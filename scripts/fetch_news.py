#!/usr/bin/env python3
"""Fetch the RSS/Atom feeds listed in config/feeds.json into data/news.json.

Uses only the Python standard library. Existing items in the output file are
kept (up to ``max_age_days``) so the app can show weekly and monthly views
built from a rolling archive.

Usage:
    python3 scripts/fetch_news.py [--config config/feeds.json] [--out data/news.json]
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "NewsDevotionBot/1.0 (+https://github.com/)"
ATOM = "{http://www.w3.org/2005/Atom}"
RSS1 = "{http://purl.org/rss/1.0/}"
DC = "{http://purl.org/dc/elements/1.1/}"
CONTENT = "{http://purl.org/rss/1.0/modules/content/}"

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def clean_text(value: str | None, limit: int = 280) -> str:
    if not value:
        return ""
    text = html.unescape(TAG_RE.sub(" ", value))
    text = WS_RE.sub(" ", text).strip()
    if len(text) > limit:
        text = text[: limit - 1].rsplit(" ", 1)[0] + "…"
    return text


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    try:
        dt = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def find_text(el: ET.Element, *tags: str) -> str | None:
    for tag in tags:
        child = el.find(tag)
        if child is not None and (child.text or "").strip():
            return child.text
    return None


def parse_feed(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    entries: list[dict] = []

    if root.tag == f"{ATOM}feed":
        for e in root.iter(f"{ATOM}entry"):
            link = None
            for l in e.findall(f"{ATOM}link"):
                if l.get("rel", "alternate") == "alternate":
                    link = l.get("href")
                    break
            entries.append({
                "title": find_text(e, f"{ATOM}title"),
                "link": link,
                "summary": find_text(e, f"{ATOM}summary", f"{ATOM}content"),
                "published": find_text(e, f"{ATOM}published", f"{ATOM}updated"),
            })
        return entries

    # RSS 2.0 (<rss><channel><item>) and RSS 1.0/RDF (<rdf:RDF><item>)
    items = list(root.iter("item")) or list(root.iter(f"{RSS1}item"))
    for i in items:
        entries.append({
            "title": find_text(i, "title", f"{RSS1}title"),
            "link": find_text(i, "link", f"{RSS1}link", "guid"),
            "summary": find_text(i, "description", f"{RSS1}description", f"{CONTENT}encoded"),
            "published": find_text(i, "pubDate", f"{DC}date", "published"),
        })
    return entries


def fetch(feed: dict) -> tuple[dict, list[dict], str | None]:
    req = urllib.request.Request(feed["url"], headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return feed, parse_feed(resp.read()), None
    except Exception as exc:  # network errors, bad XML, etc.
        return feed, [], f"{type(exc).__name__}: {exc}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--config", default=ROOT / "config" / "feeds.json", type=Path)
    ap.add_argument("--out", default=ROOT / "data" / "news.json", type=Path)
    args = ap.parse_args()

    config = json.loads(args.config.read_text())
    max_age = timedelta(days=config.get("max_age_days", 35))
    per_feed = config.get("max_items_per_feed", 150)
    now = datetime.now(timezone.utc)

    archive: dict[str, dict] = {}
    if args.out.exists():
        try:
            for item in json.loads(args.out.read_text()).get("items", []):
                archive[item["link"]] = item
        except (ValueError, KeyError):
            print(f"warning: ignoring unreadable {args.out}", file=sys.stderr)

    feeds = config["feeds"]
    status = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for feed, entries, error in pool.map(fetch, feeds):
            if error:
                print(f"  ✗ {feed['name']}: {error}", file=sys.stderr)
                status.append({"name": feed["name"], "ok": False, "error": error})
                continue
            added = 0
            for entry in entries[:per_feed]:
                title = clean_text(entry["title"], 200)
                link = (entry["link"] or "").strip()
                if not title or not link:
                    continue
                published = parse_date(entry["published"])
                existing = archive.get(link)
                archive[link] = {
                    "title": title,
                    "link": link,
                    "source": feed["name"],
                    "category": feed["category"],
                    "summary": clean_text(entry["summary"]),
                    # Keep the first-seen time for undated items so they age out.
                    "published": (published.isoformat() if published
                                  else (existing or {}).get("published") or now.isoformat()),
                }
                added += 1
            print(f"  ✓ {feed['name']}: {added} items")
            status.append({"name": feed["name"], "ok": True, "count": added})

    cutoff = now - max_age
    items = [
        i for i in archive.values()
        if datetime.fromisoformat(i["published"]) >= cutoff
        and datetime.fromisoformat(i["published"]) <= now + timedelta(hours=12)
    ]
    items.sort(key=lambda i: i["published"], reverse=True)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({
        "generated": now.isoformat(),
        "categories": list(dict.fromkeys(f["category"] for f in feeds)),
        "feeds": status,
        "items": items,
    }, ensure_ascii=False, indent=1))
    print(f"Wrote {len(items)} items to {args.out}")
    return 0 if any(s["ok"] for s in status) else 1


if __name__ == "__main__":
    sys.exit(main())
