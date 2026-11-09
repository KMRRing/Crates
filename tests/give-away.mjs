// A question whose right answer is a word of the question is left out of the banks (give-away.js; 2 November 2026, Korbi:
// "if the answer is a word that is in the question … just skip these questions"): "Where does the Hannover Messe take
// place?" → Hannover. The matcher, and every bank built from kb/ clear of such questions.
import { givesAway, mentions } from "../give-away.js";
import { CHOICE_BANKS, build } from "../tools/build-kb.mjs";
// judged on everything kb/ holds (the personal build): the published banks deal only the universal part of it
const full = await build({ level: "personal" });
const load = async f => ({ MATHS: full.choice[f.replace("-bank.js", "")].MATHS });

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const item = (q, o, a = [0]) => ({ q, o, a });

check(givesAway(item("Where does the Hannover Messe take place?", ["Hannover", "Munich", "Frankfurt", "Cologne"])), "the Hannover Messe is in Hannover: skipped");
check(givesAway(item("The Shanghai Futures Exchange trades copper in", ["Shanghai", "Beijing", "Shenzhen", "Dalian"])), "an exchange in its own city: skipped");
check(givesAway(item("The capital of Tunisia", ["Tunis", "Tripoli", "Algiers", "Rabat"])), "Tunis from Tunisia (one word begins the other): skipped");
check(givesAway(item("The wife of a baron is a", ["baroness", "dame", "marchioness", "lady"])), "baroness from baron: skipped");
check(givesAway(item("The capital of São Tomé and Príncipe", ["Sao Tome", "Luanda", "Libreville", "Malabo"])), "accents don't hide it: skipped");
check(mentions("Grupo México", "Mexico") && !mentions("Grupo Bimbo", "Mexico"), "a clue naming its answer, accents aside");

check(!givesAway(item("Which is sweeter, Brut or Extra Dry?", ["Extra Dry", "Brut", "Sec", "Demi-sec"])), "a question that names its candidates hides nothing: kept");
check(!givesAway(item("For CIF (CIP raised the cover to Institute Cargo Clauses (A)) the minimum stays", ["Institute Cargo Clauses (C)", "Institute Cargo Clauses (A)", "Institute Cargo Clauses (B)", "no cover"])), "(C) against (A): kept");
check(!givesAway(item("Vermeer painted about how many pictures that survive?", ["About 35", "About 5", "About 100", "About 350"])), "'about' is not the answer: kept");
check(!givesAway(item("What is the capital of France?", ["Paris", "Lyon", "Nice", "Lille"])), "an ordinary question: kept");
check(!givesAway({}) && !givesAway(null) && !givesAway(item("q", ["a", "b"], [])), "malformed items are left alone");

// the banks as built
let left = 0, total = 0;
for (const b of CHOICE_BANKS) {
  const { MATHS } = await load(`${b}-bank.js`);
  total += MATHS.length;
  for (const q of MATHS) if (givesAway(q)) { left++; console.log(`  ${b}: ${q.q.slice(0, 90)} → ${q.a.map(i => q.o[i]).join(" / ")}`); }
}
check(left === 0 && total > 2000, `no question of the ${total} in the banks built from kb/ has its answer in it${left ? ` (${left} do: run node tools/build-kb.mjs)` : ""}`);
process.exit(bad ? 1 : 0);
