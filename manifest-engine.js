// Manifest: a stack of coloured containers drops in, holds, and is gone; then you're asked about it.
//
// Each round opens with an order book: the questions to come, posted by kind and not by detail (a colour's count,
// tier 2's count, a spot on tier 2, the stack seen from behind), each with a price. You choose what to watch. Once
// the stack is down you can ship it early: the share of the hold time you didn't use is a bonus on the round. Then
// the questions open in full: answer any, pass any. A right answer pays its price, a wrong one costs a life, a pass
// costs nothing. Prices grow with the rounds and follow your record: what you usually get right pays less.
//
// Every fourth round is a change round: the stack vanishes, the stage stays empty for a moment, and the stack comes
// back with one container different; in later ones it comes back turned round, or with two containers swapped.
// A run is twelve rounds, or until the lives run out.
//
// Together (the end of this file): a table of two to six plays the rounds in step, against each other or as one team
// that sees the stack in parts.

export const LIVES = 3, ROUNDS = 12;
export const COLOURS = [
  { id: "red", name: "Red", hex: "#D23B2A" },
  { id: "blue", name: "Blue", hex: "#2F6FDE" },
  { id: "yellow", name: "Yellow", hex: "#F2C230" },
  { id: "green", name: "Green", hex: "#2E9E5B" },
  { id: "orange", name: "Orange", hex: "#E8832A" },
  { id: "purple", name: "Purple", hex: "#7A4BC9" },
];
export const VIEWS = { all: "All at once", layers: "Tier by tier", slices: "Slice by slice", pair: "Two tiers, then the rest" };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const shuffle = (r, xs) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;
const keyOf = (x, y, z) => `${x},${y},${z}`;
const unkey = k => k.split(",").map(Number);

/**
 * How round r goes: the stack's size (growing to 4×4×3), colours (to five), the hold once the last container has
 * landed, how many orders are posted, and whether it's a change round (every fourth: a colour, then turned, then
 * swapped).
 */
export function levelOf(r) {
  return {
    x: Math.min(4, 3 + Math.floor((r - 1) / 6)),
    y: Math.min(4, 2 + Math.floor((r - 1) / 4)),
    z: Math.min(3, 2 + Math.floor((r - 1) / 6)),
    colours: Math.min(5, 3 + Math.floor((r - 1) / 4)),
    exposure: Math.max(5000, 9000 - 300 * (r - 1)),
    orders: r < 6 ? 3 : 4,
    change: r % 4 === 0 ? ["colour", "turned", "swap"][(r / 4 - 1) % 3] : null,
  };
}

/** The stack for a round: cells[x][y][z] holds a colour index (1-based) or 0 for empty; columns stack from the floor. */
function makeStack(r, L) {
  const cells = [];
  for (let x = 0; x < L.x; x++) {
    cells.push([]);
    for (let y = 0; y < L.y; y++) {
      const h = int(r, 1, L.z);
      cells[x].push(Array.from({ length: L.z }, (_, z) => (z < h ? int(r, 1, L.colours) : 0)));
    }
  }
  return cells;
}
const each = (cells, fn) => cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c) fn(x, y, z, c); })));
const count = (cells, pred) => { let n = 0; each(cells, (x, y, z, c) => { if (pred(x, y, z, c)) n++; }); return n; };
const copy = cells => cells.map(col => col.map(row => [...row]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- turning ----------
// A quarter turn (clockwise, seen from above): cell (x, y) goes to (Y−1−y, x), so a container's long side, along x,
// ends up along y. Turned stacks are drawn with their containers that way round (boxFor).
/** The stack turned by this many quarter turns. */
export function turn(cells, turns) {
  let out = cells;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const Y = out[0].length, X = out.length;
    out = Array.from({ length: Y }, (_, x) => Array.from({ length: X }, (_, y) => out[y][Y - 1 - x].slice()));
  }
  return out;
}
/** Where cell (x, y, z) of an X×Y stack ends up after the turns, as a key. */
export function turnKey(x, y, z, X, Y, turns) {
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) { [x, y] = [Y - 1 - y, x]; [X, Y] = [Y, X]; }
  return keyOf(x, y, z);
}
/** The stack in a mirror: front and back rows change places. No turn can make it, unless the stack is symmetric. */
export const mirror = cells => cells.map(col => [...col].reverse());

