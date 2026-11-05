// Courier's encounters (reckoning-encounters.js) and the ramp that places them (5 November 2026; audit 33-39, 61, 65, 66): every encounter is passable by
// a bot that answers foes by what they do, at any speed and from any lane; the composer places one after a rest, by tier and by distance, with a cooldown;
// and the difficulty has more axes than a hazard count. COURIER_SEEDS makes the passability run longer (courier-soak.mjs, slow).
import { buildRows, newGame, step, speedAt } from "../reckoning-engine.js";
import { ENCOUNTERS, ENCOUNTER_IDS, tierAt, encShareAt } from "../reckoning-encounters.js";
import { BIOMES, BIOME_IDS, makeSegment, genRows, rng } from "../reckoning-biomes.js";
import { arena, run } from "./courier-reflex.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const seeds = Number(process.env.COURIER_SEEDS || 2);

// ---------- the data ----------
{
  const tokens = new Set("cCgboTRKSPWH");
  check(ENCOUNTER_IDS.length >= 12, `${ENCOUNTER_IDS.length} encounters`);
  check(ENCOUNTER_IDS.every(id => ENCOUNTERS[id].name && ENCOUNTERS[id].note && ENCOUNTERS[id].parts.every(([t, lane, s]) => tokens.has(t) && lane >= -1 && lane <= 1 && s >= 0)), "each has a name, a note and parts of known tokens in lanes, at times from its start");
  check(ENCOUNTER_IDS.every(id => BIOME_IDS.some(b => BIOMES[b].encounters.includes(id))) && BIOME_IDS.every(b => BIOMES[b].encounters.every(id => ENCOUNTERS[id])), "every encounter belongs to a biome, and a biome names only encounters that exist");
  check(BIOME_IDS.every(b => BIOMES[b].encounters.length >= 8), "no biome has a poor list: each has eight or more, so the biomes differ in what they throw");
  const sets = BIOME_IDS.map(b => BIOMES[b].encounters.slice().sort().join());
  check(new Set(sets).size === BIOME_IDS.length, "and no two biomes have the same list");
  const stagger = ENCOUNTERS.stagger.parts.map(p => p[2]).sort((a, b) => a - b), gaps = stagger.slice(1).map((t, i) => t - stagger[i]);
  check(gaps.every(g => g >= 0.2 && g <= 0.3) && ENCOUNTERS.boarders.parts[1][2] - ENCOUNTERS.boarders.parts[0][2] >= 0.2, "staggered launches are 0.2 to 0.3 s apart");
}

// ---------- passable ----------
{
  let worst = 0, runs = 0, failed = [];
  for (const id of ENCOUNTER_IDS) for (const z of [0, 1500, 3200]) for (const lane of [-1, 0, 1]) for (let seed = 1; seed <= seeds; seed++) {
    const S = arena({ seed, z, lane });
    buildRows(S, [`!enc ${id}`], z + 30, 11);
    run(S, { secs: 8 });
    runs++;
    if (S.hearts < 3) { worst = Math.max(worst, 3 - S.hearts); failed.push(`${id}@${z}/${lane}/${seed}`); }
  }
  check(failed.length === 0, `every encounter is passable without a heart lost: ${runs} runs at three speeds from every lane${failed.length ? " (lost: " + failed.slice(0, 6).join(" ") + ")" : ""}`);
}

