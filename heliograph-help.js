// Heliograph's feature help, pure (no page): what each thing a level brings is called, how it reads in a few lines, and the
// little scenes that show it, each a real shot of the engine (heliograph-engine.js) on a small chandelier, so what is drawn
// is what happens. heliograph-help-ui.js draws the scenes and keeps the dialog; this file knows the features, so a level's
// start, the menu's "How things work" and the tests all ask the same thing.
//
// A scene is seen from the side, everything in one upright plane: five strings of the chandelier (the middle row of its
// nineteen places) with the light coming down a port at its left, a first mirror `a` that turns it to a second, `b`, which
// turns it into the chandelier. Between them stands what the scene is about (a colour crystal, a prism, a shutter). Its
// `strings` are the colours of each string, top first; `gate` what the light first passes (a colour crystal `c`, or a prism
// of `cs`; at fraction `t` of the way from a to b, or `at`); `aim` the crystal [string, layer] that b is turned to; `lantern`
// the one in a brass collar; `shutter` { p, r, cycle } a bar across the tube; `sun` the sun's course; `shots` which shot of
// the level it is; `expect` what the engine must make of it (the tests hold the text and the picture to that).
// The numbers in a text come from the engine too (`worth`, the bonuses); the rest are words.
import { CELLS, newGame, fire, pointMirror, idOf, layerY, worth, sunAngle, BEACON_BONUS, CLEAR_BONUS } from "./heliograph-engine.js";

const fmt = n => n.toLocaleString("en-GB");
const place = q => CELLS.findIndex(c => c.q === q && c.r === 0);
/** Where a crystal of a string [q, k] hangs, in the scene's plane. */
export const hangs = (q, k) => [CELLS[place(q)].x, layerY(k), 0];
const [GOLD, GREEN, BLUE, RED] = [0, 1, 2, 3];

// the chandeliers of the scenes: strings of colours, top first, for the places q = -2 to 2
/** A diagonal of the chandelier, three of one colour and then another, which a beam up from the lower left runs through: three go, and what hangs under them falls. */
const RUN = [[BLUE, RED, BLUE, RED], [RED, BLUE, RED, BLUE, RED, GOLD], [BLUE, RED, BLUE, RED, GOLD, BLUE], [RED, BLUE, RED, GOLD, BLUE, RED], [RED, BLUE, GREEN, RED, BLUE]];
/** The same diagonal in alternate colours. */
const ALTERNATE = [[BLUE, RED, BLUE, RED], [RED, BLUE, RED, BLUE, RED, GOLD], [BLUE, RED, BLUE, RED, GREEN, BLUE], [RED, BLUE, RED, GOLD, BLUE, RED], [RED, BLUE, GREEN, RED, BLUE]];
/** Strings with two red crystals at the foot of the second and fourth, for a beam straight up them. */
const UP = [[RED, BLUE, RED], [RED, BLUE, GOLD, GOLD], [BLUE, RED, BLUE, RED], [BLUE, RED, GOLD, GOLD], [RED, BLUE, RED]];

// the scenes' two shapes of light: down the port, along under the chandelier and up a string (UP), or turned at once into the
// chandelier from above, across it on a slant (DIAG)
const DIAG = { a: [-3.3, 12], b: [-2.4, 7.4], aim: [-1, 5] };
const UPWARD = { a: [-3.6, 7.5] };

