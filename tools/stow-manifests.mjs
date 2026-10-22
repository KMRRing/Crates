// Writes stow-manifests.js, Stow's campaign of manifests: each level a recipe (the hold, the crates aboard, the sizes
// of piece to cut, the rules, how hard) turned into a manifest by stow-pack.js's makeManifest, which cuts the empty
// space into pieces until the counter finds a cut with one stow and no other (when the recipe asks for one), as hard
// as asked. Seeds run on from each level's own until one does, so the same recipes write the same campaign.
// Run: node tools/stow-manifests.mjs
import fs from "fs";
import { makeManifest } from "../stow-pack.js";

const sq = (w, h, decks) => ({ kind: "square", w, h, ...(decks ? { decks } : {}) });
// a hull's hold seen from above, the bow up the page: narrowing forward
const bow = (rows, decks) => ({ kind: "square", rows, ...(decks ? { decks } : {}) });
const FORE = ["..####..", ".######.", "########", "########", "########", "########"];
const FORE7 = ["..####..", ".######.", "########", "########", "########", "########", "########"];
// piece sizes: a weight for each size, 1 up
const SMALL = [0, 2, 4, 3], MID = [0, 1, 3, 4, 3], BIG = [0, 0, 2, 4, 6], CUBES = [0, 2, 4, 4], BIGCUBES = [0, 1, 4, 6];

