// Manifest: a stack of coloured containers is shown for a few seconds, then it's gone and you're asked about it.
// How many blue? How many on tier 2? Which colour sits here? Which one changed? Rounds get bigger stacks, more
// colours, less time, and a different view each time: vertical slices, flat layers, two tiers only, or the whole
// stack in isometric, where the inner containers are hidden and questions ask only about what you could see.

export const LIVES = 3;
export const COLOURS = [
  { id: "red", name: "Red", hex: "#D23B2A" },
  { id: "blue", name: "Blue", hex: "#2F6FDE" },
  { id: "yellow", name: "Yellow", hex: "#F2C230" },
  { id: "green", name: "Green", hex: "#2E9E5B" },
  { id: "orange", name: "Orange", hex: "#E8832A" },
  { id: "purple", name: "Purple", hex: "#7A4BC9" },
];
export const VIEWS = { slices: "Vertical slices", layers: "Flat layers", pair: "Two tiers", iso: "The whole stack" };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;

/** How hard round r is: the stack's size, colours, time on screen, view and how many questions. */
export function levelOf(r) {
  return {
    x: Math.min(5, 3 + Math.floor((r - 1) / 3)),
    y: Math.min(4, 2 + Math.floor((r - 1) / 4)),
    z: Math.min(4, 2 + Math.floor((r - 1) / 5)),
    colours: Math.min(COLOURS.length, 3 + Math.floor((r - 1) / 2)),
    exposure: Math.max(2500, 6500 - 350 * (r - 1)),           // ms the stack shows
    questions: r < 4 ? 1 : 2,
    change: r % 5 === 0,                                        // every fifth round: spot the change
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

// ---------- isometric visibility ----------
// The whole-stack view hides inner containers. Which ones show is settled the way the screen settles it: the cubes
// are drawn back to front onto a small raster of ids, and a cube is visible if any of its pixels survive.
const ISO = { w: 0.866, h: 0.5 };
/** Screen position (in cube units) of the corner of cell (x, y, z) as the page draws it. */
export const isoPoint = (x, y, z) => ({ sx: (x - y) * ISO.w, sy: (x + y) * ISO.h - z });
/** The three faces of a cube as polygons in cube units: top, left (the +y face), right (the +x face). */
export function cubeFaces(x, y, z) {
  const p = (dx, dy, dz) => { const q = isoPoint(x + dx, y + dy, z + dz); return [q.sx, q.sy]; };
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
export function visibleSet(cells) {
  const order = drawOrder(cells);
  const polys = order.map(cube => ({ key: `${cube.x},${cube.y},${cube.z}`, faces: Object.values(cubeFaces(cube.x, cube.y, cube.z)) }));
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

// ---------- questions ----------
/** Number options around the truth: five, including it, never negative. */
function numberOptions(r, truth) {
  const opts = new Set([truth]);
  const spread = Math.max(2, Math.round(truth * 0.5));
  let guard = 0;
  while (opts.size < 5 && guard++ < 50) { const v = truth + int(r, -spread, spread); if (v >= 0) opts.add(v); }
  for (let v = truth + 1; opts.size < 5; v++) opts.add(v);
  return [...opts].sort((a, b) => a - b);
}
const colourName = c => COLOURS[c - 1].name;

/**
 * The questions for a round, given the stack and view. Each: { type, text, answer, options (for numbers or colours),
 * cell (for a marked position), kind: "number" | "colour" | "cell" }.
 */
function makeQuestions(r, cells, L, view, visible) {
  const colours = new Set();
  each(cells, (x, y, z, c) => colours.add(c));
  const used = [...colours];
  const qs = [];
  const total = count(cells, () => true);
  const types = { slices: ["count", "tier", "at", "most"], layers: ["count", "tier", "at", "most"], pair: ["count2", "at2", "tier2"], iso: ["seen", "top", "seenMost"] }[view];
  const pool = [...types];
  for (let k = 0; k < L.questions && pool.length; k++) {
    const type = pool.splice(Math.floor(r() * pool.length), 1)[0];
    switch (type) {
      case "count": { const c = pick(r, used); const n = count(cells, (x, y, z, cc) => cc === c); qs.push({ type, kind: "number", text: `How many ${colourName(c).toLowerCase()} containers?`, colour: c, answer: n, options: numberOptions(r, n) }); break; }
      case "tier": { const z = int(r, 0, L.z - 1); const n = count(cells, (x, y, zz) => zz === z); qs.push({ type, kind: "number", text: `How many containers on tier ${z + 1}?`, answer: n, options: numberOptions(r, n) }); break; }
      case "at": {
        const spots = []; each(cells, (x, y, z) => spots.push([x, y, z]));
        const [x, y, z] = pick(r, spots);
        qs.push({ type, kind: "colour", text: `Which colour is the marked container (tier ${z + 1})?`, cell: { x, y, z }, answer: cells[x][y][z], options: used });
        break;
      }
      case "most": {
        const tally = used.map(c => [c, count(cells, (x, y, z, cc) => cc === c)]).sort((a, b) => b[1] - a[1]);
        if (tally.length < 2 || tally[0][1] === tally[1][1]) { pool.push("count"); k--; break; }
        qs.push({ type, kind: "colour", text: "Which colour is most common?", answer: tally[0][0], options: used });
        break;
      }
      case "count2": { const c = pick(r, used); const n = count(cells, (x, y, z, cc) => cc === c && z < 2); qs.push({ type, kind: "number", text: `How many ${colourName(c).toLowerCase()} containers on the two tiers you saw?`, colour: c, answer: n, options: numberOptions(r, n) }); break; }
      case "tier2": { const z = int(r, 0, Math.min(1, L.z - 1)); const n = count(cells, (x, y, zz) => zz === z); qs.push({ type, kind: "number", text: `How many containers on tier ${z + 1}?`, answer: n, options: numberOptions(r, n) }); break; }
      case "at2": {
        const spots = []; each(cells, (x, y, z) => { if (z < 2) spots.push([x, y, z]); });
        const [x, y, z] = pick(r, spots);
        qs.push({ type, kind: "colour", text: `Which colour is the marked container (tier ${z + 1})?`, cell: { x, y, z }, answer: cells[x][y][z], options: used });
        break;
      }
      case "seen": { const c = pick(r, used); const n = count(cells, (x, y, z, cc) => cc === c && visible.has(`${x},${y},${z}`)); qs.push({ type, kind: "number", text: `How many ${colourName(c).toLowerCase()} containers could you see?`, colour: c, answer: n, options: numberOptions(r, n) }); break; }
      case "top": {
        const tops = []; cells.forEach((col, x) => col.forEach((row, y) => { const h = row.filter(Boolean).length; if (h) tops.push([x, y, h - 1]); }));
        const [x, y, z] = pick(r, tops.filter(([x, y, z]) => visible.has(`${x},${y},${z}`)));
        qs.push({ type, kind: "colour", text: "Which colour is on top of the marked column?", cell: { x, y, z }, answer: cells[x][y][z], options: used });
        break;
      }
      case "seenMost": {
        const tally = used.map(c => [c, count(cells, (x, y, z, cc) => cc === c && visible.has(`${x},${y},${z}`))]).sort((a, b) => b[1] - a[1]);
        if (tally.length < 2 || tally[0][1] === tally[1][1]) { pool.push("seen"); k--; break; }
        qs.push({ type, kind: "colour", text: "Which colour could you see most of?", answer: tally[0][0], options: used });
        break;
      }
    }
  }
  return { qs, total };
}

/** A change round: one container recoloured; the question is which. */
function makeChange(r, cells, L) {
  const spots = []; each(cells, (x, y, z) => spots.push([x, y, z]));
  const [x, y, z] = pick(r, spots);
  const before = cells[x][y][z];
  let after = before;
  while (after === before) after = int(r, 1, L.colours);
  const changed = cells.map(col => col.map(row => [...row]));
  changed[x][y][z] = after;
  return { changed, question: { type: "change", kind: "cell", text: "One container changed colour. Tap it.", cell: { x, y, z }, answer: `${x},${y},${z}` } };
}

/** Round r of a run: { r, level, cells, view, visible, questions, changed? }. */
export function makeRound(seed, r) {
  const L = levelOf(r), rand = rng(mix(seed, r));
  const cells = makeStack(rand, L);
  const change = L.change;
  const view = change ? pick(rand, ["slices", "layers"]) : ["slices", "layers", "pair", "iso"][(r - 1) % 4];
  const visible = view === "iso" ? visibleSet(cells) : null;
  if (change) { const c = makeChange(rand, cells, L); return { r, level: L, cells, view, visible, questions: [c.question], changed: c.changed }; }
  const { qs } = makeQuestions(rand, cells, L, view, visible);
  return { r, level: L, cells, view, visible, questions: qs };
}

/** Points for a right answer in round r: more for harder rounds. */
export const points = r => 50 + 25 * (r - 1);
