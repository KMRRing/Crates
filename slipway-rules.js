// Slipway, pure: a block of n×n×n cubes to be cut into pieces (9 Nov 2026, Korbi: the cut-list game was "horrendous"; this replaces it,
// a puzzle of reading clues). The pieces are free-form: any connected run of cubes, no plane cuts needed. A level gives numbers, never
// counts of a row: `gauge` (a cube's number is how many cubes its piece has), `census` (how many pieces of each kind: a single cube,
// a bar (a straight line), a plank (a flat rectangle), a block (a box), a bend (flat, not a rectangle), a knot (anything else)) and
// `maxSize` (no piece is bigger). Each level has exactly one answer (tests/slipway.mjs proves it with `solutions`).
// The player cuts the block with a chisel, a saw and a bore, and mends it with glue. Cubes are numbered x + n * (y + n * z): left to right, front to back, bottom to top.

import { BOOK, CHAPTERS as BOOK_CHAPTERS } from "./slipway-book.js";

export const at = (n, x, y, z) => x + n * (y + n * z);
export const xyz = (n, k) => [k % n, ((k / n) | 0) % n, (k / (n * n)) | 0];

/**
 * The levels, in the order they are played. `sol` is the answer as a piece number for each cube (layers bottom to top, each layer's
 * rows front to back, as written). A level is its own identity (bests are kept by id), so its clues and answer, once published, never
 * change. What it offers and says may: `tools` (all four when absent) and `rule`, the one line that brings in a new tool.
 * (11 Nov 2026, Korbi: the four tools are right but unclear, the chisel above all, and the first levels must ease you in. So the
 * tools come one at a time: the saw, then the chisel on its own, then the two together, the bore, and glue last; each level has
 * the tools met so far (the chisel's first, only the chisel), and the one it brings in is picked to start.)
 */
