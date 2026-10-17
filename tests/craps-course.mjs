// Craps' course (craps-course.js) worked through the rules: every lesson's id its own, every choice's answer one of its
// options and why, every payout a lesson works out what the rules pay, every edge, count and odds figure it states the
// engine's, every bet a picture puts on the layout one the layout carries and draws, every call over the dice the one the
// throw makes, and every word of the floor one the rules page prints.
import { COURSE } from "../craps-course.js";
import { settle, edgeOf, edgeWithOdds, oddsFair, valid, THROWS, WAYS, POINTS, ODDS_PAY, LAY_PAY, BIG_PAY, HARD_PAY, HORN_PAY, SINGLE_PAY, FIELD, totalOf } from "../craps-engine.js";
import { GROUPS, GROUP_IDS } from "../craps-layout.js";
import { parseRounds } from "../craps-stage.js";
import { WORDS } from "../craps-rules.js";
import { parseDice } from "../casino-dice.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const lessons = COURSE.chapters.flatMap(c => c.lessons), ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "every lesson has an id of its own");
const chapters = COURSE.chapters.map(c => c.id);
check(new Set(chapters).size === chapters.length, "every chapter has an id of its own");

const pct = x => Math.round(10000 * x) / 100;
// a bet drawn in a group: the group's cells, or for the numbers the halves of their boxes (and the boxes themselves)
const shownIn = (g, k) => GROUPS[g].flat().includes(k) || (g === "numbers" && /^(d?come\d+o?|n\d+)$/.test(k));
const rules = WORDS.map(w => w.join(" | ")).join("\n");
let steps = 0, checks = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  if (s.quiz) {
    check(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && s.why, `${where}: an answer among the options, and why`);
    check(new Set(s.quiz).size === s.quiz.length, `${where}: options that differ`);
  }
  let d = null;
  if (s.dice) { try { d = parseDice(s.dice); check(d.length === 2, `${where}: two dice`); } catch { check(false, `${where}: dice "${s.dice}"`); } }
  if (s.call) {
    check(!!d, `${where}: a call over no dice`);
    const { before, after } = s.call;
    check([before, after].every(x => x == null || POINTS.includes(x)), `${where}: a point before and after that is null or a point`);
    // the call says where the point stands after this throw: the rules' own
    if (d) check(settle({}, before ?? null, d).point === (after ?? null), `${where}: the point after ${s.dice} from ${before} is ${after}`);
  }
  if (s.screen) { try { const r = parseRounds(s.screen); check(r.length > 0 && r.every(x => x.length === 2), `${where}: the screen's throws are two dice each`); } catch { check(false, `${where}: screen "${s.screen}"`); } }
  if (s.layout) {
    const L = s.layout, keys = [...Object.keys(L.bets || {}), ...(L.lit || [])];
    check(keys.every(k => valid(k) || /^n\d+$/.test(k)), `${where}: every bet one the engine knows (${keys.filter(k => !valid(k)).join(", ")})`);
    check((L.groups || []).length > 0 && L.groups.every(g => GROUP_IDS.includes(g)), `${where}: groups the layout has`);
    // a bet on a group the picture doesn't draw would be invisible
    check(keys.every(k => L.groups.some(g => shownIn(g, k))), `${where}: every bet shown in a group drawn (${keys.filter(k => !L.groups.some(g => shownIn(g, k))).join(", ")})`);
    check(L.point == null || POINTS.includes(L.point), `${where}: the puck on a point`);
    if (L.lit && d) {
      const r = settle(Object.fromEntries(L.lit.map(k => [k, 100])), L.point ?? null, d);
      check(L.lit.every(k => r.lines.find(x => x.key === k)?.net > 0), `${where}: the bets lit are the winners`);
    }
  }
  if (s.edges) check(s.edges.every(([k, label]) => valid(k) && label), `${where}: every edge a bet and a label`);
  if (s.edges && s.edges.length > 3) {
    const e = s.edges.map(([k]) => edgeOf(k));
    check(e.every((x, j) => !j || x >= e[j - 1] - 1e-12), `${where}: the bars run from least to most`);
  }
  if (s.ways?.pick != null) check(s.ways.pick in WAYS, `${where}: the total picked is one of 2 to 12`);
  if (s.odds) check(s.odds.every(n => Number.isInteger(n) && n >= 0), `${where}: odds multiples`);
  if (s.terms) {
    check(s.terms.every(t => t.length === 3 && t.every(x => x)), `${where}: every word a word, its Jyutping and its meaning`);
    // the words of the course are the rules page's: same characters, same Jyutping
    check(s.terms.every(([zh, jp]) => rules.includes(zh) && rules.includes(jp)), `${where}: words the rules page prints (${s.terms.filter(([zh, jp]) => !rules.includes(zh) || !rules.includes(jp)).map(t => t[0]).join(", ")})`);
  }
  const c = s.check || {};
  if (c.pays) {
    const bets = c.pays.bets || { [c.pays.key]: c.pays.stake }, r = settle(bets, c.pays.point ?? null, parseDice(c.pays.dice));
    check(r.net === c.pays.net, `${where}: ${JSON.stringify(bets)} on ${c.pays.dice} (point ${c.pays.point ?? "none"}) nets ${c.pays.net} (is ${r.net})`);
    checks++;
  }
  if (c.edge) { check(pct(edgeOf(c.edge.key)) === c.edge.pct, `${where}: ${c.edge.key} keeps ${c.edge.pct}% (is ${pct(edgeOf(c.edge.key))}%)`); checks++; }
  if (c.ways) { check(WAYS[c.ways.total] === c.ways.n, `${where}: ${c.ways.total} falls ${c.ways.n} ways (is ${WAYS[c.ways.total]})`); checks++; }
  if (c.fair) {
    check(edgeOf("passo") === 0 && edgeOf("donto") === 0 && POINTS.every(n => oddsFair(n) && oddsFair(n, true)), `${where}: the odds and lays are exactly fair`);
    checks++;
  }
  if (c.odds) for (const [n, p] of c.odds) { check(pct(edgeWithOdds(n)) === p, `${where}: pass with ${n}× odds keeps ${p}% (is ${pct(edgeWithOdds(n))}%)`); checks++; }
  if (c.moves) {
    const m = c.moves, r = settle({ [m.key]: 100 }, m.point, parseDice(m.dice));
    check(r.bets[`${m.key}${m.to}`] === 100 && !r.bets[m.key] && r.net === 0, `${where}: ${m.key} on ${m.dice} moves to ${m.to}`);
    checks++;
  }
  if (c.stays) {
    const m = c.stays, r = settle({ [m.key]: 100 }, m.point, parseDice(m.dice));
    check(r.bets[m.key] === 100 && r.lines.length === 0, `${where}: ${m.key} on ${m.dice} stays up`);
    checks++;
  }
  if (c.point) {
    const m = c.point;
    check(settle({}, m.before, parseDice(m.dice)).point === m.after, `${where}: ${m.dice} from ${m.before} leaves the point at ${m.after}`);
    checks++;
  }
  if (c.losing) {
    const n = THROWS.filter(t => settle({ [c.losing.key]: 100 }, null, t).net < 0).length;
    check(n === c.losing.n, `${where}: ${c.losing.key} loses on ${c.losing.n} of the 36 throws (is ${n})`);
    checks++;
  }
  if (c.sides) { check(edgeOf(c.sides[0]) > edgeOf(c.sides[1]), `${where}: ${c.sides[0]} keeps more than ${c.sides[1]}`); checks++; }
});

