// The level gate for the chapters after the ninth (landfall-bots.js; tests/landfall-bots.mjs has sections 1 to 9), shared by
// tests/landfall-bots-sea.mjs and tests/landfall-bots-sky.mjs, which run it on half of them each (one test of all of them runs too long).
// Each level is played by a careful bot, a sloppy one and a blind one; a good level has the careful bot winning more often than not, the
// blind one well behind, and the sloppy one behind over the chapters. And each chapter's own way to a line has to matter: a careful bot
// that leaves it alone does worse.
import { LEVELS } from "../landfall-levels.js";
import { play, BOTS } from "../landfall-bots.js";
import { validate } from "../landfall-engine.js";

const SEEDS = 24;
// the careful bot without the chapter's own tool: no lead or line of soundings, no light or land or birds
BOTS.without = { ...BOTS.careful, lead: false, noLight: true, noLand: true };

/** Runs the gate on the levels of `sections`; prints its checks and returns the number that failed. */
export function gate(sections, what) {
  let bad = 0, invalid = 0;
  const check = (ok, line) => { console.log(`${ok ? "ok  " : "FAIL"} ${line}`); if (!ok) bad++; };
  const SEA = LEVELS.filter(L => sections.includes(L.section)), R = {};
  for (const L of SEA) {
    R[L.id] = {};
    for (const bot of ["careful", "sloppy", "blind", ...(L.unnamed ? [] : ["without"])]) {
      let won = 0;
      for (let seed = 1; seed <= SEEDS; seed++) { const p = play(L.id, seed, bot); if (p.S.end.kind === "arrived") won++; if (validate(p.S).length) invalid++; }
      R[L.id][bot] = won / SEEDS;
    }
    const r = R[L.id], pc = x => `${Math.round(100 * x)}%`;
    console.log(`     ${L.name.padEnd(24)} careful ${pc(r.careful)}, sloppy ${pc(r.sloppy)}, blind ${pc(r.blind)}${r.without !== undefined ? `, without its tool ${pc(r.without)}` : ""}`);
  }
  const mean = b => SEA.reduce((t, L) => t + R[L.id][b], 0) / SEA.length;
  check(invalid === 0, "every bot's voyage keeps the engine's invariants");
  check(SEA.every(L => R[L.id].careful >= 0.65), `the careful bot wins every level of ${what} more often than not (${SEA.map(L => Math.round(100 * R[L.id].careful)).join(", ")}%)`);
  check(SEA.every(L => R[L.id].blind <= R[L.id].careful - 0.25), "...and the blind bot is at least a quarter behind on each");
  check(mean("careful") - mean("sloppy") >= 0.1, `the sloppy bot is behind over them: ${(100 * mean("careful")).toFixed(0)} / ${(100 * mean("sloppy")).toFixed(0)} / ${(100 * mean("blind")).toFixed(0)}%`);
  const tooled = SEA.filter(L => R[L.id].without !== undefined), gain = tooled.reduce((t, L) => t + R[L.id].careful - R[L.id].without, 0) / tooled.length;
  check(gain >= 0.1 && tooled.filter(L => R[L.id].careful < R[L.id].without).length <= 1, `each chapter's tool matters: a careful bot without it wins ${(100 * gain).toFixed(0)} points less on average`);
  return bad;
}
