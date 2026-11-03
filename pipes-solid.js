// Pipes on a solid (November 2026): the Puzzle's rules on the faces of a polyhedron. A board is a graph of tiles: each tile
// has n sides (a square's four, a pentagon's five), numbered 0..n-1 counter-clockwise seen from outside, and a side of one
// tile meets one side of another across an edge of the solid; the oil leaves a tile by a side and enters the next by the
// side that meets it. Pieces turn (on a solid there is no north to fix them to): a piece is a kind and a rotation, "a2".
// Kind a joins two sides next to each other (a bend; on a pentagon the tight one), b two sides one apart round (a square's
// straight; a pentagon's easy bend), x a crossing (squares only). The hand fixes how many of each kind; the route fixes the
// turns. Pure: pipes-solid-solve.js proves every level has one answer, pipes-solid-3d.js and pipes-solid-ui.js draw it,
// tests/pipes-solid.mjs plays it.
//
// Geometry is on a unit sphere (the solid's corners at distance 1), so one camera fits every solid.

// ---------- vectors ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => mul(a, 1 / len(a));
const mid = (a, b) => mul(add(a, b), 0.5);
const mean = vs => mul(vs.reduce(add, [0, 0, 0]), 1 / vs.length);
const key = v => v.map(x => Math.round(x * 1e4)).join(",");

// ---------- the solids ----------
const CUBE_FACES = [   // outward normal N and axes U, V with U × V = N, so a face's tiles run counter-clockwise from outside
  { N: [1, 0, 0], U: [0, 1, 0], V: [0, 0, 1] }, { N: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0] },
  { N: [0, 1, 0], U: [0, 0, 1], V: [1, 0, 0] }, { N: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1] },
  { N: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0] }, { N: [0, 0, -1], U: [0, 1, 0], V: [1, 0, 0] },
];
const PHI = (1 + Math.sqrt(5)) / 2;

/** The faces of the solid as polygons (each a list of corners, counter-clockwise seen from outside), with their tiles' corners
 *  per face: cube faces are cut m by m (square tile c = j * m + i in the face), a dodecahedron's pentagon is one tile. */
function faceList(name, m) {
  if (name === "cube") {
    return CUBE_FACES.map(({ N, U, V }) => {
      const p = (a, b) => add(N, add(mul(U, -1 + 2 * a / m), mul(V, -1 + 2 * b / m)));
      const tiles = [];
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) tiles.push([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]);
      return { verts: [p(0, 0), p(m, 0), p(m, m), p(0, m)], tiles };
    });
  }
  if (name === "dodeca") {
    const V = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) V.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]);
    const normals = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) normals.push([0, a * PHI, b], [a * PHI, b, 0], [b, 0, a * PHI]);
    return normals.map(N0 => {
      const N = unit(N0), best = Math.max(...V.map(v => dot(v, N))), vs = V.filter(v => dot(v, N) > best - 1e-6);
      const c = mean(vs), e1 = unit(sub(vs[0], c)), e2 = cross(N, e1);
      vs.sort((p, q) => Math.atan2(dot(sub(p, c), e2), dot(sub(p, c), e1)) - Math.atan2(dot(sub(q, c), e2), dot(sub(q, c), e1)));
      return { verts: vs, tiles: [vs] };
    });
  }
  throw new Error(`unknown solid ${name}`);
}

const cache = new Map();
/**
 * A solid: { name, m, tiles, faces, count, R }. tiles[t] = { n (sides), verts (3D, counter-clockwise), c (centre), N (outward normal),
 * mids (the middle of each side), nb: [[tile, side]…] (side s meets side nb[s][1] of tile nb[s][0]), face }. faces[f] =
 * { verts, tiles }. Cube tiles are numbered face by face (+X −X +Y −Y +Z −Z), row by row within a face.
 */
