// Maths, chapters 11 to 13: Probability and statistics, Discrete maths, Differential equations.
import * as K from "./maths-math.js";
import { P, Q, N, G, ex, chapter, lesson } from "./maths-kit.js";

const tx = String.raw;
const r = (v, d) => Number(v.toFixed(d));

// ---------- counting ----------
const counting = lesson("counting", "Counting", [
  P("Counting without listing: an ordering of n things can be done in n! ways (n × (n−1) × … × 1). Choosing k of n, when order does not matter, is C(n, k) = n! ÷ (k!(n − k)!), because each chosen set is counted k! times among the orderings.",
    { kind: "formula", tex: [tx`n!=n(n-1)\cdots1`, tx`\binom nk=\frac{n!}{k!\,(n-k)!}`] }),
  N("co-arr", "In how many different orders can 5 books be put on a shelf?", ex(K.fact(5)), "5 × 4 × 3 × 2 × 1 = 120: five choices for the first place, four for the next, and so on.", { t: "js", f: "5*4*3*2*1" }),
  Q("co-choose", "A committee of 3 is chosen from 8 people. How many committees are possible?", ex(K.binom(8, 3)), [ex(K.perm(8, 3)), "24", ex(K.binom(8, 2) + 1)], "C(8, 3) = 8·7·6 ÷ 3! = 56. The 336 is for three different posts (order matters); dividing by 3! = 6 removes the repeats.", { t: "js", f: "8*7*6/6" }),
  N("co-pin", "A 4-digit PIN uses no digit twice. How many PINs are there?", ex(10 * 9 * 8 * 7), "10 × 9 × 8 × 7 = 5040: each position has one fewer digit left to use.", { t: "js", f: "10*9*8*7" }),
]);

// ---------- probability rules ----------
const rules = lesson("prules", "Probability rules", [
  P("Probability is a number from 0 to 1. For equally likely outcomes it is favourable ÷ total. Two events that do not affect each other are independent, and then P(A and B) = P(A)P(B). In general, P(A or B) = P(A) + P(B) − P(A and B), so the overlap is not counted twice.",
    { kind: "formula", tex: [tx`P(A\cup B)=P(A)+P(B)-P(A\cap B)`, tx`P(A\mid B)=\frac{P(A\cap B)}{P(B)}`] }),
  Q("pr-dice", "Two fair dice are thrown. What is the probability that the total is 7?", "1/6", ["1/12", "7/36", "1/7"], "Six of the 36 pairs make 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1). So 6/36 = 1/6.", { t: "js", f: "(()=>{let c=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a+b===7)c++;return c/36})()" }),
  N("pr-or", "A and B are independent, with P(A) = 0.4 and P(B) = 0.5. What is P(A or B)?", "0.7", "P(A and B) = 0.4 × 0.5 = 0.2, so P(A or B) = 0.4 + 0.5 − 0.2 = 0.7.", { t: "js", f: "0.4+0.5-0.4*0.5" }),
  N("pr-bayes", "1% of people have a condition. A test finds 95% of those who have it, and wrongly flags 10% of those who do not. Given a positive test, what is the probability of having it? To 3 decimal places.", ex(r(0.01 * 0.95 / (0.01 * 0.95 + 0.99 * 0.1), 3)), "Of 10 000 people, 95 true positives and 990 false ones: 95 ÷ 1085 = 0.088. A rare condition makes most positives false alarms.", { t: "js", f: "0.01*0.95/(0.01*0.95+0.99*0.10)" }, { tol: 0.0006 }),
], "SL to HL");

