// A chess board for puzzles: the position from the solver's side, the opponent's move played first, then taps
// (a piece, then a square, with the legal targets shown) checked against the puzzle's solution move by move.
// Any move that gives checkmate is accepted where the solution's move does (Lichess's rule). Uses chess.js for
// the rules and the cburnett pieces.
import { Chess } from "./vendor/chess.js";
import { PIECES } from "./chess-pieces.js";

const SVG = "http://www.w3.org/2000/svg";
const FILES = "abcdefgh";
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

/** The solution's moves in SAN, for notes: played out from the puzzle's start. */
export function solutionSan(puzzle) {
  const c = new Chess(puzzle.fen);
  return puzzle.moves.map(m => c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })?.san || m);
}

/**
 * Mounts a puzzle board in `container`. opts: { onDone(solved), interactive, revealSolution }. Returns
 * { destroy() }. The board plays the opponent's first move after a beat, then waits for taps.
 */
export function mountPuzzle(container, puzzle, opts = {}) {
  const chess = new Chess(puzzle.fen);
  const solver = chess.turn() === "w" ? "b" : "w";                 // the opponent moves first
  let step = 0;                                                      // index into puzzle.moves
  let selected = null, done = false, last = null, hint = null;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const svg = el("svg", { viewBox: "0 0 8 8", class: "ch-board" });
  container.replaceChildren(svg);

  const uci = m => m.from + m.to + (m.promotion || "");
  const squareAt = (file, rank) => FILES[file] + (rank + 1);
  // screen coordinates: the solver's side at the bottom
  const xy = sq => { const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1; return solver === "w" ? [f, 7 - r] : [7 - f, r]; };

  function draw() {
    svg.replaceChildren();
    const legal = selected ? chess.moves({ square: selected, verbose: true }) : [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = squareAt(f, r), [x, y] = xy(sq), dark = (f + r) % 2 === 0;
      const isLast = last && (last.from === sq || last.to === sq);
      const rect = el("rect", { x, y, width: 1, height: 1, class: `sq ${dark ? "dark" : "light"}${isLast ? " last" : ""}${selected === sq ? " sel" : ""}${hint === sq ? " hint" : ""}` });
      rect.addEventListener("click", () => tap(sq));
      svg.appendChild(rect);
    }
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = squareAt(f, r), piece = chess.get(sq);
      if (!piece) continue;
      const [x, y] = xy(sq);
      const g = el("g", { transform: `translate(${x} ${y}) scale(${1 / 45})`, class: "piece" });
      g.innerHTML = PIECES[(piece.color === "w" ? "w" : "b") + piece.type.toUpperCase()];
      g.addEventListener("click", () => tap(sq));
      svg.appendChild(g);
    }
    for (const m of legal) {
      const [x, y] = xy(m.to);
      const dot = el("circle", { cx: x + 0.5, cy: y + 0.5, r: chess.get(m.to) ? 0.42 : 0.14, class: `target${chess.get(m.to) ? " capture" : ""}` });
      dot.addEventListener("click", () => tap(m.to));
      svg.appendChild(dot);
    }
    if (chess.inCheck()) { const k = kingSquare(chess.turn()); if (k) { const [x, y] = xy(k); svg.insertBefore(el("rect", { x, y, width: 1, height: 1, class: "sq check" }), svg.children[64]); } }
  }
  function kingSquare(colour) { for (const row of chess.board()) for (const p of row) if (p && p.type === "k" && p.color === colour) return p.square; return null; }

  function play(m) { const mv = chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); last = mv ? { from: mv.from, to: mv.to } : null; return mv; }
  function tap(sq) {
    if (done || !opts.interactive || chess.turn() !== solver || step >= puzzle.moves.length) return;
    const piece = chess.get(sq);
    if (selected && selected !== sq) {
      const legal = chess.moves({ square: selected, verbose: true }).filter(m => m.to === sq);
      if (legal.length) {
        const expected = puzzle.moves[step];
        // the expected move, including its promotion; otherwise promote as the solution does, else to a queen
        const promotion = expected.slice(0, 4) === selected + sq ? (expected[4] || undefined) : legal.some(m => m.promotion) ? "q" : undefined;
        const trial = new Chess(chess.fen());
        const mv = trial.move({ from: selected, to: sq, promotion });
        const right = uci(mv) === expected || (trial.isCheckmate() && solutionMates());
        selected = null;
        if (!right) { fail(mv); return; }
        play(uci(mv)); step++;
        draw();
        if (step >= puzzle.moves.length) { finish(true); return; }
        later(() => { play(puzzle.moves[step]); step++; draw(); if (step >= puzzle.moves.length) finish(true); }, 450);
        return;
      }
    }
    selected = piece && piece.color === solver ? sq : null;
    draw();
  }
  /** Does the solution's next move give checkmate? */
  function solutionMates() { const t = new Chess(chess.fen()); const m = puzzle.moves[step]; t.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); return t.isCheckmate(); }
  function fail(mv) {
    // show the wrong move, then the move that was wanted
    const wanted = puzzle.moves[step];
    last = { from: mv.from, to: mv.to };
    hint = null;
    draw();
    later(() => { hint = wanted.slice(2, 4); last = { from: wanted.slice(0, 2), to: wanted.slice(2, 4) }; draw(); }, 500);
    finish(false);
  }
  function finish(solved) { if (done) return; done = true; selected = null; draw(); opts.onDone?.(solved); }

  draw();
  // the opponent's move comes after a beat so the position registers first; a revealed board shows the whole line
  if (opts.revealSolution) {
    for (const m of puzzle.moves) play(m);
    step = puzzle.moves.length; done = true; draw();
  } else later(() => { play(puzzle.moves[0]); step = 1; draw(); }, 600);
  return { destroy() { timers.forEach(clearTimeout); }, get solver() { return solver; } };
}
