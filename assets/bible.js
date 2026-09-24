/* One-year Bible reading plan: all 1,189 chapters spread evenly across 365 days. */
(function () {
  const BOOKS = [
    ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34],
    ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
    ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10],
    ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
    ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52], ["Lamentations", 5],
    ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3], ["Amos", 9],
    ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3],
    ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
    ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28],
    ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6], ["Ephesians", 6],
    ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
    ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13], ["James", 5],
    ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1], ["3 John", 1],
    ["Jude", 1], ["Revelation", 22],
  ];
  const PLAN_DAYS = 365;

  const CHAPTERS = [];
  for (const [book, count] of BOOKS) {
    for (let c = 1; c <= count; c++) CHAPTERS.push([book, c]);
  }

  /** Portion for a 0-based plan day, e.g. "Genesis 50; Exodus 1–2". */
  function portion(day) {
    if (day < 0 || day >= PLAN_DAYS) return null;
    const start = Math.floor((day * CHAPTERS.length) / PLAN_DAYS);
    const end = Math.floor(((day + 1) * CHAPTERS.length) / PLAN_DAYS);
    const groups = [];
    for (let i = start; i < end; i++) {
      const [book, ch] = CHAPTERS[i];
      const last = groups[groups.length - 1];
      if (last && last.book === book) last.to = ch;
      else groups.push({ book, from: ch, to: ch });
    }
    const fmt = (sep) => groups
      .map((g) => (g.from === g.to ? `${g.book} ${g.from}` : `${g.book} ${g.from}${sep}${g.to}`))
      .join("; ");
    return { label: fmt("–"), query: fmt("-"), chapters: end - start };
  }

  window.BiblePlan = { PLAN_DAYS, TOTAL_CHAPTERS: CHAPTERS.length, portion };
})();