// ---------- distributions ----------
const dists = lesson("dists", "Binomial and Poisson", [
  P("Repeat n independent trials, each succeeding with probability p. The number of successes is binomial: P(X = k) = C(n, k)pᵏ(1 − p)ⁿ⁻ᵏ, with mean np and variance np(1 − p). For rare events at a steady average rate m, the Poisson law P(X = k) = e⁻ᵐmᵏ/k! fits.",
    { kind: "formula", tex: [tx`P(X=k)=\binom nk p^k(1-p)^{n-k}`, tx`P(X=k)=\frac{e^{-m}m^k}{k!}`] }),
  N("bi-pmf", "A coin lands heads with probability 0.3. In 10 tosses, what is the probability of exactly 3 heads? To 3 decimal places.", ex(r(K.binomPmf(10, 0.3, 3), 3)), "C(10, 3) × 0.3³ × 0.7⁷ = 120 × 0.027 × 0.0824 = 0.267.", { t: "js", f: "120*0.3**3*0.7**7" }, { tol: 0.0006 }),
  Q("bi-sd", "X is binomial with n = 20 and p = 0.25. What are its mean and standard deviation?", "~5 and 1.94", ["~5 and 3.75", "~5 and 2.5", "~4 and 1.94"], "Mean np = 5. Variance np(1 − p) = 3.75, and the standard deviation is its square root, 1.94.", { t: "words" }),
  N("po-zero", "A call centre gets 2 calls a minute on average. What is the probability of no calls in a given minute? To 3 decimal places.", ex(r(K.poissonPmf(2, 0), 3)), "e⁻² = 0.135, since m⁰/0! = 1.", { t: "js", f: "Math.exp(-2)" }, { tol: 0.0006 }),
], "HL");

// ---------- normal ----------
const NORMAL = { kind: "plot", win: [-4, 4, 0, 0.5], fns: [{ e: "exp(-x^2/2)/2.5066" }], shade: { a: "-b", b: "b" }, params: { b: { min: 0, max: 3.5, step: 0.05, v: 1, label: "±z" } } };
const normal = lesson("normal", "Normal distribution", [
  P("Many measurements pile up in a bell curve set by two numbers: the mean μ (the centre) and the standard deviation σ (the spread). Convert a value to a z-score, z = (x − μ)/σ, and every normal case becomes the standard one. Widen the shaded band and watch the area, the probability, grow.",
    { ...NORMAL, alt: "the standard normal curve" }),
  G("no-95", "Set the band ±z so that it holds 95% of the area (the readout shows the area as a decimal).",
    { ...NORMAL, goal: { e: "b", v: 1.96, tol: 0.06 }, alt: "the standard normal curve" },
    "95% lies within 1.96 standard deviations of the mean (often rounded to 2). Within 1σ is 68%, within 3σ is 99.7%.", { t: "goal-e" }),
  N("no-iq", "IQ scores have mean 100 and standard deviation 15. What fraction score above 130? To 3 decimal places.", ex(r(1 - K.normCdf(2), 3)), "z = (130 − 100)/15 = 2, and the area beyond 2 is 0.0228: about 1 in 44.", { t: "js", f: "(()=>{let s=0,h=1e-4;for(let x=2;x<10;x+=h)s+=Math.exp(-((x+h/2)**2)/2)*h;return s/Math.sqrt(2*Math.PI)})()" }, { tol: 0.0006 }),
  N("no-z", "A woman's height is 168 cm where the mean is 162 cm and the standard deviation 6 cm. What is her z-score?", "1", "z = (168 − 162) ÷ 6 = 1: one standard deviation above the mean.", { t: "js", f: "(168-162)/6" }),
], "HL");

// ---------- tests and regression ----------
const tests = lesson("tests", "Testing and fitting", [
  P("A hypothesis test asks: if nothing special were going on (the null hypothesis), how surprising is what we saw? The p-value is that probability; below a chosen level such as 5%, we reject the null. A regression line y = a + bx is the line that makes the squared vertical misses smallest.",
    { kind: "formula", tex: [tx`z=\frac{\bar x-\mu}{\sigma/\sqrt n}`, tx`b=\frac{\sum(x-\bar x)(y-\bar y)}{\sum(x-\bar x)^2}`] }),
  N("te-z", "A machine fills bags with mean 500 g and standard deviation 8 g. A sample of 16 bags averages 504 g. What is the z-statistic?", "2", "The standard error is 8/√16 = 2, and (504 − 500)/2 = 2. A z of 2 is just beyond the 1.96 cut-off for a two-sided 5% test.", { t: "js", f: "(504-500)/(8/Math.sqrt(16))" }),
  N("te-slope", "The points (1, 2), (2, 4), (3, 5), (4, 8) have a best-fit line y = a + bx. What is the slope b?", "1.9", "The means are x̄ = 2.5, ȳ = 4.75. Σ(x − x̄)(y − ȳ) = 9.5 and Σ(x − x̄)² = 5, so b = 1.9.", { t: "js", f: "(()=>{const x=[1,2,3,4],y=[2,4,5,8],mx=2.5,my=4.75;let s=0,t=0;for(let i=0;i<4;i++){s+=(x[i]-mx)*(y[i]-my);t+=(x[i]-mx)**2}return s/t})()" }),
  Q("te-corr", "A study finds that towns with more ice-cream sales have more drownings, with a strong correlation. What is the likeliest explanation?", "~Hot weather raises both", ["~Ice cream causes drowning", "~Drowning increases ice-cream sales", "~The correlation must be a calculation error"], "A hidden third factor (temperature) drives both. Correlation measures how two things move together, never why.", { t: "words" }),
], "HL");

