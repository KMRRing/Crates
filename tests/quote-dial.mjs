// Quote's ruler (quote-dial.js): which questions have one, that it never tells the answer (a log ruler's decades are placed by
// the question's id, so the truth is as likely one, two or three decades from the left end, and every year question shares
// one ruler), that a place on it and a value are the same thing both ways, and that the page has it wired in.
// Run: node tests/quote-dial.mjs
import fs from "node:fs";
const QUOTES = (await (await import("../tools/build-kb.mjs")).build({ level: "personal" })).quote.QUOTES;   // the engine is tried on everything kb/ holds; the published bank is its universal part
const { axisOf, posOf, offOf, valueAt, labelOf, TAP_WIDTH, DECADES } = await import("../quote-dial.js");
const { fault, floorOf, settle, widthOf } = await import("../quote-engine.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };

// ---------- which questions ----------
const logs = QUOTES.filter(q => q.scale === "log"), years = QUOTES.filter(q => q.unit === "year"), withRuler = QUOTES.filter(q => axisOf(q));
check(logs.every(q => axisOf(q)?.kind === "log") && years.every(q => axisOf(q)?.kind === "linear"), "a magnitude has a log ruler, a year a plain one");
check(withRuler.length / QUOTES.length > 0.9, `most questions have a ruler (${withRuler.length} of ${QUOTES.length}); the rest are counts and ages, where a window would tell where the truth is`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(QUOTES.every(q => same(axisOf(q), axisOf({ ...q }))), "a question's ruler is its own, the same every time and on every phone");

// ---------- the ruler never tells ----------
{
  const share = [0, 0, 0, 0, 0];                              // the truth's decade from the left end
  const small = q => q.whole && q.truth < 1000;                 // a small count's ruler starts at 1, wherever that puts the truth
  for (const q of logs) {
    const a = axisOf(q), at = Math.log10(q.truth / a.lo);
    check(at >= (small(q) ? 0 : 1) && at < 4 + 1e-9 && a.hi === Number((a.lo * 10 ** DECADES).toPrecision(1)), `${q.id}: the truth lies one to four decades in, inside the ruler (${at.toFixed(2)})`);
    if (!small(q)) share[Math.floor(at + 1e-9)]++;
  }
  const spread = [1, 2, 3].map(i => share[i] / logs.filter(q => !small(q)).length);
  check(spread.every(s => s > 0.2), `the truth is one, two or three decades in about as often as each other (${spread.map(s => `${Math.round(s * 100)}%`).join(", ")})`);
  const yearRulers = new Set(years.map(q => JSON.stringify(axisOf(q))));
  check(yearRulers.size === 1 && years.every(q => q.truth >= 1000 && q.truth <= 2050), "every year question has the same ruler, 1000 to 2050");
  check(logs.every(q => { const a = axisOf(q); return a.ticks.every(t => t === Number(t.toPrecision(1))) && a.ticks.length === DECADES + 1; }), "a log ruler's ticks are round numbers, a decade apart");
}

// ---------- a count starts at 1 ----------
// 3 November 2026, Korbi, on the Garter question (24, log): "answers that are full integers should start at 1 on the
// logarithmic scale (this one does 0.1)". A question flagged `whole` is a count: its ruler, its ticks, its bid and what a
// handle gives never go below 1, and the grading is the same log-ratio maths from 1.
{
  const counts = QUOTES.filter(q => q.whole), logCounts = counts.filter(q => q.scale === "log");
  check(logCounts.length >= 3, `the bank has counts on a log scale (${logCounts.length})`);
  check(counts.every(q => Number.isInteger(q.truth) && q.truth >= 1), "a count's truth is a whole number, 1 or more");
  // a log question whose unit is a thing counted is flagged: a new one can't slip in with a 0.1 ruler
  const THINGS = /^(members|seats|people|employees|bottles|works|refineries|countries|lines|châteaux|vineyards|paintings|prizes|children|symphonies|plays|companies)$/;
  const unflagged = QUOTES.filter(q => q.scale === "log" && THINGS.test(q.unit) && !q.whole);
  check(!unflagged.length, `every log question counting things is flagged whole${unflagged.length ? `: ${unflagged.slice(0, 4).map(q => q.id)}` : ""}`);
  for (const q of logCounts) {
    const a = axisOf(q);
    check(a.lo >= 1 && (q.truth >= 1000 || a.lo === 1) && a.ticks[0] === a.lo, `${q.id}: a count's ruler starts at 1 (${a.lo})`);
    check(a.ticks.every((t, i) => t >= 1 && (i === 0 || t > a.ticks[i - 1]) && Number.isInteger(t)) && a.ticks.at(-1) === a.hi, `${q.id}: its ticks are whole numbers from ${a.lo}: ${a.ticks.map(labelOf).join(", ")}`);
    let low = Infinity;
    for (let i = 0; i <= 200; i++) { const v = valueAt(a, i / 200); low = Math.min(low, v); if (!Number.isInteger(v) || v < 1) { check(false, `${q.id}: the ruler gave ${v}`); break; } }
    check(low === a.lo, `${q.id}: the ruler's left end is ${a.lo}`);
    check(floorOf(q) === 1 && fault(q, 0.5, 20) && fault(q, 0.1, 0.2) && !fault(q, 1, 30) && !fault(q, q.truth, q.truth), `${q.id}: a bid under 1 is refused, 1 and the truth are not`);
  }
  check(QUOTES.filter(q => !q.whole).every(q => floorOf(q) === 0), "a question that isn't a count has no floor");
  // a market that straddles a small count: truth 3, from 1 to 30 (a factor of 30)
  const q = { id: "x-straddle", unit: "members", whole: true, scale: "log", truth: 3, tol: 0.15, d: 3 }, a = axisOf(q);
  const r = settle(q, 1, 30);
  check(a.lo === 1 && a.ticks.map(labelOf).join(" ") === "1 10 100 1k 10k 100k" && r.inside && Number.isFinite(r.delta) && Math.abs(widthOf(q, 1, 30) - Math.log2(30)) < 1e-9, "truth 3 with a market of 1 to 30: a ruler from 1 and the usual log-ratio maths");
  check(valueAt(a, 0) === 1 && valueAt(a, 0.01) === 1 && valueAt(a, 0.2) === 10 && offOf(a, 0.5), "a place at the left end is 1, and 0.5 lies off the ruler");
}

// ---------- a place and a value ----------
{
  const q = QUOTES.find(x => x.id === "ge-13"), a = axisOf(q);                    // the Panama Canal, 82 km
  check(valueAt(a, 0) === a.lo && valueAt(a, 1) === a.hi, "the ends are the ruler's ends");
  check(Math.abs(posOf(a, q.truth) - Math.log10(q.truth / a.lo) / DECADES) < 1e-9, "a log ruler is even in doublings: a place is a share of the decades");
  const p = 0.37, v = valueAt(a, p);
  check(Math.abs(posOf(a, v) - p) < 0.02 && v === Number(v.toPrecision(2)), "a place gives a value of two figures, and the value is back near the place");
  check(valueAt(a, -1) === a.lo && valueAt(a, 7) === a.hi && posOf(a, a.lo / 100) === 0 && posOf(a, a.hi * 100) === 1, "beyond an end it stops at the end");
  check(offOf(a, a.lo / 2) && offOf(a, a.hi * 2) && !offOf(a, q.truth), "a figure typed beyond an end is off the ruler");
  const y = axisOf(QUOTES.find(x => x.unit === "year"));
  check(valueAt(y, 0.5) === 1525 && posOf(y, 1525) === 0.5 && Number.isInteger(valueAt(y, 0.3333)), "a year is a whole year, the ruler plain");
  const pc = axisOf({ id: "x", unit: "%", scale: 10, truth: 40 });
  check(pc && pc.lo === 0 && pc.hi === 100 && !axisOf({ id: "x", unit: "%", scale: 10, truth: 140 }), "a percentage is 0 to 100, and none when the figure is over it");
  check(labelOf(1) === "1" && labelOf(100) === "100" && labelOf(1e3) === "1k" && labelOf(2e5) === "200k" && labelOf(1e6) === "1M" && labelOf(1e9) === "1bn" && labelOf(0.01) === "0.01", "ticks read 1, 100, 1k, 1M, 1bn");
  check(TAP_WIDTH(a) > 0.05 && TAP_WIDTH(a) < 0.15 && TAP_WIDTH(y) > 0.05 && TAP_WIDTH(pc) === 0.2, "a tap makes a market of a sensible width");
}

// ---------- the page ----------
{
  const html = fs.readFileSync(new URL("../quote.html", import.meta.url), "utf8"), js = fs.readFileSync(new URL("../quote.js", import.meta.url), "utf8"), css = fs.readFileSync(new URL("../quote.css", import.meta.url), "utf8");
  check(/id="dial"[^>]*>\s*<\/div>\s*<div id="market"/.test(html), "the ruler sits over the boxes");
  check(/mountDial\(\$\("dial"\)/.test(js) && /syncDial\(\);\s*\}\s*\/\*\* A market's verdict/.test(js) && /addEventListener\("input", syncDial\)/.test(js), "the page draws it after every state and hears the boxes");
  check(/\.qt-card\.settled #dial/.test(css) && /\.qt-dial\.none \{ visibility: hidden/.test(css), "a settled market hides it, and a question without one keeps its room");
}

console.log(bad ? `quote-dial: ${bad} problems` : `quote-dial: a ruler for ${withRuler.length} of ${QUOTES.length} questions, none telling its answer`);
if (bad) process.exitCode = 1;
