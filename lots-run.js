// A board as one player plays it (README, Lots), with no page in it: the page keeps it in lots:run as it changes, so a
// reload, another device or a partner watching sees it as it stands. Pick four, submit; "one away" when three of them
// are a lot; the fourth mistake ends it.
import { SIZE, MISTAKES, BY_ID, classify, comboKey, points, reverseRainbow, shuffle, seeded } from "./lots-engine.js";

export const RUN_V = 1;

/** A fresh run of a board. kind: "random", "daily" (with its day) or "race". */
export function newRun({ board, kind = "random", day = null, n = 1 }) {
  return {
    v: RUN_V, n, kind, ...(day ? { day } : {}), level: board.level, board,
    order: shuffle(board.g.flatMap(g => g.w), seeded((board.seed ^ 0x6c078965) >>> 0)),
    sel: [], found: [], guesses: [], mistakes: 0, ms: 0, done: false, won: false,
  };
}
/** Whether a stored run is one this code can play on (a board begun on the wall, which Lots no longer has, is not). */
export const isRun = r => r?.v === RUN_V && r.mode !== "wall" && r.board?.g?.length === SIZE && r.board.g.every(g => BY_ID.has(g.c) && g.w?.length === SIZE)
  && Array.isArray(r.order) && r.order.length === SIZE * SIZE && Array.isArray(r.sel) && Array.isArray(r.found) && Array.isArray(r.guesses) && Number.isFinite(r.ms);

export const placedOf = r => new Set(r.found.flatMap(k => r.board.g[k].w));
/** The words still to place, in the board's order. */
export const leftOf = r => { const p = placedOf(r); return r.order.filter(w => !p.has(w)); };

/** A tap on a word: in or out of the picks. */
export function pick(r, word) {
  if (r.done || placedOf(r).has(word) || !r.order.includes(word)) return null;
  if (r.sel.includes(word)) { r.sel = r.sel.filter(w => w !== word); return { sel: "off" }; }
  if (r.sel.length >= SIZE) return null;
  r.sel = [...r.sel, word];
  return { sel: "on" };
}
export const clearPicks = r => { const had = r.sel.length > 0; r.sel = []; return had; };
/** Shuffles the words still in play (the board's order is the run's: a reload keeps it). */
export function shuffleLeft(r, rng = Math.random) {
  const p = placedOf(r), left = shuffle(r.order.filter(w => !p.has(w)), rng);
  r.order = [...r.order.filter(w => p.has(w)), ...left];
}

/** The picks as a guess: { res: "right" | "one" | "miss", g }, or { why }. */
export function submit(r) {
  if (r.done) return { why: "over" };
  if (r.sel.length !== SIZE) return { why: "four" };
  const key = comboKey(r.sel);
  if (r.guesses.some(x => comboKey(x.w) === key)) return { why: "tried" };
  const c = classify(r.board, r.sel), at = Math.round(r.ms);
  r.guesses.push({ w: r.sel, r: c.res, at });
  if (c.res === "right") {
    r.found.push(c.g);
    r.sel = [];
    if (r.found.length === SIZE - 1) r.found.push(r.board.g.findIndex((_, k) => !r.found.includes(k)));   // the last four can only be one lot
    if (r.found.length === SIZE) end(r, true);
    return { res: "right", g: c.g };
  }
  if (++r.mistakes >= MISTAKES) end(r, false);
  return { res: c.res };
}
function end(r, won) {
  r.sel = [];
  r.done = true;
  r.won = won;
}
/** Time on the board, booked by the page. */
export function tick(r, ms) { if (!r.done) r.ms += Math.max(0, ms); }

// ---------- the result ----------
/** Points: a point a lot and, once solved, one for each mistake to spare (8). */
export const scoreOf = r => points(r.found.length, r.mistakes, r.won);
export const maxScore = () => 2 * SIZE;
/** A day's result as one number, higher better: points, then the quicker the better (Crates' form, "7/8 in 1:42"). */
export const dayScore = r => scoreOf(r) * 100000 + (99999 - Math.min(99999, Math.round(r.ms / 1000)));
/** Lots found hardest first: the players' reverse rainbow. */
export const rainbow = r => r.won && reverseRainbow(r.found);
