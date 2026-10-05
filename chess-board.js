// A chess board for puzzles: the position from the solver's side, the opponent's move played first, then taps
// (a piece, then a square, with the legal targets shown) checked against the puzzle's solution move by move.
// Any move that gives checkmate is accepted where the solution's move does (Lichess's rule). Pieces can be
// dragged as well as tapped. A move made while it's the opponent's turn is a premove: it plays the instant the
// reply lands, if it's legal then, and counts like any other move. Uses chess.js for the rules and the cburnett
// pieces.
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
  let selected = null, done = false, last = null, want = null, premove = null, drag = null;   // want: the square the wanted move goes to, after a miss
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
    // the squares, then translucent highlights over them (last move, selection, premove, the wanted move), then
    // the coordinates in the edge squares, as a printed board has them
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = squareAt(f, r), [x, y] = xy(sq), dark = (f + r) % 2 === 0;
      svg.appendChild(el("rect", { x, y, width: 1, height: 1, class: `sq ${dark ? "dark" : "light"}` }));
      const marks = [last && (last.from === sq || last.to === sq) && "last", selected === sq && "sel", premove && (premove.from === sq || premove.to === sq) && "pre", want === sq && "want"].filter(Boolean);
      for (const m of marks) svg.appendChild(el("rect", { x, y, width: 1, height: 1, class: `hl ${m}` }));
    }
    for (let i = 0; i < 8; i++) {
      const fileSq = solver === "w" ? FILES[i] + "1" : FILES[7 - i] + "8", rankSq = solver === "w" ? "a" + (8 - i) : "h" + (i + 1);
      const [fx, fy] = xy(fileSq), [rx, ry] = xy(rankSq);
      const fileText = el("text", { x: fx + 0.93, y: fy + 0.95, class: `coord ${(FILES.indexOf(fileSq[0]) + Number(fileSq[1]) - 1) % 2 === 0 ? "on-dark" : "on-light"}`, "text-anchor": "end" });
      fileText.textContent = fileSq[0];
      const rankText = el("text", { x: rx + 0.07, y: ry + 0.3, class: `coord ${(FILES.indexOf(rankSq[0]) + Number(rankSq[1]) - 1) % 2 === 0 ? "on-dark" : "on-light"}` });
      rankText.textContent = rankSq[1];
      svg.append(fileText, rankText);
    }
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = squareAt(f, r), piece = chess.get(sq);
      if (!piece) continue;
      const [x, y] = xy(sq);
      const g = el("g", { transform: `translate(${x} ${y}) scale(${1 / 45})`, class: `piece${drag && drag.from === sq ? " lifted" : ""}` });
      g.innerHTML = PIECES[(piece.color === "w" ? "w" : "b") + piece.type.toUpperCase()];
      svg.appendChild(g);
    }
    for (const m of legal) {
      const [x, y] = xy(m.to);
      svg.appendChild(el("circle", { cx: x + 0.5, cy: y + 0.5, r: chess.get(m.to) ? 0.42 : 0.14, class: `target${chess.get(m.to) ? " capture" : ""}` }));
    }
    if (drag) {                                                       // the piece in hand follows the pointer
      const piece = chess.get(drag.from);
      const g = el("g", { transform: `translate(${drag.x - 0.5} ${drag.y - 0.5}) scale(${1 / 45})`, class: "piece dragging" });
      g.innerHTML = PIECES[(piece.color === "w" ? "w" : "b") + piece.type.toUpperCase()];
      svg.appendChild(g);
    }
    if (chess.inCheck()) { const k = kingSquare(chess.turn()); if (k) { const [x, y] = xy(k); const pieces = svg.querySelector(".piece"); svg.insertBefore(el("circle", { cx: x + 0.5, cy: y + 0.5, r: 0.5, class: "hl check" }), pieces); } }
  }
  function kingSquare(colour) { for (const row of chess.board()) for (const p of row) if (p && p.type === "k" && p.color === colour) return p.square; return null; }

  function play(m) { const mv = chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); last = mv ? { from: mv.from, to: mv.to } : null; return mv; }
  function tap(sq) {
    if (done || !opts.interactive || step >= puzzle.moves.length) return;
    const piece = chess.get(sq);
    if (chess.turn() !== solver) {                                   // the opponent's turn: a premove
      if (selected && selected !== sq) { premove = { from: selected, to: sq }; selected = null; }
      else if (premove && premove.from === sq) premove = null;
      else selected = piece && piece.color === solver ? sq : null;
      draw();
      return;
    }
    if (selected && selected !== sq && attempt(selected, sq)) return;
    selected = piece && piece.color === solver ? sq : null;
    draw();
  }
  /** Tries a move from the solver on their turn: plays it if legal and judges it. True if it was a legal move. */
  function attempt(from, to) {
    const legal = chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!legal.length) return false;
    const expected = puzzle.moves[step];
    // the expected move, including its promotion; otherwise promote as the solution does, else to a queen
    const promotion = expected.slice(0, 4) === from + to ? (expected[4] || undefined) : legal.some(m => m.promotion) ? "q" : undefined;
    const trial = new Chess(chess.fen());
    const mv = trial.move({ from, to, promotion });
    const right = uci(mv) === expected || (trial.isCheckmate() && solutionMates());
    selected = null; premove = null;
    if (!right) { fail(mv); return true; }
    play(uci(mv)); step++;
    draw();
    if (step >= puzzle.moves.length) { finish(true); return true; }
    later(reply, opts.replyMs ?? 350);
    return true;
  }
  /** The opponent's reply, then any premove the solver has waiting. */
  function reply() {
    play(puzzle.moves[step]); step++;
    draw();
    if (step >= puzzle.moves.length) { finish(true); return; }
    if (premove) { const p = premove; premove = null; if (!attempt(p.from, p.to)) draw(); }
  }
  /** Does the solution's next move give checkmate? */
  function solutionMates() { const t = new Chess(chess.fen()); const m = puzzle.moves[step]; t.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); return t.isCheckmate(); }
  function fail(mv) {
    // show the wrong move, then the move that was wanted
    const wanted = puzzle.moves[step];
    last = { from: mv.from, to: mv.to };
    want = null;
    draw();
    later(() => { want = wanted.slice(2, 4); last = { from: wanted.slice(0, 2), to: wanted.slice(2, 4) }; draw(); }, 500);
    finish(false);
  }
  function finish(solved) { if (done) return; done = true; selected = null; premove = null; draw(); opts.onDone?.(solved); }

  // taps and drags, from the board's own pointer events: squares from the pointer's position
  const squareOf = e => {
    const r = svg.getBoundingClientRect();
    const bx = (e.clientX - r.left) / r.width * 8, by = (e.clientY - r.top) / r.height * 8;
    if (bx < 0 || by < 0 || bx >= 8 || by >= 8) return { sq: null, bx, by };
    const col = Math.floor(bx), row = Math.floor(by);
    const f = solver === "w" ? col : 7 - col, rank = solver === "w" ? 7 - row : row;
    return { sq: squareAt(f, rank), bx, by };
  };
  let press = null;
  svg.addEventListener("pointerdown", e => {
    if (done || !opts.interactive) return;
    const { sq, bx, by } = squareOf(e);
    if (!sq) return;
    press = { sq, x: e.clientX, y: e.clientY, id: e.pointerId };
    try { svg.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const piece = chess.get(sq);
    if (piece && piece.color === solver) { drag = { from: sq, x: bx, y: by, moved: false }; selected = sq; draw(); }
    e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag || !press || e.pointerId !== press.id) return;
    const { bx, by } = squareOf(e);
    drag.x = Math.max(0, Math.min(8, bx)); drag.y = Math.max(0, Math.min(8, by));
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) drag.moved = true;
    draw();
  });
  const release = e => {
    if (!press || e.pointerId !== press.id) return;
    const { sq } = squareOf(e);
    const from = drag?.from, moved = drag?.moved;
    drag = null;
    press = null;
    if (from && moved) {                                              // a drag: drop on a square
      if (sq && sq !== from) { selected = from; tap(sq); }
      else draw();
      return;
    }
    if (sq) tapAt(sq);                                                // a tap
    else draw();
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", () => { drag = null; press = null; draw(); });
  /** A tap on a square: the second tap of a pair moves; a press on an own piece (already selected on the way down) stays selected. */
  function tapAt(sq) {
    const piece = chess.get(sq);
    if (selected && selected !== sq) { tap(sq); return; }
    if (piece && piece.color === solver) { selected = sq; draw(); return; }   // keeps a piece selected after the press
    selected = null; draw();
  }

  draw();
  // the opponent's move comes after a beat so the position registers first; a revealed board shows the whole line
  if (opts.revealSolution) {
    for (const m of puzzle.moves) play(m);
    step = puzzle.moves.length; done = true; draw();
  } else later(reply, opts.firstMs ?? 500);
  return { destroy() { timers.forEach(clearTimeout); }, get solver() { return solver; } };
}
