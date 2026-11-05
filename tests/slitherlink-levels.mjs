// Portolan's ladder (slitherlink-levels.js) and the page's use of the twists: chapters that each bring one twist, the gauntlet where
// they meet, a puzzle of every chapter's first level made the same for everyone, the stars, and the page wired to the engine.
import fs from "node:fs";
import { LEVELS, CHAPTERS, COUNT, chapterOf, seedOf, kindOf, levelPuzzle, parOf, starsFor } from "../slitherlink-levels.js";
import { SIZES, HEX_SIZES, LEVELS as GRADES } from "../slitherlink-engine.js";
import { puzzleOf, count } from "../slitherlink-twist.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;

// ---------- the ladder ----------
{
  const froms = CHAPTERS.map(c => c.from);
  check(froms[0] === 0 && froms.every((f, i) => i === 0 || f > froms[i - 1]) && froms.at(-1) < COUNT, `${CHAPTERS.length} chapters in order, from level 0 to ${COUNT - 1}`);
  check(new Set(LEVELS.map(L => L.name)).size === COUNT, "every level has a name of its own");
  check(LEVELS.every(L => (L.board === "hex" ? HEX_SIZES : SIZES).includes(L.size) && GRADES[L.level] && !(L.board === "hex" && /tunnels/.test(L.twist))), "every level is a size, level and twist its board has (a honeycomb has no causeways)");
  const kinds = ch => LEVELS.slice(ch.from, CHAPTERS[CHAPTERS.indexOf(ch) + 1]?.from ?? COUNT);
  const [base, ranges, tunnels, hex, gauntlet] = CHAPTERS.map(kinds);
  check(base.every(L => L.board === "square" && L.twist === "none"), "chapter 1 is the plain game");
  check(ranges.every(L => L.twist === "ranges" && L.board === "square"), "chapter 2 brings ranges alone");
  check(tunnels.filter(L => L.twist === "ranges+tunnels").length >= 1 && tunnels.filter(L => L.twist === "tunnels").length >= 3, "chapter 3: tunnels first, then a block mixing them with ranges");
  check(hex.every(L => L.board === "hex") && hex.some(L => L.twist === "ranges"), "chapter 4 is the honeycomb, ending with ranges on it");
  check(gauntlet.every(L => /ranges/.test(L.twist)) && gauntlet.some(L => /tunnels/.test(L.twist)) && gauntlet.some(L => L.board === "hex"), "the gauntlet mixes ranges, tunnels and the honeycomb");
  check(chapterOf(0) === 0 && chapterOf(COUNT - 1) === CHAPTERS.length - 1, "a level knows its chapter");
}

// ---------- the puzzles ----------
{
  let fine = true, made = 0;
  const firsts = [...new Set([...CHAPTERS.map(c => c.from), 1, 7, 12, 17, 19])].filter(i => LEVELS[i].size <= 7 && LEVELS[i].level !== "hard");
  for (const i of firsts) {
    const a = levelPuzzle(i), b = levelPuzzle(i), L = LEVELS[i];
    if (!a || JSON.stringify(a) !== JSON.stringify(b)) { fine = false; continue; }
    const P = puzzleOf(L.size, a.grid, a.sol, { shape: L.board, tun: a.tun });
    fine &&= a.level === L.level && count(P.g, P.X, 2) === 1 && (a.shape ?? "square") === L.board;
    made++;
  }
  check(fine && made >= 6, `${made} levels (a chapter's first, and some more) make the same puzzle each time, one answer, on the level`);
  check(seedOf(0) !== seedOf(1) && kindOf(3).size === LEVELS[3].size, "a level's own seed, and the kind a level asks for");
}

// ---------- the stars ----------
{
  const par = parOf(49, "medium", "ranges");
  check(parOf(25, "easy") < parOf(49, "easy") && parOf(49, "easy") < parOf(49, "hard") && parOf(49, "easy") <= parOf(49, "easy", "ranges+tunnels"), "the par grows with the cells, the level and the twists");
  check(starsFor(49, "medium", "ranges", par) === 3 && starsFor(49, "medium", "ranges", par + 1) === 2 && starsFor(49, "medium", "ranges", 2 * par) === 2 && starsFor(49, "medium", "ranges", 2 * par + 1) === 1, "three stars within the par, two within twice it, else one");
}

// ---------- the page ----------
{
  const page = fs.readFileSync(root + "slitherlink.js", "utf8"), css = fs.readFileSync(root + "slitherlink.css", "utf8"), html = fs.readFileSync(root + "slitherlink.html", "utf8");
  check(/from "\.\/slitherlink-levels\.js"/.test(page) && /CAMP = "slitherlink:camp"/.test(page) && /LRUNS = "slitherlink:lruns"/.test(page), "the page keeps the ladder under slitherlink: keys");
  check(/startMarks/.test(page) && /P\.locked\?\.\[e\]/.test(page), "a causeway's lines start drawn and can't be changed");
  check(/slitherlink:ramp:hex|id: "hex"/.test(page) && /choice\("Board"/.test(page) && /choice\("Twist"/.test(page), "Free play chooses a board and a twist; the honeycomb has a ramp of its own");
  check(/shape: k\.board, twist: k\.twist/.test(page) && /b=hex/.test(page) && /#lv=/.test(page), "the worker is asked for the board and twist, and a link carries them");
  check(/slk-bound/.test(css) && /slk-causeway/.test(css) && /slk-bound/.test(page), "a bound sits on a plate, a causeway is drawn as a deck");
  check(/DAILY_KIND = \{ \.\.\.DAILY, board: "square", twist: "none" \}/.test(page), "today's puzzle stays the plain classic");
  check(/slitherlink\.js/.test(html), "the page script is linked");
}

console.log(bad ? `\n${bad} failed` : "\nall slitherlink ladder checks passed");
process.exit(bad ? 1 : 0);