export const PROB = chapter("prob", "Probability and statistics", [counting, rules, dists, normal, tests]);

// ---------- logic and sets ----------
const sets = lesson("sets", "Sets and logic", [
  P("A set is a collection; A ∪ B is everything in either, A ∩ B is what is in both. Counting a union must not count the overlap twice: |A ∪ B| = |A| + |B| − |A ∩ B|. 'If P then Q' is false only when P is true and Q false.",
    { kind: "formula", tex: [tx`|A\cup B|=|A|+|B|-|A\cap B|`, tx`\lnot(P\land Q)\equiv\lnot P\lor\lnot Q`] }),
  N("se-incl", "In a class, 20 students play football, 15 play chess, and 6 do both. How many play at least one?", "29", "20 + 15 − 6 = 29. Adding 20 + 15 counts the six who do both twice.", { t: "js", f: "20+15-6" }),
  Q("se-neg", "Which is the negation of 'every prime is odd'?", "~Some prime is even", ["~Every prime is even", "~No prime is odd", "~Some prime is odd"], "To deny 'all', one counterexample is enough. And one exists: 2 is prime and even.", { t: "words" }),
  N("se-sub", "How many subsets does a set of 6 elements have (counting the empty set and the whole set)?", "64", "Each element is in or out: 2 × 2 × 2 × 2 × 2 × 2 = 2⁶ = 64.", { t: "js", f: "2**6" }),
]);

// ---------- induction ----------
const induct = lesson("induction", "Proof by induction", [
  P("Induction proves a statement for every n = 1, 2, 3, … in two steps: it holds for n = 1 (the base), and if it holds for n = k it holds for n = k + 1 (the step). Like dominoes: the first falls, and each knocks over the next.",
    { kind: "formula", tex: [tx`1+3+5+\cdots+(2n-1)=n^2`], note: "Base: 1 = 1². Step: n² + (2n + 1) = (n + 1)²." }),
  N("in-odd", "What is the sum of the first 12 odd numbers 1 + 3 + 5 + …?", "144", "The sum of the first n odd numbers is n², so 12² = 144.", { t: "js", f: "(()=>{let s=0;for(let i=1;i<=12;i++)s+=2*i-1;return s})()" }),
  N("in-sum", "Using 1 + 2 + … + n = n(n + 1)/2, what is 1 + 2 + … + 100?", "5050", "100 × 101 ÷ 2 = 5050. (Gauss paired 1 with 100, 2 with 99 and so on: 50 pairs of 101.)", { t: "js", f: "(()=>{let s=0;for(let i=1;i<=100;i++)s+=i;return s})()" }),
  Q("in-step", "In an induction proof of 1 + 2 + … + n = n(n + 1)/2, what must the step show?", "~That k(k + 1)/2 + (k + 1) equals (k + 1)(k + 2)/2", ["~That the formula holds for every n at once", "~That the formula holds for n = 1", "~That k(k + 1)/2 + k equals (k + 1)(k + 2)/2"], "Assume the formula for k, add the next term k + 1 to both sides, and tidy the left to (k + 1)(k + 2)/2: the formula with k + 1 in place of k.", { t: "words" }),
], "HL");

