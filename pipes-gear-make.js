// Gears: the generator (4 November 2026). It draws one self-avoiding route per train across an empty plate (all disjoint), gives each hop a
// piece from the recipe's palette whose ports fit the way in and the way out and whose entry wheel is of the channel (module, layer) the
// last wheel left in, reads each sink's speed off the train it drew (choosing the sink's tooth count so the speed is a small fraction),
// takes the hand from the pieces, and then adds pillars, bridges, pinned pieces and clicks until the solver finds at most `maxSols`
// answers, and takes away whichever of them the answers don't need. Used to write the level files (pipes-gear-pick.mjs); no page loads it.
import { rng, mix } from "./pipes-pieces.js";
import * as F from "./pipes-gear-frac.js";
import { CATALOG, parseKind, shapeOf, orientations, back, SIDE, topLayer, radius } from "./pipes-gear-shapes.js";
import { parseLevel, check, beyond, pieceStr, pieceOf, SLOTS, keyOf, discVoid } from "./pipes-gear-engine.js";
import { solve } from "./pipes-gear-solve.js";

const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffled = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** The kinds a recipe may use: { mods: [4,5], layers: [1,2], fams: { S: 3, D: 3, T: 1, K: 1, R: 1 } (weights), ratio: [lo, hi] a duo's or stack's ratio } filtered from the catalogue. */
export function paletteOf(pal) {
  const cat = CATALOG(), out = [];
  for (const [fam, weight] of Object.entries(pal.fams)) {
    for (const kind of cat[fam]) {
      const p = parseKind(kind);
      if (fam === "K") { if (!(pal.mods.includes(p.m1) && pal.mods.includes(p.m2) && pal.layers.includes(p.l1) && pal.layers.includes(p.l2))) continue; }
      else if (fam === "R") { if (!(pal.mods.includes(p.m1) && pal.mods.includes(p.m2) && pal.layers.includes(p.l1) && pal.layers.includes(p.l2))) continue; }
      else if (!pal.mods.includes(p.m) || !pal.layers.includes(p.l)) continue;
      if (pal.only && !pal.only(kind, p)) continue;
      out.push({ kind, fam, weight });
    }
  }
  return out;
}
/** A straight piece whose two ends are alike: laid either way round it is one answer (an unlike pair doubles the answers for nothing, in a train whose speeds the pieces do not change). */
const sameEnds = kind => { const sh = shapeOf(kind, 0), ns = sh.ports.map(q => sh.wheels[q.w].n); return ns[0] === ns[1]; };
const templates = new Map();
const rotsOf = kind => { if (!templates.has(kind)) templates.set(kind, orientations(kind).map(r => ({ rot: r, shape: shapeOf(kind, r) }))); return templates.get(kind); };

/** A random route of n squares: { passes: [{ c, a, b }] (a the side of the square it comes in by, b the side it leaves by), barrel: { c, side }, sink: { c, side } } or null. */
function drawRoute(L0, n, r, blocked, bends = 0, touch = false) {
  const free = c => !blocked.has(c);
  const s = Math.floor(r() * L0.size), d0 = Math.floor(r() * 4);
  if (!free(s)) return null;
  const first = beyond(L0, s, d0);
  if (first < 0 || !free(first)) return null;
  const passes = [], used = new Set([s]);
  let tries = 0;
  const bendsNow = () => passes.reduce((k, p) => k + (p.b !== back(p.a) ? 1 : 0), 0);
  const adj = c => [0, 1, 2, 3].map(d => beyond(L0, c, d)).filter(x => x >= 0);
  function walk(c, a) {
    if (++tries > 3000) return false;
    used.add(c);
    for (const b of shuffled([0, 1, 2, 3].filter(x => x !== a), r)) {
      const next = beyond(L0, c, b);
      if (next < 0 || used.has(next) || !free(next)) continue;
      if (!touch && adj(next).some(x => x !== c && used.has(x))) continue;
      passes.push({ c, a, b });
      if (passes.length === n) { if (bendsNow() >= bends) return true; }
      else if (walk(next, back(b))) return true;
      passes.pop();
    }
    used.delete(c);
    return false;
  }
  if (!walk(first, back(d0))) return null;
  const last = passes[n - 1], sinkC = beyond(L0, last.c, last.b);
  if (sinkC < 0 || used.has(sinkC) || !free(sinkC)) return null;
  return { passes, barrel: { c: s, side: d0 }, sink: { c: sinkC, side: back(last.b) } };
}

