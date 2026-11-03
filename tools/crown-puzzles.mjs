// Crown's shots found by the search: positions from the computer's own games where the winning move is a sacrifice (a
// man given up so that a compulsory jump drags a piece out of place and the reply takes more). A position is kept when
// every move is a quiet one, the best is clear of the next by more than a man, the best wins material the position
// doesn't already have, and it gives a piece for the opponent to take. Rated by how deep the search has to look to find it.
// Writes crown-puzzles.js (the course's third lesson and the daily shot read it). Not run by CI.
//   node tools/crown-puzzles.mjs sample <set> <first seed> <games> <out.jsonl>
//   node tools/crown-puzzles.mjs merge <files…>
import fs from "fs";
import { toArray, toText, movesOf, play, counts, SETS, geo as geoOf } from "../crown-board.js";
import { engineFor } from "../crown-search.js";
import { rules, legalMoves } from "../crown-rules.js";
import { moveName, piecesText } from "../crown-course.js";
import { seeded } from "../seats.js";

const [, , cmd, ...args] = process.argv;

function analyse(set, board, side) {
  const e = engineFor(set), b = toArray(board);
  const root = movesOf(set, b, side);
  if (root.length < 2 || root[0].caps.length) return null;
  // a cheap look first: nothing is worth the deep search unless a quiet move already stands out
  const quick = e.search(b, side, { nodes: 3000, depth: 5, noise: 1, rng: () => 0 });
  if (quick.moves.length < 2 || quick.moves[0].score - quick.moves[1].score < 100) return null;
  let final = null;
  const deep = e.search(b, side, { nodes: 150000, depth: 9, noise: 1, rng: () => 0 });
  const ms = deep.moves;
  if (ms.length < 2) return null;
  const [best, second] = ms, stat = e.evaluate(b, side);
  if (best.score - second.score < 120 || best.score < stat + 70 || best.score > 9000) return null;
  const after = play(b, best.move);
  const reply = movesOf(set, after, 1 - side);
  if (!reply.length || !reply[0].caps.length) return null;
  // how deep the search must look before it settles on this move with a clear margin
  let needs = 9;
  for (let d = 2; d <= 9; d++) {
    const r = e.search(b, side, { nodes: 150000, depth: d, noise: 1, rng: () => 0 });
    if (r.moves[0].move.path.join() === best.move.path.join() && r.moves[0].score - (r.moves[1]?.score ?? -1e5) >= 100) { needs = d; break; }
  }
  // the line: our sacrifice, their best reply, our best, their best, our best
  const line = [moveName(set, best.move)];
  let cur = after, s = 1 - side;
  for (let i = 0; i < 4; i++) {
    const r = e.search(cur, s, { nodes: 20000, depth: 6 });
    if (!r.move) break;
    line.push(moveName(set, r.move));
    cur = play(cur, r.move); s = 1 - s;
  }
  const c0 = counts(b), c1 = counts(cur), mine = side * 2;
  const material = c => c[0] + c[1] * 1.5 + 0 - (c[2] + c[3] * 1.5);
  const gain = (side === 0 ? 1 : -1) * (material(c1) - material(c0));
  return { set, side, pieces: piecesText(set, board), answer: moveName(set, best.move), line, needs, gap: best.score - second.score, gain: Math.round(gain * 10) / 10, men: c0.reduce((a, b2) => a + b2, 0), mine };
}

if (cmd === "sample") {
  const [set, first, games, out] = args;
  const seen = new Set(), found = [];
  for (let g = 0; g < Number(games); g++) {
    const seed = Number(first) + g, rng = seeded(seed);
    let s = rules.deal({ options: { set }, rng, now: 0 });
    for (let i = 0; i < 6; i++) { const l = legalMoves(s); s = rules.act(s, s.turn, { path: l[Math.floor(rng() * l.length)].path }, { rng, now: 0 }); }
    for (let ply = 0; ply < 120 && !s.result; ply++) {
      const side = s.ply % 2, tot = counts(toArray(s.board)).reduce((a, b) => a + b, 0);
      if (ply >= 4 && tot <= (SETS[set].size === 10 ? 22 : 16) && !seen.has(s.board + side)) {
        seen.add(s.board + side);
        const r = analyse(set, s.board, side);
        if (r && r.gain >= 0.9) { found.push(r); fs.appendFileSync(out, JSON.stringify(r) + "\n"); }
      }
      const level = ply % 3 === 0 ? "easy" : "medium";
      const m = rules.bot(s, s.turn, { level, rng });
      s = rules.act(s, s.turn, m, { rng, now: 0 });
    }
  }
  console.log(`${set}: ${found.length} shots from ${args[2]} games`);
} else if (cmd === "random") {
  // small random positions: a few men a side, none yet crowned, the side to move with only quiet moves
  const [set, first, count, out] = args, g = geoOf(set);
  const rng = seeded(Number(first));
  let found = 0, tried = 0;
  for (let i = 0; i < Number(count); i++) {
    const a = new Int8Array(g.N), n = [3 + Math.floor(rng() * 4), 3 + Math.floor(rng() * 4)];
    for (let side = 0; side < 2; side++) for (let k = 0; k < n[side]; k++) {
      for (let tries = 0; tries < 20; tries++) {
        const sq = Math.floor(rng() * g.N), r = g.row[sq];
        if (a[sq] || (side === 0 ? r < 2 || r > g.S - 1 : r > g.S - 3 || r < 0)) continue;
        a[sq] = side === 0 ? 1 : -1;
        break;
      }
    }
    const board = toText(a), side = rng() < 0.5 ? 0 : 1;
    tried++;
    const r = analyse(set, board, side);
    if (r && r.gain >= 0.9) { found++; fs.appendFileSync(out, JSON.stringify(r) + "\n"); }
  }
  console.log(`${set}: ${found} shots from ${tried} random positions`);
} else if (cmd === "merge") {
  const all = [];
  for (const f of args) for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) all.push(JSON.parse(l));
  const uniq = new Map(all.map(p => [`${p.set}:${p.pieces}:${p.side}`, p]));
  const list = [...uniq.values()].sort((a, b) => a.set.localeCompare(b.set) || a.needs - b.needs || a.men - b.men);
  const head = `// Crown's shots, found by tools/crown-puzzles.mjs (don't edit: run it again). Each is a position from the computer's own games where\n// the best move is a sacrifice that wins material, written as the course writes a step (crown-course.js: set, pieces, side), with\n// the move, the line the search plays on from it, how deep the search must look (needs) and what it gains, in men.\n`;
  fs.writeFileSync(new URL("../crown-puzzles.js", import.meta.url), `${head}export const SHOTS = [\n${list.map(p => JSON.stringify(p)).join(",\n")},\n];\n`);
  console.log(`${list.length} shots written`);
}
