// Writes stow-levels.js, Stow's campaign: each level a recipe (the field, how much cargo, how many consignments, the
// sizes of piece it deals, the par it should come out at) turned into a level by stow-engine.js's makeLevel, which
// composes boards from seeds until the solver can win one in the par asked for and a careless player can't do as well.
// Deterministic: the same recipes write the same levels. Run: node tools/stow-levels.mjs
import fs from "fs";
import { makeLevel } from "../stow-engine.js";

const sq8 = { kind: "square", w: 8, h: 8 }, bays = { kind: "square", w: 9, h: 9, bays: 3 }, hex4 = { kind: "hex", radius: 4 };
const tri3 = { kind: "tri", size: 3 }, tri4 = { kind: "tri", size: 4 };
// the odd holds: a hull in section, a deck round a hatch, a cross of decks; a hexagon round a well; triangles round a hub
const hull = { kind: "square", rows: ["#########", "#########", "#########", ".#######.", ".#######.", "..#####..", "..#####..", "...###..."] };
const hatch = { kind: "square", rows: ["#########", "#########", "#########", "###...###", "###...###", "###...###", "#########", "#########", "#########"] };
const cross = { kind: "square", rows: ["...###...", "...###...", "...###...", "#########", "#########", "#########", "...###...", "...###...", "...###..."] };
const well = { kind: "hex", radius: 4, holes: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] };
const hub = { kind: "tri", size: 4, holes: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 0], [1, 0, 0], [0, 1, 0]].map(([a, b, c]) => [a, b, c]) };

const SMALL = [3, 4, 3, 1], MID = [2, 3, 4, 3, 1, 1, 0, 0, 1], FULL = [2, 3, 4, 4, 3, 2, 0, 0, 1];
const HEX_SMALL = [3, 4, 4, 1], HEX = [2, 3, 4, 4];
const TRI_SMALL = [3, 4, 4, 3, 1], TRI = [3, 4, 4, 4, 2, 1], TRI_BIG = [2, 3, 4, 4, 3, 2];

export const CHAPTERS = [
  { id: 1, title: "The hold" },
  { id: 2, title: "Bays" },
  { id: 3, title: "Hexagons" },
  { id: 4, title: "Triangles" },
  { id: 5, title: "Odd holds" },
];
// [chapter, field, fill, marks, weights, par range, easy (no careless check)]
const RECIPES = [
  [1, sq8, 0.10, 1, SMALL, [2, 4], true],
  [1, sq8, 0.14, 2, SMALL, [3, 5], true],
  [1, sq8, 0.18, 2, MID, [4, 6]],
  [1, sq8, 0.22, 3, MID, [5, 7]],
  [1, sq8, 0.25, 3, MID, [5, 8]],
  [1, sq8, 0.27, 4, FULL, [6, 9]],
  [1, sq8, 0.29, 4, FULL, [7, 10]],
  [1, sq8, 0.31, 5, FULL, [8, 11]],
  [1, sq8, 0.33, 5, FULL, [8, 12]],
  [1, sq8, 0.35, 6, FULL, [9, 14]],
  [2, bays, 0.16, 2, MID, [3, 6], true],
  [2, bays, 0.2, 3, MID, [4, 7]],
  [2, bays, 0.24, 3, FULL, [5, 8]],
  [2, bays, 0.27, 4, FULL, [6, 9]],
  [2, bays, 0.3, 5, FULL, [7, 11]],
  [2, bays, 0.32, 5, FULL, [8, 12]],
  [2, bays, 0.34, 6, FULL, [9, 13]],
  [2, bays, 0.37, 7, FULL, [10, 15]],
  [3, hex4, 0.12, 1, HEX_SMALL, [2, 4], true],
  [3, hex4, 0.16, 2, HEX_SMALL, [3, 5], true],
  [3, hex4, 0.2, 2, HEX, [4, 6]],
  [3, hex4, 0.23, 3, HEX, [4, 7]],
  [3, hex4, 0.26, 3, HEX, [5, 8]],
  [3, hex4, 0.28, 4, HEX, [6, 9]],
  [3, hex4, 0.3, 4, HEX, [6, 10]],
  [3, hex4, 0.32, 5, HEX, [7, 11]],
  [3, hex4, 0.34, 5, HEX, [8, 12]],
  [3, hex4, 0.36, 6, HEX, [9, 14]],
  [4, tri3, 0.12, 1, TRI_SMALL, [2, 5], true],
  [4, tri3, 0.16, 2, TRI_SMALL, [3, 6], true],
  [4, tri3, 0.2, 2, TRI, [4, 7]],
  [4, tri3, 0.24, 3, TRI, [5, 9]],
  [4, tri3, 0.27, 3, TRI, [6, 10]],
  [4, tri4, 0.18, 2, TRI_BIG, [6, 11]],
  [4, tri4, 0.21, 3, TRI_BIG, [8, 13]],
  [4, tri4, 0.24, 3, TRI_BIG, [9, 15]],
  [4, tri4, 0.26, 4, TRI_BIG, [11, 17]],
  [4, tri4, 0.28, 4, TRI_BIG, [12, 19]],
  [5, hull, 0.2, 2, MID, [4, 7]],
  [5, hull, 0.26, 3, FULL, [5, 9]],
  [5, hatch, 0.22, 3, FULL, [5, 9]],
  [5, hatch, 0.28, 4, FULL, [7, 11]],
  [5, cross, 0.22, 3, MID, [5, 9]],
  [5, cross, 0.28, 4, FULL, [6, 11]],
  [5, well, 0.22, 3, HEX, [5, 9]],
  [5, well, 0.28, 4, HEX, [7, 11]],
  [5, hub, 0.22, 3, TRI_BIG, [8, 14]],
  [5, hub, 0.26, 4, TRI_BIG, [10, 17]],
];

const levels = [];
const t0 = Date.now();
RECIPES.forEach(([chapter, field, fill, marks, weights, par, easy], k) => {
  const id = k + 1, recipe = { field, fill, marks, weights, par, easy, clump: field.kind === "tri" ? 3 : 4, limit: 40 };
  const lv = makeLevel(recipe, 1000 + id * 37, { tries: 80, width: 80 });
  if (!lv) throw new Error(`level ${id}: nothing the solver could win`);
  const inRange = lv.par >= par[0] && lv.par <= par[1];
  console.log(`level ${id} (chapter ${chapter}, ${field.kind}): par ${lv.par}${inRange ? "" : ` (wanted ${par[0]}–${par[1]})`}, ${lv.marks.length} consignments, ${lv.cargo.length} cargo`);
  const n = levels.filter(l => l.chapter === chapter).length + 1;
  levels.push({ id, chapter, n, field, cargo: lv.cargo, marks: lv.marks, seed: lv.seed, weights, par: lv.par, solution: lv.solution });
});
const head = "// Stow's campaign, written by tools/stow-levels.mjs from its recipes: edit those, not this file. Each level is a field,\n" +
  "// its cargo and consignments (cell indices), the seed its trays are dealt from, the piece sizes it deals (weights), its\n" +
  "// par (the fewest pieces the solver cleared it in) and that solution ([tray slot, cell], replayed by tests/stow.mjs).\n";
const out = `${head}export const CHAPTERS = ${JSON.stringify(CHAPTERS)};\nexport const LEVELS = [\n${levels.map(l => JSON.stringify(l)).join(",\n")},\n];\n`;
fs.writeFileSync(new URL("../stow-levels.js", import.meta.url), out);
console.log(`${levels.length} levels in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
