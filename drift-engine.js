// Drift's rules, pure (no page): a field seven squares by seven, tiles of four colours lying on it, and the wind,
// forecast three turns ahead. Each turn you lay the next tile on any empty square; then the wind blows and every tile
// slides downwind until it meets the edge or another tile, keeping its order, as in 2048 (where you choose the way and
// the game lays the tile; here the forecast chooses the way and you lay it). Three or more alike in a line, across or
// down, clear, and the wind keeps blowing, so a clear can set off another. Every few turns a squall blows stray tiles
// in, more often as the game goes on, forecast a turn ahead: they're shown on the squares they'll land on, and no tile
// can be laid there; a field with no empty square left ends it. Every few turns the tile to lay comes
// with a stake: laid, it stays put whatever the wind, and the tiles the wind brings pile against it as against an edge,
// until it clears in a line and its stake with it. The page (drift.js) draws it; tests/drift.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a colour 0–3 or -1 empty, row by row), stakes (the
// squares of the staked tiles), next (the tile to lay and the one after), winds (this turn's and the next two: 0
// north, 1 east, 2 south, 3 west, the way the wind blows the tiles), turns, untilSquall, strays (the squall's tiles
// forecast for this turn, [{ at, colour }], none when it isn't due), untilStake (turns until the tile laid is staked:
// 0, the tile to lay now), score, over }.

export const N = 7, COLOURS = 4, START = 8;
// every STAKE_EVERY-th tile to lay comes staked
export const STAKE_EVERY = 6;
export const WINDS = ["north", "east", "south", "west"];
// the squalls: until so many turns, every so many turns, so many stray tiles
export const PACE = [[15, 2, 1], [40, 1, 1], [80, 1, 2], [150, 1, 3], [Infinity, 1, 4]];
const paceAt = turns => PACE.find(([until]) => turns < until);
export const squallEvery = turns => paceAt(turns)[1];
export const squallCount = turns => paceAt(turns)[2];

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);
const idx = (x, y) => y * N + x;

/** The squares of each line along the wind, from the downwind edge back: a slide fills them in order. */
function lanes(wind) {
  const out = [];
  for (let k = 0; k < N; k++) {
    const lane = [];
    for (let j = 0; j < N; j++) lane.push(wind === 0 ? idx(k, j) : wind === 1 ? idx(N - 1 - j, k) : wind === 2 ? idx(k, N - 1 - j) : idx(j, k));
    out.push(lane);
  }
  return out;
}
/**
 * The field after the wind: every tile slid downwind as far as it goes, in order, to the edge, the next tile or a
 * staked one (stakes, the squares of the tiles that stay put); and which tile went where.
 */
export function blow(cells, wind, stakes = []) {
  const out = new Array(N * N).fill(-1), moved = [], fixed = new Set(stakes);
  for (const lane of lanes(wind)) {
    let k = 0;
    lane.forEach((i, j) => {
      if (cells[i] < 0) return;
      // a staked tile stays, and what's upwind of it piles against it
      if (fixed.has(i)) { out[i] = cells[i]; k = j + 1; return; }
      out[lane[k]] = cells[i];
      if (lane[k] !== i) moved.push([i, lane[k]]);
      k++;
    });
  }
  return { cells: out, moved };
}
/** The squares in a line of three or more alike, across or down (each once). */
export function lines(cells) {
  const hit = new Set();
  for (let k = 0; k < N; k++) for (const across of [true, false]) {
    let start = 0;
    for (let j = 1; j <= N; j++) {
      const at = q => (across ? idx(q, k) : idx(k, q)), c = cells[at(start)];
      if (j < N && c >= 0 && cells[at(j)] === c) continue;
      if (c >= 0 && j - start >= 3) for (let q = start; q < j; q++) hit.add(at(q));
      start = j;
    }
  }
  return [...hit].sort((a, b) => a - b);
}
/** A colour for an empty square that makes no line there as things stand. */
function quiet(s, cells, i) {
  const ok = [...Array(COLOURS).keys()].filter(c => { const t = cells.slice(); t[i] = c; return !lines(t).includes(i); });
  return ok.length ? ok[pick(s, ok.length)] : pick(s, COLOURS);
}
const empties = cells => cells.flatMap((c, i) => (c < 0 ? [i] : []));
/**
 * The squall's stray tiles, forecast the turn before it comes: each on an empty square at random, in a colour making no
 * line there as things stand, and never on the last empty square, so a tile can always be laid. Draws from the game's
 * seed (moving its count on).
 */
