// Drift's rules, pure (no page). Crates of four goods lie on a quay, a mask on a grid (drift-shapes.js: an open square,
// a ship's hull, a pier...; water round it and inside it). Each turn you lay the next crate on any empty square of the
// quay; then the wind blows and every crate slides downwind until it meets the edge of the quay, another crate, a rock
// or a moored one, keeping its order, as in 2048 (where you choose the way and the game lays the tile; here the forecast
// chooses the way and you lay it). Three or more of a good in a line, across or down, are shipped, and the wind keeps
// blowing, so one shipment can line up the next. A line runs only over quay: water breaks it, as it stops a slide.
//
// The queue is shown QUEUE turns ahead: the crate to lay, the wind and the events of each turn. Events (introduced one
// to a section in drift-levels.js): a squall blows stray crates on to empty squares, a rogue wave shoves a row or a
// column one square, a second gust follows the wind at once, fog hides the queue beyond the turn, a rock rises from the
// water on an empty square, a crate comes moored (it stays put whatever the wind) or with the harbour master's seal
// (it ships every crate of its good). A squall's strays and a rock are drawn on the squares they will take, and no crate
// can be laid there; the turn shown beforehand is lay() itself, so it is the turn you get.
//
// A game is one object, as saved: { v: 2, seed, n (draws made), shape, cells (a good 0-3, -1 empty, -2 water or rock,
// row by row), stakes (the moored squares), rocks, next (the QUEUE crates to lay: { c, k: 0 plain, 1 moored, 2 sealed }),
// plan (the QUEUE turns: { w (0 north, 1 east, 2 south, 3 west: the way it blows the crates), w2 (a second gust),
// squall (how many strays), wave: { axis: 0 row 1 column, at, dir }, rock, fog }), strays ([{ at, colour }] this turn's
// squall), reef (this turn's rock, a square, or -1), turns, sqAt (the turn of the next squall), score, shipped, status
// "play" | "won" | "lost", why }. What a game is played by, its rules, is not saved with it: it is drift-levels.js's.
import { SHAPES } from "./drift-shapes.js";

export const GOODS = 4, QUEUE = 5, EMPTY = -1, WATER = -2;
export const NAMES = ["salt", "grain", "cloth", "timber"];
export const WINDS = ["north", "east", "south", "west"];
export const PLAIN = 0, MOORED = 1, SEALED = 2;
// the squalls of an endless game: until so many turns, every so many turns, so many stray crates
export const PACE = [[15, 2, 1], [40, 1, 1], [80, 1, 2], [150, 1, 3], [Infinity, 1, 4]];
const paceAt = t => PACE.find(([until]) => t < until);

/** Rules with their gaps filled: no events, four goods in equal measure, random winds. */
export function rules(r) {
  return { shape: "quay", mix: [1, 1, 1, 1], goods: GOODS, windMode: "random", start: 6, moor: 0, seal: 0, squall: null, gust: null, wave: null, fog: null, rock: null, orders: null, turns: null, runs: [], ...r };
}

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const next = s => draw(s.seed, s.n++);
const pick = (s, k) => Math.floor(next(s) * k);
const clone = s => ({ ...s, cells: s.cells.slice(), stakes: s.stakes.slice(), rocks: s.rocks.slice(), next: s.next.map(x => ({ ...x })), plan: s.plan.map(p => ({ ...p, wave: p.wave && { ...p.wave } })), strays: s.strays.map(q => ({ ...q })), shipped: s.shipped.slice() });

