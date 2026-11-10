// Gears: the rules (4 November 2026; docs/pipes.md and docs/pipes-contract.md). Pure: no page. A level is a plate of squares, one to three
// trains (a barrel, a sink with a goal, pinned pieces on the way) and a hand of pieces (pipes-gear-shapes.js) that must all be laid.
// Every wheel is a node of one graph: a MESH (facing port wheels of one layer and one module, or two wheels meshed inside a piece), a RING
// mesh (internal teeth: the same turn) or a RIGID link (one arbor). Each barrel turns clockwise at speed 1; speeds are exact fractions
// flooded out from it (a mesh gives w_v = -w_u n_u / n_v). A wheel reached twice with two different speeds is LOCKED, and the loop that
// closes is the jam (an odd loop gives two directions, a loop whose tooth ratios do not multiply to 1 gives two magnitudes: a bind).
// Wheels of one layer and two modules that face each other CLASH; two trains whose wheels mesh are TANGLED. A gear id is c * 8 + i
// (square c, wheel i of its piece). Squares are numbered c = y * cols + x; sides 0 N, 1 E, 2 S, 3 W.
import * as F from "./pipes-gear-frac.js";
import { CELL, SIDE, DIRS, back, shapeOf, endShape, orientations, canonRot, topLayer, parseKind, radius } from "./pipes-gear-shapes.js";

export { SIDE, DIRS, back, F };
export const STAR_LIFTS = 2;      // corrections the third star allows (and one more for every six pieces)
export const SLOTS = 8;           // gear ids per square
const WAYS = ["cw", "ccw"];

// ---------- the level ----------
/** The squares outside a round plate `d` squares across (a level with `disc` in its data keeps them as voids): their centres are further from the middle than the radius less a fifth of a square. */
export function discVoid(d) {
  const out = new Set(), m = (d - 1) / 2;
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) if (Math.hypot(x - m, y - m) > d / 2 - 0.2) out.add(y * d + x);
  return out;
}
/** The square beyond c on side d, or -1 off the board. */
export function beyond(L, c, d) {
  const x = c % L.cols + DIRS[d][0], y = Math.floor(c / L.cols) + DIRS[d][1];
  return x >= 0 && y >= 0 && x < L.cols && y < L.rows ? y * L.cols + x : -1;
}
export const xy = (L, c) => [c % L.cols, Math.floor(c / L.cols)];
export const pieceStr = (kind, rot) => `${kind}@${rot}`;
export const pieceOf = p => { const i = p.lastIndexOf("@"); return { kind: p.slice(0, i), rot: Number(p.slice(i + 1)) }; };
const goalOf = (g, fallbackW = 0) => (g ? { type: g.type || "wheel", speed: g.speed === undefined || g.speed === null ? null : F.abs(typeof g.speed === "string" ? F.parse(g.speed) : g.speed),
  dir: g.dir === "ccw" || g.dir === 1 ? 1 : g.dir === "cw" || g.dir === 0 ? 0 : null, w: g.w ?? fallbackW, ring: !!g.ring, tune: g.tune, hour: g.hour, extra: g } : null);
const sideOf = s => (typeof s === "number" ? s : SIDE.indexOf(s));
const wayOf = d => (d === "ccw" || d === 1 ? 1 : 0);

/**
 * A level from its data (see docs/pipes-contract.md): { id, name, chapter, cols, rows, rotate, map, trains, pins, clicks, hand, sols }.
 * Throws on a bad level.
 */
