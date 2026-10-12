// Stow: drag the shapes into the hold; a line full from end to end clears. This is everything but the page: the fields
// (squares, hexagons, triangles, cut to any outline, flat or in decks), their lines, the pieces that fit each, placing
// and clearing, the deals, the levels and the solver that proves every level can be won and sets its par. Pure,
// integer-only where it decides anything, so the page, the worker, the build of the levels and the tests all reach the
// same answers.
//
// A hold in decks is a flat field stacked: the crane lowers each piece over the hold and it goes down as one until a
// crate stops it, so cargo can't be slid in under cargo. A line along a deck clears; then the hold settles, every crate
// dropping until it rests on another or the floor, which can fill another line, which clears in turn. (Columns from
// the floor to the hatch were tried as lines too: topping up a consignment's column freed it in a piece or two, and no
// hold made a puzzle of it.)

// ---------- randomness: seeded and integer-only, the same on every device ----------
/** mulberry32: a seed's stream of numbers in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A seed from several numbers: the same numbers, the same seed. */
export function mix(...xs) {
  let h = 2166136261;
  for (const x of xs) { h ^= x >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}

// ---------- cells ----------
// A square cell is [x, y]; a hexagon [q, r] (axial, pointy-top: rows run across); a triangle [a, b, c], the indices of
// the three strips it lies in, a + b + c being 1 for one that points up and 2 for one that points down. Each kind's
// lines are its cells sharing a coordinate: rows and columns; the three directions of hexagons; the three of triangles.
const SQ3 = Math.sqrt(3);
export const keyOf = c => c.join(",");
function neighbours(kind, c) {
  if (kind === "square") return [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]];
  if (kind === "hex") return [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1], [c[0] + 1, c[1] - 1], [c[0] - 1, c[1] + 1]];
  const d = c[0] + c[1] + c[2] === 2 ? -1 : 1;                 // a triangle meets three: one less (or more) in one strip
  return [[c[0] + d, c[1], c[2]], [c[0], c[1] + d, c[2]], [c[0], c[1], c[2] + d]];
}
/** A cell's outline and centre, in the field's own units (a square's side, a hexagon's corner radius, a triangle's side). */
function shape(kind, c) {
  if (kind === "square") return { x: c[0] + 0.5, y: c[1] + 0.5, pts: [[c[0], c[1]], [c[0] + 1, c[1]], [c[0] + 1, c[1] + 1], [c[0], c[1] + 1]] };
  if (kind === "hex") {
    const x = SQ3 * (c[0] + c[1] / 2), y = 1.5 * c[1];
    const pts = [];
    for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + (k * Math.PI) / 3; pts.push([x + Math.cos(t), y + Math.sin(t)]); }
    return { x, y, pts };
  }
  // a triangle's corners, from its strips: α, β across two of the directions (γ = −α − β), drawn as x = (2α + β)/2,
  // y = β·√3/2; one pointing up has its corners at (a, b, c − 1), (a, b − 1, c), (a − 1, b, c); one pointing down at
  // (a − 1, b − 1, c), (a − 1, b, c − 1), (a, b − 1, c − 1)
  const [a, b] = c, up = c[0] + c[1] + c[2] === 1;
  const at = (al, be) => [(2 * al + be) / 2, (be * SQ3) / 2];
  const pts = up ? [at(a, b), at(a, b - 1), at(a - 1, b)] : [at(a - 1, b - 1), at(a - 1, b), at(a, b - 1)];
  return { x: (pts[0][0] + pts[1][0] + pts[2][0]) / 3, y: (pts[0][1] + pts[1][1] + pts[2][1]) / 3, pts };
}
export const pointsUp = c => c.length === 3 && c[0] + c[1] + c[2] === 1;

// ---------- fields ----------
/**
 * A field from its spec: { kind: "square", w, h, bays } (bays: 3×3 boxes clear too), { kind: "hex", radius } or
 * { kind: "tri", size } (a hexagon of triangles), each optionally with holes (cells cut out, as coordinates) or rows
 * (a square field's outline: "#" a cell, "." none). Lines shorter than three cells (the tips of a cut outline) don't
 * count: they'd fill by accident. With decks, a hold of that plan that many decks deep (makeHold).
 */
