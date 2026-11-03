// Pipes, the puzzle, on the page (November 2026): the board of the level in hand, the hand of pieces to lay, the oil's way as
// it stands, the hint, the stars and the levels. The rules are pipes-puzzle.js's (pure) and the levels are
// pipes-puzzle-levels.js; this file draws them into pipes.html's board, queue, status line and buttons, and keeps the
// level in hand and the stars under pipes:puzzle and pipes:stars, so a partner watching sees the same board.
import { el, T, MID, channel, drawPipe, drawGround, drawSource, drawTerminal, pieceTile, PIECE_NAMES } from "./pipes-draw.js";
import * as Z from "./pipes-puzzle.js";
import { LEVELS as FLAT_LEVELS, CHAPTERS as FLAT_CHAPTERS } from "./pipes-puzzle-levels.js";
import { camera, pick, clampView, HOME } from "./pipes-map-view.js";
import { sure } from "./sure.js";

const STAR = "★", HOLLOW = "☆";
const OIL_STEP = 60;                      // ms between squares as the oil runs through a solved level
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const CHIPS = 46;                         // px kept clear at the map's left for the floor chips

/**
 * The puzzle's view. deps: { $ (element by id), read, write (localStorage with a fallback), toast, frame (a partner's
 * watching frame: no taps), openMenu, onSolved (a level finished: roundOver for random mode), reduced () }. cfg: the board
 * it is: { levels, chapters, run, stars (the saved keys), map (true for the 3D map: layers drawn as a stack you turn) }.
 */
