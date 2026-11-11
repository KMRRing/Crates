// Gears: the campaign (11 November 2026). The plan (the Gears tab of the game plan) as data: a hundred levels in thirteen chapters, each
// level a combination of themes. Thirty-six are Book I's levels kept (some made mechanical, some given spare pieces); the rest are made by
// pipes-gear-forge.js from a recipe read off the level's themes. Writes pipes-gear-levels.js:
//   node pipes-gear-campaign.mjs make <from> <to> [out.json]   makes the new levels numbered from..to (two can run at once)
//   node pipes-gear-campaign.mjs write <chunk.json>...          joins the kept levels and the chunks into the level file
// 11 Nov 2026, Korbi: "the chapters should get longer and introduce more themes, returning to the common themes frequently and chapter
// themes rare, mostly in the chapter. So almost like permutations." "Especially the mechanical movement: way earlier. Until then quartz."
// And: "turning should stay"; the escape wheel ends the train from the first mechanical level; twin barrels and full plates are in.
import fs from "fs";
import { forgeLevel, WHY } from "./pipes-gear-forge.js";
import { LEVELS as OLD } from "./pipes-train-levels.js";
import { legacySpec } from "./pipes-gear-legacy.js";
import { parseLevel, check } from "./pipes-gear-engine.js";
import { solve } from "./pipes-gear-solve.js";
import { CATALOG, parseKind, orientations } from "./pipes-gear-shapes.js";
import { mix } from "./pipes-pieces.js";

export const BOOKS = [
  { key: "I", name: "The bench", rule: "Whole gears, duos and trios, driven by a quartz motor." },
  { key: "II", name: "The movement", rule: "The mainspring, loads, jams, fixed gears and the tray." },
  { key: "III", name: "Calibres", rule: "Turning, ratios and two trains." },
  { key: "IV", name: "Complications", rule: "Layers, branches, the crown, twin barrels and full plates." },
];
export const CHAPTERS = [
  { key: "a", book: "I", name: "Meshing", rule: "Mesh gears from the quartz motor to the dial: each arrow shows its turn." },
  { key: "b", book: "I", name: "Duos", rule: "A duo is two small gears in one square: it flips the turn." },
  { key: "c", book: "I", name: "Trios", rule: "A trio is three small gears: it keeps the turn, and meshes on two sides." },
  { key: "w", book: "II", name: "Mainspring", rule: "Mechanical: wind to try it. Turns show only once wound; a spring wound before the escape wheel spins out." },
  { key: "d", book: "II", name: "Loads", rule: "A load takes a single gear that must turn the way shown." },
  { key: "e", book: "II", name: "Jams", rule: "Gears side by side must turn opposite ways, or they jam." },
  { key: "f", book: "II", name: "Fixed gears", rule: "A dark pinned gear is part of the train; in a mechanical one the hands sit on it." },
  { key: "s", book: "II", name: "The tray", rule: "The tray holds more pieces than the movement needs: some stay out." },
  { key: "t", book: "III", name: "Turning", rule: "Tap a piece to turn it: walls and neighbours say which way it faces." },
  { key: "r", book: "III", name: "Ratios", rule: "A stack slows the train entered at its wheel, speeds it at its pinion. Stations want a speed." },
  { key: "p", book: "III", name: "Two trains", rule: "Two trains must never mesh: different tooth sizes may touch, one size must keep apart." },
  { key: "l", book: "IV", name: "Layers", rule: "Wheels on two layers pass over each other: a riser lifts a train, a crossing lets two pass." },
  { key: "g", book: "IV", name: "Grande complication", rule: "A branch ends in hands or a second barrel; the crown's two positions must both run." },
];
const CHAPTER_OF = [[1, "a"], [6, "b"], [11, "c"], [15, "w"], [21, "d"], [27, "e"], [34, "f"], [42, "s"], [50, "t"], [59, "r"], [68, "p"], [78, "l"], [89, "g"]];
export const chapterOf = n => CHAPTER_OF.filter(([from]) => from <= n).pop()[1];
const capstone = n => CHAPTER_OF.some(([from]) => from === n + 1) || n === 100;

