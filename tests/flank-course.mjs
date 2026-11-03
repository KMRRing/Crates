// Flank's course (flank-course.js): every claim a lesson makes about a position is checked against the engine. A puzzle
// marked proved has its answer played out to the end by the exact solver (it is the best move, the squares it lists as
// good enough win, the squares it lists as losing lose); the counts a quiz asks for are counted here; a pass, an
// ended game, the discs that "can never be turned" and the sizes of the regions of empty squares are all worked out
// again; and each step is played through judge() the way the stage does, right answers and wrong.
import { COURSE, positionOf, squaresIn, judge, repliesTo } from "../flank-course.js";
import { movesOf, turnsOf, position, play, tally, sqName, sqOf } from "../flank-board.js";
import { rootScores } from "../flank-engine.js";
import { sidesOf } from "../flank-bot.js";
import { exactMargin } from "../flank-think.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const names = text => String(text ?? "").split(/\s+/).filter(Boolean);
const empties = b => [...b].filter(c => c === ".").length;

/** The exact result in discs of each move, for the side to move: { square name: margin }. */
function margins(p) {
  const [pl, ph, ol, oh] = sidesOf(p.b, p.t);
  return Object.fromEntries(rootScores(pl, ph, ol, oh, { exact: 64, all: true }).map(m => [sqName(m.sq), exactMargin(m.score)]));
}
/** Region sizes of the empty squares (touching, diagonals too), in the order the board is read. */
function regionSizes(b) {
  const seen = new Set(), out = [];
  for (let s = 0; s < 64; s++) {
    if (b[s] !== "." || seen.has(s)) continue;
    let n = 0;
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const q = stack.pop();
      n++;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = (q >> 3) + dr, c = (q & 7) + dc, k = r * 8 + c;
        if (r < 0 || r > 7 || c < 0 || c > 7 || b[k] !== "." || seen.has(k)) continue;
        seen.add(k);
        stack.push(k);
      }
    }
    out.push(n);
  }
  return out;
}
/** The discs no continuation of the game ever turns. */
function neverTurned(p) {
  const keep = new Set();
  for (let i = 0; i < 64; i++) if (p.b[i] !== ".") keep.add(i);
  const walk = q => {
    for (const m of movesOf(q)) {
      const n = play(q, m);
      for (const f of n.flips) keep.delete(f);
      walk(n);
    }
  };
  walk(p);
  return keep;
}

// ---------- the course's shape ----------
const lessons = COURSE.chapters.flatMap(c => c.lessons);
const ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "lesson ids are unique");
check(lessons.length >= 8, "the course has its lessons");
check(lessons.at(-1).steps.at(-1).play === true, "the course ends with a game");
for (const c of COURSE.chapters) check(c.lessons.length > 0 && c.title, `chapter ${c.id} has lessons`);

