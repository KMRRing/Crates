// Codeword (README, Codeword): the rules a page plays by (codeword-rules.js), the solvers (codeword-solve.js: the
// exact count of answers, and the human-style cracker that grades a puzzle and plays the computer rival), the puzzle
// maker (codeword-engine.js: every puzzle has exactly one answer, every letter, the level's skill), the mystery word
// (codeword-themes.js), the split key at a table through the database's round trip (codeword-room.js), saved state
// through JSON, and today's grid the same on every device.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALPHABET, SIZES, GIVENS, DAILY, HINT, CHECK, HALVES, holderOf, pack, unpack, entriesOf, layoutOf, mysteryNums, newRun,
  letterOf, isFixed, holding, place, erase, undo, filled, wrongOf, isFull, isSolved, rightOf, check as checkRun, show, score } from "../codeword-rules.js";
import { SKILLS, LEVELS, RIVALS, makePuzzle, gradeOf, splits, hintFor, rivalPlan, wideList, knownList } from "../codeword-engine.js";
import { wordList, count, solutions, crack, patternOf } from "../codeword-solve.js";
import { THEMES, themeOf } from "../codeword-themes.js";
import { BRANCH, freshTable, isTable, marker, puzzleOf, letterAt, holdingAt, isFixedAt, suggestionFor, filledAt, wrongAt, solvedAt, isMarked,
  asRun, tableScore, whyNot, writeIn, takeOut, takeBack, suggest, wave, checkAt, rightAt, hintAt, newGrid, resultOf } from "../codeword-room.js";
import { gridProblems } from "../gridfill.js";
import { isWord, tierOf } from "../wordlist.js";
import { today } from "../days.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NUMBERS = [...Array(26).keys()].map(i => i + 1);
const knownOf = p => Object.fromEntries(p.givens.map(n => [n, p.letters[n]]));
const turned = g => g.map((row, r) => [...g[g.length - 1 - r]].reverse().join(""));
const words = p => entriesOf(p.grid, p.num).map(e => e.nums.map(n => p.letters[n]).join(""));

// ---------- making puzzles: one answer, every letter, the level's skill ----------
// Math.random has no part in a deal (a link or today's grid must be the same grid everywhere): it throws while dealing.
const random = Math.random;
Math.random = () => { throw new Error("Math.random in a deal"); };
const made = [];
const t0 = performance.now();
const deal = (seed, o) => { const a = performance.now(), p = makePuzzle(seed, o); made.push({ seed, o, p, ms: performance.now() - a }); return p; };
for (const seed of [11, 12, 13, 14, 15]) deal(seed, { level: "medium" });
for (const level of ["easy", "hard", "expert"]) for (const seed of [21, 22]) deal(seed, { level });
deal(31, { level: "medium", size: "small" });
deal(32, { level: "medium", size: "large" });
Math.random = random;
const dealt = performance.now() - t0;
{
  const ps = made.map(m => m.p);
  check(ps.every(Boolean), `every deal makes a puzzle (${made.length} puzzles, ${Math.round(dealt / made.length)} ms each here)`);
  const ok = ps.filter(Boolean);
  check(ok.every(p => !gridProblems(p.grid).length && turned(p.grid).join() === p.grid.join()), "every grid is a good one, the same turned half round");
  check(made.every(m => !m.p || m.p.grid.length === SIZES[m.o.size || "medium"].n), "every grid has its size's side (11, 13, 15)");
  check(ok.every(p => [...p.letters.slice(1)].sort().join("") === ALPHABET), "the key is the alphabet: 26 numbers, 26 letters, no two the same");
  check(ok.every(p => NUMBERS.every(n => p.num.includes(n))), "every number, so every letter, is somewhere in the grid");
  check(ok.every(p => words(p).every(w => w.length >= 3 && isWord(w) && tierOf(w) <= 2)), "every entry is a common word of three letters or more");
  check(ok.every(p => new Set(words(p)).size === words(p).length), "no word is in a grid twice");
  check(made.every(m => !m.p || m.p.givens.length === GIVENS[m.o.level]), "each level gives its letters: Easy 4, Medium 3, Hard 2, Expert 1");
  const wide = wideList();
  const sols = ok.map(p => solutions(p, knownOf(p), wide));
  check(sols.every(s => s.count === 1), "every puzzle has exactly one answer from its givens, against every word the list has (both spellings, rare ones too)");
  check(sols.every((s, i) => s.first.slice(1).join("") === ok[i].letters.slice(1).join("")), "and that answer is the puzzle's key");
  const list = knownList();
  check(ok.every(p => crack(p, knownOf(p), list, SKILLS[p.grade]).done && (p.grade === 0 || !crack(p, knownOf(p), list, SKILLS[p.grade - 1]).done)),
    "a puzzle's grade is the lowest rung of skill that cracks it from its givens, without a guess");
  check(made.every(m => !m.p || (m.p.grade >= LEVELS[m.o.level].grade[0] - 1 && m.p.grade <= LEVELS[m.o.level].grade[1])), "every puzzle's grade is in its level's window");
  const mean = level => { const g = made.filter(m => m.p && m.o.level === level).map(m => m.p.grade); return g.reduce((a, b) => a + b, 0) / g.length; };
  check(mean("easy") < mean("medium") && mean("medium") < mean("hard") && mean("hard") < mean("expert"),
    `the levels get harder: grades ${["easy", "medium", "hard", "expert"].map(l => mean(l).toFixed(1)).join(", ")}`);
  const again = makePuzzle(13, { level: "medium" });
  check(JSON.stringify(pack(again)) === JSON.stringify(pack(made[2].p)), "the same seed and options deal the same puzzle");
  check(made[0].p.num.join() !== made[1].p.num.join(), "another seed deals another");
  check(ok.every(p => JSON.stringify(pack(p)).length < 1200), "a puzzle packed is small (under 1,200 characters)");
}

