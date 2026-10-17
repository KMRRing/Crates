// Baccarat's course (baccarat-course.js) worked through the rules: every lesson's id its own, every choice's answer one
// of its options, every card real and every pair of hands one the tableau deals (but those marked free: two cards each,
// before any third), every payout the lesson works out what the bet pays, every road's marks and every ask road's next
// mark what the roads make of the results shown, every count and longest run a screen is read for, every layout's
// stakes on spots it has, what the squeeze shows of a card (the pips down its side, those in its middle and how many a
// peel from the foot reveals) as the squeeze draws it, what a first card burns, and which third cards win a hand.
import { COURSE } from "../baccarat-course.js";
import { SIDES, dealHand, payout, rankOf, burnCount, bigColumns, derived, ask } from "../baccarat-engine.js";
import { parseHand, parseSeq } from "../baccarat-stage.js";
import { sidePips, middlePips } from "../baccarat-squeeze.js";

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
  if (c.count) check(parseSeq(c.count.seq).filter(r => r.w === c.count.w).length === c.count.n, `${where}: ${c.count.n} ${c.count.w} wins`);
  if (c.longest) {
    const cols = bigColumns(parseSeq(c.longest.seq)).cols, most = Math.max(...cols.map(x => x.length));
    check(most === c.longest.n && cols.some(x => x.length === most && x[0].w === c.longest.w), `${where}: the longest run is ${c.longest.n} ${c.longest.w}`);
  }
  if (s.road) try { parseSeq(s.road.seq); } catch (e) { check(false, `${where}: ${e.message}`); }
  if (s.layout) {
    const sides = s.layout.sides || ["pairs"], spots = ["player", "banker", "tie", ...SIDES.filter(sd => sides.includes(sd.id)).flatMap(sd => sd.spots)];
    check(sides.every(id => SIDES.some(sd => sd.id === id)), `${where}: the layout's side bets are ones a table carries`);
    check(Object.keys(s.layout.stakes || {}).every(id => spots.includes(id)), `${where}: every stake on a spot the layout has`);
  }
  if (s.peel) for (const p of s.peel) try { parseHand(p.card); } catch (e) { check(false, `${where}: ${e.message}`); }
  if (s.burn) try { parseHand(s.burn); } catch (e) { check(false, `${where}: ${e.message}`); }
  const ranks = text => text.split(" ");
  for (const sd of [c.side || []].flat()) {
    for (const r of ranks(sd.cards)) check(sd.n != null ? sidePips(r) === sd.n : sidePips(r) !== sd.not, `${where}: a ${r} has ${sidePips(r)} pips down its side`);
  }
  if (c.middle) ranks(c.middle.cards).forEach((r, k) => {
    const mid = middlePips(r);
    check(mid.length === Number(ranks(c.middle.n)[k]) && mid.filter(y => y > 1 - c.middle.foot).length === Number(ranks(c.middle.shows)[k]), `${where}: a ${r}'s middle pips, and those a peel from the foot shows`);
  });
  if (c.burn) check(burnCount(parseHand(c.burn.card)[0]) === c.burn.n, `${where}: a ${c.burn.card} burns ${c.burn.n}`);
  if (c.third) {
    const base = c.third.hand.split(" ").map(t => parseHand(t)[0]), winner = r => dealHand([...base, parseHand(r)[0]]).winner;
    check(ranks(c.third.wins).every(r => winner(r) === "P") && ranks(c.third.loses).every(r => winner(r) !== "P"), `${where}: the Player's third card wins on ${c.third.wins}, not on ${c.third.loses}`);
  }
});
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`baccarat course: ${lessons.length} lessons, ${steps} steps; ${hands} deals, ${pays} payouts and ${roads} roads checked`);