let proved = 0, judged = 0;
for (const lesson of lessons) {
  lesson.steps.forEach((s, i) => {
    const at = `${lesson.id} step ${i + 1}`;
    check(typeof s.say === "string" && s.say.length > 20, `${at} says something`);
    let p;
    try { p = positionOf(s); } catch (e) { check(false, `${at}: ${e.message}`); return; }
    // the squares a step names must exist
    for (const key of ["tap", "also", "loses", "most", "pair"]) for (const n of names(s[key])) check(sqOf(n) >= 0, `${at}: ${key} "${n}" is a square`);
    for (const n of names(s.mark)) check(sqOf(n.split(":")[0]) >= 0 && ["good", "bad", "pick"].includes(n.split(":")[1]), `${at}: mark "${n}"`);

    if (s.quiz) {
      check(s.answer >= 0 && s.answer < s.quiz.length && s.quiz.length >= 2, `${at}: the answer is one of the options`);
      check(typeof s.why === "string" && s.why.length > 5, `${at}: a quiz says why`);
      if (s.calc === "moves") check(Number(s.quiz[s.answer]) === movesOf(p).length, `${at}: the number of moves`);
      if (s.calc === "winner") {
        const t = tally(p.b), want = t.d > t.l ? "Dark" : t.l > t.d ? "Light" : "A draw";
        check(p.over && s.quiz[s.answer] === want, `${at}: the winner is ${want}`);
      }
      if (s.calc === "fewer") {
        const [x, y] = names(s.pair).map(n => [n, repliesTo(p, sqOf(n))]);
        const fewer = x[1] < y[1] ? x[0] : y[0];
        check(x[1] !== y[1] && s.quiz[s.answer] === fewer, `${at}: ${fewer} leaves fewer replies`);
      }
    }
    if (s.pair) check(names(s.pair).length === 2 && names(s.pair).every(n => movesOf(p).includes(sqOf(n))), `${at}: a pair of legal moves`);
    if (s.pass) {
      const other = s.pass === "d" ? "l" : "d", q = position(p.b, s.pass);
      check(q.t !== s.pass && !q.over, `${at}: ${s.pass} has no move but the game goes on`);
      check(movesOf(q).length > 0 && q.t === other, `${at}: the other side moves`);
    }
    if (s.over) check(p.over, `${at}: the game is over`);
    if (s.most) {
      const ms = movesOf(p).map(sq => [sq, turnsOf(p, sq).length]).sort((a, b) => b[1] - a[1]);
      check(sqName(ms[0][0]) === s.most && ms[0][1] > ms[1][1], `${at}: ${s.most} turns the most discs, alone`);
    }
    if (s.sizes) check(regionSizes(p.b).join(" ") === s.sizes, `${at}: regions of ${s.sizes}, not ${regionSizes(p.b).join(" ")}`);
    if (s.stable) {
      const keep = neverTurned(p);
      for (const n of names(s.mark)) { const [sq, kind] = n.split(":"); if (kind === "good") check(keep.has(sqOf(sq)), `${at}: ${sq} can never be turned`); }
    }
    for (const n of names(s.tap).concat(names(s.also))) check(movesOf(p).includes(sqOf(n)), `${at}: ${n} is a legal move`);
    for (const n of names(s.loses)) check(movesOf(p).includes(sqOf(n)), `${at}: ${n} is a legal move`);

    if (s.proved) {
      proved++;
      check(empties(p.b) <= 14, `${at}: few enough squares to prove (${empties(p.b)})`);
      const m = margins(p), best = Math.max(...Object.values(m));
      for (const n of names(s.tap)) check(m[n] === best, `${at}: ${n} is the best move (${m[n]} against ${best})`);
      check(Object.values(m).filter(v => v === best).length === names(s.tap).length, `${at}: the best move is the one named`);
      for (const n of names(s.also)) check(m[n] > 0 && m[n] < best, `${at}: ${n} wins, by less (${m[n]})`);
      for (const n of names(s.loses)) check(m[n] < 0, `${at}: ${n} loses (${m[n]})`);
      check(best > 0, `${at}: the best move wins (${best})`);
      if (s.mob) {
        const k = Object.fromEntries(Object.keys(m).map(n => [n, repliesTo(p, sqOf(n))])), fewest = Math.min(...Object.values(k));
        check(names(s.tap).every(n => k[n] === fewest) && Object.values(k).filter(v => v === fewest).length === 1, `${at}: the best move leaves the fewest replies, alone`);
      }
      // wrong answers that are not listed as losing must be told something true: they win, but by less
      if (s.miss && /wins too/.test(s.miss)) for (const n of Object.keys(m)) if (!names(s.tap).includes(n)) check(m[n] > 0, `${at}: ${n} wins too (${m[n]})`);
    }

    // played as the stage plays it
    if (s.tap || s.free || s.find) {
      judged++;
      const legal = movesOf(p), st = {};
      const illegal = [...Array(64).keys()].find(sq => p.b[sq] === "." && !legal.includes(sq));
      if (illegal != null) check(judge(s, {}, illegal, p).ok === false, `${at}: a square where nothing turns is refused`);
      const occupied = p.b.split("").findIndex(c => c !== ".");
      check(judge(s, {}, occupied, p).ok === false, `${at}: a taken square is refused`);
      if (s.find) {
        let last;
        for (const sq of legal) last = judge(s, st, sq, p);
        check(last.ok && last.done !== false, `${at}: finding every move finishes the step`);
        check(judge(s, st, legal[0], p).ok, `${at}: a square found twice is no mistake`);
      } else {
        const right = s.free ? legal : squaresIn(s.tap).concat(squaresIn(s.also));
        for (const sq of right) { const r = judge(s, {}, sq, p); check(r.ok && r.done !== false && r.msg, `${at}: ${sqName(sq)} is right`); }
        for (const sq of legal.filter(x => !right.includes(x))) { const r = judge(s, {}, sq, p); check(!r.ok && r.why, `${at}: ${sqName(sq)} is wrong and says why`); }
      }
    } else if (!s.quiz && !s.play) {
      check(true, "");
    }
  });
}
check(proved >= 5, `at least five proved puzzles (${proved})`);
check(judged >= 8, `the exercises are played (${judged})`);

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log(`Flank course: ${lessons.length} lessons, ${proved} puzzles proved by the solver, ${judged} exercises played through. All good.`);
