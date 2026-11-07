// A chess board for puzzles: the position from the solver's side, the opponent's move played first, then taps
// (a piece, then a square, with the legal targets shown) checked against the puzzle's solution move by move.
// Any move that gives checkmate is accepted where the solution's move does (Lichess's rule). Pieces can be
// dragged as well as tapped. A move made while it's the opponent's turn is a premove: it plays the instant the
// reply lands, if it's legal then, and counts like any other move. Uses chess.js for the rules and the cburnett
// pieces. Both boards can be drawn a second time in 3D (gambit-3d.js, when the page asks for it with opts.view "3d"): the
// rules of touch below are the same for both drawings, which differ only in where a finger is read to be (the scene's `local`).
import { Chess } from "./vendor/chess.js";
import { PIECES } from "./chess-pieces.js";
import { waitMark, load3d } from "./loading.js";

const SVG = "http://www.w3.org/2000/svg";
const FILES = "abcdefgh";
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

// ---------- the 3D drawing (gambit-3d.js): loaded the first time it's wanted, kept for the page, let go when the flat board is chosen ----------
const three = { load: null, scene: null, host: null, active: null, failed: false };    // active: the touch rules of the mount drawing in it now
const loadScene = () => (three.load ||= load3d(import("./gambit-3d.js")).catch(err => { three.load = null; throw err; }));
function dropScene() { three.scene?.dispose(); three.scene = three.host = null; }
/** Holds the 3D scene still (the menu is open) or lets it go on. */
export const holdScene = on => three.scene?.hold(on);
/** The 3D scene drawing now, or null (for tests and the look). */
export const sceneNow = () => three.scene;
/**
 * Where a mount draws: its flat SVG, or the 3D scene when the page asks for "3d" and the device can draw it. The scene is one for the
 * page (a puzzle rush mounts a board for each puzzle, and a graphics context for each would be slow, and a phone has only a few), so a
 * new mount in the same box takes it over. `touch` is the mount's rules of touch ({ grab, accept, down, move, up, cancel }), `redraw()` draws its
 * position again, `notice(text)` says in words that 3D isn't there and `unavailable()` that it won't be (no WebGL: the page forgets the
 * choice). While the scene loads the box shows the mark; a scene lost for good falls back to the flat board.
 */
function createSurface(container, svg, { view, touch, redraw, notice, unavailable }) {
  let want = false, token = 0, dead = false;
  const flat = () => { want = false; if (three.host === container) dropScene(); container.classList.remove("ch-3d"); container.replaceChildren(svg); };
  const surface = {
    /** The scene drawing for this mount, once it's ready. */
    get scene() { return want && three.host === container ? three.scene : null; },
    /** Wanted in 3D and not here yet. */
    get loading() { return want && !surface.scene; },
    /** Draws in the 3D scene ("3d") or flat (anything else). */
    use(next, quiet = false) {
      const on = next === "3d" && !three.failed && !dead && typeof WebGLRenderingContext !== "undefined";
      const mine = ++token;
      if (!on) { if (want || three.host === container || !svg.isConnected) { flat(); if (!quiet) redraw(); } return; }
      want = true;
      three.active = { ...touch, owner: surface, lost: () => { flat(); notice?.("3D stopped, so the flat board is back"); redraw(); } };
      container.classList.add("ch-3d");
      if (three.scene && three.host === container) { if (!quiet) redraw(); return; }       // the page scene, left by the last mount in this box
      dropScene();
      const wait = document.createElement("div");
      wait.className = "ch3-wait";
      wait.append(waitMark());
      container.replaceChildren(wait);
      loadScene().then(mod => {
        if (mine !== token || dead) return;
        const to = name => (...args) => three.active?.[name]?.(...args);
        three.scene = mod.createScene(container, { grab: e => three.active?.grab(e) ?? null, accept: sq => !!three.active?.accept?.(sq), down: to("down"), move: to("move"), up: to("up"), cancel: to("cancel"), lost: to("lost") });
        three.host = container;
        redraw();
      }).catch(err => {
        if (mine !== token) return;
        console.warn("Gambit: no 3D here, so the board is drawn flat.", err);
        three.failed = true;
        flat();
        notice?.("This device can't draw the board in 3D, so it stays flat");
        unavailable?.();
        redraw();
      });
    },
    /** This mount is done: the scene is left for the next one in the box. */
    destroy() { dead = true; token++; if (three.active?.owner === surface) three.active = null; },
  };
  surface.use(view, true);
  return surface;
}

