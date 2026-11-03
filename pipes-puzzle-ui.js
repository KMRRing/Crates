// Pipes, the puzzle, on the page (November 2026): the board of the level in hand, the hand of pieces to lay, the oil's way as
// it stands, the hint, the stars and the levels. The rules are pipes-puzzle.js's (pure) and the levels are
// pipes-puzzle-levels.js; this file draws them into pipes.html's board, queue, status line and buttons, and keeps the
// level in hand and the stars under pipes:puzzle and pipes:stars, so a partner watching sees the same board.
import { el, T, MID, channel, drawPipe, drawGround, drawSource, drawTerminal, pieceTile, PIECE_NAMES } from "./pipes-draw.js";
import * as Z from "./pipes-puzzle.js";
import { LEVELS, CHAPTERS } from "./pipes-puzzle-levels.js";
import { sure } from "./sure.js";

export const KEY = { run: "pipes:puzzle", stars: "pipes:stars" };
const STAR = "★", HOLLOW = "☆";
const OIL_STEP = 60;                      // ms between squares as the oil runs through a solved level
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The level's index in the ladder for an id, or -1. */
export const indexOf = id => LEVELS.findIndex(l => l.id === id);

/**
 * The puzzle's view. deps: { $ (element by id), read, write (localStorage with a fallback), toast, frame (a partner's
 * watching frame: no taps), openMenu, onSolved (a level finished: roundOver for random mode), reduced () }.
 */
