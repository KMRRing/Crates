// Assay's number games (README, Assay: Numbers): Primes and Equations as lexicons of the engine. The primes are the
// primes; an equation is checked by the usual order of operations with exact fractions; the answer lists are what the
// generator writes (the shorter lengths worked out again here, the longest checked for what it must be); each level of
// each game has answers; every mode is played through by the Steady rival and the dodging word's biggest groups hold;
// a game's answers are hidden in what's kept, digits and signs too; and the page asks for the file only when wanted.
import { LEVELS, newGame, guessIn, refusal, hide, unhide, packOf, levelOf, dodgeStep, answersOf, timeUp, limitOf, marksOf, HIT, NEAR, GREY, rulesBreak } from "../assay-engine.js";
import { rivalPlan } from "../assay-solve.js";
import { PRIMES, EQUATIONS, valueOf, isEquation, tierOfEquation } from "../assay-numbers.js";
import { ALL, IDS, lexOf, ready, unitOf, nounOf } from "../assay-lexicons.js";
import { equationsOf } from "../assay-equations.mjs";
import { readFileSync } from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const t0 = Date.now();

// ---------- the registry ----------
check(same(IDS, ["en", "primes", "equations"]) && lexOf("nope").id === "en" && lexOf(undefined).id === "en", "three games; an id unknown (a game saved before there were others) is words");
check(unitOf(PRIMES) === "digits" && unitOf(EQUATIONS) === "characters" && unitOf(ALL.en) === "letters" && nounOf(PRIMES) === "prime" && nounOf(EQUATIONS) === "equation" && nounOf(ALL.en) === "word", "what each game calls its pieces");
check(ALL.en.load === undefined && PRIMES.load === undefined && typeof EQUATIONS.load === "function", "only equations has a file to fetch");
check(Object.values(ALL).every(l => l.rows.length >= 2 && l.rows.join("").length === new Set(l.rows.join("")).size), "every keyboard has each key once");
let threw = false;
try { EQUATIONS.answers(7); } catch { threw = true; }
check(threw, "equations asked for before they are loaded say so, rather than deal nothing");
await ready(EQUATIONS);

// ---------- primes ----------
{
  const four = PRIMES.answers(4), five = PRIMES.answers(5);
  check(four.length === 1061 && five.length === 8363, "1,061 four-digit primes and 8,363 of five");
  const isPrime = n => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return n > 1; };
  check(four.every(x => isPrime(Number(x.w)) && x.w.length === 4 && x.w[0] !== "0") && five.every(x => isPrime(Number(x.w)) && x.w.length === 5), "every answer is a prime of its length");
  check(four.every(x => (x.tier === 0) === (new Set(x.w).size === 4)) && five.every(x => (x.tier === 0) === (new Set(x.w).size === 5)), "easy primes repeat no digit; the rest do");
  check(PRIMES.accepts("10007") && PRIMES.accepts("9973") && !PRIMES.accepts("10001") && !PRIMES.accepts("9999") && !PRIMES.accepts("0997") && !PRIMES.accepts("97") && !PRIMES.accepts("100003") && !PRIMES.accepts("abcde"), "a guess must be a prime of four or five digits");
  check(PRIMES.why("10001") === "Not a prime" && PRIMES.why("1000a") === "Digits only", "a refusal says why");
  check(["0", "5", "x", "+", "A", ""].map(c => PRIMES.letter(c)).join("|") === "0|5||||", "primes take digits from a keyboard");
}

