// Cross-number (Crossword's "Numbers" clues), pure: a crossword whose answers are whole numbers. Every answer comes from
// Quote's bank (quote-bank.js): the years of things, and the few measures that are sharp integers (a height, a
// capacity), clued as Quote asks them. The grid is grown, not filled: a first entry is laid across the middle and each
// next one crosses what is there at a matching digit, touching nothing else, so the grid is as loose as a cross-number
// is wont to be (cells in one entry only are fine). It comes out in crossword-engine.js's own puzzle shape, so the
// crossword page, its check, reveal and tables play it unchanged. Seeded and counted, never timed.
import { QUOTES } from "./quote-bank.js";
import { seeded } from "./crossword-solve.js";
import { mix } from "./gridfill.js";
const BLACK = "#";   // (crossword-engine.js's own; not imported, as it imports this)

/** What a level asks: the squares across the grid may take, how many entries it aims for, and the hardest question
 *  (Quote's d, 1 to 4) it draws on. */
export const NUM_LEVELS = {
  easy: { size: 11, entries: 12, d: 3, audience: 2 },
  medium: { size: 13, entries: 16, d: 3, audience: 3 },
  hard: { size: 13, entries: 20, d: 4, audience: 3 },
};

const FUZZY = /\b(about|around|circa|roughly|nearly|almost|some)\b|\bc\. ?\d/i;
const commas = n => n.toLocaleString("en");
/** Whether a question has one exact whole-number answer that stands on its own (no picture, no "this"). */
function exact(q) {
  if (q.pic || q.title || !Number.isInteger(q.truth) || q.truth < 100 || q.truth > 999999) return false;
  if (/\bthis\b/i.test(q.q) || FUZZY.test(q.note || "")) return false;
  if (q.unit === "year") return q.truth <= 2100;
  // a measure counts only if it is sharp (a tight tolerance) and its note states that very number
  return q.tol <= 0.03 && q.cat !== "markets" && ((q.note || "").includes(commas(q.truth)) || (q.note || "").includes(String(q.truth)));
}
/** The clue a question makes: "The year the South Sea Bubble burst", or "Height of Mont Blanc (metres)". */
export const clueOf = q => (q.unit === "year" ? q.q : `${q.q} (${q.unit})`);
/** Every question the bank can set, once, by answer: { id, answer, text, d, audience }. */
export function pool() {
  const seen = new Set(), out = [];
  for (const q of QUOTES) {
    if (!exact(q)) continue;
    const answer = String(q.truth);
    const text = clueOf(q);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ id: q.id, answer, text, d: q.d || 3, audience: q.audience || 2, year: q.unit === "year" });
  }
  return out;
}

// ---------- growing a grid ----------
const DIRS = { across: [0, 1], down: [1, 0] };
/** Whether `word` may go at (r, c) in `dir` on a sparse grid (a Map "r,c" → digit): it crosses at least one square of
 *  its own digit, agrees where it does, and touches no other entry's square sideways or end on. Its crossings, or null. */
