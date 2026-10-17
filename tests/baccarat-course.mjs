// Baccarat's course (baccarat-course.js) worked through the rules: every lesson's id its own, every choice's answer one
// of its options, every card real and every pair of hands one the tableau deals (but those marked free: two cards each,
// before any third), every payout the lesson works out what the bet pays, every road's marks and every ask road's next
// mark what the roads make of the results shown.
import { COURSE } from "../baccarat-course.js";
import { dealHand, payout, rankOf, bigColumns, derived, ask } from "../baccarat-engine.js";
import { parseHand, parseSeq } from "../baccarat-stage.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const lessons = COURSE.chapters.flatMap(c => c.lessons), ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "every lesson has an id of its own");
let steps = 0, hands = 0, pays = 0, roads = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  if (s.quiz) check(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && s.why, `${where}: an answer among the options, and why`);
  if (s.hands) {
    let p, b;
    try { p = parseHand(s.hands.player, 0); b = parseHand(s.hands.banker, 1); } catch (e) { check(false, `${where}: ${e.message}`); return; }
    if (!s.free) {
      // the order they'd come out of the shoe: Player, Banker, Player, Banker, then the third cards
      const order = [p[0], b[0], p[1], b[1], ...(p[2] != null ? [p[2]] : []), ...(b[2] != null ? [b[2]] : [])];
      const h = dealHand(order), same = (a, x) => a.length === x.length && a.every((id, k) => rankOf(id) === rankOf(x[k]));
      check(same(h.player, p) && same(h.banker, b), `${where}: the hands shown are the ones the rules deal (${s.hands.player} / ${s.hands.banker})`);
      hands++;
    } else check(p.length === 2 && b.length === 2, `${where}: a free pair of hands is two cards each`);
  }
  const c = s.check || {};
  if (c.pays) {
    const cards = c.pays.hand.split(" ").map(t => parseHand(t)[0]);
    check(payout(c.pays.spot, c.pays.stake, dealHand(cards), c.pays.table) === c.pays.net, `${where}: ${c.pays.spot} pays ${c.pays.net}`);
    pays++;
  }
  if (c.road) {
    const seq = parseSeq(c.road.seq);
    if (c.road.ask) check(ask(seq)[c.road.ask][c.road.k - 1] === c.road.mark, `${where}: asking ${c.road.ask}, road ${c.road.k} marks ${c.road.mark}`);
    else check(derived(bigColumns(seq).cols, c.road.k).join(" ") === c.road.marks, `${where}: road ${c.road.k} reads ${c.road.marks}`);
    roads++;
  }
  if (s.road) try { parseSeq(s.road.seq); } catch (e) { check(false, `${where}: ${e.message}`); }
});
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`baccarat course: ${lessons.length} lessons, ${steps} steps; ${hands} deals, ${pays} payouts and ${roads} roads checked`);
