// Gears: the solver that proves a level has its answers (and how many). It lays the trains one after the other: from a barrel it tries, at
// every square, each piece of the hand (in each distinct turn) that takes the power in through a wheel of the channel (module, layer)
// the last wheel left in, tracks every wheel's speed as a fraction, and checks as it goes what the rules check at the end: a wheel facing
// another of one layer and another module clashes, a wheel meshing another train's tangles, two speeds for one wheel are a jam or a bind,
// a click wants its turn, a station or a sink wants its speed and turn. A walk that uses the whole hand and every pinned piece and ends in
// every sink is confirmed by the full check() before it counts. Used by the generator and by tests; no page loads it.
import { shapeOf, orientations, topLayer, parseKind, back, radius } from "./pipes-gear-shapes.js";
import { check, beyond, pieceStr, pieceOf, SLOTS } from "./pipes-gear-engine.js";
import * as F from "./pipes-gear-frac.js";

const factorsOf = (sh, entry) => {
  // each wheel's speed over the entry wheel's, through the meshes, rings and arbors of the piece (null for another component)
  const fac = Array(sh.wheels.length).fill(null);
  fac[entry] = F.ONE;
  let more = true;
  while (more) {
    more = false;
    const set = (u, v, f) => { if (fac[u] && !fac[v]) { fac[v] = F.mul(fac[u], f); more = true; } };
    for (const [u, v] of sh.mesh) {
      set(u, v, F.neg(F.mk(sh.wheels[u].n, sh.wheels[v].n)));
      set(v, u, F.neg(F.mk(sh.wheels[v].n, sh.wheels[u].n)));
    }
    for (const [u, v] of sh.ring || []) { set(u, v, F.mk(sh.wheels[u].n, sh.wheels[v].n)); set(v, u, F.mk(sh.wheels[v].n, sh.wheels[u].n)); }
    sh.wheels.forEach((w, i) => sh.wheels.forEach((o, j) => { if (i !== j && w.a === o.a) set(i, j, F.ONE); }));
  }
  return fac;
};
const optCache = new Map();
/** The ways a hand key can be laid: [{ key, kind, rot, shape, top, single, fac (by entry wheel) }]. */
export function optionsOf(L, key) {
  const ck = `${L.rotate}|${key}`;
  if (optCache.has(ck)) return optCache.get(ck);
  const { kind, rot } = key.includes("@") ? pieceOf(key) : { kind: key, rot: 0 };
  const rots = key.includes("@") ? [rot] : orientations(kind);
  const out = rots.map(r => {
    const shape = shapeOf(kind, r);
    return { key, kind, rot: r, shape, piece: pieceStr(kind, r), top: topLayer(kind), single: parseKind(kind).f === "S", fac: shape.wheels.map((_, w) => (shape.ports.some(q => q.w === w) ? factorsOf(shape, w) : null)) };
  });
  optCache.set(ck, out);
  return out;
}

/**
 * Every answer of L, up to `cap`: { sols: [{ laid }], nodes, capped, aborted }. `limit` bounds the pieces tried (then aborted).
 * opts.parity false: do not prune by the parity of the distance.
 */
