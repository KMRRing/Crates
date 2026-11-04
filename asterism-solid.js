// Asterism on shapes other than the flat square board: a cube and a hexagon. Pure (no page), so the generator, the
// tests and the view (asterism-space.js) share one geometry, as Mines' solids do (mines-solid.js, whose cube it reuses).
//
// The rule is the flat game's: every line and every region holds one star, none touching (even at a corner). What a
// "line" is has to be settled for each shape, because a row and a column exist only on a square grid:
//   cube: a BELT, the ring of cells going round the cube at one layer along an axis (4n cells; n layers on each of 3
//     axes). Every cell lies on exactly two belts (a cell on the +x face is on one y belt and one z belt), as a flat cell
//     lies on a row and a column. A belt, stars and regions: 3n belts holding a star each, so 3n/2 stars and regions:
//     n is even (4, 6, 8);
//   hexagon: a hexagonal board of side s, its lines the rows in each of the three directions (2s-1 in each, of
//     lengths s to 2s-1). A cell lies on three; 2s-1 stars and regions.
// Two shapes that Mines has were left out, for want of lines (docs/asterism.md): the football (a hexagon grid with 12
// pentagons: its straight lines break at every pentagon) and the rhombicuboctahedron (its triangles lie on no belt at all).
// One star a line only: with two a line the puzzles need more room than a phone gives these shapes.
import { solidBoard } from "./mines-solid.js";
import { rngOf, shuffle } from "./loop-engine.js";
import { ORDER, gradeOf } from "./asterism-engine.js";
import { BANK } from "./asterism-bank.js";

export const SHAPES = { flat: "Flat", cube: "Cube", hex: "Hexagons" };
export const SOLID_SIZES = { cube: [4], hex: [4, 5, 6, 7] };
/** What a size is called in the menu, from the shape's own measure. */
export const sizeName = (shape, n) => (shape === "cube" ? `${n} a side` : shape === "hex" ? `side ${n}` : `${n}×${n}`);
export const isSolid = shape => shape === "cube" || shape === "hex";
export const solidKind = (shape, size) => `${shape}:${size}`;
const TRIES = 24, MOVES = 24, WORK = 36;            // counts, not times: a seed makes the same puzzle on every device

// ---------- the shapes ----------
const FACES = [                                         // as mines-solid.js cuts its cube: a face's axes and corner
  n => ({ u: [0, 1, 0], v: [0, 0, 1], o: [n, 0, 0] }), n => ({ u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0] }),
  n => ({ u: [0, 0, 1], v: [1, 0, 0], o: [0, n, 0] }), n => ({ u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0] }),
  n => ({ u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, n] }), n => ({ u: [0, 1, 0], v: [1, 0, 0], o: [0, 0, 0] }),
];
const TOPOS = new Map();
/** The shape's cells and lines: { shape, size, n, nbr (cells sharing a corner), side (cells sharing an edge), lines
 *  [{ kind, id, cells (in order round or along it), cyclic }], mesh { cells [{ c, nrm, pts }], closed, size (a cell's
 *  width), radius (everything fits a circle this far from the middle) } }. */
