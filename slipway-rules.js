// Slipway, pure: a block of n×n×n cubes to be cut into pieces (9 Nov 2026, Korbi: the cut-list game was "horrendous"; this replaces it,
// a puzzle of reading clues). The pieces are free-form: any connected run of cubes, no plane cuts needed. A level gives numbers, never
// counts of a row: `gauge` (a cube's number is how many cubes its piece has), `census` (how many pieces of each kind: a single cube,
// a bar (a straight line), a plank (a flat rectangle), a block (a box), a bend (flat, not a rectangle), a knot (anything else)) and
// `maxSize` (no piece is bigger). Each level has exactly one answer (tests/slipway.mjs proves it with `solutions`).
// The player paints pieces: a colour is a piece. Cubes are numbered x + n * (y + n * z): left to right, front to back, bottom to top.

export const at = (n, x, y, z) => x + n * (y + n * z);
export const xyz = (n, k) => [k % n, ((k / n) | 0) % n, (k / (n * n)) | 0];

/**
 * The levels. `sol` is the answer as a piece number for each cube (layers bottom to top, each layer's rows front to back, as written).
 * A level is its own identity (bests are kept by id), so a level once published is never changed.
 */
const rows = (...layers) => layers.flatMap(l => l.split(/\s+/).join("").split("")).map(c => c.charCodeAt(0) - 65);
export const LEVELS = [
  { id: "s1", name: "Offcuts", n: 3, maxSize: 6, gauge: { 0: 6, 1: 6, 2: 3, 5: 5, 6: 5, 8: 5, 13: 4, 15: 6, 17: 1, 19: 4, 21: 2 },
    census: { cube: 1, bar: 1, bend: 3, knot: 3 },
    sol: rows("AAB AAC CCC", "DDB AEB ACF", "DEE GEH GHH") },
];

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

/** The neighbours of each cube in an n-block. */
const NB = new Map();
export function neighbours(n) {
  if (!NB.has(n)) NB.set(n, Array.from({ length: n ** 3 }, (_, k) => { const [x, y, z] = xyz(n, k), o = []; for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + a, Y = y + b, Z = z + c; if (X >= 0 && Y >= 0 && Z >= 0 && X < n && Y < n && Z < n) o.push(at(n, X, Y, Z)); } return o; }));
  return NB.get(n);
}
/** Splits painted cubes into connected runs of one colour: { colour, cells } each, from a paint (a number per cube, 0 for none). */
export function runs(n, paint) {
  const nb = neighbours(n), seen = new Uint8Array(paint.length), out = [];
  for (let k = 0; k < paint.length; k++) {
    if (!paint[k] || seen[k]) continue;
    const cells = [k], colour = paint[k]; seen[k] = 1;
    for (let i = 0; i < cells.length; i++) for (const j of nb[cells[i]]) if (!seen[j] && paint[j] === colour) { seen[j] = 1; cells.push(j); }
    out.push({ colour, cells });
  }
  return out;
}
/**
 * What is wrong with a painting: `open` cubes not painted, `split` colours that are two pieces apart, `wrong` numbered cubes whose
 * piece has another size, `census` kinds whose count is off, `big` colours over the largest size; `done` when nothing is.
 */
export function judge(level, paint) {
  const { n } = level, rs = runs(n, paint), pieceOf = new Map();
  rs.forEach(r => r.cells.forEach(c => pieceOf.set(c, r)));
  const open = [...paint].filter(v => !v).length, colours = new Map();
  for (const r of rs) colours.set(r.colour, (colours.get(r.colour) || 0) + 1);
  const split = [...colours].filter(([, c]) => c > 1).map(([v]) => v);
  const wrong = Object.keys(level.gauge).map(Number).filter(k => pieceOf.has(k) && pieceOf.get(k).cells.length !== level.gauge[k]);
  const have = censusOf(n, rs.map(r => r.cells)), census = Object.keys(KIND_NAMES).filter(k => (have[k] || 0) !== (level.census[k] || 0));
  const big = rs.filter(r => r.cells.length > level.maxSize).map(r => r.colour);
  return { open, split, wrong, census, big, have, pieces: rs, done: !open && !split.length && !wrong.length && !census.length && !big.length };
}
/** The cubes a tool takes when it is used on cube k along an axis: a chisel one cube, a saw its whole layer, a bore its whole line. */
export function reach(n, tool, axis, k) {
  if (tool === "chisel") return [k];
  const c = xyz(n, k), out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < (tool === "saw" ? n : 1); j++) {
    const p = c.slice();
    if (tool === "bore") p[axis] = i; else { p[(axis + 1) % 3] = i; p[(axis + 2) % 3] = j; }
    out.push(at(n, ...p));
  }
  return out;
}

// ---------- the proof that a level has one answer ----------
/**
 * Every way to cut the level's block (up to `limit`, giving up after `cap` steps): pieces are found one at a time, each from the
 * first cube not yet in one, over every connected run of free cubes that has it, a cube's number fixing the run's size.
 * `aborted` when the cap was hit, so a count of one is only proof when it is not.
 */
export function solutions(level, limit = 2, cap = 3e6) {
  const { n, gauge, census, maxSize } = level, N = n ** 3, nb = neighbours(n), asg = new Int8Array(N).fill(-1), pieces = [], sols = [];
  let nodes = 0, aborted = false;
  function done() {
    const c = censusOf(n, pieces);
    for (const k of Object.keys(KIND_NAMES)) if ((c[k] || 0) !== (census[k] || 0)) return;
    sols.push(Array.from(asg));
  }
  function place(cells) {
    const id = pieces.length; pieces.push(cells); for (const c of cells) asg[c] = id;
    if (cells.every(c => gauge[c] == null || gauge[c] === cells.length)) go();
    for (const c of cells) asg[c] = -1; pieces.pop();
  }
  function go() {
    if (aborted || sols.length >= limit) return;
    if (++nodes > cap) { aborted = true; return; }
    const s = asg.indexOf(-1);
    if (s < 0) return done();
    const want = gauge[s], cells = [s], seen = new Set([s]);
    const grow = frontier => {
      if (aborted || sols.length >= limit) return;
      if (want == null || cells.length === want) place(cells.slice());
      if (cells.length >= (want ?? maxSize)) return;
      const f = frontier.slice();
      while (f.length) {
        const x = f.pop(); cells.push(x);
        const add = []; for (const y of nb[x]) if (asg[y] < 0 && !seen.has(y)) { seen.add(y); add.push(y); }
        grow(f.concat(add));
        for (const y of add) seen.delete(y);
        cells.pop();
      }
    };
    const first = []; for (const y of nb[s]) if (asg[y] < 0) { seen.add(y); first.push(y); }
    grow(first);
  }
  go();
  return { sols, nodes, aborted };
}
