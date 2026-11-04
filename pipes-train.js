// Gears, the rules (4 November 2026; Pipes until then: the id, files and saved keys keep that name). Pure: no page.
// A level is a plate and a hand of pieces. Every square holds WHOLE gears, always drawn with all their teeth:
//   g    one big gear whose teeth reach all four edges of the square, so it meshes whatever gear sits on any side;
//   d*   a duo: two small gears meshed inside the square, one reaching each of two sides (h, v straight; ne, nw, se, sw elbow);
//   t*   a trio: three small gears in a row, the same ports (th, tv, tne, tnw, tse, tsw).
// A side of a square where a gear reaches the edge is a port. Two gears on facing ports of neighbouring squares mesh, and
// meshed gears turn opposite ways, so the turn of every gear is read off by 2-colouring the graph of meshes from the
// mainspring (clockwise). Two gears forced to turn the SAME way are a JAM (an odd loop of meshes): a jammed level is never
// solved. Physics, not the owner's sentence: a duo (2 gears) passes the turn on flipped; a single and a trio (odd) do not.
// Squares are numbered c = y * cols + x; sides 0 N, 1 E, 2 S, 3 W. Pieces never turn: the hand fixes which ways a duo or
// trio can run. Solving: pipes-train-solve.js; drawing: pipes-wheels.js; the page: pipes-train-ui.js.
import { DIRS, back } from "./pipes-pieces.js";

export { DIRS, back };
export const SIDE = "NESW";
export const STAR_LIFTS = 2;      // lifts a level allows for the third star (and one more for every six pieces)
const R = n => 2.5 * n;            // pitch radius of an n-tooth gear: every gear has the same tooth size, so any two mesh
const quarter = ([x, y], k) => { for (let i = 0; i < k; i++) [x, y] = [60 - y, x]; return [x, y]; };

// ---------- the pieces ----------
const elbowDuo = () => {
  const a = { x: 30, y: R(5), n: 5 }, bx = 60 - R(5);
  return { gears: [a, { x: bx, y: a.y + Math.sqrt((2 * R(5)) ** 2 - (bx - 30) ** 2), n: 5 }], ports: { 0: 0, 1: 1 } };
};
const straightTrio = () => {
  const a = { x: R(5), y: 30, n: 5 }, c = { x: 60 - R(5), y: 30, n: 5 };
  return { gears: [a, { x: 30, y: 30 - Math.sqrt((R(5) + R(4)) ** 2 - (30 - R(5)) ** 2), n: 4 }, c], ports: { 3: 0, 1: 2 } };
};
const elbowTrio = () => {
  const a = { x: 30, y: R(4), n: 4 }, c = { x: 60 - R(4), y: 30, n: 4 };
  const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2, half = Math.hypot(c.x - a.x, c.y - a.y) / 2, up = Math.sqrt((R(4) + R(5)) ** 2 - half * half);
  const ux = (a.y - c.y) / (2 * half), uy = (c.x - a.x) / (2 * half);                  // unit normal of a-c, pointing to the lower left
  return { gears: [a, { x: mx + ux * up, y: my + uy * up, n: 5 }, c], ports: { 0: 0, 1: 2 } };
};
const BASE = {
  g: { gears: [{ x: 30, y: 30, n: 12 }], ports: { 0: 0, 1: 0, 2: 0, 3: 0 } },
  h: { duo: { gears: [{ x: R(6), y: 30, n: 6 }, { x: 60 - R(6), y: 30, n: 6 }], ports: { 3: 0, 1: 1 } }, trio: straightTrio() },
  e: { duo: elbowDuo(), trio: elbowTrio() },
};
/** Every kind of piece: its gears ({x, y, n}: the middle and tooth count, in train order), port (side -> the gear that reaches
 *  it), sides (the ports), cls (how many gears). */
