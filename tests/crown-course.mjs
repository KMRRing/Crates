import fs from "node:fs";
// Draughts's course (crown-course.js) and its shots (crown-puzzles.js): every position of every step parses onto dark squares;
// every move a lesson asks for or accepts is legal in its position, every wrong one with words is legal too; a quiz's
// answer is one of its options; the claims the lessons make hold on the board (a jump compulsory, a run that must go on,
// a man crowned in a jump stopping, the majority rule, the exchange, the opposition) and each shot is the search's own
// clear first choice; and the stage is tapped through on plain objects as a person taps it.
import { SETS, toArray, movesOf, play, toText } from "../crown-board.js";
import { COURSE, dayStreak, streakNow, boardOf, moveName, legalOf, positionOf, answersOf, judge, setOf, sideOfStep, boardStage, squaresOf } from "../crown-course.js";
import { SHOTS } from "../crown-puzzles.js";
import { engineFor } from "../crown-search.js";
import { squareOf } from "../crown-draw.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const lessons = COURSE.chapters.flatMap(c => c.lessons), steps = lessons.flatMap(l => l.steps.map(s => ({ ...s, lesson: l.id })));
check(new Set(lessons.map(l => l.id)).size === lessons.length && lessons.length >= 12, `${lessons.length} lessons, each with its own id`);
check(lessons.at(-1).steps.some(s => s.play), "the course ends in a game");

// ---------- every step's position and moves ----------
let problems = [];
for (const s of steps) {
  try {
    if (s.pieces == null) { if (!s.play && !s.rows) problems.push(`${s.lesson}: a step with no position`); continue; }
    if (!SETS[setOf(s)]) problems.push(`${s.lesson}: no rule set ${s.set}`);
    positionOf(s);
    if (s.mark) squaresOf(setOf(s), s.mark);
    if (s.quiz) {
      if (!(s.answer >= 0 && s.answer < s.quiz.length)) problems.push(`${s.lesson}: the quiz answer is not an option`);
      continue;
    }
    if (s.answer != null) {
      const legal = legalOf(s).map(m => moveName(setOf(s), m));
      for (const a of answersOf(s)) if (!legal.includes(a)) problems.push(`${s.lesson}: ${a} is not legal (${legal.join(" ")})`);
      for (const w of Object.keys(s.wrong || {})) if (!legal.includes(w)) problems.push(`${s.lesson}: wrong move ${w} is not legal`);
      if (!s.say || !s.then && !s.shot) problems.push(`${s.lesson}: an exercise needs words`);
    }
  } catch (e) { problems.push(`${s.lesson}: ${e.message}`); }
}
check(!problems.length, `every step's pieces sit on dark squares and its moves are legal${problems.length ? `: ${problems.join("; ")}` : ""}`);

// ---------- what the lessons say about the rules, on the board ----------
const step = (id, i = 0) => lessons.find(l => l.id === id).steps[i];
const namesOf = s => legalOf(s).map(m => moveName(setOf(s), m)).sort();
check(legalOf(step("compulsory", 0)).every(m => m.caps.length) && namesOf(step("compulsory", 0)).length === 1, "a jump is compulsory: with a jump on offer the steps are not offered");
check(namesOf(step("compulsory", 1)).join() === "b2xd4,f4xh6", "two men with a jump each: either is legal");
check(namesOf(step("runs", 0)).join() === "b2xd4xf6", "a run must go on: one move, taking both");
check(namesOf(step("runs", 1)).join() === ["a3xc5", "c3xa5", "c3xe5xg7"].sort().join(), "English: any route may be chosen, three are open");
{
  const m = legalOf(step("crown", 0)).filter(x => x.crown), j = legalOf(step("crown", 1))[0];
  check(m.length === 2 && j.crown && j.path.length === 2 && j.caps.length === 1, "a man reaching the far row is crowned, and in a jump the move ends there");
}
check(namesOf(step("kings", 0)).join() === "d4xb2" && namesOf(step("kings", 1)).every(n => !n.includes("x")), "a king jumps backward; a man cannot");
check(namesOf(step("sets", 1)).join() === "c3xe5xg7" && SETS.international.most, "International: the majority rule leaves only the longest jump");
check(namesOf(step("sets", 0)).join() === ["c1xg5", "c1xh6", "c1xi7", "c1xj8"].sort().join(), "a flying king may land on any free square beyond the piece it jumps");
{
  // the exchange: a step, their compulsory jump, and the recapture
  const s = step("exchange", 0), b = toArray(positionOf(s)), m = legalOf(s).find(x => moveName("english", x) === "c3-d4");
  const after = play(b, m), reply = movesOf("english", after, 1), recapture = movesOf("english", play(after, reply[0]), 0);
  check(reply.length === 1 && reply[0].caps.length === 1 && recapture.some(x => moveName("english", x) === "b2xd4"), "the exchange: they must take, and b2 takes back");
}
{
  const s = step("opposition", 0), e = engineFor("english"), b = toArray(positionOf(s));
  const r = e.search(b, 0, { nodes: 30000, depth: 12, noise: 1, rng: () => 0 });
  const win = r.moves.filter(x => x.score > 90000).map(x => moveName("english", x.move));
  check(win.join() === "c3-d4", "the opposition: c3-d4 wins by force and nothing else does");
}

