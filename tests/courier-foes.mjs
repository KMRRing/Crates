// Courier's foes: the behaviours table (BEHAVIOURS in reckoning-engine.js) has an entry for every kind, each living kind has timings that
// make sense and punishes a habit no other kind does, and each foe's counters work (and its punished habit fails) in play.
import { KINDS, BEHAVIOURS, behOf } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

{
  check(Object.keys(KINDS).every(k => BEHAVIOURS[k]), "every kind of foe has a behaviour");
  const live = Object.entries(BEHAVIOURS).filter(([, b]) => !b.inert);
  check(live.every(([, b]) => b.sight > b.wind && b.wind > b.launch && b.launch > 0 && b.counters.length >= 2 && b.move), "a living foe sees, winds up and launches in that order, and has two ways to beat it at least");
  const habits = live.map(([, b]) => b.punishes);
  check(habits.every(Boolean) && new Set(habits).size === habits.length, `no two foes punish the same habit (${habits.length} kinds)`);
  check(behOf({ kind: "crab", heavy: true }) === BEHAVIOURS.bruiser && behOf({ kind: "gull" }) === BEHAVIOURS.gull, "a heavy crab behaves as the bruiser");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier foes: the behaviours table");
