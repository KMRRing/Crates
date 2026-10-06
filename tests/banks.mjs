// The subject banks don't give their answers away: the right option mustn't stand out as clearly the longest, or as
// the only one with a formula or a number. Banks listed in CLEAN are held to it (none may give an answer away);
// the others are counted until they're rewritten. Run: node tests/banks.mjs
import fs from "fs";
globalThis.window = {}; globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const P = await import("../punt-gen.js");
const CLEAN = new Set(["physics", "chemistry", "economics", "religion", "code", "wine", "art", "words", "refining", "reasoning", "cities", "flags", "patterns", "philosophy"]);
const formula = s => /[=≥≤≈∝ΔΣ∫√±×÷^ℏπλμσ$/−²³⁴⁵ⁿ⁰¹⁺⁻₀₁₂₃ₐᵇ∑∏∞∂∇⟂∥ℤℝℂℕ∈⊂]|\d/.test(s);
// options that are all names (a country, a city, a painter, a museum) vary in length by nature, not by a writer
// padding the answer: the length rule leaves them be
const nameLike = s => /^(the )?[A-ZÀ-Þ]/.test(s) && !/[:;]/.test(s) && s.split(/\s+/).length <= 6 && !/\d/.test(s);
export function givesAway(q) {
  const right = q.a.map(i => q.o[i]), wrong = q.o.filter((_, i) => !q.a.includes(i));
  if (!wrong.length) return false;
  if (q.o.every(nameLike)) return q.o.length >= 3 && right.every(formula) && wrong.every(s => !formula(s));
  const rl = Math.max(...right.map(s => s.length)), wl = wrong.map(s => s.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  const longest = rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8;
  const onlyFormula = q.o.length >= 3 && right.every(formula) && wrong.every(s => !formula(s));
  return longest || onlyFormula;
}
let bad = 0;
const counts = [];
for (const [id] of P.TOPIC_LIST) {
  if (P.CLUE_TOPICS[id]) continue;
  const B = await import(`../${P.LEVELS[id].bank.replace("./", "")}`);
  const qs = B[Object.keys(B).find(k => Array.isArray(B[k]) && B[k][0]?.o)] || [];
  const away = qs.filter(givesAway);
  counts.push(`${id} ${away.length}/${qs.length}`);
  if (CLEAN.has(id) && away.length) { bad++; console.log(`${id} gives answers away again: ${away.map(q => q.id).join(", ")}`); }
}
console.log(`banks: ${bad ? "FAILED" : `clean (${[...CLEAN].join(", ")}) give nothing away`}; still to rewrite: ${counts.filter(c => !CLEAN.has(c.split(" ")[0]) && !c.startsWith(c.split(" ")[0] + " 0/")).join(", ")}`);
if (bad) process.exitCode = 1;
