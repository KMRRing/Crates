// Asterism on shapes other than the flat square board: a football and a hexagon. Pure (no page), so the generator, the
// tests and the view (asterism-space.js) share one geometry.
//
// The rule is the flat game's: every line and every region holds one star, none touching. What a "line" is has to be
// settled for each shape, because a row and a column exist only on a square grid:
//   football: the Goldberg ball GP(m,0), the icosahedron's faces cut m to an edge into hexagons, a pentagon at each of its
//     12 corners. A line is a RING: a straight row of hexagons, in at one side and out at the opposite, that goes right
//     round the ball and meets no pentagon. There are m-1 of them round each of the six axes through opposite pentagons; a
//     hexagon inside a face lies on three, one on a face's edge on two. The pentagons are the ball's black panels: no star,
//     no region (23 November 2026, Korbi: the cube "definitely doesn't work ... Maybe it'd work with hexagons? ... Replace
//     the cube with football"). A star covers two or three rings, so the stars are 2(m-1) to 3(m-1). Rings that long and
//     regions that tile the ball made puzzles only long trial and error could solve (the cube's trouble too), so a ball's
//     regions are CONSTELLATIONS of three to eight hexagons, one star in each, and the hexagons outside them are dark SKY,
//     which holds none: a few small regions, and the rings running through them, are a puzzle reasoning can work;
//   hexagon: a hexagonal board of side s, its lines the rows in each of the three directions (2s-1 in each, of
//     lengths s to 2s-1). A cell lies on three; 2s-1 stars and regions.
// One star a line only: with two a line the puzzles need more room than a phone gives these shapes.
import { rngOf, shuffle } from "./loop-engine.js";
import { ORDER, gradeOf } from "./asterism-engine.js";
import { BANK } from "./asterism-bank.js";

export const SHAPES = { flat: "Flat", ball: "Football", hex: "Hexagons" };
export const SOLID_SIZES = { ball: [3, 4], hex: [4, 5, 6, 7] };
/** A ball's cells outside every constellation: "z" in a region map. */
export const SKY = 35;
/** What a size is called in the menu, from the shape's own measure (a ball by its panels, as a football's 32 are counted). */
export const sizeName = (shape, n) => (shape === "ball" ? `${10 * n * n + 2} panels` : shape === "hex" ? `Side ${n}` : `${n}×${n}`);
export const isSolid = shape => shape === "ball" || shape === "hex";
export const solidKind = (shape, size) => `${shape}:${size}`;
const TRIES = 24, MOVES = 24, WORK = 36;            // counts, not times: a seed makes the same puzzle on every device

// ---------- the shapes ----------
const TOPOS = new Map();
/** The shape's cells and lines: { shape, size, n, nbr (cells that touch), side (cells sharing an edge), lines [{ kind, id,
 *  axis, cells (in order round or along it), cyclic }], mesh { cells [{ c, nrm, pts }], blank (the pentagons' outlines),
 *  closed, size (a cell's width), radius (everything fits a circle this far from the middle) } }. */
export function topoOf(shape, size) {
  const key = solidKind(shape, size);
  let t = TOPOS.get(key);
  if (!t) { t = shape === "ball" ? ballTopo(size) : hexTopo(size); t.shape = shape; t.size = size; TOPOS.set(key, t); }
  return t;
}
const unit = p => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const PHI = (1 + Math.sqrt(5)) / 2;
export const ICOSA = {
  V: [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(unit),
  F: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]],
};
/** The ball GP(m,0): each icosahedron face's lattice of m to an edge, its points the panels (a corner's a pentagon), the
 *  small triangles between them the ball's corners. Points shared by faces are named, not measured, so each is made once. */