// ---------- modular arithmetic ----------
const modular = lesson("modular", "Modular arithmetic", [
  P("Clock arithmetic: a ≡ b (mod m) means a and b leave the same remainder after dividing by m. You can add, subtract and multiply remainders, then reduce. It is the basis of check digits and of public-key cryptography.",
    { kind: "formula", tex: [tx`a\equiv b\pmod m\iff m\mid(a-b)`, tx`7\cdot9=63=2\cdot31+1\Rightarrow 7^{-1}\equiv9\pmod{31}`] }),
  N("mo-rem", "What is 7¹⁰⁰ mod 13? (Work with remainders as you go.)", ex((() => { let x = 1; for (let i = 0; i < 100; i++) x = (x * 7) % 13; return x; })()), "Powers of 7 mod 13 repeat with period 12 (Fermat: 7¹² ≡ 1), and 100 = 8 × 12 + 4, so 7¹⁰⁰ ≡ 7⁴ = 2401 = 184 × 13 + 9.", { t: "js", f: "(()=>{let x=1;for(let i=0;i<100;i++)x=(x*7)%13;return x})()" }),
  N("mo-inv", "Find the number x between 1 and 30 with 7x ≡ 1 (mod 31).", "9", "7 × 9 = 63 = 2 × 31 + 1. Such an inverse exists when the number and the modulus share no factor.", { t: "js", f: "(()=>{for(let x=1;x<31;x++)if((7*x)%31===1)return x})()" }),
  N("mo-isbn", "The last digit of a 10-digit ISBN makes 10a₁ + 9a₂ + … + 1a₁₀ a multiple of 11. For 0-306-40615-?, what is the missing last digit?", "2", "The first nine digits give 10·0 + 9·3 + 8·0 + 7·6 + 6·4 + 5·0 + 4·6 + 3·1 + 2·5 = 130, and 130 + ? must be a multiple of 11: 132, so ? = 2.", { t: "js", f: "(()=>{const d=[0,3,0,6,4,0,6,1,5];let s=0;d.forEach((v,i)=>s+=(10-i)*v);for(let c=0;c<10;c++)if((s+c)%11===0)return c})()" }),
], "Uni");

// ---------- graphs ----------
const graphs = lesson("graphs", "Graphs", [
  P("A graph is dots (vertices) joined by lines (edges). The degree of a vertex counts its edges, and every edge has two ends, so the degrees add up to twice the number of edges: the handshake lemma. A complete graph Kₙ joins every pair.",
    { kind: "formula", tex: [tx`\sum_v \deg(v)=2E`, tx`E(K_n)=\binom n2`] }),
  N("gr-k7", "How many edges does the complete graph on 7 vertices have?", ex(K.binom(7, 2)), "One edge for each pair: C(7, 2) = 7 × 6 ÷ 2 = 21.", { t: "js", f: "7*6/2" }),
  N("gr-deg", "A graph has 10 edges. What do its vertex degrees add up to?", "20", "Each edge has two ends, each adding 1 to a degree: 2 × 10 = 20. So the number of odd-degree vertices is always even.", { t: "js", f: "2*10" }),
  N("gr-tree", "A tree (connected, no cycles) on 12 vertices has how many edges?", "11", "A tree always has one edge fewer than vertices: join them one at a time, each new vertex needing one edge.", { t: "js", f: "12-1" }),
], "Uni");

// ---------- recurrences ----------
const recur = lesson("recur", "Recurrences", [
  P("A recurrence defines each term from earlier ones. Fibonacci: Fₙ = Fₙ₋₁ + Fₙ₋₂ with F₁ = F₂ = 1. For aₙ = r·aₙ₋₁ the answer is geometric, aₙ = a₀rⁿ. The ratio of successive Fibonacci numbers settles on the golden ratio, φ = (1 + √5)/2 ≈ 1.618.",
    { kind: "formula", tex: [tx`F_n=F_{n-1}+F_{n-2}`, tx`\lim_{n\to\infty}\frac{F_{n+1}}{F_n}=\frac{1+\sqrt5}{2}`] }),
  N("rc-fib", "What is F₁₀ for Fibonacci (1, 1, 2, 3, 5, …)?", "55", "1, 1, 2, 3, 5, 8, 13, 21, 34, 55.", { t: "js", f: "(()=>{let a=1,b=1;for(let i=3;i<=10;i++)[a,b]=[b,a+b];return b})()" }),
  N("rc-lin", "a₀ = 0 and aₙ = 2aₙ₋₁ + 1. What is a₁₀?", "1023", "The terms are 0, 1, 3, 7, 15, …: aₙ = 2ⁿ − 1, so a₁₀ = 1024 − 1 = 1023.", { t: "js", f: "(()=>{let a=0;for(let i=0;i<10;i++)a=2*a+1;return a})()" }),
  N("rc-phi", "To 3 decimal places, what is the ratio F₂₀ / F₁₉?", ex(r(6765 / 4181, 3)), "6765 ÷ 4181 = 1.618: already equal to φ to 3 places.", { t: "js", f: "(()=>{let a=1,b=1;for(let i=3;i<=20;i++)[a,b]=[b,a+b];return b/a})()" }, { tol: 0.0006 }),
], "Uni");

