// Finds the positions Flank's course teaches with: each lesson's puzzle is a position from a real game whose best move
// the exact solver proves (every legal move solved to the end of the game), picked to show one idea.
//   corner    the corner on offer is the one best move, clear of the rest
//   x         the move turning the most discs is on a square beside an empty corner and loses; another move wins by more
//   mobility  the best move is the one leaving the other side fewest replies, and the greedy move is clearly worse
//   parity    two or more separate regions of empty squares; the best move is in a region of odd size, and a move in
//             an even one loses by a margin
//   end       a few squares left, one best move clear of the rest, not the move turning the most discs
// Prints candidates as JSON lines, for choosing by hand (flank-course.js keeps the chosen ones; tests/flank-course.mjs
// solves each again). CI does not run this.
//   node tools/flank-puzzles.mjs [games=200] [kinds=corner,x,mobility,parity,end] [seed=1] [lo=6] [hi=12] [levels=easy,medium]
// (the games are played by those levels, a random pick for each move: medium alone gives the closest positions)
import { position, play, movesOf, turnsOf, sqName } from "../flank-board.js";
import { rootScores } from "../flank-engine.js";
import { chooseMove, sidesOf } from "../flank-bot.js";
import { exactMargin } from "../flank-think.js";
import { seeded } from "../seats.js";

const [games = "200", kinds = "corner,x,mobility,parity,end", seed = "1", lo = "6", hi = "12", levels = "easy,medium"] = process.argv.slice(2);
const LEVELS = levels.split(",");
const want = new Set(kinds.split(","));
const CORNERS = new Set([0, 7, 56, 63]);
const X_OF = { 9: 0, 14: 7, 49: 56, 54: 63 };
const empties = b => [...b].filter(c => c === ".").length;
/** The regions of empty squares (connected, diagonals too): lists of squares. */
export function regions(b) {
  const seen = new Set(), out = [];
  for (let s = 0; s < 64; s++) {
    if (b[s] !== "." || seen.has(s)) continue;
    const region = [], stack = [s];
    seen.add(s);
    while (stack.length) {
      const q = stack.pop();
      region.push(q);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = (q >> 3) + dr, c = (q & 7) + dc, n = r * 8 + c;
        if (r < 0 || r > 7 || c < 0 || c > 7 || b[n] !== "." || seen.has(n)) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    out.push(region.sort((x, y) => x - y));
  }
  return out;
}
const reply = (p, sq) => { const n = play(p, sq); return n && !n.over && n.t !== p.t ? movesOf(n).length : 0; };

const rng = seeded(Number(seed));
const found = { corner: 0, x: 0, mobility: 0, parity: 0, end: 0 };
for (let g = 0; g < Number(games); g++) {
  let p = position(), n = 0;
  const shown = new Set();                      // one of a kind from a game: the next positions of it are the same lesson
  while (!p.over) {
    const e = empties(p.b);
    if (e <= Number(hi) && e >= Number(lo)) {
      const ms = movesOf(p);
      if (ms.length >= 3) {
        const [pl, ph, ol, oh] = sidesOf(p.b, p.t);
        const sc = rootScores(pl, ph, ol, oh, { exact: 64, all: true }).map(m => [m.sq, exactMargin(m.score)]).sort((a, b) => b[1] - a[1]);
        const best = sc[0], second = sc[1], gap = best[1] - second[1];
        const greedy = ms.map(s => [s, turnsOf(p, s).length]).sort((a, b) => b[1] - a[1])[0][0];
        const score = s => sc.find(x => x[0] === s)[1];
        // the learner always plays dark: a position with light to move is written with the colours swapped
        const swap = t => (p.t === "l" ? t.replace(/[dl]/g, c => (c === "d" ? "l" : "d")) : t);
        const out = (kind, extra = {}) => {
          if (shown.has(kind)) return;
          shown.add(kind);
          found[kind]++;
          console.log(JSON.stringify({ kind, b: swap(p.b), empties: e, best: sqName(best[0]), gap, scores: sc.map(([s, v]) => `${sqName(s)}:${v}`).join(" "), ...extra }));
        };
        if (want.has("corner") && CORNERS.has(best[0]) && gap >= 4) out("corner");
        const xs = ms.filter(s => s in X_OF && p.b[X_OF[s]] === ".");
        if (want.has("x") && xs.length && xs.includes(greedy) && !(best[0] in X_OF) && score(greedy) <= best[1] - 6 && gap >= 2) out("x", { greedy: sqName(greedy) });
        if (want.has("mobility") && gap >= 2 && greedy !== best[0] && score(greedy) <= best[1] - 4) {
          const mobs = ms.map(s => [s, reply(p, s)]).sort((a, b) => a[1] - b[1]);
          if (mobs[0][0] === best[0] && mobs[1][1] - mobs[0][1] >= 2 && reply(p, greedy) - mobs[0][1] >= 3) out("mobility", { greedy: sqName(greedy), replies: mobs.map(([s, m]) => `${sqName(s)}:${m}`).join(" ") });
        }
        if (want.has("parity") && gap >= 2) {
          const rs = regions(p.b), size = s => rs.find(r => r.includes(s)).length;
          const evenLoser = ms.find(s => size(s) % 2 === 0 && score(s) <= best[1] - 4);
          if (rs.length >= 2 && size(best[0]) % 2 === 1 && evenLoser != null) out("parity", { regions: rs.map(r => r.map(sqName).join(" ")).join(" | ") });
        }
        if (want.has("end") && e <= 8 && gap >= 6 && greedy !== best[0]) out("end", { greedy: sqName(greedy) });
      }
    }
    const level = LEVELS[Math.floor(rng() * LEVELS.length)];
    const m = n < 4 ? movesOf(p)[Math.floor(rng() * movesOf(p).length)] : chooseMove(p.b, p.t, level, rng);
    p = play(p, m);
    n++;
  }
}
console.error(JSON.stringify(found));
