// Maths, chapter 14: Functions of several variables (first-year university), and the Practice lessons that end each chapter.
import { P, Q, N, B, ex, chapter, lesson } from "./maths-kit.js";

const tx = String.raw;
const r = (v, d) => Number(v.toFixed(d));

// ---------- partial derivatives ----------
const partials = lesson("partials", "Partial derivatives", [
  P("With two inputs, f(x, y) is a surface. The partial derivative ∂f/∂x is the slope when you walk in the x direction only, treating y as a constant; ∂f/∂y likewise. To find one, differentiate as usual and leave the other letter alone.",
    { kind: "formula", tex: [tx`f=x^2y+y^3\;\Rightarrow\;\frac{\partial f}{\partial x}=2xy,\quad\frac{\partial f}{\partial y}=x^2+3y^2`], note: "In ∂f/∂x the y is just a number, so y³ vanishes and x²y behaves like (a number) × x²." }),
  N("pa-x", "f(x, y) = x²y + y³. What is ∂f/∂x at the point (1, 2)?", "4", "∂f/∂x = 2xy = 2 × 1 × 2 = 4. The y³ term has no x in it, so it contributes nothing.", { t: "js", f: "(()=>{const f=(x,y)=>x*x*y+y**3,h=1e-4;return (f(1+h,2)-f(1-h,2))/(2*h)})()" }, { tol: 1e-6 }),
  N("pa-y", "For the same f(x, y) = x²y + y³, what is ∂f/∂y at (1, 2)?", "13", "∂f/∂y = x² + 3y² = 1 + 12 = 13.", { t: "js", f: "(()=>{const f=(x,y)=>x*x*y+y**3,h=1e-4;return (f(1,2+h)-f(1,2-h))/(2*h)})()" }, { tol: 1e-6 }),
  N("pa-xy", "Differentiate x²y + y³ first with respect to x, then with respect to y. What is the result at (1, 2)? (The order does not matter for smooth functions.)", "2", "∂f/∂x = 2xy, and ∂/∂y of that is 2x = 2 at x = 1. Differentiating in the other order gives 2x as well: Clairaut's theorem.", { t: "js", f: "(()=>{const f=(x,y)=>x*x*y+y**3,h=1e-2;return (f(1+h,2+h)-f(1+h,2-h)-f(1-h,2+h)+f(1-h,2-h))/(4*h*h)})()" }, { tol: 1e-4 }),
], "Uni");

// ---------- gradient ----------
const gradient = lesson("gradient", "The gradient", [
  P("The gradient ∇f collects the partial derivatives into a vector: it points uphill, in the direction of steepest climb, and its length is how steep that climb is. The rate of change in any other direction u (a unit vector) is ∇f · u.",
    { kind: "formula", tex: [tx`\nabla f=\left(\frac{\partial f}{\partial x},\frac{\partial f}{\partial y}\right)`, tx`D_{\mathbf u}f=\nabla f\cdot\mathbf u`] }),
  Q("gr-vec", "For f(x, y) = x² + y², what is the gradient at (3, 4)?", { v: [6, 8] }, [{ v: [3, 4] }, { v: [8, 6] }, { v: [9, 16] }], "(∂f/∂x, ∂f/∂y) = (2x, 2y) = (6, 8). It points directly away from the origin, the way the bowl climbs fastest.", { t: "vec", f: "[6,8]" }),
  N("gr-steep", "How steep is the steepest climb of f(x, y) = x² + y² at (3, 4)? That is, the length of the gradient.", "10", "|(6, 8)| = √(36 + 64) = 10.", { t: "js", f: "Math.hypot(6,8)" }),
  N("gr-dir", "Walking from (3, 4) in the direction of the unit vector (0.6, 0.8), what is the rate of change of x² + y²?", "10", "∇f · u = 6 × 0.6 + 8 × 0.8 = 3.6 + 6.4 = 10. This direction is the gradient's own, so it equals the gradient's length.", { t: "js", f: "6*0.6+8*0.8" }),
  N("gr-flat", "At (3, 4) the gradient of x² + y² is (6, 8). Walking in the direction (0.8, −0.6), what is the rate of change?", "0", "6 × 0.8 − 8 × 0.6 = 0. Perpendicular to the gradient you stay on the same level: the circle x² + y² = 25.", { t: "js", f: "6*0.8+8*(-0.6)" }),
], "Uni");

