// Factor's coast: an island of nineteen hexes (three, four, five, four, three in a row), the 54 corners where posts and
// factories stand, the 72 edges where roads run, and nine harbours round the shore. Geometry only, drawn to a unit
// hexagon (circumradius 1, point up): the page scales it, the rules and the computer players read its neighbours.
// A hex, corner or edge is its index in HEXES, VERTS or EDGES, which never changes, so a saved game can say "corner 17".
import { shuffle } from "./seats.js";

export const RES = ["timber", "clay", "wool", "grain", "iron"];      // what the land gives, in the order every hand lists it
export const RES_NAMES = ["timber", "clay", "wool", "grain", "iron"];
/** The land: one terrain for each resource, and the dunes, which give nothing. */
export const TERRAIN = ["forest", "clay pits", "pasture", "fields", "hills", "dunes"];
/** Pips: how often a number comes up of the 36 ways two dice fall (2 and 12 once, 6 and 8 five times). */
export const pips = n => (n >= 2 && n <= 12 && n !== 7 ? 6 - Math.abs(7 - n) : 0);

const SQ3 = Math.sqrt(3);

// ---------- the hexes ----------
const AXIAL = [];
for (let r = -2; r <= 2; r++) for (let q = Math.max(-2, -2 - r); q <= Math.min(2, 2 - r); q++) AXIAL.push([q, r]);

export const HEXES = AXIAL.map(([q, r]) => ({ q, r, x: SQ3 * (q + r / 2), y: 1.5 * r, corners: [], nb: [] }));
export const VERTS = [];
export const EDGES = [];

{
  const vkey = new Map(), ekey = new Map();
  const vertex = (x, y) => {
    const k = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    if (!vkey.has(k)) { vkey.set(k, VERTS.length); VERTS.push({ x, y, hexes: [], adj: [], edges: [] }); }
    return vkey.get(k);
  };
  HEXES.forEach((h, hi) => {
    for (let i = 0; i < 6; i++) {
      const a = (60 * i - 30) * Math.PI / 180;
      const v = vertex(h.x + Math.cos(a), h.y + Math.sin(a));
      h.corners.push(v);
      VERTS[v].hexes.push(hi);
    }
    for (let i = 0; i < 6; i++) {
      const a = h.corners[i], b = h.corners[(i + 1) % 6], k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!ekey.has(k)) {
        ekey.set(k, EDGES.length);
        EDGES.push({ a: Math.min(a, b), b: Math.max(a, b), x: (VERTS[a].x + VERTS[b].x) / 2, y: (VERTS[a].y + VERTS[b].y) / 2, hexes: [] });
      }
      EDGES[ekey.get(k)].hexes.push(hi);
    }
  });
  EDGES.forEach((e, ei) => {
    for (const v of [e.a, e.b]) VERTS[v].edges.push(ei);
    VERTS[e.a].adj.push(e.b);
    VERTS[e.b].adj.push(e.a);
    if (e.hexes.length === 2) { HEXES[e.hexes[0]].nb.push(e.hexes[1]); HEXES[e.hexes[1]].nb.push(e.hexes[0]); }
  });
}

/** The other end of an edge. */
export const otherEnd = (e, v) => (EDGES[e].a === v ? EDGES[e].b : EDGES[e].a);
/** The edge between two corners, or -1. */
export const edgeBetween = (a, b) => VERTS[a].edges.find(e => otherEnd(e, a) === b) ?? -1;

// ---------- the shore and its harbours ----------
/** The edges with sea on one side, clockwise from the top: thirty of them. */
export const COAST = EDGES.map((e, i) => i).filter(i => EDGES[i].hexes.length === 1)
  .sort((p, q) => {
    const ang = i => { const a = Math.atan2(EDGES[i].x, -EDGES[i].y); return a < 0 ? a + 2 * Math.PI : a; };
    return ang(p) - ang(q);
  });
/** Which coast edges carry a harbour: nine, with two, two and three bare edges between them, three times round. */
export const PORT_AT = [0, 3, 6, 10, 13, 16, 20, 23, 26].map(i => COAST[i]);
/** Harbours: a 3:1 for anything (four of them) and a 2:1 for each resource (one each). */
export const PORT_KINDS = ["any", "any", "any", "any", 0, 1, 2, 3, 4];
/** The harbour's side the sea is on: a unit vector from the island's middle out through the edge. */
export const portOut = e => { const { x, y } = EDGES[e], d = Math.hypot(x, y) || 1; return [x / d, y / d]; };

// ---------- a coast dealt from a seed ----------
/**
 * The land: { kind[19] (0..4 a resource, 5 the dunes), num[19] (0 on the dunes), ports[9] (what each harbour trades: "any" or a
 * resource), robber (the hex the blockade starts on: the dunes) }. The hot numbers, 6 and 8, never touch.
 */
export function makeBoard(rng) {
  const kind = shuffle([0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5], rng);
  const nums = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  let num = null;
  for (let tries = 0; tries < 400 && !num; tries++) {
    const order = shuffle(nums, rng);
    const trial = kind.map(k => (k === 5 ? 0 : order.pop()));
    const hot = i => trial[i] === 6 || trial[i] === 8;
    if (!HEXES.some((h, i) => hot(i) && h.nb.some(j => j > i && hot(j)))) num = trial;
    else if (tries === 399) num = trial;
  }
  return { kind, num, ports: shuffle(PORT_KINDS, rng), robber: kind.indexOf(5) };
}

/** The corners a harbour serves: both ends of its edge. */
export const portVerts = i => [EDGES[PORT_AT[i]].a, EDGES[PORT_AT[i]].b];
