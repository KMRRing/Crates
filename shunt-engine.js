// Shunt's rules, pure (no page): a rail yard of six tracks across and six down, wagons of four cargoes standing on it.
// Each turn the incoming wagon is shoved onto a track from either end: the wagons on it roll along until the first gap
// closes; a full track shoves its far-end wagon off the rails, and a derailment costs one of three lives. Three or more
// alike in a line, across or down, couple up and depart. Every few shoves a goods train leaves a wagon of its own on an
// empty square, more often as the game goes on. The page (shunt.js) draws it; tests/shunt.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a cargo 0–3 a square, -1 empty, row by row), next
// (the wagon coming and the one after), shoves, untilDrop, lives, score, over }.

export const N = 6, CARGOES = 4, LIVES = 3, START = 8;
// the goods train: until so many shoves, every so many shoves, so many wagons; unhurried at first, then more and more
// often, so a long game ends
export const PACE = [[20, 3, 1], [50, 2, 1], [100, 1, 1], [160, 1, 2], [Infinity, 1, 3]];
const paceAt = shoves => PACE.find(([until]) => shoves < until);
export const dropEvery = shoves => paceAt(shoves)[1];
export const dropCount = shoves => paceAt(shoves)[2];
export const SIDES = ["left", "right", "top", "bottom"];

const idx = (x, y) => y * N + x;
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

/** The squares of a track, from the end a wagon is shoved in at. */
export function track(side, line) {
  const out = [];
  for (let k = 0; k < N; k++) {
    if (side === "left") out.push(idx(k, line));
    else if (side === "right") out.push(idx(N - 1 - k, line));
    else if (side === "top") out.push(idx(line, k));
    else out.push(idx(line, N - 1 - k));
  }
  return out;
}

/** Every run of three or more alike, across or down: the squares in them (a square in two runs counted once). */
export function runs(cells) {
  const hit = new Set();
  const scan = line => {
    let start = 0;
    for (let k = 1; k <= line.length; k++) {
      if (k < line.length && cells[line[k]] >= 0 && cells[line[k]] === cells[line[start]]) continue;
      if (cells[line[start]] >= 0 && k - start >= 3) for (let j = start; j < k; j++) hit.add(line[j]);
      start = k;
    }
  };
  for (let l = 0; l < N; l++) { scan(track("left", l)); scan(track("top", l)); }
  return [...hit].sort((a, b) => a - b);
}
/** Would a wagon of this cargo on this square stand in a run of three? */
const wouldRun = (cells, i, c) => { const t = cells.slice(); t[i] = c; return runs(t).includes(i); };
/** A cargo for a square that makes no run there (a wagon left by the goods train never departs by itself). */
function quiet(s, cells, i) {
  const ok = [...Array(CARGOES).keys()].filter(c => !wouldRun(cells, i, c));
  return ok.length ? ok[pick(s, ok.length)] : pick(s, CARGOES);
}

/** A new game from a seed: START wagons standing about the yard, none in a run. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: new Array(N * N).fill(-1), next: [], shoves: 0, untilDrop: dropEvery(0), lives: LIVES, score: 0, over: false };
  for (let k = 0; k < START; k++) {
    const empty = s.cells.flatMap((c, i) => (c < 0 ? [i] : []));
    const i = empty[pick(s, empty.length)];
    s.cells[i] = quiet(s, s.cells, i);
  }
  s.next = [pick(s, CARGOES), pick(s, CARGOES)];
  return s;
}
/** Ten times the square of the wagons that depart in one shove. */
export const worth = n => 10 * n * n;

/**
 * The incoming wagon shoved onto a track ({ side, line }), before anything departs: { cells (the yard after the roll),
 * moved ([from, to] squares of the wagons that rolled, the new one from -1), derailed (the square of the wagon shoved
 * off, or -1), departed (the squares of the runs it makes) }. What a shove would do, for the page to show beforehand.
 */
export function roll(game, { side, line }) {
  const cells = game.cells.slice(), t = track(side, line), gap = t.findIndex(i => cells[i] < 0);
  const end = gap < 0 ? N - 1 : gap, moved = [];
  // the wagons from the shoved end up to the gap roll on a square (on a full track, the last one off the far end)
  for (let k = end; k > 0; k--) { if (cells[t[k - 1]] >= 0) moved.push([t[k - 1], t[k]]); cells[t[k]] = cells[t[k - 1]]; }
  cells[t[0]] = game.next[0];
  moved.push([-1, t[0]]);
  return { cells, moved, derailed: gap < 0 ? t[N - 1] : -1, departed: runs(cells) };
}

/**
 * Shoves the incoming wagon onto a track: the game after it, and what happened, for the page to show: roll's, and
 * gain, dropped (the squares the goods train left wagons on), over. Pure: the game passed in is left as it was.
 */
export function shove(game, move) {
  const s = structuredClone(game);
  if (s.over) return { state: s, moved: [], derailed: -1, departed: [], gain: 0, dropped: [], over: true };
  const r = roll(s, move);
  s.cells = r.cells.slice();   // roll's own stays the yard before anything departs, for the page to play out
  if (r.derailed >= 0) s.lives--;
  for (const i of r.departed) s.cells[i] = -1;
  const gain = r.departed.length ? worth(r.departed.length) : 0;
  s.score += gain;
  s.shoves++;
  s.next = [s.next[1], pick(s, CARGOES)];
  // the goods train: wagons of its own every few shoves, on empty squares, each standing in no run
  const dropped = [];
  if (--s.untilDrop <= 0) {
    for (let k = dropCount(s.shoves - 1); k > 0; k--) {
      const empty = s.cells.flatMap((c, i) => (c < 0 ? [i] : []));
      if (!empty.length) break;
      const i = empty[pick(s, empty.length)];
      s.cells[i] = quiet(s, s.cells, i);
      dropped.push(i);
    }
    s.untilDrop = dropEvery(s.shoves);
  }
  if (s.lives <= 0) s.over = true;
  return { state: s, ...r, gain, dropped, over: s.over };
}

/** Every shove there is: [{ side, line, result }]. For the tests and the tuning player. */
export const shoves = s => SIDES.flatMap(side => [...Array(N).keys()].map(line => ({ side, line, result: shove(s, { side, line }) })));
/** How full the yard is. */
export const filled = s => s.cells.filter(c => c >= 0).length;
