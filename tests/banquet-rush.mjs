// Banquet's rush, "call it" (banquet-rush.js): its bank 30 at each rating, each puzzle hands the game has and a right
// call that's the total (a count) or your hand and the favourite of Lao Wang's last throws (a read: clear by Sharp's
// weighting and by counting alone), a call your hand may make; the numbers on the calls where the rating shows them;
// a tap on the right call on the course's stage makes it; a run's order rising; the verdicts and their words.
import { PUZZLES, favourite, stepOf, judge, callText, askText, whyText } from "../banquet-rush.js";
import { handStage } from "../banquet-course.js";
import { runOrder } from "../rush-sheet.js";
import { HANDS, callsFor } from "../banquet-rules.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const by = r => PUZZLES.filter(p => p.r === r).length;
check(PUZZLES.length === 300 && new Set(PUZZLES.map(p => p.id)).size === 300 && [...Array(10)].every((_, i) => by(i + 1) === 30), `${PUZZLES.length} puzzles, 30 at each rating, each with its own id`);
const problems = [];
for (const p of PUZZLES) {
  const hands = HANDS[p.mode], bare = ![1, 2, 5, 7, 8].includes(p.r), mode = [5, 6, 10].includes(p.r) ? "shiwu" : "huaquan";
  if (p.mode !== mode || p.bare !== bare || p.kind !== (p.r <= 6 ? "count" : "read")) problems.push(`${p.id}: not what its rating deals`);
  if (![p.mine, ...(p.kind === "count" ? [p.theirs] : p.history)].every(n => hands.includes(n))) problems.push(`${p.id}: a hand the game hasn't`);
  if (p.kind === "count" && p.best !== p.mine + p.theirs) problems.push(`${p.id}: the total isn't ${p.best}`);
  if (p.kind === "read") {
    const f = favourite(p.history), count = n => p.history.filter(x => x === n).length;
    if (!f.clear || p.best !== p.mine + f.hand || hands.some(n => n !== f.hand && count(n) >= count(f.hand))) problems.push(`${p.id}: the favourite isn't clear, or the call isn't the hand and it`);
  }
  if (!callsFor(p.mode, p.mine).includes(p.best)) problems.push(`${p.id}: the right call is a 臭拳`);
  if (!askText(p) || !whyText(p)) problems.push(`${p.id}: no words`);
}
check(!problems.length, "every puzzle: what its rating deals, hands the game has, the right call the total or the hand and a clear favourite, never a 臭拳");
for (const x of problems.slice(0, 10)) console.log(`     ${x}`);

// the course's stage takes the call
function fakeBox() { const on = {}; return { innerHTML: "", addEventListener: (k, f) => { on[k] = f; }, on }; }
const tapOn = c => ({ target: { closest: sel => (sel === "[data-call]" ? { dataset: { call: String(c) } } : null) } });
const stuck = [];
for (const p of PUZZLES.filter((_, i) => i % 15 === 0)) {
  const s = stepOf(p), stage = handStage(), box = fakeBox(), t = { done: false };
  stage.mount(box, { changed: () => stage.draw(s, t), answer: () => {} });
  stage.draw(s, t);
  if (/<small>\d+ ·/.test(box.innerHTML) === p.bare) stuck.push(`${p.id}: the numbers ${p.bare ? "shown" : "hidden"}`);
  box.on.click(tapOn(p.best));
  if (t.sel !== p.best || !stage.ready(s, t) || judge(p, t.sel).verdict !== "best") stuck.push(`${p.id}: a tap on ${p.best} doesn't make it`);
}
check(!stuck.length, "a tap on the right call on the course's stage makes it; the numbers on the calls only where the rating shows them");
for (const x of stuck) console.log(`     ${x}`);

const order = runOrder(PUZZLES, 7, []), rs = order.slice(0, 40).map(id => PUZZLES.find(p => p.id === id).r);
check(new Set(order).size === order.length && rs.every((r, i) => i === 0 || r >= rs[i - 1]), `a run rises: ${rs.slice(0, 12).join(" ")}…`);
const p = PUZZLES.find(x => x.kind === "read" && x.mode === "huaquan");
check(judge(p, p.best).verdict === "best" && judge(p, (p.best + 1) % 11).verdict === "wrong" && callText("huaquan", 3) === "三星照, 3" && callText("shiwu", 15) === "十五, 15", "the verdicts, and calls in words");
check(/^Your \d+ and his favourite \d+: \d+ of his last \d+/.test(whyText(p)) && whyText(PUZZLES[0]) === `Your ${PUZZLES[0].mine} and his ${PUZZLES[0].theirs}.`, `why: "${whyText(p)}"`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
