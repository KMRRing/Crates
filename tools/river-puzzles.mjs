// Finds River's rush puzzles (river-puzzles.txt): Xiangqi tactics in games River's own levels play among themselves,
// checked by Fairy-Stockfish as Lichess checks the puzzles it finds in players' games. A game is played first, between
// two neighbouring levels from Beginner to Master (its first few moves Novice's, so no two open alike); then at each of
// its positions the moves the side to move might make are tried as mistakes: the move played, the ten a weak player
// weighs (the engine's best after 2,000 positions, Beginner's way of looking) and, where a strong level was to move,
// the five it weighs at its own search. They're searched together (UCI's searchmoves, 40,000 positions, three times
// that for a strong level's), and a move is a mistake when it leaves the other side three soldiers' worth ahead from no
// more than three before, its winning chances (uci-coach.js's curve, at Xiangqi's scale) up by 0.3 or more, or lets in a
// mate. The position after it is a puzzle when the other side's best move is the only one that wins: winning chances
// at least 0.5 above the second best's at a glance (40,000 positions, two best moves), and again on 200,000; for a mate
// in more than one, no other move that mates and none winning about a chariot's worth. The line goes on, the loser
// answering with the engine's best defence (100,000 positions), while each of the winner's moves is the only one, up
// to four of them, and stops at the first that isn't (the advantage then in hand); a winner's move that falls below two
// and a half soldiers' worth throws the puzzle out. It ends on the winner's move, and a last move that was the only
// legal one is cut, since it asks nothing. Where the line mates, the page accepts any move that mates. One puzzle a
// position at most, the next four plies passed over after one, and twelve a game at most, so a game's puzzles aren't
// one position again and again.
//
// Rated by how River's levels fare at it (rate, below), and kept as found: one JSON line each, with each solver's chance;
// merge rates them again, puts the bank together easiest first and gives each an id from its position and line.
//
//   node tools/river-puzzles.mjs find <first game> <games> <out.jsonl>    the games' seeds run from <first game>
//   node tools/river-puzzles.mjs merge <found.jsonl…>                    writes river-puzzles.txt
// FAIRY=<a native fairy-stockfish> searches twice as fast as the page's WebAssembly, with the same results (built from
// the same commit: make build ARCH=x86-64-bmi2 largeboards=yes nnue=no). Two at once, on different games, use both cores.
// TRACE=1 says why each mistake tried was turned away.
import fs from "node:fs";
import { spawn } from "node:child_process";
import * as X from "../river-rules.js";
import { LEVELS, SETUP } from "../river-levels.js";
import { Engine, levelMove, valueOf } from "../uci.js";
import { chances, scoreOf } from "../uci-coach.js";
import { fairyWorker } from "./uci-node.mjs";

const SCALE = 1.25;                                              // Xiangqi's centipawns to chess's, as the coach reads them
const GLANCE = "nodes 40000", DEEP = "nodes 200000", REPLY = "nodes 100000";
const FULL = { "Skill Level": 20, UCI_LimitStrength: false };
const MOST = 4;                                                  // the winner's moves in a line, at most
const LEAD = 250, BEFORE = 300, JUMP = 0.3;                      // the swing that marks a mistake
const HOLD = 250, GAP = 0.5, MATE_GAP = 0.12;                    // the line: still winning, and the only move
const WXF = ".KAEHRCP";                                          // a piece's letter, for the themes

