// Courier's twenty sections (reckoning-sections.js): every one is built, played through by a bot that swipes by the rules (tests/reckoning-bot.js)
// and must reach its finish with its aim met and no more hearts lost than its par allows: a section nobody can win does not get in.
import { SECTIONS } from "../reckoning-sections.js";
import { newGame, goalValue, starsOf, speed } from "../reckoning-engine.js";
import { playSection } from "./reckoning-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const q = n => ({ id: `Q${n}`, bank: "test", q: "?", o: ["a", "b", "c"], a: n % 3, x: "", about: [] });
const only = process.argv[2] ? +process.argv[2] : 0;

for (const def of SECTIONS) {
  if (only && def.id !== only) continue;
  let n = 0;
  const S = playSection(def, { deal: () => q(n++) });
  const goal = goalValue(S), stars = starsOf(S);
  console.log(`     ${String(def.id).padStart(2)} ${def.name.padEnd(22)} ${Math.round(S.hero.z)} m of ${Math.round(S.world.finish)}, hits ${S.hits}, aim ${goal}/${def.goal.n}${def.par.more ? ` (par ${def.par.more})` : ""}, ${stars} stars, ${S.t.toFixed(0)} s`);
  check(S.won && S.hits <= def.par.hits && stars === 3, `section ${def.id}, ${def.name}: won at par with the full aim`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier sections: every section is built, and won by a bot at par");
