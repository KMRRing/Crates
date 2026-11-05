// Slipway's generator: a part for Random and for Today's, composed from the features of slipway-build.js, each with the
// tool it asks for. What it may use is what the player has met (`reach` chapters); the order the tools must come in
// follows from the rules, not from the generator. The solution is built with the part, and the par is its length:
// tests/slipway-search.mjs proves by the exhaustive search that nothing is shorter, for a hundred seeds and the next
// fortnight's dailies. The same seed gives the same part on every phone (a mulberry32 stream).
import { build } from "./slipway-build.js";
import { play, status } from "./slipway-puzzle.js";

/** A stream of numbers in [0, 1) from a seed. */
export function rng(seed) {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NAMES = ["Fid", "Cleat", "Davit", "Bitt", "Thole", "Knee", "Rib", "Chock", "Cringle", "Sheave", "Lanyard", "Spar", "Batten", "Wedge", "Thimble", "Gudgeon", "Pintle", "Keelson", "Stringer", "Quoin"];
const SPOTS = ["mast", "hull", "rig", "rudder", "bow", "deck", "keel"];
/** The tools a player has met after `reach` chapters (1..6). */
export const toolsFor = (chapters, reach) => new Set(chapters.slice(0, reach).flatMap(c => c.tools));

/**
 * The part for a seed: { ...level, id, name, spot, seed }. `chapters` is slipway-levels.js's CHAPTERS; `reach` how many the
 * player has opened (at least one). A part is a straight bar with features along it, or, when the adze and the
 * spokeshave are open and the dice say so, a round-topped bar.
 */
export function generate(seed, chapters, reach = 6) {
  for (let tries = 0; tries < 12; tries++) {
    const level = attempt(seed * 13 + tries, chapters, Math.max(1, Math.min(6, reach)));
    if (level) {
      const r = play(level);
      if (r.results.every(x => x.ok) && status(r.b).solved) return { ...level, seed };
    }
  }
  throw new Error(`Slipway: no part for seed ${seed}`);
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const rnd = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

function attempt(seed, chapters, reach) {
  const r = rng(seed), have = toolsFor(chapters, reach), saw = have.has("saw");
  const round = have.has("adze") && have.has("shave") && r() < 0.4;
  const spec = { features: [] }, f = spec.features;
  let L, H, W;
  if (round) {
    W = 12; H = 12; L = rnd(r, 22, 26);
    const trim = saw && r() < 0.5 ? 3 : 0, x0 = trim ? 0 : 0, x1 = L - trim;
    if (trim) f.push(["trim", { end: "r", a: 3 }]);
    if (have.has("drill") && r() < 0.6) f.push(["hole", { axis: 1, at: [rnd(r, 6, 8), 6] }]);
    if (saw && r() < 0.6) f.push(["slope", { end: "l", run: 10, drop: 7 }]);
    const leftSlope = f.some(x => x[0] === "slope");
    const adzeAt = [], reachLo = leftSlope ? 10 : 0;
    for (let x = reachLo + (leftSlope ? 3.5 : 4); x - 4.5 < x1; x += 8.5) adzeAt.push(Math.round(Math.min(x, x1 - 4.4) * 100) / 100);
    f.push(["crown", { sag: 5, adze: adzeAt, shave: [2.4, 9.6] }]);
    spec.size = [L, H, W];
  } else {
    const dishOk = have.has("gouge"), chisel = have.has("chisel") && have.has("kerf"), plane = have.has("plane"), drill = have.has("drill");
    const dish = dishOk && r() < 0.4;
    W = dish ? 11 : pick(r, [7, 7, 8]);
    const Ht = rnd(r, 9, 11);
    let cap = saw && r() < 0.65 ? rnd(r, 3, 4) : 0;
    // the two ends, then what goes between
    const left = pick(r, ["none", ...(saw ? ["slope", "trim"] : []), ...(saw && drill ? ["trimhole"] : [])]);
    const right = pick(r, ["none", ...(saw ? ["slope", "trim"] : [])]);
    if (left === "slope" && right === "slope") cap = 0;                // two slopes meet over the top and do the capping themselves
    H = Ht + cap;
    const mids = [];
    const pockets = [...(chisel ? ["chisel"] : []), ...(plane ? ["plane"] : [])];
    if (pockets.length && r() < 0.75) mids.push(pick(r, pockets));
    if (dish) mids.push("dish");
    if (drill && r() < 0.6 && left !== "trimhole") mids.push("hole");
    // the least a part is: two things
    if (left === "none" && right === "none" && !mids.length) return null;
    let x = 1;
    const place = (kind, w) => { const at = x; x += w + 2; return at; };
    if (left === "trim") { f.push(["trim", { end: "l", a: 3 }]); place("trim", 3); }
    if (left === "trimhole") { f.push(["trim", { end: "l", a: 3 }]); f.push(["hole", { axis: 1, at: [5.7, W / 2] }]); x = 10; }
    if (left === "slope") { const run = rnd(r, 7, 9); f.push(["slope", { end: "l", run, drop: rnd(r, 4, 5) }]); x = run + 2; }
    const midX = {};
    for (const m of mids) midX[m] = place(m, m === "dish" ? 8 : m === "hole" ? 4 : m === "chisel" ? 6 : 8);
    let rightW = 0;
    if (right === "slope") rightW = rnd(r, 7, 9); else if (right === "trim") rightW = 3;
    L = Math.min(38, Math.max(20, Math.ceil(x + rightW + 1)));
    if (right === "trim") f.push(["trim", { end: "r", a: 3 }]);
    if (right === "slope") f.push(["slope", { end: "r", run: rightW, drop: rnd(r, 4, 5) }]);
    for (const m of mids) {
      const a = midX[m];
      if (m === "chisel") f.push(["pocket", { x0: a, x1: a + 6, depth: rnd(r, 6, 8), via: "chisel" }]);
      else if (m === "plane") f.push(["pocket", { x0: a, x1: a + 8, depth: rnd(r, 2, 3), via: "plane" }]);
      else if (m === "dish") f.push(["dish", { at: [a + 4, W / 2] }]);
      else f.push(["hole", { axis: 1, at: [a + 2, W / 2] }]);
    }
    // an edge eased, where there is a saw to ease it (and a dish to be spoiled by it)
    if (saw && (dish || r() < 0.4)) f.push(["chamfer", { edge: pick(r, ["tf", "tb"]), size: dish ? 3.5 : 3 }]);
    if (cap) spec.cap = cap;
    // a knot in the waste over a planed pocket: the iron stops on it until the saw has been
    const planed = f.find(x => x[0] === "pocket" && x[1].via === "plane");
    if (planed && cap && r() < 0.6) spec.knots = [[(planed[1].x0 + planed[1].x1) / 2, Ht + cap / 2, W / 2, 1.3]];
    spec.size = [L, H, W];
  }
  const level = build(spec);
  if (level.par > 7) return null;                                      // a part is a puzzle, not an afternoon
  const names = pick(r, NAMES);
  return { ...level, id: `r${seed}`, name: names, line: `A ${names.toLowerCase()} for the cog, cut from whatever is on the bench today. No two alike.`, spot: pick(r, SPOTS) };
}
