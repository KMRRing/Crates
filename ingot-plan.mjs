// Ingot's Foundry: the levels as written (DESIGN), proved by the search and written to ingot-levels.js. For each level the
// search plays seeds in turn until it meets the goal; that seed is the level's, the swipes it took are the par, and the
// level allows a quarter more (rounded up to five). So every level has been met on its own pours. Run with node (no
// arguments) to write ingot-levels.js; `node ingot-plan.mjs check` only says what it would write.
//
// Korbi, 24 November 2026: "ingot needs twists ... make it and have me review them via playing them". The twists, one chapter
// each, then together: anvils (part of the mould), a hallmark (the square to cast on), slag at a level's own rate, cold squares
// (a bar on one when a swipe starts cannot merge on it).
import fs from "fs";
import { newLevel, move, hint, searchOn } from "./ingot-engine.js";

// squares: row by row, r * side + c
export const CHAPTERS = [
  { id: "apprentice", name: "Apprentice", idea: "Commissions: cast a bar in so many swipes." },
  { id: "anvils", name: "Anvils", idea: "Anvils are part of the mould: bars slide up against them, and nothing moves them." },
  { id: "hallmarks", name: "Hallmarks", idea: "The bar must be cast on the hallmarked square." },
  { id: "slag", name: "Slag", idea: "Lumps of slag are poured now and then: they block a pocket until two bars merged beside them knock them loose." },
  { id: "quench", name: "Quench", idea: "Cold squares: a bar standing on one when you swipe is quenched hard, and merges with nothing on that swipe." },
  { id: "foundry", name: "The foundry", idea: "Everything at once, on the big mould." },
];
const corners5 = [0, 4, 20, 24];
export const DESIGN = [
  // Apprentice: the plain mould, the bars growing
  { id: "first-pour", chapter: "apprentice", name: "First pour", side: 4, goal: { e: 6 }, note: "Cast a 64." },
  { id: "one-twenty-eight", chapter: "apprentice", name: "A hundred and twenty-eight", side: 4, goal: { e: 7 }, note: "Cast a 128." },
  { id: "set-bars", chapter: "apprentice", name: "Bars already set", side: 4, start: { 0: 5, 1: 4, 4: 3 }, goal: { e: 8 }, note: "A 32, a 16 and an 8 are already in the mould: build on them to a 256." },
  { id: "two-five-six", chapter: "apprentice", name: "Two hundred and fifty-six", side: 4, goal: { e: 8 }, note: "Cast a 256." },
  // Anvils
  { id: "one-anvil", chapter: "anvils", name: "One anvil", side: 4, anvils: [5], goal: { e: 7 }, note: "An anvil in the mould: bars stop against it." },
  { id: "two-anvils", chapter: "anvils", name: "Two anvils", side: 4, anvils: [5, 10], goal: { e: 7 }, note: "Two anvils across the middle." },
  { id: "forge-floor", chapter: "anvils", name: "The forge floor", side: 5, anvils: corners5, goal: { e: 8 }, note: "The big mould with its corners filled: no corner to build in." },
  { id: "split-mould", chapter: "anvils", name: "A split mould", side: 5, anvils: [2, 7, 17, 22], goal: { e: 8 }, note: "A wall of anvils down the middle, with one gap." },
  // Hallmarks
  { id: "corner-mark", chapter: "hallmarks", name: "The corner mark", side: 4, goal: { e: 7, at: 0 }, note: "Cast the 128 on the hallmark." },
  { id: "edge-mark", chapter: "hallmarks", name: "The edge mark", side: 4, goal: { e: 7, at: 1 }, note: "The hallmark is on the edge, beside the corner." },
  { id: "mark-anvil", chapter: "hallmarks", name: "Mark by the anvil", side: 4, anvils: [0], goal: { e: 7, at: 1 }, note: "An anvil holds the corner: the hallmark leans on it." },
  { id: "centre-mark", chapter: "hallmarks", name: "The centre mark", side: 5, anvils: corners5, goal: { e: 7, at: 12 }, note: "The hallmark is in the middle of the big mould." },
  // Slag
  { id: "every-seventh", chapter: "slag", name: "Every seventh pour", side: 4, slag: 7, goal: { e: 7 }, note: "Every seventh pour is a lump of slag." },
  { id: "every-fifth", chapter: "slag", name: "Every fifth pour", side: 4, slag: 5, goal: { e: 7 }, note: "Slag every fifth pour." },
  { id: "slag-anvils", chapter: "slag", name: "Slag among anvils", side: 5, anvils: corners5, slag: 6, goal: { e: 8 }, note: "Anvils in the corners, slag every sixth pour." },
  { id: "slag-mark", chapter: "slag", name: "Slag on the mark", side: 4, slag: 7, goal: { e: 7, at: 15 }, note: "Keep the hallmark clear of slag." },
  // Quench
  { id: "cold-corner", chapter: "quench", name: "A cold corner", side: 4, cold: [0], goal: { e: 7 }, note: "The corner is cold: a bar on it merges with nothing on the swipe that starts there." },
  { id: "cold-row", chapter: "quench", name: "A cold row", side: 4, cold: [4, 5, 6, 7], goal: { e: 7 }, note: "A whole row is cold." },
  { id: "quench-mark", chapter: "quench", name: "Quench and mark", side: 4, cold: [5, 6, 9, 10], goal: { e: 7, at: 3 }, note: "A cold middle, and the hallmark in a corner." },
  { id: "cold-edges", chapter: "quench", name: "Cold edges", side: 5, cold: [2, 10, 14, 22], goal: { e: 8 }, note: "The middle of every edge is cold." },
  // The foundry
  { id: "anvils-frost", chapter: "foundry", name: "Anvils and frost", side: 5, anvils: [6, 18], cold: [12], goal: { e: 8 }, note: "Two anvils and a cold heart." },
  { id: "all-at-once", chapter: "foundry", name: "All at once", side: 5, anvils: corners5, slag: 7, cold: [7, 17], goal: { e: 8, at: 12 }, note: "Anvils, slag, cold squares and a hallmark in the middle." },
  { id: "the-bell", chapter: "foundry", name: "The bell", side: 5, anvils: [0, 4], slag: 8, goal: { e: 9 }, note: "A 512, the bell metal." },
  { id: "masterwork", chapter: "foundry", name: "Masterwork", side: 5, anvils: corners5, cold: [12], goal: { e: 9, at: 2 }, note: "A 512 on the hallmark, the heart of the mould cold." },
];

