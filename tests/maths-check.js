// How tests/maths.mjs verifies a lesson step by a route the lesson did not use. A step's `chk` says which:
//   js     the answer equals a JavaScript expression's value (a count, a search, a plain sum)
//   pred   a JavaScript predicate holds for the right option and for none of the others
//   ident  the option is the same function of x as `f` (an expansion, a factorisation, a simplification)
//   inverse the option undoes f
//   deriv / anti / def   the option is f's derivative / an antiderivative of f / the integral of f from a to b, by a numerical estimate
//   roots  the option's list is exactly the roots of f (on `dom`, else -60 to 60), found by scanning for sign changes
//   lim    the option is f's limit, estimated by evaluating beside the point
//   goal   the sliders at the goal satisfy each [expression, value, tolerance?] in eqs
//   goal-e some slider position satisfies the goal expression, and not most of them
//   vec    the option is the vector (o.v) that `f` (a JavaScript expression) gives
//   cplx   the option is the complex number [re, im] that `f` (a JavaScript expression) gives
//   riemann / taylor / epsdelta   the exercise can be won, and is not won at its start
//   words  a question about words: nothing to compute
//   bank   the question is in the bank
import { compile, valueOf } from "../maths-expr.js";
import { deriv, simpson, riemann } from "../maths-math.js";

const js = src => new Function(`return (${src})`)();
const near = (a, b, rel = 1e-7) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const SAMPLES = [-2.3, -0.7, 0.4, 1.3, 1.9, 3.1];
const isText = o => typeof o === "string" && o.startsWith("~");
const val = o => (isText(o) ? NaN : valueOf(String(o)));

/** Whether `ok` holds at every sample where f is defined (and there are at least three). */
function onDomain(f, ok) {
  const at = SAMPLES.filter(x => Number.isFinite(f({ x })) && Number.isFinite(f({ x: x + 1e-3 })) && Number.isFinite(f({ x: x - 1e-3 })));
  return at.length >= 3 && at.every(ok);
}

/** The roots of f on [-60, 60], by scanning for sign changes and bisecting. */
export function rootsOf(f, lo = -60, hi = 60) {
  const out = [], steps = Math.round((hi - lo) * 1000);
  let prev = f(lo), x = lo;
  for (let i = 1; i <= steps; i++) {
    const nx = lo + i * 0.001, y = f(nx);
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
  const f = chk.f && !["js", "pred", "cplx", "vec"].includes(chk.t) ? compile(chk.f) : null;
  switch (chk.t) {
    case "js": { const J = js(chk.f); return o => near(val(o), J, chk.tol ?? 1e-9); }
    case "pred": { const p = js(chk.p); return o => { const v = val(o); return !Number.isNaN(v) && !!p(v); }; }
    case "ident": return o => { if (isText(o) || Array.isArray(o)) return false; const g = compile(String(o)); return onDomain(f, x => near(g({ x }), f({ x }))); };
    case "inverse": return o => { if (isText(o)) return false; const g = compile(String(o)); return SAMPLES.every(x => near(f({ x: g({ x }) }), x)); };
    case "deriv": return o => { const g = compile(String(o)); return onDomain(f, x => near(g({ x }), deriv(t => f({ x: t }), x), 1e-5)); };
    case "anti": return o => { const g = compile(String(o)); return onDomain(f, x => near(deriv(t => g({ x: t }), x), f({ x }), 1e-5)); };
    case "def": return o => near(val(o), simpson(t => f({ x: t }), js(String(chk.a)), js(String(chk.b))), 1e-6);
    case "lim": return o => { const at = js(String(chk.to)), e = chk.e ?? 1e-4; return near(val(o), at === Infinity ? f({ x: 1e8 }) : (f({ x: at - e }) + f({ x: at + e })) / 2, 1e-3); };
    case "cplx": { const [re, im] = js(chk.f); return o => !!(o && o.c) && near(o.c[0], re) && near(o.c[1], im); }
    case "roots": {
      const rs = rootsOf(x => f({ x }), ...(chk.dom ? chk.dom.map(d => js(String(d))) : []));
      if (chk.n != null && rs.length !== chk.n) throw new Error(`${step.id}: expected ${chk.n} roots, found ${rs.length}`);
      return o => Array.isArray(o) && o.length === rs.length && o.every(e => rs.some(r => near(valueOf(e), r, 1e-6)));
    }
        case "vec": { const J = js(chk.f); return o => !!(o && o.v) && o.v.length === J.length && o.v.every((x, i) => near(x, J[i])); }
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
  if (chk.t === "riemann") {
    const w = step.w, F = x => compile(w.f)({ x }), exact = simpson(F, w.a, w.b);
    const hows = w.hows || ["left", "right", "mid", "trap"], errH = (n, how) => Math.abs(riemann(F, w.a, w.b, n, how) - exact) / Math.abs(exact);
    if (hows.some(h => errH(w.n.v, h) <= w.goal.err)) bad.push(`${where}: the start already wins with some rule`);
    if (!hows.some(h => errH(w.n.max, h) <= w.goal.err)) bad.push(`${where}: even ${w.n.max} strips do not win`);
    return bad;
  }
  if (chk.t === "taylor") {
    const w = step.w, f = x => compile(w.f)({ x }), P = (x, n) => w.c.slice(0, n + 1).reduce((s, c, k) => s + c * x ** k, 0), err = n => Math.abs(f(w.at) - P(w.at, n));
    if (!(err(w.deg.v) > w.goal.err)) bad.push(`${where}: the start already wins`);
    if (!(err(w.deg.max) <= w.goal.err)) bad.push(`${where}: even degree ${w.deg.max} does not win`);
    if (!(Math.abs(f(0.1) - P(0.1, w.deg.max)) < 1e-4 && Math.abs(f(0.2) - P(0.2, w.deg.max)) < 1e-3)) bad.push(`${where}: the coefficients do not give the function near 0`);
    return bad;
  }
  if (chk.t === "epsdelta") {
    const w = step.w, f = x => compile(w.f)({ x }), holds = d => { for (let i = 0; i <= 400; i++) { const x = w.a - d + (2 * d * i) / 400; if (Math.abs(x - w.a) < 1e-12) continue; if (!(Math.abs(f(x) - w.L) < w.eps)) return false; } return true; };
    if (!near(f(w.a - 1e-6), w.L, 1e-4) || !near(f(w.a + 1e-6), w.L, 1e-4)) bad.push(`${where}: ${w.L} is not the limit`);
    if (holds(w.dmax || 2)) bad.push(`${where}: the biggest δ already works`);
    if (!holds(0.01)) bad.push(`${where}: even δ = 0.01 fails`);
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
