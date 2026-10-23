// Slipway's yard: the carved parts put together. No page here (tests/slipway-yard.mjs runs it in Node); slipway.js takes
// the taps and slipway-yard-3d.js draws the assembly.
//
// An assembly is some of the cog's parts and the joints between them. A joint is fastened with what the player has made
// and what a fastening is worth depends on the joint: a wedge drives a mast tight, a treenail pins a knee or a scarf
// and a lashing alone is all a yard that must slide can have. The fastenings are the small parts carved at the bench,
// treenails, wedges and belaying pins, and how many there are comes from how well they were carved, so the bench feeds
// the yard: a drawer of good pegs is more of them. Each part of an assembly counts as strong as its carving was, and an
// assembly opens once its parts and the three fastenings are carved. When the player has fastened what they
// choose, the gale comes: every joint has a load that is known only as a band (the forecast), the gale draws one load
// from each, and a joint holds if the fastenings it has, as strong as the weaker of the parts they join, are worth
// that much. What there is to decide is where to spend what is scarce, and how much to trust the forecast.
import { rng, PARTS } from "./slipway-carve.js";

export const MAX_ON = 4;                                   // fastenings on one joint (a lashing is at most one of them)
export const MORE = [1, 0.7, 0.4];                         // the second of a kind on a joint is worth 0.7 of the first, the third 0.4
export const WEAK = 0.6;                                   // how strong a part is at a score of 30, against 1 from 90 (three stars)
export const SLACK3 = 1.15;                                // fastenings allowed over the least that would have held, for three stars (a seventh as many again, and one)
export const SLACK2 = 1.6;                                 // and for two (three fifths as many again, and two)

/** What fastens: the lashing is free and one to a joint; the rest are the parts carved at the bench. */
export const FIXINGS = [
  { id: "lash", name: "Lashing", part: null },
  { id: "treenail", name: "Treenail", part: "treenail" },
  { id: "wedge", name: "Wedge", part: "wedge" },
  { id: "pin", name: "Belaying pin", part: "pin" },
];
const IDS = FIXINGS.map(f => f.id);

/** The kinds of joint: what each fastening is worth on it (a missing one can't be used), and why. */
export const KINDS = {
  stand: { name: "Mast step", value: { lash: 1, treenail: 2, wedge: 3 }, why: "Wedges round the foot hold a mast upright." },
  hoist: { name: "Hoist", value: { lash: 2, pin: 1.5 }, why: "A yard that slides: lash it, belay the halyard." },
  sling: { name: "Block sling", value: { lash: 2, treenail: 2.5, pin: 1.5 }, why: "Hung from the masthead: a peg through the hole." },
  scarf: { name: "Scarf", value: { lash: 1, treenail: 3, wedge: 2 }, why: "Lapped end on end: pegs through the lap." },
  knee: { name: "Knee", value: { lash: 1, treenail: 3, wedge: 1.5 }, why: "Frame to beam: pegs; a wedge would split it." },
  helm: { name: "Tiller in its mortise", value: { lash: 2, wedge: 3, pin: 1 }, why: "Wedged in its mortise, so it comes out again." },
  hang: { name: "Rudder on its post", value: { lash: 1.5, treenail: 2, pin: 1 }, why: "Hung on its post, it must swing: few pegs." },
};

/**
 * The assemblies, each some of the cog's parts and the joints between them. `load` is the forecast band, in the same
 * units as a fastening's worth; the gale draws a load anywhere in it.
 */
