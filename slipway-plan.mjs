// Slipway: the book of levels, made from a plan (13 November 2026, Korbi: "both of these are 100 types ... an important thing to realize
// early is that cubes are not the only shape! the 3x3 cubes are quite difficult. so better to have some starting shapes that make the
// solution more intuitive ... the first 50 levels should be easier than the 3x3 cube"). A row of PLAN is a shape (its layers bottom to
// top, each layer's rows front to back, "#" timber and "." air), how it is to be cut, the tools it offers and how many numbers it shows.
// For each row this finds, from its seed on, a cut of the shape into pieces and the numbers that leave that cut the only answer
// (slipway-rules.js's `solutions`), and writes the levels to slipway-book.js.
//
// How a row is cut: `cut: "saw"` cuts it only by whole planes (all a saw can do, for the levels that offer nothing else); `cut: "bore"`
// takes `bars` straight rows out first; otherwise the pieces grow at random from `pieces` seeds (any shape). `sizes` caps a piece.
// The numbers: "rich" puts one on every piece and more where it helps (the early chapters: the reading is the lesson); "lean" keeps
// only as many as the one answer needs (later). Census and the largest size are always given.
//
// Usage: node slipway-plan.mjs check [chapter]     the levels a plan gives, drawn, with the solver's steps
//        node slipway-plan.mjs write                writes slipway-book.js
import fs from "fs";
import { solutions, censusOf, kindOf, neighbours, at, xyz } from "./slipway-rules.js";

const rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
/** Two cuts are the same when two cubes share a piece in one exactly when they do in the other. */
const same = (a, b) => a.every((v, i) => a.every((w, k) => (v === w) === (b[i] === b[k])));

export const CHAPTERS = [
  { n: 1, name: "Planks", rule: "A number on a cube is how many cubes its piece has." },
  { n: 2, name: "The chisel", rule: "Pieces can be any shape: the chisel splits one joint at a time." },
  { n: 3, name: "Posts", rule: "The bore frees a whole row of cubes at once." },
  { n: 4, name: "The census", rule: "The census counts the kinds of piece: a bar, a plank, a bend, a knot." },
  { n: 5, name: "Steps", rule: "Blocks that climb: a piece can turn a corner upwards." },
  { n: 6, name: "Glue", rule: "Glue mends a cut: saw through, then mend what should stay whole." },
  { n: 7, name: "Frames", rule: "Rings and arches: a ring needs two cuts to come apart." },
  { n: 8, name: "Hulls", rule: "Long timbers, a keel and its strakes." },
  { n: 10, name: "Hidden cubes", rule: "Some cubes are inside, out of sight: count them all the same." },
  { n: 12, name: "The yard", rule: "Big timbers and many pieces: everything at once." },
];

// shapes, as layers bottom to top
const slab = (w, d, h = 1) => Array.from({ length: h }, () => Array.from({ length: d }, () => "#".repeat(w)));
const flat = (...rows) => [rows];
/** A shape the same in every layer. */
const prism = (h, ...rows) => Array.from({ length: h }, () => rows);
const ALL = ["chisel", "saw", "bore"], GLUED = ["chisel", "saw", "bore", "glue"];