// ---------- today's grid: the same on every device ----------
{
  const day = today();
  const here = JSON.stringify(pack(makePuzzle(day, DAILY)));
  const there = execFileSync(process.execPath, ["--input-type=module", "-e",
    `import { makePuzzle } from "../codeword-engine.js"; import { pack } from "../codeword-rules.js"; import { DAILY } from "../codeword-rules.js";
     process.stdout.write(JSON.stringify(pack(makePuzzle(${day}, DAILY))));`], { cwd: fileURLToPath(new URL(".", import.meta.url)), encoding: "utf8" });
  check(here === there, "today's grid dealt by another process (another phone) is the same grid, letter for letter");
  check(DAILY.level === "medium" && DAILY.size === "medium" && !DAILY.mystery, "today's grid is Medium, 13 by 13, with no mystery word: the same choices for everyone");
}

// ---------- the solvers ----------
{
  const list = wordList({ upto: 7 });
  const cat = { grid: ["..."], num: [1, 2, 3], letters: ["", "c", "a", "t", ...ALPHABET.replace(/[cat]/g, "")] };
  check(count(cat, { 2: "a", 3: "t" }, list) === 2, "count stops at two: _AT has many answers");
  check(count(cat, { 1: "c", 2: "a", 3: "t" }, list) === 1, "and one when every letter is known");
  check(count({ grid: ["..."], num: [1, 1, 2], letters: cat.letters }, { 1: "q" }, list) === 0, "and none when no word fits (QQ_)");
  check(patternOf("letter") === "0.1.2.2.1.3", "a word's pattern is its letters in order of first appearance");
  const p = made[0].p, k = knownList();
  check(!crack(p, {}, k, SKILLS[SKILLS.length - 1]).done, "the human-style cracker needs a letter to start from: with none, nothing is given away");
  const r = crack(p, knownOf(p), k, SKILLS[p.grade]);
  check(r.steps.every(s => s.gives.every(([n, ch]) => p.letters[n] === ch)), "every step it takes is right (it only writes in what's left)");
  const entries = entriesOf(p.grid, p.num);
  check(r.steps.filter(s => s.kind === "word").every(s => entries[s.entry].nums.map(n => p.letters[n]).join("") === s.word), "a word step names the entry's word");
  check(r.steps.every(s => s.kind !== "word" || s.fits <= SKILLS[p.grade].sift), "and it never sifts more words than its skill allows");
  check(Object.keys(r.known).length === 26, "cracked, it knows all 26 letters");
}