export function makeField(spec) {
  if (spec.decks) return makeHold(spec);
  const kind = spec.kind, coords = [];
  if (kind === "square") {
    const rows = spec.rows || Array.from({ length: spec.h }, () => "#".repeat(spec.w));
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") coords.push([x, y]); }));
  } else if (kind === "hex") {
    const R = spec.radius;
    for (let r = -R; r <= R; r++) for (let q = -R; q <= R; q++) if (Math.abs(q + r) <= R) coords.push([q, r]);
  } else {
    const N = spec.size;
    for (let b = 1 - N; b <= N; b++) for (let a = 1 - N; a <= N; a++) for (const s of [1, 2]) {
      const c = s - a - b;
      if (c >= 1 - N && c <= N) coords.push([a, b, c]);
    }
  }
  const holes = new Set((spec.holes || []).map(keyOf));
  const kept = coords.filter(c => !holes.has(keyOf(c)));
  const index = new Map(kept.map((c, i) => [keyOf(c), i]));
  const cells = kept.map((c, i) => ({ i, c, ...shape(kind, c) }));
  // the lines: cells sharing a coordinate (and, with bays, a 3×3 box)
  const groups = new Map();
  const add = (k, i) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); };
  for (const cell of cells) {
    cell.c.forEach((v, d) => add(`${d}:${v}`, cell.i));
    if (kind === "hex") add(`2:${-cell.c[0] - cell.c[1]}`, cell.i);              // the hexagons' third direction
    if (kind === "square" && spec.bays) add(`b:${Math.floor(cell.c[0] / spec.bays)},${Math.floor(cell.c[1] / spec.bays)}`, cell.i);
  }
  const lines = [...groups.entries()].filter(([, l]) => l.length >= 3).sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([k, l]) => ({ k, cells: Int16Array.from(l) }));
  const cellLines = cells.map(() => []);
  lines.forEach((l, li) => { for (const i of l.cells) cellLines[i].push(li); });
  for (const cell of cells) cell.nb = neighbours(kind, cell.c).map(n => index.get(keyOf(n))).filter(i => i !== undefined);
  const xs = cells.flatMap(c => c.pts.map(p => p[0])), ys = cells.flatMap(c => c.pts.map(p => p[1]));
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return { spec, kind, n: cells.length, cells, index, lines, cellLines: cellLines.map(l => Int16Array.from(l)), box, cache: new Map() };
}
/**
 * A hold in decks: its plan (the flat field the spec describes) repeated `decks` times one above another, the floor
 * first, so a cell's column is its index in the plan and its deck the index over the plan's size. Its lines are each
 * deck's own.
 */
function makeHold(spec) {
  const { decks, ...flat } = spec, plan = makeField(flat), n2 = plan.n;
  const cells = [], index = new Map();
  for (let z = 0; z < decks; z++) for (const p of plan.cells) {
    const c = [...p.c, z], i = z * n2 + p.i;
    cells.push({ i, c, col: p.i, z, x: p.x, y: p.y, pts: p.pts });
    index.set(keyOf(c), i);
  }
  const lines = [];
  for (let z = 0; z < decks; z++) for (const l of plan.lines) lines.push({ k: `${z}|${l.k}`, cells: Int16Array.from(l.cells, i => z * n2 + i) });
  const cellLines = cells.map(() => []);
  lines.forEach((l, li) => { for (const i of l.cells) cellLines[i].push(li); });
  for (const cell of cells) cell.nb = [...plan.cells[cell.col].nb.map(j => cell.z * n2 + j), ...(cell.z > 0 ? [cell.i - n2] : []), ...(cell.z < decks - 1 ? [cell.i + n2] : [])];
  return { spec, kind: plan.kind, decks, plan, n2, n: cells.length, cells, index, lines, cellLines: cellLines.map(l => Int16Array.from(l)), box: plan.box, cache: new Map() };
}

// ---------- pieces ----------
// Every piece is a fixed shape (it never turns: Block Blast's rule, and on triangles turning would change which cells
// point up), kept as its cells with the first (in coordinate order) at the origin; a triangle piece keeps the sum of
// that first cell, so it only fits where its cells point the way they do.
function canonical(kind, cells) {
  const sorted = cells.map(c => c.slice()).sort((p, q) => p[0] - q[0] || p[1] - q[1] || (p[2] || 0) - (q[2] || 0));
  const o = sorted[0];
  const t = kind === "tri" ? [-o[0], -o[1], o[0] + o[1]] : [-o[0], -o[1]];
  return sorted.map(c => c.map((v, d) => v + t[d]));
}
// in a hold a cell carries its deck last: [x, y, z], [q, r, z], [a, b, c, z]; its neighbours are the plan's on its deck,
// and the cells over and under it
const neighbours3 = (kind, c) => {
  const z = c[c.length - 1], flat = c.slice(0, -1);
  return [...neighbours(kind, flat).map(n => [...n, z]), [...flat, z + 1], [...flat, z - 1]];
};
function canonical3(kind, cells) {
  const sorted = cells.map(c => c.slice()).sort((p, q) => { for (let d = 0; d < p.length; d++) if (p[d] !== q[d]) return p[d] - q[d]; return 0; });
  const o = sorted[0];
  const t = kind === "tri" ? [-o[0], -o[1], o[0] + o[1], -o[3]] : [-o[0], -o[1], -o[2]];
  return sorted.map(c => c.map((v, d) => v + t[d]));
}
const pieceKey = cells => cells.map(keyOf).join(";");
/**
 * Every fixed polyform of a kind up to `size` cells, smallest first: { id, kind, cells, size }. Deep, the polyforms of
 * a hold's cells (cubes, hexagonal and triangular prisms), each cell carrying its deck last, ids under "<kind>3".
 */