export function createPuzzle(deps) {
  const { $, read, write, toast, frame, openMenu, onSolved, reduced } = deps;
  // saved: { v, id (the level in hand), runs: { id: { sig (what the level was when this was kept), laid: { square: piece },
  // sel (the kind in hand), lifts, hints, solved (the stars of the finish, 0 while it's open) } } }
  let saved = { v: 1, id: LEVELS[0].id, runs: {} };
  let stars = {};                          // id -> the best stars won
  let L = null, laid = [], run = null, index = 0;
  let undoStack = [], hint = null, cellG = [], svg = null;
  let oilTo = 0, oilTimer = 0, passes = [];            // the oil running through a level just solved: how many squares it has filled
  let shownFor = "";

  // ---------- keeping ----------
  const sigOf = spec => `${spec.map.join("/")}|${spec.hand}|${spec.out}${spec.inlet}`;
  function load() {
    const s = read(KEY.run, null);
    if (s?.v === 1 && typeof s.id === "string") saved = { v: 1, id: s.id, runs: s.runs || {} };
    const st = read(KEY.stars, {});
    stars = st && typeof st === "object" ? st : {};
    if (indexOf(saved.id) < 0) saved.id = firstOpen();
  }
  const persist = () => { if (!frame) write(KEY.run, saved); };
  const totalStars = () => Object.entries(stars).reduce((n, [id, s]) => n + (indexOf(id) >= 0 ? s : 0), 0);
  const firstOpen = () => (LEVELS.find(l => !stars[l.id]) || LEVELS[0]).id;
  const starsOf = id => stars[id] || 0;

  // ---------- the level in hand ----------
  function open(id, { fresh = false } = {}) {
    clearTimeout(oilTimer);
    index = Math.max(0, indexOf(id));
    const spec = LEVELS[index];
    L = Z.parseLevel(spec);
    saved.id = spec.id;
    let r = saved.runs[spec.id];
    if (!r || r.sig !== sigOf(spec) || fresh) r = saved.runs[spec.id] = { sig: sigOf(spec), laid: {}, sel: null, lifts: 0, hints: 0, solved: 0 };
    run = r;
    laid = Z.emptyLaid(L);
    for (const [c, p] of Object.entries(run.laid)) if (Z.PIECES[p] && !L.cells[c]) laid[c] = p;
    undoStack = []; hint = null;
    oilTo = run.solved ? Infinity : 0;
    passes = run.solved ? Z.check(L, laid).passes : [];
    persist();
  }
  function store() {
    run.laid = {};
    laid.forEach((p, c) => { if (p) run.laid[c] = p; });
    persist();
  }
  const handNow = () => Z.handLeft(L, laid);
  const sel = () => (run.sel && (handNow()[run.sel] || 0) > 0 ? run.sel : null);

  // ---------- drawing ----------
  /** The middle of a channel's pipe, where an old pipe's stud goes. */
  function midOf(a, b) {
    if (a === Z.back(b)) return [MID, MID];
    const cx = MID + (Z.DIRS[a][0] + Z.DIRS[b][0]) * MID, cy = MID + (Z.DIRS[a][1] + Z.DIRS[b][1]) * MID, k = MID / Math.hypot(MID - cx, MID - cy);
    return [cx + (MID - cx) * k, cy + (MID - cy) * k];
  }
  function drawCell(c, res) {
    const g = cellG[c];
    g.replaceChildren();
    const f = L.cells[c], piece = Z.pieceOn(L, laid, c);
    drawGround(g, f?.k === "rock");
    if (f?.k === "rock") return;
    const oilIn = test => () => {
      passes.forEach((s, i) => {
        if (s.c !== c || i >= oilTo || !test(s)) return;
        el("path", { d: channel(s.a, s.b).d, class: "oil", "stroke-width": 9 }, g);
      });
    };
    const stub = d => () => { if (oilTo > 0) el("path", { d: channel(-1, d).d, class: "oil", "stroke-width": 9 }, g); };
    if (f?.k === "source") drawSource(g, f.d, stub(f.d));
    else if (f?.k === "terminal") drawTerminal(g, f.d, () => { if (oilTo > passes.length) stub(f.d)(); });
    else if (piece) {
      const mark = f?.k === "old" ? el("g", { class: "old" }, g) : g;
      drawPipe(mark, piece, i => oilIn(s => Z.channelOf(piece, s.a)?.i === i)());
      if (f?.k === "old") for (const [p, q] of Z.PIECES[piece]) { const [x, y] = midOf(p, q); el("circle", { cx: x, cy: y, r: 6, class: "fixed-mark" }, g); }
    }
    if (L.stakeAt[c]) {
      const n = L.stakeAt[c], at = res.stakeState[n - 1];
      el("circle", { cx: 14, cy: 14, r: 10, class: `stake ${at}` }, g);
      const t = el("text", { x: 14, y: 18.5, "text-anchor": "middle", "font-size": 13, class: "stake-n" }, g);
      t.textContent = String(n);
    }
    if (hint) {
      if (hint.wrong?.includes(c)) el("rect", { x: 3, y: 3, width: T - 6, height: T - 6, rx: 8, class: "pick bad" }, g);
      if (hint.c === c) {
        drawPipe(el("g", { class: "ghost" }, g), hint.piece);
        el("rect", { x: 3, y: 3, width: T - 6, height: T - 6, rx: 8, class: "pick" }, g);
      }
    }
  }
  /** How each stake stands: "ok" (passed in its turn), "bad" (passed out of turn) or "" (not yet). */
  function stakeStates(passes) {
    const order = [];
    for (const s of passes) if (L.stakeAt[s.c] && !order.includes(s.c)) order.push(s.c);
    return L.stakes.map((c, i) => { const at = order.indexOf(c); return at < 0 ? "" : L.stakes[at] === c ? "ok" : "bad"; });
  }
  function resOf() {
    const res = Z.check(L, laid);
    res.stakeState = stakeStates(res.passes);
    res.feed = Z.feed(L, laid);
    return res;
  }
  function drawOverlay(res) {
    const layer = svg.querySelector(".overlay");
    layer.replaceChildren();
    if (run.solved) return;
    const at = (s, cls) => { const [x, y] = Z.xy(L, s.c); el("path", { d: channel(s.a, s.b).d, class: cls, transform: `translate(${x * T} ${y * T})` }, layer); };
    for (const s of res.passes) at(s, "route");
    for (const s of res.feed.passes) at(s, "route feed");
    const ring = (c, cls) => { const [x, y] = Z.xy(L, c); el("rect", { x: x * T + 4, y: y * T + 4, width: T - 8, height: T - 8, rx: 8, class: `next ${cls}` }, layer); };
    const { end } = res, fend = res.feed.end;
    if (end.why === "open") ring(end.c, "");
    else if (end.why !== "terminal") {
      // the oil is stopped: a cross where (or, off the edge, beyond the last square)
      const [x, y] = Z.xy(L, end.c);
      let cx = x * T + MID, cy = y * T + MID;
      if (end.why === "edge") { const last = res.passes[res.passes.length - 1] || { b: L.source.d }; cx += Z.DIRS[last.b][0] * (MID - 6); cy += Z.DIRS[last.b][1] * (MID - 6); }
      el("path", { d: `M${cx - 8} ${cy - 8}L${cx + 8} ${cy + 8}M${cx + 8} ${cy - 8}L${cx - 8} ${cy + 8}`, class: "spill-x" }, layer);
    }
    if (fend.why === "open" && !(end.why === "open" && end.c === fend.c)) ring(fend.c, "out");
  }
  function drawBoard() {
    const key = `${L.id}`;
    if (shownFor !== key || !svg) build();
    const res = resOf();
    for (let c = 0; c < cellG.length; c++) drawCell(c, res);
    drawOverlay(res);
    drawHand();
    drawText(res);
    return res;
  }
  function build() {
    const board = $("board");
    svg = el("svg", { viewBox: `0 0 ${L.cols * T} ${L.rows * T}`, role: "img", "aria-label": `${LEVELS[index].name}: the board` });
    cellG = [];
    for (let c = 0; c < L.cols * L.rows; c++) { const [x, y] = Z.xy(L, c); cellG.push(el("g", {}, el("g", { transform: `translate(${x * T} ${y * T})` }, svg))); }
    el("g", { class: "overlay" }, svg);
    svg.addEventListener("pointerdown", e => {
      if (e.button === 2) return;
      const r = svg.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * L.cols), y = Math.floor((e.clientY - r.top) / r.height * L.rows);
      if (x >= 0 && y >= 0 && x < L.cols && y < L.rows) tap(y * L.cols + x);
    });
    svg.addEventListener("contextmenu", e => e.preventDefault());
    board.replaceChildren(svg);
    board.style.setProperty("--cols", L.cols);
    board.style.setProperty("--rows", L.rows);
    shownFor = `${L.id}`;
  }
  function drawHand() {
    const q = $("queue"), left = handNow(), cur = sel();
    q.className = "pi-queue pi-hand";
    const label = document.createElement("span");
    label.className = "pi-q-label";
    label.textContent = "Hand";
    const tiles = Z.KINDS.filter(k => L.hand[k]).map(k => {
      const b = pieceTile(k, false, "button");
      b.type = "button";
      b.classList.add("pi-h");
      b.classList.toggle("sel", cur === k);
      b.classList.toggle("none", !left[k]);
      b.disabled = !!run.solved;
      b.setAttribute("aria-label", `${PIECE_NAMES[k]}, ${left[k]} left`);
      b.setAttribute("aria-pressed", cur === k ? "true" : "false");
      const n = document.createElement("b");
      n.className = "pi-n";
      n.textContent = left[k];
      b.append(n);
      b.addEventListener("click", () => choose(k));
      return b;
    });
    q.replaceChildren(label, ...tiles);
  }

  // ---------- the line under the board, the numbers, the buttons ----------
  const WHY = { edge: "The oil runs off the edge", rock: "The oil runs into rock", shape: "The oil meets a piece that won't take it in", full: "The oil meets pipe it has already filled", loop: "The oil goes round in a circle" };
  function textOf(res) {
    const spec = LEVELS[index], left = res.left;
    if (run.solved) return `${spec.name} solved · ${STAR.repeat(run.solved)}${HOLLOW.repeat(3 - run.solved)}`;
    if (hint?.wrong?.length) return "The red pieces aren't in an answer: lift them";
    if (hint) return hint.over ? `Hint: ${hint.over}` : "Hint: this piece goes in the dashed square";
    if (!res.placed) {
      // a chapter's first level says what's new in it; the rest say what to do
      const ch = CHAPTERS.find(c => c.key === spec.chapter);
      return LEVELS.findIndex(l => l.chapter === spec.chapter) === index ? `${ch.name}: ${ch.rule}` : `${spec.name}: lay all ${plural(L.total, "piece")}`;
    }
    if (!left) {
      if (res.end.why === "terminal") {
        if (res.strays.length) return `${plural(res.strays.length, "piece")} the oil never reaches`;
        if (res.missed.length) return `The oil misses old pipe`;
        if (!res.stakesOk) return "The stakes must be passed in order";
        return "";
      }
      if (res.end.why === "open") return "No pieces left, and a gap in the route";
      return `${WHY[res.end.why] || "The oil is stopped"}, and no pieces left`;
    }
    const cur = sel(), reach = res.passes.length;
    if (res.end.why === "terminal") return `The oil is in the terminal with ${plural(left, "piece")} left: it must run through them all`;
    if (res.end.why !== "open" && res.end.why !== "terminal" && reach) return `${WHY[res.end.why]} · ${plural(left, "piece")} left`;
    return `${cur ? `Tap a square for the ${PIECE_NAMES[cur]}` : "Pick a piece from the hand"} · the oil runs ${plural(reach, "piece")}`;
  }
  function drawText(res) {
    const text = textOf(res);
    $("status").textContent = text;
    $("ahead").hidden = true;
    $("stat1Label").textContent = "Level"; $("stat1").textContent = String(index + 1);
    $("stat3Label").textContent = "To lay"; $("stat3").textContent = run.solved ? "✓" : String(res.left);
    $("stat3").className = run.solved ? "met" : "";
    $("scoreLabel").textContent = "Stars";
    $("score").textContent = `${totalStars()}${STAR}`;
    const solved = !!run.solved;
    $("puzzleControls").classList.toggle("done", solved);
    $("pzUndo").hidden = solved; $("pzClear").hidden = solved; $("pzHint").hidden = solved;
    $("pzAgain").hidden = !solved; $("pzNext").hidden = !solved;
    $("pzUndo").disabled = !undoStack.length;
    $("pzClear").disabled = !res.placed;
    $("pzNext").textContent = index + 1 < LEVELS.length ? "Next level" : "The levels";
  }

  // ---------- playing ----------
  const snap = () => { undoStack.push({ laid: laid.slice(), lifts: run.lifts, sel: run.sel }); if (undoStack.length > 300) undoStack.shift(); };
  function choose(k) {
    if (frame || run.solved) return;
    hint = null;
    run.sel = sel() === k ? null : k;
    persist();
    drawBoard();
  }
  function tap(c) {
    if (frame || run.solved || oilTimer) return;
    if (L.cells[c]) { hint = null; return drawBoard(); }
    hint = null;
    const cur = sel(), here = laid[c];
    if (cur && here !== cur) {
      snap();
      const r = Z.lay(L, laid, c, cur);
      if (r === "swapped") run.lifts++;
      if (r === "laid" || r === "swapped") {
        // the kind in hand stays in hand while some is left; a swap hands back the piece that was there, and takes that up
        if (r === "swapped") run.sel = here;
        else if (!(handNow()[cur] > 0)) run.sel = null;
      } else undoStack.pop();
    } else if (here) {
      snap();
      Z.lift(L, laid, c);
      run.lifts++;
      run.sel = here;                                        // taken up, it is in hand: tap again to lay it elsewhere
    } else {
      // nothing in hand and an empty square: if one kind is left, that's the one
      const kinds = Z.KINDS.filter(k => (handNow()[k] || 0) > 0);
      if (kinds.length === 1) { run.sel = kinds[0]; return tap(c); }
      toast("Pick a piece from the hand first", 1400);
      return drawBoard();
    }
    store();
    const res = drawBoard();
    if (res.solved) solved(res);
  }
  function undo() {
    if (frame || run.solved || !undoStack.length) return;
    const s = undoStack.pop();
    laid = s.laid; run.lifts = s.lifts; run.sel = s.sel; hint = null;
    store();
    drawBoard();
  }
  function clearAll() {
    if (frame || run.solved || !laid.some(Boolean)) return;
    snap();
    laid = Z.emptyLaid(L); run.sel = null; hint = null;
    store();
    drawBoard();
  }
  /** A level finished: its stars, the oil running through it, and what the next step is. */
  function solved(res) {
    run.solved = Z.starsFor(L, run);
    if (run.solved > starsOf(L.id)) { stars[L.id] = run.solved; if (!frame) write(KEY.stars, stars); }
    passes = res.passes;
    store();
    onSolved?.(run.solved);
    if (reduced()) { oilTo = Infinity; return void drawBoard(); }
    oilTo = 0;
    drawBoard();
    const tick = () => {
      oilTo++;
      if (oilTo >= passes.length + 1) { oilTo = Infinity; oilTimer = 0; drawBoard(); return; }
      drawBoard();
      oilTimer = setTimeout(tick, OIL_STEP);
    };
    oilTimer = setTimeout(tick, OIL_STEP);
  }
  /** The hint: if the pieces laid can still be part of an answer, where the next piece goes along the oil's way; if not,
   *  the pieces that are in the way. It costs the level its third star. */
  async function giveHint() {
    if (frame || run.solved || oilTimer) return;
    if (!run.hints && !(await sure("A hint costs the level a star: the most you can win is two. Show one?", { yes: "Hint" }))) return;
    const answers = L.sols.map(r => Z.layRoute(L, r)).filter(Boolean);
    if (!answers.length) return;
    let best = null;
    for (const sol of answers) {
      const wrong = [], agree = [];
      laid.forEach((p, c) => { if (p) (sol[c] === p ? agree : wrong).push(c); });
      if (!best || wrong.length < best.wrong.length || (wrong.length === best.wrong.length && agree.length > best.agree.length)) best = { sol, wrong, agree };
    }
    run.hints++;
    if (best.wrong.length) hint = { wrong: best.wrong };
    else {
      const route = Z.trace(L, best.sol).passes.find(s => !L.cells[s.c] && !laid[s.c]);
      hint = route ? { c: route.c, piece: best.sol[route.c] } : { over: "nothing is left to lay" };
    }
    persist();
    drawBoard();
  }
  function again() {
    if (frame) return;
    open(L.id, { fresh: true });
    drawBoard();
  }
  function next() {
    if (frame) return;
    if (index + 1 >= LEVELS.length) return openMenu();
    go(LEVELS[index + 1].id);
  }
  /** Shows a level (the one in hand when none is named). */
  function go(id) {
    open(id);
    drawBoard();
  }

  // ---------- the levels, in the menu ----------
  /** The levels in their chapters: each its number and the stars won; any can be played at any time, as it was left. */
  function levelList(onPick) {
    const all = document.createElement("div");
    all.className = "pi-levels";
    CHAPTERS.forEach(ch => {
      const head = document.createElement("h3"), grid = document.createElement("div");
      head.className = "pi-chap";
      head.textContent = ch.name;
      grid.className = "pi-lgrid";
      LEVELS.forEach((l, n) => {
        if (l.chapter !== ch.key) return;
        const b = document.createElement("button"), won = starsOf(l.id);
        b.type = "button";
        b.className = `pi-lv${won ? " done" : ""}${l.id === saved.id ? " now" : ""}`;
        b.setAttribute("aria-label", `Level ${n + 1}, ${l.name}${won ? `, ${plural(won, "star")}` : ""}`);
        if (l.id === saved.id) b.setAttribute("aria-current", "true");
        const num = document.createElement("b"), st = document.createElement("small");
        num.textContent = String(n + 1);
        st.textContent = won ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : HOLLOW.repeat(3);
        b.append(num, st);
        b.addEventListener("click", () => onPick(l.id));
        grid.append(b);
      });
      all.append(head, grid);
    });
    return all;
  }

  // ---------- wiring and showing ----------
  $("pzUndo").addEventListener("click", undo);
  $("pzClear").addEventListener("click", clearAll);
  $("pzHint").addEventListener("click", giveHint);
  $("pzAgain").addEventListener("click", again);
  $("pzNext").addEventListener("click", next);
  load();
  return {
    /** Shows the level in hand. */
    show() { $("board").hidden = false; $("shaft").hidden = true; $("card").hidden = true; shownFor = ""; svg = null; go(saved.id); },
    pause() { clearTimeout(oilTimer); oilTimer = 0; },
    resume() { if (run?.solved && oilTo !== Infinity) { oilTo = Infinity; drawBoard(); } },
    levelList, go, again, next, undo,
    get id() { return saved.id; },
    get level() { return LEVELS[index]; },
    get index() { return index; },
    get run() { return run; },
    get stars() { return stars; },
    firstOpen, totalStars,
    count: LEVELS.length,
    solvedCount: () => LEVELS.filter(l => stars[l.id]).length,
  };
}
