// Maths, chapters 2 and 3: Algebra (GCSE to IB SL) and Functions and graphs (IB SL).
import * as K from "./maths-math.js";
import { P, Q, N, G, ex, ptex, chapter, lesson } from "./maths-kit.js";

const tx = String.raw, nm = K.nm;

// ---------- brackets ----------
const E1 = K.pMul([3, 1], [-2, 1]);
const brackets = lesson("brackets", "Brackets", [
  P("Expanding multiplies every term in one bracket by every term in the other, then collects like terms. Factorising is the same thing run backwards.",
    { kind: "formula", tex: tx`(x+3)(x-2)=x^2-2x+3x-6=${ptex(E1)}`, note: "Four products, two of them like terms (the -2x and the 3x)." }),
  Q("expand", "Expand (2x − 1)(x + 4).", K.pText(K.pMul([-1, 2], [4, 1])), ["2*x^2-4", "2*x^2+9*x-4", "2*x^2+7*x+4"], "2x·x = 2x², 2x·4 = 8x, −1·x = −x, −1·4 = −4: 2x² + 7x − 4.", { t: "ident", f: "(2*x-1)*(x+4)" }),
  Q("factorise", "Factorise x² − 5x + 6.", "(x-2)*(x-3)", ["(x+2)*(x+3)", "(x-1)*(x-6)", "(x-2)*(x+3)"], "Two numbers that multiply to +6 and add to −5: −2 and −3. Check by expanding: x² − 3x − 2x + 6.", { t: "ident", f: "x^2-5*x+6" }),
  Q("diff-squares", "Factorise 9x² − 16.", "(3*x-4)*(3*x+4)", ["(3*x-4)^2", "(9*x-16)*(x+1)", "(3*x-8)*(3*x+2)"], "A difference of two squares: (3x)² − 4² = (3x − 4)(3x + 4). The middle terms cancel.", { t: "ident", f: "9*x^2-16" }),
  Q("expand-square", "Expand (x + 5)².", "x^2+10*x+25", ["x^2+25", "x^2+5*x+25", "x^2+10*x+5"], "(x + 5)(x + 5) = x² + 5x + 5x + 25. The cross term 10x is the part everyone forgets: (a + b)² is not a² + b².", { t: "ident", f: "(x+5)^2" }),
]);

// ---------- linear equations ----------
const LIN = { a: 6, b: -3, c: 5, d: 4 };
const linear = lesson("linear", "Equations", [
  P("Solve an equation by doing the same thing to both sides until x stands alone. Brackets first, then gather the x terms on one side.",
    { kind: "rows", rows: [["$3(2x-1)=5x+4$", ""], ["expand", `$${LIN.a}x${LIN.b}=${LIN.c}x+${LIN.d}$`], ["gather x", `$${LIN.a - LIN.c}x=${LIN.d - LIN.b}$`], ["so", `$x=${(LIN.d - LIN.b) / (LIN.a - LIN.c)}$`]] }),
  N("lin-solve", "Solve 4(x − 3) = 2x + 10.", ex((10 + 12) / 2), "4x − 12 = 2x + 10, so 2x = 22 and x = 11.", { t: "js", f: "(()=>{for(let x=-100;x<=100;x+=0.5)if(4*(x-3)===2*x+10)return x})()" }),
  N("lin-formula", "Temperature in °C is C = 5/9 × (F − 32). What is C when F = 212?", ex(5 / 9 * (212 - 32)), "5/9 × 180 = 100: the boiling point of water.", { t: "js", f: "5/9*(212-32)" }),
  Q("lin-neg", "At what temperature do the Celsius and Fahrenheit scales agree?", "-40", ["0", "32", "-32"], "Set C = F: F = 5/9(F − 32), so 9F = 5F − 160, 4F = −160 and F = −40.", { t: "js", f: "(()=>{for(let f=-100;f<=100;f++)if(Math.abs(5/9*(f-32)-f)<1e-9)return f})()" }),
]);

