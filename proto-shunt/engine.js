// SHUNT-PACK: pure, seeded rules for the packing version of Shunt. No DOM. Runs in Node and the page.
//
// A BOX (any shape of cells) with a DOOR on one side. Gears are pieces on the cell grid, placed one at a time, each of
// which must be able to travel from outside through the door to its spot without overlapping anything (rigid, no
// turning on the way): so order and orientation are real choices. Pieces:
//   g1[f]   one cell, pitch family f           (weight 1)
//   g2[f]   2x2 cells, family f                (weight 2)
//   br[f,g] bridge: two cells on ONE shaft, family f at one end, g at the other, both turn the SAME way (weight 2).
//           Four orientations: which end is which family, and across or down.
// Touching gears (sharing an edge) of the same family MESH and turn opposite ways; of different families they CLASH
// (grind) and the placement is refused. A shaft is the only same-way link, so a loop of gears with an odd number of
// meshes JAMS: the contact graph must be 2-colourable by spin. FIXED parts: motors (always turn, spin +1), outputs
// (must be driven by the motor of the same id, optionally in a required direction), posts (dead squares).
// Two motors in one connected train FUSE: refused. Win: every output driven by its own motor, right way.
// Score: weights of the gears in motor-driven trains.

export const WEIGHT = { g1: 1, g2: 2, br: 2 };
const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Footprint of a piece in an orientation: cells [{dx,dy,f,n}] (n = which gear of the piece), w, h. */
export function shape(p, o) {
  if (p.k === "g1") return { w: 1, h: 1, cells: [{ dx: 0, dy: 0, f: p.f, n: 0 }] };
  if (p.k === "g2") return { w: 2, h: 2, cells: [0, 1, 2, 3].map(i => ({ dx: i & 1, dy: i >> 1, f: p.f, n: 0 })) };
  const [a, b] = o === 0 ? [[0, 0], [1, 0]] : o === 1 ? [[0, 0], [0, 1]] : o === 2 ? [[1, 0], [0, 0]] : [[0, 1], [0, 0]];
  const horiz = o === 0 || o === 2;
  return { w: horiz ? 2 : 1, h: horiz ? 1 : 2, cells: [{ dx: a[0], dy: a[1], f: p.f, n: 0 }, { dx: b[0], dy: b[1], f: p.g, n: 1 }] };
}
export const orients = p => (p.k !== "br" ? [0] : p.f === p.g ? [0, 1] : [0, 1, 2, 3]);
export const kindKey = p => (p.k === "br" ? `br${p.f}${p.g}` : `${p.k}${p.f}`);

/** level: { w, h, box: ["..##", ...] ('.' cell, '#' wall), door: "N"|"S"|"E"|"W",
 *           fixed: [{t:"motor"|"out"|"post", x, y, size, f, id, dir}], supply: [{k, f, g}] } */
export function prep(level) {
  const { w, h } = level, wall = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) wall[y * w + x] = level.box[y][x] === "#" ? 1 : 0;
  const fixedCells = new Int16Array(w * h).fill(-1), nodes = [], post = new Uint8Array(w * h);
  level.fixed.forEach(fx => {
    if (fx.t === "post") { post[fx.y * w + fx.x] = 1; return; }
    const n = nodes.length; nodes.push({ f: fx.f, fixed: fx, piece: -1 - n });
    for (let dy = 0; dy < (fx.size || 1); dy++) for (let dx = 0; dx < (fx.size || 1); dx++) fixedCells[(fx.y + dy) * w + fx.x + dx] = n;
  });
  const kinds = [], seen = new Map();
  level.supply.forEach(p => { const key = kindKey(p); if (!seen.has(key)) { seen.set(key, kinds.length); kinds.push({ p, key, count: 0, id: kinds.length }); } kinds[seen.get(key)].count++; });
  const places = [];
  for (const K of kinds) for (const o of orients(K.p)) {
    const sh = shape(K.p, o);
    for (let y = 0; y + sh.h <= h; y++) for (let x = 0; x + sh.w <= w; x++) {
      if (sh.cells.some(c => { const i = (y + c.dy) * w + x + c.dx; return wall[i] || post[i] || fixedCells[i] >= 0; })) continue;
      places.push({ id: places.length, kind: K.id, o, x, y, sh });
    }
  }
  return { level, w, h, wall, post, fixedCells, nodes, kinds, places, door: DIRS[level.door] };
}

