/* Daily Bread & Briefing: daily / weekly / monthly news and devotion views. */
(function () {
  "use strict";

  const PERIODS = ["day", "week", "month"];
  const NEWS_LIMIT = { day: 6, week: 8, month: 10 };
  const ROLLING_DAYS = { day: 1, week: 7, month: 30 };
  const STORE_KEY = "dbb.v1";
  const MS_DAY = 86400000;

  // ---------- storage (per-browser; must never break rendering) ----------
  function loadStore() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { /* unavailable */ }
    return {
      planStart: s.planStart || null, // set to the first visit below
      version: s.version || "KJV",
      done: s.done || {},
      notes: s.notes || {},
    };
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) { /* ignore */ }
  }

  // ---------- dates (local calendar days) ----------
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const dayDiff = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                                        Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS_DAY);
  const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7)); // Monday
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / MS_DAY + 1) / 7) };
  }
  function periodRange(period, anchor) {
    if (period === "day") return [anchor, addDays(anchor, 1)];
    if (period === "week") { const s = startOfWeek(anchor); return [s, addDays(s, 7)]; }
    const s = startOfMonth(anchor);
    return [s, new Date(s.getFullYear(), s.getMonth() + 1, 1)];
  }
  const fmt = (d, opts) => d.toLocaleDateString(undefined, opts);

  // ---------- state ----------
  const store = loadStore();
  if (!store.planStart) { store.planStart = ymd(today()); saveStore(); }
  const state = {
    period: PERIODS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "day",
    anchor: today(),
    category: "All",
    topic: null,
    expanded: new Set(),
  };
  let devotions = null;
  let news = null;

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
  const passageUrl = (q) =>
    `https://www.biblegateway.com/passage/?search=${encodeURIComponent(q)}&version=${encodeURIComponent(store.version)}`;
  const passageLink = (ref, label) =>
    h("a", { href: passageUrl(ref), target: "_blank", rel: "noopener" }, label || ref);

  // ---------- header ----------
  function renderHeader() {
    const [start, end] = periodRange(state.period, state.anchor);
    const now = today();
    let title;
    if (state.period === "day") {
      const diff = dayDiff(now, state.anchor);
      title = diff === 0 ? "Today" : diff === -1 ? "Yesterday" : diff === 1 ? "Tomorrow" : null;
      title = (title ? title + " · " : "") + fmt(state.anchor, { weekday: "long", month: "long", day: "numeric" });
    } else if (state.period === "week") {
      const last = addDays(end, -1);
      title = `Week of ${fmt(start, { month: "short", day: "numeric" })} – ${fmt(last, { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      title = fmt(start, { month: "long", year: "numeric" });
    }
    $("period-title").textContent = title;
    $("today-btn").hidden = now >= start && now < end;
    document.querySelectorAll(".tabs [role=tab]").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.period === state.period)));
  }

  // ---------- devotion ----------
  function renderDevotion() {
    const box = $("devotion");
    box.replaceChildren();
    if (!devotions) { box.append(h("p", { class: "muted" }, "Loading…")); return; }

    if (state.period === "day") {
      const d = devotions.daily[(state.anchor.getDate() - 1) % devotions.daily.length];
      box.append(h("article", { class: "card devotion" },
        h("p", { class: "eyebrow" }, "Verse of the day"),
        h("h3", {}, d.title),
        h("blockquote", {}, h("p", {}, d.text), h("cite", {}, passageLink(d.ref, `${d.ref} ${devotions.translation}`))),
        h("p", {}, d.reflection),
        h("p", { class: "prayer" }, h("strong", {}, "Prayer. "), d.prayer)));
    } else if (state.period === "week") {
      const { week } = isoWeek(state.anchor);
      const w = devotions.weekly[(week - 1) % devotions.weekly.length];
      const [start] = periodRange("week", state.anchor);
      const verses = Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const d = devotions.daily[(day.getDate() - 1) % devotions.daily.length];
        return h("li", {}, h("span", { class: "muted" }, fmt(day, { weekday: "short" })), " ", passageLink(d.ref), " · ", d.title);
      });
      box.append(h("article", { class: "card devotion" },
        h("p", { class: "eyebrow" }, `Week ${week} theme`),
        h("h3", {}, w.theme),
        h("p", {}, "Read and reflect on ", passageLink(w.passage), "."),
        h("p", {}, h("strong", {}, "This week's practice. "), w.practice),
        h("p", { class: "eyebrow" }, "Reflection questions"),
        h("ul", { class: "questions" }, w.questions.map((q) => h("li", {}, q))),
        h("p", { class: "eyebrow" }, "Daily verses this week"),
        h("ul", { class: "plain-list" }, verses)));
    } else {
      const m = devotions.monthly[state.anchor.getMonth()];
      box.append(h("article", { class: "card devotion" },
        h("p", { class: "eyebrow" }, `${fmt(state.anchor, { month: "long" })} theme`),
        h("h3", {}, m.theme),
        h("p", {}, m.focus),
        h("p", {}, h("strong", {}, "Memory verse. "), passageLink(m.memoryVerse)),
        h("p", { class: "eyebrow" }, "Monthly review"),
        h("ul", { class: "questions" }, m.review.map((q) => h("li", {}, q)))));
    }
  }

  // ---------- reading plan ----------
  const planStart = () => parseYmd(store.planStart);
  const planDayOf = (date) => dayDiff(planStart(), date);

  function toggleDone(day, checked) {
    if (checked) store.done[day] = true; else delete store.done[day];
    saveStore();
    renderReading();
  }

  function readingRow(date, { compact }) {
    const day = planDayOf(date);
    const p = BiblePlan.portion(day);
    const label = compact ? fmt(date, { weekday: "short", day: "numeric" }) : null;
    if (!p) {
      return h("li", { class: "reading-row off" },
        label && h("span", { class: "reading-date" }, label),
        h("span", { class: "muted" }, day < 0 ? "Plan not started" : "Plan complete"));
    }
    const done = !!store.done[day];
    const isToday = dayDiff(today(), date) === 0;
    const id = `r-${day}`;
    return h("li", { class: `reading-row${done ? " done" : ""}${isToday ? " is-today" : ""}` },
      h("input", { type: "checkbox", id, checked: done, onchange: (e) => toggleDone(day, e.target.checked),
                   "aria-label": `Mark day ${day + 1} (${p.label}) as read` }),
      label && h("label", { for: id, class: "reading-date" }, label),
      h("span", { class: "reading-portion" }, passageLink(p.query, p.label)),
      h("span", { class: "muted small reading-day" }, `Day ${day + 1}`));
  }

  function planStats() {
    const doneDays = Object.keys(store.done).map(Number).filter((d) => d >= 0 && d < BiblePlan.PLAN_DAYS);
    const doneChapters = doneDays.reduce((n, d) => n + BiblePlan.portion(d).chapters, 0);
    const current = Math.min(planDayOf(today()), BiblePlan.PLAN_DAYS - 1);
    let behind = 0;
    for (let d = 0; d < current; d++) if (!store.done[d]) behind++;
    let streak = 0;
    for (let d = store.done[current] ? current : current - 1; d >= 0 && store.done[d]; d--) streak++;
    return { days: doneDays.length, pct: Math.round((doneChapters / BiblePlan.TOTAL_CHAPTERS) * 100), behind, streak };
  }

  function renderReading() {
    const box = $("reading");
    box.replaceChildren();
    const [start, end] = periodRange(state.period, state.anchor);
    const card = h("div", { class: "card" });

    if (state.period === "day") {
      const p = BiblePlan.portion(planDayOf(state.anchor));
      if (p) card.append(h("p", { class: "eyebrow" }, `Today's reading · ${p.chapters} chapter${p.chapters > 1 ? "s" : ""}`));
      card.append(h("ul", { class: "reading-list" }, readingRow(state.anchor, { compact: false })));
    } else {
      const rows = [];
      let periodDone = 0, periodTotal = 0;
      let beforeStart = 0;
      for (let d = start; d < end; d = addDays(d, 1)) {
        const day = planDayOf(d);
        if (day < 0) { beforeStart++; continue; }
        rows.push(readingRow(d, { compact: true }));
        if (day >= 0 && day < BiblePlan.PLAN_DAYS) { periodTotal++; if (store.done[day]) periodDone++; }
      }
      card.append(
        h("p", { class: "eyebrow" }, `${periodDone} of ${periodTotal} readings done this ${state.period}`),
        beforeStart > 0 && rows.length > 0 &&
          h("p", { class: "small muted" }, `Plan started ${fmt(planStart(), { month: "short", day: "numeric" })}.`),
        rows.length
          ? h("ul", { class: `reading-list${state.period === "month" ? " scroll" : ""}` }, rows)
          : h("p", { class: "muted" }, `Your plan starts ${fmt(planStart(), { month: "long", day: "numeric", year: "numeric" })}.`));
    }

    const s = planStats();
    card.append(h("div", { class: "plan-stats" },
      h("div", { class: "progress", role: "progressbar", "aria-valuenow": s.pct, "aria-valuemin": 0, "aria-valuemax": 100,
                 "aria-label": "Bible read" }, h("span", { style: `width:${s.pct}%` })),
      h("p", { class: "small muted" },
        `${s.pct}% of the Bible · ${s.days}/${BiblePlan.PLAN_DAYS} days`,
        s.streak ? ` · ${s.streak}-day streak` : "",
        s.behind ? ` · ${s.behind} day${s.behind > 1 ? "s" : ""} to catch up` : "")));
    box.append(card);
  }

  // ---------- notes ----------
  function notesKey() {
    if (state.period === "day") return ymd(state.anchor);
    if (state.period === "week") { const w = isoWeek(state.anchor); return `${w.year}-W${String(w.week).padStart(2, "0")}`; }
    return ymd(state.anchor).slice(0, 7);
  }
  let noteTimer;
  function renderNotes() {
    const key = notesKey();
    const label = { day: "Journal & prayer notes", week: "Weekly reflection", month: "Monthly review notes" }[state.period];
    const status = h("span", { class: "small muted" });
    const ta = h("textarea", { id: "notes-text", rows: 4, placeholder: "What is God showing you? What are you praying about?" });
    ta.value = store.notes[key] || "";
    ta.addEventListener("input", () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => {
        if (ta.value.trim()) store.notes[key] = ta.value; else delete store.notes[key];
        saveStore();
        status.textContent = "Saved";
      }, 400);
    });
    $("notes").replaceChildren(h("div", { class: "card notes" },
      h("div", { class: "notes-head" }, h("label", { for: "notes-text", class: "eyebrow" }, label), status), ta));
  }

  // ---------- news ----------
  const STOPWORDS = new Set(("a about after again against all also am an and any are as at be because been before being " +
    "between both but by can could did do does doing down during each few for from further had has have having he her " +
    "here hers him his how i if in into is it its just me more most my new no nor not now of off on once only or other " +
    "our out over own same says say said she should so some such than that the their them then there these they this " +
    "those through to too under until up us very was we were what when where which while who whom why will with would " +
    "you your year years first last week day days time amid could may might make makes made get gets how's what's " +
    "it's he's she's they're we're don't can't won't isn't people one two three four five back top big set still " +
    "news report reports video watch live latest update updates here's why's year-old white access " +
    "discover discovers scientists study finds reveals according") .split(/\s+/));

  function newsWindow() {
    const [start, end] = periodRange(state.period, state.anchor);
    const now = new Date();
    if (now >= start && now < end) {
      return { from: new Date(now - ROLLING_DAYS[state.period] * MS_DAY), to: now,
               label: { day: "Past 24 hours", week: "Past 7 days", month: "Past 30 days" }[state.period] };
    }
    return { from: start, to: end, label: null };
  }

  function topicsFor(items) {
    const counts = new Map();
    for (const it of items) {
      const words = new Set((it.title.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) || [])
        .map((w) => w.replace(/['’]s$/, "").replace(/[-'’]+$/, ""))
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)));
      for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }

  function relTime(iso) {
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d) / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}m ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
    return fmt(d, { month: "short", day: "numeric" });
  }

  function renderNews() {
    const box = $("news"), topicsBox = $("topics"), filterBox = $("category-filter");
    box.replaceChildren(); topicsBox.replaceChildren(); filterBox.replaceChildren();
    if (!news) { box.append(h("p", { class: "muted" }, "Loading headlines…")); return; }
    if (!news.items.length) {
      box.append(h("div", { class: "card empty" }, "No headlines yet. Run ", h("code", {}, "python3 scripts/fetch_news.py"), " to fetch the feeds."));
      return;
    }

    const win = newsWindow();
    $("news-updated").textContent = `${win.label ? win.label + " · " : ""}updated ${relTime(news.generated)}`;
    const inWindow = news.items.filter((it) => { const t = new Date(it.published); return t >= win.from && t < win.to; });

    const categories = news.categories || [...new Set(news.items.map((i) => i.category))];
    if (state.category !== "All" && !categories.includes(state.category)) state.category = "All";
    for (const c of ["All", ...categories]) {
      filterBox.append(h("button", { class: "chip", "aria-pressed": String(state.category === c),
        onclick: () => { state.category = c; state.expanded.clear(); renderNews(); } }, c));
    }

    const byCategory = state.category === "All" ? inWindow : inWindow.filter((i) => i.category === state.category);
    const topics = topicsFor(byCategory);
    if (state.topic && !topics.some(([w]) => w === state.topic)) state.topic = null;
    if (topics.length) {
      topicsBox.append(h("p", { class: "eyebrow" }, state.period === "day" ? "In the headlines" : "Trending this " + state.period),
        h("div", { class: "chips" }, topics.map(([w, n]) =>
          h("button", { class: "chip topic", "aria-pressed": String(state.topic === w),
            onclick: () => { state.topic = state.topic === w ? null : w; state.expanded.clear(); renderNews(); } },
            w, h("span", { class: "chip-count" }, n)))));
    }

    const filtered = state.topic ? byCategory.filter((i) => i.title.toLowerCase().includes(state.topic)) : byCategory;
    if (!filtered.length) {
      box.append(h("div", { class: "card empty" }, "No headlines in this period. The archive keeps roughly the last month."));
      return;
    }

    const groups = new Map(categories.map((c) => [c, []]));
    for (const it of filtered) (groups.get(it.category) || groups.set(it.category, []).get(it.category)).push(it);
    const limit = state.topic ? Infinity : NEWS_LIMIT[state.period] * (state.category === "All" ? 1 : 3);

    for (const [cat, items] of groups) {
      if (!items.length) continue;
      const expanded = state.expanded.has(cat);
      const shown = expanded ? items : items.slice(0, limit);
      box.append(h("section", { class: "card news-group" },
        h("h3", {}, cat, h("span", { class: "muted small" }, ` ${items.length}`)),
        h("ul", { class: "news-list" }, shown.map((it) => h("li", {},
          h("a", { href: safeUrl(it.link), target: "_blank", rel: "noopener" }, it.title),
          it.summary && h("p", { class: "summary" }, it.summary),
          h("p", { class: "meta small muted" }, it.source, " · ", relTime(it.published))))),
        items.length > shown.length && h("button", { class: "link-btn",
          onclick: () => { state.expanded.add(cat); renderNews(); } }, `Show ${items.length - shown.length} more`)));
    }
  }

  // ---------- wiring ----------
  function render() {
    renderHeader();
    renderDevotion();
    renderReading();
    renderNotes();
    renderNews();
  }

  function shift(dir) {
    const a = state.anchor;
    if (state.period === "day") state.anchor = addDays(a, dir);
    else if (state.period === "week") state.anchor = addDays(a, 7 * dir);
    else state.anchor = new Date(a.getFullYear(), a.getMonth() + dir, Math.min(a.getDate(), 28));
    state.expanded.clear();
    render();
  }

  function setPeriod(p) {
    state.period = p;
    state.expanded.clear();
    state.topic = null;
    history.replaceState(null, "", `#${p}`);
    render();
  }

  document.querySelectorAll(".tabs [role=tab]").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));
  $("prev-btn").addEventListener("click", () => shift(-1));
  $("next-btn").addEventListener("click", () => shift(1));
  $("today-btn").addEventListener("click", () => { state.anchor = today(); render(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, dialog[open]")) return;
    if (e.key === "ArrowLeft") shift(-1);
    if (e.key === "ArrowRight") shift(1);
  });

  const dialog = $("settings");
  $("settings-btn").addEventListener("click", () => {
    $("plan-start").value = store.planStart;
    $("bible-version").value = store.version;
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test($("plan-start").value)) store.planStart = $("plan-start").value;
    store.version = $("bible-version").value;
    saveStore();
    render();
  });
  $("reset-progress").addEventListener("click", () => {
    if (confirm("Clear all reading-plan checkmarks? Your notes are kept.")) { store.done = {}; saveStore(); render(); }
  });

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }

  render();
  loadJson("data/devotions.json").then((d) => { devotions = d; renderDevotion(); })
    .catch((e) => $("devotion").replaceChildren(h("p", { class: "card empty" }, `Could not load devotions (${e.message}).`)));
  loadJson("data/news.json").then((n) => { news = n; renderNews(); })
    .catch(() => { news = { items: [] }; renderNews(); });
})();
