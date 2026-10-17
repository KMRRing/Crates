// Heliograph's rules, pure (no page): gems hang from the top of a board and creep down; a signal mirror at the foot (a
// heliograph) fires a beam each turn, in the colour at the head of a queue. You lay small angled mirrors, / or \, to
// turn the beam; it shatters every gem of its colour it passes and stops at the first of another, unless that one has
// a gem of its own colour just beyond it: two side by side relay the beam, which takes their colour, passes through
// them and goes on, shattering gems of the new colour. Whatever then hangs from nothing falls. The page
// (heliograph.js) draws it and lays the mirrors; tests/heliograph.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made from the seed), gems (a colour 0–3 a cell, -1 empty; row 0
// is the top, which holds the field up), mirrors [{ x, y, t: "/" or "\", life }], aim ("up", "right" or "left"),
// queue (this shot's colour and the next), shots, untilDrop, score, over }. Every random thing comes from the seed and
// the draw's number, so a game saved and opened again goes on as it would have.

export const COLS = 7, ROWS = 12, COLOURS = 4;
export const START_ROWS = 5;          // rows of gems at the start, and after a board is cleared
// shots between the field's drops: unhurried at first, then closer together, so a long game ends
export const PACE = [[30, 5], [70, 4], [120, 3], [Infinity, 2]];
export const dropEvery = shots => PACE.find(([until]) => shots < until)[1];
export const LIFE = 3;                // the shots a mirror takes part in (the one it's laid for included)
export const SOURCE = { x: Math.floor(COLS / 2), y: ROWS - 1 };
export const AIMS = ["up", "right", "left"];
export const CLEAR_BONUS = 1000;
const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

const idx = (x, y) => y * COLS + x;
const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

// ---------- chance ----------
/** One number in [0, 1) for a seed's nth draw (mulberry32 on the two mixed): the same on every device. */
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const roll = s => draw(s.seed, s.n++);
const pick = (s, k) => Math.floor(roll(s) * k);

/** A row of gems for the top: each a fresh colour, or (often) the same as its left neighbour or the gem it will sit on,
 *  so colours come in runs worth a beam. */
function newRow(s, below) {
  const row = [];
  for (let x = 0; x < COLS; x++) {
    const r = roll(s);
    row.push(x > 0 && r < 0.3 ? row[x - 1] : below && below[x] >= 0 && r < 0.5 ? below[x] : pick(s, COLOURS));
  }
  return row;
}
/** The colours on the board, for the queue: a beam is only ever a colour there's something of. */
const present = s => [...new Set(s.gems.filter(c => c >= 0))].sort();
function nextColour(s) {
  const cs = present(s);
  return cs.length ? cs[pick(s, cs.length)] : pick(s, COLOURS);
}
/** A fresh field: START_ROWS rows from the top, the rest empty. */
function fill(s) {
  s.gems = new Array(COLS * ROWS).fill(-1);
  let above = null;
  for (let y = 0; y < START_ROWS; y++) {
    const row = newRow(s, above);
    row.forEach((c, x) => { s.gems[idx(x, y)] = c; });
    above = row;
  }
}

/** A new game from a seed. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, gems: [], mirrors: [], aim: "up", queue: [], shots: 0, untilDrop: dropEvery(0), score: 0, over: false };
  fill(s);
  s.queue = [nextColour(s), nextColour(s)];
  return s;
}

// ---------- the beam ----------
export const mirrorAt = (s, x, y, extra = null) => (extra && extra.x === x && extra.y === y ? extra : s.mirrors.find(m => m.x === x && m.y === y) || null);
/** A beam's way on from a mirror: / sends one going up to the right (and right to up, down to left, left to down), \
 *  one going up to the left. */