// ---------- isometric geometry and visibility ----------
// The whole-stack view hides inner containers. Which ones show is settled the way the screen settles it: the cubes
// are drawn back to front onto a small raster of ids, and a cube is visible if any of its pixels survive.
const ISO = { w: 0.866, h: 0.5 };
/** A container's proportions: length, width and height, in cell units. */
export const BOX = { L: 1.9, W: 1, H: 0.95 };
/** The cell's extent along x and y: a container lies along x, or along y once the stack is turned a quarter. */
export const boxFor = (turns = 0) => (turns % 2 ? { X: BOX.W, Y: BOX.L, H: BOX.H } : { X: BOX.L, Y: BOX.W, H: BOX.H });
/** Screen position of the corner of cell (x, y, z) as the page draws it. */
export const isoPoint = (x, y, z, b = boxFor(0)) => ({ sx: (x * b.X - y * b.Y) * ISO.w, sy: (x * b.X + y * b.Y) * ISO.h - z * b.H });
/** The three faces of a cube as polygons in screen units: top, left (the +y face), right (the +x face). */
export function cubeFaces(x, y, z, b = boxFor(0)) {
  const p = (dx, dy, dz) => { const q = isoPoint(x + dx, y + dy, z + dz, b); return [q.sx, q.sy]; };
  return {
    top: [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)],
    left: [p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1)],
    right: [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)],
  };
}
/** Draw order: far to near. */
export const drawOrder = cells => { const out = []; each(cells, (x, y, z, c) => out.push({ x, y, z, c })); return out.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z); };
/** The ms from the last container's landing until the stack holds still (its bounce settles). */
export const LANDING = 450;
/**
 * When each container lands, by the round's view: { times: { "x,y,z": ms after the drop begins }, last }. Tier by
 * tier and slice by slice pause between tiers or slices; two tiers, then the rest quickly; all at once, one after
 * another without a pause.
 */
export function dropTimes(cells, view) {
  const times = {};
  let k = 0, last = 0;
  const stagger = 45, pause = 1300;
  for (const cube of drawOrder(cells)) {
    let at;
    if (view === "layers") at = cube.z * pause + k * stagger;
    else if (view === "slices") at = cube.y * pause + k * stagger;
    else if (view === "pair") at = cube.z < 2 ? cube.z * pause + k * stagger : 2 * pause + 600 + k * 25;
    else at = k * 35;
    times[keyOf(cube.x, cube.y, cube.z)] = at;
    last = Math.max(last, at);
    k++;
  }
  return { times, last };
}
function inside(poly, px, py) {
  let on = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) on = !on;
  }
  return on;
}
/** The set of "x,y,z" keys of cubes you can see in the isometric view. */
export function visibleSet(cells, b = boxFor(0)) {
  const order = drawOrder(cells);
  if (!order.length) return new Set();
  const polys = order.map(cube => ({ key: keyOf(cube.x, cube.y, cube.z), faces: Object.values(cubeFaces(cube.x, cube.y, cube.z, b)) }));
  const xs = polys.flatMap(p => p.faces.flat().map(q => q[0])), ys = polys.flatMap(p => p.faces.flat().map(q => q[1]));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const res = 14;                                                     // pixels per cube unit: plenty to catch a sliver
  const W = Math.ceil((maxX - minX) * res) + 1, H = Math.ceil((maxY - minY) * res) + 1;
  const buf = new Array(W * H).fill(null);
  for (const p of polys) {
    for (const face of p.faces) {
      const fx = face.map(q => (q[0] - minX) * res), fy = face.map(q => (q[1] - minY) * res);
      const x0 = Math.max(0, Math.floor(Math.min(...fx))), x1 = Math.min(W - 1, Math.ceil(Math.max(...fx)));
      const y0 = Math.max(0, Math.floor(Math.min(...fy))), y1 = Math.min(H - 1, Math.ceil(Math.max(...fy)));
      const poly = face.map((q, i) => [fx[i], fy[i]]);
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) if (inside(poly, px + 0.5, py + 0.5)) buf[py * W + px] = p.key;
    }
  }
  return new Set(buf.filter(Boolean));
}

// ---------- orders ----------
// Each kind: its base price (before the round's growth and your record), and what the order book says about it.
export const KINDS = {
  count: { name: "Count", base: 60 },
  total: { name: "Total", base: 50 },
  tier: { name: "Tier", base: 50 },
  spot: { name: "Spot", base: 80 },
  top: { name: "Top", base: 60 },
  most: { name: "Most", base: 50 },
  turned: { name: "Turned", base: 140 },
  which: { name: "Which stack", base: 150 },
  change: { name: "Change", base: 150 },
  changeTurned: { name: "Change, turned", base: 220 },
  swap: { name: "Swap", base: 220 },
};
/**
 * Number options around the truth: five, evenly spaced, never negative, the truth at a place drawn evenly from those
 * that fit. Scattered at random round the truth, the truth would sit in the middle more often than not, and picking
 * the middle option would pay without looking.
 */
function numberOptions(r, truth) {
  const step = truth >= 8 ? int(r, 1, 2) : 1, places = [0, 1, 2, 3, 4].filter(k => truth - k * step >= 0);
  const at = pick(r, places);
  return [0, 1, 2, 3, 4].map(k => truth + (k - at) * step);
}
const colourName = c => COLOURS[c - 1].name.toLowerCase();
const turnWords = t => (t === 2 ? "from behind" : "from the side");

/** What you saw in a view: every container when they arrive tier by tier or slice by slice; the visible ones all at once; the bottom two tiers otherwise. */
function seenIn(cells, view, visible) {
  const seen = new Set();
  each(cells, (x, y, z) => { const k = keyOf(x, y, z); if (view === "all" ? visible.has(k) : view === "pair" ? z < 2 : true) seen.add(k); });
  return seen;
}