function ballTopo(m) {
  const { V, F } = ICOSA, idx = new Map(), pos = [];
  const at = (f, i, j) => {                                     // weights: the face's first corner m-i-j, its second i, its third j
    const w = [[F[f][0], m - i - j], [F[f][1], i], [F[f][2], j]].filter(([, x]) => x > 0).sort((a, b) => a[0] - b[0]);
    const name = w.length === 1 ? `v${w[0][0]}` : w.length === 2 ? `e${w[0][0]}-${w[1][0]}:${w[0][1]}` : `f${f}:${i},${j}`;
    if (!idx.has(name)) idx.set(name, pos.push(unit([0, 1, 2].map(d => w.reduce((t, [v, x]) => t + V[v][d] * x, 0) / m))) - 1);
    return idx.get(name);
  };
  const tris = [];
  for (let f = 0; f < 20; f++) for (let i = 0; i < m; i++) for (let j = 0; i + j < m; j++) {
    tris.push([at(f, i, j), at(f, i + 1, j), at(f, i, j + 1)]);
    if (i + j <= m - 2) tris.push([at(f, i + 1, j), at(f, i + 1, j + 1), at(f, i, j + 1)]);
  }
  const N = pos.length, near = Array.from({ length: N }, () => new Set()), round = Array.from({ length: N }, () => []);
  const corner = tris.map(t => unit([0, 1, 2].map(d => pos[t[0]][d] + pos[t[1]][d] + pos[t[2]][d])));
  tris.forEach((t, ti) => t.forEach((a, k) => { near[a].add(t[(k + 1) % 3]); near[a].add(t[(k + 2) % 3]); round[a].push(ti); }));
  /** Angles round a panel, in its own plane. */
  const angleRound = c => {
    const z = pos[c], x = unit(cross(Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], z)), y = cross(z, x);
    return p => Math.atan2(dot(p, y), dot(p, x));
  };
  const ring = [], outline = [];
  for (let c = 0; c < N; c++) {
    const a = angleRound(c);
    ring.push([...near[c]].sort((p, q) => a(pos[p]) - a(pos[q])));
    outline.push(round[c].slice().sort((p, q) => a(corner[p]) - a(corner[q])).map(ti => corner[ti]));
  }
  // the hexagons are the cells, numbered in the order made; the pentagons are left out
  const cellOf = new Int16Array(N).fill(-1), hexes = [];
  for (let c = 0; c < N; c++) if (ring[c].length === 6) { cellOf[c] = hexes.length; hexes.push(c); }
  const nbr = hexes.map(c => ring[c].map(d => cellOf[d]).filter(d => d >= 0));
  // the rings: in at one side and out at the opposite, until back where it began; one that meets a pentagon is none
  const lines = [], seen = new Set(), axes = [];
  for (const c of hexes) for (let d = 0; d < 3; d++) {
    const cells = [c];
    let prev = c, cur = ring[c][d];
    while (cur !== c && ring[cur].length === 6) { cells.push(cur); const next = ring[cur][(ring[cur].indexOf(prev) + 3) % 6]; prev = cur; cur = next; }
    if (cur !== c) continue;
    const name = cells.slice().sort((p, q) => p - q).join();
    if (seen.has(name)) continue;
    seen.add(name);
    // its axis: the ring goes round it; rings round one axis are disjoint, as the rows of a family are
    const nrm = unit(cells.reduce((t, x, i) => { const v = cross(pos[x], pos[cells[(i + 1) % cells.length]]); return [t[0] + v[0], t[1] + v[1], t[2] + v[2]]; }, [0, 0, 0]));
    let axis = axes.findIndex(a => Math.abs(dot(a, nrm)) > 0.95);
    if (axis < 0) axis = axes.push(nrm) - 1;
    lines.push({ kind: "ring", axis, cells: cells.map(x => cellOf[x]), cyclic: true });
  }
  lines.sort((p, q) => p.axis - q.axis || Math.min(...p.cells) - Math.min(...q.cells));
  lines.forEach((l, i) => { l.id = i; });
  const width = Math.acos(Math.min(1, dot(pos[hexes[0]], pos[ring[hexes[0]][0]])));
  const mesh = { cells: hexes.map(c => ({ c: pos[c], nrm: pos[c], pts: outline[c] })), blank: pos.map((p, c) => (ring[c].length === 5 ? outline[c] : null)).filter(Boolean), closed: true, size: width, radius: 1 };
  return { n: hexes.length, nbr, side: nbr, lines, families: axes.length, mesh };
}
function hexTopo(s) {
  const cells = [], index = new Map();
  for (let r = -(s - 1); r <= s - 1; r++) for (let q = -(s - 1); q <= s - 1; q++) if (Math.abs(q + r) <= s - 1) { index.set(`${q},${r}`, cells.length); cells.push([q, r]); }
  const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const nbr = cells.map(([q, r]) => DIRS.map(([a, b]) => index.get(`${q + a},${r + b}`)).filter(x => x !== undefined));
  const lines = [], L = 2 * s - 1, off = s - 1;
  const family = (id, of, along) => {
    for (let v = 0; v < L; v++) {
      const cs = []; cells.forEach((c, x) => { if (of(c) + off === v) cs.push(x); });
      cs.sort((x, y) => along(cells[x]) - along(cells[y]));
      lines.push({ kind: "line", id: id * L + v, axis: id, cells: cs, cyclic: false });
    }
  };
  family(0, ([q]) => q, ([, r]) => r); family(1, ([, r]) => r, ([q]) => q); family(2, ([q, r]) => q + r, ([q]) => q);
  // pointy-top hexagons of width 1 (centres 1 apart), the board filling a circle of radius 1
  const R = 1 / Math.sqrt(3), ext = Math.max(...cells.map(([q, r]) => Math.hypot(Math.sqrt(3) * (q + r / 2), 1.5 * r))) + 2 * R;
  const mc = cells.map(([q, r]) => {
    const cx = Math.sqrt(3) * (q + r / 2) * R, cy = 1.5 * r * R, pts = Array.from({ length: 6 }, (_, i) => { const an = Math.PI / 6 + i * Math.PI / 3; return [(cx + R * Math.cos(an)) / ext * 2, (cy + R * Math.sin(an)) / ext * 2, 0]; });
    return { c: [cx / ext * 2, cy / ext * 2, 0], nrm: [0, 0, 1], pts };
  });
  // cells sharing a hexagon edge also share a corner pair: the corners' names come from their rounded coordinates
  return { n: cells.length, nbr, side: nbr, lines, families: 3, mesh: { cells: mc, closed: false, size: 1 / ext * 2, radius: 1 } };
}