export function parseLevel(spec) {
  const rows = spec.map.length, cols = spec.map[0].length, size = cols * rows, bad = m => { throw new Error(`level ${spec.id}: ${m}`); };
  const L = { id: spec.id, name: spec.name, chapter: spec.chapter, cols, rows, size, rotate: spec.rotate !== false, cap: new Int8Array(size).fill(3), fixed: Array(size).fill(null),
    click: new Int8Array(size).fill(-1), trains: [], pins: [], clicks: [], hand: {}, total: 0, sols: [], spec, void: new Uint8Array(size) };
  spec.map.forEach((row, y) => {
    if (row.length !== cols) bad(`row ${y} is ${row.length} wide, not ${cols}`);
    [...row].forEach((ch, x) => {
      const c = y * cols + x;
      if (ch === "#") L.cap[c] = 0;
      else if (ch === " ") { L.cap[c] = 0; L.void[c] = 1; }      // outside a round plate: no ground, nothing to lay or to see
      else if (ch === "1" || ch === "2") L.cap[c] = Number(ch);
      else if (ch !== ".") bad(`unknown square ${ch}`);
    });
  });
  const fix = (c, f) => { if (!(c >= 0 && c < size)) bad(`square ${c} is off the plate`); if (L.cap[c] === 0 || L.fixed[c]) bad(`square ${c} is not free`); L.fixed[c] = f; };
  (spec.trains || []).forEach((t, index) => {
    const b = t.barrel, s = t.sink;
    const barrel = { c: b.c, side: sideOf(b.side), m: b.m, l: b.l, n: b.n || Math.round(45 / b.m) };
    const sink = { c: s.c, side: sideOf(s.side), m: s.m, l: s.l, n: s.n || Math.round(45 / s.m), ring: !!s.goal?.ring || !!s.ring, pinion: s.pinion || 4 };
    const shapeOfEnd = e => endShape({ side: e.side, n: e.n, m: e.m, l: e.l, ring: e.ring, pinion: e.pinion });
    const tr = { id: t.id || "ABC"[index], index, barrel, sink, goal: goalOf(s.goal, sink.ring ? 1 : 0) };
    fix(barrel.c, { k: "barrel", train: index, shape: shapeOfEnd({ ...barrel, ring: false }) });
    fix(sink.c, { k: "sink", train: index, shape: shapeOfEnd(sink), goal: tr.goal });
    L.trains.push(tr);
  });
  if (!L.trains.length) bad("needs a train");
  (spec.pins || []).forEach(p => {
    const shape = shapeOf(p.kind, p.rot || 0);
    if (!shape) bad(`bad pin ${p.kind}`);
    const train = p.train === undefined ? 0 : typeof p.train === "number" ? p.train : L.trains.findIndex(t => t.id === p.train);
    const pin = { c: p.c, kind: p.kind, rot: p.rot || 0, train, goal: goalOf(p.goal) };
    fix(p.c, { k: "pin", train, shape, goal: pin.goal });
    L.pins.push(pin);
  });
  for (const k of spec.clicks || []) {
    if (!(k.c >= 0 && k.c < size) || L.cap[k.c] === 0 || L.fixed[k.c]) bad(`bad click ${k.c}`);
    L.click[k.c] = wayOf(k.dir); L.clicks.push({ c: k.c, dir: wayOf(k.dir) });
  }
  for (const item of (spec.hand || "").split(/\s+/).filter(Boolean)) {
    const i = item.lastIndexOf(":"), key = item.slice(0, i), n = Number(item.slice(i + 1));
    const { kind, rot } = key.includes("@") ? pieceOf(key) : { kind: key, rot: 0 };
    if (!shapeOf(kind, rot) || !(n >= 1)) bad(`bad hand ${item}`);
    if (L.rotate === key.includes("@")) bad(`hand ${key} ${L.rotate ? "has a fixed turn in a level that turns" : "needs its turn (kind@rot)"}`);
    L.hand[key] = (L.hand[key] || 0) + n; L.total += n;
  }
  L.sols = (spec.sols || []).map(s => { const a = Array(size).fill(null); for (const [c, p] of Object.entries(s)) a[c] = p; return a; });
  return L;
}