/** The engine in a process of its own: the native build FAIRY names, else the page's WebAssembly in this one. */
function worker() {
  const bin = process.env.FAIRY;
  if (!bin) return fairyWorker();
  const w = { onmessage: null, onerror: null };
  const child = spawn(bin, [], { stdio: ["pipe", "pipe", "ignore"] });
  let carry = "";
  child.stdout.on("data", d => {
    carry += d;
    for (let i = carry.indexOf("\n"); i >= 0; i = carry.indexOf("\n")) { const line = carry.slice(0, i).replace(/\r$/, ""); carry = carry.slice(i + 1); w.onmessage?.({ data: line }); }
  });
  child.on("error", e => w.onerror?.({ message: String(e?.message || e) }));
  w.postMessage = cmd => child.stdin.write(`${cmd}\n`);
  w.terminate = () => { try { child.stdin.write("quit\n"); child.kill(); } catch { /* gone */ } };
  return w;
}
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const ranked = r => r.lines.filter(l => l.pv?.length).sort((a, b) => valueOf(b) - valueOf(a));
/** The position after a line of moves from a FEN. */
function walk(fen, moves) {
  let pos = X.parseFen(fen);
  for (const u of moves) { const m = X.parseUci(u); pos = X.after(pos, m.from, m.to); }
  return pos;
}
/** Whether a move leaves the other side no move: mate (將死) or no move left (困斃), a win either way. */
const ends = (pos, uci) => { const m = X.parseUci(uci); return !X.legalMoves(X.after(pos, m.from, m.to)).length; };

// ---------- finding ----------
// the levels that play the games (indexes into LEVELS, Red's and Black's): neighbours from Beginner to Master, so the
// positions run from a beginner's muddle to a master's
const PAIRS = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2], [2, 3], [3, 2], [3, 3], [3, 4], [4, 3], [4, 4], [4, 5], [5, 4], [5, 5], [5, 6], [6, 5]];
// The mistakes tried at each position: the move played, those a weak player weighs (the engine's ten best after 2,000
// positions, Beginner's way of looking), and where a strong level is to move, the five it weighs at its own search: a
// mistake among them is one somebody might make, a strong level's the kind only a deeper look refutes. They're searched
// together (40,000 positions, three times that where a strong level moved). One puzzle a position at most, and the next
// four plies passed over after one, so a game's puzzles aren't the same position again.
const PLAUSIBLE = { limit: "nodes 2000", multipv: 10 }, CHECK = 40000, SPACING = 4, PER_GAME = 12;

