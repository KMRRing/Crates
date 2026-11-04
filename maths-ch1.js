// Maths, chapter 1: Number (GCSE). Every figure a lesson states is made here from maths-math.js; tests/maths.mjs recomputes it.
import * as K from "./maths-math.js";
import { P, Q, N, G, ex, ftex, chapter, lesson } from "./maths-kit.js";

const F = K.frac, T = K.ftext, tx = String.raw;

// ---------- fractions ----------
const A = F(1, 4), Bf = F(2, 3), L = K.lcm(A.d, Bf.d), SUM = K.fadd(A, Bf);
const DIV = { a: F(2, 3), b: F(4, 9) }, DIVR = K.fdiv(DIV.a, DIV.b);
const fractions = lesson("fractions", "Fractions", [
  P("A fraction is a number of equal parts out of a whole. To add or subtract, first give both the same bottom number (the denominator): quarters and thirds both become twelfths.",
    { kind: "formula", tex: tx`${ftex(A)}+${ftex(Bf)}=\frac{${A.n * L / A.d}}{${L}}+\frac{${Bf.n * L / Bf.d}}{${L}}=${ftex(SUM)}`, note: "Add the tops only: the bottoms are the size of the piece, and they now match." }),
  Q("frac-add", "What is 3/5 + 1/4?", T(K.fadd(F(3, 5), F(1, 4))), ["4/9", "1/5", "7/20"],
    "Twentieths: 3/5 = 12/20 and 1/4 = 5/20, so 17/20. Adding the tops and the bottoms (4/9) is the classic slip: it can never be right, because 4/9 is smaller than 3/5.", { t: "js", f: "3/5+1/4" }),
  P("To divide by a fraction, turn it upside down and multiply: how many 4/9s fit into 2/3? The same as 2/3 × 9/4.",
    { kind: "formula", tex: tx`${ftex(DIV.a)}\div${ftex(DIV.b)}=${ftex(DIV.a)}\times${ftex(F(DIV.b.d, DIV.b.n))}=${ftex(DIVR)}` }),
  Q("frac-div", "What is 3/4 ÷ 9/10?", T(K.fdiv(F(3, 4), F(9, 10))), ["27/40", "6/5", "3/10"],
    "3/4 × 10/9 = 30/36 = 5/6. 27/40 is what you get by multiplying without turning the second fraction over.", { t: "js", f: "(3/4)/(9/10)" }),
  N("frac-of", "A cargo of 90 thousand tonnes is 5/6 loaded. How many thousand tonnes are aboard?", ex(90 * 5 / 6), "90 ÷ 6 = 15 for one sixth, and five of them make 75.", { t: "js", f: "90*5/6" }),
  Q("frac-mixed", "What is 2½ × 1⅕?", "3", ["21/10", "31/10", "7/2"],
    "Turn both into improper fractions: 5/2 × 6/5 = 30/10 = 3. Multiplying the whole parts and the fractions separately (2×1 + ½×⅕) leaves out the cross terms.", { t: "js", f: "2.5*1.2" }),
]);

