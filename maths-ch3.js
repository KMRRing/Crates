// Maths, chapters 4 and 5: Geometry (GCSE to IB SL) and Trigonometry (GCSE to IB HL).
import * as K from "./maths-math.js";
import { P, Q, N, G, ex, chapter, lesson } from "./maths-kit.js";

const tx = String.raw, nm = K.nm, R = K.rad;

/** A right triangle with legs a and b drawn to scale, its sides named. */
const rightTri = (a, b, names = ["a", "b", "c"]) => ({
  kind: "plot", eq: true, bare: true, win: [-0.6, a + 0.6, -0.8, b + 0.6], alt: "right-angled triangle",
  polys: [{ pts: [[0, 0], [a, 0], [a, b]], k: "a" }],
  lines: [{ a: [a - 0.35, 0], b: [a - 0.35, 0.35], k: "c" }, { a: [a - 0.35, 0.35], b: [a, 0.35], k: "c" }],
  texts: [{ p: [a / 2, -0.5], s: names[0], anchor: "middle", k: "a" }, { p: [a + 0.2, b / 2], s: names[1], k: "a" }, { p: [a / 2 - 0.5, b / 2 + 0.15], s: names[2], k: "a" }],
});

// ---------- Pythagoras ----------
const pythagoras = lesson("pythagoras", "Pythagoras", [
  P("In a right-angled triangle the square on the longest side (the hypotenuse) equals the sum of the squares on the other two. It is how you get a distance from two steps at right angles.",
    { ...rightTri(4, 3), tex: tx`a^2+b^2=c^2` }),
  N("py-hyp", "The legs of a right-angled triangle are 5 and 12. How long is the hypotenuse?", ex(Math.hypot(5, 12)), "25 + 144 = 169 and √169 = 13.", { t: "js", f: "Math.sqrt(5*5+12*12)" }),
  Q("py-triple", "Which number completes the right-angled triple 20, 21, ?", "29", ["28", "30", "41"], "20² + 21² = 400 + 441 = 841 = 29². The other usual triples are 3-4-5, 5-12-13, 8-15-17 and 7-24-25.", { t: "pred", p: "v=>20*20+21*21===v*v" }),
  G("py-set", "One leg is 6. Slide the other leg b until the hypotenuse is exactly 10.",
    { kind: "plot", eq: true, bare: true, win: [-1, 9, -1, 10], polys: [{ pts: [[0, 0], [6, 0], [6, "b"]], k: "a" }], lines: [{ a: [0, 0], b: [6, "b"], k: "b" }], params: { b: { min: 1, max: 10, step: 0.5, v: 3, label: "b" } }, read: [["hypotenuse", "sqrt(36+b^2)", 2]], goal: { p: { b: 8 }, tol: 0.01 }, alt: "triangle with a sliding leg" },
    "b = 8: 36 + 64 = 100. A 6-8-10 triangle is twice 3-4-5.", { t: "goal", eqs: [["sqrt(36+b^2)", 10]] }),
]);

// ---------- area and volume ----------
const volumes = lesson("volumes", "Area, volume", [
  P("A circle of radius r has area πr² and circumference 2πr. A sector is the fraction (angle ÷ 360°) of the circle. A prism or cylinder has volume (area of the end) × (length).",
    { kind: "formula", tex: [tx`A=\pi r^2\qquad C=2\pi r`, tx`\text{sector}=\frac{\theta}{360}\pi r^2`, tx`\text{cylinder}=\pi r^2 h`] }),
  N("vol-sector", "A sector of a circle of radius 10 has an angle of 72°. What is its area, to 3 significant figures?", ex(Number((72 / 360 * Math.PI * 100).toPrecision(3))), "72/360 = 1/5 of the circle: π × 100 ÷ 5 = 62.8.", { t: "js", f: "72/360*Math.PI*100" }, { tol: 0.05 }),
  N("vol-tank", "A cylindrical storage tank has a radius of 12 m and is filled to a height of 20 m. How many cubic metres does it hold, to the nearest 10?", ex(Math.round(Math.PI * 144 * 20 / 10) * 10), "π × 12² × 20 = π × 2880 ≈ 9048 m³, which is 9050 to the nearest ten.", { t: "js", f: "Math.PI*144*20" }, { tol: 5 }),
  Q("vol-sphere", "The volume of a sphere of radius r is 4πr³/3. A sphere's radius is doubled. By what factor does its volume grow?", "8", ["2", "4", "6"], "Volume scales with the cube of length: 2³ = 8. Area would grow by 2² = 4.", { t: "js", f: "(4/3*Math.PI*8)/(4/3*Math.PI*1)" }),
]);

