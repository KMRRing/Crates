// Picks the levels of Gears 2 from the generator and writes pipes-gear-levels.js: `node pipes-gear-pick.mjs [chapter keys…]` (no keys: all).
// Each slot of a chapter has a recipe and a target for how hard the solver found it (pieces tried), rising through the chapter; the
// generator is asked for many seeds and the level nearest the target that shows what the chapter teaches is kept. A level's id is its
// identity (stars are kept by it): to add one, give a chapter a new slot at the end; changing a recipe re-picks the chapter and the stars
// kept for its old levels lose their meaning. The levels already in the file are kept for the chapters not named.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { makeLevel } = await import(new URL("pipes-gear-make.js", here));
const { parseLevel, check } = await import(new URL("pipes-gear-engine.js", here));
const { solve } = await import(new URL("pipes-gear-solve.js", here));
const F = await import(new URL("pipes-gear-frac.js", here));
const { parseKind } = await import(new URL("pipes-gear-shapes.js", here));

const BOOKS = [
  { key: "II", name: "The train", rule: "Pieces can be turned from here on; ratios come from stacks." },
  { key: "III", name: "Pitches", rule: "Tooth sizes (modules) never mesh; trains of different sizes must not touch." },
  { key: "IV", name: "Layers", rule: "Wheels on different layers pass over each other; an arbor carries wheels of several sizes." },
  { key: "V", name: "Complications", rule: "A train ends in a complication that wants an exact speed." },
  { key: "VI", name: "Grandes complications", rule: "Several trains on one plate, each with its own mainspring, tooth size and complication." },
];
const sp = (m, ls, fams = { S: 2, D: 3, T: 2 }, extra = {}) => ({ mods: m, layers: ls, fams, ...extra });
const speedOf = lv => F.parse(lv.spec.trains[0].sink.goal.speed);
const notOne = lv => lv.spec.trains.some(t => t.sink.goal.speed !== "1");
const nStack = lv => Object.values(lv.spec.sols[0]).filter(p => /^[KR]/.test(p)).length + lv.spec.pins.filter(p => /^[KR]/.test(p.kind)).length;
// a stack that changes the tooth rate (np differs from n1) and keeps the module
const rateStack = kind => { const p = parseKind(kind); return p.f === "K" && p.np !== p.n1 && p.m1 === p.m2; };

