// Picks the levels of Gears from the generator and writes pipes-train-levels.js: `node pipes-train-pick.mjs`.
// Each slot of a chapter has a recipe and a target for how hard the solver found it (squares tried), rising through the
// chapter; the generator is asked for several seeds and the level nearest the target that has what the chapter teaches is kept.
// Levels are identified by id (stars are kept by it), so to add one, give a chapter a sixth slot at the end and keep the rest as
// they are: changing a target or a recipe re-picks the chapter's levels, and the stars kept for the old ones lose their meaning.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { makeLevel } = await import(new URL("pipes-train-make.js", here));
const { discVoid } = await import(new URL("pipes-gear-engine.js", here));
const { parseLevel } = await import(new URL("pipes-train.js", here));
const { solve } = await import(new URL("pipes-train-solve.js", here));

// recipe(i) -> the generator's options for slot i; need(m) what a level of the chapter must show; target[i] the squares tried
const CHAPTERS = [
  { key: "a", name: "Meshing", rule: "Mesh gears from the mainspring to the dial: each arrow shows its turn.",
    target: [10, 25, 60, 120, 250], names: ["Barrel", "Arbor", "Pinion", "Wheel", "Cannon"],
    recipe: i => ({ cols: i < 2 ? 4 : 5, rows: i < 2 ? 4 : 5, pieces: [3, 4, 5, 6, 8][i], maxSols: 8, turns: i > 1 ? 2 : 1 }), need: () => true },
  { key: "b", name: "Duos", rule: "A duo is two small gears in one square: it flips the turn.",
    target: [20, 45, 90, 180, 350], names: ["Pair", "Couple", "Ratio", "Step-down", "Reverser"],
    recipe: i => ({ cols: 5, rows: i < 2 ? 4 : 5, pieces: [4, 5, 6, 7, 9][i], duos: [1, 1, 2, 2, 3][i], maxSols: 4, turns: 2 }), need: m => m.duos >= 1 },
  { key: "c", name: "Trios", rule: "A trio is three small gears: it keeps the turn, and meshes on two sides.",
    target: [30, 70, 140, 280, 500], names: ["Train", "Chain", "Compound", "Idler", "Triple"],
    recipe: i => ({ cols: 5, rows: i < 2 ? 4 : 5, pieces: [4, 5, 6, 7, 9][i], trios: [1, 1, 2, 2, 2][i], duos: [0, 0, 0, 1, 1][i], maxSols: 4, turns: 2 }), need: m => m.trios >= 1 },
  { key: "d", name: "Loads", rule: "A load takes a single gear that must turn the way shown.",
    target: [40, 90, 180, 350, 650], names: ["Hours", "Minutes", "Seconds", "Date", "Moon"],
    recipe: i => ({ cols: 5, rows: i < 2 ? 5 : 6, pieces: [6, 7, 8, 9, 10][i], loads: [1, 1, 2, 2, 3][i], duos: [1, 1, 1, 2, 2][i], trios: [0, 1, 0, 1, 1][i], maxSols: 1, turns: 3 }), need: m => m.loads >= 1 && m.loose === 0 },
  { key: "e", name: "Jams", rule: "Gears side by side must turn opposite ways, or they jam.",
    target: [60, 130, 260, 500, 900], names: ["Clack", "Seize", "Bind", "Lock", "Stall"],
    recipe: i => ({ cols: 6, rows: i < 3 ? 5 : 6, pieces: [8, 9, 10, 11, 12][i], duos: [2, 2, 2, 3, 3][i], trios: [0, 0, 1, 0, 1][i], loads: i > 1 ? 1 : 0, maxSols: 1, turns: 5 }), need: m => m.kills >= 1 && m.loose === 0 },
  { key: "f", name: "Fixed gears", rule: "A dark pinned gear is part of the train.",
    target: [60, 130, 260, 500, 900], names: ["Stud", "Index", "Regulator", "Hairspring", "Balance"],
    recipe: i => ({ cols: 6, rows: 6, pieces: [8, 9, 10, 11, 12][i], olds: [2, 2, 3, 3, 3][i], duos: [1, 1, 1, 2, 2][i], trios: [0, 1, 1, 1, 1][i], loads: i > 1 ? 1 : 0, maxSols: 1, turns: 4 }), need: m => m.olds >= 2 && m.loose === 0 },
  { key: "g", name: "The movement", rule: "Everything at once: duos, trios, fixed gears, loads, jams.",
    target: [120, 250, 450, 800, 1400], names: ["Calibre", "Keyless", "Winding", "Setting", "Motion"],
    recipe: i => ({ cols: 6, rows: 7, pieces: [10, 11, 12, 13, 14][i], olds: i % 2 ? 2 : 1, duos: 2 + (i > 2 ? 1 : 0), trios: 1 + (i > 3 ? 1 : 0), loads: 2, maxSols: 1, turns: 5 }), need: m => m.loose === 0 && m.kills >= 1 },
  { key: "h", name: "Complications", rule: "A bigger plate, and every piece in play.",
    target: [250, 500, 900, 1600, 2800], names: ["Date", "Chronograph", "Repeater", "Tourbillon", "Grande"],
    recipe: i => ({ cols: 7, rows: 7, pieces: [12, 13, 14, 15, 16][i], olds: i % 2 ? 2 : 1, duos: 3, trios: 2, loads: 2, maxSols: 1, turns: 6 }), need: m => m.loose === 0 },
];
const picked = [], seenSig = new Set();
for (const ch of CHAPTERS) {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const raw = ch.recipe(i), cand = [];
    // a round plate: as many squares across as it takes to hold the route's squares (and the mainspring and the dial) K times over; a level
    // that finds no answer set that small is given a little more room
    for (const K of [1.3, 1.45, 1.6, 1.8, 2.0, 2.3, 2.7, 3.2, 3.6]) {
      let d = 4;
      while (d < 10 && d * d - discVoid(d).size < K * (raw.pieces + 2)) d++;
      const base = { ...raw, cols: d, rows: d, disc: true };
      const from = 400001 + i * 1000 + ch.key.charCodeAt(0) * 10000;
      for (let seed = from; seed < from + 3 * (ch.key > "d" ? 700 : 260); seed++) {
        const m = makeLevel(seed, base);
        if (!m || !ch.need(m)) continue;
        const sig = m.spec.map.join("") + m.spec.hand;
        if (!seenSig.has(sig)) cand.push({ seed, m });
      }
      if (cand.length >= 2) break;
    }
    if (!cand.length) throw new Error(`chapter ${ch.key} level ${i + 1}: no candidate`);
    const miss = c => Math.abs(Math.log(Math.max(5, c.m.nodes) / ch.target[i]));
    cand.sort((p, q) => miss(p) - miss(q));
    const best = cand[0];
    seenSig.add(best.m.spec.map.join("") + best.m.spec.hand);
    rows.push({ id: `w${ch.key}${i + 1}`, name: ch.names[i], m: best.m });
    console.log(`w${ch.key}${i + 1} ${ch.names[i]}: ${cand.length} candidates; seed ${best.seed}, ${best.m.spec.hand}, ${best.m.nodes} squares tried (target ${ch.target[i]}), ${best.m.sols.length} answers, kills ${best.m.kills}, spin ${best.m.spec.spin}`);
  }
  picked.push({ ch, rows });
}
const q = s => JSON.stringify(s);
let out = `// Gears: the levels (4 November 2026). A level is its map (. open ground, # pillar, S the mainspring, T the dial at the end of
// the train, o and the box characters a gear pinned to the plate, ↻ a load that must turn clockwise and ↺ one that must turn
// counter-clockwise), the side the mainspring's teeth face (out) and the side the dial's teeth face (inlet), the way the dial must
// turn (spin), the hand of pieces to lay (g a single gear; dh dv dne dnw dse dsw duos; th tv tne tnw tse tsw trios; a count each),
// and the answers: the side the power leaves each square by, from the mainspring on, written N E S W for a single or fixed
// single, n e s w for a duo, ^ > v < for a trio. Made by pipes-train-pick.mjs from pipes-train-make.js, which adds pillars
// where the level needs them to have its few answers (and keeps loads and fixed gears only where they are needed too), and
// checked by tests/pipes-train.mjs, which solves every level again and wants those answers and no others. A level's id is its
// identity (stars are kept by it): new levels go at the end of a chapter.

export const CHAPTERS = [\n`;
for (const { ch } of picked) out += `  { key: ${q(ch.key)}, name: ${q(ch.name)}, rule: ${q(ch.rule)} },\n`;
out += `];\n\nexport const LEVELS = [\n`;
for (const { ch, rows } of picked) {
  out += `  // ${ch.name}\n`;
  for (const r of rows) {
    const spec = r.m.spec, s = solve(parseLevel({ ...spec, id: r.id }), 12);
    out += `  { id: ${q(r.id)}, name: ${q(r.name)}, chapter: ${q(ch.key)}, disc: true, out: ${q(spec.out)}, inlet: ${q(spec.inlet)}, spin: ${q(spec.spin)}, hand: ${q(spec.hand)}, sols: ${q(s.sols.map(x => x.route))},\n    map: [${spec.map.map(q).join(", ")}] },\n`;
  }
}
out += `];\n`;
fs.writeFileSync(new URL(process.env.OUT || "pipes-train-levels.js", here), out);
console.log("written");
