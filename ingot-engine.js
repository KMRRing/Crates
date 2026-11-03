// Ingot's rules, pure (no page): a four-by-four board of bars of metal. A swipe slides every bar as far as it will go;
// two equal bars that meet merge into one of twice the value (once each per swipe, the pair nearest the wall first), and
// scores the new value. If the swipe moved anything, a new bar (a 2 nine times in ten, a 4 otherwise) lands on an empty
// square, which one and which value drawn from the game's seed and the number of the draw, so the day's board is the
// same for everyone who plays the same swipes. The end is a board with no swipe left that moves anything; the 2048 bar
// is noted when made and play goes on. The search (hint, par) is an expectimax: it takes the best of the four swipes,
// where the new bar's landing is an average over its squares and its two values. The game's idea is free (2048 was
// Gabriele Cirulli's, MIT, 2014); this code and its search are ours.
//
// A game is one object, as saved: { v, seed, n (bars dealt), grid (16 exponents, 0 empty, e = the bar of value 2^e),
// score, moves, undos, hints (left), prev (the position before the last swipe, or null), top (highest exponent), reached
// (a 2048 bar has been made), over, ended (ended by hand) }.

export const N = 4, SIZE = N * N, WIN = 11, UNDOS = 3, HINTS = 3;
export const DIRS = ["left", "up", "right", "down"];
export const value = e => (e ? 2 ** e : 0);

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
// the four lines of a swipe, each from the wall the bars are sliding to
const LINES = {
  left: [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => r * N + c)),
  right: [0, 1, 2, 3].map(r => [3, 2, 1, 0].map(c => r * N + c)),
  up: [0, 1, 2, 3].map(c => [0, 1, 2, 3].map(r => r * N + c)),
  down: [0, 1, 2, 3].map(c => [3, 2, 1, 0].map(r => r * N + c)),
};

/**
 * A swipe on a grid: { grid (the result), gain, moved, slides: [{ from, to, e (the bar that moves), into (true if it
 * merges into the bar already there) }] }. Every bar that is anywhere has a slide, even if it stays put (from === to).
 */
export function swipe(grid, dir) {
  const out = new Array(SIZE).fill(0), slides = [];
  let gain = 0, moved = false;
  for (const line of LINES[dir]) {
    let at = 0, last = -1;                       // where the next bar goes; the square of the last bar placed, if it can still merge
    for (const from of line) {
      const e = grid[from];
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
const empties = grid => { const r = []; for (let i = 0; i < SIZE; i++) if (!grid[i]) r.push(i); return r; };
/** Whether any swipe moves anything. */
export const alive = grid => DIRS.some(d => swipe(grid, d).moved);
/** The swipes that move something. */
export const legal = grid => DIRS.filter(d => swipe(grid, d).moved);

/** The bar the draw numbered n lands: { at, e }, or null on a full board. */
export function bar(grid, seed, n) {
  const free = empties(grid);
  if (!free.length) return null;
  return { at: free[Math.floor(unit(seed, 2 * n) * free.length)], e: unit(seed, 2 * n + 1) < 0.9 ? 1 : 2 };
}

// ---------- a game ----------
const top = grid => grid.reduce((a, e) => (e > a ? e : a), 0);
/** A new game from a seed: two bars down. */
export function newGame(seed) {
  let grid = new Array(SIZE).fill(0), n = 0;
  for (let k = 0; k < 2; k++) { const b = bar(grid, seed, n++); grid = grid.slice(); grid[b.at] = b.e; }
  return { v: 1, seed, n, grid, score: 0, moves: 0, undos: UNDOS, hints: HINTS, prev: null, top: top(grid), reached: false, over: false, ended: false };
}

/**
 * A swipe played: { state, slides, gain, bar (the new bar: { at, e }), made (the 2048 bar made by this swipe, the first time),
 * over }, or null if it moves nothing (or the game is over). The state it leaves is a new object.
 */
export function move(state, dir) {
  if (state.over) return null;
  const r = swipe(state.grid, dir);
  if (!r.moved) return null;
  const b = bar(r.grid, state.seed, state.n);
  const grid = r.grid.slice();
  grid[b.at] = b.e;
  const t = top(grid), made = !state.reached && t >= WIN;
  const over = !alive(grid);
  const prev = { grid: state.grid, score: state.score, n: state.n, moves: state.moves, top: state.top, reached: state.reached };
  return {
    state: { ...state, grid, n: state.n + 1, score: state.score + r.gain, moves: state.moves + 1, prev, top: t, reached: state.reached || made, over },
    slides: r.slides, gain: r.gain, bar: b, made, over,
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
export const valid = g => !!g && g.v === 1 && Array.isArray(g.grid) && g.grid.length === SIZE && g.grid.every(e => Number.isInteger(e) && e >= 0 && e < 30)
  && Number.isFinite(g.score) && Number.isInteger(g.n) && Number.isInteger(g.seed);

// ---------- the search ----------
// How good a board is, for the swipe that leads to it: room to move, the big bars lined up along a wall (a row or a
// column that only rises or only falls), neighbours close in size, equal neighbours ready to merge, the biggest in a corner.
function worth(grid) {
  let free = 0, bad = 0, pairs = 0, big = 0;
  for (let i = 0; i < SIZE; i++) { if (!grid[i]) free++; if (grid[i] > big) big = grid[i]; }
  const line = (a, b, c, d) => {
    let up = 0, down = 0, rough = 0;
    const row = [a, b, c, d];
    for (let k = 0; k < 3; k++) {
      const x = row[k], y = row[k + 1];
      if (y > x) up += y * y - x * x; else down += x * x - y * y;
      if (x && y) { rough += Math.abs(x - y); if (x === y) pairs++; }
    }
    bad += Math.min(up, down) * 0.7 + rough * 1.2;
  };
  for (let r = 0; r < N; r++) line(grid[r * N], grid[r * N + 1], grid[r * N + 2], grid[r * N + 3]);
  for (let c = 0; c < N; c++) line(grid[c], grid[c + N], grid[c + 2 * N], grid[c + 3 * N]);
  const corner = grid[0] === big || grid[3] === big || grid[12] === big || grid[15] === big;
  return free * 24 - bad + pairs * 5 + (corner ? big * 9 : 0);
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
