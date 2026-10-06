// The Ledger's record (ledger-log.js): weeks, gaps, Kelly's implied chance, the weekly totals; and what the pile feeds
// it, including the once-only move of items learned under the old four piles into the month pile.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const L = await import("../ledger-log.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const D = 24 * 60 * 60 * 1000, at = s => Date.parse(`${s}T12:00:00Z`);

// ISO weeks, across year ends (the references are Python's isocalendar)
const weeks = { "2026-10-07": "2026-W41", "2026-01-01": "2026-W01", "2025-12-29": "2026-W01", "2024-12-30": "2025-W01", "2021-01-03": "2020-W53", "2020-12-31": "2020-W53", "2027-01-01": "2026-W53" };
check(Object.entries(weeks).every(([d, w]) => L.weekOf(at(d)) === w), "ISO weeks, the year ends included (2027-01-01 is 2026's week 53)");
check(L.gapOf(5 * 60e3) === "hour" && L.gapOf(20 * 3600e3) === "day" && L.gapOf(8 * D) === "week" && L.gapOf(31 * D) === "month" && L.gapOf(95 * D) === "quarter", "an item's time away sorts it: the hour, two days, a week or two, a month, three months");
check(Math.abs(L.kellyChance(.25, 3) - .5) < 1e-9 && L.kellyChance(1, 2) === 1 && Math.abs(L.kellyChance(0, 4) - .25) < 1e-9, "Kelly backwards: a quarter of the pot at 3.0 believes 50%; all-in believes certainty; nothing staked, the house's 1/odds");
check(L.stakeOf(5) === 5 && L.stakeOf(20) === 25 && L.stakeOf(100) === 100, "stakes sort into Punt's sizes");

// the weekly totals
L.reset();
L.noteRecall(10 * D, true); L.noteRecall(9 * D, false); L.noteRecall(40 * D, true);
L.noteStake(25, 3, true); L.noteStake(25, 3, false); L.noteStake(0, 3, true);
L.noteMarket("S", true); L.noteMarket("C", false);
const s = L.stats(), w = L.weekOf();
check(s.recall[w].week.join() === "1,2" && s.recall[w].month.join() === "1,1", "recall: right and asked, by how long the item was away");
check(s.stake[w][5][0] === 1 && s.stake[w][5][1] === 2 && Math.abs(s.stake[w][5][2] - .5) < 1e-9 && s.size[w][25].join() === "1,2", "Punt: two bets at a believed 50% (one won: Brier .25 each), a pass not counted");
check(s.market[w].n === 2 && s.market[w].inside === 1 && s.market[w].grades.S === 1 && s.market[w].grades.C === 1, "Quote: markets, how many held the truth, and their grades");
L.reset();
check(!Object.keys(L.stats().recall).length, "reset starts the record afresh");

// the pile feeds it, and moves what was learned under the week into the month pile once
localStorage.setItem("pile:items", JSON.stringify({ "punt:old": { id: "punt:old", game: "punt", key: "old", added: Date.now() - 50 * D, pile: 3, learned: Date.now() - 40 * D, due: null, last: { at: Date.now() - 40 * D, why: "right" } } }));
const P = await import("../pile.js?fresh");
const old = P.all("punt")[0];
check(old.pile === 4 && !old.learned && Math.abs(old.due - (Date.now() - 10 * D)) < 60e3 && P.due("punt").length === 1, "learned under the old piles: back in the month pile, due a month after it was learned (here, already)");
P.answer("punt", "old", true);
check(P.all("punt")[0].pile === 5 && L.stats().recall[w].month?.join() === "1,1", "answered right after 40 days: up to the longest pile, and the Ledger counts a month's recall");
P.record("quote", "q1", { id: "q1" }, "wrong");
check(!L.stats().recall[w].hour, "a first miss isn't a recall: nothing was there to remember");
P.record("quote", "q1", { id: "q1" }, "wrong");
check(L.stats().recall[w].hour?.join() === "0,1", "the same item missed again: a recall that failed, within the hour");
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
