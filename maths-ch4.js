// Maths, chapters 6 to 8: Further algebra (IB HL), Differentiation and Integration (IB SL to first-year university).
import * as K from "./maths-math.js";
import { P, Q, N, G, ex, chapter, lesson } from "./maths-kit.js";

const tx = String.raw;

// ---------- the binomial theorem ----------
const ROW5 = Array.from({ length: 6 }, (_, k) => K.binom(5, k));
const powPoly = (p, n) => Array.from({ length: n }).reduce(a => K.pMul(a, p), [1]);
const X4 = powPoly([2, 1], 4);
const binomial = lesson("binomial", "Binomial theorem", [
  P(`Expanding (a + b)ⁿ gives a row of Pascal's triangle as the coefficients: the number of ways to choose k of the n brackets to supply a b. For n = 5 the row is ${ROW5.join(", ")}.`,
    { kind: "formula", tex: [tx`(a+b)^n=\sum_{k=0}^{n}\binom nk a^{n-k}b^k`, tx`\binom nk=\frac{n!}{k!\,(n-k)!}`] }),
  Q("bin-expand", "Expand (x + 2)⁴.", K.pText(X4), ["x^4+16", "x^4+4*x^3+6*x^2+4*x+1", "x^4+8*x^3+12*x^2+32*x+16"], "Coefficients 1, 4, 6, 4, 1 and the powers of 2: 1, 2, 4, 8, 16 in turn. So x⁴ + 4·2x³ + 6·4x² + 4·8x + 16.", { t: "ident", f: "(x+2)^4" }),
  N("bin-coef", "What is the coefficient of x³ in the expansion of (2 + x)⁵?", ex(K.binom(5, 3) * 4), "C(5, 3) × 2² = 10 × 4 = 40: choose which three brackets give x, and the other two give 2.", { t: "js", f: "(()=>{let p=[1];for(let i=0;i<5;i++){const q=Array(p.length+1).fill(0);p.forEach((c,j)=>{q[j]+=2*c;q[j+1]+=c});p=q}return p[3]})()" }),
  N("bin-approx", "Use the first three terms of (1 + 0.01)¹⁰ to estimate 1.01¹⁰, to 4 decimal places.", ex(1 + 10 * 0.01 + 45 * 0.0001), "1 + 10(0.01) + 45(0.01)² = 1.1045. The true value is 1.10462: small powers die fast, which is why 'a few terms' is enough.", { t: "js", f: "Math.pow(1.01,10)" }, { tol: 0.0002 }),
]);

// ---------- complex numbers ----------
const complexL = lesson("complex", "Complex numbers", [
  P("The number i is defined by i² = −1. A complex number a + bi has a real part a and an imaginary part b, and sits on a plane at (a, b). Its modulus |z| is its distance from the origin.",
    { kind: "plot", eq: true, win: [-5, 6, -4, 6], arrows: [{ to: ["a", "b"], k: "a", label: "z" }], pts: [{ p: ["a", "b"], k: "a" }], lines: [{ a: ["a", 0], b: ["a", "b"], k: "d" }, { a: [0, "b"], b: ["a", "b"], k: "d" }], params: { a: { min: -4, max: 5, step: 1, v: 3, label: "Re" }, b: { min: -3, max: 5, step: 1, v: 2, label: "Im" } }, read: [["|z|", "sqrt(a^2+b^2)", 3]], alt: "Argand diagram" }),
  Q("cx-mul", "What is (3 + 2i)(1 − i)?", { c: [5, -1] }, [{ c: [3, -2] }, { c: [1, -1] }, { c: [5, 1] }], "Expand: 3 − 3i + 2i − 2i² = 3 − i + 2 = 5 − i, because i² = −1.", { t: "cplx", f: "[3*1-2*(-1), 3*(-1)+2*1]" }),
  N("cx-mod", "What is the modulus of 3 + 4i?", ex(Math.hypot(3, 4)), "|z| = √(3² + 4²) = 5, Pythagoras on the Argand diagram.", { t: "js", f: "Math.sqrt(9+16)" }),
  Q("cx-square", "What is (1 + i)²?", { c: [0, 2] }, [{ c: [2, 0] }, { c: [1, 1] }, { c: [0, 1] }], "(1 + i)(1 + i) = 1 + 2i + i² = 2i. Squaring a number of modulus √2 and angle 45° gives modulus 2 and angle 90°.", { t: "cplx", f: "(()=>{const a=1,b=1;return [a*a-b*b,2*a*b]})()" }),
  Q("cx-conj", "z = 2 + 5i. What is z times its conjugate (2 − 5i)?", "29", ["-21", "~4 + 25i", "10"], "(2 + 5i)(2 − 5i) = 4 − 25i² = 4 + 25 = 29, which is |z|². Multiplying by the conjugate always gives a real number: that is how you divide by a complex number.", { t: "js", f: "2*2+5*5" }),
], "HL");

