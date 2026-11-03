// Fuel maths' deck (README, Speed maths; speedfuels-data.js): the desk's figures agree with each other, every chain says what
// it does in words that match its arithmetic, Korbi's own chain works out as he would, and docs/speedfuels.md lists every
// chain with figures and answer for him to review (a chain added without its entry there fails here).
import fs from "fs";
import { chainProblem, drawFigs, rng, judge, near, fmtNum, fmtAnswer, stepText, values, roundSf } from "../speedmaths-core.js";
import { FUEL, CRUDE_BBL, COMPARATOR, TOPICS, DEFS, CONSTANTS, sum } from "../speedfuels-data.js";
import { startRun, problemAt, submit } from "../speedmaths-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const source = fs.readFileSync(root + "speedfuels-data.js", "utf8");
const doc = fs.readFileSync(root + "docs/speedfuels.md", "utf8");

// ---------- the desk's figures agree with each other ----------
// a barrel is 158.987 litres, so barrels a tonne is 6.2898 over the density in tonnes a m³ (at 15 °C)
for (const f of Object.values(FUEL)) {
  const calc = 6.2898 / f.dens;
  check(Math.abs(f.bbl - calc) / calc < 0.005, `${f.name}: ${f.bbl} barrels a tonne is the density's ${calc.toFixed(2)} to half a per cent`);
}
check(CRUDE_BBL === 7.33 && COMPARATOR === 94 && FUEL.diesel.mj === 43 && FUEL.fame.mj === 37 && FUEL.hvo.mj === 44 && FUEL.ethanol.mj === 27,
  "crude 7.33 barrels a tonne, the comparator 94 gCO2e/MJ and the Directive's heating values as the desk uses them");
check(/SOURCES AND DATE/.test(source) && /3 November 2026/.test(source) && /2018\/2001/.test(source) && /Annex V/.test(source), "the data file says where its figures come from and when");
check(TOPICS.length >= 4 && TOPICS.every(([id, label]) => id && label) && CONSTANTS.length >= 8, "the sprint has its topics and the deck its conversion factors");

// ---------- the sprint's desk sums are exact, with their units ----------
{
  const r = rng(2026), seen = new Set();
  let wrong = null;
  for (const [kind] of TOPICS) for (let i = 0; i < 400; i++) {
    const s = sum(kind, r, (i % 20) / 20 + 0.3 > 1 ? 1 : (i % 20) / 20 + 0.3);
    seen.add(`${kind}:${s.prompt.replace(/[\d.,]+/g, "#")}`);
    const x = s.answer * 1000;
    if (!(Number.isFinite(s.answer) && s.answer > 0 && s.unit && Math.abs(x - Math.round(x)) < 1e-6)) wrong ??= `${kind} ${s.prompt} = ${s.answer} ${s.unit}`;
  }
  check(!wrong && seen.size >= 15, `${seen.size} kinds of desk sum, every answer positive, with a unit, and typeable to three decimals${wrong ? `: ${wrong}` : ""}`);
}

// ---------- every chain, every combination ----------
function* combos(figs) {
  const keys = Object.keys(figs);
  const walk = function* (i, acc) {
    if (i === keys.length) { yield { ...acc }; return; }
    for (const o of figs[keys[i]]) { acc[keys[i]] = o; yield* walk(i + 1, acc); }
  };
  yield* walk(0, {});
}
{
  let words = null, units = null, dead = null, count = 0;
  for (const d of DEFS) for (const figs of combos(d.figs)) {
    const p = chainProblem(d, figs);
    count++;
    if (!p) { dead ??= `${d.id} ${JSON.stringify(figs).slice(0, 80)}`; continue; }
    for (const s of p.steps) {
      if (!s.to || !String(s.to).trim()) units ??= `${d.id}: a step with no unit it leaves`;
      const text = stepText(s);
      // a step without words of its own says its figure: what is shown is what is worked
      if (!s.say && !text.includes(fmtNum(s.n))) words ??= `${d.id}: "${text}" for ${s.n}`;
    }
    if (!p.start.say || !Number.isFinite(p.start.v)) words ??= `${d.id}: no start`;
  }
  check(!dead && !units && !words, `${count} combinations of figures: every one an answer to type, every step with its unit and its figure in its words${dead || units || words ? `: ${dead || units || words}` : ""}`);
  check(DEFS.filter(d => d.n >= 3).length >= 14 && DEFS.filter(d => d.n <= 2).length >= 10 && DEFS.some(d => d.n === 6), "a deck of estimates (one or two steps) and chains (three to six)");
}