export const SHAPES = {};
{
  const add = (kind, base, turns, cls) => {
    const gears = base.gears.map(g => { const [x, y] = quarter([g.x, g.y], turns); return { ...g, x, y }; });
    const port = Object.fromEntries(Object.entries(base.ports).map(([s, i]) => [(Number(s) + turns) % 4, i]));
    SHAPES[kind] = { kind, cls, gears, port, sides: Object.keys(port).map(Number).sort() };
  };
  add("g", BASE.g, 0, 1);
  for (const [cls, pre, key] of [[2, "d", "duo"], [3, "t", "trio"]]) {
    add(`${pre}h`, BASE.h[key], 0, cls); add(`${pre}v`, BASE.h[key], 1, cls);
    add(`${pre}ne`, BASE.e[key], 0, cls); add(`${pre}se`, BASE.e[key], 1, cls); add(`${pre}sw`, BASE.e[key], 2, cls); add(`${pre}nw`, BASE.e[key], 3, cls);
  }
}
export const KINDS = Object.keys(SHAPES);
export const clsOf = k => SHAPES[k].cls;
/** The mainspring and the load's own gear: one gear of 9 teeth reaching only side d. */
export const END = [0, 1, 2, 3].map(d => ({ kind: "end", cls: 1, gears: [(([x, y]) => ({ x, y, n: 9 }))(quarter([60 - R(9), 30], (d + 3) % 4))], port: { [d]: 0 }, sides: [d] }));
/** The sides a piece passes the power between, entering by side a: a single leaves by any other side, a duo or trio by its other port. */
export const exitsFrom = (kind, a) => {
  const sh = SHAPES[kind];
  if (sh.port[a] === undefined) return [];
  return sh.sides.filter(s => s !== a);
};
/** Turn of the gear at the far end of a train inside a piece, given the turn of the one at the near end. */
export const farTurn = (kind, e) => e ^ ((SHAPES[kind].gears.length - 1) & 1);

/** A fixed gear is written in a map as these; a load as ↻ (the gear laid there must turn clockwise) or ↺ (counter-clockwise). */
export const GLYPH = { g: "o", dh: "─", dv: "│", dne: "└", dnw: "┘", dse: "┌", dsw: "┐", th: "═", tv: "║", tne: "╚", tnw: "╝", tse: "╔", tsw: "╗" };
const OF_GLYPH = Object.fromEntries(Object.entries(GLYPH).map(([k, g]) => [g, k]));
export const LOAD_CHAR = ["↻", "↺"];
/** A route is the side each square is left by, written with the class of piece there: N E S W a single (or a fixed gear), n e s w
 *  a duo, ^ > v < a trio. */
const ROUTE_CH = ["NESW", "nesw", "^>v<"];
const routeChar = (cls, b) => ROUTE_CH[cls - 1][b];
const clsOfChar = ch => ROUTE_CH.findIndex(s => s.includes(ch)) + 1;
const sideOfChar = ch => ROUTE_CH.map(s => s.indexOf(ch)).find(i => i >= 0);
export { routeChar };

/** The square beyond c on side d, or -1 off the board. */
export function beyond(L, c, d) {
  const x = c % L.cols + DIRS[d][0], y = Math.floor(c / L.cols) + DIRS[d][1];
  return x >= 0 && y >= 0 && x < L.cols && y < L.rows ? y * L.cols + x : -1;
}
export const xy = (L, c) => [c % L.cols, Math.floor(c / L.cols)];
/** The piece joining sides a and b: h v ne nw se sw (the shape; a duo or trio is d or t in front of it). */
export function shapeJoining(a, b) {
  const s = [a, b].sort().join("");
  return { "13": "h", "02": "v", "01": "ne", "03": "nw", "12": "se", "23": "sw" }[s] || null;
}

/**
 * A level from its text. spec: { id, map, out, inlet, hand, spin }. The map's rows: . open ground, # pillar, S the mainspring
 * (its teeth towards side `out`), T the load at the train's end (its dial towards side `inlet`, turning as `spin` says), o and the
 * box characters a gear pinned to the plate (the train must run through it), ↻ ↺ a load: a square for a single gear that has to
 * turn that way. hand is "g5 dh1 tne2 …": the pieces to lay, each exactly once.
 */
