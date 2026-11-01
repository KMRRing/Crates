// Assay's levels (README, Assay, "Levels"): every recipe is a game the engine can deal; a level's own word is the same
// for everyone and in its level's pool; the stars are the par's, to the guess; the Steady rival plays every level through
// the real rules and the stars it earns come out whole; the ladder's miniatures draw; and the page keeps the ladder in
// its own keys, a game per level.
import { LEVELS as LEVEL_NAMES, BOARDS, RULES, MODES, newGame, guessIn, answersOf, levelOf, packOf, timeUp } from "../assay-engine.js";
import { ENGLISH } from "../assay-words.js";
import { ALL, IDS, lexOf, ready } from "../assay-lexicons.js";
import { rivalPlan } from "../assay-solve.js";
import * as LV from "../assay-levels.js";
import { miniature } from "../assay-mini.js";
import { readFileSync } from "fs";

await ready(ALL.equations);                     // the answers a few levels deal from
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const t0 = Date.now();

// ---------- the recipes ----------
{
  const names = new Set(LV.LEVELS.map(L => L.name));
  check(LV.COUNT === LV.LEVELS.length && LV.COUNT >= 20, `${LV.COUNT} levels`);
  check(names.size === LV.COUNT, "every level has a name of its own");
  check(LV.LEVELS.every(L => MODES.includes(L.mode) && IDS.includes(L.lex) && lexOf(L.lex).lengths.includes(L.len) && BOARDS.includes(L.boards) && LEVEL_NAMES.includes(L.level) && RULES.includes(L.rules)), "every recipe is a lexicon, mode, length, board count, answer level and rule the engine has");
  check(LV.LEVELS.every(L => (L.mode === "boards") === (L.boards > 1) && (L.boards === 1 || L.rules === "free")), "several boards only in the boards mode, and always free (the engine plays them so)");
  check(LV.CHAPTERS[0].from === 0 && LV.CHAPTERS.every((c, i) => i === 0 || c.from > LV.CHAPTERS[i - 1].from) && LV.CHAPTERS.at(-1).from < LV.COUNT, "the chapters begin at the first level and run in order");
  check(LV.LEVELS.every((_, i) => LV.chapterOf(i) === LV.CHAPTERS.findLastIndex(c => c.from <= i)), "a level is in the last chapter that has begun");
  check(LV.CHAPTERS.every(c => c.name && c.about), "every chapter says what it brings");
  // the par leaves a guess to spare on a limit, so the last guess still earns a star; one word's never under four
  const roomy = LV.LEVELS.every((L, i) => L.mode === "dodge" || L.mode === "sprint" || (Number.isInteger(L.par) && L.par + LV.slackOf(L) <= LV.limitOfLevel(i)));
  check(roomy, "each par and its extra guess fit inside the guesses the level gives");
  check(LV.LEVELS.every(L => L.mode !== "classic" || L.par >= 4), "no one-word par under four: three guesses is luck");
  check(LV.LEVELS.every(L => L.mode !== "sprint" || (L.par >= 4 && LV.sprintNeeds(L).every((n, k, a) => k === 0 || n > a[k - 1]))), "a sprint asks for more words at each star");
  check(LV.LEVELS.every((L, i, a) => i === 0 || a[i - 1].mode !== L.mode || a[i - 1].len !== L.len || a[i - 1].level !== L.level || a[i - 1].rules !== L.rules || a[i - 1].boards !== L.boards), "no level repeats the one before");
}