// ---------- the puzzle of a region map ----------
const PUZZLES = new Map();
/** As asterism-engine.js's puzzleOf, for a shape: the groups are the lines then the regions, one star in each. */
export function solidPuzzle(shape, size, reg, sol = null) {
  const key = `${shape}.${size}.${reg}`;
  let P = PUZZLES.get(key);
  if (!P) {
    const T = topoOf(shape, size), R = Uint8Array.from(reg, ch => parseInt(ch, 36)), L = T.lines.length;
    const groups = T.lines.map(l => ({ kind: l.kind, id: l.id, cells: l.cells }));
    const count = regionsIn(shape, size, reg), sky = [];
    for (let i = 0; i < count; i++) groups.push({ kind: "region", id: i, cells: [] });
    for (let x = 0; x < T.n; x++) if (R[x] === SKY) sky.push(x); else groups[L + R[x]]?.cells.push(x);
    if (sky.length) groups.push({ kind: "sky", id: 0, cells: sky, k: 0 });   // known empty from the start (asterism-engine.js's stateOf)
    const of = Array.from({ length: T.n }, () => []);
    groups.forEach((g, gi) => { for (const c of g.cells) of[c].push(gi); });
    const regs = Array.from({ length: count }, (_, i) => L + i), word = shape === "ball" ? "ring" : "line";
    const pairs = [];
    for (let f = 0; f < T.families; f++) {                  // the lines of a family are disjoint: weighed against the regions
      const fam = []; T.lines.forEach((l, i) => { if (l.axis === f) fam.push(i); });
      pairs.push([fam, regs, "regions-in-lines", word], [regs, fam, "lines-in-regions", word]);
    }
    P = { shape, size, n: T.n, k: 1, reg: R, nbr: T.nbr.map(l => Int16Array.from(l)), groups, of, pairs, topo: T, sky };
    if (PUZZLES.size > 200) PUZZLES.clear();
    PUZZLES.set(key, P);
  }
  return sol ? { ...P, sol: Uint8Array.from(sol, Number) } : P;
}
/** How many regions (and stars) a puzzle has: a hexagon board's are fixed; a ball's are as many as its map has. */
const regionsIn = (shape, size, reg) => (shape === "hex" ? 2 * size - 1 : Math.max(...Array.from(reg, ch => parseInt(ch, 36)).filter(r => r !== SKY)) + 1);
export const solidRegionsOk = (shape, size, reg) => {
  const T = topoOf(shape, size);
  if (reg.length !== T.n || !/^[0-9a-z]+$/.test(reg)) return false;
  const count = regionsIn(shape, size, reg), L = T.lines.length;
  return [...reg].every(c => parseInt(c, 36) < count || (shape === "ball" && c === "z")) && (shape === "hex" || (count >= L / 3 && count <= L / 2));
};
/** The stars a puzzle of the shape has: fixed on a hexagon board; on a ball, a range (each star is on two or three rings). */
export const regionCount = (shape, size) => (shape === "hex" ? 2 * size - 1 : null);

