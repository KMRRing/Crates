// Assay (README, Assay): the marks as Wordle gives them, repeated letters included; the hard and strict rules and
// what they say; the answers (everyday words, no forms of others, nothing crude) and what's accepted; the grades
// (kept ahead in assay-grades.js, and the same as worked out now) and the levels they make; the daily, the same for
// everyone and no word twice in years; every mode played through (one board, several, the word that dodges, the
// sprint); a game kept and read back; the computer players, each a way of solving, stronger level by level; the
// team's split colours (the parts make the whole, and neither part alone does), played at a table through the
// database's own round trip.
import { GREY, NEAR, HIT, LENGTHS, LEVELS, guessesFor, marksOf, codeOfMarks, marksOfCode, codeAt, packOf, fits, rulesBreak, rng, hashOf,
  gradeOf, gradesOf, levelOf, meanGuesses, RUNS, deal, dailyWord, dayNumber, DAILY, newGame, guessIn, rowsOf, solvedAt, answersOf,
  hide, unhide, dodgeStep, dodgeCands, timeUp, sprintSolved, scoreOf, lettersOf, refusal, roleOf, seenAs, UNSEEN, limitOf, allHit } from "../assay-engine.js";
import { ENGLISH, inflection } from "../assay-words.js";
import { GRADES } from "../assay-grades.js";
import { RIVALS, rivalPlan, rivalSoFar, rivalMarks, BEST_OPENER } from "../assay-solve.js";
import { freshTeam, isTeam, tidy, guessAt, rowsOfTable, roleAt, resultOf as teamResult, dealAt, wordOf } from "../assay-table.js";
import { DEFS } from "../slate-defs.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const t0 = Date.now();

// ---------- the marks ----------
check(same(marksOf("eerie", "crane"), [GREY, GREY, NEAR, GREY, HIT]), "eerie against crane: the E in place is green, the other two grey, R elsewhere");
check(same(marksOf("abide", "speed"), [GREY, GREY, GREY, NEAR, NEAR]), "abide against speed: D and E elsewhere");
check(same(marksOf("kebab", "abbey"), [GREY, NEAR, HIT, NEAR, NEAR]), "kebab against abbey: the B in place first, then the other B elsewhere");
check(same(marksOf("geese", "those"), [GREY, GREY, GREY, HIT, HIT]), "geese against those: one E, in place, so the other two are grey");
check(same(marksOf("lolly", "hello"), [GREY, NEAR, HIT, HIT, GREY]), "lolly against hello: two Ls in place leave none for the first; the O elsewhere");
check(marksOf("crane", "crane").every(m => m === HIT) && codeOfMarks(marksOf("crane", "crane")) === allHit(5), "the word itself is all green");
{
  const P = packOf(ENGLISH, 5), r = rng(7);
  let agree = true, round = true;
  for (let k = 0; k < 3000; k++) {
    const g = r() % P.N, a = r() % P.N, m = marksOf(P.words[g], P.words[a]);
    if (codeAt(P, g, a) !== codeOfMarks(m)) agree = false;
    if (!same(marksOfCode(codeOfMarks(m), 5), m)) round = false;
  }
  check(agree && round, "the solvers' quick marking agrees with the marks, 3,000 pairs; a code reads back as its marks");
}

// ---------- the rules ----------
{
  const rows = [{ guess: "crane", marks: marksOf("crane", "proud") }];   // R in place, the rest out
  check(rulesBreak("bloke", rows, "free") === null, "free: anything goes");
  check(rulesBreak("bloke", rows, "hard") === "The 2nd letter must be R" && rulesBreak("bored", rows, "hard") === "The 2nd letter must be R",
    "hard: a letter in place must stay there");
  check(rulesBreak("crimp", rows, "hard") === null, "hard: a letter shown out may be used again (Wordle's hard mode)");
  check(rulesBreak("crimp", rows, "strict") === "There's no C", "strict: a letter shown out stays out");
  const near = [{ guess: "stare", marks: marksOf("stare", "trout") }];  // T and R elsewhere
  check(rulesBreak("blond", near, "hard") === "Use the T", "hard: every letter shown in the word is used");
  check(rulesBreak("otter", near, "hard") === null && rulesBreak("otter", near, "strict") === "T can't be 2nd", "strict: a letter shown elsewhere moves");
  const two = [{ guess: "geese", marks: marksOf("geese", "eerie") }];
  check(/twice|E/.test(rulesBreak("abide", two, "hard") || "") && rulesBreak("abide", two, "hard") !== null, "hard: a letter shown twice is used twice");
  check(rulesBreak("proud", rows, "strict") === null && fits("proud", rows), "strict: the answer itself always passes");
}

