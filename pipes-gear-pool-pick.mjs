// Draws the pool of plates the Daily and Random modes deal from, and writes pipes-gear-pool.js: `node pipes-gear-pool-pick.mjs [per-band] [band…]`
// (default 24 a band, all bands). Each plate is made by the generator, proven again by the solver with the whole answer set (at most four
// answers, none gave up), and kept only when it differs from the ones kept before it. The page never solves: a day's plate is a pool plate
// under one of the eight turns and mirrors of the board (transformLevel), which keep every answer.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { makeLevel } = await import(new URL("pipes-gear-make.js", here));
const { discVoid } = await import(new URL("pipes-gear-engine.js", here));
const { parseLevel, check, emptyLaid } = await import(new URL("pipes-gear-engine.js", here));
const { transformLevel } = await import(new URL("pipes-gear-legacy.js", here));
const { solve } = await import(new URL("pipes-gear-solve.js", here));
const F = await import(new URL("pipes-gear-frac.js", here));
const { parseKind } = await import(new URL("pipes-gear-shapes.js", here));

const sp = (m, ls, fams = { S: 2, D: 3, T: 2 }, extra = {}) => ({ mods: m, layers: ls, fams, ...extra });
const rateStack = kind => { const p = parseKind(kind); return p.f === "K" && p.np !== p.n1 && p.m1 === p.m2; };
const nonOne = lv => lv.spec.trains.some(t => t.sink.goal.speed && t.sink.goal.speed !== "1");

// a band is a list of recipes, taken in turn; `ok` says the plate shows what the band is about
const BANDS = {
  easy: [
    { ok: nonOne, o: i => ({ cols: 5, rows: 5, maxSols: 4, extras: { pins: 2, clicks: 1 }, trains: [{ m: 5, l: 1, pieces: 5 + (i % 3), bends: 2, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 1, minStacks: 1, stackOnly: rateStack, stackWeight: 6, variety: 0.3 }] }) },
    { ok: () => true, o: i => ({ cols: 5, rows: 5, maxSols: 3, extras: { pins: 2, clicks: 1 }, touch: true, trains: [{ m: 5, l: 1, pieces: 4, bends: 1, palette: sp([5], [1]), variety: 0.4 }, { m: 4, l: 1, pieces: 3, bends: 1, palette: sp([4], [1]), variety: 0.4 }] }) },
  ],
  medium: [
    { ok: nonOne, o: i => ({ cols: 6, rows: 6, maxSols: 5, extras: { pins: 2, clicks: 2 }, trains: [{ m: 5, l: 1, pieces: 7 + (i % 3), bends: 2, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 2, minStacks: 2, stackOnly: rateStack, stackWeight: 6, stations: 1, stationType: "hands", variety: 0.2 }] }) },
    { ok: () => true, o: i => ({ cols: 6, rows: 6, maxSols: 5, extras: { pins: 3, clicks: 2 }, touch: true, trains: [{ m: 5, l: 1, pieces: 5, bends: 1, palette: sp([5], [1]), variety: 0.3 }, { m: 4, l: 1, pieces: 5, bends: 1, palette: sp([4], [1]), variety: 0.3 }] }) },
    { ok: lv => lv.spec.map.some(r => /[12]/.test(r)), o: i => ({ cols: 6, rows: 6, maxSols: 4, extras: { pins: 2, clicks: 1, bridges: 3 }, trains: [{ m: 5, l: 1, pieces: 8, bends: 1, palette: sp([5], [1, 2, 3], { S: 2, D: 3, T: 2, K: 1, R: 1 }), stacks: 2, minStacks: 1, stackWeight: 6, variety: 0.2 }] }) },
  ],
  hard: [
    { ok: () => true, o: i => ({ cols: 7, rows: 7, maxSols: 6, extras: { pins: 4, clicks: 2 }, touch: true, trains: [{ m: 5, l: 1, pieces: 5, bends: 1, palette: sp([5], [1]), variety: 0.3 }, { m: 4, l: 1, pieces: 4, bends: 1, palette: sp([4], [1]), variety: 0.3 }, { m: 6, l: 1, pieces: 4, bends: 1, palette: sp([6], [1]), variety: 0.3 }] }) },
    { ok: nonOne, o: i => ({ cols: 6, rows: 7, maxSols: 5, extras: { pins: 2, clicks: 1 }, trains: [{ m: 5, l: 1, pieces: 10 + (i % 2), bends: 2, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 3, minStacks: 2, stackOnly: rateStack, stackWeight: 6, stations: 2, stationType: "hands", variety: 0.2 }] }) },
    { ok: lv => lv.spec.trains.some(t => t.sink.goal.ring), o: i => ({ cols: 6, rows: 6, maxSols: 5, extras: { pins: 2, clicks: 1 }, trains: [{ m: 5, l: 1, pieces: 8, bends: 1, palette: sp([5], [1, 2], { S: 2, D: 3, T: 2, K: 1 }), stacks: 1, stackOnly: rateStack, goal: { type: "date", ring: true }, variety: 0.3 }] }) },
  ],
};