// ---------- ratio and percentages ----------
const SHARE = { total: 450, parts: [2, 3, 4] }, PARTS = SHARE.parts.reduce((s, p) => s + p, 0);
const UP = 1.2, DOWN = 0.8, NET = Math.round((UP * DOWN - 1) * 100);
const ratio = lesson("ratio", "Ratio and percent", [
  P("A ratio splits a total into parts: add the parts, find what one part is worth, then multiply. Share 450 in the ratio 2 : 3 : 4.",
    { kind: "rows", rows: [["Parts in all", `$${SHARE.parts.join("+")}=${PARTS}$`], ["One part", `$${SHARE.total}\\div${PARTS}=${SHARE.total / PARTS}$`], ["The shares", `$${SHARE.parts.map(p => p * SHARE.total / PARTS).join(",\\ ")}$`]] }),
  N("ratio-small", "Split 450 in the ratio 3 : 4 : 8. How much is the smallest share?", ex(450 * 3 / 15), "3 + 4 + 8 = 15 parts, one part is 450 ÷ 15 = 30, and the smallest share is 3 parts: 90.", { t: "js", f: "450/(3+4+8)*3" }),
  P("A percentage change is a multiplier: a 15% rise multiplies by 1.15, a 15% fall by 0.85. Changes in a row multiply, they do not add.",
    { kind: "formula", tex: tx`\text{after a rise of }20\%\text{ then a fall of }20\%:\ \ ${UP}\times${DOWN}=${K.nm(UP * DOWN, 2)}` }),
  Q("pc-net", "A price rises 20% and then falls 20%. What is the net change, in percent?", String(NET), ["0", "4", "-2"],
    "1.2 × 0.8 = 0.96, so the price ends 4% below where it started. The fall is taken from a larger number than the rise was added to.", { t: "js", f: "(1.2*0.8-1)*100" }),
  N("pc-reverse", "After a 20% rise a price is 90. What was the price before the rise?", ex(90 / 1.2), "The 90 is 120% of the old price: 90 ÷ 1.2 = 75. Taking 20% off 90 (72) is the usual wrong turn.", { t: "js", f: "90/1.2" }),
  G("pc-double", "Money grows by r% a year, compounded: after t years 1000 becomes 1000 × (1 + r/100)ᵗ. Set r so that it just doubles in 10 years.",
    { kind: "plot", win: [0, 20, 0, 4000], fns: [{ e: "1000*(1+r/100)^x" }], params: { r: { min: 1, max: 15, step: 0.1, v: 3, label: "r %" } }, read: [["after 10 years", "1000*(1+r/100)^10", 0]], goal: { e: "(1+r/100)^10", v: 2, tol: 0.03, miss: "Look at the value after 10 years: it should be 2000." }, alt: "growth curve" },
    "About 7.2%: 1.072¹⁰ ≈ 2. The rule of 72 says the doubling time in years is about 72 ÷ the rate.", { t: "goal-e" }),
  N("pc-compound", "2,000 is invested at 3% a year, compounded. What is it worth after 5 years, to the nearest penny?", ex(Math.round(2000 * 1.03 ** 5 * 100) / 100), "2000 × 1.03⁵ = 2318.55. Simple interest (5 × 60 = 300) would give 2300: the extra is interest earned on interest.", { t: "js", f: "2000*Math.pow(1.03,5)" }, { tol: 0.006 }),
]);

// ---------- powers and roots ----------
const powers = lesson("powers", "Powers and roots", [
  P("A power counts repeated multiplication, and the rules follow from counting: add the powers when you multiply, subtract when you divide, multiply them when you raise a power to a power. A negative power is a reciprocal, and a power 1/n is an n-th root.",
    { kind: "formula", tex: tx`a^m a^n=a^{m+n},\quad \frac{a^m}{a^n}=a^{m-n},\quad (a^m)^n=a^{mn},\quad a^{-n}=\frac1{a^n},\quad a^{1/n}=\sqrt[n]{a}`, note: "And a⁰ = 1: it is aᵐ ÷ aᵐ." }),
  Q("pow-mul", "What is 2⁵ × 2⁻²?", "8", ["128", "1/1024", "16"], "Add the powers: 2³ = 8. Check: 32 × ¼ = 8.", { t: "js", f: "Math.pow(2,5)*Math.pow(2,-2)" }),
  N("pow-frac", "Work out 16 to the power ¾.", ex(16 ** 0.75), "16^(3/4) = (16^(1/4))³ = 2³ = 8: take the root first, it keeps the numbers small.", { t: "js", f: "Math.pow(16,0.75)" }),
  Q("pow-simplify", "Simplify (x³)² × x⁻⁴.", "x^2", ["x^10", "x^(-2)", "x^5"], "(x³)² = x⁶, and x⁶ × x⁻⁴ = x².", { t: "ident", f: "(x^3)^2*x^(-4)" }),
  G("pow-curve", "The curve y = aˣ always passes through (0, 1). Set a so that it also passes through the marked point (3, 8).",
    { kind: "plot", win: [-1, 4, -1, 10], fns: [{ e: "a^x" }], pts: [{ p: [3, 8], k: "b", label: "(3, 8)" }], params: { a: { min: 0.5, max: 4, step: 0.05, v: 1.5, label: "a" } }, goal: { p: { a: 2 }, tol: 0.03 }, alt: "exponential curve" },
    "a = 2: 2³ = 8. The same curve passes through (1, 2), (2, 4), (4, 16).", { t: "goal", eqs: [["a^3", 8]] }),
]);

