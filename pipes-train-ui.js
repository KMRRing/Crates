// Gears on the page (4 November 2026; Pipes until then): the board of the level in hand, the hand of pieces to lay, the turns
// the mainspring gives every gear it drives, the jams, the hint, the stars and the levels. The rules are pipes-train.js's (pure)
// and the levels pipes-train-levels.js; this file draws them into pipes.html's board, queue, status line and buttons, and keeps
// the level in hand and the stars under pipes:train and pipes:trainstars, so a partner watching sees the same board.
import { el, T, MID, spinMs, drawPiece, drawSource, drawLoad, drawGround, turnArrow, badgeAt, pieceTile, phasesOf, PIECE_NAMES } from "./pipes-wheels.js";
import * as Z from "./pipes-train.js";
import { LEVELS, CHAPTERS } from "./pipes-train-levels.js";
import { sure } from "./sure.js";
import { tick as tickSound } from "./pipes-sound.js";

const STAR = "★", HOLLOW = "☆";
const STEP = 70;                          // ms between gears as the train starts turning in a solved level
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const WAY = ["clockwise", "counter-clockwise"];

/**
 * The puzzle's view. deps: { $ (element by id), read, write (localStorage with a fallback), toast, frame (a partner's watching
 * frame: no taps), openMenu, onSolved (a level finished: roundOver for random mode), reduced (), sound () }.
 */