// ---------- the words ----------
{
  const sizes = LENGTHS.map(n => ENGLISH.answers(n).length);
  check(sizes.every(s => s > 1000), `every length has over a thousand answers (${LENGTHS.map((n, i) => `${n}: ${sizes[i]}`).join(", ")})`);
  const all = LENGTHS.flatMap(n => ENGLISH.answers(n).map(x => x.w));
  check(all.every(w => ENGLISH.accepts(w) && /^[a-z]+$/.test(w)), "every answer is a word you can guess, a to z");
  check(all.every(w => !inflection(w)), "no answer is a regular form of another (a plural, a past, an -ing, a comparative)");
  check(ENGLISH.answers(5).every(x => x.tier <= 2), "answers are from the three commonest tiers");
  check(!all.includes("colour") && !all.includes("color") && ENGLISH.accepts("colour") && ENGLISH.accepts("color"), "a spelling only one side has is never the answer, but both are guesses");
  check(["books", "aimed", "boxes", "cried", "fries", "using", "nicer", "safest", "knives", "women"].every(w => !all.includes(w)), "books, aimed, boxes, cried, fries, using, nicer, safest, knives and women are out");
  check(["seed", "thing", "genus", "species", "alas", "forest", "water", "crane", "hatch"].every(w => all.includes(w)), "seed, thing, genus, species, alas, forest, water, crane and hatch are in");
  // Slate's dictionary marks every form of another word (=see.d): no four- or five-letter answer is only that
  const formOnly = w => DEFS[w] && DEFS[w].split("|").every(p => /^=[a-z]+\.[psdgct]$/.test(p));
  const forms = [4, 5].flatMap(n => ENGLISH.answers(n).map(x => x.w)).filter(formOnly);
  check(!forms.length, `no four- or five-letter answer is only a form of another in Slate's dictionary${forms.length ? `: ${forms.join(", ")}` : ""}`);
  const crude = ["cums", "crap", "sluts", "rapes", "faggots", "rapists", "condom", "retard", "midget", "slave", "lynch"].filter(w => all.includes(w));
  check(!crude.length, `nothing crude, and no slur's neighbour${crude.length ? `: ${crude.join(" ")}` : ""}`);
  check(ENGLISH.accepts("xylyl") === false && ENGLISH.accepts("qajaq") === false && ENGLISH.accepts("zebra") && ENGLISH.accepts("quixotic"), "a non-word is turned away; any real word is a guess");
}

// ---------- the grades and the levels ----------
{
  for (const n of LENGTHS) {
    const P = packOf(ENGLISH, n), kept = GRADES.en?.[n];
    check(kept && kept.n === P.N && kept.sum === hashOf(P.words.join(" ")), `${n} letters: the kept grades are for these answers${kept ? "" : " (none: run node assay-grades.mjs)"}`);
    const g = gradesOf(P), r = rng(n);
    let match = true;
    for (let k = 0; k < 12; k++) { const i = r() % P.N; if (gradeOf(P, i) !== g[i]) match = false; }
    check(match, `${n} letters: a grade worked out now is the one kept (twelve words); rerun node assay-grades.mjs if not`);
    const m = LEVELS.map(lv => meanGuesses(P, lv));
    check(m[0] < m[1] && m[1] < m[2], `${n} letters: Easy, Medium and Hard take the human-style player ${m.map(x => x.toFixed(2)).join(", ")} guesses`);
    check(levelOf(P, "easy").every(i => P.tier[i] <= 1) && LEVELS.every(lv => levelOf(P, lv).length >= 300), `${n} letters: Easy's words are the commonest; each level has 300 or more (${LEVELS.map(lv => levelOf(P, lv).length).join(", ")})`);
  }
  const P = packOf(ENGLISH, 5), hard = new Set(levelOf(P, "hard").map(i => P.words[i])), easy = new Set(levelOf(P, "easy").map(i => P.words[i]));
  check(["hatch", "latch", "mound", "joker", "shave"].every(w => hard.has(w)), "the genre's traps (hatch, latch, mound, joker, shave) are Hard");
  check(["raise", "earth", "heart", "court"].every(w => easy.has(w) && !hard.has(w)), "words that split the field cleanly (raise, earth, heart, court) are Easy");
}