// ---------- a level's own word ----------
{
  let pooled = true, sameAgain = true, ignoresAvoid = true, lengthOk = true, distinct = true;
  const seen = new Map();
  LV.LEVELS.forEach((L, i) => {
    const g = LV.levelGame(i), again = LV.levelGame(i), w = answersOf(g);
    const P = packOf(lexOf(L.lex), L.len), pool = new Set(levelOf(P, L.level).map(k => P.words[k]));
    if (!w.every(x => pool.has(x))) pooled = false;
    if (L.mode === "sprint" && pool.size < 60) pooled = `level ${i + 1}'s pool is ${pool.size}, a sprint deals 60`;
    if (w.length !== (L.mode === "boards" ? L.boards : L.mode === "dodge" ? 0 : L.mode === "sprint" ? 60 : 1)) pooled = false;
    if (JSON.stringify(g.secret) !== JSON.stringify(again.secret)) sameAgain = false;
    if (JSON.stringify(LV.levelGame(i, LV.seedOf(i), w).secret) !== JSON.stringify(g.secret)) ignoresAvoid = false;
    if (g.lang !== L.lex || g.len !== L.len || g.mode !== L.mode || g.boards !== L.boards || g.rules !== L.rules || g.level !== L.level) lengthOk = false;
    if (L.mode === "classic" || L.mode === "boards") for (const x of w) { if (seen.has(x)) distinct = `${x} in levels ${seen.get(x) + 1} and ${i + 1}`; seen.set(x, i); }
  });
  check(pooled === true, `a level's own words come from its level's pool, as many as its mode deals${pooled === true ? "" : ` (${pooled})`}`);
  check(sameAgain, "the level's own seed deals the same words every time (the same for everyone)");
  check(ignoresAvoid, "...even when words are to be avoided: the first game is not shaped by what you saw lately");
  check(lengthOk, "a level's game has the recipe's mode, length, boards, rules and level");
  check(distinct === true, `no word is the first word of two levels${distinct === true ? "" : ` (${distinct})`}`);
  const other = LV.levelGame(0, 12345), mine = LV.levelGame(0, LV.seedOf(0), []);
  check(JSON.stringify(other.secret) !== JSON.stringify(mine.secret), "another seed deals another word of the same level");
}

// ---------- the stars ----------
{
  // plays `guesses` words that are not the answer, then the answer if `solve`
  const decoys = ["about", "other", "which", "there", "their", "would", "these", "first", "could", "after", "where", "being", "every"];
  const play = (L, words, tried, solve) => {
    const g = newGame({ lex: ENGLISH, mode: L.mode, len: L.len, boards: L.boards, level: L.level, rules: "free", seed: 5, words });
    const pool = decoys.filter(d => !words.includes(d)).slice(0, tried);
    for (const d of pool) guessIn(g, d, ENGLISH);
    if (solve) for (const w of words) guessIn(g, w, ENGLISH);
    return g;
  };
  const at = i => LV.LEVELS[i];
  const warm = at(0);                                   // 5 letters, par 4, six guesses
  const stars = (tried, solve = true) => LV.starsFor(0, play(warm, ["yield"], tried, solve));
  check(stars(3) === 3 && stars(2) === 3, "within the par: three stars (4 guesses, 3)");
  check(stars(4) === 2, "one past the par: two stars (5 guesses)");
  check(stars(5) === 1, "on the last guess: one star (6 guesses)");
  check(stars(6, false) === 0, "six guesses and no word: not cleared");
  check(stars(1, false) === 0, "a game still running is not cleared");
  const di = LV.LEVELS.findIndex(L => L.mode === "dodge"), dg = at(di);
  const dodged = n => { const g = newGame({ lex: ENGLISH, mode: "dodge", len: dg.len, level: dg.level, seed: 1 }); g.over = "won"; g.guesses = Array(n).fill("x".repeat(dg.len)); return LV.starsFor(di, g); };
  check(dodged(dg.par) === 3 && dodged(dg.par + 2) === 2 && dodged(dg.par + 3) === 1 && dodged(dg.par + 20) === 1, "the dodging word: three stars at the par, two within two more, one for any solve");
  const si = LV.LEVELS.findIndex(L => L.mode === "sprint"), sg = at(si), [one, two, three] = LV.sprintNeeds(sg);
  const sprinted = n => { const g = newGame({ lex: ENGLISH, mode: "sprint", len: sg.len, level: sg.level, seed: 1 }); g.past = Array.from({ length: n + 3 }, (_, k) => ({ guesses: ["x"], won: k < n })); g.over = "time"; return LV.starsFor(si, g); };
  check(sprinted(three) === 3 && sprinted(three - 1) >= 2 && sprinted(two) === 2 && sprinted(one) === 1 && sprinted(one - 1) === 0 && sprinted(0) === 0, "a sprint: stars for words solved, none under the first number");
  const bi = LV.LEVELS.findIndex(L => L.mode === "boards"), bg = at(bi);
  const words = answersOf(LV.levelGame(bi));
  const solvedIn = n => LV.starsFor(bi, play(bg, words, n - words.length, true));
  check(solvedIn(bg.par) === 3 && solvedIn(bg.par + 1) === 2 && solvedIn(LV.limitOfLevel(bi)) === 1, "several boards: the par is guesses in all, not per board");
  const half = play(bg, words, 0, false);
  guessIn(half, words[0], ENGLISH);
  half.over = "lost";
  check(LV.starsFor(bi, half) === 0, "boards left unsolved: not cleared");
}