export function forecast(s) {
  const out = [], cells = s.cells.slice();
  for (let k = Math.min(squallCount(s.turns), empties(cells).length - 1); k > 0; k--) {
    const free = empties(cells), j = free[pick(s, free.length)];
    cells[j] = quiet(s, cells, j);
    out.push({ at: j, colour: cells[j] });
  }
  return out;
}
const due = s => (s.untilSquall === 1 ? forecast(s) : []);

/** A new game from a seed: START tiles lying about, none in a line, the next two tiles and three winds forecast. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: new Array(N * N).fill(-1), stakes: [], next: [], winds: [], turns: 0, untilSquall: squallEvery(0), strays: [], untilStake: STAKE_EVERY - 1, score: 0, over: false };
  for (let k = 0; k < START; k++) { const free = empties(s.cells), i = free[pick(s, free.length)]; s.cells[i] = quiet(s, s.cells, i); }
  s.next = [pick(s, COLOURS), pick(s, COLOURS)];
  s.winds = [pick(s, 4), pick(s, 4), pick(s, 4)];
  s.strays = due(s);
  return s;
}
/** A game saved before stakes, given none and the count to the first; one saved before the squall was forecast, its forecast. */
export function upgrade(game) {
  if (Array.isArray(game.stakes) && game.untilStake != null && Array.isArray(game.strays)) return game;
  const s = structuredClone(game);
  if (!Array.isArray(s.stakes) || s.untilStake == null) { s.stakes = []; s.untilStake = STAKE_EVERY - 1; }
  if (!Array.isArray(s.strays)) s.strays = due(s);
  return s;
}
const strayAt = (s, i) => s.strays.some(q => q.at === i);
/**
 * The wind over a field until it settles: it blows, the lines it makes clear, and it blows again while anything
 * clears. { cells (the field after), stakes (those still standing: a stake goes with its tile), gusts ([{ moved,
 * cleared }]: each blow, which tiles slid where and what then cleared), cleared (how many in all) }.
 */
export function gale(cells, wind, stakes = []) {
  let now = cells.slice(), cleared = 0, fixed = stakes.slice();
  const gusts = [];
  for (;;) {
    const b = blow(now, wind, fixed), found = lines(b.cells);
    now = b.cells;
    gusts.push({ moved: b.moved, cleared: found });
    if (!found.length) break;
    for (const j of found) now[j] = -1;
    fixed = fixed.filter(j => now[j] >= 0);
    cleared += found.length;
  }
  return { cells: now, stakes: fixed, gusts, cleared };
}
/** Ten times the square of the tiles cleared in one turn, every gust of it together. */
export const worth = n => 10 * n * n;

/**
 * Lays the next tile on square i and lets the wind blow: the game after it, and what happened, for the page to show:
 * staked (whether the tile laid came with a stake), squall ([{ at, colour }]: the stray tiles blown in where they were
 * forecast, before the wind takes them), gusts (as gale gives them), gain, over. Pure; throws on a square that isn't
 * empty or where a stray is coming.
 */
export function lay(game, i) {
  const s = structuredClone(game);
  if (s.over) throw new Error("it's over");
  if (!(s.cells[i] < 0) || strayAt(s, i)) throw new Error("not an empty square");
  s.cells[i] = s.next[0];
  const staked = s.untilStake === 0;
  if (staked) s.stakes.push(i);
  // a squall: its strays land where they were forecast (no tile could be laid there)
  const squall = [];
  if (--s.untilSquall <= 0) {
    for (const q of s.strays) { s.cells[q.at] = q.colour; squall.push(q); }
    s.untilSquall = squallEvery(s.turns + 1);
  }
  const g = gale(s.cells, s.winds[0], s.stakes);
  s.cells = g.cells;
  s.stakes = g.stakes;
  const gusts = g.gusts, gain = g.cleared ? worth(g.cleared) : 0;
  s.score += gain;
  s.turns++;
  s.next = [s.next[1], pick(s, COLOURS)];
  s.winds = [s.winds[1], s.winds[2], pick(s, 4)];
  s.untilStake = staked ? STAKE_EVERY - 1 : s.untilStake - 1;
  s.strays = due(s);
  s.over = !moves(s).length;
  return { state: s, staked, squall, gusts, gain, over: s.over };
}
/** Every square a tile can go on: empty, and no stray coming. For the tests and the tuning players. */
export const moves = s => empties(s.cells).filter(i => !strayAt(s, i));
export const filled = s => s.cells.filter(c => c >= 0).length;