// ---------- proof by contradiction and the pigeonhole ----------
const contra = lesson("contra", "Contradiction", [
  P("To prove something by contradiction, assume it is false and follow the consequences until they clash with something known. The pigeonhole principle is the simplest tool: put more than n objects into n boxes and some box holds two.",
    { kind: "formula", tex: [tx`\sqrt2=\tfrac pq\ \text{in lowest terms}\;\Rightarrow\;p^2=2q^2\;\Rightarrow\;p,\,q\text{ both even}`], note: "Both even contradicts 'lowest terms', so √2 is irrational." }),
  N("ct-pig", "How many people must be in a room to be sure that two share a birth month?", "13", "There are 12 months (boxes). With 12 people, each could have a different one; the 13th must repeat.", { t: "js", f: "12+1" }),
  N("ct-socks", "A drawer holds many red, blue and green socks in the dark. What is the fewest you must pull out to be sure of a matching pair?", "4", "Three socks could be one of each colour. The fourth must match one of them.", { t: "js", f: "3+1" }),
  N("ct-sum", "Among any 5 whole numbers, two always have the same remainder on division by 4. How many different remainders are there (the boxes)?", "4", "The remainders are 0, 1, 2 and 3: four boxes for five numbers, so two numbers share a box.", { t: "js", f: "4" }),
  Q("ct-form", "To prove that there is no largest prime by contradiction, what do you assume first?", "~There is a largest prime p", ["~Every number is prime", "~There are infinitely many primes", "~The number of primes is odd"], "Assume a largest prime p, then show that p! + 1 has a prime factor larger than p (it is not divisible by anything up to p): a contradiction.", { t: "words" }),
], "HL");

// ---------- paths in graphs ----------
const paths = lesson("paths", "Paths and cycles", [
  P("A walk through a graph that uses every edge exactly once is an Euler trail. Euler (1736, the bridges of Königsberg) showed this is possible only if at most two vertices have odd degree. A path through every vertex once is a different question, much harder to answer.",
    { kind: "formula", tex: [tx`\#\{v:\deg v\text{ odd}\}\in\{0,2\}\iff\text{an Euler trail exists (connected graph)}`] }),
  Q("pa-bridges", "Königsberg's four land areas had degrees 3, 3, 3 and 5 (counting bridges). Could a walk cross every bridge exactly once?", "~No: four vertices have odd degree", ["~Yes: it needs only one odd vertex", "~Yes: every graph has such a walk", "~No: there are too many bridges"], "A trail needs 0 or 2 odd vertices, and here all four are odd. Euler's argument founded graph theory.", { t: "words" }),
  N("pa-bfs", "A, B, C, D, E are joined as A-B, A-C, B-D, C-D, D-E. What is the fewest edges on a path from A to E?", "3", "A-B-D-E (or A-C-D-E): three edges. Every route must pass through D.", { t: "js", f: "(()=>{const adj={A:'BC',B:'AD',C:'AD',D:'BCE',E:'D'};let d={A:0},q=['A'];while(q.length){const v=q.shift();for(const w of adj[v])if(!(w in d)){d[w]=d[v]+1;q.push(w)}}return d.E})()" }),
  N("pa-cyc", "How many different round trips (cycles, not counting direction or starting point) visit all 5 vertices of K₅ once each?", "12", "Fix the start and order the other four: 4! = 24 orders, and each cycle is counted twice (forwards and backwards): 24 ÷ 2 = 12.", { t: "js", f: "(4*3*2*1)/2" }),
], "Uni");