const CHAPTERS = [
  { key: "i", book: "II", name: "Turning", rule: "Tap a piece you hold to turn it; tap one you've laid to turn it again. The same pieces, but you choose the way they face.",
    names: ["Quarter", "Half", "Three quarters", "Full circle", "Revolution"], nodes: [40, 80, 150, 300, 600],
    recipe: i => ({ cols: i < 2 ? 4 : 5, rows: i < 2 ? 4 : 5, maxSols: [2, 3, 3, 4, 4][i], extras: { pins: 2, clicks: 1 }, trains: [{ m: 5, l: 1, pieces: [4, 5, 6, 7, 8][i], bends: 2, palette: sp([5], [1]), variety: 0.5 }] }), need: () => true },
  { key: "j", book: "II", name: "Ratios", rule: "A stack is a wheel and a pinion on one arbor, on two layers: it changes the speed. The chip on the dial shows the speed it has and the speed it wants.",
    names: ["Step down", "Reduction", "Gear train", "Compound", "Two stages", "Fractions"], nodes: [40, 80, 150, 300, 500, 800],
    recipe: i => ({ cols: i < 2 ? 4 : 5, rows: i < 2 ? 4 : 5, maxSols: [3, 3, 4, 4, 5, 5][i], extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [4, 5, 6, 6, 7, 8][i], bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: i > 3 ? 2 : 1, minStacks: i > 3 ? 2 : 1, stackOnly: rateStack, stackWeight: 6, variety: 0.2 }] }),
    need: lv => notOne(lv) && nStack(lv) >= 1 },
  { key: "k", book: "II", name: "Stations", rule: "A pinned wheel on the way has its own speed to meet: the order of the stacks before it matters.",
    names: ["Minute", "Hour", "Second hand", "Cannon pinion", "Motion works"], nodes: [80, 150, 300, 600, 1000],
    recipe: i => ({ cols: 5, rows: i < 2 ? 5 : 6, maxSols: 4, extras: { pins: 1, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [6, 7, 8, 9, 10][i], bends: 2, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 2, minStacks: 2, stackOnly: rateStack, stackWeight: 6, stations: i < 3 ? 1 : 2, stationType: "hands", variety: 0.2 }] }),
    need: lv => lv.spec.pins.filter(p => p.goal).length >= 1 && notOne(lv) },
  { key: "l", book: "II", name: "Going up", rule: "Entered at its pinion, a stack speeds the train up. Which way round you lay it is the whole question.",
    names: ["Up", "Faster", "Seconds", "Escape"], nodes: [60, 150, 350, 700],
    recipe: i => ({ cols: 5, rows: 5, maxSols: 4, extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [5, 6, 7, 8][i], bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), asym: true, stacks: 1, minStacks: 1, stackOnly: rateStack, stackWeight: 8, goal: { type: "seconds" }, variety: 0.2 }] }),
    need: lv => F.cmp(speedOf(lv), [1, 1]) > 0 },
  { key: "m", book: "III", name: "Two pitches", rule: "Fine (rose), standard (gilt): wheels of different tooth size never mesh, and two trains must not touch.",
    names: ["Fine and standard", "Side by side", "Gap", "Walls", "Detour", "Interlace"], nodes: [60, 120, 250, 500, 900, 1500],
    recipe: i => ({ cols: i < 2 ? 5 : 6, rows: i < 2 ? 5 : 6, maxSols: [3, 4, 4, 5, 5, 6][i], extras: { pins: 3, clicks: 2 }, touch: true,
      trains: [{ m: 5, l: 1, pieces: [3, 4, 4, 5, 5, 6][i], bends: 1, palette: sp([5], [1]), variety: 0.4 }, { m: 4, l: 1, pieces: [3, 3, 4, 4, 5, 6][i], bends: 1, palette: sp([4], [1]), variety: 0.4 }] }),
    need: () => true },
  { key: "n", book: "III", name: "Three pitches", rule: "Fine, standard and coarse: three trains, three sizes, and none may touch.",
    names: ["Triple", "Triad", "Trinity", "Triptych"], nodes: [150, 350, 700, 1400],
    recipe: i => ({ cols: i < 2 ? 6 : 7, rows: i < 2 ? 6 : 7, maxSols: [4, 5, 5, 6][i], extras: { pins: 4, clicks: 2 }, touch: true,
      trains: [{ m: 5, l: 1, pieces: [3, 4, 5, 6][i], bends: 1, palette: sp([5], [1]), variety: 0.3 }, { m: 4, l: 1, pieces: [3, 4, 4, 5][i], bends: 1, palette: sp([4], [1]), variety: 0.3 }, { m: 6, l: 1, pieces: [3, 3, 4, 5][i], bends: 1, palette: sp([6], [1]), variety: 0.3 }] }),
    need: () => true },
  { key: "o", book: "III", name: "Same pitch", rule: "Two trains of one tooth size still must not touch, even if their speeds would agree.",
    names: ["Twins", "Mirror", "Parallel"], nodes: [80, 250, 600],
    recipe: i => ({ cols: 5, rows: i < 1 ? 5 : 6, maxSols: [3, 4, 5][i], extras: { pins: 3, clicks: 2 }, touch: true,
      trains: [{ m: 5, l: 1, pieces: [4, 5, 6][i], bends: 1, palette: sp([5], [1]), variety: 0.4 }, { m: 5, l: 1, pieces: [4, 5, 5][i], bends: 1, palette: sp([5], [1]), variety: 0.4 }] }),
    need: () => true },
  { key: "q", book: "IV", name: "Arbors", rule: "A stack or a riser carries one train from layer to layer, and even from one tooth size to another.",
    names: ["Over", "Under", "Adapter", "Descent", "Compound", "Stair"], nodes: [80, 150, 300, 500, 900, 1500],
    recipe: i => ({ cols: i < 2 ? 5 : 6, rows: i < 2 ? 5 : 6, maxSols: 4, extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [5, 6, 7, 7, 8, 9][i], bends: 1, palette: sp(i < 2 ? [5] : [4, 5], [1, 2, 3], { S: 2, D: 3, T: 2, K: 1, R: 1 }), stacks: 2, minStacks: 1, stackWeight: 6, variety: 0.2 }] }),
    need: lv => nStack(lv) >= 1 },
  { key: "r", book: "IV", name: "Low bridges", rule: "A bridge lets only low pieces under it: flatten the train there, or go round.",
    names: ["Lintel", "Arch", "Viaduct", "Span"], nodes: [100, 250, 500, 1000],
    recipe: i => ({ cols: 5, rows: i < 2 ? 5 : 6, maxSols: 4, extras: { pins: 2, clicks: 1, bridges: 3 },
      trains: [{ m: 5, l: 1, pieces: [6, 7, 8, 9][i], bends: 1, palette: sp([5], [1, 2, 3], { S: 2, D: 3, T: 2, K: 1, R: 1 }), stacks: 2, minStacks: 1, stackWeight: 6, variety: 0.2 }] }),
    need: lv => lv.spec.map.some(r => /[12]/.test(r)) },
  { key: "s", book: "V", name: "Date", rule: "The date ring has internal teeth: a pinion inside it turns it the same way, so the last mesh does not flip.",
    names: ["Window", "Disc", "Ring", "Calendar"], nodes: [60, 150, 350, 700],
    recipe: i => ({ cols: 5, rows: 5, maxSols: 4, extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [4, 5, 6, 7][i], bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: i > 1 ? 1 : 0, stackOnly: rateStack, goal: { type: "date", ring: true }, variety: 0.3 }] }),
    need: () => true },
  { key: "t", book: "V", name: "Moon", rule: "The moon disc is fine (m4): the train must change tooth size on the way.",
    names: ["New moon", "Crescent", "Full moon"], nodes: [100, 300, 700],
    recipe: i => ({ cols: 5, rows: i < 1 ? 5 : 6, maxSols: 4, extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [5, 6, 7][i], bends: 1, palette: sp([4, 5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 2, minStacks: 1, stackOnly: k => parseKind(k).f === "K" && parseKind(k).m1 !== parseKind(k).m2, stackWeight: 8, end: { m: 4 }, goal: { type: "moon" }, variety: 0.2 }] }),
    need: lv => lv.spec.trains[0].sink.m === 4 },
  { key: "u", book: "V", name: "Chime", rule: "The chiming barrel wants one speed and one direction, and sets the tempo of the tune.",
    names: ["Strike", "Carillon", "Gong", "Westminster"], nodes: [80, 200, 450, 900],
    recipe: i => ({ cols: 5, rows: i < 2 ? 5 : 6, maxSols: 4, extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [5, 6, 7, 9][i], bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 2, minStacks: 1, stackOnly: rateStack, goal: { type: "chime" }, variety: 0.2 }] }),
    need: notOne },
  { key: "v", book: "V", name: "Escapement", rule: "The going train is a step-up: the escape wheel must run several times faster than the barrel.",
    names: ["Anchor", "Lever", "Detent", "Co-axial", "Constant force"], nodes: [80, 160, 300, 600, 1000],
    recipe: i => ({ cols: 5, rows: i < 2 ? 5 : 6, maxSols: 4, extras: { pins: 2, clicks: 1 },
      trains: [{ m: 5, l: 1, pieces: [5, 6, 7, 8, 9][i], bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), asym: true, stacks: 2, minStacks: 1, stackOnly: rateStack, stackWeight: 8, goal: { type: "escape" }, variety: 0.2 }] }),
    need: lv => F.cmp(speedOf(lv), [2, 1]) >= 0 },
  { key: "x", book: "VI", name: "Set pieces", rule: "A watch with several complications: each train has its own mainspring and its own tooth size, and none may touch another.",
    names: ["Perpetual calendar", "Minute repeater", "Tourbillon", "Grande complication"], nodes: [800, 1500, 2500, 4000],
    recipe: i => [
      { cols: 7, rows: 7, maxSols: 6, extras: { pins: 3, clicks: 2 }, touch: true, trains: [
        { m: 5, l: 1, pieces: 6, bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 2, minStacks: 1, stackOnly: rateStack, asym: true, goal: { type: "escape" }, variety: 0.2 },
        { m: 4, l: 1, pieces: 6, bends: 1, palette: sp([4], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 1, stackOnly: rateStack, goal: { type: "date", ring: true }, stations: 1, stationType: "hands", variety: 0.2 }] },
      { cols: 7, rows: 7, maxSols: 6, extras: { pins: 3, clicks: 2 }, touch: true, trains: [
        { m: 5, l: 1, pieces: 6, bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 1, stackOnly: rateStack, goal: { type: "wheel" }, variety: 0.2 },
        { m: 6, l: 1, pieces: 6, bends: 1, palette: sp([6], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 2, minStacks: 1, stackOnly: rateStack, stations: 2, stationType: "chime", goal: { type: "chime" }, variety: 0.2 }] },
      { cols: 7, rows: 7, maxSols: 6, extras: { pins: 3, clicks: 2, bridges: 2 }, trains: [
        { m: 5, l: 1, pieces: 11, bends: 2, palette: sp([5], [1, 2, 3], { S: 2, D: 3, T: 2, K: 1, R: 1 }), stacks: 3, minStacks: 2, stackOnly: rateStack, stackWeight: 6, goal: { type: "tourbillon" }, stations: 1, stationType: "hands", variety: 0.2 }] },
      { cols: 7, rows: 7, maxSols: 6, extras: { pins: 4, clicks: 2, bridges: 2 }, touch: true, trains: [
        { m: 5, l: 1, pieces: 5, bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 1, stackOnly: rateStack, goal: { type: "escape" }, variety: 0.2 },
        { m: 4, l: 1, pieces: 4, bends: 1, palette: sp([4], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 1, stackOnly: rateStack, goal: { type: "date", ring: true }, variety: 0.2 },
        { m: 6, l: 1, pieces: 4, bends: 1, palette: sp([6], [1]), goal: { type: "chime" }, variety: 0.2 }] },
    ][i], need: () => true },
];

const want = process.argv.slice(2);
const existing = await import(new URL("pipes-gear-levels.js", here)).catch(() => ({ LEVELS: [] }));
const kept = new Map();
for (const lv of existing.LEVELS) (kept.get(lv.chapter) || kept.set(lv.chapter, []).get(lv.chapter)).push(lv);
const out = new Map();
const seenSig = new Set();
const t00 = Date.now();
for (const ch of CHAPTERS) {
  if (want.length && !want.includes(ch.key)) { out.set(ch.key, kept.get(ch.key) || []); continue; }
  const rows = [];
  for (let i = 0; i < ch.names.length; i++) {
    const base = ch.recipe(i), cand = [], from = 700001 + i * 5000 + ch.key.charCodeAt(0) * 100000, tries = +(process.env.TRIES || 120);
    const t0 = Date.now();
    for (let seed = from; seed < from + tries && Date.now() - t0 < +(process.env.SLOT_MS || 90000); seed++) {
      let m = null;
      try { m = makeLevel(seed, { nodes: ch.nodes[i], limit: 6e5, ...base }); } catch (e) { console.log("error", seed, e.message); }
      if (!m || !ch.need(m)) continue;
      cand.push({ seed, m });
    }
    if (!cand.length) { console.log(`chapter ${ch.key} level ${i + 1}: no candidate`); continue; }
    const miss = c => Math.abs(Math.log(Math.max(5, c.m.nodes) / ch.nodes[i]));
    cand.sort((p, q) => miss(p) - miss(q));
    const best = cand.find(c => !seenSig.has(c.m.spec.map.join("") + c.m.spec.hand)) || cand[0];
    seenSig.add(best.m.spec.map.join("") + best.m.spec.hand);
    const spec = best.m.spec;
    // re-prove with the whole answer set and a roomy limit
    const L = parseLevel(spec), s = solve(L, 7, 4e6);
    if (s.aborted || s.sols.length > 6 || !s.sols.length) { console.log(`chapter ${ch.key} level ${i + 1}: the pick did not re-prove`); continue; }
    spec.id = `w${ch.key}${i + 1}`; spec.name = ch.names[i]; spec.chapter = ch.key;
    spec.sols = s.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)));
    rows.push({ ...spec, v: 1 });
    console.log(`${spec.id} ${ch.names[i]}: ${cand.length} candidates; seed ${best.seed}, ${spec.cols}x${spec.rows}, ${L.total} pieces, ${best.m.nodes} nodes (target ${ch.nodes[i]}), ${s.sols.length} answers, pillars ${best.m.extras.pillars} bridges ${best.m.extras.bridges} pins ${best.m.extras.pins} clicks ${best.m.extras.clicks}, speed ${spec.trains.map(t => t.sink.goal.speed).join("/")}`);
  }
  out.set(ch.key, rows);
}
const q = s => JSON.stringify(s);
let text = `// Gears 2: the levels of Books II to V (4 November 2026). Made by pipes-gear-pick.mjs from pipes-gear-make.js, never by hand; checked by
// tests/pipes-gear-levels.mjs, which solves every level again and wants the listed answers (at most six) and no others. A level's id is
// its identity (stars are kept by it). Book I (the old forty) is read from pipes-train-levels.js through pipes-gear-legacy.js.
// A level is the data described in docs/pipes-contract.md: map (. ground, # pillar, 1 2 a bridge), trains (barrel, sink with its goal),
// pins (pinned pieces, some with a goal: a station), clicks, hand (kind:count) and sols (every answer: square -> kind@rot).

export const BOOKS = ${q(BOOKS)};

export const CHAPTERS = [\n`;
for (const ch of CHAPTERS) if ((out.get(ch.key) || []).length) text += `  { key: ${q(ch.key)}, book: ${q(ch.book)}, name: ${q(ch.name)}, rule: ${q(ch.rule)} },\n`;
text += `];\n\nexport const LEVELS = [\n`;
for (const ch of CHAPTERS) {
  const rows = out.get(ch.key) || [];
  if (!rows.length) continue;
  text += `  // ${ch.name}\n`;
  for (const r of rows) text += `  ${q(r)},\n`;
}
text += `];\n`;
fs.writeFileSync(new URL("pipes-gear-levels.js", here), text);
console.log(`wrote ${[...out.values()].reduce((n, r) => n + r.length, 0)} levels in ${((Date.now() - t00) / 1000).toFixed(0)} s`);
void check;