// ---------- the daily ----------
{
  const days = Array.from({ length: 400 }, (_, k) => { const d = new Date(Date.UTC(2026, 9, 20 + k)); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); });
  const words = days.map(d => dailyWord(d));
  const P = packOf(ENGLISH, 5), medium = new Set(levelOf(P, "medium").map(i => P.words[i]));
  check(dayNumber(20261020) === 0 && dayNumber(20261021) === 1 && dayNumber(20270101) === 73, "days are counted from 20 October 2026");
  check(new Set(words).size === words.length, "no word twice in 400 days");
  check(words.every(w => medium.has(w)), "every daily is a five-letter Medium word");
  check(dailyWord(20261020) === words[0] && dailyWord(20261020) === dailyWord(20261020), `the same day, the same word (today's begins with ${words[0][0].toUpperCase()})`);
  const g = newGame({ ...DAILY, words: [dailyWord(20261020)], day: 20261020 });
  check(g.len === 5 && g.boards === 1 && limitOf(g) === 6 && answersOf(g)[0] === words[0], "the daily: five letters, one board, six guesses");
}

// ---------- playing ----------
{
  check(guessesFor(5) === 6 && guessesFor(4) === 7 && guessesFor(7) === 6 && guessesFor(5, 2) === 7 && guessesFor(5, 4) === 9 && guessesFor(5, 8) === 13,
    "six guesses for five letters, seven for four; Dordle's 7, Quordle's 9 and Octordle's 13 for several boards");
  const g = newGame({ len: 5, words: ["crane"], rules: "hard" });
  check(guessIn(g, "zzzzz").ok === false && guessIn(g, "zzzzz").why === "Not in the word list" && guessIn(g, "cran").why === "5 letters", "a non-word, or the wrong length, is turned away and costs nothing");
  check(guessIn(g, "trace").ok && g.guesses.length === 1 && !g.over, "a word is played");
  check(guessIn(g, "pious").why === "The 2nd letter must be R" && guessIn(g, "brick").why === "The 3rd letter must be A", "hard mode holds the R and the A in place");
  check(guessIn(g, "brace").ok && guessIn(g, "crane").over === "won" && solvedAt(g, 0) === 2, "solved on the third guess");
  check(guessIn(g, "slate").ok === false, "nothing more once it's over");
  const lost = newGame({ len: 5, words: ["hatch"] });
  for (const w of ["latch", "match", "patch", "watch", "catch", "batch"]) guessIn(lost, w);
  check(lost.over === "lost" && scoreOf(lost) === 7, "six wrong guesses lose it; a loss scores past the limit");
  // several boards: every board marked by the same guesses, each finished by its own word
  const four = newGame({ mode: "boards", boards: 4, len: 5, words: ["crane", "slate", "pious", "lemon"] });
  for (const w of ["crane", "slate", "pious"]) guessIn(four, w);
  check(solvedAt(four, 0) === 0 && solvedAt(four, 1) === 1 && solvedAt(four, 2) === 2 && solvedAt(four, 3) === -1 && !four.over, "four boards: three solved by their words, the fourth still open");
  check(rowsOf(four, 0).length === 1 && rowsOf(four, 3).length === 3, "a solved board stops at its word; the others carry every guess");
  guessIn(four, "lemon");
  check(four.over === "won" && scoreOf(four) === 4 && four.rules === "free", "solved with the fourth guess; several boards always play free");
  const keys = lettersOf(newGame({ words: ["crane"] }), 0);
  check(same(keys, {}), "no letters shown before a guess");
  const kk = newGame({ words: ["crane"] }); guessIn(kk, "react");
  check(same(lettersOf(kk, 0), { r: NEAR, e: NEAR, a: HIT, c: NEAR, t: GREY }), "the keyboard keeps the best each letter has shown");
}
{
  // the word that dodges: it keeps the largest group, and only one word left can be beaten
  const P = packOf(ENGLISH, 5), cands = levelOf(P, "medium");
  const step = dodgeStep(P, cands, "slate");
  const groups = new Map(); for (const i of cands) { const c = codeOfMarks(marksOf("slate", P.words[i])); groups.set(c, (groups.get(c) || 0) + 1); }
  check(step.cands.length === Math.max(...groups.values()) && step.cands.every(i => fits(P.words[i], [{ guess: "slate", marks: step.marks }])), "the dodging word keeps the largest group of words, every one fitting its marks");
  const g = newGame({ mode: "dodge", len: 5, level: "medium" });
  let n = 0;
  while (!g.over && n < 15) {
    const left = dodgeCands(g);
    const w = left.length === 1 ? P.words[left[0]] : P.words[left.reduce((b, c) => b, left[0])];
    guessIn(g, n === 0 ? "slate" : w);
    n++;
  }
  check(g.over === "won" && g.left === 1 && answersOf(g)[0] === g.guesses.at(-1), `beaten by leaving it one word and guessing that (${g.guesses.length} guesses)`);
  check(same(dodgeCands(roundTrip(JSON.parse(JSON.stringify(g))), ENGLISH).length, 1), "its words in play are replayed from the guesses alone");
}
{
  // the sprint: a word solved or its guesses spent moves on to the next; the clock ends it
  const s = newGame({ mode: "sprint", len: 5, level: "easy", seed: 5 });
  const [w0, w1] = answersOf(s);
  guessIn(s, w0);
  check(s.at === 1 && sprintSolved(s) === 1 && s.guesses.length === 0, "a word solved moves the sprint to the next");
  for (let k = 0; k < 6; k++) guessIn(s, w0 === "crane" ? "slate" : "crane");
  check(s.at === 2 && sprintSolved(s) === 1 && s.past[1].won === false && rowsOf(s, 0).length === 0, "six misses move on too, unsolved");
  check(answersOf(s)[1] === w1 && answersOf(s).length === 60, "sixty words dealt, more than anyone solves in three minutes");
  timeUp(s);
  check(s.over === "time" && scoreOf(s) === 999, "the clock ends it: one word solved");
}
{
  // a game kept as JSON and read back plays on the same
  const g = newGame({ mode: "boards", boards: 2, len: 6, level: "hard", seed: 99 });
  guessIn(g, "satire");
  const back = JSON.parse(JSON.stringify(g));
  check(same(rowsOf(back, 0), rowsOf(g, 0)) && same(rowsOf(back, 1), rowsOf(g, 1)) && !JSON.stringify(g).includes(answersOf(g)[0]), "a game read back from storage is the same game, and its answers aren't there to read");
  check(unhide(hide("quixotic")) === "quixotic" && hide("crane") !== "crane", "hidden words come back");
  const a = deal({ len: 5, level: "medium", seed: 3, count: 5 }), b = deal({ len: 5, level: "medium", seed: 3, count: 5 });
  check(same(a, b) && new Set(a).size === 5, "a seed deals the same different words everywhere");
  const avoid = deal({ len: 5, level: "easy", seed: 4, count: 600 });
  check(!avoid.includes(deal({ len: 5, level: "easy", seed: 11, avoid })[0]), "words seen lately are left for later");
}

