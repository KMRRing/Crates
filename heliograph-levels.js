// Heliograph's levels, pure (no page): six stations on the coast, five levels each (two gentle ones that bring the station's
// twist, two that put it with what came before, and a set piece). Every level is a puzzle made by hand: a chandelier hung as
// written (`hang`), colour crystals that stay where they stand (`gems`), fixtures (a prism, shutters, a splitter, lamps), mirrors
// to hand and bolted ones (`pins`), and a designed answer (heliograph-answers.js), shot by shot, which tests/heliograph-levels.mjs
// plays through the engine, so no level is out of reach. The stars are for shots: the answer's length is three, one more is two.
// The stations (heliograph-chapters.js) are Heligoland (where you cut), Visby (bolts), Reval (the prism), Bergen (the splitter),
// Danzig (lamps and signals) and Lübeck (cracked glass, then all of it).
import { newGame, fire, plan, beaconsOf, lampsOf, litCount } from "./heliograph-engine.js";
import { CHAPTERS } from "./heliograph-chapters.js";
import { ANSWERS } from "./heliograph-answers.js";
import { ORDER } from "./heliograph-help.js";

export { CHAPTERS, ANSWERS };
export const LEVELS = CHAPTERS.flatMap((c, ci) => c.levels.map((L, k) => ({ ...L, chapter: ci, k, n: 0 }))).map((L, n) => ({ ...L, n }));

/** The rules the engine plays level n by (its `x`). */
export function rulesOf(n) {
  const L = LEVELS[n], x = { lv: n, hang: L.hang, gems: L.gems ?? [], every: 99, shots: L.shots, goal: L.goal };
  for (const k of ["pins", "fix", "sun", "hand", "moves", "first", "port"]) if (L[k] !== undefined) x[k] = L[k];
  return x;
}

/** The stars a game has earned (0 to 3): a star for the goal, one more for each par (in shots) it was met within. A quota (not in the campaign, but the engine has it) is by score. */
export function starsOf(x, s) {
  const g = x?.goal;
  if (!g) return 0;
  if (g.kind === "score") return [g.n, ...g.more].filter(t => s.score >= t).length;
  return s.met ? 1 + g.pars.filter(p => s.metAt <= p).length : 0;
}
/** The stars still within reach of a game in play: those it would have if the goal were met on the next shot. */
export function starsInReach(x, s) {
  const g = x?.goal;
  if (!g || g.kind === "score" || s.over) return starsOf(x, s);
  return 1 + g.pars.filter(p => s.shots + 1 <= p).length;
}

/** What a level has that is worth explaining, by help's ids, in the order they are taught (heliograph-help.js). */
export function featuresOf(x) {
  const has = new Set(), g = x.goal?.kind, fix = x.fix ?? [], hang = Object.values(x.hang ?? {}).join("");
  if (g === "beacons") has.add("beacons");
  if (g === "clear") has.add("clear");
  if (/b/.test(hang)) has.add("bolt");
  if (/f/.test(hang)) has.add("frail");
  if (x.pins?.length) has.add("pin");
  if (g === "lamps" || fix.some(f => f.k === "lamp")) has.add("lamp");
  if (fix.some(f => f.k === "prism")) has.add("prism");
  if (fix.some(f => f.k === "split")) has.add("split");
  if (fix.some(f => f.k === "shutter")) has.add("shutter");
  return ORDER.filter(id => has.has(id));
}

const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The level's goal in a sentence, as the plaque says it before the first move. */
export function goalSentence(x) {
  const g = x.goal, shots = plural(x.shots, "shot"), lamps = (x.fix ?? []).filter(f => f.k === "lamp").length;
  if (g.kind === "score") return `Reach ${fmt(g.n)} in ${shots}`;
  if (g.kind === "beacons") return `Bring down ${plural(beaconsIn(x), "lantern")} in ${shots}`;
  if (g.kind === "lamps") {
    if (g.mode === "together") return `Light ${lamps === 1 ? "the lamp" : `all ${lamps} lamps`} in one shot, in ${shots}`;
    if (g.mode === "order") return `Signal: light the ${lamps} lamps in order, one a shot, in ${shots}`;
    return `Light ${lamps === 1 ? "the lamp" : `all ${lamps} lamps`} in ${shots}`;
  }
  return `Clear the chandelier in ${shots}`;
}
/** How many lanterns a level hangs. */
const beaconsIn = x => Object.values(x.hang ?? {}).join("").replace(/[^l]/g, "").length;
/** The goal in a few words, for the level list. */
export function goalShort(x) {
  const g = x.goal;
  if (g.kind === "score") return `${fmt(g.n)} in ${x.shots}`;
  if (g.kind === "beacons") return `${plural(beaconsIn(x), "lantern")} in ${x.shots}`;
  if (g.kind === "lamps") return g.mode === "order" ? `Signal in ${x.shots}` : g.mode === "together" ? "Lamps at once" : `Lamps in ${x.shots}`;
  return `Clear in ${x.shots}`;
}
/** The goal row's words for a game in play: the goal and how far it has come. */
export function goalWords(x, s) {
  const g = x.goal;
  if (g.kind === "score") return s.met ? `Quota ${fmt(g.n)} met` : `Quota ${fmt(g.n)}`;
  if (g.kind === "beacons") return `Lanterns ${beaconsIn(x) - beaconsOf(s).length} of ${beaconsIn(x)}`;
  if (g.kind === "lamps") return `${g.mode === "order" ? "Signal" : "Lamps"} ${litCount(s)} of ${lampsOf(s).length}`;
  return `Crystals left ${s.layers.reduce((a, l) => a + l.c.filter(c => c >= 0).length, 0)}`;
}
/**
 * How far a game has come on the meter under the goal, 0 to 1, and where the star lines lie on it. The meter is the shots
 * used, the lines where the second and third star are lost (a quota's runs to its last star).
 */
export function meterOf(x, s) {
  const g = x.goal;
  if (g.kind === "score") { const top = g.more[g.more.length - 1]; return { fill: Math.min(1, s.score / top), marks: [g.n / top, ...g.more.slice(0, -1).map(v => v / top)] }; }
  return { fill: Math.min(1, s.shots / x.shots), marks: g.pars.map(p => p / x.shots) };
}

// ---------- the designed answers, and the simple players ----------
/** A game played out by the engine's simple player (`how`: random, glance, keen, best): where it ends. */
export function played(s, how = "best", rnd = Math.random) {
  for (let n = 0; !s.over && n < 80; n++) s = fire(plan(s, how, rnd)).state;
  return s;
}
/** A game of level n. A level is always the same (the seed deals nothing). */
export const dealLevel = (n, seed = 1) => newGame(seed, rulesOf(n));
export { beaconsOf };
