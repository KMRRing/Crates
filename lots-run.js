// A board as one player plays it (README, Lots), with no page in it: the page keeps it in lots:run as it changes, so a
// reload, another device or a partner watching sees it as it stands. Two ways to play:
//  - classic: pick four, submit; "one away" when three of them are a lot; the fourth mistake ends it;
//  - the wall (Only Connect's): two and a half minutes, the fourth pick is the guess, no "one away", guesses free until
//    two lots are found and three lives after; then every lot's link is named from four, found or not.
import { SIZE, MISTAKES, WALL, BY_ID, classify, comboKey, points, wallPoints, reverseRainbow, namingOptions, shuffle, seeded } from "./lots-engine.js";
import { plan as rivalPlan, at as rivalAt, RIVALS } from "./lots-bot.js";

export const RUN_V = 1;

/** A fresh run of a board. kind: "random", "daily" (with its day) or "race"; rival: a computer level, classic only. */
export function newRun({ board, kind = "random", day = null, mode = "classic", rival = null, n = 1 }) {
  const wall = mode === "wall";
  return {
    v: RUN_V, n, kind, ...(day ? { day } : {}), mode: wall ? "wall" : "classic", level: board.level, board,
    order: shuffle(board.g.flatMap(g => g.w), seeded((board.seed ^ 0x6c078965) >>> 0)),
    sel: [], found: [], guesses: [], mistakes: 0, ms: 0, done: false, won: false,
    ...(wall ? { lives: null, out: null, names: [] } : {}),
    ...(rival && !wall && RIVALS[rival] ? { rival: { level: rival, plan: rivalPlan(board, rival, board.seed) } } : {}),
  };
}
/** Whether a stored run is one this code can play on. */
export const isRun = r => r?.v === RUN_V && r.board?.g?.length === SIZE && r.board.g.every(g => BY_ID.has(g.c) && g.w?.length === SIZE)
  && Array.isArray(r.order) && r.order.length === SIZE * SIZE && Array.isArray(r.sel) && Array.isArray(r.found) && Array.isArray(r.guesses) && Number.isFinite(r.ms);

const lotOf = (r, w) => r.board.g.findIndex(g => g.w.includes(w));
export const placedOf = r => new Set(r.found.flatMap(k => r.board.g[k].w));
/** The words still to place, in the board's order. */
export const leftOf = r => { const p = placedOf(r); return r.order.filter(w => !p.has(w)); };
/** "play", "name" (the wall frozen: links to name) or "over". */
export const phaseOf = r => (r.done ? "over" : r.mode === "wall" && r.out ? "name" : "play");

/** A tap on a word: in or out of the picks. On the wall the fourth pick is the guess: its result comes back. */
export function pick(r, word) {
  if (phaseOf(r) !== "play" || placedOf(r).has(word) || !r.order.includes(word)) return null;
  if (r.sel.includes(word)) { r.sel = r.sel.filter(w => w !== word); return { sel: "off" }; }
  if (r.sel.length >= SIZE) return null;
  r.sel = [...r.sel, word];
  return r.mode === "wall" && r.sel.length === SIZE ? submit(r) : { sel: "on" };
}
export const clearPicks = r => { const had = r.sel.length > 0; r.sel = []; return had; };
/** Shuffles the words still in play (the board's order is the run's: a reload keeps it). */
export function shuffleLeft(r, rng = Math.random) {
  const p = placedOf(r), left = shuffle(r.order.filter(w => !p.has(w)), rng);
  r.order = [...r.order.filter(w => p.has(w)), ...left];
}

