// Writes assay-equations.js: Assay's equation answers (README, Assay: Numbers) for each length, the balancing sums of
// the length with nothing trivial in them: node assay-equations.mjs (a few seconds). Run it again if the rules of what
// counts as an answer change; tests/assay-numbers.mjs fails until it has been (it works out the shorter lengths again
// and compares). `equationsOf(n)` is the list itself.
import fs from "fs";
import { valueOf } from "./assay-numbers.js";

const SIGNS = ["+", "-", "*", "/"];
const numbers = len => { const out = []; for (let v = len === 1 ? 0 : 10 ** (len - 1); v < 10 ** len; v++) out.push(v); return out; };
// every way to cut `chars` into numbers of lengths with a sign between each
function* shapes(chars, acc = []) {
  if (chars === 0) { yield acc; return; }
  for (let l = 1; l <= Math.min(chars, 6); l++) {
    const rest = chars - l;
    if (rest === 0) yield [...acc, l];
    else if (rest >= 2) yield* shapes(rest - 1, [...acc, l]);      // a sign, then at least one more number
  }
}
/** Every sum of `L` characters that comes out whole and not negative, with its operands and signs. */
function* sums(L) {
  for (const shape of shapes(L)) {
    const pools = shape.map(numbers), k = shape.length, vs = Array(k), os = Array(k - 1);
    const signs = j => {
      if (j === k - 1) { const text = vs.reduce((t, v, i) => t + (i ? os[i - 1] : "") + v, ""), val = valueOf(text); if (val !== null && val >= 0) return [text, val, [...vs], [...os]]; return null; }
      return undefined;
    };
    const out = [];
    const recOps = j => { if (j === k - 1) { const r = signs(j); if (r) out.push(r); return; } for (const o of SIGNS) { os[j] = o; recOps(j + 1); } };
    const recNums = i => { if (i === k) { recOps(0); return; } for (const v of pools[i]) { vs[i] = v; recNums(i + 1); } };
    recNums(0);
    yield* out;
  }
}
// trivial: a lone number, a zero added or taken, a one or a zero multiplied or divided
const trivial = (vs, os) => os.length === 0 || os.some((o, q) => ((o === "*" || o === "/") && (vs[q] <= 1 || vs[q + 1] <= 1)) || ((o === "+" || o === "-") && (vs[q] === 0 || vs[q + 1] === 0)));

/** The answers of n characters, alphabetical: the sums that balance, with a whole number alone on the right, and nothing trivial. */
export function equationsOf(n) {
  const list = new Set();
  for (let right = 1; right <= n - 4; right++) {
    const L = n - 1 - right;
    for (const [text, val, vs, os] of sums(L)) if (String(val).length === right && !trivial(vs, os)) list.add(`${text}=${val}`);
  }
  return [...list].sort();
}

// run as a program, it writes the file
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const out = {};
  for (const n of [6, 7, 8]) {
    const t0 = Date.now();
    out[n] = equationsOf(n);
    console.log(`${n}: ${out[n].length} equations in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  fs.writeFileSync(new URL("./assay-equations.js", import.meta.url), `// Assay's equation answers, written by assay-equations.mjs: don't edit, rerun it (tests/assay-numbers.mjs says when).
// Each length's balancing sums, alphabetical, with nothing trivial in them, joined by commas; loaded when first wanted
// (assay-numbers.js, EQUATIONS.load).
export const EQUATIONS = {
${Object.entries(out).map(([n, l]) => `  ${n}: "${l.join(",")}",`).join("\n")}
};
`);
}
