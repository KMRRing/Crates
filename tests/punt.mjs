// Punt sessions: every level deals a full session; every question has four options, a right one and a wrong one, no
// option or clue gives the answer away by name, and every bet pays 2×. Run: node tests/punt.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const P = await import("../punt-gen.js");

// at a table (a pair's match, a party's of up to six): a round settled for several players, Against (a pot each) and
// Together (one pot); who the table waits for (the slow, the seats not yet sat in, never the away or the bust); going
// on without the slow after the grace; Next for everyone; the reveal's order; the pair's record; every state as the
// database keeps it (read back after each change, as a transaction would see it)
{
  const T = await import("../punt-table.js");
  const { roundTrip } = await import("./rtdb.js");
  const { reseat } = await import("../rooms.js");
  let fails = 0;
  const ok = (cond, what) => { if (!cond) { fails++; console.log(`FAIL table: ${what}`); } };
  const q = (right = 0) => ({ kind: "clue", options: ["Brazil", "Chile", "Peru", "Bolivia"].map((label, i) => ({ label, right: i === right })), need: 1, answer: "Brazil" });
  const players = n => Object.fromEntries(["a", "b", "c", "d", "e", "f"].slice(0, n).map((id, slot) => [id, { name: ["Korbi", "Sarah", "Tom", "Ana", "Bo", "Lin"][slot], slot, online: true }]));
  const table = (mode, n, people = n, questions = 3) => ({ v: 1, app: 2, seed: 7, created: 1, level: "mix", length: "standard", mode, people,
    questions: Array.from({ length: questions }, () => q(0)), players: players(n), index: 0, phase: "bet", bets: {}, log: [], done: null, pot: 1000 });
  /** A change as a transaction makes it: on the state the database gave back, then stored again. */
  const tx = (g, fn) => { const cur = roundTrip(g); const r = fn(cur); return r === false ? g : roundTrip(cur); };
  const bet = (pick, pct, at) => ({ pick: [pick], pct, at });

  // Against, three at the table: each stakes on their own pot; it settles on the last stake
  let g = table("against", 3);
  ok(T.maxShare(g) === 100 && T.potOf(g, "c") === 1000, "Against: all of your own pot, 1,000 to start");
  g = tx(g, x => T.stake(x, "a", bet(0, 10, 1000), ["a", "b", "c"]));
  g = tx(g, x => T.stake(x, "b", bet(2, 50, 2000), ["a", "b", "c"]));
  ok(g.phase === "bet" && T.waitingFor(g, ["a", "b", "c"]).ids.join() === "c", "the table waits for the one still to stake");
  ok(T.waitingFor(g, ["a", "b"]).ids.length === 0, "and not for one who's away");
  ok(T.goOnAt(g, ["a", "b", "c"]) === 2000 + T.GRACE && !T.mayGoOn(g, ["a", "b", "c"], 2000 + T.GRACE - 1) && T.mayGoOn(g, ["a", "b", "c"], 2000 + T.GRACE),
    "the slow can be gone on without once everyone else has staked and the grace has passed since the last of them");
  g = tx(g, x => T.stake(x, "c", { pick: [0], pct: 0, at: 3000 }, ["a", "b", "c"]));
  const e = T.logOf(g).at(-1);
  ok(g.phase === "reveal" && g.pots.a === 1100 && g.pots.b === 500 && (g.pots.c ?? 1000) === 1000, "settled on the last stake: +100 on a right 10%, −500 on a wrong half, a pass changes nothing");
  ok(e.bets.a.pot === 1000 && e.bets.a.stake === 100 && e.bets.a.change === 100 && e.bets.b.change === -500 && e.bets.c.pct === 0 && e.bets.c.pick.join() === "0" && !e.bets.c.none,
    "the log keeps each player's pick, stake, change and pot before");
  const rows = T.standingsAfter(g);
  ok(rows.map(r => r.id).join() === "a,c,b" && rows.map(r => r.value).join() === "1100,1000,500" && rows.map(r => r.change).join() === "100,0,-500", "the reveal's order: best pot first, each with this question's change");
  // Next: once everyone here has pressed it; one gone away isn't waited for
  g = tx(g, x => T.pressNext(x, "a", ["a", "b", "c"], 4000));
  g = tx(g, x => T.pressNext(x, "b", ["a", "b", "c"], 5000));
  ok(g.phase === "reveal" && T.waitingFor(g, ["a", "b", "c"]).ids.join() === "c", "Next waits for everyone at the table");
  ok(!T.carryOn(roundTrip(g), ["a", "b", "c"], 5100) && T.carryOn(roundTrip(g), ["a", "b"], 5100), "nobody left to wait for once the last one goes away");
  g = tx(g, x => T.carryOn(x, ["a", "b"], 5100));
  ok(g.phase === "bet" && g.index === 1 && !g.next, "on to the next question");
  // the slow gone on without: their stake is nothing
  g = tx(g, x => T.stake(x, "a", bet(1, 25, 10000), ["a", "b", "c"]));
  g = tx(g, x => T.stake(x, "b", bet(0, 20, 12000), ["a", "b", "c"]));
  ok(!T.goOn(roundTrip(g), ["a", "b", "c"], 12000 + T.GRACE - 1), "not before the grace");
  g = tx(g, x => T.goOn(x, ["a", "b", "c"], 12000 + T.GRACE));
  const e2 = T.logOf(g).at(-1);
  ok(g.phase === "reveal" && e2.bets.c.none && e2.bets.c.change === 0 && g.pots.a === 1100 - 275 && g.pots.b === 500 + 100, "gone on without the slow one, who staked nothing");
  // all in and wrong: bust, not waited for, can't stake; the run ends when everyone is
  g = tx(g, x => T.carryOn(x, ["a", "b"], 50000) || T.advance(x));
  g = tx(g, x => T.stake(x, "a", bet(3, 100, 60000), ["a", "b"]));
  g = tx(g, x => T.stake(x, "b", bet(0, 10, 61000), ["a", "b"]));
  ok(T.isBust(g, "a") && T.potOf(g, "a") === 0 && !T.runOver({ ...g, index: 0 }), "all in and wrong: bust, the others play on");
  const later = tx({ ...g, questions: [...g.questions, q(0)] }, x => T.advance(x));
  ok(T.waitingFor(later, ["a", "b", "c"]).ids.join() === "b,c" && !T.stake(roundTrip(later), "a", bet(0, 10, 1), ["a", "b", "c"]), "a bust player is neither waited for nor able to stake");
  ok(T.waitingFor(g, ["a", "b", "c"]).ids.join() === "b,c", "nor waited for to press Next: they only watch");
  ok(T.runOver({ ...g, pots: { a: 0, b: 0, c: 0 } }) && T.runOver(g), "the run ends when everyone's bust, or after the set's last question");
  g = tx(g, x => T.advance(x, null, 70000));
  ok(g.done?.at === 70000, "the end of the set");
  const ra = T.resultFor(g, "a"), rc = T.resultFor(g, "c");
  ok(rc.won && !rc.coop && rc.score === 1000 && !T.resultFor(g, "b").won && !ra.won && ra.score === 0 && ra.match === rc.match, "the pair's record: head to head, won by the sole first");
  ok(!T.resultFor({ ...g, pots: { a: 900, b: 900, c: 900 } }, "a").won, "a shared first place wins nobody the match");

  // the first question waits for the seats kept for people who haven't sat down yet, then for nobody missing
  let h = table("against", 2, 4);
  h = tx(h, x => T.stake(x, "a", bet(0, 10, 1000), ["a", "b"]));
  h = tx(h, x => T.stake(x, "b", bet(0, 10, 1500), ["a", "b"]));
  ok(h.phase === "bet" && T.waitingFor(h, ["a", "b"]).seats === 2 && T.goOnAt(h, ["a", "b"]) === 1500 + T.GRACE, "a party's first question waits for its people to sit down, with the grace");
  h = tx(h, x => T.goOn(x, ["a", "b"], 1500 + T.GRACE));
  h = tx(h, x => T.advance(x));
  ok(h.phase === "bet" && T.waitingFor(h, ["a", "b"]).seats === 0, "after the first question, an empty seat holds nothing up");
  h.players.c = { name: "Tom", slot: 2, online: true };
  ok(T.waitingFor(h, ["a", "b", "c"]).ids.join() === "a,b,c" && T.potOf(h, "c") === 1000, "one who sits down later is waited for, with 1,000 of their own");

  // Together: one pot, an equal share each at most; the standings are what each has added to it
  let t = table("together", 3);
  ok(T.maxShare(t) === 33 && T.maxShare(table("together", 2)) === 50 && T.maxShare(table("together", 2, 6)) === 16, "Together: half the pot each for two, a third for three, a sixth for six");
  t = tx(t, x => T.stake(x, "a", bet(0, 50, 1), ["a", "b", "c"]));
  ok(t.bets.a.pct === 33, "a stake is held to the share");
  t = tx(t, x => T.stake(x, "b", bet(1, 10, 2), ["a", "b", "c"]));
  t = tx(t, x => T.stake(x, "c", bet(0, 0, 3), ["a", "b", "c"]));
  const te = T.logOf(t).at(-1);
  ok(t.pot === 1000 + 330 - 100 && te.change === 230 && te.pot === 1000 && !t.pots, "the pot takes everyone's gains and losses");
  ok(T.standingsAfter(t).map(r => `${r.id}${r.value}`).join() === "a330,c0,b-100", "the standings: what each has added, most first");
  t = tx(t, x => T.pressNext(x, "a", ["a"], 9) );
  ok(t.index === 1 && t.phase === "bet", "Next alone at the table moves on");
  ok(T.resultFor({ ...t, done: { at: 1 } }, "b").coop && T.resultFor({ ...t, done: { at: 1 } }, "b").score === t.pot, "Together, the pair's record is the team's pot");

  // a player's seat taken over on another device keeps their pot, stake and log
  const moved = reseat(roundTrip(g), "b", "z");
  ok(moved.pots.z === g.pots.b && T.logOf(moved)[0].bets.z.change === -500 && !moved.pots.b, "a seat taken over keeps its pot and its log");
  ok(T.peopleFor({ people: 9 }) === 6 && T.peopleFor({ people: 3 }) === 3 && T.peopleFor(null) === 2 && T.modeOf({}) === "together" && T.modeOf({ mode: "against" }) === "against",
    "seats for two to six people; a table from before the modes had one pot");
  console.log(fails ? `table: ${fails} FAILED` : "table: Against and Together settle for everyone at once, wait for the slow and the seats still empty but not the away or the bust, go on without the slow after the grace, rank the reveal by pot, and keep as the database does");
  if (fails) process.exitCode = 1;
}
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