// ---------- the computer players ----------
{
  const P = packOf(ENGLISH, 5), r = rng(1);
  for (const [n, w] of Object.entries(BEST_OPENER)) {
    const Q = packOf(ENGLISH, Number(n)), i = Q.at.get(w);
    const bits = j => { const m = new Map(); for (let a = 0; a < Q.N; a++) { const c = codeAt(Q, j, a); m.set(c, (m.get(c) || 0) + 1); } let s = 0; for (const c of m.values()) s += c * Math.log2(c); return Math.log2(Q.N) - s / Q.N; };
    const mine = bits(i), rr = rng(Number(n)), others = Array.from({ length: 30 }, () => bits(rr() % Q.N));
    check(i != null && others.every(b => b <= mine + .1), `${n} letters: Master and Sharp open with ${w.toUpperCase()}, an answer that tells as much as any of 30 others (${mine.toFixed(2)} bits)`);
  }
  const mean = {};
  for (const lv of RIVALS) {
    let sum = 0, won = 0;
    for (let s = 1; s <= 24; s++) { const p = rivalPlan(newGame({ len: 5, level: "medium", seed: s * 31 }), lv); sum += p.rows.length; won += p.won ? 1 : 0; }
    mean[lv] = { guesses: sum / 24, won };
  }
  check(mean.novice.guesses > mean.steady.guesses && mean.steady.guesses > mean.sharp.guesses && mean.master.guesses <= mean.sharp.guesses + .15,
    `stronger level by level: ${RIVALS.map(lv => `${lv} ${mean[lv].guesses.toFixed(2)}`).join(", ")} guesses on 24 words`);
  check(mean.steady.won === 24 && mean.sharp.won === 24 && mean.master.won === 24, "Steady, Sharp and Master solve every one of them");
  const g = newGame({ len: 5, level: "medium", seed: 77 }), p1 = rivalPlan(g, "sharp"), p2 = rivalPlan(JSON.parse(JSON.stringify(g)), "sharp");
  check(same(p1, p2) && p1.rows.every(row => ENGLISH.accepts(row.guess)), "a rival's game is the same each time it's worked out; every guess is a word");
  check(p1.rows.every((row, k) => k === 0 || row.at > p1.rows[k - 1].at) && p1.rows[0].at >= 2000 && p1.done === p1.rows.at(-1).at, "its guesses come one at a time, a person's thinking apart");
  check(rivalSoFar(p1, 0).length === 0 && rivalSoFar(p1, p1.done).length === p1.rows.length, "what it has done by a moment of play");
  const last = p1.rows.at(-1);
  check(rivalMarks(g, last).every(m => m === HIT), "its last guess, on a won game, is the word");
  const b = rivalPlan(newGame({ mode: "boards", boards: 4, len: 5, seed: 8 }), "master");
  check(b.won && b.rows.length <= guessesFor(5, 4), `on four boards Master solves them all (${b.rows.length} guesses)`);
  const d = rivalPlan(newGame({ mode: "dodge", len: 5, level: "medium", seed: 3 }), "master");
  check(d.won && d.rows.every(row => row.marks), `against the dodging word Master gets there (${d.rows.length} guesses)`);
  const sp = rivalPlan(newGame({ mode: "sprint", len: 5, level: "medium", seed: 3 }), "steady");
  check(sp.solved >= 2 && sp.done <= 180000 && sp.rows.every(row => row.at <= 180000), `in a sprint Steady solves ${sp.solved} words in three minutes`);
}