// ---------- what is laid ----------
export const emptyLaid = L => Array(L.size).fill(null);
export const packLaid = laid => Object.fromEntries(laid.map((p, c) => [c, p]).filter(([, p]) => p));
/** The saved { square: "kind@rot" } read back; anything that no longer fits the level is dropped. */
export function unpackLaid(L, saved) {
  const laid = emptyLaid(L);
  for (const [c, p] of Object.entries(saved || {})) {
    if (typeof p !== "string" || !(Number(c) >= 0 && Number(c) < L.size) || L.fixed[c] || !L.cap[c]) continue;
    const { kind, rot } = pieceOf(p);
    if (shapeOf(kind, rot) && topLayer(kind) <= L.cap[c]) laid[c] = pieceStr(kind, canonRot(kind, rot));
  }
  return laid;
}
/** The hand key a laid piece is counted under: its kind in a level that turns, kind@rot in one that does not. */
export const keyOf = (L, p) => (L.rotate ? pieceOf(p).kind : p);
export function handLeft(L, laid) {
  const left = { ...L.hand };
  for (const p of laid) if (p) left[keyOf(L, p)] = (left[keyOf(L, p)] || 0) - 1;
  return left;
}
export const handKinds = L => Object.keys(L.hand);
export const laidCount = laid => laid.reduce((n, p) => n + (p ? 1 : 0), 0);
export const shapeAt = (L, laid, c) => {
  const f = L.fixed[c];
  if (f) return f.shape;
  const p = laid[c];
  if (!p) return null;
  const { kind, rot } = pieceOf(p);
  return shapeOf(kind, rot);
};
/** The piece a hand key and a wish of turn make (a level that does not turn fixes the turn). */
export const pieceFor = (L, key, rot = 0) => { if (key.includes("@")) return key; return pieceStr(key, canonRot(key, rot)); };

/** Lays hand key `key` (turned `rot` when the level turns) on square c: "laid" or "swapped" (a piece of yours was there and goes back to
 *  the hand), or why not: "fixed" (a pillar, a pinned piece, an end), "none" (all laid), "ceiling" (a bridge is too low), "click" (a click
 *  takes a single only). */
export function lay(L, laid, c, key, rot = 0) {
  if (L.fixed[c] || !L.cap[c]) return "fixed";
  if (!key || (handLeft(L, laid)[key] || 0) < 1) return "none";
  const kind = key.includes("@") ? pieceOf(key).kind : key;
  if (topLayer(kind) > L.cap[c]) return "ceiling";
  if (L.click[c] >= 0 && parseKind(kind).f !== "S") return "click";
  const had = laid[c];
  laid[c] = pieceFor(L, key, rot);
  return had ? "swapped" : "laid";
}
export function lift(L, laid, c) { const had = laid[c]; if (!had) return null; laid[c] = null; return had; }
/** Turns the piece on c to its next distinct orientation; returns the new rot, or null when it has none (or the level does not turn). */
export function turn(L, laid, c) {
  if (!L.rotate || !laid[c]) return null;
  const { kind, rot } = pieceOf(laid[c]), os = orientations(kind);
  if (os.length < 2) return null;
  const next = os[(os.indexOf(canonRot(kind, rot)) + 1) % os.length];
  laid[c] = pieceStr(kind, next);
  return next;
}
/** The turn of kind `key` that suits square c best: no jam, clash or tangle, then driven, then the most wheels driven. */
export function bestTurn(L, laid, c, key) {
  if (key.includes("@")) return pieceOf(key).rot;
  let best = null;
  for (const rot of orientations(key)) {
    const was = laid[c];
    laid[c] = pieceStr(key, rot);
    const M = mesh(L, laid), bad = M.jam.size + M.clash.length + M.tangle.length, mine = M.driven.has(c) ? 0 : 1, score = [bad, mine, -M.driven.size];
    laid[c] = was;
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2])))) best = { rot, score };
  }
  return best ? best.rot : 0;
}

// ---------- the graph of wheels ----------
/**
 * The wheels and how they are joined, and the speeds. M = { gears [{ id, c, i, x, y, n, m, layer, arbor, train, fixed }], idx (gear id -> index in
 * gears or -1), edges [{ u, v, kind: "mesh" | "ring" | "rigid", at: [x, y] }], omega (by gear id: a fraction, the barrel being 1, clockwise
 * positive, or null when no barrel drives it), dir (by gear id: 0 clockwise, 1 counter-clockwise, -1 not driven), jam (Set of gear ids on
 * a locked loop), locked (Set of every gear id joined to a jam: none of them can turn), loops [{ gears, why: "turn" | "bind" }], clash [[u, v]], tangle [[trainA, trainB]], driven (Set of squares), order (the
 * squares in the order the power reaches them), orders (the same by train), trainOf (by gear id, -1 for none), shapes (by square) }.
 */
