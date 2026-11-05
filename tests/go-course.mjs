// Go's course (go-course.js): every position parses, every point a lesson names exists, every move it asks for or
// accepts is legal and every claim it makes holds under go-rules.js: captures, atari, liberties, connection, area
// counts, ko, and (by search on the small boards) life, death and ladders.
import { Position, BLACK, WHITE, PASS, areaScore, groupAt, neighbours, ptName } from "../go-rules.js";
import { COURSE, positionOf, ptsOf, ptOf, judge, sizeOf } from "../go-course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const lessons = COURSE.chapters.flatMap(c => c.lessons), steps = lessons.flatMap(l => l.steps.map(s => ({ ...s, lesson: l.id })));
check(new Set(lessons.map(l => l.id)).size === lessons.length && lessons.length >= 15, `${lessons.length} lessons, each with its own id`);
check(lessons.at(-1).steps.some(s => s.play), "the course ends in a game");
const byId = id => lessons.find(l => l.id === id);

// ---------- searches (small boards only) ----------
const libsOf = (pos, pt) => {
  const nb = neighbours(pos.n), out = new Set();
  for (const s of groupAt(pos, pt)) for (const q of nb[s]) if (pos.b[q] === 0) out.add(q);
  return out;
};
/** Can the side not owning `target` capture its group within `depth` plies, the owner defending with any move or a pass? */
function kills(pos, target, depth) {
  const col = pos.b[target];
  if (!col) return true;
  if (depth <= 0) return false;
  const attacker = pos.toMove !== col, moves = pos.legalPoints();
  if (attacker) {
    for (const m of moves) { const q = pos.copy(); if (q.play(m) >= 0 && kills(q, target, depth - 1)) return true; }
    return false;
  }
  for (const m of [PASS, ...moves]) { const q = pos.copy(); if (q.play(m) >= 0 && !kills(q, target, depth - 1)) return false; }
  return true;
}
/** A ladder on the group at `target`: the chaser plays only on its liberties, the runner only extends; true if it dies. */
function ladder(pos, target, depth = 40) {
  const col = pos.b[target];
  if (!col) return true;
  if (depth <= 0) return false;
  const libs = libsOf(pos, target);
  if (libs.size >= 3) return false;
  if (pos.toMove !== col) {
    for (const m of libs) { const q = pos.copy(); if (q.play(m) >= 0 && ladder(q, target, depth - 1)) return true; }
    return false;
  }
  if (!libs.size) return true;
  for (const m of libs) { const q = pos.copy(); if (q.play(m) >= 0 && !ladder(q, target, depth - 1)) return false; }
  return true;
}

/** A net on the group at `target`: the netter has `moves` free moves, the runner only extends (or passes). */
function netted(pos, target, moves) {
  const col = pos.b[target];
  if (!col) return true;
  if (pos.toMove !== col) {
    if (moves <= 0) return false;
    for (const m of pos.legalPoints()) { const q = pos.copy(); if (q.play(m) >= 0 && netted(q, target, moves - 1)) return true; }
    return false;
  }
  const libs = libsOf(pos, target);
  if (!libs.size) return true;
  for (const m of [PASS, ...libs]) { const q = pos.copy(); if (q.play(m) >= 0 && !netted(q, target, moves)) return false; }
  return true;
}

