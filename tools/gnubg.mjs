// GNU Backgammon, asked from Node, for the tools that write Gammon's lessons and puzzles (never the game itself: gnubg is
// GPL, so only its answers are kept here). It's the @nodots-llc/gnubg-hints package, a native add-on round gnubg's
// evaluation (2-ply, its default): GNUBG_HINTS names where it's installed (its folder, with dist/ and the .wd and .bd
// files beside it). Money play throughout: no match score, no Jacoby rule, the cube in the middle unless said.
// Positions are ours (gammon-board.js: each side in its own numbering, [25] the bar, [0] off); gnubg is handed the
// board as the package draws one, the side on roll moving clockwise from its 24 to its 1.
import { createRequire } from "node:module";
import { playText } from "../gammon-course.js";
import { apply } from "../gammon-board.js";

const require = createRequire(import.meta.url);
let engine = null;
/** gnubg, started once (from the folder its weights are in). */
export async function gnubg() {
  if (engine) return engine;
  const dir = process.env.GNUBG_HINTS;
  if (!dir) throw new Error("set GNUBG_HINTS to the folder of @nodots-llc/gnubg-hints");
  const cwd = process.cwd();
  process.chdir(`${dir}/..`);                        // its weights and bear-off databases are looked for from here
  ({ GnuBgHints: engine } = require(`${dir}/dist/index.js`));
  await engine.initialize();
  process.chdir(cwd);
  return engine;
}
export const shutdown = () => engine?.shutdown();

/** A position as the package takes it: the side on roll white, moving clockwise (its point n the board's n). */
function request(me, op, extra = {}) {
  const many = (n, color) => Array.from({ length: n }, () => ({ color }));
  const points = [];
  for (let n = 1; n <= 24; n++) points.push({ position: { clockwise: n, counterclockwise: 25 - n }, checkers: [...many(me[n], "white"), ...many(op[25 - n], "black")] });
  const board = {
    points,
    bar: { clockwise: { checkers: many(me[25], "white") }, counterclockwise: { checkers: many(op[25], "black") } },
    off: { clockwise: { checkers: many(me[0], "white") }, counterclockwise: { checkers: many(op[0], "black") } },
  };
  return { board, activePlayerColor: "white", activePlayerDirection: "clockwise", cubeValue: 1, cubeOwner: null, matchScore: [0, 0], matchLength: 0, crawford: false, jacoby: false, beavers: false, ...extra };
}

/**
 * gnubg's plays for a roll, best first, for the side on roll: [{ moves ([from, to] in our numbering), text ("8/5 6/5"),
 * me, op (the board after), equity (cubeful, money), win, gammon }].
 */
export async function hints(me, op, dice, n = 8) {
  const g = await gnubg(), out = await g.getMoveHints({ ...request(me, op), dice }, n);
  return out.map(h => {
    const moves = h.moves.map(m => [m.fromContainer === "bar" ? 25 : m.from, m.toContainer === "off" ? 0 : m.to]);
    let m = me, o = op;
    for (const mv of moves) [m, o] = apply(m, o, mv);
    return { moves, text: playText(moves, op), me: m, op: o, equity: h.equity, win: h.evaluation?.win, gammon: h.evaluation?.winGammon };
  });
}

/**
 * gnubg on the cube, the side on roll (me) before rolling: whether to double, and whether the other side should take.
 * owner: null (the cube in the middle), "me" or "op". Returns { double: "double" | "no-double" | "too-good",
 * take: "take" | "drop", cubeful (my equity playing on, the cube where it is), takeEquity (mine if I double and they
 * take, against the 1 a drop gives me) }. The package answers the double for the side its request puts on roll
 * (fMoveOverride 1) and the take with its override at 0: asked with 1, its take verdicts made no sense (a take 37%
 * behind in a race), where with 0 they follow the 8-9-12 rule, dropping between 9% and 11% behind.
 */
export async function cube(me, op, { value = 1, owner = null } = {}) {
  const g = await gnubg(), at = f => request(me, op, { cubeValue: value, cubeOwner: owner === "me" ? "white" : owner === "op" ? "black" : null, fMoveOverride: f });
  const d = await g.getDoubleHint(at(1)), t = await g.getTakeHint(at(0));
  return { double: d.action, take: t.action, cubeful: d.cubefulEquity, takeEquity: t.takeEquity };
}