export function mesh(L, laid) {
  const n = L.size, shapes = Array.from({ length: n }, (_, c) => shapeAt(L, laid, c));
  const gears = [], idx = new Int32Array(n * SLOTS).fill(-1), edges = [], clash = [];
  shapes.forEach((sh, c) => {
    if (!sh) return;
    const [cx, cy] = xy(L, c), f = L.fixed[c];
    sh.wheels.forEach((w, i) => {
      idx[c * SLOTS + i] = gears.length;
      gears.push({ id: c * SLOTS + i, c, i, x: cx * CELL + w.x, y: cy * CELL + w.y, n: w.n, m: w.m, layer: w.l, arbor: c * SLOTS + sh.wheels.findIndex(o => o.a === w.a), train: f ? f.train : -1, fixed: f ? f.k : null,
        ring: sh.ring.some(([, v]) => v === i) });
    });
  });
  const G = id => gears[idx[id]], adj = new Map();
  const link = (u, v, kind, at) => { edges.push({ u, v, kind, at }); for (const [a, b] of [[u, v], [v, u]]) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ v: b, kind }); } };
  shapes.forEach((sh, c) => {
    if (!sh) return;
    const id = i => c * SLOTS + i, mid = (a, b) => { const r1 = radius(a.m, a.n), r2 = radius(b.m, b.n); return [a.x + (b.x - a.x) * r1 / (r1 + r2), a.y + (b.y - a.y) * r1 / (r1 + r2)]; };
    for (const [u, v] of sh.mesh) link(id(u), id(v), "mesh", mid(G(id(u)), G(id(v))));
    for (const [u, v] of sh.ring) {
      const a = G(id(u)), b = G(id(v)), d = Math.hypot(a.x - b.x, a.y - b.y) || 1, r = radius(a.m, a.n);
      link(id(u), id(v), "ring", [a.x + (a.x - b.x) / d * r, a.y + (a.y - b.y) / d * r]);
    }
    sh.wheels.forEach((w, i) => { const first = sh.wheels.findIndex(o => o.a === w.a); if (first !== i) link(id(first), id(i), "rigid", [G(id(i)).x, G(id(i)).y]); });
    for (const q of sh.ports) {
      const d = beyond(L, c, q.s), other = d > c ? shapes[d] : null;
      if (!other) continue;
      const w1 = sh.wheels[q.w];
      for (const q2 of other.ports) {
        if (q2.s !== back(q.s)) continue;
        const w2 = other.wheels[q2.w];
        if (w1.l !== w2.l) continue;
        const u = id(q.w), v = d * SLOTS + q2.w;
        if (w1.m !== w2.m) clash.push([u, v]);
        else link(u, v, "mesh", mid(G(u), G(v)));
      }
    }
  });
  // the flood: speeds out from each barrel, then from whatever is left (to find the jams of gears no barrel drives)
  const omega = Array(n * SLOTS).fill(null), dir = new Int8Array(n * SLOTS).fill(-1), trainOf = new Int8Array(n * SLOTS).fill(-1);
  const seen = new Uint8Array(n * SLOTS), parent = new Int32Array(n * SLOTS).fill(-1), depth = new Int32Array(n * SLOTS), w = new Map();
  const jam = new Set(), loops = [], driven = new Set(), order = [], orders = [], tangle = [], tangleKey = new Set();
  const flood = (start, train) => {
    const q = [start], mine = [], trainsMet = new Set();
    seen[start] = 1; w.set(start, F.ONE); depth[start] = 0;
    for (let h = 0; h < q.length; h++) {
      const u = q[h], wu = w.get(u), gu = G(u);
      if (train >= 0) { omega[u] = wu; dir[u] = wu[0] > 0 ? 0 : 1; trainOf[u] = train; if (!driven.has(gu.c)) { driven.add(gu.c); order.push(gu.c); mine.push(gu.c); } }
      if (gu.fixed) trainsMet.add(gu.train);
      for (const e of adj.get(u) || []) {
        const gv = G(e.v), ratio = [gu.n, gv.n];
        const wv = e.kind === "mesh" ? F.neg(F.mul(wu, ratio)) : e.kind === "ring" ? F.mul(wu, ratio) : wu;
        if (!seen[e.v]) { seen[e.v] = 1; w.set(e.v, wv); parent[e.v] = u; depth[e.v] = depth[u] + 1; q.push(e.v); continue; }
        if (F.eq(w.get(e.v), wv)) continue;
        // two speeds for one wheel: the loop through the tree between u and v is locked
        const loop = new Set([u, e.v]);
        let a = u, b = e.v;
        while (a !== b) { if (depth[a] >= depth[b]) { a = parent[a]; loop.add(a); } else { b = parent[b]; loop.add(b); } }
        for (const g of loop) jam.add(g);
        loops.push({ gears: [...loop], why: F.sign(w.get(e.v)) !== F.sign(wv) ? "turn" : "bind" });
      }
    }
    if (trainsMet.size > 1) {
      const t = [...trainsMet].sort((a, b) => a - b);
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (!tangleKey.has(`${t[i]},${t[j]}`)) { tangleKey.add(`${t[i]},${t[j]}`); tangle.push([t[i], t[j]]); }
    }
    return { q, mine };
  };
  for (const t of L.trains) {
    const id = t.barrel.c * SLOTS;
    if (idx[id] < 0) continue;
    if (seen[id]) { orders.push([]); continue; }
    orders.push(flood(id, t.index).mine);
  }
  for (const g of gears) if (!seen[g.id]) flood(g.id, -1);
  // 11 Nov 2026, Korbi: "when the earlier part of the train is jammed, the later part should not be moving. it should also be jittering,
  // but not red highlighted." A jam locks every wheel joined to it, before and after: LOCKED holds them all (the jam's own wheels too).
  const locked = new Set(jam), stack = [...jam];
  while (stack.length) for (const e of adj.get(stack.pop()) || []) if (!locked.has(e.v)) { locked.add(e.v); stack.push(e.v); }
  return { gears, idx, edges, omega, dir, jam, locked, loops, clash, tangle, driven, order, orders, trainOf, shapes, adj };
}
export const speeds = (L, laid) => { const M = mesh(L, laid); return { omega: M.omega, dir: M.dir }; };
export function jams(L, laid) {
  const M = mesh(L, laid);
  return { gears: M.jam, loops: M.loops.map(l => l.gears) };
}