// ---------- every step ----------
const problems = [];
for (const s of steps) {
  const tag = `${s.lesson}`;
  try {
    if (s.play) continue;
    if (!s.say) problems.push(`${tag}: a step with no words`);
    if (s.quiz) {
      if (!(s.answer >= 0 && s.answer < s.quiz.length)) problems.push(`${tag}: the quiz answer is not an option`);
      if (!s.why) problems.push(`${tag}: a quiz needs its why`);
    }
    if (!s.board) { if (!s.quiz) problems.push(`${tag}: a step with no board is a quiz`); continue; }
    const n = sizeOf(s), pos = positionOf(s);
    if (n > 9 || n < 5) problems.push(`${tag}: the board is ${n}x${n}`);
    for (const f of ["mark", "dead", "libs", "count", "neutral"]) if (s[f]) ptsOf(n, s[f]);
    for (const w of Object.keys(s.wrong || {})) ptOf(n, w);
    const answers = ptsOf(n, s.at || s.illegal || s.pick);
    if (!s.quiz && !answers.length && !s.libs && !s.show) problems.push(`${tag}: an exercise names no point`);
    if (answers.length && (!s.then || !s.why)) problems.push(`${tag}: an exercise needs then and why`);
    // the answers are right under judge, and a point nobody wants is wrong
    for (const a of answers) {
      const j = judge(s, a);
      if (!j.ok) problems.push(`${tag}: ${ptName(n, a)} is named as right but judged: ${j.why}`);
      if (s.at && !pos.playable(a)) problems.push(`${tag}: ${ptName(n, a)} is not playable`);
      if (s.illegal && pos.playable(a)) problems.push(`${tag}: ${ptName(n, a)} is playable, so not an illegal answer`);
    }
    let someWrong = false;
    for (let pt = 0; pt < n * n; pt++) if (!answers.includes(pt) && !(s.group && s.pick && ptsOf(n, s.pick).some(w => groupAt(pos, w).includes(pt)))) { someWrong = true; if (judge(s, pt).ok) problems.push(`${tag}: ${ptName(n, pt)} is judged right`); }
    if (answers.length && !someWrong) problems.push(`${tag}: every point is right`);
    for (const [name, why] of Object.entries(s.wrong || {})) { const j = judge(s, ptOf(n, name)); if (j.ok || j.why !== why) problems.push(`${tag}: ${name} should say its own why`); }
  } catch (e) { problems.push(`${tag}: ${e.message}`); }
}
check(!problems.length, `every position parses, every named point exists and is judged as the lesson says${problems.length ? `: ${problems.join("; ")}` : ""}`);

