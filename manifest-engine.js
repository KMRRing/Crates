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
 * ones you could see, and can see again.
 */
function makeChange(r, cells, L, visible, variant) {
  const spots = [...visible].map(unkey), X = cells.length, Y = cells[0].length;
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

/** Round r of a run: { r, level, cells, view, visible, orders }. Orders are fixed by the seed; prices are not. */
export function makeRound(seed, r) {
  const L = levelOf(r), rand = rng(mix(seed, r));
  const cells = makeStack(rand, L);
  // the views take turns over the rounds that aren't change rounds
  const view = L.change ? "all" : ["layers", "all", "slices", "pair"][(r - 1 - Math.floor((r - 1) / 4)) % 4];
  const visible = visibleSet(cells);
  if (L.change) return { r, level: L, cells, view, visible, orders: [makeChange(rand, cells, L, visible, L.change)] };
  const orders = [];
  for (const type of shuffle(rand, kindsFor(view, r))) {
    if (orders.length >= L.orders) break;
    const o = makeOrder(rand, type, cells, L, view, visible);
    if (o) orders.push(o);
  }
  orders.sort((a, b) => ASK_ORDER.indexOf(a.type) - ASK_ORDER.indexOf(b.type));
  return { r, level: L, cells, view, visible, orders };
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
