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
 * Beyond the plain walk from each barrel to its sink: a pinned END not reached on the way is grown back from the end itself, at the speed
 * its goal names, until a piece meets the train; a pinned crossing is passed once by each of its trains; with `spare` the hand need not
 * be used up; with a clutch, once every train is down the crown is pulled out and its other ends are grown back to the clutch alone.
 */
export function solve(L, cap = 2, limit = 4e6, opts = {}) {
  const n = L.size, keys = Object.keys(L.hand), hand = { ...L.hand };
  const opt = Object.fromEntries(keys.map(k => [k, optionsOf(L, k)]));
  const at = Array(n).fill(null);                       // { shape, spd (by wheel), tr (by wheel), live, entry }
  const laid = Array(n).fill(null);
  const sols = [], seen = new Set();
  let nodes = 0, aborted = false, left = L.total, state = 0;
  const relaxed = L.spare || !!L.clutch || L.pins.some(p => p.end || p.trains);
  // the pinned pieces each train must pass: one unit per pin, or per wheel of a crossing
  const units = [];
  for (const p of L.pins) {
    const sh = shapeOf(p.kind, p.rot);
    if (p.trains) sh.wheels.forEach((_, i) => units.push({ c: p.c, comp: sh.comp[i], train: p.trains[i], end: false, state: p.state, reached: false }));
    else units.push({ c: p.c, comp: null, train: p.train, end: p.end, state: p.state, goal: p.goal, reached: false });
  }
  const live0 = u => u.state === null || u.state === undefined || u.state === 0;
  const pinsLeft = L.trains.map(t => units.filter(u => u.train === t.index && live0(u)).length);
  let pinsAll = units.filter(live0).length;
  const dist = (a, b) => Math.abs((a % L.cols) - (b % L.cols)) + Math.abs(Math.floor(a / L.cols) - Math.floor(b / L.cols));
  const firsts = L.trains.map(t => beyond(L, t.barrel.c, t.barrel.side));
  if (firsts.some(f => f < 0)) return { sols, nodes: 0, capped: false, aborted: false };
  const trainOfWheel = (f, i) => (f.trains ? f.trains[i] : f.train);
  for (const t of L.trains) { const sh = L.fixed[t.barrel.c].shape; at[t.barrel.c] = { shape: sh, spd: [F.ONE], tr: [t.index], live: true }; }
  const shapeFixed = f => (f.shapes ? f.shapes[state] : f.shape);
  const into = (wp, pn, n2) => F.neg(F.mul(wp, F.mk(pn, n2)));

  /** Whether the wheels of `x` just given speeds at c sit right with every neighbour down. `only`: in a crown's second position, the
   *  one square (the clutch) a new piece may mesh with; `from`: the square the walk came from. */
  function contacts(c, x, train, only = -1, from = -1) {
    let joins = 0;
    for (const q of x.shape.ports) {
      if (!x.spd[q.w]) continue;
      const d = beyond(L, c, q.s);
      if (d < 0) continue;
      const fd = L.fixed[d], y = at[d];
      if (!y && !fd) continue;
      const ysh = y ? y.shape : shapeFixed(fd), w1 = x.shape.wheels[q.w];
      for (const q2 of ysh.ports) {
        if (q2.s !== back(q.s)) continue;
        const w2 = ysh.wheels[q2.w];
        if (w1.l !== w2.l) continue;
        if (w1.m !== w2.m) return -1;                                      // clash
        const ytrain = y ? y.tr[q2.w] : trainOfWheel(fd, q2.w);
        if (ytrain !== train) return -1;                                   // tangle
        const ls = y && y.live ? y.spd[q2.w] : null;
        if (!ls) continue;                                                 // a pinned piece not reached yet: checked when it is
        if (only >= 0 && d !== only && d !== from) return -1;              // the crown's other position must not touch the train elsewhere
        const want = F.neg(F.mul(x.spd[q.w], F.mk(w1.n, w2.n)));
        if (!F.eq(want, ls)) return -1;                                    // a jam or a bind
        if (d !== from) joins++;
      }
    }
    return joins;
  }
  /** Puts a piece down at c entered by wheel `entry` at speed `w0`: { undo, joins }, or null if it does not fit. */
  function put(c, shape, fac, w0, train, fixed, only = -1, from = -1) {
    const spd = fac.map(f => (f ? F.mul(w0, f) : null));
    if (L.click[c] >= 0 && !fixed && (spd[0][0] > 0 ? 0 : 1) !== L.click[c]) return null;
    if (fixed?.goal) {
      const g = fixed.goal, w = spd[g.w];
      if (w) {
        if (g.dir !== null && (w[0] > 0 ? 0 : 1) !== g.dir) return null;
        if (g.speed && !F.eq(F.abs(w), g.speed)) return null;
      } else if (!fixed.trains) return null;
    }
    const prev = at[c];
    const x = prev ? { shape, spd: prev.spd.map((v, i) => spd[i] || v), tr: prev.tr.map((v, i) => (spd[i] ? train : v)), live: true }
      : { shape, spd, tr: spd.map((v, i) => (v ? train : fixed ? trainOfWheel(fixed, i) : train)), live: true };
    at[c] = { ...x, spd };            // the contacts of the wheels just driven
    const joins = contacts(c, at[c], train, only, from);
    if (joins < 0) { at[c] = prev; return null; }
    at[c] = x;
    return { undo: () => { at[c] = prev; }, joins };
  }
  // which trains can use which hand key: a piece is usable by a train that can reach any channel (module, layer) of its ports, a stack or
  // riser joining the channels it links
  const chanOf = o => [...new Set(o.shape.ports.map(q => `${o.shape.wheels[q.w].m}.${o.shape.wheels[q.w].l}`))];
  const reach = L.trains.map(t => {
    const set = new Set([`${t.barrel.m}.${t.barrel.l}`, `${t.sink.m}.${t.sink.l}`]);
    for (const p of L.pins) if (p.train === t.index || p.trains?.includes(t.index)) for (const ch of chanOf({ shape: shapeOf(p.kind, p.rot) })) set.add(ch);
    for (let again = true; again;) {
      again = false;
      for (const k of keys) for (const o of opt[k]) { const ch = chanOf(o); if (ch.some(x => set.has(x)) && ch.some(x => !set.has(x))) { ch.forEach(x => set.add(x)); again = true; } }
    }
    return set;
  });
  const users = Object.fromEntries(keys.map(k => [k, L.trains.map(t => t.index).filter(t => chanOf(opt[k][0]).some(x => reach[t].has(x)))]));
  if (!L.spare && keys.some(k => !users[k].length)) return { sols, nodes: 0, capped: false, aborted: false };
  const canKeys = L.trains.map(t => keys.filter(k => users[k].includes(t.index)));
  const mustKeys = L.trains.map(t => canKeys[t.index].filter(k => !users[k].some(u => u > t.index)));
  const lastKeys = L.trains.map(t => keys.filter(k => !users[k].some(u => u > t.index)));
  const sinkDist = L.trains.map(t => dist(firsts[t.index], t.sink.c));
  const tailNeed = L.trains.map((_, t) => { let s = 0; for (let u = t + 1; u < L.trains.length; u++) s += sinkDist[u]; return s; });
  const bound = (c, t, w) => {
    if (w.back) return true;
    // squares still to be passed through: the hand and the pins not yet reached, against the distance each train still has to go, the
    // pieces only this train can take and the pieces it can take at most
    const d0 = dist(c, L.trains[t].sink.c);
    let must = pinsLeft[t], can = pinsLeft[t];
    for (const k of canKeys[t]) can += hand[k];
    if (can < d0) return false;
    if (relaxed) return true;
    for (const k of mustKeys[t]) must += hand[k];
    let lo = must > d0 ? must : d0;
    if ((lo - d0) & 1) lo++;
    if (lo > can) return false;
    const rem = left + pinsAll, need = d0 + tailNeed[t];
    return rem >= need && (opts.parity === false || ((rem - need) & 1) === 0);
  };
  function record() {
    if (!L.spare && left) return;
    if (units.some(u => !u.reached && (u.state === null || u.state === undefined || u.state === state || L.clutch))) return;
    const key = laid.map(p => p || "").join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const res = check(L, laid);
    if (res.solved) sols.push({ laid: laid.slice() });
  }
  const unitAt = (c, comp) => units.find(u => u.c === c && !u.reached && (u.comp === null || u.comp === comp));
  const reachUnit = u => { if (!u) return () => {}; u.reached = true; if (live0(u)) { pinsLeft[u.train]--; pinsAll--; } return () => { u.reached = false; if (live0(u)) { pinsLeft[u.train]++; pinsAll++; } }; };
  /** Arrived at square c through side s from a wheel of module pm, layer pl, tooth count pn, speed wp. `w` is the walk: { t, back (grown
   *  from an end: done when a piece meets the train), only (the clutch, in the crown's second position), done () }. */
  function step(w, c, s, pm, pl, pn, wp) {
    if (aborted || sols.length >= cap) return;
    if (++nodes > limit) { aborted = true; return; }
    const t = w.t, f = L.fixed[c], from = beyond(L, c, s);
    if (f) {
      if (f.k === "barrel") return;
      if (f.k === "sink" && (w.back || L.trains[f.train] && !sinkOk(t, f))) return;
      const sh = shapeFixed(f);
      for (const q of sh.ports) {
        const wh = sh.wheels[q.w];
        if (q.s !== s || wh.l !== pl || wh.m !== pm || trainOfWheel(f, q.w) !== t) continue;
        if (at[c] && at[c].spd[q.w]) continue;
        const r = put(c, sh, factorsOf(sh, q.w), into(wp, pn, wh.n), t, f, w.only ?? -1, from);
        if (!r) continue;
        if (c === L.clutch?.c && state === 0) at[c].entry = { s, pm, pl, pn, wp };
        if (f.k === "sink") { if (!w.back) w.done(); }
        else {
          const undoU = reachUnit(unitAt(c, sh.comp[q.w]));
          if (w.back && r.joins) w.done(); else if (!(w.only >= 0 && r.joins)) exits(w, c, s, sh, q.w);
          undoU();
        }
        r.undo();
      }
      return;
    }
    if (at[c] || !L.cap[c] || !bound(c, t, w)) return;
    for (const k of keys) {
      if (hand[k] < 1) continue;
      for (const o of opt[k]) {
        if (o.top > L.cap[c]) continue;
        if (L.click[c] >= 0 && !o.single) continue;
        for (const q of o.shape.ports) {
          const wh = o.shape.wheels[q.w];
          if (q.s !== s || wh.l !== pl || wh.m !== pm) continue;
          const r = put(c, o.shape, o.fac[q.w], into(wp, pn, wh.n), t, null, w.only ?? -1, from);
          if (!r) continue;
          hand[k]--; left--; laid[c] = o.piece;
          if (w.back && r.joins) w.done(); else exits(w, c, s, o.shape, q.w);
          hand[k]++; left++; laid[c] = null; r.undo();
        }
      }
    }
  }
  const sinkOk = (t, f) => f.train === t && (!L.clutch || L.clutch.train !== t || state === 0);
  /** The piece at c is down, entered by wheel `entry` on side s: carry on out of each other port of its component. */
  function exits(w, c, s, shape, entry) {
    for (const q of shape.ports) {
      if (q.s === s || shape.comp[q.w] !== shape.comp[entry]) continue;
      const d = beyond(L, c, q.s);
      if (d < 0 || (at[d] && !L.fixed[d])) continue;
      const fd = L.fixed[d];
      if (fd ? fd.k === "barrel" : !L.cap[d]) continue;
      const wh = shape.wheels[q.w];
      const sp = at[c].spd[q.w];
      if (!sp) continue;
      step(w, d, back(q.s), wh.m, wh.l, wh.n, sp);
    }
  }
  /** Grows the train back from the pinned end `u`: the end at the speed its goal names (a goal of a turn only: the barrel's tooth rate). */
  function growBack(u, only, k) {
    if (u.reached) return k();
    const f = L.fixed[u.c], sh = shapeFixed(f), g = f.goal;
    if (!g || g.dir === null) return;
    const wg = sh.wheels[g.w], tr = L.trains[u.train];
    const mag = g.speed || F.mk(tr.barrel.n, wg.n), w0 = g.dir === 0 ? mag : F.neg(mag);
    const r = put(u.c, sh, factorsOf(sh, g.w), w0, u.train, f, only);
    if (!r) return;
    const undoU = reachUnit(u);
    const w = { t: u.train, back: true, only, done: k };
    if (r.joins) k();
    else for (const q of sh.ports) {
      if (sh.comp[q.w] !== sh.comp[g.w]) continue;
      const d = beyond(L, u.c, q.s);
      if (d < 0 || (at[d] && !L.fixed[d])) continue;
      const fd = L.fixed[d];
      if (fd ? fd.k === "barrel" || fd.k === "sink" : !L.cap[d]) continue;
      const wh = sh.wheels[q.w];
      step(w, d, back(q.s), wh.m, wh.l, wh.n, at[u.c].spd[q.w]);
    }
    undoU(); r.undo();
  }
  const endsOf = (t, st) => units.filter(u => u.end && u.train === t && (st === 0 ? live0(u) : u.state === st));
  function afterSink(t) {
    // every pinned piece of this train is passed, but its ends may be grown back
    if (units.some(u => u.train === t && live0(u) && !u.reached && !u.end)) return;
    const list = endsOf(t, 0);
    const go = i => {
      if (i === list.length) {
        if (!relaxed && !lastKeys[t].every(k => hand[k] < 1)) return;
        next(t + 1);
        return;
      }
      growBack(list[i], -1, () => go(i + 1));
    };
    go(0);
  }
  function crownOut() {
    // the crown pulled out: the clutch turns to its second shape, driven from the side the train came in by, and its other ends are grown
    // back to it alone
    const c = L.clutch.c, f = L.fixed[c], was = at[c];
    if (!was?.entry) return;
    state = 1;
    const sh = f.shapes[1], e = was.entry;
    const q = sh.ports.find(p => p.s === e.s && sh.wheels[p.w].m === e.pm && sh.wheels[p.w].l === e.pl);
    if (q) {
      const spd = factorsOf(sh, q.w).map(x => (x ? F.mul(into(e.wp, e.pn, sh.wheels[q.w].n), x) : null));
      at[c] = { shape: sh, spd, tr: spd.map(() => f.train), live: true };
      // in this position the clutch may only touch the train it came from
      let ok = true;
      for (const p of sh.ports) {
        if (p.s === e.s) continue;
        const d = beyond(L, c, p.s), y = d >= 0 ? at[d] : null;
        if (y && y.shape.ports.some(p2 => p2.s === back(p.s) && y.shape.wheels[p2.w].l === sh.wheels[p.w].l)) ok = false;
      }
      if (ok) {
        const list = endsOf(L.clutch.train, 1);
        const go = i => (i === list.length ? record() : growBack(list[i], c, () => go(i + 1)));
        go(0);
      }
    }
    at[c] = was; state = 0;
  }
  function next(t) {
    if (aborted || sols.length >= cap) return;
    if (t === L.trains.length) { if (L.clutch) crownOut(); else if (!pinsAll) record(); return; }
    const tr = L.trains[t];
    step({ t, back: false, done: () => afterSink(t) }, firsts[t], back(tr.barrel.side), tr.barrel.m, tr.barrel.l, tr.barrel.n, F.ONE);
  }
  next(0);
  return { sols, nodes, capped: sols.length >= cap || aborted, aborted };
}
