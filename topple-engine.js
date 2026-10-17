// Topple's rules, pure (no page): a table eight squares by eight. Dominoes stand on it in three colours, a piece of
// them at a time: three pieces in hand, laid anywhere they fit, in the order you like, the next three dealt when all
// three are down. The knock is on the table's time, not yours: when a hand's last piece is down (every hand at first,
// later every second), you knock one domino before the next is laid. It falls as dominoes do: the one knocked takes
// down every domino of its colour beside it, and each after that falls away from the one that knocked it and takes
// down the one straight ahead of it, or, where there's none, those to either side (round a corner, both ways at a
// fork). So a line falls end to end, and a blob falls round its edge and leaves its middle standing. A knock scores ten
// times how many fell times the steps they took (a snake from its end beats a blob of as many, and where it's knocked
// matters), doubled when the fall passes the bell, a mark on one square that moves on when it's rung. A hand that fits
// nowhere, with no knock to make first, ends the game. The page (topple.js) draws it; tests/topple.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a colour 0–2 a square, -1 empty, row by row),
// hand (three { piece, colour }, null where one has been laid), due (a knock to make before the next piece),
// untilKnock (hands until the next is due), bell (its square), rung, sets (hands dealt), laid, felled, score, over }.

export const N = 8, HAND = 3, COLOURS = 3;
// the knocks: until so many hands dealt, one every so many hands
export const PACE = [[12, 1], [Infinity, 2]];
export const knockEvery = sets => PACE.find(([until]) => sets < until)[1];
const shape = rows => rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === "#" ? [[x, y]] : [])));
// each piece in every way it comes (none is turned), with how often it's dealt
const FAMILIES = [
  [1, [["#"]]],
  [3, [["##"], ["#", "#"]]],
  [3, [["###"], ["#", "#", "#"]]],
  [3, [["#.", "##"], ["##", "#."], ["##", ".#"], [".#", "##"]]],
  [2, [["####"], ["#", "#", "#", "#"]]],
  [2, [["##", "##"]]],
  [2, [["#.", "#.", "##"], [".#", ".#", "##"], ["##", "#.", "#."], ["##", ".#", ".#"], ["###", "#.."], ["###", "..#"], ["#..", "###"], ["..#", "###"]]],
  [2, [["###", ".#."], [".#.", "###"], ["#.", "##", "#."], [".#", "##", ".#"]]],
  [1.5, [[".##", "##."], ["##.", ".##"], ["#.", "##", ".#"], [".#", "##", "#."]]],
  [1, [["#####"], ["#", "#", "#", "#", "#"]]],
  [1, [["#..", "#..", "###"], ["..#", "..#", "###"], ["###", "#..", "#.."], ["###", "..#", "..#"]]],
];
/** Every piece by name: its squares ([x, y] from its top left), width, height and how often it's dealt. */
export const PIECES = Object.fromEntries(FAMILIES.flatMap(([weight, ways], f) => ways.map((rows, k) => {
  const cells = shape(rows);
  return [`${f}.${k}`, { cells, w: Math.max(...cells.map(c => c[0])) + 1, h: Math.max(...cells.map(c => c[1])) + 1, weight: weight / ways.length }];
})));
const NAMES = Object.keys(PIECES), TOTAL = NAMES.reduce((a, k) => a + PIECES[k].weight, 0);

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function dealOne(s) {
  let r = draw(s.seed, s.n++) * TOTAL, piece = NAMES[NAMES.length - 1];
  for (const k of NAMES) if ((r -= PIECES[k].weight) < 0) { piece = k; break; }
  return { piece, colour: Math.floor(draw(s.seed, s.n++) * COLOURS) };
}
function deal(s) { s.sets++; s.hand = Array.from({ length: HAND }, () => dealOne(s)); }
/** The bell to an empty square at random (none on a full table). */
function hang(s) {
  const empty = s.cells.flatMap((c, i) => (c < 0 ? [i] : []));
  s.bell = empty.length ? empty[Math.floor(draw(s.seed, s.n++) * empty.length)] : -1;
}

/** A new game from a seed: an empty table, the bell on it, three pieces, and a knock after the first hand. */
export function newGame(seed) {
  const s = { v: 2, seed: seed >>> 0, n: 0, cells: new Array(N * N).fill(-1), hand: [], due: false, untilKnock: knockEvery(1), bell: -1, rung: 0, sets: 0, laid: 0, felled: 0, score: 0, over: false };
  deal(s);
  hang(s);
  return s;
}
/** A game saved before the knock was the table's: its stored knocks go, and a knock comes after the hand in play. */
export function upgrade(g) {
  if (g?.v !== 1) return g;
  const s = { ...g, v: 2, due: false, untilKnock: 1, rung: 0 };
  delete s.knocks;
  hang(s);
  return s;
}

/** The squares a piece would cover with its top left on (x, y), or null if it doesn't fit there. */
export function cover(cells, piece, x, y) {
  const out = [];
  for (const [dx, dy] of PIECES[piece].cells) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N || cells[cy * N + cx] >= 0) return null;
    out.push(cy * N + cx);
  }
  return out;
}
export const fitsAnywhere = (cells, piece) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cover(cells, piece, x, y)) return true;
  return false;
};
const stuck = s => !s.hand.some(h => h && fitsAnywhere(s.cells, h.piece));
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * What a knock on a square brings down: the dominoes in the order they fall, each as [square, step (0 the one knocked,
 * 1 those it knocks, …), the square of the one that knocked it (-1 for the first)]. The one knocked takes down every
 * domino of its colour beside it; each after that falls away from the one that knocked it and takes down the one
 * straight ahead, or, with none of its colour there, those to either side. Empty for an empty square.
 */