// ---------- polar form ----------
const polar = lesson("polar", "Polar form", [
  P("A complex number also has a modulus r and an argument θ (its angle from the positive real axis): z = r(cos θ + i sin θ). Multiplying numbers multiplies the moduli and adds the angles, so de Moivre's theorem follows.",
    { kind: "formula", tex: [tx`z=r(\cos\theta+i\sin\theta)=re^{i\theta}`, tx`z^n=r^n(\cos n\theta+i\sin n\theta)`] }),
  N("pl-arg", "What is the argument of −1 + i, as a multiple of π? Type the fraction.", "3/4", "The point (−1, 1) is in the second quarter, at 135° = 3π/4 from the positive real axis.", { t: "js", f: "Math.atan2(1,-1)/Math.PI" }),
  N("pl-demoivre", "What is the real part of (√3 + i)⁶?", "-64", "√3 + i has modulus 2 and argument 30°. Raise to the sixth: modulus 2⁶ = 64, argument 180°: 64(cos 180° + i sin 180°) = −64.", { t: "js", f: "Math.pow(2,6)*Math.cos(6*Math.PI/6)" }),
  Q("pl-unity", "What do the five fifth roots of unity add up to?", "0", ["1", "5", "-1"], "They sit evenly round the unit circle, so they balance: the real parts and the imaginary parts each cancel. Every set of n-th roots of unity (n > 1) sums to 0.", { t: "js", f: "[0,1,2,3,4].reduce((s,k)=>s+Math.cos(2*Math.PI*k/5),0)" }),
], "HL");

export const FURTHER = chapter("further", "Further algebra", [binomial, complexL, polar]);

// ---------- limits and first principles ----------
const limits = lesson("limits", "Gradient from limits", [
  P("The gradient of a curve at a point is the limit of the gradient of a chord from that point as the chord shrinks. On y = x² at x = 1 the chord to x = 1 + h has gradient ((1 + h)² − 1)/h = 2 + h. Shrink h.",
    { kind: "plot", win: [-1, 3, -1, 6], fns: [{ e: "x^2" }], secant: { at: 1, h: "h" }, params: { h: { min: 0.02, max: 2, step: 0.02, v: 1.5, label: "h" } }, alt: "chord on a parabola" }),
  G("lim-small", "Make h small enough that the chord's gradient is within 0.05 of the tangent's gradient, which is 2.",
    { kind: "plot", win: [-1, 3, -1, 6], fns: [{ e: "x^2" }], secant: { at: 1, h: "h" }, params: { h: { min: 0.02, max: 2, step: 0.02, v: 1.5, label: "h" } }, goal: { e: "((1+h)^2-1)/h", v: 2, tol: 0.05, miss: "Look at the gradient: it should be within 0.05 of 2." }, alt: "chord on a parabola" },
    "The gradient is 2 + h, so h ≤ 0.05 does it. The limit as h → 0 is exactly 2: that number is the derivative of x² at 1.", { t: "goal-e" }),
  N("lim-first", "From first principles, what is the gradient of y = x² at x = 3? (The limit of ((3 + h)² − 9)/h as h → 0.)", "6", "((3 + h)² − 9)/h = (6h + h²)/h = 6 + h, and as h → 0 this is 6. In general the gradient of x² is 2x.", { t: "js", f: "(()=>{const h=1e-6;return ((3+h)**2-9)/h})()" }, { tol: 0.001 }),
  Q("lim-hole", "What is the limit of (x² − 4)/(x − 2) as x → 2?", "4", ["0", "2", "~There is no limit"], "At x = 2 the fraction is 0/0, but for any other x it simplifies to x + 2, so the values approach 4. A limit cares about where the function is heading, not what it does at the point.", { t: "lim", f: "(x^2-4)/(x-2)", to: 2 }),
]);