/** Can a piece travel from outside the door to (x,y)? Rigid; every cell it passes must be free. `occ`: owner per cell, -1 free. */
export function reachable(P, sh, x, y, occ) {
  const { w, h, door } = P, [ddx, ddy] = door;
  const inStrip = (cx, cy) => (ddx === 0 ? cx >= 0 && cx < w : true) && (ddy === 0 ? cy >= 0 && cy < h : true) && (ddx < 0 ? cx < 0 : ddx > 0 ? cx >= w : ddy < 0 ? cy < 0 : cy >= h);
  const blocked = (ax, ay) => {
    for (const c of sh.cells) {
      const cx = ax + c.dx, cy = ay + c.dy;
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) { if (!inStrip(cx, cy)) return true; continue; }
      const i = cy * w + cx; if (P.wall[i] || P.post[i] || P.fixedCells[i] >= 0 || occ[i] >= 0) return true;
    }
    return false;
  };
  const key = (ax, ay) => (ay + 4) * 32 + ax + 4, seen = new Uint8Array(32 * 32), q = [];
  for (let ay = -4; ay < h + 3; ay++) for (let ax = -4; ax < w + 3; ax++) {
    if (sh.cells.every(c => inStrip(ax + c.dx, ay + c.dy)) && !blocked(ax, ay)) { seen[key(ax, ay)] = 1; q.push([ax, ay]); }
  }
  for (let k = 0; k < q.length; k++) {
    const [ax, ay] = q[k]; if (ax === x && ay === y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ax + dx, ny = ay + dy; if (nx < -4 || ny < -4 || nx >= w + 3 || ny >= h + 3 || seen[key(nx, ny)] || blocked(nx, ny)) continue;
      seen[key(nx, ny)] = 1; q.push([nx, ny]);
    }
  }
  return false;
}

/** Analyse a set of placements (place ids): clashes, jams, fuses, driven trains, outputs. */
export function analyse(P, placed) {
  const { w, h } = P, cellNode = new Int16Array(w * h).fill(-1), nodes = P.nodes.map(n => ({ ...n })), pieceOf = nodes.map(n => n.piece);
  const fam = nodes.map(n => n.f), pl = [], edges = [];
  for (let i = 0; i < w * h; i++) if (P.fixedCells[i] >= 0) cellNode[i] = P.fixedCells[i];
  placed.forEach((pid, pi) => {
    const pc = P.places[pid], K = P.kinds[pc.kind], base = nodes.length, nn = pc.sh.cells.length === 2 ? 2 : 1;
    for (let n = 0; n < nn; n++) { nodes.push({ piece: pi }); pieceOf.push(pi); fam.push(pc.sh.cells.find(c => c.n === n).f); }
    if (nn === 2) edges.push([base, base + 1, 1]);
    for (const c of pc.sh.cells) cellNode[(pc.y + c.dy) * w + pc.x + c.dx] = base + c.n;
    pl.push({ pid, K, base });
  });
  let clash = null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = cellNode[y * w + x]; if (a < 0) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy; if (nx >= w || ny >= h) continue;
      const b = cellNode[ny * w + nx]; if (b < 0 || b === a || pieceOf[a] === pieceOf[b]) continue;
      if (fam[a] !== fam[b]) { clash = clash || { a, b, x, y }; continue; }
      edges.push([a, b, -1]);
    }
  }
  const adj = nodes.map(() => []); for (const [a, b, s] of edges) { adj[a].push([b, s]); adj[b].push([a, s]); }
  const comp = new Int16Array(nodes.length).fill(-1), spin = new Int8Array(nodes.length), comps = [];
  let jam = false;
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] >= 0) continue;
    const cid = comps.length, list = [s]; comp[s] = cid; spin[s] = 1; let bad = false;
    for (let k = 0; k < list.length; k++) for (const [j, sg] of adj[list[k]]) {
      const want = spin[list[k]] * sg;
      if (comp[j] < 0) { comp[j] = cid; spin[j] = want; list.push(j); } else if (spin[j] !== want) bad = true;
    }
    if (bad) jam = true;
    comps.push({ list, bad, motors: list.filter(n => nodes[n].fixed && nodes[n].fixed.t === "motor") });
  }
  const fuse = comps.some(c => c.motors.length > 1);
  const driven = new Uint8Array(nodes.length), abs = new Int8Array(nodes.length);
  for (const c of comps) if (!c.bad && c.motors.length === 1) { const m = spin[c.motors[0]]; for (const n of c.list) { driven[n] = 1; abs[n] = spin[n] * m; } }
  let score = 0; for (const p of pl) if (driven[p.base]) score += WEIGHT[p.K.p.k];
  const outs = nodes.map((n, i) => ({ n, i })).filter(o => o.n.fixed && o.n.fixed.t === "out").map(({ n, i }) => {
    const c = comps[comp[i]], mot = c.motors.length === 1 && !c.bad ? nodes[c.motors[0]].fixed.id : null;
    return { id: n.fixed.id, ok: mot === n.fixed.id && (!n.fixed.dir || abs[i] === n.fixed.dir), spin: abs[i] };
  });
  return { clash, jam, fuse, ok: !clash && !jam && !fuse, score, outs, won: outs.every(o => o.ok), driven, pl };
}