/** [number, kept level id or null, name, themes, pieces in the answer, what changes in a kept level ("M" mechanical, "S" spares)] */
export const PLAN = [
  [1, "wa1", "Barrel", [], 3],
  [2, "wa2", "Arbor", [], 4],
  [3, "wa3", "Pinion", [], 5],
  [4, "wa4", "Wheel", [], 6],
  [5, "wa5", "Cannon", [], 8],
  [6, "wb1", "Pair", ["Duos"], 4],
  [7, "wb2", "Couple", ["Duos"], 5],
  [8, "wb3", "Ratio", ["Duos"], 6],
  [9, "wb4", "Step-down", ["Duos"], 7],
  [10, "wb5", "Reverser", ["Duos"], 9],
  [11, "wc2", "Chain", ["Trios"], 5],
  [12, "wc3", "Compound", ["Trios"], 6],
  [13, "wc4", "Idler", ["Trios","Duos"], 7],
  [14, "wc5", "Triple", ["Trios","Duos"], 9],
  [15, null, "Click", ["Mechanical","Duos"], 6],
  [16, null, "Ratchet", ["Mechanical","Trios"], 7],
  [17, null, "Spring", ["Mechanical","Duos","Trios"], 8],
  [18, null, "Going train", ["Mechanical","Duos","Trios"], 9],
  [19, null, "Pallets", ["Mechanical","Duos","Trios"], 10],
  [20, null, "Escapement", ["Mechanical","Duos","Trios"], 11],
  [21, "wd1", "Hours", ["Loads","Duos"], 6],
  [22, "wd2", "Minutes", ["Loads","Duos","Trios"], 7],
  [23, "wd3", "Seconds", ["Loads","Duos","Mechanical"], 8, "M"],
  [24, "wd4", "Date", ["Loads","Duos","Trios"], 9],
  [25, "wd5", "Moon", ["Loads","Duos","Trios","Mechanical"], 10, "M"],
  [26, null, "Detent", ["Loads","Duos","Trios","Mechanical"], 11],
  [27, "we2", "Seize", ["Jams","Duos"], 9],
  [28, "we3", "Bind", ["Jams","Duos","Trios","Loads"], 10],
  [29, null, "Pallet fork", ["Jams","Duos","Mechanical"], 10],
  [30, "we4", "Lock", ["Jams","Duos","Loads","Mechanical"], 11, "M"],
  [31, "we5", "Stall", ["Jams","Duos","Trios","Loads"], 12],
  [32, null, "Impulse", ["Jams","Trios","Loads","Mechanical"], 12],
  [33, null, "Lever", ["Jams","Duos","Trios","Loads","Mechanical"], 13],
  [34, "wf2", "Index", ["Fixed gears","Trios"], 7],
  [35, "wf4", "Hairspring", ["Fixed gears","Duos","Loads"], 8],
  [36, "wf5", "Balance", ["Fixed gears","Duos","Loads","Mechanical"], 9, "M"],
  [37, "wg1", "Calibre", ["Fixed gears","Duos","Loads"], 9],
  [38, "wg2", "Keyless", ["Fixed gears","Duos","Loads","Mechanical"], 9, "M"],
  [39, "wg3", "Winding", ["Fixed gears","Duos","Trios","Loads","Jams"], 11],
  [40, "wg4", "Setting", ["Fixed gears","Duos","Trios","Loads","Jams","Mechanical"], 11, "M"],
  [41, "wg5", "Motion", ["Fixed gears","Duos","Trios","Loads","Jams","Mechanical"], 13, "M"],
  [42, null, "Parts tray", ["Spares","Duos","Loads"], 11],
  [43, null, "Loupe", ["Spares","Trios","Jams","Mechanical"], 12],
  [44, "wh1", "Date", ["Spares","Duos","Trios","Loads","Fixed gears","Mechanical"], 11, "SM"],
  [45, "wh2", "Chronograph", ["Spares","Duos","Trios","Loads","Fixed gears"], 11, "S"],
  [46, "wh3", "Repeater", ["Spares","Duos","Trios","Loads","Fixed gears","Jams","Mechanical"], 13, "SM"],
  [47, null, "Tweezers", ["Spares","Duos","Jams","Mechanical"], 13],
  [48, "wh4", "Tourbillon", ["Spares","Duos","Trios","Loads","Fixed gears","Jams"], 13, "S"],
  [49, "wh5", "Grande", ["Spares","Duos","Trios","Loads","Fixed gears","Jams","Mechanical"], 15, "SM"],
  [50, null, "Quarter", ["Turning","Duos"], 10],
  [51, null, "Half", ["Turning","Trios","Loads"], 11],
  [52, null, "Three quarters", ["Turning","Duos","Mechanical"], 12],
  [53, null, "Full circle", ["Turning","Fixed gears","Jams"], 12],
  [54, null, "Revolution", ["Turning","Spares","Duos","Mechanical"], 13],
  [55, null, "Pivot", ["Turning","Loads","Fixed gears","Trios"], 13],
  [56, null, "Jewel", ["Turning","Spares","Jams","Trios","Mechanical"], 14],
  [57, null, "Cap jewel", ["Turning","Spares","Loads","Fixed gears","Mechanical"], 15],
  [58, null, "Balance spring", ["Turning","Spares","Duos","Trios","Loads","Fixed gears","Jams","Mechanical"], 16],
  [59, null, "Step up", ["Ratios","Duos"], 12],
  [60, null, "Reduction", ["Ratios","Spares","Trios"], 12],
  [61, null, "Fourth wheel", ["Ratios","Loads","Turning","Duos","Mechanical"], 13],
  [62, null, "Minute wheel", ["Stations","Ratios","Fixed gears"], 14],
  [63, null, "Centre seconds", ["Stations","Ratios","Spares","Mechanical"], 14],
  [64, null, "Date ring", ["Date ring","Ratios","Loads","Duos"], 15],
  [65, null, "Pinion leaves", ["Ratios","Turning","Jams","Mechanical"], 15],
  [66, null, "Day and date", ["Date ring","Ratios","Spares","Trios"], 16],
  [67, null, "Motion works", ["Stations","Ratios","Spares","Loads","Jams","Mechanical"], 18],
  [68, null, "Fine and standard", ["Two pitches","Duos"], 14],
  [69, null, "Side by side", ["Two pitches","Trios","Loads","Turning"], 15],
  [70, null, "Two plates", ["Two pitches","Spares","Jams","Fixed gears","Mechanical"], 16],
  [71, null, "Keep apart", ["One pitch apart","Duos","Trios"], 16],
  [72, null, "Interlace", ["One pitch apart","Loads","Fixed gears","Trios","Mechanical"], 17],
  [73, null, "Spacer", ["One pitch apart","Ratios","Spares","Duos"], 18],
  [74, null, "New moon", ["Moon","Ratios","Two pitches"], 18],
  [75, null, "Full moon", ["Moon","Spares","Turning","Trios","Mechanical"], 19],
  [76, null, "Three trains", ["Three trains","Duos","Trios","Jams","Mechanical"], 20],
  [77, null, "Sonnerie", ["Three trains","One pitch apart","Ratios","Spares","Loads","Mechanical"], 22],
  [78, null, "Figure of eight", ["Layers","Duos"], 15],
  [79, null, "Over and under", ["Layers","Trios","Loads","Turning"], 15],
  [80, null, "Riser", ["Layers","Ratios","Jams","Mechanical"], 16],
  [81, null, "Overpass", ["Crossing","Duos","Spares"], 17],
  [82, null, "Cock", ["Crossing","Loads","Spares","Fixed gears","Mechanical"], 18],
  [83, null, "Viaduct", ["Crossing","Fixed gears","Turning"], 18],
  [84, null, "Low bridge", ["Low bridge","Trios","Jams","Turning"], 19],
  [85, null, "Lintel", ["Low bridge","Crossing","Spares","Trios","Mechanical"], 20],
  [86, null, "Moon phase", ["Crossing","Moon","Ratios","Mechanical"], 20],
  [87, null, "Skeleton", ["Layers","Turning","Spares","Loads","Mechanical"], 21],
  [88, null, "Calendar bridge", ["Crossing","Low bridge","Spares","Loads","Jams","Trios","Mechanical"], 24],
  [89, null, "Cannon pinion", ["Branch","Duos","Ratios","Turning"], 18],
  [90, null, "Minute hand", ["Branch","Loads","Spares","Fixed gears","Duos","Mechanical"], 19],
  [91, null, "GMT", ["Branch","Stations","Ratios","Layers","Mechanical"], 20],
  [92, null, "Crown", ["Keyless","Duos","Trios"], 18],
  [93, null, "Castle wheel", ["Keyless","Loads","Jams","Fixed gears","Mechanical"], 19],
  [94, null, "Flyback", ["Keyless","Branch","Spares","Mechanical"], 21],
  [95, null, "Twin barrels", ["Twin barrels","Ratios","Loads","Layers","Duos","Mechanical"], 22],
  [96, null, "Full plate", ["Full plate","Duos","Trios","Jams","Turning"], 24],
  [97, null, "Eight days", ["Full plate","Twin barrels","Spares","Fixed gears","Trios","Mechanical"], 25],
  [98, null, "Grande sonnerie", ["Three trains","Crossing","Full plate","Duos","Mechanical"], 26],
  [99, null, "Perpetual calendar", ["Branch","Date ring","Moon","Ratios","Mechanical"], 27],
  [100, null, "Supercomplication", ["Branch","Keyless","Crossing","Twin barrels","Spares","Turning","Mechanical"], 30],
];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const idOf = row => row[1] || `x-${slug(row[2])}`;

