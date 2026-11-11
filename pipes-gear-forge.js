// Gears: the maker of the campaign's levels (11 November 2026; the plan is the Gears tab of the game plan, the recipes are in
// pipes-gear-campaign.mjs). A recipe names the themes a level combines; the maker draws a route per train (and the routes the themes add: a
// branch to a pinned end, a crown's second branch, a crossing), dresses each square with a piece of the recipe's families by a search that
// honours what the themes force (a crossing piece where routes cross, a single where a branch leaves, the clutch at a bend), reads the goals
// off the speeds it drew, and then makes the answer the only one: pillars everywhere first, pins, clicks and bridges added until one answer
// is left, pillars taken away while it stays one, spare pieces added to the hand while it stays one. Used to write the level file; no page
// loads it.
import { rng, mix } from "./pipes-pieces.js";
import * as F from "./pipes-gear-frac.js";
import { CATALOG, parseKind, shapeOf, orientations, canonRot, back, SIDE, topLayer, radius } from "./pipes-gear-shapes.js";
import { parseLevel, check, beyond, pieceStr, pieceOf, SLOTS, discVoid } from "./pipes-gear-engine.js";
import { solve } from "./pipes-gear-solve.js";

const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffled = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const WHY = {};
const no = k => { WHY[k] = (WHY[k] || 0) + 1; return null; };

// ---------- routes ----------
/**
 * A walk of n squares from `from`, entered by side a0: { passes: [{ c, a, b, cross }], end (the square after the last) } or null. o: blocked
 * (never entered), keep (other routes: not entered, and not touched unless o.touch), touch (may run beside itself), cross (Map square ->
 * "h" | "v": straight squares of another route it may cross at right angles), self (it may cross its own straight squares), crosses (how many
 * crossings it must make), bends (at least).
 */
function walkRoute(L0, r, from, a0, n, o) {
  const passes = [], used = new Set(), crossedAt = new Set();
  let tries = 0, crosses = 0;
  const free = c => c >= 0 && !o.blocked.has(c) && !used.has(c) && !o.keep?.has(c);
  const nb = c => [0, 1, 2, 3].map(d => beyond(L0, c, d)).filter(x => x >= 0);
  const orient = b => (b % 2 ? "h" : "v");
  const ownStraight = c => passes.find(p => p.c === c && !p.cross && p.b === back(p.a));
  // a route may come up to a square it can cross; nowhere else may it run beside a route (unless o.touch)
  const crossTarget = x => (o.cross?.has(x) || (o.self && !!ownStraight(x))) && crosses < (o.crosses || 0);
  const touchBad = (c, prev) => !o.touch && nb(c).some(x => x !== prev && !crossedAt.has(x) && !crossTarget(x) && (used.has(x) || o.keep?.has(x)));
  const crossable = (c, b) => {
    if (crosses >= (o.crosses || 0) || crossedAt.has(c)) return false;
    const want = orient(b) === "h" ? "v" : "h";
    if (o.cross?.get(c) === want) return true;
    const own = o.self && ownStraight(c);
    return !!own && orient(own.b) === want;
  };
  const bends = () => passes.reduce((k, p) => k + (p.b !== back(p.a) && !p.cross ? 1 : 0), 0);
  const finish = last => {
    const end = beyond(L0, last.c, last.b);
    if (!free(end) || touchBad(end, last.c) || bends() < (o.bends || 0) || crosses < (o.crosses || 0)) return null;
    return end;
  };
  let endSq = null;
  function go(c, a, prev) {
    if (++tries > 6000 + n * 1500) return false;
    used.add(c);
    for (const b of shuffled([0, 1, 2, 3].filter(x => x !== a), r)) {
      const nx = beyond(L0, c, b);
      if (nx < 0) continue;
      if (crossable(nx, b)) {
        const out = beyond(L0, nx, b);
        if (!free(out) || passes.length + 2 > n) continue;
        passes.push({ c, a, b }, { c: nx, a: back(b), b, cross: true });
        crosses++; crossedAt.add(nx);
        if (passes.length === n) { const e = finish(passes[n - 1]); if (e !== null) { endSq = e; return true; } }
        else if (!touchBad(out, nx) && go(out, back(b), nx)) return true;
        passes.pop(); passes.pop(); crosses--; crossedAt.delete(nx);
        continue;
      }
      if (!free(nx) || touchBad(nx, c)) continue;
      passes.push({ c, a, b });
      if (passes.length === n) { const e = finish(passes[n - 1]); if (e !== null) { endSq = e; return true; } }
      else if (go(nx, back(b), c)) return true;
      passes.pop();
    }
    used.delete(c);
    return false;
  }
  if (!free(from)) return null;
  return go(from, a0, -1) ? { passes, end: endSq } : null;
}