const rows = (...layers) => layers.flatMap(l => l.split(/\s+/).join("").split("")).map(c => c.charCodeAt(0) - 65);
const letters = text => [...text].map(c => c.charCodeAt(0) - 65);
export const TOOLS = ["chisel", "saw", "bore", "glue"];
const CUBES = [
  { id: "s7", name: "Top cut", n: 3, maxSize: 18, gauge: { 19: 9, 10: 18 }, census: { plank: 1, block: 1 }, tools: ["saw"],
    rule: "The block is cubes glued together. The saw cuts right through it, just behind the face you tap.",
    sol: rows("BBB BBB BBB", "BBB BBB BBB", "AAA AAA AAA") },
  { id: "s8", name: "Corner", n: 2, maxSize: 7, gauge: { 4: 7, 5: 1 }, census: { cube: 1, knot: 1 }, tools: ["chisel"],
    rule: "The chisel splits one joint: the first glued one it meets, going in from the face you tap.",
    sol: letters("AAAAABAA") },
  { id: "s2", name: "Slice", n: 2, maxSize: 4, gauge: { 0: 4, 2: 4, 4: 3, 7: 1 }, census: { plank: 1, bend: 1, cube: 1 }, tools: ["chisel", "saw"], sol: letters("AAAABBBC") },
  { id: "s3", name: "First bore", n: 2, maxSize: 6, gauge: { 0: 2, 1: 6, 2: 6, 5: 6 }, census: { bar: 1, knot: 1 }, tools: ["chisel", "saw", "bore"],
    rule: "The bore frees the whole row of cubes through the one you tap.", sol: letters("ABBBABBB") },
  { id: "s4", name: "Core", n: 3, maxSize: 24, gauge: { 0: 24, 1: 24, 3: 24, 4: 3, 14: 24, 26: 24 }, census: { bar: 1, knot: 1 }, tools: ["chisel", "saw", "bore"], sol: letters("BBBBABBBBBBBBABBBBBBBBABBBB") },
  { id: "s6", name: "Rail", n: 3, maxSize: 15, gauge: { 0: 15, 1: 15, 3: 15, 7: 15, 12: 3, 13: 3, 16: 15, 17: 15, 18: 9, 22: 9, 25: 9, 26: 9 }, census: { plank: 1, bar: 1, knot: 1 }, tools: ["chisel", "saw", "bore"], sol: letters("CCCCCCCCCCCCBBBCCCAAAAAAAAA") },
  { id: "s5", name: "Post", n: 3, maxSize: 16, gauge: { 0: 9, 1: 9, 3: 9, 4: 9, 8: 9, 9: 2, 10: 16, 18: 2, 19: 16, 25: 16, 26: 16 }, census: { plank: 1, bar: 1, knot: 1 },
    rule: "Glue mends one cut: the first it meets, going in from the face you tap.", sol: letters("AAAAAAAAABCCCCCCCCBCCCCCCCC") },
  // (11 Nov 2026, Korbi: Offcuts straight after Post was far too steep, census and numbers at once. Now a ramp leads to it: more
  // pieces and fewer numbers a step at a time, two by two first, the census mattering more as it goes; Offcuts comes last.)
  { id: "s9", name: "Quarters", n: 2, maxSize: 3, gauge: { 0: 3, 3: 2, 4: 3, 6: 2, 7: 1 }, census: { cube: 1, bar: 2, bend: 1 },
    sol: letters("ABCBAACD") },
  { id: "s10", name: "Knee", n: 2, maxSize: 4, gauge: { 0: 4, 4: 2, 5: 4, 7: 2 }, census: { bar: 2, knot: 1 },
    sol: letters("AAABCACB") },
  { id: "s11", name: "Deck", n: 3, maxSize: 9, gauge: { 0: 9, 1: 9, 5: 9, 9: 6, 11: 4, 14: 4, 17: 4, 18: 8, 19: 8, 22: 8, 23: 8, 25: 8, 26: 8 }, census: { plank: 2, bend: 2 },
    sol: rows("AAA AAA AAA", "BBC BBC BBC", "DDC DDD DDD") },
  { id: "s12", name: "Keel", n: 3, maxSize: 9, gauge: { 1: 6, 4: 6, 5: 8, 8: 4, 9: 9, 10: 6, 18: 9, 20: 8, 23: 8, 24: 9, 25: 6, 26: 8 }, census: { plank: 1, bend: 2, knot: 1 },
    sol: rows("ABC ABC ADD", "ABC ADC ADC", "ABC ABC ABC") },
  { id: "s13", name: "Strakes", n: 3, maxSize: 7, gauge: { 0: 5, 1: 5, 2: 7, 5: 5, 9: 4, 10: 4, 14: 5, 17: 7, 18: 4, 19: 4, 21: 5, 24: 6, 25: 7 }, census: { plank: 1, bend: 3, knot: 1 },
    sol: rows("AAB AAA CCC", "DDB EEE CCB", "DDB EEB CBB") },
  { id: "s14", name: "Frames", n: 3, maxSize: 6, gauge: { 0: 5, 1: 3, 2: 5, 5: 5, 11: 4, 14: 6, 16: 4, 20: 4, 22: 4, 23: 4, 25: 5 }, census: { bar: 1, bend: 4, knot: 1 },
    sol: rows("ABA AAA CCC", "DBE DDD DCD", "FBE FEE FFF") },
  { id: "s15", name: "Scarf", n: 3, maxSize: 5, gauge: { 2: 3, 5: 4, 6: 4, 9: 5, 11: 2, 14: 5, 15: 4, 17: 4, 19: 4, 20: 5, 22: 5, 25: 4, 26: 4 }, census: { bar: 2, bend: 3, knot: 2 },
    sol: rows("AAA BBC DBC", "BEE BFF DDC", "GGF GFF GDC") },
  { id: "s16", name: "Trenails", n: 3, maxSize: 5, gauge: { 1: 4, 4: 3, 5: 4, 7: 3, 9: 3, 14: 4, 15: 4, 16: 4, 18: 3, 21: 3, 22: 5, 23: 2, 26: 3 }, census: { bar: 4, bend: 3, knot: 1 },
    sol: rows("ABB CDB DDB", "AEE CEF FFF", "AEG CEG HHH") },
  { id: "s17", name: "Mortise", n: 3, maxSize: 5, gauge: { 5: 4, 10: 4, 11: 5, 14: 4, 17: 2, 18: 4, 21: 5, 22: 3, 24: 5, 25: 4, 26: 4 }, census: { bar: 2, bend: 3, knot: 2 },
    sol: rows("AAA ABC CCC", "DEA DBF DGG", "EEE DBF DFF") },
  { id: "s18", name: "Tenon", n: 3, maxSize: 5, gauge: { 1: 4, 7: 2, 8: 4, 9: 5, 18: 5, 19: 4, 21: 5, 22: 4, 24: 4, 25: 5, 26: 3 }, census: { bar: 2, bend: 2, knot: 3 },
    sol: rows("ABB CDB CDB", "AAE FFE CEE", "AFG AFG CEG") },
  { id: "s1", name: "Offcuts", n: 3, maxSize: 6, gauge: { 0: 6, 1: 6, 2: 3, 5: 5, 6: 5, 8: 5, 13: 4, 15: 6, 17: 1, 19: 4, 21: 2 },
    census: { cube: 1, bar: 1, bend: 3, knot: 3 },
    sol: rows("AAB AAC CCC", "DDB AEB ACF", "DEE GEH GHH") },
];
// 13 Nov 2026, Korbi: 100 levels, "the first 50 levels should be easier than the 3x3 cube". The book (slipway-plan.mjs) comes first,
// shaped blocks chapter by chapter; the cubes made before it follow as the later chapters: the two-by-two ones as Boxes, the three-by-
// three as The cube. The tools those first met are met earlier now, so only glue keeps its line there (Post brings it in).
export const CHAPTERS = [...BOOK_CHAPTERS, { n: 9, name: "Boxes", rule: "Whole blocks, two cubes each way." }, { n: 11, name: "The cube", rule: "Three cubes each way: a cube you can't see is still a cube." }];
// (they offer the three tools met by then, as the book's later levels do; glue comes in at Post, and from there all four)
const OLD = [...CUBES.filter(l => l.n === 2), ...CUBES.filter(l => l.n === 3)], GLUE = OLD.findIndex(l => l.id === "s5");
const later = (l, i) => ({ ...l, chapter: l.n === 2 ? 9 : 11, tools: i < GLUE ? ["chisel", "saw", "bore"] : undefined, ...(l.rule && !/Glue/.test(l.rule) ? { rule: undefined } : {}) });
export const LEVELS = [...BOOK, ...OLD.map(later)];
/** The chapter a level is in. */
export const chapterOf = level => CHAPTERS.find(c => c.n === level.chapter) || null;
/** The tools a level offers, in the bar's order. */
export const toolsOf = level => TOOLS.filter(t => !level.tools || level.tools.includes(t));
/** The tool a level brings in (picked when it starts): one no earlier level had, or null. */
export function newTool(level) {
  const before = new Set(LEVELS.slice(0, Math.max(0, LEVELS.indexOf(level))).flatMap(toolsOf));
  return toolsOf(level).find(t => !before.has(t)) ?? null;
}
/** The two cubes of a joint "a-b". */
export const jointCubes = key => key.split("-").map(Number);

