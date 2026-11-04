// Maths, chapters 9 and 10: Series and analysis (IB HL to first-year university) and Vectors and linear algebra.
import * as K from "./maths-math.js";
import { P, Q, N, G, ex, chapter, lesson } from "./maths-kit.js";

const tx = String.raw;

// ---------- limits of sequences ----------
const seqLimit = lesson("seqlimit", "Limits of sequences", [
  P("A sequence has a limit L if its terms get and stay as close to L as you like. Here aₙ = (3n + 1)/(n + 2): the terms climb towards 3 without reaching it.",
    { kind: "plot", win: [0, 30, 0, 3.5], fns: [{ e: "(3*x+1)/(x+2)" }, { e: "3", k: "b", dash: true }], alt: "a sequence approaching its limit" }),
  Q("sl-limit", "What is the limit of (3n + 1)/(n + 2) as n grows without bound?", "3", ["1", "1/2", "~There is no limit"], "Divide top and bottom by n: (3 + 1/n)/(1 + 2/n) → 3/1 = 3, since 1/n and 2/n go to 0.", { t: "lim", f: "(3*x+1)/(x+2)", to: "Infinity" }),
  N("sl-n", "How many terms must you go along before every later term of (3n + 1)/(n + 2) is within 0.03 of 3? Give the smallest such n.", "165", "3 − aₙ = 5/(n + 2), and 5/(n + 2) < 0.03 needs n + 2 > 166.7, so n + 2 = 167 and n = 165.", { t: "js", f: "(()=>{for(let n=1;;n++)if(Math.abs((3*n+1)/(n+2)-3)<0.03)return n})()" }),
]);

// ---------- series ----------
const series = lesson("series", "Series", [
  P("A series is the running total of a sequence. It converges if the totals settle on a number, and diverges if not. Terms going to zero is necessary but not enough: 1 + 1/2 + 1/3 + … creeps up without end.",
    { kind: "formula", tex: [tx`\sum_{n=1}^{\infty}\frac1{n^2}=\frac{\pi^2}{6}`, tx`\sum_{n=1}^{\infty}\frac1n=\infty`], note: "The first converges; the second diverges, though its terms also go to zero." }),
  Q("se-basel", "To what number does 1 + 1/4 + 1/9 + 1/16 + … (the sum of 1/n²) converge?", "pi^2/6", ["2", "pi/2", "3/2"], "Euler's answer: π²/6 ≈ 1.6449. The partial sums rise quickly and then crawl: a million terms still leave a gap of about a millionth.", { t: "js", f: "(()=>{let s=0;for(let n=1;n<=2000000;n++)s+=1/(n*n);return s})()", tol: 1e-5 }),
  N("se-harm", "What is the sum of the first 1000 terms of 1 + 1/2 + 1/3 + … ? To 4 decimal places.", ex(Number([...Array(1000).keys()].reduce((s, i) => s + 1 / (i + 1), 0).toFixed(4))), "The partial sum is 7.4855: about ln 1000 + 0.5772. It grows like ln n, so it passes any number eventually, but very slowly (it takes about 12 000 terms to pass 10).", { t: "js", f: "(()=>{let s=0;for(let n=1;n<=1000;n++)s+=1/n;return s})()" }, { tol: 0.0001 }),
  Q("se-ratio", "The ratio test looks at the limit of aₙ₊₁/aₙ; below 1 means convergence. For the terms aₙ = n/2ⁿ, what is that limit?", "1/2", ["2", "1", "0"], "aₙ₊₁/aₙ = ((n + 1)/n) × (1/2) → 1/2. Below 1, so Σ n/2ⁿ converges (to 2, as it happens).", { t: "js", f: "((1e4+1)/1e4)/2", tol: 1e-3 }),
]);

