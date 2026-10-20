// Nonogram on hexes, pure (no page): the genre's other grid, a hexagon of hexagonal cells, every cell on three lines
// (a row, and a line in each of the two slants), each with its clue. Three clues meet at every cell where a square
// grid has two, so the reasoning runs differently: a slant can settle what neither of the other two lines could. The
// pictures are the same knowledge base's outlines and lakes (a flag is a rectangle, and stays on squares), drawn into
// the hexagon as large as it holds them; the one-answer proof and the grading are nonogram-engine.js's, which take any
// lines. nonogram-board.js draws it.
//
// Cells are hexes standing on a point, in axial coordinates (q, r): the big hexagon holds every cell with |q|, |r| and
// |q + r| at most R. Each line reads from the end its clue stands at, as a row reads from its clue on the left: the
// rows left to right (their clues on the left), the falling slants (q fixed) from the bottom right up to the left
// (their clues off the lower right), the rising slants (q + r fixed) from the top right down to the left (their clues
// off the upper right). So the clues stand round three of the six sides each, none in another's way, and the first
// number of a clue is the run nearest it, as on paper.
import { cluesFor, countSolutions, grade } from "./nonogram-engine.js";

export const HEX_SIZES = { small: { label: "Small", R: 5 }, medium: { label: "Medium", R: 7 }, large: { label: "Large", R: 9 } };
const S3 = Math.sqrt(3);
/** A cell's centre, its hex's size (centre to corner) 1: x across, y down. */
export const centreOf = (q, r) => [S3 * (q + r / 2), 1.5 * r];
/** The three directions a line reads in (rows, falling slants, rising slants), as steps of (q, r) and as unit vectors
 *  on the page; a clue stands off its line's first cell the other way. */
export const DIRS = [[1, 0], [0, -1], [-1, 1]].map(([dq, dr]) => { const [x, y] = centreOf(dq, dr), n = Math.hypot(x, y); return { dq, dr, ux: x / n, uy: y / n }; });
export const DIR_NAMES = ["row", "falling slant", "rising slant"];

const GRIDS = new Map();
/**
 * The hexagon of radius R: { R, n, cells: [[q, r]…] (rows top to bottom, each left to right), index (q,r → cell),
 * lines: [[cell…]…] (the rows top to bottom, then the falling slants, then the rising, each left to right; each line's
 * cells in reading order), dirs (each line's direction, 0 1 2) }. 2R + 1 lines a direction.
 */
export function hexGrid(R) {
  if (GRIDS.has(R)) return GRIDS.get(R);
  const cells = [], index = new Map(), key = (q, r) => `${q},${r}`;
  for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++) { index.set(key(q, r), cells.length); cells.push([q, r]); }
  const lines = [], dirs = [];
  const add = (d, list) => { lines.push(list); dirs.push(d); };
  for (let r = -R; r <= R; r++) { const l = []; for (let q = -R; q <= R; q++) { const i = index.get(key(q, r)); if (i != null) l.push(i); } add(0, l); }
  for (let q = -R; q <= R; q++) { const l = []; for (let r = R; r >= -R; r--) { const i = index.get(key(q, r)); if (i != null) l.push(i); } add(1, l); }
  for (let s = R; s >= -R; s--) { const l = []; for (let r = -R; r <= R; r++) { const i = index.get(key(-s - r, r)); if (i != null) l.push(i); } add(2, l); }
  const g = { R, n: cells.length, cells, index: (q, r) => index.get(key(q, r)) ?? -1, lines, dirs };
  GRIDS.set(R, g);
  return g;
}
/** A line's name, for a hint or a partner pointing at it: "row 3", "falling slant 5" (slants counted from the left). */
export const lineName = (R, k) => `${DIR_NAMES[Math.floor(k / (2 * R + 1))]} ${(k % (2 * R + 1)) + 1}`;
/**
 * Who reads line k when a hexagon's clues are split between the seats at a table (the square grid's is ownerOf in
 * nonogram-engine.js): alone, every line; three, a direction each; otherwise round the table within each direction,
 * so a pair has every other line of all three, and nobody can finish alone.
 */
export function hexOwner(R, k, seats) {
  const s = [...seats].sort((a, b) => a - b), per = 2 * R + 1, d = Math.floor(k / per), j = k % per;
  if (s.length < 2) return s[0] ?? 0;
  if (s.length === 3) return s[d];
  return s[(j + d) % s.length];
}
/** The cell under a point of the page (in cell units), or -1: the hex it rounds to. */
export function cellAtPoint(g, x, y) {
  const r = y / 1.5, q = x / S3 - r / 2, s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return g.index(rq, rr);
}