/** What kind of piece a set of cubes is. */
export function kindOf(n, cells) {
  const P = cells.map(k => xyz(n, k)), ext = [0, 1, 2].map(j => Math.max(...P.map(p => p[j])) - Math.min(...P.map(p => p[j])) + 1);
  if (cells.length === 1) return "cube";
  const thick = ext.filter(e => e > 1).length;
  if (thick === 1) return "bar";
  if (ext[0] * ext[1] * ext[2] === cells.length) return thick === 2 ? "plank" : "block";
  return thick === 2 ? "bend" : "knot";
}
export const KIND_NAMES = { cube: ["single", "singles"], bar: ["bar", "bars"], plank: ["plank", "planks"], block: ["block", "blocks"], bend: ["bend", "bends"], knot: ["knot", "knots"] };
export const KIND_NOTES = {
  cube: "A single is one cube alone.", bar: "A bar is cubes in one straight line.", plank: "A plank is a flat rectangle, one cube thick.",
  block: "A block is a full box, at least two cubes each way.", bend: "A bend lies flat in one layer but is no rectangle.", knot: "A knot is anything that is not flat.",
};
/** The census of a painting as { kind: count }. */
export function censusOf(n, pieces) { const c = {}; for (const p of pieces) { const k = kindOf(n, p); c[k] = (c[k] || 0) + 1; } return c; }