export function createPuzzle(deps, cfg = {}) {
  const { $, read, write, toast, frame, openMenu, onSolved, reduced } = deps;
  const LEVELS = cfg.levels || FLAT_LEVELS, CHAPTERS = cfg.chapters || FLAT_CHAPTERS, map = !!cfg.map;
  const KEY = { run: cfg.run || "pipes:puzzle", stars: cfg.stars || "pipes:stars" };
  const indexOf = id => LEVELS.findIndex(l => l.id === id);
  // saved: { v, id (the level in hand), runs: { id: { sig (what the level was when this was kept), laid: { square: piece },
  // sel (the kind in hand), lifts, hints, solved (the stars of the finish, 0 while it's open) } }, view and layer (the map:
  // how the stack is turned, and the floor in front) }
  let saved = { v: 1, id: LEVELS[0].id, runs: {}, view: { ...HOME }, layer: 0 };
  let stars = {};                          // id -> the best stars won
  let L = null, laid = [], run = null, index = 0;
  let undoStack = [], hint = null, cellG = [], svg = null;
  let oilTo = 0, oilTimer = 0, passes = [];            // the oil running through a level just solved: how many squares it has filled
  let shownFor = "";
  // the map's stack: each floor's plate (a group the camera turns), the pipes between floors, each floor's overlay, the chips
  let plateG = [], linkG = [], overlayG = [], chipsEl = null, cam = null, gesture = null, lastBlank = 0, follow = false, observer = null;

  // ---------- keeping ----------
  const sigOf = spec => `${spec.map.join("/")}|${spec.hand}|${spec.out}${spec.inlet}`;
  function load() {
    const s = read(KEY.run, null);
    if (s?.v === 1 && typeof s.id === "string") saved = { v: 1, id: s.id, runs: s.runs || {}, view: clampView(s.view), layer: Number.isInteger(s.layer) ? s.layer : 0 };
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
    saved.layer = Math.min(Math.max(0, saved.layer), L.layers - 1);
    follow = "start";                                      // the map shows the floor where the oil needs a piece
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
    if (a >= 4 || b >= 4) return a >= 4 && b >= 4 ? [MID + 17, MID + 17] : [MID + 18, MID + 18];      // beside the riser
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
        if (s.a >= 4 || s.b >= 4) el("circle", { cx: MID, cy: MID, r: 5.5, class: "oil-dot" }, g);
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
  /** The group a square's overlay (the oil's dashed way, the ring, a cross) is drawn in: its floor's. */
  const overlayOf = c => (map ? overlayG[Z.layerOf(L, c)] : svg.querySelector(".overlay"));
  function drawOverlay(res) {
    (map ? overlayG : [svg.querySelector(".overlay")]).forEach(g => g.replaceChildren());
    if (run.solved) return;
    const at = (s, cls) => { const [x, y] = Z.xy(L, s.c); el("path", { d: channel(s.a, s.b).d, class: cls, transform: `translate(${x * T} ${y * T})` }, overlayOf(s.c)); };
    for (const s of res.passes) at(s, "route");
    for (const s of res.feed.passes) at(s, "route feed");
    const ring = (c, cls) => { const [x, y] = Z.xy(L, c); el("rect", { x: x * T + 4, y: y * T + 4, width: T - 8, height: T - 8, rx: 8, class: `next ${cls}` }, overlayOf(c)); };
    const { end } = res, fend = res.feed.end;
    if (end.why === "open") ring(end.c, "");
    else if (end.why !== "terminal") {
      // the oil is stopped: a cross where (or, off the edge, beyond the last square)
      const [x, y] = Z.xy(L, end.c);
      let cx = x * T + MID, cy = y * T + MID;
      if (end.why === "edge") { const last = res.passes[res.passes.length - 1] || { b: L.source.d }; cx += Z.DIRS[last.b][0] * (MID - 6); cy += Z.DIRS[last.b][1] * (MID - 6); }
      el("path", { d: `M${cx - 8} ${cy - 8}L${cx + 8} ${cy + 8}M${cx + 8} ${cy - 8}L${cx - 8} ${cy + 8}`, class: "spill-x" }, overlayOf(end.c));
    }
    if (fend.why === "open" && !(end.why === "open" && end.c === fend.c)) ring(fend.c, "out");
  }
  /** Draws the level. `follow` ("start" for a level just opened, true after a move) brings the floor where the oil needs
   *  its next piece, or a hint points, to the front; the player can look at another floor afterwards. */
  function drawBoard(follows = false) {
    const key = `${L.id}`;
    if (shownFor !== key || !svg) (map ? buildMap : build)();
    const res = resOf();
    const mode = follow || follows;
    follow = false;
    if (map && mode) {
      const at = hint ? (hint.c ?? hint.wrong?.[0]) : res.end.why === "open" ? res.end.c : mode === "start" ? (res.feed.end.why === "open" ? res.feed.end.c : L.source.c) : null;
      if (at != null && at !== undefined) { saved.layer = Z.layerOf(L, at); persist(); }
    }
    for (let c = 0; c < cellG.length; c++) drawCell(c, res);
    drawOverlay(res);
    if (map) { styleLayers(); drawLinks(); }
    drawHand();
    drawText(res);
    return res;
  }

  // ---------- the map: a stack of floors, turned by a finger ----------
  const FLOOR = "Floor";
  function buildMap() {
    const board = $("board");
    svg = el("svg", { role: "img", "aria-label": `${LEVELS[index].name}: the map, ${L.layers} floors` });
    cellG = []; plateG = []; linkG = []; overlayG = [];
    for (let z = 0; z < L.layers; z++) {
      const plate = el("g", { class: "plate" }, svg);
      el("rect", { x: -3, y: -3, width: L.cols * T + 6, height: L.rows * T + 6, rx: 9, class: "plate-bg" }, plate);
      for (let i = 0; i < L.cols * L.rows; i++) { const [x, y] = Z.xy(L, i); cellG.push(el("g", {}, el("g", { transform: `translate(${x * T} ${y * T})` }, plate))); }
      overlayG.push(el("g", { class: "overlay" }, plate));
      plateG.push(plate);
      if (z < L.layers - 1) linkG.push(el("g", { class: "links" }, svg));
    }
    svg.addEventListener("contextmenu", e => e.preventDefault());
    svg.addEventListener("pointerdown", e => {
      if (frame || e.button === 2 || gesture) return;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: saved.view.yaw, pitch: saved.view.pitch, turned: false };
      try { svg.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    });
    svg.addEventListener("pointermove", e => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (!gesture.turned && Math.hypot(dx, dy) < 8) return;
      gesture.turned = true;
      saved.view = clampView({ yaw: gesture.yaw + dx * 0.012, pitch: gesture.pitch + dy * 0.008 });
      fit();
    });
    const end = e => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const g = gesture;
      gesture = null;
      if (g.turned) return void persist();
      if (e.type === "pointerup") tapMap(e);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    chipsEl = document.createElement("div");
    chipsEl.className = "pi-layers";
    const head = document.createElement("small");
    head.textContent = FLOOR;
    chipsEl.append(head);
    for (let z = L.layers - 1; z >= 0; z--) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pi-layer";
      b.textContent = String(z + 1);
      b.dataset.z = z;
      b.setAttribute("aria-label", `${FLOOR} ${z + 1}`);
      b.addEventListener("click", () => setLayer(z));
      chipsEl.append(b);
    }
    const home = document.createElement("button");
    home.type = "button";
    home.className = "pi-layer home";
    home.textContent = "⟲";
    home.setAttribute("aria-label", "Reset the view");
    home.addEventListener("click", resetView);
    chipsEl.append(home);
    board.replaceChildren(svg, chipsEl);
    observer?.disconnect();
    if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(() => fit()); observer.observe(board); }
    shownFor = `${L.id}`;
    fit();
  }
  /** Places the stack for the board's size and the turn: every floor's plate is the flat board's picture under a matrix. */
  function fit() {
    if (!map || !svg || !L) return;
    const board = $("board"), W = board.clientWidth, H = board.clientHeight;
    if (W < 20 || H < 20) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    cam = camera(L, W, H, saved.view, { l: CHIPS, r: 4, t: 4, b: 4 });
    plateG.forEach((p, z) => p.setAttribute("transform", `matrix(${cam.plate(z).join(" ")})`));
    drawLinks();
  }
  function styleLayers() {
    plateG.forEach((p, z) => p.setAttribute("class", `plate ${z === saved.layer ? "on" : z > saved.layer ? "over" : "under"}`));
    chipsEl?.querySelectorAll(".pi-layer[data-z]").forEach(b => b.classList.toggle("now", Number(b.dataset.z) === saved.layer));
  }
  function setLayer(z) {
    if (z === saved.layer) return;
    saved.layer = z;
    persist();
    styleLayers();
  }
  function resetView() {
    saved.view = { ...HOME };
    persist();
    fit();
  }
  /** A tap on the map: a square of the floor in front lays a piece; another floor's plate brings that floor forward; empty
   *  space twice in a row puts the view back. */
  function tapMap(e) {
    if (!cam) return;
    const r = svg.getBoundingClientRect();
    const hit = pick(L, cam, saved.layer, (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width), (e.clientY - r.top) * (svg.viewBox.baseVal.height / r.height));
    if (!hit) { const now = Date.now(); if (now - lastBlank < 400) { lastBlank = 0; resetView(); } else lastBlank = now; return; }
    if (hit.c < 0) return setLayer(hit.z);
    tap(hit.c);
  }
  /** The pipes between floors, drawn on the screen (not on a plate): from a square's middle up to the one above. A pipe
   *  that one side has and the other lacks stops half way. */
  function drawLinks() {
    if (!map || !cam) return;
    const size = L.cols * L.rows, wet = new Set();
    passes.forEach((s, i) => { if (i < oilTo) { if (s.b === 4) wet.add(s.c); else if (s.b === 5) wet.add(Z.beyond(L, s.c, 5)); } });
    if (oilTo > 0) { if (L.source.d === 4) wet.add(L.source.c); else if (L.source.d === 5) wet.add(Z.beyond(L, L.source.c, 5)); }
    if (oilTo > passes.length) { const t = L.terminal; if (t.d === 4) wet.add(t.c); else if (t.d === 5) wet.add(Z.beyond(L, t.c, 5)); }
    const opens = (c, d) => {
      const f = L.cells[c];
      if (f?.k === "source" || f?.k === "terminal") return f.d === d;
      const piece = Z.pieceOn(L, laid, c);
      return !!piece && !!Z.channelOf(piece, d);
    };
    linkG.forEach((g, z) => {
      g.replaceChildren();
      for (let i = 0; i < size; i++) {
        const lo = z * size + i, hi = lo + size, up = opens(lo, 4), down = opens(hi, 5);
        if (!up && !down) continue;
        const [x, y] = Z.xy(L, lo), u = x * T + MID, v = y * T + MID;
        const a = cam.at(z, u, v), b = cam.at(z + 1, u, v), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const [p, q] = up && down ? [a, b] : up ? [a, m] : [m, b];
        const d = `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`, w = cam.k;
        el("path", { d, class: "shaft-edge", "stroke-width": 20 * w }, g);
        el("path", { d, class: "shaft", "stroke-width": 14 * w }, g);
        if (wet.has(lo) && up && down) el("path", { d, class: "shaft-oil", "stroke-width": 8 * w }, g);
        if (!(up && down)) el("path", { d, class: "shaft-open", "stroke-width": 3 }, g);
      }
    });
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
    q.className = `pi-queue pi-hand${Z.KINDS.filter(k => L.hand[k]).length > 9 ? " many wrap" : Z.KINDS.filter(k => L.hand[k]).length > 7 ? " many" : ""}`;
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
    if (hint) return hint.done ? "Hint: nothing is left to lay" : "Hint: this piece goes in the dashed square";
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
    if (map && res.end.why === "open" && Z.layerOf(L, res.end.c) !== saved.layer) return `The oil waits on floor ${Z.layerOf(L, res.end.c) + 1} · tap Look · ${plural(left, "piece")} left`;
    return `${cur ? `Tap a square for the ${PIECE_NAMES[cur]}` : "Pick a piece from the hand"} · the oil runs ${plural(reach, "piece")}`;
  }
  function drawText(res) {
    const text = textOf(res);
    $("status").textContent = text;
    $("stat1Label").textContent = "Level"; $("stat1").textContent = String(index + 1);
    $("stat3Label").textContent = "To lay"; $("stat3").textContent = run.solved ? "✓" : String(res.left);
    $("stat3").className = run.solved ? "met" : "";
    $("scoreLabel").textContent = "Stars";
    $("score").textContent = `${totalStars()}${STAR}`;
    const solved = !!run.solved;
    $("puzzleControls").classList.toggle("done", solved);
    $("pzUndo").hidden = solved; $("pzClear").hidden = solved; $("pzHint").hidden = solved;
    $("pzAgain").hidden = !solved; $("pzNext").hidden = !solved;
    $("puzzleControls").classList.toggle("map", map);
    $("pzLook").hidden = !map || solved;
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
    const res = drawBoard(true);
    if (res.solved) solved(res);
  }
  function undo() {
    if (frame || run.solved || !undoStack.length) return;
    const s = undoStack.pop();
    laid = s.laid; run.lifts = s.lifts; run.sel = s.sel; hint = null;
    store();
    drawBoard(true);
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
   *  the pieces that are in the way. It caps the level at one star (starsFor). */
  async function giveHint() {
    if (frame || run.solved || oilTimer) return;
    if (!run.hints && !(await sure("A hint caps this level at one star. Show one?", { yes: "Hint" }))) return;
    hint = Z.hintFor(L, laid);
    if (!hint) return;
    run.hints++;
    persist();
    drawBoard(true);
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
    show() { $("queue").hidden = false; $("board").hidden = false; $("board").className = `pi-board${map ? " map" : ""}`; shownFor = ""; svg = null; go(saved.id); },
    hide() {
      $("queue").hidden = true; $("board").hidden = true;
      $("puzzleControls").classList.remove("map"); $("pzLook").hidden = true;
      observer?.disconnect(); observer = null;
    },
    pause() { clearTimeout(oilTimer); oilTimer = 0; },
    resume() { if (run?.solved && oilTo !== Infinity) { oilTo = Infinity; drawBoard(); } },
    resize() { fit(); },
    /** The map: brings forward the floor where the oil needs its next piece. */
    look() {
      if (frame || !map || run.solved) return;
      const res = resOf(), at = res.end.why === "open" ? res.end.c : res.feed.end.why === "open" ? res.feed.end.c : null;
      if (at != null) setLayer(Z.layerOf(L, at));
      drawBoard();
    },
    levelList, go, again, next, undo, clear: clearAll, hint: giveHint,
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
