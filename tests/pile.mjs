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
P.setLearning(false); check(P.learning() === false, "learning mode can be switched off"); P.setLearning(true);
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
