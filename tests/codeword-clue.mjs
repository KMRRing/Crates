// Codeword's clues (codeword-clues.js, codeword-rules.js, codeword-room.js): a grid opens on a question from Punt's
// machinery whose answer is one easy word, and that word's letters are the givens. Checked here, quickly (the whole
// puzzle maker is tests/codeword.mjs, which is slow): what a pool is made of and how Settings' topics and the marked
// content choice shape it, that it is the same for the same seed, that one answer fits the grid and is a plain word,
// and the rules of the question (a wrong pick, a skip, the givens that stay hidden until it is answered), solo and at a
// table.
import fs from "node:fs";
import { ALPHABET, MISS, HINT, newRun, clueOpen, answerClue, skipClue, letterOf, isFixed, place, score, pack, unpack, mysteryNums } from "../codeword-rules.js";
import { freshTable, puzzleOf, clueOpenAt, answerAt, skipAt, whyNot, letterAt, tableScore } from "../codeword-room.js";
import { makePuzzle } from "../codeword-engine.js";
import { SUBJECTS, subjectsIn } from "../topics.js";
import { roundTrip } from "./rtdb.js";

globalThis.window = {};
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const C = await import("../codeword-clues.js");

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const on = ids => Object.fromEntries(SUBJECTS.map(s => [s.id, ids.includes(s.id) ? 1 : 0]));

// ---------- which sources the topics leave on ----------
check(C.sourcesFromSubjects(on(SUBJECTS.map(s => s.id))) === C.ALL_SOURCES, "every subject on deals every source");
check(C.sourcesFromSubjects(on(["geo"])) === "cf", "Geography on: countries and flags");
check(C.sourcesFromSubjects(on(["cities"])) === "t" && C.sourcesFromSubjects(on(["trade"])) === "m", "Cities on: capitals; Trade on: commodities");
check(C.sourcesFromSubjects(on(["sci", "math"])) === C.ALL_SOURCES && C.sourcesFromSubjects(on([])) === C.ALL_SOURCES,
  "topics that leave none of the sources on (STEM, or none) deal them all, never an empty hint, as Settings says a mix too narrow does");
check(subjectsIn(on(["geo"])).length === 1 && C.cleanSources("zz") === C.ALL_SOURCES && C.cleanSources("tc") === "ct", "a link's letters are made whole");

// ---------- the pool ----------
const all = await C.cluePool(5, {});
check(all.length >= 30, `every source together gives ${all.length} candidates`);
check(all.every(c => /^[a-z]{4,11}$/.test(c.word) && new Set(all.map(x => x.word)).size === all.length), "each answer is one plain word of 4 to 11 letters, once");
check(all.every(c => c.clue.options.length === 4 && new Set(c.clue.options).size === 4 && c.clue.options[c.clue.a].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === c.word),
  "each question has four different options and the right one is the answer");
check(all.every(c => !c.clue.prompt.toLowerCase().includes(c.word)), "no question names its answer");
check(all.every(c => c.kind === "country" || c.kind === "commodity" || c.kind === "city"), "each answer is a country, a commodity or a city");
check(JSON.stringify(await C.cluePool(5, {})) === JSON.stringify(all), "the same seed and choices give the same pool (a link, a table and a daily need it)");
check(JSON.stringify(await C.cluePool(6, {})) !== JSON.stringify(all), "another seed another");
const by = {};
for (const [letter, kinds] of [["c", ["country"]], ["m", ["commodity"]], ["t", ["city"]], ["f", ["country"]]]) {
  const p = by[letter] = await C.cluePool(5, { src: letter });
  check(p.length >= 8 && p.every(c => kinds.includes(c.kind)), `source ${letter} alone: ${p.length} candidates, all of one kind (${kinds[0]})`);
}
check(by.f.every(c => /flag/i.test(c.clue.prompt)) && by.t.every(c => /capital/i.test(c.clue.prompt)), "flags ask whose flag, cities the capital");
check(all.filter(c => c.word.length <= 5).length > 0 && (await C.cluePool(5, { src: "t", max: 5 })).every(c => c.word.length <= 5), "a small grid takes only short words");
const excl = await C.cluePool(5, { inc: false }), incl = await C.cluePool(5, { inc: true });
check(excl.every(c => !c.clue.mk) && incl.some(c => c.clue.mk), "marked content is out unless Settings includes it, and the star is on what is marked");
check(incl.filter(c => c.clue.mk).every(c => C.starOf(c.clue).includes("marked-star")) && !excl.some(c => C.starOf(c.clue)), "a marked question carries the star");

