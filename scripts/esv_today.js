#!/usr/bin/env node
/* Fetch today's ESV text in the hourly GitHub job, so the ESV API key stays a secret.

   Writes esv/today.json (published with the site, never committed; see .gitignore) holding only
   today's reading and focus verse, replaced each run. It reuses the browser's own logic
   (assets/grounding.js for what today's passages are, assets/esv.js for the guideline checks
   and the request format), so the page and this job always agree.

   Also writes data/state/esv_day.txt (just the date, no scripture) so the job redeploys the
   site when the day changes.

   Runs every hour with the rest of the job, but asks the ESV API only once a day: each run
   republishes the whole site, so it first copies today's file from the live site (SITE_URL)
   and only fetches from ESV when that copy is missing or from an earlier day.

   Env: ESV_API_KEY (required; without it nothing is written), SITE_URL (the live site, to reuse
   today's file), ESV_API (optional, for tests).
   No ESV text is ever sent to an AI service from here. */
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
global.window = {};
require(path.join(root, "assets/grounding.js"));
require(path.join(root, "assets/esv.js"));
const { Grounding, Esv } = global.window;

async function main() {
  const key = process.env.ESV_API_KEY;
  if (!key) {
    console.log("No ESV_API_KEY secret; skipping the ESV text.");
    return;
  }
  const grounding = JSON.parse(fs.readFileSync(path.join(root, "data/grounding.json"), "utf8"));
  const profile = JSON.parse(fs.readFileSync(path.join(root, "config/profile.json"), "utf8"));

  // Today in the reader's time zone, as a local date like the browser uses.
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const reading = Grounding.narrative(grounding, date).chapters;
  const focus = Grounding.focus(grounding, date).verse;
  const refs = [];
  if (Esv.allowed(reading)) refs.push(...reading);
  else console.log(`Today's reading (${reading.join("; ")}) is over the ESV per-page limit; the page links out.`);
  if (focus && Esv.allowed([focus]) && !refs.includes(focus)) refs.push(focus);

  const outDir = path.join(root, "esv");
  const outFile = path.join(outDir, "today.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(root, "data/state/esv_day.txt"), ymd + "\n");

  // Already published today? Carry it into this deploy without asking ESV again.
  if (process.env.SITE_URL) {
    try {
      const res = await fetch(new URL("esv/today.json", process.env.SITE_URL), { cache: "no-store" });
      const live = res.ok ? await res.json() : null;
      if (live && live.date === ymd && refs.every((r) => live.passages?.[r])) {
        fs.writeFileSync(outFile, JSON.stringify(live) + "\n");
        console.log(`ESV text for ${ymd} already published; reused it.`);
        return;
      }
    } catch (_) { /* not published yet, or the site is unreachable: fetch below */ }
  }

  const api = process.env.ESV_API || Esv.API;
  const passages = {};
  for (const ref of refs) {
    const res = await fetch(`${api}?${Esv.params(ref)}`, { headers: { Authorization: `Token ${key}` } });
    if (!res.ok) throw new Error(`ESV API ${res.status} for ${ref}`);
    passages[ref] = (await res.json()).passages.join("\n\n").trim();
  }

  fs.writeFileSync(outFile, JSON.stringify({ date: ymd, passages }) + "\n");
  console.log(`ESV text for ${ymd}: ${Object.keys(passages).join("; ") || "(none)"}`);
}

main().catch((err) => {
  // Never fail the digest over scripture text; the page falls back to a BibleGateway link.
  console.error(`ESV fetch failed: ${err.message}`);
  try { fs.rmSync(path.join(root, "esv/today.json")); } catch (_) { /* nothing to remove */ }
});