/** One order of a kind, or null if the stack can't make a fair one: { type, posted, question }. */
function makeOrder(r, type, cells, L, view, visible) {
  const seen = seenIn(cells, view, visible), seenCells = [...seen].map(unkey);
  const used = [...new Set(seenCells.map(([x, y, z]) => cells[x][y][z]))].sort((a, b) => a - b);
  const where = view === "all" ? " you could see" : view === "pair" ? " on the bottom two tiers" : "";
  const X = cells.length, Y = cells[0].length;
  switch (type) {
    case "count": {
      const c = pick(r, used), n = seenCells.filter(([x, y, z]) => cells[x][y][z] === c).length;
      return { type, posted: `How many of one colour${where}`, question: { as: "number", text: `How many ${colourName(c)} containers${where}?`, colour: c, answer: n, options: numberOptions(r, n) } };
    }
    case "total": {
      const n = seenCells.length;
      return { type, posted: `How many containers${where} in all`, question: { as: "number", text: `How many containers${where} in all?`, answer: n, options: numberOptions(r, n) } };
    }
    case "tier": {
      const tiers = [...new Set(seenCells.map(([, , z]) => z))].filter(z => view !== "pair" || z < 2);
      const z = pick(r, tiers), n = count(cells, (x, y, zz) => zz === z);
      return { type, posted: `How many on tier ${z + 1}`, question: { as: "number", text: `How many containers on tier ${z + 1}?`, tier: z, answer: n, options: numberOptions(r, n) } };
    }
    case "spot": {
      const z = pick(r, [...new Set(seenCells.map(([, , zz]) => zz))]);
      const [x, y] = pick(r, seenCells.filter(([, , zz]) => zz === z));
      return { type, posted: `A colour at a spot on tier ${z + 1}`, question: { as: "colour", text: `Which colour is the marked container on tier ${z + 1}?`, cell: { x, y, z }, answer: cells[x][y][z], options: used } };
    }
    case "top": {
      const tops = [];
      cells.forEach((col, x) => col.forEach((row, y) => { const h = row.filter(Boolean).length; if (h && visible.has(keyOf(x, y, h - 1))) tops.push([x, y, h - 1]); }));
      const [x, y, z] = pick(r, tops);
      return { type, posted: "The top of a column", question: { as: "colour", text: "Which colour is on top of the marked column?", cell: { x, y, z }, answer: cells[x][y][z], options: used } };
    }
    case "most": {
      const tally = used.map(c => [c, seenCells.filter(([x, y, z]) => cells[x][y][z] === c).length]).sort((a, b) => b[1] - a[1]);
      if (tally.length < 2 || tally[0][1] === tally[1][1]) return null;
      return { type, posted: `The most common colour${where}`, question: { as: "colour", text: `Which colour is most common${where}?`, answer: tally[0][0], options: used } };
    }
    case "turned": {
      // a container you saw, marked on the stack turned round and drawn in grey: which colour is it?
      const turns = int(r, 1, 3), turned = turn(cells, turns), shows = visibleSet(turned, boxFor(turns));
      const spots = seenCells.filter(([x, y, z]) => shows.has(turnKey(x, y, z, X, Y, turns)));
      if (!spots.length) return null;
      const [x, y, z] = pick(r, spots);
      return { type, posted: `A spot, the stack seen ${turnWords(turns)}`, question: { as: "colour", text: `The stack seen ${turnWords(turns)}: which colour is the marked container?`, turns, cell: { x, y, z }, at: turnKey(x, y, z, X, Y, turns), answer: cells[x][y][z], options: used } };
    }
    case "which": {
      // four stacks turned the same way: yours, its mirror image, and yours with a container or two changed
      const turns = int(r, 1, 3), b = boxFor(turns), turned = turn(cells, turns), shows = visibleSet(turned, b);
      const both = seenCells.filter(([x, y, z]) => shows.has(turnKey(x, y, z, X, Y, turns)));
      if (!both.length) return null;
      const recolour = () => {
        const [x, y, z] = pick(r, both), c = cells[x][y][z], other = used.filter(u => u !== c);
        if (!other.length) return null;
        const m = copy(cells); m[x][y][z] = pick(r, other); return turn(m, turns);
      };
      const swapTwo = () => {
        const pairs = [];
        both.forEach((a, i) => both.slice(i + 1).forEach(bb => { if (cells[a[0]][a[1]][a[2]] !== cells[bb[0]][bb[1]][bb[2]]) pairs.push([a, bb]); }));
        if (!pairs.length) return null;
        const [[x1, y1, z1], [x2, y2, z2]] = pick(r, pairs), m = copy(cells);
        [m[x1][y1][z1], m[x2][y2][z2]] = [m[x2][y2][z2], m[x1][y1][z1]];
        return turn(m, turns);
      };
      const mirrored = mirror(cells), mirrorIsTurn = [0, 1, 2, 3].some(t => same(turn(cells, t), mirrored));
      const decoys = [];
      const offer = s => { if (s && !same(s, turned) && !decoys.some(d => same(d, s))) decoys.push(s); };
      if (!mirrorIsTurn) offer(turn(mirrored, turns));
      for (let tries = 0; decoys.length < 3 && tries < 30; tries++) offer(tries % 2 ? swapTwo() : recolour());
      if (decoys.length < 3) return null;
      const stacks = shuffle(r, [turned, ...decoys]);
      return { type, posted: "The stack you saw, turned", question: { as: "stack", text: `Which of these is the stack you saw, seen ${turnWords(turns)}?`, turns, stacks, answer: stacks.findIndex(s => s === turned) } };
    }
  }
  return null;
}

