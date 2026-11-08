// Constellation's letters: every vowel about as likely as the others, every consonant too (Korbi, 8 Nov 2026: "ROUGHLY even
// probabilities", "AEIOUY, two or three of these per constellation"). Which letter sets pass a level's tests is uneven, so the
// engine's LEAN table bends the draw; `node tests/yield-letters.mjs --fit` deals skies, nudges the table and prints a new one to
// paste into yield-engine.js (setLean takes it). Without --fit it checks the spread.
import { deal, setLean } from "../yield-engine.js";

const LEVELS = ["light", "medium", "heavy"], VOWELS = "aeiouy";
const fit = process.argv.includes("--fit"), N = Number(process.env.N) || (fit ? 100 : 60);
let bad = 0;
const check = (ok, what) => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${what}`); };

function shares(seedBase) {
  const seen = {}, size = {};
  let skies = 0;
  for (const level of LEVELS) for (let s = 1; s <= N; s++) {
    const p = deal({ seed: seedBase + s * 7919, level });
    skies++;
    size[p.letters.length] = (size[p.letters.length] || 0) + 1;
    for (const c of p.letters) seen[c] = (seen[c] || 0) + 1;
  }
  return { seen, skies, size };
}

if (fit) {
  let lean = {};
  const ENGINE = await import("../yield-engine.js");
  for (let round = 0; round < Number(process.env.ROUNDS || 6); round++) {
    ENGINE.setLean(lean);
    const { seen, skies } = shares(round * 1000003);
    const next = { ...lean };
    for (const c of "abcdefghijklmnopqrtuvwxyz") {   // (no S: the word list has none)
      const want = VOWELS.includes(c) ? 0.46 : 0.34, got = Math.max(0.01, (seen[c] || 0) / skies);
      next[c] = Math.min(2, Math.max(0.1, (lean[c] ?? 1) * Math.pow(want / got, 0.5)));
    }
    lean = next;
    console.log(`round ${round}: ` + Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([c, v]) => c + (v / skies).toFixed(2)).join(" "));
  }
  console.log("const LEAN = " + JSON.stringify(Object.fromEntries(Object.entries(lean).map(([c, v]) => [c, Math.round(v * 100) / 100]))) + ";");
} else {
  const { seen, skies, size } = shares(0);
  const share = c => (seen[c] || 0) / skies, vs = [...VOWELS].map(share);
  console.log("shares:", Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([c, v]) => c + (v / skies).toFixed(2)).join(" "), "| sizes", JSON.stringify(size));
  check(Math.max(...vs) <= 3 * Math.min(...vs), `the six vowels are within three to one of each other, E the highest (${Math.min(...vs).toFixed(2)} to ${Math.max(...vs).toFixed(2)})`);
  check(share("e") <= 0.85 && share("t") <= 0.6 && share("a") <= 0.65 && share("r") <= 0.7, "T, A and R are not in most skies, and E is not in all of them");
  check(Math.max(...Object.values(seen)) / skies <= 0.85 && "bcdfghklmnpvwy".split("").every(c => share(c) >= 0.12), "no letter is in nearly every sky, and the ordinary consonants all come up");
  check([7, 8, 9, 10, 11].every(n => (size[n] || 0) > 0), "skies of seven to eleven stars all appear");
  process.exit(bad ? 1 : 0);
}
