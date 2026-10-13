// Cue: the words (one word of letters each, none in two kinds, enough of each kind), the deck (every word once a
// round, a step back and on again to the same word, a new round never starting with the word just seen, a deck kept on
// the device still read back when it fits the list, and not when the list has changed under it) and the countdown (a
// second to read, then 3, 2, 1, a second each).
import { KINDS } from "../cue-words.js";
import { deal, next, back, current, valid, wordsOf, shuffle } from "../cue-deck.js";
import { READ, COUNT, clockAt } from "../cue-clock.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// ---------- the words ----------
const all = KINDS.flatMap(k => k.words), twice = all.filter((w, i) => all.indexOf(w) !== i);
check(!twice.length, `no word in two kinds, nor twice in one (${all.length} words)${twice.length ? `: ${twice.join(", ")}` : ""}`);
const odd = all.filter(w => !/^[a-zé]+$/.test(w));
check(!odd.length, `every word one word of small letters${odd.length ? `: ${odd.join(", ")}` : ""}`);
check(all.length >= 500, `at least 500 words (${all.length})`);
const thin = KINDS.filter(k => k.words.length < 20);
check(!thin.length, `at least 20 words of each kind (the fewest: ${Math.min(...KINDS.map(k => k.words.length))})${thin.length ? `: ${thin.map(k => k.id).join(", ")}` : ""}`);
check(new Set(KINDS.map(k => k.id)).size === KINDS.length && KINDS.every(k => k.name && k.one), "every kind with an id of its own, a name and a word for one");
check(all.every(w => w.length <= 13), `no word longer than 13 letters, so it fits the card large (the longest: ${all.reduce((a, w) => (w.length > a.length ? w : a), "")})`);

// ---------- the deck ----------
const ids = KINDS.map(k => k.id), r = rng(7);
let d = deal(ids, r);
check(d.at === 0 && current(d) === null && d.order.length === all.length, "a fresh deck has every word and none up yet");
const seen = [];
for (let i = 0; i < d.order.length; i++) { d = next(d, r); seen.push(`${current(d).kind}:${current(d).word}`); }
check(new Set(seen).size === all.length, `a round deals every word once (${seen.length} taps, ${new Set(seen).size} words)`);
const last = d.order[d.at - 1];
d = next(d, r);
check(d.round === 2 && d.at === 1 && d.order[0] !== last, "then a new round, shuffled again, not starting with the word just seen");
d = next(next(d, r), r);
const up = d.order[d.at - 1];
d = next(back(d), r);
check(d.order[d.at - 1] === up, "back a step and on again: the same word");
check(back(deal(ids, r)).at === 0 && back(next(deal(ids, r), r)).at === 1, "no step back before the first word");
const few = deal(["feelings", "body"], r);
check(few.order.every(w => w.startsWith("feelings:") || w.startsWith("body:")) && few.order.length === wordsOf(["feelings", "body"]).length, "a deck of some kinds has their words and no others");
check(valid(d) && valid(JSON.parse(JSON.stringify(d))), "a deck kept on the device is read back");
check(!valid({ ...d, order: d.order.slice(1) }) && !valid({ ...d, order: [...d.order.slice(1), "animals:unicorn"] }) && !valid({ ...d, at: d.order.length + 1 }) && !valid(null), "a deck the list has changed under, or out of place, is dealt afresh");
// a shuffle that's fair enough: each word's place spread over the deck
const firsts = new Map(), N = 4000, words = ["a", "b", "c", "d"];
const s = rng(11);
for (let i = 0; i < N; i++) { const f = shuffle(words, s)[0]; firsts.set(f, (firsts.get(f) || 0) + 1); }
check([...firsts.values()].every(n => Math.abs(n - N / 4) < N * 0.05), `a shuffle puts each word first about as often (${[...firsts.values()].join(", ")} of ${N})`);

// ---------- the countdown ----------
check(READ === 1000 && COUNT === 3000, "a second to read, then three counted down");
check([0, 500, 999].every(ms => clockAt(ms).phase === "read" && clockAt(ms).n === null), "for the first second nothing is counted: the word alone, to read");
const shown = [1000, 1001, 1999, 2000, 2999, 3000, 3999].map(ms => clockAt(ms).n).join();
check(shown === "3,3,3,2,2,1,1" && clockAt(1000).left === 1, `then 3, 2 and 1, a second each, the arc full as the count starts (${shown})`);
check(clockAt(4000).phase === "over" && clockAt(4000).n === 0 && clockAt(4000).left === 0 && clockAt(60000).phase === "over", "nought at four seconds, and over it stays");
const lefts = [1000, 1500, 2000, 2500, 3000, 3500].map(ms => clockAt(ms).left);
check(lefts.every((l, i) => i === 0 || Math.abs(lefts[i - 1] - l - 500 / COUNT) < 1e-9) && clockAt(3999).left > 0, "the arc runs out evenly over the three seconds");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("cue: the words, the deck and the countdown");
