// Picks the levels of Gears' flat board from the generator and writes pipes-puzzle-levels.js: `node pipes-puzzle-pick.mjs`.
// Each slot of a chapter has a target for how hard the solver found it (squares tried), rising through the chapter; the
// generator is asked for hands of a few sizes around the recipe's and the level nearest the target is kept. Levels are
// identified by id (stars are kept by it), so to add one, give a chapter a sixth slot at the end and keep the rest as they
// are: changing a target or a recipe re-picks the chapter's levels, and the stars kept for the old ones lose their meaning.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { makeLevel } = await import(new URL("pipes-puzzle-make.js", here));
const { parseLevel } = await import(new URL("pipes-puzzle.js", here));
const { solve } = await import(new URL("pipes-puzzle-solve.js", here));

const CHAPTERS = [
  { key: "a", name: "Meshing", rule: "Mesh gears from the mainspring to the load: lay every one.", target: [18, 30, 55, 90, 140],
    names: ["Barrel", "Arbor", "Pinion", "Wheel", "Cannon"], recipe: () => ({ cols: 5, rows: 5, pieces: [7, 8, 9, 10, 11], rocks: 0 }), need: () => true },
  { key: "b", name: "Pillars", rule: "A pillar is bolted through the plate: the train goes round it.", target: [40, 80, 150, 280, 480],
    names: ["Screw", "Cock", "Bridge", "Plate", "Bezel"], recipe: () => ({ cols: 6, rows: 6, pieces: [9, 10, 11, 12, 13] }), need: m => m.rocks >= 2 },
  { key: "c", name: "Crossovers", rule: "One piece, two trains: the power may pass a crossover twice.", target: [100, 200, 350, 600, 1000],
    names: ["Rocker", "Lever", "Fusee", "Chain", "Click"], recipe: () => ({ cols: 6, rows: 6, pieces: [9, 10, 11, 12, 13], cross: true }), need: () => true },
  { key: "d", name: "Fixed gears", rule: "A dark pinned gear is part of the train: run through it.", target: [50, 110, 220, 420, 750],
    names: ["Stud", "Index", "Regulator", "Hairspring", "Balance"], recipe: i => ({ cols: 6, rows: i < 2 ? 6 : 7, pieces: [10, 11, 12, 13, 14], olds: i < 2 ? 2 : 3 }), need: m => !m.loose && m.olds >= 2 },
  { key: "e", name: "Loads", rule: "Loads are numbered and turn a set way: reach them in order.", target: [120, 250, 450, 800, 1400],
    names: ["Hours", "Minutes", "Seconds", "Date", "Moon"], recipe: i => ({ cols: 6, rows: 7, pieces: [10, 11, 12, 13, 14], stakes: i < 2 ? 2 : 3 }), need: m => !m.loose },
  { key: "f", name: "Reduction", rule: "A reduction flips the turn: all after it turn the other way.", target: [30, 60, 120, 220, 400],
    names: ["Pair", "Compound", "Ratio", "Step-down", "Count"], recipe: i => ({ cols: 6, rows: 7, pieces: [9, 10, 11, 12, 13], reds: i < 3 ? 1 : 2, stakes: i < 2 ? 2 : 3 }), need: m => !m.loose && m.reds >= 1 },
  { key: "g", name: "The movement", rule: "Everything at once: reductions, fixed gears, crossovers and loads on one plate.", target: [200, 400, 700, 1100, 1800],
    names: ["Calibre", "Keyless", "Winding", "Setting", "Motion"], recipe: i => ({ cols: 7, rows: 7, pieces: [12, 13, 14, 15, 16], reds: 1 + (i > 2 ? 1 : 0), stakes: 2, olds: i % 2 ? 2 : 0, cross: i % 2 === 0 }), need: m => !m.loose && m.reds >= 1 },
  { key: "h", name: "Complications", rule: "A bigger plate, and every piece in play.", target: [500, 900, 1500, 2400, 4000],
    names: ["Date", "Chronograph", "Repeater", "Tourbillon", "Grande"], recipe: i => ({ cols: 7, rows: 8, pieces: [14, 15, 16, 17, 18], reds: i < 3 ? 1 : 2, stakes: 3, olds: i % 2 ? 2 : 0, cross: i % 2 === 0 }), need: m => !m.loose && m.reds >= 1 },
];
const picked = [], seenSig = new Set();
for (const ch of CHAPTERS) {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const base = ch.recipe(i), cand = [], limit = ch.key === "h" || ch.key === "g" ? 250 : 300, pieces = base.pieces[i];
    for (const dp of [-1, 0, 1]) {
      const opts = { ...base, pieces: pieces + dp }, from = 300001 + i * 1000 + dp * 100000;
      for (let seed = from; seed < from + limit; seed++) {
        const m = makeLevel(seed, opts);
        if (!m || !ch.need(m)) continue;
        const sig = m.spec.map.join("") + m.spec.hand;
        if (!seenSig.has(sig)) cand.push({ seed, m, opts });
      }
    }
    if (!cand.length) throw new Error(`chapter ${ch.key} level ${i + 1}: no candidate`);
    const miss = c => Math.abs(Math.log(c.m.nodes / ch.target[i]));
    cand.sort((p, q) => miss(p) - miss(q));
    const best = cand[0];
    seenSig.add(best.m.spec.map.join("") + best.m.spec.hand);
    rows.push({ id: `g${ch.key}${i + 1}`, name: ch.names[i], m: best.m });
    console.log(`g${ch.key}${i + 1} ${ch.names[i]}: ${cand.length} candidates; seed ${best.seed}, ${best.opts.pieces} pieces, ${best.m.nodes} squares tried (target ${ch.target[i]}), spin ${best.m.spec.spin}`);
  }
  picked.push({ ch, rows });
}
const q = s => JSON.stringify(s);
let out = `// Gears, the flat board: the levels (November 2026). A level is its map (. open ground, # pillar, S the mainspring, T the load at
// the end of the train, ─ │ └ ┘ ┌ ┐ ┼ a gear already pinned to the plate, 1-9 a numbered load that turns clockwise and a-i one that turns
// counter-clockwise), the side the mainspring's teeth face (out) and the side of the end load its inlet is on, the way that load
// must turn (spin), the hand of pieces to lay (h v ne nw se sw x, rh rv the reductions, a count each), and the routes that solve it:
// the side the power leaves each square by, from the mainspring on (lower case where the piece is a reduction). Made by
// pipes-puzzle-pick.mjs from pipes-puzzle-make.js, which keeps pillars only where the level needs them to have one answer (and fixed
// gears and loads only where they are needed too), and checked by tests/pipes-puzzle.mjs, which solves every level again and wants
// those routes and no others. A level's id is its identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [\n`;
for (const { ch } of picked) out += `  { key: ${q(ch.key)}, name: ${q(ch.name)}, rule: ${q(ch.rule)} },\n`;
out += `];\n\nexport const LEVELS = [\n`;
for (const { ch, rows } of picked) {
  out += `  // ${ch.name}\n`;
  for (const r of rows) {
    const spec = r.m.spec, s = solve(parseLevel({ ...spec, id: r.id }), 5);
    out += `  { id: ${q(r.id)}, name: ${q(r.name)}, chapter: ${q(ch.key)}, out: ${q(spec.out)}, inlet: ${q(spec.inlet)}, spin: ${q(spec.spin)}, hand: ${q(spec.hand)}, sols: ${q(s.routes)},\n    map: [${spec.map.map(q).join(", ")}] },\n`;
  }
}
out += `];\n`;
fs.writeFileSync(new URL("pipes-puzzle-levels.js", here), out);
console.log("written");