const per = Number(process.argv[2]) || 24, want = process.argv.slice(3);
const out = {}, seen = new Set(), t00 = Date.now();
for (const [band, recipes] of Object.entries(BANDS)) {
  if (want.length && !want.includes(band)) continue;
  out[band] = [];
  for (let seed = 910001, tries = 0; out[band].length < per && tries < per * 400; seed++, tries++) {
    const k = tries % recipes.length, rc = recipes[k];
    let m = null;
    try {
      // a round plate, as many squares across as holds the trains' squares (a piece each, the barrel and the dial) 1.9 times over
      const o = rc.o(tries), used = o.trains.reduce((n, t) => n + t.pieces + 2, 0);
      let d = 4;
      while (d < 10 && d * d - discVoid(d).size < 1.9 * used) d++;
      m = makeLevel(seed, { nodes: 2000, limit: 6e5, ...o, cols: d, rows: d, disc: true });
    } catch { /* next */ }
    if (!m || !rc.ok(m)) continue;
    const sig = m.spec.map.join("") + m.spec.hand;
    if (seen.has(sig)) continue;
    const L = parseLevel(m.spec), s = solve(L, 5, 4e6);
    if (s.aborted || !s.sols.length || s.sols.length > 4) continue;
    const spec = m.spec;
    // every turn and mirror must exist (a few elbow pieces have no mirror image) and keep the answers
    let turns = true;
    try {
      for (let t = 1; t < 8 && turns; t++) {
        const tt = transformLevel({ ...spec, sols: s.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p))) }, t), TL = parseLevel(tt);
        for (const sol of tt.sols) { const laid = emptyLaid(TL); for (const [c, p] of Object.entries(sol)) laid[c] = p; if (!check(TL, laid).solved) turns = false; }
      }
    } catch { turns = false; }
    if (!turns) continue;
    seen.add(sig);
    spec.sols = s.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)));
    spec.id = `${band[0]}${out[band].length + 1}`; spec.name = ""; spec.chapter = band; spec.v = 1;
    out[band].push(spec);
    console.log(`${band} ${out[band].length}/${per}: seed ${seed}, ${spec.cols}x${spec.rows}, ${L.total} pieces, ${s.sols.length} answers, ${m.nodes} nodes (${((Date.now() - t00) / 1000).toFixed(0)} s)`);
  }
}
void F;
const q = JSON.stringify;
let text = `// Gears: the pool the Daily and Random plates are dealt from (5 November 2026). Made by pipes-gear-pool-pick.mjs, never by hand; checked by
// tests/pipes-gear-levels.mjs, which solves every plate again. A day's plate is one of these under one of the eight turns and mirrors of
// the board (pipes-gear-legacy.js transformLevel), so nothing is solved on the page. Loaded only when a daily or a random plate is asked for.\n\nexport const POOL = {\n`;
for (const [band, list] of Object.entries(out)) text += `  ${band}: [\n${list.map(l => `    ${q(l)},`).join("\n")}\n  ],\n`;
text += `};\n`;
if (!want.length) fs.writeFileSync(new URL("pipes-gear-pool.js", here), text);
else {
  // a partial run: merge into the file's other bands
  let old = {};
  try { old = (await import(new URL("pipes-gear-pool.js", here))).POOL; } catch { /* none */ }
  const all = { ...old, ...out };
  let t2 = text.slice(0, text.indexOf("export const POOL"));
  t2 += `export const POOL = {\n`;
  for (const [band, list] of Object.entries(all)) t2 += `  ${band}: [\n${list.map(l => `    ${q(l)},`).join("\n")}\n  ],\n`;
  t2 += `};\n`;
  fs.writeFileSync(new URL("pipes-gear-pool.js", here), t2);
}
console.log(`wrote ${Object.values(out).reduce((n, l) => n + l.length, 0)} plates in ${((Date.now() - t00) / 1000).toFixed(0)} s`);