// ---------- Taylor series ----------
const taylor = lesson("taylor", "Taylor series", [
  P("Near x = 0 a smooth function looks like a polynomial whose coefficients are its derivatives there, divided by factorials: f(x) ≈ f(0) + f′(0)x + f″(0)x²/2! + … Add terms to eˣ and watch the polynomial hug the curve.",
    { kind: "taylor", f: "exp(x)", c: K.taylorCoef("exp", 8), at: 1, win: [-3, 3, -1, 9], deg: { max: 8, v: 1 }, tex: tx`e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots` }),
  G("ty-deg", "How many terms are needed before the polynomial gives e¹ within 0.001? Set the degree.",
    { kind: "taylor", f: "exp(x)", c: K.taylorCoef("exp", 8), at: 1, win: [-3, 3, -1, 9], deg: { max: 8, v: 1 }, goal: { err: 0.001 } },
    "Degree 6 gives 2.71806, which is 0.0002 short; degree 5 is 0.0016 short. Each term is a factor of about 1/n smaller than the last, so the error falls fast.", { t: "taylor" }),
  N("ty-sin", "The Maclaurin series of sin x is x − x³/6 + x⁵/120 − … What is the coefficient of x³? Type it as a fraction.", "-1/6", "The third derivative of sin x is −cos x, which is −1 at 0, and −1/3! = −1/6.", { t: "js", f: "(()=>{const f=Math.sin,h=0.01;return ((f(2*h)-2*f(h)+2*f(-h)-f(-2*h))/(2*h**3))/6})()" }, { tol: 0.001 }),
  N("ty-est", "Estimate e^0.2 using the first three terms, 1 + x + x²/2. To 2 decimal places.", ex(Number((1 + 0.2 + 0.02).toFixed(2))), "1 + 0.2 + 0.02 = 1.22. The true value is 1.2214, so three terms already agree to 2 decimals.", { t: "js", f: "Math.exp(0.2)" }, { tol: 0.002 }),
], "HL");

// ---------- l'Hôpital ----------
const hopital = lesson("hopital", "L'Hôpital", [
  P("When a limit of f/g gives 0/0 or ∞/∞, differentiate the top and the bottom separately and try again: lim f/g = lim f′/g′ (if that exists). It is a shortcut for what the Taylor series show.",
    { kind: "formula", tex: [tx`\lim_{x\to0}\frac{\sin x}{x}=\lim_{x\to0}\frac{\cos x}{1}=1`, tx`\lim_{x\to0}\frac{e^x-1-x}{x^2}=\lim\frac{e^x-1}{2x}=\lim\frac{e^x}{2}=\frac12`] }),
  Q("lh-sin", "What is the limit of (sin 3x)/x as x → 0?", "3", ["0", "1", "1/3"], "Top and bottom derivatives: 3 cos 3x over 1, which is 3 at 0. Or: sin 3x ≈ 3x near 0.", { t: "lim", f: "sin(3*x)/x", to: 0 }),
  N("lh-cos", "What is the limit of (1 − cos x)/x² as x → 0? Type it as a decimal.", "0.5", "(sin x)/(2x) → ½ after one use of the rule; or cos x ≈ 1 − x²/2 near 0.", { t: "js", f: "(x=>(1-Math.cos(x))/(x*x))(1e-3)" }, { tol: 0.001 }),
  Q("lh-exp", "What is the limit of x e⁻ˣ as x → ∞?", "0", ["1", "~∞", "-1"], "Write it as x/eˣ (∞/∞) and differentiate: 1/eˣ → 0. The exponential beats every power.", { t: "lim", f: "x*exp(-x)", to: "Infinity" }),
], "HL");

