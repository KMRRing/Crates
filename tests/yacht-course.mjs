// Yacht's course (yacht-course.js) worked through the engine: every score a step quotes is yacht-rules.js's, every chance
// an exact count over the dice (holding what the step says, or the commonest face), every hold and box one the Hard
// computer player makes, every percentage in a lesson's words one a step checks, and every exercise has its answer.
import { COURSE, IDS, parseDice, maskFor, judgeHold, judgePick } from "../yacht-course.js";
import { CATS, scoreOf, totals, countsOf, BONUS, YACHT, CHOICE, FOUR, LITTLE, BIG, HOUSE } from "../yacht-rules.js";
import { botMove } from "../yacht-bot.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const lessons = COURSE.chapters.flatMap(c => c.lessons);
check(new Set(lessons.map(l => l.id)).size === lessons.length, "every lesson has an id of its own");

// ---------- exact chances ----------
const GOALS = {
  yacht: d => scoreOf(YACHT, d) > 0, four: d => scoreOf(FOUR, d) > 0, house: d => scoreOf(HOUSE, d) > 0, little: d => scoreOf(LITTLE, d) > 0,
  straight: d => scoreOf(LITTLE, d) > 0 || scoreOf(BIG, d) > 0,
};
const modal = d => { const c = countsOf(d); let f = 1; for (let i = 2; i <= 6; i++) if (c[i] > c[f]) f = i; return d.filter(x => x === f); };
/** The chance the goal is met by the end, rolling every die not kept (keepOf), `left` rolls to come; memoised on the dice. */
function chance(dice, left, goal, keepOf) {
  const memo = new Map();
  const go = (d, n) => {
    if (goal(d)) return 1;
    if (!n) return 0;
    const key = `${[...d].sort().join("")}/${n}`;
    if (memo.has(key)) return memo.get(key);
    const kept = keepOf(d), k = 5 - kept.length, total = 6 ** k;
    let t = 0;
    for (let i = 0; i < total; i++) {
      let x = i;
      const r = [];
      for (let j = 0; j < k; j++, x = Math.floor(x / 6)) r.push(1 + (x % 6));
      t += go([...kept, ...r], n - 1);
    }
    memo.set(key, t / total);
    return t / total;
  };
  return go(dice, left);
}
/** The same from nothing rolled yet: the first roll is all five dice. */
function chanceFromScratch(left, goal, keepOf) {
  const memo = new Map();
  const go = (d, n) => {
    if (d && goal(d)) return 1;
    if (!n) return 0;
    const key = d ? `${[...d].sort().join("")}/${n}` : `-/${n}`;
    if (memo.has(key)) return memo.get(key);
    const kept = d ? keepOf(d) : [], k = 5 - kept.length, total = 6 ** k;
    let t = 0;
    for (let i = 0; i < total; i++) {
      let x = i;
      const r = [];
      for (let j = 0; j < k; j++, x = Math.floor(x / 6)) r.push(1 + (x % 6));
      t += go([...kept, ...r], n - 1);
    }
    memo.set(key, t / total);
    return t / total;
  };
  return go(null, left);
}
const keepFaces = faces => d => { const out = []; for (const f of faces) if (d.includes(f)) out.push(f); return out; };
const aim = f => d => d.filter(x => x === f);
const round1 = x => Math.round(x * 1000) / 10;

function oddsOf(o) {
  const dice = o.dice ? parseDice(o.dice) : null;
  if (o.goal === "face3" || o.goal === "face4") {
    const n = o.goal === "face3" ? 3 : 4;
    return chanceFromScratch(o.left, d => d.filter(x => x === 4).length >= n, aim(4));
  }
  const keep = o.keep ? keepFaces(parseDice(o.keep)) : modal;
  return dice ? chance(dice, o.left, GOALS[o.goal], keep) : chanceFromScratch(o.left, GOALS[o.goal], keep);
}

// ---------- the hard computer player's choice ----------
function hardChoice(step) {
  const dice = parseDice(step.dice), sheet = Array(12).fill(-1);
  for (const [id, v] of Object.entries(step.taken || {})) sheet[IDS.indexOf(id)] = v;
  const m = botMove({ left: step.left, sheets: [sheet], dice, held: [0, 0, 0, 0, 0] }, 0, { level: "hard" });
  return m.t === "score" ? { box: IDS[m.c] } : { hold: dice.filter((_, i) => m.hold[i]).sort().join(" ") };
}

