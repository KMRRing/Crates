// Punt sessions: every level deals a full session; every question has four options, a right one and a wrong one, no
// option or clue gives the answer away by name, and every bet pays 2×. Run: node tests/punt.mjs
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
// every level that deals from a bank, as punt-gen.js declares it (so a new level is tested without touching this file)
const BANKS = Object.fromEntries(await Promise.all(Object.entries(P.LEVELS).filter(([, L]) => L.bank)
  .map(async ([id, L]) => [id, L.bank === "./maths-bank.js" ? M : await import(`../${L.bank.replace("./", "")}`)])));
const stageMap = B => Object.fromEntries(B.STAGES.map(x => [x.id, x.label]));
const mathsFor = lvl => (BANKS[lvl] ? { pool: BANKS[lvl].MATHS, stages: stageMap(BANKS[lvl]) } : null);
for (const lvl of Object.keys(P.LEVELS).filter(l => l !== "mix")) {   // a run of topics has its own test, below
  let multi = 0, total = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = P.makeSession(seed * 7919, lvl, "standard", mathsFor(lvl));
    if (s.length !== P.LEVELS[lvl].questions) { bad++; console.log(`${lvl} seed ${seed}: ${s.length} questions`); }
    if (JSON.stringify(P.makeSession(seed * 7919, lvl, "standard", mathsFor(lvl))) !== JSON.stringify(s)) { bad++; console.log(`${lvl} seed ${seed}: not repeatable`); }
    for (const q of s) {
      total++;
      const right = q.options.filter(o => o.right).length;
      if (q.options.length !== 4) { bad++; console.log(`${lvl}: a question with ${q.options.length} options`); }
      if (!right || right === q.options.length) { bad++; console.log(`${lvl}: a question with ${right} of ${q.options.length} right`); }
      if (right > 1) multi++;
      if ("offered" in q || "fair" in q) { bad++; console.log(`${lvl}: a question priced on its own`); }
    }
  }
  console.log(`${lvl}: ${total} questions of four options, ${multi} with several right answers`);
}
// runs deal their full lengths (100-question and endless) without repeating a clue
for (const lvl of Object.keys(P.LEVELS).filter(l => l !== "mix")) {
  for (let seed = 1; seed <= 10; seed++) {
    let qs = P.makeSession(seed * 104729, lvl, "hundred", mathsFor(lvl));
    if (qs.length !== 100 || qs.some(q => q.options.length !== 4)) { bad++; console.log(`${lvl} 100-question run ${seed}: ${qs.length} questions`); }
    qs = P.makeSession(seed, lvl, "endless", mathsFor(lvl));
    for (let k = 0; k < 4; k++) qs = qs.concat(P.moreQuestions(seed, lvl, qs, mathsFor(lvl)));
    const pool = mathsFor(lvl)?.pool.length;
    if (!(pool && pool < qs.length) && new Set(qs.map(q => q.key)).size !== qs.length) { bad++; console.log(`${lvl} endless run repeats a clue`); }   // a small bank cycles by design
  }
}
// every bet pays 2×: a right one wins the stake again, a wrong one loses it, a pass costs nothing
{
  const win = P.settle(1000, 10, true), lose = P.settle(1000, 10, false), pass = P.settle(1000, 0, true), odd = P.settle(999, 25, true);
  if (!(P.ODDS === 2 && win.change === 100 && lose.change === -100 && pass.change === 0 && odd.stake === 249 && odd.change === 249)) { bad++; console.log("settling at 2×", { win, lose, pass, odd }); }
  else console.log("odds: every bet pays 2×, a right one winning its stake again and a wrong one losing it");
}
// Maths: a filter to one stage and two difficulties deals only those, cycles once the pool runs dry and keeps the
// questions' own right answers
{
  const pool = M.MATHS.filter(q => q.lv === "gcse" && [1, 2].includes(q.d));
  const qs = P.makeSession(5, "maths", "hundred", { pool, stages: stageMap(M) });
  const byId = new Map(M.MATHS.map(q => [q.id, q]));
  const okFilter = qs.every(q => { const src = byId.get(q.key); return src.lv === "gcse" && [1, 2].includes(src.d); });
  // the bank's options, in a new order each run: the same labels, each right exactly when the bank says so
  const okAnswers = qs.every(q => { const src = byId.get(q.key); return q.options.filter(o => o.right).length === src.s && q.options.length === src.o.length && q.options.every(o => src.o.includes(o.label) && o.right === src.a.includes(src.o.indexOf(o.label))); });
  const moved = qs.filter(q => q.options.some((o, k) => o.label !== byId.get(q.key).o[k])).length;
  if (moved < qs.length / 2) { bad++; console.log("maths options keep the bank's order", { moved, of: qs.length }); }
  console.log(`maths: filtered pool of ${pool.length}, 100 dealt (cycling), the bank's answers in a new order`);
  if (!(okFilter && okAnswers && qs.length === 100)) { bad++; console.log("maths deal problems", { okFilter, okAnswers, n: qs.length }); }
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
// away, and choosing it from four options has exactly one right option and it's the name.
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
      if (right.length !== 1 || right[0].label !== q.answer || q.options.length !== 4) fail(`${lvl}: "${q.prompt}" offers ${right.length} right of ${q.options.length} options`);
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
  console.log(wrong ? `name-it: ${wrong} FAILED` : "name-it: off deals none, all only name-it, known only what's been recognised; every one asks for a name its hint doesn't give away");
  if (wrong) process.exitCode = 1;
}