// ---------- the answer: a plain search ----------
/** Up to `limit` answers (lists of cells), by search: a group with just as many cells left as stars needs them all
 *  (settled before anything is tried), then the group with the fewest cells left is tried a star in each of its cells in
 *  turn, the earlier ones then known empty. Nothing of the solver's reasoning is in it. */
export function solidAnswers(P, limit = 2) {
  const out = [], G = P.groups, k = P.k;
  const place = (st, x) => {
    if (st[x] !== 0) return st[x] === 1;
    st[x] = 1;
    for (const d of P.nbr[x]) { if (st[d] === 1) return false; if (st[d] === 0) st[d] = 2; }
    for (const gi of P.of[x]) {
      let have = 0;
      for (const y of G[gi].cells) if (st[y] === 1) have++;
      const want = G[gi].k ?? k;
      if (have > want) return false;
      if (have === want) for (const y of G[gi].cells) if (st[y] === 0) st[y] = 2;
    }
    return true;
  };
  /** Settles what is forced; false if a group is left without room. */
  const settle = st => {
    for (let changed = true; changed;) {
      changed = false;
      for (const g of G) {
        let have = 0, free = 0;
        for (const y of g.cells) { if (st[y] === 1) have++; else if (st[y] === 0) free++; }
        const want = g.k ?? k;
        if (have > want || have + free < want) return false;
        if (have < want && have + free === want) { for (const y of g.cells) if (st[y] === 0 && !place(st, y)) return false; changed = true; }
      }
    }
    return true;
  };
  const go = st => {
    if (out.length >= limit) return;
    if (!settle(st)) return;
    let best = null, bestFree = 1e9;
    for (const g of G) {
      let have = 0, free = 0;
      for (const y of g.cells) { if (st[y] === 1) have++; else if (st[y] === 0) free++; }
      if (have < (g.k ?? k) && free < bestFree) { bestFree = free; best = g; }
    }
    if (!best) { const cells = []; st.forEach((v, x) => { if (v === 1) cells.push(x); }); out.push(cells); return; }
    const cands = best.cells.filter(x => st[x] === 0);
    for (let i = 0; i < cands.length && out.length < limit; i++) {
      const next = st.slice();
      for (let j = 0; j < i; j++) next[cands[j]] = 2;                // the earlier ones are not stars here
      if (place(next, cands[i])) go(next);
    }
  };
  go(new Int8Array(P.n));
  return out;
}