/** The kinds a view can carry: the turning ones come in from round 3 and 5, and never with the two-tier view. */
function kindsFor(view, r) {
  const kinds = { layers: ["count", "total", "tier", "spot", "most", "turned", "which"], slices: ["count", "total", "tier", "spot", "most", "turned", "which"],
    all: ["count", "total", "top", "most", "turned", "which"], pair: ["count", "total", "tier", "spot", "most"] }[view];
  return kinds.filter(k => (k !== "turned" || r >= 3) && (k !== "which" || r >= 5));
}

/**
 * A change round: the stack comes back with one container recoloured; turned a quarter round as well; or with two
 * containers of different colours swapped, so the colour counts can't give it away. The changed containers are
 * ones you could see (seen), and can see again when the whole stack comes back (visible, or the turned stack's own).
 */
function makeChange(r, cells, L, seen, visible, variant) {
  const spots = [...seen].filter(k => visible.has(k)).map(unkey), X = cells.length, Y = cells[0].length;
  const recolour = (m, [x, y, z]) => { const c = m[x][y][z]; let n = c; while (n === c) n = int(r, 1, L.colours); m[x][y][z] = n; };
  const pairs = [];
  if (variant === "swap") spots.forEach((a, i) => spots.slice(i + 1).forEach(b => { if (cells[a[0]][a[1]][a[2]] !== cells[b[0]][b[1]][b[2]]) pairs.push([a, b]); }));
  if (variant === "swap" && pairs.length) {
    const [[x1, y1, z1], [x2, y2, z2]] = pick(r, pairs), back = copy(cells);
    [back[x1][y1][z1], back[x2][y2][z2]] = [back[x2][y2][z2], back[x1][y1][z1]];
    return { type: "swap", posted: "Two containers swap places", question: { as: "pair", text: "Two containers swapped places. Tap both.", turns: 0, back, answer: [keyOf(x1, y1, z1), keyOf(x2, y2, z2)].sort() } };
  }
  let turns = variant === "turned" ? pick(r, [1, 3]) : 0;
  const shows = turns ? visibleSet(turn(cells, turns), boxFor(turns)) : visible;
  let fair = spots.filter(([a, b, c]) => shows.has(turnKey(a, b, c, X, Y, turns)));
  if (!fair.length) { turns = 0; fair = spots; }                  // nothing seen both ways: plain change
  const [x, y, z] = pick(r, fair);
  const changed = copy(cells);
  recolour(changed, [x, y, z]);
  return turns
    ? { type: "changeTurned", posted: "Spot the change, the stack turned", question: { as: "cell", text: `The stack's come back seen ${turnWords(turns)}, and one container changed colour. Tap it.`, turns, back: turn(changed, turns), answer: turnKey(x, y, z, X, Y, turns), cell: { x, y, z } } }
    : { type: "change", posted: "Spot the change", question: { as: "cell", text: "One container changed colour. Tap it.", turns: 0, back: changed, answer: keyOf(x, y, z), cell: { x, y, z } } };
}

/**
 * The order questions are asked in: those whose pictures and answers give least away first. A turned spot's grey
 * stack shows the shape, so it comes after the counts; the four stacks of which-stack show nearly everything, so it
 * comes last. Questions come one at a time, so nothing later is seen before what comes earlier is answered or passed.
 */
export const ASK_ORDER = ["count", "total", "tier", "most", "spot", "top", "turned", "which"];

/**
 * Round r of a run: { r, level, cells, view, visible, seen, parts, orders }. Orders are fixed by the seed; prices are
 * not. Played together by a team of `team` (two to six), the stack is the same, shared out in parts (splitStack), one
 * to each player; and all at once, where each part is drawn alone, the team saw what any of them could see of their
 * own part (seen): more than the whole stack shows, as nobody else's containers stand in front of theirs, so the
 * orders are made of that. (The whole stack's own are in it too: one it shows by a sliver shows at least as much with
 * fewer in front, though the raster that finds it may miss a sliver drawn to another frame.)
 */
export function makeRound(seed, r, team = 0) {
  const L = levelOf(r), rand = rng(mix(seed, r));
  const cells = makeStack(rand, L);
  // the views take turns over the rounds that aren't change rounds
  const view = L.change ? "all" : ["layers", "all", "slices", "pair"][(r - 1 - Math.floor((r - 1) / 4)) % 4];
  const visible = visibleSet(cells);
  const parts = team > 1 ? splitStack(cells, team) : null;
  const seen = parts && view === "all" ? new Set([...visible, ...parts.flatMap(part => [...visibleSet(partCells(cells, part))])]) : visible;
  if (L.change) return { r, level: L, cells, view, visible, seen, parts, orders: [makeChange(rand, cells, L, seen, visible, L.change)] };
  const orders = [];
  for (const type of shuffle(rand, kindsFor(view, r))) {
    if (orders.length >= L.orders) break;
    const o = makeOrder(rand, type, cells, L, view, seen);
    if (o) orders.push(o);
  }
  orders.sort((a, b) => ASK_ORDER.indexOf(a.type) - ASK_ORDER.indexOf(b.type));
  return { r, level: L, cells, view, visible, seen, parts, orders };
}

