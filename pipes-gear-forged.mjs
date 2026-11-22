// Gears: the maker of levels 48 to 100 (20 November 2026). Korbi: "still missing the remaining gear levels, we had a whole design log ...
// it's getting a tad repetitive". The design log (the game plan's Gears tab) gives each level its power, themes, face, pieces and clues;
// ROWS is that log. A row's recipe is read off it (recipeOf) and pipes-gear-forge.js makes levels from seeds: on a face of the earlier
// chapters' size, filled but for two squares (denseFace, 22 Nov 2026), a piece fewer when a quarter of the time has found nothing; half of
// every level's pieces are singles. Trays with spares are made strict, the spares added after while the answer stays the only one. DROP
// says where a theme could not be kept. The chosen candidates are written to pipes-gear-forged.js, which pipes-gear-plan.mjs checks
// and writes into the level file with the drawn levels.
//   node pipes-gear-forged.mjs make <n,n,...> <seconds each> <dir>     candidates to <dir>/cand-<n>.json (two can run at once)
//   node pipes-gear-forged.mjs adopt <dir> <n>:<i> ...                 writes candidate i of each level n into pipes-gear-forged.js
import fs from "fs";
import { forgeLevel, WHY } from "./pipes-gear-forge.js";
import { mix as mixSeed } from "./pipes-pieces.js";
import { solve } from "./pipes-gear-solve.js";
import { parseLevel } from "./pipes-gear-engine.js";
import { trickOf, powerContacts } from "./pipes-gear-plan.mjs";