// ---------- the Steady rival plays every level ----------
{
  const tally = [0, 0, 0, 0];
  let finished = true, whole = true;
  LV.LEVELS.forEach((L, i) => {
    const lex = lexOf(L.lex), g = LV.levelGame(i), plan = rivalPlan(g, "steady", lex);
    for (const row of plan.rows) { const r = guessIn(g, row.guess, lex); if (!r.ok) finished = false; if (g.over) break; }
    if (L.mode === "sprint") timeUp(g);
    if (!g.over) finished = false;
    const s = LV.starsFor(i, g);
    if (!Number.isInteger(s) || s < 0 || s > 3) whole = false;
    tally[s]++;
  });
  check(finished, "the Steady rival's moves are all legal, and every level ends");
  check(whole, "every finished level has 0 to 3 stars");
  console.log(`     Steady on each level's own word: ${tally.map((n, s) => `${s} stars ${n}`).join(", ")}`);
  check(tally[0] <= 6, "Steady clears nearly every level on its first word");
}

// ---------- the miniatures ----------
{
  const all = LV.LEVELS.map(miniature);
  const sizes = LV.LEVELS.map((L, i) => (L.mode === "sprint" ? true : (all[i].match(/<rect/g) || []).length === L.len * (L.boards > 2 ? 3 : 4) * L.boards));
  check(all.every(s => s.startsWith("<svg") && s.endsWith("</svg>")), "every level draws a miniature");
  check(sizes.every(Boolean), "a board's miniature has a tile for every letter of every row and every board");
  check(LV.LEVELS.every((L, i) => (L.mode === "dodge") === all[i].includes('class="n d"') || L.mode === "sprint"), "only the dodging word's tiles are dashed");
  check(LV.LEVELS.every((L, i) => (L.mode === "sprint") === all[i].includes("<circle")), "only a sprint draws a clock");
}

// ---------- the page ----------
{
  const page = readFileSync(new URL("../assay.js", import.meta.url), "utf8"), html = readFileSync(new URL("../assay.html", import.meta.url), "utf8");
  check(/assay:camp/.test(page) && /assay:lruns/.test(page) && /assay:track/.test(page), "the ladder lives in assay:camp, assay:lruns and assay:track (so it syncs and a watcher sees it)");
  check(/id="levelBtn"/.test(html) && /\$\("levelBtn"\)\.addEventListener/.test(page), "the header's Level button opens the menu");
  check(/startLevel\(camp\.at, !!S\)/.test(page), "a level's word that was played (told, if lost) is not dealt again on a return");
  check(/write\(LRUNS/.test(page) && /write\(RUN, S\)/.test(page), "a level's game is kept apart from free play's");
}

console.log(`${Date.now() - t0} ms`);
if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
