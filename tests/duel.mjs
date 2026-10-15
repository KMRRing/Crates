// A head-to-head on one deal (duel-core.js, the table under duel.js): everyone ready starts everyone together, a
// latecomer starts on a countdown of their own, a run's score goes in only while its match is on and stands once it's
// finished, the runs rank by score (or the lower, for a game scored so) and then by time, the match is over when every
// run that began is done and nobody at the table is still to play, the pair's record gets who won (a draw for nobody),
// and a rematch starts the table over with the one who asked ready. Every state goes through the database's own
// round trip (tests/rtdb.js), which drops what's empty and reads lists back with holes.
import { freshDuel, isDuel, seated, slotOf, runOf, presentSlots, allReady, sayReady, startAll, noteRun, rematch, byScore, standings, isOver, resultOf, COUNTDOWN, MOST } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const db = g => roundTrip(JSON.parse(JSON.stringify(g)));
const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
const here = (...uids) => Object.fromEntries(uids.map(u => [u, { game: "rush", online: true }]));

// a pair's table: Korbi deals, Sarah sits down
let g = db(freshDuel({ a: seat("Korbi", 0) }, { app: 1, match: { seed: 7, mode: "three" }, now: 1000 }));
check(isDuel(g) && g.n === 1 && g.people === 2 && g.match.seed === 7, "a new table holds its first match, for two");
check(freshDuel({}, { people: 9, match: {} }).people === MOST && freshDuel({}, { people: 1, match: {} }).people === 2, "a party's table seats two to six");
g.players.b = seat("Sarah", 1);
g = db(g);
check(seated(g).map(([id]) => id).join() === "a,b" && slotOf(g, "b") === 1, "seated in the order they sat down");
check(presentSlots(g, here("b"), "rush", "a").join() === "0,1" && presentSlots(g, { b: { game: "quote", online: true } }, "rush", "a").join() === "0",
  "at the table: this device, and whoever has this game open");

// Ready: one is not enough, both start together
let pres = [0, 1];
check(sayReady(g, 0, pres, 2000) && !g.start && runOf(g, 0).ready && !runOf(g, 0).begun, "Korbi is ready; nothing starts while Sarah isn't");
g = db(g);
check(!allReady(g, pres) && !sayReady(db(g), null, pres, 2000), "not everyone ready; a device with no seat changes nothing");
sayReady(g, 1, pres, 2500);
g = db(g);
check(g.start === 2500 + COUNTDOWN && runOf(g, 0).begun === g.start && runOf(g, 1).begun === g.start, "Sarah's Ready starts both, on one countdown");
check(!sayReady(g, 0, pres, 2600), "Ready again changes nothing once begun");

// scores as they go, and a finish that stands
const t0 = g.start;
check(noteRun(g, 0, 1, { score: 3, text: "3 solved" }, t0 + 30000) && runOf(g, 0).score === 3 && !runOf(g, 0).done, "a score goes in as it changes");
check(!noteRun(g, 0, 2, { score: 9 }, t0 + 31000) && runOf(g, 0).score === 3, "a score for another match doesn't");
check(noteRun(g, 0, 1, { begun: 1, ready: false, score: 4 }, t0 + 32000) && runOf(g, 0).begun === t0 && runOf(g, 0).ready === true && runOf(g, 0).score === 4,
  "a report can't move a run's start");
noteRun(g, 0, 1, { score: 11, text: "11 solved", done: true }, t0 + 180000);
g = db(g);
check(runOf(g, 0).done && runOf(g, 0).ms === 180000, "a finish keeps its time, from the run's own start");
check(!noteRun(g, 0, 1, { score: 30 }, t0 + 200000) && runOf(g, 0).score === 11, "a finished run stands (a reloaded phone can't change it)");
check(!isOver(g, pres) && resultOf(g, 0, pres) === null, "not over while Sarah plays");
noteRun(g, 1, 1, { score: 9, text: "9 solved", done: true }, t0 + 180000);
g = db(g);
check(isOver(g, pres), "over once both are done");
const ra = resultOf(g, 0, pres), rb = resultOf(g, 1, pres);
check(ra.won === true && rb.won === false && ra.match === rb.match && ra.score === 11 && rb.score === 9, "Korbi's 11 beats Sarah's 9, the same match on both sides");