export const ASSEMBLIES = [
  { id: "deck", name: "A double block", line: "Two blocks hung from a deck beam: the first lesson in what holds what.",
    parts: ["beam", "sheave"],
    joints: [
      { id: "blockA", kind: "sling", a: "sheave", b: "beam", load: [2.5, 4.2] },
      { id: "blockB", kind: "sling", a: "sheave", b: "beam", load: [2.9, 4.8] },
    ] },
  { id: "hull", name: "The hull", line: "The stem rises from the keel to the rib, and the beam crosses the top of the rib.",
    parts: ["stem", "frame", "beam"],
    joints: [
      { id: "scarf", kind: "scarf", a: "stem", b: "frame", load: [3.3, 5.7] },
      { id: "kneeL", kind: "knee", a: "frame", b: "beam", load: [3.1, 5.3] },
      { id: "kneeR", kind: "knee", a: "frame", b: "beam", load: [3.1, 5.3] },
    ] },
  { id: "helm", name: "The helm", line: "The rudder hangs on the post and the tiller goes through its head.",
    parts: ["rudder", "tiller", "stem"],
    joints: [
      { id: "mortise", kind: "helm", a: "tiller", b: "rudder", load: [3.5, 5.8] },
      { id: "post", kind: "hang", a: "rudder", b: "stem", load: [3.5, 5.8] },
    ] },
  { id: "rig", name: "Mast and yard", line: "The mast stands on the deck beam; the yard goes up it and the block hangs from the masthead.",
    parts: ["beam", "mast", "yard", "sheave"],
    joints: [
      { id: "step", kind: "stand", a: "mast", b: "beam", load: [3.7, 6] },
      { id: "hoist", kind: "hoist", a: "yard", b: "mast", load: [3, 4.8] },
      { id: "sling", kind: "sling", a: "sheave", b: "mast", load: [2.8, 4.6] },
    ] },
  { id: "cog", name: "The cog", line: "Everything at once: the rig, the hull and the helm, with only what you have made to fasten them.",
    parts: ["beam", "mast", "yard", "sheave", "stem", "frame", "tiller", "rudder"],
    joints: [
      { id: "step", kind: "stand", a: "mast", b: "beam", load: [3, 4.8] },
      { id: "hoist", kind: "hoist", a: "yard", b: "mast", load: [2.4, 3.8] },
      { id: "sling", kind: "sling", a: "sheave", b: "mast", load: [2.2, 3.6] },
      { id: "scarf", kind: "scarf", a: "stem", b: "frame", load: [3, 4.8] },
      { id: "kneeL", kind: "knee", a: "frame", b: "beam", load: [2.6, 4.2] },
      { id: "kneeR", kind: "knee", a: "frame", b: "beam", load: [2.6, 4.2] },
      { id: "mortise", kind: "helm", a: "tiller", b: "rudder", load: [2.8, 4.4] },
      { id: "post", kind: "hang", a: "rudder", b: "stem", load: [2.8, 4.4] },
    ] },
];

// ---------- what the bench has made ----------
export const starsOf = score => (score >= 90 ? 3 : score >= 75 ? 2 : score >= 55 ? 1 : 0);
/** How strong a part is for the score it was carved to: 0.77 at a star's 55, 0.9 at two stars' 75 and 1 from three stars' 90. */
export const strength = score => WEAK + (1 - WEAK) * Math.max(0, Math.min(1, ((score ?? 0) - 30) / 60));
/** How many of each fastening there are, from the scores of the parts carved: the better the carving, the fewer split. */
export function stock(scores) {
  const s = id => starsOf(scores[id] ?? 0);
  return { lash: Infinity, treenail: 2 + 2 * s("treenail"), wedge: 1 + s("wedge"), pin: 1 + s("pin") };
}

// ---------- fastening a joint ----------
/** A joint's fastenings as counts by kind: { treenail: 2, … } (none where it has none). */
export const onJoint = (run, id) => run.fix[id] ?? {};
const total = f => IDS.reduce((n, k) => n + (f[k] ?? 0), 0);
/** What the fastenings (counts by kind) are worth on a joint of this kind, before the parts' strength. */
export function worth(kind, f) {
  const v = KINDS[kind].value;
  let sum = 0;
  for (const id of IDS) { const n = f[id] ?? 0; for (let i = 0; i < n; i++) sum += (v[id] ?? 0) * MORE[Math.min(i, MORE.length - 1)]; }
  return sum;
}
/** How strong a joint is: the fastenings' worth, as strong as the weaker of the two parts. */
export const holdOf = (assembly, joint, f, scores) => worth(joint.kind, f) * Math.min(strength(scores[joint.a]), strength(scores[joint.b]));
export const allowed = (joint, id) => KINDS[joint.kind].value[id] != null;

/** How many of a fastening are used across the assembly. */
export const usedOf = (run, id) => Object.values(run.fix).reduce((n, f) => n + (f[id] ?? 0), 0);
/** Whether one more of a fastening can go on a joint: the kind takes it, the joint has room and the stock lasts. */
export function canAdd(assembly, run, jointId, id, scores) {
  const j = assembly.joints.find(x => x.id === jointId), f = onJoint(run, jointId);
  if (!j || run.done || !allowed(j, id) || total(f) >= MAX_ON) return false;
  if (id === "lash") return !(f.lash > 0);
  return usedOf(run, id) < stock(scores)[id];
}
/** Puts one on (+1) or takes one off (-1): returns whether it changed. */
export function fasten(assembly, run, jointId, id, d, scores) {
  const f = (run.fix[jointId] ??= {});
  if (d > 0 ? !canAdd(assembly, run, jointId, id, scores) : run.done || !(f[id] > 0)) return false;
  f[id] = (f[id] ?? 0) + d;
  if (!f[id]) delete f[id];
  if (!Object.keys(f).length) delete run.fix[jointId];
  return true;
}