export function solidOf(name, m = 1) {
  const id = `${name}:${m}`;
  if (cache.has(id)) return cache.get(id);
  const raw = faceList(name, m), R = Math.max(...raw.flatMap(f => f.verts.map(len)));
  const tiles = [], faces = [];
  raw.forEach((f, fi) => {
    const own = [];
    for (const vs0 of f.tiles) {
      const verts = vs0.map(v => mul(v, 1 / R)), c = mean(verts);
      const N = unit(cross(sub(verts[1], verts[0]), sub(verts[2], verts[1])));
      own.push(tiles.length);
      tiles.push({ n: verts.length, verts, c, N, mids: verts.map((v, s) => mid(v, verts[(s + 1) % verts.length])), nb: [], face: fi });
    }
    faces.push({ verts: f.verts.map(v => mul(v, 1 / R)), tiles: own });
  });
  const edge = new Map();
  tiles.forEach((T, t) => T.verts.forEach((v, s) => edge.set(`${key(v)}>${key(T.verts[(s + 1) % T.n])}`, [t, s])));
  tiles.forEach(T => T.verts.forEach((v, s) => {
    const o = edge.get(`${key(T.verts[(s + 1) % T.n])}>${key(v)}`);
    if (!o) throw new Error(`${name}: an edge with no other side`);
    T.nb[s] = o;
  }));
  const S = { name, m, tiles, faces, count: tiles.length, R: 1 };
  cache.set(id, S);
  return S;
}

// ---------- pieces ----------
export const KINDS = ["a", "b", "x"];
const SPAN = { a: 1, b: 2 };
/** The kinds a solid's hand can have: squares have a crossing too. */
export const kindsOf = S => (S.tiles[0].n === 4 ? ["a", "b", "x"] : ["a", "b"]);
export const KIND_NAMES = {
  cube: { a: "Bend", b: "Straight", x: "Crossing" },
  dodeca: { a: "Tight bend", b: "Easy bend" },
};
export const parsePiece = p => ({ k: p[0], r: Number(p.slice(1)) });
/** The same piece in one spelling: a straight turned twice is itself on a square, a crossing needs no turn. */
export function canon(n, k, r) {
  if (k === "x") return "x0";
  return k + (n === 2 * SPAN[k] ? r % SPAN[k] : ((r % n) + n) % n);
}
/** The channels of a piece on an n-sided tile: pairs of sides. */
export function chans(n, piece) {
  const { k, r } = parsePiece(piece);
  if (k === "x") return [[0, 2], [1, 3]];
  return [[r % n, (r + SPAN[k]) % n]];
}
/** The channel that takes the oil in by side a: { i, out }, or null. */
export function channelOf(n, piece, a) {
  const cs = chans(n, piece);
  for (let i = 0; i < cs.length; i++) { const [p, q] = cs[i]; if (p === a) return { i, out: q }; if (q === a) return { i, out: p }; }
  return null;
}
/** The piece joining sides a and b, or null (they must be one or two apart round the tile). */
export function pieceJoining(n, a, b) {
  for (const k of ["a", "b"]) {
    const s = SPAN[k];
    if ((a + s) % n === b) return canon(n, k, a);
    if ((b + s) % n === a) return canon(n, k, b);
  }
  return null;
}
/** The sides the oil can leave by, entering by a, from a piece of kind k laid any way up. */
export function exitsOf(n, k, a) {
  if (k === "x") return [(a + 2) % 4];
  const s = SPAN[k], o = [(a + s) % n, (a - s + n) % n];
  return o[0] === o[1] ? [o[0]] : o;
}
/** The rotations that put kind k on the oil coming in by side a, nearest to rotation `near` first. */
export function turnsFor(n, k, a, near = 0) {
  if (k === "x") return ["x0"];
  const out = [...new Set(exitsOf(n, k, a).map(b => pieceJoining(n, a, b)))];
  const rot = p => parsePiece(p).r;
  return out.sort((p, q) => Math.abs(rot(p) - near) - Math.abs(rot(q) - near));
}
/** The next turn of a piece in hand. */
export function turned(n, piece) {
  const { k, r } = parsePiece(piece);
  if (k === "x") return piece;
  return canon(n, k, r + 1);
}

// ---------- a level ----------
export const STAR_LIFTS = 2;
const SIDE = "012345";

/**
 * A level from its text. spec: { id, name, chapter, solid ("cube" | "dodeca"), m (cube faces are m × m), src: [tile, side] (the
 * wellhead's tile and the side its outlet is on), term: [tile, side] (the terminal's inlet), rocks: [tiles], olds: { tile:
 * piece } (old pipe: the oil must run through it), stakes: [tiles] (passed in this order), hand: "a3 b2 x1", sols: routes }.
 * A route is the side the oil leaves each tile by, as digits, from the wellhead's outlet on.
 */
