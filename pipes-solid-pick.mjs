// Picks the levels of Pipes' solids from the generator and writes pipes-cube-levels.js or pipes-dodeca-levels.js:
// `node pipes-solid-pick.mjs cube` (or `dodeca`). Each slot of a chapter has a target for how hard the solver found it (squares
// tried), rising through the chapter; the generator is asked for routes of a few sizes around the recipe's and the level nearest the
// target is kept. Levels are identified by id (stars are kept by it), so to add one, give a chapter a slot at the end and keep the rest
// as they are: changing a target or a recipe re-picks the chapter's levels, and the stars kept for the old ones lose their meaning.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { makeLevel } = await import(new URL("pipes-solid-make.js", here));

const SOLIDS = {
  cube: {
    file: "pipes-cube-levels.js", title: "the cube", prefix: "cube-",
    chapters: [
      { key: "a", name: "Edges", rule: "The oil runs over the edges from one face to the next. Turn the pieces to fit.", target: [60, 150, 300, 600],
        names: ["Arris", "Quoin", "Mitre", "Hip"], recipe: i => ({ solid: "cube", m: 3, pieces: 8 + i, edges: 2 + (i > 1 ? 1 : 0) }), need: () => true },
      { key: "b", name: "Crossings", rule: "A crossing carries the oil across itself: one piece, two passes.", target: [300, 700, 1500, 3000],
        names: ["Gantry", "Flyover", "Trestle", "Span"], recipe: i => ({ solid: "cube", m: 3, pieces: 10 + i, cross: true, edges: 3 }), need: () => true },
      { key: "c", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it.", target: [500, 1200, 2500, 5000],
        names: ["Spool", "Flange", "Gasket", "Coupling"], recipe: i => ({ solid: "cube", m: 3, pieces: 11 + i, olds: 2 + (i > 1 ? 1 : 0), edges: 3 }), need: m => !m.loose && m.olds >= 2 },
      { key: "d", name: "Stakes", rule: "The oil passes the numbered stakes in order.", target: [1500, 4000, 9000, 20000],
        names: ["Peg", "Marker", "Cairn", "Bearing"], recipe: i => ({ solid: "cube", m: 4, pieces: 12 + i, stakes: 2 + (i > 1 ? 1 : 0), edges: 3 }), need: m => !m.loose },
      { key: "e", name: "The cube", rule: "Everything at once, on the big cube.", target: [8000, 20000, 45000, 100000],
        names: ["Tallinn", "Zug", "Ningbo", "Fujairah"], recipe: i => ({ solid: "cube", m: 4, pieces: 14 + i, cross: i % 2 === 0, olds: i % 2 ? 2 : 0, stakes: i > 1 ? 2 : 0, edges: 3 }), need: m => !m.loose },
    ],
  },
  dodeca: {
    file: "pipes-dodeca-levels.js", title: "the dodecahedron", prefix: "dodeca-",
    chapters: [
      { key: "a", name: "Pentagons", rule: "Five sides to every tile: a tight bend joins neighbours, an easy bend skips one.", target: [20, 50, 100, 200],
        names: ["Apex", "Facet", "Ridge", "Crest"], recipe: i => ({ solid: "dodeca", m: 1, pieces: 5 + i, edges: 4 }), need: () => true },
      { key: "b", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it.", target: [60, 150, 300, 600],
        names: ["Spool", "Flange", "Gasket", "Coupling"], recipe: i => ({ solid: "dodeca", m: 1, pieces: 7 + (i > 1 ? 1 : 0), olds: 2, edges: 4 }), need: m => !m.loose && m.olds >= 2 },
      { key: "c", name: "Stakes", rule: "The oil passes the numbered stakes in order.", target: [100, 250, 500, 1000],
        names: ["Peg", "Marker", "Cairn", "Bearing"], recipe: i => ({ solid: "dodeca", m: 1, pieces: 8 + (i > 1 ? 1 : 0), stakes: 2, olds: i % 2, edges: 4 }), need: m => !m.loose },
    ],
  },
};
const which = process.argv[2];
const cfg = SOLIDS[which];
if (!cfg) throw new Error("node pipes-solid-pick.mjs cube | dodeca");
const picked = [], seenSig = new Set(), q = s => JSON.stringify(s);
for (const ch of cfg.chapters) {
  const rows = [];
  for (let i = 0; i < ch.target.length; i++) {
    const base = ch.recipe(i), cand = [], limit = 160;
    for (const dp of [-1, 0, 1]) {
      const opts = { ...base, pieces: base.pieces + dp }, from = 100001 + i * 1000 + (dp + 1) * 100000;
      for (let seed = from; seed < from + limit; seed++) {
        const m = makeLevel(seed, opts);
        if (!m || !ch.need(m)) continue;
        const sig = JSON.stringify([m.spec.src, m.spec.term, m.spec.rocks, m.spec.olds, m.spec.stakes, m.spec.hand]);
        if (!seenSig.has(sig)) cand.push({ seed, m, opts });
      }
    }
    if (!cand.length) throw new Error(`chapter ${ch.key} level ${i + 1}: no candidate`);
    const miss = c => Math.abs(Math.log(Math.max(1, c.m.nodes) / ch.target[i]));
    cand.sort((p, q2) => miss(p) - miss(q2));
    const best = cand[0];
    seenSig.add(JSON.stringify([best.m.spec.src, best.m.spec.term, best.m.spec.rocks, best.m.spec.olds, best.m.spec.stakes, best.m.spec.hand]));
    rows.push({ id: `${cfg.prefix}${ch.key}${i + 1}`, name: ch.names[i], m: best.m });
    console.log(`${ch.key}${i + 1} ${ch.names[i]}: ${cand.length} candidates; seed ${best.seed}, ${best.opts.pieces} pieces, ${best.m.rocks} rocks, ${best.m.nodes} squares tried (target ${ch.target[i]})`);
  }
  picked.push({ ch, rows });
}
let out = `// Pipes on ${cfg.title}: the levels (November 2026). A level is where the wellhead (src) and the terminal (term) are, as [tile, side], its rock, its old pipe
// (tile: piece), its stakes (tiles, in order), the hand of pieces to lay (a b x, a count each) and the routes that solve it: the side
// the oil leaves each tile by, as digits, from the wellhead's outlet on. Made by pipes-solid-pick.mjs from pipes-solid-make.js, which keeps rock
// only where the level needs it to have one answer (and old pipe and stakes only where they are needed too), and checked
// by tests/pipes-solid.mjs, which solves every level again and wants those routes and no others.
// A level's id is its identity (stars are kept by it): new levels go at the end of a chapter with a new id.

export const CHAPTERS = [\n`;
for (const { ch } of picked) out += `  { key: ${q(ch.key)}, name: ${q(ch.name)}, rule: ${q(ch.rule)} },\n`;
out += `];\n\nexport const LEVELS = [\n`;
const { parseLevel } = await import(new URL("pipes-solid.js", here));
const { solve } = await import(new URL("pipes-solid-solve.js", here));
for (const { ch, rows } of picked) {
  out += `  // ${ch.name}\n`;
  for (const r of rows) {
    const sp = r.m.spec, spec = { ...sp, id: r.id }, s = solve(parseLevel(spec), 5);
    out += `  { id: ${q(r.id)}, name: ${q(r.name)}, chapter: ${q(ch.key)}, solid: ${q(sp.solid)}, m: ${sp.m}, src: ${q(sp.src)}, term: ${q(sp.term)}, rocks: ${q(sp.rocks)}, olds: ${q(sp.olds)}, stakes: ${q(sp.stakes)}, hand: ${q(sp.hand)}, sols: ${q(s.routes)} },\n`;
  }
}
out += `];\n`;
fs.writeFileSync(new URL(cfg.file, here), out);
console.log("written", cfg.file);
