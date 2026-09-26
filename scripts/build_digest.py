#!/usr/bin/env python3
"""Build today's digest (data/digests/YYYY-MM-DD.json) from the scored stories.

The day's type comes from the cadence in config/profile.json:
  pulse-<circle>        daily pulse (0-3 items) plus that circle's spotlight
  reflection[-hyperlocal]  little or no news; one inspiring story
  weekly                the Saturday digest (8-12 items with context)
Emergencies override the rhythm on any day.

Usage: python3 scripts/build_digest.py [--date YYYY-MM-DD] [--force]
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import llm
from common import DIGESTS, NEWS, STATE, load_json, local_now, parse_ts, profile, rubric, save_json

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


# ---------- selection helpers ----------
def story(item: dict, s: dict, **extra) -> dict:
    return {
        "id": item["id"], "title": item["title"], "link": item["link"], "source": item["source"],
        "published": item["published"], "summary": item.get("summary", ""), "circle": s["circle"],
        "story_key": s["story_key"], "composite": s["composite"], "bar": s["bar"],
        "decision": s["decision"], "reason": s["reason"], "flourishing": s["flourishing"],
        "domain": s["domain"], "durability": s["durability"], **extra,
    }


def fatigued(item: dict, s: dict, coverage: dict, kinds: set[str], since: datetime) -> bool:
    """Covered recently, and this item is not a genuine update published since then."""
    seen = [c for c in coverage.get(s["story_key"], []) if c["kind"] in kinds and parse_ts(c["at"]) >= since]
    if not seen:
        return False
    if any(c.get("id") == item["id"] for c in seen):
        return True
    last = max(parse_ts(c["at"]) for c in seen)
    return not (s.get("new_development") and parse_ts(item["published"]) > last)


def best_per_key(rows: list[tuple[dict, dict]]) -> list[tuple[dict, dict]]:
    best: dict[str, tuple[dict, dict]] = {}
    for item, s in rows:
        k = s["story_key"]
        if k not in best or s["composite"] > best[k][1]["composite"]:
            best[k] = (item, s)
    return sorted(best.values(), key=lambda r: r[1]["composite"], reverse=True)


def methodology(rows: list[tuple[dict, dict]], chosen_ids: set[str], fatigue_ids: set[str], label: str) -> dict:
    counts = Counter()
    excluded, borderline = [], []
    for item, s in rows:
        if item["id"] in chosen_ids:
            continue
        if item["id"] in fatigue_ids:
            counts["already covered, no genuine update"] += 1
            continue
        if s["decision"] == "borderline":
            borderline.append({"title": item["title"], "link": item["link"], "source": item["source"],
                               "note": s["reason"], "composite": s["composite"], "bar": s["bar"]})
        elif s["decision"] == "exclude":
            counts[f"{s['circle']}|{s['exclusion']}"] += 1
            excluded.append({"title": item["title"], "link": item["link"], "source": item["source"],
                             "reason": s["exclusion"], "circle": s["circle"]})
        else:
            counts["cleared the bar but didn't fit this digest's scope"] += 1
    notes = []
    for key, n in counts.most_common():
        if "|" in key:
            circle, why = key.split("|")
            notes.append(f"{n} {circle} stor{'y was' if n == 1 else 'ies were'} filtered out {label}: {why}.")
        else:
            notes.append(f"{n} stor{'y' if n == 1 else 'ies'}: {key}.")
    borderline.sort(key=lambda b: b["composite"], reverse=True)
    return {"considered": len(rows), "included": len(chosen_ids), "notes": notes,
            "borderline": borderline[:6], "excluded": excluded}


def skew(items: list[dict]) -> str | None:
    if len(items) < 2:
        return None
    circles = Counter(i["circle"] for i in items)
    circle, n = circles.most_common(1)[0]
    if n == len(items):
        return (f"Every included story is {circle}-circle, which reflects this period's news and the "
                f"scoring rules, not a thumb on the scale.")
    domain = sum(1 for i in items if i["domain"] >= 6)
    if domain == len(items):
        return ("Every included story is finance-related. That reflects real skew in the news cycle plus the "
                "domain weighting, not an editorial choice.")
    return None


# ---------- Claude writing (optional) ----------
BLURB_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {"type": "array", "items": {
            "type": "object",
            "properties": {"id": {"type": "string"}, "blurb": {"type": "string"}, "summary": {"type": "string"},
                           "why_it_matters": {"type": "string"}, "talk_to": {"type": "string"}},
            "required": ["id", "blurb", "summary", "why_it_matters", "talk_to"],
            "additionalProperties": False}},
        "skew_note": {"type": "string"},
    },
    "required": ["items", "skew_note"],
    "additionalProperties": False,
}
DEEP_SCHEMA = {
    "type": "object",
    "properties": {
        "background": {"type": "string"},
        "prior_attempts": {"type": "string"},
        "consensus": {"type": "string"},
        "debated": {"type": "string"},
        "open_questions": {"type": "array", "items": {"type": "string"}},
        "faith_engagement": {"type": "string"},
        "sources": {"type": "array", "items": {
            "type": "object", "properties": {"title": {"type": "string"}, "url": {"type": "string"}},
            "required": ["title", "url"], "additionalProperties": False}},
    },
    "required": ["background", "prior_attempts", "consensus", "debated", "open_questions", "faith_engagement",
                 "sources"],
    "additionalProperties": False,
}
REGION_SCHEMA = {
    "type": "object",
    "properties": {
        "what_is_true": {"type": "string"},
        "changes_since_last": {"type": "string"},
        "suggestion": {"type": "string"},
        "sources": DEEP_SCHEMA["properties"]["sources"],
    },
    "required": ["what_is_true", "changes_since_last", "suggestion", "sources"],
    "additionalProperties": False,
}


def write_items(p: dict, items: list[dict], kind: str) -> None:
    """Fill blurb/summary/why_it_matters/talk_to for each item, in place."""
    for i in items:  # sensible defaults when Claude is unavailable
        i.setdefault("blurb", i["summary"][:220])
        i.setdefault("ai_summary", "")
        i.setdefault("why_it_matters", "")
        i.setdefault("talk_to", "")
    if not items or not llm.available():
        return
    detail = ("For each story write: blurb (one or two plain sentences on what happened, a few lines at most); "
              "summary (2-3 neutral sentences); why_it_matters (for the weekly digest, a short paragraph of context "
              f"on why this matters to {p['reader']} as a citizen, {p['profession']}, or neighbor; "
              "empty string for a daily pulse); talk_to (occasionally, when it would genuinely help, one sentence "
              "suggesting who he might call or talk with about this, a client, colleague, neighbor, pastor, or "
              "family member; otherwise empty string). Also write skew_note: one sentence if the set is lopsided "
              "by circle or topic because of real-world events, else empty string. No hype, no alarm.")
    lines = "\n".join(f"[{i['id']}] {i['title']} | {i['source']} | circle={i['circle']} | {i['summary']}" for i in items)
    result = llm.ask_json(model=p["claude"]["model"], system=rubric(p),
                          prompt=f"These stories cleared the bar for the {kind}.\n{detail}\n\n{lines}",
                          schema=BLURB_SCHEMA)
    if not result:
        return
    by_id = {r["id"]: r for r in result["items"]}
    for i in items:
        r = by_id.get(i["id"])
        if r:
            i.update(blurb=r["blurb"], ai_summary=r["summary"], why_it_matters=r["why_it_matters"],
                     talk_to=r["talk_to"])
    return result.get("skew_note") or None


def deep_dive(p: dict, item: dict) -> dict | None:
    if not llm.available():
        return None
    prompt = (f"Write a deeper-context briefing on this story for {p['reader']}, a {p['profession']}.\n"
              f"Story: {item['title']} ({item['source']}, {item['link']})\n{item['summary']}\n\n"
              "Search the web as needed. Cover: background; prior_attempts (what research or earlier attempts exist); "
              "consensus (where genuine consensus lies); debated (where serious people still disagree, fairly "
              "represented); open_questions (3-5); faith_engagement (only where relevant and helpful: how the "
              "Christian tradition has engaged the underlying question, as one thoughtful voice among others, "
              "not the final word; else empty string); sources (the pages you relied on).")
    return llm.ask_json(model=p["claude"]["model"], system=rubric(p), prompt=prompt, schema=DEEP_SCHEMA,
                        web_search=5)


def region_note(p: dict, region: str, month: str) -> dict:
    slug = re.sub(r"[^a-z0-9]+", "-", region.lower()).strip("-")
    path = STATE / "regions" / f"{slug}.json"
    log = load_json(path, {"region": region, "visits": []})
    visit = next((v for v in log["visits"] if v["month"] == month), None)
    if visit is None and llm.available():
        last = log["visits"][-1] if log["visits"] else None
        previous = (f"Notes from the last visit ({last['month']}):\n{last['what_is_true']}"
                    if last else "This is the first visit to this region.")
        prompt = (f"This month's global focus region is {region}. Search the web. Do not chase headlines. Ask what "
                  "is persistently or quietly true in this region right now, including slow-moving crises, "
                  "long-running conflicts, famine, displacement, and also what is genuinely working. "
                  f"{previous}\n\nWrite what_is_true (a brief note, one or two short paragraphs), "
                  "changes_since_last (what changed since the last visit, or 'Nothing significant has changed.'), "
                  f"suggestion (one thing worth {p['reader']}'s attention or prayer this month), and sources.")
        result = llm.ask_json(model=p["claude"]["model"], system=rubric(p), prompt=prompt, schema=REGION_SCHEMA,
                              web_search=8)
        if result:
            visit = {"month": month, "generated": local_now(p).isoformat(), **result}
            log["visits"].append(visit)
            save_json(path, log)
    return {"region": region, "month": month, "visit": visit, "visits_logged": len(log["visits"])}


# ---------- main ----------
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="build for this local date (default: today)")
    ap.add_argument("--force", action="store_true", help="rebuild even if today's digest exists")
    args = ap.parse_args()

    p = profile()
    tz = ZoneInfo(p["timezone"])
    now = local_now(p)
    day = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else now.date()
    as_of = now if day == now.date() else datetime.combine(day, time(p["digest_hour"]), tz)
    if not args.date and not args.force and now.hour < p["digest_hour"]:
        print(f"Before {p['digest_hour']}:00 local; today's digest not due yet.")

    news = load_json(NEWS, {"items": []})
    scores = load_json(STATE / "scores.json", {})
    coverage: dict = load_json(STATE / "coverage.json", {})
    if args.force:  # a rebuild must not count its own earlier picks as already covered
        coverage = {k: [c for c in v if c.get("digest") != day.isoformat()] for k, v in coverage.items()}
    rows = [(i, scores[i["id"]]) for i in news["items"] if i["id"] in scores]
    rows = [(i, s) for i, s in rows if parse_ts(i["published"]) <= as_of]

    def window(days: float) -> list[tuple[dict, dict]]:
        start = as_of - timedelta(days=days)
        return [(i, s) for i, s in rows if parse_ts(i["published"]) >= start]

    path = DIGESTS / f"{day.isoformat()}.json"
    existing = load_json(path)
    covered_ids = {c.get("id") for v in coverage.values() for c in v}

    # Emergencies override the rhythm on any day, even after the digest is built.
    emergencies = [story(i, s) for i, s in best_per_key(window(1))
                   if s.get("emergency") and i["id"] not in covered_ids]
    due = args.force or args.date or now.hour >= p["digest_hour"]
    if existing and not emergencies and not args.force:
        print(f"{path.name} already built; nothing new.")
        return 0
    if not existing and not due:
        return 0

    day_type = p["cadence"][WEEKDAYS[day.weekday()]]
    digest = existing if (existing and not args.force) else {
        "date": day.isoformat(), "type": day_type.split("-")[0],
        "circle": day_type.split("-")[1] if "-" in day_type else None,
        "generated": as_of.isoformat(), "emergencies": [],
    }
    fresh = digest is not existing
    newly_covered: list[dict] = []

    if emergencies:
        write_items(p, emergencies, "emergency alert")
        digest["emergencies"] = digest.get("emergencies", []) + emergencies
        newly_covered += [{**e, "kind": "emergency"} for e in emergencies]

    if fresh:
        kind = digest["type"]
        pulse_since = as_of - timedelta(days=p["fatigue_days"]["pulse"])
        if kind == "pulse":
            # Look back to the previous pulse so reflection days don't swallow news.
            lookback = 1
            for back in range(1, 4):
                prev = WEEKDAYS[(day.weekday() - back) % 7]
                if p["cadence"][prev].startswith("pulse"):
                    break
                lookback += 1
            cand, fatigue_ids = [], set()
            for i, s in best_per_key(window(lookback)):
                if s["decision"] != "include":
                    continue
                if not (s["circle"] in ("hyperlocal", "local") or s["domain"] >= p["scoring"]["domain_critical"]):
                    continue
                if fatigued(i, s, coverage, {"pulse", "weekly", "spotlight", "emergency"}, pulse_since):
                    fatigue_ids.add(i["id"])
                    continue
                cand.append(story(i, s))
            pulse = cand[: p["pulse_max_items"]]
            circle = digest["circle"]
            spotlight = None
            if circle in ("local", "state"):
                taken = {x["story_key"] for x in pulse}
                spot = [story(i, s) for i, s in best_per_key(window(7))
                        if s["circle"] == circle and s["decision"] in ("include", "borderline")
                        and s["story_key"] not in taken
                        and not fatigued(i, s, coverage, {"pulse", "weekly", "spotlight"}, pulse_since)][:3]
                spotlight = {"circle": circle, "items": spot}
                newly_covered += [{**x, "kind": "spotlight"} for x in spot]
            elif circle == "global":
                regions = p["regions"]
                region = regions[(day.year * 12 + day.month - 1) % len(regions)]
                spotlight = {"circle": "global", **region_note(p, region, day.strftime("%Y-%m"))}
            note = write_items(p, pulse + (spotlight or {}).get("items", []), "daily pulse")
            digest["pulse"] = pulse
            digest["spotlight"] = spotlight
            chosen = {x["id"] for x in pulse}
            digest["methodology"] = methodology(window(lookback), chosen, fatigue_ids, "from today's pulse")
            digest["methodology"]["skew_note"] = note or skew(pulse)
            newly_covered += [{**x, "kind": "pulse"} for x in pulse]

        elif kind == "reflection":
            inspiring = [story(i, s) for i, s in best_per_key(window(7))
                         if s["flourishing"] >= 6 and s["decision"] in ("include", "borderline")
                         and i["id"] not in covered_ids][:1]
            write_items(p, inspiring, "reflection day's inspiring story")
            digest["inspiring"] = inspiring
            newly_covered += [{**x, "kind": "inspiring"} for x in inspiring]

        elif kind == "weekly":
            weekly_since = as_of - timedelta(days=p["fatigue_days"]["weekly"])
            week = window(7)
            # Running tally: borderline on several separate days means it quietly persisted.
            border_days = defaultdict(set)
            for i, s in window(21):
                if s["decision"] == "borderline":
                    border_days[s["story_key"]].add(i["published"][:10])
            cand, fill, fatigue_ids = [], [], set()
            for i, s in best_per_key(week):
                if fatigued(i, s, coverage, {"weekly"}, weekly_since):
                    fatigue_ids.add(i["id"])
                    continue
                if s["decision"] == "include":
                    cand.append(story(i, s))
                elif s["decision"] == "borderline":
                    persisted = len(border_days[s["story_key"]]) >= p["scoring"]["tally_promote_days"]
                    (cand if persisted else fill).append(
                        story(i, s, borderline=True, promoted=persisted))
            items = cand[: p["weekly_max_items"]]
            if len(items) < p["weekly_min_items"]:
                items += fill[: p["weekly_min_items"] - len(items)]
            note = write_items(p, items, "weekly digest")
            for item in items[: p["deep_dives_per_week"]]:
                dd = deep_dive(p, item)
                if dd:
                    item["deep_dive"] = dd
            digest["items"] = items
            digest["first_weekend"] = day.day <= 7
            digest["methodology"] = methodology(week, {x["id"] for x in items}, fatigue_ids, "this week")
            digest["methodology"]["skew_note"] = note or skew(items)
            newly_covered += [{**x, "kind": "weekly"} for x in items]

        digest["scored_by"] = sorted({scores[i]["scored_by"] for i in scores}) if scores else []

    for c in newly_covered:
        coverage.setdefault(c["story_key"], []).append(
            {"at": as_of.isoformat(), "kind": c["kind"], "id": c["id"], "title": c["title"], "digest": day.isoformat()})
    horizon = as_of - timedelta(days=120)
    coverage = {k: [c for c in v if parse_ts(c["at"]) >= horizon] for k, v in coverage.items()}
    coverage = {k: v for k, v in coverage.items() if v}

    save_json(path, digest)
    save_json(STATE / "coverage.json", coverage)
    index = sorted({(d.stem, (load_json(d) or {}).get("type", "")) for d in DIGESTS.glob("20*.json")})
    save_json(DIGESTS / "index.json", [{"date": d, "type": t} for d, t in index])
    print(f"Built {path.name} ({digest['type']}{'/' + digest['circle'] if digest.get('circle') else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