// ---------- trains, goals, the whole check ----------
const comps = (L, M) => {
  const out = [];
  const add = (c, f, tr, goal) => {
    if (!goal) return;
    const id = c * SLOTS + goal.w, has = M.omega[id], want = goal.speed;
    let status = "ok";
    if (!has) status = "off";
    else if (goal.dir !== null && M.dir[id] !== goal.dir) status = "wrong";
    else if (want) { const k = F.cmp(F.abs(has), want); status = k === 0 ? "ok" : k < 0 ? "slow" : "fast"; }
    out.push({ train: tr, c, w: goal.w, type: goal.type, status, has: has ? F.abs(has) : null, want, dir: has ? M.dir[id] : null, wantDir: goal.dir });
  };
  for (const t of L.trains) add(t.sink.c, L.fixed[t.sink.c], t.index, t.goal);
  for (const p of L.pins) add(p.c, L.fixed[p.c], p.train, p.goal);
  return out;
};

/** The path of one train: the squares from its barrel to its sink, every square of the train once, each consecutive pair meshing (a
 *  piece is entered and left by wheels of one component), or null. */
function trainPath(L, M, t, cells) {
  const total = cells.size, sink = t.sink.c, seen = new Set(), out = [];
  const exits = new Map();
  for (const e of M.edges) {
    if (e.kind !== "mesh") continue;
    const a = M.gears[M.idx[e.u]], b = M.gears[M.idx[e.v]];
    if (a.c === b.c) continue;
    for (const [x, y] of [[a, b], [b, a]]) { if (!exits.has(x.c)) exits.set(x.c, []); exits.get(x.c).push({ from: x.i, to: y.c, toI: y.i }); }
  }
  const go = (c, entryI) => {
    seen.add(c); out.push(c);
    if (c === sink) { if (seen.size === total) return true; seen.delete(c); out.pop(); return false; }
    const comp = M.shapes[c].comp;
    for (const e of exits.get(c) || []) {
      if (!cells.has(e.to) || seen.has(e.to) || comp[e.from] !== comp[entryI] || (c === t.barrel.c && false)) continue;
      if (go(e.to, e.toI)) return true;
    }
    seen.delete(c); out.pop();
    return false;
  };
  return go(t.barrel.c, 0) ? out.slice() : null;
}
export function trains(L, laid, M = mesh(L, laid)) {
  return L.trains.map(t => {
    const cells = new Set();
    for (const g of M.gears) if (M.trainOf[g.id] === t.index) cells.add(g.c);
    const path = cells.has(t.sink.c) ? trainPath(L, M, t, cells) : null;
    const cm = comps(L, M).find(x => x.train === t.index && x.c === t.sink.c);
    return { id: t.id, index: t.index, cells: [...cells], path, order: M.orders[t.index] || [], sink: { status: cm ? cm.status : "off", c: t.sink.c } };
  });
}
export const complications = (L, laid) => comps(L, mesh(L, laid));
export const walk = (L, laid) => trains(L, laid).flatMap(t => t.path || []);

