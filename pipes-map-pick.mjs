// PARKED (4 November 2026, Korbi: "Let's park the 3d mode for now, but trust it's coming later and in detail."): the 3D map is kept
// whole but not offered: pipes.js's MAP_ON turns it back on. It plays the OLD model (pipes-puzzle*.js: gears whose teeth show only on
// the sides they mesh, arbors, reductions), which the flat board has left for whole gears (pipes-train*.js); before it returns it needs
// redoing in that scheme (a stack of floors of single, duo and trio squares). Its saved keys pipes:map and pipes:mapstars are left alone.
// Picks the levels of Gears' 3D map from the generator and writes pipes-map-levels.js: `node pipes-map-pick.mjs`.
// The same way pipes-puzzle-pick.mjs picks the flat ones: each slot of a chapter has a target for how hard the solver found
// it (squares tried), rising through the chapter, and the candidate nearest the target is kept. A level's id is its identity
// (stars are kept by it): to add one, give a chapter a slot at the end; changing a target or recipe re-picks the chapter.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { makeLevel } = await import(new URL("pipes-puzzle-make.js", here));
const { parseLevel } = await import(new URL("pipes-puzzle.js", here));
const { solve } = await import(new URL("pipes-puzzle-solve.js", here));

const CHAPTERS = [
  { key: "a", name: "Stairs", rule: "A shaft joins gears between floors without meshing: both turn the same way.", target: [8, 14, 24, 40, 70],
    names: ["Landing", "Flight", "Mezzanine", "Atrium", "Penthouse"], recipe: () => ({ cols: 3, rows: 3, layers: 3, pieces: [5, 6, 7, 8, 9], climbs: 2 }), need: () => true },
  { key: "b", name: "Shafts", rule: "Bigger: four floors of four by four, and rock in the way.", target: [60, 110, 200, 350, 600],
    names: ["Winze", "Raise", "Adit", "Drift", "Stope"], recipe: () => ({ cols: 4, rows: 4, layers: 4, pieces: [9, 10, 11, 12, 13], climbs: 3 }), need: m => m.rocks >= 1 },
  { key: "c", name: "Crossovers", rule: "Two gears in one square, on separate levels.", target: [150, 300, 600, 1000],
    names: ["Rocker", "Lever", "Fusee", "Click"], recipe: () => ({ cols: 4, rows: 4, layers: 4, pieces: [9, 10, 11, 12], cross: true, climbs: 3 }), need: () => true },
  { key: "d", name: "Fixed gears and loads", rule: "Pinned gears and loads on every floor: only a side mesh reverses the turn.", target: [300, 600, 1000],
    names: ["Stud", "Index", "Regulator"], recipe: i => ({ cols: 4, rows: 4, layers: 4, pieces: [11, 12, 13], olds: i === 0 ? 2 : 0, stakes: i === 0 ? 0 : i + 1, reds: i === 2 ? 1 : 0, climbs: 3 }), need: m => !m.loose },
  { key: "e", name: "The stack", rule: "Five floors of five by five.", target: [1500, 4000, 9000],
    names: ["Orrery", "Carillon", "Cathedral"], recipe: i => ({ cols: 5, rows: 5, layers: 5, pieces: [14, 15, 16], cross: i === 1, reds: i === 2 ? 1 : 0, stakes: i === 2 ? 2 : 0, climbs: 4 }), need: m => !m.loose },
];
const picked = [], seenSig = new Set();
for (const ch of CHAPTERS) {
  const rows = [];
  for (let i = 0; i < ch.target.length; i++) {
    const base = ch.recipe(i), cand = [], limit = ch.key === "e" ? 70 : 200, pieces = base.pieces[i];
    for (const dp of [-1, 0, 1]) {
      const opts = { ...base, pieces: pieces + dp }, from = 200001 + i * 1000 + dp * 100000;
      for (let seed = from; seed < from + limit; seed++) {
        const m = makeLevel(seed, opts);
        if (!m || !ch.need(m)) continue;
        const sig = JSON.stringify(m.spec.map) + m.spec.hand;
        if (!seenSig.has(sig)) cand.push({ seed, m, opts });
      }
    }
    if (!cand.length) throw new Error(`chapter ${ch.key} level ${i + 1}: no candidate`);
    const miss = c => Math.abs(Math.log(c.m.nodes / ch.target[i]));
    cand.sort((p, q) => miss(p) - miss(q));
    const best = cand[0];
    seenSig.add(JSON.stringify(best.m.spec.map) + best.m.spec.hand);
    rows.push({ id: `m${ch.key}${i + 1}`, name: ch.names[i], m: best.m });
    console.log(`${ch.key}${i + 1} ${ch.names[i]}: ${cand.length} candidates; seed ${best.seed}, ${best.opts.pieces} pieces, ${best.m.nodes} squares tried (target ${ch.target[i]})`);
  }
  picked.push({ ch, rows });
}
const q = s => JSON.stringify(s);
let out = `// Gears, the 3D map: the levels (November 2026). A level is its map, a list of floors from the bottom, each a list of rows
// (. open ground, # pillar, S the mainspring, T the end load, ─ │ └ ┘ ┌ ┐ ┼ and the letters of pipes-puzzle.js's GLYPH fixed gears, 1-9
// numbered loads, a-i counter-clockwise ones), the side the mainspring faces by (out: N E S W U D) and the side of the terminal its inlet is on, the hand of
// pieces to lay (a count each), and the routes that solve it: the side the power leaves each square by, from the mainspring on (lower case for a reduction).
// Made by pipes-map-pick.mjs from pipes-puzzle-make.js and checked by tests/pipes-map.mjs, which solves every level again and
// wants those routes and no others. A level's id is its identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [\n`;
for (const { ch } of picked) out += `  { key: ${q(ch.key)}, name: ${q(ch.name)}, rule: ${q(ch.rule)} },\n`;
out += `];\n\nexport const LEVELS = [\n`;
for (const { ch, rows } of picked) {
  out += `  // ${ch.name}\n`;
  for (const r of rows) {
    const spec = r.m.spec, s = solve(parseLevel({ ...spec, id: r.id }), 5);
    out += `  { id: ${q(r.id)}, name: ${q(r.name)}, chapter: ${q(ch.key)}, out: ${q(spec.out)}, inlet: ${q(spec.inlet)}, spin: ${q(spec.spin)}, hand: ${q(spec.hand)}, sols: ${q(s.routes)},\n    map: [\n${spec.map.map(l => `      [${l.map(q).join(", ")}],\n`).join("")}    ] },\n`;
  }
}
out += `];\n`;
fs.writeFileSync(new URL("pipes-map-levels.js", here), out);
console.log("written");
