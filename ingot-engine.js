// Ingot's rules, pure (no page): a four-by-four board of bars of metal. A swipe slides every bar as far as it will go;
// two equal bars that meet merge into one of twice the value (once each per swipe, the pair nearest the wall first), and
// scores the new value. If the swipe moved anything, a new bar (a 2 nine times in ten, a 4 otherwise) lands on an empty
// square, which one and which value drawn from the game's seed and the number of the draw, so the day's board is the
// same for everyone who plays the same swipes. The end is a board with no swipe left that moves anything; the 2048 bar
// is noted when made and play goes on. The search (hint, par) is an expectimax: it takes the best of the four swipes,
// where the new bar's landing is an average over its squares and its two values. The game's idea is free (2048 was
// Gabriele Cirulli's, MIT, 2014); this code and its search are ours.
//
// A game is one object, as saved: { v, seed, mode, n (bars dealt), grid (exponents, row by row, 0 empty, e = the bar of
// value 2^e, SLAG a lump of slag; four by four, or five by five in the Great mould: the board's side is the root of its length),
// score, moves, undos, hints (left), prev (the position before the last swipe, or null), top (highest exponent), reached
// (a 2048 bar has been made), over, ended (ended by hand), and for a commission goal { e, swipes } and won }.
//
// The modes (Korbi, 23 Nov 2026: modes for Ingot, "sure try some I'll test them"): Ingot, the classic four by four; the Great
// mould, five by five, the long game; Slag, where every ninth thing poured is a lump of slag that blocks its pocket, bars sliding up
// against it, until two bars merged beside it knock it loose; and the Commission, an order to cast one bar in so many swipes, the
// swipes the search took to cast it on the same pours and a quarter more, so every commission is one that can be met.

export const N = 4, SIZE = N * N, WIN = 11, UNDOS = 3, HINTS = 3;
export const SLAG = -1;
export const DIRS = ["left", "up", "right", "down"];
export const value = e => (e > 0 ? 2 ** e : 0);
/** The modes: their board's side, and for Slag how often a lump is poured. */
export const MODES = {
  ingot: { name: "Ingot", side: 4 },
  great: { name: "Great mould", side: 5 },
  slag: { name: "Slag", side: 4, slag: 9 },
  commission: { name: "Commission", side: 4 },
};
export const modeOf = s => MODES[s?.mode] || MODES.ingot;
const sideOf = grid => Math.round(Math.sqrt(grid.length));

// ---------- the draw ----------
/** A number in [0, 1) from a seed and a draw's number: a hash, so any draw can be made without making those before it. */
function unit(seed, k) {
  let t = (seed + Math.imul(k + 1, 0x9e3779b9)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** The day's seed: one number for a date (YYYYMMDD), the same on every device. */
export const daySeed = day => (Math.imul(Number(day) || 0, 2654435761) ^ 0x1d9e7) >>> 0;

// ---------- sliding ----------
// the lines of a swipe on a board of a side, each from the wall the bars are sliding to
const LINES = new Map();
function linesOf(side) {
  if (!LINES.has(side)) {
    const k = [...Array(side).keys()], back = [...k].reverse();
    LINES.set(side, {
      left: k.map(r => k.map(c => r * side + c)), right: k.map(r => back.map(c => r * side + c)),
      up: k.map(c => k.map(r => r * side + c)), down: k.map(c => back.map(r => r * side + c)),
    });
  }
  return LINES.get(side);
}

/**
 * A swipe on a grid: { grid (the result), gain, moved, slides: [{ from, to, e (the bar that moves), into (true if it
 * merges into the bar already there) }] }. Every bar that is anywhere has a slide, even if it stays put (from === to).
 * A lump of slag stays where it is and is a wall to the bars: they slide up against it, and nothing merges across it.
 */
export function swipe(grid, dir) {
  const out = new Array(grid.length).fill(0), slides = [];
  let gain = 0, moved = false;
  for (const line of linesOf(sideOf(grid))[dir]) {
    let at = 0, last = -1;                       // where the next bar goes; the square of the last bar placed, if it can still merge
    for (let j = 0; j < line.length; j++) {
      const from = line[j], e = grid[from];
      if (e === SLAG) { out[from] = SLAG; at = j + 1; last = -1; continue; }
      if (!e) continue;
      if (last >= 0 && out[last] === e) {        // meets an equal bar that hasn't merged yet
        out[last] = e + 1;
        gain += value(e + 1);
        slides.push({ from, to: last, e, into: true });
        last = -1;
        moved = true;
      } else {
        const to = line[at++];
        out[to] = e;
        last = to;
        slides.push({ from, to, e, into: false });
        if (to !== from) moved = true;
      }
    }
  }
  return { grid: out, gain, moved, slides };
}
const empties = grid => { const r = []; for (let i = 0; i < grid.length; i++) if (!grid[i]) r.push(i); return r; };
/** Whether any swipe moves anything. */
export const alive = grid => DIRS.some(d => swipe(grid, d).moved);
/** The swipes that move something. */
export const legal = grid => DIRS.filter(d => swipe(grid, d).moved);

/** The bar the draw numbered n lands: { at, e }, or null on a full board. In Slag every ninth is a lump of slag (e SLAG). */
export function bar(grid, seed, n, mode = "ingot") {
  const free = empties(grid);
  if (!free.length) return null;
  const every = MODES[mode]?.slag;
  return { at: free[Math.floor(unit(seed, 2 * n) * free.length)], e: every && n % every === every - 1 ? SLAG : unit(seed, 2 * n + 1) < 0.9 ? 1 : 2 };
}
/** The lumps of slag that two bars merged beside knock loose: every lump next to a square a merge made. */
export function knocked(grid, slides) {
  const side = sideOf(grid), out = new Set();
  for (const s of slides) {
    if (!s.into) continue;
    const r = Math.floor(s.to / side), c = s.to % side;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < side && cc >= 0 && cc < side && grid[rr * side + cc] === SLAG) out.add(rr * side + cc);
    }
  }
  return [...out];
}