export function polyforms(kind, size, deep = false) {
  const seeds = kind === "tri" ? [[[0, 0, 1]], [[0, 0, 2]]] : [[[0, 0]]];
  const nbs = deep ? neighbours3 : neighbours, canon = deep ? canonical3 : canonical;
  let layer = seeds.map(s => canon(kind, deep ? s.map(c => [...c, 0]) : s));
  const out = [...layer];
  for (let n = 2; n <= size; n++) {
    const next = new Map();
    for (const p of layer) {
      const have = new Set(p.map(keyOf));
      for (const c of p) for (const nb of nbs(kind, c)) {
        if (have.has(keyOf(nb))) continue;
        const q = canon(kind, [...p, nb]), k = pieceKey(q);
        if (!next.has(k)) next.set(k, q);
      }
    }
    layer = [...next.values()].sort((x, y) => (pieceKey(x) < pieceKey(y) ? -1 : 1));
    out.push(...layer);
  }
  const id = deep ? `${kind}3` : kind;
  return out.map(cells => ({ id: `${id}:${pieceKey(cells)}`, kind, cells, size: cells.length, ...(deep ? { deep } : {}) }));
}
/** How far apart a piece's farthest two cells are (centre to centre, in the field's units): a line of five is long
 *  but tidy, a hook of five is awkward. */