// ---------- a stack in parts, for a team ----------
/**
 * The stack shared out among n players, so that every container is seen by exactly one of them: each gets whole
 * columns of the floor (a part stands on the floor as it was stacked, nothing hanging in the air, and looks the same in
 * every view), one stretch of the floor each. The columns are taken slice by slice, each slice back the way the last
 * came, so a stretch stays in one piece, and the stretches are cut where the parts come out most even: the fewest
 * between the largest and the smallest part (never more than the tallest column), then the evenest spread.
 * Returns n lists of container keys, in the stretches' order.
 */
export function splitStack(cells, n) {
  const X = cells.length, Y = cells[0].length, cols = [];
  for (let y = 0; y < Y; y++) for (let k = 0; k < X; k++) {
    const x = y % 2 ? X - 1 - k : k, keys = [];
    cells[x][y].forEach((c, z) => { if (c) keys.push(keyOf(x, y, z)); });
    cols.push(keys);
  }
  const parts = Math.max(1, Math.min(n, cols.length)), sizes = cols.map(c => c.length);
  let best = null;
  // every way of cutting the snake into `parts` stretches (at most 3,003, for sixteen columns and six players)
  const cut = (start, left, ends) => {
    if (left === 1) {
      const all = [...ends, cols.length], sums = all.map((end, i) => sizes.slice(i ? all[i - 1] : 0, end).reduce((a, b) => a + b, 0));
      const score = [Math.max(...sums) - Math.min(...sums), sums.reduce((a, b) => a + b * b, 0)];
      if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { score, ends: all };
      return;
    }
    for (let end = start + 1; end <= cols.length - (left - 1); end++) cut(end, left - 1, [...ends, end]);
  };
  cut(0, parts, []);
  return best.ends.map((end, i) => cols.slice(i ? best.ends[i - 1] : 0, end).flat());
}
/** The stack with only these containers in it (a player's part), the rest of the floor empty. */
export function partCells(cells, keys) {
  const mine = new Set(keys);
  return cells.map((col, x) => col.map((row, y) => row.map((c, z) => (mine.has(keyOf(x, y, z)) ? c : 0))));
}

// ---------- prices ----------
/** How much prices have grown by round r. */
export const growth = r => 1 + 0.12 * (r - 1);
/** What your record does to a kind's price: a hit rate of a half leaves it, usually right pays less, usually wrong more. */
export function skillFactor(rec) {
  const h = ((rec?.h || 0) + 1) / ((rec?.t || 0) + 2);
  return Math.min(1.4, Math.max(0.6, 1.45 - 0.9 * h));
}
/** An order's price in round r, given your record for its kind; to the nearest 5. */
export const priceOf = (type, r, rec) => Math.max(5, Math.round(KINDS[type].base * growth(r) * skillFactor(rec) / 5) * 5);
/** Your record after an answer: recent answers count most. */
export const recordAfter = (rec, right) => ({ t: (rec?.t || 0) * 0.95 + 1, h: (rec?.h || 0) * 0.95 + (right ? 1 : 0) });
/** Shipping early: the round's answers pay up to half as much again, by the share of the hold time left. */
export const shipBonus = left => 1 + 0.5 * Math.max(0, Math.min(1, left));

// ---------- together: a table of two to six, the rounds in step ----------
// Everyone at the table plays the same round at the same moment: the room keeps the round and when its order book
// opened, on the database's clock, and every phone runs the book, the drop and the hold from that. Against: each
// answers their own questions; once everyone at the table has finished, the round is settled for all of them (points,
// lives, the standings), and the next opens once everyone has pressed Next. Together: one run for the table, its lives
// and score; each player is shown only their part of the stack (splitStack), and the questions are the team's, the
// first reply to each counting. Prices are plain in both: a record moves its player's own prices, not a table's.
//
// The room's branch, kept by manifest.js through together.js:
//   { v: 2, app, created, people, players: { uid: { name, slot, pid, online } }, next (the mode a new game takes),
//     game: { n, mode: "against" | "team", seed, created, ready: { s<slot>: t } (Ready before round 1, Next after each),
//       round: { r, at, seats (together: the slots the parts are dealt to), runs: { s<slot>: { q<i>: { g } or { p: 1 },
//         ship, done } } (against), answers: { q<i>: { g, by } or { p: 1, by } }, ship: { s<slot>: t }, shipped
//         (together), settled },
//       totals: { s<slot>: { pts, lives, right, wrong, passed, last, out } } (against), team: { pts, lives, right, wrong,
//       passed, last } (together), over } }
// Times are the database's (ms). Keys are s<slot> and q<i>, never bare numbers, which the database reads back as a list
// with holes. Every change below is made inside the room's transaction, on its freshest copy.

