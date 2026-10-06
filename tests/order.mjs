// Order: enough dated cards for a run, quantity families of one unit with enough cards each, and every card a number
// that can be compared. Run: node tests/order.mjs
const { QUOTES } = await import("../quote-bank.js");
let bad = 0;
const dates = QUOTES.filter(q => q.unit === "year");
const fams = Object.entries(QUOTES.filter(q => q.unit !== "year").reduce((f, q) => ((f[q.unit] ||= []).push(q), f), {})).filter(([, qs]) => qs.length >= 6);
if (dates.length < 16) { bad++; console.log("too few dated cards", dates.length); }
if (fams.length < 4) { bad++; console.log("too few quantity families", fams.length); }
const notNumbers = QUOTES.filter(q => !Number.isFinite(q.truth));
if (notNumbers.length) { bad++; console.log("cards without a number", notNumbers.map(q => q.id)); }
console.log(bad ? `order: ${bad} problems` : `order: ${dates.length} dated cards, ${fams.length} quantity families (${fams.map(([u, qs]) => `${u} ${qs.length}`).join(", ")})`);
if (bad) process.exitCode = 1;

// primers: each a key and at least eight cards of very different sizes, every value a number, no two alike, each shown
const { PRIMERS } = await import("../kb/items/primers.js");
for (const p of PRIMERS) {
  const vs = p.items.map(i => i.v);
  if (!p.key || p.items.length < 8 || vs.some(v => !Number.isFinite(v) || v <= 0) || new Set(vs).size !== vs.length || p.items.some(i => !i.shown)) { bad++; console.log("primer", p.id, "is incomplete"); }
}
console.log(`order: ${PRIMERS.length} primers (${PRIMERS.map(p => `${p.name} ${p.items.length}`).join(", ")})`);
if (bad) process.exitCode = 1;
