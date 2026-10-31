// Quote's ruler (quote-dial.js): which questions have one, that it never tells the answer (a log ruler's decades are placed by
// the question's id, so the truth is as likely one, two or three decades from the left end, and every year question shares
// one ruler), that a place on it and a value are the same thing both ways, and that the page has it wired in.
// Run: node tests/quote-dial.mjs
import fs from "node:fs";
const { QUOTES } = await import("../quote-bank.js");
const { axisOf, posOf, offOf, valueAt, labelOf, TAP_WIDTH, DECADES } = await import("../quote-dial.js");
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
  for (const q of logs) {
    const a = axisOf(q), at = Math.log10(q.truth / a.lo);
    check(at >= 1 && at < 4 + 1e-9 && a.hi === Number((a.lo * 10 ** DECADES).toPrecision(1)), `${q.id}: the truth lies one to four decades in, inside the ruler (${at.toFixed(2)})`);
    share[Math.floor(at + 1e-9)]++;
  }
  const spread = [1, 2, 3].map(i => share[i] / logs.length);
  check(spread.every(s => s > 0.2), `the truth is one, two or three decades in about as often as each other (${spread.map(s => `${Math.round(s * 100)}%`).join(", ")})`);
  const yearRulers = new Set(years.map(q => JSON.stringify(axisOf(q))));
  check(yearRulers.size === 1 && years.every(q => q.truth >= 1000 && q.truth <= 2050), "every year question has the same ruler, 1000 to 2050");
  check(logs.every(q => { const a = axisOf(q); return a.ticks.every(t => t === Number(t.toPrecision(1))) && a.ticks.length === DECADES + 1; }), "a log ruler's ticks are round numbers, a decade apart");
}

// ---------- a place and a value ----------
{
  const q = QUOTES.find(x => x.id === "tr-05"), a = axisOf(q);                    // the Suez Canal's length, 193 km
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