// ---------- differentiation rules ----------
const D1 = [0, 5, -2, 0, 3];
const rules1 = lesson("diffrules", "Differentiating", [
  P("The derivative of xⁿ is nxⁿ⁻¹: multiply by the power, then lower it by one. Constants vanish, and sums are done term by term.",
    { kind: "formula", tex: [tx`\frac{d}{dx}x^n=nx^{n-1}`, tx`\frac{d}{dx}\bigl(3x^4-2x^2+5x\bigr)=12x^3-4x+5`] }),
  Q("d-poly", "Differentiate 3x⁴ − 2x² + 5x.", K.pText(K.pDeriv(D1)), ["12*x^3-4*x", "12*x^4-4*x^2+5", "3*x^3-2*x+5"], "Term by term: 3·4x³ = 12x³, −2·2x = −4x, and 5x gives 5.", { t: "deriv", f: "3*x^4-2*x^2+5*x" }),
  Q("d-sqrt", "Differentiate √x.", "1/(2*sqrt(x))", ["2*sqrt(x)", "1/sqrt(x)", "sqrt(x)/2"], "√x = x^(1/2), so the derivative is (1/2)x^(−1/2) = 1/(2√x).", { t: "deriv", f: "sqrt(x)" }),
  Q("d-recip", "Differentiate 1/x.", "-1/x^2", ["1/x^2", "-1/x", "ln(x)"], "1/x = x⁻¹, so the derivative is −1·x⁻² = −1/x².", { t: "deriv", f: "1/x" }),
  N("d-grad", "What is the gradient of y = x³ − 3x at x = 2?", ex(K.pEval(K.pDeriv([0, -3, 0, 1]), 2)), "dy/dx = 3x² − 3, which is 9 at x = 2.", { t: "js", f: "(()=>{const f=x=>x**3-3*x,h=1e-6;return (f(2+h)-f(2-h))/(2*h)})()" }, { tol: 1e-6 }),
]);

// ---------- product and quotient ----------
const rules2 = lesson("diffprod", "Product, quotient", [
  P("A product is not differentiated factor by factor. The product rule takes one derivative at a time; the quotient rule is the same idea with a minus sign and a square on the bottom.",
    { kind: "formula", tex: [tx`(uv)'=u'v+uv'`, tx`\left(\frac uv\right)'=\frac{u'v-uv'}{v^2}`] }),
  Q("d-prod", "Differentiate x² sin x.", "2*x*sin(x)+x^2*cos(x)", ["2*x*cos(x)", "x^2*cos(x)", "2*x*sin(x)-x^2*cos(x)"], "u = x², v = sin x: u′v + uv′ = 2x sin x + x² cos x.", { t: "deriv", f: "x^2*sin(x)" }),
  Q("d-quot", "Differentiate x/(x + 1).", "1/(x+1)^2", ["1/(x+1)", "x/(x+1)^2", "(2*x+1)/(x+1)^2"], "(1·(x + 1) − x·1)/(x + 1)² = 1/(x + 1)².", { t: "deriv", f: "x/(x+1)" }),
  Q("d-exp", "Differentiate eˣ cos x.", "exp(x)*(cos(x)-sin(x))", ["-exp(x)*sin(x)", "exp(x)*(cos(x)+sin(x))", "exp(x)*cos(x)"], "eˣ cos x + eˣ(−sin x) = eˣ(cos x − sin x).", { t: "deriv", f: "exp(x)*cos(x)" }),
  N("d-xex", "What is the gradient of y = x eˣ at x = 1, to 4 decimal places?", ex(Number((2 * Math.E).toFixed(4))), "dy/dx = eˣ + x eˣ = (1 + x)eˣ, which is 2e = 5.4366 at x = 1.", { t: "js", f: "(()=>{const f=x=>x*Math.exp(x),h=1e-6;return (f(1+h)-f(1-h))/(2*h)})()" }, { tol: 0.0001 }),
]);