const speedWord = (f, glyph = true) => `×${F.fmt(f, glyph)}`;
/**
 * How the level stands. { solved, placed, left, strays (laid squares nothing drives), missed (pinned squares their barrel does not
 * drive), jams (squares), clashes [[u, v]], tangles [[trainA, trainB]], trains, comps, clicks { square: "ok" | "bad" | "" }, clicksOk,
 * messages [string] (what to fix, most urgent first), nearest { c, text } | null, M }.
 */
export function check(L, laid) {
  const M = mesh(L, laid), placed = laidCount(laid), left = L.total - placed;
  const strays = [], missed = [];
  laid.forEach((p, c) => { if (p && !M.shapes[c].wheels.some((_, i) => M.omega[c * SLOTS + i])) strays.push(c); });
  for (const p of L.pins) if (!M.driven.has(p.c) || M.trainOf[p.c * SLOTS] !== p.train) missed.push(p.c);
  const jamSquares = [...new Set([...M.jam].map(g => Math.floor(g / SLOTS)))];
  const cm = comps(L, M), tr = trains(L, laid, M);
  const clicks = {};
  let clicksOk = true;
  for (const k of L.clicks) {
    const has = M.dir[k.c * SLOTS];
    clicks[k.c] = !laid[k.c] || has < 0 ? "" : has === k.dir ? "ok" : "bad";
    if (clicks[k.c] !== "ok") clicksOk = false;
  }
  const messages = [];
  let nearest = null;
  const say = (text, c) => { messages.push(text); if (!nearest) nearest = { c: c ?? null, text }; };
  const sqOf = id => Math.floor(id / SLOTS);
  if (M.clash.length) say("These wheels clash: teeth of two sizes on one layer. Change a piece or leave a gap", sqOf(M.clash[0][0]));
  for (const [a, b] of M.tangle) say(`${L.trains[a].id} touches ${L.trains[b].id}: two trains must not mesh, even at the same pitch. Leave a gap`, null);
  if (M.loops.length) {
    const l = M.loops[0];
    say(l.why === "bind" ? "These gears bind: the tooth ratios round this loop do not multiply to 1" : "Jam: these gears would have to turn both ways", sqOf(l.gears[0]));
  }
  for (const k of L.clicks) if (clicks[k.c] === "bad") say(`The click on this gear bites: it turns ${WAYS[M.dir[k.c * SLOTS]]} and must turn ${WAYS[k.dir]}`, k.c);
  for (const x of cm) {
    const name = L.trains[x.train].id;
    if (x.status === "wrong") say(`${name} turns ${WAYS[x.dir]} and wants ${WAYS[x.wantDir]}: add or drop a duo`, x.c);
    else if (x.status === "fast") say(`${name} is ${speedWord(x.has)} and wants ${speedWord(x.want)}: too fast`, x.c);
    else if (x.status === "slow") say(`${name} is ${speedWord(x.has)} and wants ${speedWord(x.want)}: too slow`, x.c);
  }
  if (!left) {
    if (strays.length) say(`${strays.length} piece${strays.length > 1 ? "s" : ""} no barrel drives`, strays[0]);
    if (missed.length) say("The train misses a pinned piece", missed[0]);
    for (const t of tr) if (!t.path && !messages.length) say(`Every piece must sit on one train, from barrel ${t.id} to its sink`, null);
  }
  const clean = !M.clash.length && !M.tangle.length && !M.loops.length;
  const solved = !left && clean && !strays.length && !missed.length && tr.every(t => t.path) && cm.every(x => x.status === "ok") && clicksOk;
  return { solved, placed, left, strays, missed, jams: jamSquares, clashes: M.clash, tangles: M.tangle, trains: tr, comps: cm, clicks, clicksOk, messages, nearest, M };
}