/** Pieces for a route: [{ kind, rot, exitW, ... }] and the channel and speed it ends in, or null. */
function dress(route, tr, palette, r) {
  const out = [];
  let m = tr.m, l = tr.l, n = tr.barrelN, w = F.ONE;
  const total = route.passes.length;
  for (let i = 0; i < total; i++) {
    const p = route.passes[i], cand = [];
    for (const { kind, fam, weight } of palette) {
      for (const { rot, shape } of rotsOf(kind)) {
        for (const q of shape.ports) {
          const wh = shape.wheels[q.w];
          if (q.s !== p.a || wh.m !== m || wh.l !== l) continue;
          for (const q2 of shape.ports) {
            if (q2.s !== p.b || shape.comp[q2.w] !== shape.comp[q.w]) continue;
            const ex = shape.wheels[q2.w];
            if (i === total - 1 && tr.end && ((tr.end.m !== undefined && ex.m !== tr.end.m) || (tr.end.l !== undefined && ex.l !== tr.end.l))) continue;
            cand.push({ kind, fam, rot, shape, entry: q.w, exit: q2.w, weight });
          }
        }
      }
    }
    if (!cand.length) return null;
    // weighted choice, with a pull towards the family the recipe wants more of (tr.want[fam]) and away from pieces already used often
    const tot = cand.reduce((s, c) => s + c.weight, 0);
    let x = r() * tot, c = cand[0];
    for (const k of cand) { x -= k.weight; if (x <= 0) { c = k; break; } }
    const fac = F.mk(1);
    void fac;
    const e = c.shape.wheels[c.entry], ex = c.shape.wheels[c.exit];
    // speed of the entry wheel from the last wheel, then along the piece to the exit wheel
    const wEntry = F.neg(F.mul(w, F.mk(n, e.n)));
    const wExit = pieceSpeed(c.shape, c.entry, c.exit, wEntry);
    out.push({ ...c, pass: p, wEntry, wExit });
    w = wExit; m = ex.m; l = ex.l; n = ex.n;
  }
  return { pieces: out, m, l, n, w };
}
function pieceSpeed(sh, from, to, w) {
  // through the piece: meshes flip and scale, arbors keep
  const sp = Array(sh.wheels.length).fill(null);
  sp[from] = w;
  for (let k = 0; k < sh.wheels.length * 2; k++) {
    for (const [u, v] of sh.mesh) {
      if (sp[u] && !sp[v]) sp[v] = F.neg(F.mul(sp[u], F.mk(sh.wheels[u].n, sh.wheels[v].n)));
      if (sp[v] && !sp[u]) sp[u] = F.neg(F.mul(sp[v], F.mk(sh.wheels[v].n, sh.wheels[u].n)));
    }
    sh.wheels.forEach((a, i) => sh.wheels.forEach((b, j) => { if (i !== j && a.a === b.a && sp[i] && !sp[j]) sp[j] = sp[i]; }));
  }
  return sp[to];
}

const niceSpeed = f => f[0] !== 0 && Math.abs(f[0]) <= 16 && f[1] <= 16 && F.num(F.abs(f)) >= 1 / 16 && F.num(F.abs(f)) <= 8;

/**
 * Makes a level from the seed, or null when the seed gives nothing. o: {
 *   cols, rows, maxSols (answers allowed, at most 6),
 *   trains: [{ m, l (the barrel's channel), pieces (squares of the route), bends, palette (see paletteOf), end: { m, l } | null, goal: { type }, sinkMods?, pins: count of stations }],
 *   extras: { pillars: n, bridges: n, pins: n, clicks: n } the most of each to add, limit: solver limit }
 */
