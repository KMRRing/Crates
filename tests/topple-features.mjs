// Whether what each Topple level brings in is engaged with, or only there (Korbi: "make sure that the features of each level are
// actually impactful and need to be engaged with in order to get the goal rather than just being there"). A knock's use of a level's
// rules is read off the dominoes it brought down (`tagsOf`, tests/topple-players.js). For each thing a level adds, the careful
// player plays the level twice: as it is, and refusing every push that uses the thing (it takes the best push that doesn't).
// `node tests/topple-features.mjs measure games=10 levels=4,5` prints what the README's numbers come from.
import { LEVELS, custom, lodge } from "../topple-levels.js";
import { PLAYERS, play } from "./topple-players.js";

/** What each level adds that a player must engage with, as `tagsOf` names it. */
export const FEATURES = {
  2: ["mix"], 3: ["mix"], 4: ["heavy", "gilded"], 5: ["mix", "down", "gilded"], 6: ["spring", "gate", "heavy"],
  7: ["mix", "drop", "link"], 8: ["water", "link"], 9: ["water", "marsh"], 10: ["rainbow"], 11: ["ball", "cup", "down"],
  12: ["link", "drop", "rainbow"], 13: ["gate", "down", "drop"], 14: ["mix", "gate", "spring", "link", "ball", "cup", "water", "rainbow"],
};
/** What stands in a level's way (not something to use but something to get round), by the map keys that make it. */
export const OBSTACLES = { 2: ["rock"], 3: ["water"], 6: ["water"], 8: ["water", "rock"], 9: ["water", "marsh"], 10: ["hedge"], 14: ["water", "rock"] };
/** The level's spec with those obstacles taken off its table. */
const without = (spec, keys) => {
  const strip = m => Object.fromEntries(Object.entries(m || {}).filter(([k]) => !keys.includes(k)));
  return { ...spec, map: strip(spec.map), layers: spec.layers && spec.layers.map(strip) };
};
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