// ---------- hint, stars ----------
const canon = p => { if (!p) return p; const { kind, rot } = pieceOf(p); return pieceStr(kind, canonRot(kind, rot)); };
/** What a hint says: the listed answer that agrees best with the pieces laid. If some piece laid is not in it, those squares: { wrong:
 *  [c…] }; otherwise the first square along the trains still to be laid and its piece: { c, piece: "kind@rot" }; or { done: true }. */
export function hintFor(L, laid) {
  let best = null;
  for (const sol of L.sols) {
    const wrong = [], agree = [];
    laid.forEach((p, c) => { if (p) (canon(sol[c]) === canon(p) ? agree : wrong).push(c); });
    if (!best || wrong.length < best.wrong.length || (wrong.length === best.wrong.length && agree.length > best.agree.length)) best = { sol, wrong, agree };
  }
  if (!best) return null;
  if (best.wrong.length) return { wrong: best.wrong };
  const next = walk(L, best.sol).find(c => !L.fixed[c] && !laid[c]);
  return next !== undefined ? { c: next, piece: best.sol[next] } : { done: true };
}
/** The stars a finished level earns: 1 for solving it, 2 without a hint, 3 for that and few corrections (a lift, a move, a turn of a piece laid). */
export function starsFor(L, { hints = 0, lifts = 0 }) {
  if (hints) return 1;
  return lifts <= STAR_LIFTS + Math.floor(L.total / 6) ? 3 : 2;
}

// ---------- the pictures: tooth phases and the clock ----------
/**
 * The angle (degrees) of every wheel (by gear id, NaN for no wheel) so that where two mesh a tooth lies in a gap: from each barrel
 * outwards, each wheel from the one it was reached by; a rigid link copies the angle. A loop that does not close exactly leaves a pair a
 * little out: a picture, never a rule.
 */
export function phasesOf(L, M) {
  const phase = new Float64Array(L.size * SLOTS).fill(NaN), G = id => M.gears[M.idx[id]];
  const run = start => {
    phase[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const u = q[h], gu = G(u);
      for (const e of M.adj.get(u) || []) {
        if (!Number.isNaN(phase[e.v])) continue;
        const gv = G(e.v);
        if (e.kind === "rigid") phase[e.v] = phase[u];
        else {
          const pu = 360 / gu.n, pv = 360 / gv.n, theta = Math.atan2(gv.y - gu.y, gv.x - gu.x) * 180 / Math.PI;
          if (e.kind === "ring") {
            const toward = theta + 180, fu = ((((toward - phase[u]) / pu) % 1) + 1) % 1;
            phase[e.v] = toward - pv * (((fu + 0.5) % 1 + 1) % 1);
          } else {
            const fu = ((((theta - phase[u]) / pu) % 1) + 1) % 1, fv = ((0.5 - fu) % 1 + 1) % 1;
            phase[e.v] = theta + 180 - pv * fv;
          }
        }
        q.push(e.v);
      }
    }
  };
  for (const t of L.trains) if (M.idx[t.barrel.c * SLOTS] >= 0) run(t.barrel.c * SLOTS);
  for (const g of M.gears) if (Number.isNaN(phase[g.id])) run(g.id);
  return phase;
}
/** Milliseconds per turn of a barrel: the fastest wheel turns in at least 1.6 s and the slowest in at most 90 s where both can hold. */
export function tempo(L, M) {
  let hi = 1, lo = 1;
  for (const g of M.gears) { const w = M.omega[g.id]; if (!w) continue; const a = F.num(F.abs(w)); if (a > hi) hi = a; if (a < lo) lo = a; }
  return Math.max(1600 * hi, Math.min(6000, 90000 * lo));
}