export function parseLevel(spec) {
  const S = solidOf(spec.solid, spec.m || 1);
  const L = { id: spec.id, name: spec.name, chapter: spec.chapter, S, spec, cells: Array(S.count).fill(null), stakeAt: Array(S.count).fill(0), stakes: [...(spec.stakes || [])],
    hand: {}, total: 0, olds: 0, source: { c: spec.src[0], d: spec.src[1] }, terminal: { c: spec.term[0], d: spec.term[1] }, sols: spec.sols || [] };
  for (const c of spec.rocks || []) L.cells[c] = { k: "rock" };
  for (const [c, p] of Object.entries(spec.olds || {})) { L.cells[c] = { k: "old", piece: p }; L.olds++; }
  L.cells[L.source.c] = { k: "source", d: L.source.d };
  L.cells[L.terminal.c] = { k: "terminal", d: L.terminal.d };
  L.stakes.forEach((c, i) => { L.stakeAt[c] = i + 1; });
  for (const w of (spec.hand || "").split(/\s+/).filter(Boolean)) {
    const mm = /^([a-z])(\d+)$/.exec(w);
    if (!mm || !KINDS.includes(mm[1])) throw new Error(`level ${spec.id}: bad hand ${w}`);
    L.hand[mm[1]] = Number(mm[2]); L.total += Number(mm[2]);
  }
  return L;
}
/** A level's hand as text. */
export const handText = hand => KINDS.filter(k => hand[k] > 0).map(k => `${k}${hand[k]}`).join(" ");

export const emptyLaid = L => Array(L.S.count).fill(null);
export const pieceOn = (L, laid, c) => (L.cells[c]?.k === "old" ? L.cells[c].piece : laid[c]);
export const laidCount = laid => laid.reduce((n, p) => n + (p ? 1 : 0), 0);
/** What's left of the hand: counts by kind. */
export function handLeft(L, laid) {
  const left = { ...L.hand };
  for (const p of laid) if (p) left[p[0]] = (left[p[0]] || 0) - 1;
  return left;
}
const tileN = (L, c) => L.S.tiles[c].n;
/** The tile and side the oil comes into when it leaves tile c by side d. */
export const across = (L, c, d) => L.S.tiles[c].nb[d];

/**
 * The oil's way as the pieces stand, as in the flat Puzzle (pipes-puzzle.js): { passes: [{ c, a, b }], end: { c, why } } with why
 * "terminal", "shape", "open" (c needs a piece), "rock", "full" (pipe it has filled), "loop".
 */
export function trace(L, laid) {
  const passes = [], filled = {};
  let [c, a] = across(L, L.source.c, L.source.d), last = L.source.c;
  for (let guard = 0; guard < 4 * L.S.count; guard++) {
    const f = L.cells[c];
    if (f?.k === "terminal") return { passes, end: { c, why: f.d === a ? "terminal" : "shape" } };
    if (f?.k === "rock") return { passes, end: { c, why: "rock" } };
    if (f?.k === "source") return { passes, end: { c, why: "full" } };
    const piece = pieceOn(L, laid, c);
    if (!piece) return { passes, end: { c, why: "open" } };
    const ch = channelOf(tileN(L, c), piece, a);
    if (!ch) return { passes, end: { c, why: "shape" } };
    if ((filled[c] || 0) & (1 << ch.i)) return { passes, end: { c, why: "full" } };
    filled[c] = (filled[c] || 0) | (1 << ch.i);
    passes.push({ c, a, b: ch.out });
    last = c;
    [c, a] = across(L, c, ch.out);
  }
  return { passes, end: { c: last, why: "loop" } };
}
/** The way back from the terminal: the pieces that already lead into its inlet. { passes (from the terminal towards the
 *  wellhead; a is the side the oil comes from, b the side it leaves by), end: { c, why } ("source", "open", …) }. */