// ---------- planar graphs and colouring ----------
const planar = lesson("planar", "Planar graphs", [
  P("A graph is planar if it can be drawn on paper with no edges crossing. Euler's formula links the dots, lines and regions (faces, including the outside): V − E + F = 2. A map needs no more than four colours (a theorem proved only with a computer, 1976).",
    { kind: "formula", tex: [tx`V-E+F=2`], note: "A cube: 8 corners, 12 edges, 6 faces: 8 − 12 + 6 = 2." }),
  N("pl-faces", "A connected planar graph has 6 vertices and 10 edges. How many faces does it have, including the outside?", "6", "V − E + F = 2 gives F = 2 − 6 + 10 = 6.", { t: "js", f: "2-6+10" }),
  N("pl-dodec", "A dodecahedron has 20 vertices and 12 faces. How many edges?", "30", "E = V + F − 2 = 20 + 12 − 2 = 30.", { t: "js", f: "20+12-2" }),
  N("pl-col", "How many colours does the cycle on 5 vertices (a pentagon, each vertex joined to its two neighbours) need so that no neighbours share a colour?", "3", "Two colours alternate around an even cycle, but an odd one runs out on the last vertex: it needs a third.", { t: "js", f: "(()=>{const n=5;for(let k=1;k<=n;k++){const c=[];const go=i=>{if(i===n)return c[n-1]!==c[0]||n===1;for(let x=0;x<k;x++){if(i>0&&c[i-1]===x)continue;c[i]=x;if(go(i+1))return true}return false};if(go(0))return k}})()" }),
], "Uni");

export const DISCRETE = chapter("discrete", "Discrete maths", [sets, induct, contra, modular, graphs, paths, planar, recur]);

// ---------- differential equations ----------
const separable = lesson("separable", "Separable equations", [
  P("A differential equation relates a function to its derivative. If dy/dx = f(x)g(y), separate: put every y on one side, every x on the other, and integrate both. For dy/dx = ky the result is exponential growth or decay: y = y₀eᵏˣ.",
    { kind: "formula", tex: [tx`\frac{dy}{dx}=2xy\;\Rightarrow\;\int\frac{dy}{y}=\int2x\,dx\;\Rightarrow\;y=Ce^{x^2}`] }),
  N("sp-val", "dy/dx = 2xy with y(0) = 3. What is y(1)? To 2 decimal places.", ex(r(3 * Math.E, 2)), "y = Ce^(x²) and y(0) = C = 3, so y(1) = 3e = 8.15.", { t: "js", f: "3*Math.exp(1)" }, { tol: 0.006 }),
  N("sp-decay", "A drug decays by dy/dt = −0.2y. Starting from 100 mg, how much is left after 5 hours? To 1 decimal place.", ex(r(100 * Math.exp(-1), 1)), "y = 100e^(−0.2t), so at t = 5 it is 100e⁻¹ = 36.8 mg.", { t: "js", f: "100*Math.exp(-0.2*5)" }, { tol: 0.06 }),
  Q("sp-form", "Which function satisfies dy/dx = y with y(0) = 2?", "~y = 2eˣ", ["~y = e²ˣ", "~y = 2x", "~y = eˣ + 1"], "A function equal to its own derivative is a multiple of eˣ, and the starting value 2 sets the multiple.", { t: "words" }),
], "HL");

// ---------- linear first order ----------
const linear1 = lesson("linear1", "Linear first-order", [
  P("For dy/dx + y = 2 the solution settles. Try y = 2 + Ce⁻ˣ: the constant 2 is where the equation is balanced (dy/dx = 0), and the e⁻ˣ term is the leftover that fades. With y(0) = 0 the constant C is −2.",
    { kind: "plot", win: [0, 5, 0, 2.5], fns: [{ e: "2-2*exp(-x)" }, { e: "2", k: "b", dash: true }], alt: "a solution levelling off at 2" }),
  N("li-val", "dy/dx + y = 2 with y(0) = 0. What is y(1)? To 3 decimal places.", ex(r(2 - 2 * Math.exp(-1), 3)), "y = 2 − 2e⁻ˣ, so y(1) = 2 − 0.7358 = 1.264.", { t: "js", f: "2-2*Math.exp(-1)" }, { tol: 0.0006 }),
  N("li-eq", "At what level does the solution of dy/dx = 6 − 3y settle, for any starting value?", "2", "It settles when dy/dx = 0: 6 − 3y = 0 gives y = 2.", { t: "js", f: "6/3" }),
  Q("li-ic", "The solution of dy/dx + y = 2 has the form y = 2 + Ce⁻ˣ. If y(0) = 5, what is C?", "3", ["5", "-3", "7"], "At x = 0: 5 = 2 + C, so C = 3.", { t: "js", f: "5-2" }),
], "HL");