// ---------- a game ----------
const top = grid => grid.reduce((a, e) => (e > a ? e : a), 0);
/** A new game from a seed: two bars down. A commission's goal is the bar to cast (an exponent) and the swipes it may take. */
export function newGame(seed, mode = "ingot", goal = null) {
  const side = (MODES[mode] || MODES.ingot).side;
  let grid = new Array(side * side).fill(0), n = 0;
  for (let k = 0; k < 2; k++) { const b = bar(grid, seed, n++); grid = grid.slice(); grid[b.at] = b.e === SLAG ? 1 : b.e; }
  return { v: 1, seed, mode: MODES[mode] ? mode : "ingot", n, grid, score: 0, moves: 0, undos: UNDOS, hints: HINTS, prev: null, top: top(grid), reached: false, over: false, ended: false, ...(goal ? { goal, won: false } : {}) };
}

/**
 * A swipe played: { state, slides, gain, bar (the new bar: { at, e }), made (the 2048 bar made by this swipe, the first time),
 * over }, or null if it moves nothing (or the game is over). The state it leaves is a new object.
 */
export function move(state, dir) {
  if (state.over) return null;
  const r = swipe(state.grid, dir);
  if (!r.moved) return null;
  const grid = r.grid.slice(), loose = knocked(grid, r.slides);
  for (const i of loose) grid[i] = 0;
  const b = bar(grid, state.seed, state.n, state.mode);
  grid[b.at] = b.e;
  const t = top(grid), made = !state.reached && t >= WIN, moves = state.moves + 1;
  const won = !!state.goal && t >= state.goal.e;
  const over = won || (state.goal && moves >= state.goal.swipes) || !alive(grid);
  const prev = { grid: state.grid, score: state.score, n: state.n, moves: state.moves, top: state.top, reached: state.reached };
  return {
    state: { ...state, grid, n: state.n + 1, score: state.score + r.gain, moves, prev, top: t, reached: state.reached || made, over, ...(state.goal ? { won } : {}) },
    slides: r.slides, gain: r.gain, bar: b, made, over, loose,
  };
}
/** The last swipe taken back (a few a game): the position, the score and the draw as they were, so the same swipe again
 *  brings the same bar and another one brings what the draw gives there. Null if none is left. */
export function undo(state) {
  if (!state.prev || state.undos <= 0 || state.over) return null;
  return { ...state, ...state.prev, prev: null, undos: state.undos - 1 };
}
/** The game ended by hand: what's on the board stands. */
export const end = state => (state.over ? state : { ...state, over: true, ended: true, prev: null });
/** A saved game fit to open. */
export const valid = g => !!g && g.v === 1 && Array.isArray(g.grid) && g.grid.length === modeOf(g).side ** 2 && (g.mode == null || !!MODES[g.mode])
  && g.grid.every(e => Number.isInteger(e) && e >= SLAG && e < 30) && Number.isFinite(g.score) && Number.isInteger(g.n) && Number.isInteger(g.seed)
  && (!g.goal || (Number.isInteger(g.goal.e) && Number.isInteger(g.goal.swipes)));