// ---------- the chain rule ----------
const chain = lesson("chain", "The chain rule", [
  P("When a function sits inside another, differentiate the outside (leaving the inside alone), then multiply by the derivative of the inside.",
    { kind: "formula", tex: [tx`\frac{d}{dx}f\bigl(g(x)\bigr)=f'\bigl(g(x)\bigr)\cdot g'(x)`, tx`\frac{d}{dx}(3x+1)^5=5(3x+1)^4\cdot3`] }),
  Q("c-power", "Differentiate (3x + 1)⁵.", "15*(3*x+1)^4", ["5*(3*x+1)^4", "15*x^4", "5*(3*x+1)^4*x"], "Outside: 5(3x + 1)⁴. Inside: 3. Multiply: 15(3x + 1)⁴. Forgetting the 3 is the usual slip.", { t: "deriv", f: "(3*x+1)^5" }),
  Q("c-sin", "Differentiate sin(x²).", "2*x*cos(x^2)", ["cos(x^2)", "2*x*cos(x)", "-2*x*cos(x^2)"], "Outside: cos(x²). Inside x² has derivative 2x.", { t: "deriv", f: "sin(x^2)" }),
  Q("c-exp", "Differentiate e to the power −x².", "-2*x*exp(-x^2)", ["exp(-x^2)", "2*x*exp(-x^2)", "-x^2*exp(-x^2)"], "The exponential is its own derivative; the inside −x² contributes −2x. This is the shape of the bell curve, and its slope is zero at its peak, x = 0.", { t: "deriv", f: "exp(-x^2)" }),
  Q("c-ln", "Differentiate ln(2x + 1).", "2/(2*x+1)", ["1/(2*x+1)", "2*x+1", "2/x"], "Outside: 1/(2x + 1). Inside: 2.", { t: "deriv", f: "ln(2*x+1)" }),
  N("c-num", "What is the gradient of y = √(1 + x²) at x = 2, to 4 decimal places?", ex(Number((2 / Math.sqrt(5)).toFixed(4))), "(1/2)(1 + x²)^(−1/2) × 2x = x/√(1 + x²) = 2/√5 = 0.8944.", { t: "js", f: "(()=>{const f=x=>Math.sqrt(1+x*x),h=1e-6;return (f(2+h)-f(2-h))/(2*h)})()" }, { tol: 0.0001 }),
]);

// ---------- tangents and normals ----------
const tangents = lesson("tangents", "Tangents", [
  G("tg-flat", "The tangent to y = x² − 4x touches the curve at the point t. Slide t to where the tangent is flat (gradient zero): the bottom of the curve.",
    { kind: "plot", win: [-1, 6, -5, 6], fns: [{ e: "x^2-4*x" }], tangent: { at: "t" }, params: { t: { min: -0.5, max: 5, step: 0.5, v: 0.5, label: "t" } }, goal: { e: "2*t-4", v: 0, tol: 0.01 }, alt: "tangent sliding on a parabola" },
    "The gradient is 2t − 4, which is zero at t = 2: the lowest point of the curve, (2, −4).", { t: "goal-e" }),
  N("tg-int", "The curve y = x³ − 2x has a tangent at x = 1. Where does that tangent cut the y-axis?", "-2", "The gradient is 3x² − 2 = 1 at x = 1, and the point is (1, −1). The tangent is y + 1 = 1(x − 1), so y = x − 2: it cuts the y-axis at −2.", { t: "js", f: "(()=>{const f=x=>x**3-2*x,h=1e-6,m=(f(1+h)-f(1-h))/(2*h);return f(1)-m*1})()" }, { tol: 1e-5 }),
  Q("tg-normal", "A tangent has gradient 4. What is the gradient of the normal (the line at right angles to it)?", "-1/4", ["4", "1/4", "-4"], "Perpendicular gradients multiply to −1: 4 × (−1/4) = −1.", { t: "pred", p: "v=>Math.abs(v*4+1)<1e-9" }),
]);