/** The themes taught before level n (any level up to n-1 that names them). */
const taughtBy = n => new Set(PLAN.filter(r => r[0] < n).flatMap(r => r[3]));

/** The maker's recipe for a new level, read off its themes. */
export function recipeOf(row) {
  const [n, , , els, pieces] = row, E = new Set(els), known = taughtBy(n);
  const has = x => E.has(x), knows = x => has(x) || known.has(x);
  const wt = x => (has(x) ? 3 : knows(x) ? 1 : 0);
  const cap = capstone(n);
  const base = { m: 5, l: 1, fams: { S: 2, D: wt("Duos"), T: wt("Trios") } };
  let trains = [];
  const nTrains = has("Three trains") ? 3 : has("Two pitches") || has("One pitch apart") || has("Crossing") ? 2 : 1;
  const mods = has("Three trains") ? (has("One pitch apart") ? [5, 5, 4] : [5, 4, 6]) : has("Two pitches") ? [5, 4] : [5, 5];
  const ends = [];
  if (has("Branch")) { ends.push({ len: 3, type: "hands" }); if (has("Stations") || has("Date ring") || has("Moon")) ends.push({ len: 3, type: has("Moon") ? "moon" : "hands" }); }
  if (has("Twin barrels")) ends.push({ len: 3, look: "barrel", type: "barrel" });
  const branchLen = ends.reduce((s, e) => s + e.len + 1, 0) + (has("Keyless") ? 5 : 0);
  const perTrain = Math.max(5, Math.round((pieces - branchLen) / nTrains));
  for (let k = 0; k < nTrains; k++) {
    const t = { ...base, m: mods[k], fams: { ...base.fams }, pieces: perTrain, bends: Math.min(4, Math.floor(perTrain / 3)) };
    if (has("Ratios") || (knows("Ratios") && (has("Stations") || has("Date ring")))) { t.fams.K = 2; t.stacks = 1; t.layers = [1, 2]; t.mods = [t.m]; t.adapt = false; }
    if (has("Stations") && k === 0) t.stations = cap ? 2 : 1;
    if (has("Date ring") && k === 0 && !has("Branch")) t.goal = { type: "date", ring: true };
    if (has("Moon") && k === nTrains - 1 && !has("Branch")) { t.fams.K = 2; t.stacks = 1; t.mods = [t.m, 4]; t.layers = [1, 2]; t.end = { m: 4 }; t.adapt = true; if (!has("Mechanical")) t.goal = { type: "moon" }; }
    if (has("Layers") && k === 0) { t.self = true; t.fams.R = 0.4; t.layers = [1, 2]; t.stacks = 1; t.pieces = Math.max(t.pieces, 9); }
    if (has("Crossing") && k === 1) { t.fams.R = 0.4; t.layers = [1, 2]; t.stacks = 1; t.pieces = Math.max(t.pieces, 7); }
    if (k === 0 && ends.length) t.ends = ends;
    if (k === 0 && has("Keyless")) { t.clutch = { len: 4 }; if (!has("Mechanical")) t.goal = { type: "barrel" }; }
    if (k === 0 && has("Mechanical") && has("Fixed gears")) t.hands = true;
    trains.push(t);
  }
  const extras = {
    clicks: knows("Loads") ? (has("Loads") ? 3 : 1) : 0,
    pins: knows("Fixed gears") ? (has("Fixed gears") ? 3 : 1) : 0,
    bridges: has("Low bridge") ? 3 : knows("Low bridge") ? 1 : 0,
  };
  // a train that may not run beside itself needs about twice its length in open ground
  const need = pieces + nTrains * 2 + ends.length + 2, open = need / (has("Full plate") ? 0.85 : has("Jams") ? 0.6 : 0.5);
  const plates = [[5, true, 21], [6, true, 32], [7, true, 37], [7, false, 49], [8, false, 64], [9, false, 81]];
  const [size, disc] = plates.find(p => p[2] >= open) || plates[plates.length - 1];
  return {
    cols: size, rows: size, disc, turn: has("Turning"), power: has("Mechanical") ? "mech" : "quartz", spares: has("Spares") ? (cap ? 3 : 2) : 0,
    full: has("Full plate"), touch: has("Jams") || has("Full plate"), extras, lastResortPins: knows("Fixed gears"), trains,
    cross: has("Crossing") ? [[0, 1]] : [], nodes: 1500 + 300 * pieces, limit: 4e5, chapter: chapterOf(n),
  };
}

