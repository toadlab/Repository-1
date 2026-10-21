# Daily Bread & Briefing

A personal news filter and digest for Joe. It is grounded in scripture and prayer, filtered by durability, geographic proximity and professional relevance (financial planning), and open about its own editorial choices.

The design goals and philosophy are in **[docs/project-goals.md](docs/project-goals.md)**. This README covers how the code implements them.

## What you see

**Today.** Every day opens with grounding, before any news:

- **Liturgical season.** Advent, Christmas, Epiphany, Lent, Holy Week, Easter, Pentecost and Ordinary Time are computed from the calendar, including Easter.
- **Thematic constants.** Through Ordinary Time the focus rotates in three-week blocks: the Beatitudes, the Fruit of the Spirit, the Lord's Prayer and the Ten Commandments. Each day holds one line and a question.
- **Prayer of the week.** One dense, classic prayer, repeated every day for a week. These are the 11 from the goals doc.
- **Today's reading (narrative track).** Less-visited books in salvation-history order, one unit per month (Job, Leviticus, Proverbs, the minor prophets, Mark, the Pastoral Epistles, and so on). Choose ESV, NIV or NASB in Settings. In the ESV (the default), today's reading and focus verse appear in full. The ESV API key stays secret: the hourly job (`scripts/esv_today.js`, secret `ESV_API_KEY`) fetches only today's passages, once a day, and publishes them as `esv/today.json`, which is replaced daily and never committed. Later runs that day copy the published file forward instead of asking ESV again. Past days link to BibleGateway, unless you enter a personal ESV key in Settings (kept only in that browser), which shows any day. NIV and NASB open on BibleGateway, because those publishers offer no free way to show their text here. **No AI touches the ESV:** at Crossway's request, the reading has no chat, and nothing sent to Claude contains ESV text (chat about the day's focus line uses the built-in KJV). ESV use follows the [ESV API guidelines](https://api.esv.org/#conditions) (see `assets/esv.js`): each quotation keeps its "(ESV)" mark, the full notice is on `copyright.html`, no page or request goes over 500 verses or half a book (the one day a year that would, Haggai 2, links out instead), text is never saved to disk, and requests stay under the rate limits.

After the grounding, the day's content follows a weekly rhythm (`config/profile.json` → `cadence`):

| Day | Type | Content |
|---|---|---|
| Mon | Daily pulse + **local** day | 0-3 items (inner-circle local news or domain-critical, at most 1 finance, 1 slot held for good in the world), then local stories from the week |
| Tue, Thu | **Reflection** | No news. A prompt, one story about something that is working, and "which of these would you like to pray about today?" |
| Wed | Daily pulse + **state** day | Indiana and Indianapolis-region stories |
| Fri | Daily pulse + **global** day | The region of the month: what is persistently or quietly true there, what changed since the last visit, and one suggestion |
| Sat | **Weekly digest** | 8-12 durable stories with "why it matters to you," deep dives on the top two, and on the first weekend of the month a pick from your flagged stories |
| Sun | Reflection, **hyperlocal** | Family and friends. Nothing comes from a feed here; you bring it |

A genuine **emergency** overrides the rhythm on any day. Every digest ends with a closing thought, a journal box, and a **"How this was filtered"** footer. The footer shows counts excluded and why, the borderline calls, and the full list of excluded headlines on request.

**Weekly digest.** The Saturday digests. Tap a story to see the source link, an AI summary, context, sometimes a "who you might talk to" nudge, and one-tap actions: *Different perspectives*, *Dig deeper*, *Who could I talk to?*, *Ask…*.

**Flagged.** Tap ⚑ on any story to save it as worth digging into later. On the first weekend of the month, those stories come back as a short list; pick one to explore in depth.

**Chat.** A chat box sits beside every prayer, story and region note (not the Bible reading), and it already knows what you are looking at. It is never pre-filled with commentary. It uses your own Claude API key, entered in Settings and stored only in your browser.

## How the pipeline works

```
fetch_news.py  → data/news.json            raw feed history (~45 days), each feed tagged with a circle hint
score.py       → data/state/scores.json    Claude rates durability, circle, domain, flourishing, emergency, story_key
build_digest.py→ data/digests/DATE.json    today's pulse / reflection / weekly digest + methodology
  review.py    → data/state/reviews.json   stage 2: full-article verdicts and summaries, cached by URL
                 data/state/review_cuts.jsonl  every cut, with its reason
                 data/state/coverage.json  what has been covered, for story fatigue
                 data/state/regions/*.json running log per region
```

- **Scoring rubric:** `config/rubric.md`. These are explicit, testable criteria that Claude applies to each story.
- **Composite and bars:** computed in Python from `config/profile.json`, so the editorial math is visible and tunable: `durability + 0.35·domain + 0.25·flourishing`, compared against a bar that rises with distance (local 4, state 6, national 8, international 9). Stories within 1 point of the bar are *borderline*.
- **Story fatigue:** a story key already covered is skipped unless Claude marks the item as a genuine new development.
- **Silence as signal:** stories covered on 3 or more separate days get a small persistence bonus. A borderline story that recurs on 3 or more days is promoted into the weekly digest.
- **Stage 2, the article review** (`scripts/review.py`, rubric in `config/article_review.md`). Each article that survives the headline filter is fetched and read in full: the main text is extracted, readability-style, and truncated to about 7,000 tokens. Claude then returns `{decision: keep|cut, reason, summary}`. Articles are reviewed in rank order until each section has enough keepers, so a cut is replaced by the next candidate. An article is cut if it is (a) an introductory explainer on one of your expert topics without a trusted author or new rules or data, (b) limited to jurisdictions that exclude your state, (c) impossible to summarize with concrete specifics, (d) clickbait, (e) a finance story without new rules, rulings, data or recognized analysis, or (f) feel-good fluff in the good-in-the-world category. Kept articles get a summary written from the full text (what it is, who and where it applies, the numbers and dates, what's new, caveats); the publisher's blurb is never shown. If the text can't be fetched, the story appears as **"headline only, unverified"**. Every cut is logged to `data/state/review_cuts.jsonl` and listed, with its reason, in the digest's "How this was filtered" section.
  - Edit your expert topics and trusted authorities in `config/profile.json` → `review`. Your state comes from `home.state`.
  - Full article text is cached by URL outside the repo (in CI, via `actions/cache`), because the site is public and the text belongs to its publishers. Only verdicts and our own summaries are committed.
  - To test the review on particular articles: Actions → **Review articles (test)** → Run workflow, or `python3 scripts/review_articles.py --search "headline words"` locally.
  - Some sites block automated reading (for example SEC.gov and MarketWatch), so their stories show as unverified.
- **Topic mix** (`config/profile.json` → `categories` and `quotas`). Each story gets one category from its scores: **finance** (domain relevance 6+), **good in the world** (from a feed tagged `"category": "good_in_world"`, or flourishing 7+), or **other**. A daily pulse holds 0-3 items, with at most 1 finance story a day across the pulse and spotlight. One slot is reserved for a good-in-the-world story, filled only if one passes the review; otherwise the slot goes to other news. Finance stories over the limit are skipped before review, so they cost nothing. The Saturday digest has its own limits (`weekly_max`, `weekly_reserved`). The review applies stricter bars by category: finance needs new rules, rulings, data, or analysis from a recognized authority (rule e); good in the world needs concrete actors and real evidence of impact (rule f). Each day's category counts go to `data/state/category_mix.csv`, which GitHub shows as a table.
- Without an API key, a keyword heuristic stands in for scoring so the pipeline still runs, and stories show as "headline only, not reviewed". Scores are redone by Claude once a key is added.

The GitHub Actions workflow runs hourly. The digest is built once the local time passes `digest_hour` (5 am), emergencies are checked every run, the updated `data/` is committed back, and the site is deployed to GitHub Pages.

## Setup

1. **Pages:** in Settings → Pages, set Source to **GitHub Actions**.
2. **Keys:** in Settings → Secrets and variables → Actions, add `ANTHROPIC_API_KEY` (Claude) and `ESV_API_KEY` (from [api.esv.org](https://api.esv.org/account/create-application/)).
3. **Answer the open questions** in `config/profile.json` (fields marked `OPEN`: your town and county). Add local feeds (the town paper, county government agendas) to `config/feeds.json` with `"circle": "local"`. Until then the daily pulse can only surface domain-critical stories.
4. Optionally adjust the `cadence` (which day maps to which circle), the `regions` rotation, and the scoring bars.

**Model and cost:** the pipeline uses `claude-opus-5` (set in `config/profile.json` → `claude.model`), with server-side refusal fallbacks enabled. At roughly 400 new headlines a day, a rough estimate is **$1-2 a day**. Scoring takes most of that; the weekly deep dives and monthly region research add a little. The article review adds about 5-10 cents per article read, roughly 5-20 articles a day, and each article is only reviewed once. Switching `model` to `claude-sonnet-5` would cut that substantially, at some cost in judgment.

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
- The built-in lines (seasonal verses, Beatitudes, commandments) are stored in the public-domain KJV. Whole-verse lines switch to the ESV when a key is set; partial-verse lines, like the Fruit of the Spirit list, stay in the KJV.