// ---------- a grid made from a pool ----------
const p = makePuzzle(7, { level: "easy", clues: all });
check(p && p.clue && p.mystery.word === p.clue.options[p.clue.a].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), `a grid is made with a clue (${p?.mystery?.word})`);
check(p && p.givens.join() === [...new Set(p.mystery.word)].map(ch => p.letters.indexOf(ch)).sort((a, b) => a - b).join() && p.givens.length >= 3, "its givens are the answer's letters");
check(p && mysteryNums(p).map(n => p.letters[n]).join("") === p.mystery.word, "the answer is spelt in the grid's numbers");
check(p && JSON.stringify(pack(makePuzzle(7, { level: "easy", clues: all }))) === JSON.stringify(pack(p)), "the same seed and pool make the same grid");
check(p && unpack(roundTrip(pack(p))).clue.a === p.clue.a && unpack({ ...pack(p), clue: { prompt: "x", options: ["a"], a: 0 } }).clue === null, "the question is kept with the grid, through the database; a broken one is dropped");

// ---------- the rules of the question ----------
{
  const run = newRun(), g0 = p.givens[0], free = [...Array(26).keys()].map(i => i + 1).find(n => !p.givens.includes(n)), wrong = [0, 1, 2, 3].filter(i => i !== p.clue.a);
  check(clueOpen(p, run) && !letterOf(p, run, g0) && !isFixed(p, run, g0), "the question is open: the givens don't show");
  check(answerClue(p, run, wrong[0]).wrong && run.miss === 1 && clueOpen(p, run) && !answerClue(p, run, wrong[0]).ok && run.miss === 1, "a wrong pick is struck out and costs; the same one again does nothing");
  check(answerClue(p, run, p.clue.a).ok && !clueOpen(p, run) && letterOf(p, run, g0) === p.letters[g0] && isFixed(p, run, g0), "the answer opens the grid: the givens show, fixed");
  check(score({ ...run, ms: 10000 }) === 10 + MISS, `the score has ${MISS} seconds for the wrong pick`);
  check(!answerClue(p, run, wrong[1]).ok && run.miss === 1 && !skipClue(p, run), "once answered, nothing more to pick or skip");
  const run2 = newRun();
  check(skipClue(p, run2) && !clueOpen(p, run2) && run2.hints === 1 && score({ ...run2, ms: 0 }) === HINT, "a skip shows the answer at a hint's price");
  const old = { ...p, clue: null };
  check(!clueOpen(old, newRun()) && isFixed(old, newRun(), g0), "a grid made before there were clues shows its givens from the start");
  check(place(p, newRun(), free, p.letters[free]).ok === true, "(the rules leave the page to hold the keys back while it is open)");
}

// ---------- at a table ----------
{
  const players = { u0: { name: "Korbi", slot: 0 }, u1: { name: "Ana", slot: 1 } };
  let g = roundTrip(freshTable(players, { app: 1, puzzle: pack(p), now: 1000 }));
  const act = fn => { const copy = structuredClone(g), ok = fn(copy); if (ok) g = roundTrip(copy); return ok; };
  const P = puzzleOf(g), wrong = [0, 1, 2, 3].find(i => i !== P.clue.a), g0 = P.givens[0];
  check(clueOpenAt(g, P) && !letterAt(g, P, g0) && whyNot(g, 0, 1, "q") === "clue", "at a table the question is open, the givens hidden, nothing written in");
  check(act(t => answerAt(t, wrong)) && g.miss === 1 && g.struck === 1 << wrong && !act(t => answerAt(t, wrong)), "a wrong pick by either is struck out for both");
  check(act(t => skipAt(t)) && !clueOpenAt(g, P) && g.hints === 1 && letterAt(g, P, g0) === P.letters[g0] && !act(t => skipAt(t)), "a skip is the team's, at a hint's price");
  g.done = 1000 + 60000;
  check(tableScore(g) === 60 + HINT + MISS, "the team's score has the wrong pick");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("codeword clues: pools from the topics, one plain word each, the same for the same seed; the grid's givens its answer's letters; the question's rules, solo and at a table");