// ---------- the rules of a run: writing in, moving, undo, check, hint, score ----------
{
  const p = made[1].p, run = newRun();
  const [g0] = p.givens, free = NUMBERS.filter(n => !p.givens.includes(n));
  const [a, b, c] = free;
  check(letterOf(p, run, g0) === p.letters[g0] && isFixed(p, run, g0) && !isFixed(p, run, a), "a given has its letter from the start, fixed");
  check(!place(p, run, g0, "q").ok && place(p, run, g0, "q").why === "fixed", "a given can't be written over");
  check(place(p, run, a, p.letters[b]).ok && holding(p, run, p.letters[b]) === a, "a letter written in goes in every cell of its number");
  const moved = place(p, run, c, p.letters[b]);
  check(moved.ok && moved.moved === a && !letterOf(p, run, a) && letterOf(p, run, c) === p.letters[b], "a letter on another number moves (two numbers are never one letter)");
  const taken = place(p, run, a, p.letters[g0]);
  check(!taken.ok && taken.why === "taken" && taken.on === g0, "a given's letter can't be put on another number");
  check(undo(p, run) === c && letterOf(p, run, a) === p.letters[b] && !letterOf(p, run, c), "undo puts a moved letter back where it was");
  check(erase(p, run, a) && !letterOf(p, run, a) && !erase(p, run, a), "a letter comes out; an empty number has none to take out");
  undo(p, run);
  check(letterOf(p, run, a) === p.letters[b], "and undo puts it back");
  check(checkRun(p, run).join() === String(a) && wrongOf(p, run).join() === String(a) && run.checks === 1, "a check marks the numbers written in wrong");
  place(p, run, a, p.letters[a]);
  check(!run.marks.length, "a marked number's mark goes when it changes");
  check(show(p, run, b) && isFixed(p, run, b) && run.hints === 1 && !run.log.length && !show(p, run, b), "a hint shows a letter for good (and can't be undone, nor given twice)");
  check(rightOf(p, run)[a] === p.letters[a] && rightOf(p, run)[b] === p.letters[b] && Object.keys(rightOf(p, run)).length === p.givens.length + 2, "what's right: the givens, the hints, the letters written in right");
  // saved and read back (localStorage), the run goes on as it was
  const kept = JSON.parse(JSON.stringify({ mode: "random", opts: { level: "medium", size: "medium", mystery: "" }, puzzle: pack(p), run, at: { k: 0, dir: "across" } }));
  const p2 = unpack(kept.puzzle), r2 = kept.run;
  check(p2 && p2.num.join() === p.num.join() && p2.letters.join() === p.letters.join() && p2.givens.join() === p.givens.join() && p2.grade === p.grade, "a puzzle packed comes back the same, through JSON");
  check(filled(p2, r2) === filled(p, run) && letterOf(p2, r2, b) === p.letters[b] && isFixed(p2, r2, b), "a run comes back as it was, hints and all");
  for (const n of free) place(p2, r2, n, p.letters[n]);
  check(isFull(p2, r2) && isSolved(p2, r2), "every number given its letter solves the grid");
  r2.ms = 245400;
  check(score(r2) === 245 + HINT + CHECK, "the score is the seconds on the clock, a hint's 30 and a check's 20");
  check(unpack(null) === null && unpack({ v: 1, rows: ["..."], nums: "AB", key: ALPHABET }) === null && unpack({ ...pack(p), key: "abc" }) === null,
    "a puzzle that isn't one isn't unpacked");
  const L = layoutOf(p);
  check(L.cellsOf.slice(1).every(cs => cs.length > 0) && p.num.every((n, k) => !n || L.across[k] >= 0 || L.down[k] >= 0), "every number has its cells, and every white cell is in a word");
}

