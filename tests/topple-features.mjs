// Whether what each Topple level brings in is engaged with, or only there (Korbi: "make sure that the features of each level are
// actually impactful and need to be engaged with in order to get the goal rather than just being there"). A knock's use of a level's
// rules is read off the dominoes it brought down (`tagsOf`, tests/topple-players.js). For each thing a level adds, the careful
// player plays the level twice: as it is, and refusing every push that uses the thing (it takes the best push that doesn't).
// `node tests/topple-features.mjs measure games=10 levels=4,5` prints what the README's numbers come from.
import { LEVELS, custom, lodge } from "../topple-levels.js";
import { FEATURES, OBSTACLES, without } from "./topple-features-list.js";
import { PLAYERS, play } from "./topple-players.js";
import { REACHED } from "./topple-reached.js";

const arg = k => process.argv.find(x => x.startsWith(`${k}=`))?.slice(k.length + 1);
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];

if (process.argv.includes("measure")) {
  const games = Number(arg("games") || 10), only = arg("levels")?.split(",").map(Number);
  for (const [n, tags] of Object.entries(FEATURES)) {
    if (only && !only.includes(Number(n))) continue;
    const L = LEVELS[n - 1], base = Array.from({ length: games }, (_, g) => play(100 + g, PLAYERS.careful, { level: n - 1, pieces: 400 }));
    const total = base.reduce((a, r) => a + r.score, 0);
    console.log(`${n} ${L.name} (goal ${L.goal}): as it is, median ${median(base.map(r => r.score))}, reached ${base.filter(r => r.score >= L.goal).length} of ${games}`);
    for (const tag of tags) {
      const share = base.reduce((a, r) => a + (r.used[tag]?.gain || 0), 0) / total, games_ = base.filter(r => r.used[tag]).length;
      const denied = Array.from({ length: games }, (_, g) => play(100 + g, PLAYERS.careful, { level: n - 1, pieces: 400, deny: [tag] }));
      console.log(`   ${tag.padEnd(8)} used in ${games_} of ${games} games, ${(share * 100).toFixed(0)}% of the score; refused: median ${median(denied.map(r => r.score))}, reached ${denied.filter(r => r.score >= L.goal).length} of ${games}`);
    }
  }
  for (const [n, keys] of Object.entries(OBSTACLES)) {
    if (only && !only.includes(Number(n))) continue;
    const spec = LEVELS[n - 1], free = custom(without(spec, keys));
    const as = Array.from({ length: games }, (_, g) => play(100 + g, PLAYERS.careful, { level: n - 1, pieces: 400 }));
    const off = Array.from({ length: games }, (_, g) => play(100 + g, PLAYERS.careful, { level: lodge(free), pieces: 400 }));
    console.log(`${n} ${spec.name}: ${keys.join(" and ")} on the table: median ${median(as.map(r => r.score))} in ${median(as.map(r => r.laid))} pieces; taken off: ${median(off.map(r => r.score))} in ${median(off.map(r => r.laid))}`);
  }
  process.exit(0);
}

// ---------- in the game on record that reaches each goal ----------
// (the measure above says how it goes over many games; this is one game, the same every time, so it can run with the rest)
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
{
  const unused = [], needed = [], stripped = [];
  for (const [n, tags] of Object.entries(FEATURES)) {
    const [id, seed] = REACHED[n], goal = LEVELS[n - 1].goal;
    const won = play(seed, PLAYERS[id], { level: n - 1, pieces: 400 });
    for (const tag of tags) {
      if (!won.used[tag]) unused.push(`${n} ${tag}`);
      else if (play(seed, PLAYERS[id], { level: n - 1, pieces: 400, deny: [tag] }).score >= goal) needed.push(`${n} ${tag}`);
    }
  }
  // what stands in the way costs the careful player: four games on each table as it is and with it taken off, each to 150 pieces
  for (const [n, keys] of Object.entries(OBSTACLES)) {
    const free = lodge(custom(without(LEVELS[n - 1], keys))), total = level => [100, 101, 102, 103].reduce((a, seed) => a + play(seed, PLAYERS.careful, { level, pieces: 150 }).score, 0);
    const as = total(n - 1), off = total(free);
    if (off < as * 1.2) stripped.push(`${n} ${keys.join("+")}: ${as} to ${off}`);
  }
  check(!unused.length, `the game that reaches each goal uses everything its level adds${unused.length ? ` (not: ${unused.join(", ")})` : ""}`);
  check(!needed.length, `and refusing any one of them, it falls short of the goal${needed.length ? ` (still reached: ${needed.join(", ")})` : ""}`);
  check(!stripped.length, `taking a table's stones, water, marsh or hedges off raises the careful player's score by a fifth at least (four games each, to 150 pieces)${stripped.length ? ` (not: ${stripped.join("; ")})` : ""}`);
}
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple features: each level's features are used, and needed, in the game that reaches its goal");