// 13 Nov 2026, Korbi: "cubes are not the only shape! the 3x3 cubes are quite difficult. so better to have some starting shapes that
// make the solution more intuitive". A level's block is any shape of cubes inside its n×n×n box: a cube whose answer is below zero (a
// "." in `rows`) is air, not timber. Everything below takes either n (the whole box, the cube of old) or the level itself, whose air it
// leaves out: no piece, joint or cut ever touches an air cube.
const SOLID = new WeakMap();
/** A level's timber: 1 for each cube of its box that is there. */
export function solidOf(level) {
  if (!SOLID.has(level)) SOLID.set(level, Uint8Array.from(level.sol, v => (v >= 0 ? 1 : 0)));
  return SOLID.get(level);
}
/** { n, solid (null for the whole box) } from n or a level. */
export const geo = g => (typeof g === "number" ? { n: g, solid: null } : { n: g.n, solid: g.sol.some(v => v < 0) ? solidOf(g) : null });
/** The cubes that are there, in order. */
export function cubesOf(g) { const { n, solid } = geo(g); return Array.from({ length: n ** 3 }, (_, k) => k).filter(k => !solid || solid[k]); }
/** The size of the shape's own box, [x, y, z] (the box n×n×n for a whole block). */
export function extent(g) {
  const { n } = geo(g), P = cubesOf(g).map(k => xyz(n, k));
  return [0, 1, 2].map(i => Math.max(...P.map(p => p[i])) - Math.min(...P.map(p => p[i])) + 1);
}
/** The neighbours of each cube in a block (air has none, and is no one's neighbour). */
const NB = new Map(), NBS = new WeakMap();
export function neighbours(g) {
  const { n, solid } = geo(g);
  if (solid) {
    if (!NBS.has(solid)) NBS.set(solid, neighbours(n).map((o, k) => (solid[k] ? o.filter(j => solid[j]) : [])));
    return NBS.get(solid);
  }
  if (!NB.has(n)) NB.set(n, Array.from({ length: n ** 3 }, (_, k) => { const [x, y, z] = xyz(n, k), o = []; for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + a, Y = y + b, Z = z + c; if (X >= 0 && Y >= 0 && Z >= 0 && X < n && Y < n && Z < n) o.push(at(n, X, Y, Z)); } return o; }));
  return NB.get(n);
}
// ---------- cutting ----------
// A cut is a joint between two touching cubes that has been broken; `cuts` is the set of broken joints, each "a-b" with a < b. The
// pieces are the runs of cubes still joined. (Cubes are glued at the start: the whole block is one piece.)
export const joint = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
/** The pieces left by a set of cuts: each a sorted list of cubes. */
export function pieces(g, cuts) {
  const { n, solid } = geo(g), nb = neighbours(g), seen = new Uint8Array(n ** 3), out = [];
  for (let k = 0; k < n ** 3; k++) {
    if (seen[k] || (solid && !solid[k])) continue;
    const cells = [k]; seen[k] = 1;
    for (let i = 0; i < cells.length; i++) for (const j of nb[cells[i]]) if (!seen[j] && !cuts.has(joint(cells[i], j))) { seen[j] = 1; cells.push(j); }
    out.push(cells.sort((x, y) => x - y));
  }
  return out;
}
/**
 * What is wrong with the cuts so far: `wrong` numbered cubes whose piece has another size, `census` kinds whose count is off, `big`
 * pieces over the largest size; `done` when nothing is.
 */
export function judge(level, cuts) {
  const { n } = level, ps = pieces(level, cuts), pieceOf = new Map();
  ps.forEach(p => p.forEach(c => pieceOf.set(c, p)));
  const wrong = Object.keys(level.gauge).map(Number).filter(k => pieceOf.get(k).length !== level.gauge[k]);
  const have = censusOf(n, ps), census = Object.keys(KIND_NAMES).filter(k => (have[k] || 0) !== (level.census[k] || 0));
  const big = ps.filter(p => p.length > level.maxSize);
  return { wrong, census, big, have, pieces: ps, done: !wrong.length && !census.length && !big.length };
}
/**
 * What a tool does when used on cube k from the outside of a face (axis, dir: +1 for the face looking up the axis): { add, remove }
 * (joints to break, joints to glue back), or null when it would change nothing. A chisel breaks the first joint still whole going
 * into the block from that cube; a saw the first plane that still has a whole joint; a bore breaks the sides of the whole line of
 * cubes through k; glue mends the first broken joint going in.
 */
