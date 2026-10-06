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

// every unit with a key (a hectare, a kWh) has a family of cards to order, and every key is a sentence
const { UNIT_KEYS } = await import("../kb/items/units.js");
for (const [unit, key] of Object.entries(UNIT_KEYS)) {
  const n = QUOTES.filter(q => q.unit === unit).length;
  if (n < 6 || !/\.$/.test(key)) { bad++; console.log("unit", unit, "has", n, "cards or no key"); }
}
console.log(`order: keys for ${Object.keys(UNIT_KEYS).join(", ")}`);
if (bad) process.exitCode = 1;