export const WHY = {};
export function makeLevel(seed, o) {
  const no = k => { WHY[k] = (WHY[k] || 0) + 1; return null; };
  const r = rng(mix(seed, 177)), L0 = { cols: o.cols, rows: o.rows, size: o.cols * o.rows };
  const gone = o.disc ? discVoid(o.cols) : new Set(), blocked = new Set(gone), routes = [];
  for (const t of o.trains) {
    let R = null;
    const near = new Set();
    for (const c of blocked) if (!gone.has(c)) for (let d = 0; d < 4; d++) { const x = beyond(L0, c, d); if (x >= 0) near.add(x); }
    for (let k = 0; k < 60 && !R; k++) R = drawRoute(L0, t.pieces, r, k < 40 ? new Set([...blocked, ...near]) : blocked, t.bends || 0, !!o.touch);
    if (!R) return no(1);
    // keep the trains' squares apart: the barrel, the route and the sink are taken, and so is the ring of squares round the barrel and sink
    for (const p of R.passes) blocked.add(p.c);
    blocked.add(R.barrel.c); blocked.add(R.sink.c);
    routes.push(R);
  }
  // the route squares of another train must not touch this train's barrel or sink end-on: check() rejects what meshes, but cheaply refuse the obvious
  const dressed = [];
  for (let i = 0; i < o.trains.length; i++) {
    const t = o.trains[i], pal = t.paletteList || (t.paletteList = paletteOf(t.palette));
    const tr = { ...t, barrelN: t.barrelN || Math.round(45 / t.m) };
    let d = null;
    // a few kinds per train, not the whole catalogue: a hand of all different pieces has a factorial of ways to lay them along a route.
    // The hand is a skeleton: a straight kind for the straights, an elbow kind for the bends, a wildcard single now and then, and the
    // stacks or risers the recipe asks for.
    const chanKey = p => { const q = parseKind(p.kind); return `${q.m}.${q.l}`; };
    const chans = [...new Set(pal.filter(p => p.fam !== "K" && p.fam !== "R").map(chanKey))];
    const by = (ch, f) => pal.filter(p => f(p) && chanKey(p) === ch);
    const comp = pal.filter(p => p.fam === "K" || p.fam === "R");
    for (let k = 0; k < 60 && !d; k++) {
      const sub = [];
      for (const ch of chans) {
        const straight = by(ch, p => (p.fam === "D" || p.fam === "T") && !p.kind.endsWith("e") && (t.asym || sameEnds(p.kind)));
        const elbow = by(ch, p => (p.fam === "D" || p.fam === "T") && p.kind.endsWith("e"));
        const nst = 1 + (r() < (t.variety ?? 0.3) ? 1 : 0), nel = 1 + (r() < (t.variety ?? 0.3) ? 1 : 0);
        for (let q = 0; q < nst && straight.length; q++) sub.push(pick(r, straight));
        for (let q = 0; q < nel && elbow.length; q++) sub.push(pick(r, elbow));
        if (r() < (t.singles ?? 0.25)) sub.push(...by(ch, p => p.fam === "S"));
      }
      if (t.stacks && comp.length) { const filtered = t.stackOnly ? comp.filter(p => t.stackOnly(p.kind)) : comp; for (let q = 0; q < t.stacks && filtered.length; q++) sub.push({ ...pick(r, filtered), weight: t.stackWeight ?? 4 }); }
      d = dress(routes[i], tr, sub, r);
      const nComp = d ? d.pieces.filter(p => p.fam === "K" || p.fam === "R").length : 0;
      if (d && (nComp < (t.minStacks ?? (t.stacks ? 1 : 0)) || nComp > (t.maxStacks ?? 99))) d = null;
    }
    if (!d) return no(2);
    // the sink's tooth count: a speed that is a small fraction (a train of plain pieces keeps the tooth rate, so its sink asks only for a turn)
    const ring = !!t.goal?.ring, compound = ring || d.pieces.some(p => p.fam === "K" || p.fam === "R");
    let sinkN, wSink, barrelN = tr.barrelN;
    const bs = { 4: [10, 11, 12], 5: [8, 9, 10, 11], 6: [7, 8, 9] }[t.m];
    if (ring || compound) {
      // the barrel's and the sink's tooth counts that make the goal the smallest fraction
      const opts = [];
      for (const b of bs) for (const n of ring ? [4, 5, 6, 7].filter(x => radius(d.m, x) <= 20) : Array.from({ length: Math.floor(60 / d.m) - 3 }, (_, k) => k + 4)) {
        const scaled = F.mul(d.w, F.mk(b, tr.barrelN)), w = ring ? F.neg(F.mul(scaled, F.mk(d.n, Math.round(60 / d.m)))) : F.neg(F.mul(scaled, F.mk(d.n, n)));
        if (niceSpeed(w)) opts.push({ b, n, w, score: Math.abs(w[0]) + w[1] + r() * 2 });
      }
      if (!opts.length) return no(3);
      opts.sort((p, q) => p.score - q.score);
      if (opts[0].score > (t.maxScore ?? 12)) return no(3);
      ({ b: barrelN, n: sinkN, w: wSink } = opts[0]);
      const k = F.mk(barrelN, tr.barrelN);
      for (const p of d.pieces) { p.wEntry = F.mul(p.wEntry, k); p.wExit = F.mul(p.wExit, k); }
    } else { sinkN = Math.round(45 / d.m); wSink = F.neg(F.mul(d.w, F.mk(d.n, sinkN))); }
    dressed.push({ ...d, sinkN, wSink, compound, ring, barrelN });
  }
  const spec = {
    id: `g${seed}`, name: "", chapter: o.chapter || "z", cols: o.cols, rows: o.rows, rotate: true,
    map: Array.from({ length: o.rows }, (_, y) => Array.from({ length: o.cols }, (__, x) => (gone.has(y * o.cols + x) ? " " : ".")).join("")), hand: "", sols: [], pins: [], clicks: [],
    trains: o.trains.map((t, i) => ({
      id: "ABC"[i], barrel: { c: routes[i].barrel.c, side: SIDE[routes[i].barrel.side], m: t.m, l: t.l, n: dressed[i].barrelN },
      sink: { c: routes[i].sink.c, side: SIDE[routes[i].sink.side], m: dressed[i].m, l: dressed[i].l, n: dressed[i].sinkN,
        goal: { type: t.goal?.type || (dressed[i].compound ? "wheel" : "dial"), ...(dressed[i].compound ? { speed: F.fmt(F.abs(dressed[i].wSink)) } : {}), dir: dressed[i].wSink[0] > 0 ? "cw" : "ccw", ...(dressed[i].ring ? { ring: true } : {}) } },
    })),
  };
  const wanted = {}, handCount = {};
  routes.forEach((R, ti) => {
    const t = o.trains[ti], ps = dressed[ti].pieces;
    const at = shuffled(ps.map((_, i) => i).filter(i => i > 0 && i < ps.length - 1), r).slice(0, t.stations || 0);
    for (const i of at) {
      const p = ps[i];
      spec.pins.push({ c: p.pass.c, kind: p.kind, rot: p.rot, train: ti, goal: { type: t.stationType || "wheel", w: p.entry, ...(dressed[ti].compound ? { speed: F.fmt(F.abs(p.wEntry)) } : {}), dir: p.wEntry[0] > 0 ? "cw" : "ccw" } });
    }
  });
  dressed.forEach((d, ti) => d.pieces.forEach((p, i) => { wanted[p.pass.c] = pieceStr(p.kind, p.rot); }));
  const counts = () => {
    const h = {};
    for (const p of Object.values(wanted)) { const k = pieceOf(p).kind; h[k] = (h[k] || 0) + 1; }
    for (const p of spec.pins) h[p.kind] -= 1;
    return Object.entries(h).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(" ");
  };
  void handCount;
  spec.sols = [wanted];
  spec.hand = counts();
  const setMap = (c, ch) => { const y = Math.floor(c / o.cols), x = c % o.cols, row = spec.map[y]; spec.map[y] = row.slice(0, x) + ch + row.slice(x + 1); };
  const build = () => { spec.hand = counts(); return parseLevel(spec); };
  let L = build();
  const wantedLaid = L.sols[0];
  // the drawn train must itself be a solution (the check catches an accidental mesh, a clash, a tangle)
  const laidNow = () => { const a = Array(L.size).fill(null); for (const [c, p] of Object.entries(wanted)) if (!spec.pins.some(q => q.c === Number(c))) a[c] = p; return a; };
  if (!check(L, laidNow()).solved) return no(4);
  void wantedLaid;
  if (o.drawOnly) return { spec, L };
  const maxSols = Math.min(6, o.maxSols || 1), limit = o.limit || 4e5, ex = o.extras || {}, target = o.nodes || 2000;
  const key = a => a.map(p => p || "").join(",");
  const mine = key(laidNow());
  const added = { pins: [], bridges: [], clicks: [] };
  const fixedPins = spec.pins.map(p => p.c);
  const routeSquares = new Set(Object.keys(wanted).map(Number));
  const ends = new Set(spec.trains.flatMap(t => [t.barrel.c, t.sink.c]));
  const settled = s => !s.aborted && s.sols.length <= maxSols;
  const solveL = () => solve(L, maxSols + 1, limit);
  // stage 1: a plate of pillars with only the routes open, where the answers are few and the solver is quick; pins, clicks and bridges
  // are added until at most maxSols remain
  const free = [];
  for (let c = 0; c < L.size; c++) if (!routeSquares.has(c) && !ends.has(c) && !gone.has(c)) { setMap(c, "#"); free.push(c); }
  L = build();
  for (let guard = 0; guard < 40; guard++) {
    const s = solveL();
    if (s.aborted) return no(5);
    if (settled(s)) break;
    const alt = pick(r, s.sols.filter(x => key(x.laid) !== mine)).laid;
    const opts = [];
    alt.forEach((p, c) => {
      if (!p || ends.has(c) || L.fixed[c]) return;
      const w = wanted[c];
      if (w && w !== p) {
        if (added.pins.length < (ex.pins ?? 0)) opts.push(["pin", c]);
        const wt = topLayer(pieceOf(w).kind), at = topLayer(pieceOf(p).kind);
        if (at > wt && L.cap[c] === 3 && wt < 3 && added.bridges.length < (ex.bridges ?? 0)) opts.push(["bridge", c]);
      }
      if (w && pieceOf(w).kind.startsWith("S") && w !== p && added.clicks.length < (ex.clicks ?? 0) && L.click[c] < 0) opts.push(["click", c]);
    });
    if (!opts.length) return no(6);
    const [what, c] = pick(r, opts);
    if (what === "bridge") { setMap(c, String(topLayer(pieceOf(wanted[c]).kind))); added.bridges.push(c); }
    else if (what === "pin") {
      const { kind, rot } = pieceOf(wanted[c]), ti = routes.findIndex(R => R.passes.some(p => p.c === c));
      if (fixedPins.includes(c)) continue;
      spec.pins.push({ c, kind, rot, train: ti }); added.pins.push(c);
      spec.clicks = spec.clicks.filter(k => k.c !== c); added.clicks = added.clicks.filter(x => x !== c);
    } else {
      const res = check(L, laidNow());
      spec.clicks.push({ c, dir: res.M.dir[c * SLOTS] ? "ccw" : "cw" }); added.clicks.push(c);
    }
    L = build();
  }
  let fin = solveL();
  if (!settled(fin) || !fin.sols.some(x => key(x.laid) === mine)) return no(7);
  // stage 2: pillars come out, in random order, while the answers stay few and the solver's work stays under the level's target
  let work = fin.nodes, pillars = free.slice();
  for (const c of shuffled(free, r)) {
    setMap(c, ".");
    const t = build(), s = solve(t, maxSols + 1, Math.max(limit, target * 3));
    if (settled(s) && s.nodes <= target) { pillars.splice(pillars.indexOf(c), 1); L = t; work = s.nodes; fin = s; } else setMap(c, "#");
  }
  // stage 3: whatever else the answers don't need goes again
  const tryDrop = (list, take, put) => {
    for (const c of shuffled(list.slice(), r)) {
      const undo = take(c), t = build();
      if (settled(solve(t, maxSols + 1, limit))) { list.splice(list.indexOf(c), 1); L = t; } else undo();
    }
  };
  tryDrop(added.bridges, c => { const was = spec.map[Math.floor(c / o.cols)][c % o.cols]; setMap(c, "."); return () => setMap(c, was); });
  tryDrop(added.pins, c => { const i = spec.pins.findIndex(p => p.c === c), pin = spec.pins.splice(i, 1)[0]; return () => spec.pins.splice(i, 0, pin); });
  tryDrop(added.clicks, c => { const i = spec.clicks.findIndex(p => p.c === c), k = spec.clicks.splice(i, 1)[0]; return () => spec.clicks.splice(i, 0, k); });
  L = build();
  fin = solve(L, maxSols + 1, Math.max(limit, target * 3));
  if (!settled(fin)) return no(8);
  spec.sols = fin.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)));
  const fams = {};
  for (const d of dressed) for (const p of d.pieces) fams[parseKind(p.kind).f] = (fams[parseKind(p.kind).f] || 0) + 1;
  return { spec, L, nodes: fin.nodes, work, sols: fin.sols.length, extras: { pillars: pillars.length, bridges: added.bridges.length, pins: added.pins.length, clicks: added.clicks.length }, fams, dressed, routes };
}
export { keyOf };