// ---------- making a puzzle ----------
/** A random arrangement of one star in every line, none touching: cells, or null. */
export function randomStars(T, rng) {
  const n = T.n, st = new Int8Array(n), count = regionCount(T.shape, T.size);    // (a ball's is whatever the rings come to)
  let budget = 3000;
  const lineOf = Array.from({ length: n }, () => []);
  T.lines.forEach((l, i) => { for (const c of l.cells) lineOf[c].push(i); });
  const done = new Uint8Array(T.lines.length);
  const go = () => {
    if (--budget < 0) return false;
    let best = -1, bestFree = 1e9;
    for (let i = 0; i < T.lines.length; i++) {
      if (done[i]) continue;
      let free = 0;
      for (const c of T.lines[i].cells) if (st[c] === 0) free++;
      if (!free) return false;
      if (free < bestFree) { bestFree = free; best = i; }
    }
    if (best < 0) return true;
    const cells = shuffle(T.lines[best].cells.filter(c => st[c] === 0), rng);
    for (const c of cells) {
      const was = st.slice(), wasDone = done.slice();
      st[c] = 1; for (const d of T.nbr[c]) if (st[d] === 0) st[d] = 2;
      for (const li of lineOf[c]) { done[li] = 1; for (const x of T.lines[li].cells) if (x !== c && st[x] === 0) st[x] = 2; }
      if (go()) return true;
      st.set(was); done.set(wasDone);
    }
    return false;
  };
  if (!go()) return null;
  const out = []; st.forEach((v, x) => { if (v === 1) out.push(x); });
  return count == null || out.length === count ? out : null;
}
/** Regions grown round the stars, a cell at a time over the shared edges, the sizes made uneven by `spread`; with `caps`
 *  (a ball's constellations) each stops at its own size and what none reaches is sky. */
