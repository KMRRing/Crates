// Acrostic (README, Classics: Acrostic): the text laid out as squares, the rules of filling either side, the hidden
// texts from the knowledge base, the generator (answers holding exactly the text's letters, the spine down their first
// or last letters, every answer a clued word, one way only to fill it, across levels, twists and seeds), the grading by
// the skill a person needs, the computer player, the team's split (the halves make the whole and neither alone does),
// the Half twist, today's puzzle the same on every phone, and a puzzle kept through JSON and the database.
import {
  LEVELS, TWISTS, DAILY, SOURCES, EMPTY, fold, lettersOf, layOut, runsOf, owners, labelOf, blank, put, solved, filled, wrong, right, spelled,
  spineCell, step, nextEmpty, rivalAt, rivalDone, holds, validEntry,
} from "../acrostic-engine.js";
import { entries, tells } from "../acrostic-texts.js";
import { makePuzzle, fillAnswers, dayOrder, rng, hash } from "../acrostic-make.js";
import { fills, solve, grade, rivalPlan, splitFor, clueLevel } from "../acrostic-solve.js";
import { answers } from "../acrostic-words.js";
import { cluesOf, hasClue } from "../clues.js";
import { today } from "../days.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sorted = s => [...s].sort().join("");

// ---------- letters and squares ----------
check(fold("Bären, œuvre, Ærø, Łódź") === "Baren, oeuvre, AEro, Lodz" && lettersOf("It's 4,800 km!") === "ITSKM", "accents fold to the 26 letters; only letters take squares");
{
  const { cells, layout } = layOut("Life's but a walking shadow, a poor player; 1883 — (head-to-head)");
  check(cells === "LIFESBUTAWALKINGSHADOWAPOORPLAYERHEADTOHEAD", "every letter is a square, in reading order");
  const boxes = layout.flat();
  check(boxes.filter(b => b.c != null).length === cells.length && boxes.filter(b => b.g).map(b => b.g).join("") === "1883", "a digit is shown, not a square");
  check(layout[0][3].a === "'" && layout[4][5].a === "," && layout[7][5].a === ";" && layout[8][3].a === " —" && layout.at(-1)[0].b === "(",
    "punctuation sits at a square's edge: after a letter, before a word, a dash between words after the one before");
  const runs = runsOf(layout).map(r => r.map(c => cells[c]).join(""));
  check(runs.includes("LIFE") && runs.includes("S") && runs.includes("HEAD") && runs.includes("TO") && !runs.includes("LIFES"), "the text's words split where a mark falls inside them: life's is LIFE and S, head-to-head three");
}
check(labelOf(0) === "A" && labelOf(25) === "Z" && labelOf(26) === "AA", "clues are labelled A to Z, then AA");

// ---------- the hidden texts ----------
const list = entries();
{
  const by = {};
  for (const e of list) by[e.source] = (by[e.source] || 0) + 1;
  check(SOURCES.every(([id]) => by[id] > 20), `texts from every source (${SOURCES.map(([id]) => `${id} ${by[id] || 0}`).join(", ")})`);
  check(!list.some(e => e.source === "saying" && e.stage === "pop"), "the sayings leave out pop culture");
  check(list.every(e => e.forms.length && e.forms.every(f => f.text && f.spines.length && f.spines.every(s => s.label && lettersOf(s.text).length >= 3))), "every text has its forms, each with a spine that says what it spells");
  check(list.every(e => e.forms.every(f => f.spines.every(s => !tells(f.text, s.text)))), "no text gives its spine away (every word of the spine in it)");
  check(tells("For Franz Marc blue meant the masculine", "Franz Marc") && !tells("The oldest desert, along Namibia's coast", "The Namib"), "a spine is given away only when the text holds all its words");
  check(list.every(e => e.about?.title), "every text has its reveal");
}

