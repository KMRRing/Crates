// Bones' course (bones-course.js on course.js): every exercise worked through the rules (bones-rules.js). Every line
// written is a real line, its tiles touching, and no step shows a tile twice; every fits exercise has as many tiles to
// find as its words promise; every tile asked for can be laid, its answer is judged right, every wrong play it has
// words for is judged wrong with them, and of every play the hand could make only those the lesson means are right;
// every Fives and Threes figure quoted is what the ends make; the scores the lessons work out (a side going out, a
// blocked hand, Gaple's chips) are what the rules' own scoring gives; the stage, on a page made of plain objects, takes
// every exercise to its end by taps; the course keeps its progress.
import { COURSE, parseLine, parseTiles, tableOf, tilesOf, judge, playsFor, fittingOf, scoreOf, bestScore, withPlay, tileStage, tileName } from "../bones-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { rules, TILES, legalPlays, endsOf, endsTotal, fivesPoints, idOf, pipsOf } from "../bones-rules.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE);

check(COURSE.chapters.length >= 1 && COURSE.chapters[0].id === "game" && COURSE.chapters.every(c => c.title), "the course starts with the game");
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length, `${LESSONS.length} lessons, each with its own id`);
check(LESSONS.every(x => x.lesson.steps.length && x.lesson.title), "every lesson has steps and a title");
const first = COURSE.chapters[0].lessons.at(-1);
check(first.steps.at(-1).play === true && LESSONS.every(x => x.lesson === first || x.lesson.steps.every(s => !s.play)), "the game's chapter ends in a game, and only it");

// ---------- every step ----------
let lines = 0, fits = 0, lays = 0, judged = 0, goals = 0, quizzes = 0, totals = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`;
  if (!st.say || /undefined/.test(st.say)) problems.push(`${where}: no words`);
  let tiles;
  try { tiles = tilesOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
  if (st.line) lines++;
  const shown = [...tiles.laid, ...tiles.hand];
  if (new Set(shown).size !== shown.length) problems.push(`${where}: a tile both on the line and in the hand, or twice`);
  for (const r of tiles.rows) if (r && new Set(r).size !== r.length) problems.push(`${where}: a row shows a tile twice`);
  if (!(st.rows || []).length && st.line == null && !st.play) problems.push(`${where}: nothing on the stage`);
  for (const r of st.rows || []) if (!r.tiles && !r.text) problems.push(`${where}: a row with nothing in it`);
  if (st.total) {
    totals++;
    const s = tableOf(st), total = endsTotal(s), pts = fivesPoints(total);
    if (!st.hand && (!st.say.includes(String(total)) || !st.say.includes(`${pts} point`))) problems.push(`${where}: the ends make ${total}, ${pts} points, and the words don't say so`);
    if (st.hand && !st.say.includes(`make ${total}`)) problems.push(`${where}: the ends make ${total}, and the words don't say so`);
  }
  if (st.fits) {
    fits++;
    const n = fittingOf(st).length;
    if (!n) problems.push(`${where}: no tile fits`);
    if (n !== st.count) problems.push(`${where}: ${n} tiles fit, the lesson says ${st.count}`);
    if (!st.then) problems.push(`${where}: no words for the end`);
    if (st.answer != null || st.goal) problems.push(`${where}: a fits exercise that also asks for a play`);
  }
  const plays = st.line != null && st.hand ? legalPlays(tableOf(st), 0) : [];
  if (st.answer != null && !st.quiz) {
    lays++;
    if (!playsFor(st, st.answer).length) problems.push(`${where}: the answer ${st.answer} can't be laid`);
    for (const k of [st.answer, ...(st.accept || [])]) for (const p of playsFor(st, k)) if (!judge(st, p).ok) problems.push(`${where}: ${k} is judged wrong`);
    for (const [k, words] of Object.entries(st.wrong || {})) {
      const ps = playsFor(st, k);
      if (!ps.length) problems.push(`${where}: the wrong play ${k} can't be laid`);
      for (const p of ps) { const res = judge(st, p); if (res.ok || res.why !== words) problems.push(`${where}: the wrong play ${k} isn't judged so`); }
    }
    // every play the hand could make: the right ones are the lesson's
    const right = new Set([st.answer, ...(st.accept || [])].flatMap(k => playsFor(st, k)).map(p => `${p.tile}${p.end}`));
    for (const p of plays) {
      judged++;
      if (judge(st, p).ok !== right.has(`${p.tile}${p.end}`)) problems.push(`${where}: ${tileName(p.tile)} on ${p.end} is judged ${judge(st, p).ok ? "right" : "wrong"}`);
    }
    if (!st.then) problems.push(`${where}: no words for the right play`);
  }
  if (st.goal === "most") {
    goals++;
    const s = tableOf(st), best = bestScore(s), right = plays.filter(p => judge(st, p).ok);
    judged += plays.length;
    if (best !== st.pts) problems.push(`${where}: the best play scores ${best}, the lesson says ${st.pts}`);
    if (!right.length || right.some(p => scoreOf(s, p).pts !== best)) problems.push(`${where}: a play that doesn't score most is judged right`);
    if (plays.filter(p => scoreOf(s, p).pts === best).length !== right.length) problems.push(`${where}: a play that scores most is judged wrong`);
    if (plays.every(p => scoreOf(s, p).pts === best)) problems.push(`${where}: every play scores as much`);
    const { total } = scoreOf(s, right[0]);
    if (!st.then || !st.then.includes(String(total)) || !st.then.includes(`${best} points`)) problems.push(`${where}: the words don't say the best play makes ${total}, ${best} points`);
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length)) problems.push(`${where}: the answer isn't an option`);
    if (!st.why) problems.push(`${where}: no words for the answer`);
    const said = st.quiz[st.answer], ends = /^(\d) and (\d)$/.exec(said);
    if (ends && st.line) { const e = endsOf(tableOf(st)); if (`${e.L} and ${e.R}` !== said) problems.push(`${where}: the ends show ${e.L} and ${e.R}, the answer says ${said}`); }
    if (said === "Knock" && plays.length) problems.push(`${where}: the answer is to knock, and a tile fits`);
    if (st.hand && st.line && said !== "Knock" && /^Knock$/m.test(st.quiz.join("\n")) && !plays.length) problems.push(`${where}: nothing fits, and the answer isn't to knock`);
  }
});
check(!problems.length, `every step works: ${lines} lines, ${fits} hands to find the fits in, ${lays} tiles to lay and ${goals} to score with (${judged} plays judged), ${quizzes} questions, ${totals} totals`);
for (const p of problems) console.log(`     ${p}`);