// ---------- pieces ----------
/** The kinds a train may use: { mods, layers, fams: { S, D, T, K, R } (weights) }, as [{ kind, fam, weight }]. */
export function paletteOf(pal) {
  const cat = CATALOG(), out = [];
  for (const [fam, weight] of Object.entries(pal.fams)) {
    if (!weight) continue;
    for (const kind of cat[fam]) {
      const p = parseKind(kind);
      if (fam === "K" || fam === "R") { if (!(pal.mods.includes(p.m1) && pal.mods.includes(p.m2) && pal.layers.includes(p.l1) && pal.layers.includes(p.l2))) continue; }
      else if (!pal.mods.includes(p.m) || !pal.layers.includes(p.l)) continue;
      if (fam === "K" && pal.adapt === false && p.m1 !== p.m2) continue;
      out.push({ kind, fam, weight });
    }
  }
  return out;
}
const templates = new Map();
const rotsOf = kind => { if (!templates.has(kind)) templates.set(kind, orientations(kind).map(rot => ({ rot, shape: shapeOf(kind, rot) }))); return templates.get(kind); };
const sameEnds = kind => { const sh = shapeOf(kind, 0), ns = sh.ports.map(q => sh.wheels[q.w].n); return ns[0] === ns[1]; };
function pieceSpeeds(sh, from, w) {
  const sp = Array(sh.wheels.length).fill(null);
  sp[from] = w;
  for (let k = 0; k < sh.wheels.length * 2; k++) {
    for (const [u, v] of sh.mesh) {
      if (sp[u] && !sp[v]) sp[v] = F.neg(F.mul(sp[u], F.mk(sh.wheels[u].n, sh.wheels[v].n)));
      if (sp[v] && !sp[u]) sp[u] = F.neg(F.mul(sp[v], F.mk(sh.wheels[v].n, sh.wheels[u].n)));
    }
    sh.wheels.forEach((a, i) => sh.wheels.forEach((b, j) => { if (i !== j && a.a === b.a && sp[i] && !sp[j]) sp[j] = sp[i]; }));
  }
  return sp;
}
/**
 * The pieces for a run of passes, by a search: the channel (module, layer, teeth, speed) it starts from, each pass a piece of the palette whose
 * entry port takes that channel and whose exit port of the same component leaves by the pass's side. `force(i)`: what pass i must be
 * ({ kind, rot?, layer? } or { fam }). `endChan`: the module and layer the last wheel must have. Returns [{ c, kind, rot, entry, exit, wEntry,
 * wExit, shape }] or null.
 */
function dressRun(passes, start, pal, r, force = () => null, endChan = null, budget = 4000) {
  const out = [];
  let left = budget;
  const options = (i, m, l) => {
    const p = passes[i], f = force(i), cand = [];
    const list = f?.kind ? [{ kind: f.kind, fam: parseKind(f.kind).f, weight: 1 }] : f?.fam ? pal.filter(x => x.fam === f.fam) : f?.notFam ? pal.filter(x => x.fam !== f.notFam) : pal;
    for (const { kind, fam, weight } of list) {
      for (const { rot, shape } of rotsOf(kind)) {
        if (f?.rot !== undefined && rot !== f.rot) continue;
        for (const q of shape.ports) {
          const wh = shape.wheels[q.w];
          if (q.s !== p.a || wh.m !== m || wh.l !== l || (f?.layer && wh.l !== f.layer)) continue;
          for (const q2 of shape.ports) {
            if (q2.s !== p.b || shape.comp[q2.w] !== shape.comp[q.w]) continue;
            const ex = shape.wheels[q2.w];
            if (i === passes.length - 1 && endChan && ((endChan.m && ex.m !== endChan.m) || (endChan.l && ex.l !== endChan.l))) continue;
            cand.push({ kind, fam, rot, shape, entry: q.w, exit: q2.w, weight: weight * (0.5 + r()) });
          }
        }
      }
    }
    return cand.sort((x, y) => y.weight - x.weight);
  };
  const go = (i, m, l, n, w) => {
    if (i === passes.length) return true;
    if (--left < 0) return false;
    for (const c of options(i, m, l)) {
      const e = c.shape.wheels[c.entry], ex = c.shape.wheels[c.exit];
      const wEntry = F.neg(F.mul(w, F.mk(n, e.n))), sp = pieceSpeeds(c.shape, c.entry, wEntry);
      out.push({ ...c, c: passes[i].c, pass: passes[i], wEntry, wExit: sp[c.exit], spd: sp });
      if (go(i + 1, ex.m, ex.l, ex.n, sp[c.exit])) return true;
      out.pop();
    }
    return false;
  };
  return go(0, start.m, start.l, start.n, start.w) ? out : null;
}