// ---------- the search ----------
// How good a board is, for the swipe that leads to it: room to move, the big bars lined up along a wall (a row or a
// column that only rises or only falls), neighbours close in size, equal neighbours ready to merge, the biggest in a corner.
function worth(grid) {
  const side = sideOf(grid), L = linesOf(side), last = side - 1;
  let free = 0, bad = 0, pairs = 0, big = 0, slag = 0;
  for (let i = 0; i < grid.length; i++) { if (!grid[i]) free++; else if (grid[i] === SLAG) slag++; if (grid[i] > big) big = grid[i]; }
  const line = row => {
    let up = 0, down = 0, rough = 0;
    for (let k = 0; k < row.length - 1; k++) {
      const x = Math.max(0, grid[row[k]]), y = Math.max(0, grid[row[k + 1]]);
      if (y > x) up += y * y - x * x; else down += x * x - y * y;
      if (x && y) { rough += Math.abs(x - y); if (x === y) pairs++; }
    }
    bad += Math.min(up, down) * 0.7 + rough * 1.2;
  };
  for (const row of L.left) line(row);
  for (const col of L.up) line(col);
  const corner = [0, last, last * side, side * side - 1].some(i => grid[i] === big);
  return free * 24 - bad + pairs * 5 + (corner ? big * 9 : 0) - slag * 30;
}
const DEAD = -1e6;
/** The best of the four swipes, `plies` swipes deep. */
function best(grid, plies) {
  if (plies === 0) return worth(grid);
  let top = DEAD;
  for (const d of DIRS) {
    const r = swipe(grid, d);
    if (!r.moved) continue;
    const v = r.gain * 0.5 + landing(r.grid, plies - 1);
    if (v > top) top = v;
  }
  return top;
}
/** What a board is worth with the new bar still to land: the average over its squares (a few, spread, on a roomy board) and its two values. */
function landing(grid, plies) {
  if (plies === 0) return worth(grid);
  const free = empties(grid);
  if (!free.length) return DEAD;
  const take = free.length > 6 ? [0, 1, 2, 3, 4, 5].map(k => free[Math.floor((k * free.length) / 6)]) : free;
  let sum = 0;
  for (const at of take) {
    for (const [e, p] of [[1, 0.9], [2, 0.1]]) {
      grid[at] = e;
      sum += p * best(grid, plies);
      grid[at] = 0;
    }
  }
  return sum / take.length;
}
/**
 * The search's choice on a grid: { dir, scores: { dir: worth } }, or dir null if nothing moves. `plies` is how many
 * swipes it looks ahead (3 for a hint, one more when the board is nearly full; 2 is quick enough to play a whole game).
 */
export function hint(grid, plies = 3) {
  const free = empties(grid).length;
  const deep = free <= 3 ? plies + 1 : plies;
  const scores = {};
  let dir = null, top = -Infinity;
  for (const d of DIRS) {
    const r = swipe(grid, d);
    if (!r.moved) continue;
    const v = r.gain * 0.5 + landing(r.grid.slice(), deep - 1);
    scores[d] = v;
    if (v > top) { top = v; dir = d; }
  }
  return { dir, scores };
}
/**
 * A commission on a seed: { seed, goal: { e, swipes } }, the bar to cast and the swipes allowed, a quarter more than the search
 * took to cast it on the same pours (rounded up to five). A seed the search could not cast it on gives way to the next, so a
 * commission is always one that has been met.
 */
export function commission(seed, e) {
  for (let s0 = seed >>> 0, tries = 0; tries < 20; s0 = (s0 + 7919) >>> 0, tries++) {
    let s = newGame(s0, "commission");
    while (!s.over && s.top < e) { const h = hint(s.grid, 2); if (!h.dir) break; s = move(s, h.dir).state; }
    if (s.top >= e) return { seed: s0, goal: { e, swipes: Math.ceil((s.moves * 1.25) / 5) * 5 } };
  }
  return { seed, goal: { e, swipes: 2 ** e } };
}
/** A game played by the search from a state, `moves` swipes at most; the state it reaches. The par is such a game
 *  from the seed's start, played out. */
export function play(state, moves = Infinity, plies = 2) {
  let s = state;
  for (let k = 0; k < moves && !s.over; k++) {
    const h = hint(s.grid, plies);
    if (!h.dir) { s = end(s); break; }
    s = move(s, h.dir).state;
  }
  return s;
}