function reach(p) {
  const pts = p.cells.map(c => shape(p.kind, c));
  let d = 0;
  for (const a of pts) for (const b of pts) d = Math.max(d, Math.hypot(a.x - b.x, a.y - b.y));
  return d;
}
// a piece lying along one line: all its cells share a coordinate (a bar of hexagons, a strip of triangles)
const straight = p => p.cells[0].some((v, d) => p.cells.every(c => c[d] === v)) || (p.kind === "hex" && p.cells.every(c => -c[0] - c[1] === -p.cells[0][0] - p.cells[0][1]));
// the pieces each kind deals from: squares up to five (lines, the 2×2, 2×3 and 3×3 blocks, the corners); hexagons up
// to four and triangles up to six, the compact ones and the bars (a crooked snake is no fun to place)
const POOLS = new Map();
export function pool(kind) {
  if (POOLS.has(kind)) return POOLS.get(kind);
  let ps;
  if (kind === "square") {
    ps = polyforms("square", 5).filter(p => p.size <= 4 || straight(p) || isCorner(p));
    const block = (w, h) => { const cells = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]); return { id: `square:${w}x${h}`, kind, cells: canonical(kind, cells), size: w * h }; };
    ps.push(block(2, 3), block(3, 2), block(3, 3));
  } else if (kind === "hex") {
    ps = polyforms("hex", 4).filter(p => p.size <= 3 || reach(p) <= 3.5 || straight(p));
  } else {
    ps = polyforms("tri", 6).filter(p => p.size <= 4 || reach(p) <= 1.55 || (straight(p) && p.size >= 5));
  }
  ps.forEach((p, i) => { p.n = i; });
  POOLS.set(kind, ps);
  return ps;
}
function isCorner(p) {   // the five-cell L with arms of three: two full edges of its 3×3 box
  const xs = p.cells.map(c => c[0]), ys = p.cells.map(c => c[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const has = (x, y) => p.cells.some(c => c[0] === minX + x && c[1] === minY + y);
  const row = y => has(0, y) && has(1, y) && has(2, y), col = x => has(x, 0) && has(x, 1) && has(x, 2);
  return (row(0) || row(2)) && (col(0) || col(2));
}
// A hold's pieces, from the polyforms of its cells: every one of three cells or fewer; of four, those lying flat on one
// deck in a shape the flat field deals, the columns, and, of cubes, the 2×2 squares standing up, the corner of a cube
// (three arms from one cube) and the 2×2×2 block. The twisted fours (a screw of cubes) are hard to read in a tray and
// never dealt; a piece too tall or too wide for a level's hold isn't dealt there (poolFor).
function pool3(kind) {
  const key = `${kind}3`;
  if (POOLS.has(key)) return POOLS.get(key);
  const flat2 = new Set(pool(kind).map(p => p.id.slice(p.id.indexOf(":") + 1)));
  const zOf = c => c[c.length - 1], flatKey = p => pieceKey(canonical(kind, p.cells.map(c => c.slice(0, -1))));
  const level = p => p.cells.every(c => zOf(c) === zOf(p.cells[0])), column = p => p.cells.every(c => c.slice(0, -1).join() === p.cells[0].slice(0, -1).join());
  const span = (p, d) => Math.max(...p.cells.map(c => c[d])) - Math.min(...p.cells.map(c => c[d])) + 1;
  // of cubes: a 2×2 square standing up (two wide, one deep, two high), and the corner of a cube (one cube with an arm
  // in each direction; the screws, the other fours filling half a 2×2×2 block, have none touching three)
  const standing = p => kind === "square" && span(p, 2) === 2 && span(p, 0) * span(p, 1) === 2;
  const touching = (p, c) => p.cells.filter(d => d.reduce((t, v, k) => t + Math.abs(v - c[k]), 0) === 1).length;
  const corner = p => kind === "square" && [0, 1, 2].every(d => span(p, d) === 2) && p.cells.some(c => touching(p, c) === 3);
  const ps = polyforms(kind, 4, true).filter(p => p.size <= 3 || (level(p) && flat2.has(flatKey(p))) || column(p) || (p.size === 4 && (standing(p) || corner(p))));
  if (kind === "square") {
    const cells = [];
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) cells.push([x, y, z]);
    ps.push({ id: "square3:2x2x2", kind, cells: canonical3(kind, cells), size: 8, deep: true });
  }
  ps.forEach((p, i) => { p.n = i; });
  POOLS.set(key, ps);
  return ps;
}
/** The pieces a level deals: a flat field's whole pool; a hold's, those that fit it empty. */
const FITTING = new Map();
export function poolFor(spec) {
  if (!spec.decks) return pool(spec.kind);
  const key = JSON.stringify(spec);
  if (!FITTING.has(key)) { const f = makeField(spec); FITTING.set(key, pool3(spec.kind).filter(p => drops(f, p).some(d => d.tall < f.decks))); }
  return FITTING.get(key);
}
export const pieceById = id => { const kind = id.split(":")[0]; return (kind.endsWith("3") ? pool3(kind.slice(0, -1)) : pool(kind)).find(p => p.id === id) || null; };

/**
 * Every way a piece fits the field's outline, ignoring what's in it: lists of cell indices, the piece's first cell
 * first. Worked out once per field and piece.
 */
export function placements(field, piece) {
  const k = piece.id;
  if (field.cache.has(k)) return field.cache.get(k);
  const out = [], p0 = piece.cells[0], tri = field.kind === "tri";
  for (const cell of field.cells) {
    if (tri && cell.c[0] + cell.c[1] + cell.c[2] !== p0[0] + p0[1] + p0[2]) continue;   // it points the other way
    const t = cell.c.map((v, d) => v - p0[d]);
    const idx = new Int16Array(piece.size);
    let ok = true;
    for (let j = 0; j < piece.size; j++) {
      const i = field.index.get(keyOf(piece.cells[j].map((v, d) => v + t[d])));
      if (i === undefined) { ok = false; break; }
      idx[j] = i;
    }
    if (ok) out.push(idx);
  }
  field.cache.set(k, out);
  return out;
}

/**
 * Every place the crane can lower a piece into a hold: its footprint inside the plan's outline (a triangle piece only
 * where its triangles point its way). Each: the column under each of its cells and the cell's height in the piece, and,
 * column by column, its lowest cell there (what it comes to rest on). Worked out once per hold and piece.
 */
export function drops(field, piece) {
  const k = `drop:${piece.id}`;
  if (field.cache.has(k)) return field.cache.get(k);
  const plan = field.plan, out = [], p0 = piece.cells[0].slice(0, -1), tri = field.kind === "tri";
  const zMin = Math.min(...piece.cells.map(c => c[c.length - 1]));
  for (const cell of plan.cells) {
    if (tri && cell.c[0] + cell.c[1] + cell.c[2] !== p0[0] + p0[1] + p0[2]) continue;
    const t = cell.c.map((v, d) => v - p0[d]), col = new Int16Array(piece.size), dz = new Int8Array(piece.size);
    let ok = true;
    for (let j = 0; j < piece.size && ok; j++) {
      const c = piece.cells[j], i2 = plan.index.get(keyOf(c.slice(0, -1).map((v, d) => v + t[d])));
      if (i2 === undefined) ok = false;
      else { col[j] = i2; dz[j] = c[c.length - 1] - zMin; }
    }
    if (!ok) continue;
    const low = new Map();
    for (let j = 0; j < piece.size; j++) low.set(col[j], Math.min(low.get(col[j]) ?? 99, dz[j]));
    out.push({ col, dz, cols: Int16Array.from(low.keys()), low: Int8Array.from(low.values()), tall: Math.max(...dz) });
  }
  field.cache.set(k, out);
  return out;
}
/** How high each column of a hold stands: one over its highest crate, 0 when it's empty. */
export function tops(field, board) {
  const { n2, decks } = field, top = new Int8Array(n2);
  for (let col = 0; col < n2; col++) for (let z = decks - 1; z >= 0; z--) if (board[z * n2 + col]) { top[col] = z + 1; break; }
  return top;
}
/** Where a piece lowered at a drop comes to rest (its cells, the piece's first first), or null if it would stand out of
 *  the hatch. */
export function landing(field, top, d) {
  let base = 0;
  for (let k = 0; k < d.cols.length; k++) base = Math.max(base, top[d.cols[k]] - d.low[k]);
  if (base + d.tall >= field.decks) return null;
  const idx = new Int16Array(d.col.length);
  for (let j = 0; j < idx.length; j++) idx[j] = (base + d.dz[j]) * field.n2 + d.col[j];
  return idx;
}
/** Every way a piece can go in now (lists of cell indices, its first cell first): where it fits, or, in a hold, where
 *  it comes to rest from each place the crane can lower it. */
export function options(field, board, piece) {
  if (!field.decks) return placements(field, piece).filter(idx => fits(board, idx));
  const top = tops(field, board), out = [];
  for (const d of drops(field, piece)) { const idx = landing(field, top, d); if (idx) out.push(idx); }
  return out;
}

// ---------- the board: cells empty (0), cargo (1), a consignment to clear (2) ----------
/** Whether a placement's cells are all empty. */
export const fits = (board, idx) => { for (let j = 0; j < idx.length; j++) if (board[idx[j]]) return false; return true; };
/** The lines a placement would fill (the board as it is, the piece not yet in): their indices. */
export function filledBy(field, board, idx) {
  const out = [], seen = new Set(), mine = new Set(idx);
  for (const i of idx) for (const li of field.cellLines[i]) {
    if (seen.has(li)) continue;
    seen.add(li);
    const cells = field.lines[li].cells;
    let full = true;
    for (let j = 0; j < cells.length; j++) if (!board[cells[j]] && !mine.has(cells[j])) { full = false; break; }
    if (full) out.push(li);
  }
  return out;
}
/**
 * Puts a piece in: the board after (a new array), the lines it filled and the cells they cleared, how many
 * consignments went with them, and the waves: in a hold, each clearing and the settling after it (the crates moved,
 * [from, to]), which may fill more lines. `carry` (optional, the same length as the board) is moved along with the
 * crates, so a colour stays with its crate. With `trace`, each wave keeps the board before it and after (and the
 * carried values before and after: carried, carry).
 */
export function put(field, board, idx, carry = null, trace = false) {
  const next = board.slice(), extra = carry && carry.slice(), waves = [];
  let lines = filledBy(field, board, idx), marks = 0;
  for (const i of idx) next[i] = 1;
  while (lines.length) {
    const cleared = new Set();
    for (const li of lines) for (const i of field.lines[li].cells) cleared.add(i);
    const before = trace ? next.slice() : null, carried = trace && extra ? extra.slice() : null;
    for (const i of cleared) { if (next[i] === 2) marks++; next[i] = 0; if (extra) extra[i] = 0; }
    const moved = field.decks ? settle(field, next, extra) : [];
    waves.push({ lines, cleared: [...cleared], moved, ...(trace ? { before, after: next.slice(), carried, carry: extra && extra.slice() } : {}) });
    lines = moved.length ? fullThrough(field, next, moved.map(m => m[1])) : [];
  }
  return { board: next, extra, lines: waves[0]?.lines || [], cleared: waves[0]?.cleared || [], marks, waves };
}
/** A hold settles: in every column each crate drops until it rests on another or the floor. The crates moved, [from, to]. */
function settle(field, b, extra) {
  const { n2, decks } = field, moved = [];
  for (let col = 0; col < n2; col++) {
    let to = 0;
    for (let z = 0; z < decks; z++) {
      const i = z * n2 + col;
      if (!b[i]) continue;
      if (z !== to) {
        const j = to * n2 + col;
        b[j] = b[i]; b[i] = 0;
        if (extra) { extra[j] = extra[i]; extra[i] = 0; }
        moved.push([i, j]);
      }
      to++;
    }
  }
  return moved;
}
/** The lines through some cells that are full. */
function fullThrough(field, b, cells) {
  const out = [], seen = new Set();
  for (const i of cells) for (const li of field.cellLines[i]) {
    if (seen.has(li)) continue;
    seen.add(li);
    const l = field.lines[li].cells;
    let full = true;
    for (let j = 0; j < l.length; j++) if (!b[l[j]]) { full = false; break; }
    if (full) out.push(li);
  }
  return out.sort((x, y) => x - y);
}
export const marksLeft = board => { let n = 0; for (let i = 0; i < board.length; i++) if (board[i] === 2) n++; return n; };
/** Whether any of the pieces still in hand fits somewhere. */
export function anyFits(field, board, pieces) {
  if (!field.decks) {
    for (const p of pieces) if (p && placements(field, p).some(idx => fits(board, idx))) return true;
    return false;
  }
  const top = tops(field, board);
  for (const p of pieces) if (p) for (const d of drops(field, p)) {
    let base = 0;
    for (let k = 0; k < d.cols.length; k++) base = Math.max(base, top[d.cols[k]] - d.low[k]);
    if (base + d.tall < field.decks) return true;
  }
  return false;
}

// ---------- deals ----------
/**
 * The pieces a level deals, three to a tray: drawn by size (`weights`: a weight for each size, 1 up) and then evenly
 * among the pool's pieces of that size, from the level's seed and the tray's number, so every tray of a level is the
 * same whoever plays it and whatever happened before. A second player's trays come from the same level with `hand` 1.
 */
export function tray(level, n, hand = 0) {
  const ps = poolFor(level.field), r = rng(mix(level.seed, n, hand, 0x5703));
  const bySize = new Map();
  for (const p of ps) if (level.weights[p.size - 1]) { if (!bySize.has(p.size)) bySize.set(p.size, []); bySize.get(p.size).push(p); }
  const sizes = [...bySize.keys()].sort((a, b) => a - b), total = sizes.reduce((s, z) => s + level.weights[z - 1], 0);
  const out = [];
  for (let k = 0; k < 3; k++) {
    let x = r() * total, size = sizes[sizes.length - 1];
    for (const z of sizes) { x -= level.weights[z - 1]; if (x < 0) { size = z; break; } }
    const list = bySize.get(size);
    out.push(list[Math.floor(r() * list.length)]);
  }
  return out;
}

// ---------- the solver: a beam search over placements, proving a level and setting its par ----------
// What it looks for in a board: consignments gone above all; then lines that hold consignments nearly full, room to
// move, and no lonely holes (an empty cell walled in on every side only a single cell can fill). Integers throughout,
// so every device ranks the same boards the same way and the daily's par is the same everywhere.
function judge(field, board) {
  if (field.decks) return judgeHold(field, board);
  let marks = 0, empty = 0, lonely = 0, progress = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 2) marks++;
    if (board[i]) continue;
    empty++;
    let open = 0;
    for (const j of field.cells[i].nb) if (!board[j]) open++;
    if (open === 0) lonely++;
  }
  for (const l of field.lines) {
    let hasMark = false, full = 0;
    for (let j = 0; j < l.cells.length; j++) { const v = board[l.cells[j]]; if (v === 2) hasMark = true; if (v) full++; }
    if (hasMark) progress += Math.floor((full * full * 64) / (l.cells.length * l.cells.length));
  }
  return -marks * 100000 + progress * 10 + empty * 6 - lonely * 40;
}
// In a hold: consignments gone above all; then lines holding consignments nearly full, room, and no hollows (an empty
// cell under a crate, which nothing lowered can reach until the hold settles) and no tall stacks (a column near the
// hatch takes little).
function judgeHold(field, board) {
  const { n2, decks } = field, top = tops(field, board);
  let marks = 0, empty = 0, hollow = 0, progress = 0, high = 0;
  for (let col = 0; col < n2; col++) {
    for (let z = 0; z < top[col]; z++) if (!board[z * n2 + col]) hollow++;
    if (top[col] >= decks - 1) high += top[col] - decks + 2;
  }
  for (let i = 0; i < board.length; i++) { if (board[i] === 2) marks++; if (!board[i]) empty++; }
  for (const l of field.lines) {
    let hasMark = false, full = 0;
    for (let j = 0; j < l.cells.length; j++) { const v = board[l.cells[j]]; if (v === 2) hasMark = true; if (v) full++; }
    if (hasMark) progress += Math.floor((full * full * 64) / (l.cells.length * l.cells.length));
  }
  return -marks * 100000 + progress * 10 + empty * 6 - hollow * 30 - high * 20;
}
/**
 * Solves a level: the fewest pieces it found that clear every consignment (`par`) and the moves (each [the tray slot
 * used, the cell its first cell went to]), or null if the beam found no way within `limit` pieces. `width` is how many
 * boards it keeps at each step.
 */
