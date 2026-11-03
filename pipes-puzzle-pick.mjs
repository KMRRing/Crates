// Picks the levels of Pipes' puzzle from the generator and writes pipes-puzzle-levels.js: `node pipes-puzzle-pick.mjs`.
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
  { key: "a", name: "Laying", rule: "Lay every piece of the hand, and the oil runs through them all.", target: [18, 30, 55, 90, 140],
    names: ["Wellhead", "Flowline", "Manifold", "Gathering", "Header"], recipe: () => ({ cols: 5, rows: 5, pieces: [7, 8, 9, 10, 11], rocks: 0 }), need: () => true },
  { key: "b", name: "Rock", rule: "Rock blocks the way: the oil goes round it.", target: [40, 80, 150, 280, 480],
    names: ["Shale", "Basalt", "Scree", "Cap rock", "Bedrock"], recipe: () => ({ cols: 6, rows: 6, pieces: [9, 10, 11, 12, 13] }), need: m => m.rocks >= 2 },
  { key: "c", name: "Crossings", rule: "A crossing carries the oil across itself: one piece, two passes.", target: [100, 200, 350, 600, 1000],
    names: ["Overpass", "Interchange", "Culvert", "Viaduct", "Junction"], recipe: () => ({ cols: 6, rows: 6, pieces: [9, 10, 11, 12, 13], cross: true }), need: () => true },
  { key: "d", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it.", target: [50, 110, 220, 420, 750],
    names: ["Salvage", "Retrofit", "Legacy", "Tie-in", "Splice"], recipe: i => ({ cols: 6, rows: i < 2 ? 6 : 7, pieces: [10, 11, 12, 13, 14], olds: i < 2 ? 2 : 3 }), need: m => !m.loose && m.olds >= 2 },
  { key: "e", name: "Stakes", rule: "The oil passes the numbered stakes in order.", target: [120, 250, 450, 800, 1400],
    names: ["Survey", "Chainage", "Benchmark", "Traverse", "Datum"], recipe: i => ({ cols: 6, rows: 7, pieces: [10, 11, 12, 13, 14], stakes: i < 2 ? 2 : 3 }), need: m => !m.loose },
  { key: "f", name: "The field", rule: "Everything at once, on a bigger field.", target: [900, 1500, 2200, 3000, 4500],
    names: ["Zhoushan", "Fos", "ISAB", "Rotterdam", "Geneva"], recipe: i => ({ cols: 7, rows: 8, pieces: [14, 15, 16, 17, 18], olds: i % 2 ? 2 : 0, stakes: i > 1 ? 2 : 0, cross: i % 2 === 0 }), need: m => !m.loose },
];
const picked = [], seenSig = new Set();
for (const ch of CHAPTERS) {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const base = ch.recipe(i), cand = [], limit = ch.key === "f" ? 90 : 300, pieces = base.pieces[i];
    for (const dp of [-1, 0, 1]) {
      const opts = { ...base, pieces: pieces + dp }, from = 100001 + i * 1000 + dp * 100000;
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
    rows.push({ id: `${ch.key}${i + 1}`, name: ch.names[i], m: best.m });
    console.log(`${ch.key}${i + 1} ${ch.names[i]}: ${cand.length} candidates; seed ${best.seed}, ${best.opts.pieces} pieces, ${best.m.nodes} squares tried (target ${ch.target[i]})`);
  }
  picked.push({ ch, rows });
}
const q = s => JSON.stringify(s);
let out = `// Pipes, the puzzle: the levels (November 2026). A level is its map (. open ground, # rock, S the wellhead, T the terminal,
// ─ │ └ ┘ ┌ ┐ ┼ old pipe, 1-9 stakes), the side the wellhead's oil leaves by (out) and the side of the terminal its inlet
// is on, the hand of pieces to lay (h v ne nw se sw x, a count each), and the routes that solve it: the side the oil
// leaves each square by, from the wellhead on. Made by pipes-puzzle-pick.mjs from pipes-puzzle-make.js, which keeps rock
// only where the level needs it to have one answer (and old pipe and stakes only where they are needed too), and checked
// by tests/pipes-puzzle.mjs, which solves every level again and wants those routes and no others.
// A level's id is its identity (stars are kept by it): new levels go at the end of a chapter with a new id.

export const CHAPTERS = [\n`;
for (const { ch } of picked) out += `  { key: ${q(ch.key)}, name: ${q(ch.name)}, rule: ${q(ch.rule)} },\n`;
out += `];\n\nexport const LEVELS = [\n`;
for (const { ch, rows } of picked) {
  out += `  // ${ch.name}\n`;
  for (const r of rows) {
    const spec = r.m.spec, s = solve(parseLevel({ ...spec, id: r.id }), 5);
    out += `  { id: ${q(r.id)}, name: ${q(r.name)}, chapter: ${q(ch.key)}, out: ${q(spec.out)}, inlet: ${q(spec.inlet)}, hand: ${q(spec.hand)}, sols: ${q(s.routes)},\n    map: [${spec.map.map(q).join(", ")}] },\n`;
  }
}
out += `];\n`;
fs.writeFileSync(new URL("pipes-puzzle-levels.js", here), out);
console.log("written");