export const reflect = ([dx, dy], t) => (t === "/" ? [-dy, -dx] : [dy, dx]);
/** Where a mirror may be laid: an empty cell (or one with a mirror, which it replaces), not the heliograph's own. */
export const canPlace = (s, x, y) => inside(x, y) && !(x === SOURCE.x && y === SOURCE.y) && s.gems[idx(x, y)] < 0;
export const nextAim = aim => AIMS[(AIMS.indexOf(aim) + 1) % AIMS.length];

/**
 * The beam this turn, with `extra` (a mirror being laid: { x, y, t }) as if it were there: { points (the corners of its
 * path, in cells: the heliograph, each mirror it turns at, each relay it enters, then where it ends), legs (its
 * colours along the way: [{ colour, from (the point it starts at) }], one more at each relay), shattered (the cells of
 * the gems it shatters, in the order it reaches them), relays (the cells of the pairs it passed through, two by two),
 * stop (the cell of the gem that stops it, or null), end ("gem", "edge", "source" when it comes back to the
 * heliograph, or "loop" when mirrors send it round for ever), colour (the heliograph's), last (the colour it ends in) }.
 * A gem it has shattered is gone for the rest of its way, so a beam crossing its own path doesn't count one twice.
 */
export function trace(s, extra = null, aim = s.aim) {
  let colour = s.queue[0], [x, y] = [SOURCE.x, SOURCE.y], dir = DIRS[aim];
  const points = [[x, y]], legs = [{ colour, from: 0 }], shattered = [], gone = new Set(), relays = [], seen = new Set();
  const gemAt = (gx, gy) => (inside(gx, gy) && !gone.has(idx(gx, gy)) && !mirrorAt(s, gx, gy, extra) && !(gx === SOURCE.x && gy === SOURCE.y) ? s.gems[idx(gx, gy)] : -1);
  const done = (end, stop = null) => ({ points, legs, shattered, relays, stop, end, colour: s.queue[0], last: colour });
  for (;;) {
    const nx = x + dir[0], ny = y + dir[1];
    if (!inside(nx, ny)) { points.push([x + dir[0] / 2, y + dir[1] / 2]); return done("edge"); }
    if (nx === SOURCE.x && ny === SOURCE.y) { points.push([nx, ny]); return done("source"); }
    const key = `${nx},${ny},${dir}`;
    if (seen.has(key)) { points.push([nx, ny]); return done("loop"); }
    seen.add(key);
    x = nx; y = ny;
    const m = mirrorAt(s, x, y, extra);
    if (m) { dir = reflect(dir, m.t); points.push([x, y]); continue; }
    const g = gemAt(x, y);
    if (g < 0) continue;
    if (g === colour) { shattered.push(idx(x, y)); gone.add(idx(x, y)); continue; }
    points.push([x - dir[0] / 2, y - dir[1] / 2]);             // its near face
    // two of another colour side by side in its way relay it: it takes their colour and passes through, and they stay
    if (gemAt(x + dir[0], y + dir[1]) !== g) return done("gem", idx(x, y));
    relays.push(idx(x, y), idx(x + dir[0], y + dir[1]));
    legs.push({ colour: g, from: points.length - 1 });
    colour = g;
    x += dir[0];
    y += dir[1];
  }
}

/** The gems held up by nothing: not joined to the top row through other gems (side by side or one above another). */
export function loose(gems) {
  const held = new Set(), queue = [];
  for (let x = 0; x < COLS; x++) if (gems[x] >= 0) { held.add(x); queue.push(x); }
  while (queue.length) {
    const i = queue.pop(), x = i % COLS, y = Math.floor(i / COLS);
    for (const [dx, dy] of Object.values(DIRS)) {
      const ax = x + dx, ay = y + dy, j = idx(ax, ay);
      if (inside(ax, ay) && gems[j] >= 0 && !held.has(j)) { held.add(j); queue.push(j); }
    }
  }
  return gems.flatMap((c, i) => (c >= 0 && !held.has(i) ? [i] : []));
}
/** What a turn's gems are worth: ten times the square of all it brought down, so one beam that does much beats two
 *  that do half as much each. */
