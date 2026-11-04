// A synthetic profile for the Ledger's tests and for looking at the page: several games' saved keys, a pile with items across
// subjects and piles, and a few weeks of the Ledger's record. Built around `now` so its numbers are fixed (Wednesday
// 4 November 2026, 12:00 UTC, in the test). `idOf(label, i)` names an entity of a subject: the test's own, or a real one.
const DAY = 24 * 60 * 60 * 1000;
export const NOW = Date.parse("2026-11-04T12:00:00Z");
const ymd = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

export const APPS = [
  ["punt", "knowledge", "Punt"], ["quote", "knowledge", "Quote"], ["chart", "knowledge", "Chart"], ["maths", "courses", "Maths"], ["music", "courses", "Music"],
  ["glyph", "puzzle", "Slate"], ["sudoku", "puzzle", "Sudoku"], ["mines", "classics", "Mines"], ["heliograph", "idle", "Heliograph"], ["rack", "board", "Rack"],
  ["bigtwo", "cards", "Big Two"], ["yacht", "cards", "Yacht"], ["whispers", "party", "Whispers"], ["guilloche", "appendix", "Guilloché"],
].map(([id, sec, name]) => ({ id, sec, name, href: `./${id}.html` }));
export const SECTIONS = [["knowledge", "Knowledge"], ["courses", "Courses"], ["puzzle", "Puzzles"], ["classics", "Classics"], ["idle", "Idle"], ["board", "Board games"], ["cards", "Cards & dice"], ["party", "Party"], ["appendix", "Appendix"]];
export const MARKS = { punt: "daily", quote: "daily", chart: "daily", glyph: "time", sudoku: "time", mines: "time", yacht: "daily", maths: "lessons", music: "lessons", bigtwo: "streak" };

/** The subjects: how many items, how many learned (and when, days ago), passes and fails each, the pile, the game, how it last went and when. */
const SUBJECTS = {
  Painters: { n: 4, game: "chart", learned: [2, 6, 8, 40], passes: 5, fails: 1, pile: 5, why: "right", at: [2, 6, 8, 40], due: 0 },
  Countries: { n: 10, game: "quote", learned: [7, 14, 15, 30, 31, 32], passes: 4, fails: 1, pile: 3, why: "lowStake", at: [7, 14, 15, 30, 31, 32, 1, 1, 1, 1], due: 5 * DAY },
  Paintings: { n: 6, game: "crates", learned: [], passes: 2, fails: 3, pile: 2, why: "clue", at: 5, due: -10 * DAY },
  Commodities: { n: 4, game: "chart", learned: [], passes: 1, fails: 3, pile: 1, why: "miss", at: 12, due: 3 * DAY },
  Museums: { n: 3, game: "quote", learned: [], passes: 1, fails: 4, pile: 1, why: "miss", at: 9, due: -2 * 3600e3 },
  Law: { n: 5, game: "punt", learned: [], passes: 0, fails: 3, pile: 0, why: "wrong", at: 2, due: -3 * DAY },
  People: { n: 2, game: "chart", learned: [], passes: 1, fails: 1, pile: 1, why: "miss", at: 20, due: 4 * DAY },
};

/** The profile. `scale` multiplies the games and the pile for the speed test. */
export function fakeProfile({ now = NOW, idOf = (label, i) => `${label}:${i}`, scale = 1 } = {}) {
  const items = [], day = d => now - d * DAY;
  for (const [label, s] of Object.entries(SUBJECTS)) for (let rep = 0; rep < scale; rep++) for (let i = 0; i < s.n; i++) {
    const learnedAgo = s.learned[i], at = Array.isArray(s.at) ? s.at[i] : s.at;
    const key = `${label}-${rep}-${i}`, it = { id: `${s.game}:${key}`, game: s.game, key, added: day(60), seen: 1, fails: s.fails, passes: s.passes, pile: s.pile, about: [idOf(label, i)], payload: { q: key } };
    if (learnedAgo != null) { it.learned = day(learnedAgo); it.due = Infinity; it.last = { at: day(learnedAgo), why: "right" }; }
    else { it.due = now + s.due; it.last = { at: day(at ?? 3), why: s.why }; }
    items.push(it);
  }
  items.push({ id: "parley:w", game: "parley", key: "w", added: day(30), seen: 0, fails: 0, passes: 2, pile: 1, due: now + DAY, last: { at: day(1), why: "right" } });   // a word: about nothing in the base
  const snap = {}, meta = {}, put = (k, v, ago = 0) => { snap[k] = JSON.stringify(v); meta[k] = now - ago * DAY; };
  put("punt:ranked", { best: 12, day: { key: ymd(now), score: 10 } }, 0);
  put("quote:ranked", { best: 8, day: { key: ymd(day(1)), score: 6 } }, 1);
  put("chart:best", 5, 20);
  put("maths:lessons", { done: 5, of: 12 }, 3);
  put("music:lessons", { done: 12, of: 12 }, 5);
  put("slate:today", { key: ymd(day(3)), v: 120 }, 3);
  put("slate:best", 100, 3);
  put("sudoku:best", { easy: 90, hard: 200 }, 9);
  put("sudoku:today", { key: ymd(now), v: 300 }, 0);
  put("mines:best", 45, 40);
  put("heliograph:best", 1e6, 60);
  put("bigtwo:streak", { now: 2, best: 5 }, 1);
  put("yacht:daily", Object.fromEntries([0, 1, 2, 4, 5, 6, 8, 9, 12, 13].map(d => [ymd(day(d)), 200 + d])), 0);
  put("punt:settings", { x: 1 }, 0);                      // a setting is no sign of play
  snap["suite:meta"] = JSON.stringify(meta);
  const stats = {
    since: day(60),
    recall: { "2026-W44": { hour: [4, 5], week: [8, 10], month: [2, 3] }, "2026-W43": { week: [6, 10], quarter: [0, 2] }, "2026-W42": { week: [3, 4] } },
    stake: { "2026-W44": { 5: [3, 5, 1.2], 8: [4, 5, 0.4] } },
    size: { "2026-W44": { 25: [4, 6], 100: [3, 4] } },
    know: {}, market: { "2026-W44": { n: 4, inside: 3, grades: { S: 2, A: 1, C: 1 } } },
    days: Object.fromEntries([0, 1, 2, 3].map(d => [ymd(day(d)), [3, 5]])),
  };
  const apps = [...APPS], marks = { ...MARKS };
  for (let g = 0; g < 140 * (scale - 1); g++) {       // the speed test: a screen of games, each with the usual keys
    const id = `game${g}`; apps.push({ id, sec: SECTIONS[g % 8][0], name: `Game ${g}`, href: `./${id}.html` }); marks[id] = g % 3 ? "daily" : "stars";
    put(`${id}:best`, g * 3, g % 30); put(`${id}:stars`, g % 40, g % 30); put(`${id}:daily`, Object.fromEntries([0, 2, 3, 7, 9].map(d => [ymd(day(d)), d])), 1); put(`${id}:lessons`, { done: g % 9, of: 9 }, 2);
    put(`${id}:progress`, Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`l${i}`, { stars: i % 4 }])), 3);
    for (const n of ["settings", "view", "run", "mode", "sound"]) snap[`${id}:${n}`] = JSON.stringify({ x: g });
  }
  const labels = Object.keys(SUBJECTS), ids = new Map();
  for (const label of labels) for (let i = 0; i < 12; i++) ids.set(idOf(label, i), label);
  return { snap, apps, sections: SECTIONS, marks, items, stats, now, subjectOf: id => ids.get(id), labels };
}