/** Every feature: { id, name, lines (2 short ones; the first says what it is), scenes (one to three, shown in turn) }. */
export const FEATURES = [
  {
    id: "quota", name: "Quota",
    lines: [
      "Each level gives you so many shots and a quota to reach in them. More points than the quota earn a second star, and a third.",
      `A shot scores ten times the square of the crystals it shatters, and ten for each that falls: three shattered and three fallen is ${worth(3, 3)}. Long runs of one colour are worth the most.`,
    ],
    scenes: [{ ...DIAG, strings: RUN, gate: { c: GOLD }, caption: "Three of its colour in a row", expect: { shattered: 3, fallen: 3, gain: worth(3, 3), stop: "piece" } }],
  },
  {
    id: "beacons", name: "Lanterns",
    lines: [
      "A lantern is a crystal in a brass collar. Bring every lantern down to win the level; the stars are how few shots it takes.",
      `A lantern falls when it is shattered, or when anything above it on its string is: a cut below it leaves it hanging. Each is worth ${BEACON_BONUS} too.`,
    ],
    scenes: [
      { ...DIAG, strings: RUN, gate: { c: GOLD }, lantern: [0, 5], goal: "beacons", caption: "Cut above: it falls", expect: { shattered: 3, fallen: 3, downed: 1, gain: worth(3, 3) + BEACON_BONUS } },
      { ...DIAG, strings: RUN, gate: { c: GOLD }, lantern: [0, 3], goal: "beacons", caption: "Cut below: it hangs", expect: { shattered: 3, fallen: 3, downed: 0, gain: worth(3, 3) } },
    ],
  },
  {
    id: "clear", name: "Clearing the chandelier",
    lines: [
      "Bring down every crystal. The chandelier doesn't come down any lower and nothing replaces it; the stars are how few shots it takes.",
      `A cut from the side leaves what hangs above it. A beam up a string from below takes the whole string, and the last crystal down is worth ${fmt(CLEAR_BONUS)} more.`,
    ],
    scenes: [
      { ...UPWARD, b: [0, 7.8], aim: [0, 3], strings: [[], [], [GOLD, GOLD, GOLD, GOLD], [GREEN, GREEN, GREEN], []], gate: { c: GOLD }, goal: "clear", caption: "Shot 1: a string", expect: { shattered: 4, fallen: 0, cleared: false, gain: worth(4, 0) } },
      { ...UPWARD, b: [0.92, 7.8], aim: [1, 2], strings: [[], [], [], [GREEN, GREEN, GREEN], []], gate: { c: GREEN }, goal: "clear", caption: "Shot 2: the last", expect: { shattered: 3, fallen: 0, cleared: true, gain: worth(3, 0) + CLEAR_BONUS } },
    ],
  },
  {
    id: "prism", name: "Prism",
    lines: [
      "A prism is never spent. White light through it comes out in its two colours, as if it had crossed two colour crystals; through a colour crystal too, it carries more.",
      "A beam in two colours shatters either, and stops only at a third: a run of alternate colours, which one colour stops at once, goes down whole.",
    ],
    scenes: [
      { ...DIAG, strings: ALTERNATE, gate: { c: GOLD }, caption: "One colour: stops at the next", expect: { shattered: 1, fallen: 0, gain: worth(1, 0), stop: "piece" } },
      { ...DIAG, strings: ALTERNATE, gate: { cs: [GOLD, GREEN] }, caption: "The prism: two colours", expect: { shattered: 4, fallen: 5, gain: worth(4, 5), stop: "skirt" } },
    ],
  },
  {
    id: "shutter", name: "Shutter",
    lines: [
      "A shutter is a brass louvre across the tube. The light stops at it, as at a wall.",
      "Light goes round it: set the mirror that turns the light up into the chandelier to one side, and out of its shadow.",
    ],
    scenes: [
      { ...UPWARD, b: [-0.92, 7.8], aim: [-1, 3], strings: UP, gate: { c: GOLD }, shutter: { p: [-0.7, 8.7], r: 0.9 }, caption: "In its way: stopped", expect: { shattered: 0, fallen: 0, gain: 0, stop: "shutter" } },
      { ...UPWARD, b: [0.92, 7.8], aim: [1, 3], strings: UP, gate: { c: GOLD }, shutter: { p: [-0.7, 8.7], r: 0.9 }, caption: "Beside it: through", expect: { shattered: 2, fallen: 0, gain: worth(2, 0), stop: "piece" } },
    ],
  },
  {
    id: "blink", name: "Opening shutter",
    lines: [
      "This shutter shuts and opens by turns, one shot to the next: a solid bar is shut, a dashed one open.",
      "The light meets it as it stands when you fire, not as you aim. The line over the tube says whether it is shut now and next shot.",
    ],
    scenes: [
      { ...UPWARD, b: [-0.92, 7.8], aim: [-1, 3], strings: UP, gate: { c: GOLD }, shutter: { p: [-0.7, 8.7], r: 0.9, cycle: [1, 0] }, shots: 0, caption: "Shot 1: shut", expect: { shattered: 0, fallen: 0, gain: 0, stop: "shutter" } },
      { ...UPWARD, b: [-0.92, 7.8], aim: [-1, 3], strings: UP, gate: { c: GOLD }, shutter: { p: [-0.7, 8.7], r: 0.9, cycle: [1, 0] }, shots: 1, caption: "Shot 2: open", expect: { shattered: 2, fallen: 0, gain: worth(2, 0), stop: "piece" } },
    ],
  },
  {
    id: "sun", name: "The sun",
    lines: [
      "The sun crosses the sky over the level, and the light comes in more aslant each shot: the dial over the tube shows where it is.",
      "Where the light falls on a mirror moves with it, so a mirror set for one shot is wrong for the next. Move it to follow the light, or keep it high, near the port, where it has to move least.",
    ],
    scenes: [0, 3, 6].map((shots, i) => ({
      ...UPWARD, b: [0.92, 7.8], aim: [1, 3], strings: [[], ...UP.slice(1)], gate: { c: GOLD, at: [-0.1, 7.75] }, port: -3, follow: true, sun: { from: 10, to: -10 }, span: 7, shots,
      caption: ["Early: the light leans one way", "Midday: straight down", "Late: it leans the other"][i], expect: { shattered: 2, fallen: 0, gain: worth(2, 0), stop: "piece" },
    })),
  },
];
/** The order they are taught in, and shown in when a level has several. */
export const ORDER = FEATURES.map(f => f.id);
export const featureOf = id => FEATURES.find(f => f.id === id);