// ---------- equations ----------
{
  check(valueOf("6/4*2") === 3 && valueOf("3+4*5") === 23 && valueOf("20-6/2") === 17 && valueOf("2*3+4*5") === 26 && valueOf("100/8*2") === 25, "a sum is worked by the usual order, fractions exact on the way (6/4*2 is 3)");
  check(valueOf("7/2") === null && valueOf("5/0") === null && valueOf("1-9") === -8 && valueOf("01+2") === null && valueOf("12+") === null && valueOf("+12") === null && valueOf("1++2") === null && valueOf("12") === null, "a half, a zero divide, a leading zero, a dangling sign and a lone number are no sums (a negative value is, for the right side to refuse)");
  const yes = ["12+34=46", "6/4*2=3", "3+4*5=23", "10-9=1", "99-9=90", "2*3=6", "9-9=0", "56/7=8"], no = ["12+34=47", "01+2=3", "1+2=3=3", "12+34", "=12", "1+2=", "10/4+3=5.5", "5=5", "1+2=1+2", "3-9=-6", "7/2=3", "2+2=04", "a+b=cd"];
  check(yes.every(isEquation) && no.every(w => !isEquation(w)), "an equation balances with a whole number alone on its right: no second =, no sign or leading zero over there, nothing negative");
  check(yes.filter(w => w.length >= 6 && w.length <= 8).every(w => EQUATIONS.accepts(w)) && !EQUATIONS.accepts("1+1=2") && !EQUATIONS.accepts("12+345=357x"), "a guess of six to eight characters must balance, trivial or not");
  check(EQUATIONS.accepts("1*1+0=1") && EQUATIONS.accepts("0+12=12") && !EQUATIONS.accepts("9+9+9=27x"), "a guess may be a trivial sum; only an answer may not");
  check(EQUATIONS.why("12+34=47") === "That doesn't balance" && EQUATIONS.why("12+34") === "One = sign" && EQUATIONS.why("12+3a=46") === "Digits and signs only", "a refusal says why");
  check(["7", "+", "=", "x", "×", "÷", "−", "a"].map(c => EQUATIONS.letter(c)).join("|") === "7|+|=|*|*|/|-|", "the keyboard's x, × and ÷ are the signs; others turn away");
  check(EQUATIONS.show("*") === "×" && EQUATIONS.show("/") === "÷" && EQUATIONS.show("-") === "−" && EQUATIONS.show("7") === "7", "signs are drawn as such");
  for (const n of [6, 7]) check(same(EQUATIONS.answers(n).map(x => x.w), equationsOf(n)), `the ${n}-character answers are what the generator makes now (rerun node assay-equations.mjs if not)`);
  const lens = EQUATIONS.lengths.map(n => EQUATIONS.answers(n));
  check(lens.every((a, i) => a.length > 100 && a.every(x => x.w.length === EQUATIONS.lengths[i] && isEquation(x.w))), "every answer is an equation of its length");
  check(lens.every(a => a.every((x, i) => i === 0 || a[i - 1].w < x.w)), "answers are alphabetical, none twice");
  check(lens.every(a => a.every(x => !/(^|[-+*/])(0|1)[*/]|[*/](0|1)([-+*/=]|$)|(^|[-+*/])0[-+]|[-+]0([-+*/=]|$)/.test(x.w.split("=")[0]))), "no answer has a zero added, or a one or zero multiplied or divided");
  check(lens.every(a => a.every(x => x.tier === tierOfEquation(x.w))) && [["1+2+3=6", 0], ["2*3+1=7", 1], ["8/2+1=5", 2], ["1+2+3+4=10", 2]].every(([w, t]) => tierOfEquation(w) === t), "easy is only + and − with up to two signs, medium has a ×, hard a ÷ or three signs");
}

// ---------- levels of each game ----------
{
  let every = true, small = null;
  for (const id of ["primes", "equations"]) for (const len of lexOf(id).lengths) for (const level of LEVELS) {
    const n = levelOf(packOf(lexOf(id), len), level).length;
    if (n < 40) { every = false; small = `${id} ${len} ${level}: ${n}`; }
  }
  check(every, `every length and level has answers to deal (40 at least)${small ? `; ${small}` : ""}`);
  const e = levelOf(packOf(PRIMES, 5), "easy"), h = levelOf(packOf(PRIMES, 5), "hard"), m = levelOf(packOf(PRIMES, 5), "medium");
  check(e.length + h.length === m.length && m.length === 8363, "primes: Easy and Hard split the primes, Medium has them all");
}

