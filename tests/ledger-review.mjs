// The Ledger's review (ledger-review.js) on a synthetic profile (tests/ledger-fake.js): the headline's two weeks, the subjects
// strongest and weakest, the revision's health, the games by section, the judgement's read, the three next steps, the
// empty state, and the speed on a fully populated profile.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const { review, span } = await import("../ledger-review.js");
const L = await import("../ledger-log.js");
const { fakeProfile, NOW } = await import("./ledger-fake.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const eq = (a, b, what) => { const ok = JSON.stringify(a) === JSON.stringify(b); check(ok, ok ? what : `${what}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); };

const r = review(fakeProfile());
check(!r.empty, "a played profile is not empty");

// the headline: the last whole ISO week (2026-W44) against the one before (W43)
eq([r.headline.week, r.headline.before], ["2026-W44", "2026-W43"], "the weeks compared: the last whole one and the one before");
eq([r.headline.last.learned, r.headline.prev.learned], [3, 2], "learned: 3 items in W44, 2 in W43");
eq([r.headline.last.recall, r.headline.prev.recall], [77, 50], "recall after a week: 10 of 13 against 6 of 12");
eq([r.headline.last.played, r.headline.prev.played], [7, 3], "games played: a daily, a save or a pile answer in the week, each game once");
eq([r.headline.last.dailies, r.headline.prev.dailies], [6, 2], "dailies kept: Yacht's five days and Slate's, against Yacht's two");

// knowledge by topic
const names = l => l.map(s => s.label);
eq(names(r.topics.strong), ["Painters", "Countries", "Paintings"], "the three strongest subjects");
eq(names(r.topics.weak), ["Law", "Museums", "Commodities"], "the three weakest, the weakest first");
eq(names(r.topics.rest), ["People"], "the rest are folded (People has only two items, too few to rank)");
const law = r.topics.weak[0], countries = r.topics.strong[1];
check(law.held === 5 && law.learned === 0 && law.rate === 0 && law.tries === 10 && law.misses30 === 5, "Law: 5 held, none learned, nothing recalled, 5 missed in 30 days");
check(countries.held === 4 && countries.learned === 6 && countries.rate === 1 && countries.total === 10, "Countries: 4 held, 6 learned, every recall right");
check(r.topics.aboutNothing === 1, "an item about nothing in the base (a word) is counted apart");
const base = fakeProfile(), two = review({ ...base, items: base.items.filter(i => ["Painters", "Law"].some(l => i.key.startsWith(l))) });
eq([names(two.topics.strong), names(two.topics.weak)], [["Painters"], ["Law"]], "two subjects: one strongest, one weakest");
check(review({ ...base, subjectOf: null }).topics.subjects === 0, "without the knowledge base's index no subject is read (the page waits for it)");

// revision health
const h = r.health;
check(h.due === 14 && h.overdue.hours === 3 && h.overdue.days === 5 && h.overdue.weeks === 6, "due now: 14 (3 by hours, 5 by days, 6 by a week or more)");
check(h.oldest === 10 * 24 * 3600e3 && span(h.oldest) === "10 days", "the oldest is 10 days late");
check(h.learnedWeek === 2, "learned in the last 7 days: 2 (7 days exactly is out)");
eq(h.piles, [5, 10, 6, 4, 0, 0], "six piles: Law 5; Museums 3, Commodities 4, People 2 and the word 1; Paintings 6; Countries 4 held");
check(h.learned === 10, "learned: 4 painters and 6 countries");
check(h.streak === 4 && h.reviewedToday, "a streak of 4 days with a review, today included (day 4 is missing)");
eq(h.dots.slice(-5), [false, true, true, true, true], "the dots mark the days, today last");

// across the games
const sec = Object.fromEntries(r.sections.map(s => [s.id, s]));
check(!sec.appendix && sec.knowledge.started === 3 && sec.courses.started === 2 && sec.party.started === 0, "sections: the appendix is left out; Knowledge has 3 started, Party none");
const g = id => r.games.find(x => x.id === id);
check(g("punt").best === 12 && g("sudoku").best === 200 && g("chart").best === 5, "bests: a ranked game's, the highest of bests by level, a plain number");
check(g("punt").bestAt === NOW && g("sudoku").bestAt === NOW - 9 * 86400e3, "when a best was set is the key's last write (suite:meta)");
check(g("maths").left === 7 && g("music").left === 0 && g("maths").lessons.of === 12, "courses: Maths has 7 lessons left, Music none");
check(g("yacht").kept === 10 && g("yacht").dots[13] && !g("yacht").dots[10] && g("yacht").dots[9], "Yacht's daily: 10 of the last 14 days, as dots");
check(!g("punt").dots.slice(0, 13).some(Boolean) && g("punt").dots[13], "a ranked game keeps only the latest day: one dot");
eq(r.games.filter(x => x.stalled).map(x => x.id).sort(), ["chart", "heliograph", "mines"], "started and stalled: no sign for 14 days or more");
check(!g("rack").started && !g("whispers").stalled && !g("bigtwo").stalled, "a game never started is not stalled; a settings key is no sign of play");
check(g("glyph").started && g("glyph").days.size === 1, "Slate's tile (glyph) reads slate: keys");
check(sec.knowledge.recent === 2 && sec.cards.kept === 10, "a section's played lately and dailies kept: Punt and Quote lately; Yacht's ten");

// judgement
const j = r.judgement;
check(j.commits === 10 && Math.abs(j.wonShare - .7) < 1e-9 && Math.abs(j.believed - (.55 * 5 + .85 * 5) / 10) < 1e-9, "Punt: 10 commitments, 70% right against what they acted on");
check(j.markets.n === 4 && j.markets.inside === 3, "Quote: 3 of 4 markets held the truth");
eq(j.reads, [{ label: "Law", kind: "over", n: 5 }], "the plain read: more committed than known on Law (all five Punt items there were committed misses)");

// next steps
eq(r.next.map(n => n.kind), ["review", "course", "daily"], "three next steps: review, a course, a daily");
eq(r.next.map(n => n.href), ["deck.html#topic=Law", "./maths.html", "./quote.html#today"], "each a link: the weakest subject, the course with lessons left, a daily not done today (the most kept lately)");
check(/Law/.test(r.next[0].text) && /7 lessons left/.test(r.next[1].why) && /1 of the last 14/.test(r.next[2].why), "and each says why");

// the empty state: a new player with a settings key only
const e = review({ snap: { "punt:settings": "{}" }, apps: base.apps, sections: base.sections, marks: {}, items: [], stats: {}, subjectOf: null, now: NOW });
check(e.empty && e.next.length === 0 && e.topics.subjects === 0 && e.health.streak === 0, "a new player: empty, no suggestions, no streak");

// the record gains the days with a review (the streak's source)
L.reset(); L.noteRecall(86400e3, true); L.noteRecall(86400e3, false);
eq(L.stats().days[new Date().toISOString().slice(0, 10).replace(/-/g, "")], [1, 2], "the Ledger's record notes the day: 1 right of 2 items back");

// speed: a profile fully populated, and one the size of the games screen
const big = fakeProfile({ scale: 6 });
check(big.apps.length > 700 && big.items.length >= 150, `a big profile: ${big.apps.length} games, ${big.items.length} items, ${Object.keys(big.snap).length} keys`);
const best = (p, n) => { let m = Infinity; for (let i = 0; i < n; i++) { const t = performance.now(); review(p); m = Math.min(m, performance.now() - t); } return m; };   // the quickest of several: a busy machine slows a run, not the work
const ms = best(big, 7);
check(ms < 250, `a review of it takes ${ms.toFixed(1)} ms (under 250)`);
const real = fakeProfile({ scale: 2 }), ms2 = best(real, 7);
check(ms2 < 50, `a review at the size of the games screen (${real.apps.length} games) takes ${ms2.toFixed(1)} ms (under 50)`);
// Ledger speaks as Punt does (tests/no-gambling.mjs): what a player reads, in the page and its script, has none of the betting words
import fs from "fs";
const BANNED = /\b(bets?|betting|stakes?|staked|pots?|all[- ]in|bust|chips?|odds|wagers?|gambl\w*|casino|punters?|pays?|passe[sd]?|pass)\b/i;
const words = [];
for (const f of ["ledger.js", "ledger-review.js", "ledger.html"]) {
  const t = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'`\w\\])\/\/.*$/gm, "$1");
  const lits = f.endsWith(".html") ? [...t.matchAll(/>([^<>]+)</g)].map(m => m[1]) : [...t.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(m => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, " "));
  for (const x of lits) if (BANNED.test(x) && x !== "pass") words.push(`${f}: ${x.slice(0, 80)}`);
}
check(!words.length, `Ledger's words are the merchant's (venture, commit, purse, hold)${words.length ? `: ${words.join(" | ")}` : ""}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