export function solve(level, { width = 60, limit = 45, hand = 0 } = {}) {
  const field = level.fieldObj || makeField(level.field);
  let beam = [{ board: startBoard(level, field), slots: [true, true, true], tray: 0, moves: [], score: 0 }];
  if (marksLeft(beam[0].board) === 0) return { par: 0, moves: [] };
  const trays = [];
  const trayOf = n => (trays[n] ||= tray(level, n, hand));
  for (let depth = 1; depth <= limit; depth++) {
    const next = new Map();
    for (const s of beam) {
      const pieces = trayOf(s.tray);
      for (let k = 0; k < 3; k++) {
        if (!s.slots[k]) continue;
        // the same shape twice in a tray: only its first unused copy is tried
        if (pieces.slice(0, k).some((p, j) => s.slots[j] && p === pieces[k])) continue;
        for (const idx of options(field, s.board, pieces[k])) {
          const r = put(field, s.board, idx);
          let slots = s.slots.slice(); slots[k] = false;
          let t = s.tray;
          if (!slots.some(Boolean)) { slots = [true, true, true]; t++; }
          const moves = [...s.moves, [k, idx[0]]];
          if (marksLeft(r.board) === 0) return { par: depth, moves };
          // a board that can't take another piece is a dead end
          const left = trayOf(t).filter((_, j) => slots[j]);
          if (!anyFits(field, r.board, left)) continue;
          const key = `${t}|${slots.map(Number).join("")}|${r.board.join("")}`;
          const score = judge(field, r.board);
          const had = next.get(key);
          if (!had || had.score < score) next.set(key, { board: r.board, slots, tray: t, moves, score, key });
        }
      }
    }
    if (!next.size) return null;
    beam = [...next.values()].sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, width);
  }
  return null;
}
/** A level's board as it opens: its cargo and its consignments. */
export function startBoard(level, field) {
  const b = new Uint8Array(field.n);
  for (const i of level.cargo || []) b[i] = 1;
  for (const i of level.marks || []) b[i] = 2;
  return b;
}
/** Replays moves ([slot, cell]) from the start: the board after each, or null at the first that doesn't fit. */
export function replay(level, moves, hand = 0) {
  const field = level.fieldObj || makeField(level.field);
  let board = startBoard(level, field), slots = [true, true, true], t = 0, pieces = tray(level, 0, hand);
  for (const [k, at] of moves) {
    if (!slots[k]) return null;
    const idx = options(field, board, pieces[k]).find(x => x[0] === at);
    if (!idx) return null;
    board = put(field, board, idx).board;
    slots[k] = false;
    if (!slots.some(Boolean)) { slots = [true, true, true]; t++; pieces = tray(level, t, hand); }
  }
  return board;
}