export function chain(cells, start) {
  const c = cells[start];
  if (!(c >= 0)) return [];
  const step = new Map([[start, 0]]), by = new Map([[start, -1]]), queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % N, y = (i - x) / N, from = by.get(i);
    let next = SIDES;
    if (from >= 0) {
      const dx = x - from % N, dy = y - Math.floor(from / N);
      next = inside(x + dx, y + dy) && cells[(y + dy) * N + x + dx] === c ? [[dx, dy]] : [[dy, dx], [-dy, -dx]];
    }
    for (const [ox, oy] of next) {
      const nx = x + ox, ny = y + oy, j = ny * N + nx;
      if (inside(nx, ny) && cells[j] === c && !step.has(j)) { step.set(j, step.get(i) + 1); by.set(j, i); queue.push(j); }
    }
  }
  return queue.map(i => [i, step.get(i), by.get(i)]);
}
/** The dominoes of a colour joined to square i along their sides, all of them, whether a knock would take them or not. */
export function group(cells, i) {
  const c = cells[i];
  if (!(c >= 0)) return [];
  const seen = new Set([i]), queue = [i];
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q], x = k % N, y = (k - x) / N;
    for (const [ox, oy] of SIDES) { const j = (y + oy) * N + x + ox; if (inside(x + ox, y + oy) && cells[j] === c && !seen.has(j)) { seen.add(j); queue.push(j); } }
  }
  return queue;
}
/** The steps a knock's fall takes (as chain gives it): from the one knocked, counting it. */
export const stepsOf = fell => (fell.length ? Math.max(...fell.map(f => f[1])) + 1 : 0);
/** Ten times the dominoes felled by one knock times the steps they take (a straight run from its end: its length). */
export const worth = (n, steps = n) => 10 * n * steps;
/** What a knock on square i would come to: { fell (as chain gives it), steps, rings (the bell's square among them), gain }. */
export function knockOn(cells, i, bell = -1) {
  const fell = chain(cells, i), steps = stepsOf(fell), rings = bell >= 0 && fell.some(f => f[0] === bell);
  return { fell, steps, rings, gain: worth(fell.length, steps) * (rings ? 2 : 1) };
}
/**
 * The best knock on the dominoes joined to square i: { at, fell (how many), steps, rings, gain, size (how many are
 * joined) }, the one scoring most (felling most where they score the same). Every square of them tried: they're at
 * most the table, so this is quick.
 */
export function longest(cells, i, bell = -1) {
  const all = group(cells, i);
  let best = { at: -1, fell: 0, steps: 0, rings: false, gain: 0 };
  for (const j of all) {
    const k = knockOn(cells, j, bell);
    if (k.gain > best.gain || (k.gain === best.gain && k.fell.length > best.fell)) best = { at: j, fell: k.fell.length, steps: k.steps, rings: k.rings, gain: k.gain };
  }
  return { ...best, size: all.length };
}

/**
 * Lays the piece in hand slot `slot` with its top left on (x, y): the game after it, and what happened, for the page
 * to show: laid (its squares), dealt (a new hand came), due (a knock is to be made now), over. Pure; throws if a knock
 * is to be made first, or the piece isn't there or doesn't fit.
 */
export function lay(game, slot, x, y) {
  const s = structuredClone(game), h = s.hand[slot];
  if (s.over || !h) throw new Error("no piece there");
  if (s.due) throw new Error("knock first");
  const laid = cover(s.cells, h.piece, x, y);
  if (!laid) throw new Error("it doesn't fit there");
  for (const i of laid) s.cells[i] = h.colour;
  s.laid++;
  s.hand[slot] = null;
  const dealt = s.hand.every(k => !k);
  if (dealt) {
    deal(s);
    if (--s.untilKnock <= 0) s.due = true;
  }
  s.over = !s.due && stuck(s);
  return { state: s, laid, dealt, due: s.due, over: s.over };
}
/**
 * Knocks the domino on a square, the knock that's due: the game after it, the fall (as chain gives it), its steps,
 * whether it rang the bell (and where the bell went) and the gain. Pure; throws with no knock due or no domino there.
 */
export function knock(game, i) {
  const s = structuredClone(game);
  if (s.over || !s.due) throw new Error("no knock due");
  const k = knockOn(s.cells, i, s.bell);
  if (!k.fell.length) throw new Error("no domino there");
  for (const [j] of k.fell) s.cells[j] = -1;
  s.score += k.gain;
  s.felled += k.fell.length;
  s.due = false;
  s.untilKnock = knockEvery(s.sets);
  if (k.rings) { s.rung++; hang(s); }
  s.over = stuck(s);
  return { state: s, fell: k.fell, steps: k.steps, rang: k.rings, gain: k.gain, over: s.over };
}
/** Every way to lay a piece in hand: [{ slot, x, y }] (none while a knock is due). For the tests and the tuning players. */
export function moves(s) {
  const out = [];
  if (s.due) return out;
  s.hand.forEach((h, slot) => {
    if (!h) return;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cover(s.cells, h.piece, x, y)) out.push({ slot, x, y });
  });
  return out;
}
/** The dominoes standing, joined by colour: one square of each, how many, and its best knock (longest's), most first. */
export function chains(cells, bell = -1) {
  const seen = new Set(), out = [];
  cells.forEach((c, i) => {
    if (c < 0 || seen.has(i)) return;
    const all = group(cells, i);
    for (const j of all) seen.add(j);
    out.push({ at: i, length: all.length, best: longest(cells, i, bell) });
  });
  return out.sort((a, b) => b.length - a.length);
}
export const filled = s => s.cells.filter(c => c >= 0).length;