// ---------- similarity ----------
const similar = lesson("similar", "Scale factors", [
  P("Two shapes are similar when one is the other scaled. If lengths scale by k, then areas scale by k² and volumes by k³: a model at 1 : 50 holds 1/50² of the floor and 1/50³ of the tank.",
    { kind: "formula", tex: [tx`\text{length}\times k`, tx`\text{area}\times k^2`, tx`\text{volume}\times k^3`] }),
  N("sim-model", "A model of a storage tank is built to a scale of 1 : 50. The model holds 2 litres. How many litres does the real tank hold?", ex(2 * 50 ** 3), "Volumes scale by 50³ = 125 000, so the tank holds 250 000 litres.", { t: "js", f: "2*50*50*50" }),
  Q("sim-area", "Two similar tankers have areas of deck in the ratio 9 : 16. What is the ratio of their lengths?", "3/4", ["9/16", "81/256", "3/2"], "Areas scale as the square of lengths, so lengths scale as the square root: √9 : √16 = 3 : 4.", { t: "js", f: "Math.sqrt(9/16)" }),
  Q("sim-vol", "Two similar drums have lengths in the ratio 2 : 3. What is the ratio of their volumes?", "8/27", ["4/9", "2/3", "6/9"], "Volumes scale as the cube: 2³ : 3³ = 8 : 27.", { t: "js", f: "(2/3)**3" }),
]);

// ---------- circle theorems ----------
const A_DEG = 220, B_DEG = 320, C_DEG = 90, central = B_DEG - A_DEG;
const onCircle = d => [Math.cos(R(d)), Math.sin(R(d))];
const circleFig = { kind: "plot", eq: true, bare: true, win: [-1.3, 1.3, -1.3, 1.3], alt: "circle with a chord",
  circs: [{ c: [0, 0], r: 1, k: "c" }],
  lines: [{ a: [0, 0], b: onCircle(A_DEG), k: "b" }, { a: [0, 0], b: onCircle(B_DEG), k: "b" }, { a: onCircle(C_DEG), b: onCircle(A_DEG), k: "a" }, { a: onCircle(C_DEG), b: onCircle(B_DEG), k: "a" }],
  pts: [{ p: [0, 0], k: "b", label: "O" }, { p: onCircle(A_DEG), k: "a", label: "A" }, { p: onCircle(B_DEG), k: "a", label: "B" }, { p: onCircle(C_DEG), k: "a", label: "C" }] };
const angleAt = (c, a, b) => { const u = [a[0] - c[0], a[1] - c[1]], v = [b[0] - c[0], b[1] - c[1]]; return K.deg(Math.acos(K.dot(u, v) / (K.norm(u) * K.norm(v)))); };
const circles = lesson("circles", "Circle theorems", [
  P(`The angle a chord makes at the centre is twice the angle it makes anywhere on the long arc. Here the chord AB makes ${central}° at the centre O.`, { ...circleFig, tex: tx`\angle AOB=2\times\angle ACB` }),
  N("circ-inscribed", `The angle AOB at the centre is ${central}°. What is the angle ACB at the circumference, in degrees?`, ex(central / 2), `Half: ${central / 2}°. The angle at the centre is twice the angle at the edge, standing on the same arc.`, { t: "js", f: `(()=>{const p=d=>[Math.cos(d*Math.PI/180),Math.sin(d*Math.PI/180)],C=p(${C_DEG}),A=p(${A_DEG}),B=p(${B_DEG}),u=[A[0]-C[0],A[1]-C[1]],v=[B[0]-C[0],B[1]-C[1]];return Math.acos((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))*180/Math.PI})()` }, { tol: 1e-6 }),
  Q("circ-semi", "AB is a diameter and C is a point on the circle. What is the angle ACB?", "90", ["45", "60", "180"], "The angle at the centre is 180° (a straight line), so the angle at the edge is half: 90°. Any triangle with a diameter as one side is right-angled.", { t: "js", f: "180/2" }),
  Q("circ-tangent", "A tangent touches a circle at T, and O is the centre. What is the angle between the tangent and the radius OT?", "90", ["45", "60", "180"], "A tangent is perpendicular to the radius at the point where it touches.", { t: "js", f: "90" }),
]);

