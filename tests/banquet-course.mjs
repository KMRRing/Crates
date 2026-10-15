// Banquet's course (banquet-course.js: Learn Banquet, on course.js): every exercise worked through the rules
// (banquet-rules.js). Every hand shown is one the game has; every tap exercise has as many calls to find as its words
// say, the hand's own (no 臭拳), and every call outside them is refused with why; every call to make is one the hand may
// make and judged right, and of the calls only the meant ones are; the figures the lessons quote are worked out again
// (the totals, the verses' numbers, who drinks, the caller's two in a row by the rules themselves, the odds by counting,
// the likeliest total from the other's last throws as Sharp weighs them, the sequence Sharp reads best); the stage
// takes every exercise to its end by taps; the course keeps its progress.
import { COURSE, CALLS, callWords, wantedOf, whyNot, judge, handStage } from "../banquet-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { rules, HUA, SHIWU, HANDS, callsFor } from "../banquet-rules.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const LESSONS = lessonsOf(COURSE), WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const modeOf = s => s.mode || "huaquan";

check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.every(x => x.lesson.steps.length && x.lesson.title), `${LESSONS.length} lessons, each with its own id, steps and a title`);
const ends = COURSE.chapters.map(c => c.lessons.at(-1));
check(ends.every(l => l.steps.at(-1).play === true) && LESSONS.every(x => (ends.includes(x.lesson) ? x.lesson.steps.slice(0, -1) : x.lesson.steps).every(s => !s.play)), "each chapter ends in a game, and nothing else does");

let taps = 0, calls = 0, quizzes = 0;
const problems = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((st, i) => {
  const where = `${l.id} step ${i + 1}`, mode = modeOf(st), hands = HANDS[mode];
  if (!st.say) problems.push(`${where}: no words`);
  for (const n of [...(st.show || []), ...(st.history || []), ...[st.mine, st.theirs].filter(x => x != null)]) if (!hands.includes(n)) problems.push(`${where}: no hand of ${n} in ${mode}`);
  for (const [who, c] of Object.entries(st.calls || {})) if (!callsFor(mode, st[who]).includes(c)) problems.push(`${where}: ${who} can't call ${c}`);
  if (!st.play && !st.show && !st.verses && !st.rows && st.mine == null && !st.history && !st.quiz) problems.push(`${where}: nothing on the stage`);
  if (st.tap) {
    taps++;
    const want = wantedOf(st);
    if (want.length !== st.count || !st.then) problems.push(`${where}: ${want.length} calls to find, the lesson says ${st.count}`);
    for (const c of CALLS[mode]) if (!want.includes(c) !== !!whyNot(st, c)) problems.push(`${where}: ${c} is ${want.includes(c) ? "wanted but refused" : "not wanted, yet allowed"}`);
  }
  if (st.answer != null && !st.quiz) {
    calls++;
    const right = new Set([st.answer, ...(st.accept || [])]);
    if (!callsFor(mode, st.mine).includes(st.answer)) problems.push(`${where}: the answer ${st.answer} can't be called`);
    for (const c of CALLS[mode]) if (judge(st, c).ok !== right.has(c)) problems.push(`${where}: ${c} is judged ${judge(st, c).ok ? "right" : "wrong"}`);
    for (const [c, words] of Object.entries(st.wrong || {})) { const res = judge(st, Number(c)); if (res.ok || res.why !== words) problems.push(`${where}: the wrong call ${c} isn't judged so`); }
    if (!st.then) problems.push(`${where}: no words for the right call`);
  }
  if (st.quiz) {
    quizzes++;
    if (!(st.quiz.length >= 2 && st.answer >= 0 && st.answer < st.quiz.length) || !st.why) problems.push(`${where}: the answer isn't an option, or has no words`);
  }
});
check(!problems.length, `every step works: ${taps} hands to tap the calls of, ${calls} calls to make, ${quizzes} questions`);
for (const p of problems) console.log(`     ${p}`);

// ---------- the figures ----------
const step = (id, f) => LESSONS.find(x => x.lesson.id === id).lesson.steps.find(f);
const said = s => s.quiz[s.answer];
const fingers = step("hand", s => s.quiz);
check(said(fingers) === WORDS[fingers.show[0]], `a hand of ${fingers.show[0]}: "${said(fingers)}"`);
const total = step("total", s => s.quiz);
check(said(total) === WORDS[total.mine + total.theirs] && total.total === total.mine + total.theirs, `the total: ${total.mine} and ${total.theirs}, "${said(total)}"`);
const verses = LESSONS.find(x => x.lesson.id === "verses").lesson.steps.filter(s => s.quiz);
// a verse asked about by its characters is answered with its number; a number asked about, with its verse
check(verses.every(s => (/^[A-Z]/.test(said(s)) ? said(s) === WORDS[s.verse] && s.say.includes(HUA[s.verse].zh) : said(s) === HUA[s.verse].zh)), "the verses' numbers, as the game has them");
check(HUA[3].zh === "三星照" && HUA[5].zh === "五魁首" && HUA[10].zh === "十全美" && callWords("shiwu", 15).zh === "十五", "the verses quoted are the game's");