export function useTool(g, tool, axis, dir, k, cuts) {
  const { n, solid } = geo(g), step = [0, 0, 0]; step[axis] = -dir;
  const there = p => p.every(v => v >= 0 && v < n) && (!solid || solid[at(n, ...p)]), inside = there, c = xyz(n, k), nb = neighbours(g);
  const along = [];                                // the cubes from k going in, as far as the timber goes
  for (let p = c.slice(); there(p); p = p.map((v, i) => v + step[i])) along.push(at(n, ...p));
  if (tool === "chisel" || tool === "glue") {
    for (let i = 0; i + 1 < along.length; i++) {
      const key = joint(along[i], along[i + 1]), broken = cuts.has(key);
      if (tool === "chisel" && !broken) return { add: [key], remove: [] };
      if (tool === "glue" && broken) return { add: [], remove: [key] };
    }
    return null;
  }
  if (tool === "saw") {
    for (let i = 0; i + 1 < along.length; i++) {
      const layerOf = cell => { const q = xyz(n, cell); return q[axis]; };
      const here = layerOf(along[i]), keys = [];
      for (let cell = 0; cell < n ** 3; cell++) if ((!solid || solid[cell]) && layerOf(cell) === here) { const q = xyz(n, cell); q[axis] -= dir; if (inside(q)) { const key = joint(cell, at(n, ...q)); if (!cuts.has(key)) keys.push(key); } }
      if (keys.length) return { add: keys, remove: [] };
    }
    return null;
  }
  // bore: the line through k along the axis, cut loose from everything beside it
  const add = [];
  for (let i = 0; i < n; i++) {
    const p = c.slice(); p[axis] = i; const cell = at(n, ...p);
    if (solid && !solid[cell]) continue;
    for (const o of nb[cell]) { const q = xyz(n, o); if (q[axis] === i && !cuts.has(joint(cell, o))) add.push(joint(cell, o)); }
  }
  return add.length ? { add: [...new Set(add)], remove: [] } : null;
}

// ---------- the proof that a level has one answer ----------
/**
 * Every way to cut the level's block (up to `limit`, giving up after `cap` steps): pieces are found one at a time, each from the
 * first cube not yet in one, over every connected run of free cubes that has it, a cube's number fixing the run's size.
 * `aborted` when the cap was hit, so a count of one is only proof when it is not. `fixed`: pieces (lists of cubes) that are already cut.
 * `census` null leaves the census out, to see whether the numbers alone decide.
 */
