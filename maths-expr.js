// The Maths course's expressions: a small calculator language (numbers, x and other variables, + - * / ^, sin cos tan asin
// acos atan sinh cosh tanh exp ln log10 sqrt abs, pi, e) that is compiled to a function for the plotter and the checks, and
// printed as plain readable text (x², √3/2, π/6) for the course's answer buttons. No eval anywhere: the text is parsed.
//   compile("x^2-3*x")({ x: 2 })      → -2
//   pretty("3*x^2*sin(x)")            → "3x² sin x"
// Writing rules: every product is written with *, a power with ^ (x^2, x^(1/2), e^(-x)), a function with brackets (sin(x)).

const FUNS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh,
  tanh: Math.tanh, exp: Math.exp, ln: Math.log, log10: Math.log10, sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor,
};
const CONST = { pi: Math.PI, e: Math.E };

/** Text → syntax tree: { t: "num", v } | { t: "var", n } | { t: "neg", a } | { t: "bin", op, a, b } | { t: "fn", n, a }. */
export function parse(src) {
  const s = String(src).replace(/\s+/g, "");
  let i = 0;
  const fail = what => { throw new Error(`maths-expr: ${what} at ${i} in "${src}"`); };
  const peek = () => s[i];
  function expr() {
    let a = term();
    while (peek() === "+" || peek() === "-") { const op = s[i++]; a = { t: "bin", op, a, b: term() }; }
    return a;
  }
  function term() {
    let a = unary();
    while (peek() === "*" || peek() === "/") { const op = s[i++]; a = { t: "bin", op, a, b: unary() }; }
    return a;
  }
  function unary() {
    if (peek() === "-") { i++; return { t: "neg", a: unary() }; }
    if (peek() === "+") { i++; return unary(); }
    return power();
  }
  function power() {
    const a = atom();
    if (peek() === "^") { i++; return { t: "bin", op: "^", a, b: unary() }; }      // right-associative: 2^3^2 = 2^(3^2)
    return a;
  }
  function atom() {
    const c = peek();
    if (c === "(") { i++; const a = expr(); if (peek() !== ")") fail("missing )"); i++; return a; }
    if (c >= "0" && c <= "9" || c === ".") {
      const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) fail("bad number");
      i += m[0].length;
      return { t: "num", v: Number(m[0]) };
    }
    const m = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(s.slice(i));
    if (!m) fail(`unexpected "${c ?? "end"}"`);
    i += m[0].length;
    const n = m[0];
    if (peek() === "(" && FUNS[n]) { i++; const a = expr(); if (peek() !== ")") fail("missing )"); i++; return { t: "fn", n, a }; }
    if (FUNS[n]) fail(`${n} needs brackets`);
    return { t: "var", n };
  }
  const tree = expr();
  if (i < s.length) fail(`stray "${s[i]}"`);
  return tree;
}

/** Text → function of an object of variables. Unknown variables are NaN. */
export function compile(src) {
  const build = n => {
    switch (n.t) {
      case "num": { const v = n.v; return () => v; }
      case "var": { const k = n.n, d = k in CONST ? CONST[k] : NaN; return o => (o && k in o ? o[k] : d); }
      case "neg": { const a = build(n.a); return o => -a(o); }
      case "fn": { const a = build(n.a), f = FUNS[n.n]; return o => f(a(o)); }
      default: {
        const a = build(n.a), b = build(n.b);
        switch (n.op) {
          case "+": return o => a(o) + b(o);
          case "-": return o => a(o) - b(o);
          case "*": return o => a(o) * b(o);
          case "/": return o => a(o) / b(o);
          default: return o => Math.pow(a(o), b(o));
        }
      }
    }
  };
  return build(typeof src === "string" ? parse(src) : src);
}

/** Text → a function of x alone, with any named extras held fixed: the plotter's workhorse. */
export function fnOf(src, extra = {}) { const f = compile(src); return x => f({ ...extra, x }); }

/** A number from text, "3/4" or "-0.5" or "sqrt(2)" or "pi/6" ("," as a decimal point allowed); NaN when it is not one. */
export function valueOf(text) {
  try { return compile(String(text).replace(/,/g, ".").replace(/−/g, "-").replace(/π/g, "pi").replace(/√(\d+\.?\d*|pi)/g, "sqrt($1)").replace(/\s+/g, ""))({}); } catch { return NaN; }
}

/** The names of the free variables in a text, other than x. */
export function params(src) {
  const out = new Set(), walk = n => { if (n.t === "var") { if (n.n !== "x" && !(n.n in CONST)) out.add(n.n); } else if (n.a) { walk(n.a); if (n.b) walk(n.b); } };
  walk(parse(src));
  return [...out];
}

// ---------- printing ----------
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };
const prec = n => (n.t === "bin" ? PREC[n.op] : n.t === "neg" ? 2 : 5);
const isNum = n => n.t === "num";
const digits = t => [...t].map(c => SUP[c]).join("");

function show(n) {
  switch (n.t) {
    case "num": return String(Number.isInteger(n.v) ? n.v : Number(n.v.toPrecision(10)));
    case "var": return n.n === "pi" ? "π" : n.n;
    case "neg": return `−${wrap(n.a, 3)}`;
    case "fn": {
      const a = n.a, atom = a.t === "num" || a.t === "var";
      if (n.n === "sqrt") return `√${atom ? show(a) : `(${show(a)})`}`;
      if (n.n === "exp") return atom ? `e${sup(a)}` : `e^(${show(a)})`;
      const simple = atom || (a.t === "bin" && (a.op === "*" || a.op === "/") && a.a.t !== "bin" && a.b.t !== "bin");
      return simple ? `${n.n} ${show(a)}` : `${n.n}(${show(a)})`;
    }
    default: {
      const { op, a, b } = n;
      if (op === "+") return `${show(a)} + ${show(b)}`;
      if (op === "-") return `${show(a)} − ${wrap(b, 2)}`;
      if (op === "*") {
        const numLike = n => isNum(n) || (n.t === "bin" && n.op === "^" && isNum(n.a));          // 10⁹ stands like a number
        const sep = isNum(a) && numLike(b) ? " × " : a.t === "fn" || b.t === "fn" || isNum(b) ? " " : "";
        return `${wrap(a, 2)}${sep}${wrap(b, 3)}`;
      }
      if (op === "/") return `${wrap(a, 3)}/${b.t === "bin" || b.t === "neg" ? `(${show(b)})` : show(b)}`;
      return `${a.t === "var" || (isNum(a) && a.v >= 0) ? show(a) : `(${show(a)})`}${sup(b)}`;
    }
  }
}
/** A child printed in brackets when it binds looser than `min` (a negative number counts as looser). */
const wrap = (n, min) => (prec(n) < min || (isNum(n) && n.v < 0) ? `(${show(n)})` : show(n));
function sup(e) {
  if (isNum(e) && Number.isInteger(e.v) && e.v >= 0) return digits(String(e.v));
  if (e.t === "neg" && isNum(e.a) && Number.isInteger(e.a.v)) return `⁻${digits(String(e.a.v))}`;
  if (e.t === "var" && e.n === "n") return "ⁿ";
  return e.t === "num" || e.t === "var" ? `^${show(e)}` : `^(${show(e)})`;
}
/** Text → how the course shows it: 3*x^2*sin(x) → "3x² sin x", sqrt(3)/2 → "√3/2". */
export const pretty = src => show(parse(src));
