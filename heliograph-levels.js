// Heliograph's levels, pure (no page): six stations on the coast, each four short levels, each station bringing one new
// thing that changes how the light is aimed. A level is the rules the engine plays by (heliograph-engine.js's `x`: its
// chandelier, its goal, its shots, its fixtures) and stands on its own: it is dealt from a seed and the deal is only
// kept if the engine's simple player can win it (`dealLevel`), so no deal is out of reach.
//
//   Heligoland  a quota: so many points in so many shots (the station on its rock, the first heliograph)
//   Visby       beacons: crystals in a brass collar that must come down, the cut that gets them being the puzzle
//   Reval       a prism: a glass in the tube that splits white light into two colours and is never spent
//   Bergen      shutters: brass louvres that stop the light, and some that open and shut with the shots
//   Danzig      the sun: it crosses the sky over the level, the light slanting a little more each shot
//   Lübeck      nothing new: the ways of aiming met so far, two and three at a time; the last level clears the chandelier
import { newGame, fire, plan, beaconsOf } from "./heliograph-engine.js";

const unit = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const lvl = spec => ({ colours: [0, 1, 2], crystals: 2, every: 4, extra: 0, ...spec });
/** A brass shutter: a disc of radius r at p facing n; `cycle` makes it shut and open by the shot's number (1 shut, 0 open). */
const shutter = (p, n, r, cycle) => ({ k: "shutter", p, n: unit(n), r, ...(cycle ? { cycle } : {}) });
const prism = (p, cs) => ({ k: "prism", p, cs });
const score = (n, ...more) => ({ kind: "score", n, more });
const beacons = (...pars) => ({ kind: "beacons", pars });