// ---------- making levels ----------
/**
 * A level from a recipe and a seed: cargo laid in clumps over `fill` of the field (never a full line), `marks` of it
 * stamped as consignments, spread over different lines. Returns { field, cargo, marks, seed, weights } (no par yet).
 */
export function compose(recipe, seed) {
  if (recipe.field.decks) return composeHold(recipe, seed);
  const field = makeField(recipe.field), r = rng(mix(seed, 0xC0DE));
  const board = new Uint8Array(field.n), want = Math.round(field.n * recipe.fill);
  let placed = 0, guard = 0;
  while (placed < want && guard++ < 5000) {
    // a clump: a short walk from a random cell
    let i = Math.floor(r() * field.n), len = 1 + Math.floor(r() * (recipe.clump || 4));
    for (let s = 0; s < len && placed < want; s++) {
      if (!board[i]) {
        board[i] = 1;
        if (field.cellLines[i].some(li => [...field.lines[li].cells].every(j => board[j]))) board[i] = 0;   // never a full line
        else placed++;
      }
      const nb = field.cells[i].nb;
      if (!nb.length) break;
      i = nb[Math.floor(r() * nb.length)];
    }
  }
  // the consignments: filled cells, each on lines no other consignment shares where possible
  const filled = [...board.keys()].filter(i => board[i]);
  const marks = [], used = new Set();
  for (let tries = 0; marks.length < recipe.marks && tries < 400; tries++) {
    const i = filled[Math.floor(r() * filled.length)];
    if (i === undefined || board[i] === 2) continue;
    const ls = field.cellLines[i];
    if (tries < 300 && ls.some(li => used.has(li))) continue;
    board[i] = 2; marks.push(i); ls.forEach(li => used.add(li));
  }
  const cargo = filled.filter(i => board[i] === 1);
  return { field: recipe.field, cargo, marks: marks.sort((a, b) => a - b), seed, weights: recipe.weights };
}
/**
 * A hold's cargo: stacks raised a crate at a time along short walks over the plan, as the crane would have left them
 * (no hollows, no column higher than the deck under the hatch, never a full line), `marks` of the crates stamped as
 * consignments, the deeper ones first and each on lines no other shares where it can be.
 */
