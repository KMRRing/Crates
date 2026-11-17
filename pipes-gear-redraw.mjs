// Gears: Book I's levels redrawn where Korbi's ratings were low, each in its old place (pipes-gear-book.js swaps it in), with a new id, so no
// star won on the old level counts for the new one. Each is made by the level maker (pipes-gear-forge.js) from the recipe and seed below,
// picked from the many it made by the rules his ratings gave, and proven: one answer, no shorter train, every pillar, fixed gear and load
// needed (tests/pipes-gear-levels.mjs checks the same again). Writes pipes-gear-redrawn.js: node pipes-gear-redraw.mjs
//
// 17 Nov 2026, the play log of 16 November, chapter g (The movement): Calibre 2/5 (34 s), Keyless 3/5 (1 min), against Balance 4/5, Winding
// 4/5 and Setting 5/5 (3 min each). The liked ones make the solver work three to six times as hard (500 to 850 positions, against 130 and
// 230) and run beside themselves on three to five sides that don't mesh; the disliked ones go straight from the motor to the dial. So a
// redraw is picked from the maker's levels at 500 to 1000 positions, with four or more blind sides, a duo and a trio, at most two pillars.
import fs from "fs";
import { forgeLevel } from "./pipes-gear-forge.js";
import { mix } from "./pipes-pieces.js";
import { faults, trickOf } from "./pipes-gear-plan.mjs";

const NEUTRAL = ["S5.1", "D5.1:6+6", "D5.1:5>5e", "T5.1:5-4-5", "T5.1:4-5-4e"];
/** The movement's recipe (Book I, chapter g: "everything at once: duos, trios, fixed gears, loads, jams"), quartz on the 5×5 round face. */
const recipe = (pieces, loads, fixed) => ({ cols: 5, rows: 5, disc: true, turn: false, power: "quartz", spares: 0, extras: { pins: 1, clicks: 1 }, loads, fixed,
  lastResortPins: false, minimal: true, strict: true, touch: true, limit: 4e5, chapter: "g",
  trains: [{ m: 5, l: 1, pieces, bends: 3, fams: { S: 1, D: 1, T: 1 }, kinds: NEUTRAL, mix: ["D", "T"] }] });

export const REDRAW = [
  { replaces: "wg1", name: "Calibre", pieces: 11, loads: 2, fixed: 1, seed: 33334,
    aha: "The motor and the dial almost touch at the bottom, but the fixed gear at the top is part of the train: it climbs to it on the left and comes back down the right, and the two loads say where the duo and the trio go." },
  { replaces: "wg2", name: "Keyless", pieces: 12, loads: 2, fixed: 1, seed: 25353,
    aha: "The dial is two squares from the motor, but the fixed gear on the left edge is part of the train: it goes down past it, along the bottom and back up the middle, running beside itself five times on sides that don't mesh." },
];

/** A redrawn level as level data, or an error saying why it fails. */
export function redrawn(r) {
  const res = forgeLevel(mix(50, r.seed, 77), recipe(r.pieces, r.loads, r.fixed));
  if (!res) throw new Error(`${r.name}: its seed makes nothing`);
  const spec = { ...res.spec, id: `rd-${r.name.toLowerCase()}`, name: r.name, chapter: "g", replaces: r.replaces, aha: r.aha, nodes: res.nodes,
    themes: ["Fixed gears", "Duos", "Trios", "Loads", "Jams"] };
  const f = faults(spec), t = trickOf(spec), pillars = spec.map.join("").split("#").length - 1;
  if (f.out.length) throw new Error(`${r.name}: ${f.out[0]}`);
  if (pillars > 2 || t.touch < 4 || res.nodes < 500 || res.nodes > 1000) throw new Error(`${r.name}: ${pillars} pillars, ${t.touch} blind sides, ${res.nodes} positions`);
  return spec;
}

if (process.argv[1]?.endsWith("pipes-gear-redraw.mjs")) {
  const levels = REDRAW.map(redrawn);
  fs.writeFileSync(new URL("./pipes-gear-redrawn.js", import.meta.url), `// Gears: Book I's levels redrawn where Korbi rated them low. Made by pipes-gear-redraw.mjs (node pipes-gear-redraw.mjs), never by hand.\n` +
    `export const REDRAWN = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
  for (const l of levels) console.log(`${l.name} (${l.id}, in place of ${l.replaces}): ${Object.keys(l.sols[0]).length} pieces, ${l.pins.length} fixed, ${l.clicks.length} loads, ${l.nodes} positions`);
}
