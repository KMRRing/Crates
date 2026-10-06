// Punt sessions: every level deals a full session; every question has a right and a wrong option, no option
// or clue gives the answer away by name, and the odds are sane. Run: node tests/punt.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const P = await import("../punt-gen.js");
{
  const opts = n => Array.from({ length: n }, (_, i) => ({ label: `o${i}`, right: i === 0 }));
  const g = P.guessChance, ok = Math.abs(g({ options: opts(4), need: 1 }) - .25) < 1e-9 && Math.abs(g({ options: opts(4), need: 2 }) - 1 / 6) < 1e-9
    && g({ options: opts(2), need: 1 }) === .5 && g({ options: opts(4), need: 1 }, true) === 0 && g({}) === 0;
  console.log(ok ? "guess: a pure guess's chance, one in four for one of four, one in six for two of four, none typed" : "FAIL guess chances");
  if (!ok) process.exitCode = 1;
}
let bad = 0;
// the maths bank, for the Maths level (every stage and difficulty)
const M = await import("../maths-bank.js");
const BANKS = { maths: M, refining: await import("../refining-bank.js"), reasoning: await import("../reasoning-bank.js"), words: await import("../words-bank.js"), cities: await import("../cities-bank.js"), flags: await import("../flags-bank.js"), patterns: await import("../patterns-bank.js"), wine: await import("../wine-bank.js"), art: await import("../art-bank.js"), economics: await import("../eco-bank.js"), physics: await import("../phy-bank.js"), chemistry: await import("../chm-bank.js"), code: await import("../cs-bank.js"), philosophy: await import("../phil-bank.js"), religion: await import("../rel-bank.js") };
const stageMap = B => Object.fromEntries(B.STAGES.map(x => [x.id, x.label]));
const mathsFor = lvl => (BANKS[lvl] ? { pool: BANKS[lvl].MATHS, stages: stageMap(BANKS[lvl]) } : null);
for (const lvl of Object.keys(P.LEVELS).filter(l => l !== "mix")) {   // a run of topics has its own test, below
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
  console.log(`${lvl}: ${total} questions, ${multi} with several right answers, odds ${oddsSeen[0]}× to ${oddsSeen[oddsSeen.length - 1]}× (median ${oddsSeen[oddsSeen.length >> 1]}×)`);
}
// the odds: every question on the scale from 1.1× to 3× (typed answers up to 4×), harder questions paying more; runs
// still deal their full lengths (100-question and endless) without repeating a clue
for (const lvl of Object.keys(P.LEVELS).filter(l => l !== "mix")) {
  for (let seed = 1; seed <= 10; seed++) {
    let qs = P.makeSession(seed * 104729, lvl, "hundred", mathsFor(lvl));
    const off = qs.filter(q => q.offered < 1.1 - 1e-9 || q.offered > 3 + 1e-9 || (q.typedOffered && q.typedOffered > 4 + 1e-9));
    if (qs.length !== 100 || off.length) { bad++; console.log(`${lvl} 100-question run ${seed}: ${qs.length} questions, ${off.length} priced off the scale`); }
    qs = P.makeSession(seed, lvl, "endless", mathsFor(lvl));
    for (let k = 0; k < 4; k++) qs = qs.concat(P.moreQuestions(seed, lvl, qs, mathsFor(lvl)));
    const pool = mathsFor(lvl)?.pool.length;
    if (!(pool && pool < qs.length) && new Set(qs.map(q => q.key)).size !== qs.length) { bad++; console.log(`${lvl} endless run repeats a clue`); }   // a small bank cycles by design
  }
}
{
  const easy = P.scaleOdds(1.05), hard = P.scaleOdds(2.5), mid = P.scaleOdds(1.35);
  if (!(Math.abs(easy - 1.1) < 1e-9 && Math.abs(hard - 3) < 1e-9 && mid > easy && mid < hard)) { bad++; console.log("odds scale ends", { easy, mid, hard }); }
  else console.log(`odds: the easiest ${easy}×, the hardest ${hard}×, in between by how hard the house thinks a question is`);
}
// Maths: a filter to one stage and two difficulties deals only those, cycles once the pool runs dry, keeps the
// questions' own right answers, and prices harder questions higher
{
  const pool = M.MATHS.filter(q => q.lv === "gcse" && [1, 2].includes(q.d));
  const qs = P.makeSession(5, "maths", "hundred", { pool, stages: stageMap(M) });
  const byId = new Map(M.MATHS.map(q => [q.id, q]));
  const okFilter = qs.every(q => { const src = byId.get(q.key); return src.lv === "gcse" && [1, 2].includes(src.d); });
  // the bank's options, in a new order each run: the same labels, each right exactly when the bank says so
  const okAnswers = qs.every(q => { const src = byId.get(q.key); return q.options.filter(o => o.right).length === src.s && q.options.length === src.o.length && q.options.every(o => src.o.includes(o.label) && o.right === src.a.includes(src.o.indexOf(o.label))); });
  const moved = qs.filter(q => q.options.some((o, k) => o.label !== byId.get(q.key).o[k])).length;
  if (moved < qs.length / 2) { bad++; console.log("maths options keep the bank's order", { moved, of: qs.length }); }
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

// name-it questions: a clue's own hint, with its answer and topics, the clue to name; the hint never gives the name
// away, choosing it from options has exactly one right option and it's the name, and typing it pays at least as much.
// Three modes: off deals none; all deals nothing else; known (the default) only clues in the record of those recognised
// the other way round, and until there are some, a full run without them
{
  const { normalize } = await import("../typing.js");
  let wrong = 0;
  const fail = msg => { wrong++; console.log(`FAIL ${msg}`); };
  for (const lvl of ["easy", "medium", "hard"]) {
    const all = P.makeSession(4242, lvl, "hundred", null, { mode: "all" });
    if (all.some(q => q.kind !== "name") || all.length !== 100) fail(`${lvl}: "all" deals ${all.filter(q => q.kind === "name").length} name-it of ${all.length}`);
    for (const q of all) {
      const right = q.options.filter(o => o.right);
      if (right.length !== 1 || right[0].label !== q.answer) fail(`${lvl}: "${q.prompt}" offers ${right.length} right options`);
      if (!(q.typedOffered >= q.offered)) fail(`${lvl}: "${q.prompt}" pays ${q.typedOffered} typed, ${q.offered} chosen`);
      if (normalize(q.prompt).includes(normalize(q.answer))) fail(`${lvl}: "${q.prompt}" names ${q.answer}`);
      if (!/^Name it · /.test(q.ask) || !q.pair) fail(`${lvl}: ask "${q.ask}", pair ${q.pair}`);
    }
    const off = P.makeSession(4242, lvl, "hundred", null, { mode: "off" });
    if (off.some(q => q.kind === "name") || off.length !== 100) fail(`${lvl}: "off" deals name-it`);
    const none = P.makeSession(4242, lvl, "hundred", null, { mode: "known", known: {} });
    if (none.some(q => q.kind === "name") || none.length !== 100) fail(`${lvl}: "known" with nothing recognised deals ${none.length}, some name-it`);
    const record = Object.fromEntries(off.flatMap(q => q.pairs || []).slice(0, 10).map(k => [k, { at: 1 }]));
    const mine = P.makeSession(77, lvl, "hundred", null, { mode: "known", known: record }).filter(q => q.kind === "name");
    if (!mine.length || mine.some(q => !record[q.pair])) fail(`${lvl}: "known" names ${mine.length} clues, some not in the record`);
  }
  console.log(wrong ? `name-it: ${wrong} FAILED` : "name-it: off deals none, all only name-it, known only what's been recognised; every one asks for a name its hint doesn't give away, and typing pays more");
  if (wrong) process.exitCode = 1;
}

// topics: a mixed run deals each topic by its weight (a "more" topic twice an "in" one), keeps a clue topic to its own
// category, puts every question on the 1–10 scale and prices the run as one batch; the next block carries on
{
  const pool = M.MATHS.slice(0, 200), mathsStages = stageMap(M);
  const src = [{ id: "countries", label: "Countries", weight: 1, cat: "country", diffs: [] }, { id: "commodities", label: "Commodities", weight: 2, cat: "commodity", diffs: [] },
    { id: "maths", label: "Maths", weight: 1, pool, stages: mathsStages, dueKeys: [], seenKeys: new Set() }];
  const qs = P.mixQuestions(12345, src, 16);
  const by = qs.reduce((t, q) => ({ ...t, [q.src]: (t[q.src] || 0) + 1 }), {});
  const ok = qs.length === 16 && by.commodities === 8 && by.countries === 4 && by.maths === 4 && qs.every(q => q.offered > 1 && q.d >= 1 && q.d <= 10)
    && qs.filter(q => q.src === "countries").every(q => q.cat === "country") && qs.filter(q => q.src === "commodities").every(q => q.cat === "commodity");
  const more = P.mixQuestions(12345, src, 8, qs), keys = [...qs, ...more].filter(q => q.src !== "maths").map(q => q.key);
  const easyOnly = P.mixQuestions(7, [{ id: "countries", label: "Countries", weight: 1, cat: "country", diffs: [1, 2] }], 12);
  const presetsOk = Object.values(P.TOPIC_PRESETS).every(p => Object.keys(p.topics).every(k => P.TOPIC_LIST.some(([t]) => t === k)));
  if (!ok || more.length !== 8 || new Set(keys).size !== keys.length || !easyOnly.every(q => q.d <= 3) || !presetsOk) {
    console.log("topics mix problems", { by, n: qs.length, more: more.length, repeats: keys.length - new Set(keys).size, easy: easyOnly.map(q => q.d), presetsOk });
    process.exitCode = 1;
  } else console.log("topics: a mixed run deals by weight, keeps each clue topic to its category, prices as one batch and carries on");
}

// the long run: Balanced runs of every topic average about 2×, from about 1.1× on the easiest to 3× on the hardest
{
  const sources = [];
  for (const [id, label] of P.TOPIC_LIST) {
    if (P.CLUE_TOPICS[id]) { sources.push({ id, label, weight: 1, cat: P.CLUE_TOPICS[id], diffs: [] }); continue; }
    const B = BANKS[id] || await import(`../${P.LEVELS[id].bank.replace("./", "")}`);
    const pool = B[Object.keys(B).find(k => Array.isArray(B[k]) && B[k][0]?.o)] || [];
    sources.push({ id, label, weight: 1, pool, stages: stageMap(B), dueKeys: [], seenKeys: new Set() });
  }
  const all = [];
  for (let seed = 1; seed <= 40; seed++) all.push(...P.mixQuestions(seed * 7919, sources, 15));
  const odds = all.map(q => q.offered).sort((a, b) => a - b), mean = odds.reduce((a, b) => a + b, 0) / odds.length;
  const p5 = odds[Math.floor(.05 * odds.length)], p95 = odds[Math.floor(.95 * odds.length)];
  if (!(mean > 1.85 && mean < 2.15 && p5 <= 1.25 && p95 >= 2.8)) { console.log("long-run odds", { mean, p5, p95 }); process.exitCode = 1; }
  else console.log(`odds over ${all.length} Balanced questions: average ${mean.toFixed(2)}×, the easiest twentieth ${p5}×, the hardest ${p95}×`);
}