// the figures the words state outright, against the rules
const say = lessons.flatMap(l => l.steps.map(s => s.say + " " + (s.why || ""))).join(" ");
check(THROWS.length === 36, "36 throws");
check(Object.values(WAYS).reduce((a, b) => a + b, 0) === 36, "the totals' ways add to 36");
check(WAYS[7] === 6 && WAYS[6] === 5 && WAYS[8] === 5 && WAYS[10] === 3 && WAYS[2] === 1 && WAYS[12] === 1, "the ways the words give for the totals");
check(POINTS.every(n => ODDS_PAY[n][0] / ODDS_PAY[n][1] === WAYS[7] / WAYS[n]), "the odds pay what a point is worth against a 7 (the words say 2 to 1, 3 to 2 and 6 to 5)");
check(ODDS_PAY[4].join() === "2,1" && ODDS_PAY[5].join() === "3,2" && ODDS_PAY[6].join() === "6,5", "the odds the words give");
check(LAY_PAY[4].join() === "1,2" && LAY_PAY[6].join() === "5,6", "the lays the words give");
check(BIG_PAY[6].join() === "7,6" && BIG_PAY[5].join() === "7,5" && BIG_PAY[4].join() === "9,5", "the Big bets' pays the words give");
check(HARD_PAY[6] === 9 && HARD_PAY[8] === 9 && HARD_PAY[4] === 7 && HARD_PAY[10] === 7, "the hard ways' pays the words give");
check(SINGLE_PAY.seven === 4 && HORN_PAY.twelve.join() === "27,4" && HORN_PAY.eleven.join() === "3,1", "the Any seven and Horn pays the words give");
check(FIELD.two === 2 && FIELD.twelve === 2, "the field pays 2 to 1 on a 2 and a 12, as the words say");
check(THROWS.filter(t => settle({ field: 100 }, null, t).net > 0).length === 16, "the field wins on 16 of the 36");
check(settle({ horn: 100 }, null, [6, 6]).net === 675 && settle({ horn: 100 }, null, [1, 2]).net === 300, "the Horn's HK$675 and HK$300");
check(settle({ field: 100 }, null, [6, 6]).net === 200, "the field's 12 wins HK$200");
check(pct(edgeOf("pass")) === 1.41 && pct(edgeOf("dont")) === 1.36 && pct(edgeOf("field")) === 5.56, "the line and field edges the words quote");
check(pct(edgeOf("seven")) === 16.67 && pct(edgeOf("craps")) === 11.11 && pct(edgeOf("aces")) === 13.89 && pct(edgeOf("horn")) === 12.5, "the one-roll edges the words quote");
check(pct(edgeOf("hard6")) === 9.09 && pct(edgeOf("hard4")) === 11.11, "the hard ways' edges the words quote");
check(pct(edgeOf("b6")) === 1.52 && pct(edgeOf("b5")) === 4 && pct(edgeOf("b4")) === 6.67, "the Big bets' edges the words quote");
check(Math.round(10000 * edgeOf("seven")) === 1667 && Math.round(10000 * edgeOf("pass")) === 141, "HK$10,000 staked: HK$1,667 on Any seven, HK$141 on the pass line");
check(/1\.41%/.test(say) && /0\.33%/.test(say) && /16\.67%/.test(say), "the words quote the figures");
check(totalOf([3, 4]) === 7, "dice add");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`craps course: ${lessons.length} lessons, ${steps} steps; ${checks} figures checked`);
