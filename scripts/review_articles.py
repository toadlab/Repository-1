#!/usr/bin/env python3
"""Run the stage-2 article review on specific articles and print the verdicts.

Usage:
    python3 scripts/review_articles.py URL [URL ...]
    python3 scripts/review_articles.py --search "RMD" --search "estate planning documents"

--search matches headlines in data/news.json. Verdicts are not cached by this
command, so it always re-reviews (article text is still cached by URL).
"""

from __future__ import annotations

import argparse
import json
import sys

import llm
import review
from common import NEWS, load_json, profile


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--search", action="append", default=[], help="headline words to look up in data/news.json")
    ap.add_argument("--json", metavar="FILE", help="also write the verdicts to this JSON file")
    args = ap.parse_args()

    p = profile()
    items = {i["link"]: i for i in load_json(NEWS, {"items": []})["items"]}
    targets = [items.get(u, {"title": u, "link": u, "source": "unknown"}) for u in args.urls]
    for query in args.search:
        words = query.lower().split()
        found = [i for i in items.values() if all(w in i["title"].lower() for w in words)]
        if not found:
            print(f"No headline matches {query!r}", file=sys.stderr)
        targets += found[:1]
    if not targets:
        ap.error("give URLs or --search terms")

    if not llm.available():
        print("Note: no ANTHROPIC_API_KEY, so only the fetch step runs.\n", file=sys.stderr)
    results = []
    for item in targets:
        article = review.fetch_article(item["link"], p["review"]["max_article_tokens"])
        fetched = (f"{article['words']} words, author: {article['author'] or 'not listed'}"
                   f"{', truncated' if article['truncated'] else ''}" if article else "could not fetch usable text")
        verdict = review.review_article(p, item, {}) if llm.available() else None
        results.append({"title": item["title"], "url": item["link"], "fetched": fetched, "verdict": verdict})
        print(f"\n■ {item['title']}\n  {item['link']}\n  Fetched: {fetched}")
        if verdict:
            print(f"  Decision: {verdict['decision'].upper()}"
                  f"{'  (' + review.UNVERIFIED + ')' if verdict['status'] == 'unverified' else ''}")
            print(f"  Reason: {verdict['reason']}")
            if verdict["summary"]:
                print(f"  Summary: {verdict['summary']}")
    if args.json:
        with open(args.json, "w") as f:
            json.dump(results, f, indent=1, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