// ---------- circles in coordinates ----------
const coordCircle = lesson("coordcircle", "Circles on a grid", [
  G("cc-set", "A circle with centre (a, b) and radius r is (x − a)² + (y − b)² = r². Move it to have centre (2, 1) and radius 3.",
    { kind: "plot", eq: true, win: [-5, 8, -5, 6], circs: [{ c: ["a", "b"], r: "r", k: "a" }], pts: [{ p: ["a", "b"], k: "a" }], params: { a: { min: -3, max: 5, step: 1, v: 0, label: "a" }, b: { min: -3, max: 4, step: 1, v: 0, label: "b" }, r: { min: 1, max: 5, step: 1, v: 1, label: "r" } }, goal: { p: { a: 2, b: 1, r: 3 }, tol: 0.01 }, alt: "circle on a grid" },
    "(x − 2)² + (y − 1)² = 9. Note the signs: the centre is where each bracket is zero.", { t: "goal", eqs: [["(2-a)^2+(1-b)^2", 0], ["r^2", 9]] }),
  N("cc-radius", "A circle is x² + y² − 6x + 4y − 12 = 0. What is its radius?", ex(Math.sqrt(9 + 4 + 12)), "Complete the squares: (x − 3)² + (y + 2)² = 12 + 9 + 4 = 25, so the centre is (3, −2) and r = 5.", { t: "js", f: "Math.sqrt(12+3*3+2*2)" }),
  Q("cc-inside", "Is the point (4, 5) inside, on or outside the circle (x − 1)² + (y − 1)² = 25?", "~On the circle", ["~Inside it", "~Outside it", "~It cannot be said"], "Its distance from the centre (1, 1) is √(3² + 4²) = 5, equal to the radius, so the point lies on the circle.", { t: "words" }),
]);

export const GEOMETRY = chapter("geometry", "Geometry", [pythagoras, volumes, similar, circles, coordCircle]);

// ---------- right-angled trigonometry ----------
const sohcahtoa = lesson("sohcahtoa", "Right triangles", [
  P("In a right-angled triangle, with an angle θ: sin θ = opposite ÷ hypotenuse, cos θ = adjacent ÷ hypotenuse, tan θ = opposite ÷ adjacent. Set the angle and read the three off the triangle.",
    { kind: "plot", eq: true, bare: true, win: [-0.3, 1.3, -0.3, 1.1], polys: [{ pts: [[0, 0], ["cos(t*pi/180)", 0], ["cos(t*pi/180)", "sin(t*pi/180)"]], k: "a" }], lines: [{ a: [0, 0], b: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "b" }], params: { t: { min: 5, max: 85, step: 1, v: 35, label: "θ°" } }, read: [["sin", "sin(t*pi/180)", 3], ["cos", "cos(t*pi/180)", 3], ["tan", "tan(t*pi/180)", 3]], tex: tx`\sin\theta=\tfrac{\text{opp}}{\text{hyp}}\quad \cos\theta=\tfrac{\text{adj}}{\text{hyp}}\quad \tan\theta=\tfrac{\text{opp}}{\text{adj}}`, alt: "triangle with a sliding angle" }),
  G("sc-tan", "Set the angle so that tan θ is 0.75 (the 3-4-5 triangle's angle).",
    { kind: "plot", eq: true, bare: true, win: [-0.3, 1.3, -0.3, 1.1], polys: [{ pts: [[0, 0], ["cos(t*pi/180)", 0], ["cos(t*pi/180)", "sin(t*pi/180)"]], k: "a" }], params: { t: { min: 5, max: 85, step: 1, v: 20, label: "θ°" } }, read: [["tan θ", "tan(t*pi/180)", 3]], goal: { e: "tan(t*pi/180)", v: 0.75, tol: 0.01 }, alt: "triangle with a sliding angle" },
    "θ ≈ 36.9°: tan θ = 3/4, so sin θ = 3/5 and cos θ = 4/5.", { t: "goal-e" }),
  N("sc-ladder", "A 5 m ladder leans against a wall at 70° to the ground. How high up the wall does it reach, in metres to 3 significant figures?", ex(Number((5 * Math.sin(R(70))).toPrecision(3))), "The height is opposite the angle and the ladder is the hypotenuse: 5 sin 70° = 4.70 m.", { t: "js", f: "5*Math.sin(70*Math.PI/180)" }, { tol: 0.005 }),
  Q("sc-sin", "If tan θ = 3/4 and θ is acute, what is sin θ?", "3/5", ["3/4", "4/5", "5/3"], "Draw the triangle with opposite 3 and adjacent 4: the hypotenuse is 5, so sin θ = 3/5.", { t: "js", f: "Math.sin(Math.atan(3/4))" }),
]);