// ---------- together: the colours split ----------
{
  check(roleOf(0, 2) === HIT && roleOf(1, 2) === NEAR && roleOf(0, 2, 1) === NEAR, "a pair: one sees what's in place, the other what's elsewhere, swapping each word");
  check(roleOf(0, 3) === HIT && roleOf(1, 3) === NEAR && roleOf(2, 3) === GREY && roleOf(3, 4) === HIT, "three or more: the third sees what's out, and round again");
  // after the same three guesses, what each could still believe the word to be from their part alone, against both
  // parts together (a solver given one part alone needs about seven guesses where the pair needs four, and fails six
  // guesses about half the time: measured while building, too slow to run here)
  const P = packOf(ENGLISH, 5), r = rng(42), games = 80;
  let whole = true, pairKnows = 0, onlyPair = 0, pair = 0, greens = 0, yellows = 0;
  for (let k = 0; k < games; k++) {
    const ans = P.words[r() % P.N], rows = ["slate", "crony", P.words[r() % P.N]].map(guess => ({ guess, marks: marksOf(guess, ans) }));
    for (const { marks } of rows) {
      const a = seenAs(marks, HIT), b = seenAs(marks, NEAR);
      // greys go to nobody: a letter is out when neither of you sees it lit
      if (!marks.every((m, i) => m === (a[i] !== UNSEEN ? a[i] : b[i] !== UNSEEN ? b[i] : GREY))) whole = false;
    }
    const fitsPart = (w, role) => rows.every(({ guess, marks }) => seenAs(marksOf(guess, w), role).every((m, i) => m === seenAs(marks, role)[i]));
    const both = P.words.filter(w => fits(w, rows)).length, one = P.words.filter(w => fitsPart(w, HIT)).length, two = P.words.filter(w => fitsPart(w, NEAR)).length;
    pair += both; greens += one; yellows += two;
    if (both === 1) { pairKnows++; if (one > 1 && two > 1) onlyPair++; }
  }
  check(whole, "the two parts make the whole: in place, elsewhere, and out where neither is lit");
  check(greens > 4 * pair && yellows > 4 * pair, `after three guesses the pair has ${(pair / games).toFixed(1)} words left; the greens alone leave ${(greens / games).toFixed(1)}, the yellows alone ${(yellows / games).toFixed(1)}`);
  check(onlyPair >= .6 * pairKnows, `of the ${pairKnows} games the pair could name the word, neither of you alone could in ${onlyPair}`);
}
{
  // a table through the database's own round trip: turns, the word, the result
  const db = t => roundTrip(JSON.parse(JSON.stringify(t)));
  let t = db(freshTeam({ a: { name: "Korbi", slot: 0, pid: "pa", online: true } }, { app: 1, len: 5, seed: 7, now: 1000 }));
  t.players.b = { name: "Sarah", slot: 1, pid: "pb", online: true };
  t = tidy(db(t));
  check(isTeam(t) && t.n === 1 && t.guesses.length === 0 && t.turn === 0, "a new table: the first word, no guesses (the database keeps no empty list), Korbi's turn");
  check(roleAt(t, 0) === HIT && roleAt(t, 1) === NEAR, "Korbi sees what's in place, Sarah what's elsewhere");
  check(guessAt(t, { n: 1, k: 0, slot: 1, w: "slate" }) === "turn" && guessAt(t, { n: 1, k: 0, slot: 1, w: "slate", anyone: true }) === "ok", "Sarah waits for her turn, unless Korbi is away");
  t = tidy(db(t));
  check(t.turn === 0 && guessAt(t, { n: 1, k: 0, slot: 0, w: "crane" }) === "moved", "a guess made on a board the table has moved on from does nothing");
  const word = wordOf(t);
  check(guessAt(t, { n: 1, k: 1, slot: 0, w: word }) === "ok" && t.over === "won", "Korbi guesses it");
  t = tidy(db(t));
  const res = teamResult(t);
  check(res.coop && res.won && res.score === 2 && res.lower && res.match === "1000-1", "the pair's record: a team result, two guesses");
  check(rowsOfTable(t).length === 2 && rowsOfTable(t)[1].marks.every(m => m === HIT) && rowsOfTable(t)[0].by === 1, "the rows carry who guessed");
  dealAt(t, { seed: 9 });
  t = tidy(db(t));
  check(t.n === 2 && t.turn === 1 && t.guesses.length === 0 && !t.over && roleAt(t, 0) === NEAR, "the next word: Sarah starts, and the colours swap");
  for (let k = 0; k < 6; k++) guessAt(t, { n: 2, k, slot: t.turn, w: wordOf(t) === "zebra" ? "crane" : "zebra" });
  check(t.over === "lost" && teamResult(t).score === 7 && !teamResult(t).won, "six misses and the table loses it");
}

console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (bad) { console.log(`${bad} FAILED`); process.exitCode = 1; }
else console.log("assay: all ok");