// ---------- stationary points and optimisation ----------
const VOL = t => t * (12 - 2 * t) ** 2;
const stationary = lesson("stationary", "Max and min", [
  P("At a maximum or minimum the tangent is flat, so f′(x) = 0. To tell which, look at the second derivative: positive means the gradient is increasing, so a minimum (a valley); negative, a maximum.",
    { kind: "formula", tex: [tx`f'(x)=0\ \text{at a turning point}`, tx`f''>0\Rightarrow\text{minimum}\qquad f''<0\Rightarrow\text{maximum}`] }),
  Q("st-points", "Where does y = x³ − 12x have its turning points?", ["2", "-2"], [["2", "0"], ["12", "-12"], ["4", "-4"]], "dy/dx = 3x² − 12 = 0 gives x² = 4, so x = ±2.", { t: "roots", f: "3*x^2-12", n: 2 }),
  N("st-second", "For y = x³ − 12x, what is the second derivative at x = 2? (Positive means a minimum.)", ex(K.pEval(K.pDeriv(K.pDeriv([0, -12, 0, 1])), 2)), "y″ = 6x, which is 12 at x = 2: positive, so x = 2 is a minimum (and y″ = −12 at x = −2, a maximum).", { t: "js", f: "(()=>{const f=x=>x**3-12*x,h=1e-3;return (f(2+h)-2*f(2)+f(2-h))/(h*h)})()" }, { tol: 1e-3 }),
  G("st-box", "A 12 cm square sheet has a square of side t cut from each corner and the sides are folded up into an open box: volume V = t(12 − 2t)². Slide t to make the box as big as possible.",
    { kind: "plot", win: [0, 6, 0, 150], fns: [{ e: "x*(12-2*x)^2" }], pts: [{ p: ["t", "t*(12-2*t)^2"], k: "b" }], params: { t: { min: 0.5, max: 5.5, step: 0.1, v: 1, label: "t cm" } }, read: [["volume", "t*(12-2*t)^2", 1]], goal: { e: "t*(12-2*t)^2", v: VOL(2), tol: 1, miss: "Keep going: the volume can be bigger." }, alt: "volume of a box" },
    "t = 2 cm: V = 2 × 8² = 128 cm³. V′ = (12 − 2t)(12 − 6t) = 0 at t = 2 (or at t = 6, which leaves no box).", { t: "goal-e" }),
  N("st-max", "What is the greatest volume of that box, in cm³?", ex(VOL(2)), "V′ = (12 − 2t)(12 − 6t) = 0 at t = 2, where V = 2 × 8 × 8 = 128.", { t: "js", f: "Math.max(...Array.from({length:6001},(_,i)=>(i/1000)*(12-2*(i/1000))**2))" }, { tol: 1e-4 }),
]);