export function createPuzzle(deps) {
  const { $, read, write, toast, frame, openMenu, onSolved, reduced } = deps;
  const KEY = { run: "pipes:train", stars: "pipes:trainstars" };
  const indexOf = id => LEVELS.findIndex(l => l.id === id);
  // saved: { v, id (the level in hand), runs: { id: { sig (what the level was when this was kept), laid: { square: piece },
  // sel (the kind in hand), lifts, hints, solved (the stars of the finish, 0 while it's open) } } }
  let saved = { v: 1, id: LEVELS[0].id, runs: {} };
  let stars = {};                          // id -> the best stars won
  let L = null, laid = [], run = null, index = 0;
  let undoStack = [], hint = null, cellG = [], svg = null, last = null;
  let oilTo = 0, oilTimer = 0, order = [], spinEpoch = 0;            // the train turning in a level just solved: how many gears have started
  let shownFor = "", jamKey = "";

  // ---------- keeping ----------
  const sigOf = spec => `${spec.map.join("/")}|${spec.hand}|${spec.out}${spec.inlet}${spec.spin}`;
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
    clearTimeout(oilTimer); oilTimer = 0; spinEpoch = 0;
    index = Math.max(0, indexOf(id));
    const spec = LEVELS[index];
    L = Z.parseLevel(spec);
    saved.id = spec.id;
    let r = saved.runs[spec.id];
    if (!r || r.sig !== sigOf(spec) || fresh) r = saved.runs[spec.id] = { sig: sigOf(spec), laid: {}, sel: null, lifts: 0, hints: 0, solved: 0 };
    run = r;
    laid = Z.unpackLaid(L, run.laid);
    undoStack = []; hint = null; jamKey = "";
    oilTo = run.solved ? Infinity : 0;
    order = run.solved ? Z.check(L, laid).m.order : [];
    persist();
  }
  function store() {
    run.laid = Z.packLaid(laid);
    persist();
  }
  const handNow = () => Z.handLeft(L, laid);
  const sel = () => (run.sel && (handNow()[run.sel] || 0) > 0 ? run.sel : null);

  // ---------- drawing ----------
  function drawCell(c, res, ph) {
    const g = cellG[c], f = L.cells[c], piece = Z.pieceOn(L, laid, c), m = res.m;
    g.replaceChildren();
    if (f?.k === "rock") return;
    const gearsOf = c3 => { const k = m.shapes[c]?.gears.length || 0; return Array.from({ length: k }, (_, i) => c3 + i); };
    const turns = gearsOf(c * 3).map(u => (m.turn[u] >= 0 ? m.turn[u] : null)), phases = gearsOf(c * 3).map(u => ph[u]);
    const jams = new Set(gearsOf(c * 3).map((u, i) => (m.jam.has(u) ? i : -1)).filter(i => i >= 0));
    if (f?.k === "source") drawSource(g, f.d, { phase: phases[0], jam: jams.has(0) });
    else if (f?.k === "terminal") {
      drawLoad(g, f.d, { phase: phases[0], jam: jams.has(0), dir: turns[0] });
      const state = res.loadOn ? (res.spinOk ? "ok" : "bad") : "";
      turnArrow(g, ...badgeAt(f.d), L.spin, 5, `g-turn load ${state}`);
    } else if (piece) {
      const old = f?.k === "old", box = old ? el("g", { class: "old" }, g) : g;
      drawPiece(box, piece, { turns, phases, jams });
      if (old) el("circle", { cx: 8, cy: 52, r: 4, class: "fixed-mark" }, g);
    }
    if (L.load[c] >= 0) {
      const state = res.loads[c] || "";
      if (!piece) {
        // an empty load: a ring waiting for a single gear that turns this way
        el("circle", { cx: MID, cy: MID, r: 25, class: "load-ring" }, g);
        turnArrow(g, MID, MID, L.load[c], 11, "g-turn load big");
      } else {
        el("circle", { cx: 12, cy: 12, r: 10, class: `stake ${state}` }, g);
        turnArrow(g, 12, 12, L.load[c], 6, `g-turn load plate ${state}`);
      }
    }
    if (hint) {
      if (hint.wrong?.includes(c)) el("rect", { x: 3, y: 3, width: T - 6, height: T - 6, rx: 8, class: "pick bad" }, g);
      if (hint.c === c) {
        drawPiece(el("g", { class: "ghost" }, g), hint.piece, { phases: Z.SHAPES[hint.piece].gears.map((_, i) => (i % 2 ? 180 / Z.SHAPES[hint.piece].gears[i].n : 0)) });
        el("rect", { x: 3, y: 3, width: T - 6, height: T - 6, rx: 8, class: "pick" }, g);
      }
    }
  }
  /** Draws the level; returns how it stands. */
  function drawBoard() {
    if (shownFor !== L.id || !svg) build();
    const res = Z.check(L, laid), ph = phasesOf(L, res.m);
    last = res;
    for (let c = 0; c < cellG.length; c++) drawCell(c, res, ph);
    drawHand();
    drawText(res);
    if (run.solved && oilTo === Infinity) startSpin();
    return res;
  }
  function build() {
    const board = $("board");
    // a margin of 4 round the plate, for the teeth of the wheels at its edge
    svg = el("svg", { viewBox: `-4 -4 ${L.cols * T + 8} ${L.rows * T + 8}`, role: "img", "aria-label": `${LEVELS[index].name}: the plate` });
    cellG = [];
    // the ground first and the wheels over all of it, so that a tooth reaching into the next square is not painted over by it
    for (let c = 0; c < L.size; c++) { const [x, y] = Z.xy(L, c); drawGround(el("g", { transform: `translate(${x * T} ${y * T})` }, svg), L.cells[c]?.k === "rock"); }
    for (let c = 0; c < L.size; c++) { const [x, y] = Z.xy(L, c); cellG.push(el("g", { transform: `translate(${x * T} ${y * T})` }, svg)); }
    svg.addEventListener("pointerdown", e => {
      if (e.button === 2) return;
      const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * (L.cols * T + 8) - 4, vy = (e.clientY - r.top) / r.height * (L.rows * T + 8) - 4;
      const x = Math.floor(vx / T), y = Math.floor(vy / T);
      if (x >= 0 && y >= 0 && x < L.cols && y < L.rows) tap(y * L.cols + x);
    });
    svg.addEventListener("contextmenu", e => e.preventDefault());
    board.replaceChildren(svg);
    board.style.setProperty("--cols", (L.cols * T + 8) / T);
    board.style.setProperty("--rows", (L.rows * T + 8) / T);
    shownFor = L.id;
  }
  function drawHand() {
    const q = $("queue"), left = handNow(), cur = sel(), kinds = Z.kindsOf(L);
    q.className = `pi-queue pi-hand${kinds.length > 8 ? " many wrap" : kinds.length > 6 ? " many" : ""}`;
    const label = document.createElement("span");
    label.className = "pi-q-label";
    label.textContent = "Hand";
    const tiles = kinds.map(k => {
      const b = pieceTile(k, "button");
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
  function textOf(res) {
    const spec = LEVELS[index], left = res.left;
    if (run.solved) return `${spec.name} runs · ${STAR.repeat(run.solved)}${HOLLOW.repeat(3 - run.solved)}`;
    if (hint?.wrong?.length) return "The red gears aren't in an answer: lift them";
    if (hint) return hint.done ? "Hint: nothing is left to lay" : "Hint: this piece goes in the dashed square";
    if (res.jams.length) return "Jam: these gears would have to turn both ways. Move one";
    if (!res.placed) {
      // a chapter's first level says what's new in it; the rest say what to do
      const ch = CHAPTERS.find(c => c.key === spec.chapter);
      return LEVELS.findIndex(l => l.chapter === spec.chapter) === index ? `${ch.name}: ${ch.rule}` : `${spec.name}: lay all ${plural(L.total, "piece")}`;
    }
    const badLoad = L.loads.find(c => res.loads[c] === "bad");
    if (badLoad !== undefined) return `A load turns ${WAY[res.m.turn[badLoad * 3]]} and wants ${WAY[L.load[badLoad]]}: count the gears before it`;
    if (!left) {
      if (res.strays.length) return `${plural(res.strays.length, "gear")} the mainspring doesn't drive`;
      if (res.missed.length) return "The train misses a fixed gear";
      if (!res.loadOn) return "No pieces left, and the load isn't driven";
      if (!res.spinOk) return `The dial turns ${WAY[res.m.turn[L.terminal.c * 3]]} and wants ${WAY[L.spin]}: count the gears`;
      if (!res.loadsOk) return "A load has no gear yet";
      if (!res.path) return "Every gear must sit on one train, from the mainspring to the dial";
      return "";
    }
    const cur = sel(), reach = res.m.driven.size - 1;
    if (res.loadOn) return `The dial is driven with ${plural(left, "piece")} left: every piece must be on the train`;
    return `${cur ? `Tap a square for the ${PIECE_NAMES[cur]}` : "Pick a piece from the hand"} · ${plural(reach, "gear")} turning`;
  }
  function drawText(res) {
    $("status").textContent = textOf(res);
    $("stat1Label").textContent = "Level"; $("stat1").textContent = String(index + 1);
    $("stat3Label").textContent = "To lay"; $("stat3").textContent = run.solved ? "✓" : String(res.left);
    $("stat3").className = run.solved ? "met" : "";
    $("scoreLabel").textContent = "Stars";
    $("score").textContent = `${totalStars()}${STAR}`;
    const solved = !!run.solved;
    $("puzzleControls").classList.toggle("done", solved);
    $("pzUndo").hidden = solved; $("pzClear").hidden = solved; $("pzHint").hidden = solved;
    $("pzAgain").hidden = !solved; $("pzNext").hidden = !solved;
    $("pzLook").hidden = true;
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
    if (L.cells[c]) { hint = null; return void drawBoard(); }
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
      } else {
        undoStack.pop();
        if (r === "load") toast("A load takes a single gear only", 1600);
      }
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
      return void drawBoard();
    }
    store();
    const res = drawBoard();
    // a jam that has just appeared: two dull clacks
    const key = res.jams.join(",");
    if (key && key !== jamKey) { sound(0.42); setTimeout(() => sound(0.34), 90); }
    jamKey = key;
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
  /** A level finished: its stars, the train turning, and what the next step is. */
  function solved(res) {
    run.solved = Z.starsFor(L, run);
    if (run.solved > starsOf(L.id)) { stars[L.id] = run.solved; if (!frame) write(KEY.stars, stars); }
    order = res.m.order;
    store();
    onSolved?.(run.solved);
    if (reduced()) { oilTo = Infinity; return void drawBoard(); }
    // the train starts turning gear by gear from the mainspring, each with its tick, and the load's hands move last
    oilTo = 0;
    drawBoard();
    startSpin();
    const tick = () => {
      oilTo++;
      if (oilTo >= order.length + 2) { oilTo = Infinity; oilTimer = 0; return startSpin(); }
      startSpin();
      sound(oilTo <= order.length ? 1 + (oilTo % 2) * 0.12 : 0.7);
      oilTimer = setTimeout(tick, STEP);
    };
    oilTimer = setTimeout(tick, STEP);
  }
  /** Sets every gear of a solved level turning at once, each wheel at its own speed (a tooth passes at the same rate on all), and
   *  the load's hands, minute and hour, once the train has reached the load (`oilTo`). All wheels count from one start
   *  (`spinEpoch`): teeth that mesh stay meshed (a wheel started later would be out of step for good), and a redraw, which makes
   *  new animations, picks the wheels up where they are instead of from zero. Safe to call again: a wheel turns once. */
  function startSpin() {
    if (!run.solved || reduced() || !cellG.length) return;
    if (!spinEpoch) spinEpoch = performance.now();
    for (let c = 0; c < cellG.length; c++) {
      for (const sp of cellG[c].querySelectorAll(".spin.cw, .spin.ccw")) {
        if (sp.dataset.on) continue;
        sp.dataset.on = "1";
        const turn = sp.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${sp.classList.contains("ccw") ? -360 : 360}deg)` }], { duration: spinMs(Number(sp.dataset.n)), iterations: Infinity });
        turn.currentTime = performance.now() - spinEpoch;
      }
      if (c === L.terminal.c && oilTo > order.length) {
        const s = L.spin ? -1 : 1;
        for (const [q, from, turns, ms] of [[".g-hand.minute", 60, 6, 12000], [".g-hand.hour", -60, 0.5, 12000]]) {
          const h = cellG[c].querySelector(q);
          if (h && !h.dataset.on) { h.dataset.on = "1"; h.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${from + s * 360 * turns}deg)` }], { duration: ms, iterations: Infinity }); }
        }
      }
    }
  }
  /** A soft tick (pipes-sound.js), if the player has sound on. */
  const sound = pitch => { if (deps.sound?.()) tickSound(pitch); };
  /** The hint: if the pieces laid can still be part of an answer, where the next piece goes along the train; if not, the pieces
   *  that are in the way. It caps the level at one star (starsFor). */
  async function giveHint() {
    if (frame || run.solved || oilTimer) return;
    if (!run.hints && !(await sure("A hint caps this level at one star. Show one?", { yes: "Hint" }))) return;
    hint = Z.hintFor(L, laid);
    if (!hint) return;
    run.hints++;
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

  // ---------- showing (the page's buttons are wired in pipes.js, to whichever board is showing) ----------
  load();
  return {
    /** Shows the level in hand. */
    show() { $("queue").hidden = false; $("board").hidden = false; $("board").className = "pi-board"; shownFor = ""; svg = null; go(saved.id); },
    hide() { $("queue").hidden = true; $("board").hidden = true; $("pzLook").hidden = true; },
    pause() { clearTimeout(oilTimer); oilTimer = 0; },
    resume() { if (run?.solved && oilTo !== Infinity) { oilTo = Infinity; drawBoard(); } },
    resize() {},
    look() {},
    levelList, go, again, next, undo, clear: clearAll, hint: giveHint, tap,
    get id() { return saved.id; },
    get level() { return LEVELS[index]; },
    get index() { return index; },
    get run() { return run; },
    get stars() { return stars; },
    get laid() { return laid; },
    get res() { return last; },
    firstOpen, totalStars,
    count: LEVELS.length,
    solvedCount: () => LEVELS.filter(l => stars[l.id]).length,
  };
}