function composeHold(recipe, seed) {
  const field = makeField(recipe.field), r = rng(mix(seed, 0xC0DE, 3)), { n2, decks } = field;
  const board = new Uint8Array(field.n), want = Math.round(field.n * recipe.fill), top = new Int8Array(n2), cap = recipe.cap ?? decks - 1;
  let placed = 0, guard = 0;
  while (placed < want && guard++ < 5000) {
    let col = Math.floor(r() * n2), len = 1 + Math.floor(r() * (recipe.clump || 4));
    for (let s = 0; s < len && placed < want; s++) {
      if (top[col] < cap) {
        const i = top[col] * n2 + col;
        board[i] = 1;
        if (field.cellLines[i].some(li => field.lines[li].cells.every(j => board[j]))) board[i] = 0;
        else { top[col]++; placed++; }
      }
      const nb = field.plan.cells[col].nb;
      if (!nb.length) break;
      col = nb[Math.floor(r() * nb.length)];
    }
  }
  // the consignments: crates with cargo over them first, then any
  const filled = [...board.keys()].filter(i => board[i]);
  const buried = filled.filter(i => i + n2 < field.n && board[i + n2]);
  const marks = [], used = new Set();
  for (let tries = 0; marks.length < recipe.marks && tries < 400; tries++) {
    const from = tries < 200 && buried.length ? buried : filled, i = from[Math.floor(r() * from.length)];
    if (i === undefined || board[i] === 2) continue;
    const ls = field.cellLines[i];
    if (tries < 300 && ls.some(li => used.has(li))) continue;
    board[i] = 2; marks.push(i); ls.forEach(li => used.add(li));
  }
  const cargo = filled.filter(i => board[i] === 1);
  return { field: recipe.field, cargo, marks: marks.sort((a, b) => a - b), seed, weights: recipe.weights };
}
/**
 * A level that's a puzzle: composed from the recipe with seeds from `seed` on, solved, and kept when its par lies in
 * the recipe's range and a careless player (the solver at width one) does worse or gets stuck. Up to `tries` seeds;
 * failing that, the last one the solver could win.
 */