// ---------- exponentials, logs and rates ----------
const ratesL = lesson("rates", "Exp, implicit, rates", [
  P("The function eˣ is its own derivative: at every point its gradient equals its height. Move the tangent along it and compare the two numbers.",
    { kind: "plot", win: [-2, 3, -1, 12], fns: [{ e: "exp(x)" }], tangent: { at: "t" }, params: { t: { min: -1, max: 2.5, step: 0.05, v: 0, label: "t" } }, read: [["height", "exp(t)", 3]], alt: "exponential with a tangent" }),
  G("rt-find", "Find the point on y = eˣ where the gradient is 5.",
    { kind: "plot", win: [-2, 3, -1, 12], fns: [{ e: "exp(x)" }], tangent: { at: "t" }, params: { t: { min: -1, max: 2.5, step: 0.05, v: 0, label: "t" } }, goal: { e: "exp(t)", v: 5, tol: 0.1, miss: "Watch the gradient reading: it should be 5." }, alt: "exponential with a tangent" },
    "eᵗ = 5 gives t = ln 5 ≈ 1.61. The gradient of eˣ is eˣ itself, so we need the height to be 5.", { t: "goal-e" }),
  Q("rt-2x", "Differentiate 2ˣ.", "ln(2)*2^x", ["x*2^(x-1)", "2^x", "ln(x)*2^x"], "Write 2ˣ = e^(x ln 2); the chain rule brings down ln 2. The exponent rule xⁿ → nxⁿ⁻¹ is for a variable base, not a variable power.", { t: "deriv", f: "2^x" }),
  Q("rt-implicit", "On the circle x² + y² = 25, what is dy/dx at the point (3, 4)?", "-3/4", ["3/4", "-4/3", "4/3"], "Differentiate both sides: 2x + 2y dy/dx = 0, so dy/dx = −x/y = −3/4. The tangent is shallow and falling, as it should be on the upper right of the circle.", { t: "js", f: "(()=>{const y=x=>Math.sqrt(25-x*x),h=1e-6;return (y(3+h)-y(3-h))/(2*h)})()", tol: 1e-6 }),
  N("rt-area", "A circular oil slick has radius 5 m, growing at 0.2 m per minute. How fast is its area growing, in m² per minute, to 3 decimal places?", ex(Number((2 * Math.PI * 5 * 0.2).toFixed(3))), "A = πr², so dA/dt = 2πr dr/dt = 2π × 5 × 0.2 = 6.283 m² a minute.", { t: "js", f: "(()=>{const A=r=>Math.PI*r*r,h=1e-6;return (A(5+h)-A(5-h))/(2*h)*0.2})()" }, { tol: 0.001 }),
]);

export const DIFF = chapter("diff", "Differentiation", [limits, rules1, rules2, chain, tangents, stationary, ratesL]);

// ---------- antiderivatives ----------
const anti = lesson("anti", "Antiderivatives", [
  P("Integration undoes differentiation: an antiderivative of f is a function whose derivative is f. Raise the power by one and divide by the new power; add a constant C, because constants vanish when differentiated.",
    { kind: "formula", tex: [tx`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C\quad(n\ne-1)`, tx`\int e^{kx}dx=\frac{e^{kx}}{k}+C`] }),
  Q("i-poly", "Integrate 6x² − 4x + 1.", "2*x^3-2*x^2+x", ["6*x^3-4*x^2+x", "2*x^3-2*x^2+1", "12*x-4"], "Each power goes up by one and divides by the new power: 6x³/3 = 2x³, 4x²/2 = 2x², x. (Plus C.) Check by differentiating.", { t: "anti", f: "6*x^2-4*x+1" }),
  Q("i-cos", "Integrate cos 2x.", "sin(2*x)/2", ["sin(2*x)", "2*sin(2*x)", "-sin(2*x)/2"], "Differentiating sin 2x gives 2 cos 2x, so we need half of it: sin(2x)/2.", { t: "anti", f: "cos(2*x)" }),
  Q("i-exp", "Integrate e to the power 2x.", "exp(2*x)/2", ["exp(2*x)", "2*exp(2*x)", "exp(2*x)/x"], "The chain rule would put a factor 2 on the derivative of e^(2x), so divide by 2 to undo it.", { t: "anti", f: "exp(2*x)" }),
  N("i-const", "A curve has gradient 3x² − 2 and passes through (1, 4). What is y when x = 2?", ex(9), "y = x³ − 2x + C, and 4 = 1 − 2 + C gives C = 5. At x = 2, y = 8 − 4 + 5 = 9.", { t: "js", f: "(()=>{const f=x=>x**3-2*x,C=4-f(1);return f(2)+C})()" }),
]);