// ---------- the quay: segments, the stretches of quay a crate can slide along or a line can run over ----------
const geometry = new Map();
/** The rows and the columns of the quay cut at water and rocks: { h: [[squares west to east]], v: [[north to south]] }. */
export function geo(shape, cells) {
  const key = shape + ":" + cells.map(c => (c === WATER ? 1 : 0)).join("");
  let g = geometry.get(key);
  if (g) return g;
  const { w, h } = SHAPES[shape], segs = at => {
    const out = [];
    for (let k = 0; k < (at.rows ? h : w); k++) {
      let cur = [];
      for (let j = 0; j < (at.rows ? w : h); j++) {
        const i = at.rows ? k * w + j : j * w + k;
        if (cells[i] === WATER) { if (cur.length) out.push(cur); cur = []; } else cur.push(i);
      }
      if (cur.length) out.push(cur);
    }
    return out;
  };
  g = { h: segs({ rows: true }), v: segs({ rows: false }) };
  if (geometry.size > 400) geometry.clear();
  geometry.set(key, g);
  return g;
}
/** The segments with the downwind end first. */
const lanes = (g, wind) => (wind === 0 ? g.v : wind === 2 ? g.v.map(l => l.slice().reverse()) : wind === 3 ? g.h : g.h.map(l => l.slice().reverse()));
/** The squares in a quay (not water, not rock). */
export const quayOf = shape => SHAPES[shape].open.flatMap((o, i) => (o ? [i] : []));

/**
 * The quay after the wind: every crate slid downwind as far as it goes, in order, to the edge of its segment, the next
 * crate or a moored one (stakes, the squares of the crates that stay put); and which crate went where.
 */
export function blow(shape, cells, wind, stakes = []) {
  const out = cells.map(c => (c === WATER ? WATER : EMPTY)), moved = [], fixed = new Set(stakes);
  for (const lane of lanes(geo(shape, cells), wind)) {
    let k = 0;
    lane.forEach((i, j) => {
      if (cells[i] < 0) return;
      if (fixed.has(i)) { out[i] = cells[i]; k = j + 1; return; }
      out[lane[k]] = cells[i];
      if (lane[k] !== i) moved.push([i, lane[k]]);
      k++;
    });
  }
  return { cells: out, moved };
}
/** For every square in a line of three or more alike (across or down), the longest such line through it. */
export function lineRuns(shape, cells) {
  const hit = new Map(), g = geo(shape, cells);
  for (const seg of [...g.h, ...g.v]) {
    let start = 0;
    for (let j = 1; j <= seg.length; j++) {
      const c = cells[seg[start]];
      if (j < seg.length && c >= 0 && cells[seg[j]] === c) continue;
      if (c >= 0 && j - start >= 3) for (let q = start; q < j; q++) hit.set(seg[q], Math.max(hit.get(seg[q]) || 0, j - start));
      start = j;
    }
  }
  return hit;
}
/** The squares in a line of three or more alike, across or down (each once). */
export const lines = (shape, cells) => [...lineRuns(shape, cells).keys()].sort((a, b) => a - b);
const empties = cells => cells.flatMap((c, i) => (c === EMPTY ? [i] : []));
/** A good for an empty square that makes no line there as things stand. */
function quiet(s, cells, i, goods) {
  const ok = [...Array(goods).keys()].filter(c => { const t = cells.slice(); t[i] = c; return !lines(s.shape, t).includes(i); });
  return ok.length ? ok[pick(s, ok.length)] : pick(s, goods);
}

/**
 * A rogue wave: every crate in a row (axis 0) or column (axis 1) at `at` is shoved one square east or south (dir 1) or
 * west or north (-1) if the square beyond is empty quay, the leading one first; moored crates don't move.
 */
export function shove(shape, cells, wave, stakes = []) {
  const { w, h } = SHAPES[shape], out = cells.slice(), moved = [], fixed = new Set(stakes);
  const len = wave.axis === 0 ? w : h, step = wave.axis === 0 ? 1 : w, from = (wave.axis === 0 ? wave.at * w : wave.at);
  for (let j = 0; j < len; j++) {
    const q = wave.dir > 0 ? len - 1 - j : j, i = from + q * step, t = i + wave.dir * step;
    if (out[i] < 0 || fixed.has(i) || q + wave.dir < 0 || q + wave.dir >= len || out[t] !== EMPTY) continue;
    out[t] = out[i];
    out[i] = EMPTY;
    moved.push([i, t]);
  }
  return { cells: out, moved };
}

