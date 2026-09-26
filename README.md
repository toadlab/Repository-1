# Daily Bread & Briefing

A personal news filter and digest for Joe. It is grounded in scripture and prayer, filtered by durability, geographic proximity and professional relevance (financial planning), and open about its own editorial choices.

The design goals and philosophy are in **[docs/project-goals.md](docs/project-goals.md)**. This README covers how the code implements them.

## What you see

**Today.** Every day opens with grounding, before any news:

- **Liturgical season.** Advent, Christmas, Epiphany, Lent, Holy Week, Easter, Pentecost and Ordinary Time are computed from the calendar, including Easter.
- **Thematic constants.** Through Ordinary Time the focus rotates in three-week blocks: the Beatitudes, the Fruit of the Spirit, the Lord's Prayer and the Ten Commandments. Each day holds one line and a question.
- **Prayer of the week.** One dense, classic prayer, repeated every day for a week. These are the 11 from the goals doc.
- **Reading trial.** A four-week trial of daily lectionaries, one per week: Catholic, Eastern Orthodox, Coptic Orthodox, then Bible in a Year. Each week has a notes box. At the end, you pick the one you found most nourishing.
- **Narrative track.** Less-visited books in salvation-history order, one unit per month (Job, Leviticus, Proverbs, the minor prophets, the Pastoral Epistles, and so on). The full KJV text is shown inline.

After the grounding, the day's content follows a weekly rhythm (`config/profile.json` → `cadence`):

| Day | Type | Content |
|---|---|---|
| Mon | Daily pulse + **local** day | 0-3 items (inner-circle local news, or domain-critical), then local stories from the week |
| Tue, Thu | **Reflection** | No news. A prompt, one story about something that is working, and "which of these would you like to pray about today?" |
| Wed | Daily pulse + **state** day | Indiana and Indianapolis-region stories |
| Fri | Daily pulse + **global** day | The region of the month: what is persistently or quietly true there, what changed since the last visit, and one suggestion |
| Sat | **Weekly digest** | 8-12 durable stories with "why it matters to you," deep dives on the top two, and on the first weekend of the month a pick from your flagged stories |
| Sun | Reflection, **hyperlocal** | Family and friends. Nothing comes from a feed here; you bring it |

A genuine **emergency** overrides the rhythm on any day. Every digest ends with a closing thought, a journal box, and a **"How this was filtered"** footer. The footer shows counts excluded and why, the borderline calls, and the full list of excluded headlines on request.

**Weekly digest.** The Saturday digests. Tap a story to see the source link, an AI summary, context, sometimes a "who you might talk to" nudge, and one-tap actions: *Different perspectives*, *Dig deeper*, *Who could I talk to?*, *Ask…*.

**Flagged.** Tap ⚑ on any story to save it as worth digging into later. On the first weekend of the month, those stories come back as a short list; pick one to explore in depth.

**Chat.** A chat box sits beside every prayer, reading, story and region note, and it already knows what you are looking at. It is never pre-filled with commentary. It uses your own Claude API key, entered in Settings and stored only in your browser.

## How the pipeline works

```
fetch_news.py  → data/news.json            raw feed history (~45 days), each feed tagged with a circle hint
score.py       → data/state/scores.json    Claude rates durability, circle, domain, flourishing, emergency, story_key
build_digest.py→ data/digests/DATE.json    today's pulse / reflection / weekly digest + methodology
                 data/state/coverage.json  what has been covered, for story fatigue
                 data/state/regions/*.json running log per region
```

- **Scoring rubric:** `config/rubric.md`. These are explicit, testable criteria that Claude applies to each story.
- **Composite and bars:** computed in Python from `config/profile.json`, so the editorial math is visible and tunable: `durability + 0.35·domain + 0.25·flourishing`, compared against a bar that rises with distance (local 4, state 6, national 8, international 9). Stories within 1 point of the bar are *borderline*.
- **Story fatigue:** a story key already covered is skipped unless Claude marks the item as a genuine new development.
- **Silence as signal:** stories covered on 3 or more separate days get a small persistence bonus. A borderline story that recurs on 3 or more days is promoted into the weekly digest.
- Without an API key, a keyword heuristic stands in so the pipeline still runs. Those scores are redone by Claude once a key is added.

The GitHub Actions workflow runs hourly. The digest is built once the local time passes `digest_hour` (5 am), emergencies are checked every run, the updated `data/` is committed back, and the site is deployed to GitHub Pages.

## Setup

1. **Pages:** in Settings → Pages, set Source to **GitHub Actions**.
2. **Claude key:** in Settings → Secrets and variables → Actions, add `ANTHROPIC_API_KEY`.
3. **Answer the open questions** in `config/profile.json` (fields marked `OPEN`: your town and county). Add local feeds (the town paper, county government agendas) to `config/feeds.json` with `"circle": "local"`. Until then the daily pulse can only surface domain-critical stories.
4. Optionally adjust the `cadence` (which day maps to which circle), the `regions` rotation, and the scoring bars.

**Model and cost:** the pipeline uses `claude-opus-5` (set in `config/profile.json` → `claude.model`), with server-side refusal fallbacks enabled. At roughly 400 new headlines a day, a rough estimate is **$1-2 a day**. Scoring takes most of that; the weekly deep dives and monthly region research add a little. Switching `model` to `claude-sonnet-5` would cut that substantially, at some cost in judgment.

## Run locally

```sh
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...          # optional; falls back to keyword scoring
python3 scripts/fetch_news.py
python3 scripts/score.py
python3 scripts/build_digest.py --force   # or --date YYYY-MM-DD
python3 -m http.server 8000           # open http://localhost:8000
```

## Not built yet

These are from the goals doc's later phases and open questions:

- A retrospective that checks whether filtered-out stories turned out to matter, then tunes the rubric.
- A year-in-review tab with star and remove overrides.
- Manual override to mark a story important even when it fails the durability test. Flags cover "dig into later" only.
- Delivery as a message or doc. For now the digest is the web page.
- Lectionary readings open on their publishers' sites rather than inline, because the texts are copyrighted. The narrative track shows the full KJV text inline.