// ---------- definite integrals and area ----------
const area = lesson("area", "Area", [
  P("The definite integral from a to b is the signed area between the curve and the axis. If F is an antiderivative, it equals F(b) − F(a). Slide the upper limit b along y = x².",
    { kind: "plot", win: [0, 5, 0, 12], fns: [{ e: "x^2" }], shade: { a: 0, b: "b" }, params: { b: { min: 0, max: 3.4, step: 0.1, v: 1, label: "b" } }, alt: "area under a parabola" }),
  G("ar-set", "Choose b so that the area under y = x² from 0 to b is exactly 9.",
    { kind: "plot", win: [0, 5, 0, 12], fns: [{ e: "x^2" }], shade: { a: 0, b: "b" }, params: { b: { min: 0, max: 4, step: 0.1, v: 1, label: "b" } }, goal: { e: "b^3/3", v: 9, tol: 0.1 }, alt: "area under a parabola" },
    "The area is b³/3, and b³ = 27 gives b = 3.", { t: "goal-e" }),
  N("ar-between", "What is the area enclosed between y = 2x and y = x²? (They meet at x = 0 and x = 2.) To 3 decimal places.", ex(Number((4 / 3).toFixed(3))), "Between the curves the line is above: ∫₀² (2x − x²) dx = [x² − x³/3] from 0 to 2 = 4 − 8/3 = 4/3.", { t: "def", f: "2*x-x^2", a: 0, b: 2 }, { tol: 0.0004 }),
  Q("ar-odd", "What is the integral of x³ from −1 to 1?", "0", ["1/2", "2", "-1/2"], "x³ is an odd function: the area below the axis on the left exactly cancels the area above it on the right. The definite integral is signed area.", { t: "def", f: "x^3", a: -1, b: 1 }),
  N("ar-sin", "What is the area under y = sin x from 0 to π?", "2", "−cos x evaluated from 0 to π: (−cos π) − (−cos 0) = 1 + 1 = 2.", { t: "def", f: "sin(x)", a: 0, b: "Math.PI" }, { tol: 1e-6 }),
]);

// ---------- Riemann sums ----------
const riem = lesson("riemann", "Sums to integrals", [
  P("Before antiderivatives: slice the area into strips and add them up. More, thinner strips give a better answer, and the limit of the sums is the integral. Try the rules: a left sum uses each strip's left edge; the middle sum and the trapezium rule use more of the curve.",
    { kind: "riemann", f: "x^2", a: 0, b: 2, win: [0, 2.2, 0, 4.6], n: { min: 1, max: 60, v: 4 } }),
  G("rm-win", "The area under x² from 0 to 2 is 8/3 ≈ 2.667. Find a rule and a number of strips that gets within 2%.",
    { kind: "riemann", f: "x^2", a: 0, b: 2, win: [0, 2.2, 0, 4.6], n: { min: 1, max: 60, v: 2 }, goal: { err: 0.02 } },
    "The middle sum and the trapezium rule reach 2% with a handful of strips; a left or right sum is wrong by about the same amount on every strip, in the same direction, and needs a hundred or more.", { t: "riemann" }),
  N("rm-mid", "The middle sum for the area under y = x² from 0 to 2 with 4 strips adds the heights at 0.25, 0.75, 1.25 and 1.75, times the width 0.5. What is it?", ex(K.riemann(x => x * x, 0, 2, 4, "mid")), "(0.0625 + 0.5625 + 1.5625 + 3.0625) × 0.5 = 2.625, against the exact 2.667: already within 2%.", { t: "js", f: "[0.25,0.75,1.25,1.75].reduce((s,x)=>s+x*x,0)*0.5" }),
]);