export const CHAPTERS = [
  {
    name: "Heligoland", about: "The station on its rock. Reach the quota before the shots run out.",
    levels: [
      lvl({ name: "First light", about: "Two colours only, so runs go long.", shape: "column", colours: [0, 1], shots: 6, every: 6, goal: score(800, 1300, 1800) }),
      lvl({ name: "Fair wind", about: "A third colour to cut a run short.", shape: "cone", shots: 7, goal: score(550, 900, 1300) }),
      lvl({ name: "Slack water", about: "A bowl, longest round the edge.", shape: "bowl", shots: 8, goal: score(650, 1100, 1600) }),
      lvl({ name: "Fog bank", about: "Four colours, hung low.", shape: "hollow", colours: [0, 1, 2, 3], extra: 1, every: 3, shots: 8, goal: score(600, 1000, 1450) }),
    ],
  },
  {
    name: "Visby", about: "The fleet's lanterns hang in the chandelier. Bring them down.",
    levels: [
      lvl({ name: "Two lanterns", about: "At the foot of their strings: any cut on a string brings its lantern down.", shape: "column", marks: { n: 2, at: "bottom" }, shots: 8, goal: beacons(5, 3) }),
      lvl({ name: "Night watch", about: "Halfway down: the cut has to be above the lantern.", shape: "cone", marks: { n: 2, at: "mid" }, shots: 10, goal: beacons(8, 6) }),
      lvl({ name: "Masthead", about: "Near the top, under the skirt: from below, up the string.", shape: "bowl", marks: { n: 2, at: "high" }, shots: 11, goal: beacons(9, 7) }),
      lvl({ name: "The fleet", about: "Three lanterns, four colours.", shape: "star", colours: [0, 1, 2, 3], marks: { n: 3, at: "mid" }, shots: 12, goal: beacons(9, 7) }),
    ],
  },
  {
    name: "Reval", about: "The glassmakers' quarter. A prism splits white light in two and is never spent.",
    levels: [
      lvl({ name: "Clear glass", about: "No colour crystals: the prism is all the colour there is.", shape: "cone", crystals: 0, shots: 7, fix: [prism([-2.2, 3.5, 0.8], [0, 1])], goal: score(900, 1350, 1700) }),
      lvl({ name: "Spectrum", about: "One colour crystal as well: the light can carry three colours.", shape: "hollow", colours: [0, 1, 2, 3], crystals: 1, shots: 8, fix: [prism([2.3, 3.2, -1.2], [0, 2])], goal: score(800, 1300, 1700) }),
      lvl({ name: "Dispersion", about: "Lanterns, and a prism to reach them.", shape: "cone", colours: [0, 1, 2, 3], marks: { n: 2, at: "mid" }, shots: 10, fix: [prism([0, 2.5, -2.4], [1, 3])], goal: beacons(8, 5) }),
      lvl({ name: "Rainbow", about: "Four colours, two crystals, one prism.", shape: "spiral", colours: [0, 1, 2, 3], shots: 8, fix: [prism([-2.4, 3, 1.5], [0, 1])], goal: score(900, 1400, 1800) }),
    ],
  },
  {
    name: "Bergen", about: "The wharf's shutters. A shut shutter stops the light.",
    levels: [
      lvl({ name: "Louvre", about: "A shutter under the chandelier: no light straight up the middle.", shape: "cone", shots: 8, fix: [shutter([0, 5, 0], [0, 1, 0], 2.4)], goal: score(350, 600, 900) }),
      lvl({ name: "Partition", about: "A wall across the tube.", shape: "bowl", shots: 8, fix: [shutter([0, 4, 0.5], [0, 0, 1], 2)], goal: score(600, 1000, 1400) }),
      lvl({ name: "Slats", about: "Shut on every other shot, open on the rest.", shape: "hollow", colours: [0, 1, 2, 3], shots: 8, fix: [shutter([0, 5, 0], [0, 1, 0], 2.4, [1, 0])], goal: score(450, 750, 1050) }),
      lvl({ name: "Morse", about: "Two shutters, one shut while the other is open.", shape: "column", marks: { n: 3, at: "mid" }, shots: 11, fix: [shutter([0, 5, 0], [0, 1, 0], 2.4, [1, 0]), shutter([0, 4.5, 0], [1, 0, 0], 3.2, [0, 1])], goal: beacons(9, 7) }),
    ],
  },
  {
    name: "Danzig", about: "The sun crosses the sky over the level, and the light slants a little more each shot.",
    levels: [
      lvl({ name: "Morning watch", about: "Rising: the light slants, then stands upright.", shape: "cone", shots: 8, sun: { from: -24, to: 0 }, goal: score(450, 700, 900) }),
      lvl({ name: "Noon", about: "From east to west across the sky.", shape: "bowl", shots: 8, sun: { from: -26, to: 26 }, goal: score(450, 750, 1000) }),
      lvl({ name: "Afternoon", about: "Lanterns under a sinking sun.", shape: "hollow", marks: { n: 2, at: "mid" }, shots: 10, sun: { from: 0, to: 28 }, goal: beacons(6, 4) }),
      lvl({ name: "Sundown", about: "The whole sky, four colours.", shape: "star", colours: [0, 1, 2, 3], shots: 9, sun: { from: -28, to: 28 }, goal: score(300, 500, 750) }),
    ],
  },
  {
    name: "Lübeck", about: "The Holstentor, where everything meets. Nothing new: the stations' ways of aiming, two and three at a time.",
    levels: [
      lvl({ name: "Customs house", about: "A prism and a shutter that opens and shuts.", shape: "bowl", colours: [0, 1, 2, 3], crystals: 1, shots: 8, fix: [prism([-2.4, 3.2, 1.2], [0, 2]), shutter([0, 5, 0], [0, 1, 0], 2.4, [1, 0])], goal: score(600, 1000, 1400) }),
      lvl({ name: "Salt store", about: "A wall across the tube, and the sun going over it.", shape: "cone", shots: 8, sun: { from: -22, to: 22 }, fix: [shutter([0, 4, 0.5], [0, 0, 1], 2)], goal: score(500, 800, 1100) }),
      lvl({ name: "Steelyard", about: "Lanterns, a prism and the sun.", shape: "hollow", colours: [0, 1, 2, 3], marks: { n: 2, at: "mid" }, shots: 11, sun: { from: -20, to: 20 }, fix: [prism([2.3, 3.2, -1.2], [1, 2])], goal: beacons(7, 4) }),
      lvl({ name: "The Admiralty", about: "Bring down the whole chandelier.", shape: "sprig", every: 99, shots: 14, goal: { kind: "clear", pars: [12, 10] } }),
    ],
  },
];

export const LEVELS = CHAPTERS.flatMap((c, ci) => c.levels.map((L, k) => ({ ...L, chapter: ci, k, n: 0 }))).map((L, n) => ({ ...L, n }));