/** The plan, in playing order: { ch, name, shape, cut, pieces, sizes, tools, clues, rule, seed }. */
export const PLAN = [
  // 1 Planks: one cube thick, cut only by the saw (whole planes), every piece numbered. The shapes get wider, then bend, then stand up.
  { ch: 1, name: "Batten", shape: slab(4, 1), cut: "saw", planes: 1, tools: ["saw"], clues: "rich", seed: 1,
    rule: "The block is cubes glued together. The saw cuts right through it, just behind the face you tap." },
  { ch: 1, name: "Board", shape: slab(3, 2), cut: "saw", planes: 1, tools: ["saw"], clues: "rich", seed: 2 },
  { ch: 1, name: "Thirds", shape: slab(5, 2), cut: "saw", planes: 2, tools: ["saw"], clues: "rich", seed: 3 },
  { ch: 1, name: "Cross-cut", shape: slab(4, 3), cut: "saw", planes: 2, tools: ["saw"], clues: "rich", seed: 4 },
  { ch: 1, name: "Ell", shape: flat("###.", "###.", "####"), cut: "saw", planes: 2, tools: ["saw"], clues: "rich", seed: 5 },
  { ch: 1, name: "Tee", shape: flat(".##.", ".##.", "####"), cut: "saw", planes: 2, tools: ["saw"], clues: "rich", seed: 6 },
  { ch: 1, name: "Standing plank", shape: slab(4, 1, 3), cut: "saw", planes: 2, tools: ["saw"], clues: "rich", seed: 7 },
  { ch: 1, name: "Two boards", shape: slab(4, 2, 2), cut: "saw", planes: 2, tools: ["saw"], clues: "rich", seed: 8 },
  // 2 The chisel: flat shapes cut into pieces of any shape; the chisel alone first, then with the saw
  { ch: 2, name: "Split", shape: slab(3, 2), pieces: 2, tools: ["chisel"], clues: "rich", seed: 11,
    rule: "The chisel splits one joint: the first glued one it meets, going in from the face you tap." },
  { ch: 2, name: "Hook", shape: slab(3, 3), pieces: 2, tools: ["chisel", "saw"], clues: "rich", seed: 12 },
  { ch: 2, name: "Steps", shape: slab(4, 2), pieces: 3, tools: ["chisel", "saw"], clues: "rich", seed: 13 },
  { ch: 2, name: "Dovetail", shape: slab(4, 3), pieces: 3, tools: ["chisel", "saw"], clues: "rich", seed: 14 },
  { ch: 2, name: "Ess", shape: flat("###.", "####", ".###"), pieces: 3, tools: ["chisel", "saw"], clues: "rich", seed: 15 },
  { ch: 2, name: "Yoke", shape: flat("#..#", "####", "####"), pieces: 3, tools: ["chisel", "saw"], clues: "rich", seed: 16 },
  { ch: 2, name: "Patchwork", shape: slab(4, 4), pieces: 4, tools: ["chisel", "saw"], clues: "rich", seed: 17 },
  { ch: 2, name: "Inlay", shape: slab(5, 3), pieces: 4, tools: ["chisel", "saw"], clues: "lean", seed: 18 },
  // 3 Posts: rods, towers and walls; the bore takes a row out at once
  { ch: 3, name: "Dowel", shape: slab(2, 2, 3), cut: "bore", bars: 1, pieces: 1, tools: ["chisel", "saw", "bore"], clues: "rich", seed: 21,
    rule: "The bore frees the whole row of cubes through the one you tap." },
  { ch: 3, name: "Mast", shape: slab(2, 2, 4), cut: "bore", bars: 2, pieces: 1, tools: ["chisel", "saw", "bore"], clues: "rich", seed: 22 },
  { ch: 3, name: "Rails", shape: slab(4, 2, 1), cut: "bore", bars: 1, pieces: 2, tools: ["chisel", "saw", "bore"], clues: "rich", seed: 23 },
  { ch: 3, name: "Fence", shape: slab(4, 1, 3), cut: "bore", bars: 2, pieces: 1, tools: ["chisel", "saw", "bore"], clues: "rich", seed: 24 },
  { ch: 3, name: "Post and rail", shape: [["####", "#..."], ["#...", "#..."], ["#...", "#..."]], cut: "bore", bars: 1, pieces: 2, tools: ["chisel", "saw", "bore"], clues: "rich", seed: 25 },
  { ch: 3, name: "Bundle", shape: slab(3, 3, 2), cut: "bore", bars: 2, pieces: 2, tools: ["chisel", "saw", "bore"], clues: "rich", seed: 26 },
  { ch: 3, name: "Tower", shape: slab(2, 2, 5), cut: "bore", bars: 2, pieces: 2, tools: ["chisel", "saw", "bore"], clues: "lean", seed: 27 },
  { ch: 3, name: "Gatepost", shape: [["###", "#.#"], ["###", "#.#"], ["###", "..."]], cut: "bore", bars: 2, pieces: 2, tools: ["chisel", "saw", "bore"], clues: "lean", seed: 28 },
  // 4 The census: the kinds of piece decide where a cut goes; fewer numbers, so the census has to be read
  { ch: 4, name: "Kinds", shape: slab(4, 3), pieces: 3, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 31,
    rule: "The census counts the kinds of piece: a bar is a straight line, a plank a flat rectangle, a bend flat but no rectangle, a knot anything not flat." },
  { ch: 4, name: "Bar and bend", shape: flat("####", "###.", "###."), pieces: 3, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 32 },
  { ch: 4, name: "Knot", shape: slab(3, 2, 2), pieces: 3, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 33 },
  { ch: 4, name: "Planks only", shape: slab(4, 4), cut: "saw", planes: 3, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 34 },
  { ch: 4, name: "Landing", shape: [["####", "####"], ["##..", "##.."]], pieces: 3, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 35 },
  { ch: 4, name: "Offset", shape: flat("##..", "####", "####", "..##"), pieces: 4, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 36 },
  { ch: 4, name: "Two bends", shape: slab(5, 2), pieces: 3, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 37 },
  { ch: 4, name: "Stack", shape: slab(3, 3, 2), pieces: 4, tools: ["chisel", "saw", "bore"], clues: "lean", census: true, seed: 38 },
  // 5 Steps: stairs and podiums, pieces that climb
  { ch: 5, name: "Tread", shape: [["###", "###"], ["##.", "##."], ["#..", "#.."]], pieces: 3, tools: ALL, clues: "rich", seed: 41 },
  { ch: 5, name: "Riser", shape: [["####"], ["###."], ["##.."]], pieces: 3, tools: ALL, clues: "rich", seed: 42 },
  { ch: 5, name: "Podium", shape: [["###", "###", "###"], ["...", ".#.", "..."]], pieces: 3, tools: ALL, clues: "rich", seed: 43 },
  { ch: 5, name: "Winder", shape: [["###", "#..", "#.."], ["##.", "#..", "..."], ["#..", "...", "..."]], pieces: 3, tools: ALL, clues: "rich", seed: 44 },
  { ch: 5, name: "Terrace", shape: [["####", "####", "####"], ["####", "####", "...."], ["####", "....", "...."]], pieces: 4, tools: ALL, clues: "rich", seed: 45 },
  { ch: 5, name: "Ridge", shape: [["#####", "#####"], [".###.", ".###."], ["..#..", "..#.."]], pieces: 4, tools: ALL, clues: "lean", seed: 46 },
  { ch: 5, name: "Ziggurat", shape: [["####", "####", "####", "####"], ["....", ".##.", ".##.", "...."]], pieces: 4, tools: ALL, clues: "lean", seed: 47 },
  { ch: 5, name: "Two flights", shape: [["#####", "#####"], ["##.##", "##.##"], ["#...#", "#...#"]], pieces: 4, tools: ALL, clues: "lean", seed: 48 },
  // 6 Glue: sawn through, and mended where a piece crosses the cut
  { ch: 6, name: "Mend", shape: slab(4, 2), cut: "sawglue", planes: 2, glue: 1, tools: GLUED, clues: "rich", seed: 51,
    rule: "Glue mends one cut: the first it meets, going in from the face you tap." },
  { ch: 6, name: "Patch", shape: slab(4, 3), cut: "sawglue", planes: 3, glue: 1, tools: GLUED, clues: "rich", seed: 52 },
  { ch: 6, name: "Splice", shape: slab(5, 2), cut: "sawglue", planes: 3, glue: 2, tools: GLUED, clues: "rich", seed: 53 },
  { ch: 6, name: "Rebate", shape: slab(3, 3, 2), cut: "sawglue", planes: 2, glue: 1, tools: GLUED, clues: "rich", seed: 54 },
  { ch: 6, name: "Lap joint", shape: slab(4, 2, 2), cut: "sawglue", planes: 3, glue: 2, tools: GLUED, clues: "lean", seed: 55 },
  { ch: 6, name: "Housing", shape: flat("####", "####", "##..", "##.."), cut: "sawglue", planes: 3, glue: 2, tools: GLUED, clues: "lean", seed: 56 },
  { ch: 6, name: "Bridle", shape: slab(4, 4), cut: "sawglue", planes: 4, glue: 2, tools: GLUED, clues: "lean", seed: 57 },
  { ch: 6, name: "Halving", shape: slab(3, 3, 2), cut: "sawglue", planes: 3, glue: 2, tools: GLUED, clues: "lean", seed: 58 },
  // 7 Frames: rings, arches and hollow boxes
  { ch: 7, name: "Ring", shape: flat("###", "#.#", "###"), pieces: 2, tools: GLUED, clues: "rich", seed: 61 },
  { ch: 7, name: "Picture frame", shape: flat("####", "#..#", "#..#", "####"), pieces: 3, tools: GLUED, clues: "rich", seed: 62 },
  { ch: 7, name: "Arch", shape: [["#..#"], ["#..#"], ["####"]], pieces: 3, tools: GLUED, clues: "rich", seed: 63 },
  { ch: 7, name: "Gate", shape: [["#...#", "#...#"], ["#...#", "#...#"], ["#####", "#####"]], pieces: 4, tools: GLUED, clues: "rich", seed: 64 },
  { ch: 7, name: "Window", shape: flat("#####", "#...#", "#...#", "#####"), pieces: 3, tools: GLUED, clues: "lean", seed: 65 },
  { ch: 7, name: "Collar", shape: prism(2, "###", "#.#", "###"), pieces: 3, tools: GLUED, clues: "lean", seed: 66 },
  { ch: 7, name: "Cloister", shape: flat("#####", "#.#.#", "#####"), pieces: 4, tools: GLUED, clues: "lean", seed: 67 },
  { ch: 7, name: "Lantern", shape: [["###", "###", "###"], ["#.#", "...", "#.#"], ["###", "###", "###"]], pieces: 4, tools: GLUED, clues: "lean", seed: 68 },
  // 8 Hulls: long timbers, the keel along the bottom and strakes that widen above it
  { ch: 8, name: "Keel", shape: [[".....", "#####", "....."], ["#####", "#####", "#####"]], pieces: 3, tools: GLUED, clues: "rich", seed: 71 },
  { ch: 8, name: "Garboard", shape: [["......", "######", "......"], [".####.", "######", ".####."]], pieces: 3, tools: GLUED, clues: "rich", seed: 72 },
  { ch: 8, name: "Strakes", shape: [[".....", "#####", "....."], ["#####", "#####", "#####"], ["#####", ".....", "#####"]], pieces: 4, tools: GLUED, clues: "rich", seed: 73 },
  { ch: 8, name: "Stem and stern", shape: [["#....#", "######", "#....#"]], pieces: 3, tools: GLUED, clues: "lean", seed: 74 },
  { ch: 8, name: "Ribs", shape: [["#.#.#", "#####", "#.#.#"]], pieces: 4, tools: GLUED, clues: "lean", seed: 75 },
  { ch: 8, name: "Planking", shape: [[".###.", "#####", ".###."], ["#####", "#####", "#####"]], pieces: 4, tools: GLUED, clues: "lean", seed: 76 },
  { ch: 8, name: "Deadwood", shape: [["######", "......"], ["######", "######"]], pieces: 4, tools: GLUED, clues: "lean", seed: 77 },
  { ch: 8, name: "Launch", shape: [["..##..", "######", "..##.."], [".####.", "######", ".####."]], pieces: 5, tools: GLUED, clues: "lean", seed: 78 },
  // 9 Boxes (with the two-by-two cubes made before): whole blocks
  { ch: 9, name: "Chest", shape: slab(2, 2, 3), pieces: 3, tools: GLUED, clues: "lean", seed: 81 },
  { ch: 9, name: "Crate", shape: slab(3, 2, 2), pieces: 3, tools: GLUED, clues: "lean", seed: 82 },
  { ch: 9, name: "Bollard", shape: slab(2, 2, 4), pieces: 4, tools: GLUED, clues: "lean", seed: 83 },
  // 10 Hidden cubes: three thick, a cube out of sight
  { ch: 10, name: "Plinth", shape: [["###", "###", "###"], ["###", "###", "###"], [".#.", "###", ".#."]], pieces: 4, tools: GLUED, clues: "rich", seed: 91 },
  { ch: 10, name: "Cross", shape: prism(3, ".#.", "###", ".#."), pieces: 4, tools: GLUED, clues: "rich", seed: 92 },
  { ch: 10, name: "Cushion", shape: [[".#.", "###", ".#."], ["###", "###", "###"], [".#.", "###", ".#."]], pieces: 4, tools: GLUED, clues: "rich", seed: 93 },
  { ch: 10, name: "Heart", shape: [["###", "###", "###"], ["###", "###", "###"], ["...", ".#.", "..."]], pieces: 4, tools: GLUED, clues: "lean", seed: 94 },
  { ch: 10, name: "Capstan", shape: [["###", "###", "###"], [".#.", "###", ".#."], ["###", "###", "###"]], pieces: 4, tools: GLUED, clues: "lean", seed: 95 },
  { ch: 10, name: "Bitts", shape: [["####", "####", "####"], ["#.##", "####", "##.#"], ["####", "####", "####"]], pieces: 5, tools: GLUED, clues: "lean", seed: 96 },
  { ch: 10, name: "Windlass", shape: prism(3, "####", "####", "####"), pieces: 6, tools: GLUED, clues: "lean", seed: 97 },
  { ch: 10, name: "Bulkhead", shape: [["###", "###", "###"], ["###", "#.#", "###"], ["###", "###", "###"]], pieces: 5, tools: GLUED, clues: "lean", seed: 98 },
  { ch: 10, name: "Bilge", shape: [[".#.", "###", ".#."], ["###", "###", "###"], ["###", "###", "###"]], pieces: 5, tools: GLUED, clues: "lean", seed: 99 },
  { ch: 10, name: "Hatch", shape: [["###", "###", "###"], ["###", "###", "###"], ["#.#", "...", "#.#"]], pieces: 5, tools: GLUED, clues: "lean", seed: 100 },
  // 12 The yard: big timbers, many pieces
  { ch: 12, name: "Timber stack", shape: prism(3, "####", "####", "####"), pieces: 7, tools: GLUED, clues: "lean", seed: 121 },
  { ch: 12, name: "Sternpost", shape: [["#####", "#####", "#####"], ["#####", "#####", "#####"], ["#....", "#....", "#...."]], pieces: 7, tools: GLUED, clues: "lean", seed: 122 },
  { ch: 12, name: "Gun deck", shape: [["#####", "#####", "#####"], ["#.#.#", "#####", "#.#.#"], ["#####", "#####", "#####"]], pieces: 8, tools: GLUED, clues: "lean", seed: 123 },
  { ch: 12, name: "Capstan bar", shape: [["....", "####", "####", "...."], ["####", "####", "####", "####"], ["....", "####", "####", "...."]], pieces: 7, tools: GLUED, clues: "lean", seed: 124 },
  { ch: 12, name: "Launching", shape: [["..##..", ".####.", "######"], [".####.", "######", "######"], ["######", "######", "######"]], pieces: 9, tools: GLUED, clues: "lean", seed: 125 },
];