// who drinks, by the rules: both throws made on a fresh 划拳 table
function play(mode, a, b) {
  let s = rules.deal({ options: { mode, limit: 3 }, rng: () => 0.1 });
  const first = s.first, order = [first, 1 - first], th = { [0]: a, [1]: b };
  for (const seat of order) { s = rules.act(s, seat, { t: "throw", ...th[seat] }, { now: 0 }); if (typeof s === "string") throw new Error(s); }
  return s;
}
for (const s of LESSONS.find(x => x.lesson.id === "drink").lesson.steps.filter(x => x.quiz)) {
  const r = play("huaquan", { hand: s.mine, call: s.calls.mine }, { hand: s.theirs, call: s.calls.theirs }).last;
  const words = r.loser === 1 ? "They drink" : r.loser === 0 ? "You drink" : "Again";
  check(said(s) === words, `${s.calls.mine} against ${s.calls.theirs} with hands ${s.mine} and ${s.theirs}: "${words}"`);
}
const sw = step("shiwu", s => s.quiz);
check(said(sw) === SHIWU[sw.mine + sw.theirs].zh && sw.total === sw.mine + sw.theirs, `十五二十: ${sw.mine} and ${sw.theirs}, "${said(sw)}"`);
{
  // the caller right twice running: the other drinks, and calls next
  let s = rules.deal({ options: { mode: "shiwu", limit: 3 }, rng: () => 0.1 });
  const c = s.caller;
  for (let k = 0; k < 2; k++) {
    for (const seat of [s.first, 1 - s.first]) s = rules.act(s, seat, seat === c ? { t: "throw", hand: 5, call: 10 } : { t: "throw", hand: 5 }, { now: 0 });
    if (k === 0) s = rules.wake(s, { now: 99999 });
  }
  const rt = step("caller", x => x.rights);
  check(s.last.loser === 1 - c && s.caller === 1 - c && said(rt) === "They drink, and call next", "right twice running: they drink, and call next");
}

// the odds, counted
const odds = step("odds", s => s.odds), hit = HANDS.huaquan.filter(t => odds.mine + t === odds.odds.call).length;
check(said(odds) === `${hit} in ${HANDS.huaquan.length}` && odds.odds.n === hit, `${HUA[odds.odds.call].zh} with three, against a random hand: ${hit} in 6`);
// the likeliest total from the other's last throws, as Sharp weighs them (each once, the last four one and a half more)
for (const s of LESSONS.find(x => x.lesson.id === "habits").lesson.steps) {
  const w = new Map();
  s.history.forEach((x, i) => w.set(x, (w.get(x) || 0) + 1 + (i >= s.history.length - 4 ? 1.5 : 0)));
  const ranked = [...w].sort((a, b) => b[1] - a[1]);
  check(ranked[0][1] > ranked[1][1] && s.answer === s.mine + ranked[0][0], `their last throws ${s.history.join(" ")}: they favour ${ranked[0][0]}, so ${s.answer}`);
}
{
  const hide = step("hide", s => s.quiz), top = seq => Math.max(...[0, 1, 2, 3, 4, 5].map(n => seq.split(" ").filter(x => Number(x) === n).length));
  check(hide.quiz.every((q, i) => i === hide.answer || top(q) < top(hide.quiz[hide.answer])) && top(said(hide)) === 7, `the sequence Sharp reads best: seven of one hand in ten`);
}
{
  // 十五二十 against hands opened at random: the four ways two hands fall, and each call's chance
  const falls = [0, 5, 5, 10], chance = (mine, c) => falls.filter(t => mine + t === c).length / 4;
  const steps = LESSONS.find(x => x.lesson.id === "shiwuodds").lesson.steps.filter(s => s.answer != null);
  check(steps.every(s => callsFor("shiwu", s.mine).every(c => chance(s.mine, c) <= chance(s.mine, s.answer)) && chance(s.mine, s.answer) === 0.5), "showing five or ten against hands opened at random: five more is right half the time, the others a quarter");
  const mix = step("mixer", s => s.mixer);
  check(said(mix) === "1 in 3", "against a mixer: one in three");
}

// ---------- the stage, tapped through ----------
function fakeBox() { const on = {}; return { innerHTML: "", addEventListener: (k, f) => { on[k] = f; }, on }; }
const tapOn = c => ({ target: { closest: sel => (sel === "[data-call]" ? { dataset: { call: String(c) } } : null) } });
let walked = 0;
const stuck = [];
for (const { lesson: l } of LESSONS) l.steps.forEach((s, i) => {
  if (!(s.tap || (s.answer != null && !s.quiz))) return;
  const where = `${l.id} step ${i + 1}`, stage = handStage(), box = fakeBox(), t = { done: false };
  let res = null;
  stage.mount(box, { changed: () => stage.draw(s, t), answer: x => { res = x; if (x.ok) t.done = true; stage.draw(s, t); } });
  stage.draw(s, t);
  if (!/lbq-calls/.test(box.innerHTML)) stuck.push(`${where}: no calls drawn`);
  if (s.tap) {
    const want = wantedOf(s), miss = CALLS[modeOf(s)].find(c => !want.includes(c));
    if (miss != null) { box.on.click(tapOn(miss)); if (res?.ok !== false) stuck.push(`${where}: a call the hand can't make isn't a miss`); }
    for (const c of want) box.on.click(tapOn(c));
    if (!res?.ok || !t.done) stuck.push(`${where}: finding every call doesn't end it`);
  } else {
    box.on.click(tapOn(s.answer));
    if (t.sel !== s.answer || !stage.ready(s, t) || !/^Call /.test(stage.label(s, t)) || !stage.submit(s, t).ok) stuck.push(`${where}: a tap on the answer doesn't make the call`);
  }
  walked++;
});
check(!stuck.length && walked === taps + calls, `the stage takes all ${walked} exercises to their end by taps`);
for (const p of stuck) console.log(`     ${p}`);

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const pr = progressOf("banquet", COURSE);
check(pr.done === 0 && pr.of === LESSONS.length, `nothing done yet: ${pr.done} of ${pr.of}`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