// ---------- epsilon and delta ----------
const epsdelta = lesson("epsdelta", "Epsilon and delta", [
  P("The exact definition of lim f(x) = L as x → a: whatever tolerance ε you demand around L, there is a window δ around a such that every x in the window (other than a) lands inside the tolerance. Here f(x) = x², a = 2, L = 4. The brass band is the tolerance ε; the grey one is your window δ.",
    { kind: "epsdelta", f: "x^2", a: 2, L: 4, eps: 0.5, win: [0, 4, 0, 9], dmax: 1, delta0: 0.5 }),
  G("ed-find", "Find a δ that works for ε = 0.5: the whole stretch of curve inside your window must stay inside the band. Choose the widest you can.",
    { kind: "epsdelta", f: "x^2", a: 2, L: 4, eps: 0.5, win: [0, 4, 0, 9], dmax: 1, delta0: 0.6, goal: { frac: 0.5 } },
    "The curve leaves the band at x² = 3.5 and x² = 4.5, so δ can be up to √4.5 − 2 = 0.121. Any smaller δ works too. A smaller ε forces a smaller δ: that dependence is the whole definition.", { t: "epsdelta" }),
  N("ed-lin", "For f(x) = 3x + 1 near a = 2 (the limit is 7) and ε = 0.3, what is the largest δ that works? To 2 decimal places.", "0.1", "|3x + 1 − 7| = 3|x − 2| < 0.3 exactly when |x − 2| < 0.1. For a straight line, δ = ε ÷ |slope|.", { t: "js", f: "(()=>{let best=0;for(let d=0.001;d<1;d+=0.001){let ok=true;for(let i=0;i<=400;i++){const x=2-d+2*d*i/400;if(Math.abs(x-2)<1e-12)continue;if(!(Math.abs(3*x+1-7)<0.3)){ok=false;break}}if(ok)best=d}return best})()" }, { tol: 0.002 }),
  N("ed-ivt", "The function x³ + x − 1 is −1 at x = 0 and +1 at x = 1, so the intermediate value theorem puts a root between them. Find it by halving the interval, to 3 decimal places.", ex(Number(K.bisect(x => x ** 3 + x - 1, 0, 1).toFixed(3))), "Halve repeatedly: f(0.5) < 0, f(0.75) > 0, f(0.625) < 0, … the root is 0.682. A continuous function cannot jump over 0.", { t: "js", f: "(()=>{let a=0,b=1;for(let i=0;i<60;i++){const m=(a+b)/2;if(m**3+m-1<0)a=m;else b=m}return a})()" }, { tol: 0.0006 }),
], "Uni");

export const SERIES = chapter("series", "Series and analysis", [seqLimit, series, taylor, hopital, epsdelta]);

// ---------- vectors ----------
const vectors = lesson("vectors", "Vectors", [
  P("A vector has a size and a direction, written by its components. Adding vectors puts them tip to tail; the sum goes from the start to the end. Its length (magnitude) is the square root of the sum of the squares of the components.",
    { kind: "plot", eq: true, win: [-1, 8, -4, 6], arrows: [{ to: [2, 3], k: "a", label: "a" }, { from: [2, 3], to: [`2+b1`, `3+b2`], k: "b", label: "b" }, { to: ["2+b1", "3+b2"], k: "ok", label: "a + b" }], params: { b1: { min: -3, max: 5, step: 1, v: 2, label: "b₁" }, b2: { min: -5, max: 3, step: 1, v: -1, label: "b₂" } }, read: [["|a + b|", "sqrt((2+b1)^2+(3+b2)^2)", 3]], alt: "vector addition" }),
  G("vc-sum", "The vector a = (2, 3) is fixed. Choose b so that a + b = (5, 1).",
    { kind: "plot", eq: true, win: [-1, 8, -4, 6], arrows: [{ to: [2, 3], k: "a", label: "a" }, { from: [2, 3], to: ["2+b1", "3+b2"], k: "b", label: "b" }], pts: [{ p: [5, 1], k: "ok", label: "(5, 1)" }], params: { b1: { min: -3, max: 5, step: 1, v: 0, label: "b₁" }, b2: { min: -5, max: 3, step: 1, v: 0, label: "b₂" } }, goal: { p: { b1: 3, b2: -2 }, tol: 0.01 }, alt: "vector addition" },
    "b = (5, 1) − (2, 3) = (3, −2): subtract component by component.", { t: "goal", eqs: [["2+b1", 5], ["3+b2", 1]] }),
  N("vc-mag", "What is the length of the vector (3, 4, 12)?", ex(K.norm([3, 4, 12])), "√(9 + 16 + 144) = √169 = 13: Pythagoras twice, once across the floor and once up.", { t: "js", f: "Math.sqrt(3*3+4*4+12*12)" }),
  Q("vc-comb", "If a = (1, 2, 3) and b = (4, 0, −1), what is 2a − b?", { v: [-2, 4, 7] }, [{ v: [6, 4, 5] }, { v: [-2, 4, 5] }, { v: [-3, 2, 4] }], "Component by component: (2 − 4, 4 − 0, 6 + 1) = (−2, 4, 7). Subtracting b is adding −b, which flips every sign of b.", { t: "vec", f: "[2*1-4,2*2-0,2*3-(-1)]" }),
]);