const niceSpeed = f => f[0] !== 0 && Math.abs(f[0]) <= 16 && f[1] <= 16 && F.num(F.abs(f)) >= 1 / 16 && F.num(F.abs(f)) <= 8;
const dirOf = w => (w[0] > 0 ? "cw" : "ccw");
const fmt = w => F.fmt(F.abs(w));

/**
 * One level from a seed and a recipe, or null. Recipe: {
 *   cols, rows, disc, turn (pieces turn), power ("quartz" | "mech"), spares (pieces too many), maxSols (1), nodes (the solver's work it may
 *   take once the pillars are out), full (keep every square the routes leave as a pillar: a filled plate), touch (routes may run beside
 *   themselves), extras { pins, clicks, bridges } (the most of each to add), forcePins,
 *   trains: [{ m, l, pieces, bends, fams, mods, layers, adapt, end { m, l }, goal { type, ring }, stations, stationType, self (crosses itself),
 *            ends: [{ len, look: "hands" | "barrel", type }], clutch { len }, hands (a pinned hands station on the way) }],
 *   cross: [[a, b]] (train b crosses train a once at a pinned crossing)
 * }
 */
export function forgeLevel(seed, o) {
  const r = rng(mix(seed, 911)), L0 = { cols: o.cols, rows: o.rows, size: o.cols * o.rows };
  const gone = o.disc ? discVoid(o.cols) : new Set();
  const blocked = new Set(gone), keep = new Set(), routes = [];
  const cat = CATALOG();
  // ---- routes: each train's main line, then what its themes add
  for (let ti = 0; ti < o.trains.length; ti++) {
    const t = o.trains[ti];
    const crossWith = (o.cross || []).find(([, b]) => b === ti);
    let R = null;
    for (let k = 0; k < (t.pieces > 14 ? 200 : 80) && !R; k++) {
      const s = Math.floor(r() * L0.size), d0 = Math.floor(r() * 4), first = beyond(L0, s, d0);
      if (blocked.has(s) || keep.has(s) || first < 0) continue;
      const cross = new Map();
      if (crossWith) for (const p of routes[crossWith[0]].main.passes) if (!p.cross && p.b === back(p.a)) cross.set(p.c, p.b % 2 ? "h" : "v");
      const w = walkRoute(L0, r, first, back(d0), t.pieces, { blocked: new Set([...blocked, s]), keep, touch: !!o.touch, cross,
        self: !!t.self, crosses: (crossWith ? 1 : 0) + (t.self ? 1 : 0), bends: t.bends || 0 });
      if (w && !keep.has(w.end)) R = { barrel: { c: s, side: d0 }, main: w, sink: { c: w.end, side: back(w.passes[w.passes.length - 1].b) } };
    }
    if (!R) return no(`route ${ti}`);
    const taken = new Set([R.barrel.c, R.sink.c, ...R.main.passes.map(p => p.c)]);
    taken.forEach(c => keep.add(c));
    routes.push({ ...R, branches: [] });
  }
  // ---- dress each train's main line
  const dressed = [];
  for (let ti = 0; ti < o.trains.length; ti++) {
    const t = o.trains[ti], R = routes[ti], pal = paletteOf({ mods: t.mods || [t.m], layers: t.layers || [t.l], fams: t.fams, adapt: t.adapt });
    // a skeleton of a few kinds per channel, as a hand of every different piece has a factorial of ways to be laid
    const chanKey = p => { const q = parseKind(p.kind); return `${q.m}.${q.l}`; };
    const chans = [...new Set(pal.filter(p => p.fam !== "K" && p.fam !== "R").map(chanKey))];
    const crossKind = `X[${t.m}.1,${t.m}.2]`;
    let d = null, clutchAt = -1, junctions = [];
    for (let k = 0; k < 40 && !d; k++) {
      const sub = [];
      for (const ch of chans) {
        for (const fam of ["D", "T"]) {
          if (!t.fams[fam]) continue;
          const straight = pal.filter(p => p.fam === fam && chanKey(p) === ch && !p.kind.endsWith("e") && sameEnds(p.kind));
          const elbow = pal.filter(p => p.fam === fam && chanKey(p) === ch && p.kind.endsWith("e"));
          const nst = 1 + (r() < 0.3 ? 1 : 0), nel = 1 + (r() < 0.3 ? 1 : 0);
          for (let q = 0; q < nst && straight.length; q++) sub.push(pick(r, straight));
          for (let q = 0; q < nel && elbow.length; q++) sub.push(pick(r, elbow));
        }
        sub.push(...pal.filter(p => p.fam === "S" && chanKey(p) === ch));
      }
      const comp = pal.filter(p => p.fam === "K" || p.fam === "R");
      for (let q = 0; q < (t.stacks || 0) * 2 && comp.length; q++) sub.push(pick(r, comp));
      // what the themes force: crossings, the clutch at a bend, singles where branches leave
      const passes = R.main.passes;
      const crossIdx = passes.map((p, i) => (p.cross || (t.self && passes.some(q => q.cross && q.c === p.c)) ? i : -1)).filter(i => i >= 0);
      const crossedByOther = new Set();
      for (const [a, b] of o.cross || []) if (a === ti) for (const p of routes[b]?.main.passes || []) if (p.cross) crossedByOther.add(p.c);
      clutchAt = -1;
      if (t.clutch) {
        const bendsAt = passes.map((p, i) => (i > 0 && i < passes.length - 1 && p.b !== back(p.a) && !p.cross ? i : -1)).filter(i => i >= 0);
        if (!bendsAt.length) break;
        clutchAt = pick(r, bendsAt);
      }
      // a branch leaves a single by a side the line does not use, into open ground
      const nEnds = (t.ends || []).length, roomy = i => {
        const p = passes[i];
        return [0, 1, 2, 3].some(sd => { const x = beyond(L0, p.c, sd); return sd !== p.a && sd !== p.b && x >= 0 && !blocked.has(x) && !keep.has(x); });
      };
      junctions = shuffled(passes.map((p, i) => i).filter(i => i > 0 && i < passes.length - 1 && i !== clutchAt && !crossIdx.includes(i) && !crossedByOther.has(passes[i].c) && roomy(i)), r).slice(0, nEnds);
      if (junctions.length < nEnds) { d = null; break; }
      const clutchKind = `D${t.m}.${t.l}:${{ 4: 6, 5: 5, 6: 4 }[t.m]}>${{ 4: 6, 5: 5, 6: 4 }[t.m]}e`;
      // beside a crossing a piece keeps to the layer it crosses on (a riser there would mesh the other layer too)
      const nextTo = new Map();
      passes.forEach((p, i) => {
        const x = crossIdx.includes(i) ? (p.cross ? 2 : 1) : crossedByOther.has(p.c) ? 1 : 0;
        if (x) for (const j of [i - 1, i + 1]) if (j >= 0 && j < passes.length && !crossIdx.includes(j)) nextTo.set(j, x);
      });
      const force = i => {
        if (crossIdx.includes(i)) return { kind: crossKind, rot: 0, layer: passes[i].cross ? 2 : 1 };
        if (crossedByOther.has(passes[i].c)) return { kind: crossKind, rot: 0, layer: 1 };
        if (nextTo.has(i)) return { notFam: "R", layer: nextTo.get(i) };
        if (i === clutchAt) { const p = passes[i]; return { kind: clutchKind, rot: p.b === (p.a + 1) % 4 ? p.a : (p.a + 3) % 4 }; }
        if (junctions.includes(i)) return { fam: "S" };
        return null;
      };
      const start = { m: t.m, l: t.l, n: t.barrelN || Math.round(45 / t.m), w: F.ONE };
      d = dressRun(passes, start, sub.length ? [...sub, ...(t.self || crossedByOther.size ? [{ kind: crossKind, fam: "X", weight: 0 }] : [])] : pal, r, force, t.end || null);
      if (d && t.stacks && d.filter(p => p.fam === "K" || p.fam === "R").length < (t.minStacks ?? 1)) d = null;
    }
    if (!d) return no(`dress ${ti}`);
    dressed.push({ pieces: d, clutchAt, junctions });
  }
  // ---- branches: from each junction single (or the clutch's other side) out to a pinned end
  const ends = [];
  for (let ti = 0; ti < o.trains.length; ti++) {
    const t = o.trains[ti], R = routes[ti], D = dressed[ti];
    const pal = paletteOf({ mods: [t.m], layers: [t.l], fams: { S: 2, D: t.fams.D ? 3 : 0, T: t.fams.T ? 3 : 0 } });
    const grow = (fromC, side, len, startChan, extraForce) => {
      for (let k = 0; k < 30; k++) {
        const first = beyond(L0, fromC, side);
        if (first < 0 || blocked.has(first) || keep.has(first)) return null;
        const keep2 = new Set([...keep].filter(c => c !== fromC));
        const w = len > 0 ? walkRoute(L0, r, first, back(side), len, { blocked, keep: keep2, touch: k > 10 }) : { passes: [], end: first };
        if (!w) continue;
        if (len === 0 && keep.has(first)) return null;
        const run = len > 0 ? dressRun(w.passes, startChan, pal, r, extraForce) : [];
        if (!run) continue;
        return { w, run };
      }
      return null;
    };
    const lastSpeed = (run, startChan) => (run.length ? { m: run[run.length - 1].shape.wheels[run[run.length - 1].exit].m, n: run[run.length - 1].shape.wheels[run[run.length - 1].exit].n, w: run[run.length - 1].wExit }
      : { m: startChan.m, n: startChan.n, w: startChan.w });
    (t.ends || []).forEach((e, k) => {
      const j = D.junctions[k];
      if (j === undefined) return;
      const jp = D.pieces[j], wj = jp.spd[0], free = [0, 1, 2, 3].filter(s => s !== jp.pass.a && s !== jp.pass.b);
      for (const side of shuffled(free, r)) {
        const g = grow(jp.c, side, e.len, { m: t.m, l: t.l, n: jp.shape.wheels[0].n, w: wj });
        if (!g) continue;
        const ls = lastSpeed(g.run, { m: t.m, n: jp.shape.wheels[0].n, w: wj }), single = `S${t.m}.${t.l}`, nEnd = shapeOf(single, 0).wheels[0].n;
        const wEnd = F.neg(F.mul(ls.w, F.mk(ls.n, nEnd)));
        ends.push({ train: ti, c: g.w.end, kind: single, w: wEnd, look: e.look || "hands", type: e.type || (e.look === "barrel" ? "barrel" : "hands"), run: g.run, state: null });
        [g.w.end, ...g.w.passes.map(p => p.c)].forEach(c => keep.add(c));
        break;
      }
    });
    if (t.clutch && D.clutchAt >= 0) {
      const cp = D.pieces[D.clutchAt], p = cp.pass, side = back(p.b);
      const rot1 = side === (p.a + 1) % 4 ? p.a : (p.a + 3) % 4, sh1 = shapeOf(cp.kind, rot1);
      const q = sh1.ports.find(x => x.s === p.a), q2 = sh1.ports.find(x => x.s === side);
      if (!q || !q2) return no("clutch shape");
      const sp1 = pieceSpeeds(sh1, q.w, cp.wEntry);
      const g = grow(cp.c, side, t.clutch.len, { m: t.m, l: t.l, n: sh1.wheels[q2.w].n, w: sp1[q2.w] });
      if (!g) return no("clutch branch");
      const ls = lastSpeed(g.run, { m: t.m, n: sh1.wheels[q2.w].n, w: sp1[q2.w] }), single = `S${t.m}.${t.l}`, nEnd = shapeOf(single, 0).wheels[0].n;
      ends.push({ train: ti, c: g.w.end, kind: single, w: F.neg(F.mul(ls.w, F.mk(ls.n, nEnd))), look: "hands", type: "hands", run: g.run, state: 1 });
      D.clutch = { c: cp.c, kind: cp.kind, states: [cp.rot, rot1] };
      [g.w.end, ...g.w.passes.map(x => x.c)].forEach(c => keep.add(c));
    } else if (t.clutch) return no("clutch");
    if ((t.ends || []).length !== ends.filter(e => e.train === ti && e.state === null).length) return no("ends");
  }
  // ---- goals and the level's data
  const spec = {
    id: `f${seed}`, name: "", chapter: o.chapter || "z", cols: o.cols, rows: o.rows, rotate: !!o.turn, v: 1, power: o.power || "quartz",
    map: Array.from({ length: o.rows }, (_, y) => Array.from({ length: o.cols }, (__, x) => (gone.has(y * o.cols + x) ? " " : ".")).join("")),
    hand: "", sols: [], pins: [], clicks: [], trains: [],
  };
  if (o.spares) spec.spare = true;
  for (let ti = 0; ti < o.trains.length; ti++) {
    const t = o.trains[ti], R = routes[ti], D = dressed[ti], last = D.pieces[D.pieces.length - 1];
    const ex = last.shape.wheels[last.exit], ring = !!t.goal?.ring, compound = ring || D.pieces.some(p => p.fam === "K" || p.fam === "R") || !!t.stations;
    let sinkN = Math.round(45 / ex.m), barrelN = t.barrelN || Math.round(45 / t.m), wSink = F.neg(F.mul(last.wExit, F.mk(ex.n, sinkN)));
    if (ring) {
      const opts = [];
      for (const n of [4, 5, 6, 7].filter(x => radius(ex.m, x) <= 20)) {
        const w = F.neg(F.mul(last.wExit, F.mk(ex.n, Math.round(60 / ex.m))));
        if (niceSpeed(w)) opts.push({ n, w, score: Math.abs(w[0]) + w[1] });
      }
      if (!opts.length) return no("ring");
      opts.sort((a, b) => a.score - b.score);
      sinkN = opts[0].n; wSink = opts[0].w;
    } else if (compound) {
      const opts = [];
      for (let n = 4; n <= Math.floor(60 / ex.m) - 3; n++) { const w = F.neg(F.mul(last.wExit, F.mk(ex.n, n))); if (niceSpeed(w)) opts.push({ n, w, score: Math.abs(w[0]) + w[1] + r() }); }
      if (!opts.length) return no("speed");
      opts.sort((a, b) => a.score - b.score);
      sinkN = opts[0].n; wSink = opts[0].w;
    }
    const type = t.goal?.type || (o.power === "mech" ? "escape" : compound ? "wheel" : "dial");
    spec.trains.push({ id: "ABC"[ti], barrel: { c: R.barrel.c, side: SIDE[R.barrel.side], m: t.m, l: t.l, n: barrelN },
      sink: { c: R.sink.c, side: SIDE[R.sink.side], m: ex.m, l: ex.l, n: sinkN, goal: { type, ...(compound ? { speed: fmt(wSink) } : {}), dir: dirOf(wSink), ...(ring ? { ring: true } : {}) } } });
  }
  const wanted = {}, pinned = new Set();
  const addPin = p => { spec.pins.push(p); pinned.add(p.c); };
  dressed.forEach((D, ti) => D.pieces.forEach(p => { if (!wanted[p.c]) wanted[p.c] = pieceStr(p.kind, p.rot); }));
  for (const e of ends) for (const p of e.run) wanted[p.c] = pieceStr(p.kind, p.rot);
  const trainAt = new Map();
  dressed.forEach((D, ti) => D.pieces.forEach(p => { if (!trainAt.has(p.c)) trainAt.set(p.c, ti); }));
  for (const e of ends) for (const p of e.run) trainAt.set(p.c, e.train);
  // crossings and clutches are pinned; the ends are pinned with their goals
  const crossSq = new Map();
  dressed.forEach((D, ti) => D.pieces.forEach(p => { if (p.fam === "X" || /^X/.test(p.kind)) { if (!crossSq.has(p.c)) crossSq.set(p.c, { kind: p.kind, trains: [ti, ti] }); const wh = p.shape.wheels[p.entry]; crossSq.get(p.c).trains[wh.l === 1 ? 0 : 1] = ti; } }));
  for (const [c, x] of crossSq) addPin({ c, kind: x.kind, rot: 0, trains: x.trains });
  dressed.forEach((D, ti) => { if (D.clutch) addPin({ c: D.clutch.c, kind: D.clutch.kind, rot: D.clutch.states[0], states: D.clutch.states, train: ti }); });
  for (const e of ends) addPin({ c: e.c, kind: e.kind, rot: 0, train: e.train, end: true, ...(e.state !== null ? { state: e.state } : {}), ...(e.look === "barrel" ? { look: "barrel" } : {}),
    goal: { type: e.type, w: 0, speed: fmt(e.w), dir: dirOf(e.w) } });
  // stations: pinned pieces of the main line with their speed; a mechanical train's hands sit on one
  dressed.forEach((D, ti) => {
    const t = o.trains[ti], can = D.pieces.map((p, i) => i).filter(i => i > 0 && i < D.pieces.length - 1 && !pinned.has(D.pieces[i].c) && !D.junctions.includes(i) && /^[STD]/.test(D.pieces[i].kind));
    const n = (t.stations || 0) + (t.hands ? 1 : 0);
    shuffled(can, r).slice(0, n).forEach((i, k) => {
      const p = D.pieces[i], hands = t.hands && k === 0;
      addPin({ c: p.c, kind: p.kind, rot: p.rot, train: ti, goal: { type: hands ? "hands" : t.stationType || "wheel", w: p.entry, ...(t.stations && !hands ? { speed: fmt(p.wEntry) } : {}), dir: dirOf(p.wEntry) } });
    });
  });
  const handKey = p => (spec.rotate ? pieceOf(p).kind : pieceStr(pieceOf(p).kind, canonRot(pieceOf(p).kind, pieceOf(p).rot)));
  const spareKeys = [];
  const counts = () => {
    const h = {};
    for (const [c, p] of Object.entries(wanted)) if (!pinned.has(Number(c))) { const k = handKey(p); h[k] = (h[k] || 0) + 1; }
    for (const k of spareKeys) h[k] = (h[k] || 0) + 1;
    return Object.entries(h).map(([k, v]) => `${k}:${v}`).join(" ");
  };
  const setMap = (c, ch) => { const y = Math.floor(c / o.cols), x = c % o.cols, row = spec.map[y]; spec.map[y] = row.slice(0, x) + ch + row.slice(x + 1); };
  const build = () => { spec.hand = counts(); return parseLevel(spec); };
  let L = build();
  const laidNow = () => { const a = Array(L.size).fill(null); for (const [c, p] of Object.entries(wanted)) if (!pinned.has(Number(c))) a[c] = p; return a; };
  const res0 = check(L, laidNow());
  if (!res0.solved) return no(`not solved: ${res0.messages[0]}`);
  if (o.drawOnly) { spec.sols = [Object.fromEntries(laidNow().map((p, c) => [c, p]).filter(([, p]) => p))]; return { spec, L }; }
  // ---- one answer: pillars first, then pins, clicks and bridges where another answer goes another way
  const maxSols = o.maxSols || 1, limit = o.limit || 3e5, ex = o.extras || {}, target = o.nodes || 3000;
  const key = a => a.map(p => p || "").join(",");
  const mine = () => key(laidNow());                 // pins come and go, so the answer's own squares do too
  const routeSq = new Set([...Object.keys(wanted).map(Number), ...spec.pins.map(p => p.c), ...spec.trains.flatMap(t => [t.barrel.c, t.sink.c])]);
  const added = { pins: [], bridges: [], clicks: [] };
  const settled = s => !s.aborted && s.sols.length <= maxSols;
  const solveL = (lim = limit) => solve(L, maxSols + 1, lim);
  const freeSq = [];
  for (let c = 0; c < L.size; c++) if (!routeSq.has(c) && !gone.has(c)) { setMap(c, "#"); freeSq.push(c); }
  L = build();
  for (let guard = 0; guard < 40; guard++) {
    const s = solveL();
    if (s.aborted) return no("abort 1");
    if (settled(s)) break;
    const me = mine(), alt = pick(r, s.sols.filter(x => key(x.laid) !== me)).laid, opts = [];
    alt.forEach((p, c) => {
      if (L.fixed[c]) return;
      const w = wanted[c];
      if (w && w !== p && p) {
        if (added.pins.length < (ex.pins ?? 0)) opts.push(["pin", c]);
        const wt = topLayer(pieceOf(w).kind), at = topLayer(pieceOf(p).kind);
        if (at > wt && L.cap[c] === 3 && wt < 3 && added.bridges.length < (ex.bridges ?? 0)) opts.push(["bridge", c]);
        if (pieceOf(w).kind.startsWith("S") && added.clicks.length < (ex.clicks ?? 0) && L.click[c] < 0) opts.push(["click", c]);
      }
    });
    // with nothing the recipe offers left, a pin is the last resort
    if (!opts.length && o.lastResortPins !== false) for (const [c, w] of Object.entries(wanted)) if (!L.fixed[c] && alt[c] !== w) opts.push(["pin", Number(c)]);
    if (!opts.length) return no("no way to one answer");
    const [what, c] = pick(r, opts);
    if (what === "bridge") { setMap(c, String(topLayer(pieceOf(wanted[c]).kind))); added.bridges.push(c); }
    else if (what === "pin") {
      const { kind, rot } = pieceOf(wanted[c]);
      addPin({ c, kind, rot, train: trainAt.get(c) ?? 0 }); added.pins.push(c);
      spec.clicks = spec.clicks.filter(k => k.c !== c); added.clicks = added.clicks.filter(x => x !== c);
    } else {
      const res = check(L, laidNow());
      spec.clicks.push({ c, dir: res.M.dir[c * SLOTS] ? "ccw" : "cw" }); added.clicks.push(c);
    }
    L = build();
  }
  let fin = solveL();
  if (!settled(fin) || !fin.sols.some(x => key(x.laid) === mine())) return no("not one");
  // the pillars come out while the answer stays one and the work stays under the target (a filled plate keeps them)
  let pillars = freeSq.slice();
  if (!o.full) for (const c of shuffled(freeSq, r)) {
    setMap(c, ".");
    const t = build(), s = solve(t, maxSols + 1, Math.max(limit, target * 3));
    if (settled(s) && s.nodes <= target) { pillars.splice(pillars.indexOf(c), 1); L = t; fin = s; } else setMap(c, "#");
  }
  // whatever the answer doesn't need goes again
  const tryDrop = (list, take) => {
    for (const c of shuffled(list.slice(), r)) {
      const undo = take(c), t = build();
      if (settled(solve(t, maxSols + 1, limit))) { list.splice(list.indexOf(c), 1); L = t; } else undo();
    }
  };
  tryDrop(added.bridges, c => { const was = spec.map[Math.floor(c / o.cols)][c % o.cols]; setMap(c, "."); return () => setMap(c, was); });
  tryDrop(added.pins, c => { const i = spec.pins.findIndex(p => p.c === c), pin = spec.pins.splice(i, 1)[0]; pinned.delete(c); return () => { spec.pins.splice(i, 0, pin); pinned.add(c); }; });
  tryDrop(added.clicks, c => { const i = spec.clicks.findIndex(p => p.c === c), k = spec.clicks.splice(i, 1)[0]; return () => spec.clicks.splice(i, 0, k); });
  // ---- spares: pieces of the trains' channels the answer does not need, added while the answer stays one
  if (o.spares) {
    const used = Object.entries(wanted).filter(([c]) => !pinned.has(Number(c))).map(([, p]) => pieceOf(p));
    const pool = [];
    for (const t of o.trains) for (const fam of ["S", "D", "T"]) if (fam === "S" || t.fams[fam]) for (const kind of cat[fam]) {
      const p = parseKind(kind);
      if (p.m !== t.m || p.l !== t.l) continue;
      if (fam !== "S" && !used.some(u => parseKind(u.kind).f === fam)) continue;
      for (const rot of orientations(kind)) pool.push(spec.rotate ? kind : pieceStr(kind, rot));
    }
    // prefer the kinds already in the hand (a spare that looks like the answer's pieces tempts)
    const inHand = new Set(used.map(u => (spec.rotate ? u.kind : pieceStr(u.kind, canonRot(u.kind, u.rot)))));
    const ranked = shuffled([...new Set(pool)], r).sort((a, b) => (inHand.has(b) ? 1 : 0) - (inHand.has(a) ? 1 : 0));
    let got = 0;
    for (const k of ranked) {
      if (got >= o.spares) break;
      spareKeys.push(k);
      const t = build(), s = solve(t, maxSols + 1, Math.max(limit, target * 4));
      if (settled(s)) { L = t; fin = s; got++; } else spareKeys.pop();
    }
    if (got < o.spares) return no("spares");
  }
  L = build();
  fin = solve(L, maxSols + 1, Math.max(limit, target * 4));
  if (!settled(fin) || !fin.sols.some(x => key(x.laid) === mine())) return no("final");
  spec.sols = fin.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)));
  const placed = Object.keys(wanted).filter(c => !pinned.has(Number(c))).length;
  return { spec, L, nodes: fin.nodes, placed, pillars: pillars.length, extras: { pins: added.pins.length, clicks: added.clicks.length, bridges: added.bridges.length } };
}
