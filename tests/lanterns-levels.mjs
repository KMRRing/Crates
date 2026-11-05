// Lanterns' ladder (lanterns-levels.js): chapters in order, every level a kind the generator can make, the first level of each
// chapter and a few others made from their own seeds (one answer, at the level the ladder asks for, showing their twist), the
// stars. Every level of the ladder was checked by hand when it was set (36 of 36 came out at their level from their own seed).
import fs from "node:fs";
import { CHAPTERS, LEVELS, COUNT, chapterOf, seedOf, kindOf, levelPuzzle, parOf, starsFor, isHex } from "../lanterns-levels.js";
import { puzzleOf, count, twistOf, twistKey, SIZES, HEX_SIZES, ORDER } from "../lanterns-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;

// ---------- the ladder's shape ----------
{
  check(COUNT === LEVELS.length && COUNT >= 30 && CHAPTERS[0].from === 0 && CHAPTERS.every((c, i) => i === 0 || c.from > CHAPTERS[i - 1].from), `${COUNT} levels in ${CHAPTERS.length} chapters, in order from the first`);
  check(CHAPTERS.map(c => c.name).join("|") === "Safe harbour|Ranges|Short beams|Mirrors|Hex shoals|The gauntlet", "the chapters: the plain game, ranges, short beams, mirrors, hex, the gauntlet");
  check(new Set(LEVELS.map(L => L.name)).size === COUNT && new Set(Array.from({ length: COUNT }, (_, i) => seedOf(i))).size === COUNT, "every level has a name of its own and a seed of its own");
  const fine = LEVELS.every((L, i) => ORDER.includes(L.level) && twistKey(L.twist) === L.twist && (isHex(i) ? HEX_SIZES : SIZES).includes(L.size) && !(isHex(i) && L.size < 9 && L.level === "expert"));
  check(fine, "each level is a board size, a level and a twist the generator offers, the twist named in its fixed order (no Expert on a hex board 7 across)");
  // each chapter brings its twist in: its first level has it, and the chapters before it do not
  const has = (i, t) => twistOf(LEVELS[i].twist)[t];
  const firsts = [["ranges", 1], ["short", 2], ["mirrors", 3], ["hex", 4]];
  check(firsts.every(([t, c]) => has(CHAPTERS[c].from, t) && LEVELS.slice(0, CHAPTERS[c].from).every((_, i) => !has(i, t))), "a twist first comes in at its own chapter, alone, and not before");
  check(CHAPTERS[0].from === 0 && LEVELS.slice(0, CHAPTERS[1].from).every(L => L.twist === "none"), "the first chapter is the plain game");
  const gauntlet = LEVELS.slice(CHAPTERS[5].from);
  check(gauntlet.every(L => L.twist.split("+").length >= 2) && gauntlet.some(L => L.twist.includes("hex")) && gauntlet.some(L => !L.twist.includes("hex")), "the gauntlet's levels all mix twists, on both boards");
  const endsMixed = [["short", 2], ["mirrors", 3], ["hex", 4]].every(([t, c]) => { const last = LEVELS.slice(CHAPTERS[c].from, CHAPTERS[c + 1].from).at(-1); return has(CHAPTERS[c + 1].from - 1, t) && last.twist.split("+").length >= 2; });
  check(endsMixed, "the short beams, mirrors and hex chapters end on a block that mixes their twist with one from before");
  check(chapterOf(0) === 0 && chapterOf(CHAPTERS[2].from) === 2 && chapterOf(COUNT - 1) === 5, "a level's chapter");
}

// ---------- levels made from their own seeds ----------
{
  const t0 = performance.now();
  const picks = [0, 1, ...CHAPTERS.slice(1).map(c => c.from), COUNT - 1];
  let unique = 0, onLevel = 0, shows = 0, again = 0;
  for (const i of picks) {
    const L = LEVELS[i], p = levelPuzzle(i), tw = twistOf(L.twist);
    if (!p) continue;
    const P = puzzleOf(p.size, p.grid, p.sol, { board: p.board, k: p.k });
    if (count(P, 2) === 1) unique++;
    if (p.level === L.level) onLevel++;
    if ((!tw.hex || p.board === "hex") && (!tw.short || p.k > 0) && (!tw.ranges || /[a-fA-E]/.test(p.grid)) && (!tw.mirrors || /[\\/-]/.test(p.grid.replace(/\./g, "")))) shows++;
    if (JSON.stringify(levelPuzzle(i)) === JSON.stringify(p)) again++;
    const k = kindOf(i);
    if (k.twist !== L.twist || k.size !== L.size) bad++;
  }
  check(unique === picks.length && onLevel === picks.length, `${picks.length} levels from their own seeds: one answer each, at the level the ladder asks for`);
  check(shows === picks.length && again === picks.length, "…each showing its twist, and the same puzzle every time it is made");
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}

// ---------- the stars ----------
{
  const p = { grid: ".".repeat(40) + "#".repeat(9), level: "medium", twist: "none" }, par = parOf(p);
  check(par > 15 && starsFor(p, par) === 3 && starsFor(p, par + 1) === 2 && starsFor(p, 2 * par) === 2 && starsFor(p, 2 * par + 1) === 1, "stars: three within the par, two within twice it, one for solving");
  check(parOf({ ...p, level: "hard" }) > par && parOf({ ...p, twist: "mirrors" }) > par && parOf({ ...p, grid: ".".repeat(20) + "#".repeat(29) }) < par, "a harder level, a twist and more white cells give a longer par");
}

// ---------- the page wired to it ----------
{
  const page = fs.readFileSync(root + "lanterns.js", "utf8"), css = fs.readFileSync(root + "lanterns.css", "utf8");
  check(/lanterns:camp/.test(page) && /lanterns:lruns/.test(page) && /lanterns:track/.test(page) && /lanterns:prefs/.test(page), "the ladder is kept under lanterns: keys");
  check(/lanterns-levels\.js/.test(page) && /recordLevel/.test(page) && /levelList/.test(page) && /lan-lgrid/.test(css), "the menu lists the ladder, and a solved level keeps its stars");
  check(/choice\("Board"/.test(page) && /ticks\("Twists"/.test(page) && !/choice\("(Size|Level)"/.test(page), "Free play chooses the board and the twists, and has no Size or Level row");
  check(!/\b(alert|confirm|prompt)\(/.test(page), "no browser pop-ups");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("lanterns levels: the ladder holds");