/** The picks as a guess: { res: "right" | "one" | "miss" | "wrong" (the wall says no more), g }, or { why }. */
export function submit(r) {
  if (phaseOf(r) !== "play") return { why: "over" };
  if (r.sel.length !== SIZE) return { why: "four" };
  const key = comboKey(r.sel);
  if (r.guesses.some(x => comboKey(x.w) === key)) { if (r.mode === "wall") r.sel = []; return { why: "tried" }; }
  const c = classify(r.board, r.sel), at = Math.round(r.ms);
  const res = c.res === "right" ? "right" : r.mode === "wall" ? "wrong" : c.res;
  r.guesses.push({ w: r.sel, r: res, at });
  if (res === "right") {
    r.found.push(c.g);
    r.sel = [];
    if (r.found.length === SIZE - 1) r.found.push(r.board.g.findIndex((_, k) => !r.found.includes(k)));   // the last four can only be one lot
    if (r.mode === "wall" && r.found.length >= WALL.free && r.lives == null && r.found.length < SIZE) r.lives = WALL.lives;
    if (r.found.length === SIZE) end(r, "solved");
    return { res, g: c.g };
  }
  if (r.mode === "wall") {
    r.sel = [];
    if (r.lives != null && --r.lives <= 0) end(r, "lives");
  } else if (++r.mistakes >= MISTAKES) end(r, "mistakes");
  return { res };
}
function end(r, how) {
  r.sel = [];
  if (r.mode === "wall") { r.out = how; r.won = r.found.length === SIZE; return; }   // the naming comes next
  r.done = true;
  r.won = how === "solved";
}
/** Time on the board, booked by the page; the wall freezes when its clock runs out. */
export function tick(r, ms) {
  if (r.done || (r.mode === "wall" && r.out)) return false;
  r.ms += Math.max(0, ms);
  if (r.mode === "wall" && r.ms >= WALL.ms) { r.ms = WALL.ms; end(r, "time"); return true; }
  return false;
}
export const wallLeft = r => Math.max(0, WALL.ms - r.ms);

// ---------- the wall's naming ----------
/** The lot to name next (every lot, found or not, in the board's order), or null. */
export const toName = r => (phaseOf(r) === "name" ? r.names.length : null);
export const namingFor = (r, k) => namingOptions(r.board, k, r.board.seed);
export function nameLot(r, pickId) {
  const k = toName(r);
  if (k == null || !namingFor(r, k).includes(pickId)) return null;
  const right = pickId === r.board.g[k].c;
  r.names.push({ g: k, pick: pickId, right });
  if (r.names.length === SIZE) r.done = true;
  return { right, g: k };
}

// ---------- the result ----------
/** Points: classic, a point a lot and once solved one for each mistake to spare (8); the wall, Only Connect's (10). */
export const scoreOf = r => (r.mode === "wall" ? wallPoints(r.found.length, r.names.filter(x => x.right).length) : points(r.found.length, r.mistakes, r.won));
export const maxScore = r => (r.mode === "wall" ? 2 * SIZE + WALL.bonus : 2 * SIZE);
/** A day's result as one number, higher better: points, then the quicker the better (Crates' form, "7/8 in 1:42"). */
export const dayScore = r => scoreOf(r) * 100000 + (99999 - Math.min(99999, Math.round(r.ms / 1000)));
/** Lots found hardest first: the players' reverse rainbow. */
export const rainbow = r => r.mode === "classic" && r.won && reverseRainbow(r.found);
/** The rival at this point of the board, or null. */
export const rivalNow = r => (r.rival ? rivalAt(r.rival.plan, r.ms) : null);
/**
 * You against the computer, once you're done: 1 you won, -1 it did, 0 level: the more points, then the quicker; its
 * game is fixed at the deal, so where it ends is known even while it's still playing.
 */
export function versus(r) {
  if (!r.rival || !r.done) return null;
  const them = rivalAt(r.rival.plan, Infinity), theirs = points(them.found.length, them.mistakes, them.won);
  const mine = scoreOf(r);
  if (mine !== theirs) return { result: mine > theirs ? 1 : -1, theirs, ms: them.end };
  return { result: Math.sign(them.end - r.ms) || 0, theirs, ms: them.end };
}
