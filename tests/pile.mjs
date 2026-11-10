// The pile: recording, promotion through the six piles with their gaps, demotion, due ordering, learned; the record it keeps for the Ledger.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const P = await import("../pile.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
P.clear();
P.record("punt", "words/WD-001", { prompt: "laconic" }, "wrong");
P.record("quote", "tr-01", { id: "tr-01" }, "wide");
check(P.counts().piles[0] === 2 && P.due().length === 2, "two items recorded land in the ultra-short pile, due at once");
check(P.due("punt").length === 1 && P.due("quote").length === 1, "due is per game");
let it = P.answer("punt", "words/WD-001", true);
check(it.pile === 1 && it.due > Date.now() && P.due("punt").length === 0, `right moves it to the short pile, due in ${Math.round((it.due - Date.now()) / 60000)} min`);
check(P.due("punt", Date.now() + 11 * 60000).length === 1, "and it's due eleven minutes later");
it = P.answer("punt", "words/WD-001", false);
check(it.pile === 0 && P.due("punt").length === 1, "wrong drops it back to the ultra-short pile, due now");
for (let i = 0; i < P.PILES.length - 1; i++) it = P.answer("punt", "words/WD-001", true);
check(it.pile === 5 && !it.learned && Math.round((it.due - Date.now()) / 86400000) === 91, "five rights in a row from the bottom: the longest pile, back in three months (a week, then a month, then a quarter)");
it = P.answer("punt", "words/WD-001", true);
check(!!it.learned && P.counts().learned === 1 && P.due("punt").length === 0, "right once more: learned");
// a chess puzzle skips the short-term piles: ultra-short, then a week, then three months, then learned
P.record("rush", "puzzle-1", { fen: "x" }, "wrong");
let ch = P.answer("rush", "puzzle-1", true);
const days = x => Math.round((x.due - Date.now()) / 86400000);
check(ch.pile === 3 && days(ch) === 7, `a chess puzzle right from the ultra-short pile: the week pile, back in ${days(ch)} days`);
ch = P.answer("rush", "puzzle-1", true);
check(ch.pile === 5 && days(ch) === 91, `right again: the three-month pile, back in ${days(ch)} days`);
ch = P.answer("rush", "puzzle-1", true);
check(!!ch.learned, "right once more: learned");
ch = P.answer("rush", "puzzle-1", false);
P.record("punt", "words/WD-001", {}, "wrong");
check(!P.all("punt")[0].learned && P.all("punt")[0].pile === 0, "a miss on a learned item brings it back to the first pile");
check(P.has("quote", "tr-01") && !P.has("quote", "nope"), "has() knows what's banked");
{ // the most revised first: the highest pile, then the longest overdue; the ultra-short pile last
  P.clear();
  for (const [key, ups] of [["new", 0], ["week", 3], ["quarter", 5], ["day", 2], ["week2", 3]]) {
    P.record("chart", key, {}, "miss");
    for (let i = 0; i < ups; i++) P.answer("chart", key, true);
  }
  const at = Date.now() + 200 * 86400000, all = P.all("chart");
  all.find(x => x.key === "week2").due -= 5000;                // overdue a little longer than its pile-mate
  const order = P.due("chart", at).map(it => it.key).join();
  check(order === "quarter,week2,week,day,new", `due order, the most revised first: ${order}`);
  P.clear();
}
// the learning modes: what each deals from the same piles
{
  P.clear();
  for (const [key, ups] of [["new", 0], ["week", 3], ["quarter", 5], ["day", 2], ["fresh", 0]]) {
    P.record("chart", key, {}, "miss");
    for (let i = 0; i < ups; i++) P.answer("chart", key, true);
  }
  const all = P.all("chart"), by = k => all.find(x => x.key === k);
  by("new").due -= 3000; by("fresh").due -= 1000;          // 'new' has waited longer than 'fresh'
  for (const k of ["week", "quarter", "day"]) by(k).due = Date.now() - 1000;   // all three are due too
  const names = list => list.map(it => it.key).join();
  check(P.mode() === "revision" && P.learning(), "the default mode is revision (what was 'on')");
  check(names(P.picks("chart")) === "quarter,week,day,new,fresh", `revision: longest-term first: ${names(P.picks("chart"))}`);
  P.setMode("learn");
  check(names(P.picks("chart")) === "new,fresh", `learn: the ultra-short and short piles only: ${names(P.picks("chart"))}`);
  P.record("chart", "short", {}, "miss"); P.answer("chart", "short", true);       // one step up: the short pile, ten minutes away
  check(names(P.picks("chart")) === "new,short,fresh", `learn mixes the two piles one for one: ${names(P.picks("chart"))}`);
  check(!names(P.picks("chart")).includes("day"), "learn deals nothing from the longer piles");
  P.forget("chart", "short");
  localStorage.setItem("pile:settings", JSON.stringify({ mode: "mixed" })); check(P.mode() === "revision", "a mode saved as Mixed (gone) reads as Revise");
  by("day").due = Date.now() + 86400000;
  P.setMode("learn"); check(P.picks("chart").some(it => it.key === "new" && it.due > 0), "learn deals what isn't due yet too");
  P.setMode("revision"); check(!P.picks("chart").some(it => it.key === "day"), "revision deals only what's due");
  P.setMode("norepeat");
  check(!P.learning() && P.picks("chart").length === 0 && P.weakElsewhere("quote").size === 0, "no repeats deals nothing from the piles");
  P.setMode("nonsense"); check(P.mode() === "norepeat", "an unknown mode is ignored");
  localStorage.setItem("pile:settings", JSON.stringify({ learning: false })); check(P.mode() === "norepeat", "the old switch off is no repeats");
  localStorage.setItem("pile:settings", JSON.stringify({ learning: true })); check(P.mode() === "revision", "the old switch on is revision");
  // what's been dealt lately, kept to the latest
  P.dealt("crossword", ["a", "b", "c"], 4); P.dealt("crossword", ["b", "d", "e"], 4);
  check([...P.recent("crossword")].join() === "c,b,d,e" && P.recent("nothing").size === 0, `dealt lately keeps the latest four, oldest dropped: ${[...P.recent("crossword")]}`);
  P.clear();
}
{ // each item keeps its last answers (HISTORY), small, and an item stored before it works as before
  P.clear();
  const d = P.historyOf({ h: [[20261101, 1]] }), last = () => P.all().find(x => x.key === "h");
  check(d.length === 1 && P.historyOf({}).length === 0 && P.historyOf(null).length === 0 && P.historyOf({ h: "junk" }).length === 0, "history reads from what's stored, and an item without one has none");
  P.record("punt", "h", {}, "wrong");
  check(JSON.stringify(last().h.map(x => x[1])) === "[2]" && /^\d{8}$/.test(String(last().h[0][0])), "the miss that put it in is noted, with its day (YYYYMMDD) and code 2");
  P.answer("punt", "h", true); P.answer("punt", "h", false); P.record("punt", "h", {}, "pass");
  check(JSON.stringify(last().h.map(x => x[1])) === "[2,1,0,0]", "right is 1, wrong when it came back is 0, a miss again in a game is 0");
  for (let i = 0; i < 12; i++) P.answer("punt", "h", i % 2 === 0);
  check(last().h.length === P.HISTORY && P.HISTORY === 8, `capped at the last ${P.HISTORY} answers`);
  check(JSON.stringify(last().h.map(x => x[1])) === "[1,0,1,0,1,0,1,0]", "and they are the newest ones, in order (the twelve answers ended wrong)");
  check(JSON.stringify(P.all()).length < 400, `small: an item with a full history is ${JSON.stringify(P.all()[0]).length} bytes`);
  // an item stored before history: answering starts one
  localStorage.setItem("pile:items", JSON.stringify({ "punt:old": { id: "punt:old", game: "punt", key: "old", added: 1, seen: 0, fails: 1, passes: 0, pile: 0, due: 1, last: { at: 1, why: "wrong" }, payload: {} } }));
  const fresh = await import("../pile.js?again");
  check(fresh.all()[0].h === undefined && fresh.answer("punt", "old", true).h.length === 1, "an item stored before history is read as before, and starts one with its next answer");
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;

// Knowledge travels: what one game found you weak on is dealt by the others, in their own form
{
  const P = await import("../pile.js");
  P.clear();
  P.record("punt", "art/AR-001", { prompt: "Who painted this?", about: ["mona-lisa"] }, "wrong");
  P.record("crates", "0:12", { word: "Geneva", about: ["geneva", "switzerland"] }, "wrong");
  const weak = P.weakElsewhere("quote");
  const quotePool = [{ key: "ar-p01", about: ["mona-lisa"] }, { key: "ct-01", about: [] }, { key: "rf-01" }];
  const dealt = P.dealDue("quote", quotePool, [], 5);
  const chartDealt = P.dealDue("chart", [{ key: "ci-11", about: ["geneva"] }, { key: "ci-01", about: ["tokyo"] }], [], 5);
  const puntOwn = P.weakElsewhere("punt");
  const ok = weak.has("mona-lisa") && weak.has("geneva") && dealt.join() === "ar-p01" && chartDealt.join() === "ci-11" && !puntOwn.has("mona-lisa") && puntOwn.has("geneva");
  console.log(`${ok ? "ok  " : "FAIL"} a painter missed in Punt brings the painting's year into Quote; a clue missed in Crates brings the city's pin into Chart; a game isn't dealt its own misses twice`);
  if (!ok) process.exitCode = 1;
  P.clear();
}

// a fact is one item of learning, whichever game asks it (Korbi, 10 Nov 2026)
{
  const F = "krone>clue>norway";
  P.clear(); P.setMode("revision");
  P.record("crates", "norway.krone", { word: "Krone", facts: [F] }, "wrong");
  P.record("punt", "art/AR-1", { prompt: "Who painted this?", facts: ["mona-lisa>painted-by>leonardo-da-vinci"] }, "wrong");
  const pool = [{ key: "countries/CT-9", facts: [F] }, { key: "countries/CT-10", facts: ["norway.area"] }];
  const dealt = P.dealDue("punt", pool, [], 5);
  const ok1 = dealt.includes("countries/CT-9") && !dealt.includes("countries/CT-10");
  console.log(`${ok1 ? "ok  " : "FAIL"} a clue missed in Crates brings Punt's question on the same fact into its block, not one on another fact`); if (!ok1) process.exitCode = 1;
  P.answer("punt", "countries/CT-9", true, [F]);
  const crates = P.all("crates")[0], ok2 = crates.pile === 1 && crates.due > Date.now() && crates.last.via === "punt";
  console.log(`${ok2 ? "ok  " : "FAIL"} right in Punt, where Punt has no item for it, moves Crates' item on that fact up a pile`); if (!ok2) process.exitCode = 1;
  P.record("lode", "norway|Krone", { word: "Krone", facts: [F] }, "miss");
  const ok3 = P.all("crates")[0].pile === 0 && P.due().length === 3 && P.oncePerFact(P.due()).length === 2;
  console.log(`${ok3 ? "ok  " : "FAIL"} missed again in Lode, Crates' item drops back with it; Deck asks the fact once (${P.oncePerFact(P.due()).length} of ${P.due().length})`); if (!ok3) process.exitCode = 1;
  P.clear(); P.record("punt", "art/AR-2", { prompt: "old" }, "wrong");
  P.adopt("punt", [{ key: "art/AR-2", facts: ["the-night-watch>painted-by>rembrandt"] }]);
  const ok4 = P.all("punt")[0].facts?.[0] === "the-night-watch>painted-by>rembrandt";
  console.log(`${ok4 ? "ok  " : "FAIL"} an item from before facts takes its question's facts when the game deals`); if (!ok4) process.exitCode = 1;
  P.clear();
}
{
  const F = "rotterdam>clue>netherlands";
  P.clear(); P.setMode("revision");
  P.record("crates", "nl.rotterdam", { facts: [F] }, "wrong");
  P.answer("punt", "countries/CT-1", true, [F]);
  P.answer("lode", "netherlands|Rotterdam", true, [F]);
  const it = P.all("crates")[0], ok = it.pile === 1;
  console.log(`${ok ? "ok  " : "FAIL"} right in two more games within the minute moves the fact one pile, not two: its gap still stands (pile ${it.pile})`); if (!ok) process.exitCode = 1;
  P.clear();
}
