// Gears: the campaign as re-planned on 12 November 2026, and the maker that turns each planned level into level data.
// (Korbi: "do your best to create clever, complex, sometimes beautiful maps, each one should ideally have an 'aha' moment.") Each row is
// the brief of one level (the game plan's "The 100 levels" tab): its power, themes, face, answer length, the pieces besides singles, the
// clues it is built round. The maker draws candidates to the brief (pipes-gear-forge.js: a route, dressed with exactly those pieces,
// the designed clues laid first, then pillars everywhere taken out while the answer stays the only one, so every clue left is needed);
// a candidate is kept by eye for its aha, and its seed written in the row. The rules of the plan are checked again by the level test.
//
// Usage: node pipes-gear-plan.mjs make <n> [tries] [from-seed]   candidates for level n, best first, with their pictures
//        node pipes-gear-plan.mjs write                         the levels whose rows have a seed, into pipes-gear-designs.js
import fs from "fs";
import { forgeLevel } from "./pipes-gear-forge.js";
import { mix as mixSeed } from "./pipes-pieces.js";
import { solve } from "./pipes-gear-solve.js";
import { parseLevel } from "./pipes-gear-engine.js";

// the faces: rows of the square, "." on the face and " " off it
const face = (...rows) => rows;
export const FACES = {
  S3: face("...", "...", "..."),
  R4: face(" .. ", "....", "....", " .. "),
  S4: face("....", "....", "....", "...."),
  O54: face(" ... ", ".....", ".....", " ... "),
  R54: face(".....", ".....", ".....", "....."),
  R55: face(" ... ", ".....", ".....", ".....", " ... "),
  S55: face(".....", ".....", ".....", ".....", "....."),
  O64: face(" .... ", "......", "......", " .... "),
  R64: face("......", "......", "......", "......"),
  O65: face(" .... ", "......", "......", "......", " .... "),
  R65: face("......", "......", "......", "......", "......"),
  R66: face(" .... ", " .... ", "......", "......", " .... ", " .... "),
  SOFT66: face(" .... ", "......", "......", "......", "......", " .... "),
  S66: face("......", "......", "......", "......", "......", "......"),
};
const POWER = { Q: "quartz", M: "mech", A: "arbor" };
const NEUTRAL = ["S5.1", "D5.1:6+6", "D5.1:5>5e", "T5.1:5-4-5", "T5.1:4-5-4e"];