// ---------- Korbi's chain, as he gave it ----------
// kb/d → t/month → 5% → 80% saving against 94 gCO2e/MJ → t CO2e → at 120 pounds a tonne, pounds a month → dollars a year
{
  const d = DEFS.find(x => x.id === "flow-co2-dollars");
  const p = chainProblem(d, { kbd: 300, share: 5, saving: 80, price: 120, fx: 1.3 });
  const by = 300 * 30 / 7.45 * 0.05 * (43 * 94 * 0.8 / 1000) * 120 * 1.3 * 12 / 1000;
  check(!!d && d.n === 6 && p.n === 6 && near(p.answer, by) && Math.abs(p.answer - 365.6) < 0.2 && p.unit === "million dollars a year",
    `300 thousand barrels a day, 5% of it, 80% saved against 94 gCO2e/MJ, at £120 a tonne and $1.30: ${fmtAnswer(p.answer)} million dollars a year (6 steps)`);
  check(p.steps[0].to === "thousand barrels a month" && p.steps[1].to === "kt a month" && p.steps[2].to === "kt a month" && /94 gCO2e\/MJ/.test(stepText(p.steps[3])) && /80%/.test(stepText(p.steps[3]))
    && p.steps[4].to === "thousand pounds a month" && p.steps[5].to === "million dollars a year", "its steps run in the order he works them, each leaving the unit he'd say");
  // one significant figure, with the shortcuts a trader takes: 7.5 barrels a tonne, 43 × 94 × 0.8 as 3.2, a year of twelve months
  const rough = 300 * 30 / 7.5 * 0.05 * 3.2 * 120 * 1.3 * 12 / 1000;
  check(judge(p, 370).ok && judge(p, 360).ok && judge(p, 400).ok && !judge(p, 450).ok && !judge(p, 37).ok && !judge(p, 3700).ok && judge(p, rough).ok,
    `to 1 s.f. 370, 360 and 400 are right (the chain's band is ${(p.rel * 100).toFixed(1)}%), 450 is not, and a zero out never is; the rounded-factor answer ${fmtAnswer(rough)} is right`);
}

// ---------- in a run ----------
{
  const run = startRun({ pool: "fuels", mode: "chains", seed: 20261103 });
  const first = problemAt(run, 0);
  check(first.kind === "chain" && first.n === 3 && first.topic && first.name, "a chains run starts on three steps");
  const typed = String(roundSf(first.answer, first.sf));
  const r = submit(run, typed, 5000);
  check(r.ok && run.score === first.worth && /^(close|exact)$/.test(r.grade), "and takes the answer rounded as asked");
}

// ---------- the list for Korbi to review ----------
{
  check(/to review/i.test(doc) && /Korbi/.test(doc), "docs/speedfuels.md says these are to be reviewed");
  const missing = [], wrong = [];
  for (const d of DEFS) {
    const at = doc.indexOf(`(${d.id})`);
    if (at < 0) { missing.push(d.id); continue; }
    const block = doc.slice(at, doc.indexOf("\n### ", at) < 0 ? undefined : doc.indexOf("\n### ", at));
    const first = Object.fromEntries(Object.entries(d.figs).map(([k, v]) => [k, v[0]]));
    const p = chainProblem(d, first);
    if (!p || !block.includes(`Answer: ${fmtAnswer(p.answer)} ${p.unit}`)) wrong.push(d.id);
  }
  check(!missing.length && !wrong.length, `every one of the ${DEFS.length} chains is in docs/speedfuels.md with its worked answer${missing.length ? `; missing ${missing.join(", ")}` : ""}${wrong.length ? `; answer differs for ${wrong.join(", ")}` : ""}`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("speedfuels: the deck's figures agree, every chain is listed for review, and Korbi's works out");