// ---------- the generator ----------
const RUNS = [["easy", "classic", 4], ["medium", "classic", 5], ["hard", "classic", 4], ["medium", "telestich", 3], ["medium", "half", 3], ["hard", "half", 2], ["easy", "telestich", 2]];
const made = [];
const t0 = Date.now();
for (const [level, twist, n] of RUNS) for (let i = 0; i < n; i++) {
  const seed = 9000 + 37 * i + level.length * 11 + twist.length;
  const P = makePuzzle(seed, { level, twist });
  if (P) made.push(P); else check(false, `a puzzle at ${level}, ${twist}, seed ${seed}`);
}
console.log(`     ${made.length} puzzles in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const W = answers();
check(made.every(P => sorted(P.answers.map(a => a.word).join("")) === sorted(P.cells)), "every puzzle's answers hold exactly the text's letters");
check(made.every(P => { const used = P.answers.flatMap(a => a.cells); return used.length === P.cells.length && new Set(used).size === used.length && P.answers.every(a => a.cells.every((c, i) => P.cells[c] === a.word[i])); }),
  "every answer's letter has a square of its own, holding that letter");
check(made.every(P => P.answers.map((a, i) => (P.spine.at === "last" ? a.word.at(-1) : a.word[0])).join("") === lettersOf(P.spine.text)), "the answers' first letters spell the spine (their last, in a telestich)");
check(made.every(P => P.answers.every(a => hasClue(a.word) && cluesOf(a.word).some(c => c.text === a.clue && c.d === a.d))), "every answer is a clued word, with one of its own clues");
check(made.every(P => { const L = LEVELS[P.level], k = P.answers.length, n = P.cells.length; return n >= L.letters[0] && n <= L.letters[1] && k >= L.answers[0] && k <= L.answers[1]; }), "every puzzle is its level's size");
check(made.every(P => P.answers.every(a => a.tier <= LEVELS[P.level].tier)), "Easy's answers are the commonest words");
check(made.every(P => fills(P).count === 1), "every puzzle fills one way only (the proof, every answer a clued word and every word of the text a word)");
{
  // two letters of one answer side by side in the text, in its order, would spell a piece of it
  let pairs = 0, side = 0;
  for (const P of made) for (const a of P.answers) for (let i = 1; i < a.cells.length; i++) { pairs++; if (a.cells[i] === a.cells[i - 1] + 1) side++; }
  check(side <= pairs * 0.02, `an answer's letters are spread over the text, seldom side by side in its order (${side} of ${pairs})`);
}
{
  const P = made[0], again = makePuzzle(P.seed, { level: P.level, twist: P.twist });
  check(JSON.stringify(again) === JSON.stringify(P), "a seed makes the same puzzle every time");
}

// ---------- one way only: the proof ----------
{
  // CAT and DOG laid into "Cat dog" letter for letter: COT, CUT and the like fill it as well
  const { cells, layout } = layOut("Cat dog");
  const P = { cells, layout, answers: [{ word: "CAT", cells: [0, 1, 2], d: 1, tier: 0 }, { word: "DOG", cells: [3, 4, 5], d: 1, tier: 0 }], spine: { text: "CD", at: "first" } };
  const r = fills(P);
  check(r.count === 2 && r.two && r.two !== cells && /^C..D..$/.test(r.two), `a text that fills two ways is caught, with the second way (${r.two})`);
}

// ---------- difficulty ----------
{
  const levels = made.filter(P => P.twist === "classic");
  check(levels.every(P => P.grade.level >= LEVELS[P.level].grade - 1 && P.grade.level <= 3), "every puzzle's grade is its level's, or one step easier at most");
  const exact = levels.filter(P => P.grade.level === LEVELS[P.level].grade).length;
  check(exact >= levels.length * 0.75, `most puzzles grade exactly their level (${exact} of ${levels.length})`);
  check(levels.every(P => solve(P, P.grade.level).solved && (P.grade.level === 1 || !solve(P, P.grade.level - 1).solved)), "a puzzle finishes at its grade's skill and not at the skill below");
  const secs = l => { const xs = levels.filter(P => P.level === l).map(P => solve(P, 3).secs); return xs.reduce((a, b) => a + b, 0) / xs.length; };
  check(secs("easy") < secs("medium") && secs("medium") < secs("hard"), `a person takes longer the higher the level (${["easy", "medium", "hard"].map(l => `${l} ${Math.round(secs(l))} s`).join(", ")})`);
  const P = levels.find(x => x.level === "hard");
  check(P.answers.some((_, a) => clueLevel(P, a) === 3), "Hard has clues a person must know rarer words for");
}