// ---------- substitution and parts ----------
const subst = lesson("subst", "Substitution", [
  P("When one factor is the derivative of something inside the other, call that inside u. Then ∫ 2x eˣ² dx becomes ∫ eᵘ du, because du = 2x dx.",
    { kind: "formula", tex: [tx`u=x^2,\quad du=2x\,dx`, tx`\int 2x\,e^{x^2}dx=\int e^u du=e^{x^2}+C`] }),
  Q("su-exp", "Integrate 2x e to the power x².", "exp(x^2)", ["x^2*exp(x^2)", "exp(x^2)/(2*x)", "2*exp(x^2)"], "u = x², du = 2x dx: ∫ eᵘ du = eᵘ = e^(x²). Differentiating it with the chain rule gives back 2x e^(x²).", { t: "anti", f: "2*x*exp(x^2)" }),
  Q("su-sin", "Integrate cos x sin³x.", "sin(x)^4/4", ["sin(x)^4", "cos(x)^4/4", "-sin(x)^4/4"], "u = sin x, du = cos x dx: ∫ u³ du = u⁴/4.", { t: "anti", f: "cos(x)*sin(x)^3" }),
  N("su-def", "What is the integral of 2x/(1 + x²) from 0 to 1, to 4 decimal places?", ex(Number(Math.LN2.toFixed(4))), "u = 1 + x², du = 2x dx: ∫ du/u = ln u, so ln 2 − ln 1 = ln 2 = 0.6931.", { t: "def", f: "2*x/(1+x^2)", a: 0, b: 1 }, { tol: 0.0001 }),
]);

const parts = lesson("parts", "By parts", [
  P("The product rule run backwards: ∫u dv = uv − ∫v du. Choose u as the factor that gets simpler when differentiated (x, not eˣ).",
    { kind: "formula", tex: [tx`\int u\,dv=uv-\int v\,du`, tx`\int x e^x dx=xe^x-\int e^x dx=(x-1)e^x+C`] }),
  Q("pa-xex", "Integrate x eˣ.", "(x-1)*exp(x)", ["(x+1)*exp(x)", "x*exp(x)", "x^2*exp(x)/2"], "u = x, dv = eˣ dx: x eˣ − ∫ eˣ dx = (x − 1)eˣ. Differentiate to check: eˣ + (x − 1)eˣ = x eˣ.", { t: "anti", f: "x*exp(x)" }),
  Q("pa-xcos", "Integrate x cos x.", "x*sin(x)+cos(x)", ["x*sin(x)-cos(x)", "sin(x)+x*cos(x)", "x^2*sin(x)/2"], "u = x, dv = cos x dx: x sin x − ∫ sin x dx = x sin x + cos x.", { t: "anti", f: "x*cos(x)" }),
  N("pa-def", "What is the integral of x eˣ from 0 to 1?", "1", "[(x − 1)eˣ] from 0 to 1 = 0 − (−1) = 1.", { t: "def", f: "x*exp(x)", a: 0, b: 1 }, { tol: 1e-6 }),
]);

// ---------- volumes and averages ----------
const volumes2 = lesson("revolve", "Volumes, averages", [
  P("Spin the region under a curve about the x-axis and you get a solid. Stack discs of radius y and thickness dx, each of volume πy² dx, and add: V = π ∫ y² dx.",
    { kind: "plot", win: [0, 4.4, -2.4, 2.4], fns: [{ e: "sqrt(x)" }, { e: "-sqrt(x)", k: "c" }], shade: { fn: 0, a: 0, b: "b" }, params: { b: { min: 0.5, max: 4, step: 0.5, v: 4, label: "to x" } }, alt: "region spun about an axis" }),
  N("rv-vol", "Spin y = √x from x = 0 to x = 4 about the x-axis. What is the volume, to 2 decimal places?", ex(Number((8 * Math.PI).toFixed(2))), "π ∫₀⁴ x dx = π [x²/2] = π × 8 = 25.13.", { t: "js", f: "Math.PI*(()=>{let s=0,n=100000;for(let i=0;i<n;i++){const x=(i+0.5)*4/n;s+=x*4/n}return s})()" }, { tol: 0.005 }),
  N("rv-mean", "What is the average value of y = x² on the interval from 0 to 3?", "3", "The average is the area divided by the width: (∫₀³ x² dx)/3 = 9/3 = 3.", { t: "def", f: "x^2/3", a: 0, b: 3 }, { tol: 1e-6 }),
]);

export const INTEGRATION = chapter("integration", "Integration", [anti, area, riem, subst, parts, volumes2]);