// ---------- the gale ----------
/** The loads the gale from this seed puts on the joints (each drawn from the joint's own band). */
export function gale(assembly, seed) {
  const r = rng(seed);
  return Object.fromEntries(assembly.joints.map(j => [j.id, j.load[0] + (j.load[1] - j.load[0]) * r()]));
}
/** The fewest fastenings (other than the lashing, which is free) that would have held a joint against a load. */
export function leastFor(joint, load, q) {
  const ids = IDS.filter(id => id !== "lash" && allowed(joint, id));
  let best = Infinity;
  const go = (at, f, n) => {
    if (n >= best) return;
    if (worth(joint.kind, { ...f, lash: allowed(joint, "lash") ? 1 : 0 }) * q >= load) { best = n; return; }
    if (at === ids.length || n + 1 >= best || n >= MAX_ON - 1) return;
    for (let c = 0; c <= MAX_ON - 1 - n; c++) go(at + 1, { ...f, [ids[at]]: c }, n + c);
  };
  go(0, {}, 0);
  return best === Infinity ? MAX_ON : best;
}
/** The fewest fastenings that would have held the whole assembly against a gale: what a hand that knew the sea would have used. */
export const parOf = (assembly, loads, scores) =>
  assembly.joints.reduce((n, j) => n + leastFor(j, loads[j.id], Math.min(strength(scores[j.a]), strength(scores[j.b]))), 0);

// ---------- a run ----------
export const newRun = (index, seed) => ({ job: index, seed: seed >>> 0, fix: {}, tries: 0, done: null });
/** A seed for the next gale after one that took a joint (the sea is never the same twice). */
export const nextSeed = seed => (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
/**
 * The gale: every joint holds or doesn't. Returns { joints: [{ id, hold, load, ok }], held, used, par, stars }. When it all
 * holds the run is closed with its stars (3 if it used little more than the least that would have held, 2 if a good deal
 * more, else 1); when a joint goes the run goes on with the fastenings as they are and a new gale to come.
 */
export function launch(assembly, run, scores) {
  const loads = gale(assembly, run.seed);
  const joints = assembly.joints.map(j => {
    const hold = holdOf(assembly, j, onJoint(run, j.id), scores);
    return { id: j.id, hold, load: loads[j.id], ok: hold >= loads[j.id] };
  });
  const held = joints.every(j => j.ok), used = IDS.reduce((n, id) => n + (id === "lash" ? 0 : usedOf(run, id)), 0), par = parOf(assembly, loads, scores);
  const thrift = used <= Math.ceil(par * SLACK3) + 1 ? 3 : used <= Math.ceil(par * SLACK2) + 2 ? 2 : 1;
  const stars = held ? Math.max(1, thrift - run.tries) : 0;
  if (held) run.done = { stars, used, par, tries: run.tries };
  else { run.tries++; run.seed = nextSeed(run.seed); }
  return { joints, held, used, par, stars };
}
/** What the line under the assembly says before the gale. */
export function summary(assembly, run, scores) {
  const left = stock(scores);
  const has = id => left[id] - usedOf(run, id);
  return `Left: ${has("treenail")} treenail${has("treenail") === 1 ? "" : "s"}, ${has("wedge")} wedge${has("wedge") === 1 ? "" : "s"}, ${has("pin")} pin${has("pin") === 1 ? "" : "s"}.`;
}
/** The stars the games screen counts for Slipway: those for the parts carved and for the assemblies fitted. */
export const starsTotal = (scores, fitted) => PARTS.reduce((n, p) => n + starsOf(scores[p.id] ?? 0), 0) + ASSEMBLIES.reduce((n, a) => n + (fitted[a.id] ?? 0), 0);
/** What an assembly still wants carved before it opens: its own parts and the three fastenings. */
export const missing = (assembly, scores) => [...new Set([...assembly.parts, ...FIXINGS.map(f => f.part).filter(Boolean)])].filter(id => scores[id] == null);
/** A run the page keeps, if it is whole and of an assembly that exists; else null. */
export function sound(run) {
  if (!run || !ASSEMBLIES[run.job] || !Number.isFinite(run.seed) || typeof run.fix !== "object" || !run.fix) return null;
  const a = ASSEMBLIES[run.job];
  for (const [id, f] of Object.entries(run.fix)) {
    if (!a.joints.some(j => j.id === id) || typeof f !== "object" || !f) return null;
    for (const [k, n] of Object.entries(f)) if (!IDS.includes(k) || !Number.isInteger(n) || n < 1 || n > MAX_ON) return null;
  }
  return run;
}