// topics: a mixed run deals each topic by its weight (a "more" topic twice an "in" one), keeps a clue topic to its own
// category and puts every question on the 1–10 scale; the next block carries on
{
  const pool = M.MATHS.slice(0, 200), mathsStages = stageMap(M);
  const src = [{ id: "countries", label: "Countries", weight: 1, cat: "country", diffs: [] }, { id: "commodities", label: "Commodities", weight: 2, cat: "commodity", diffs: [] },
    { id: "maths", label: "Maths", weight: 1, pool, stages: mathsStages, dueKeys: [], seenKeys: new Set() }];
  const qs = P.mixQuestions(12345, src, 16);
  const by = qs.reduce((t, q) => ({ ...t, [q.src]: (t[q.src] || 0) + 1 }), {});
  const ok = qs.length === 16 && by.commodities === 8 && by.countries === 4 && by.maths === 4 && qs.every(q => q.options.length === 4 && q.d >= 1 && q.d <= 10)
    && qs.filter(q => q.src === "countries").every(q => q.cat === "country") && qs.filter(q => q.src === "commodities").every(q => q.cat === "commodity");
  const more = P.mixQuestions(12345, src, 8, qs), keys = [...qs, ...more].filter(q => q.src !== "maths").map(q => q.key);
  const easyOnly = P.mixQuestions(7, [{ id: "countries", label: "Countries", weight: 1, cat: "country", diffs: [1, 2] }], 12);
  const presetsOk = Object.values(P.TOPIC_PRESETS).every(p => Object.keys(p.topics).every(k => P.TOPIC_LIST.some(([t]) => t === k)));
  if (!ok || more.length !== 8 || new Set(keys).size !== keys.length || !easyOnly.every(q => q.d <= 3) || !presetsOk) {
    console.log("topics mix problems", { by, n: qs.length, more: more.length, repeats: keys.length - new Set(keys).size, easy: easyOnly.map(q => q.d), presetsOk });
    process.exitCode = 1;
  } else console.log("topics: a mixed run deals by weight, keeps each clue topic to its category, every question on the 1–10 scale, and carries on");
}

// the long run: Balanced runs of every topic, every question of four options, a clue question on the 1–10 scale like
// any other
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
  const clue = all.filter(q => P.CLUE_TOPICS[q.src]), scale = new Set(clue.map(q => q.d));
  if (!(all.every(q => q.options.length === 4) && [...scale].every(d => [3, 6, 8].includes(d)) && scale.size === 3)) { console.log("long run", { options: [...new Set(all.map(q => q.options.length))], scale: [...scale] }); process.exitCode = 1; }
  else console.log(`${all.length} Balanced questions, every one of four options; clue questions at difficulty ${[...scale].sort().join(", ")} on the 1–10 scale`);
}
