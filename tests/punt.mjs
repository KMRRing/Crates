// Punt sessions: every level deals a full session; every question has a right and a wrong option, no option
// or clue gives the answer away by name, and the odds are sane. Run: node tests/punt.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const P = await import("../punt-gen.js");
let bad = 0;
// the maths bank, for the Maths level (every stage and difficulty)
const M = await import("../maths-bank.js");
const BANKS = { maths: M, refining: await import("../refining-bank.js"), reasoning: await import("../reasoning-bank.js"), words: await import("../words-bank.js"), cities: await import("../cities-bank.js"), flags: await import("../flags-bank.js"), patterns: await import("../patterns-bank.js") };
const stageMap = B => Object.fromEntries(B.STAGES.map(x => [x.id, x.label]));
const mathsFor = lvl => (BANKS[lvl] ? { pool: BANKS[lvl].MATHS, stages: stageMap(BANKS[lvl]) } : null);
for (const lvl of Object.keys(P.LEVELS)) {
  let multi = 0, total = 0, overpaid = 0, oddsSeen = [];
  for (let seed = 1; seed <= 40; seed++) {
    const s = P.makeSession(seed * 7919, lvl, "standard", mathsFor(lvl));
    if (s.length !== P.LEVELS[lvl].questions) { bad++; console.log(`${lvl} seed ${seed}: ${s.length} questions`); }
    if (JSON.stringify(P.makeSession(seed * 7919, lvl, "standard", mathsFor(lvl))) !== JSON.stringify(s)) { bad++; console.log(`${lvl} seed ${seed}: not repeatable`); }
    for (const q of s) {
      total++;
      const right = q.options.filter(o => o.right).length;
      if (![2, 4].includes(q.options.length)) { bad++; console.log(`${lvl}: a question with ${q.options.length} options`); }
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
// runs must be comparable: a typical player's average value from the house's prices is the same in every run
for (const lvl of Object.keys(P.LEVELS)) {
  const target = 1 - P.LEVELS[lvl].margin;
  for (let seed = 1; seed <= 10; seed++) {
    let qs = P.makeSession(seed * 104729, lvl, "hundred", mathsFor(lvl));
    const runValue = qs.reduce((t, q) => t + q.chance * q.offered, 0) / qs.length;
    if (qs.length !== 100 || Math.abs(runValue - target) > 0.005) { bad++; console.log(`${lvl} 100-question run ${seed}: ${qs.length} questions, value ${runValue.toFixed(3)} (target ${target})`); }
    qs = P.makeSession(seed, lvl, "endless", mathsFor(lvl));
    for (let k = 0; k < 4; k++) qs = qs.concat(P.moreQuestions(seed, lvl, qs, mathsFor(lvl)));
    const batches = [0, 1, 2, 3, 4].map(b => qs.slice(b * P.BATCH, (b + 1) * P.BATCH));
    for (const batch of batches) {
      const v = batch.reduce((t, q) => t + q.chance * q.offered, 0) / batch.length;
      if (Math.abs(v - target) > 0.01) { bad++; console.log(`${lvl} endless batch: value ${v.toFixed(3)} (target ${target})`); }
    }
    const pool = mathsFor(lvl)?.pool.length;
    if (!(pool && pool < qs.length) && new Set(qs.map(q => q.key)).size !== qs.length) { bad++; console.log(`${lvl} endless run repeats a clue`); }   // a small bank cycles by design
  }
  console.log(`${lvl}: 100-question and endless runs all priced at ${target} to a typical player`);
}
// Maths: a filter to one stage and two difficulties deals only those, cycles once the pool runs dry, keeps the
// questions' own right answers, and prices harder questions higher
{
  const pool = M.MATHS.filter(q => q.lv === "gcse" && [1, 2].includes(q.d));
  const qs = P.makeSession(5, "maths", "hundred", { pool, stages: stageMap(M) });
  const byId = new Map(M.MATHS.map(q => [q.id, q]));
  const okFilter = qs.every(q => { const src = byId.get(q.key); return src.lv === "gcse" && [1, 2].includes(src.d); });
  const okAnswers = qs.every(q => { const src = byId.get(q.key); return q.options.filter(o => o.right).length === src.s && q.options.every((o, k) => o.right === src.a.includes(k)); });
  const easy = qs.filter(q => q.d === 1), easyPrice = easy.reduce((t, q) => t + q.fair, 0) / easy.length;
  const hardQs = P.makeSession(5, "maths", "standard", { pool: M.MATHS.filter(q => q.d >= 9), stages: stageMap(M) });
  const hardPrice = hardQs.reduce((t, q) => t + q.fair, 0) / hardQs.length;
  console.log(`maths: filtered pool of ${pool.length}, 100 dealt (cycling), fair price ${easyPrice.toFixed(2)}× at difficulty 1 against ${hardPrice.toFixed(2)}× at 9–10`);
  if (!(okFilter && okAnswers && qs.length === 100 && hardPrice > easyPrice * 1.5)) { bad++; console.log("maths deal problems", { okFilter, okAnswers, n: qs.length }); }
}
console.log(bad ? `${bad} problems` : "all sessions check out");
if (bad) process.exitCode = 1;

// the stats should read sizing right: simulated players who know their chances and stake ½, 1 or 2 × Kelly
{
  let r = 12345;
  const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  for (const c of [0.5, 1, 2]) {
    const recs = [];
    for (let i = 0; i < 4000; i++) {
      const o = 1.2 + rnd() * 3, p = 0.3 + rnd() * 0.65, k = P.kellyStake(p, o);
      const f = Math.min(1, c * k), right = rnd() < p ? 1 : 0;
      recs.push({ o, f, r: f > 0 ? right : null });
    }
    const st = P.knowledgeStats(recs);
    const ok = Math.abs(st.sizing / c - 1) < 0.45;
    console.log(`player staking ${c}× Kelly: the stats say ${st.sizing.toFixed(2)}× ${ok ? "" : "(off)"}`);
    if (!ok) process.exitCode = 1;
  }
}
