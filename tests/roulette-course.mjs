// Roulette's course (roulette-course.js) worked through the rules: every lesson's id its own, every choice's answer one
// of its options and why, every payout a lesson works out what the bet pays, every bet a picture puts on the layout one
// the layout takes, and every screen's numbers real.
import { COURSE } from "../roulette-course.js";
import { payout, validBet, WHEEL } from "../roulette-engine.js";
import { parsePockets } from "../roulette-stage.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const lessons = COURSE.chapters.flatMap(c => c.lessons), ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "every lesson has an id of its own");
let steps = 0, pays = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  if (s.quiz) check(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && s.why, `${where}: an answer among the options, and why`);
  if (s.layout) {
    const keys = [...Object.keys(s.layout.bets || {}), ...(s.layout.lit || [])];
    check(keys.every(validBet), `${where}: every bet one the layout takes (${keys.filter(k => !validBet(k)).join(", ")})`);
    if (s.layout.dolly != null) check(WHEEL.includes(s.layout.dolly), `${where}: the dolly on a number`);
    if (s.layout.lit && s.layout.dolly != null) check(s.layout.lit.every(k => payout(k, 1, s.layout.dolly) > 0), `${where}: the bets lit are the winners`);
  }
  if (s.screen) check(parsePockets(s.screen).every(p => WHEEL.includes(p)), `${where}: the screen's numbers are the wheel's`);
  if (s.wheel?.pocket != null) check(WHEEL.includes(s.wheel.pocket), `${where}: the wheel's pocket`);
  const c = s.check || {};
  if (c.pays) { check(payout(c.pays.key, c.pays.stake, c.pays.pocket) === c.pays.net, `${where}: ${c.pays.key} pays ${c.pays.net} on ${c.pays.pocket}`); pays++; }
});
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`roulette course: ${lessons.length} lessons, ${steps} steps; ${pays} payouts checked`);