// ---------- the computer player ----------
{
  const P = made.find(x => x.level === "medium" && x.twist === "classic");
  const plans = [1, 2, 3].map(l => P.rival[l]);
  check(plans.every(p => p.length && p.every((s, i) => !i || s[0] >= p[i - 1][0])), "the computer's run is a schedule of steps in time");
  check(plans.every(p => new Set(p.flatMap(s => s[1])).size === P.cells.length), "every computer finishes: each square once");
  check(rivalDone(P, 3) < rivalDone(P, 2) && rivalDone(P, 2) < rivalDone(P, 1), `the harder computer is quicker (${[1, 2, 3].map(l => `${Math.round(rivalDone(P, l) / 1000)} s`).join(", ")})`);
  check(rivalAt(P, 2, 0) === blank(P) && rivalAt(P, 2, rivalDone(P, 2)) === P.cells && right(P, rivalAt(P, 2, rivalDone(P, 2) / 2)) > 0, "its letters come in as its clock runs");
  check(JSON.stringify(rivalPlan(P, 2)) === JSON.stringify(P.rival[2]), "its schedule is worked out the same every time");
}

// ---------- the rules of filling ----------
{
  const P = made[1], own = owners(P);
  let e = blank(P);
  check(validEntry(P, e) && filled(e) === 0 && !solved(P, e), "a fresh entry: every square empty");
  const a = P.answers[2], c = a.cells[1];
  e = put(e, c, a.word[1].toLowerCase());
  check(e[c] === a.word[1] && spelled(P, e, 2)[1] === a.word[1], "a letter in a square is the letter in its clue's answer: both sides are one");
  e = put(e, a.cells[0], "Q" === a.word[0] ? "Z" : "Q");
  check(wrong(P, e).length === 1 && wrong(P, e)[0] === a.cells[0] && right(P, e) === 1, "a check finds the letters that aren't the text's");
  check(step(P, own, a.cells[0], "clue") === a.cells[1] && step(P, own, 0, "text") === 1 && step(P, own, P.cells.length - 1, "text") === null, "typing runs along the clue's answer or along the text");
  check(nextEmpty(P, own, e, a.cells[0], "clue") === a.cells[2], "the next empty square along the clue");
  let full = blank(P);
  for (let x = 0; x < P.cells.length; x++) full = put(full, x, P.cells[x]);
  check(solved(P, full) && filled(full) === P.cells.length, "every square right: solved");
  check(spineCell(P, 0) === (P.spine.at === "last" ? P.answers[0].cells.at(-1) : P.answers[0].cells[0]), "the spine's square in each answer");
}

// ---------- twists ----------
{
  const tele = made.filter(P => P.twist === "telestich");
  check(tele.length && tele.every(P => P.spine.at === "last"), "a telestich's spine runs down the last letters");
  const half = made.filter(P => P.twist === "half");
  check(half.length && half.every(P => P.unclued?.length >= Math.ceil(P.answers.length / 3) && P.unclued.length <= P.answers.length / 2), "Half clued leaves a third to a half of the clues blank");
  check(half.every(P => solve(P, 3, { read: a => !P.unclued.includes(a) }).solved), "with only the clues it shows, a Half clued puzzle still finishes");
  check(half.every(P => P.grade.level === solve(P, P.grade.level, { read: a => !P.unclued.includes(a) }).solved * P.grade.level), "its grade counts the blank clues as unread");
  check(Object.keys(TWISTS).join() === "classic,telestich,half", "three ways to play: classic, telestich, half clued");
}