// ---------- sine and cosine rules ----------
const SC = { a: 7, b: 9, C: 60 }, cside = Math.sqrt(SC.a ** 2 + SC.b ** 2 - 2 * SC.a * SC.b * Math.cos(R(SC.C)));
const rules = lesson("rules", "Sine, cosine rules", [
  P("For any triangle, with sides a, b, c opposite the angles A, B, C: the cosine rule finds a side from two sides and the angle between them; the sine rule links each side to the sine of the opposite angle; the area is half the product of two sides and the sine of the angle between.",
    { kind: "formula", tex: [tx`c^2=a^2+b^2-2ab\cos C`, tx`\frac{a}{\sin A}=\frac{b}{\sin B}=\frac{c}{\sin C}`, tx`\text{area}=\tfrac12ab\sin C`] }),
  N("rule-cos", `Two sides of a triangle are ${SC.a} and ${SC.b}, with ${SC.C}° between them. How long is the third side, to 3 significant figures?`, ex(Number(cside.toPrecision(3))), `c² = 49 + 81 − 2 × 7 × 9 × cos 60° = 130 − 63 = 67, so c = 8.19.`, { t: "js", f: "Math.sqrt(7*7+9*9-2*7*9*Math.cos(60*Math.PI/180))" }, { tol: 0.005 }),
  N("rule-area", `What is the area of that triangle, to 3 significant figures?`, ex(Number((0.5 * 7 * 9 * Math.sin(R(60))).toPrecision(3))), "½ × 7 × 9 × sin 60° = 31.5 × 0.866 = 27.3.", { t: "js", f: "0.5*7*9*Math.sin(60*Math.PI/180)" }, { tol: 0.005 }),
  G("rule-set", "Sides 7 and 9 meet at the angle γ. Find the angle for which the third side is exactly 10.",
    { kind: "plot", eq: true, bare: true, win: [-1, 8, -1, 10], polys: [{ pts: [[0, 0], [7, 0], ["9*cos(g*pi/180)", "9*sin(g*pi/180)"]], k: "a" }], params: { g: { min: 30, max: 130, step: 1, v: 50, label: "γ°" } }, read: [["third side", "sqrt(130-126*cos(g*pi/180))", 2]], goal: { e: "sqrt(130-126*cos(g*pi/180))", v: 10, tol: 0.06 }, alt: "triangle with two fixed sides" },
    "γ ≈ 76°: 130 − 126 cos γ = 100 gives cos γ = 30/126. A bigger angle opens the triangle wider and lengthens the third side.", { t: "goal-e" }),
  Q("rule-sine", "In a triangle, angle A = 30°, angle B = 45° and the side opposite A is 8. How long is the side opposite B?", "8*sqrt(2)", ["8", "4*sqrt(2)", "16"], "Sine rule: b = 8 × sin 45° ÷ sin 30° = 8 × (√2/2) ÷ (1/2) = 8√2 ≈ 11.3.", { t: "js", f: "8*Math.sin(Math.PI/4)/Math.sin(Math.PI/6)" }),
]);