export const BOOK = 6000;            // the order book shows this long before the stack drops
export const LEAD = 800;             // from a round's opening to its order book, so every phone has it by then
export const GRACE = 30000;          // the others done this long (and the questions open as long), the table may go on without the last
export const MODES = { against: "Against", team: "Together" };
const MOST = 6;                      // the most at a table (a party's)

const sk = slot => `s${slot}`;
const qk = i => `q${i}`;
const sameAnswer = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fresh = () => ({ pts: 0, lives: LIVES, right: 0, wrong: 0, passed: 0 });
/** The seated players' slots, in order. */
const seatedSlots = g => Object.values(g?.players || {}).filter(p => p && p.slot != null).map(p => p.slot).sort((a, b) => a - b);
const withMe = (present, slot) => [...new Set([...(present || []), slot])].sort((a, b) => a - b);

/** A new table, in the lobby of its first game. */
export function freshTable(players, { app = 2, people = 2, mode = "against", seed = 1, now = Date.now() } = {}) {
  const g = { v: 2, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, next: MODES[mode] ? mode : "against" };
  newGame(g, { mode: g.next, seed, now });
  return g;
}
export const isTable = g => g?.v === 2 && !!g.game && Number.isInteger(g.game.n) && !!MODES[g.game.mode];
/** A new game at the table, in its lobby until everyone at the table says Ready (`by` already has). */
export function newGame(g, { mode, seed, now = Date.now(), by = null }) {
  g.game = { n: (g.game?.n || 0) + 1, mode: MODES[mode] ? mode : "against", seed, created: now, ...(by != null ? { ready: { [sk(by)]: now } } : {}) };
  return true;
}

/** Where a game stands: "lobby" (before round 1), "play" (a round under way), "results" (one settled), "over". */
export function stageOf(game) {
  if (!game) return null;
  if (game.over) return "over";
  if (!game.round) return "lobby";
  return game.round.settled ? "results" : "play";
}
const made = new Map();
/** The game's round in play (or last settled), as makeRound makes it (a team's in its parts); kept, as it's asked for
 *  on every redraw. Not to be changed by whoever asks. */
export function roundOf(game) {
  const team = game.mode === "team" ? (game.round.seats?.length || 1) : 0, key = `${game.seed}/${game.round.r}/${team}`;
  let R = made.get(key);
  if (!R) {
    R = makeRound(game.seed, game.round.r, team);
    made.set(key, R);
    if (made.size > 24) made.delete(made.keys().next().value);
  }
  return R;
}
/** How a round opened at `at` goes: { at, drop (the stack starts to fall), landed, holdEnd, times (each container's
 *  landing, after drop) }, the same on every phone. */
export function timeline(R, at) {
  const { times, last } = dropTimes(R.cells, R.view), drop = at + BOOK, landed = drop + last + LANDING;
  return { at, drop, landed, holdEnd: landed + R.level.exposure, times };
}
/**
 * The part of a team's stack a player sees, as container keys: null for the whole stack (they're the only one with a
 * part), [] for none (they weren't at the table when the round opened). The parts go round the table a step each
 * round, so nobody keeps the same stretch of the floor.
 */
export function partFor(R, seats, slot) {
  const j = (seats || []).indexOf(slot);
  if (j < 0) return [];
  return R.parts ? R.parts[(j + R.r) % R.parts.length] : null;
}

/** A player's lives: against, their own; together, the team's. */
export const livesOf = (game, slot) => (game.mode === "team" ? game.team?.lives ?? LIVES : game.totals?.[sk(slot)]?.lives ?? LIVES);
/** Whether a player plays the rounds still: against, while they have lives (one out of lives watches); together, always. */
export const playing = (game, slot) => game.mode === "team" || livesOf(game, slot) > 0;
/** The replies a round has: against, a player's own; together, the team's: { q<i>: { g } or { p: 1 } }. */
export function repliesOf(game, slot) {
  const round = game?.round;
  return (round && (game.mode === "team" ? round.answers : round.runs?.[sk(slot)])) || {};
}
/** The question in hand: the first with no reply, or -1. Questions come one at a time, as alone. */
export function firstOpen(replies, n) {
  for (let i = 0; i < n; i++) if (!replies?.[qk(i)]) return i;
  return -1;
}

/**
 * Who the table waits for to go on: { stage, waiting: [slots], without: the one left once everyone else is done, at:
 * from when the table may go on without them }. In a round (against): those at the table still playing who haven't
 * finished it, the last one's grace counted from when the others were done and the questions open; before round 1 and
 * after each, those who haven't said Ready or Next (those still playing, unless everyone here is out: then the
 * watchers move it on). `present`: the slots at the table now (the game open, online); nobody else holds it up.
 */