// ---------- the deal ----------
const crate = (s, r, m) => {
  const mix = r.mix.slice(0, r.goods), tot = mix.reduce((a, b) => a + b, 0);
  let x = next(s) * tot, c = mix.length - 1;
  for (let g = 0; g < mix.length; g++) if ((x -= mix[g]) < 0) { c = g; break; }
  // the mth crate of the game: every `moor`th moored, every `seal`th sealed
  return { c, k: r.moor && m % r.moor === r.moor - 1 ? MOORED : r.seal && m % r.seal === r.seal - 1 ? SEALED : PLAIN };
};
const lastWind = s => s.plan[s.plan.length - 1]?.w;
function windOf(s, r, last) {
  const x = next(s);
  if (r.windMode === "trade" && last != null) { if (x < 0.7) return last; const o = [0, 1, 2, 3].filter(w => w !== last); return o[pick(s, 3)]; }
  return Math.floor(x * 4);
}
const sqEvery = (r, t) => (r.squall.pace ? paceAt(t)[1] : r.squall.every);
const sqCount = (r, t) => (r.squall.pace ? paceAt(t)[2] : r.squall.count || 1);
const goes = (e, t, s) => e && t >= (e.from || 0) && next(s) < e.p;
/** The plan of turn t (the rock and wave events only while there is room for them). */
function planFor(s, r, t) {
  const p = { w: windOf(s, r, lastWind(s)) };
  if (r.squall && t === s.sqAt) { p.squall = sqCount(r, t); s.sqAt = t + sqEvery(r, t + 1); return p; }
  const pendingRocks = s.plan.filter(q => q.rock).length;
  if (r.rock && s.rocks.length + pendingRocks < r.rock.max && goes(r.rock, t, s)) p.rock = true;
  else if (goes(r.wave, t, s)) { const axis = pick(s, 2), dim = SHAPES[s.shape][axis ? "w" : "h"]; p.wave = { axis, at: pick(s, dim), dir: pick(s, 2) ? 1 : -1 }; }
  else if (goes(r.gust, t, s)) { const o = [0, 1, 2, 3].filter(w => w !== p.w); p.w2 = o[pick(s, 3)]; }
  else if (goes(r.fog, t, s)) p.fog = true;
  return p;
}
/** This turn's omens, drawn from the game's seed: a squall's strays (each on an empty square at random, in a good that makes no line there, never on the last empty square) and a rock's square. */
function omens(r, s) {
  const p = s.plan[0];
  s.strays = []; s.reef = -1;
  const cells = s.cells.slice();
  if (p.squall) for (let k = Math.min(p.squall, empties(cells).length - 1); k > 0; k--) {
    const free = empties(cells), j = free[pick(s, free.length)];
    cells[j] = quiet(s, cells, j, r.goods);
    s.strays.push({ at: j, colour: cells[j] });
  }
  if (p.rock) {
    const free = empties(cells);
    if (free.length >= 3) s.reef = free[pick(s, free.length)];
  }
}

