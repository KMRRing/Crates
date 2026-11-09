// Korbi, 4 November 2026: the menu is the minimum it needs to be. The puzzles', word games', quizzes', idle and party games'
// menus have no size, level, strength, length, rule-variant or display rows: size and level are a hidden ramp (ramp.js,
// rungs from ramp-steps.js), lobby options that went are `hidden`. This reads each game's source and checks the rows are gone
// and the ramp is wired (the menu itself needs a browser).
import fs from "fs";
import { rungs, startFor, split } from "../ramp-steps.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const src = g => fs.readFileSync(`${root}${g}.js`, "utf8");
const rowOf = (s, label) => new RegExp(`\\b(?:choice|toggle|ticks|mirror)\\(\\s*["'\`]${label}["'\`]`).test(s);

// game: [rows that are gone]; every one of them has the ramp wired
const RAMPED = {
  moor: ["Size", "Level"], lanterns: ["Size", "Level"], 
  sudoku: ["Size", "Level", "Its pace", "Clear pencil marks as you write"], calcudoku: ["Size", "Level", "Its pace", "Clear pencil marks as you write"],
  kakuro: ["Size", "Level", "Its pace", "Show the ways a run can be", "Clear pencil marks as you write"],
  delta: ["Level"], slate: ["Level"], survey: ["Size", "Readings"], bridges: ["Size", "Level", "Twist"],
  asterism: ["Size", "Level", "Stars a row"], ladder: ["Level", "Letters", "Themes", "Rules", "Its level"], bulls: ["Codemaker", "Computer", "Help", "Pieces"],
  lode: ["Level", "Board", "Clues"], lots: ["Level"], shunt: ["Difficulty", "Coach lines (levels 1 to 8)"],
  rack: ["Computer players"], 
  quest: ["Roles", "The computer", "The computer players talk"], speedmaths: ["Sprint range"],
  nurikabe: ["Size", "Level"], slitherlink: ["Size", "Level", "Clues"], yield: ["Puzzle", "Level", "Clock", "Race clock"],
};
for (const [g, gone] of Object.entries(RAMPED)) {
  const s = src(g === "speedmaths" ? "speedmaths-ui" : g);
  const left = gone.filter(l => rowOf(s, l));
  check(!left.length, `${g}: none of the cut rows is built${left.length ? ` (still: ${left.join(", ")})` : ""}`);
  check(/from "\.\/ramp\.js"/.test(s) && /\bramp\(\s*(?:"|pool\b)/.test(s), `${g}: the level comes from the hidden ramp`);
  check(/ramp\.(won|lost)\(/.test(s), `${g}: the ramp moves when a game ends`);
}
// rows that went with no ramp behind them
const PLAIN = { 
  punt: ["Difficulty", "Name it"], 
  cue: ["The kind over the word"], rush: ["Coordinates on the board"],
  slipway: ["The part's ghost", "Show what a tool would take"], landfall: ["Help"], drift: ["Quay"], stow: ["Cargo"] };
for (const [g, gone] of Object.entries(PLAIN)) {
  const left = gone.filter(l => rowOf(src(g), l));
  check(!left.length, `${g}: none of the cut rows is built${left.length ? ` (still: ${left.join(", ")})` : ""}`);
}
// (forger: its Rounds option is shown, 7 Nov 2026, Korbi: "changing the number of rounds wasn't easy"; it has nothing else to hide)
// a lobby option that went is hidden, not deleted: its default still reaches start()
for (const g of ["sketch", "gauge", "echo", "decoy", "pewter", "gallery", "undercover", "whoami", "whispers", "coup"])
  check(/hidden: true/.test(src(`party-${g}`)), `${g}: some lobby option is hidden`);

// ramp-steps.js: rungs run easiest first, and the old choice finds its nearest rung
const R = rungs([6, 9], ["easy", "medium", "hard"]);
check(R[0] === "6.easy" && R.at(-1) === "9.hard" && R.length === 6, `rungs run from 6.easy to 9.hard: ${R.join(" ")}`);
check(startFor(R, [6, 9], ["easy", "medium", "hard"], 9, "medium") === "9.medium", "a saved 9 medium starts on its own rung");
check(startFor(rungs([6, 9], ["easy", "hard"]), [6, 9], ["easy", "medium", "hard"], 6, "medium") !== undefined, "a saved level the rungs lack finds a near one");
check(split("10.medium").size === "10" && split("10.medium").level === "medium", "a rung splits into its size and level");

process.exit(bad ? 1 : 0);