export function waitingFor(g, present, now) {
  const game = g?.game, stage = stageOf(game), out = { stage, waiting: [], without: null, at: null };
  if (!game || stage === "over" || (stage === "play" && game.mode === "team")) return out;
  let who, mark, from = 0;
  if (stage === "play") {
    who = present.filter(s => playing(game, s));
    mark = s => game.round.runs?.[sk(s)]?.done;
    from = timeline(roundOf(game), game.round.at).holdEnd;
  } else {
    who = stage === "lobby" ? present : present.filter(s => playing(game, s));
    if (!who.length) who = present;
    mark = s => game.ready?.[sk(s)];
  }
  out.waiting = who.filter(s => !mark(s));
  const done = who.filter(s => mark(s));
  if (out.waiting.length === 1 && done.length) { out.without = out.waiting[0]; out.at = Math.max(from, ...done.map(mark)) + GRACE; }
  return out;
}
/** The next round opens: its order book a moment from now, for everyone at once; together, its stack in parts for
 *  those at the table. */
export function openRound(g, present, now) {
  const game = g.game, r = (game.round?.r || 0) + 1;
  if (game.over || r > ROUNDS) return false;
  game.round = { r, at: now + LEAD, ...(game.mode === "team" ? { seats: [...new Set(present)].sort((a, b) => a - b) } : {}) };
  delete game.ready;
  return true;
}
/** Ready (before round 1) or Next (after a round): once everyone at the table has said it, the next round opens (the
 *  first needs two at the table). */
export function sayReady(g, slot, present, now) {
  const game = g?.game, stage = stageOf(game);
  if (slot == null || (stage !== "lobby" && stage !== "results") || game.ready?.[sk(slot)]) return false;
  game.ready = { ...(game.ready || {}), [sk(slot)]: now };
  const here = withMe(present, slot);
  if (!waitingFor(g, here, now).waiting.length && (stage !== "lobby" || here.length >= 2)) openRound(g, here, now);
  return true;
}
/** Going on without the one the table waits for, once their time is up (waitingFor): the round settled with what they
 *  answered (the rest passed), or the next round opened without their Next. */
export function goOn(g, slot, present, now) {
  const here = withMe(present, slot), w = waitingFor(g, here, now);
  if (w.without == null || w.without === slot || now < w.at) return false;
  return w.stage === "play" ? settle(g, now) : openRound(g, here, now);
}

/**
 * A reply to question i of round r: an answer ({ g: what was given }) or a pass ({ p: 1 }). Against, a player's own,
 * in order: once all of theirs are in they're done, and the round settles if nobody at the table is still playing it.
 * Together, the team's: the first reply to the question in hand counts, and a stale one (answered meanwhile, or the
 * round moved on) changes nothing; the last one settles the round. False when nothing changed.
 */
export function reply(g, slot, r, i, rep, { present = [], now = Date.now() } = {}) {
  const game = g?.game, round = game?.round;
  if (stageOf(game) !== "play" || round.r !== r || slot == null) return false;
  const n = roundOf(game).orders.length, stored = rep?.p ? { p: 1 } : rep?.g != null ? { g: rep.g } : null;
  if (!stored || !(i >= 0 && i < n)) return false;
  if (game.mode === "team") {
    round.answers ??= {};
    if (firstOpen(round.answers, n) !== i) return false;
    round.answers[qk(i)] = { ...stored, by: slot };
    if (firstOpen(round.answers, n) < 0) settle(g, now);
    return true;
  }
  if (!playing(game, slot)) return false;
  const run = (round.runs ??= {})[sk(slot)] ??= {};
  if (firstOpen(run, n) !== i) return false;                       // in already (sent twice), or out of order
  run[qk(i)] = stored;
  if (firstOpen(run, n) < 0) {
    run.done = now;
    settleIfDue(g, withMe(present, slot), now);
  }
  return true;
}
/**
 * Ship it, at `now`. Against, it ends only your own hold, for your own bonus. Together, your part goes, and once
 * everyone at the table with a part has shipped, the team's hold ends then, and the team's answers pay by what was left.
 */
export function ship(g, slot, r, { present = [], now = Date.now() } = {}) {
  const game = g?.game, round = game?.round;
  if (stageOf(game) !== "play" || round.r !== r || slot == null) return false;
  if (game.mode === "team") {
    if (!(round.seats || []).includes(slot) || round.ship?.[sk(slot)] || round.shipped) return false;
    round.ship = { ...(round.ship || {}), [sk(slot)]: now };
    const here = withMe(present, slot);
    if (round.seats.filter(s => here.includes(s)).every(s => round.ship[sk(s)])) round.shipped = now;
    return true;
  }
  if (!playing(game, slot)) return false;
  const run = (round.runs ??= {})[sk(slot)] ??= {};
  if (run.ship) return false;
  run.ship = now;
  return true;
}
/** What shipping at `shipAt` pays a round's answers (as alone): up to half as much again, by the share of the hold left. */
export function bonusAt(R, at, shipAt) {
  return shipAt ? Math.round(shipBonus((timeline(R, at).holdEnd - shipAt) / R.level.exposure) * 100) / 100 : 1;
}
/** The bonus this round's answers are paid at: against, a player's own; together, the team's. */
export const bonusOf = (game, slot) => bonusAt(roundOf(game), game.round.at, game.mode === "team" ? game.round.shipped : game.round.runs?.[sk(slot)]?.ship);

