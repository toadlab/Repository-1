#!/usr/bin/env python3
"""Score new stories in data/news.json against config/rubric.md.

Claude rates each story on durability, geographic circle, domain relevance and
flourishing; the composite score and include/borderline/exclude decision are
computed here, deterministically, from config/profile.json so the editorial
math stays visible and tunable. Without an API key a keyword heuristic stands
in, and those scores are redone by Claude once a key is configured.
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from datetime import timedelta

import llm
from common import NEWS, STATE, load_json, now_utc, parse_ts, profile, rubric, save_json

CIRCLES = ["hyperlocal", "local", "state", "national", "international"]
SCORE_WINDOW_DAYS = 8  # only recent stories can appear in a digest

SCHEMA = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "story_key": {"type": "string"},
                    "durability": {"type": "integer"},
                    "circle": {"type": "string", "enum": CIRCLES},
                    "domain": {"type": "integer"},
                    "flourishing": {"type": "integer"},
                    "emergency": {"type": "boolean"},
                    "new_development": {"type": "boolean"},
                    "reason": {"type": "string"},
                },
                "required": ["id", "story_key", "durability", "circle", "domain", "flourishing",
                             "emergency", "new_development", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scores"],
    "additionalProperties": False,
}


# ---------- heuristic fallback ----------
LOW = re.compile(r"\b(police|arrest|arrested|shooting|shot|killed|murder|charged|crash|celebrity|actor|singer|"
                 r"dies|died|obituary|game|score|playoff|quarterback|coach|recipe|horoscope|watch:|quiz)\b", re.I)
HIGH = re.compile(r"\b(law|bill|rule|rules|ruling|court|supreme|election|legislation|regulation|budget|war|"
                  r"ceasefire|treaty|tariff|rate cut|rate hike|signed|passes|passed|final rule|famine)\b", re.I)
DOMAIN = re.compile(r"(social security|401\(?k\)?|\bira\b|\btax|\birs\b|retire|medicare|federal reserve|\bfed\b|"
                    r"interest rate|inflation|mortgage|\bsec\b|finra|fiduciary|annuit|stock|market|bond|"
                    r"treasury|estate plan|cola|rmd|pension)", re.I)
ROUTINE = re.compile(r"^(S\.|H\.R\.) ?\d+|\b(charges|alleges|censures|settles|sentenced)\b|\?$", re.I)
STOP = {"the", "a", "an", "of", "to", "in", "on", "for", "and", "is", "as", "at", "by", "with", "from", "after",
        "new", "how", "why", "what", "says", "its", "it", "be", "are", "was", "will", "this", "that"}


def heuristic(item: dict, home: dict) -> dict:
    text = f"{item['title']} {item.get('summary', '')}"
    if LOW.search(item["title"]) or ROUTINE.search(item["title"]):
        durability = 2
    else:
        durability = 7 if HIGH.search(text) else 4
    hits = len(DOMAIN.findall(text))
    domain = min(10, (6 if item.get("domain_feed") else 0) + 3 * min(hits, 2))
    flourishing = 7 if item.get("flourishing_feed") else 0
    circle = item.get("circle_hint", "national")
    if circle in ("national", "international") and re.search(rf"\b({home['state']}|{home['metro']})\b", text, re.I):
        circle = "state"
    words = [w for w in re.findall(r"[a-z0-9]+", item["title"].lower()) if w not in STOP][:5]
    return {
        "story_key": "-".join(words) or item["id"], "durability": durability, "circle": circle,
        "domain": domain, "flourishing": flourishing, "emergency": False, "new_development": True,
        "reason": "Keyword estimate (no Claude API key configured).",
    }


# ---------- composite ----------
def composite(s: dict, cfg: dict, persistent: bool) -> dict:
    w = cfg["weights"]
    value = s["durability"] + s["domain"] * w["domain"] + s["flourishing"] * w["flourishing"]
    if persistent:
        value += cfg["persistence_bonus"]
    bar = cfg["circle_bar"][s["circle"]]
    if value >= bar:
        decision = "include"
    elif value >= bar - cfg["borderline_margin"]:
        decision = "borderline"
    else:
        decision = "exclude"
    if decision == "include":
        why = None
    elif s["durability"] <= 3:
        why = "low durability"
    elif s["circle"] in ("national", "international"):
        why = f"did not clear the {s['circle']} bar"
    else:
        why = "below the inclusion bar"
    return {"composite": round(value, 2), "bar": bar, "decision": decision, "exclusion": why,
            "persistent": persistent}


def clamp(v) -> int:
    return max(0, min(10, int(v)))


def main() -> int:
    p = profile()
    cfg = p["scoring"]
    news = load_json(NEWS, {"items": []})
    scores: dict = load_json(STATE / "scores.json", {})
    coverage: dict = load_json(STATE / "coverage.json", {})
    use_claude = llm.available()
    now = now_utc()
    cutoff = now - timedelta(days=SCORE_WINDOW_DAYS)

    recent = [i for i in news["items"] if parse_ts(i["published"]) >= cutoff]
    todo = [i for i in recent
            if i["id"] not in scores or (use_claude and scores[i["id"]].get("scored_by") == "heuristic")]
    print(f"{len(todo)} stories to score ({'Claude' if use_claude else 'heuristic'})")

    raw: dict[str, dict] = {}
    if use_claude and todo:
        system = rubric(p)
        recent_keys = sorted(
            ((k, v[-1]) for k, v in coverage.items() if v and parse_ts(v[-1]["at"]) >= now - timedelta(days=30)),
            key=lambda kv: kv[1]["at"], reverse=True)[:80]
        known = "\n".join(f"- {k}: last covered {v['at'][:10]}: {v['title']}" for k, v in recent_keys) or "(none yet)"
        size = p["claude"]["batch_size"]
        for start in range(0, len(todo), size):
            batch = todo[start:start + size]
            lines = "\n".join(
                f"[{i['id']}] {i['title']} | {i['source']} (feed circle: {i['circle_hint']}) | {i.get('summary', '')}"
                for i in batch)
            prompt = (f"Recently covered stories (reuse these story_keys when an item is the same story):\n{known}\n\n"
                      f"Score every one of these {len(batch)} stories. Return one entry per id.\n\n{lines}")
            result = llm.ask_json(model=p["claude"]["model"], system=system, prompt=prompt, schema=SCHEMA,
                                  effort=p["claude"].get("scoring_effort"))
            for s in (result or {}).get("scores", []):
                raw[s["id"]] = s
            print(f"  batch {start // size + 1}: {len((result or {}).get('scores', []))}/{len(batch)} scored")

    for item in todo:
        s = raw.get(item["id"])
        if s:
            s = {**s, "durability": clamp(s["durability"]), "domain": clamp(s["domain"]),
                 "flourishing": clamp(s["flourishing"]), "scored_by": "claude"}
            s.pop("id", None)
        elif item["id"] in scores:
            continue  # keep the previous score rather than downgrading it
        else:
            s = {**heuristic(item, p["home"]), "scored_by": "heuristic"}
        scores[item["id"]] = s

    # Silence as signal: a story covered on several distinct days kept mattering.
    days_by_key = defaultdict(set)
    for item in news["items"]:
        s = scores.get(item["id"])
        if s:
            days_by_key[s["story_key"]].add(item["published"][:10])
    for item in news["items"]:
        s = scores.get(item["id"])
        if s:
            persistent = len(days_by_key[s["story_key"]]) >= cfg["persistence_days"]
            s.update(composite(s, cfg, persistent))

    live_ids = {i["id"] for i in news["items"]}
    scores = {k: v for k, v in scores.items() if k in live_ids}
    save_json(STATE / "scores.json", scores)
    counts = defaultdict(int)
    for s in scores.values():
        counts[s["decision"]] += 1
    print(f"Scores saved: {dict(counts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