// ---------- optimisation ----------
const optimise = lesson("optimise", "Peaks and saddles", [
  P("A smooth surface can only have a peak, a pit or a saddle where the gradient is zero. Set both partials to zero and solve for the critical point. Then the second derivatives tell which: with D = fₓₓf_yy − f_xy², D > 0 with fₓₓ > 0 is a pit, D > 0 with fₓₓ < 0 a peak, and D < 0 a saddle.",
    { kind: "formula", tex: [tx`D=f_{xx}f_{yy}-f_{xy}^2`] }),
  N("op-x", "f(x, y) = x² + y² − 4x + 6y. Setting ∂f/∂x = 2x − 4 = 0 gives x = 2. What is y at the critical point?", "-3", "∂f/∂y = 2y + 6 = 0, so y = −3.", { t: "js", f: "-6/2" }),
  N("op-val", "What is the value of f(x, y) = x² + y² − 4x + 6y at its critical point (2, −3)?", "-13", "4 + 9 − 8 − 18 = −13. Here fₓₓ = 2 > 0 and D = 4 > 0, so it is the lowest point of the bowl.", { t: "js", f: "(()=>{const x=2,y=-3;return x*x+y*y-4*x+6*y})()" }),
  Q("op-saddle", "f(x, y) = x² − y² has a critical point at the origin. What is it?", "~A saddle", ["~A minimum", "~A maximum", "~A point of inflection"], "fₓₓ = 2, f_yy = −2, f_xy = 0, so D = −4 < 0. Along x it is a valley, along y a ridge: a saddle, like a horse's back.", { t: "words" }),
  N("op-d", "For f(x, y) = x³ + y³ − 3xy the second derivatives at (1, 1) are fₓₓ = 6, f_yy = 6 and f_xy = −3. What is D?", "27", "D = 6 × 6 − (−3)² = 36 − 9 = 27. Positive with fₓₓ > 0: (1, 1) is a local minimum.", { t: "js", f: "6*6-(-3)**2" }),
], "Uni");

// ---------- double integrals ----------
const doubleL = lesson("double", "Double integrals", [
  P("A double integral adds up f over a region: slice it one way, integrate along each slice, then integrate the results. Over a rectangle, do the inner integral first (treating the other letter as constant), then the outer. It is the volume under the surface.",
    { kind: "formula", tex: [tx`\int_0^2\!\!\int_0^3 (x+y)\,dy\,dx=\int_0^2\Big(3x+\tfrac92\Big)dx=15`] }),
  N("di-prod", "What is the integral of xy over 0 ≤ x ≤ 1, 0 ≤ y ≤ 2?", "1", "When f is a product, the integral splits: ∫₀¹ x dx × ∫₀² y dy = ½ × 2 = 1.", { t: "js", f: "(()=>{let s=0,n=400;for(let i=0;i<n;i++)for(let j=0;j<n;j++)s+=((i+.5)/n)*(2*(j+.5)/n);return s*2/(n*n)})()" }, { tol: 1e-4 }),
  N("di-sum", "What is the integral of x + y over 0 ≤ x ≤ 2, 0 ≤ y ≤ 3?", "15", "The inner integral over y gives 3x + 9/2; then ∫₀² (3x + 9/2) dx = 6 + 9 = 15. (The region has area 6 and the average of x + y is 2.5.)", { t: "js", f: "(()=>{let s=0,n=400;for(let i=0;i<n;i++)for(let j=0;j<n;j++)s+=2*(i+.5)/n+3*(j+.5)/n;return s*6/(n*n)})()" }, { tol: 1e-3 }),
  N("di-tri", "What is the integral of 1 over the triangle with 0 ≤ y ≤ x ≤ 1, that is the area? Type it as a decimal.", "0.5", "The inner integral over y from 0 to x gives x, and ∫₀¹ x dx = ½: half the unit square.", { t: "js", f: "(()=>{let c=0,n=1000;for(let i=0;i<n;i++)for(let j=0;j<n;j++)if((j+.5)<=(i+.5))c++;return c/(n*n)})()" }, { tol: 1e-3 }),
], "Uni");

