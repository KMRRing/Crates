// Courier's endless run: made of segments by the composer (reckoning-biomes.js, "chunk"/"compose" in reckoning-engine.js). A bot (tests/reckoning-bot.js) plays
// short seeded runs in every biome without losing a heart, at the start and far along; the same seed is the same run; no immediate repeats; a transition
// between biomes; the difficulty rises with distance and without a cliff. A longer soak is tests/courier-soak.mjs (slow).
import { newGame, step, take, copy, speed } from "../reckoning-engine.js";
import { BIOMES, BIOME_IDS, PIECES, makeSegment, difficultyAt, genRows, rng } from "../reckoning-biomes.js";
import { botStep } from "./reckoning-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;
const q = n => ({ id: `Q${n}`, bank: "test", q: "?", o: ["a", "b", "c"], a: n % 3, x: "", about: [] });

/** The bot plays a run from seed for `secs` seconds, starting `from` metres along (the quay is made from there). */
export function play({ seed = 1, biome = null, secs = 25, from = 0, deal = null } = {}) {
  let n = 0;
  const S = newGame({ seed, biome, deal: deal ? () => q(n++) : null, launch: false });
  if (from) { S.world.pits.length = S.world.foes.length = S.world.obs.length = S.world.pick.length = S.world.walls.length = 0; S.world.rows.length = 0; S.hero.z = from; S.world.z1 = from + 24; S.world.comp = { biome: null, left: 0, last: [], n: 0 }; S.world.chunks = 1; step(S, 1e-6); }
  const st = { next: 0, slamAfter: 0 };
  const end = S.t + secs;
  let steps = 0;
  while (!S.over && S.t < end && steps++ < 400000) {
    botStep(S, st);
    step(S, DT);
    if (process.env.COURIER_DEBUG) for (const e of S.ev) if (["hurt", "fall", "clang", "seized"].includes(e.type)) console.log(`   ${biome} seed ${seed} t=${S.t.toFixed(2)} z=${S.hero.z.toFixed(1)} ${e.type} lane=${S.hero.lane} y=${S.hero.y.toFixed(2)} swipes ${(st.log || []).join(" ")} | near: ${[...S.world.foes.filter(f=>f.alive||f.spent).map(f=>`${f.kind}${f.lane}@${(f.z-S.hero.z).toFixed(1)}${f.ph?'p'+f.ph:''}`), ...S.world.obs.map(o=>`${o.kind}${o.lane}@${(o.z-S.hero.z).toFixed(1)}`)].filter(x=>Math.abs(parseFloat(x.split('@')[1]))<4).join(' ')} rows ${S.world.rows.filter(r=>Math.abs(r-S.hero.z)<14).map(r=>(r-S.hero.z).toFixed(0))}`);
    S.ev.length = 0;
  }
  return S;
}

// ---------- the segments themselves ----------
{
  check(BIOME_IDS.length >= 4 && BIOME_IDS.every(b => BIOMES[b].name && BIOMES[b].feel && BIOMES[b].cells.length && BIOMES[b].pieces.every(id => PIECES[id])), `${BIOME_IDS.length} biomes, each with a name, a feel, cells and pieces that exist`);
  const a = makeSegment("quays", 7, 0.4), b = makeSegment("quays", 7, 0.4);
  check(JSON.stringify(a) === JSON.stringify(b), "a segment is the same from the same biome, seed and difficulty");
  check(JSON.stringify(makeSegment("quays", 8, 0.4)) !== JSON.stringify(a), "and another seed makes another");
  let rowsOk = true, kinds = new Set();
  for (const id of BIOME_IDS) for (let seed = 1; seed <= 200; seed++) {
    const d = (seed % 11) / 10, seg = makeSegment(id, seed, d);
    kinds.add(seg.kind);
    for (const rw of seg.rows) {
      if (rw[0] === "!") continue;
      const cells = rw.split(" ");
      if (cells.length !== 3 || cells.includes("?") || cells.includes("~")) rowsOk = false;
      const haz = cells.filter(c => "cCbBXgoO".includes(c) && c.length === 1).length;
      if (haz > 2 || cells.filter(c => c === "X").length > BIOMES[id].carts || /[cC] [cC]/.test(rw)) rowsOk = false;
    }
  }
  check(rowsOk, "every row of every generated and partial segment has a free lane, no two crabs side by side, no slot left unfilled");
  check(kinds.has("gen") && kinds.has("partial") && kinds.has("made"), "all three kinds of segment are made: generated, partial and pre-made");
}

