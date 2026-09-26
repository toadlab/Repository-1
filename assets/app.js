/* Daily Bread & Briefing: grounding first, then a deliberately thin, filtered digest. */
(function () {
  "use strict";

  const STORE_KEY = "pnd.v1";
  const MS_DAY = 86400000;

  // ---------- per-browser storage (never allowed to break rendering) ----------
  function loadStore() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { /* unavailable */ }
    return { trialStart: s.trialStart || null, source: s.source || "trial", flags: s.flags || [],
             journal: s.journal || {}, trialNotes: s.trialNotes || {}, praying: s.praying || {} };
  }
  const store = loadStore();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) { /* ignore */ } }

  // ---------- dates ----------
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmt = (d, o) => d.toLocaleDateString(undefined, o);
  const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
  if (!store.trialStart) { store.trialStart = ymd(startOfWeek(today())); save(); }

  // ---------- state & data ----------
  const state = {
    view: ["today", "weekly", "flagged"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "today",
    date: today(),
    weekIndex: null,
  };
  let grounding = null, index = [];
  const digests = new Map();

  async function getJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }
  async function digestFor(date) {
    const key = ymd(date);
    if (!index.some((d) => d.date === key)) return null;
    if (!digests.has(key)) {
      const p = getJson(`data/digests/${key}.json`).catch(() => { digests.delete(key); return null; });
      digests.set(key, p);
    }
    return digests.get(key);
  }

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
      if (c == null || c === false || c === "") continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
  const ext = (href, label, cls) => h("a", { href: safeUrl(href), target: "_blank", rel: "noopener", class: cls }, label);
  const gateway = (ref) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=KJV`;
  const para = (text) => (text || "").split(/\n{2,}/).filter(Boolean).map((t) => h("p", {}, t));

  function talk(ctx, prompt) {
    if (window.openChat) window.openChat(ctx, prompt);
    else alert("The chat is still loading, or it can't reach the Claude API from here.");
  }
  const talkBtn = (label, ctx, prompt) => h("button", { class: "chip action", onclick: () => talk(ctx, prompt) }, label);

  // ---------- grounding ----------
  function groundingSection(date, { compact } = {}) {
    if (!grounding) return h("p", { class: "muted" }, "Loading…");
    const f = Grounding.focus(grounding, date);
    const pr = Grounding.prayer(grounding, date);
    const wrap = h("section", { class: "grounding", "aria-label": "Grounding" });

    wrap.append(h("div", { class: `card focus season-${f.seasonKey}` },
      h("p", { class: "eyebrow" }, `${f.season.name} · ${f.label}`),
      h("blockquote", {}, h("p", {}, f.text),
        h("cite", {}, ext(gateway(f.ref), `${f.ref} ${grounding.translation}`))),
      f.prompt && h("p", { class: "prompt" }, f.prompt)));

    wrap.append(h("div", { class: "card prayer-card" },
      h("p", { class: "eyebrow" }, `Prayer of the week · ${pr.number} of ${pr.of}`),
      h("h3", {}, pr.title, pr.source && h("span", { class: "muted small" }, ` · ${pr.source}`)),
      h("p", { class: "prayer-text" }, pr.text),
      h("div", { class: "card-actions" },
        h("span", { class: "muted small" }, "The same prayer each day this week, to turn over slowly."),
        talkBtn("Talk it through", { kind: "prayer", title: pr.title, body: pr.text }))));

    if (compact) return wrap;

    const r = Grounding.reading(grounding, date, store);
    const trial = r.trial;
    const readingCard = h("div", { class: "card reading-card" },
      h("p", { class: "eyebrow" }, trial
        ? (trial.before ? "Trial starts soon" : trial.complete ? "Trial complete. Keep rotating until you choose." : `Reading trial · week ${trial.week} of ${trial.of}`)
        : "Today's reading"),
      h("h3", {}, r.name),
      h("p", { class: "muted small" }, `${r.length}. ${r.about}`),
      h("div", { class: "card-actions" },
        ext(r.link.url, r.link.label + " ↗", "btn-link"),
        r.link.alt && ext(r.link.alt.url, r.link.alt.label + " ↗", "btn-link subtle"),
        talkBtn("Ask about this passage", { kind: "reading", title: `${r.name}, ${fmt(date, { month: "long", day: "numeric", year: "numeric" })}`,
          body: `Today's readings: ${r.link.url}`, url: r.link.url })));
    if (trial) {
      const noteKey = r.id;
      const ta = h("textarea", { rows: 2, placeholder: `How did ${r.name.split(" (")[0]} sit with you this week?` });
      ta.value = store.trialNotes[noteKey] || "";
      ta.addEventListener("input", () => { store.trialNotes[noteKey] = ta.value; save(); });
      readingCard.append(h("label", { class: "small muted trial-note" }, "Trial notes", ta));
      if (trial.complete) readingCard.append(trialChooser());
    }
    wrap.append(readingCard);

    const n = Grounding.narrative(grounding, date);
    const passage = n.chapters.join("; ");
    const textBox = h("div", { class: "scripture" });
    const details = h("details", { class: "card narrative" },
      h("summary", {},
        h("span", { class: "eyebrow" }, `Narrative track · ${n.unit.period}`),
        h("span", { class: "narrative-title" }, `${n.unit.title}: ${passage}`)),
      textBox,
      h("div", { class: "card-actions" }, ext(gateway(passage), "Read on BibleGateway ↗", "btn-link subtle"),
        talkBtn("Ask about this passage", { kind: "reading", title: passage, body: `${n.unit.period}: ${n.unit.title}` })));
    details.addEventListener("toggle", () => { if (details.open && !textBox.childElementCount) loadScripture(passage, textBox); }, { once: false });
    wrap.append(details);
    return wrap;
  }

  async function loadScripture(passage, box) {
    box.replaceChildren(h("p", { class: "muted small" }, "Loading the text…"));
    try {
      const parts = await Promise.all(passage.split("; ").map((p) =>
        getJson(`https://bible-api.com/${encodeURIComponent(p)}?translation=kjv`)));
      box.replaceChildren(...parts.flatMap((d) => [
        h("h4", {}, d.reference),
        h("p", {}, d.verses.flatMap((v) => [h("sup", {}, v.verse), `${v.text.replace(/\s+/g, " ").trim()} `]))]));
    } catch (_) {
      box.replaceChildren(h("p", { class: "muted small" }, "Couldn't load the text here. Use the link below."));
    }
  }

  function trialChooser() {
    const box = h("div", { class: "chooser" },
      h("p", {}, h("strong", {}, "Which one did you find most nourishing to return to? "),
        "Not the most efficient or the most popular, just the one that fed you."));
    for (const s of grounding.trial_sources) {
      box.append(h("button", { class: "chip", onclick: () => { store.source = s.id; save(); render(); } },
        s.name, store.trialNotes[s.id] ? h("span", { class: "chip-count" }, " · has notes") : null));
    }
    return box;
  }

  function closing(date) {
    const f = Grounding.focus(grounding, date);
    return h("p", { class: "closing" }, f.season.closing);
  }

  // ---------- stories ----------
  const isFlagged = (id) => store.flags.some((f) => f.id === id);
  function toggleFlag(item) {
    if (isFlagged(item.id)) store.flags = store.flags.filter((f) => f.id !== item.id);
    else store.flags.push({ id: item.id, title: item.title, link: item.link, source: item.source,
                            blurb: item.blurb || item.summary || "", flaggedAt: new Date().toISOString() });
    save();
    updateFlagCount();
  }
  function updateFlagCount() { $("flag-count").textContent = store.flags.length ? String(store.flags.length) : ""; }

  function newsCtx(item) {
    return { kind: "news", title: item.title, url: item.link,
             body: [item.ai_summary || item.summary, item.why_it_matters].filter(Boolean).join("\n\n") };
  }

  function storyEl(item, { weekly } = {}) {
    const flagBtn = h("button", { class: "flag", "aria-pressed": String(isFlagged(item.id)), title: "Worth digging into later",
      onclick: (e) => { e.stopPropagation(); toggleFlag(item); flagBtn.setAttribute("aria-pressed", String(isFlagged(item.id))); } },
      "⚑");
    const dd = item.deep_dive;
    const body = h("div", { class: "story-body", hidden: true },
      h("p", { class: "meta small muted" }, ext(item.link, `${item.source} ↗`), " · ", fmt(new Date(item.published), { month: "short", day: "numeric" })),
      item.ai_summary && h("div", { class: "ai-summary" }, h("span", { class: "tag" }, "AI summary"), h("p", {}, item.ai_summary)),
      !item.ai_summary && item.summary && h("p", {}, item.summary),
      weekly && item.why_it_matters && h("div", { class: "why" }, h("h4", {}, "Why it matters to you"), ...para(item.why_it_matters)),
      item.talk_to && h("p", { class: "talk-to" }, "☎ ", item.talk_to),
      dd && h("div", { class: "deep-dive" },
        h("h4", {}, "Deeper context"),
        h("h5", {}, "Background"), ...para(dd.background),
        dd.prior_attempts && [h("h5", {}, "Research and prior attempts"), ...para(dd.prior_attempts)],
        h("h5", {}, "Where there is consensus"), ...para(dd.consensus),
        h("h5", {}, "Where serious people disagree"), ...para(dd.debated),
        dd.open_questions?.length > 0 && [h("h5", {}, "Open questions"), h("ul", {}, dd.open_questions.map((q) => h("li", {}, q)))],
        dd.faith_engagement && [h("h5", {}, "How the Christian tradition has engaged this"), ...para(dd.faith_engagement)],
        dd.sources?.length > 0 && h("p", { class: "small muted sources" }, "Sources: ",
          dd.sources.map((s, i) => [i ? ", " : "", ext(s.url, s.title)]))),
      h("p", { class: "small muted score-line" },
        item.borderline ? (item.promoted ? "Borderline, but it quietly persisted across several days. " : "Borderline call. ") : "",
        `Score ${item.composite} against a ${item.circle} bar of ${item.bar}. ${item.reason}`),
      h("div", { class: "actions" },
        talkBtn("Different perspectives", newsCtx(item), "What are the different serious perspectives on this story? Represent each fairly."),
        talkBtn("Dig deeper", newsCtx(item), "Dig deeper: what's the background, what's known versus disputed, and what should I watch for?"),
        talkBtn("Who could I talk to?", newsCtx(item), "Who in my life (clients, colleagues, neighbors, family, church) might be worth talking with about this, and what might I ask them?"),
        talkBtn("Ask…", newsCtx(item))));
    const head = h("div", { class: "story-head", role: "button", tabindex: 0, "aria-expanded": "false" },
      h("div", { class: "story-text" },
        h("h3", {}, item.title, item.borderline && h("span", { class: "badge" }, "borderline"), dd && h("span", { class: "badge deep" }, "deep dive")),
        h("p", { class: "blurb" }, item.blurb || item.summary)),
      flagBtn);
    const toggle = () => { body.hidden = !body.hidden; head.setAttribute("aria-expanded", String(!body.hidden)); };
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    return h("li", { class: "story" }, head, body);
  }

  function methodologyEl(m) {
    if (!m) return null;
    const excluded = h("ul", { class: "excluded", hidden: true }, (m.excluded || []).map((x) =>
      h("li", {}, ext(x.link, x.title), h("span", { class: "muted" }, ` · ${x.source} · ${x.reason}`))));
    return h("details", { class: "methodology" },
      h("summary", {}, `How this was filtered: ${m.included} included of ${m.considered} considered`),
      m.skew_note && h("p", {}, m.skew_note),
      h("ul", {}, (m.notes || []).map((n) => h("li", {}, n))),
      m.borderline?.length > 0 && [h("h4", {}, "Borderline calls, not included"),
        h("ul", {}, m.borderline.map((b) => h("li", {}, ext(b.link, b.title), h("span", { class: "muted" }, ` · ${b.source}. ${b.note}`))))],
      m.excluded?.length > 0 && h("button", { class: "link-btn", onclick: (e) => { excluded.hidden = !excluded.hidden;
        e.target.textContent = excluded.hidden ? `Show all ${m.excluded.length} excluded headlines` : "Hide excluded headlines"; } },
        `Show all ${m.excluded.length} excluded headlines`),
      excluded,
      h("p", { class: "small muted" }, "Sources are mainstream and regional RSS feeds, so some mainstream framing is an accepted limitation. Stories are included or excluded by the durability and relevance rules, never to manufacture balance."));
  }

  function journalEl(key, label, placeholder) {
    const status = h("span", { class: "small muted" });
    const ta = h("textarea", { id: "journal", rows: 3, placeholder });
    ta.value = store.journal[key] || "";
    let t;
    ta.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (ta.value.trim()) store.journal[key] = ta.value; else delete store.journal[key];
        save(); status.textContent = "Saved";
      }, 400);
    });
    return h("div", { class: "card journal" }, h("div", { class: "journal-head" }, h("label", { for: "journal", class: "eyebrow" }, label), status), ta);
  }

  // ---------- views ----------
  async function renderToday() {
    const date = state.date;
    const view = $("view");
    const digest = await digestFor(date);
    if (state.view !== "today" || ymd(state.date) !== ymd(date)) return; // navigated away meanwhile
    const parts = [groundingSection(date)];

    if (digest?.emergencies?.length) {
      parts.push(h("section", { class: "card emergency" }, h("p", { class: "eyebrow" }, "Breaking the rhythm: this needs your attention"),
        h("ul", { class: "stories" }, digest.emergencies.map((i) => storyEl(i)))));
    }

    const isFuture = date > today();
    if (!digest) {
      parts.push(h("div", { class: "card empty" }, isFuture ? "This day's digest hasn't been written yet."
        : "No digest was built for this day. The pipeline builds one each morning once it is running."));
    } else if (digest.type === "pulse") {
      const spot = digest.spotlight;
      parts.push(h("section", {},
        h("h2", { class: "section-h" }, "Daily pulse"),
        digest.pulse.length
          ? h("ul", { class: "stories card" }, digest.pulse.map((i) => storyEl(i)))
          : h("div", { class: "card calm" }, h("p", {}, h("strong", {}, "Nothing needs your attention today. "),
              "That is an expected outcome, not a gap."))));
      if (spot?.circle === "global") parts.push(regionEl(spot));
      else if (spot) {
        parts.push(h("section", {},
          h("h2", { class: "section-h" }, `${spot.circle === "local" ? "Local" : "State and region"} day`),
          spot.items.length ? h("ul", { class: "stories card" }, spot.items.map((i) => storyEl(i)))
            : h("div", { class: "card calm" }, `Nothing from the ${spot.circle} circle cleared the bar this week.`)));
      }
      parts.push(methodologyEl(digest.methodology));
    } else if (digest.type === "reflection") {
      parts.push(reflectionEl(date, digest));
    } else if (digest.type === "weekly") {
      parts.push(h("div", { class: "card calm" }, h("p", {}, h("strong", {}, "Today is the weekly digest. "), "It's meant for unhurried weekend reading."),
        h("button", { class: "btn", onclick: () => { state.weekIndex = weeklyDates().indexOf(ymd(date)); setView("weekly"); } }, "Open this week's digest")));
    }

    parts.push(closing(date));
    parts.push(journalEl(ymd(date), "Your reflection", "What did you notice, feel, or want to remember today?"));
    view.replaceChildren(...parts.filter(Boolean));
  }

  function regionEl(spot) {
    const v = spot.visit;
    return h("section", {},
      h("h2", { class: "section-h" }, "Global day"),
      h("div", { class: "card region" },
        h("p", { class: "eyebrow" }, `Region of the month · ${spot.region}`),
        h("p", { class: "muted small" }, "Not what happened, but what is persistently or quietly true there right now."),
        v ? [
          ...para(v.what_is_true),
          h("h4", {}, "Since the last visit"), ...para(v.changes_since_last),
          h("h4", {}, "Worth your attention this month"), ...para(v.suggestion),
          v.sources?.length > 0 && h("p", { class: "small muted sources" }, "Sources: ", v.sources.map((s, i) => [i ? ", " : "", ext(s.url, s.title)])),
          h("div", { class: "card-actions" }, talkBtn("Talk about this region", { kind: "region", title: spot.region, body: v.what_is_true })),
        ] : h("p", {}, "This month's note needs a Claude API key in the pipeline to research it.")));
  }

  function reflectionEl(date, digest) {
    const key = ymd(date);
    const hyper = digest.circle === "hyperlocal";
    const pick = (list) => list[Math.floor(date.getTime() / MS_DAY) % list.length];
    const f = Grounding.focus(grounding, date);
    const pr = Grounding.prayer(grounding, date);
    const story = digest.inspiring?.[0];
    const options = [
      { id: "passage", label: `The passage: ${f.ref}` },
      { id: "prayer", label: `This week's prayer: ${pr.title}` },
      story && { id: "story", label: `The story: ${story.title}` },
      hyper && { id: "people", label: "Someone in my family or among my friends" },
    ].filter(Boolean);
    const chosen = store.praying[key];
    return h("section", {},
      h("h2", { class: "section-h" }, hyper ? "Reflection day · family and friends" : "Reflection day"),
      h("div", { class: "card reflection" },
        h("p", {}, "No news today. That's on purpose."),
        h("p", { class: "prompt" }, hyper ? pick(grounding.hyperlocal_prompts) : pick(grounding.reflection_prompts)),
        story && h("div", { class: "inspiring" }, h("p", { class: "eyebrow" }, "Something that is working"),
          h("ul", { class: "stories" }, storyEl(story))),
        h("p", { class: "question" }, "Which of these would you like to pray about today?"),
        h("div", { class: "chips" }, options.map((o) => h("button", { class: "chip", "aria-pressed": String(chosen === o.id),
          onclick: () => { store.praying[key] = o.id; save(); render(); } }, o.label))),
        chosen && h("div", { class: "card-actions" },
          talkBtn("Pray it through with Claude", { kind: "reflection", title: options.find((o) => o.id === chosen)?.label || "",
            body: chosen === "prayer" ? pr.text : chosen === "passage" ? `${f.ref}: ${f.text}` : chosen === "story" ? (story.blurb || story.summary) : "" }))));
  }

  const weeklyDates = () => index.filter((d) => d.type === "weekly").map((d) => d.date);

  async function renderWeekly() {
    const view = $("view");
    const dates = weeklyDates();
    if (!dates.length) {
      view.replaceChildren(h("div", { class: "card empty" }, "No weekly digest yet. The first one arrives on Saturday morning."));
      $("period-title").textContent = "Weekly digest";
      return;
    }
    if (state.weekIndex == null || state.weekIndex < 0 || state.weekIndex >= dates.length) state.weekIndex = dates.length - 1;
    const date = parseYmd(dates[state.weekIndex]);
    renderHeader();
    const digest = await digestFor(date);
    if (state.view !== "weekly") return;
    if (!digest) { view.replaceChildren(h("div", { class: "card empty" }, "Couldn't load this digest.")); return; }

    const parts = [groundingSection(date, { compact: true })];
    parts.push(h("section", {}, h("h2", { class: "section-h" }, `This week · ${digest.items.length} stories`),
      h("ul", { class: "stories card" }, digest.items.map((i) => storyEl(i, { weekly: true })))));
    if (digest.first_weekend) parts.push(monthlyPickEl(date));
    parts.push(methodologyEl(digest.methodology));
    parts.push(closing(date));
    parts.push(journalEl(`week-${dates[state.weekIndex]}`, "Weekly reflection", "What stood out this week? What do you want to remember or pray about?"));
    view.replaceChildren(...parts.filter(Boolean));
  }

  function monthlyPickEl(date) {
    const since = addDays(date, -35);
    const flags = store.flags.filter((f) => new Date(f.flaggedAt) >= since);
    return h("section", { class: "card monthly-pick" },
      h("p", { class: "eyebrow" }, "First weekend of the month"),
      h("h3", {}, "Pick one flagged story to explore in depth"),
      flags.length
        ? h("ul", { class: "plain-list" }, flags.map((f) => h("li", {},
            h("span", {}, f.title), " ",
            talkBtn("Explore in depth", { kind: "news", title: f.title, url: f.link, body: f.blurb },
              "I flagged this as worth digging into. Let's explore it in real depth: background, what's known and disputed, the best thinking on different sides, and what it might mean for me."))))
        : h("p", { class: "muted" }, "You haven't flagged anything this past month. Use ⚑ on any story to save it for here."));
  }

  function renderFlagged() {
    const view = $("view");
    const list = [...store.flags].sort((a, b) => b.flaggedAt.localeCompare(a.flaggedAt));
    view.replaceChildren(
      h("p", { class: "muted" }, "Stories you marked as worth digging into later. On the first weekend of each month they come back as a short list to choose from."),
      list.length ? h("ul", { class: "stories card" }, list.map((f) => h("li", { class: "story" },
        h("div", { class: "story-head" },
          h("div", { class: "story-text" }, h("h3", {}, f.title), h("p", { class: "blurb" }, f.blurb),
            h("p", { class: "small muted" }, ext(f.link, `${f.source} ↗`), ` · flagged ${fmt(new Date(f.flaggedAt), { month: "short", day: "numeric" })}`),
            h("div", { class: "actions" },
              talkBtn("Explore in depth", { kind: "news", title: f.title, url: f.link, body: f.blurb },
                "I flagged this as worth digging into. Let's explore it in real depth."),
              h("button", { class: "chip", onclick: () => { toggleFlag(f); renderFlagged(); } }, "Remove")))))))
        : h("div", { class: "card empty" }, "Nothing flagged yet. Tap ⚑ on any story."));
  }

  // ---------- chrome ----------
  function renderHeader() {
    const nav = $("date-nav");
    nav.hidden = state.view === "flagged";
    document.querySelectorAll(".tabs [role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === state.view)));
    if (state.view === "today") {
      const d = Math.round((state.date - today()) / MS_DAY);
      const rel = d === 0 ? "Today" : d === -1 ? "Yesterday" : d === 1 ? "Tomorrow" : null;
      $("period-title").textContent = (rel ? rel + " · " : "") + fmt(state.date, { weekday: "long", month: "long", day: "numeric" });
      const f = grounding && Grounding.focus(grounding, state.date);
      $("period-sub").textContent = f ? `${f.season.name} · ${f.season.theme}` : "";
      $("today-btn").hidden = d === 0;
    } else if (state.view === "weekly") {
      const dates = weeklyDates();
      const date = dates.length && state.weekIndex != null ? parseYmd(dates[state.weekIndex]) : null;
      $("period-title").textContent = date ? `Week ending ${fmt(date, { month: "long", day: "numeric" })}` : "Weekly digest";
      $("period-sub").textContent = "For weekend reading";
      $("today-btn").hidden = state.weekIndex === dates.length - 1;
    } else {
      $("period-title").textContent = "Flagged";
    }
  }

  function render() {
    renderHeader();
    updateFlagCount();
    if (!grounding) { $("view").replaceChildren(h("p", { class: "muted" }, "Loading…")); return; }
    if (state.view === "today") renderToday();
    else if (state.view === "weekly") renderWeekly();
    else renderFlagged();
  }

  function setView(v) {
    state.view = v;
    history.replaceState(null, "", `#${v}`);
    render();
    window.scrollTo(0, 0);
  }

  function shift(dir) {
    if (state.view === "today") state.date = addDays(state.date, dir);
    else if (state.view === "weekly") state.weekIndex = Math.max(0, Math.min(weeklyDates().length - 1, (state.weekIndex ?? 0) + dir));
    render();
  }

  document.querySelectorAll(".tabs [role=tab]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $("prev-btn").addEventListener("click", () => shift(-1));
  $("next-btn").addEventListener("click", () => shift(1));
  $("today-btn").addEventListener("click", () => { state.date = today(); state.weekIndex = null; render(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, dialog[open], [role=button]")) return;
    if (e.key === "ArrowLeft") shift(-1);
    if (e.key === "ArrowRight") shift(1);
  });

  const settings = $("settings");
  $("settings-btn").addEventListener("click", () => {
    $("set-source").value = store.source;
    $("set-trial-start").value = store.trialStart;
    $("set-key").value = window.chatSettings?.key || "";
    $("set-model").value = window.chatSettings?.model || "claude-opus-5";
    settings.showModal();
  });
  settings.addEventListener("close", () => {
    store.source = $("set-source").value;
    if (/^\d{4}-\d{2}-\d{2}$/.test($("set-trial-start").value)) store.trialStart = $("set-trial-start").value;
    if (window.chatSettings) { window.chatSettings.key = $("set-key").value; window.chatSettings.model = $("set-model").value; }
    save();
    render();
  });

  render();
  Promise.all([
    getJson("data/grounding.json").then((g) => { grounding = g; }),
    getJson("data/digests/index.json").then((i) => { index = i; }).catch(() => { index = []; }),
  ]).then(render).catch((e) => $("view").replaceChildren(h("div", { class: "card empty" }, `Couldn't load the app data (${e.message}).`)));
})();
