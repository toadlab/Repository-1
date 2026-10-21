/* ESV text via the ESV API v3, within Crossway's guidelines (https://api.esv.org/#conditions):
   - Each quotation keeps the "(ESV)" mark the API sends; the full notice is on copyright.html.
   - No query or page exceeds 500 verses or half of a book (single-chapter books excepted),
     checked before requesting; a 500-verse trim after arrival is a backup.
   - Text is never written to disk: fetches bypass the HTTP cache, and the in-memory copy
     holds only the passages on screen for the current day.
   - Requests are capped below the 60/minute, 1,000/hour and 5,000/day limits.
   - Use is personal and non-commercial. The site's key is never sent to browsers: the hourly
     GitHub job (scripts/esv_today.js) fetches today's passages with it and publishes them as
     esv/today.json, replaced daily and never committed. A reader's own key, entered in Settings,
     is used directly from that browser and works for any day.
   - ESV text is never sent to AI: Crossway has asked that the ESV not be used with AI, so the
     reading has no chat, and chat contexts only ever carry the built-in KJV lines. */
(function () {
  "use strict";

  const API = "https://api.esv.org/v3/passage/text/";
  const TODAY_FILE = "esv/today.json";
  const MAX_VERSES = 500;
  const LIMITS = [[60_000, 50], [3_600_000, 900], [86_400_000, 4_500]]; // [window ms, max requests], under the API's caps

  // Verse counts per chapter for every book of five or fewer chapters, where one or two
  // chapters can reach half the book. Longer books can't, at a few chapters a day.
  const SHORT_BOOKS = {
    "Ruth": [22, 23, 18, 22], "Lamentations": [22, 22, 66, 22, 22], "Joel": [20, 32, 21],
    "Obadiah": [21], "Jonah": [17, 10, 10, 11], "Nahum": [15, 13, 19], "Habakkuk": [17, 20, 19],
    "Zephaniah": [18, 15, 20], "Haggai": [15, 23], "Malachi": [14, 17, 18, 6],
    "Philippians": [30, 30, 21, 23], "Colossians": [29, 23, 25, 18], "1 Thessalonians": [10, 20, 13, 18, 28],
    "2 Thessalonians": [12, 17, 18], "2 Timothy": [18, 26, 17, 22], "Titus": [16, 15, 15], "Philemon": [25],
    "James": [27, 26, 18, 17, 20], "1 Peter": [25, 25, 22, 19, 14], "2 Peter": [21, 22, 18],
    "1 John": [10, 29, 24, 21, 21], "2 John": [13], "3 John": [15], "Jude": [25],
  };

  const parse = (ref) => {
    const m = /^(.+?) (\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(ref.trim());
    return m && { book: m[1], chapter: +m[2], from: m[3] ? +m[3] : null, to: m[4] ? +m[4] : m[3] ? +m[3] : null };
  };

  /** Can this page show these references (e.g. ["Haggai 1", "Haggai 2"]) from the ESV? */
  function allowed(refs) {
    const perBook = {};
    for (const ref of refs) {
      const r = parse(ref);
      if (!r) return false;
      const short = SHORT_BOOKS[r.book];
      let verses;
      if (r.from != null) verses = r.to - r.from + 1;
      else if (short) verses = short[r.chapter - 1] ?? Infinity;
      else verses = 176; // longest chapter in the Bible; only matters against the 500 cap
      perBook[r.book] = (perBook[r.book] || 0) + verses;
    }
    let total = 0;
    for (const [book, verses] of Object.entries(perBook)) {
      total += verses;
      const short = SHORT_BOOKS[book];
      if (short && short.length > 1 && verses > short.reduce((a, b) => a + b, 0) / 2) return false;
    }
    return total <= MAX_VERSES;
  }

  const sent = [];
  function underRateLimit() {
    const now = Date.now();
    while (sent.length && now - sent[0] > 86_400_000) sent.shift();
    return LIMITS.every(([ms, max]) => sent.filter((t) => now - t < ms).length < max);
  }

  /** Query for one passage, shared with scripts/esv_today.js so both ask for the same thing. */
  function params(ref) {
    return new URLSearchParams({
      q: ref, "include-passage-references": "false", "include-footnotes": "false",
      "include-headings": "false", "include-short-copyright": "true", "include-copyright": "false",
      "indent-paragraphs": "0", "indent-poetry": "false",
    });
  }

  let todayFile = null;
  /** Today's text as published by the hourly job. Rejects with "not-today" for any other date. */
  function fromSite(ref, date) {
    if (!todayFile) {
      todayFile = fetch(TODAY_FILE, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null)).catch(() => null);
    }
    return todayFile.then((f) => {
      if (!f) throw new Error("unavailable");
      if (f.date !== date) throw new Error("not-today");
      const text = f.passages?.[ref];
      if (!text) throw new Error("unavailable");
      return text;
    });
  }

  let day = null;
  const memory = new Map(); // only the current day's passages

  /** Fetch one reference's text, with the "(ESV)" mark the API appends. */
  function passage(ref, key, today) {
    if (today !== day) { memory.clear(); day = today; }
    if (memory.has(ref)) return memory.get(ref);
    if (!underRateLimit()) return Promise.reject(new Error("rate"));
    sent.push(Date.now());
    const p = fetch(`${API}?${params(ref)}`, { headers: { Authorization: `Token ${key}` }, cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((d) => d.passages.join("\n\n").trim())
      .catch((e) => { memory.delete(ref); throw e; });
    memory.set(ref, p);
    return p;
  }

  /** Backup limit: trim [[ref, text], ...] so the page never shows more than 500 verses. */
  function cap(parts) {
    let shown = 0, trimmed = false;
    const out = [];
    for (const [ref, text] of parts) {
      if (shown >= MAX_VERSES) { trimmed = true; break; }
      const pieces = text.split(/(?=\[\d+\])/);
      const verses = pieces.filter((x) => /^\[\d+\]/.test(x)).length;
      if (shown + verses <= MAX_VERSES) { out.push([ref, text]); shown += verses; continue; }
      let keep = MAX_VERSES - shown, kept = "";
      for (const piece of pieces) {
        if (/^\[\d+\]/.test(piece) && keep-- <= 0) break;
        kept += piece;
      }
      out.push([ref, kept.trim() + " (ESV)"]);
      shown = MAX_VERSES;
      trimmed = true;
    }
    return { parts: out, trimmed };
  }

  window.Esv = { allowed, passage, fromSite, params, cap, API, MAX_VERSES };
})();
