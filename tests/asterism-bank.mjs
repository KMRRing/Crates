// Asterism's banked puzzles (asterism-bank.js, made ahead for the cube and the larger hexagon boards): each is graded
// again, and is the level it is stored under. Slow (grading a hexagon of 7 takes seconds a puzzle): the nightly run has it.
import { BANK } from "../asterism-bank.js";
import { solidPuzzle } from "../asterism-solid.js";
import { gradeOf, ORDER } from "../asterism-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
for (const [key, levels] of Object.entries(BANK)) {
  const [shape, size] = key.split(":");
  let wrong = 0, n = 0;
  for (const level of ORDER) for (const [reg, sol] of levels[level] || []) { n++; if (ORDER[gradeOf(solidPuzzle(shape, +size, reg, sol))] !== level) wrong++; }
  check(wrong === 0, `${key}: all ${n} banked puzzles grade as the level they are stored under`);
}
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("asterism bank: every banked puzzle grades as stored");