export function feed(L, laid) {
  const passes = [], seen = {};
  let [c, exit] = across(L, L.terminal.c, L.terminal.d);
  for (let guard = 0; guard < 4 * L.S.count; guard++) {
    const f = L.cells[c];
    if (f?.k === "rock") return { passes, end: { c, why: "rock" } };
    if (f?.k === "source") return { passes, end: { c, why: f.d === exit ? "source" : "shape" } };
    if (f?.k === "terminal") return { passes, end: { c, why: "shape" } };
    const piece = pieceOn(L, laid, c);
    if (!piece) return { passes, end: { c, why: "open" } };
    const ch = channelOf(tileN(L, c), piece, exit);
    if (!ch) return { passes, end: { c, why: "shape" } };
    if (seen[c] & (1 << ch.i)) return { passes, end: { c, why: "loop" } };
    seen[c] = (seen[c] || 0) | (1 << ch.i);
    passes.push({ c, a: ch.out, b: exit });
    [c, exit] = across(L, c, ch.out);
  }
  return { passes, end: { c, why: "loop" } };
}
/** How the level stands, as pipes-puzzle.js's check: { passes, end, placed, left, strays, missed, stakesOk, stakesPassed, solved }. */
export function check(L, laid) {
  const { passes, end } = trace(L, laid);
  const seen = new Set(passes.map(s => s.c));
  const strays = [], missed = [];
  laid.forEach((p, c) => { if (p && !seen.has(c)) strays.push(c); });
  L.cells.forEach((f, c) => { if (f?.k === "old" && !seen.has(c)) missed.push(c); });
  const order = [];
  for (const s of passes) if (L.stakeAt[s.c] && !order.includes(s.c)) order.push(s.c);
  const stakesOk = order.every((c, i) => c === L.stakes[i]);
  const placed = laidCount(laid), left = L.total - placed;
  const solved = end.why === "terminal" && !left && !strays.length && !missed.length && stakesOk && order.length === L.stakes.length;
  return { passes, end, placed, left, strays, missed, stakesOk, stakesPassed: order.length, solved };
}
/** Lays a piece (kind and turn, "a2") on tile c: "laid", "swapped" (yours was there: it goes back to the hand), or "fixed" / "none". */
export function lay(L, laid, c, piece) {
  if (L.cells[c]) return "fixed";
  if (!piece || (handLeft(L, laid)[piece[0]] || 0) < 1) return "none";
  const had = laid[c];
  laid[c] = piece;
  return had ? "swapped" : "laid";
}
export function lift(L, laid, c) {
  const had = laid[c];
  if (!had) return null;
  laid[c] = null;
  return had;
}
/**
 * Where a piece of kind k laid on tile c would best be turned: to take the oil as it stands (the way in from the wellhead's
 * end, or from the terminal's), else as it is in hand. Returns the piece, "a2".
 */
export function fitted(L, laid, c, k, near) {
  const n = tileN(L, c), t = trace(L, laid), f = feed(L, laid);
  if (t.end.why === "open" && t.end.c === c) {
    const last = t.passes[t.passes.length - 1];
    const a = last ? across(L, last.c, last.b)[1] : across(L, L.source.c, L.source.d)[1];
    const o = turnsFor(n, k, a, near);
    if (o.length) return o[0];
  }
  if (f.end.why === "open" && f.end.c === c) {
    const last = f.passes[f.passes.length - 1];
    const b = last ? across(L, last.c, last.a)[1] : across(L, L.terminal.c, L.terminal.d)[1];
    const o = turnsFor(n, k, b, near);
    if (o.length) return o[0];
  }
  return canon(n, k, near);
}

// ---------- a solution, as the route the oil takes ----------
export function routeOf(L, laid) { return trace(L, laid).passes.map(s => SIDE[s.b]).join(""); }
/** The pieces a route lays (old pipe and the wellhead aren't laid), or null if the route isn't legal for the board. */
export function layRoute(L, route) {
  const laid = emptyLaid(L), used = new Set();
  let [c, a] = across(L, L.source.c, L.source.d);
  for (let i = 0; i < route.length; i++) {
    const n = tileN(L, c), f = L.cells[c], b = Number(route[i]), key2 = `${c}:${Math.min(a, b)}${Math.max(a, b)}`;
    if (!(b >= 0 && b < n) || b === a || used.has(key2)) return null;
    used.add(key2);
    if (f) {
      if (f.k !== "old" || channelOf(n, f.piece, a)?.out !== b) return null;
    } else if (!laid[c]) {
      const piece = pieceJoining(n, a, b);
      if (!piece) return null;
      laid[c] = piece;
    } else if (n === 4 && laid[c][0] === "b" && b === (a + 2) % 4 && a % 2 !== parsePiece(laid[c]).r % 2) laid[c] = "x0";
    else return null;
    [c, a] = across(L, c, b);
  }
  return c === L.terminal.c && a === L.terminal.d ? laid : null;
}
/** What a hint says (as pipes-puzzle.js's): { wrong: [c…] } for pieces not in the answer nearest to what's laid, else the next
 *  tile along the oil and its piece, { c, piece }, or { done: true }. Followed, it always ends in a solution. */