/** The game a scene is a shot of, as the engine has it. */
export function sceneState(spec) {
  const goal = spec.goal === "beacons" ? { kind: "beacons", pars: [1, 1] } : spec.goal === "clear" ? { kind: "clear", pars: [1, 1] } : { kind: "score", n: 99999, more: [] };
  const shots = spec.shots ?? 0, g = spec.gate ?? {};
  const x = { lv: -1, shape: "column", colours: [0, 1, 2, 3], extra: 0, crystals: 0, every: 99, shots: spec.span ?? 8, goal, port: [spec.port ?? spec.a[0], 14, 0], fix: [] };
  if (spec.sun) x.sun = spec.sun;
  // the first mirror stands where the light falls on it: straight under the port, or along the sun's slant
  const slant = Math.tan((sunAngle({ x }, shots) * Math.PI) / 180), a = [spec.follow ? x.port[0] + (14 - spec.a[1]) * slant : spec.a[0], spec.a[1], 0], b = [...spec.b, 0];
  const t = g.t ?? 0.5, gate = g.at ? [...g.at, 0] : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0];
  if (g.cs) x.fix.push({ k: "prism", p: gate, cs: g.cs });
  if (spec.shutter) x.fix.push({ k: "shutter", p: [...spec.shutter.p, 0], n: [0, 1, 0], r: spec.shutter.r, ...(spec.shutter.cycle ? { cycle: spec.shutter.cycle } : {}) });
  let s = newGame(1, x);
  s.serial = 0;
  s.depth = CELLS.map(c => (c.r === 0 ? spec.strings[c.q + 2].length : 0));
  const deepest = Math.max(...s.depth);
  s.layers = Array.from({ length: deepest }, (_, k) => ({ s: s.serial++, c: CELLS.map(c => (c.r === 0 ? spec.strings[c.q + 2][k] ?? -1 : -1)) }));
  s.crystals = g.c == null ? [] : [{ x: gate[0], y: gate[1], z: 0, c: g.c }];
  s.shots = shots;
  s.untilDrop = 99;
  if (spec.lantern) s.x.beacons = [idOf(s.layers[spec.lantern[1]].s, place(spec.lantern[0]))];
  s.mirrors = [{ id: 0, p: a, n: [0, 1, 0] }, { id: 1, p: b, n: [0, 1, 0] }];
  s.mid = 2;
  s = pointMirror(s, 0, b);
  return pointMirror(s, 1, hangs(...spec.aim));
}
/** A scene played: { spec, s (before), r (fire's result) }. */
export function runScene(spec) {
  const s = sceneState(spec);
  return { spec, s, r: fire(s) };
}
/** What a scene's shot brought, in a few words each, for the corner of the picture. */
export function marksOf({ r }) {
  const out = [];
  if (r.path.stop.what === "shutter") out.push("stopped");
  if (r.shattered.length) out.push(`${r.shattered.length} shattered`);
  if (r.fallen.length) out.push(`${r.fallen.length} fell`);
  if (r.downed) out.push(r.downed === 1 ? "lantern down" : `${r.downed} lanterns down`);
  if (r.cleared) out.push("cleared");
  if (r.gain) out.push(`+${fmt(r.gain)}`);
  return out;
}
export const verdictOf = ({ spec }) => spec.caption ?? "";