// ---------- played through ----------
{
  const plays = [["primes", "classic", 5, 1, "easy", "free"], ["primes", "classic", 4, 1, "hard", "hard"], ["primes", "boards", 5, 2, "medium", "free"], ["primes", "dodge", 4, 1, "easy", "free"], ["primes", "sprint", 4, 1, "easy", "free"],
    ["equations", "classic", 8, 1, "medium", "strict"], ["equations", "classic", 6, 1, "easy", "free"], ["equations", "boards", 7, 2, "easy", "free"], ["equations", "dodge", 8, 1, "easy", "free"], ["equations", "sprint", 6, 1, "easy", "free"]];
  let legal = true, ended = true, solved = 0, bounded = true;
  for (const [id, mode, len, boards, level, rules] of plays) {
    const lex = lexOf(id), g = newGame({ lex, mode, len, boards, level, rules, seed: 41 }), plan = rivalPlan(g, "steady", lex);
    for (const row of plan.rows) { const r = guessIn(g, row.guess, lex); if (!r.ok) { legal = false; console.log(`     refused: ${id} ${mode} ${len} ${row.guess}: ${r.why}`); } if (g.over) break; }
    if (mode === "sprint") timeUp(g);
    if (!g.over) ended = false;
    if (g.over === "won" || (mode === "sprint" && plan.solved)) solved++;
    if (g.guesses.length > (limitOf(g) === Infinity ? 30 : limitOf(g))) bounded = false;
    if (g.lang !== id) legal = false;
  }
  check(legal, "the Steady rival's moves are all legal in every mode of both games, and games carry their game's id");
  check(ended && bounded, "every one ends, within its guesses");
  check(solved >= 8, `and Steady solves most of them (${solved} of ${plays.length})`);
  // the dodging word over a whole pool of the biggest length: every guess's groups add up, and its marks are the largest group's
  const P = packOf(EQUATIONS, 8), cands = [...P.words.keys()], step = dodgeStep(P, cands, P.words[1234]);
  const groups = new Map();
  for (const i of cands) { const k = marksOf(P.words[1234], P.words[i]).join(""); groups.set(k, (groups.get(k) || 0) + 1); }
  const sizes = [...groups.values()];
  check(sizes.reduce((a, b) => a + b, 0) === cands.length && step.cands.length === Math.max(...sizes) && step.marks.length === 8, `the dodging word keeps the biggest of the ${groups.size} groups one guess makes of ${cands.length} equations`);
  const plan = rivalPlan(newGame({ lex: EQUATIONS, mode: "dodge", len: 8, level: "easy", seed: 3 }), "master", EQUATIONS);
  check(plan.won && plan.rows.length <= 12, `Master, which weighs every group, pins the dodging word down in ${plan.rows.length}`);
  // a hard rule's message names the place, up to the eighth
  const rows = [{ guess: "12+34=46", marks: marksOf("12+34=46", "12+34=46").map((m, i) => (i === 7 ? HIT : GREY)) }];
  check(rulesBreak("12+34=47", rows, "hard") === "The 8th letter must be 6", "the hard rule names the eighth place too");
}

// ---------- kept games ----------
{
  const w = ["12+34=46", "9*8-7=65", "10007", "99991"];
  check(w.every(x => unhide(hide(x)) === x) && w.every(x => hide(x) !== x), "digits and signs are hidden in what's kept and come back");
  check(hide("=====") === "=====" && hide("abc") !== "abc" && unhide(hide("a1+b2=c3")) === "a1+b2=c3", "an = stays, letters, digits and signs move along their own kinds");
  check([...hide("0123456789")].every(c => /[0-9]/.test(c)) && [...hide("+-*/+-*/")].every(c => "+-*/".includes(c)) && [...hide("abcxyz")].every(c => /[a-z]/.test(c)), "a digit stays a digit, a sign a sign, a letter a letter");
  const g = newGame({ lex: PRIMES, mode: "classic", len: 5, level: "easy", seed: 9 });
  check(g.lang === "primes" && g.secret.every(s => /^\d{5}$/.test(s)) && answersOf(g).every(a => PRIMES.accepts(a)) && g.secret[0] !== answersOf(g)[0], "a game of primes keeps its lexicon, and its answer hidden");
  check(refusal(g, "12345", PRIMES) === "Not a prime" && refusal(g, "1234", PRIMES) === "5 letters" && guessIn(g, PRIMES.answers(5)[7].w, PRIMES).ok, "a refusal is the game's own; a prime is taken");
}

// ---------- the page ----------
{
  const page = readFileSync(new URL("../assay.js", import.meta.url), "utf8");
  check(/whileBusy\(`Loading the/.test(page) && /lex\.load \|\| loaded\.has/.test(page) && /await prepare\(/.test(page), "the equations file is fetched only when a game of them is begun or resumed, said while it comes");
  check(/choice\("Play", GAMES/.test(page) && /lexNow\(\)\.letter\(e\.key\)/.test(page) && /keysFor !== lexNow\(\)\.id/.test(page), "the menu chooses what to play, the keyboard and the keys follow it");
  check(!/import \{[^}]*EQUATIONS[^}]*\} from/.test(page) && !/import "\.\/assay-equations/.test(page), "the page doesn't import the equation answers itself");
}

console.log(`${Date.now() - t0} ms`);
if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