export function parseLevel(spec) {
  const rows = spec.map.length, cols = spec.map[0].length, size = cols * rows;
  const L = { id: spec.id, name: spec.name, cols, rows, size, cells: Array(size).fill(null), load: Array(size).fill(-1), loads: [], spin: spec.spin === "ccw" ? 1 : 0,
    hand: {}, total: 0, olds: 0, source: null, terminal: null, sols: spec.sols || [] };
  spec.map.forEach((row, y) => {
    if (row.length !== cols) throw new Error(`level ${spec.id}: row ${y} is ${row.length} wide, not ${cols}`);
    [...row].forEach((ch, x) => {
      const c = y * cols + x;
      if (ch === "#") L.cells[c] = { k: "rock" };
      else if (ch === "S") { L.source = { c, d: SIDE.indexOf(spec.out) }; L.cells[c] = { k: "source", d: L.source.d }; }
      else if (ch === "T") { L.terminal = { c, d: SIDE.indexOf(spec.inlet) }; L.cells[c] = { k: "terminal", d: L.terminal.d }; }
      else if (OF_GLYPH[ch]) { L.cells[c] = { k: "old", piece: OF_GLYPH[ch] }; L.olds++; }
      else if (LOAD_CHAR.includes(ch)) { L.load[c] = LOAD_CHAR.indexOf(ch); L.loads.push(c); }
      else if (ch !== ".") throw new Error(`level ${spec.id}: unknown square ${ch}`);
    });
  });
  if (!L.source || !L.terminal) throw new Error(`level ${spec.id}: needs a mainspring and a load`);
  for (const n of (spec.hand || "").split(/\s+/).filter(Boolean)) {
    const m = /^([a-z]+)(\d+)$/.exec(n);
    if (!m || !SHAPES[m[1]]) throw new Error(`level ${spec.id}: bad hand ${n}`);
    L.hand[m[1]] = Number(m[2]); L.total += Number(m[2]);
  }
  return L;
}
/** A level back as text: parseLevel's inverse, for the generator. */
export function specOf(L) {
  const map = [];
  for (let y = 0; y < L.rows; y++) {
    let row = "";
    for (let x = 0; x < L.cols; x++) {
      const c = y * L.cols + x, f = L.cells[c];
      row += !f ? (L.load[c] >= 0 ? LOAD_CHAR[L.load[c]] : ".") : f.k === "rock" ? "#" : f.k === "source" ? "S" : f.k === "terminal" ? "T" : GLYPH[f.piece];
    }
    map.push(row);
  }
  return { id: L.id, map, out: SIDE[L.source.d], inlet: SIDE[L.terminal.d], hand: KINDS.filter(k => L.hand[k]).map(k => `${k}${L.hand[k]}`).join(" "), spin: L.spin ? "ccw" : "cw" };
}

// ---------- what is laid ----------
export const emptyLaid = L => Array(L.size).fill(null);
/** The pieces laid, as they are kept in the saved run ({ square: kind }), and read back (anything that no longer fits the level is dropped). */
export const packLaid = laid => Object.fromEntries(laid.map((p, c) => [c, p]).filter(([, p]) => p));
export function unpackLaid(L, saved) {
  const laid = emptyLaid(L);
  for (const [c, p] of Object.entries(saved || {})) if (SHAPES[p] && Number(c) < L.size && !L.cells[c]) laid[c] = p;
  return laid;
}
export const pieceOn = (L, laid, c) => (L.cells[c]?.k === "old" ? L.cells[c].piece : laid[c]);
/** The shape of whatever sits in square c (a piece, a fixed gear, the mainspring, the load), or null. */
export function shapeAt(L, laid, c) {
  const f = L.cells[c];
  if (f?.k === "source" || f?.k === "terminal") return END[f.d];
  if (f?.k === "rock") return null;
  const p = pieceOn(L, laid, c);
  return p ? SHAPES[p] : null;
}
export function handLeft(L, laid) {
  const left = { ...L.hand };
  for (const p of laid) if (p) left[p] = (left[p] || 0) - 1;
  return left;
}
export const laidCount = laid => laid.reduce((n, p) => n + (p ? 1 : 0), 0);
export const kindsOf = L => KINDS.filter(k => L.hand[k]);

/** Lays kind on square c: "laid" or "swapped" (a piece of yours was there and goes back to the hand), or why not: "fixed" (a
 *  pillar, the mainspring, the load, a fixed gear), "load" (a load takes a single gear only), "none" (all of that kind laid). */