// ---------- Euler ----------
const eulerL = lesson("euler", "Euler's method", [
  P("When an equation cannot be solved in a formula, walk along it: from (x, y) the slope is dy/dx, so a small step h goes to (x + h, y + h·dy/dx). Repeat. Smaller steps give better answers, at the cost of more of them.",
    { kind: "formula", tex: [tx`y_{n+1}=y_n+h\,f(x_n,y_n)`], note: "For y′ = x + y, y(0) = 1: the first step with h = 0.1 gives y = 1 + 0.1 × 1 = 1.1." }),
  N("eu-5", "y′ = x + y, y(0) = 1. Use Euler's method with step h = 0.1 for 5 steps. What is y at x = 0.5? To 4 decimal places.", ex(r(K.euler((x, y) => x + y, 0, 1, 0.1, 5)[5][1], 4)), "The values run 1, 1.1, 1.22, 1.362, 1.5282, 1.7210. The exact answer, 2eˣ − x − 1, is 1.7974: Euler undershoots because the curve bends upward.", { t: "js", f: "(()=>{let x=0,y=1;for(let i=0;i<5;i++){y+=0.1*(x+y);x+=0.1}return y})()" }, { tol: 0.00006 }),
  N("eu-exact", "The exact solution of y′ = x + y, y(0) = 1 is y = 2eˣ − x − 1. What is it at x = 0.5? To 4 decimal places.", ex(r(2 * Math.exp(0.5) - 1.5, 4)), "2e^0.5 − 1.5 = 3.2974 − 1.5 = 1.7974.", { t: "js", f: "2*Math.exp(0.5)-1.5" }, { tol: 0.00006 }),
  Q("eu-h", "Halving the step size in Euler's method roughly does what to the error?", "~Halves it", ["~Quarters it", "~Doubles it", "~Leaves it unchanged"], "Euler's method is first order: the error is about proportional to h. Doubling the work halves the error.", { t: "words" }),
], "Uni");

// ---------- second order ----------
const second = lesson("second", "Second order", [
  P("For y″ + by′ + cy = 0, try y = eᵐˣ. It works when m solves the characteristic equation m² + bm + c = 0. Two real roots give two exponentials; no real roots give oscillation. The equation y″ + 4y = 0 has m = ±2i, so y = A cos 2x + B sin 2x.",
    { kind: "plot", win: [0, 7, -2.5, 2.5], fns: [{ e: "2*cos(2*x)" }], alt: "an oscillating solution" }),
  N("sc-roots", "y″ − 3y′ + 2y = 0. What is the larger root m of m² − 3m + 2 = 0?", "2", "m² − 3m + 2 = (m − 1)(m − 2), so the roots are 1 and 2, and y = Aeˣ + Be²ˣ.", { t: "js", f: "(3+Math.sqrt(9-8))/2" }),
  N("sc-per", "y″ + 4y = 0 has solutions like cos 2x. What is the period of the oscillation, as a decimal to 3 places?", ex(r(Math.PI, 3)), "cos(2x) repeats when 2x grows by 2π, so the period is π = 3.142.", { t: "js", f: "2*Math.PI/2" }, { tol: 0.0006 }),
  Q("sc-type", "For y″ + 2y′ + 5y = 0 the characteristic equation is m² + 2m + 5 = 0. What does the solution do?", "~Oscillates with a shrinking amplitude", ["~Grows exponentially without oscillating", "~Oscillates with a constant amplitude", "~Decays without oscillating"], "The roots are −1 ± 2i: the real part −1 gives a decay e⁻ˣ, the imaginary part 2 gives oscillation. A damped swing.", { t: "words" }),
], "Uni");

export const DE = chapter("de", "Differential equations", [separable, linear1, eulerL, second]);
