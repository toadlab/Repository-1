/* Grounding: liturgical season, Ordinary Time constants, prayer of the week,
   the lectionary trial, and the narrative read-through track. All of it is
   computed from the calendar alone and never from the day's news. */
(function () {
  "use strict";
  const MS_DAY = 86400000;
  const day = (y, m, d) => new Date(y, m, d);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diff = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                                     Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS_DAY);
  const pad = (n) => String(n).padStart(2, "0");

  // Anonymous Gregorian computus.
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
    return day(y, month - 1, dd);
  }
  function advent1(y) {
    const eve = day(y, 11, 24);
    return addDays(eve, -eve.getDay() - 21); // fourth Sunday before Christmas
  }
  function baptism(y) {
    const jan6 = day(y, 0, 6);
    return addDays(jan6, 7 - jan6.getDay()); // first Sunday after Jan 6
  }

  /** {key, week, ordinaryDay} for a date. */
  function season(date) {
    const y = date.getFullYear();
    const adv = advent1(y), E = easter(y), ash = addDays(E, -46), palm = addDays(E, -7), pent = addDays(E, 49);
    const bap = baptism(y);
    const christmas = day(y, 11, 25);
    if (date >= christmas || date < day(y, 0, 6)) return { key: "christmas", week: 0 };
    if (date >= adv) return { key: "advent", week: Math.floor(diff(adv, date) / 7) };
    if (date <= bap) return { key: "epiphany", week: diff(day(y, 0, 6), date) >= 3 ? 1 : 0 };
    if (date < ash) return { key: "ordinary", ordinaryDay: diff(addDays(bap, 1), date) };
    if (date < palm) return { key: "lent", week: Math.floor(diff(ash, date) / 7) };
    if (date < E) return { key: "holyweek", week: 0 };
    if (date < pent) return { key: "easter", week: Math.floor(diff(E, date) / 7) };
    if (diff(pent, date) === 0) return { key: "pentecost", week: 0 };
    const firstStretch = diff(addDays(bap, 1), ash);
    return { key: "ordinary", ordinaryDay: firstStretch + diff(addDays(pent, 1), date) };
  }

  function focus(g, date) {
    const s = season(date);
    const info = g.seasons[s.key];
    if (s.key === "ordinary") {
      const block = Math.floor(s.ordinaryDay / g.constant_block_days);
      const c = g.constants[block % g.constants.length];
      const inBlock = s.ordinaryDay % g.constant_block_days;
      const item = c.items[inBlock % c.items.length];
      return {
        season: info, seasonKey: s.key,
        label: `${c.name} · week ${Math.floor(inBlock / 7) + 1} of ${Math.ceil(g.constant_block_days / 7)}`,
        title: c.name, ref: c.ref, text: item.text, prompt: item.prompt,
      };
    }
    const w = info.weeks[Math.min(s.week, info.weeks.length - 1) % info.weeks.length];
    return {
      season: info, seasonKey: s.key,
      label: s.key === "advent" ? `Week ${s.week + 1} of Advent` : info.theme,
      title: w.title, ref: w.ref, text: w.text, prompt: info.about,
    };
  }

  // Weeks run Monday to Sunday; the prayer changes each Monday.
  const PRAYER_EPOCH = day(2026, 0, 5);
  function prayer(g, date) {
    const week = Math.floor(diff(PRAYER_EPOCH, date) / 7);
    const i = ((week % g.prayers.length) + g.prayers.length) % g.prayers.length;
    return { ...g.prayers[i], number: i + 1, of: g.prayers.length };
  }

  function sourceLink(id, date) {
    const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
    if (id === "catholic") return { url: `https://bible.usccb.org/bible/readings/${m}${d}${String(y).slice(2)}.cfm`, label: "Open today's Mass readings (USCCB)" };
    if (id === "orthodox") return { url: `https://www.oca.org/readings/daily/${y}/${m}/${d}`, label: "Open today's readings (OCA)" };
    if (id === "coptic") return { url: `https://www.copticchurch.net/readings?g_year=${y}&g_month=${m}&g_day=${d}`, label: "Open today's Katameros readings" };
    const n = Math.min(diff(day(y, 0, 1), date) + 1, 365);
    return {
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`Bible in a Year Day ${n} Fr Mike Schmitz`)}`,
      label: `Listen to Day ${n}`,
      alt: { url: "https://open.spotify.com/show/4Pppt42NPK2XzKwNIoW7BR", label: "Podcast on Spotify" },
      day: n,
    };
  }

  /** The day's reading source: trial rotation (one per week) until a choice is made. */
  function reading(g, date, settings) {
    const start = settings.trialStart ? new Date(settings.trialStart + "T00:00") : date;
    const week = Math.floor(diff(start, date) / 7);
    const sources = g.trial_sources;
    let id = settings.source, trial = null;
    if (!id || id === "trial") {
      const idx = ((week % sources.length) + sources.length) % sources.length;
      id = sources[idx].id;
      trial = { week: week + 1, of: sources.length, complete: week >= sources.length, before: week < 0 };
    }
    const src = sources.find((s) => s.id === id) || sources[0];
    return { ...src, link: sourceLink(src.id, date), trial };
  }

  function narrative(g, date) {
    const units = g.narrative_track.units;
    const unit = units[date.getMonth() % units.length];
    const chapters = unit.books.flatMap(([book, n]) => Array.from({ length: n }, (_, i) => `${book} ${i + 1}`));
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const start = Math.floor(((date.getDate() - 1) * chapters.length) / daysInMonth);
    const end = Math.max(start + 1, Math.floor((date.getDate() * chapters.length) / daysInMonth));
    return { unit, chapters: chapters.slice(start, end), total: chapters.length };
  }

  window.Grounding = { season, focus, prayer, reading, narrative, easter, advent1 };
})();