// ---------- simultaneous equations ----------
const simultaneous = lesson("simultaneous", "Simultaneous", [
  P("Two equations with two unknowns hold together at one point, where their lines cross. Eliminate one unknown: make its multiples match, then add or subtract.",
    { kind: "rows", rows: [["$2x+3y=12$", ""], ["$x-y=1$", "times 3: $3x-3y=3$"], ["add", "$5x=15$, so $x=3$"], ["then", "$y=x-1=2$"]] }),
  N("sim-x", "Solve 3x + 2y = 16 and x − 2y = 0. What is x?", "4", "Add the equations: 4x = 16, so x = 4, and then y = x/2 = 2.", { t: "js", f: "(()=>{for(let x=-20;x<=20;x+=0.5)for(let y=-20;y<=20;y+=0.5)if(3*x+2*y===16&&x-2*y===0)return x})()" }),
  G("sim-meet", "The first line is y = (12 − 2x)/3. Set c so that the second, y = x + c, meets it exactly at the marked point (3, 2).",
    { kind: "plot", win: [-2, 7, -2, 6], fns: [{ e: "(12-2*x)/3" }, { e: "x+c" }], pts: [{ p: [3, 2], k: "b", label: "(3, 2)" }], params: { c: { min: -4, max: 4, step: 0.5, v: 1, label: "c" } }, goal: { p: { c: -1 }, tol: 0.1 }, alt: "two lines" },
    "c = −1: the line y = x − 1 passes through (3, 2), as does the first.", { t: "goal", eqs: [["(12-2*3)/3", 2], ["3+c", 2]] }),
  Q("sim-count", "How many solutions do 2x + 4y = 8 and x + 2y = 4 have?", "~Infinitely many", ["~Exactly one", "~None", "~Exactly two"], "The first equation is twice the second, so they are the same line and every point on it solves both. Parallel lines (same slope, different intercept) would give none.", { t: "words" }),
]);