// ---------- parsing ----------
const L = parseLine("1-3 3-6 [6-6] 6-2");
check(L.first === idOf(6, 6) && L.left.map(x => x.v).join() === "3,1" && L.right.map(x => x.v).join() === "2", "a line reads outward from its first tile, each tile with the number it leaves open");
let threw = false;
try { parseLine("1-3 4-6 [6-6]"); } catch { threw = true; }
check(threw, "a line whose tiles don't touch is refused");
check(parseTiles("6-4 5-5").join() === `${idOf(6, 4)},${idOf(5, 5)}`, "tiles are read as the rules' ids");
const fx = tableOf({ line: "[6-4]", game: "fives" });
check(endsTotal(fx) === 10 && scoreOf(withPlay(fx, { tile: idOf(4, 4), end: "R" }), { tile: idOf(6, 1), end: "L" }).total === 9, "a play's score counts the ends it leaves, a double at an end both halves");

// ---------- the scores the lessons work out, by the rules ----------
const base = (game, hands, line, turn) => {
  const l = parseLine(line);
  return { game, seats: 4, opts: { ...(game === "gaple" ? { deals: 8, stuck: "pass", blank25: false } : { target: 100, count: "losers" }) }, handNo: 1, starter: 0, history: [], scores: [0, 0, 0, 0].slice(0, game === "gaple" ? 4 : 2),
    hands: hands.map(parseTiles), dead: [[], [], [], []], first: l.first, firstSides: l.firstSides, left: l.left, right: l.right, passes: 0, out: [], log: [], step: "play", turn, boneyard: [] };
};
const lesson = id => LESSONS.find(x => x.lesson.id === id).lesson;
const ctx = { rng: Math.random, now: 0 };
{
  // Tito goes out: Rosa and Marisol's tiles as the lesson shows them
  const st = lesson("partnership").steps.find(s => /Tito goes out/.test(s.say));
  const rosa = st.rows[0].tiles, marisol = st.rows[1].tiles;
  const s = rules.act(base("partnership", ["0-0", rosa, "6-1", marisol], "[1-3]", 2), 2, { t: "play", tile: idOf(6, 1), end: "L" }, ctx);
  check(s.result?.how === "domino" && s.result.delta[0] === Number(st.quiz[st.answer]), `Tito out: your side scores ${s.result?.delta[0]}, as the lesson says`);
}
{
  // blocked: both ends a 4, every 4 down; the side holding fewer scores the other side's
  const st = lesson("partnership").steps.find(s => /^Blocked, with these tiles left/.test(s.say));
  const ours = parseTiles(st.rows[0].tiles), theirs = parseTiles(st.rows[1].tiles), str = ts => ts.map(t => tileName(t).replace("–", "-")).join(" ");
  const blocked = lesson("partnership").steps.find(s => /blocked \(tranque\)/.test(s.say)).line;
  let s = base("partnership", [str(ours.slice(0, 2)), str(theirs.slice(0, 2)), str(ours.slice(2)), str(theirs.slice(2))], blocked, 0);
  check(tilesOf({ line: blocked }).laid.filter(t => TILES[t].includes(4)).length === 7 && [endsOf(s).L, endsOf(s).R].join() === "4,4", "the blocked line: both ends a 4, all seven fours down");
  for (let seat = 0; seat < 4 && s.step === "play"; seat++) s = rules.act(s, seat, { t: "pass" }, ctx);
  const want = Number(/\d+/.exec(st.quiz[st.answer])[0]);
  check(s.result?.how === "blocked" && s.result.team === 0 && s.result.delta[0] === want && ours.reduce((a, t) => a + pipsOf(t), 0) === 20, `blocked, 20 against 24: your side scores ${s.result?.delta[0]}`);
}
{
  // Gaple, blocked with 9, 4, 12 and 15 left: you get 4, Budi takes 24
  let s = base("gaple", ["6-3", "3-1", "6-6", "6-5 2-2"], lesson("partnership").steps.find(x => /blocked \(tranque\)/.test(x.say)).line, 0);
  check(s.hands.map(h => h.reduce((a, t) => a + pipsOf(t), 0)).join() === "9,4,12,15", "Gaple's example: 9, 4, 12 and 15 pips left");
  for (let seat = 0; seat < 4 && s.step === "play"; seat++) s = rules.act(s, seat, { t: "pass" }, ctx);
  const st = lesson("gaple").steps.find(x => x.quiz);
  check(s.result?.winner === 1 && `+${s.result.delta[0]}` === st.quiz[st.answer] && s.result.delta[1] === 24 && /24/.test(st.why), `Gaple blocked: you ${s.result?.delta[0] > 0 ? "+" : ""}${s.result?.delta[0]}, Budi ${s.result?.delta[1]}`);
}