export const ROWS = [
  {"n": 48, "name": "Revolution", "power": "Mech", "themes": ["Turning", "Spares", "Duos"], "brief": "Choose the pieces, then their facing: the spare duo fits only turned a way that breaks the count", "face": "6×4 oval (20)", "pieces": 15, "mix": "11S 4D +1D", "extras": "—"},
  {"n": 49, "name": "Pivot", "power": "Arbor", "themes": ["Turning", "Loads", "Fixed gears", "Trios"], "brief": "A load at one end of a trio and a fixed gear at the other fix its facing from both sides", "face": "5×5 round (21)", "pieces": 16, "mix": "12S 4T", "extras": "L1 F1"},
  {"n": 50, "name": "Jewel", "power": "Mech", "themes": ["Turning", "Spares", "Jams", "Duos"], "brief": "In the crowd only a turned duo passes; a spare single tempts at the narrowest point", "face": "5×5 soft corners (21)", "pieces": 16, "mix": "12S 4D +1S", "extras": "—"},
  {"n": 51, "name": "Balance spring", "power": "Arbor", "themes": ["Turning", "Spares", "Loads", "Fixed gears", "Jams", "Duos", "Trios"], "brief": "Everything so far, every piece turned by you", "face": "6×5 soft corners (26), symmetric", "pieces": 20, "mix": "12S 4D 4T +2", "extras": "L1 F1"},
  {"n": 52, "name": "Step up", "power": "Quartz", "themes": ["Layers+ratios", "Duos"], "brief": "Entered at its pinion, a stack speeds the train up: the dial's speed says which way it faces", "face": "6×6 round (28)", "pieces": 20, "mix": "15S 3D 2K", "extras": "—"},
  {"n": 53, "name": "Figure of eight", "power": "Quartz", "themes": ["Layers+ratios", "Trios", "Loads"], "brief": "The dial is behind the motor: the train crosses itself on the upper layer", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "15S 4T 2K 1X", "extras": "L1"},
  {"n": 54, "name": "Fourth wheel", "power": "Mech", "themes": ["Layers+ratios", "Turning", "Trios"], "brief": "The escape wheel wants speed: every stack must climb, and its facing decides the side it is entered from", "face": "6×6 soft corners (32)", "pieces": 23, "mix": "16S 4T 3K", "extras": "—"},
  {"n": 55, "name": "Minute wheel", "power": "Arbor", "themes": ["Layers+ratios", "Fixed gears"], "brief": "The arbor turns at ×1 and the dial wants ×2, a fixed gear midway ×1: two separate sums", "face": "6×6 round (28), symmetric", "pieces": 20, "mix": "17S 3K", "extras": "F1"},
  {"n": 56, "name": "Low bridge", "power": "Mech", "themes": ["Layers+ratios", "Spares", "Jams"], "brief": "Under a low bridge only flat pieces fit; the tray offers a stack that would not", "face": "6×5 oval (24)", "pieces": 18, "mix": "16S 2K +1K", "extras": "—"},
  {"n": 57, "name": "Viaduct", "power": "Arbor", "themes": ["Layers+ratios", "Loads", "Duos", "Turning"], "brief": "The train crosses its own path, a load on each layer", "face": "6×6 soft corners (32)", "pieces": 23, "mix": "17S 4D 2K", "extras": "L2"},
  {"n": 58, "name": "Pinion leaves", "power": "Mech", "themes": ["Layers+ratios", "Spares", "Fixed gears", "Trios"], "brief": "Two stacks in the tray, one each way round: the escape wheel's speed says which goes in", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 3T 3K +1K", "extras": "F1"},
  {"n": 59, "name": "Bridge", "power": "Arbor", "themes": ["Layers+ratios", "Jams", "Spares", "Loads"], "brief": "A crossing and a low bridge on one face", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 3K 1X +2", "extras": "L1"},
  {"n": 60, "name": "Gear train", "power": "Mech", "themes": ["Layers+ratios", "Turning", "Spares", "Loads", "Fixed gears", "Jams", "Duos", "Trios"], "brief": "Everything so far on two layers", "face": "6×6 soft corners (32), symmetric", "pieces": 24, "mix": "14S 3D 3T 4K +2", "extras": "L1 F1"},
  {"n": 61, "name": "Hours and date", "power": "Quartz", "themes": ["Complications", "Duos"], "brief": "One train drives two dials: from the branch, both turns follow", "face": "6×6 round (28)", "pieces": 20, "mix": "16S 4D", "extras": "—"},
  {"n": 62, "name": "Moon phase", "power": "Quartz", "themes": ["Complications", "Trios", "Loads"], "brief": "Three dials off one train, a load on each branch", "face": "6×5 oval (24)", "pieces": 18, "mix": "14S 4T", "extras": "L2"},
  {"n": 63, "name": "Day and night", "power": "Arbor", "themes": ["Complications", "Layers+ratios"], "brief": "The arbor drives the hours at ×1 and a second dial at ×½", "face": "6×6 soft corners (32), symmetric", "pieces": 23, "mix": "19S 4K", "extras": "—"},
  {"n": 64, "name": "Running seconds", "power": "Mech", "themes": ["Complications", "Jams"], "brief": "The escape wheel at one end, the hands on a branch that must not jam the going train", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "22S", "extras": "P1"},
  {"n": 65, "name": "Power reserve", "power": "Arbor", "themes": ["Complications", "Fixed gears", "Turning", "Duos"], "brief": "Two dials off the arbor; a fixed gear on one branch fixes its neighbours' facing", "face": "6×6 round (28)", "pieces": 21, "mix": "16S 5D", "extras": "F1"},
  {"n": 66, "name": "Chronograph", "power": "Mech", "themes": ["Complications", "Spares", "Layers+ratios"], "brief": "The seconds branch runs fast through a stack chosen from the tray", "face": "6×6 soft corners (32)", "pieces": 23, "mix": "19S 4K +1K", "extras": "—"},
  {"n": 67, "name": "Triple calendar", "power": "Arbor", "themes": ["Complications", "Loads", "Jams", "Duos"], "brief": "Three dials off the arbor on branches close together: duos keep them from meshing", "face": "6×6 round (28)", "pieces": 21, "mix": "16S 5D", "extras": "L2"},
  {"n": 68, "name": "Annual calendar", "power": "Mech", "themes": ["Complications", "Turning", "Fixed gears", "Trios"], "brief": "Hands and date off one going train, trios turned to fit both branches", "face": "6×5 oval (24)", "pieces": 18, "mix": "13S 5T", "extras": "F1"},
  {"n": 69, "name": "Perpetual calendar", "power": "Mech", "themes": ["Complications", "Layers+ratios", "Spares", "Loads", "Jams", "Turning", "Duos"], "brief": "Three dials at three speeds off one blind train", "face": "6×6 soft corners (32), symmetric", "pieces": 24, "mix": "16S 4D 4K +2", "extras": "L1"},
  {"n": 70, "name": "Two colours", "power": "Quartz", "themes": ["Several trains", "Duos"], "brief": "Two trains of one size side by side: where they touch, duos keep them apart", "face": "6×6 round (28)", "pieces": 20, "mix": "14S 6D", "extras": "—"},
  {"n": 71, "name": "Fine and standard", "power": "Quartz", "themes": ["Several trains", "Trios", "Loads"], "brief": "Different tooth sizes may touch: each train takes its short way, through the other", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4T", "extras": "L1"},
  {"n": 72, "name": "Two arbors", "power": "Arbor", "themes": ["Several trains", "Layers+ratios"], "brief": "Two trains of one size off two arbors: one climbs over the other", "face": "6×6 soft corners (32), symmetric", "pieces": 24, "mix": "20S 3K 1X", "extras": "—"},
  {"n": 73, "name": "Strike train", "power": "Mech", "themes": ["Several trains", "Jams"], "brief": "Two blind trains wound together; where they run close, only a gap keeps them apart", "face": "6×6 round (28)", "pieces": 21, "mix": "21S", "extras": "P1"},
  {"n": 74, "name": "Two motors", "power": "Quartz", "themes": ["Several trains", "Fixed gears", "Spares"], "brief": "A fixed gear belongs to one train; the tray holds one piece too many for the two", "face": "6×5 oval (24)", "pieces": 18, "mix": "18S +1S", "extras": "F1"},
  {"n": 75, "name": "Two dials", "power": "Arbor", "themes": ["Several trains", "Turning", "Loads", "Duos"], "brief": "A load on each train fixes the facing of its duos", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 6D", "extras": "L2"},
  {"n": 76, "name": "Overpass", "power": "Mech", "themes": ["Several trains", "Layers+ratios", "Spares"], "brief": "Two trains of one size cross on the upper layer", "face": "6×6 soft corners (32)", "pieces": 24, "mix": "19S 2K 1X +2", "extras": "—"},
  {"n": 77, "name": "Dual time", "power": "Arbor", "themes": ["Several trains", "Complications", "Fixed gears"], "brief": "One train drives two dials, the other one; fixed gears mark the border", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "22S", "extras": "F2"},
  {"n": 78, "name": "Three trains", "power": "Mech", "themes": ["Several trains", "Turning", "Jams", "Trios"], "brief": "Three trains, two of one size kept apart, the third may touch both", "face": "6×6 round (28)", "pieces": 21, "mix": "14S 7T", "extras": "—"},
  {"n": 79, "name": "Sonnerie", "power": "Mech", "themes": ["Several trains", "Complications", "Layers+ratios", "Spares", "Loads", "Duos"], "brief": "Three trains, one driving two dials, the chime train fast", "face": "6×6 soft corners (32), symmetric", "pieces": 25, "mix": "17S 4D 4K +2", "extras": "L1"},
  {"n": 80, "name": "Pusher", "power": "Quartz", "themes": ["Switch", "Duos"], "brief": "One layout, two pusher positions: both must run", "face": "6×6 round (28)", "pieces": 20, "mix": "15S 5D", "extras": "—"},
  {"n": 81, "name": "Return to zero", "power": "Quartz", "themes": ["Switch", "Trios", "Loads"], "brief": "Pressed, the train runs through another wheel; the load must turn right both ways", "face": "6×5 oval (24)", "pieces": 18, "mix": "13S 5T", "extras": "L1"},
  {"n": 82, "name": "Shift", "power": "Arbor", "themes": ["Switch", "Layers+ratios"], "brief": "The pusher swaps a stack in and out: both speeds must reach the dial right", "face": "6×6 soft corners (32), symmetric", "pieces": 23, "mix": "19S 4K", "extras": "—"},
  {"n": 83, "name": "Castle wheel", "power": "Mech", "themes": ["Switch", "Jams", "Fixed gears"], "brief": "A loop closes only with the pusher in: it must count even", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "22S", "extras": "F1"},
  {"n": 84, "name": "Toggle", "power": "Quartz", "themes": ["Switch", "Spares", "Turning", "Duos"], "brief": "Choose and turn the pieces so both positions run", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 6D +1", "extras": "—"},
  {"n": 85, "name": "Flyback", "power": "Arbor", "themes": ["Switch", "Complications", "Loads"], "brief": "The pusher engages the chronograph branch; released, the hands must still run", "face": "6×6 soft corners (32)", "pieces": 24, "mix": "24S", "extras": "L2"},
  {"n": 86, "name": "Split seconds", "power": "Mech", "themes": ["Switch", "Several trains", "Duos"], "brief": "The pusher couples two trains; released, they must part cleanly", "face": "6×5 oval (24)", "pieces": 18, "mix": "14S 4D", "extras": "—"},
  {"n": 87, "name": "Column wheel", "power": "Arbor", "themes": ["Switch", "Turning", "Jams", "Trios"], "brief": "Both positions on a crowded face, trios turned to fit both", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 6T", "extras": "—"},
  {"n": 88, "name": "Rattrapante", "power": "Mech", "themes": ["Switch", "Layers+ratios", "Spares", "Fixed gears"], "brief": "The pusher lifts a stack to the upper layer and back", "face": "6×6 soft corners (32)", "pieces": 24, "mix": "20S 4K +1", "extras": "F1"},
  {"n": 89, "name": "Grand chronograph", "power": "Mech", "themes": ["Switch", "Complications", "Several trains", "Turning", "Loads", "Jams", "Duos"], "brief": "Two trains, the pusher and three dials", "face": "6×6 square (36), symmetric", "pieces": 26, "mix": "18S 8D", "extras": "L2"},
  {"n": 90, "name": "Full plate", "power": "Quartz", "themes": ["Full plate", "Duos", "Trios"], "brief": "With no square left empty, duos and trios are the only way to keep the count and pass beside yourself", "face": "6×6 round (28)", "pieces": 26, "mix": "14S 6D 6T", "extras": "—"},
  {"n": 91, "name": "Crowded", "power": "Quartz", "themes": ["Full plate", "Loads", "Jams", "Trios"], "brief": "A full face of singles would lock: trios where it would, loads say which way", "face": "6×5 oval (24)", "pieces": 22, "mix": "12S 10T", "extras": "L2"},
  {"n": 92, "name": "Eight days", "power": "Arbor", "themes": ["Full plate", "Layers+ratios", "Fixed gears", "Duos"], "brief": "A full face on two layers: stacks carry the speed, fixed gears hold the middle", "face": "6×6 soft corners (32), symmetric", "pieces": 28, "mix": "16S 8D 4K", "extras": "F2"},
  {"n": 93, "name": "Skeleton", "power": "Mech", "themes": ["Full plate", "Spares", "Turning", "Trios"], "brief": "Fill every square from a tray with too much, every piece turned", "face": "6×5 rectangle (30)", "pieces": 28, "mix": "16S 12T +2", "extras": "—"},
  {"n": 94, "name": "Calendar", "power": "Arbor", "themes": ["Full plate", "Complications", "Duos", "Loads"], "brief": "A full face whose train serves three dials", "face": "6×6 round (28)", "pieces": 24, "mix": "13S 11D", "extras": "L2"},
  {"n": 95, "name": "Minute repeater", "power": "Mech", "themes": ["Full plate", "Several trains", "Jams", "Trios"], "brief": "Two trains of one size fill the face between them; trios keep them apart", "face": "6×6 soft corners (32)", "pieces": 28, "mix": "16S 12T", "extras": "—"},
  {"n": 96, "name": "Monopusher", "power": "Quartz", "themes": ["Full plate", "Switch", "Spares", "Fixed gears", "Duos"], "brief": "A full face that runs in both pusher positions", "face": "6×5 oval (24)", "pieces": 21, "mix": "14S 7D +2", "extras": "F1"},
  {"n": 97, "name": "Astronomical", "power": "Mech", "themes": ["Full plate", "Complications", "Layers+ratios", "Turning", "Duos"], "brief": "Three dials at three speeds on a full two-layer face", "face": "6×6 round (28), symmetric", "pieces": 24, "mix": "13S 7D 4K", "extras": "—"},
  {"n": 98, "name": "Westminster chime", "power": "Arbor", "themes": ["Full plate", "Several trains", "Switch", "Loads", "Jams", "Trios"], "brief": "Two trains and a pusher, every square filled", "face": "6×6 soft corners (32)", "pieces": 28, "mix": "15S 13T", "extras": "L2"},
  {"n": 99, "name": "Grande sonnerie", "power": "Mech", "themes": ["Full plate", "Complications", "Several trains", "Spares", "Fixed gears", "Duos", "Trios"], "brief": "Three trains, one with two dials, from a tray with spares", "face": "6×6 square (36)", "pieces": 28, "mix": "16S 6D 6T +2", "extras": "F1"},
  {"n": 100, "name": "Supercomplication", "power": "Mech", "themes": ["Full plate", "Complications", "Several trains", "Switch", "Layers+ratios", "Turning", "Spares", "Loads", "Jams"], "brief": "Everything, on the one 7×7 face", "face": "7×7 round (37), symmetric", "pieces": 32, "mix": "17S 6D 5T 4K +3", "extras": "L2"}
];
const ENDS = { 61: 1, 62: 2, 63: 1, 64: 1, 65: 1, 66: 1, 67: 2, 68: 1, 69: 2, 77: 1, 79: 1, 85: 1, 89: 1, 94: 2, 97: 2, 99: 1, 100: 1 };
const TRAINS = { 70: [5, 5], 71: [5, 4], 72: [5, 5], 73: [5, 5], 74: [5, 5], 75: [5, 5], 76: [5, 5], 77: [5, 5], 78: [5, 5, 4], 79: [5, 4, 5], 86: [5, 5], 89: [5, 5], 95: [5, 5], 98: [5, 5], 99: [5, 5, 4], 100: [5, 5] };
const CROSS = { 72: [[0, 1]], 76: [[0, 1]] };
// themes the maker could not fit with the rest (20 Nov 2026: nothing in 150 s): left out of those levels
export const DROP = { 51: ["Spares", "Turning"], 76: ["Spares", "Crossing"], 54: ["Turning"], 57: ["Turning"], 60: ["Turning", "Spares"], 69: ["Turning", "Spares"], 72: ["Crossing"], 84: ["Turning"],
  87: ["Turning"], 89: ["Turning"], 93: ["Turning"] };

function faceOf(f) {
  const m = /^(\d)×(\d) (\w[\w ]*?) \(/.exec(f), cols = +m[1], rows = +m[2], kind = m[3];
  if (kind === "round" && cols === rows && cols !== 6) return { cols, rows, disc: true };
  const g = Array.from({ length: rows }, () => Array(cols).fill("."));
  if (kind === "soft corners" || kind === "oval") for (const [x, y] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]]) g[y][x] = " ";
  if (kind === "round") for (const [x, y] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]]) g[y][x] = " ";
  return { cols, rows, face: g.map(r => r.join("")) };
}
const faceSquares = f => { const F = faceOf(f); return F.face ? F.face.join("").replace(/ /g, "").length : F.cols * F.rows - (F.disc ? (F.cols === 5 ? 4 : 12) : 0); };
const count = (s, k) => { const m = new RegExp(`(\\d+)${k}\\b`).exec(s); return m ? +m[1] : 0; };

// 22 Nov 2026, Korbi: "Book C of gears is bad right now ... Keep in mind the design decisions on watch size and gear placement density
// that we have used for the previous chapters - they are good": 5×5 faces (6×5 at most, for two trains or more dials), all but two
// squares used, as levels 18 to 47 are. The log's own faces (up to 7×7) and piece counts gave sparse levels on faces too big.
// Levels that found nothing in four and a half minutes on that face (two trains, several dials, turned pieces held by clues): the
// whole 6×5 plate, still filled but for two squares, up to five pieces fewer and six squares idle at most.
export const ROOMY = new Set([49, 51, 62, 64, 68, 70, 71, 74, 75, 77, 79, 85]);
function denseFace(row, nT, ends, sw) {
  if (ROOMY.has(row.n)) return "6×5 rectangle (30)";
  if (nT > 1 || ends > 1 || sw) return "6×5 soft corners (26)";
  if (row.face.startsWith("6×4") || row.face.startsWith("5×5")) return row.face;
  return /round|soft|oval/.test(row.face) ? "5×5 soft corners (21)" : "5×5 square (25)";
}

export function recipeOf(row, extra = {}, less = 0) {
  const has = t => row.themes.includes(t) && !(DROP[row.n] || []).includes(t), P = { Quartz: "Q", Mech: "M", Arbor: "A" }[row.power];
  const mods = TRAINS[row.n] || [5], nT = mods.length, ends = ENDS[row.n] || 0;
  const spares = has("Spares") ? (/\+(\d+)/.exec(row.mix) || [0, 0])[1] | 0 : 0;
  const nD = count(row.mix, "D"), nTr = count(row.mix, "T"), nK = count(row.mix, "K"), nX = count(row.mix, "X");
  const face = denseFace(row, nT, ends, has("Switch")), squares = faceSquares(face);
  // the face full but for two squares (none on a full plate), less one more each quarter of the time that finds nothing
  const pieces = squares - 2 * nT - ends - (has("Switch") ? 1 : 0) - (has("Full plate") ? 0 : 2) - less;
  const branch = ends * 3 + (has("Switch") ? 4 : 0), perTrain = Math.max(5, Math.round((pieces - branch - nX) / nT));
  const fixed = count(row.extras, "F"), loads = count(row.extras, "L") || (has("Turning") && !fixed ? 1 : 0);   // turned pieces need a clue to settle on one answer
  const trains = mods.map((m, k) => {
    const scale = Math.min(1, perTrain * nT / Math.max(1, row.pieces - branch - nX)), share = q0 => { const q = Math.round(q0 * scale); return Math.floor(q / nT) + (k < q % nT ? 1 : 0); };
    // stacks first, then duos and trios in turn, at most 45% of the line: half a level's pieces are singles
    const dt = []; for (let d = share(nD), q = share(nTr); d + q > 0;) { if (d) { dt.push("D"); d--; } if (q) { dt.push("T"); q--; } }
    const mix = [...Array(share(nK)).fill("K"), ...dt].slice(0, Math.max(1, Math.floor(perTrain * 0.45)));
    const t = { m, l: 1, pieces: perTrain, bends: Math.min(4, Math.floor(perTrain / 3)), fams: { S: 2, D: nD ? 1 : 0, T: nTr ? 1 : 0 }, mix };
    if (P === "A") t.barrelN = 12;
    if (nK) { t.fams.K = 2; t.stacks = share(nK) || 0; t.layers = [1, 2]; t.mods = [m]; t.adapt = false; }
    if (nX && k === 0 && !CROSS[row.n] && !(DROP[row.n] || []).includes("Crossing")) { t.self = true; t.fams.R = 0.4; t.layers = [1, 2]; t.pieces = Math.max(t.pieces, 9); }
    if (CROSS[row.n] && !(DROP[row.n] || []).includes("Crossing") && k === 1) { t.fams.R = 0.4; t.layers = [1, 2]; t.pieces = Math.max(t.pieces, 7); }
    if (k === 0 && ends) t.ends = Array.from({ length: ends }, () => ({ len: 3, type: "hands" }));
    if (k === 0 && (ends || has("Switch"))) t.branchFams = { S: 4, D: nD ? 1 : 0, T: nTr ? 1 : 0 };   // branches mostly singles: half a level's pieces are
    if (k === 0 && has("Switch")) t.clutch = { len: 4 };
    return t;
  });
  return { ...faceOf(face), power: { Q: "quartz", M: "mech", A: "arbor" }[P], arbor: P === "A", turn: has("Turning"), spares: 0, spareWant: spares, spareFam: (/\+\d*([SDTK])?/.exec(row.mix) || [])[1] || "", loads, fixed,
    full: false, touch: nT === 1 || has("Jams") || has("Full plate"), extras: { pins: fixed ? 1 : 0, clicks: loads ? 1 : 0, bridges: /Low bridge|Bridge/.test(row.name + row.brief) ? 2 : 0 },
    lastResortPins: false, minimal: true, strict: true, trains, cross: has("Crossing") || !(DROP[row.n] || []).includes("Crossing") ? CROSS[row.n] || [] : [], limit: 4e5, nodes: 1500 + 300 * row.pieces, ...extra };
}


/** A tray with spares: pieces like the hand's added one at a time while the answer stays the only one with pieces left out. */
function withSpares(spec, want, fam) {
  if (!want) return { spec, nodes: null };
  const hand = {}; for (const part of spec.hand.split(/\s+/)) { const i = part.lastIndexOf(":"); hand[part.slice(0, i)] = Number(part.slice(i + 1)); }
  let cur = { ...spec, spare: true }, nodes = 0;
  for (let k = 0; k < want; k++) {
    const keys = Object.keys(hand).filter(h => !fam || h.startsWith(fam)), opts = [];
    for (const h of keys) { const [kind, rot] = h.split("@"); if (rot === undefined) opts.push(h); else for (const r of [0, 1, 2, 3]) opts.push(`${kind}@${r}`); }
    let ok = null;
    for (const o of [...new Set(opts)].sort(() => Math.random() - 0.5)) {
      const h2 = { ...hand, [o]: (hand[o] || 0) + 1 }, t = { ...cur, hand: Object.entries(h2).map(([p, c]) => `${p}:${c}`).join(" ") };
      const sv = solve(parseLevel(t), 2, 3e6);
      if (!sv.aborted && sv.sols.length === 1) { ok = { t, h2, nodes: sv.nodes }; break; }
    }
    if (!ok) return null;
    cur = ok.t; Object.assign(hand, ok.h2); nodes = ok.nodes;
  }
  return { spec: cur, nodes };
}

const [mode, list, secs = "60", dir = "."] = process.argv[1]?.endsWith("pipes-gear-forged.mjs") ? process.argv.slice(2) : [];
if (mode === "make") for (const n of list.split(",").map(Number)) {
  const row = ROWS.find(r => r.n === n), got = [], t0 = Date.now(), why = {}, budget = Number(secs) * 1000;
  let k = 0, less = 0, stageAt = t0, recipe = recipeOf(row, {}, less);
  for (; Date.now() - t0 < budget; k++) {
    // with nothing after a quarter of the time, one piece fewer (at most three; five on the whole plate)
    if (!got.length && Date.now() - stageAt > budget / 4 && less < (ROOMY.has(n) ? 5 : 3)) { less += 1; recipe = recipeOf(row, {}, less); stageAt = Date.now(); }
    let res = null;
    try { res = forgeLevel(mixSeed(n, k, 77), recipe); } catch (e) { why[e.message] = (why[e.message] || 0) + 1; continue; }
    if (!res) continue;
    const sp = withSpares(res.spec, recipe.spareWant, recipe.spareFam);
    if (!sp) continue;
    const s = sp.spec;
    const _s = s, idle = s.map.join("").split("").filter((ch, c) => ch === "." && !s.sols[0][c] && !s.pins.some(p => p.c === c) && !s.trains.some(t => t.barrel.c === c || t.sink.c === c)).length;
    const pillars = s.map.join("").split("").filter(ch => ch === "#").length;
    let meshed = 1, trick = {};
    try { if (s.trains.length === 1) { trick = trickOf(s); if (recipe.arbor) meshed = powerContacts(s); } } catch { /* a shape the plan tool can't read */ }
    if (meshed > 1 || idle > (ROOMY.has(n) ? 6 : 5) || pillars > 3) continue;   // dense: a handful of squares idle at most
    got.push({ seed: k, less, nodes: sp.nodes || res.nodes, idle, pillars, pieces: Object.keys(s.sols[0]).length, ...trick, spec: s });
  }
  got.sort((a, b) => (a.idle + a.pillars) - (b.idle + b.pillars) || (b.touch || 0) - (a.touch || 0) || b.nodes - a.nodes);
  fs.writeFileSync(`${dir}/cand-${n}.json`, JSON.stringify({ n, tries: k, got: got.slice(0, 6), why }));
  console.log(JSON.stringify(Object.entries(WHY).sort((a,b)=>b[1]-a[1]).slice(0,5))); for (const q in WHY) delete WHY[q]; console.log(`${n} ${row.name}: ${got.length} of ${k} tries${got[0] ? `, best idle ${got[0].idle} pillars ${got[0].pillars} nodes ${got[0].nodes} pieces ${got[0].pieces} less ${got[0].less}` : ""}`);
}

if (mode === "adopt") {
  const picks = process.argv.slice(4).map(a => a.split(":").map(Number)), rows = picks.map(([n, i]) => {
    const row = ROWS.find(r => r.n === n), c = JSON.parse(fs.readFileSync(`${list}/cand-${n}.json`)).got[i];
    return { n, name: row.name, power: row.power, themes: row.themes.filter(t => !(DROP[n] || []).includes(t)), aha: row.brief + ".", seed: c.seed, spec: c.spec };
  });
  const old = fs.existsSync(new URL("./pipes-gear-forged.js", import.meta.url)) ? (await import("./pipes-gear-forged.js")).FORGED.filter(r => !picks.some(([n]) => n === r.n)) : [];
  const all = [...old, ...rows].sort((a, b) => a.n - b.n);
  fs.writeFileSync(new URL("./pipes-gear-forged.js", import.meta.url), "// Gears: the levels made by pipes-gear-forge.js to the design log (levels 48 to 100). Written by pipes-gear-forged.mjs (adopt), never by hand.\n" +
    `export const FORGED = [\n${all.map(r => "  " + JSON.stringify(r)).join(",\n")}\n];\n`);
  console.log(`${all.length} forged levels: ${rows.map(r => r.n).join(", ")} adopted`);
}
