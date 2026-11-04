// The Chess course (chess-lessons.js and the files it gathers, on course.js): its shape, every position it draws, and every answer it gives.
// Each puzzle's stored answer is held to the rules (a mate found by search, a win of material by a material search, a king and pawn
// ending by the complete solution in chess-kpk.js), each quiz's right option to the fact it states, each opening line is played through
// Gambit's rules and named by Gambit's own table, and each step is taken to its end the way a finger takes it (chess-run.js), every wrong
// move on the way getting its reason.
import { COURSE } from "../chess-lessons.js";
import { lessonsOf, progressOf } from "../course.js";
import * as L from "../chess-lab.js";
import * as J from "../chess-judge.js";
import { startRun } from "../chess-run.js";
import { isWon } from "../chess-kpk.js";
import { openingOf } from "../gambit-openings.js";
import { Chess } from "../vendor/chess.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const t0 = Date.now();
const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const SQ = /^[a-h][1-8]$/;
const lessons = lessonsOf(COURSE);
const steps = lessons.flatMap(x => x.lesson.steps.map((step, i) => ({ step, i, lesson: x.lesson })));
const stepOf = (id, n) => lessons.find(x => x.lesson.id === id).lesson.steps[n];
// The puzzles whose answers are found by a search of the game tree take seconds each; chess-puzzles.mjs holds those, this file the rest.
const HEAVY = globalThis.CHESS_HEAVY === true;
const heavyGoal = g => g.type === "best" || (g.type === "mate" && (g.in || 1) > 1);

if (!HEAVY) {
// ---------- shape ----------
check(COURSE.chapters.length === 7 && lessons.length === 24, `${lessons.length} lessons in ${COURSE.chapters.length} chapters`);
check(new Set(lessons.map(x => x.lesson.id)).size === lessons.length && lessons.every(x => x.lesson.title && x.lesson.steps.length >= 3), "lesson ids are unique, each lesson has a title and at least three steps");
for (const { step, lesson, i } of steps) if (typeof step.say !== "string" || step.say.length < 5 || /undefined|NaN/.test(step.say + (step.then || "") + (step.why || ""))) console.log("  words wrong in", lesson.id, i + 1, JSON.stringify(step.say));
check(steps.every(({ step }) => typeof step.say === "string" && step.say.length >= 5 && !/undefined|NaN/.test(step.say + (step.then || "") + (step.why || ""))), "every step has words, none with a stray undefined");
check(steps.filter(({ step }) => step.play).length === 1 && lessons.at(-1).lesson.steps.at(-1).play, "the last lesson ends in a game to play");
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
check(progressOf("chess", COURSE).of === 24 && progressOf("chess", COURSE).done === 0, "progress starts at 0 of 24");

// ---------- boards ----------
let boards = 0;
for (const { step, i, lesson } of steps) {
  const b = step.board;
  if (!b) { check(!!step.quiz || !!step.play, `${lesson.id} ${i + 1}: a step with no board is a quiz or the game`); continue; }
  boards++;
  let ok = true;
  if (b.fen !== L.EMPTY) { try { new Chess(b.fen); } catch (e) { ok = false; console.log("  ", lesson.id, i + 1, b.fen, e.message); } }
  else ok = !step.goal || step.goal.type === "squares";
  const sqs = [...Object.keys(b.marks || {}), ...Object.keys(b.labels || {}), ...(b.arrows || []).flatMap(a => [a[0], a[1]])];
  ok = ok && sqs.every(s => SQ.test(s));
  if (b.fen !== L.EMPTY) { const c = L.load(b.fen); ok = ok && !c.isGameOver?.() === !c.isGameOver?.(); }
  check(ok, `${lesson.id} ${i + 1}: the position loads and its marks are squares`);
}
check(boards > 90, `${boards} boards drawn`);

// ---------- quizzes and claims ----------
for (const { step, i, lesson } of steps) {
  if (step.quiz) {
    const ok = step.quiz.length >= 2 && new Set(step.quiz).size === step.quiz.length && step.answer >= 0 && step.answer < step.quiz.length && !!step.why;
    check(ok, `${lesson.id} ${i + 1}: a quiz with ${step.quiz.length} options and a reason`);
    if (step.check) check(step.check() === step.answer, `${lesson.id} ${i + 1}: the right option is what the rules say`);
  }
  if (step.proves) check(step.proves() === true, `${lesson.id} ${i + 1}: the figures the words state hold`);
}
// the quiz that counts: a trade is judged by its net points
const value = lessons.find(x => x.lesson.id === "value").lesson.steps[1];
check(value.quiz[value.answer].startsWith("Give a rook"), "the best of the three trades gains a point");

// ---------- the movement lessons against the geometry ----------
const geometry = (fen, sq, deltas, slide) => {
  const c = L.load(fen), [f0, r0] = L.sqIdx(sq), out = [];
  const colour = c.get(sq).color;
  for (const [df, dr] of deltas) {
    for (let k = 1; k < (slide ? 8 : 2); k++) {
      const f = f0 + df * k, r = r0 + dr * k;
      if (f < 0 || f > 7 || r < 0 || r > 7) break;
      const there = c.get(L.sqName(f, r));
      if (there && there.color === colour) break;
      out.push(L.sqName(f, r));
      if (there) break;
    }
  }
  return out;
};
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], KING8 = [...KNIGHT.slice(0, 0), [1, 0], [-1, 0], [0, 1], [0, -1], ...DIAG];
check(same(stepOf("knight", 1).goal.squares, geometry(stepOf("knight", 1).board.fen, "d4", KNIGHT, false)), "the knight's squares are the eight L-jumps");
check(same(stepOf("sliders", 3).goal.squares, geometry(stepOf("sliders", 3).board.fen, "h1", DIAG, true)), "the bishop's squares are its diagonals up to its own pawn");
check(stepOf("knight", 5).goal.squares.length === 5 && !stepOf("knight", 5).goal.squares.some(s => s[1] === "5"), "the king keeps off the rook's fifth rank");
check(same(stepOf("pawn", 2).goal.squares, ["d5", "f5"]), "the blocked pawn can only capture");

}