// ---------- the stage, tapped through ----------
// a page of plain objects: the box keeps what's drawn and the listeners; a tap is an event whose target finds the
// tile or the end it's on
function fakeBox() {
  const on = {};
  return { innerHTML: "", addEventListener: (k, f) => { on[k] = f; }, on };
}
const tapOn = (attr, value) => ({ target: { closest: sel => (sel === `[${attr}]` ? { dataset: { [attr === "data-hand" ? "hand" : "end"]: String(value) } } : null) } });
let walked = 0;
const stuck = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((step, i) => {
  if (!(step.fits || (step.answer != null && !step.quiz) || step.goal)) return;
  const where = `${l.id} step ${i + 1}`, stage = tileStage(), box = fakeBox(), st = { done: false, tries: 0 };
  let res = null;
  stage.mount(box, { changed: () => stage.draw(step, st), answer: r => { res = r; if (r.ok) st.done = r.done !== false; stage.draw(step, st); } });
  stage.draw(step, st);
  if (!/lb-line|lb-empty/.test(box.innerHTML) || !/data-hand/.test(box.innerHTML)) stuck.push(`${where}: the line or the hand isn't drawn`);
  if (step.fits) {
    // a tile that doesn't fit is a miss; every one that fits, tapped, ends the step
    const miss = parseTiles(step.hand).find(t => !fittingOf(step).includes(t));
    if (miss != null) { box.on.click(tapOn("data-hand", miss)); if (res?.ok !== false) stuck.push(`${where}: a tile that doesn't fit isn't a miss`); }
    for (const t of fittingOf(step)) box.on.click(tapOn("data-hand", t));
    if (!res?.ok || !st.done) stuck.push(`${where}: finding every tile doesn't end it`);
  } else {
    // the hint's play, tapped and laid: the tile, the end if it asks, then the button
    const want = {};
    stage.hint(step, want);
    box.on.click(tapOn("data-hand", want.tile ?? want.sel));
    if (st.sel !== want.sel) stuck.push(`${where}: a tap doesn't pick the tile`);
    if (st.end == null) box.on.click(tapOn("data-end", want.end));
    if (!stage.ready(step, st) || !/^(Lay|Lead) /.test(stage.label(step, st))) stuck.push(`${where}: the tile picked can't be laid (${stage.label(step, st)})`);
    const r = stage.submit(step, st);
    if (!r.ok) stuck.push(`${where}: the hint's play is judged wrong: ${r.why}`);
    st.done = true;
    stage.draw(step, st);
    if (box.innerHTML.includes(`data-hand="${want.sel}"`)) stuck.push(`${where}: the tile laid is still in the hand`);
  }
  walked++;
});
check(!stuck.length && walked === fits + lays + goals, `the stage takes all ${walked} exercises to their end by taps`);
for (const p of stuck) console.log(`     ${p}`);

// ---------- the progress kept ----------
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const pr = progressOf("bones", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length && pr.next.lesson.id === LESSONS[0].lesson.id, `nothing done yet: ${pr.done} of ${pr.of}, the first lesson next`);
store["bones:course"] = JSON.stringify({ done: { [LESSONS[0].lesson.id]: 1 }, at: null });
check(progressOf("bones", COURSE).next.lesson.id === LESSONS[1].lesson.id, "one lesson done: the second next");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