export function solutions(level, limit = 2, cap = 3e6, fixed = [], census = level.census) {
  const { n, gauge, maxSize } = level, N = n ** 3, nb = neighbours(level), asg = new Int8Array(N).fill(-1), pieces = [], sols = [];
  level.sol.forEach((v, k) => { if (v < 0) asg[k] = -2; });                   // air: never a free cube
  let nodes = 0, aborted = false;
  function done() {
    const c = censusOf(n, pieces);
    if (census) for (const k of Object.keys(KIND_NAMES)) if ((c[k] || 0) !== (census[k] || 0)) return;
    sols.push(Array.from(asg, v => (v === -2 ? -1 : v)));
  }
  // every pocket of cubes left must hold the biggest number in it, or a piece there could never be finished
  function roomy() {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (asg[s] !== -1 || seen[s]) continue;
      const comp = [s]; seen[s] = 1; let top = 0;
      for (let i = 0; i < comp.length; i++) { top = Math.max(top, gauge[comp[i]] || 0); for (const y of nb[comp[i]]) if (asg[y] === -1 && !seen[y]) { seen[y] = 1; comp.push(y); } }
      if (comp.length < top) return false;
    }
    return true;
  }
  function place(cells) {
    const id = pieces.length; pieces.push(cells); for (const c of cells) asg[c] = id;
    if (cells.every(c => gauge[c] == null || gauge[c] === cells.length) && roomy()) go();
    for (const c of cells) asg[c] = -1; pieces.pop();
  }
  function go() {
    if (aborted || sols.length >= limit) return;
    if (++nodes > cap) { aborted = true; return; }
    // the cube with the smallest number goes first, so the small pieces are placed while the big ones are still a tight fit
    let s = -1;
    for (let c = 0; c < N; c++) if (asg[c] === -1 && (s < 0 || (gauge[c] != null && (gauge[s] == null || gauge[c] < gauge[s])))) s = c;
    if (s < 0) return done();
    const want = gauge[s], cells = [s], seen = new Set([s]);
    const grow = frontier => {
      if (aborted || sols.length >= limit) return;
      if (want == null || cells.length === want) place(cells.slice());
      if (cells.length >= (want ?? maxSize)) return;
      const f = frontier.slice();
      while (f.length) {
        const x = f.pop(); cells.push(x);
        const add = []; for (const y of nb[x]) if (asg[y] === -1 && !seen.has(y) && (want == null || gauge[y] == null || gauge[y] === want)) { seen.add(y); add.push(y); }
        grow(f.concat(add));
        for (const y of add) seen.delete(y);
        cells.pop();
      }
    };
    // a big piece is found by what it leaves out: a few cubes of the free ones (nearly all of them are in)
    const freeCubes = []; for (let c = 0; c < N; c++) if (asg[c] === -1) freeCubes.push(c);
    const leave = want == null ? -1 : freeCubes.length - want;
    if (want != null && leave >= 0 && leave < want && leave <= 4) {
      const others = freeCubes.filter(c => c !== s), out = [];
      const pick = (from, left) => {
        if (aborted || sols.length >= limit) return;
        if (out.length === leave) {
          const gone = new Set(out), cells2 = freeCubes.filter(c => !gone.has(c));
          if (cells2.some(c => gauge[c] != null && gauge[c] !== want)) return;
          const reach = new Set([s]), q = [s];
          for (let i = 0; i < q.length; i++) for (const y of nb[q[i]]) if (!gone.has(y) && asg[y] === -1 && !reach.has(y)) { reach.add(y); q.push(y); }
          if (reach.size === cells2.length) place(cells2);
          return;
        }
        for (let i = from; i < others.length; i++) { out.push(others[i]); pick(i + 1, left - 1); out.pop(); }
      };
      pick(0, leave);
      return;
    }
    const first = []; for (const y of nb[s]) if (asg[y] === -1 && (want == null || gauge[y] == null || gauge[y] === want)) { seen.add(y); first.push(y); }
    grow(first);
  }
  for (const cells of fixed) { pieces.push(cells); for (const c of cells) asg[c] = pieces.length - 1; }   // pieces already cut: only the rest is searched
  go();
  return { sols, nodes, aborted };
}

// ---------- the hint: the next piece that can be worked out, and why ----------
export const where = (n, k) => { const [x, y, z] = xyz(n, k); return `layer ${z + 1}, left ${x + 1}, front ${y + 1}`; };
/** Every connected run of `size` free cubes that holds cube s and takes no cube carrying another number. */
export function shapes(level, free, s, size, cap = 5000) {
  const { gauge } = level, nb = neighbours(level), out = [], cells = [s], seen = new Set([s]);
  const ok = c => free.has(c) && (gauge[c] == null || gauge[c] === size);
  const grow = frontier => {
    if (out.length >= cap) return;
    if (cells.length === size) { out.push(cells.slice().sort((a, b) => a - b)); return; }
    const f = frontier.slice();
    while (f.length) {
      const x = f.pop(); cells.push(x);
      const add = []; for (const y of nb[x]) if (ok(y) && !seen.has(y)) { seen.add(y); add.push(y); }
      grow(f.concat(add));
      for (const y of add) seen.delete(y);
      cells.pop();
    }
  };
  const first = []; for (const y of nb[s]) if (ok(y)) { seen.add(y); first.push(y); }
  grow(first);
  return out;
}
/** The connected pockets of free cubes. */
const pockets = (g, free) => {
  const nb = neighbours(g), seen = new Set(), out = [];
  for (const s of free) { if (seen.has(s)) continue; const comp = [s]; seen.add(s); for (let i = 0; i < comp.length; i++) for (const y of nb[comp[i]]) if (free.has(y) && !seen.has(y)) { seen.add(y); comp.push(y); } out.push(comp); }
  return out;
};
/** Why a shape cannot be: a pocket it would leave is too small for a number in it; null when it is only that nothing can be finished. */
function whyNot(level, free, shape) {
  const rest = new Set([...free].filter(c => !shape.includes(c)));
  for (const pocket of pockets(level, rest)) {
    const big = pocket.filter(c => level.gauge[c] != null).sort((a, b) => level.gauge[b] - level.gauge[a])[0];
    if (big != null && level.gauge[big] > pocket.length) return `one of the others would cut off the cube at ${where(level.n, big)} (it says ${level.gauge[big]}) in a pocket of only ${pocket.length}`;
  }
  return null;
}
/**
 * The next step, from the cuts so far: { cells (the cubes to look at), text (what and why), op: { add, remove } to do it for you }.
 * A cut that has split a piece of the only answer comes first (glue it), then the numbered piece with the fewest runs that fit
 * (cut round it), then, with no number left, the smallest leftover piece.
 */