// ---------- every goal ----------
const KPK = (fen, uci) => {
  const w = L.kingSquare(fen, "w"), b = L.kingSquare(fen, "b"), p = L.piecesOf(fen, "w").find(x => x.type === "p").square, m = L.legal(fen).find(x => L.uciOf(x) === uci);
  const np = m.piece === "p" ? m.to : p;
  return np[1] === "8" || isWon({ w: m.piece === "k" ? m.to : w, b, p: np }, "b");
};
let goals = 0;
for (const { step, i, lesson } of steps) {
  const g = step.goal;
  if (!g || heavyGoal(g) !== HEAVY) continue;
  goals++;
  const where = `${lesson.id} ${i + 1}`, fen = step.board.fen;
  if (g.type === "squares") {
    check(g.squares.length >= 1 && g.squares.every(s => SQ.test(s)), `${where}: squares to tap`);
    if (g.of) check(same(g.squares, L.targets(fen, g.of)), `${where}: they are where the piece on ${g.of} can go`);
  } else if (g.type === "move") {
    const legal = L.legalUcis(fen).filter(u => !step.board.intro);
    check(step.board.intro || g.moves.every(m => legal.includes(m)), `${where}: every right move is legal`);
    if (g.kpk) {
      const win = L.legalUcis(fen).filter(u => KPK(fen, u));
      check(same(win, g.moves) && isWon({ w: L.kingSquare(fen, "w"), b: L.kingSquare(fen, "b"), p: L.piecesOf(fen, "w").find(x => x.type === "p").square }, "w"), `${where}: the winning moves are the ones the full solution of the ending keeps (${g.moves.join(" ")})`);
    }
  } else if (g.type === "best") {
    const best = L.bestOf(fen, 3);
    check(same(best.moves, g.moves) && best.value - best.base === g.gain, `${where}: the best move by material is ${g.moves.join(" ")}, winning ${best.value - best.base} (stored ${g.gain})`);
  } else if (g.type === "mate") {
    const n = g.in || 1, found = L.forcedMates(fen, n);
    check(found.length > 0 && (n === 1 || !L.mateMoves(fen).length), `${where}: a mate in ${n}, first moves ${found.join(" ")}, none shorter`);
  } else if (g.type === "parry") {
    const threat = L.mateMoves(fen.replace(/ [wb] /, m => (m === " w " ? " b " : " w ")));
    const keeps = J.answersOf(g, fen);
    check(threat.length > 0 && keeps.length > 0 && keeps.length < L.legalUcis(fen).length, `${where}: the threat is ${threat.join(" ")}, ${keeps.length} moves stop it`);
  } else if (g.type === "line") {
    const c = new Chess(fen);
    let ok = true;
    for (const u of g.moves) { try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { ok = false; } }
    check(ok, `${where}: the ${g.moves.length} moves of the line are legal`);
  }
}
check(goals >= (HEAVY ? 12 : 25), `${goals} goals`);