// [n, name, power, themes, face, pieces, besides singles, { loads, fixed, sym, seed }, aha]
export const PLAN = [
  [1, "First mesh", "Q", [], "S3", 6, "", { seed: 19 }, "The dial sits right above the motor, yet six pieces must go in: the train loops round the face and comes back to the dial from the side, and the far corner stays empty."],
  [2, "Even", "Q", [], "R4", 8, "", { seed: 4 }, "The dial is only two squares from the motor, but eight pieces must go in: the train climbs round the top, and the two squares on the short way stay empty."],
  [3, "Odd", "Q", [], "S4", 11, "", { sym: true, seed: 687 }, "Both ends point up from the bottom row: the train fills the whole face above them, and only the two bottom squares of the same colour as each other can be spared."],
  [4, "Duo", "Q", ["Duos"], "R4", 8, "D", { seed: 97 }, "The duo goes right by the motor: it turns the train up without meshing the last single beside it, and it is what turns the dial clockwise."],
  [5, "Trio", "Q", ["Trios"], "S4", 11, "T", { seed: 1789 }, "The straight trio only fits a stretch running left to right, and there is just one: along the top, between the two columns the train climbs."],
  [6, "Pair and three", "Q", ["Duos", "Trios"], "O54", 11, "D T", { seed: 1230 }, "By the motor the train runs past its own return: the trio carries it through without meshing, and the duo turns it up."],
  [7, "Bench", "Q", ["Duos", "Trios"], "R55", 15, "D D T T", { sym: true, seed: 1124 }, "The dial is in the middle and the train spirals round it; where it passes between its own start and end, only a trio, meshing at its ends alone, can sit."],
  [8, "Mainspring", "M", ["Mechanical"], "R4", 8, "", { seed: 62 }, "Blind now: nothing shows a turn until you wind. Only one way lays all eight and reaches the escape wheel; wind too soon and the spring spins out."],
  [9, "Escape wheel", "M", ["Mechanical"], "S4", 11, "", { sym: true, seed: 515 }, "The escape wheel is two squares from the barrel along the top, but eleven pieces must go in: the train fills the face below and comes back up the middle."],
  [10, "Click", "M", ["Mechanical", "Duos"], "R54", 14, "D D", { seed: 4602 }, "Both duos are turned to fit one corner: the train runs out to the top right, turns back there, and returns along the top, leaving the block under it empty."],
  [11, "Ratchet", "M", ["Mechanical", "Trios"], "O54", 11, "T", { seed: 1232 }, "A single beside the escape wheel would mesh it at once: the elbow trio takes that corner, and the train goes all the way round first."],
  [12, "Escapement", "M", ["Mechanical", "Duos", "Trios"], "R55", 15, "D D T T", { sym: true, seed: 7836 }, "Barrel and escape wheel both sit inside the face: the train leaves bottom left, comes round the right, and the two duos at the top are its only way into the escape wheel's corner."],
  [13, "Centre wheel", "A", ["Arbor"], "R55", 15, "", { at: "centre", seed: 157 }, "The arbor meshes every wheel beside it, so its four neighbours all turn one way; the train still has to pass every square in one line and end under the dial."],
  [14, "Cannon pinion", "A", ["Arbor", "Duos"], "R54", 14, "D D", { seed: 4886 }, "Two duos turned the same way fit only where the train turns from heading left to heading up; there are just two such corners, and the square above the arbor must stay empty."],
  [15, "Hour wheel", "A", ["Arbor", "Trios"], "S55", 18, "T T", { sym: true, at: "centre", seed: 903 }, "Every wheel beside the arbor meshes it; the two trios, turned alike, are the only corners that let the train double back past it."],
  [16, "Barrel in the middle", "M", ["Mechanical", "Duos", "Trios"], "R55", 15, "D D T T", { seed: 1821 }, "The barrel is inside the face: the train leaves it sideways, and the duos and trios are what let it pass back beside the barrel without meshing it."],
  [17, "Motion works", "A", ["Arbor", "Duos", "Trios"], "R55", 15, "D D T T", { sym: true, at: "centre", seed: 6460 }, "The square above the arbor stays empty and the duo below faces away from it; the train climbs one side, crosses the top and comes down the other, the two upright trios mirroring each other."],
];

const centreOf = f => Math.floor(f.length / 2) * f[0].length + Math.floor(f[0].length / 2);
/** The forge's recipe for a planned row. */
export function recipeOf(row, extra = {}) {
  const [n, , power, themes, faceKey, pieces, besides, o] = row, f = FACES[faceKey], arbor = power === "A";
  const mx = besides.split(/\s+/).filter(Boolean);
  return {
    cols: f[0].length, rows: f.length, face: f, turn: themes.includes("Turning"), power: POWER[power], spares: 0, extras: {}, lastResortPins: false,
    minimal: true, touch: true, sym: !!o.sym, limit: 4e5, chapter: `c${n}`, arbor, at: arbor && o.at === "centre" ? centreOf(f) : undefined, loads: o.loads || 0, fixed: o.fixed || 0,
    trains: [{ m: 5, l: 1, pieces, bends: 2, fams: { S: 1, D: mx.includes("D") ? 1 : 0, T: mx.includes("T") ? 1 : 0 }, kinds: NEUTRAL, mix: mx, barrelN: arbor ? 12 : undefined }],
    ...extra,
  };
}

const TOKEN = { "S5.1@0": "o", "D5.1:6+6@0": "-", "D5.1:6+6@1": "|", "D5.1:5>5e@0": "a", "D5.1:5>5e@1": "b", "D5.1:5>5e@2": "c", "D5.1:5>5e@3": "d",
  "T5.1:5-4-5@0": "=", "T5.1:5-4-5@1": "!", "T5.1:4-5-4e@0": "A", "T5.1:4-5-4e@1": "B", "T5.1:4-5-4e@2": "C", "T5.1:4-5-4e@3": "D" };
