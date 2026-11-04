// The builders the Maths lessons (maths-ch*.js) are written with, so each question is one line of data.
//   P(say, w?)                                  words, over a figure or something to play with (w: maths-stage.js)
//   Q(id, say, right, wrong[], why, chk, w?)    choose. Options are expressions (printed as 3x² sin x), an array of roots (printed
//                                               x = 2 or 3) or "~words" (kept as written). The right one is put where the
//                                               question number says, so it is never always the first.
//   N(id, say, ans, why, chk, extra?, w?)       type a number on the keypad: `ans` is an expression ("3/4", "sqrt(2)")
//   G(id, say, w, why, chk)                     set the sliders (w has a goal)
//   B(bankId, say)                              a question from Punt's maths bank
// `chk` says how tests/maths.mjs verifies the answer by another route (maths-check.js): the lesson computes with maths-math.js,
// the test recomputes with a search, a numerical estimate or a substitution. A step with no number in it says { t: "words" }.
import { pretty } from "./maths-expr.js";

let turn = 0;
/** One option as the text on its button. */
export function show(o) {
  if (o && o.c) return cshow(o.c);
  if (o && o.v) return `(${o.v.map(v => String(Number(v.toPrecision(10))).replace("-", "−")).join(", ")})`;
  if (Array.isArray(o)) return `x = ${o.map(pretty).join(" or ")}`;
  return typeof o === "string" && o.startsWith("~") ? o.slice(1) : pretty(String(o));
}
/** A complex number [re, im] as text: 5 − i, 2i, −1 + 2i. */
export function cshow([re, im]) {
  const f = v => String(Number(v.toPrecision(10))), imag = `${Math.abs(im) === 1 ? "" : f(Math.abs(im))}i`;
  if (!im) return f(re).replace("-", "−");
  if (!re) return `${im < 0 ? "−" : ""}${imag}`;
  return `${f(re).replace("-", "−")} ${im < 0 ? "−" : "+"} ${imag}`;
}
/** A number as an expression text, exact enough for printing and for the checks. */
export const ex = v => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))));

export const P = (say, w) => ({ say, ...(w ? { w } : {}) });

export function Q(id, say, right, wrong, why, chk, w) {
  const all = [...wrong], at = turn++ % (wrong.length + 1);
  all.splice(at, 0, right);
  return { id, say, quiz: all.map(show), answer: at, why, ans: right, opts: all, chk, ...(w ? { w } : {}) };
}
export const N = (id, say, ans, why, chk, extra = {}, w) => ({ id, say, num: { ans, ...extra }, why, chk, ...(w ? { w } : {}) });
export const G = (id, say, w, why, chk) => ({ id, say, w, why, chk });
export const B = (bank, say = "From the bank of questions.") => ({ id: `bank-${bank}`, say, bank, chk: { t: "bank" } });

/** A fraction as TeX: \frac{3}{4}. */
export const ftex = f => (f.d === 1 ? String(f.n) : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`);
/** A polynomial (lowest power first) as TeX: [-6, 1, 1] → x^{2}+x-6. */
export function ptex(p, v = "x") {
  const parts = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (!c) continue;
    const a = Math.abs(c), body = i === 0 ? String(a) : `${a === 1 ? "" : a}${v}${i === 1 ? "" : `^{${i}}`}`;
    parts.push(`${parts.length ? (c < 0 ? "-" : "+") : c < 0 ? "-" : ""}${body}`);
  }
  return parts.join("") || "0";
}
export const chapter =(id, title, lessons) => ({ id, title, lessons });
export const lesson = (id, title, steps, level = "") => ({ id, title, steps, level });