// ---------- hints and the computer rival ----------
{
  const p = made[0].p, k0 = knownOf(p);
  const h = hintFor(p, k0);
  check(h && !p.givens.includes(h.n) && entriesOf(p.grid, p.num)[h.entry].nums.includes(h.n), "a hint is a letter not yet right, in the word it's found in");
  check(hintFor(p, Object.fromEntries(NUMBERS.map(n => [n, p.letters[n]]))) === null, "with everything right there's no hint");
  const ends = {};
  for (const kind of Object.keys(RIVALS)) {
    const plan = rivalPlan(p, kind, 7), gave = plan.flatMap(x => x.gives);
    ends[kind] = plan.at(-1).at;
    check(plan.every((x, i) => i === 0 || x.at > plan[i - 1].at) && gave.every(([n, ch]) => p.letters[n] === ch)
      && new Set(gave.map(([n]) => n)).size === gave.length && gave.length + p.givens.length === 26,
      `${RIVALS[kind].label}'s solve writes in every letter but the givens, once each, right, in time (${Math.round(ends[kind] / 1000)} s)`);
  }
  check(ends.ace < ends.sharp && ends.sharp < ends.steady, "the stronger the rival, the sooner it's done");
  check(ends.ace > 60000 && ends.ace < 6 * 60000 && ends.steady > 4 * 60000 && ends.steady < 25 * 60000, "and at a person's pace: Ace in a few minutes, Steady in ten or so");
  check(JSON.stringify(rivalPlan(p, "sharp", 7)) === JSON.stringify(rivalPlan(p, "sharp", 7)), "a rival's solve is the same from the same seed (it goes on after a reload)");
}

// ---------- the mystery word ----------
{
  for (const id of Object.keys(THEMES)) {
    const t = themeOf(id, "easy"), h = themeOf(id, "expert");
    check(t && t.pool.length >= 20 && t.pool.every(w => /^[a-z]{4,12}$/.test(w) && t.all.includes(w)) && h.pool.length >= t.pool.length,
      `${THEMES[id].label}: ${t.all.length} names to hide (${t.pool.length} well known on Easy and Medium)`);
  }
  check(themeOf("nonsense") === null, "a kind that isn't one gives nothing");
  const T = themeOf("countries", "medium"), p = makePuzzle(41, { level: "medium", mystery: T });
  const nums = p && mysteryNums(p);
  check(p && T.pool.includes(p.mystery.word) && nums.map(n => p.letters[n]).join("") === p.mystery.word, `a mystery word is one of its kind, spelt in the grid's numbers (${p?.mystery?.word})`);
  check(p && unpack(JSON.parse(JSON.stringify(pack(p)))).mystery.word === p.mystery.word, "and it's kept with the puzzle");
}