/** A new game from a seed: `start` crates lying about, none in a line, the queue dealt. */
export function newGame(r, seed) {
  const shape = SHAPES[r.shape];
  const s = { v: 2, seed: seed >>> 0, n: 0, shape: shape.id, cells: shape.open.map(o => (o ? EMPTY : WATER)), stakes: [], rocks: [], next: [], plan: [], turns: 0, sqAt: r.squall ? sqEvery(r, 0) - 1 : -1, strays: [], reef: -1, score: 0, shipped: new Array(GOODS).fill(0), status: "play", why: "" };
  for (let k = 0; k < r.start; k++) { const free = empties(s.cells), i = free[pick(s, free.length)]; s.cells[i] = quiet(s, s.cells, i, r.goods); }
  for (let k = 0; k < QUEUE; k++) s.next.push(crate(s, r, k));
  for (let k = 0; k < QUEUE; k++) s.plan.push(planFor(s, r, k));
  omens(r, s);
  return s;
}
/** A game saved before this one (v1: the square field of seven, tiles, three winds) made into this one. */
export function upgrade(r, game) {
  if (game.v === 2) return game;
  const s = { v: 2, seed: game.seed, n: game.n, shape: "quay", cells: game.cells.slice(), stakes: game.stakes || [], rocks: [], next: [], plan: [], turns: game.turns, sqAt: game.turns + (game.untilSquall || 1) - 1, strays: (game.strays || []).map(q => ({ ...q })), reef: -1, score: game.score, shipped: [0, 0, 0, 0], status: game.over ? "lost" : "play", why: game.over ? "The quay is full." : "" };
  for (let k = 0; k < QUEUE; k++) s.next.push(k < 2 ? { c: game.next[k], k: (game.turns + k) % 6 === 5 ? MOORED : PLAIN } : crate(s, r, game.turns + k));
  for (let k = 0; k < QUEUE; k++) {
    const t = game.turns + k;
    if (k >= 3) { s.plan.push(planFor(s, r, t)); continue; }
    const p = { w: game.winds[k] };
    if (r.squall && t === s.sqAt) { p.squall = sqCount(r, t); s.sqAt = t + sqEvery(r, t + 1); }
    s.plan.push(p);
  }
  return s;
}
const strayAt = (s, i) => s.strays.some(q => q.at === i) || s.reef === i;
/** Every square a crate can go on: empty, and no stray or rock coming. */
export const moves = s => (s.status === "play" ? empties(s.cells).filter(i => !strayAt(s, i)) : []);
export const room = s => empties(s.cells).length;
export const filled = s => s.cells.filter(c => c >= 0).length;

/**
 * The winds over a quay until it settles: it blows, the lines it makes ship, and it blows again while anything ships;
 * then the next wind of the turn, if there is one. runs[c] is the shortest line that counts for good c's order (3 unless
 * stated): ok counts the crates that qualify. { cells, stakes, gusts ([{ wind, moved, cleared }]), cleared, by, ok }.
 */
export function gale(shape, cells, winds, stakes = [], runs = []) {
  let now = cells.slice(), cleared = 0, fixed = stakes.slice();
  const gusts = [], by = new Array(GOODS).fill(0), ok = new Array(GOODS).fill(0);
  for (const wind of [].concat(winds)) for (;;) {
    const b = blow(shape, now, wind, fixed), rl = lineRuns(shape, b.cells), found = [...rl.keys()].sort((a, c) => a - c);
    now = b.cells;
    gusts.push({ wind, moved: b.moved, cleared: found });
    if (!found.length) break;
    for (const j of found) { by[now[j]]++; if (rl.get(j) >= (runs[now[j]] || 3)) ok[now[j]]++; now[j] = EMPTY; }
    fixed = fixed.filter(j => now[j] >= 0);
    cleared += found.length;
  }
  return { cells: now, stakes: fixed, gusts, cleared, by, ok };
}
/** Ten times the square of the crates shipped in one turn, every gust of it together. */
export const worth = n => 10 * n * n;
export const needLeft = (r, s) => r.orders.map((n, c) => Math.max(0, n - s.shipped[c]));
const done = (r, s) => r.orders && r.orders.every((n, c) => s.shipped[c] >= n);

/**
 * Lays the next crate on square i and lets the turn happen: the crate, the squall's strays and the rock where forecast,
 * the rogue wave, the wind (or two), and the harbour master's seal if the crate carried it. Returns { state, laid
 * ({ c, k }), squall, reef, wave: { moved, ...spec } | null, gusts, sealed (the good, or -1), gain, by, ok, cleared,
 * start (the quay when the first wind begins), stakes0 }. Pure; throws on a square that isn't empty or has an omen.
 */