// ---------- the shots ----------
{
  const e = {}, results = [];
  for (const p of SHOTS.slice(0, 6)) {
    const set = p.set, eng = e[set] ||= engineFor(set), b = toArray(boardOf(set, p.pieces));
    const r = eng.search(b, p.side, { nodes: 60000, depth: p.needs + 1, noise: 1, rng: () => 0 });
    results.push(moveName(set, r.moves[0].move) === p.answer && r.moves[0].score - r.moves[1].score >= 80);
  }
  check(results.every(Boolean), `the shots kept are the search's clear first choice (${results.length} of ${SHOTS.length} checked)`);
  check(SHOTS.length === 0 || SHOTS.every(p => p.line.length >= 3 && p.gain >= 0.9 && SETS[p.set]), `every shot has its line and wins material (${SHOTS.length} shots)`);
}
const shots = lessons.find(l => l.id === "shots").steps;
check(shots.length >= 2 && shots.every(s => s.shot && s.answer), `the shot lesson has its puzzles (${shots.length})`);

// ---------- tapped through, as the sheet does it ----------
{
  let handler = null, answered = null, changes = 0;
  const box = { addEventListener: (t, fn) => { handler = fn; }, innerHTML: "" };
  const stage = boardStage();
  stage.mount(box, { changed: () => { changes++; }, answer: r => { answered = r; } });
  const click = sq => handler({ target: { closest: () => ({ dataset: { sq: String(sq) } }) } });
  const sqOf = n => squareOf("english", n);
  const run = (s, taps) => {
    const st = { done: false, tries: 0 };
    answered = null;
    stage.draw(s, st);
    for (const n of taps) { click(sqOf(n)); stage.draw(s, st); }
    return answered;
  };
  const jump = step("runs", 0), one = step("step", 0), shot = step("jump", 0);
  check(run(one, ["c3", "d4"])?.ok === true, "tapped: a piece, then its square, a step made and judged");
  check(run(one, ["c3", "c3"]) === null, "tapped: the piece put down again, nothing made");
  check(run(jump, ["b2", "f6"])?.ok === true, "tapped: a run played by its last square alone");
  check(run(jump, ["b2", "d4", "f6"])?.ok === true, "tapped: a run played landing by landing");
  check(run(step("centre", 0), ["a3", "b4"])?.ok === false, "tapped: a legal but wrong move says why");
  const stuck = run(step("compulsory", 0), ["c3"]);
  check(stuck === null && /compulsory/.test(box.innerHTML), "tapped: a piece that cannot move while a jump is compulsory says so");
  check(run(shot, ["d4", "f6"])?.ok === true && typeof stage.hint === "function", "the stage's hint is there");
}

// ---------- the shot's streak (the games screen's tile) ----------
{
  let st = dayStreak(null, 20261030);
  check(st.now === 1 && st.best === 1, "a first shot solved is a streak of one");
  check(dayStreak(st, 20261030) === st, "a second solve the same day changes nothing");
  st = dayStreak(st, 20261031); st = dayStreak(st, 20261101);
  check(st.now === 3 && st.best === 3, "the next days add on, over a month's end");
  check(streakNow(st, 20261102) === 3 && streakNow(st, 20261103) === 0, "a day missed ends it for the menu");
  const after = dayStreak(st, 20261104);
  check(after.now === 1 && after.best === 3, "starting again keeps the best");
  check(dayStreak({ now: 4, best: 4, last: 20261231 }, 20270101).now === 5, "and over a year's end");
  check(/crown: "streak"/.test(fs.readFileSync(new URL("../suite.js", import.meta.url), "utf8")), "the tile shows the streak");
}

console.log(bad ? `crown-course: ${bad} failed` : "crown-course: every check passed");
process.exit(bad ? 1 : 0);
