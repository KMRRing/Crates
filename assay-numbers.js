// Assay's two number games (README, Assay: Numbers), lexicons in the engine's sense (see assay-words.js): what can be
// typed, what is accepted as a guess and what may be the answer. The marks are Wordle's on digits and signs.
//
// Primes: a prime of four or five digits (Primel's idea). A guess must be a prime too, so every guess is a real
// question about primes. Easy: no digit repeats; Medium: any; Hard: a digit repeats (the marks of a repeat are the
// least obvious).
//
// Equations: a sum that balances, of six to eight characters (Nerdle's idea): digits, + - * / and one =, a number
// alone on the right. A guess must balance, by the usual order of operations (the sum is worked exactly: 6/4*2 is 3),
// no number with a leading zero. Answers leave out the trivial (a zero added, a one multiplied) and are in
// assay-equations.js, written by assay-equations.mjs and loaded when first wanted. Easy: only + and -, at most two
// of them; Medium: a times; Hard: a divide, or three signs or more.

// ---------- primes ----------
const isPrimeBy = n => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const primePools = new Map();
const primesOf = len => {
  if (!primePools.has(len)) {
    const out = [];
    for (let n = 10 ** (len - 1); n < 10 ** len; n++) if (isPrimeBy(n)) out.push(String(n));
    primePools.set(len, out);
  }
  return primePools.get(len);
};
const repeats = w => new Set(w).size < w.length;
const DIGITS = "0123456789";
export const PRIMES = Object.freeze({
  id: "primes",
  name: "Primes",
  unit: "digits",
  noun: "prime",
  lengths: [4, 5],
  rows: ["12345", "67890"],
  levelNote: "Easy: no digit repeats. Hard: a digit repeats.",
  letter: ch => (ch.length === 1 && DIGITS.includes(ch) ? ch : ""),
  show: ch => ch,
  accepts: w => w.length >= 4 && w.length <= 5 && /^[1-9]\d*$/.test(w) && isPrimeBy(Number(w)),
  why: w => (/^\d+$/.test(w) ? "Not a prime" : "Digits only"),
  answers: len => Object.freeze(primesOf(len).map(w => Object.freeze({ w, tier: repeats(w) ? 2 : 0 }))),
  /** The pack indices of a level's answers: Easy has no repeated digit, Hard has one, Medium is all. */
  levelOf: (P, level) => [...P.words.keys()].filter(i => level === "medium" || (level === "easy") === (P.tier[i] === 0)),
});

// ---------- equations ----------
const SIGNS = "+-*/";
const OPERAND = /^(0|[1-9]\d*)$/;
/** The value of a sum without the = (an integer), by the usual order of operations and exact fractions; null if it is not one. */
export function valueOf(text) {
  const parts = text.split(/([-+*/])/);                 // numbers at the even places, signs at the odd
  if (parts.length % 2 === 0 || parts.length === 1) return null;
  const vals = [], ops = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2) ops.push(parts[i]);
    else { if (!OPERAND.test(parts[i]) || parts[i].length > 6) return null; vals.push([Number(parts[i]), 1]); }
  }
  const apply = (a, o, b) => {
    if (o === "+") return [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
    if (o === "-") return [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
    if (o === "*") return [a[0] * b[0], a[1] * b[1]];
    if (b[0] === 0) return null;
    const n = a[0] * b[1], d = a[1] * b[0];
    return d < 0 ? [-n, -d] : [n, d];
  };
  for (const pass of ["*/", "+-"]) {
    for (let i = 0; i < ops.length;) {
      if (!pass.includes(ops[i])) { i++; continue; }
      const r = apply(vals[i], ops[i], vals[i + 1]);
      if (!r) return null;
      vals.splice(i, 2, r);
      ops.splice(i, 1);
    }
  }
  const [n, d] = vals[0];
  return n % d === 0 ? n / d : null;
}
/** Whether text is an equation that balances: one =, a sum on the left, a whole number (not negative) alone on the right. */
export function isEquation(text) {
  const at = text.indexOf("=");
  if (at < 1 || at !== text.lastIndexOf("=") || at === text.length - 1) return false;
  const right = text.slice(at + 1);
  if (!OPERAND.test(right)) return false;
  const left = valueOf(text.slice(0, at));
  return left !== null && left === Number(right);
}
const signsIn = w => [...w.slice(0, w.indexOf("="))].filter(c => SIGNS.includes(c));
/** 0 for the easiest kind of equation (only + and -, at most two signs), 1 with a times, 2 with a divide or three signs or more. */
export const tierOfEquation = w => { const s = signsIn(w); return s.includes("/") || s.length >= 3 ? 2 : s.includes("*") ? 1 : 0; };
const SHOWN = { "*": "×", "/": "÷", "-": "−" };

let pool = null;                                        // { len: [equations] } once assay-equations.js has been loaded
const eqPools = new Map();
export const EQUATIONS = Object.freeze({
  id: "equations",
  name: "Equations",
  unit: "characters",
  noun: "equation",
  lengths: [6, 7, 8],
  rows: ["1234567890", "+-*/="],
  levelNote: "Easy: only + and −. Medium: a ×. Hard: a ÷, or three signs or more.",
  letter: ch => (ch.length === 1 && (DIGITS + SIGNS + "=").includes(ch) ? ch : ch === "x" || ch === "X" || ch === "×" ? "*" : ch === "÷" ? "/" : ch === "−" ? "-" : ""),
  show: ch => SHOWN[ch] ?? ch,
  accepts: w => w.length >= 6 && w.length <= 8 && isEquation(w),
  why: w => (/^[0-9+\-*/=]+$/.test(w) ? (w.split("=").length === 2 ? "That doesn't balance" : "One = sign") : "Digits and signs only"),
  /** Fetches the answers (a file of some 200 kB) the first time they are wanted. */
  load: async () => { pool ??= (await import("./assay-equations.js")).EQUATIONS; },
  answers: len => {
    if (!pool) throw new Error("assay-equations.js is not loaded: await EQUATIONS.load() first");
    if (!eqPools.has(len)) eqPools.set(len, Object.freeze(pool[len].split(",").map(w => Object.freeze({ w, tier: tierOfEquation(w) }))));
    return eqPools.get(len);
  },
  /** Easy: only + and -; Medium: a times; Hard: a divide or more signs. Each level is its own kind of equation. */
  levelOf: (P, level) => { const want = level === "easy" ? 0 : level === "medium" ? 1 : 2; return [...P.words.keys()].filter(i => P.tier[i] === want); },
});

/** Every lexicon by id, the English one among them (assay-words.js). */
export const NUMBER_LEXICONS = { primes: PRIMES, equations: EQUATIONS };