export function makeLevel(recipe, seed, { tries = 30, width = 60 } = {}) {
  let fallback = null;
  for (let t = 0; t < tries; t++) {
    const lv = compose(recipe, mix(seed, t));
    lv.fieldObj = makeField(lv.field);
    const best = solve(lv, { width, limit: recipe.limit || 40 });
    if (!best) continue;
    const careless = solve(lv, { width: 1, limit: recipe.limit || 40 });
    const lvOut = { ...lv, par: best.par, solution: best.moves };
    delete lvOut.fieldObj;
    fallback ||= lvOut;
    const [lo, hi] = recipe.par || [1, 99];
    if (best.par < lo || best.par > hi) continue;
    if (!recipe.easy && careless && careless.par <= best.par) continue;   // no puzzle: anything wins it as fast
    return lvOut;
  }
  return fallback;
}

// ---------- stars ----------
/** Stars for a level won in `used` pieces: three at par or better, two within a third over it, one for any win. */
export const starsFor = (used, par) => (used <= par ? 3 : used <= par + Math.max(2, Math.ceil(par / 3)) ? 2 : 1);

// ---------- the daily: a level for the day, the same everywhere ----------
// Today's hold comes round the kinds of field in turn, a hold in decks among them.
export const DAILY_RECIPES = [
  { field: { kind: "square", w: 8, h: 8 }, fill: 0.34, marks: 5, weights: [2, 3, 4, 4, 3], par: [9, 16], clump: 4 },
  { field: { kind: "hex", radius: 4 }, fill: 0.32, marks: 5, weights: [2, 3, 4, 4], par: [9, 16], clump: 4 },
  { field: { kind: "tri", size: 3 }, fill: 0.3, marks: 4, weights: [2, 3, 4, 4, 3, 2], par: [8, 15], clump: 4 },
  { field: { kind: "square", w: 9, h: 9, bays: 3 }, fill: 0.34, marks: 6, weights: [2, 3, 4, 4, 3], par: [10, 18], clump: 4 },
  { field: { kind: "square", w: 6, h: 6, decks: 3 }, fill: 0.27, marks: 5, weights: [2, 3, 4, 3, 0, 0, 0, 1], par: [6, 10], clump: 3 },
];
/** The day's level (day: YYYYMMDD). Slow-ish (it proves itself): the page asks the worker. */
export function dailyLevel(day) {
  const r = DAILY_RECIPES[day % DAILY_RECIPES.length];
  const lv = makeLevel(r, mix(day, 0xDA11), { tries: 12, width: 40 });
  return { ...lv, id: `d${day}`, day, title: "Today's hold" };
}