/**
 * The round judged, once, for everyone. Against, each player still playing is paid for their right answers (at their
 * own bonus), loses a life for each wrong one, and has passed what they didn't answer; together, the team. The game is
 * over after the twelfth round, or once nobody (together, the team) has a life left.
 */
export function settle(g, now) {
  const game = g?.game, round = game?.round;
  if (stageOf(game) !== "play") return false;
  const R = roundOf(game), prices = R.orders.map(o => priceOf(o.type, round.r));
  const judge = (t, replies, bonus) => {
    let got = 0;
    R.orders.forEach((o, i) => {
      const a = replies?.[qk(i)];
      if (!a || a.p) t.passed++;
      else if (sameAnswer(a.g, o.question.answer)) { got += Math.round(prices[i] * bonus); t.right++; }
      else { t.lives = Math.max(0, t.lives - 1); t.wrong++; }
    });
    t.pts += got;
    t.last = got;
  };
  if (game.mode === "team") {
    judge(game.team ??= fresh(), round.answers, bonusOf(game));
    if (game.team.lives <= 0 || round.r >= ROUNDS) game.over = now;
  } else {
    const slots = seatedSlots(g);
    game.totals ??= {};
    for (const s of slots) {
      const t = game.totals[sk(s)] ??= fresh();
      if (t.lives <= 0) { delete t.last; continue; }                 // out before this round: watching
      judge(t, round.runs?.[sk(s)], bonusOf(game, s));
      if (t.lives <= 0) t.out = round.r;
    }
    if (round.r >= ROUNDS || slots.every(s => game.totals[sk(s)].lives <= 0)) game.over = now;
  }
  round.settled = now;
  return true;
}
/** Settles the round (against) once nobody at the table is still playing it: everyone here who plays has finished, or
 *  nobody here plays and its hold is over. */
export function settleIfDue(g, present, now) {
  const game = g?.game;
  if (stageOf(game) !== "play" || game.mode !== "against" || waitingFor(g, present, now).waiting.length) return false;
  if (!present.some(s => playing(game, s)) && now < timeline(roundOf(game), game.round.at).holdEnd) return false;
  return settle(g, now);
}

/** The mode a new game is dealt in (the menu's together part); before round 1, this game's too (and everyone says
 *  Ready again). */
export function setNext(g, mode) {
  if (!MODES[mode] || !g?.game) return false;
  g.next = mode;
  if (stageOf(g.game) === "lobby" && g.game.mode !== mode) { g.game.mode = mode; delete g.game.ready; }
  return true;
}
/** Play again, or a new game from the menu: dealt in the next mode by whoever asks first while game n is the one at the
 *  table; one who asks a moment later says Ready to it instead. */
export function again(g, slot, n, { seed, present = [], now = Date.now() } = {}) {
  const game = g?.game;
  if (!game || slot == null) return false;
  if (game.n === n) return newGame(g, { mode: g.next || game.mode, seed, now, by: slot });
  return game.n === n + 1 && stageOf(game) === "lobby" ? sayReady(g, slot, present, now) : false;
}

/** Everyone seated and their game so far (against), by seat: [{ uid, slot, name, pts, last (this round's points; null
 *  for one already out), lives, out (the round they ran out in), right, wrong, passed }]. */
export function scoresOf(g) {
  const game = g?.game;
  return Object.entries(g?.players || {}).filter(([, p]) => p && p.slot != null).sort((a, b) => a[1].slot - b[1].slot).map(([uid, p]) => {
    const t = game?.totals?.[sk(p.slot)];
    return { uid, slot: p.slot, name: p.name || "Player", pts: t?.pts || 0, last: t?.last ?? null, lives: t ? t.lives : LIVES, out: t?.out ?? null,
      right: t?.right || 0, wrong: t?.wrong || 0, passed: t?.passed || 0 };
  });
}
/** How each of the round's questions went for a player (against) or the team: "right", "wrong" or "passed". */
export function verdicts(game, slot) {
  const R = roundOf(game), replies = repliesOf(game, slot);
  return R.orders.map((o, i) => { const a = replies[qk(i)]; return !a || a.p ? "passed" : sameAnswer(a.g, o.question.answer) ? "right" : "wrong"; });
}
/** The game as a player saw it, once it's over, for the pair's record: { match, score, won, coop }. Against, won is
 *  coming first alone; together, the team's score, won if it came through the twelve rounds. Else null. */
export function resultOf(g, slot) {
  const game = g?.game;
  if (!game?.over || slot == null) return null;
  const match = `${game.seed}-${game.created}`;
  if (game.mode === "team") return { match, score: game.team?.pts || 0, won: (game.team?.lives || 0) > 0, coop: true };
  const rows = scoresOf(g), mine = rows.find(x => x.slot === slot);
  if (!mine) return null;
  const top = Math.max(...rows.map(x => x.pts));
  return { match, score: mine.pts, won: mine.pts === top && rows.filter(x => x.pts === top).length === 1, coop: false };
}
