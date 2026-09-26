# Daily Bread & Briefing

A lightweight web app that pairs **daily, weekly and monthly news briefings** with **devotions** and a **one-year Bible reading plan**.
It needs no build step and no API keys, and runs entirely on GitHub Pages.

| View | Devotion | Reading plan | News |
|---|---|---|---|
| **Daily** | Verse of the day (KJV), reflection, prayer | Today's portion with a checkbox | Past 24 hours by category |
| **Weekly** | Weekly theme, passage, practice, reflection questions | The week's 7 readings | Past 7 days plus trending topics |
| **Monthly** | Monthly theme, memory verse, review questions | The month's readings plus progress | Past 30 days plus trending topics |

Each view also has a journal box: daily notes, a weekly reflection, and a monthly review.
Reading progress (%, streak and days to catch up) and notes are saved in your browser (`localStorage`).
Use the ‹ › buttons or the arrow keys to move between days, weeks or months.

## How it works

- `scripts/fetch_news.py` reads the feeds in `config/feeds.json` and writes `data/news.json`, keeping a rolling ~35-day archive. It uses only the Python standard library.
- `.github/workflows/deploy.yml` runs the fetcher every 3 hours and deploys the site to GitHub Pages. It carries the archive forward from the live site so the weekly and monthly views stay full.
- `data/devotions.json` holds 31 daily devotions, 13 rotating weekly themes and 12 monthly themes. Edit them freely.
- `assets/bible.js` spreads all 1,189 chapters evenly across 365 days. The plan starts on your first visit; change the start date in Settings (⚙).

## Customize

- **News sources:** edit `config/feeds.json`. Any RSS or Atom feed works, and the `category` value becomes the section heading.
- **Bible version for links:** choose it in Settings. Passage links open on BibleGateway.
- **Devotional content:** edit `data/devotions.json`.

## Run locally

```sh
python3 scripts/fetch_news.py      # refresh headlines
python3 -m http.server 8000        # then open http://localhost:8000
```

Serve the folder over HTTP rather than opening `index.html` directly, because browsers block `fetch` on `file://` pages.

## Deploy to GitHub Pages

1. Merge to `main`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The workflow deploys on every push to `main` and refreshes the news every 3 hours. You can also run it manually from the Actions tab.