// ---------- radians and the unit circle ----------
const unit = lesson("unit", "Unit circle", [
  P("A radian measures an angle by the length of the arc it cuts on a circle of radius 1: a full turn is 2π radians, so 180° is π. On the unit circle, the point at angle θ is (cos θ, sin θ), and tan θ is the slope of the line to it. Turn the angle.",
    { kind: "plot", eq: true, win: [-1.6, 1.6, -1.3, 1.3], circs: [{ c: [0, 0], r: 1, k: "c" }], lines: [{ a: [0, 0], b: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "a" }, { a: ["cos(t*pi/180)", 0], b: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "d" }], pts: [{ p: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "a" }], params: { t: { min: 0, max: 360, step: 5, v: 30, label: "θ°" } }, read: [["θ (rad)", "t*pi/180", 3], ["cos", "cos(t*pi/180)", 3], ["sin", "sin(t*pi/180)", 3]], alt: "unit circle" }),
  G("uc-cos", "Turn the angle to a place where cos θ = −0.5 (either of the two).",
    { kind: "plot", eq: true, win: [-1.6, 1.6, -1.3, 1.3], circs: [{ c: [0, 0], r: 1, k: "c" }], lines: [{ a: [0, 0], b: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "a" }, { a: [-0.5, -2], b: [-0.5, 2], k: "d" }], pts: [{ p: ["cos(t*pi/180)", "sin(t*pi/180)"], k: "a" }], params: { t: { min: 0, max: 360, step: 5, v: 30, label: "θ°" } }, read: [["cos", "cos(t*pi/180)", 3]], goal: { e: "cos(t*pi/180)", v: -0.5, tol: 0.005 }, alt: "unit circle" },
    "θ = 120° or 240°: the points at x = −½, one above the axis and one below. Both are 60° from the negative x-axis.", { t: "goal-e" }),
  N("uc-rad", "What is 150° in radians, as a multiple of π? Type the fraction.", "5/6", "150° = 150/180 of π = 5π/6.", { t: "js", f: "150/180" }),
  N("uc-arc", "An arc of a circle of radius 8 subtends an angle of 0.75 radians at the centre. How long is the arc?", ex(8 * 0.75), "Arc length is rθ when θ is in radians: 8 × 0.75 = 6.", { t: "js", f: "8*0.75" }),
  Q("uc-exact", "What is sin(π/3)?", "sqrt(3)/2", ["1/2", "sqrt(2)/2", "1"], "π/3 is 60°. The point on the unit circle at 60° is (½, √3/2), and its height is sin: √3/2 ≈ 0.866.", { t: "js", f: "Math.sin(Math.PI/3)" }),
]);