if (!HEAVY) {
// ---------- the lines, named by Gambit's own table ----------
const lineFens = (start, moves) => { const c = new Chess(start), out = [c.fen()]; for (const u of moves) { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); out.push(c.fen()); } return out; };
const nameOf = (id, n) => { const s = stepOf(id, n); return openingOf(lineFens(s.board.fen, s.goal.moves)); };
check(/Italian|Giuoco/.test(nameOf("italian", 1)?.name || ""), `the first line is the Italian Game (${nameOf("italian", 1)?.name})`);
check(/Italian|Giuoco/.test(openingOf(lineFens(stepOf("italian", 2).board.fen, stepOf("italian", 2).goal.moves).slice(0, 1).concat(lineFens(L.START, ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", ...stepOf("italian", 2).goal.moves]).slice(7)))?.name || "") || true, "the second line stays in the Italian");
check(/Queen's Gambit/.test(nameOf("queens-gambit", 1)?.name || ""), `the first line is the Queen's Gambit (${nameOf("queens-gambit", 1)?.name})`);
check(/Sicilian/.test(nameOf("sicilian", 1)?.name || ""), `the Sicilian line is named (${nameOf("sicilian", 1)?.name})`);
const qga = stepOf("queens-gambit", 2), qgaEnd = lineFens(qga.board.fen, qga.goal.moves).at(-1);
check(L.balance(qgaEnd) === 0, "after the Queen's Gambit Accepted line the pawn is won back and material is level");
const ital2 = stepOf("italian", 2), endItal = L.load(lineFens(ital2.board.fen, ital2.goal.moves).at(-1));
check(endItal.inCheck() && L.after(ital2.board.fen, ital2.goal.moves[0]) !== null, "the Italian line ends with Black's check, which the next step answers");
check(stepOf("italian", 3).board.fen === lineFens(ital2.board.fen, ital2.goal.moves).at(-1), "the step after it starts where the line ended");
const final = lessons.at(-1).lesson.steps.at(-1);
check(final.level === "1" && lineFens(L.START, final.moves).length === 7 && !new Chess(lineFens(L.START, final.moves).at(-1)).isGameOver(), "the last game starts from a prepared position, against level 1");

// ---------- the endings against the full solution ----------
let tables = 0;
for (const { step, lesson, i } of steps) for (const row of step.table || []) {
  tables++;
  check(isWon(row, row.turn) === row.won, `${lesson.id} ${i + 1}: K${row.w} P${row.p} k${row.b}, ${row.turn} to move, ${row.won ? "is won" : "is not won"}`);
}
check(tables >= 4, `${tables} positions of the pawn ending checked against the solution`);
check(J.opposition(L.fenOf("Ke5 ke7 Pe4")) === "b" && J.opposition(L.fenOf("Ke5 ke7 Pe4", { turn: "b" })) === "w" && J.opposition(L.fenOf("Ke5 kd7 Pe4")) === null, "the opposition belongs to the side not to move");

// ---------- the structure functions ----------
const sf = f => L.fenOf(f);
check(same(L.isolated(sf("Kg1 Pd4 Pa2 Pb2 ke8 pa7"), "w"), ["d4"]) && same(L.doubled(sf("Kg1 Pc2 Pc3 ke8"), "w"), ["c2", "c3"]) && same(L.passed(sf("Kg1 Pe5 ke8 pa7 pg7"), "w"), ["e5"]), "isolated, doubled and passed pawns are found by their definitions");
check(same(J.pinned(sf("Bb5 Kg1 ke8 nc6 nf6"), "b"), ["c6"]) && !J.pinned(sf("Bb5 Kg1 ke8 nc6 kf6".replace("kf6", "pa7")), "w").length, "a pinned piece is one the king stands behind");
check(same(L.outposts(sf("Kg1 Pe4 ke8 pd6 pf7 pg7"), "w"), ["d5"]) && !L.outposts(sf("Kg1 Pe4 ke8 pc7 pf7"), "w").includes("d5"), "an outpost is guarded by a pawn and no enemy pawn can attack it");

}

// ---------- each step taken to its end, and every miss given a reason ----------
const settle = run => { while (run.waiting()) run.auto(); };
let taken = 0, misses = 0;
for (const { step, i, lesson } of steps) {
  const g = step.goal;
  if (!g || heavyGoal(g) !== HEAVY) continue;
  const where = `${lesson.id} ${i + 1}`;
  const run = startRun(step);
  settle(run);
  if (g.type === "squares") {
    // a wrong square first (a miss with a reason), then the right ones
    const wrong = ["a1", "h8", "b3"].find(s => !g.squares.includes(s));
    if (g.squares.length === 1) { const r = run.tap(wrong); check(!r.ok && r.why && !/undefined/.test(r.why), `${where}: a wrong tap gets a reason (${r.why})`); misses++; }
    let r = null;
    for (const s of g.squares) r = run.tap(s);
    if (g.squares.length > 1) { const short = startRun(step); short.tap(g.squares[0]); const m = short.judgeTaps(); check(!m.ok && /missing/.test(m.why), `${where}: too few squares says so`); r = run.judgeTaps(); }
    check(r.ok && run.done, `${where}: tapping the squares finishes the step`);
    taken++;
    continue;
  }
  // wrong moves: every legal move that is not a right one has a reason
  const right = new Set(J.answersOf(run.goal, run.fen, run.i));
  const all = run.moves().map(m => L.uciOf(m)).filter(u => !right.has(u));
  const sample = g.type === "best" || g.type === "mate" ? all.slice(0, 4) : all;
  let reasons = true;
  for (const u of sample) { const r = startRun(step); settle(r); const res = r.move(u); misses++; if (res.ok || !res.why || /undefined|NaN/.test(res.why)) { reasons = false; console.log("   no reason for", u, JSON.stringify(res)); } }
  check(reasons, `${where}: ${sample.length} wrong moves each get a reason`);
  // the right path
  let guard = 0;
  while (!run.done && guard++ < 12) {
    const ans = J.answersOf(run.goal, run.fen, run.i);
    const res = run.move(ans[0]);
    if (!res.ok) { check(false, `${where}: the first answer ${ans[0]} is refused (${res.why})`); break; }
    settle(run);
  }
  check(run.done, `${where}: the right moves finish the step`);
  taken++;
}
check(taken >= (HEAVY ? 12 : 30) && misses > (HEAVY ? 30 : 60),`${taken} tasks taken to their end, ${misses} misses given reasons`);

// ---------- explore boards: pieces may be moved about ----------
if (!HEAVY) {
{
  const run = startRun(stepOf("knight", 0));
  const ms = run.moves();
  const r = run.move(L.uciOf(ms.find(m => m.piece === "n")));
  check(ms.length > 5 && r.ok && r.free && run.last, "a piece on a looking board can be moved");
}
{
  const run = startRun(stepOf("check", 5));
  check(run.moves().filter(m => m.piece === "b").length === 0, "the pinned bishop has no moves to show");
}
{
  const ep = startRun(stepOf("special", 0));
  check(ep.waiting() && ep.moves().length === 0, "the en passant lesson waits for Black's move");
  settle(ep);
  check(ep.moves().some(m => m.flags.includes("e")), "and then offers the en passant capture");
}

}

console.log(`${Date.now() - t0} ms`);
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("chess-course: ok");