/** How well a made level fits its row: lower is better. */
function scoreOf(row, got) {
  const E = new Set(row[3]), L = got.L, open = L.cap.reduce((s, c) => s + (c > 0 ? 1 : 0), 0) + L.pins.length + 2 * L.trains.length;
  const fill = (got.placed + L.pins.length + 2 * L.trains.length) / Math.max(1, open);
  let s = Math.abs(fill - 0.62) * 3 + Math.abs(got.placed - row[4]) / Math.max(4, row[4]);
  if (E.has("Loads") && !L.clicks.length) s += 1;
  if (E.has("Fixed gears") && !L.pins.some(p => !p.end && !p.trains && !L.clutch)) s += 1;
  if (!E.has("Loads") && L.clicks.length > 1) s += 0.3;
  const plain = L.pins.filter(p => !p.end && !p.trains && !p.goal && !(L.clutch && L.clutch.c === p.c)).length;
  s += Math.max(0, plain - (E.has("Fixed gears") ? 3 : 1)) * 0.25;          // a level held together by pins is a level already half solved
  return s - Math.log10(got.nodes + 1) * 0.4;           // the more the solver had to try, the more there is to reason out
}

// what goes first when a level's recipe cannot be made: the hardest themes to fit together
const DROP = ["Turning", "Crossing", "Keyless", "Twin barrels", "Full plate", "Layers", "Three trains", "Spares"];
function make(from, to) {
  const out = {};
  for (const row0 of PLAN) {
    if (row0[1] || row0[0] < from || row0[0] > to) continue;
    let row = row0, found = [];
    const t0 = Date.now();
    for (let attempt = 0; !found.length && attempt <= DROP.length; attempt++) {
      if (attempt) {
        const gone = DROP.find(x => row[3].includes(x));
        if (!gone) break;
        row = [row[0], row[1], row[2], row[3].filter(x => x !== gone), row[4], row[5]];
        console.error(`level ${row[0]} ${row[2]}: dropped ${gone}`);
      }
      const rc = recipeOf(row), t1 = Date.now();
      for (let k = 0; k < 900 && found.length < 4 && Date.now() - t1 < 90000; k++) {
        const got = forgeLevel(mix(row[0], k, 4242), rc);
        if (got) found.push({ got, score: scoreOf(row, got) });
      }
    }
    if (!found.length) { console.error(`level ${row[0]} ${row[2]}: none (${JSON.stringify(WHY)})`); continue; }
    found.sort((a, b) => a.score - b.score);
    const best = found[0].got;
    out[row[0]] = { ...best.spec, themes: row[3] };
    console.error(`level ${row[0]} ${row[2]}: ${best.placed} laid, ${best.spec.pins.length} pins, ${best.spec.clicks.length} clicks, ${best.pillars} pillars, ${best.nodes} nodes, ${found.length} made, ${Date.now() - t0} ms`);
  }
  return out;
}

