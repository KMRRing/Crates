// Tarot's course says what the game does: every card of a lesson is a card, every pick a lesson asks for is judged right
// by the rules, a puzzle's answer is the one card the search proves best, and no quiz has its right answer twice.
import { COURSE } from "../tarot-course.js";
import { parseCards, tokenOf, expected, judge } from "../tarot-stage.js";
import { solve } from "../tarot-solve.js";

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error("FAIL", m); } };

const ids = new Set();
for (const ch of COURSE.chapters) {
  for (const l of ch.lessons) {
    ok(!ids.has(l.id), `lesson id ${l.id} twice`);
    ids.add(l.id);
    ok(l.steps.length > 0, `${l.id} has no steps`);
    l.steps.forEach((s, i) => {
      const at = `${l.id} step ${i + 1}`;
      ok(typeof s.say === "string" && s.say.length > 10, `${at}: no words`);
      for (const r of s.rows || []) if (r.cards) ok(parseCards(r.cards).length > 0, `${at}: a row of no cards`);
      const hand = parseCards(s.hand), table = parseCards(s.table), rowsCards = (s.rows || []).flatMap(r => parseCards(r.cards));
      ok(new Set([...hand, ...table]).size === hand.length + table.length, `${at}: a card twice among the hand and the trick`);
      if (s.quiz) {
        ok(new Set(s.quiz).size === s.quiz.length, `${at}: two alike options`);
        ok(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length, `${at}: answer out of range`);
        ok(typeof s.why === "string" && s.why.length > 8, `${at}: a quiz without its why`);
      }
      if (s.goal) {
        const want = expected(s);
        ok(want && want.length > 0, `${at}: nothing to pick`);
        ok(want.every(c => hand.includes(c)), `${at}: the answer is not in the hand`);
        ok(judge(s, want).ok, `${at}: the right pick is judged wrong`);
        ok(!judge(s, hand.filter(c => !want.includes(c)).slice(0, 1).concat(want.slice(1))).ok || want.length === hand.length, `${at}: a wrong pick is judged right`);
        if (s.goal === "legal") ok(want.length < hand.length || /Excuse|anything|Every card/.test(s.why), `${at}: every card is lawful, so nothing is asked`);
        ok(typeof s.why === "string", `${at}: no words for a right pick`);
      }
      void rowsCards;
      if (s.puzzle) {
        const p = s.puzzle, cards = p.hands.map(parseCards), played = parseCards(p.plays).map((card, k) => ({ seat: (p.lead + k) % cards.length, card }));
        const r = solve({ hands: cards, att: p.att, lead: p.lead, plays: played });
        ok(r.length > 1 && r[0].value !== r[1].value, `${at}: the best card is not the only best`);
        ok(tokenOf(r[0].card) === s.answer, `${at}: the lesson's answer is not the search's`);
        ok(p.me === (p.lead + played.length) % cards.length, `${at}: it is not the reader's turn`);
        const all = [...cards.flat(), ...played.map(x => x.card)];
        ok(new Set(all).size === all.length, `${at}: a card twice in the puzzle`);
      }
    });
  }
}
const last = COURSE.chapters.at(-1).lessons.at(-1).steps.at(-1);
ok(last.play, "the course ends with a game");
if (fails) { console.error(`${fails} failed`); process.exit(1); }
console.log("all passed");