export const worth = n => 10 * n * n;

/**
 * Fires this turn's beam, with `extra` (a mirror to lay first, { x, y, t }, or null): the game after it, and what
 * happened, for the page to show: { path (as trace), shattered, fallen (cells), gain, cleared (the board emptied),
 * dropped (the field came down a row), crushed (mirrors the field came down on), faded (mirrors whose last shot it
 * was), over }. Pure: the game passed in is left as it was.
 */
export function fire(game, extra = null) {
  const s = structuredClone(game);
  if (s.over) return { state: s, path: null, shattered: [], fallen: [], gain: 0, cleared: false, dropped: false, crushed: [], faded: [], over: true };
  if (extra) {
    if (!canPlace(s, extra.x, extra.y)) throw new Error(`no mirror can go at ${extra.x},${extra.y}`);
    s.mirrors = s.mirrors.filter(m => !(m.x === extra.x && m.y === extra.y));
    s.mirrors.push({ x: extra.x, y: extra.y, t: extra.t === "/" ? "/" : "\\", life: LIFE });
  }
  const path = trace(s);
  for (const i of path.shattered) s.gems[i] = -1;
  const fallen = loose(s.gems);
  for (const i of fallen) s.gems[i] = -1;
  const gain = worth(path.shattered.length + fallen.length);
  s.score += gain;
  // every mirror has taken part in one more shot
  const faded = [];
  s.mirrors = s.mirrors.filter(m => { m.life--; if (m.life > 0) return true; faded.push(m); return false; });
  let cleared = false, dropped = false, crushed = [];
  if (!s.gems.some(c => c >= 0)) {
    cleared = true;
    s.score += CLEAR_BONUS;
    fill(s);
    crushed = s.mirrors.filter(m => s.gems[idx(m.x, m.y)] >= 0);
    s.mirrors = s.mirrors.filter(m => s.gems[idx(m.x, m.y)] < 0);
    s.untilDrop = dropEvery(s.shots + 1);
  } else if (--s.untilDrop <= 0) {
    // the field comes down a row, a new one above it; a gem reaching the heliograph's row ends the game
    dropped = true;
    s.untilDrop = dropEvery(s.shots + 1);
    const top = s.gems.slice(0, COLS);
    s.gems = [...newRow(s, top), ...s.gems.slice(0, COLS * (ROWS - 1))];
    crushed = s.mirrors.filter(m => s.gems[idx(m.x, m.y)] >= 0);
    s.mirrors = s.mirrors.filter(m => s.gems[idx(m.x, m.y)] < 0);
    if (s.gems.slice(COLS * (ROWS - 1)).some(c => c >= 0)) s.over = true;
  }
  s.shots++;
  s.queue = [s.queue[1], nextColour(s)];
  if (!present(s).includes(s.queue[0])) s.queue[0] = nextColour(s);   // the colour coming was the last of its kind
  return { state: s, path, shattered: path.shattered, fallen, gain, cleared, dropped, crushed, faded, over: s.over };
}

/** The lowest row with a gem in it (-1 for none): how near the field is to the heliograph. */
export function lowest(s) {
  for (let y = ROWS - 1; y >= 0; y--) for (let x = 0; x < COLS; x++) if (s.gems[idx(x, y)] >= 0) return y;
  return -1;
}

/**
 * Every turn there is (the heliograph turned each way, with no mirror or a mirror of either kind anywhere it may go),
 * each fired: [{ aim, extra, gain, result }]. For the tests and the tuning player; a page doesn't need it.
 */
export function turns(s) {
  const out = [];
  for (const aim of AIMS) {
    const g = { ...s, aim };
    const options = [null];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canPlace(s, x, y)) options.push({ x, y, t: "/" }, { x, y, t: "\\" });
    for (const extra of options) {
      const result = fire(g, extra);
      out.push({ aim, extra, gain: result.gain, result });
    }
  }
  return out;
}