export function lay(L, laid, c, kind) {
  if (L.cells[c]) return "fixed";
  if (!kind || (handLeft(L, laid)[kind] || 0) < 1) return "none";
  if (L.load[c] >= 0 && kind !== "g") return "load";
  const had = laid[c];
  laid[c] = kind;
  return had ? "swapped" : "laid";
}
export function lift(L, laid, c) {
  const had = laid[c];
  if (!had) return null;
  laid[c] = null;
  return had;
}

// ---------- the meshes ----------
/**
 * The graph of meshes as the board stands. Gear i of square c is node c * 3 + i. Returns { turn (by node: 0 clockwise, 1
 * counter-clockwise, -1 not driven by the mainspring), jam (the set of nodes on an odd loop, which cannot turn), order (the
 * squares in the order the power reaches them), driven (a Set of squares the mainspring drives), shapes, adj (the meshes) }.
 */
export function mesh(L, laid) {
  const n = L.size, shapes = Array.from({ length: n }, (_, c) => shapeAt(L, laid, c));
  const adj = Array.from({ length: n * 3 }, () => []);
  const link = (u, v) => { adj[u].push(v); adj[v].push(u); };
  for (let c = 0; c < n; c++) {
    const sh = shapes[c];
    if (!sh) continue;
    for (let i = 0; i + 1 < sh.gears.length; i++) link(c * 3 + i, c * 3 + i + 1);
    for (const s of sh.sides) {
      const m = beyond(L, c, s), other = m >= 0 ? shapes[m] : null;
      if (other && other.port[back(s)] !== undefined && m > c) link(c * 3 + sh.port[s], m * 3 + other.port[back(s)]);
    }
  }
  const turn = new Int8Array(n * 3).fill(-1), depth = new Int32Array(n * 3).fill(-1), parent = new Int32Array(n * 3).fill(-1);
  const jam = new Set(), order = [], driven = new Set();
  const flood = (start, anchored) => {
    const q = [start];
    depth[start] = 0;
    const colour = new Map([[start, 0]]);
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      if (anchored) { turn[u] = colour.get(u); const c = Math.floor(u / 3); if (!driven.has(c)) { driven.add(c); order.push(c); } }
      for (const v of adj[u]) {
        if (!colour.has(v)) { colour.set(v, colour.get(u) ^ 1); depth[v] = depth[u] + 1; parent[v] = u; q.push(v); continue; }
        if (colour.get(v) !== colour.get(u)) continue;
        // two gears that mesh and must turn the same way: the loop through the tree between them is jammed
        let a = u, b = v;
        jam.add(a); jam.add(b);
        while (a !== b) { if (depth[a] >= depth[b]) { a = parent[a]; jam.add(a); } else { b = parent[b]; jam.add(b); } }
      }
    }
    return q;
  };
  const seenAny = new Uint8Array(n * 3), start = L.source.c * 3;
  for (const u of flood(start, true)) seenAny[u] = 1;
  for (let u = 0; u < n * 3; u++) if (!seenAny[u] && shapes[Math.floor(u / 3)] && u % 3 < shapes[Math.floor(u / 3)].gears.length) for (const v of flood(u, false)) seenAny[v] = 1;
  return { turn, jam, order, driven, shapes, adj };
}

/**
 * How the level stands: the meshes, and what is left to make it a solution. { m (mesh), placed, left, strays (laid squares the
 * mainspring doesn't drive), missed (fixed gears it doesn't drive), jams (squares), loads ({ square: "ok" | "bad" | "" }),
 * loadOn (the load is driven), spinOk (it turns its way), path (a train from the mainspring through every piece to the load
 * exists), solved }.
 */
export function check(L, laid) {
  const m = mesh(L, laid), t = L.terminal.c;
  const strays = [], missed = [];
  laid.forEach((p, c) => { if (p && !m.driven.has(c)) strays.push(c); });
  L.cells.forEach((f, c) => { if (f?.k === "old" && !m.driven.has(c)) missed.push(c); });
  const jams = [...new Set([...m.jam].map(u => Math.floor(u / 3)))];
  const loads = {};
  let loadsOk = true;
  for (const c of L.loads) {
    const p = laid[c], t0 = m.turn[c * 3];
    loads[c] = !p || t0 < 0 ? "" : t0 === L.load[c] ? "ok" : "bad";
    if (loads[c] !== "ok") loadsOk = false;
  }
  const loadOn = m.driven.has(t), spinOk = loadOn && m.turn[t * 3] === L.spin;
  const placed = laidCount(laid), left = L.total - placed;
  const pre = !left && !jams.length && !strays.length && !missed.length && loadOn && spinOk && loadsOk;
  const path = pre ? trainPath(L, laid) : null;
  return { m, placed, left, strays, missed, jams, loads, loadsOk, loadOn, spinOk, path, solved: pre && path !== null };
}