export const CHAPTERS = [
  { id: 1, title: "The hold" },
  { id: 2, title: "Below decks" },
  { id: 3, title: "Discharge order" },
  { id: 4, title: "Reefers" },
  { id: 5, title: "Dangerous goods" },
  { id: 6, title: "Even keel" },
  { id: 7, title: "The voyage" },
];
// [chapter, recipe]; unique unless easy, steps the counter's effort wanted
const R = (chapter, hold, cargo, weights, pieces, steps, more = {}) => [chapter, { hold, cargo, weights, pieces, steps, unique: !more.easy, ...more }];
const RECIPES = [
  // the hold: flat, the pieces and nothing else; the first dealt as they go in, the second with one to turn
  R(1, sq(4, 3), 0, [0, 1, 3, 2], [3, 3], [0, 60], { easy: true, asCut: true }),
  R(1, sq(4, 4), 1, [0, 1, 3, 3], [4, 4], [0, 200], { easy: true }),
  R(1, sq(5, 4), 2, SMALL, [5, 5], [10, 400]),
  R(1, sq(5, 5), 3, MID, [5, 6], [40, 800]),
  R(1, sq(6, 5), 4, MID, [6, 7], [100, 1500]),
  R(1, sq(6, 6), 6, BIG, [6, 7], [300, 3000]),
  R(1, sq(6, 6), 4, MID, [7, 8], [600, 5000]),
  R(1, sq(7, 7), 10, BIG, [8, 9], [1000, 8000]),
  R(1, sq(7, 7), 8, BIG, [9, 10], [2500, 20000]),
  R(1, bow(FORE7), 6, BIG, [10, 11], [4000, 60000]),
  // below decks: a hold in decks, the crane lowering each piece until it meets a crate
  R(2, sq(3, 2, 2), 0, CUBES, [3, 3], [0, 60], { easy: true, asCut: true }),
  R(2, sq(3, 3, 2), 3, CUBES, [4, 5], [4, 200]),
  R(2, sq(4, 3, 2), 4, CUBES, [5, 6], [20, 600]),
  R(2, sq(3, 3, 3), 6, BIGCUBES, [6, 7], [60, 1500]),
  R(2, sq(4, 4, 2), 6, BIGCUBES, [7, 8], [150, 4000]),
  R(2, sq(4, 3, 3), 8, BIGCUBES, [7, 9], [300, 8000]),
  R(2, sq(5, 4, 2), 6, BIGCUBES, [9, 10], [400, 30000]),
  R(2, sq(4, 4, 3), 10, BIGCUBES, [10, 11], [1000, 60000]),
  // discharge order: three ports, what comes off first stowed on top
  R(3, sq(3, 2, 2), 0, CUBES, [3, 4], [0, 200], { rules: { ports: 2 }, easy: true }),
  R(3, sq(3, 3, 2), 2, CUBES, [5, 6], [10, 600], { rules: { ports: 2 } }),
  R(3, sq(4, 3, 2), 2, CUBES, [6, 7], [40, 1500], { rules: { ports: 2 } }),
  R(3, sq(4, 3, 2), 2, CUBES, [6, 7], [80, 3000], { rules: { ports: 3 } }),
  R(3, sq(3, 3, 3), 3, BIGCUBES, [7, 8], [200, 6000], { rules: { ports: 3 } }),
  R(3, sq(4, 4, 2), 3, BIGCUBES, [8, 9], [400, 10000], { rules: { ports: 3 } }),
  R(3, sq(4, 3, 3), 3, BIGCUBES, [9, 10], [2000, 60000], { rules: { ports: 3 } }),
  R(3, sq(4, 4, 3), 5, BIGCUBES, [11, 12], [5000, 200000], { rules: { ports: 3 }, limit: 3e6 }),
  // reefers: each on a plug
  R(4, sq(5, 4), 1, SMALL, [5, 6], [0, 300], { rules: { reefers: 1 }, easy: true }),
  R(4, sq(5, 5), 2, MID, [5, 6], [20, 600], { rules: { reefers: 2 } }),
  R(4, sq(6, 5), 2, MID, [6, 7], [60, 1500], { rules: { reefers: 2 } }),
  R(4, sq(6, 6), 3, MID, [7, 8], [150, 3000], { rules: { reefers: 3 } }),
  R(4, sq(7, 6), 4, MID, [8, 9], [400, 6000], { rules: { reefers: 3 } }),
  R(4, sq(7, 7), 5, MID, [10, 11], [800, 12000], { rules: { reefers: 4 } }),
  R(4, sq(8, 7), 6, BIG, [10, 11], [1500, 30000], { rules: { reefers: 4 } }),
  R(4, bow(FORE7), 4, BIG, [11, 12], [3000, 60000], { rules: { reefers: 5 } }),
  // dangerous goods: class 3 and 5.1 never touching, not even at a corner
  R(5, sq(5, 4), 1, SMALL, [5, 6], [0, 400], { rules: { dg: [1, 1] }, easy: true }),
  R(5, sq(5, 5), 2, MID, [5, 6], [30, 800], { rules: { dg: [1, 1] } }),
  R(5, sq(6, 5), 2, MID, [6, 7], [100, 2000], { rules: { dg: [1, 2] } }),
  R(5, sq(6, 6), 3, MID, [7, 8], [250, 5000], { rules: { dg: [2, 2] } }),
  R(5, sq(7, 6), 4, MID, [8, 9], [600, 10000], { rules: { dg: [2, 2] } }),
  R(5, sq(7, 7), 5, BIG, [9, 10], [1200, 25000], { rules: { dg: [2, 3] } }),
  R(5, sq(8, 7), 6, BIG, [10, 11], [2500, 50000], { rules: { dg: [3, 3] } }),
  R(5, bow(FORE7), 4, BIG, [11, 12], [4000, 90000], { rules: { dg: [3, 3] } }),
  // even keel: the heavy cargo split so port and starboard weigh the same
  R(6, sq(4, 4), 0, SMALL, [4, 5], [0, 400], { rules: { keel: 2 }, easy: true }),
  R(6, sq(6, 4), 2, MID, [5, 6], [30, 1000], { rules: { keel: 2 } }),
  R(6, sq(6, 5), 2, MID, [6, 7], [100, 2500], { rules: { keel: 2 } }),
  R(6, sq(6, 6), 2, MID, [7, 8], [300, 6000], { rules: { keel: 3 } }),
  R(6, sq(8, 5), 3, MID, [8, 9], [600, 12000], { rules: { keel: 3 } }),
  R(6, sq(8, 6), 4, BIG, [9, 10], [1200, 30000], { rules: { keel: 4 } }),
  R(6, bow(FORE), 2, BIG, [9, 10], [2000, 60000], { rules: { keel: 4 } }),
  R(6, sq(8, 6), 6, BIG, [9, 11], [3000, 90000], { rules: { keel: 4 } }),
  // the voyage: everything at once
  R(7, sq(6, 6), 3, MID, [7, 8], [200, 5000], { rules: { reefers: 2, dg: [1, 1] } }),
  R(7, sq(6, 6), 2, MID, [7, 8], [300, 8000], { rules: { reefers: 2, keel: 2 } }),
  R(7, sq(4, 3, 3), 4, BIGCUBES, [8, 9], [500, 20000], { rules: { ports: 3 } }),
  R(7, sq(6, 7), 3, MID, [8, 9], [800, 15000], { rules: { dg: [2, 2], keel: 2 } }),
  R(7, sq(8, 6), 4, MID, [9, 10], [1500, 30000], { rules: { reefers: 2, dg: [2, 2] } }),
  R(7, sq(8, 6), 3, BIG, [9, 10], [2000, 50000], { rules: { reefers: 2, dg: [1, 2], keel: 2 } }),
  R(7, sq(5, 3, 3), 6, BIGCUBES, [9, 12], [1500, 200000], { rules: { ports: 3 }, limit: 3e6 }),
  R(7, bow(FORE7), 4, BIG, [11, 12], [5000, 150000], { rules: { reefers: 3, dg: [2, 2], keel: 2 }, limit: 3e6 }),
  // Progress is kept by a manifest's id, its place in this list, so the campaign only grows at the end: a new level
  // goes last here, whatever its chapter, and is numbered on in its chapter. In decks (October 2026): reefers on the
  // floor's sockets, dangerous goods kept apart in all three directions, an even keel with the heavy cargo stacked.
  R(4, sq(3, 3, 2), 2, CUBES, [5, 6], [20, 600], { rules: { reefers: 2 } }),
  R(4, sq(4, 3, 2), 3, CUBES, [6, 7], [60, 2000], { rules: { reefers: 2 } }),
  R(4, sq(4, 3, 3), 4, BIGCUBES, [8, 10], [300, 20000], { rules: { reefers: 3 } }),
  R(5, sq(3, 3, 2), 2, CUBES, [5, 6], [20, 800], { rules: { dg: [1, 1] } }),
  R(5, sq(4, 3, 2), 2, CUBES, [6, 8], [80, 3000], { rules: { dg: [1, 2] } }),
  R(5, sq(4, 4, 2), 4, BIGCUBES, [7, 9], [300, 20000], { rules: { dg: [2, 2] } }),
  R(6, sq(4, 2, 2), 0, CUBES, [4, 6], [10, 600], { rules: { keel: 2 } }),
  R(6, sq(4, 3, 2), 2, CUBES, [6, 8], [60, 3000], { rules: { keel: 2 } }),
  R(6, sq(4, 4, 2), 3, BIGCUBES, [7, 9], [300, 20000], { rules: { keel: 3 } }),
  R(7, sq(4, 3, 3), 3, BIGCUBES, [8, 10], [800, 60000], { rules: { reefers: 2, ports: 3 } }),
  R(7, sq(4, 4, 2), 3, BIGCUBES, [8, 10], [800, 60000], { rules: { dg: [1, 2], keel: 2 } }),
];