let steps = 0, odds = 0, scores = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  const text = [s.say, s.why, s.then, ...(s.quiz || []), ...Object.values(s.wrong || {})].filter(Boolean).join(" ");
  if (s.quiz) {
    check(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && s.why, `${where}: an answer among the options, and why`);
    check(new Set(s.quiz).size === s.quiz.length, `${where}: options that differ`);
  }
  let dice = null;
  if (s.dice) {
    dice = parseDice(s.dice);
    check(dice.length === 5 && dice.every(d => d >= 1 && d <= 6) && [0, 1, 2, 3].includes(s.left), `${where}: five dice and the rolls left`);
  }
  for (const [id, v] of Object.entries(s.taken || {})) {
    const c = IDS.indexOf(id);
    check(c >= 0 && v >= 0 && (c >= 6 || (v % (c + 1) === 0 && v <= 5 * (c + 1))), `${where}: ${id} written as ${v} could happen`);
  }
  if (s.hold) {
    check(dice && s.left > 0 && s.left < 3, `${where}: a hold over dice with a roll to come`);
    const want = parseDice(s.hold), mask = maskFor(dice, want);
    check(judgeHold(s, mask).ok, `${where}: the answer is judged right`);
    check(!judgeHold(s, dice.map(() => 0)).ok && !judgeHold(s, dice.map(() => 1)).ok, `${where}: nothing held and everything held are wrong`);
    check(mask.filter(Boolean).length === want.length, `${where}: the dice to hold are there`);
    const h = hardChoice(s);
    check(h.hold === [...want].sort().join(" "), `${where}: Hard holds ${s.hold} (it holds ${h.hold ?? h.box})`);
    if (s.after) {
      const after = parseDice(s.after);
      check(after.length === 5 && mask.every((m, k) => !m || after[k] === dice[k]), `${where}: the held dice stay where they are`);
    }
  }
  if (s.pick) {
    check(dice && s.left === 0 && IDS.includes(s.pick) && !(s.pick in (s.taken || {})), `${where}: a box to pick over finished dice`);
    check(judgePick(s, IDS.indexOf(s.pick)).ok, `${where}: the answer is judged right`);
    const h = hardChoice(s);
    check(h.box === s.pick, `${where}: Hard writes them in ${s.pick} (it picks ${h.box ?? h.hold})`);
    for (const id of Object.keys(s.wrong || {})) check(IDS.includes(id) && !judgePick(s, IDS.indexOf(id)).ok, `${where}: wrong box ${id}`);
  }
  if (s.play) check(l.steps.at(-1) === s, `${where}: the game is the last step`);

  const c = s.check || {};
  for (const [d, id, pts] of c.scores || []) {
    scores++;
    const got = scoreOf(IDS.indexOf(id), parseDice(d));
    check(got === pts, `${where}: ${d} in ${id} scores ${got}, not ${pts}`);
    if (pts > 0) check(new RegExp(`(^|[^\\d.])${pts}([^\\d]|$)`).test(text), `${where}: the text quotes ${pts}`);
  }
  const spoken = [s.say, s.why, s.then, ...Object.values(s.wrong || {})].filter(Boolean).join(" ");
  const said = new Set((spoken.match(/\d+(\.\d+)?%/g) || []).map(x => x.slice(0, -1)));
  const proved = new Set();
  for (const o of c.odds || []) {
    odds++;
    const p = oddsOf(o);
    check(round1(p) === o.pct, `${where}: ${o.goal} ${o.dice ?? "from nothing"} with ${o.left} left is ${round1(p)}%, not ${o.pct}%`);
    if (o.frac) check(Math.abs(p - o.frac[0] / o.frac[1]) < 1e-12, `${where}: exactly ${o.frac.join(" in ")}`);
    proved.add(String(o.pct));
  }
  for (const p of said) check(proved.has(p), `${where}: ${p}% is stated but not checked`);
  for (const p of proved) check(said.has(p), `${where}: ${p}% is checked but not stated`);
  if (c.mean?.choice !== undefined) {
    let sum = 0;
    for (let n = 0; n < 7776; n++) { let x = n; const d = []; for (let j = 0; j < 5; j++, x = Math.floor(x / 6)) d.push(1 + (x % 6)); sum += scoreOf(CHOICE, d); }
    check(Math.abs(sum / 7776 - c.mean.choice) < 1e-9, `${where}: five dice average ${sum / 7776}`);
  }
  if (c.mean?.aim !== undefined) {
    // the dice of one face after three rolls holding it: each die has shown it by the third roll with chance 1 - (5/6)^3
    const memo = new Map();
    const after = (k, n) => {
      if (!n) return k;
      const key = `${k}/${n}`;
      if (memo.has(key)) return memo.get(key);
      const m = 5 - k;
      let t = 0;
      for (let i = 0; i < 6 ** m; i++) { let x = i, hit = 0; for (let j = 0; j < m; j++, x = Math.floor(x / 6)) if (x % 6 === 0) hit++; t += after(k + hit, n - 1); }
      memo.set(key, t / 6 ** m);
      return t / 6 ** m;
    };
    const mean = after(0, 3);
    check(Math.abs(mean - 5 * (1 - (5 / 6) ** 3)) < 1e-9 && Math.round(mean * 10) / 10 === c.mean.aim, `${where}: aiming at a face gives ${mean} of it`);
  }
  if (c.mean?.yachtPoints !== undefined) check(Math.round(oddsOf({ goal: "yacht", dice: null, left: 3 }) * 50 * 10) / 10 === c.mean.yachtPoints, `${where}: a Yacht turn is worth ${c.mean.yachtPoints} points`);
  if (c.upper) {
    const sheet = IDS.map(id => c.upper.taken[id] ?? -1);
    check(c.upper.needs === Math.max(0, 63 - totals(sheet).upper), `${where}: the bonus needs ${63 - totals(sheet).upper} more`);
  }
  for (const b of c.bonus || []) {
    const sheet = IDS.map(id => b.taken[id] ?? -1);
    check(totals(sheet).bonus === b.bonus && (b.bonus === 0 || b.bonus === BONUS), `${where}: ${JSON.stringify(b.taken)} earns ${b.bonus}`);
  }
});
check(CATS.length === 12, "twelve boxes");
check(steps > 25, "a course of some size");

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log(`ok  Yacht's course: ${lessons.length} lessons, ${steps} steps, ${scores} scores and ${odds} chances proved`);
