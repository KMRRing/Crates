// Sic Bo's course (sicbo-course.js) worked through the rules: every lesson's id its own, every choice's answer one of its
// options and why, every payout a lesson works out what the bet pays, every edge and count it states the engine's, every
// bet a picture puts on the layout one the layout carries, and every throw it shows real dice.
import { COURSE } from "../sicbo-course.js";
import { payout, edgeOf, waysOf, valid, onLayout, OUTCOMES, totalOf, TOTAL_PAYS, KINDS } from "../sicbo-engine.js";
import { GROUP_IDS } from "../sicbo-layout.js";
import { parseRounds, WAYS } from "../sicbo-stage.js";
import { parseDice } from "../casino-dice.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const lessons = COURSE.chapters.flatMap(c => c.lessons), ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "every lesson has an id of its own");
const chapters = COURSE.chapters.map(c => c.id);
check(new Set(chapters).size === chapters.length, "every chapter has an id of its own");

const pct = x => Math.round(10000 * x) / 100;
let steps = 0, checks = 0;
for (const l of lessons) l.steps.forEach((s, i) => {
  const where = `${l.id} step ${i + 1}`;
  steps++;
  check(typeof s.say === "string" && s.say.length > 0, `${where}: words`);
  if (s.quiz) {
    check(Number.isInteger(s.answer) && s.answer >= 0 && s.answer < s.quiz.length && s.why, `${where}: an answer among the options, and why`);
    check(new Set(s.quiz).size === s.quiz.length, `${where}: options that differ`);
  }
  if (s.dice) { try { check(parseDice(s.dice).length === 3, `${where}: three dice`); } catch { check(false, `${where}: dice "${s.dice}"`); } }
  if (s.screen) { try { const r = parseRounds(s.screen); check(r.length > 0 && r.every(d => d.length === 3), `${where}: the screen's throws are three dice each`); } catch { check(false, `${where}: screen "${s.screen}"`); } }
  if (s.layout) {
    const keys = [...Object.keys(s.layout.bets || {}), ...(s.layout.lit || [])];
    check(keys.every(onLayout), `${where}: every bet one the layout carries (${keys.filter(k => !onLayout(k)).join(", ")})`);
    check((s.layout.groups || []).every(g => GROUP_IDS.includes(g)), `${where}: groups the layout has`);
    // a bet on a group the picture doesn't draw would be invisible
    check(!s.layout.groups || keys.every(k => s.layout.groups.some(g => ({ main: /^(small|big|any)$/, triples: /^t\d$/, doubles: /^d\d$/, totals: /^n\d+$/, pairs: /^c\d\d$/, singles: /^s\d$/ })[g].test(k))), `${where}: every bet shown in a group drawn`);
    if (s.layout.lit && s.dice) {
      const d = parseDice(s.dice);
      check(s.layout.lit.every(k => payout(k, 1, d) > 0), `${where}: the bets lit are the winners`);
    }
  }
  if (s.edges) check(s.edges.every(([k, label]) => valid(k) && label), `${where}: every edge a bet and a label`);
  if (s.edges && s.edges.length > 3) {
    const e = s.edges.map(([k]) => edgeOf(k));
    check(e.every((x, j) => !j || x >= e[j - 1]), `${where}: the bars run from least to most`);
  }
  if (s.ways?.pick != null) check(s.ways.pick in WAYS, `${where}: the total picked is one of 3 to 18`);
  const c = s.check || {};
  if (c.pays) {
    const d = parseDice(c.pays.dice);
    check(payout(c.pays.key, c.pays.stake, d) === c.pays.net, `${where}: ${c.pays.key} on ${c.pays.dice} nets ${c.pays.net} (is ${payout(c.pays.key, c.pays.stake, d)})`);
    checks++;
  }
  if (c.edge) { check(pct(edgeOf(c.edge.key)) === c.edge.pct, `${where}: ${c.edge.key} keeps ${c.edge.pct}% (is ${pct(edgeOf(c.edge.key))}%)`); checks++; }
  if (c.ways) { check(waysOf(c.ways.key) === c.ways.n, `${where}: ${c.ways.key} falls ${c.ways.n} ways (is ${waysOf(c.ways.key)})`); checks++; }
  if (c.ceiling) {
    // the rules' range for a total: the same bet at the most it may pay
    const w = waysOf(`n${c.ceiling.total}`), e = (216 - w - w * c.ceiling.pays) / 216;
    check(pct(e) === c.ceiling.pct, `${where}: total ${c.ceiling.total} at ${c.ceiling.pays} to 1 keeps ${c.ceiling.pct}% (is ${pct(e)}%)`);
    checks++;
  }
  if (c.odd) { check(OUTCOMES.filter(d => totalOf(d) % 2).length === c.odd, `${where}: ${c.odd} throws have an odd total`); checks++; }
});

// the figures the words state outright, against the rules
const say = lessons.flatMap(l => l.steps.map(s => s.say)).join(" ");
check(OUTCOMES.length === 216, "216 throws");
check(WAYS[10] === 27 && WAYS[11] === 27 && WAYS[9] === 25 && WAYS[12] === 25 && WAYS[8] === 21 && WAYS[13] === 21 && WAYS[4] === 3 && WAYS[17] === 3 && WAYS[3] === 1 && WAYS[18] === 1, "the ways the words give for the totals");
check(Object.values(WAYS).reduce((a, b) => a + b, 0) === 216, "the totals' ways add to 216");
check(waysOf("small") === 105 && waysOf("big") === 105, "Big and Small win on 105 of the 216");
check(TOTAL_PAYS[4] === 50 && TOTAL_PAYS[5] === 18 && TOTAL_PAYS[6] === 14 && TOTAL_PAYS[7] === 12 && TOTAL_PAYS[8] === 8 && TOTAL_PAYS[9] === 6, "the totals' pays the words give");
check(KINDS.t.pays === 150 && KINDS.any.pays === 24 && KINDS.d.pays === 8 && KINDS.c.pays === 5, "the triple, double and pair pays the words give");
check(pct(edgeOf("s4")) === 7.87 && pct(edgeOf("n7")) === 9.72 && pct(edgeOf("n10")) === 12.5 && pct(edgeOf("d4")) === 33.33 && pct(edgeOf("c25")) === 16.67 && pct(edgeOf("n9")) === 18.98 && pct(edgeOf("n4")) === 29.17 && pct(edgeOf("t3")) === 30.09, "the edges the lesson lists");
check(/150 to 1/.test(say) && /2\.78%/.test(say), "the words quote the 150 to 1 and 2.78%");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`sicbo course: ${lessons.length} lessons, ${steps} steps; ${checks} figures checked`);