// ---------- placed by the composer ----------
{
  const zones = [];
  const S = newGame({ seed: 41 });
  for (let z = 0; z <= 6000; z += 50) { S.hero.z = z; step(S, 1e-6); for (const q of S.world.zones) if (!zones.some(o => o.z0 === q.z0)) zones.push({ ...q }); }
  zones.sort((a, b) => a.z0 - b.z0);
  const encs = zones.filter(q => q.kind === "enc");
  check(encs.length >= 6, `the endless run lays encounters (${encs.length} in 6000 m)`);
  check(encs.every(q => ENCOUNTERS[q.id].tier <= tierAt(q.z0) && ENCOUNTERS[q.id].from <= q.z0 / 3000 + 1e-9), "none comes before its tier and its difficulty");
  check(encs.every(q => q.z0 >= 250), "none in the first 250 m");
  let near = false;
  for (let i = 0; i < encs.length; i++) for (let j = i + 1; j < encs.length; j++) if (encs[i].id === encs[j].id && zones.indexOf(encs[j]) - zones.indexOf(encs[i]) < 5) near = true;
  check(!near, "an encounter waits its cooldown before it comes again");
  const at = (z0, z1) => new Set(encs.filter(q => q.z0 >= z0 && q.z0 < z1).map(q => q.id));
  check(at(0, 600).size <= 2 && [...at(0, 600)].every(id => ENCOUNTERS[id].tier === 0), "the first tier has the simplest patterns only");
  const late = new Set();
  for (const b of BIOME_IDS) for (let seed = 1; seed <= 400; seed++) { const s = makeSegment(b, seed, 1, "enc", { z: 4000 }); if (s.kind === "enc") late.add(s.id); }
  check([...late].some(id => ENCOUNTERS[id].tier >= 4) && [...late].some(id => ENCOUNTERS[id].tier === 0), "past 3000 m, where the difficulty number stops, the tiers go on and open the elite groups and the raid");
  const wide = new Set(encs.map(q => q.id)).size;
  check(wide >= 8, `and ${wide} different encounters come`);
  // an encounter's rows are a rest, the pattern, a rest
  const seg = makeSegment("quays", 5, 0.6, "enc", { z: 2500 });
  check(seg.kind === "enc" && seg.rows[0].startsWith("!rest") && seg.rows[1].startsWith("!enc ") && seg.rows[2].startsWith("!rest"), "an encounter is laid after a rest and leaves one");
}

// ---------- the ramp has more than one axis ----------
{
  check(tierAt(0) === 0 && tierAt(599) === 0 && tierAt(600) === 1 && tierAt(3000) === 5 && tierAt(4800) === 8 && tierAt(99999) === 8, "tiers: a step every 600 m, past 3000 m up to eight");
  check(encShareAt(100) === 0 && encShareAt(300) > 0.1 && encShareAt(3000) > encShareAt(300) && encShareAt(9999) <= 0.5, "the share of encounters rises with distance and has a ceiling");
  const kindsAt = (z, biome = "quays") => {
    const got = new Set();
    for (let seed = 1; seed <= 300; seed++) got.add(makeSegment(biome, seed, Math.min(1, z / 3000), null, { z }).kind);
    return got;
  };
  check(!kindsAt(100).has("enc") && kindsAt(1500).has("enc"), "encounters open with distance");
  // foe kinds by distance: what the encounters offered contain
  const foesAt = z => new Set(ENCOUNTER_IDS.filter(id => ENCOUNTERS[id].tier <= tierAt(z)).flatMap(id => ENCOUNTERS[id].parts.map(p => p[0])));
  check(!foesAt(300).has("T") && !foesAt(300).has("S") && foesAt(1300).has("T") && foesAt(1300).has("S") && !foesAt(1300).has("P") && foesAt(2000).has("P"), "the thrower and the shield bearer come after 1200 m, the pirate after 1800");
  // row motifs: lane continuity
  const zig = [];
  for (let seed = 1; seed <= 300; seed++) {
    const rows = genRows(BIOMES.quays, rng(seed), 0.6).filter(r => r !== ". . .").map(r => r.split(" ").findIndex(c => "cCbBXgo".includes(c)));
    if (rows.length >= 4 && rows.every((l, i) => i === 0 || Math.abs(l - rows[i - 1]) === 1)) zig.push(seed);
  }
  check(zig.length >= 3, `generated rows have motifs, not only independent draws (${zig.length} zigzags in 300 segments)`);
  // tempo: the pitch differs from segment to segment
  const S = newGame({ seed: 12 });
  const gaps = new Set();
  const rowsAt = new Set();
  for (let z = 0; z <= 3000; z += 50) { S.hero.z = z; step(S, 1e-6); for (const r of S.world.rows) rowsAt.add(r); }
  const sorted = [...rowsAt].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) gaps.add(Math.round(sorted[i] - sorted[i - 1]));
  check(gaps.size >= 4, `the beat varies: rows ${[...gaps].sort((a, b) => a - b).slice(0, 6).join(", ")} m apart and more, and breathers at the end of some segments`);
  check(speedAt(3000) > speedAt(0), "(the speed too)");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier encounters: passable, placed by tier and distance, a ramp of several axes");