/**
 * How much of each cell a shape covers, 0 to 1: the shape (rings in projected degrees, y up, its box `box`) drawn as
 * large as the hexagon holds it, centred, each cell sampled at 19 points inside it, inside by the even–odd rule.
 */
export function hexCoverage(rings, box, g) {
  const R = g.R + 0.45, hw = (box.x1 - box.x0) / 2, hh = (box.y1 - box.y0) / 2, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  // the largest scale at which the shape's box stands inside the hexagon: |y| ≤ 1.5R and |x| + |y|/√3 ≤ √3R
  const k = Math.min((1.5 * R) / hh, (S3 * R) / (hw + hh / S3));
  const edges = [];
  for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) edges.push(ring[i], ring[i + 1]);
  const inside = (x, y) => {
    let on = false;
    for (let e = 0; e < edges.length; e += 2) {
      const [ax, ay] = edges[e], [bx, by] = edges[e + 1];
      if ((ay > y) !== (by > y) && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) on = !on;
    }
    return on;
  };
  const SAMPLES = [[0, 0], ...[0, 1, 2, 3, 4, 5].map(j => [0.45 * Math.cos((j * Math.PI) / 3), 0.45 * Math.sin((j * Math.PI) / 3)]),
    ...[...Array(12).keys()].map(j => [0.78 * Math.cos((j * Math.PI) / 6 + Math.PI / 12), 0.78 * Math.sin((j * Math.PI) / 6 + Math.PI / 12)])];
  return g.cells.map(([q, r]) => {
    const [x0, y0] = centreOf(q, r);
    let n = 0;
    for (const [dx, dy] of SAMPLES) if (inside(cx + (x0 + dx) / k, cy - (y0 + dy) / k)) n++;
    return n / SAMPLES.length;
  });
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
/**
 * A shape's outline, a line one cell wide: the cells of it with a neighbour outside it (or at the hexagon's edge). On
 * squares an outline like this almost never has one answer (two clues a cell can't pin a thin line down); on hexes,
 * with three, every country's does (measured: README, Nonogram), so on hexes a country is drawn as its coast and its
 * borders, as a map draws it.
 */
export function outlineOf(g, cells) {
  return cells.map((v, i) => {
    if (!v) return 0;
    const [q, r] = g.cells[i];
    return NEIGHBOURS.some(([dq, dr]) => { const j = g.index(q + dq, r + dr); return j < 0 || !cells[j]; }) ? 1 : 0;
  });
}

/**
 * The puzzle a coverage makes on the hexagon, drawn as its outline, as nonogram-pictures.js's puzzleFrom does on
 * squares: the even split, then a little more or less of each cell, then the fewest cells changed (where two answers
 * differ, the half-covered first), until it has one answer that reasoning reaches. Returns { cells, land (the shape
 * the outline is of, filled: the finished picture shows it), clues, grade, flips, cut } or null.
 */
export function hexPuzzleFrom(cov, g, { flips = 10 } = {}) {
  const base = { hex: true, R: g.R, n: g.n, lines: g.lines, colours: 1 };
  const judge = cells => {
    const clues = cluesFor(g.lines, cells), p = { ...base, clues }, n = countSolutions(p, { maxNodes: 3000 });
    if (n.count !== 1 || n.gaveUp) return { clues, two: n.count > 1 ? n.found : null };
    const gr = grade(p);
    return { clues, g: gr.solved ? gr : null, st: gr.st };
  };
  const seen = new Set(), landAt = cut => cov.map(v => (v >= cut ? 1 : 0));
  for (const cut of [0.5, 0.45, 0.55, 0.4, 0.6]) {
    const land = landAt(cut), cells = outlineOf(g, land), key = cells.join("");
    if (seen.has(key)) continue;
    seen.add(key);
    const j = judge(cells);
    if (j.g) return { cells, land, clues: j.clues, grade: j.g, flips: 0, cut };
  }
  const land = landAt(0.5), cells = outlineOf(g, land), changed = [], doubt = i => Math.abs(cov[i] - 0.5);
  for (let n = 0; n <= flips; n++) {
    const j = judge(cells);
    if (j.g) return { cells, land: land.map((v, i) => v | cells[i]), clues: j.clues, grade: j.g, flips: changed.length, cut: 0.5 };
    if (n === flips) break;
    const where = j.two ? [...j.two[0].keys()].filter(i => j.two[0][i] !== j.two[1][i]) : j.st ? [...j.st.keys()].filter(i => j.st[i] & (j.st[i] - 1)) : [];
    let pick = -1;
    for (const i of where) if (!changed.includes(i) && (pick < 0 || doubt(i) < doubt(pick))) pick = i;
    if (pick < 0) break;
    cells[pick] = cells[pick] ? 0 : 1;
    changed.push(pick);
  }
  return null;
}
