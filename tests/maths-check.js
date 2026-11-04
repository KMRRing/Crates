// How tests/maths.mjs verifies a lesson step by a route the lesson did not use. A step's `chk` says which:
//   js     the answer equals a JavaScript expression's value (a count, a search, a plain sum)
//   pred   a JavaScript predicate holds for the right option and for none of the others
//   ident  the option is the same function of x as `f` (an expansion, a factorisation, a simplification)
//   inverse the option undoes f
//   deriv / anti / def   the option is f's derivative / an antiderivative of f / the integral of f from a to b, by a numerical estimate
//   roots  the option's list is exactly the roots of f, found by scanning for sign changes
//   lim    the option is f's limit, estimated by evaluating beside the point
//   goal   the sliders at the goal satisfy each [expression, value, tolerance?] in eqs
//   goal-e some slider position satisfies the goal expression, and not most of them
//   words  a question about words: nothing to compute
//   bank   the question is in the bank
import { compile, valueOf } from "../maths-expr.js";
import { deriv, simpson } from "../maths-math.js";

const js = src => new Function(`return (${src})`)();
const near = (a, b, rel = 1e-7) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const SAMPLES = [-2.3, -0.7, 0.4, 1.3, 1.9, 3.1];
const isText = o => typeof o === "string" && o.startsWith("~");
const val = o => (isText(o) ? NaN : valueOf(String(o)));

/** The roots of f on [-60, 60], by scanning for sign changes and bisecting. */
export function rootsOf(f) {
  const out = [];
  let prev = f(-60), x = -60;
  for (let i = 1; i <= 120000; i++) {
    const nx = -60 + i * 0.001, y = f(nx);
    if (Math.abs(y) < 1e-12 || (Number.isFinite(prev) && Number.isFinite(y) && prev * y < 0 && Math.abs(y - prev) < 1e3)) {
      let lo = x, hi = nx;
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if ((f(m) < 0) === (f(lo) < 0)) lo = m; else hi = m; }
      const r = (lo + hi) / 2;
      if (!out.some(q => Math.abs(q - r) < 1e-6)) out.push(r);
    }
    prev = y; x = nx;
  }
  return out.sort((a, b) => a - b);
}

/** Whether one option is right by this step's check: (option) → boolean. */
export function judge(chk, step) {
  const f = chk.f && chk.t !== "js" && chk.t !== "pred" ? compile(chk.f) : null;
  switch (chk.t) {
    case "js": { const J = js(chk.f); return o => near(val(o), J, chk.tol ?? 1e-9); }
    case "pred": { const p = js(chk.p); return o => { const v = val(o); return !Number.isNaN(v) && !!p(v); }; }
    case "ident": return o => { if (isText(o) || Array.isArray(o)) return false; const g = compile(String(o)); return SAMPLES.every(x => near(g({ x }), f({ x }))); };
    case "inverse": return o => { if (isText(o)) return false; const g = compile(String(o)); return SAMPLES.every(x => near(f({ x: g({ x }) }), x)); };
    case "deriv": return o => { const g = compile(String(o)); return SAMPLES.every(x => near(g({ x }), deriv(t => f({ x: t }), x), 1e-5)); };
    case "anti": return o => { const g = compile(String(o)); return SAMPLES.every(x => near(deriv(t => g({ x: t }), x), f({ x }), 1e-5)); };
    case "def": return o => near(val(o), simpson(t => f({ x: t }), js(String(chk.a)), js(String(chk.b))), 1e-6);
    case "lim": return o => { const at = js(String(chk.to)); const e = 1e-7; return near(val(o), at === Infinity ? f({ x: 1e8 }) : (f({ x: at - e }) + f({ x: at + e })) / 2, 1e-4); };
    case "roots": {
      const rs = rootsOf(x => f({ x }));
      if (chk.n != null && rs.length !== chk.n) throw new Error(`${step.id}: expected ${chk.n} roots, found ${rs.length}`);
      return o => Array.isArray(o) && o.length === rs.length && o.every(e => rs.some(r => near(valueOf(e), r, 1e-6)));
    }
    default: return () => false;
  }
}

/** Problems with one step (an empty list when it checks out), given the bank ids for `bank` steps. */
export function verify(step, bankIds) {
  const bad = [], chk = step.chk, where = step.id || "?";
  const needsAnswer = step.quiz || step.num;
  if (needsAnswer && !chk) return [`${where}: no check`];
  if (!chk) return bad;
  if (chk.t === "bank") { if (!bankIds.has(step.bank)) bad.push(`${where}: ${step.bank} is not in the bank`); return bad; }
  if (chk.t === "words") return bad;
  if (chk.t === "goal") {
    const g = step.w?.goal?.p;
    if (!g) return [`${where}: goal check without a goal`];
    const vars = { ...g };
    for (const [e, want, tol] of chk.eqs) { const got = compile(e)(vars); if (!near(got, want, tol ?? 1e-9)) bad.push(`${where}: ${e} is ${got} at the goal, not ${want}`); }
    return bad;
  }
  if (chk.t === "goal-e") {
    const w = step.w, g = w.goal, [name, spec] = Object.entries(w.params)[0], e = compile(g.e);
    let ok = 0, all = 0;
    for (let v = spec.min; v <= spec.max + 1e-9; v += spec.step) { all++; if (Math.abs(e({ [name]: v }) - g.v) <= (g.tol ?? 0.05)) ok++; }
    if (!ok) bad.push(`${where}: no slider position satisfies the goal`);
    if (ok / all > 0.3) bad.push(`${where}: ${ok} of ${all} positions satisfy the goal`);
    return bad;
  }
  let is;
  try { is = judge(chk, step); } catch (e) { return [`${where}: ${e.message}`]; }
  if (step.num) {
    const want = valueOf(step.num.ans), tol = step.num.tol ?? 1e-9;
    let J;
    try { J = chk.t === "def" ? simpson(t => compile(chk.f)({ x: t }), js(String(chk.a)), js(String(chk.b))) : js(chk.f); } catch (e) { return [`${where}: ${e.message}`]; }
    if (!(Math.abs(want - J) <= tol * Math.max(1, Math.abs(J)) + 1e-12 || Math.abs(want - J) <= tol)) bad.push(`${where}: the answer is ${want}, the check gets ${J}`);
    return bad;
  }
  if (step.quiz) {
    const right = step.opts.filter(is).length;
    if (!is(step.opts[step.answer])) bad.push(`${where}: the marked answer ${JSON.stringify(step.opts[step.answer])} fails its check`);
    if (right !== 1) bad.push(`${where}: ${right} options pass the check`);
  }
  return bad;
}