/** A kept level: Book I's data, its chapter in the plan, mechanical (the dial becomes the escape wheel) or with spares added. */
function keep(row) {
  const old = OLD.find(l => l.id === row[1]), spec = { ...legacySpec(old), name: row[2], chapter: chapterOf(row[0]), v: 1, power: "quartz" };
  const flags = row[5] || "";
  if (flags.includes("M")) { spec.power = "mech"; spec.trains = spec.trains.map(t => ({ ...t, sink: { ...t.sink, goal: { ...t.sink.goal, type: "escape" } } })); }
  if (flags.includes("S")) {
    // spares: pieces like the hand's, added while the answer stays the only one; a tray that lets a shorter route through gets a gear of the
    // answer pinned where the rival answer goes another way
    const answer = spec.sols[0], hand = spec.hand.split(" "), kinds = [...new Set(hand.map(h => h.slice(0, h.lastIndexOf(":"))))], cands = [];
    for (const k of kinds) { const kind = k.split("@")[0]; for (const rot of orientations(kind)) cands.push(`${kind}@${rot}`); }
    cands.push("S5.1@0");
    spec.spare = true;
    spec.pins = [...(spec.pins || [])];
    const unique = () => {
      for (let guard = 0; guard < 8; guard++) {
        const s = solve(parseLevel(spec), 2, 4e5);
        if (s.aborted) return false;
        if (s.sols.length <= 1) return s.sols.length === 1;
        const same = x => x.laid.every((p, c) => (p || null) === (answer[c] || null));
        const alt = s.sols.find(x => !same(x)).laid;
        const c = Number(Object.keys(answer).find(c => alt[c] !== answer[c] && !spec.pins.some(p => p.c === Number(c))));
        if (Number.isNaN(c)) {
          // the rival lays a piece where the answer lays none: that square becomes a pillar
          const x = alt.findIndex((p, c) => p && !answer[c]);
          if (x < 0) return false;
          const y = Math.floor(x / spec.cols), col = x % spec.cols;
          spec.map = spec.map.map((row, k) => (k === y ? row.slice(0, col) + "#" + row.slice(col + 1) : row));
          continue;
        }
        const i = answer[c].lastIndexOf("@"), kind = answer[c].slice(0, i), rot = Number(answer[c].slice(i + 1));
        spec.pins.push({ c, kind, rot, train: 0 });
        const k = spec.hand.match(new RegExp(`(^| )${answer[c].replace(/[[\]().+*?^$|\\]/g, "\\$&")}:(\\d+)`));
        spec.hand = Number(k[2]) > 1 ? spec.hand.replace(`${answer[c]}:${k[2]}`, `${answer[c]}:${Number(k[2]) - 1}`) : spec.hand.replace(new RegExp(`(^| )${answer[c].replace(/[[\]().+*?^$|\\]/g, "\\$&")}:1( |$)`), " ").trim();
        delete answer[c];
      }
      return false;
    };
    if (!unique()) throw new Error(`${row[1]}: no single answer with a tray`);
    let added = 0;
    for (const c of cands.sort((a, b) => (kinds.includes(b) ? 1 : 0) - (kinds.includes(a) ? 1 : 0) || a.localeCompare(b))) {
      if (added >= 2) break;
      const was = { hand: spec.hand, pins: spec.pins.slice(), map: spec.map.slice(), answer: { ...answer } };
      const m = spec.hand.match(new RegExp(`(^| )${c.replace(/[[\]().+*?^$|\\]/g, "\\$&")}:(\\d+)`));
      spec.hand = m ? spec.hand.replace(`${c}:${m[2]}`, `${c}:${Number(m[2]) + 1}`) : `${spec.hand} ${c}:1`;
      if (unique() && spec.pins.length <= was.pins.length + 1) added++;
      else { spec.hand = was.hand; spec.pins = was.pins; spec.map = was.map; for (const k of Object.keys(answer)) delete answer[k]; Object.assign(answer, was.answer); }
    }
    const s = solve(parseLevel(spec), 2, 4e5);
    spec.sols = s.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)));
    delete spec.sig;          // a new plate: an unfinished run on the old one starts over
  }
  return spec;
}

