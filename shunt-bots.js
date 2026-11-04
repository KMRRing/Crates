// Shunt's players that are not people: a random one, a greedy one and a beam search over the known queue and the hold. The page's
// Hint is the beam run in time slices (`search`), the levels' goals and stars are set with the beam, and the tests use all three.
import { fresh, swap, shove, legalEntries, canSwap, over, judge, goalCheck } from "./shunt-engine.js";

/** A seeded random stream (mulberry32): 0 up to but not including 1. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Every action from s: { sw (swap first?), e, t (the state to shove from) }. */
export function actions(s) {
  const out = [], opts = [[0, s]];
  if (canSwap(s)) opts.push([1, swap(s)]);
  for (const [sw, t] of opts) for (const e of legalEntries(t)) out.push({ sw, e, t });
  return out;
}
const finish = s => { const J = judge(s); return { score: J.score, ok: goalCheck(s, J).ok, jams: J.jams }; };

export function playRandom(L, seed) {
  const R = rng(seed);
  let s = fresh(L);
  while (!over(s)) {
    if (canSwap(s) && R() < 0.2) s = swap(s);
    const es = legalEntries(s);
    s = shove(s, es[Math.floor(R() * es.length)]).s;
  }
  return finish(s);
}
/** The shove with the best immediate score; ties broken at random (or by more meshes when edgesTie). */
export function playGreedy(L, seed, edgesTie) {
  const R = rng(seed);
  let s = fresh(L);
  while (!over(s)) {
    let best = -1e9, pick = [];
    for (const a of actions(s)) {
      const J = judge(shove(a.t, a.e).s), v = J.score * 100 + (edgesTie ? J.edges : 0);
      if (v > best) { best = v; pick = [a]; } else if (v === best) pick.push(a);
    }
    const a = pick[Math.floor(R() * pick.length)];
    s = shove(a.t, a.e).s;
  }
  return finish(s);
}
/** How good a state looks to the beam: the score, the goal's parts (trains, jewels, no jam), meshes, and a win above all. */
export function value(s, J) {
  const g = goalCheck(s, J), gl = s.goal;
  let v = J.score;
  if (gl.trains) { const sz = J.comps.filter(t => !t.jam).map(t => Math.min(t.n, gl.trains.m)).sort((a, b) => b - a); for (let i = 0; i < gl.trains.k; i++) v += (sz[i] || 0) * 4; }
  if (gl.jewels) v += g.parts.find(p => p.id === "jewels").have * 12;
  if (gl.nojam) v -= J.jams * 30;
  return v + J.edges * 1.2 + (g.ok ? 1e5 : 0);
}
const keyOf = s => `${s.cells.join()}|${s.hold}|${s.q.join()}`;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * A beam search in time slices, so a page stays alive: step(ms) works for about ms and returns true when finished; result()
 * is { ok (the goal is met), score, path ([swap?, entry] pairs), first, s }. noHold leaves the hold slot unused.
 */
export function search(s0, width, noHold = false) {
  let layer = [{ s: s0, path: [] }], next = new Map(), i = 0, best = null;
  const leaf = n => { const J = judge(n.s), v = value(n.s, J); if (!best || v > best.v) best = { v, J, s: n.s, path: n.path }; };
  return {
    step(ms) {
      const t0 = now();
      while (layer.length) {
        while (i < layer.length) {
          const n = layer[i++];
          if (over(n.s)) leaf(n);
          else {
            for (const a of actions(n.s)) {
              if (noHold && a.sw) continue;
              const r = shove(a.t, a.e), key = keyOf(r.s);
              if (next.has(key)) continue;
              const c = { s: r.s, path: n.path.concat([[a.sw, a.e]]) };
              c.v = value(c.s, judge(c.s));
              next.set(key, c);
            }
          }
          if (ms !== Infinity && now() - t0 > ms) return false;
        }
        layer = [...next.values()].sort((a, b) => b.v - a.v).slice(0, width);
        next = new Map();
        i = 0;
      }
      return true;
    },
    result() {
      if (!best) return { ok: false, score: 0, path: [], first: null, s: s0 };
      return { ok: goalCheck(best.s, best.J).ok, score: best.J.score, path: best.path, first: best.path[0] || null, s: best.s, jams: best.J.jams };
    },
  };
}
/** The beam to the end, from the level's first state. */
export function beam(L, width, noHold = false) {
  const sr = search(fresh(L), width, noHold);
  sr.step(Infinity);
  return sr.result();
}
/** Wins (percent), best and mean scores of the three players over `runs` seeds. */
export function study(L, { runs = 200, offset = 0 } = {}) {
  const res = { random: 0, greedy: 0, greedy2: 0, randomBest: 0, greedyBest: 0, randomAvg: 0, greedyAvg: 0 };
  for (let i = 0; i < runs; i++) {
    const r = playRandom(L, offset + i + 1), g = playGreedy(L, offset + i + 1, false), g2 = playGreedy(L, offset + i + 1, true);
    res.random += r.ok; res.greedy += g.ok; res.greedy2 += g2.ok;
    res.randomBest = Math.max(res.randomBest, r.score); res.greedyBest = Math.max(res.greedyBest, g.score);
    res.randomAvg += r.score / runs; res.greedyAvg += g.score / runs;
  }
  for (const k of ["random", "greedy", "greedy2"]) res[k] = Math.round(100 * res[k] / runs);
  return res;
}