// ---------- polar ----------
const polarL = lesson("polarint", "Polar coordinates", [
  P("For round regions use polar coordinates (r, θ). A small patch there has area r dr dθ, not dr dθ: the extra r is because the patches are wider further out. A disc is then 0 ≤ r ≤ R and 0 ≤ θ ≤ 2π.",
    { kind: "formula", tex: [tx`\iint f\,dA=\int\!\!\int f\,r\,dr\,d\theta`, tx`\iint_{\text{disc}}1\,dA=\int_0^{2\pi}\!\!\int_0^R r\,dr\,d\theta=\pi R^2`] }),
  N("po-disc", "Use polar coordinates to find the area of a disc of radius 3. To 2 decimal places.", ex(r(9 * Math.PI, 2)), "∫₀^{2π} ∫₀³ r dr dθ = 2π × 9/2 = 9π = 28.27.", { t: "js", f: "9*Math.PI" }, { tol: 0.006 }),
  N("po-r2", "What is the integral of x² + y² over the unit disc? To 3 decimal places. (In polar, x² + y² = r².)", ex(r(Math.PI / 2, 3)), "∫₀^{2π} ∫₀¹ r² · r dr dθ = 2π × 1/4 = π/2 = 1.571.", { t: "js", f: "Math.PI/2" }, { tol: 0.0006 }),
  N("po-gauss", "The integral of e^−(x² + y²) over the whole plane is a famous number. To 3 decimal places?", ex(r(Math.PI, 3)), "In polar: ∫₀^{2π} ∫₀^∞ e^(−r²) r dr dθ = 2π × ½ = π. Taking the square root gives ∫ e^(−x²) dx = √π, the integral behind the normal curve.", { t: "js", f: "(()=>{let s=0,h=1e-3;for(let r=0;r<10;r+=h)s+=Math.exp(-((r+h/2)**2))*(r+h/2)*h;return 2*Math.PI*s})()" }, { tol: 0.0006 }),
], "Uni");

export const MULTI = chapter("multi", "Several variables", [partials, gradient, optimise, doubleL, polarL]);

// ---------- Practice: questions from Punt's maths bank ----------
const PICKS = {
  number: ["NUM-01", "NUM-10", "NUM-21", "NUM-31"],
  algebra: ["ALG-01", "LOG-01", "LOG-06", "LOG-05"],
  functions: ["ALG-41", "ALG-42", "ALG-47", "ALG-48"],
  geometry: ["COORD-01", "COORD-16", "GEO-17", "GEO-09"],
  trig: ["GEO-33", "TRIG-02", "TRIG-19", "TRIG-24"],
  further: ["CPX-06", "CPX-12", "CPX-05", "CPX-31"],
  diff: ["DIFF-01", "DIFF-07", "DIFF-09", "DIFF-39"],
  integration: ["INT-03", "INT-06", "INT-07", "INT-10"],
  series: ["SER-12", "SER-10", "ANA-01", "ANA-08"],
  linalg: ["MAT-01", "MAT-29", "LA-07", "LA-24"],
  prob: ["PROB-01", "PROB-23", "STAT-38", "PROB-39"],
  discrete: ["PROOF-49", "PROOF-02", "PROOF-07", "PROOF-35"],
  de: ["ODE-01", "ODE-03", "ODE-28", "ODE-31"],
  multi: ["MVC-01", "MVC-12", "MVC-13", "MVC-36"],
};
/** The chapter's closing lesson: four of the bank's questions, in order of difficulty. */
export const practiceOf = ch => lesson(`practice-${ch}`, "Practice", PICKS[ch].map(id => B(id)));