function fits(grid, word, r, c, dir, lo, hi) {
  const [dr, dc] = DIRS[dir], n = word.length;
  const r1 = r + dr * (n - 1), c1 = c + dc * (n - 1);
  if (r < lo || c < lo || r1 > hi || c1 > hi) return null;
  const at = (a, b) => grid.get(a + "," + b);
  if (at(r - dr, c - dc) || at(r1 + dr, c1 + dc)) return null;      // runs on from another entry
  let cross = 0;
  for (let i = 0; i < n; i++) {
    const a = r + dr * i, b = c + dc * i, have = at(a, b);
    if (have) {
      if (have !== word[i]) return null;
      // a crossing is across the other entry's way: a neighbour of this square along ours is another entry's, laid the same way (694 inside 1694)
      if ((i > 0 && at(a - dr, b - dc)) || (i < n - 1 && at(a + dr, b + dc))) return null;
      cross++;
      continue;
    }
    // a square of its own: nothing either side of it (across the way it runs)
    if (at(a + dc, b + dr) || at(a - dc, b - dr)) return null;
  }
  return cross;
}
/** One grid grown from a seed: placed entries ({ item, dir, r, c }) on a sparse grid, up to `want` of them. */
function grow(items, want, size, rnd) {
  const grid = new Map(), placed = [], used = new Set();
  const lay = (item, r, c, dir) => {
    const [dr, dc] = DIRS[dir];
    for (let i = 0; i < item.answer.length; i++) grid.set(`${r + dr * i},${c + dc * i}`, item.answer[i]);
    placed.push({ item, dir, r, c });
    used.add(item.answer);
  };
  const first = items[0], mid = size >> 1;
  lay(first, mid, (size - first.answer.length) >> 1, "across");
  for (const item of items.slice(1)) {
    if (placed.length >= want) break;
    if (used.has(item.answer)) continue;
    const options = [];
    for (const p of placed) {
      const dir = p.dir === "across" ? "down" : "across", [dr, dc] = DIRS[p.dir], [er, ec] = DIRS[dir];
      for (let i = 0; i < p.item.answer.length; i++) for (let j = 0; j < item.answer.length; j++) {
        if (p.item.answer[i] !== item.answer[j]) continue;
        const r = p.r + dr * i - er * j, c = p.c + dc * i - ec * j;
        const x = fits(grid, item.answer, r, c, dir, 0, size - 1);
        if (x) options.push({ r, c, dir, x });
      }
    }
    if (!options.length) continue;
    // the most crossings, ties by chance: a tight grid, and not always the same one
    const top = Math.max(...options.map(o => o.x)), best = options.filter(o => o.x === top);
    const o = best[Math.floor(rnd() * best.length)];
    lay(item, o.r, o.c, o.dir);
  }
  return { grid, placed };
}
const shuffle = (list, rnd) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
/** No clue may carry another entry's answer (a clue that says "1914" next to an answer 1914). */
const gives = (placed) => placed.some(p => placed.some(q => q !== p && q.item.answer.length >= 3 && p.item.text.replace(/,/g, "").includes(q.item.answer)));

/**
 * A cross-number puzzle in the crossword's shape, or null: { v, seed, level, kind: "numbers", mode, pool, rows (the
 * digits, "#" for a blank square), entries, theme: null, grade: null }. Options: seed, level.
 */
export function makeNumbers({ seed = 1, level = "medium" } = {}) {
  const L = NUM_LEVELS[level] || NUM_LEVELS.medium, rnd = seeded(mix(seed, 0xC207));
  const all = pool().filter(p => p.d <= L.d && p.audience <= L.audience);
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    // years lead (a first entry that crosses easily), measures follow: both shuffled afresh each try
    const order = shuffle(all, rnd);
    const { grid, placed } = grow(order, L.entries, L.size, rnd);
    if (gives(placed)) continue;
    if (!best || placed.length > best.placed.length) best = { grid, placed };
    if (placed.length >= L.entries) break;
  }
  if (!best || best.placed.length < Math.ceil(L.entries * 0.75)) return null;
  return shape(best, { seed, level });
}
/** The grown grid cropped to its entries and numbered as a crossword is: across then down, left to right, top to bottom. */
function shape({ grid, placed }, { seed, level }) {
  const cells = [...grid.keys()].map(k => k.split(",").map(Number));
  const r0 = Math.min(...cells.map(x => x[0])), r1 = Math.max(...cells.map(x => x[0]));
  const c0 = Math.min(...cells.map(x => x[1])), c1 = Math.max(...cells.map(x => x[1]));
  const R = r1 - r0 + 1, C = c1 - c0 + 1;
  const rows = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => grid.get(`${r + r0},${c + c0}`) || BLACK).join(""));
  const starts = new Map();         // "r,c" → number, over entries' first squares
  const byStart = placed.map(p => ({ ...p, r: p.r - r0, c: p.c - c0 })).sort((a, b) => a.r - b.r || a.c - b.c);
  let num = 0;
  for (const p of byStart) {
    const key = p.r + "," + p.c;
    if (!starts.has(key)) starts.set(key, ++num);
  }
  const entries = byStart.map(p => {
    const [dr, dc] = DIRS[p.dir], len = p.item.answer.length;
    const cs = Array.from({ length: len }, (_, i) => (p.r + dr * i) * C + p.c + dc * i);
    return { num: starts.get(p.r + "," + p.c), dir: p.dir, row: p.r, col: p.c, len, cells: cs, letters: p.item.answer, kind: "word", d: p.item.d, text: p.item.text,
      other: null, enumer: String(len), answer: p.item.answer };
  });
  entries.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === "across" ? -1 : 1));
  entries.forEach((e, n) => { e.n = n; });
  return { v: 1, seed, level, kind: "numbers", mode: "classic", pool: "mixed", upto: 2, rows, entries, theme: null, grade: null };
}