export function start(level) { const P = prep(level); return { P, placed: [], left: P.kinds.map(k => k.count) }; }
export function occupancy(P, placed) {
  const occ = new Int16Array(P.w * P.h).fill(-1);
  placed.forEach((pid, i) => { const pc = P.places[pid]; for (const c of pc.sh.cells) occ[(pc.y + c.dy) * P.w + pc.x + c.dx] = i; });
  return occ;
}
/** Try a placement. { ok, why } and, when ok, the new state and its analysis. */
export function place(s, pid) {
  const { P } = s, pc = P.places[pid];
  if (s.left[pc.kind] <= 0) return { ok: false, why: "none left" };
  const occ = occupancy(P, s.placed);
  if (pc.sh.cells.some(c => occ[(pc.y + c.dy) * P.w + pc.x + c.dx] >= 0)) return { ok: false, why: "occupied" };
  const an = analyse(P, [...s.placed, pid]); // cheaper than the path search and refuses most spots
  if (an.clash) return { ok: false, why: "clash: different pitches touch" };
  if (an.jam) return { ok: false, why: "jam: odd loop" };
  if (an.fuse) return { ok: false, why: "fuse: two motors in one train" };
  if (!reachable(P, pc.sh, pc.x, pc.y, occ)) return { ok: false, why: "blocked: no way in from the door" };
  const left = s.left.slice(); left[pc.kind]--;
  return { ok: true, state: { P, placed: [...s.placed, pid], left }, an };
}
export const legalMoves = s => s.P.places.filter(pc => place(s, pc.id).ok).map(pc => pc.id);
export const judge = s => analyse(s.P, s.placed);

/** ASCII picture: # wall, X post, M motor, O output, a/b/c one-cell gears by family, A/B/C big gears, bridges as 1..3 over 4..6 ends (f-end lower-case digit). */
export function show(P, placed) {
  const { w, h } = P, g = Array.from({ length: h }, () => Array(w).fill("."));
  for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; if (P.wall[i]) g[y][x] = "#"; else if (P.post[i]) g[y][x] = "X"; else if (P.fixedCells[i] >= 0) g[y][x] = P.nodes[P.fixedCells[i]].fixed.t === "motor" ? "M" : "O"; }
  placed.forEach(pid => {
    const pc = P.places[pid], k = pc.sh.cells.length;
    for (const c of pc.sh.cells) g[pc.y + c.dy][pc.x + c.dx] = k === 1 ? "abc"[c.f] : k === 4 ? "ABC"[c.f] : "pqr"[c.f] + "";
  });
  return g.map(r => r.join("")).join("\n");
}