async function find([firstArg = "1", countArg = "10", out = "river-puzzles.jsonl"]) {
  const first = Number(firstArg), count = Number(countArg);
  const player = new Engine(worker, { setup: SETUP }), analyst = new Engine(worker, { setup: SETUP }), rater = new Engine(worker, { setup: SETUP });
  const file = fs.createWriteStream(out, { flags: "a" }), seen = new Set();
  let kept = 0;
  const t0 = Date.now();
  for (let seed = first; seed < first + count; seed++) {
    const r = rng(seed * 7919 + 17), [red, black] = PAIRS[Math.floor(r() * PAIRS.length)];
    const opening = 2 + Math.floor(r() * 7);                     // the first plies Novice's, so no two games open alike
    // the game
    const moves = [], positions = [X.parseFen()];
    for (let ply = 0; ply < 200; ply++) {
      const pos = positions[ply];
      if (!X.legalMoves(pos).length || X.outcome({ start: X.START, moves: moves.join(" ") })) break;
      const level = ply < opening ? LEVELS[1] : LEVELS[ply % 2 === 0 ? red : black];
      const { move } = await levelMove(player, level, { fen: X.START, moves, rand: r });
      const m = X.parseUci(move);
      if (!m || !X.isLegal(pos, m.from, m.to)) throw new Error(`${level.name} played ${move}, not legal`);
      moves.push(move);
      positions.push(X.after(pos, m.from, m.to));
    }
    let found = 0, lastAt = -SPACING;
    // its positions, each side's mistakes tried in turn: the moves weighed searched together (UCI's searchmoves, each
    // with its score), the best of them the side's lead before it errs
    for (let ply = opening + 1; ply < moves.length && found < PER_GAME; ply++) {
      if (ply - lastAt < SPACING) continue;
      const fen = X.toFen(positions[ply]);
      const mover = ply < opening ? LEVELS[1] : LEVELS[ply % 2 === 0 ? red : black], strong = !mover.temper;
      const weighed = ranked(await analyst.search({ fen, limit: PLAUSIBLE.limit, options: { ...FULL, MultiPV: PLAUSIBLE.multipv } })).map(l => l.pv[0]);
      const own = strong ? ranked(await analyst.search({ fen, limit: mover.limit, options: { ...FULL, MultiPV: 5 } })).map(l => l.pv[0]) : [];
      const tries = [...new Set([moves[ply], ...own, ...weighed])];
      const nodes = strong ? 3 * CHECK : CHECK;
      const worth = ranked(await analyst.search({ fen, limit: `nodes ${nodes} searchmoves ${tries.join(" ")}`, options: { ...FULL, MultiPV: tries.length } }));
      if (!worth.length) continue;
      const before = -scoreOf(worth[0]);                         // the other side's lead before the mistake
      if (worth[0].mate < 0) continue;                           // mated already: nothing left to give away
      const blunders = worth.slice(1).filter(l => {
        const now = -scoreOf(l);                                 // the other side's lead after it
        return l.mate < 0 || (now >= LEAD && before <= BEFORE && chances(now, SCALE) - chances(before, SCALE) >= JUMP);
      }).map(l => l.pv[0]).sort(() => r() - 0.5);
      for (const blunder of blunders) {
        if (seen.has(`${fen}|${blunder}`)) continue;
        seen.add(`${fen}|${blunder}`);
        const p = await puzzle(analyst, rater, fen, blunder);
        if (!p) continue;
        file.write(`${JSON.stringify({ ...p, game: seed, ply, levels: [red, black] })}\n`);
        kept++; found++; lastAt = ply;
        break;
      }
    }
    console.log(`game ${seed} (${LEVELS[red].name} against ${LEVELS[black].name}): ${moves.length} plies, ${found} puzzles; ${kept} in all, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  for (const e of [player, analyst, rater]) e.stop();
  file.end();
}

/**
 * The puzzle that starts with `blunder` from `fen`, if there is one: { fen, moves (the blunder, then the winner's moves
 * and the replies, in the engine's words), theme ("mate", or the pieces the line takes: "+R-C", a chariot for a
 * cannon), rating, by (each level's chance of solving it) }.
 */
const why = (...a) => { if (process.env.TRACE) console.log("   ", ...a); return null; };   // TRACE: why a mistake isn't a puzzle
async function puzzle(analyst, rater, fen, blunder) {
  const moves = [blunder], only = [];                            // only[k]: the winner's k-th move was the only legal one
  // a glance first, which turns most mistakes away (two good answers, or none) for a fifth of the deep search
  const [g1, g2] = ranked(await analyst.search({ fen, moves, limit: GLANCE, options: { ...FULL, MultiPV: 2 } }));
  if (!g1) return why("no line");
  if (g1.mate > 1 && g2?.mate > 0) return why("two mates at a glance");
  if (!(g1.mate > 0) && (scoreOf(g1) < HOLD || (g2 && chances(scoreOf(g1), SCALE) - chances(scoreOf(g2), SCALE) < GAP - 0.1))) return why("not alone at a glance");
  for (let k = 0; k < MOST; k++) {
    const pos = walk(fen, moves), legal = X.legalMoves(pos);
    if (!legal.length) break;
    const [best, second] = ranked(await analyst.search({ fen, moves, limit: DEEP, options: { ...FULL, MultiPV: 2 } }));
    if (!best) return why("no line");
    const move = best.pv[0];
    if (best.mate > 0) {
      // a mate: the only one (where it mates at once, any mate counts on the page)
      if (best.mate > 1 && second && (second.mate > 0 || chances(scoreOf(best), SCALE) - chances(scoreOf(second), SCALE) < MATE_GAP)) return why(k, "mate not alone", best.mate, second.mate ?? second.cp);
    } else {
      if (scoreOf(best) < HOLD) return why(k, "not winning", best.cp);   // the win was an illusion
      if (second && chances(scoreOf(best), SCALE) - chances(scoreOf(second), SCALE) < GAP) {
        if (k === 0) return why(k, "not alone", best.cp, second.mate ?? second.cp);   // not one answer
        moves.pop();                                            // the advantage in hand: the line ends on the winner's last move
        break;
      }
    }
    if (k === 0 && legal.length < 2) return null;
    moves.push(move);
    only.push(legal.length === 1);
    if (ends(pos, move)) break;
    if (k === MOST - 1) break;
    const reply = (await analyst.search({ fen, moves, limit: REPLY, options: { ...FULL, MultiPV: 1 } })).best;
    if (!reply) break;
    moves.push(reply);
  }
  // the line ends on the winner's move (an even length: the blunder, then the winner's and the replies in turn), and
  // not on one that was the only legal move, which asks nothing
  if (moves.length % 2 === 1) moves.pop();
  while (moves.length > 2 && only[(moves.length - 2) / 2]) moves.splice(-2, 2);
  if (moves.length < 2) return null;
  const end = walk(fen, moves.slice(0, -1)), mates = ends(end, moves.at(-1));
  return { fen, moves: moves.join(" "), theme: mates ? "mate" : taken(fen, moves), ...(await rate(rater, fen, moves, mates)) };
}

/** What the line takes, the blunder aside: "+" and the winner's captures, "-" and the other side's, by WXF letter. */
function taken(fen, moves) {
  let pos = walk(fen, moves.slice(0, 1)), mine = "", theirs = "";
  moves.slice(1).forEach((u, i) => {
    const m = X.parseUci(u), v = Math.abs(pos.b[m.to]);
    if (v) { if (i % 2 === 0) mine += WXF[v]; else theirs += WXF[v]; }
    pos = X.after(pos, m.from, m.to);
  });
  const order = s => [...s].sort((a, b) => "RCHAEPK".indexOf(a) - "RCHAEPK".indexOf(b)).join("");
  return mine || theirs ? `+${order(mine)}${theirs ? `-${order(theirs)}` : ""}` : "";
}

// ---------- rating ----------
// A puzzle is rated by how River's levels fare at it. The solvers: the four drawing levels as they play, and the engine
// at full strength after a ladder of searches, which takes in the three levels that play that way (Strong club's 1,500
// positions, Expert's 4,000, Master's 20,000). Each is rated: the levels as River's levels are, the rest of the ladder
// between them by the doublings of its search (Full strength's 500,000 positions are 2,700, and taken to solve every
// puzzle, since a search like its own found it), about 110 to 140 points a doubling, and below 1,500 at the first
// step's rate. The puzzle's rating is the one under which the solvers' chances are likeliest by the Elo model (a
// solver rated R solves a puzzle rated r with chance 1 / (1 + 10^((r − R) / 400))), drawn a little toward 1,300 (a
// normal prior, 700 wide) so a puzzle every solver gets isn't rated minus infinity.
const ANCHORS = [[1500, 1700], [4000, 1900], [20000, 2200], [500000, 2700]];
function ratingAt(nodes) {
  const x = Math.log2(nodes), i = Math.max(0, Math.min(ANCHORS.length - 2, ANCHORS.findIndex(([n]) => n > nodes) - 1));
  const [[n0, r0], [n1, r1]] = [ANCHORS[i], ANCHORS[i + 1]];
  return Math.round(r0 + (r1 - r0) * (x - Math.log2(n0)) / (Math.log2(n1) - Math.log2(n0)));
}
const PROBES = [
  ...LEVELS.filter(l => l.temper).map(l => ({ key: `L${l.id}`, ...l })),
  ...[1000, 1500, 2500, 4000, 8000, 20000].map(n => ({ key: `n${n}`, limit: `nodes ${n}`, rating: ratingAt(n) })),
];
const RATED = Object.fromEntries([...PROBES.map(p => [p.key, p.rating]), ["n500000", 2700]]);

/** Each solver's chance of playing the whole line (any mate where it mates), searching each position afresh (an empty
 *  hash) as it would in a game: certain or nil for the engine's own move, choose()'s weights for a drawing level. */
async function rate(engine, fen, moves, mates) {
  const by = {};
  for (const P of PROBES) {
    engine.worker?.postMessage("ucinewgame");                   // nothing from the other solvers' searches
    let p = 1;
    for (let i = 1; i < moves.length && p > 0; i += 2) {
      const pos = walk(fen, moves.slice(0, i)), last = i === moves.length - 1;
      const right = u => u === moves[i] || (last && mates && ends(pos, u));
      const r = await engine.search({ fen, moves: moves.slice(0, i), limit: P.limit, options: { ...FULL, MultiPV: P.multipv || 1 } });
      if (!P.temper) { p *= right(r.best) ? 1 : 0; continue; }
      // choose()'s draw: each move weighted by exp(−loss / temper), its loss against the best, scores past ten pawns
      // alike, except that a mate it has seen ranks above them (in a game any winning move will do, and the level takes
      // whichever; a player who has seen a mate plays it)
      const lines = r.lines.filter(l => l.pv?.length), worth = l => (l.mate > 0 ? 1100 - l.mate : Math.max(-1000, Math.min(1000, valueOf(l))));
      const top = Math.max(...lines.map(worth)), w = lines.map(l => Math.exp(-(top - worth(l)) / P.temper));
      const all = w.reduce((a, b) => a + b, 0);
      p *= all ? lines.reduce((s, l, j) => s + (right(l.pv[0]) ? w[j] : 0), 0) / all : 0;
    }
    by[P.key] = Number(p.toFixed(3));
  }
  by.n500000 = 1;                                                // Full strength: a search like its own found it
  return { rating: fit(by), by };
}
/** The rating likeliest to give the solvers' chances (by: key → chance), with a normal prior about 1,300, 700 wide. */
function fit(by) {
  let best = null;
  for (let r = 300; r <= 3000; r += 5) {
    let ll = -((r - 1300) ** 2) / (2 * 700 ** 2);
    for (const [key, p] of Object.entries(by)) {
      if (!(key in RATED)) continue;
      const q = 1 / (1 + 10 ** ((r - RATED[key]) / 400));
      ll += p * Math.log(q) + (1 - p) * Math.log(1 - q);
    }
    if (!best || ll > best.ll) best = { r, ll };
  }
  return best.r;
}

// ---------- the bank ----------
/** A puzzle's id, from its position and line, so it stays the same as the bank grows: six base-36 digits of FNV-1a. */
function idOf(p) {
  let h = 0x811c9dc5;
  for (const ch of `${p.fen}|${p.moves}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).padStart(7, "0").slice(-6);
}
/** The found puzzles as the page reads them, one a line: id|fen|moves|rating|theme, easiest first; a position found
 *  twice is kept once. */
function merge(files) {
  // a line still being written by a find that's running is passed over
  const all = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } }));
  const seen = new Set(), keep = [];
  for (const p of all) {
    const key = X.keyOf(walk(p.fen, p.moves.split(" ").slice(0, 1)));
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(p);
  }
  for (const p of keep) p.rating = fit(p.by);
  keep.sort((a, b) => a.rating - b.rating || (a.fen < b.fen ? -1 : 1));
  const lines = keep.map(p => `${idOf(p)}|${p.fen.split(" ").slice(0, 2).join(" ")}|${p.moves}|${p.rating}|${p.theme}`);
  fs.writeFileSync(new URL("../river-puzzles.txt", import.meta.url), `${lines.join("\n")}\n`);
  const bands = {};
  for (const p of keep) { const b = Math.max(600, Math.min(2400, Math.floor(p.rating / 200) * 200)); bands[b] = (bands[b] || 0) + 1; }
  console.log(`${keep.length} puzzles (${all.length - keep.length} found twice); by band ${Object.entries(bands).map(([b, n]) => `${b}: ${n}`).join(", ")}; mates ${keep.filter(p => p.theme === "mate").length}`);
}

if (process.argv[2] === "merge") merge(process.argv.slice(3));
else if (process.argv[2] === "find") await find(process.argv.slice(3));
else console.log("node tools/river-puzzles.mjs find <first game> <games> <out.jsonl> | merge <found.jsonl…>");
