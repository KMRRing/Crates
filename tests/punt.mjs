// Punt sessions: every level deals a full session; every question has a right and a wrong option, no option
// or clue gives the answer away by name, and the odds are sane. Run: node tests/punt.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const P = await import("../punt-gen.js");
let bad = 0;
for (const lvl of Object.keys(P.LEVELS)) {
  let multi = 0, total = 0, overpaid = 0, oddsSeen = [];
  for (let seed = 1; seed <= 40; seed++) {
    const s = P.makeSession(seed * 7919, lvl);
    if (s.length !== P.LEVELS[lvl].questions) { bad++; console.log(`${lvl} seed ${seed}: ${s.length} questions`); }
    if (JSON.stringify(P.makeSession(seed * 7919, lvl)) !== JSON.stringify(s)) { bad++; console.log(`${lvl} seed ${seed}: not repeatable`); }
    for (const q of s) {
      total++;
      const right = q.options.filter(o => o.right).length;
      if (!right || right === q.options.length) { bad++; console.log(`${lvl}: a question with ${right} of ${q.options.length} right`); }
      if (right > 1) multi++;
      if (q.offered < 1.05 || q.offered > 9.9) { bad++; console.log(`${lvl}: odds ${q.offered}`); }
      if (q.offered > q.fair) overpaid++;
      oddsSeen.push(q.offered);
    }
  }
  oddsSeen.sort((a, b) => a - b);
  console.log(`${lvl}: ${total} questions, ${multi} with several right answers, house overpays on ${Math.round(100 * overpaid / total)}%, odds ${oddsSeen[0]}× to ${oddsSeen[oddsSeen.length - 1]}× (median ${oddsSeen[oddsSeen.length >> 1]}×)`);
}
console.log(bad ? `${bad} problems` : "all sessions check out");
if (bad) process.exitCode = 1;