// ---------- the split key: parts make the whole, neither alone ----------
{
  check(HALVES[0].size === 13 && HALVES[1].size === 13 && NUMBERS.every(n => HALVES[holderOf(n)].has(n)), "the key splits in two: 1 to 13 and 14 to 26");
  const ps = [51, 52].map(seed => makePuzzle(seed, { level: "medium", split: true }));
  check(ps.every(Boolean), "split-key puzzles are made");
  const list = knownList();
  for (const p of ps.filter(Boolean)) {
    const share = p.num.filter(n => n >= 1 && n <= 13).length / p.num.filter(n => n).length, skill = SKILLS[Math.min(LEVELS.medium.grade[1] + 1, SKILLS.length - 1)];
    check(share >= 0.42 && share <= 0.58, `each player holds about half the cells (${Math.round(share * 100)}%)`);
    check(crack(p, knownOf(p), list, { ...skill, views: HALVES }).done, "the two together crack it, each writing in only their own numbers");
    check(!crack(p, knownOf(p), list, { ...skill, views: HALVES, alone: 0 }).done && !crack(p, knownOf(p), list, { ...skill, views: HALVES, alone: 1 }).done,
      "and neither cracks their half alone");
    check(splits(p, knownOf(p), list, skill) && count(p, knownOf(p), wideList()) === 1, "it still has exactly one answer");
  }

  // a match at the table, every write through the database's round trip (no nulls, no empty objects, lists with holes)
  const p = ps[0], packed = pack(p);
  let g = roundTrip(freshTable({ u0: { name: "Korbi", slot: 0 }, u1: { name: "Ana", slot: 1 } }, { app: 1, puzzle: packed, asked: 77, now: 1000 }));
  const act = fn => { const copy = structuredClone(g), ok = fn(copy); if (ok) g = roundTrip(copy); return ok; };
  check(isTable(g) && !isTable(marker("split", 77)) && marker("race", 77).mode === "race" && BRANCH === "codeword-split", "a table is told from a request's marker");
  const P = puzzleOf(g), mine0 = NUMBERS.filter(n => holderOf(n) === 0 && !p.givens.includes(n)), mine1 = NUMBERS.filter(n => holderOf(n) === 1 && !p.givens.includes(n));
  const [a, b, c] = mine0, [x, y] = mine1;
  check(P && P.letters.join() === p.letters.join(), "the table's puzzle unpacks to the one dealt");
  check(whyNot(g, 1, a, p.letters[a]) === "theirs" && !act(t => writeIn(t, 1, a, p.letters[a], 2000)), "a player can't write in the other's numbers");
  check(act(t => writeIn(t, 0, a, p.letters[b], 2000)) && letterAt(g, P, a) === p.letters[b] && holdingAt(g, P, p.letters[b]) === a, "a player writes in their own");
  check(act(t => writeIn(t, 1, x, p.letters[x], 2100)) && whyNot(g, 0, b, p.letters[x]) === "partner", "a letter on the other's number is theirs to move");
  check(act(t => suggest(t, 1, b, p.letters[b], 2200)) && suggestionFor(g, b)?.l === p.letters[b] && suggestionFor(g, b)?.by === 1, "the other suggests a letter for one of your numbers");
  check(act(t => writeIn(t, 0, b, p.letters[b], 2300)) && !suggestionFor(g, b) && !letterAt(g, P, a), "written in, the suggestion goes (and the letter moves off where it was)");
  check(act(t => takeBack(t, 0)) && letterAt(g, P, a) === p.letters[b] && !letterAt(g, P, b) && letterAt(g, P, x) === p.letters[x], "undo takes back your own last change, never the other's");
  check(act(t => suggest(t, 1, c, "q", 2400)) && act(t => wave(t, 0, c)) && !suggestionFor(g, c), "a suggestion can be waved away");
  check(act(t => checkAt(t)) && isMarked(g, a) && wrongAt(g, P).join() === String(a) && g.checks === 1, "a check marks what's wrong, for the team");
  check(act(t => takeOut(t, 0, a)) && !letterAt(g, P, a) && !isMarked(g, a), "a letter taken out loses its mark");
  check(act(t => hintAt(t, y, 2500)) && isFixedAt(g, P, y) && g.hints === 1 && !act(t => hintAt(t, y, 2500)), "a hint shows a letter for both, once");
  check(asRun(g).shown[y] === 1 && rightAt(g)[x] === p.letters[x], "the table reads as a run for the engine's hints");
  let t = 3000;
  for (const n of [...mine0, ...mine1]) if (letterAt(g, P, n) !== p.letters[n]) act(s => writeIn(s, holderOf(n), n, p.letters[n], t += 1000));
  check(solvedAt(g, P) && g.done === t && filledAt(g, P) === 26, "the last right letter ends the match, at that moment");
  check(tableScore(g) === Math.round((t - 1000) / 1000) + HINT + CHECK, "the team's score: the time from the deal, a hint's 30 and a check's 20");
  const r = resultOf(g);
  check(r && r.match === "split-1000" && r.score === tableScore(g) && r.coop && r.lower && r.won, "the match is recorded for the pair: together, lower better");
  check(!act(s => writeIn(s, 0, a, "q", t + 1)) && whyNot(g, 0, a, "q") === "done", "a finished grid takes no more letters");
  const next = pack(makePuzzle(53, { level: "medium", split: true }));
  check(act(s => newGrid(s, next, 90000)) && !g.put && !g.done && g.hints === 0 && g.created === 90000 && g.players.u1.name === "Ana", "a new grid at the same table: the pair stays, the letters go");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("codeword: one answer and every letter in every puzzle, levels graded by the human-style cracker, the rival and hints, the mystery word, the split key at a table, saved state, today's grid everywhere");