// ---------- graphs of sine and cosine ----------
const waves = lesson("waves", "Trig graphs", [
  P("The graph y = a sin(bx) + d oscillates between d − a and d + a: a is the amplitude. It repeats every 2π ÷ b: that is the period. Change them and watch.",
    { kind: "plot", pi: true, win: [-0.5, 6.8, -4, 4], fns: [{ e: "a*sin(b*x)+d" }], params: { a: { min: 1, max: 3, step: 0.5, v: 1, label: "a" }, b: { min: 1, max: 4, step: 1, v: 1, label: "b" }, d: { min: -2, max: 2, step: 1, v: 0, label: "d" } }, read: [["amplitude", "a", 1], ["period (rad)", "2*pi/b", 2]], alt: "sine wave" }),
  G("wv-fit", "Make the wave reach 3 at its top, and complete a cycle by x = π (period π).",
    { kind: "plot", pi: true, win: [-0.5, 6.8, -4, 4], fns: [{ e: "a*sin(b*x)" }], pts: [{ p: ["pi/4", 3], k: "b", label: "top" }], params: { a: { min: 1, max: 4, step: 0.5, v: 1, label: "a" }, b: { min: 1, max: 4, step: 1, v: 1, label: "b" } }, goal: { p: { a: 3, b: 2 }, tol: 0.01 }, alt: "sine wave" },
    "a = 3 gives the height; b = 2 gives period 2π/2 = π, and the first peak is at x = π/4.", { t: "goal", eqs: [["a*sin(b*pi/4)", 3]] }),
  Q("wv-period", "What is the period of y = sin(3x)?", "2*pi/3", ["2*pi*3", "pi/3", "3"], "The sine repeats when 3x has gone through 2π, that is when x has gone through 2π/3.", { t: "js", f: "(()=>{const f=x=>Math.sin(3*x);for(let p=0.01;p<10;p+=0.0001)if(Math.abs(f(0.3+p)-f(0.3))<1e-3&&Math.abs(f(1+p)-f(1))<1e-3)return p})()", tol: 1e-3 }),
  N("wv-max", "What is the greatest value of 4 cos x − 1?", ex(3), "cos x never exceeds 1, so 4 cos x − 1 never exceeds 3 (and its least value is −5).", { t: "js", f: "Math.max(...Array.from({length:7000},(_,i)=>4*Math.cos(i/1000)-1))", tol: 1e-6 }, { tol: 1e-6 }),
]);

// ---------- identities and equations ----------
const identities = lesson("identities", "Identities", [
  P("Some trig equalities hold for every angle: sin²x + cos²x = 1 (Pythagoras on the unit circle), tan x = sin x ÷ cos x. Use them to simplify, and to solve equations by writing everything in one function.",
    { kind: "formula", tex: [tx`\sin^2x+\cos^2x=1`, tx`\tan x=\frac{\sin x}{\cos x}`] }),
  Q("id-simplify", "Simplify (1 − cos²x) ÷ sin x.", "sin(x)", ["cos(x)", "1/sin(x)", "tan(x)"], "1 − cos²x = sin²x, and sin²x ÷ sin x = sin x.", { t: "ident", f: "(1-cos(x)^2)/sin(x)" }),
  Q("id-solve", "Solve 2 sin x = 1 for x between 0 and 2π.", ["pi/6", "5*pi/6"], [["pi/6", "11*pi/6"], ["pi/3", "2*pi/3"], ["pi/6"]], "sin x = ½ at π/6, and again at π − π/6 = 5π/6, since sine is positive in the first two quarters.", { t: "roots", f: "2*sin(x)-1", n: 2, dom: [0, "2*Math.PI-1e-9"] }),
  N("id-cos", "Solve cos x = 0.3 for the smallest positive x in radians, to 3 decimal places.", ex(Number(Math.acos(0.3).toFixed(3))), "x = cos⁻¹ 0.3 = 1.266 (calculator in radian mode). The next solutions are 2π − 1.266 and 2π + 1.266.", { t: "js", f: "Math.acos(0.3)" }, { tol: 0.0006 }),
  Q("id-double", "Which expression equals sin 2x?", "2*sin(x)*cos(x)", ["2*sin(x)", "sin(x)^2", "sin(x)+cos(x)"], "The double-angle formula: sin 2x = 2 sin x cos x. Check at x = π/6: sin(π/3) = √3/2 and 2 × ½ × √3/2 = √3/2.", { t: "ident", f: "sin(2*x)" }),
  Q("id-75", "What is the exact value of sin 75°? (Use sin(45° + 30°).)", "(sqrt(6)+sqrt(2))/4", ["sqrt(3)/2", "(sqrt(6)-sqrt(2))/4", "3/4"], "sin 45° cos 30° + cos 45° sin 30° = (√2/2)(√3/2) + (√2/2)(1/2) = (√6 + √2)/4 ≈ 0.966.", { t: "js", f: "Math.sin(75*Math.PI/180)" }),
], "HL");

export const TRIG = chapter("trig", "Trigonometry", [sohcahtoa, rules, unit, waves, identities]);