function write(chunks) {
  const made = Object.assign({}, ...chunks.map(f => JSON.parse(fs.readFileSync(f, "utf8"))));
  const levels = PLAN.map(row => {
    const spec = row[1] ? keep(row) : made[row[0]];
    if (!spec) throw new Error(`level ${row[0]} ${row[2]} was not made`);
    return { ...spec, id: idOf(row), name: row[2], chapter: chapterOf(row[0]), themes: spec.themes || row[3] };
  });
  const head = `// Gears: the hundred levels of the campaign (11 November 2026). Made by pipes-gear-campaign.mjs from the plan and pipes-gear-forge.js, never by
// hand; checked by tests/pipes-gear-levels.mjs, which solves every level again and wants the listed answers and no others. A level's id is its
// identity (stars are kept by it); Book I's kept levels keep their old ids and their run signature (sig).
`;
  const body = `${head}\nexport const BOOKS = ${JSON.stringify(BOOKS)};\n\nexport const CHAPTERS = [\n${CHAPTERS.map(c => `  ${JSON.stringify(c)},`).join("\n")}\n];\n\nexport const LEVELS = [\n${levels.map(l => `  ${JSON.stringify(l)},`).join("\n")}\n];\n`;
  fs.writeFileSync(new URL("pipes-gear-levels.js", import.meta.url), body);
  console.error(`wrote ${levels.length} levels`);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "make") { const res = make(Number(args[0]), Number(args[1])); fs.writeFileSync(args[2] || "/dev/stdout", JSON.stringify(res)); }
else if (mode === "write") write(args);