/** The solution's moves in SAN, for notes: played out from the puzzle's start. */
export function solutionSan(puzzle) {
  const c = new Chess(puzzle.fen);
  return puzzle.moves.map(m => c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })?.san || m);
}

/**
 * Mounts a puzzle board in `container`. opts: { onDone(solved), interactive, revealSolution, startStep (the moves
 * already made, to pick a puzzle up part-way), onStep(step) (after every move, either side's), view ("3d" to draw in
 * gambit-3d.js; anything else is the flat board), onNotice(text) and onUnavailable() (3D can't be had) }. Returns
 * { destroy(), stop(), setView(view) }. The board plays the opponent's first move after a beat, then waits for taps.
 */
export function mountPuzzle(container, puzzle, opts = {}) {
  const chess = new Chess(puzzle.fen);
  const solver = chess.turn() === "w" ? "b" : "w";                 // the opponent moves first
  let step = 0;                                                      // index into puzzle.moves
  let selected = null, done = false, last = null, want = null, premove = null, drag = null;   // want: the square the wanted move goes to, after a miss
  let wanted = null, surf = null;                                    // wanted: that move, which the 3D board plays out; surf: where this draws
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const svg = el("svg", { viewBox: "0 0 8 8", class: "ch-board" });

  const uci = m => m.from + m.to + (m.promotion || "");
  const squareAt = (file, rank) => FILES[file] + (rank + 1);
  // screen coordinates: the solver's side at the bottom
  const xy = sq => { const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1; return solver === "w" ? [f, 7 - r] : [7 - f, r]; };

  /** What the 3D scene is told: the same position and marks the flat drawing makes; after a miss, the move that was wanted is played out. */
  function model() {
    const shown = wanted ? new Chess(chess.fen()) : chess;
    if (wanted) shown.move({ from: wanted.slice(0, 2), to: wanted.slice(2, 4), promotion: wanted[4] });
    const pieces = {};
    for (const row of shown.board()) for (const p of row) if (p) pieces[p.square] = p.color + p.type.toUpperCase();
    const legal = selected ? chess.moves({ square: selected, verbose: true }) : [];
    return { white: solver === "w", pieces, last, selected, targets: legal.map(m => ({ to: m.to, capture: !!chess.get(m.to) })), check: !wanted && chess.inCheck() ? kingSquare(chess.turn()) : null,
      arrows: [], pre: premove, want, held: drag?.moved ? { from: drag.from, x: drag.x, y: drag.y } : null, promo: null };
  }
  function draw() {
    if (surf?.scene) { surf.scene.draw(model()); return; }
    if (surf?.loading) return;
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
    opts.onStep?.(step);
    draw();
    if (step >= puzzle.moves.length) { finish(true); return true; }
    later(reply, opts.replyMs ?? 350);
    return true;
  }
  /** The opponent's reply, then any premove the solver has waiting. */
  function reply() {
    play(puzzle.moves[step]); step++;
    opts.onStep?.(step);
    draw();
    if (step >= puzzle.moves.length) { finish(true); return; }
    if (premove) { const p = premove; premove = null; if (!attempt(p.from, p.to)) draw(); }
  }
  /** Does the solution's next move give checkmate? */
  function solutionMates() { const t = new Chess(chess.fen()); const m = puzzle.moves[step]; t.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); return t.isCheckmate(); }
  function fail(mv) {
    // show the wrong move, then the move that was wanted
    const right = puzzle.moves[step];
    last = { from: mv.from, to: mv.to };
    want = null;
    draw();
    later(() => { want = right.slice(2, 4); last = { from: right.slice(0, 2), to: right.slice(2, 4) }; wanted = right; draw(); }, 500);
    finish(false);
  }
  function finish(solved) { if (done) return; done = true; selected = null; premove = null; draw(); opts.onDone?.(solved); }

  // taps and drags, from the board's own pointer events (or the 3D scene's, which calls the same rules): squares from the pointer's position.
  // `reach` is a man in hand (in 3D it hangs above the board, so the square under it is where it is over, not where the finger's ray lands)
  const squareOf = (e, reach = false) => {
    let bx, by;
    if (surf?.scene) [bx, by] = surf.scene.local(e, reach);
    else { const r = svg.getBoundingClientRect(); bx = (e.clientX - r.left) / r.width * 8; by = (e.clientY - r.top) / r.height * 8; }
    if (bx < 0 || by < 0 || bx >= 8 || by >= 8) return { sq: null, bx, by };
    const col = Math.floor(bx), row = Math.floor(by);
    const f = solver === "w" ? col : 7 - col, rank = solver === "w" ? 7 - row : row;
    return { sq: squareAt(f, rank), bx, by };
  };
  let press = null;
  function down(e) {
    if (done || !opts.interactive) return;
    const { sq, bx, by } = squareOf(e);
    if (!sq) return;
    press = { sq, x: e.clientX, y: e.clientY, id: e.pointerId, was: selected };
    if (!surf?.scene) { try { svg.setPointerCapture(e.pointerId); } catch { /* synthetic */ } }
    const piece = chess.get(sq);
    if (piece && piece.color === solver) { drag = { from: sq, x: bx, y: by, moved: false }; selected = sq; draw(); }
    e.preventDefault?.();
  }
  function move(e) {
    if (!drag || !press || e.pointerId !== press.id) return;
    const { bx, by } = squareOf(e, true);
    drag.x = Math.max(0, Math.min(8, bx)); drag.y = Math.max(0, Math.min(8, by));
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) drag.moved = true;
    draw();
  }
  function release(e) {
    if (!press || e.pointerId !== press.id) return;
    const { sq } = squareOf(e, !!drag?.moved);
    const from = drag?.from, moved = drag?.moved, pressed = press;
    drag = null;
    press = null;
    if (from && moved) {                                              // a drag: drop on a square
      if (sq && sq !== from) { selected = from; tap(sq); }
      else draw();
      return;
    }
    if (sq) {                                                         // a tap; in 3D the picked man hides the square behind it, which may be where it goes
      const behind = surf?.scene && sq === selected && pressed.was === sq ? squareOf(e, "plane").sq : null;
      tapAt(behind && behind !== sq && chess.moves({ square: selected, verbose: true }).some(m => m.to === behind) ? behind : sq);
    } else draw();
  }
  function cancel() { drag = null; press = null; draw(); }
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", cancel);
  /** What a press means before any move: a man of the solver's to carry ("piece"), a tap that'd move or premove what's picked, or nothing (3D lets a finger turn the camera then). */
  const grab = e => {
    if (done || !opts.interactive) return null;
    const { sq } = squareOf(e), piece = sq && chess.get(sq);
    return piece && piece.color === solver ? "piece" : selected || premove ? "tap" : null;
  };
  /** A man a finger touching several would want: one of the solver's, or one the picked man may go to (a man in front hides the one behind it). */
  const accept = sq => chess.get(sq)?.color === solver || (!!selected && chess.moves({ square: selected, verbose: true }).some(m => m.to === sq));
  /** A tap on a square: the second tap of a pair moves; a press on an own piece (already selected on the way down) stays selected. */
  function tapAt(sq) {
    const piece = chess.get(sq);
    if (selected && selected !== sq) { tap(sq); return; }
    if (piece && piece.color === solver) { selected = sq; draw(); return; }   // keeps a piece selected after the press
    selected = null; draw();
  }

  surf = createSurface(container, svg, { view: opts.view, touch: { grab, accept, down, move, up: release, cancel }, redraw: draw, notice: opts.onNotice, unavailable: opts.onUnavailable });
  draw();
  // the opponent's move comes after a beat so the position registers first; a revealed board shows the whole line; a
  // puzzle picked up part-way (opts.startStep: a run after a reload, or as a partner watching sees it) replays the moves
  // already made, and if the opponent is to move, their move comes as it would have
  if (opts.revealSolution) {
    for (const m of puzzle.moves) play(m);
    step = puzzle.moves.length; done = true; draw();
  } else if (opts.startStep > 0) {
    step = Math.min(opts.startStep, puzzle.moves.length - 1);
    for (const m of puzzle.moves.slice(0, step)) play(m);
    draw();
    if (step % 2 === 0) later(reply, opts.replyMs ?? 350);           // the opponent's moves are the even ones
  } else later(reply, opts.firstMs ?? 500);
  return {
    destroy() { timers.forEach(clearTimeout); surf.destroy(); },
    /** No more moves (the run's time ran out): the board stays as it stands. */
    stop() { timers.forEach(clearTimeout); done = true; selected = null; premove = null; drag = null; draw(); },
    /** Draws flat ("board") or in 3D ("3d") from now on. */
    setView(next) { surf.use(next); },
    get solver() { return solver; },
  };
}