export function regionsAround(T, stars, rng, spread, caps = null) {
  const reg = new Int8Array(T.n).fill(-1), order = shuffle(stars.slice(), rng);
  order.forEach((s, i) => { reg[s] = i; });
  const weight = order.map(() => 0.15 + rng() ** (1 + spread) * 2);
  const front = order.map((_, i) => { const f = new Set(); for (const y of T.side[order[i]]) if (reg[y] < 0) f.add(y); return f; });
  const size = order.map(() => 1), cap = caps ? order.map(() => caps()) : null;
  let free = reg.filter(r => r < 0).length;
  while (free > 0) {
    if (cap) for (let i = 0; i < order.length; i++) if (size[i] >= cap[i]) front[i].clear();
    let total = 0;
    for (let i = 0; i < order.length; i++) if (front[i].size) total += weight[i];
    if (!total) { if (!cap) return null; reg.forEach((r, x) => { if (r < 0) reg[x] = SKY; }); return reg; }
    let t = rng() * total, pick = 0;
    for (let i = 0; i < order.length; i++) if (front[i].size) { t -= weight[i]; pick = i; if (t <= 0) break; }
    const cells = [...front[pick]], x = cells[Math.floor(rng() * cells.length)];
    reg[x] = pick; size[pick]++; free--;
    for (const f of front) f.delete(x);
    for (const y of T.side[x]) if (reg[y] < 0) front[pick].add(y);
  }
  return reg;
}
const MIN_REGION = 3;                                    // a region smaller than this gives a star away
const MAX_CONSTELLATION = 10;                            // nor is a ball's constellation larger than this
const connected = (T, reg, r, without) => {
  if (r === SKY) return true;                            // the sky need not be one piece
  const cells = []; reg.forEach((v, x) => { if (v === r && x !== without) cells.push(x); });
  if (cells.length < MIN_REGION) return false;
  const seen = new Set([cells[0]]), queue = [cells[0]];
  for (let q = 0; q < queue.length; q++) for (const y of T.side[queue[q]]) if (reg[y] === r && y !== without && !seen.has(y)) { seen.add(y); queue.push(y); }
  return seen.size === cells.length;
};
/** A region map as text: a character a cell, base 36 (a solid has up to 13 regions). */
/** Whether the regions are fair: none a gift (a handful of cells), none most of the board. */
const fair = (T, reg) => {
  const regs = reg.filter(r => r !== SKY), count = Math.max(...regs) + 1, size = new Int16Array(count); regs.forEach(r => size[r]++);
  if (regs.length < reg.length) return Math.min(...size) >= MIN_REGION && Math.max(...size) <= MAX_CONSTELLATION;
  return Math.min(...size) >= MIN_REGION && Math.max(...size) <= Math.max(0.5 * T.n, 3 * T.n / count);
};
const textOf = reg => Array.from(reg, v => v.toString(36)).join("");
/** Mends a region map until it has the one answer it was made from (as the flat engine does). */
export function mend(shape, size, T, reg, sol, rng) {
  const mine = new Set(sol), key = sol.slice().sort((x, y) => x - y).join();
  for (let t = 0; t < 400; t++) {
    const found = solidAnswers(solidPuzzle(shape, size, textOf(reg)), 8);
    if (!found.length) return null;
    const others = found.filter(a => a.slice().sort((x, y) => x - y).join() !== key);
    if (!others.length) return reg;
    // any cell of another answer, not ours, moved to a region beside it takes that answer's star out of its own region
    const tries = [];
    for (const other of others) for (const c of other) if (!mine.has(c)) for (const y of T.side[c]) if (reg[y] !== reg[c]) tries.push([c, reg[y]]);
    shuffle(tries, rng);
    let use = tries.find(([c]) => connected(T, reg, reg[c], c));
    if (!use) {                                     // all inside their regions: open one up by moving a neighbour out
      const ring = [];
      for (const other of others) for (const c of other) if (!mine.has(c)) for (const y of T.side[c]) if (!mine.has(y)) for (const z of T.side[y]) if (reg[z] !== reg[y]) ring.push([y, reg[z]]);
      shuffle(ring, rng);
      use = ring.find(([y]) => connected(T, reg, reg[y], y));
    }
    if (!use) return null;
    reg[use[0]] = use[1];
  }
  return null;
}
/** A region map one boundary cell different that still has the one answer, or null. */
function moved(shape, size, T, reg, stars, rng) {
  const mine = new Set(stars), cells = [];
  for (let c = 0; c < T.n; c++) if (!mine.has(c)) for (const y of T.side[c]) if (reg[y] !== reg[c]) cells.push([c, reg[y]]);
  shuffle(cells, rng);
  for (const [c, to] of cells.slice(0, 6)) {
    if (!connected(T, reg, reg[c], c)) continue;
    const next = Int8Array.from(reg); next[c] = to;
    if (fair(T, next) && solidAnswers(solidPuzzle(shape, size, textOf(next)), 2).length === 1) return next;
  }
  return null;
}
/** A puzzle of the shape and size steered towards the level: { shape, size, k: 1, reg, sol, level }, or null. */
export function generateSolid(seed, shape, size, level, work = WORK) {
  const banked = BANK[solidKind(shape, size)];
  if (banked) return fromBank(banked, seed, shape, size, level);
  const T = topoOf(shape, size), want = Math.max(0, ORDER.indexOf(level)), rng = rngOf(seed);
  let best = null;
  for (let t = 0, done = 0; t < TRIES && done < work; t++) {
    const stars = randomStars(T, rng);
    if (!stars) continue;
    // a ball's constellations: three hexagons or four for an Easy puzzle, up to eight for an Expert one
    const caps = shape === "ball" ? () => 3 + Math.floor(rng() * [2, 3, 5, 6][want]) : null;
    const reg = regionsAround(T, stars, rng, want === 0 ? 3 : want === 1 ? 2 : rng() * 2, caps);
    if (!reg) continue;
    const mended = mend(shape, size, T, reg, stars, rng);
    if (!mended || !fair(T, mended)) continue;
    let text = textOf(mended), got = gradeOf(solidPuzzle(shape, size, text));
    done++;
    if (got < 0) continue;
    for (let m = 0; m < MOVES && got !== want && done < work; m++) {
      const next = moved(shape, size, T, mended, stars, rng);
      if (!next) continue;
      const g = gradeOf(solidPuzzle(shape, size, textOf(next)));
      done++;
      if (g >= 0 && Math.abs(g - want) <= Math.abs(got - want)) { mended.set(next); got = g; text = textOf(next); }
    }
    const sol = Array.from({ length: T.n }, (_, x) => (stars.includes(x) ? 1 : 0)).join("");
    const found = { shape, size, k: 1, reg: text, sol, level: ORDER[got] };
    if (got === want) return found;
    if (!best || Math.abs(got - want) < Math.abs(ORDER.indexOf(best.level) - want)) best = found;
  }
  return best;
}