// ---------- the plan and the frame (pipes-gear-fixture.js; docs/pipes-contract.md) ----------
/** The level as the views draw it once: the plate and its trains. */
export function planOf(L, theme = null) {
  return {
    id: L.id, name: L.name, cols: L.cols, rows: L.rows, rotate: L.rotate, theme,
    terrain: Array.from({ length: L.size }, (_, c) => (L.void[c] ? "void" : L.cap[c] === 0 ? "pillar" : L.cap[c] < 3 ? `bridge${L.cap[c]}` : "ground")),
    cap: Array.from(L.cap),
    trains: L.trains.map(t => ({ id: t.id, index: t.index, barrel: { ...t.barrel }, sink: { ...t.sink, goal: t.goal } })),
    pins: L.pins.map(p => ({ c: p.c, kind: p.kind, rot: p.rot, train: p.train, goal: p.goal })),
    clicks: L.clicks.map(k => ({ ...k })),
  };
}
/** The frame a view draws (docs/pipes-contract.md): everything dynamic. */
export function frameOf(L, laid, extra = {}) {
  const res = check(L, laid), M = res.M;
  return { laid: laid.slice(), M, res, T0: tempo(L, M), phase: phasesOf(L, M), held: null, ghost: null, hint: null, focus: null, solved: res.solved, look: false, ...extra };
}

// ---------- the workings: what the train does, for the strip under the board ----------
/**
 * For each train, the steps along its path that matter: [{ c, type: "barrel" | "step" | "station" | "sink", factor (the tooth rate over the
 * rate before it, when it is not 1), comp (the goal's status, for a station or a sink) }]. A train with no path (not yet joined up) lists
 * what is known: its barrel and its sink.
 */
export function workings(L, res) {
  const M = res.M, rate = id => { const w = M.omega[id]; return w ? F.mul(F.abs(w), [M.gears[M.idx[id]].n, 1]) : null; };
  const side = (c, other) => {
    for (const e of M.edges) {
      if (e.kind !== "mesh") continue;
      const a = M.gears[M.idx[e.u]], b = M.gears[M.idx[e.v]];
      if (a.c === c && b.c === other) return a.id;
      if (b.c === c && a.c === other) return b.id;
    }
    return -1;
  };
  return L.trains.map(t => {
    const path = res.trains[t.index].path, items = [{ c: t.barrel.c, type: "barrel", n: t.barrel.n }];
    if (path) path.forEach((c, i) => {
      if (i === 0 || L.fixed[c]?.k === "sink") return;
      const inId = side(c, path[i - 1]), outId = side(c, path[i + 1]);
      let factor = null;
      if (inId >= 0 && outId >= 0) { const a = rate(inId), b = rate(outId); if (a && b) { const k = F.div(b, a); if (!F.eq(k, F.ONE)) factor = k; } }
      const comp = res.comps.find(x => x.c === c && x.train === t.index) || null;
      if (comp) items.push({ c, type: "station", factor, comp });
      else if (factor) items.push({ c, type: "step", factor });
    });
    items.push({ c: t.sink.c, type: "sink", comp: res.comps.find(x => x.c === t.sink.c && x.train === t.index) || null });
    return { id: t.id, index: t.index, items };
  });
}