/** A train from the mainspring through every gear piece to the load, as a route string, or null: the squares are visited once
 *  each, a piece is entered and left by its ports (any two sides for a single). */
export function trainPath(L, laid) {
  let total = L.olds;
  laid.forEach(p => { if (p) total++; });
  const seen = new Uint8Array(L.size), out = [];
  const go = (c, a, count) => {
    const kind = pieceOn(L, laid, c);
    if (!kind || seen[c] || L.cells[c]?.k === "source" || L.cells[c]?.k === "terminal") return false;
    seen[c] = 1;
    for (const b of exitsFrom(kind, a)) {
      const next = beyond(L, c, b);
      if (next < 0) continue;
      out.push(routeChar(clsOf(kind), b));
      if (next === L.terminal.c) { if (back(b) === L.terminal.d && count === total) return true; }
      else if (go(next, back(b), count + 1)) return true;
      out.pop();
    }
    seen[c] = 0;
    return false;
  };
  const first = beyond(L, L.source.c, L.source.d);
  return first >= 0 && go(first, back(L.source.d), 1) ? out.join("") : null;
}
export const routeOf = trainPath;

/** The pieces a route lays, as `laid` (fixed gears and the ends are not laid), or null if the route is no legal one. */
export function layRoute(L, route) {
  const laid = emptyLaid(L), used = new Set();
  let c = beyond(L, L.source.c, L.source.d), a = back(L.source.d);
  for (const ch of route) {
    if (c < 0 || used.has(c)) return null;
    used.add(c);
    const cls = clsOfChar(ch), b = sideOfChar(ch), f = L.cells[c];
    if (!cls || b === undefined) return null;
    if (f) {
      if (f.k !== "old" || clsOf(f.piece) !== cls || !exitsFrom(f.piece, a).includes(b)) return null;
    } else {
      const shape = cls === 1 ? "" : shapeJoining(a, b);
      if (cls > 1 && !shape) return null;
      laid[c] = cls === 1 ? "g" : `${cls === 2 ? "d" : "t"}${shape}`;
    }
    c = beyond(L, c, b); a = back(b);
  }
  return c === L.terminal.c && a === L.terminal.d ? laid : null;
}

/**
 * What a hint says: the listed answer that agrees best with the pieces laid. If some piece laid is not in it, those squares:
 * { wrong: [c…] }; otherwise the first square along the train still to be laid, and the piece: { c, piece }. Following hints
 * always ends in a solution, whatever the pieces laid, since each one lifts the pieces in the way first.
 */
export function hintFor(L, laid) {
  let best = null;
  for (const route of L.sols) {
    const sol = layRoute(L, route);
    if (!sol) continue;
    const wrong = [], agree = [];
    laid.forEach((p, c) => { if (p) (sol[c] === p ? agree : wrong).push(c); });
    if (!best || wrong.length < best.wrong.length || (wrong.length === best.wrong.length && agree.length > best.agree.length)) best = { sol, wrong, agree, route };
  }
  if (!best) return null;
  if (best.wrong.length) return { wrong: best.wrong };
  const next = walk(L, best.sol).find(c => !L.cells[c] && !laid[c]);
  return next !== undefined ? { c: next, piece: best.sol[next] } : { done: true };
}
/** The squares of a complete answer in the order the train runs through them. */
export function walk(L, laid) {
  const order = [];
  const route = trainPath(L, laid);
  let c = beyond(L, L.source.c, L.source.d);
  for (const ch of route || "") { order.push(c); c = beyond(L, c, sideOfChar(ch)); }
  return order;
}
/** The stars a finished level earns: 1 for solving it, 2 without a hint, 3 for that and few pieces taken back up. */
export function starsFor(L, { hints = 0, lifts = 0 }) {
  if (hints) return 1;
  return lifts <= STAR_LIFTS + Math.floor(L.total / 6) ? 3 : 2;
}