// ---------- banked puzzles ----------
// Where grading is too slow to steer a puzzle to its level on a phone (the larger hexagon boards), the puzzles
// are made ahead (asterism-bank.js: each has one answer, and its level) and dealt by seed, each turned or flipped by one
// of the shape's symmetries: 12 for a hexagon, so a few dozen puzzles make many hundreds.
const SYMS = new Map();
/** The shape's symmetries as cell permutations: perm[i] is where cell i goes. */
function symmetries(shape, size) {
  const key = solidKind(shape, size);
  let out = SYMS.get(key);
  if (out) return out;
  const T = topoOf(shape, size), cs = T.mesh.cells.map(c => c.c), mats = [];
  for (let r = 0; r < 6; r++) for (const fl of [1, -1]) { const a = r * Math.PI / 3, c = Math.cos(a), s = Math.sin(a); mats.push(v => [c * v[0] - s * v[1] * fl, s * v[0] + c * v[1] * fl, 0]); }
  out = mats.map(m => cs.map(v => {
    const w = m(v);
    let best = 0, bd = 1e9;
    cs.forEach((u, j) => { const d = (u[0] - w[0]) ** 2 + (u[1] - w[1]) ** 2 + (u[2] - w[2]) ** 2; if (d < bd) { bd = d; best = j; } });
    return best;
  }));
  SYMS.set(key, out);
  return out;
}
export const symmetryCount = (shape, size) => symmetries(shape, size).length;
/** The perm of a symmetry as a function of cell text, for tests. */
export const turnedBy = (shape, size, n, text) => { const perm = symmetries(shape, size)[n], out = new Array(text.length); for (let i = 0; i < perm.length; i++) out[perm[i]] = text[i]; return out.join(""); };
/** A banked puzzle of the level (the nearest level that has any) for a seed, in one of the shape's symmetries. */
function fromBank(bank, seed, shape, size, level) {
  const want = Math.max(0, ORDER.indexOf(level));
  let use = null;
  for (let d = 0; d < ORDER.length && !use; d++) for (const i of [want + d, want - d]) if (!use && ORDER[i] && bank[ORDER[i]]?.length) use = ORDER[i];
  if (!use) return null;
  const list = bank[use], h = Math.imul(seed >>> 0, 2654435761) >>> 0, entry = list[h % list.length], perms = symmetries(shape, size), perm = perms[Math.floor(h / list.length) % perms.length];
  const reg = new Array(entry[0].length), sol = new Array(entry[1].length);
  for (let i = 0; i < perm.length; i++) { reg[perm[i]] = entry[0][i]; sol[perm[i]] = entry[1][i]; }
  return { shape, size, k: 1, reg: reg.join(""), sol: sol.join(""), level: use };
}