// ---------- the claims, on the board ----------
const claims = [];
const played = (s, pt) => { const p = positionOf(s), got = p.play(pt); return { p, got }; };
for (const s of steps) {
  if (!s.board) continue;
  const n = sizeOf(s), pos = positionOf(s), tag = s.lesson;
  const answers = s.at ? ptsOf(n, s.at) : [];
  for (const a of answers) {
    const { p, got } = played(s, a), name = ptName(n, a);
    if (s.takes != null && got !== s.takes) claims.push(`${tag}: ${name} takes ${got}, not ${s.takes}`);
    if (s.atari) {
      const atari = [...neighbours(n)[a]].some(q => p.b[q] && p.b[q] !== p.b[a] && p.liberties(q) === 1);
      if (!atari || got !== 0) claims.push(`${tag}: ${name} is no atari`);
    }
    if (s.libsAfter != null && p.liberties(a) !== s.libsAfter) claims.push(`${tag}: ${name} leaves ${p.liberties(a)} liberties, not ${s.libsAfter}`);
    if (s.same && new Set(s.same.map(x => groupAt(p, ptOf(n, x)).sort((u, v) => u - v).join())).size !== 1) claims.push(`${tag}: ${s.same} are not one group after ${name}`);
    if (s.cut) {
      const [x, y] = s.cut.map(v => ptOf(n, v));
      if (groupAt(p, x).includes(y)) claims.push(`${tag}: ${s.cut} are still joined after ${name}`);
      if (groupAt(pos, x).includes(y)) claims.push(`${tag}: ${s.cut} start joined`);
    }
    if (s.life) {
      // the target is the group the lesson is about: the black group in both life lessons, Black's own if Black moved
      const target = ptOf(n, "B4"), foe = p.toMove;
      const dead = kills(p, target, 7);
      if ((s.life === "dead") !== dead) claims.push(`${tag}: after ${name} the group should be ${s.life} (search says ${dead ? "dead" : "alive"})`);
      void foe;
    }
    if (s.net && !netted(p, ptOf(n, s.net), 3)) claims.push(`${tag}: ${name} does not net the stone`);
    if (s.ladder) {
      const works = ladder(p, ptOf(n, s.ladder));
      if (!works) claims.push(`${tag}: the ladder after ${name} does not work`);
    }
  }
  for (const w of s.lifeWrong || []) {
    const { p } = played(s, ptOf(n, w));
    if (!kills(p, ptOf(n, "B4"), 7)) claims.push(`${tag}: ${w} should lose the group`);
  }
  for (const w of s.netWrong || []) {
    const { p } = played(s, ptOf(n, w));
    if (netted(p, ptOf(n, s.net), 3)) claims.push(`${tag}: ${w} should let the stone out`);
  }
  for (const w of s.ladderWrong || []) {
    const { p } = played(s, ptOf(n, w));
    if (ladder(p, ptOf(n, s.ladder))) claims.push(`${tag}: ${w} should let the stone run`);
  }
  if (s.life === "dead") {
    for (const w of Object.keys(s.wrong || {})) {
      const { p } = played(s, ptOf(n, w));
      if (kills(p, ptOf(n, "B4"), 7)) claims.push(`${tag}: ${w} should leave Black alive`);
    }
  }
  if (s.quiz && s.count) {
    const libs = pos.liberties(ptOf(n, s.count));
    if (Number(s.quiz[s.answer]) !== libs) claims.push(`${tag}: the group at ${s.count} has ${libs} liberties, the quiz says ${s.quiz[s.answer]}`);
  }
  if (s.libs && !s.quiz) { /* a drawn claim: the dots are the engine's own liberties */ }
  if (s.score) {
    const dead = new Set(ptsOf(n, s.dead)), a = areaScore(pos, dead);
    if (s.score.black !== a.black || s.score.white !== a.white) claims.push(`${tag}: area is ${a.black} to ${a.white}, not ${s.score.black} to ${s.score.white}`);
    if (s.score.dead && s.dead !== s.score.dead) claims.push(`${tag}: the dead stone differs`);
    if (s.score.winner) {
      const w = a.white + 7.5 > a.black ? "w" : "b";
      if (w !== s.score.winner || s.quiz[s.answer][0] !== (w === "w" ? "W" : "B")) claims.push(`${tag}: with komi 7.5 the winner is ${w}`);
    }
    if (s.quiz && !s.score.winner && !s.score.dead && s.quiz[s.answer] !== String(a.black) && s.quiz[s.answer] !== String(a.white)) claims.push(`${tag}: the quiz answer is not a count`);
    if (s.score.dead && s.quiz[s.answer] !== String(a.black)) claims.push(`${tag}: the quiz answer is not Black's count`);
  }
  if (s.neutral) {
    const owner = areaScore(pos).owner[ptOf(n, s.neutral)];
    if (owner !== 0 || s.answer !== 2) claims.push(`${tag}: ${s.neutral} should be neutral`);
  }
}
// a quiz of area asks for Black's count first when it names no score
check(!claims.length, `the claims hold under the rules${claims.length ? `: ${claims.join("; ")}` : ""}`);

// ---------- particular lessons ----------
{ // a first-line eye of three really is two eyes only if the middle is played, and a false eye really is false
  const dead = byId("vital").steps[0], eyes = byId("false").steps[0], n = 5;
  const pos = positionOf(eyes);
  check(pos.playable(ptOf(n, "B5")) && !pos.playable(ptOf(n, "D5")), "false eye: White may play B5 and not D5");
  check(positionOf(dead).liberties(ptOf(n, "B4")) === 3, "the eye space has three liberties");
}
{ // ko: no recapture at once, but after a move elsewhere on each side the point is open again
  const ko = byId("ko").steps[1], n = 5, pos = positionOf(ko);
  check(pos.ko === ptOf(n, "C3") && !pos.playable(ptOf(n, "C3")), "ko: White may not retake at once");
  pos.play(ptOf(n, "E1")); pos.play(ptOf(n, "A1"));
  check(pos.playable(ptOf(n, "C3")), "ko: after a move elsewhere on each side White may retake");
}
{ // area scoring with komi, as the lessons say it
  const s = byId("area").steps[2], pos = positionOf(s), a = areaScore(pos);
  check(a.black === 15 && a.white === 10 && a.white + 7.5 > a.black, "area: 15 to 10 plus komi 7.5 is a White win");
}

check(bad === 0 && (console.log(bad ? "" : "all good"), true), "done");
process.exit(bad ? 1 : 0);
void BLACK; void WHITE; void Position;
