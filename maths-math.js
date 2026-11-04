// The arithmetic the Maths course states from (never typed in by hand): whole numbers, fractions, polynomials, numerical
// calculus, a few statistics, small matrices, complex numbers. The lessons (maths-ch*.js) call these to make their figures
// and tests/maths.mjs recomputes every figure by another route (a search, a numerical estimate, a substitution).

// ---------- whole numbers ----------
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => (a / gcd(a, b)) * b;
/** [[prime, power]…] */
export function factorise(n) {
  const out = [];
  for (let p = 2; p * p <= n; p++) { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) out.push([p, e]); }
  if (n > 1) out.push([n, 1]);
  return out;
}
export const isPrime = n => n > 1 && factorise(n).length === 1 && factorise(n)[0][1] === 1;
export const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
export const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
export const perm = (n, k) => fact(n) / fact(n - k);
/** n and its prime factors as text: 84 = 2² × 3 × 7. */
export const factorText = n => factorise(n).map(([p, e]) => (e > 1 ? `${p}${"⁰¹²³⁴⁵⁶⁷⁸⁹"[e]}` : `${p}`)).join(" × ");

// ---------- numbers as text ----------
/** A number with at most d decimals and no trailing zeros: 3.10 → "3.1"; negatives with a true minus. */
export function nm(v, d = 2) {
  let s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return (s === "-0" ? "0" : s).replace("-", "−");
}
/** Significant figures. */
export const sf = (v, k = 3) => nm(Number(v.toPrecision(k)), 10);

// ---------- fractions ----------
export const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
export const fadd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fsub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fmul = (a, b) => frac(a.n * b.n, a.d * b.d);
export const fdiv = (a, b) => frac(a.n * b.d, a.d * b.n);
export const fval = a => a.n / a.d;
/** "3/4", "5" or "−2/3", as an expression the course can parse and print. */
export const ftext = a => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);

// ---------- polynomials: coefficients lowest power first, [c0, c1, c2…] ----------
export const pEval = (p, x) => p.reduceRight((s, c) => s * x + c, 0);
export const pDeriv = p => p.slice(1).map((c, i) => c * (i + 1));
export const pInteg = p => [0, ...p.map((c, i) => c / (i + 1))];
export const pMul = (a, b) => { const r = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };
export const pAdd = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0));
/** A polynomial as an expression text for the course: [1,-3,2] → "2*x^2-3*x+1". */
export function pText(p, v = "x") {
  const parts = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (!c) continue;
    const a = Math.abs(c), body = i === 0 ? String(a) : `${a === 1 ? "" : `${a}*`}${v}${i === 1 ? "" : `^${i}`}`;
    parts.push(parts.length ? (c < 0 ? `-${body}` : `+${body}`) : (c < 0 ? `-${body}` : body));
  }
  return parts.join("") || "0";
}
/** Real roots of ax² + bx + c, smaller first ([] when none). */
export function quadRoots(a, b, c) {
  const d = b * b - 4 * a * c;
  if (d < 0) return [];
  const s = Math.sqrt(d);
  return d === 0 ? [-b / (2 * a)] : [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((x, y) => x - y);
}
export const disc = (a, b, c) => b * b - 4 * a * c;

// ---------- sequences ----------
export const arithTerm = (a, d, n) => a + (n - 1) * d;
export const arithSum = (a, d, n) => (n * (2 * a + (n - 1) * d)) / 2;
export const geoTerm = (a, r, n) => a * r ** (n - 1);
export const geoSum = (a, r, n) => (r === 1 ? a * n : (a * (1 - r ** n)) / (1 - r));

// ---------- numerical calculus ----------
/** The derivative at x, by a five-point central difference. */
export function deriv(f, x, h = 1e-3) { return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h); }
/** The integral from a to b, by Simpson's rule on n (even) strips. */
export function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Riemann sums: "left", "right", "mid" or "trap", on n strips. */
export function riemann(f, a, b, n, how = "left") {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h, x1 = x0 + h;
    s += how === "left" ? f(x0) : how === "right" ? f(x1) : how === "mid" ? f((x0 + x1) / 2) : (f(x0) + f(x1)) / 2;
  }
  return s * h;
}
/** A root of f between lo and hi by bisection (the signs must differ). */
export function bisect(f, lo, hi, n = 80) {
  let flo = f(lo);
  for (let i = 0; i < n; i++) { const m = (lo + hi) / 2, fm = f(m); if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
  return (lo + hi) / 2;
}
/** Euler's method: [[x0, y0], [x1, y1]…] for y' = f(x, y), n steps of h. */
export function euler(f, x0, y0, h, n) {
  const out = [[x0, y0]];
  let x = x0, y = y0;
  for (let i = 0; i < n; i++) { y += h * f(x, y); x += h; out.push([x, y]); }
  return out;
}

// ---------- statistics ----------
export const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
export const variance = (a, sample = false) => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - (sample ? 1 : 0)); };
export const sd = (a, sample = false) => Math.sqrt(variance(a, sample));
export const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** The normal cumulative distribution, by the Abramowitz and Stegun erf (error under 1.5e-7). */
export function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
export const normPdf = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
export const binomPmf = (n, p, k) => binom(n, k) * p ** k * (1 - p) ** (n - k);
export const poissonPmf = (m, k) => Math.exp(-m) * m ** k / fact(k);

// ---------- vectors and small matrices (arrays) ----------
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = a => Math.sqrt(dot(a, a));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const det2 = ([[a, b], [c, d]]) => a * d - b * c;
export const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
export const mmul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
export const mvec = (A, v) => A.map(r => dot(r, v));
export const inv2 = ([[a, b], [c, d]]) => { const D = a * d - b * c; return [[d / D, -b / D], [-c / D, a / D]]; };
/** Real eigenvalues of a 2×2, smaller first ([] when complex). */
export const eig2 = ([[a, b], [c, d]]) => quadRoots(1, -(a + d), a * d - b * c);

// ---------- complex numbers: [re, im] ----------
export const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
export const cabs = ([a, b]) => Math.hypot(a, b);
export const carg = ([a, b]) => Math.atan2(b, a);
export const cpow = (z, n) => { const r = cabs(z) ** n, t = carg(z) * n; return [r * Math.cos(t), r * Math.sin(t)]; };

// ---------- angles ----------
export const rad = d => (d * Math.PI) / 180;
export const deg = r => (r * 180) / Math.PI;

// ---------- Maclaurin coefficients [c0, c1, … cN] of the standard functions ----------
export function taylorCoef(name, N) {
  return Array.from({ length: N + 1 }, (_, k) => {
    switch (name) {
      case "exp": return 1 / fact(k);
      case "sin": return k % 2 ? (-1) ** ((k - 1) / 2) / fact(k) : 0;
      case "cos": return k % 2 ? 0 : (-1) ** (k / 2) / fact(k);
      case "ln1p": return k ? (-1) ** (k + 1) / k : 0;
      default: throw new Error(`taylorCoef: ${name}`);
    }
  });
}
