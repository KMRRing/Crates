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
  // 24 Nov 2026, Korbi: "level 52 way too into the deep end. new mechanic needs to ease the player in": two first levels of a stack
  {"n": 52, "name": "Climbing", "power": "Quartz", "themes": ["Layers+ratios", "Fixed gears"], "brief": "A stack is a wheel and a pinion on one arbor: the motor is on the lower layer, the dial on the upper, and one stack climbs between them", "face": "4×4 square (16)", "pieces": 12, "mix": "11S 1K", "extras": "F2"},
  {"n": 53, "name": "Up and down", "power": "Quartz", "themes": ["Layers+ratios", "Fixed gears"], "brief": "One stack up, one back down: entered at its wheel a stack slows the train, at its pinion it speeds it up", "face": "5×5 soft corners (21)", "pieces": 15, "mix": "13S 2K", "extras": "F2"},
  {"n": 54, "name": "Viaduct", "power": "Arbor", "themes": ["Layers+ratios", "Loads", "Duos", "Turning"], "brief": "The train crosses its own path, a load on each layer", "face": "6×6 soft corners (32)", "pieces": 23, "mix": "17S 4D 2K", "extras": "L2"},
  {"n": 55, "name": "Low bridge", "power": "Mech", "themes": ["Layers+ratios", "Spares", "Jams"], "brief": "Under a low bridge only flat pieces fit; the tray offers a stack that would not", "face": "6×5 oval (24)", "pieces": 18, "mix": "16S 2K +1K", "extras": "—"},
  {"n": 56, "name": "Minute wheel", "power": "Arbor", "themes": ["Layers+ratios", "Fixed gears"], "brief": "The arbor turns at ×1 and the dial wants ×2, a fixed gear midway ×1: two separate sums", "face": "6×6 round (28), symmetric", "pieces": 20, "mix": "17S 3K", "extras": "F1"},
  {"n": 57, "name": "Step up", "power": "Quartz", "themes": ["Layers+ratios", "Duos", "Fixed gears"], "brief": "Entered at its pinion, a stack speeds the train up: the dial's speed says which way it faces. A stack and a gear on the upper layer are fixed to start from", "face": "6×6 round (28)", "pieces": 20, "mix": "15S 3D 2K", "extras": "—"},
  {"n": 58, "name": "Fourth wheel", "power": "Mech", "themes": ["Layers+ratios", "Turning", "Trios"], "brief": "The escape wheel wants speed: every stack must climb, and its facing decides the side it is entered from", "face": "6×6 soft corners (32)", "pieces": 23, "mix": "16S 4T 3K", "extras": "—"},
  {"n": 59, "name": "Figure of eight", "power": "Quartz", "themes": ["Layers+ratios", "Trios", "Loads"], "brief": "The dial is behind the motor: the train crosses itself on the upper layer", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "15S 4T 2K 1X", "extras": "L1"},
  {"n": 60, "name": "Pinion leaves", "power": "Mech", "themes": ["Layers+ratios", "Spares", "Fixed gears", "Trios"], "brief": "Two stacks in the tray, one each way round: the escape wheel's speed says which goes in", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 3T 3K +1K", "extras": "F1"},
  {"n": 61, "name": "Bridge", "power": "Arbor", "themes": ["Layers+ratios", "Jams", "Spares", "Loads"], "brief": "A crossing and a low bridge on one face", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 3K 1X +2", "extras": "L1"},
  {"n": 62, "name": "Gear train", "power": "Mech", "themes": ["Layers+ratios", "Turning", "Spares", "Loads", "Fixed gears", "Jams", "Duos", "Trios"], "brief": "Everything so far on two layers", "face": "6×6 soft corners (32), symmetric", "pieces": 24, "mix": "14S 3D 3T 4K +2", "extras": "L1 F1"},
  {"n": 63, "name": "Hours and date", "power": "Quartz", "themes": ["Complications", "Duos"], "brief": "One train drives two dials: from the branch, both turns follow", "face": "6×6 round (28)", "pieces": 20, "mix": "16S 4D", "extras": "—"},
  {"n": 64, "name": "Moon phase", "power": "Quartz", "themes": ["Complications", "Trios", "Loads"], "brief": "Three dials off one train, a load on each branch", "face": "6×5 oval (24)", "pieces": 18, "mix": "14S 4T", "extras": "L2"},
  {"n": 65, "name": "Day and night", "power": "Arbor", "themes": ["Complications", "Layers+ratios"], "brief": "The arbor drives the hours at ×1 and a second dial at ×½", "face": "6×6 soft corners (32), symmetric", "pieces": 23, "mix": "19S 4K", "extras": "—"},
  {"n": 66, "name": "Running seconds", "power": "Mech", "themes": ["Complications", "Jams"], "brief": "The escape wheel at one end, the hands on a branch that must not jam the going train", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "22S", "extras": "P1"},
  {"n": 67, "name": "Power reserve", "power": "Arbor", "themes": ["Complications", "Fixed gears", "Turning", "Duos"], "brief": "Two dials off the arbor; a fixed gear on one branch fixes its neighbours' facing", "face": "6×6 round (28)", "pieces": 21, "mix": "16S 5D", "extras": "F1"},
  {"n": 68, "name": "Chronograph", "power": "Mech", "themes": ["Complications", "Spares", "Layers+ratios"], "brief": "The seconds branch runs fast through a stack chosen from the tray", "face": "6×6 soft corners (32)", "pieces": 23, "mix": "19S 4K +1K", "extras": "—"},
  {"n": 69, "name": "Triple calendar", "power": "Arbor", "themes": ["Complications", "Loads", "Jams", "Duos"], "brief": "Three dials off the arbor on branches close together: duos keep them from meshing", "face": "6×6 round (28)", "pieces": 21, "mix": "16S 5D", "extras": "L2"},
  {"n": 70, "name": "Annual calendar", "power": "Mech", "themes": ["Complications", "Turning", "Fixed gears", "Trios"], "brief": "Hands and date off one going train, trios turned to fit both branches", "face": "6×5 oval (24)", "pieces": 18, "mix": "13S 5T", "extras": "F1"},
  {"n": 71, "name": "Perpetual calendar", "power": "Mech", "themes": ["Complications", "Layers+ratios", "Spares", "Loads", "Jams", "Turning", "Duos"], "brief": "Three dials at three speeds off one blind train", "face": "6×6 soft corners (32), symmetric", "pieces": 24, "mix": "16S 4D 4K +2", "extras": "L1"},
  {"n": 72, "name": "Two colours", "power": "Quartz", "themes": ["Several trains", "Duos"], "brief": "Two trains of one size, one on each layer: side by side they never mesh, so they fill the plate between them", "face": "6×6 round (28)", "pieces": 20, "mix": "14S 6D", "extras": "—"},
  {"n": 73, "name": "Fine and standard", "power": "Quartz", "themes": ["Several trains", "Trios", "Loads"], "brief": "Two tooth sizes, one train on each layer: side by side, the trains pass without meshing", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4T", "extras": "L1"},
  {"n": 74, "name": "Two arbors", "power": "Arbor", "themes": ["Several trains", "Layers+ratios"], "brief": "Two trains of one size off two arbors: one climbs over the other", "face": "6×6 soft corners (32), symmetric", "pieces": 24, "mix": "20S 3K 1X", "extras": "—"},
  {"n": 75, "name": "Strike train", "power": "Mech", "themes": ["Several trains", "Jams"], "brief": "Two blind trains wound together; where they run close, only a gap keeps them apart", "face": "6×6 round (28)", "pieces": 21, "mix": "21S", "extras": "P1"},
  {"n": 76, "name": "Two motors", "power": "Quartz", "themes": ["Several trains", "Fixed gears", "Spares"], "brief": "Two motors, one train crossing over the other; a fixed gear belongs to one of them, and the tray holds one piece too many", "face": "6×5 oval (24)", "pieces": 18, "mix": "18S +1S", "extras": "F1"},
  {"n": 77, "name": "Two dials", "power": "Arbor", "themes": ["Several trains", "Turning", "Loads", "Duos"], "brief": "A load on each train fixes the facing of its duos", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 6D", "extras": "L2"},
  {"n": 78, "name": "Overpass", "power": "Mech", "themes": ["Several trains", "Layers+ratios", "Spares"], "brief": "Two trains of one size cross on the upper layer", "face": "6×6 soft corners (32)", "pieces": 24, "mix": "19S 2K 1X +2", "extras": "—"},
  {"n": 79, "name": "Dual time", "power": "Arbor", "themes": ["Several trains", "Complications", "Fixed gears"], "brief": "One train drives two dials, the other crosses it on the upper layer; fixed gears mark the border", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "22S", "extras": "F2"},
  {"n": 80, "name": "Three trains", "power": "Mech", "themes": ["Several trains", "Turning", "Jams", "Trios"], "brief": "Three trains of one size: the one above crosses the other two, which must never touch each other below", "face": "6×6 round (28)", "pieces": 21, "mix": "14S 7T", "extras": "—"},
  {"n": 81, "name": "Sonnerie", "power": "Mech", "themes": ["Several trains", "Complications", "Layers+ratios", "Spares", "Loads", "Duos"], "brief": "Three trains, one driving two dials; the chime train crosses the going train", "face": "6×6 soft corners (32), symmetric", "pieces": 25, "mix": "17S 4D 4K +2", "extras": "L1"},
  {"n": 82, "name": "Pusher", "power": "Quartz", "themes": ["Switch", "Duos"], "brief": "One layout, two pusher positions: both must run", "face": "6×6 round (28)", "pieces": 20, "mix": "15S 5D", "extras": "—"},
  {"n": 83, "name": "Return to zero", "power": "Quartz", "themes": ["Switch", "Trios", "Loads"], "brief": "Pressed, the train runs through another wheel; the load must turn right both ways", "face": "6×5 oval (24)", "pieces": 18, "mix": "13S 5T", "extras": "L1"},
  {"n": 84, "name": "Shift", "power": "Arbor", "themes": ["Switch", "Layers+ratios"], "brief": "The pusher swaps a stack in and out: both speeds must reach the dial right", "face": "6×6 soft corners (32), symmetric", "pieces": 23, "mix": "19S 4K", "extras": "—"},
  {"n": 85, "name": "Castle wheel", "power": "Mech", "themes": ["Switch", "Jams", "Fixed gears"], "brief": "A loop closes only with the pusher in: it must count even", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "22S", "extras": "F1"},
  {"n": 86, "name": "Toggle", "power": "Quartz", "themes": ["Switch", "Spares", "Turning", "Duos"], "brief": "Choose and turn the pieces so both positions run", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 6D +1", "extras": "—"},
  {"n": 87, "name": "Flyback", "power": "Arbor", "themes": ["Switch", "Complications", "Loads"], "brief": "The pusher engages the chronograph branch; released, the hands must still run", "face": "6×6 soft corners (32)", "pieces": 24, "mix": "24S", "extras": "L2"},
  {"n": 88, "name": "Split seconds", "power": "Mech", "themes": ["Switch", "Several trains", "Duos"], "brief": "The pusher couples two trains; released, they must part cleanly", "face": "6×5 oval (24)", "pieces": 18, "mix": "14S 4D", "extras": "—"},
  {"n": 89, "name": "Column wheel", "power": "Arbor", "themes": ["Switch", "Turning", "Jams", "Trios"], "brief": "Both positions on a crowded face, trios turned to fit both", "face": "6×6 round (28)", "pieces": 21, "mix": "15S 6T", "extras": "—"},
  {"n": 90, "name": "Rattrapante", "power": "Mech", "themes": ["Switch", "Layers+ratios", "Spares", "Fixed gears"], "brief": "The pusher lifts a stack to the upper layer and back", "face": "6×6 soft corners (32)", "pieces": 24, "mix": "20S 4K +1", "extras": "F1"},
  {"n": 91, "name": "Grand chronograph", "power": "Mech", "themes": ["Switch", "Complications", "Several trains", "Turning", "Loads", "Jams", "Duos"], "brief": "Two trains, the pusher and three dials", "face": "6×6 square (36), symmetric", "pieces": 26, "mix": "18S 8D", "extras": "L2"},
  {"n": 92, "name": "Full plate", "power": "Quartz", "themes": ["Full plate", "Duos", "Trios"], "brief": "With no square left empty, duos and trios are the only way to keep the count and pass beside yourself", "face": "6×6 round (28)", "pieces": 26, "mix": "14S 6D 6T", "extras": "—"},
  {"n": 93, "name": "Crowded", "power": "Quartz", "themes": ["Full plate", "Loads", "Jams", "Trios"], "brief": "A full face of singles would lock: trios where it would, loads say which way", "face": "6×5 oval (24)", "pieces": 22, "mix": "12S 10T", "extras": "L2"},
  {"n": 94, "name": "Eight days", "power": "Arbor", "themes": ["Full plate", "Layers+ratios", "Fixed gears", "Duos"], "brief": "A full face on two layers: stacks carry the speed, fixed gears hold the middle", "face": "6×6 soft corners (32), symmetric", "pieces": 28, "mix": "16S 8D 4K", "extras": "F2"},
  {"n": 95, "name": "Skeleton", "power": "Mech", "themes": ["Full plate", "Spares", "Turning", "Trios"], "brief": "Fill every square from a tray with too much, every piece turned", "face": "6×5 rectangle (30)", "pieces": 28, "mix": "16S 12T +2", "extras": "—"},
  {"n": 96, "name": "Calendar", "power": "Arbor", "themes": ["Full plate", "Complications", "Duos", "Loads"], "brief": "A full face whose train serves three dials", "face": "6×6 round (28)", "pieces": 24, "mix": "13S 11D", "extras": "L2"},
  {"n": 97, "name": "Minute repeater", "power": "Mech", "themes": ["Full plate", "Several trains", "Jams", "Trios"], "brief": "Two trains of one size fill the face between them; trios keep them apart", "face": "6×6 soft corners (32)", "pieces": 28, "mix": "16S 12T", "extras": "—"},
  {"n": 98, "name": "Monopusher", "power": "Quartz", "themes": ["Full plate", "Switch", "Spares", "Fixed gears", "Duos"], "brief": "A full face that runs in both pusher positions", "face": "6×5 oval (24)", "pieces": 21, "mix": "14S 7D +2", "extras": "F1"},
  {"n": 99, "name": "Astronomical", "power": "Mech", "themes": ["Full plate", "Complications", "Layers+ratios", "Turning", "Duos"], "brief": "Three dials at three speeds on a full two-layer face", "face": "6×6 round (28), symmetric", "pieces": 24, "mix": "13S 7D 4K", "extras": "—"},
  {"n": 100, "name": "Westminster chime", "power": "Arbor", "themes": ["Full plate", "Several trains", "Switch", "Loads", "Jams", "Trios"], "brief": "Two trains and a pusher, every square filled", "face": "6×6 soft corners (32)", "pieces": 28, "mix": "15S 13T", "extras": "L2"},
  {"n": 101, "name": "Grande sonnerie", "power": "Mech", "themes": ["Full plate", "Complications", "Several trains", "Spares", "Fixed gears", "Duos", "Trios"], "brief": "Three trains, one with two dials, one crossing another, from a tray with spares", "face": "6×6 square (36)", "pieces": 28, "mix": "16S 6D 6T +2", "extras": "F1"},
  {"n": 102, "name": "Supercomplication", "power": "Mech", "themes": ["Full plate", "Complications", "Several trains", "Switch", "Layers+ratios", "Turning", "Spares", "Loads", "Jams"], "brief": "Everything, on the one 7×7 face", "face": "7×7 round (37), symmetric", "pieces": 32, "mix": "17S 6D 5T 4K +3", "extras": "L2"},
  // 24 Nov 2026, Korbi: "three layers can be chapter specific but not recurring theme": Three storeys, the trains one to a layer
  {"n": 103, "name": "Mezzanine", "power": "Quartz", "themes": ["Three storeys", "Several trains"], "brief": "The third layer: one train on the bottom, one on the top, crossing where the top passes over", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4D", "extras": "—"},
  {"n": 104, "name": "Three storeys", "power": "Quartz", "themes": ["Three storeys", "Several trains"], "brief": "Three trains, one to a layer: side by side they never mesh, so they fill the plate between them", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4D", "extras": "—"},
  {"n": 105, "name": "Stairwell", "power": "Quartz", "themes": ["Three storeys", "Several trains", "Duos"], "brief": "Three trains on three layers: the top one crosses the bottom one", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "16S 6D", "extras": "—"},
  {"n": 106, "name": "Two landings", "power": "Arbor", "themes": ["Three storeys", "Several trains"], "brief": "The middle train crosses the bottom one, and the top one crosses the middle", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4D", "extras": "—"},
  {"n": 107, "name": "Every way", "power": "Quartz", "themes": ["Three storeys", "Several trains", "Trios"], "brief": "Each train crosses each other once: three crossings, three pairs of layers", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "16S 6T", "extras": "—"},
  {"n": 108, "name": "Tower clock", "power": "Mech", "themes": ["Three storeys", "Several trains"], "brief": "Wound, three trains climb over one another: the top one crosses both below", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4D", "extras": "—"},
  {"n": 109, "name": "Three loads", "power": "Quartz", "themes": ["Three storeys", "Several trains", "Loads"], "brief": "Three trains crossing, a load on each to turn the right way", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "18S 4D", "extras": "L3"},
  {"n": 110, "name": "Campanile", "power": "Arbor", "themes": ["Three storeys", "Several trains", "Trios", "Duos"], "brief": "Three trains, three crossings, off the arbor: the bell tower", "face": "6×5 rectangle (30)", "pieces": 22, "mix": "14S 4D 4T", "extras": "—"}
];
const ENDS = { 63: 1, 64: 2, 65: 1, 66: 1, 67: 1, 68: 1, 69: 2, 70: 1, 71: 2, 79: 1, 81: 1, 87: 1, 91: 1, 96: 2, 99: 2, 101: 1, 102: 1 };
const TRAINS = { 72: [5, 5], 73: [5, 4], 74: [5, 5], 75: [5, 5], 76: [5, 5], 77: [5, 5], 78: [5, 5], 79: [5, 5], 80: [5, 5, 5], 81: [5, 4, 5], 88: [5, 5], 91: [5, 5], 97: [5, 5], 100: [5, 5], 101: [5, 5, 4], 102: [5, 5],
  103: [5, 5], 104: [5, 5, 5], 105: [5, 5, 5], 106: [5, 5, 5], 107: [5, 5, 5], 108: [5, 5, 5], 109: [5, 5, 5], 110: [5, 5, 5] };
// [a, b]: train b crosses train a once, at a pinned crossing, b on the upper layer (b after a: a route crosses those drawn before it) (23 Nov 2026, Korbi: "multiple trains on multiple layers
// so you can have trains go on top/below each other. even up to 3 trains"); a crossing's two wheels are of one size, so the two trains are too
const CROSS = { 74: [[0, 1]], 76: [[0, 1]], 78: [[0, 1]], 79: [[0, 1]], 80: [[0, 2], [1, 2]], 81: [[0, 2]], 101: [[0, 1]],
  103: [[0, 1]], 105: [[0, 2]], 106: [[0, 1], [1, 2]], 107: [[0, 1], [0, 2], [1, 2]], 108: [[0, 2], [1, 2]], 109: [[0, 1], [1, 2]], 110: [[0, 1], [0, 2], [1, 2]] };
// Three storeys: each train's own layer, the lowest first (a crossing train is drawn after the trains it crosses, so it is higher)
const STOREYS = { 103: [1, 3], 104: [1, 2, 3], 105: [1, 2, 3], 106: [1, 2, 3], 107: [1, 2, 3], 108: [1, 2, 3], 109: [1, 2, 3], 110: [1, 2, 3] };
// themes the maker could not fit with the rest (20 Nov 2026: nothing in 150 s): left out of those levels
export const DROP = { 51: ["Spares", "Turning"], 78: ["Spares"], 58: ["Turning"], 54: ["Turning"], 62: ["Turning", "Spares"], 71: ["Turning", "Spares"], 86: ["Turning"],
  89: ["Turning"], 91: ["Turning"], 95: ["Turning"] };

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
// the extras are written letter first ("L2 F1": two loads, a fixed gear); read as the mix was (number first), they came to nothing, and the
// levels made before 24 Nov 2026 have none of their own (found making the stack chapter's first levels)
const extraOf = (s, k) => { const m = new RegExp(`\\b${k}(\\d+)`).exec(s); return m ? +m[1] : 0; };

// 22 Nov 2026, Korbi: "Book C of gears is bad right now ... Keep in mind the design decisions on watch size and gear placement density
// that we have used for the previous chapters - they are good": 5×5 faces (6×5 at most, for two trains or more dials), all but two
// squares used, as levels 18 to 47 are. The log's own faces (up to 7×7) and piece counts gave sparse levels on faces too big.
// Levels that found nothing in four and a half minutes on that face (two trains, several dials, turned pieces held by clues): the
// whole 6×5 plate, still filled but for two squares, up to five pieces fewer and six squares idle at most. (23 Nov 2026: of these only
// 79 came out in five minutes; the rest keep their sparser forms of 20 November in pipes-gear-forged.js.)
// two trains side by side, the second on the upper layer, so they may run beside each other unmeshed (23 Nov 2026: kept a row apart,
// two trains on a 6×5 plate left five to nine squares idle; on one layer, even teeth of two sizes clash)
const TOUCH = new Set([72, 73, 77]);
export const ROOMY = new Set([49, 51, 64, 66, 70, 72, 73, 76, 77, 79, 81, 87, 103, 104, 105, 106, 108]);
function denseFace(row, nT, ends, sw) {
  if (ROOMY.has(row.n)) return "6×5 rectangle (30)";
  if (nT > 1 || ends > 1 || sw) return "6×5 soft corners (26)";
  if (row.face.startsWith("6×4") || row.face.startsWith("5×5") || row.face.startsWith("4×4")) return row.face;   // (4×4: a chapter's first level, small on purpose)
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
  const fixed = extraOf(row.extras, "F"), loads = extraOf(row.extras, "L") || (has("Turning") && !fixed ? 1 : 0);   // turned pieces need a clue to settle on one answer
  const trains = mods.map((m, k) => {
    const scale = Math.min(1, perTrain * nT / Math.max(1, row.pieces - branch - nX)), share = q0 => { const q = Math.round(q0 * scale); return Math.floor(q / nT) + (k < q % nT ? 1 : 0); };
    // stacks first, then duos and trios in turn, at most 45% of the line: half a level's pieces are singles
    const dt = []; for (let d = share(nD), q = share(nTr); d + q > 0;) { if (d) { dt.push("D"); d--; } if (q) { dt.push("T"); q--; } }
    const mix = [...Array(share(nK)).fill("K"), ...dt].slice(0, Math.max(1, Math.floor(perTrain * 0.45)));
    // a train that crosses another runs on the upper layer, as an overpass does: beside the other it passes unmeshed, and only its own
    // risers and stacks bring it down to the lower one (23 Nov 2026, Korbi: "multiple trains on multiple layers so you can have trains
    // go on top/below each other")
    const over = (!!CROSS[row.n]?.some(([, b]) => b === k) && !(DROP[row.n] || []).includes("Crossing")) || (TOUCH.has(row.n) && k > 0);
    const t = { m, l: STOREYS[row.n]?.[k] ?? (over ? 2 : 1), pieces: perTrain, bends: Math.min(4, Math.floor(perTrain / 3)), fams: { S: 2, D: nD ? 1 : 0, T: nTr ? 1 : 0 }, mix };
    if (P === "A") t.barrelN = 12;
    if (nK) { t.fams.K = 2; t.stacks = share(nK) || 0; t.layers = [1, 2]; t.mods = [m]; t.adapt = false; }
    if (nX && k === 0 && !CROSS[row.n] && !(DROP[row.n] || []).includes("Crossing")) { t.self = true; t.fams.R = 0.4; t.layers = [1, 2]; t.pieces = Math.max(t.pieces, 9); }
    // where trains cross, each keeps to its own layer (the crossing train above), so they may run side by side and pass at the crossing
    // without ever meshing; a stack or riser would bring one into the other's layer
    if ((CROSS[row.n] && !(DROP[row.n] || []).includes("Crossing")) || TOUCH.has(row.n) || STOREYS[row.n]) { t.fams = { ...t.fams, R: 0, K: 0 }; t.stacks = 0; t.mix = t.mix.filter(x => x !== "K"); t.layers = [t.l]; if (over) t.pieces = Math.max(t.pieces, 7); }
    if (k === 0 && ends) t.ends = Array.from({ length: ends }, () => ({ len: 3, type: "hands" }));
    if (k === 0 && (ends || has("Switch"))) t.branchFams = { S: 4, D: nD ? 1 : 0, T: nTr ? 1 : 0 };   // branches mostly singles: half a level's pieces are
    if (k === 0 && has("Switch")) t.clutch = { len: 4 };
    return t;
  });
  return { ...faceOf(face), power: { Q: "quartz", M: "mech", A: "arbor" }[P], arbor: P === "A", turn: has("Turning"), spares: 0, spareWant: spares, spareFam: (/\+\d*([SDTK])?/.exec(row.mix) || [])[1] || "", loads, fixed,
    // a full plate has no free squares to hold a pillar, so up to two fixed pieces and two clicks settle it on one answer (23 Nov 2026)
    full: false, touch: nT === 1 || has("Jams") || has("Full plate") || !!CROSS[row.n], beside: TOUCH.has(row.n) || !!STOREYS[row.n],
    extras: { pins: has("Full plate") ? 2 : fixed ? 1 : 0, clicks: has("Full plate") ? 2 : loads ? 1 : 0, bridges: /Low bridge|Bridge/.test(row.name + row.brief) ? 2 : 0 },
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
    if (row.themes.includes("Full plate") && idle + pillars > 2) continue;          // a full plate: two squares at most idle or a pillar (23 Nov 2026)
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
  fs.writeFileSync(new URL("./pipes-gear-forged.js", import.meta.url), "// Gears: the levels made by pipes-gear-forge.js to the design log (levels 48 on). Written by pipes-gear-forged.mjs (adopt), never by hand.\n" +
    `export const FORGED = [\n${all.map(r => "  " + JSON.stringify(r)).join(",\n")}\n];\n`);
  console.log(`${all.length} forged levels: ${rows.map(r => r.n).join(", ")} adopted`);
}