// ranks: ties share, time breaks a tie of scores, a game scored lower
const runs = (...xs) => ({ ...freshDuel(Object.fromEntries(xs.map((_, i) => [`u${i}`, seat(`P${i}`, i)])), { people: xs.length, match: {} }), start: 1,
  runs: Object.fromEntries(xs.map((x, i) => [`s${i}`, { ready: true, begun: 1, done: true, ...x }])) });
let s = standings(db(runs({ score: 5, ms: 900 }, { score: 7, ms: 1000 }, { score: 5, ms: 900 })));
check(s.map(r => `${r.name}:${r.rank}`).join() === "P1:1,P0:2,P2:2", "the highest first; equal runs share a rank");
s = standings(db(runs({ score: 5, ms: 900 }, { score: 5, ms: 800 })));
check(s[0].name === "P1" && s[1].rank === 2, "the same score: the quicker first");
s = standings(db(runs({ score: 40, ms: 9 }, { score: 31, ms: 99 })), byScore(true));
check(s[0].name === "P1", "lower first, for a game scored lower");
const tie = db(runs({ score: 5, ms: 900 }, { score: 5, ms: 900 }));
check(resultOf(tie, 0, [0, 1]).won === false && resultOf(tie, 1, [0, 1]).won === false, "a draw is a win for neither");

// a party of three: one comes late, one never begins
let p = db(freshDuel({ a: seat("A", 0), b: seat("B", 1), c: seat("C", 2) }, { people: 3, match: { seed: 1 }, now: 0 }));
pres = [0, 1];                                                  // C hasn't come to the table
sayReady(p, 0, pres, 100); sayReady(p, 1, pres, 200);
p = db(p);
check(p.start === 200 + COUNTDOWN && !runOf(p, 2), "the two at the table start; the third, not here, isn't waited for");
sayReady(p, 2, [0, 1, 2], 60000);
p = db(p);
check(runOf(p, 2).begun === 60000 + COUNTDOWN && runOf(p, 0).begun === p.start, "a latecomer starts on a countdown of their own");
noteRun(p, 0, 1, { score: 4, done: true }, 90000); noteRun(p, 1, 1, { score: 6, done: true }, 90000);
check(!isOver(db(p), [0, 1, 2]), "not over while the latecomer plays");
noteRun(p, 2, 1, { score: 6, done: true, ms: 50000 }, 120000);
p = db(p);
check(isOver(p, [0, 1, 2]) && standings(p).map(r => r.name).join() === "C,B,A", "over when the latecomer finishes; their 6 in less time ranks first");

let q = db(freshDuel({ a: seat("A", 0), b: seat("B", 1), c: seat("C", 2) }, { people: 3, match: { seed: 2 }, now: 0 }));
sayReady(q, 0, [0, 1, 2], 10); startAll(q, 20);
noteRun(q, 0, 1, { score: 2, done: true }, 99); q = db(q);
check(runOf(q, 0).begun === 20 + COUNTDOWN && !runOf(q, 1)?.begun, "Start without waiting starts the ready alone");
check(!isOver(q, [0, 1, 2]), "one run is no match");
sayReady(q, 1, [0, 1, 2], 200); noteRun(q, 1, 1, { score: 3, done: true }, 400); q = db(q);
check(!isOver(q, [0, 1, 2]) && isOver(q, [0, 1]), "C at the table and yet to play holds it open; once C's gone, it's over");

// a rematch
rematch(g, 1, { seed: 8, mode: "five" });
g = db(g);
check(g.n === 2 && g.match.seed === 8 && !g.start && runOf(g, 1).ready && !runOf(g, 1).begun && !runOf(g, 0), "a rematch: match 2, the one who asked ready, everyone else to say so");
check(!noteRun(g, 0, 1, { score: 50, done: true }, 1e6) && !runOf(g, 0), "a late finish from match 1 doesn't land in match 2");

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
