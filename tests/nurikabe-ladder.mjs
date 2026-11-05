// Every level of Dujiang's ladder (nurikabe-levels.js), made as a player meets it the first time: one answer, counted by a search that
// guesses, at the level the ladder asks for. Slow (the 10×10 levels take seconds), so it runs in the nightly suite.
import { LEVELS, levelPuzzle } from "../nurikabe-levels.js";
import { puzzleOf, count } from "../nurikabe-engine.js";

let bad = 0;
for (let i = 0; i < LEVELS.length; i++) {
  const L = LEVELS[i], p = levelPuzzle(i), P = p && puzzleOf(L.size, p.grid, p.sol, p);
  const ok = !!p && count(P, 2) === 1 && p.level === L.level;
  console.log(`${ok ? "ok  " : "FAIL"} level ${i + 1} ${L.name} (${L.size}×${L.size} ${L.level} ${L.twist})${p ? ` came ${p.level}` : " none"}`);
  if (!ok) bad++;
}
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("nurikabe ladder: every level deals a puzzle with one answer at its level");