const ANSWERS = new WeakMap();
export function hint(level, cuts) {
  const { n } = level, full = (ANSWERS.get(level) || ANSWERS.set(level, solutions(level, 1).sols[0]).get(level)), byPiece = new Map();
  full.forEach((p, c) => { if (p >= 0) (byPiece.get(p) || byPiece.set(p, []).get(p)).push(c); });
  const answer = [...byPiece.values()], key = a => a.join(","), ps = pieces(level, cuts), pieceId = new Map();
  ps.forEach((p, i) => p.forEach(c => pieceId.set(c, i)));
  for (const a of answer) {
    if (new Set(a.map(c => pieceId.get(c))).size === 1) continue;
    const num = a.find(c => level.gauge[c] != null), remove = [];
    for (const c of a) for (const o of neighbours(level)[c]) if (c < o && a.includes(o) && cuts.has(joint(c, o))) remove.push(joint(c, o));
    return { cells: a, op: { add: [], remove }, text: `A cut has split ${num != null ? `the piece holding the cube at ${where(n, num)} (it says ${level.gauge[num]})` : `a piece of ${a.length}`}: the answer needs these ${a.length} cubes together. Glue ${remove.length === 1 ? "that joint" : "those joints"} back.` };
  }
  const answerKeys = new Set(answer.map(key)), lockedSet = new Set(ps.filter(p => answerKeys.has(key(p))).flat());
  const free = new Set(cubesOf(level).filter(c => !lockedSet.has(c)));
  const open = answer.filter(a => !ps.some(p => key(p) === key(a)));
  if (!open.length) return null;
  const roundIt = a => { const add = []; for (const c of a) for (const o of neighbours(level)[c]) if (!a.includes(o) && !cuts.has(joint(c, o))) add.push(joint(c, o)); return { add: [...new Set(add)], remove: [] }; };
  // the shapes are counted for the small pieces only (a big one has far too many to list); with none small, for the smallest
  const known = open.map(a => ({ a, s: a.find(c => level.gauge[c] != null) })).filter(o => o.s != null).map(o => ({ ...o, size: level.gauge[o.s] })).sort((x, y) => x.size - y.size);
  const numbered = known.filter((o, i) => o.size <= 10 || i === 0).map(o => ({ ...o, all: shapes(level, free, o.s, o.size) })).sort((x, y) => x.all.length - y.all.length || x.size - y.size);
  if (numbered.length) {
    const { a, s, size, all } = numbered[0], other = all.filter(sh => key(sh) !== key(a));
    let text;
    if (size === 1) text = `The cube at ${where(n, s)} says 1: it stands alone. Cut round it.`;
    else if (!other.length) text = `The cube at ${where(n, s)} says ${size}. Among the free cubes only one run of ${size} holds it without taking a cube that has another number. Cut round it.`;
    else {
      const why = other.map(sh => whyNot(level, free, sh)).find(Boolean);
      text = `The cube at ${where(n, s)} says ${size}. ${all.length} runs of ${size} would hold it, but only this one lets the rest of the block be cut${why ? `: ${why}` : ""}. Cut round it.`;
    }
    return { cells: a, op: roundIt(a), text };
  }
  const a = open.slice().sort((x, y) => x.length - y.length)[0], kind = KIND_NAMES[kindOf(n, a)][0];
  return { cells: a, op: roundIt(a), text: `No number points at these ${a.length} free cubes. With every numbered piece placed, the census still wants this ${kind}, and the free cubes here can only be cut that one way. Cut round it.` };
}