export function hintFor(L, laid) {
  let best = null;
  for (const route of L.sols) {
    const sol = layRoute(L, route);
    if (!sol) continue;
    const wrong = [], agree = [];
    laid.forEach((p, c) => { if (p) (sol[c] === p ? agree : wrong).push(c); });
    if (!best || wrong.length < best.wrong.length || (wrong.length === best.wrong.length && agree.length > best.agree.length)) best = { sol, wrong, agree };
  }
  if (!best) return null;
  if (best.wrong.length) return { wrong: best.wrong };
  const next = trace(L, best.sol).passes.find(s => !L.cells[s.c] && !laid[s.c]);
  return next ? { c: next.c, piece: best.sol[next.c] } : { done: true };
}
export function starsFor(L, { hints = 0, lifts = 0 }) {
  if (hints) return 1;
  return lifts <= STAR_LIFTS + Math.floor(L.total / 6) ? 3 : 2;
}

// ---------- the camera, and what a touch hits (pure, so Node can test it) ----------
/** The camera's basis for a yaw and pitch (radians): d from the middle to the eye, r to the right, u up on the screen. */
export function basis(yaw, pitch) {
  const cp = Math.cos(pitch), d = [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  return { d, r, u: cross(d, r) };
}
export const MAX_PITCH = 1.35;
/** Half the picture's height in solid units: the whole solid (radius 1) fits at any turn, with a margin, for any shape of canvas. */
export function halves(aspect, zoom = 1) {
  const fit = 1.12 / zoom;
  return aspect >= 1 ? { hx: fit * aspect, hy: fit } : { hx: fit, hy: fit / aspect };
}
/** Where a point of the solid falls on the screen, in -1..1 each way (y up). */
export function project(p, cam) {
  const { r, u } = basis(cam.yaw, cam.pitch), { hx, hy } = halves(cam.aspect, cam.zoom);
  return [dot(p, r) / hx, dot(p, u) / hy];
}
/** The tile under a point of the screen (x, y in -1..1, y up), or -1: the nearest face the eye can see, by ray against
 *  each tile's plane and its sides (a few dozen tiles: nothing is raycast against a mesh). */
export function pick(S, cam, x, y) {
  const { d, r, u } = basis(cam.yaw, cam.pitch), { hx, hy } = halves(cam.aspect, cam.zoom);
  const o = add(mul(d, 4), add(mul(r, x * hx), mul(u, y * hy)));
  let best = -1, bestT = Infinity;
  for (let t = 0; t < S.tiles.length; t++) {
    const T = S.tiles[t], nd = dot(T.N, d);
    if (nd <= 1e-6) continue;                                   // turned away from the eye
    const s = (dot(T.N, T.c) - dot(T.N, o)) / -nd;               // the ray runs along -d
    if (!(s < bestT)) continue;
    const p = sub(o, mul(d, s));
    let inside = true;
    for (let i = 0; i < T.n && inside; i++) {
      const a = T.verts[i], b = T.verts[(i + 1) % T.n];
      if (dot(cross(sub(b, a), sub(p, a)), T.N) < 0) inside = false;
    }
    if (inside) { best = t; bestT = s; }
  }
  return best;
}

// ---------- the unfolded net ----------
/**
 * The solid cut open and laid flat: { tiles: [{ poly: [[x, y]…], c: [x, y], mids: [[x, y]…] }] (x right, y up, a tile's
 * inradius 30), faces: [{ poly }], cuts: [{ at: [x, y], out: [x, y] (outward), pair }] (the cut edges, each with a letter
 * shared by its two ends), w, h, minX, minY }. Squares and pentagons come out as the cross and as two flowers of pentagons.
 */
export function unfold(S) {
  const frame = f => {
    const [v0, v1] = [f.verts[0], f.verts[1]], N = unit(cross(sub(v1, v0), sub(f.verts[2], v1))), e1 = unit(sub(v1, v0)), e2 = cross(N, e1);
    return { v0, to2: p => [dot(sub(p, v0), e1), dot(sub(p, v0), e2)] };
  };
  const scale = 30 / (() => { const T = S.tiles[0], side = len(sub(T.verts[1], T.verts[0])); return side / (2 * Math.tan(Math.PI / T.n)); })();
  const fr = S.faces.map(frame);
  // the faces next to each face, and the shared edge as two corners
  const nbs = S.faces.map(() => new Map());
  S.tiles.forEach(T => T.nb.forEach(([t2], s) => {
    const g = S.tiles[t2].face;
    if (g !== T.face && !nbs[T.face].has(g)) nbs[T.face].set(g, [T.verts[s], T.verts[(s + 1) % T.n]]);
  }));
  const tryRoot = (root, order) => {
    const T = Array(S.faces.length).fill(null), tree = new Set(), queue = [root];
    T[root] = { cos: 1, sin: 0, tx: 0, ty: 0 };
    while (queue.length) {
      const f = queue.shift();
      const nl = [...nbs[f].keys()];
      if (order) nl.sort((p, q) => ((p * order) % 13) - ((q * order) % 13));
      for (const g of nl) {
        if (T[g]) continue;
        const [P, Q] = nbs[f].get(g), tf = T[f];
        const ap = ap2(tf, fr[f].to2(P)), aq = ap2(tf, fr[f].to2(Q)), gp = fr[g].to2(P), gq = fr[g].to2(Q);
        const th = Math.atan2(aq[1] - ap[1], aq[0] - ap[0]) - Math.atan2(gq[1] - gp[1], gq[0] - gp[0]);
        const cs = Math.cos(th), sn = Math.sin(th);
        T[g] = { cos: cs, sin: sn, tx: ap[0] - (cs * gp[0] - sn * gp[1]), ty: ap[1] - (sn * gp[0] + cs * gp[1]) };
        tree.add(`${Math.min(f, g)}-${Math.max(f, g)}`);
        queue.push(g);
      }
    }
    return { T, tree };
  };
  const ap2 = (t, p) => [t.cos * p[0] - t.sin * p[1] + t.tx, t.sin * p[0] + t.cos * p[1] + t.ty];
  const outline = (T, f) => S.faces[f].verts.map(v => ap2(T[f], fr[f].to2(v)).map(x => x * scale));
  let pick1 = null;
  for (let attempt = 0; attempt < 40 && !pick1; attempt++) {
    const r = tryRoot(attempt % S.faces.length, attempt < S.faces.length ? 0 : attempt);
    const polys = S.faces.map((_, f) => outline(r.T, f));
    let ok = true;
    for (let i = 0; i < polys.length && ok; i++) for (let j = i + 1; j < polys.length && ok; j++) if (overlap(polys[i], polys[j])) ok = false;
    if (ok) pick1 = r;
  }
  if (!pick1) throw new Error(`${S.name}: no net without overlaps`);
  const { T, tree } = pick1;
  const tiles = S.tiles.map(Tl => {
    const f = Tl.face, to = p => ap2(T[f], fr[f].to2(p)).map(x => x * scale);
    return { poly: Tl.verts.map(to), c: to(Tl.c), mids: Tl.mids.map(to) };
  });
  const faces = S.faces.map((_, f) => ({ poly: outline(T, f) }));
  // the cut edges: where two tiles on different faces meet and the faces aren't joined in the net
  const cuts = [], byFaces = new Map();
  S.tiles.forEach((Tl, t) => Tl.nb.forEach(([t2], s) => {
    const f = Tl.face, g = S.tiles[t2].face;
    if (g === f || tree.has(`${Math.min(g, f)}-${Math.max(g, f)}`)) return;
    const k = `${Math.min(g, f)}-${Math.max(g, f)}`;
    if (!byFaces.has(k)) byFaces.set(k, byFaces.size);       // one letter for the two ends of an edge, however many tiles it has
    const m = tiles[t].mids[s], c = tiles[t].c, dx = m[0] - c[0], dy = m[1] - c[1], l = Math.hypot(dx, dy);
    cuts.push({ at: m, out: [dx / l, dy / l], tile: t, side: s, pair: byFaces.get(k) });
  }));
  const all = tiles.flatMap(t => t.poly), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  return { tiles, faces, cuts, minX: Math.min(...xs), minY: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), scale };
}
/** Whether two convex polygons overlap by more than a sliver (separating axis). */
function overlap(P, Q) {
  for (const poly of [P, Q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ax = [a[1] - b[1], b[0] - a[0]];
      const pr = pl => pl.map(p => p[0] * ax[0] + p[1] * ax[1]);
      const p1 = pr(P), p2 = pr(Q), eps = 1e-3 * Math.hypot(...ax);
      if (Math.max(...p1) <= Math.min(...p2) + eps || Math.max(...p2) <= Math.min(...p1) + eps) return false;
    }
  }
  return true;
}