/**
 * Mounts a board for a whole game (Gambit): the position from a FEN, from White's side or Black's, moved by tap or drag
 * with the legal targets shown; a pawn reaching the last rank asks which piece it becomes (queen, rook, bishop or
 * knight, in a column over the square). onMove(uci) gets a move made by hand ("e2e4", "e7e8n"). Returns { draw(view) }:
 * view is { fen, white (White at the bottom), moves (the legal moves the hand may make now, chess.js's verbose moves; none
 * when it isn't the hand's turn), last ({ from, to }), arrows ([{ from, to, bad }]: moves to show, the coach's in its
 * green, a move it faults in oxblood), check (the square of a king in check), slide (the last move slides in) }, and
 * setView("3d" | "board") to draw in 3D or flat (opts view, onNotice and onUnavailable are mountPuzzle's). Puzzles keep mountPuzzle above.
 */
export function mountBoard(container, { onMove, view: wantedView, onNotice, onUnavailable }) {
  const svg = el("svg", { viewBox: "0 0 8 8", class: "ch-board ch-game" });
  let view = null, selected = null, drag = null, press = null, promo = null, surf = null;
  const xy = sq => { const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1; return view.white ? [f, 7 - r] : [7 - f, r]; };
  const squareAt = (bx, by) => {
    if (bx < 0 || by < 0 || bx >= 8 || by >= 8) return null;
    const col = Math.floor(bx), row = Math.floor(by);
    return view.white ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);
  };
  // the board's coordinates (0..8 across and down) under a pointer; in 3D the scene reads them off its camera (`reach`: a man in hand)
  const local = (e, reach = false) => {
    if (surf?.scene) return surf.scene.local(e, reach);
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * 8, (e.clientY - r.top) / r.height * 8];
  };
  /**
   * The four squares the choices stand on. Flat: a column from the pawn's own square inward. In 3D, where a man in front hides the one
   * behind it, a row across the middle of the board, side by side and as near as the board's middle (the same for either side).
   */
  const promoSquares = () => {
    if (surf.scene) return [2, 3, 4, 5].map(col => squareAt(col + 0.5, 4.5));
    const rank = Number(promo.to[1]), inward = rank === 8 ? -1 : 1;
    return [0, 1, 2, 3].map(i => promo.to[0] + (rank + i * inward));
  };
  const boardOf = fen => {
    const out = {}, rows = fen.split(" ")[0].split("/");
    rows.forEach((row, k) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) { f += Number(ch); continue; } out[FILES[f++] + (8 - k)] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase(); } });
    return out;
  };
  const targetsOf = sq => (view?.moves || []).filter(m => m.from === sq);
  const piece = (code, x, y, cls = "") => {
    const g = el("g", { class: `piece${cls ? ` ${cls}` : ""}` });
    g.style.transform = `translate(${x}px, ${y}px)`;
    g.innerHTML = `<g transform="scale(${1 / 45})">${PIECES[code]}</g>`;
    return g;
  };

  /** What the 3D scene is told: the position and the marks the flat drawing makes. */
  function model() {
    const pieces = boardOf(view.fen), seen = new Set(), targets = [];
    for (const m of selected ? targetsOf(selected) : []) if (!seen.has(m.to)) { seen.add(m.to); targets.push({ to: m.to, capture: !!pieces[m.to] }); }
    return { white: view.white, pieces, last: view.last, selected, targets, check: view.check, arrows: view.arrows || [], pre: null, want: null,
      held: drag?.moved ? { from: drag.from, x: drag.x, y: drag.y } : null, promo: promo ? { colour: promo.colour, squares: promoSquares(), choices: ["q", "r", "b", "n"] } : null };
  }
  function draw(next) {
    if (next) view = next;
    if (!view) return;
    if (surf.scene) { surf.scene.draw(model()); return; }
    if (surf.loading) return;
    const board = boardOf(view.fen), last = view.last, legal = selected ? targetsOf(selected) : [];
    svg.replaceChildren();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = FILES[f] + (r + 1), [x, y] = xy(sq), dark = (f + r) % 2 === 0;
      svg.appendChild(el("rect", { x, y, width: 1, height: 1, class: `sq ${dark ? "dark" : "light"}` }));
      const marks = [last && (last.from === sq || last.to === sq) && "last", selected === sq && "sel"].filter(Boolean);
      for (const m of marks) svg.appendChild(el("rect", { x, y, width: 1, height: 1, class: `hl ${m}` }));
    }
    if (view.check) { const [x, y] = xy(view.check); svg.appendChild(el("circle", { cx: x + 0.5, cy: y + 0.5, r: 0.5, class: "hl check" })); }
    for (let i = 0; i < 8; i++) {
      const fileSq = view.white ? FILES[i] + "1" : FILES[7 - i] + "8", rankSq = view.white ? "a" + (8 - i) : "h" + (i + 1);
      const [fx, fy] = xy(fileSq), [rx, ry] = xy(rankSq);
      const on = sq => ((FILES.indexOf(sq[0]) + Number(sq[1]) - 1) % 2 === 0 ? "on-dark" : "on-light");
      const fileText = el("text", { x: fx + 0.93, y: fy + 0.95, class: `coord ${on(fileSq)}`, "text-anchor": "end" });
      fileText.textContent = fileSq[0];
      const rankText = el("text", { x: rx + 0.07, y: ry + 0.3, class: `coord ${on(rankSq)}` });
      rankText.textContent = rankSq[1];
      svg.append(fileText, rankText);
    }
    let sliding = null;
    for (const [sq, code] of Object.entries(board)) {
      if (drag?.moved && drag.from === sq) continue;
      const [x, y] = xy(sq);
      if (view.slide && last && sq === last.to) { const [fx, fy] = xy(last.from); sliding = { g: piece(code, fx, fy, "slide"), x, y }; svg.appendChild(sliding.g); continue; }
      svg.appendChild(piece(code, x, y, drag && !drag.moved && drag.from === sq ? "lifted" : ""));
    }
    if (sliding) { requestAnimationFrame(() => requestAnimationFrame(() => { sliding.g.style.transform = `translate(${sliding.x}px, ${sliding.y}px)`; })); view = { ...view, slide: false }; }
    for (const m of legal) {
      const [x, y] = xy(m.to);
      if (legal.indexOf(m) !== legal.findIndex(o => o.to === m.to)) continue;   // a promotion's four moves share a square
      svg.appendChild(el("circle", { cx: x + 0.5, cy: y + 0.5, r: board[m.to] ? 0.42 : 0.14, class: `target${board[m.to] ? " capture" : ""}` }));
    }
    for (const a of view.arrows || []) {
      const [fx, fy] = xy(a.from), [tx, ty] = xy(a.to);
      const ax = fx + 0.5, ay = fy + 0.5, bx = tx + 0.5, by = ty + 0.5, len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      const ex = bx - ux * 0.32, ey = by - uy * 0.32, w = 0.24;
      svg.appendChild(el("path", { class: `arrow${a.bad ? " bad" : ""}`, d: `M${ax + ux * 0.2} ${ay + uy * 0.2}L${ex} ${ey}M${ex - ux * 0.05 - uy * w} ${ey - uy * 0.05 + ux * w}L${bx - ux * 0.08} ${by - uy * 0.08}L${ex - ux * 0.05 + uy * w} ${ey - uy * 0.05 - ux * w}Z` }));
    }
    if (drag?.moved) svg.appendChild(piece(board[drag.from], drag.x - 0.5, drag.y - 0.5, "dragging"));
    if (promo) {                                                   // the four pieces a pawn may become, from its square inward
      const [x, y] = xy(promo.to), down = y === 0 ? 1 : -1, colour = promo.colour;
      svg.appendChild(el("rect", { x: 0, y: 0, width: 8, height: 8, class: "promo-veil" }));
      ["q", "r", "b", "n"].forEach((p, i) => {
        const py = y + i * down;
        svg.appendChild(el("rect", { x, y: py, width: 1, height: 1, class: "promo-sq", "data-promo": p }));
        svg.appendChild(piece(colour + p.toUpperCase(), x, py, "promo-pc"));
      });
    }
  }

  function attempt(from, to) {
    const options = targetsOf(from).filter(m => m.to === to);
    if (!options.length) return false;
    selected = null;
    if (options.some(m => m.promotion)) { promo = { from, to, colour: options[0].color }; draw(); return true; }
    onMove(uciOf(options[0]));
    return true;
  }
  function tapAt(sq) {
    if (selected && selected !== sq && attempt(selected, sq)) return;
    selected = sq && targetsOf(sq).length && selected !== sq ? sq : null;
    draw();
  }
  // taps and drags: the board's own pointer events, or the 3D scene's, which calls the same rules
  function down(e) {
    if (!view || e.button > 0) return;
    const [bx, by] = local(e);
    if (promo) {                                                  // a piece chosen for the pawn, or the choice put away
      const sq = squareAt(bx, by), i = sq ? promoSquares().indexOf(sq) : -1, chosen = promo;
      promo = null;
      if (i >= 0) onMove(chosen.from + chosen.to + ["q", "r", "b", "n"][i]); else draw();
      e.preventDefault?.();
      return;
    }
    const sq = squareAt(bx, by);
    if (!sq) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, sq, was: selected };
    if (!surf.scene) { try { svg.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ } }
    if (targetsOf(sq).length) { drag = { from: sq, x: bx, y: by, moved: false }; if (selected !== sq) { selected = sq; draw(); } }
    e.preventDefault?.();
  }
  function move(e) {
    if (!drag || !press || e.pointerId !== press.id) return;
    const [bx, by] = local(e, true);
    drag.x = Math.max(0, Math.min(8, bx)); drag.y = Math.max(0, Math.min(8, by));
    if (!drag.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) drag.moved = true;
    if (drag.moved) draw();
  }
  function release(e) {
    if (!press || e.pointerId !== press.id) return;
    const was = drag, start = press;
    drag = null; press = null;
    const sq = squareAt(...local(e, !!was?.moved));
    if (was?.moved) { if (!(sq && sq !== was.from && attempt(was.from, sq))) draw(); return; }
    if (!sq) { draw(); return; }
    if (was && sq === start.sq) {                                  // a second tap on a picked piece puts it down
      if (start.was === sq) {
        const behind = surf.scene ? squareAt(...local(e, "plane")) : null;       // 3D: the man hides the square behind it, which may be where it goes
        if (behind && behind !== sq && attempt(sq, behind)) return;
        selected = null;
      }
      draw();
      return;
    }
    tapAt(sq);
  }
  function cancel() { drag = null; press = null; draw(); }
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", cancel);
  /** What a press means before any move: a piece to carry, the promotion's choice, a tap that would move what's picked, or nothing (3D lets a finger turn the camera then). */
  const grab = e => {
    if (!view) return null;
    if (promo) return "promo";
    const sq = squareAt(...local(e));
    return sq && targetsOf(sq).length ? "piece" : sq && selected && targetsOf(selected).some(m => m.to === sq) ? "tap" : null;
  };

  const accept = sq => !promo && (targetsOf(sq).length > 0 || (!!selected && targetsOf(selected).some(m => m.to === sq)));      // see mountPuzzle's
  surf = createSurface(container, svg, { view: wantedView, touch: { grab, accept, down, move, up: release, cancel }, redraw: draw, notice: onNotice, unavailable: onUnavailable });
  return {
    draw(next) { if (!next.moves?.length || next.fen !== view?.fen) { selected = null; promo = null; } draw(next); },
    /** Draws flat ("board") or in 3D ("3d") from now on. */
    setView(next) { surf.use(next); },
  };
}
const uciOf = m => m.from + m.to + (m.promotion || "");