/** A shape as a level's box: { n, solid (cube indices) }. */
function boxOf(shape) {
  const h = shape.length, d = Math.max(...shape.map(l => l.length)), w = Math.max(...shape.flatMap(l => l.map(r => r.length))), n = Math.max(w, d, h);
  const solid = [];
  shape.forEach((layer, z) => layer.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") solid.push(at(n, x, y, z)); })));
  return { n, solid };
}
/** A level from a box and a cut (piece number per solid cube), with clues to be chosen. */
const levelOf = (row, n, solid, part, gauge) => {
  const sol = new Array(n ** 3).fill(-1);
  solid.forEach(k => { sol[k] = part.get(k); });
  const sizes = new Map(); for (const v of part.values()) sizes.set(v, (sizes.get(v) || 0) + 1);
  const ps = [...sizes.keys()].map(p => solid.filter(k => part.get(k) === p));
  return { n, sol, gauge, census: censusOf(n, ps), maxSize: Math.max(...sizes.values()), pieces: ps };
};

/** Cut a box: by whole planes, by bars then growth, or by growth alone. Returns Map cube -> piece, or null. */
function cutOf(row, n, solid, r) {
  const set = new Set(solid), part = new Map();
  if (row.cut === "saw" || row.cut === "sawglue") {
    // planes between layers on random axes; the pieces are what the planes leave joined
    const planes = new Set();
    for (let t = 0; planes.size < row.planes && t < 50; t++) {
      const axis = Math.floor(r() * 3), ext = Math.max(...solid.map(k => xyz(n, k)[axis]));
      if (ext < 1) continue;
      planes.add(`${axis}:${Math.floor(r() * ext)}`);
    }
    if (planes.size < row.planes) return null;
    const cutHere = (a, b) => { const A = xyz(n, a), B = xyz(n, b), ax = [0, 1, 2].find(i => A[i] !== B[i]); return planes.has(`${ax}:${Math.min(A[ax], B[ax])}`); };
    const nb = neighbours(n); let id = 0;
    for (const s of solid) {
      if (part.has(s)) continue;
      const q = [s]; part.set(s, id);
      for (let i = 0; i < q.length; i++) for (const o of nb[q[i]]) if (set.has(o) && !part.has(o) && !cutHere(q[i], o)) { part.set(o, id); q.push(o); }
      id++;
    }
    if (row.cut !== "sawglue") return part;
    // mend some of the cut joints: two pieces across a plane become one (a piece no saw alone could leave)
    for (let g = 0; g < row.glue; g++) {
      const across = [];
      for (const a of solid) for (const b of nb[a]) if (a < b && set.has(b) && part.get(a) !== part.get(b)) across.push([part.get(a), part.get(b)]);
      if (!across.length) return null;
      const [p, q] = pick(r, across);
      for (const [k, v] of part) if (v === q) part.set(k, p);
    }
    const ids = [...new Set(part.values())];                          // number the pieces 0.. again
    for (const [k, v] of part) part.set(k, ids.indexOf(v));
    return part;
  }
  let id = 0;
  if (row.cut === "bore") {
    // straight rows taken out first: whole lines of the shape along an axis
    for (let b = 0; b < row.bars; b++) {
      let line = null;
      for (let t = 0; t < 60 && !line; t++) {
        const s = pick(r, solid.filter(k => !part.has(k))), axis = Math.floor(r() * 3), c = xyz(n, s), cells = [];
        for (let i = 0; i < n; i++) { const p = c.slice(); p[axis] = i; const k = at(n, ...p); if (set.has(k)) cells.push(k); }
        // a whole run: every cube of the shape on that line, connected, free and at least 2
        const zs = cells.map(k => xyz(n, k)[axis]).sort((a, b) => a - b);
        if (cells.length >= 2 && cells.every(k => !part.has(k)) && zs.every((v, i) => !i || v === zs[i - 1] + 1)) line = cells;
      }
      if (!line) return null;
      for (const k of line) part.set(k, id);
      id++;
    }
  }
  // the rest grown from seeds, each cube going to a neighbouring piece at random (smaller pieces first)
  const free = solid.filter(k => !part.has(k)), nb = neighbours(n), want = row.pieces || 1;
  if (!free.length) return part;
  const seeds = [];
  for (let t = 0; seeds.length < want && t < 200; t++) { const s = pick(r, free); if (!seeds.includes(s)) seeds.push(s); }
  if (seeds.length < want) return null;
  seeds.forEach((s, i) => part.set(s, id + i));
  const size = new Map(seeds.map((s, i) => [id + i, 1]));
  for (let guard = 0; free.some(k => !part.has(k)) && guard < 2000; guard++) {
    const edge = free.filter(k => !part.has(k) && nb[k].some(o => part.has(o) && part.get(o) >= id));
    if (!edge.length) return null;
    const k = pick(r, edge), owners = [...new Set(nb[k].filter(o => part.has(o) && part.get(o) >= id).map(o => part.get(o)))];
    owners.sort((a, b) => size.get(a) - size.get(b));
    const p = r() < 0.7 ? owners[0] : pick(r, owners);
    part.set(k, p); size.set(p, size.get(p) + 1);
  }
  return free.every(k => part.has(k)) ? part : null;
}

/** Numbers that leave the cut the only answer: one per piece first (rich: every piece; lean: as few as hold), more where two answers differ. */
function cluesFor(row, base, r) {
  const { n, sol, pieces } = base, gauge = {};
  for (const p of pieces) { const k = pick(r, p); gauge[k] = p.length; }
  const lv = () => ({ ...base, gauge });
  for (let t = 0; t < 30; t++) {
    const s = solutions(lv(), 2, 4e5);
    if (s.aborted) return null;
    if (s.sols.length === 1) break;
    if (!s.sols.length) return null;
    // a cube the two answers disagree on, numbered with its true piece's size
    const other = s.sols.find(x => !same(x, sol));
    const differ = pieces.flat().filter(k => gauge[k] == null && pieces.find(p => p.includes(k)).length !== other.filter(v => v === other[k]).length);
    const k = differ.length ? pick(r, differ) : pick(r, pieces.flat().filter(c => gauge[c] == null));
    if (k == null) return null;
    gauge[k] = pieces.find(p => p.includes(k)).length;
  }
  if (solutions(lv(), 2, 4e5).sols.length !== 1) return null;
  if (row.clues === "lean") {
    // take numbers away while the answer stays the only one
    for (const k of Object.keys(gauge).sort(() => r() - 0.5)) {
      const v = gauge[k]; delete gauge[k];
      const s = solutions(lv(), 2, 4e5);
      if (s.aborted || s.sols.length !== 1 || (row.ch >= 5 && s.nodes > MAX_STEPS)) gauge[k] = v;     // (a number is kept where the proof would grow too long)
    }
  }
  return gauge;
}

const MAX_STEPS = 5000;
/** A row's level: the first seed from its own on that gives a cut with one answer. */
export function make(row) {
  const { n, solid } = boxOf(row.shape);
  for (let seed = row.seed; seed < row.seed + 400; seed++) {
    const r = rng(seed * 7919 + 13), part = cutOf(row, n, solid, r);
    if (!part) continue;
    const pieceCount = new Set(part.values()).size;
    if (pieceCount < 2) continue;
    const base = levelOf(row, n, solid, part, {});
    if (row.census && new Set(base.pieces.map(p => kindOf(n, p))).size < 2) continue;    // a census level wants more than one kind
    const gauge = cluesFor(row, base, r);
    if (!gauge) continue;
    const s = solutions({ ...base, gauge }, 2, 2e6);
    if (s.aborted || s.sols.length !== 1) continue;
    // the proof stays quick (the level test proves every level again, and a test must take under five seconds): past the first four
    // chapters, published before this rule, a level whose proof takes the solver more than MAX_STEPS is passed over for the next seed
    if (row.ch >= 5 && s.nodes > MAX_STEPS) continue;
    if (process.env.LOG) console.error(`${row.name}: seed ${seed}, ${s.nodes} steps`);
    return { id: `b${PLAN.indexOf(row) + 1}`, name: row.name, chapter: row.ch, n, maxSize: base.maxSize, gauge, census: base.census, tools: row.tools,
      ...(row.rule ? { rule: row.rule } : {}), sol: base.sol, seed, nodes: s.nodes };
  }
  throw new Error(`no level for ${row.name}`);
}

/** A level as text: its layers side by side, pieces as letters, numbers marked. */
function picture(L) {
  const { n } = L, out = [];
  for (let y = n - 1; y >= 0; y--) out.push(Array.from({ length: n }, (_, z) => Array.from({ length: n }, (_, x) => { const k = at(n, x, y, z), v = L.sol[k]; return v < 0 ? "." : L.gauge[k] != null ? String(L.gauge[k]).slice(-1) : String.fromCharCode(97 + v); }).join("")).join("  "));
  return out;
}

const [mode, arg] = process.argv[1]?.endsWith("slipway-plan.mjs") ? process.argv.slice(2) : [];
if (mode === "check") {
  for (const row of PLAN.filter(r => !arg || r.ch === Number(arg))) {
    const L = make(row);
    console.log(`${L.id} ${L.name} (ch ${L.chapter}) seed ${L.seed}, ${Object.keys(L.gauge).length} numbers, ${Object.values(L.census).reduce((a, b) => a + b, 0)} pieces ${JSON.stringify(L.census)}, ${L.nodes} steps`);
    for (const l of picture(L)) console.log("   " + l);
  }
}
if (mode === "write") {
  const levels = PLAN.map(make);
  fs.writeFileSync(new URL("./slipway-book.js", import.meta.url), `// Slipway: the book of levels made from slipway-plan.mjs's plan (node slipway-plan.mjs write), never by hand.\n` +
    `export const CHAPTERS = ${JSON.stringify(CHAPTERS)};\nexport const BOOK = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
  console.log(`${levels.length} levels written`);
}