export function topoOf(shape, size) {
  const key = solidKind(shape, size);
  let t = TOPOS.get(key);
  if (!t) { t = shape === "cube" ? cubeTopo(size) : hexTopo(size); t.shape = shape; t.size = size; t.regions = regionCount(shape, size); TOPOS.set(key, t); }
  return t;
}
function cubeTopo(n) {
  const b = solidBoard("cube", n), lines = [], at = [];
  const per = n * n;
  for (let x = 0; x < b.n; x++) {
    const face = Math.floor(x / per), j = Math.floor((x % per) / n), i = x % n, F = FACES[face](n);
    at.push({ face, p: [0, 1, 2].map(k => F.o[k] + i * F.u[k] + j * F.v[k]), normal: F.o.findIndex((o, k) => F.u[k] === 0 && F.v[k] === 0) });
  }
  for (let a = 0; a < 3; a++) for (let layer = 0; layer < n; layer++) {
    const cells = [];
    for (let x = 0; x < b.n; x++) if (at[x].normal !== a && at[x].p[a] === layer) cells.push(x);
    const [p, q] = [0, 1, 2].filter(k => k !== a), ang = x => Math.atan2(b.cells[x].c[q], b.cells[x].c[p]);
    cells.sort((x, y) => ang(x) - ang(y));
    lines.push({ kind: "belt", id: a * n + layer, axis: a, cells, cyclic: true });
  }
  const mesh = { cells: b.cells.map(({ c, nrm, pts }) => ({ c, nrm, pts })), closed: true, size: b.size, radius: 1 };
  return { n: b.n, nbr: b.nb, side: b.side, lines, mesh };
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
  return { n: cells.length, nbr, side: nbr, lines, mesh: { cells: mc, closed: false, size: 1 / ext * 2, radius: 1 } };
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
    const per = T.lines.length / 3;                         // lines in each of the three families
    const count = shape === "cube" ? 3 * size / 2 : 2 * size - 1;
    for (let i = 0; i < count; i++) groups.push({ kind: "region", id: i, cells: [] });
    for (let x = 0; x < T.n; x++) groups[L + R[x]]?.cells.push(x);
    const of = Array.from({ length: T.n }, () => []);
    groups.forEach((g, gi) => { for (const c of g.cells) of[c].push(gi); });
    const regs = Array.from({ length: count }, (_, i) => L + i), word = shape === "cube" ? "belt" : "line";
    const pairs = [];
    for (let f = 0; f < 3; f++) {
      const fam = Array.from({ length: per }, (_, i) => f * per + i);
      pairs.push([fam, regs, "regions-in-lines", word], [regs, fam, "lines-in-regions", word]);
    }
    P = { shape, size, n: T.n, k: 1, reg: R, nbr: T.nbr.map(l => Int16Array.from(l)), groups, of, pairs, topo: T };
    if (PUZZLES.size > 200) PUZZLES.clear();
    PUZZLES.set(key, P);
  }
  return sol ? { ...P, sol: Uint8Array.from(sol, Number) } : P;
}
export const solidRegionsOk = (shape, size, reg) => { const T = topoOf(shape, size), count = shape === "cube" ? 3 * size / 2 : 2 * size - 1; return reg.length === T.n && /^[0-9a-z]+$/.test(reg) && [...reg].every(c => parseInt(c, 36) < count); };
export const regionCount = (shape, size) => (shape === "cube" ? 3 * size / 2 : 2 * size - 1);

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
      if (have > k) return false;
      if (have === k) for (const y of G[gi].cells) if (st[y] === 0) st[y] = 2;
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
        if (have > k || have + free < k) return false;
        if (have < k && have + free === k) { for (const y of g.cells) if (st[y] === 0 && !place(st, y)) return false; changed = true; }
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
      if (have < k && free < bestFree) { bestFree = free; best = g; }
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
  const n = T.n, st = new Int8Array(n), count = regionCount(T.shape, T.size);
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
  return out.length === count ? out : null;
}
/** Regions grown round the stars, a cell at a time over the shared edges, the sizes made uneven by `spread`. */
export function regionsAround(T, stars, rng, spread) {
  const reg = new Int8Array(T.n).fill(-1), order = shuffle(stars.slice(), rng);
  order.forEach((s, i) => { reg[s] = i; });
  const weight = order.map(() => 0.15 + rng() ** (1 + spread) * 2);
  const front = order.map((_, i) => { const f = new Set(); for (const y of T.side[order[i]]) if (reg[y] < 0) f.add(y); return f; });
  let free = reg.filter(r => r < 0).length;
  while (free > 0) {
    let total = 0;
    for (let i = 0; i < order.length; i++) if (front[i].size) total += weight[i];
    if (!total) return null;
    let t = rng() * total, pick = 0;
    for (let i = 0; i < order.length; i++) if (front[i].size) { t -= weight[i]; pick = i; if (t <= 0) break; }
    const cells = [...front[pick]], x = cells[Math.floor(rng() * cells.length)];
    reg[x] = pick; free--;
    for (const f of front) f.delete(x);
    for (const y of T.side[x]) if (reg[y] < 0) front[pick].add(y);
  }
  return reg;
}
const MIN_REGION = 3;                                    // a region smaller than this gives a star away
const connected = (T, reg, r, without) => {
  const cells = []; reg.forEach((v, x) => { if (v === r && x !== without) cells.push(x); });
  if (cells.length < MIN_REGION) return false;
  const seen = new Set([cells[0]]), queue = [cells[0]];
  for (let q = 0; q < queue.length; q++) for (const y of T.side[queue[q]]) if (reg[y] === r && y !== without && !seen.has(y)) { seen.add(y); queue.push(y); }
  return seen.size === cells.length;
};
/** A region map as text: a character a cell, base 36 (a solid has up to 13 regions). */
/** Whether the regions are fair: none a gift (a handful of cells), none most of the board. */
const fair = (T, reg) => {
  const size = new Int16Array(T.regions); reg.forEach(r => size[r]++);
  return Math.min(...size) >= MIN_REGION && Math.max(...size) <= Math.max(0.5 * T.n, 3 * T.n / T.regions);
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
    const reg = regionsAround(T, stars, rng, want === 0 ? 3 : want === 1 ? 2 : rng() * 2);
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
// Where grading is too slow to steer a puzzle to its level on a phone (a cube; the larger hexagon boards), the puzzles
// are made ahead (asterism-bank.js: each has one answer, and its level) and dealt by seed, each turned or flipped by one
// of the shape's symmetries: 48 for a cube, 12 for a hexagon, so a few dozen puzzles make many hundreds.
const SYMS = new Map();
/** The shape's symmetries as cell permutations: perm[i] is where cell i goes. */
function symmetries(shape, size) {
  const key = solidKind(shape, size);
  let out = SYMS.get(key);
  if (out) return out;
  const T = topoOf(shape, size), cs = T.mesh.cells.map(c => c.c), mats = [];
  if (shape === "cube") {
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const p of perms) for (let sg = 0; sg < 8; sg++) mats.push(v => [0, 1, 2].map(i => v[p[i]] * (sg >> i & 1 ? -1 : 1)));
  } else {
    for (let r = 0; r < 6; r++) for (const fl of [1, -1]) { const a = r * Math.PI / 3, c = Math.cos(a), s = Math.sin(a); mats.push(v => [c * v[0] - s * v[1] * fl, s * v[0] + c * v[1] * fl, 0]); }
  }
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