// ---------- quadratics ----------
const quadratics = lesson("quadratics", "Quadratics", [
  P("A quadratic ax² + bx + c = 0 has the solutions below. The number under the root, the discriminant b² − 4ac, tells you how many: positive, two; zero, one; negative, none (the parabola misses the axis).",
    { kind: "formula", tex: tx`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, note: "Complete the square, or factorise when you can see how." }),
  Q("quad-roots", "Solve 2x² − 3x − 2 = 0.", ["2", "-1/2"], [["-2", "1/2"], ["2", "1/2"], ["1", "-2/3"]], "(2x + 1)(x − 2) = 0, so x = −½ or x = 2. Using the formula: (3 ± √25)/4.", { t: "roots", f: "2*x^2-3*x-2", n: 2 }),
  N("quad-disc", "What is the discriminant of 3x² − 2x − 5?", ex(K.disc(3, -2, -5)), "b² − 4ac = (−2)² − 4·3·(−5) = 4 + 60 = 64. A perfect square, so the roots are rational: x = 5/3 and −1.", { t: "js", f: "(-2)*(-2)-4*3*(-5)" }),
  G("quad-touch", "Make the parabola y = x² + bx + 4 touch the x-axis in exactly one point (discriminant zero).",
    { kind: "plot", win: [-6, 6, -2, 12], fns: [{ e: "x^2+b*x+4" }], params: { b: { min: -8, max: 8, step: 0.5, v: 1, label: "b" } }, read: [["b² − 16", "b^2-16", 1]], goal: { e: "b^2-16", v: 0, tol: 0.01, miss: "The curve should touch the axis once without crossing." }, alt: "parabola" },
    "b = 4 or b = −4: b² − 4·1·4 = 0. Then x² ± 4x + 4 = (x ± 2)², a perfect square.", { t: "goal-e" }),
  Q("quad-square", "Write x² + 6x + 11 in the form (x + p)² + q.", "(x+3)^2+2", ["(x+3)^2+11", "(x+6)^2-25", "(x+3)^2-2"], "Half of 6 is 3: (x + 3)² = x² + 6x + 9, and 11 − 9 = 2 is left over. The lowest point is (−3, 2).", { t: "ident", f: "x^2+6*x+11" }),
  N("quad-ball", "A ball's height in metres is h = −5t² + 20t + 1 at t seconds. What is its greatest height?", ex(-5 * 4 + 40 + 1), "The top of the parabola is at t = −b/2a = 2, where h = −20 + 40 + 1 = 21.", { t: "js", f: "Math.max(...Array.from({length:4001},(_,i)=>-5*(i/1000)**2+20*i/1000+1))" }, { tol: 0.001 }),
  N("quad-ineq", "How many whole numbers x satisfy x² − x − 6 < 0?", String([...Array(41).keys()].map(i => i - 20).filter(x => x * x - x - 6 < 0).length), "x² − x − 6 = (x − 3)(x + 2) is negative between its roots −2 and 3, so x is −1, 0, 1 or 2.", { t: "js", f: "Array.from({length:41},(_,i)=>i-20).filter(x=>x*x-x-6<0).length" }),
]);

// ---------- sequences ----------
const sequences = lesson("sequences", "Sequences", [
  P("An arithmetic sequence adds the same difference d each time: the n-th term is a + (n − 1)d, and the first n terms add up to n/2 × (2a + (n − 1)d). A geometric sequence multiplies by the same ratio r each time.",
    { kind: "formula", tex: [tx`u_n=a+(n-1)d`, tx`S_n=\frac n2\,(2a+(n-1)d)`, tx`u_n=ar^{n-1}`, tx`S_n=\frac{a(1-r^n)}{1-r}`], note: "If |r| < 1 the geometric terms shrink, and the sum to infinity is a ÷ (1 − r)." }),
  N("seq-term", "The sequence 7, 11, 15, … is arithmetic. What is its 20th term?", ex(K.arithTerm(7, 4, 20)), "a = 7, d = 4: 7 + 19 × 4 = 83.", { t: "js", f: "(()=>{let u=7;for(let i=1;i<20;i++)u+=4;return u})()" }),
  N("seq-sum", "What is the sum of the first 20 terms of 7, 11, 15, …?", ex(K.arithSum(7, 4, 20)), "20/2 × (2·7 + 19·4) = 10 × 90 = 900. Pairing first and last (7 + 83 = 90) ten times says the same.", { t: "js", f: "(()=>{let u=7,s=0;for(let i=1;i<=20;i++){s+=u;u+=4}return s})()" }),
  N("seq-geo", "What is the sum of the first 10 terms of 3, 6, 12, …?", ex(K.geoSum(3, 2, 10)), "a = 3, r = 2: 3 × (2¹⁰ − 1)/(2 − 1) = 3 × 1023 = 3069.", { t: "js", f: "(()=>{let u=3,s=0;for(let i=0;i<10;i++){s+=u;u*=2}return s})()" }),
  Q("seq-inf", "What does 12 + 4 + 4/3 + … add up to, term after term for ever?", "18", ["16", "24", "12"], "The ratio is 1/3, so the sum is 12 ÷ (1 − 1/3) = 18. Each term is a third of the last, so the total settles.", { t: "js", f: "(()=>{let s=0,t=12;for(let i=0;i<200;i++){s+=t;t/=3}return s})()" }),
]);

export const ALGEBRA = chapter("algebra", "Algebra", [brackets, linear, simultaneous, quadratics, sequences]);

// ---------- lines ----------
const lines = lesson("lines", "Straight lines", [
  G("line-fit", "A line y = mx + c has gradient m (rise over run) and meets the y-axis at c. Two points fix a line. Set m and c so the line goes through both marked points.",
    { kind: "plot", win: [-2, 6, -3, 9], fns: [{ e: "m*x+c" }], pts: [{ p: [1, 1], k: "b", label: "(1, 1)" }, { p: [3, 5], k: "b", label: "(3, 5)" }], params: { m: { min: -3, max: 4, step: 0.5, v: 1, label: "m" }, c: { min: -4, max: 4, step: 0.5, v: 0, label: "c" } }, read: [["gradient", "m", 1], ["crosses y at", "c", 1]], goal: { p: { m: 2, c: -1 }, tol: 0.01 }, alt: "line through two points" },
    "m = 2 (up 4 over 2 across) and c = −1: y = 2x − 1 gives 1 at x = 1 and 5 at x = 3.", { t: "goal", eqs: [["m*1+c", 1], ["m*3+c", 5]] }),
  N("line-grad", "What is the gradient of the line through (1, 4) and (5, 12)?", ex((12 - 4) / (5 - 1)), "Rise over run: (12 − 4) ÷ (5 − 1) = 2.", { t: "js", f: "(12-4)/(5-1)" }),
  Q("line-perp", "A line has gradient 2/3. What is the gradient of a line perpendicular to it?", "-3/2", ["3/2", "-2/3", "2/3"], "Perpendicular gradients multiply to −1: the negative reciprocal. (2/3) × (−3/2) = −1.", { t: "pred", p: "v=>Math.abs(v*(2/3)+1)<1e-9" }),
  N("line-dist", "How far apart are the points (1, 2) and (7, 10)?", ex(Math.hypot(6, 8)), "Pythagoras on the steps 6 across and 8 up: √(36 + 64) = 10.", { t: "js", f: "Math.sqrt((7-1)**2+(10-2)**2)" }),
  Q("line-mid", "What is the midpoint's x-coordinate of (1, 2) and (7, 10)?", "4", ["3", "6", "8"], "Average the x values: (1 + 7)/2 = 4, and likewise (2 + 10)/2 = 6 for y.", { t: "js", f: "(1+7)/2" }),
]);

// ---------- function notation ----------
const functions = lesson("functions", "Functions", [
  P("A function f turns each input x into one output f(x). The domain is the inputs allowed, the range the outputs that come out. A composite f(g(x)) does g first; an inverse f⁻¹ undoes f.",
    { kind: "formula", tex: tx`f(x)=2x^2-3\qquad f(-2)=2(-2)^2-3=${2 * 4 - 3}`, note: "Squaring forgets the sign, so f(2) = f(-2): that is why f has no inverse on all the reals." }),
  N("fn-eval", "If f(x) = 2x² − 3, what is f(−2)?", ex(2 * 4 - 3), "Substitute: 2 × 4 − 3 = 5. The square comes before the multiplying.", { t: "js", f: "(x=>2*x*x-3)(-2)" }),
  Q("fn-comp", "If f(x) = x + 1 and g(x) = x², what is f(g(x))?", "x^2+1", ["(x+1)^2", "x^2+x", "x+1"], "g goes first and f takes its output: f(g(x)) = x² + 1. The other order, g(f(x)) = (x + 1)², is different.", { t: "ident", f: "x^2+1" }),
  Q("fn-inv", "If f(x) = (x + 1)/2, what is f⁻¹(x)?", "2*x-1", ["(x-1)/2", "2/(x+1)", "2*x+1"], "Undo f step by step: f adds 1 then halves, so f⁻¹ doubles then takes 1 off. Check: f(2x − 1) = 2x/2 = x.", { t: "inverse", f: "(x+1)/2" }),
  Q("fn-domain", "Which input must be left out of the domain of f(x) = 1/(x − 5)?", "5", ["0", "-5", "1/5"], "Division by zero is undefined, and x − 5 = 0 at x = 5. The function is fine at 0 (giving −1/5) and at −5.", { t: "pred", p: "v=>!Number.isFinite(1/(v-5))" }),
]);

// ---------- transformations ----------
const transform = lesson("transform", "Moving graphs", [
  P("Take the graph of y = x². Then y = (x − h)² + k is the same curve moved h to the right and k up: the vertex moves from (0, 0) to (h, k). Slide it.",
    { kind: "plot", win: [-6, 6, -4, 10], fns: [{ e: "x^2", k: "c", dash: true }, { e: "(x-h)^2+k" }], params: { h: { min: -4, max: 4, step: 1, v: 0, label: "h" }, k: { min: -3, max: 5, step: 1, v: 0, label: "k" } }, read: [["vertex at x", "h", 0], ["y", "k", 0]], alt: "parabola moved" }),
  G("tr-vertex", "Move the parabola so its vertex is at (3, −2).",
    { kind: "plot", win: [-3, 8, -4, 10], fns: [{ e: "x^2", k: "c", dash: true }, { e: "(x-h)^2+k" }], pts: [{ p: [3, -2], k: "b", label: "(3, −2)" }], params: { h: { min: -4, max: 6, step: 1, v: 0, label: "h" }, k: { min: -4, max: 4, step: 1, v: 0, label: "k" } }, goal: { p: { h: 3, k: -2 }, tol: 0.01 }, alt: "parabola moved" },
    "h = 3, k = −2: y = (x − 3)² − 2. Minus inside the bracket moves the curve to the right, which feels backwards the first time.", { t: "goal", eqs: [["(3-h)^2+k", -2]] }),
  Q("tr-reflect", "The graph of y = f(x) is reflected in the x-axis. What is the new equation?", "~y = −f(x)", ["~y = f(−x)", "~y = f(x) − 1", "~y = 1/f(x)"], "Each height flips sign: y = −f(x). Reflecting in the y-axis instead replaces x by −x: y = f(−x).", { t: "words" }),
  Q("tr-stretch", "The graph of y = f(x) is stretched away from the x-axis by a factor 3. What is the new equation?", "~y = 3f(x)", ["~y = f(3x)", "~y = f(x/3)", "~y = f(x) + 3"], "Every height triples: y = 3f(x). Replacing x by 3x would squeeze the graph towards the y-axis instead.", { t: "words" }),
]);

// ---------- exponentials and logarithms ----------
const logs = lesson("logs", "Exponents, logs", [
  P("A logarithm is the power you need: log₂ 8 = 3 because 2³ = 8. It undoes the exponential, so it turns multiplying into adding and powers into multiples.",
    { kind: "formula", tex: [tx`\log_a(xy)=\log_a x+\log_a y`, tx`\log_a(x^k)=k\log_a x`, tx`a^x=b\iff x=\frac{\ln b}{\ln a}`] }),
  Q("log-eval", "What is log₂ 32 + log₂ 2?", "6", ["5", "7", "34"], "log₂ 32 = 5 and log₂ 2 = 1, and together 6 = log₂ 64: adding logs multiplies the numbers.", { t: "js", f: "Math.log2(32)+Math.log2(2)" }),
  N("log-solve", "Solve 2ˣ = 50 for x, to 3 significant figures.", ex(Number(Math.log2(50).toPrecision(3))), "x = ln 50 ÷ ln 2 = 5.64. Check: 2⁵ = 32 and 2⁶ = 64 bracket 50.", { t: "js", f: "Math.log(50)/Math.log(2)" }, { tol: 0.005 }),
  N("log-half", "A radioactive sample halves every 8 days. After how many days is 1/10 of it left? To 3 significant figures.", ex(Number((8 * Math.log2(10)).toPrecision(3))), "(1/2)^(t/8) = 1/10 gives t = 8 log₂ 10 = 8 × 3.32 = 26.6 days.", { t: "js", f: "8*Math.log(10)/Math.log(2)" }, { tol: 0.05 }),
  G("log-curve", "The curve y = aˣ and the line y = x: when a is large the curve stays above the line, and for a small a they cross twice. Set a so that the curve just touches the line y = x (a = e^(1/e) ≈ 1.445).",
    { kind: "plot", win: [-1, 5, -1, 5], fns: [{ e: "x", k: "c", dash: true }, { e: "a^x" }], params: { a: { min: 1.1, max: 2, step: 0.005, v: 1.2, label: "a" } }, goal: { p: { a: 1.445 }, tol: 0.02 }, alt: "exponential touching a line" },
    "For a = e^(1/e) ≈ 1.4447 the curve and the line touch at x = e. Any larger a lifts the curve clear of the line.", { t: "goal", eqs: [["a^e", 2.718281828459045, 0.02]] }),
]);

// ---------- polynomials ----------
const poly = lesson("polynomials", "Polynomials", [
  P("A polynomial's roots are where it crosses the axis. The factor theorem says x = r is a root exactly when (x − r) divides it; the remainder theorem says dividing by (x − r) leaves f(r).",
    { kind: "plot", win: [-1, 5, -4, 6], fns: [{ e: "x^3-6*x^2+11*x-6" }], pts: [{ p: [1, 0], k: "b" }, { p: [2, 0], k: "b" }, { p: [3, 0], k: "b" }], alt: "cubic with three roots" }),
  Q("poly-roots", "Find all the roots of x³ − 6x² + 11x − 6.", ["1", "2", "3"], [["1", "2", "-3"], ["-1", "-2", "-3"], ["1", "6"]], "f(1) = 1 − 6 + 11 − 6 = 0, so (x − 1) is a factor; dividing leaves x² − 5x + 6 = (x − 2)(x − 3).", { t: "roots", f: "x^3-6*x^2+11*x-6", n: 3 }),
  N("poly-rem", "What is the remainder when x³ + 2x − 5 is divided by (x − 2)?", ex(8 + 4 - 5), "Remainder theorem: f(2) = 8 + 4 − 5 = 7. No division needed.", { t: "js", f: "(x=>x**3+2*x-5)(2)" }),
  N("poly-k", "(x − 1) is a factor of x³ + kx − 4. Find k.", ex(3), "f(1) = 1 + k − 4 = 0, so k = 3.", { t: "js", f: "(()=>{for(let k=-10;k<=10;k++)if(1+k-4===0)return k})()" }),
]);

// ---------- rational functions ----------
const rational = lesson("rational", "Asymptotes", [
  P("A rational function is one polynomial over another. Where the bottom is zero the graph shoots off to infinity: a vertical asymptote. Far away it settles towards a horizontal one. Move y = 1/(x − h) + k.",
    { kind: "plot", win: [-6, 8, -6, 8], fns: [{ e: "1/(x-h)+k" }], lines: [{ a: ["h", -50], b: ["h", 50], k: "d" }, { a: [-50, "k"], b: [50, "k"], k: "d" }], params: { h: { min: -3, max: 5, step: 1, v: 2, label: "h" }, k: { min: -3, max: 4, step: 1, v: 1, label: "k" } }, read: [["vertical asymptote x =", "h", 0], ["horizontal y =", "k", 0]], alt: "hyperbola" }),
  G("rat-set", "Set h and k so that the asymptotes are x = 4 and y = −2.",
    { kind: "plot", win: [-3, 9, -6, 4], fns: [{ e: "1/(x-h)+k" }], lines: [{ a: [4, -50], b: [4, 50], k: "b" }, { a: [-50, -2], b: [50, -2], k: "b" }], params: { h: { min: -3, max: 6, step: 1, v: 0, label: "h" }, k: { min: -4, max: 3, step: 1, v: 0, label: "k" } }, goal: { p: { h: 4, k: -2 }, tol: 0.01 }, alt: "hyperbola" },
    "h = 4 puts the zero of the denominator at x = 4; k = −2 is where the curve heads for as x grows.", { t: "goal", eqs: [["h", 4], ["k", -2]] }),
  Q("rat-limit", "What does (3x² + 1)/(x² − 4) approach as x grows without bound?", "3", ["0", "1", "~no limit"], "Divide top and bottom by x²: (3 + 1/x²)/(1 − 4/x²) → 3/1. The top and bottom have the same degree, so the limit is the ratio of the leading coefficients.", { t: "js", f: "(x=>(3*x*x+1)/(x*x-4))(1e8)", tol: 1e-6 }),
  Q("rat-vert", "Where are the vertical asymptotes of 1/(x² − 9)?", ["3", "-3"], [["3"], ["9", "-9"], ["0"]], "The bottom is (x − 3)(x + 3), zero at x = 3 and x = −3: two asymptotes.", { t: "roots", f: "x^2-9", n: 2 }),
]);

export const FUNCTIONS = chapter("functions", "Functions and graphs", [lines, functions, transform, logs, poly, rational]);