const levels = [], t0 = Date.now();
RECIPES.forEach(([chapter, recipe], k) => {
  const id = k + 1, t = Date.now();
  let lv = null, seed = 7000 + id * 101;
  for (let s = 0; !lv && s < 400; s++) lv = makeManifest(recipe, seed + s, { tries: 4 });
  if (!lv) throw new Error(`manifest ${id}: none would do`);
  const n = levels.filter(l => l.chapter === chapter).length + 1;
  const { steps, ...rest } = lv;
  levels.push({ id, chapter, n, ...rest, steps });
  console.log(`manifest ${id} (chapter ${chapter} · ${n}): ${lv.pieces.length} pieces, ${lv.cargo.length} aboard, counter ${steps} steps, ${Date.now() - t} ms`);
});
const head = "// Stow's manifests, written by tools/stow-manifests.mjs from its recipes: edit those, not this file. Each level is a\n" +
  "// hold, the crates already aboard and its plugs (cell indices), the pieces of its manifest (each a shape as dealt and its\n" +
  "// tags) and its stow (each piece's turn and the cell its first cell goes to), which tests/stow.mjs replays and counts.\n";
const out = `${head}export const CHAPTERS = ${JSON.stringify(CHAPTERS)};\nexport const MANIFESTS = [\n${levels.map(l => JSON.stringify(l)).join(",\n")},\n];\n`;
fs.writeFileSync(new URL("../stow-manifests.js", import.meta.url), out);
console.log(`${levels.length} manifests in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