export function lay(r, s0, i) {
  const s = clone(s0);
  if (s.status !== "play") throw new Error("it is over");
  if (!(s.cells[i] === EMPTY) || strayAt(s, i)) throw new Error("not an empty square");
  const laid = s.next[0], p = s.plan[0];
  s.cells[i] = laid.c;
  if (laid.k === MOORED) s.stakes.push(i);
  const squall = s.strays.map(q => ({ ...q })), reef = s.reef;
  for (const q of squall) s.cells[q.at] = q.colour;
  if (reef >= 0) { s.cells[reef] = WATER; s.rocks.push(reef); }
  let wave = null;
  if (p.wave) { const w = shove(s.shape, s.cells, p.wave, s.stakes); s.cells = w.cells; wave = { ...p.wave, moved: w.moved }; }
  const start = s.cells.slice(), stakes0 = s.stakes.slice(), winds = [p.w, ...(p.w2 != null ? [p.w2] : [])];
  const g = gale(s.shape, s.cells, winds, s.stakes, r.runs);
  s.cells = g.cells; s.stakes = g.stakes;
  const gusts = g.gusts, by = g.by.slice(), ok = g.ok.slice();
  let cleared = g.cleared, sealed = -1;
  if (laid.k === SEALED) {
    // the harbour master ships everything of the crate's good, then the wind settles what is left
    sealed = laid.c;
    const all = s.cells.flatMap((c, j) => (c === sealed ? [j] : []));
    if (all.length) {
      gusts.push({ wind: winds[winds.length - 1], moved: [], cleared: all, sealed: true });
      for (const j of all) s.cells[j] = EMPTY;
      by[sealed] += all.length; ok[sealed] += all.length; cleared += all.length;
      s.stakes = s.stakes.filter(j => s.cells[j] >= 0);
      const after = gale(s.shape, s.cells, winds[winds.length - 1], s.stakes, r.runs);
      s.cells = after.cells; s.stakes = after.stakes;
      gusts.push(...after.gusts);
      for (let c = 0; c < GOODS; c++) { by[c] += after.by[c]; ok[c] += after.ok[c]; }
      cleared += after.cleared;
    }
  }
  for (let c = 0; c < GOODS; c++) s.shipped[c] += ok[c];
  const gain = cleared ? worth(cleared) : 0;
  s.score += gain; s.turns++;
  s.next.shift(); s.next.push(crate(s, r, s.turns + QUEUE - 1));
  s.plan.shift(); s.plan.push(planFor(s, r, s.turns + QUEUE - 1));
  omens(r, s);
  if (done(r, s)) s.status = "won";
  else if (r.turns && s.turns >= r.turns) { s.status = "lost"; s.why = "The season ended with orders unfilled."; }
  else if (!moves(s).length) { s.status = "lost"; s.why = "The quay is full."; }
  return { state: s, laid, squall, reef, wave, gusts, sealed, gain, by, ok, cleared, start, stakes0, winds };
}
/** Stars for a won level: 3 with a fifth of the turns to spare, 2 with a twelfth. */
export function stars(r, s) {
  if (s.status !== "won") return 0;
  const left = r.turns - s.turns;
  return left >= Math.ceil(r.turns * 0.2) ? 3 : left >= Math.ceil(r.turns * 0.08) ? 2 : 1;
}
/** Whether the forecast beyond this turn is hidden by fog. */
export const foggy = s => !!s.plan[0]?.fog;
export function validate(r) {
  const bad = [];
  if (!SHAPES[r.shape]) bad.push("no such shape");
  if (r.orders) {
    if (!(r.turns >= 1)) bad.push("turns must be at least 1");
    if (!Array.isArray(r.orders) || r.orders.length !== GOODS || r.orders.some(n => !(n >= 0))) bad.push("orders: four counts");
    else if (r.orders.every(n => n === 0)) bad.push("at least one order is needed");
    if (r.orders.some((n, c) => n && c >= r.goods)) bad.push("an order for a good that never comes");
  }
  if (r.runs.length && r.runs.some(n => n && !(n >= 3 && n <= 9))) bad.push("runs: 0 or a length from 3 to 9");
  if (r.mix.length !== GOODS || r.mix.some(w => !(w > 0))) bad.push("mix: four positive weights");
  return bad;
}