/** A level drawn as its answer: P the power, G the dial, ↻ ↺ loads, F a fixed piece, # a pillar, _ off the face. */
export function picture(spec) {
  const t = spec.trains[0], sol = spec.sols[0];
  return spec.map.map((row, y) => [...row].map((ch, x) => {
    const c = y * spec.cols + x, pin = spec.pins.find(p => p.c === c), k = spec.clicks.find(q => q.c === c);
    if (ch === " ") return "_";
    if (c === t.barrel.c) return t.barrel.arbor ? "*" : "P" + (t.barrel.side || "");
    if (c === t.sink.c) return "G" + t.sink.side;
    if (pin) return "F" + (TOKEN[`${pin.kind}@${pin.rot}`] || "?");
    if (k) return k.dir === "cw" ? "↻" : "↺";
    return ch === "#" ? "#" : sol[c] ? TOKEN[sol[c]] || "?" : ".";
  }).map(s => s.padEnd(2)).join(" "));
}

/** A planned row made from its seed: the level data, or an error naming what failed. */
export function make(row, seed) {
  const res = forgeLevel(mixSeed(row[0], seed, 77), recipeOf(row));
  if (!res) throw new Error(`level ${row[0]} ${row[1]}: seed ${seed} makes nothing`);
  return { ...res.spec, id: `g-${row[1].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: row[1], chapter: chapterOf(row[0]), themes: row[3], aha: row[8] || "", nodes: res.nodes,
    ...(row[7].sym ? { sym: true } : {}) };
}

export const CHAPTERS = [
  { key: "na", book: "N", name: "Gears", from: 1, rule: "Mesh gears from the motor to the dial: each mesh turns the next wheel the other way." },
  { key: "nb", book: "N", name: "Duos and trios", from: 4, rule: "Duos and trios mesh only at their ends. A duo turns the next wheel the way a single would not; a trio turns it as a single does." },
  { key: "nc", book: "N", name: "Mechanical", from: 8, rule: "Wind it to try it: no wheel shows its turn until it runs, and it ticks only once it reaches the escape wheel." },
  { key: "nd", book: "N", name: "The arbor", from: 13, rule: "The movement's arbor turns, smooth and unwound: it meshes every wheel beside it." },
];
// the new levels are their own book while Korbi plays them ahead of Book I (12 Nov 2026: "put them in front of all the levels")
export const BOOKS = [{ key: "N", name: "The new bench", rule: "Gears, duos and trios, and the three powers." }];
export const chapterOf = n => [...CHAPTERS].reverse().find(c => n >= c.from).key;

const [mode, ...args] = process.argv[1]?.endsWith("pipes-gear-plan.mjs") ? process.argv.slice(2) : [];
if (mode === "make") {
  const row = PLAN.find(r => r[0] === Number(args[0])), tries = Number(args[1] || 200), from = Number(args[2] || 0), got = [], t0 = Date.now();
  for (let k = from; k < from + tries && Date.now() - t0 < 280000; k++) {
    const res = forgeLevel(mixSeed(row[0], k, 77), recipeOf(row));
    if (!res) continue;
    const s = res.spec, open = s.map.join("").split("").filter(ch => ch !== " " && ch !== "#").length;
    got.push({ k, nodes: res.nodes, fill: Math.round(100 * (res.placed + s.pins.length) / open), pillars: res.pillars, pic: picture(s), dir: s.trains[0].sink.goal.dir });
  }
  got.sort((a, b) => b.nodes - a.nodes);
  console.log(`level ${row[0]} ${row[1]}: ${got.length} of ${tries} in ${Date.now() - t0} ms`);
  for (const g of got.slice(0, Number(args[3] || 4))) console.log(`seed ${g.k}: nodes ${g.nodes}, fill ${g.fill}%, ${g.pillars} pillars, dial ${g.dir}\n` + g.pic.map(l => "   " + l).join("\n"));
}
if (mode === "write") {
  const levels = PLAN.filter(r => r[7].seed !== undefined).map(r => make(r, r[7].seed));
  fs.writeFileSync(new URL("./pipes-gear-designs.js", import.meta.url), `// Gears: the levels designed to the plan of 12 November 2026. Made by pipes-gear-plan.mjs (node pipes-gear-plan.mjs write), never by hand.\n` +
    `export const BOOKS = ${JSON.stringify(BOOKS)};\nexport const CHAPTERS = ${JSON.stringify(CHAPTERS)};\nexport const LEVELS = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
  console.log(`${levels.length} levels written`);
}
void solve; void parseLevel;