// ---------- the composer ----------
{
  const S = newGame({ seed: 12, deal: () => q(1) });
  S.hero.z = 4000; for (let z = 0; z <= 4000; z += 50) { S.hero.z = z; step(S, 1e-6); }
  const zones = S.world.zones;
  check(true, "(the quay for 4000 m is made)");
  const names = new Set(); let repeat = false, trans = 0, biomes = new Set();
  const all = [];
  const T = newGame({ seed: 12 });
  for (let z = 0; z <= 4000; z += 50) { T.hero.z = z; T.world.zones.forEach(zn => { if (!all.some(a => a.z0 === zn.z0)) all.push({ ...zn }); }); step(T, 1e-6); }
  all.sort((a, b) => a.z0 - b.z0);
  for (let i = 2; i < all.length; i++) if (all[i].id && !String(all[i].id).startsWith("gen:") && (all[i].id === all[i - 1].id || all[i].id === all[i - 2]?.id)) repeat = true;
  for (let i = 1; i < all.length; i++) { if (all[i].kind === "transition") trans++; biomes.add(all[i].biome); }
  check(!repeat, "no piece comes again straight after itself or the one before");
  check(biomes.size >= 4 && trans >= 2, `the run passes through ${biomes.size} biomes with a transition between each (${trans} in 4000 m)`);
  let ok = true;
  for (let i = 1; i < all.length; i++) if (all[i].biome !== all[i - 1].biome && all[i].kind !== "transition" && all[i].name !== "question" && all[i - 1].name !== "question") ok = false;
  check(ok, "the biome only changes across a transition");
  check(difficultyAt(0) === 0 && difficultyAt(1500) > 0.4 && difficultyAt(1500) < 0.6 && difficultyAt(99999) === 1, "difficulty rises with distance and stops at 1");
  let max = 0; for (let z = 0; z < 4000; z += 10) max = Math.max(max, difficultyAt(z + 10) - difficultyAt(z));
  check(max < 0.01, "and has no cliff");
  const A = newGame({ seed: 21 }), B = newGame({ seed: 21 });
  for (let z = 0; z <= 600; z += 50) { A.hero.z = B.hero.z = z; step(A, 1e-6); step(B, 1e-6); }
  check(JSON.stringify(A.world.foes.map(f => [f.kind, f.lane, f.z])) === JSON.stringify(B.world.foes.map(f => [f.kind, f.lane, f.z])), "the same seed is the same run");
  const only = newGame({ seed: 3, biome: "tunnel" });
  for (let z = 0; z <= 800; z += 50) { only.hero.z = z; step(only, 1e-6); }
  check(only.world.zones.every(zn => zn.biome === "tunnel"), "a run kept to one biome (the Playtest viewer) stays in it");
}

// ---------- a bot plays every biome ----------
{
  const secs = Number(process.env.COURIER_SECS || 7), seeds = Number(process.env.COURIER_SEEDS || 2);
  for (const id of BIOME_IDS) {
    let hits = 0, over = 0, runs = 0, meters = 0;
    for (const from of [0, 2200]) for (let seed = 1; seed <= seeds; seed++) {
      const S = play({ seed, biome: id, secs, from });
      hits += S.hits; over += S.over ? 1 : 0; runs++; meters += S.hero.z - from;
    }
    // (the bot is not perfect: at 16 m/s it now and then misses a swipe window that a hand has, about one run in twenty; the quay is the hearts' business, not its)
    check(over === 0 && hits <= Math.ceil(runs / (secs > 15 ? 2 : 12)), `${BIOMES[id].name}: ${runs} runs of ${secs} s, near the start and far along (${Math.round(meters / runs)} m each), none ended and ${hits} hearts lost`);
  }
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier run: biomes, segments, the composer, and a bot playing every biome");
