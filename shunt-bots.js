// Shunt's players that are not people: a random one, a greedy one and a beam search over the known queue and the hold. The page's
// Hint is the beam run in time slices (`search`), the levels' goals and stars are set with the beam (`longest`), and the tests use all
// three. Each aims at trains of a size (`aim`: the goal's, unless asked for more), the number of them the goal's.
import { fresh, swap, shove, legalEntries, canSwap, over, judge, goalCheck, reach, covered, progress } from "./shunt-engine.js";

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
const ks = s => s.goal.trains?.k || 1;
const finish = s => { const J = judge(s); return { reach: reach(J, ks(s)), sizes: J.sizes, ok: goalCheck(s, J).ok, jams: J.jams }; };

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
/** The shove that looks best at once (`value`, aiming at `aim`); ties broken at random. */
export function playGreedy(L, seed, aim) {
  const R = rng(seed);
  let s = fresh(L);
  while (!over(s)) {
    let best = -1e9, pick = [];
    for (const a of actions(s)) {
      const n = shove(a.t, a.e).s, v = value(n, judge(n), aim);
      if (v > best) { best = v; pick = [a]; } else if (v === best) pick.push(a);
    }
    const a = pick[Math.floor(R() * pick.length)];
    s = shove(a.t, a.e).s;
  }
  return finish(s);
}
/** How good a state looks to the beam: the goal's number of trains grown towards `aim` gears each (the goal's size unless more is
 *  asked), jewels covered, jams where the goal forbids them, meshes, and the goal met above all. aim Infinity: climbing, the goal's
 *  size left aside, its trains as long as they will go (each one gear longer than they all are), with its other conditions met. */
export function value(s, J, aim) {
  const gl = s.goal, k = ks(s), climb = aim === Infinity, r = climb ? reach(J, k) : 0;
  let v = progress(J, k, climb ? Math.max(3, r + 1) : aim || gl.trains?.m || 3) * 10;
  const jw = gl.jewels ? covered(s, J) : 0;
  if (gl.jewels) v += jw * 12;
  if (gl.nojam) v -= J.jams * 30;
  const won = climb ? r >= 3 && (!gl.jewels || jw === s.jewels.length) && (!gl.nojam || J.jams === 0) : goalCheck(s, J).ok;
  return v + J.edges * 1.2 + (won ? 1e5 + r * 1000 : 0);
}
const keyOf = s => `${s.cells.join()}|${s.hold}|${s.q.join()}`;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * A beam search in time slices, so a page stays alive: step(ms) works for about ms and returns true when finished; result()
 * is { ok (the goal is met), reach (the size the goal's number of trains reach), sizes, path ([swap?, entry] pairs), first, s }.
 * noHold leaves the hold slot unused; aim: the size of train to climb towards (the goal's unless given).
 */
export function search(s0, width, noHold = false, aim = 0) {
  let layer = [{ s: s0, path: [] }], next = new Map(), i = 0, best = null;
  const leaf = n => { const J = judge(n.s), v = value(n.s, J, aim); if (!best || v > best.v) best = { v, J, s: n.s, path: n.path }; };
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
              c.v = value(c.s, judge(c.s), aim);
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
      if (!best) return { ok: false, reach: 0, sizes: [], path: [], first: null, s: s0 };
      return { ok: goalCheck(best.s, best.J).ok, reach: reach(best.J, ks(best.s)), sizes: best.J.sizes, path: best.path, first: best.path[0] || null, s: best.s, jams: best.J.jams };
    },
  };
}
/** The beam to the end, from the level's first state. */
export function beam(L, width, noHold = false, aim = 0) {
  const sr = search(fresh(L), width, noHold, aim);
  sr.step(Infinity);
  return sr.result();
}
/**
 * The longest trains a plate allows, as far as the beam finds: the goal's number of them (k), its other conditions met. A climbing beam
 * first, then a beam aimed one gear longer than the best so far, again while one gets there. Returns { m (each of the k trains at
 * least that long), line (its [swap?, entry] pairs) }, or null with no k trains at all. In slices like `search`: step(ms), result().
 */
export function longest(L, k, { width = 40, noHold = false, swapFirst = false } = {}) {
  // swapFirst: the line must begin with a swap (a level that teaches the hold shows it on its first turn)
  const at = m => { const s = fresh({ ...L, goal: { ...L.goal, trains: { k, m } } }); return swapFirst ? swap(s) : s; };
  const lineOf = path => (swapFirst && path.length ? [[1, path[0][1]], ...path.slice(1)] : path);
  let got = null, sr = search(at(3), width, noHold, Infinity), climbing = true, fin = false;
  return {
    step(ms) {
      const t0 = now();
      while (!fin) {
        if (!sr.step(ms === Infinity ? Infinity : Math.max(1, ms - (now() - t0)))) return false;
        const r = sr.result(), ok = climbing ? r.reach >= 3 && r.ok : r.ok;
        if (ok && (!got || r.reach > got.m)) got = { m: r.reach, line: lineOf(r.path) };
        if (!ok && !climbing) { fin = true; break; }
        if (!got) { fin = true; break; }
        climbing = false;
        sr = search(at(got.m + 1), width, noHold);
        if (ms !== Infinity && now() - t0 > ms) return false;
      }
      return true;
    },
    result: () => got,
  };
}
/** Wins (percent) and the mean length the goal's trains reach, of the random and the greedy players over `runs` seeds. */
export function study(L, { runs = 200, offset = 0 } = {}) {
  const res = { random: 0, greedy: 0, randomReach: 0, greedyReach: 0 };
  for (let i = 0; i < runs; i++) {
    const r = playRandom(L, offset + i + 1), g = playGreedy(L, offset + i + 1);
    res.random += r.ok; res.greedy += g.ok;
    res.randomReach += r.reach / runs; res.greedyReach += g.reach / runs;
  }
  for (const k of ["random", "greedy"]) res[k] = Math.round(100 * res[k] / runs);
  return res;
}
