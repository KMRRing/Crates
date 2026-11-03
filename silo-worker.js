// Four in a row's thinking, off the page's thread: Hard's move and the coach's reading of a position. A position (the moves so
// far) in, the answer out; the tables live as long as the worker, so each move of a game is cheaper than the last.
import { createSolver } from "./silo-solver.js";
import { hardMove } from "./silo-bot.js";

let solver = null;
onmessage = e => {
  const { id, moves } = e.data;
  let result = null, error = null;
  try {
    solver ||= createSolver({ bits: 22, thinkBits: 20 });
    result = hardMove(moves, { solver, big: true });
  } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, result, error });
};