const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h >>> 0; };
/** The search plays a level from a seed: the swipes it took to meet the goal, or null. */
function trial(d, seed) {
  let s = newLevel({ ...d, seed, goal: { ...d.goal, swipes: 10000 } });
  while (!s.over) { const h = hint(s.grid, 2, searchOn(s)); if (!h.dir) return null; s = move(s, h.dir).state; }
  return s.won ? s.moves : null;
}
export function prove(d) {
  for (let k = 0; k < 40; k++) {
    const seed = (hash(d.id) + k * 7919) >>> 0, par = trial(d, seed);
    if (par != null) return { ...d, seed, goal: { ...d.goal, par, swipes: Math.max(par + 5, Math.ceil((par * 1.25) / 5) * 5) } };
  }
  return null;
}

if (process.argv[1]?.endsWith("ingot-plan.mjs")) {
  const out = [], t0 = Date.now();
  for (const [i, d] of DESIGN.entries()) {
    const L = prove(d);
    if (!L) { console.log(`${i + 1} ${d.name}: NONE`); process.exitCode = 1; continue; }
    console.log(`${i + 1} ${d.name}: seed ${L.seed}, par ${L.goal.par}, allowed ${L.goal.swipes}`);
    out.push(L);
  }
  console.log(`${out.length} of ${DESIGN.length} levels proved in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (process.argv[2] !== "check" && out.length === DESIGN.length) {
    fs.writeFileSync(new URL("./ingot-levels.js", import.meta.url), "// Ingot's Foundry: its levels, each proved by the search on its seed. Written by ingot-plan.mjs, never by hand.\n" +
      `export const CHAPTERS = ${JSON.stringify(CHAPTERS, null, 1)};\n` +
      `export const LEVELS = [\n${out.map((L, i) => "  " + JSON.stringify({ n: i + 1, ...L })).join(",\n")}\n];\n`);
    console.log("ingot-levels.js written");
  }
}