// ---------- the dot product ----------
const dotL = lesson("dot", "Dot product", [
  P("The dot product multiplies matching components and adds: a·b = a₁b₁ + a₂b₂ + a₃b₃. It also equals |a||b| cos θ, so it measures how much two vectors point the same way. Zero means perpendicular.",
    { kind: "formula", tex: [tx`\mathbf a\cdot\mathbf b=a_1b_1+a_2b_2+a_3b_3`, tx`\mathbf a\cdot\mathbf b=|\mathbf a||\mathbf b|\cos\theta`] }),
  N("dt-val", "What is (1, 2, 3)·(4, −5, 6)?", ex(K.dot([1, 2, 3], [4, -5, 6])), "4 − 10 + 18 = 12. Positive, so the vectors point broadly the same way (an angle under 90°).", { t: "js", f: "1*4+2*(-5)+3*6" }),
  G("dt-perp", "The vector a = (2, 1) is fixed. Slide the first component t of b = (t, 4) until b is perpendicular to a.",
    { kind: "plot", eq: true, win: [-5, 5, -2, 6], arrows: [{ to: [2, 1], k: "a", label: "a" }, { to: ["t", 4], k: "b", label: "b" }], params: { t: { min: -4, max: 4, step: 0.5, v: 1, label: "t" } }, read: [["a·b", "2*t+4", 2]], goal: { e: "2*t+4", v: 0, tol: 0.01 }, alt: "two vectors" },
    "a·b = 2t + 4 = 0 gives t = −2. The two arrows then meet at a right angle.", { t: "goal-e" }),
  N("dt-angle", "What is the angle between (1, 0, 1) and (0, 1, 1), in degrees?", ex(60), "The dot product is 1 and each length is √2, so cos θ = 1/2 and θ = 60°.", { t: "js", f: "Math.acos((1*0+0*1+1*1)/(Math.sqrt(2)*Math.sqrt(2)))*180/Math.PI" }, { tol: 1e-6 }),
]);

// ---------- cross product and planes ----------
const crossL = lesson("cross", "Cross product", [
  P("In three dimensions, the cross product a × b is a vector at right angles to both, with length |a||b| sin θ: the area of the parallelogram they span. Its direction is the normal to the plane they lie in.",
    { kind: "formula", tex: [tx`\mathbf a\times\mathbf b=\begin{pmatrix}a_2b_3-a_3b_2\\a_3b_1-a_1b_3\\a_1b_2-a_2b_1\end{pmatrix}`] }),
  Q("cr-axes", "What is (1, 0, 0) × (0, 1, 0)?", { v: [0, 0, 1] }, [{ v: [0, 0, -1] }, { v: [1, 1, 0] }, { v: [0, 0, 0] }], "x × y = z: the right-hand rule. Swapping the order flips the sign: y × x = −z.", { t: "vec", f: "[0*0-0*1,0*0-1*0,1*1-0*0]" }),
  N("cr-area", "What is the area of the triangle with corners (0, 0, 0), (2, 0, 0) and (0, 3, 4)?", ex(K.norm(K.cross([2, 0, 0], [0, 3, 4])) / 2), "Half the length of the cross product: (2, 0, 0) × (0, 3, 4) = (0, −8, 6), of length 10, so the area is 5. (Base 2 and slant height 5 gives the same.)", { t: "js", f: "0.5*Math.hypot(0*4-0*3,0*0-2*4,2*3-0*0)" }),
  N("cr-dist", "The plane x + 2y + 2z = 0 passes through the origin and has normal (1, 2, 2). How far is the point (3, 0, 0) from it?", ex(3 / K.norm([1, 2, 2])), "The distance is |n·p| ÷ |n| = 3 ÷ 3 = 1: the length of the point's shadow along the normal.", { t: "js", f: "(()=>{const n=[1,2,2],p=[3,0,0],t=(n[0]*p[0]+n[1]*p[1]+n[2]*p[2])/9;return Math.hypot(t*n[0],t*n[1],t*n[2])})()" }),
]);

