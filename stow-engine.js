// Stow: drag the shapes into the hold; a line full from end to end clears. This is everything but the page: the fields
// (squares, hexagons, triangles, cut to any outline), their lines, the pieces that fit each, placing and clearing, the
// deals, the levels and the solver that proves every level can be won and sets its par. Pure, integer-only where it
// decides anything, so the page, the worker, the build of the levels and the tests all reach the same answers.

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
 * count: they'd fill by accident.
 */
export function makeField(spec) {
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
const pieceKey = cells => cells.map(keyOf).join(";");
/** Every fixed polyform of a kind up to `size` cells, smallest first: { id, kind, cells, size }. */
export function polyforms(kind, size) {
  const seeds = kind === "tri" ? [[[0, 0, 1]], [[0, 0, 2]]] : [[[0, 0]]];
  let layer = seeds.map(s => canonical(kind, s));
  const out = [...layer];
  for (let n = 2; n <= size; n++) {
    const next = new Map();
    for (const p of layer) {
      const have = new Set(p.map(keyOf));
      for (const c of p) for (const nb of neighbours(kind, c)) {
        if (have.has(keyOf(nb))) continue;
        const q = canonical(kind, [...p, nb]), k = pieceKey(q);
        if (!next.has(k)) next.set(k, q);
      }
    }
    layer = [...next.values()].sort((x, y) => (pieceKey(x) < pieceKey(y) ? -1 : 1));
    out.push(...layer);
  }
  return out.map(cells => ({ id: `${kind}:${pieceKey(cells)}`, kind, cells, size: cells.length }));
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
export const pieceById = id => { const kind = id.split(":")[0]; return pool(kind).find(p => p.id === id) || null; };

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
/** Puts a piece in: the board after (a new array), the lines cleared, and how many consignments went with them. */
export function put(field, board, idx) {
  const lines = filledBy(field, board, idx), next = board.slice();
  for (const i of idx) next[i] = 1;
  let marks = 0;
  const cleared = new Set();
  for (const li of lines) for (const i of field.lines[li].cells) cleared.add(i);
  for (const i of cleared) { if (next[i] === 2) marks++; next[i] = 0; }
  return { board: next, lines, cleared: [...cleared], marks };
}
export const marksLeft = board => { let n = 0; for (let i = 0; i < board.length; i++) if (board[i] === 2) n++; return n; };
/** Whether any of the pieces still in hand fits somewhere. */
export function anyFits(field, board, pieces) {
  for (const p of pieces) if (p && placements(field, p).some(idx => fits(board, idx))) return true;
  return false;
}

// ---------- deals ----------
/**
 * The pieces a level deals, three to a tray: drawn by size (`weights`: a weight for each size, 1 up) and then evenly
 * among the pool's pieces of that size, from the level's seed and the tray's number, so every tray of a level is the
 * same whoever plays it and whatever happened before. A second player's trays come from the same level with `hand` 1.
 */
export function tray(level, n, hand = 0) {
  const ps = pool(level.field.kind), r = rng(mix(level.seed, n, hand, 0x5703));
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
        for (const idx of placements(field, pieces[k])) {
          if (!fits(s.board, idx)) continue;
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
    const idx = placements(field, pieces[k]).find(x => x[0] === at);
    if (!idx || !fits(board, idx)) return null;
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
// Today's hold comes round the kinds of field in turn, a little harder at the weekend.
export const DAILY_RECIPES = [
  { field: { kind: "square", w: 8, h: 8 }, fill: 0.34, marks: 5, weights: [2, 3, 4, 4, 3], par: [9, 16], clump: 4 },
  { field: { kind: "hex", radius: 4 }, fill: 0.32, marks: 5, weights: [2, 3, 4, 4], par: [9, 16], clump: 4 },
  { field: { kind: "tri", size: 3 }, fill: 0.3, marks: 4, weights: [2, 3, 4, 4, 3, 2], par: [8, 15], clump: 4 },
  { field: { kind: "square", w: 9, h: 9, bays: 3 }, fill: 0.34, marks: 6, weights: [2, 3, 4, 4, 3], par: [10, 18], clump: 4 },
];
/** The day's level (day: YYYYMMDD). Slow-ish (it proves itself): the page asks the worker. */
export function dailyLevel(day) {
  const r = DAILY_RECIPES[day % DAILY_RECIPES.length];
  const lv = makeLevel(r, mix(day, 0xDA11), { tries: 12, width: 40 });
  return { ...lv, id: `d${day}`, day, title: "Today's hold" };
}