/** The rules the engine plays level n by (its `x`). */
export function rulesOf(n) {
  const L = LEVELS[n], x = { lv: n, shape: L.shape, colours: L.colours, extra: L.extra, crystals: L.crystals,
    every: L.every, shots: L.shots, goal: L.goal };
  if (L.marks) x.marks = L.marks;
  if (L.fix) x.fix = L.fix;
  if (L.sun) x.sun = L.sun;
  return x;
}

/** The stars a game has earned (0 to 3): by score for a quota, by the shots a goal was met in for the rest. */
export function starsOf(x, s) {
  const g = x?.goal;
  if (!g) return 0;
  if (g.kind === "score") return [g.n, ...g.more].filter(t => s.score >= t).length;
  return s.met ? 1 + g.pars.filter(p => s.metAt <= p).length : 0;
}
/** The stars still within reach of a game in play: those it would have if the goal were met on the next shot (a quota: those its score has). */
export function starsInReach(x, s) {
  const g = x?.goal;
  if (!g || g.kind === "score" || s.over) return starsOf(x, s);
  return 1 + g.pars.filter(p => s.shots + 1 <= p).length;
}

/** What a level has that is worth explaining, by help's ids, in the order they are met. */
export function featuresOf(x) {
  const out = [];
  const g = x.goal?.kind;
  if (g === "score") out.push("quota");
  if (g === "beacons") out.push("beacons");
  if (g === "clear") out.push("clear");
  if (x.fix?.some(f => f.k === "prism")) out.push("prism");
  if (x.fix?.some(f => f.k === "shutter" && !f.cycle)) out.push("shutter");
  if (x.fix?.some(f => f.k === "shutter" && f.cycle)) out.push("blink");
  if (x.sun) out.push("sun");
  return out;
}

const fmt = n => n.toLocaleString("en-GB");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The level's goal in a sentence, as the plaque says it before the first move. */
export function goalSentence(x) {
  const g = x.goal, shots = plural(x.shots, "shot");
  if (g.kind === "score") return `Reach ${fmt(g.n)} in ${shots}`;
  if (g.kind === "beacons") return `Bring down ${x.marks.n === 1 ? "the lantern" : `all ${x.marks.n} lanterns`} in ${shots}`;
  return `Clear the chandelier in ${shots}`;
}
/** The goal in a few words, for the level list. */
export function goalShort(x) {
  const g = x.goal;
  if (g.kind === "score") return `${fmt(g.n)} in ${x.shots}`;
  if (g.kind === "beacons") return `${plural(x.marks.n, "lantern")} in ${x.shots}`;
  return `Clear in ${x.shots}`;
}
/** The goal row's words for a game in play: the goal and how far it has come. */
export function goalWords(x, s) {
  const g = x.goal;
  if (g.kind === "score") return s.met ? `Quota ${fmt(g.n)} met` : `Quota ${fmt(g.n)}`;
  if (g.kind === "beacons") return `Lanterns ${x.marks.n - beaconsOf(s).length} of ${x.marks.n}`;
  return `Crystals left ${s.layers.reduce((a, l) => a + l.c.filter(c => c >= 0).length, 0)}`;
}
/**
 * How far a game has come on the meter under the goal, 0 to 1, and where the star lines lie on it. A quota's meter runs
 * to its last star, the lines at the first two; the others' meter is the shots used, the lines where the second and third
 * star are lost.
 */
export function meterOf(x, s) {
  const g = x.goal;
  if (g.kind === "score") { const top = g.more[g.more.length - 1]; return { fill: Math.min(1, s.score / top), marks: [g.n / top, ...g.more.slice(0, -1).map(v => v / top)] }; }
  return { fill: Math.min(1, s.shots / x.shots), marks: g.pars.map(p => p / x.shots) };
}

// ---------- dealing ----------
const TRIES = 40;
/** A game played out by the engine's simple player (the one that looks at every aim, or another): where it ends. */
export function played(s, how = "best", rnd = Math.random) {
  for (let n = 0; !s.over && n < 80; n++) s = fire(plan(s, how, rnd)).state;
  return s;
}
/** Whether a deal can be won: the simple player wins it. */
const winnable = s => played(s).won === true;
/** A game of level n from a seed, the next seeds tried if the first deal is one the simple player cannot win (so every deal is possible). */
export function dealLevel(n, seed) {
  const x = rulesOf(n);
  let s = null;
  for (let k = 0; k < TRIES; k++) {
    s = newGame((seed + k * 7919) >>> 0, x);
    if (winnable(s)) return s;
  }
  return s;
}
export { beaconsOf };