// ---------- systems of equations ----------
const systems = lesson("systems", "Linear systems", [
  P("Three equations in three unknowns are solved the same way as two: eliminate one unknown to get two equations, then one. That is Gaussian elimination: row operations that do not change the solution, until it can be read off.",
    { kind: "rows", rows: [["$x+y+z=6$", "(1)"], ["$2x-y+z=3$", "(2)"], ["$x+2y-z=2$", "(3)"], ["(1) + (3)", "$2x+3y=8$"], ["(2) − (1)", "$x-2y=-3$"], ["so", "$x=1,\ y=2,\ z=3$"]] }),
  N("sy-z", "Solve x + y + z = 6, 2x − y + z = 3 and x + 2y − z = 2. What is z?", "3", "Add the first and third: 2x + 3y = 8. Subtract the first from the second: x − 2y = −3. Then x = 1, y = 2, and z = 6 − 3 = 3.", { t: "js", f: "(()=>{for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++)for(let z=-10;z<=10;z++)if(x+y+z===6&&2*x-y+z===3&&x+2*y-z===2)return z})()" }),
  Q("sy-none", "The equations x + y = 2 and 2x + 2y = 5 are: ", "~Inconsistent: no solution", ["~Consistent with one solution", "~Consistent with infinitely many solutions", "~Both true when x = y = 1"], "Doubling the first gives 2x + 2y = 4, which contradicts 5. The lines are parallel and never meet. (If the right side were 4, they would be the same line.)", { t: "words" }),
]);

// ---------- matrices as maps ----------
const matrices = lesson("matrices", "Matrices", [
  P("A 2×2 matrix is a rule that moves every point of the plane. Its columns say where the two unit steps go, and the determinant (ad − bc) says how much it scales area (a negative one flips the plane over). The grey square is the original, the blue one its image.",
    { kind: "plot", eq: true, win: [-4, 5, -4, 5], polys: [{ pts: [[0, 0], [1, 0], [1, 1], [0, 1]], k: "c" }, { pts: [[0, 0], ["p", "r"], ["p+q", "r+s"], ["q", "s"]], k: "a" }], params: { p: { min: -3, max: 3, step: 0.5, v: 2, label: "a" }, q: { min: -3, max: 3, step: 0.5, v: 0, label: "b" }, r: { min: -3, max: 3, step: 0.5, v: 0, label: "c" }, s: { min: -3, max: 3, step: 0.5, v: 1, label: "d" } }, read: [["determinant", "p*s-q*r", 2]], alt: "square mapped by a matrix" }),
  G("mx-set", "Set the matrix so that the unit square becomes a rectangle 3 wide and 2 tall: the matrix with a = 3, d = 2 and zeros elsewhere.",
    { kind: "plot", eq: true, win: [-4, 5, -4, 5], polys: [{ pts: [[0, 0], [1, 0], [1, 1], [0, 1]], k: "c" }, { pts: [[0, 0], ["p", "r"], ["p+q", "r+s"], ["q", "s"]], k: "a" }], params: { p: { min: -3, max: 3, step: 0.5, v: 1, label: "a" }, q: { min: -3, max: 3, step: 0.5, v: 0, label: "b" }, r: { min: -3, max: 3, step: 0.5, v: 0, label: "c" }, s: { min: -3, max: 3, step: 0.5, v: 1, label: "d" } }, read: [["determinant", "p*s-q*r", 2]], goal: { p: { p: 3, q: 0, r: 0, s: 2 }, tol: 0.01 }, alt: "square mapped by a matrix" },
    "A diagonal matrix stretches along the axes: the determinant 3 × 2 = 6 is the new area.", { t: "goal", eqs: [["p*s-q*r", 6]] }),
  N("mx-det", "What is the determinant of the matrix with rows (3, 1) and (2, 5)?", ex(K.det2([[3, 1], [2, 5]])), "ad − bc = 15 − 2 = 13.", { t: "js", f: "3*5-1*2" }),
  N("mx-prod", "Multiply the matrices with rows (1, 2), (3, 4) and rows (0, 1), (1, 0). What is the bottom-left entry of the product?", ex(K.mmul([[1, 2], [3, 4]], [[0, 1], [1, 0]])[1][0]), "Row 2 of the first, (3, 4), times column 1 of the second, (0, 1): 3·0 + 4·1 = 4. (The second matrix swaps columns.)", { t: "js", f: "3*0+4*1" }),
  N("mx-det3", "What is the determinant of the 3×3 matrix with rows (1, 2, 3), (0, 1, 4), (5, 6, 0)?", ex(K.det3([[1, 2, 3], [0, 1, 4], [5, 6, 0]])), "Expand along the first row: 1(0 − 24) − 2(0 − 20) + 3(0 − 5) = −24 + 40 − 15 = 1.", { t: "js", f: "1*(1*0-4*6)-2*(0*0-4*5)+3*(0*6-1*5)" }),
]);