// ---------- standard form and surds ----------
const standard = lesson("standard", "Standard form, surds", [
  P("Standard form writes a number as A × 10ⁿ with A at least 1 and below 10: it makes very large and very small figures readable.",
    { kind: "formula", tex: tx`45\,000\,000=4.5\times10^{7}\qquad 0.00032=3.2\times10^{-4}`, note: "Count how far the point moves; moving left makes the power positive." }),
  Q("std-mul", "What is (3 × 10⁴) × (2 × 10⁵)?", "6*10^9", ["6*10^20", "5*10^9", "6*10^8"], "Multiply the numbers (3 × 2 = 6) and add the powers (4 + 5 = 9).", { t: "js", f: "3e4*2e5" }),
  N("std-ratio", "How many times larger is 3.2 × 10⁶ than 8 × 10³?", "400", "3.2 ÷ 8 = 0.4 and 10⁶ ÷ 10³ = 10³, so 0.4 × 1000 = 400.", { t: "js", f: "3.2e6/8e3" }),
  P("A surd is a root that does not come out exactly, like √2. Keep it exact: √72 = √36 × √2 = 6√2, taking out the biggest square factor.",
    { kind: "formula", tex: tx`\sqrt{72}=\sqrt{36\times2}=6\sqrt2\qquad \frac{6}{\sqrt3}=\frac{6\sqrt3}{3}=2\sqrt3`, note: "To clear a surd from the bottom, multiply top and bottom by it." }),
  Q("surd-simplify", "Simplify √72.", "6*sqrt(2)", ["6*sqrt(3)", "9*sqrt(2)", "8*sqrt(3)"], "72 = 36 × 2 and √36 = 6, so √72 = 6√2 ≈ 8.485.", { t: "js", f: "Math.sqrt(72)" }),
  Q("surd-rationalise", "Rationalise 6/√3 (no root in the bottom).", "2*sqrt(3)", ["3*sqrt(2)", "6*sqrt(3)", "sqrt(3)/2"], "Multiply top and bottom by √3: 6√3/3 = 2√3 ≈ 3.464.", { t: "js", f: "6/Math.sqrt(3)" }),
]);

// ---------- primes, HCF and LCM ----------
const primes = lesson("primes", "Primes, HCF, LCM", [
  P(`Every whole number above 1 is a product of primes in exactly one way. 84 = ${K.factorText(84)} and 126 = ${K.factorText(126)}. The highest common factor (HCF) takes the lowest power of each shared prime; the lowest common multiple (LCM) takes the highest of every prime.`,
    { kind: "rows", rows: [["$84$", `$${K.factorise(84).map(([p, e]) => `${p}^{${e}}`).join("\\times")}$`], ["$126$", `$${K.factorise(126).map(([p, e]) => `${p}^{${e}}`).join("\\times")}$`], ["HCF", `$${K.gcd(84, 126)}$`], ["LCM", `$${K.lcm(84, 126)}$`]] }),
  Q("hcf", "What is the HCF of 90 and 144?", String(K.gcd(90, 144)), ["6", "36", "72"], "90 = 2 × 3² × 5 and 144 = 2⁴ × 3², so the HCF is 2 × 3² = 18.", { t: "js", f: "(()=>{let g=0;for(let k=1;k<=90;k++)if(90%k==0&&144%k==0)g=k;return g})()" }),
  N("lcm-ships", "Two tankers load at a terminal every 8 days and every 12 days, and both are loading today. After how many days do they next load on the same day?", String(K.lcm(8, 12)), "The LCM of 8 and 12: 8 = 2³ and 12 = 2² × 3, so 2³ × 3 = 24.", { t: "js", f: "(()=>{let k=1;while(k%8||k%12)k++;return k})()" }),
  Q("prime-which", "Which of these is prime?", "59", ["51", "57", "91"], "51 = 3 × 17, 57 = 3 × 19, 91 = 7 × 13. For 59 only primes up to 7 need testing (since 8² = 64 > 59), and none divides it.", { t: "pred", p: "v=>v>1&&[...Array(v).keys()].slice(2).every(k=>v%k)" }),
  N("prime-count", "How many primes are there below 30?", String([...Array(30).keys()].filter(K.isPrime).length), "2, 3, 5, 7, 11, 13, 17, 19, 23, 29: ten of them.", { t: "js", f: "[...Array(30).keys()].filter(v=>v>1&&[...Array(v).keys()].slice(2).every(k=>v%k)).length" }),
]);

export const NUMBER = chapter("number", "Number", [fractions, ratio, powers, standard, primes]);