export function solve(L, cap = 2, limit = 4e6, opts = {}) {
  const n = L.size, keys = Object.keys(L.hand), hand = { ...L.hand };
  const opt = Object.fromEntries(keys.map(k => [k, optionsOf(L, k)]));
  const at = Array(n).fill(null);                       // { shape, spd, train, live }
  const laid = Array(n).fill(null);
  const sols = [], seen = new Set();
  let nodes = 0, aborted = false, left = L.total;
  const pinsLeft = L.trains.map(t => L.pins.filter(p => p.train === t.index).length);
  let pinsAll = L.pins.length;
  const dist = (a, b) => Math.abs((a % L.cols) - (b % L.cols)) + Math.abs(Math.floor(a / L.cols) - Math.floor(b / L.cols));
  const firsts = L.trains.map(t => beyond(L, t.barrel.c, t.barrel.side));
  if (firsts.some(f => f < 0)) return { sols, nodes: 0, capped: false, aborted: false };
  for (const f of L.fixed) void f;
  // the barrels are down from the start
  for (const t of L.trains) at[t.barrel.c] = { shape: L.fixed[t.barrel.c].shape, spd: [F.ONE], train: t.index, live: true };
  const spdOf = (wgear, goalDir) => (goalDir === null ? true : (wgear[0] > 0 ? 0 : 1) === goalDir);

  /** Whether the wheels of the piece `x` just given speeds `spd` at c sit right with every neighbour already down. */
  function contacts(c, x, train) {
    for (const q of x.shape.ports) {
      const d = beyond(L, c, q.s);
      if (d < 0) continue;
      const y = at[d] || L.fixed[d];
      if (!y) continue;
      const ysh = y.shape, w1 = x.shape.wheels[q.w];
      for (const q2 of ysh.ports) {
        if (q2.s !== back(q.s)) continue;
        const w2 = ysh.wheels[q2.w];
        if (w1.l !== w2.l) continue;
        if (w1.m !== w2.m) return false;                                   // clash
        const ytrain = y.train;
        if (ytrain !== train) return false;                                // tangle
        const live = at[d];
        if (!live || !live.live) continue;                                 // a pinned piece not reached yet: checked when it is
        const want = F.neg(F.mul(x.spd[q.w], F.mk(w1.n, w2.n)));
        if (!F.eq(want, live.spd[q2.w])) return false;                     // a jam or a bind
      }
    }
    return true;
  }
  /** Puts a piece down at c entered by wheel `entry` at speed `w0`; returns the record, or null if it does not fit. */
  function put(c, shape, fac, w0, train, fixed) {
    const spd = fac.map(f => (f ? F.mul(w0, f) : null));
    const x = { shape, spd, train, live: true };
    // a click wants its turn from the single laid on it
    if (L.click[c] >= 0 && !fixed && (spd[0][0] > 0 ? 0 : 1) !== L.click[c]) return null;
    if (fixed?.goal) {
      const g = fixed.goal, w = spd[g.w];
      if (!w) return null;
      if (g.dir !== null && (w[0] > 0 ? 0 : 1) !== g.dir) return null;
      if (g.speed && !F.eq(F.abs(w), g.speed)) return null;
    }
    at[c] = x;
    if (!contacts(c, x, train)) { at[c] = null; return null; }
    return x;
  }
  // which trains can use which hand key: a piece is usable by a train that can reach any channel (module, layer) of its ports, a stack or
  // riser joining the channels it links
  const chanOf = o => [...new Set(o.shape.ports.map(q => `${o.shape.wheels[q.w].m}.${o.shape.wheels[q.w].l}`))];
  const reach = L.trains.map(t => {
    const set = new Set([`${t.barrel.m}.${t.barrel.l}`, `${t.sink.m}.${t.sink.l}`]);
    for (const p of L.pins) if (p.train === t.index) for (const ch of chanOf({ shape: shapeOf(p.kind, p.rot) })) set.add(ch);
    for (let again = true; again;) {
      again = false;
      for (const k of keys) for (const o of opt[k]) { const ch = chanOf(o); if (ch.some(x => set.has(x)) && ch.some(x => !set.has(x))) { ch.forEach(x => set.add(x)); again = true; } }
    }
    return set;
  });
  const users = Object.fromEntries(keys.map(k => [k, L.trains.map(t => t.index).filter(t => chanOf(opt[k][0]).some(x => reach[t].has(x)))]));
  if (keys.some(k => !users[k].length)) return { sols, nodes: 0, capped: false, aborted: false };
  const canKeys = L.trains.map(t => keys.filter(k => users[k].includes(t.index)));
  const mustKeys = L.trains.map(t => canKeys[t.index].filter(k => !users[k].some(u => u > t.index)));
  const lastKeys = L.trains.map(t => keys.filter(k => !users[k].some(u => u > t.index)));
  const sinkDist = L.trains.map(t => dist(firsts[t.index], t.sink.c));
  const tailNeed = L.trains.map((_, t) => { let s = 0; for (let u = t + 1; u < L.trains.length; u++) s += sinkDist[u]; return s; });
  const bound = (c, t) => {
    // squares still to be passed through: the hand and the pins not yet reached, against the distance each train still has to go, the
    // pieces only this train can take and the pieces it can take at most
    const d0 = dist(c, L.trains[t].sink.c);
    let must = pinsLeft[t], can = pinsLeft[t];
    for (const k of canKeys[t]) can += hand[k];
    for (const k of mustKeys[t]) must += hand[k];
    if (can < d0) return false;
    let lo = must > d0 ? must : d0;
    if ((lo - d0) & 1) lo++;
    if (lo > can) return false;
    const rem = left + pinsAll, need = d0 + tailNeed[t];
    return rem >= need && (opts.parity === false || ((rem - need) & 1) === 0);
  };
  function record() {
    const key = laid.map(p => p || "").join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const res = check(L, laid);
    if (res.solved) sols.push({ laid: laid.slice() });
  }
  /** Train t arrives at square c through side s from a wheel of module pm, layer pl, tooth count pn, speed wp. */
  function step(t, c, s, pm, pl, pn, wp) {
    if (aborted || sols.length >= cap) return;
    if (++nodes > limit) { aborted = true; return; }
    const tr = L.trains[t], f = L.fixed[c];
    if (f) {
      if (f.k === "barrel") return;
      if (f.train !== t) return;
      const sh = f.shape;
      for (const q of sh.ports) {
        const w = sh.wheels[q.w];
        if (q.s !== s || w.l !== pl || w.m !== pm) continue;
        const fac = factorsOf(sh, q.w), x = put(c, sh, fac, F.neg(F.mul(wp, F.mk(pn, w.n))), t, f);
        if (!x) continue;
        if (f.k === "sink") {
          if (!pinsLeft[t] && lastKeys[t].every(k => hand[k] < 1)) next(t + 1);
        } else {
          pinsLeft[t]--; pinsAll--;
          exits(t, c, s, sh, q.w, x);
          pinsLeft[t]++; pinsAll++;
        }
        at[c] = null;
      }
      return;
    }
    if (at[c] || !L.cap[c] || !bound(c, t)) return;
    for (const k of keys) {
      if (hand[k] < 1) continue;
      for (const o of opt[k]) {
        if (o.top > L.cap[c]) continue;
        if (L.click[c] >= 0 && !o.single) continue;
        for (const q of o.shape.ports) {
          const w = o.shape.wheels[q.w];
          if (q.s !== s || w.l !== pl || w.m !== pm) continue;
          const x = put(c, o.shape, o.fac[q.w], F.neg(F.mul(wp, F.mk(pn, w.n))), t, null);
          if (!x) continue;
          hand[k]--; left--; laid[c] = o.piece;
          exits(t, c, s, o.shape, q.w, x);
          hand[k]++; left++; laid[c] = null; at[c] = null;
        }
      }
    }
  }
  /** The piece at c is down, entered by wheel `entry` on side s: carry on out of each other port of its component. */
  function exits(t, c, s, shape, entry, x) {
    for (const q of shape.ports) {
      if (q.s === s || shape.comp[q.w] !== shape.comp[entry]) continue;
      const d = beyond(L, c, q.s);
      if (d < 0 || at[d]) continue;
      const fd = L.fixed[d];
      if (fd ? fd.k === "barrel" || fd.train !== t : !L.cap[d]) continue;
      const w = shape.wheels[q.w];
      step(t, d, back(q.s), w.m, w.l, w.n, x.spd[q.w]);
    }
  }
  function next(t) {
    if (aborted || sols.length >= cap) return;
    if (t === L.trains.length) { if (!left && !pinsAll) record(); return; }
    const tr = L.trains[t];
    step(t, firsts[t], back(tr.barrel.side), tr.barrel.m, tr.barrel.l, tr.barrel.n, F.ONE);
  }
  next(0);
  return { sols, nodes, capped: sols.length >= cap || aborted, aborted };
}