// ---------- playing together ----------
{
  const team = made.filter(P => P.twist !== "half");
  const halves = P => [0, 1].map(seat => P.answers.map((_, a) => a).filter(a => P.split[a] === seat));
  check(team.every(P => P.split.length === P.answers.length && halves(P).every(h => h.length >= Math.floor(P.answers.length / 2))), "a team's clues split between the two seats, half each");
  const both = team.every(P => solve(P, 3).solved);
  const alone = team.filter(P => [0, 1].every(seat => !solve(P, 3, { read: a => P.split[a] === seat }).solved));
  check(both && alone.length === team.length, `the halves together finish it, and neither half alone does (${alone.length} of ${team.length})`);
  check(team.every(P => P.alone.every(x => x < 1)), "how far each half gets alone is kept with the puzzle");
  const P = team[0];
  check(holds(P, 0, P.split[0]) && !holds(P, 0, 1 - P.split[0]) && holds(P, 0, null), "each seat reads its own clues; alone, all of them");
  const again = splitFor(P, rng(1));
  check(again.split.length === P.answers.length, "a split can be worked out again");
}

// ---------- today's ----------
{
  const day = today(new Date(Date.UTC(2026, 9, 20, 12)));
  const a = makePuzzle(day, { ...DAILY, daily: true }), b = makePuzzle(day, { ...DAILY, daily: true });
  const c = makePuzzle(today(new Date(Date.UTC(2026, 9, 21, 12))), { ...DAILY, daily: true });
  check(a && JSON.stringify(a) === JSON.stringify(b), "today's puzzle is the same on every phone");
  check(a && c && a.id !== c.id, "tomorrow's is another");
  check(a.level === "medium" && a.twist === "classic", "today's is Medium, classic");
  // each day enters the pool a golden step of its length on from the day before: a month's days start far apart
  const some = list.slice(0, 500), order = dayOrder(some, 20260101).map(e => e.id);    // 1 January enters at the start
  const at = [];
  for (let i = 0; i < 30; i++) at.push(order.indexOf(dayOrder(some, today(new Date(Date.UTC(2026, 10, 1 + i, 12))))[0].id));
  const s = [...at].sort((x, y) => x - y), gap = Math.min(...s.slice(1).map((x, i) => x - s[i]));
  check(new Set(at).size === 30 && gap >= 5, `a month of days starts at thirty places in the pool, at least ${gap} apart`);
  check(hash("acrostic") === hash("acrostic") && hash("a") !== hash("b") && rng(5)() === rng(5)() && rng(5)() !== rng(6)(), "the seeded generator and the hash");
}

// ---------- kept: JSON and the database ----------
{
  const P = made.find(x => x.twist === "classic");
  const run = { mode: "random", P, entry: put(blank(P), 0, P.cells[0]), ms: 61000, pen: 20, hints: 1, checks: 0, shown: [0], marked: [], done: false, rival: 2, at: 3, way: "clue" };
  const back = JSON.parse(JSON.stringify(run));
  check(validEntry(back.P, back.entry) && JSON.stringify(owners(back.P)) === JSON.stringify(owners(P)) && rivalDone(back.P, 2) === rivalDone(P, 2), "a run kept as JSON plays on the same");
  const table = { v: 1, kind: "team", app: 1, created: 1, players: { u1: { name: "Korbi", slot: 0 } }, n: 1, P, entry: blank(P), by: blank(P), pen: 0, shown: [], begun: 5, done: null };
  const db = roundTrip(table);
  check(db.P.answers.length === P.answers.length && rivalDone(db.P, 3) === rivalDone(P, 3) && validEntry(db.P, db.entry) && !db.shown && db.done == null, "a team's table survives the database (no empty lists, numbered keys read back as a list)");
  const match = roundTrip({ seed: 3, level: "medium", twist: "classic", P });
  check(fills(match.P).count === 1 && JSON.stringify(runsOf(match.P.layout)) === JSON.stringify(runsOf(P.layout)), "a race's match survives the database whole");
}

// ---------- the search itself ----------
{
  const ids = fillAnswers("The quick brown fox jumps over the lazy dog", "Thomas", { rand: rng(4) });
  check(ids === null || sorted(ids.map(id => W.list[id].word).join("")) === sorted(lettersOf("The quick brown fox jumps over the lazy dog")), "a fill takes the text's letters exactly, or finds none");
  check(fillAnswers("A short text", "XYLOPHONE") === null, "a spine whose letters aren't in the text has no fill");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`acrostic: ${made.length} puzzles proven to fill one way, graded, split and paced`);