// ---------- eigenvalues ----------
const eigen = lesson("eigen", "Eigenvalues", [
  P("For most directions a matrix turns a vector as well as stretching it. An eigenvector is a direction it does not turn: Av = λv, and λ is the eigenvalue, the stretch. Here A has rows (2, 1) and (1, 2). Turn v and watch Av.",
    { kind: "plot", eq: true, win: [-4, 4, -4, 4], arrows: [{ to: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "a", label: "v" }, { to: ["2*cos(t*pi/180)+sin(t*pi/180)", "cos(t*pi/180)+2*sin(t*pi/180)"], k: "b", label: "Av" }], circs: [{ c: [0, 0], r: 1, k: "c" }], params: { t: { min: 0, max: 180, step: 5, v: 20, label: "angle°" } }, read: [["|Av| ÷ |v|", "sqrt((2*cos(t*pi/180)+sin(t*pi/180))^2+(cos(t*pi/180)+2*sin(t*pi/180))^2)", 3]], alt: "a vector and its image" }),
  G("ei-find", "Find an angle where Av lies along the same line as v (the two arrows point the same way or opposite ways).",
    { kind: "plot", eq: true, win: [-4, 4, -4, 4], arrows: [{ to: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "a", label: "v" }, { to: ["2*cos(t*pi/180)+sin(t*pi/180)", "cos(t*pi/180)+2*sin(t*pi/180)"], k: "b", label: "Av" }], circs: [{ c: [0, 0], r: 1, k: "c" }], params: { t: { min: 0, max: 180, step: 5, v: 20, label: "angle°" } }, read: [["cos 2θ", "cos(2*t*pi/180)", 3]], goal: { e: "cos(2*t*pi/180)", v: 0, tol: 0.02 }, alt: "a vector and its image" },
    "At 45° and at 135° the arrows line up. At 45° Av is three times v (eigenvalue 3); at 135° it is v itself (eigenvalue 1).", { t: "goal-e" }),
  N("ei-lam", "The matrix with rows (4, 1) and (2, 3) has two eigenvalues. What is the larger?", "5", "Solve det(A − λI) = (4 − λ)(3 − λ) − 2 = λ² − 7λ + 10 = (λ − 5)(λ − 2) = 0. The eigenvalues are 5 and 2 (their sum is the trace 7, their product the determinant 10).", { t: "js", f: "(()=>{let v=[1,1];for(let i=0;i<200;i++){const w=[4*v[0]+v[1],2*v[0]+3*v[1]],n=Math.hypot(...w);v=w.map(x=>x/n)}return v[0]*(4*v[0]+v[1])+v[1]*(2*v[0]+3*v[1])})()" }, { tol: 1e-6 }),
  N("ei-trace", "A 2×2 matrix has trace 7 and determinant 12. What is its larger eigenvalue?", "4", "The eigenvalues add to the trace and multiply to the determinant: λ² − 7λ + 12 = (λ − 3)(λ − 4), so 3 and 4.", { t: "js", f: "(()=>{for(let a=-20;a<=20;a++)for(let b=a;b<=20;b++)if(a+b===7&&a*b===12)return b})()" }),
], "Uni");

export const LINALG = chapter("linalg", "Vectors and linear algebra", [vectors, dotL, crossL, systems, matrices, eigen]);
