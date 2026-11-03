// Pipes on a solid, on the page (November 2026): the Puzzle played on the faces of a solid you turn with a finger. The rules are
// pipes-solid.js's (pure) and the drawing pipes-solid-3d.js's; this file keeps the level in hand, the camera, the stars and the
// hand of pieces under pipes:<solid> and pipes:<solid>stars (so a partner watching sees the same board), and answers taps and drags.
// It fills the same page furniture as the flat Puzzle (pipes-puzzle-ui.js): the board, the hand, the numbers, the line and the buttons.
import * as Z from "./pipes-solid.js";
import { paintTile, solidMatrix, netLayout, netPick, paletteOf, forgetPalette, iconSvg } from "./pipes-solid-3d.js";
import { sure } from "./sure.js";

const STAR = "★", HOLLOW = "☆";
const OIL_STEP = 60;                       // ms between tiles as the oil runs through a level just solved
const SPIN_MS = 14000;                     // a solved level turns by itself this long, so the whole route is seen
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * deps: { $, read, write, toast, frame (a partner's watching frame: no taps), openMenu, onSolved, reduced (), solid ("cube"),
 * key (the saved keys' name), levels, chapters }.
 */
export function createSolid(deps) {
  const { $, read, write, toast, frame, openMenu, onSolved, reduced, solid, key, levels: LEVELS, chapters: CHAPTERS } = deps;
  const KEY = { run: `pipes:${key}`, stars: `pipes:${key}stars` };
  const NAMES = Z.KIND_NAMES[solid];
  const indexOf = id => LEVELS.findIndex(l => l.id === id);
  // saved: { v, id, runs: { id: { sig, laid: { tile: piece }, sel, rot (the turn last used for each kind), lifts, hints, solved } },
  //          view: { id (the level it was for), yaw, pitch, zoom, net } }
  let saved = { v: 1, id: LEVELS[0].id, runs: {}, view: { id: "", yaw: .6, pitch: .45, zoom: 1, net: false } };
  let stars = {};
  let L = null, laid = [], run = null, index = 0, res = null, infos = [];
  let undoStack = [], hint = null, lifting = false, lookAt = 0, way = null;
  let oilTo = 0, oilTimer = 0, passes = [];
  let canvas = null, ctx = null, W = 1, H = 1, dpr = 1, net = null, raf = 0, anim = null, spinUntil = 0, last = 0, shown = false;

  // ---------- keeping ----------
  const sigOf = s => [s.solid, s.m, s.src, s.term, s.rocks, JSON.stringify(s.olds), s.stakes, s.hand].join("|");
  function load() {
    const s = read(KEY.run, null);
    if (s?.v === 1 && typeof s.id === "string") saved = { v: 1, id: s.id, runs: s.runs || {}, view: { ...saved.view, ...(s.view || {}) } };
    const st = read(KEY.stars, {});
    stars = st && typeof st === "object" ? st : {};
    if (indexOf(saved.id) < 0) saved.id = firstOpen();
  }
  const persist = () => { if (!frame) write(KEY.run, saved); };
  const view = () => saved.view;
  const totalStars = () => Object.entries(stars).reduce((n, [id, s]) => n + (indexOf(id) >= 0 ? s : 0), 0);
  const firstOpen = () => (LEVELS.find(l => !stars[l.id]) || LEVELS[0]).id;
  const starsOf = id => stars[id] || 0;
  const kinds = () => Z.kindsOf(L.S).filter(k => L.hand[k]);

  // ---------- the level in hand ----------
  function open(id, { fresh = false } = {}) {
    clearTimeout(oilTimer); oilTimer = 0;
    index = Math.max(0, indexOf(id));
    const spec = LEVELS[index];
    L = Z.parseLevel(spec);
    saved.id = spec.id;
    let r = saved.runs[spec.id];
    if (!r || r.sig !== sigOf(spec) || fresh) r = saved.runs[spec.id] = { sig: sigOf(spec), laid: {}, sel: null, rot: {}, lifts: 0, hints: 0, solved: 0 };
    run = r;
    run.rot = run.rot || {};
    way = { toTerminal: Z.distFrom(L, Z.across(L, L.terminal.c, L.terminal.d)[0]), toSource: Z.distFrom(L, Z.across(L, L.source.c, L.source.d)[0]) };
    laid = Z.emptyLaid(L);
    for (const [c, p] of Object.entries(run.laid)) if (!L.cells[c] && Z.KINDS.includes(p[0])) laid[c] = p;
    undoStack = []; hint = null; lifting = false; lookAt = 0; anim = null; net = null;
    oilTo = run.solved ? Infinity : 0;
    passes = run.solved ? Z.check(L, laid).passes : [];
    if (view().id !== spec.id) { Object.assign(view(), facing(L.source.c), { id: spec.id, zoom: 1 }); }
    spinUntil = 0;
    persist();
  }
  function store() {
    run.laid = {};
    laid.forEach((p, c) => { if (p) run.laid[c] = p; });
    persist();
  }
  const handNow = () => Z.handLeft(L, laid);
  const sel = () => (run.sel && (handNow()[run.sel] || 0) > 0 ? run.sel : null);

  // ---------- the camera ----------
  /** The yaw and pitch that show tile c, from a little above and beside, so two more faces show with it. */
  function facing(c) {
    const N = L.S.tiles[c].N;
    return { yaw: Math.atan2(N[0], N[2]) + .5, pitch: clamp(Math.asin(clamp(N[1], -1, 1)) + .38, -Z.MAX_PITCH, Z.MAX_PITCH) };
  }
  // the engine's camera fits the solid's whole corner-to-corner circle with a margin; a cube is rarely seen so wide, so it is drawn a
  // tenth larger (a corner can touch the edge); a dodecahedron's corners are all on the circle and it keeps the margin
  const FIT = solid === "cube" ? 1.12 : 1;
  const camera = () => ({ yaw: view().yaw, pitch: view().pitch, zoom: view().zoom * FIT, aspect: W / H });
  /** Turns the solid to show tile c: eased, or at once if the player asked for less motion. */
  function flyTo(c) {
    if (view().net) return;
    const to = facing(c);
    let dy = to.yaw - view().yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));                // the short way round
    if (reduced()) { view().yaw += dy; view().pitch = to.pitch; draw(); return keepView(); }
    anim = { t0: performance.now(), dur: 520, y0: view().yaw, dy, p0: view().pitch, dp: to.pitch - view().pitch };
    kick();
  }
  const keepView = () => persist();
  function kick() { if (!raf && shown) { last = performance.now(); raf = requestAnimationFrame(frameLoop); } }
  function frameLoop(now) {
    raf = 0;
    if (!shown) return;
    let again = false;
    if (anim) {
      const k = clamp((now - anim.t0) / anim.dur, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      view().yaw = anim.y0 + anim.dy * e; view().pitch = clamp(anim.p0 + anim.dp * e, -Z.MAX_PITCH, Z.MAX_PITCH);
      if (k >= 1) { anim = null; keepView(); } else again = true;
    } else if (spinUntil > now && !view().net) {
      view().yaw += (now - last) * .00026;
      again = true;
    }
    last = now;
    draw();
    if (again) kick();
  }

  // ---------- drawing ----------
  function size() {
    const host = $("board"), r = host.getBoundingClientRect();
    if (!canvas || r.width < 4 || r.height < 4) return;
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);          // iPhones: never more than 2
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    net = null;
  }
  function draw() {
    if (!ctx || !L || !res) return;
    const P = paletteOf($("board")), S = L.S;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fillFace = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = P.ground; ctx.fill(); };
    if (view().net) {
      net ||= netLayout(S, W, H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      net.faces.forEach(fillFace);                                // the dark under the tiles, so the gaps between them read as seams
      S.tiles.forEach((T, c) => { const t = infos[c]; t.m = net.tiles[c].m; t.dpr = dpr; t.shade = 0; paintTile(ctx, t, P); });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = P.brass; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      for (const f of net.faces) { ctx.beginPath(); f.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); }
      // the cut edges are lettered, the same letter at both ends: where the net folds shut
      ctx.fillStyle = P.ink; ctx.font = "800 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const k of net.cuts) ctx.fillText(String.fromCharCode(65 + k.pair), k.at[0] + k.out[0] * 9, k.at[1] + k.out[1] * 9);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    const cam = camera(), { d, r, u } = Z.basis(cam.yaw, cam.pitch);
    const light = [-.35 * r[0] + .65 * u[0] + .7 * d[0], -.35 * r[1] + .65 * u[1] + .7 * d[1], -.35 * r[2] + .65 * u[2] + .7 * d[2]];
    const ll = Math.hypot(...light);
    const { hx, hy } = Z.halves(cam.aspect, cam.zoom), px = p => [(Z.dot(p, r) / hx + 1) * W / 2, (1 - Z.dot(p, u) / hy) * H / 2];
    const seen = S.faces.filter(f => Z.dot(S.tiles[f.tiles[0]].N, d) > 1e-6);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const f of seen) fillFace(f.verts.map(px));
    S.tiles.forEach((T, c) => {
      const m = solidMatrix(T, cam, W, H);
      if (!m) return;
      const t = infos[c];
      t.m = m; t.dpr = dpr; t.shade = .4 * (1 - clamp(Z.dot(T.N, light) / ll, 0, 1));
      paintTile(ctx, t, P);
    });
    // each visible face's frame, so the faces read as faces
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = P.brass; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.lineJoin = "round";
    for (const f of seen) {
      ctx.beginPath(); f.verts.forEach((v, i) => { const [x, y] = px(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  /** What each tile shows, from the pieces as they stand. */
  function refresh() {
    res = Z.check(L, laid);
    res.feed = Z.feed(L, laid);
    const order = [];
    for (const s of res.passes) if (L.stakeAt[s.c] && !order.includes(s.c)) order.push(s.c);
    const stakeState = L.stakes.map((c, i) => { const at = order.indexOf(c); return at < 0 ? "" : L.stakes[at] === c ? "ok" : "bad"; });
    infos = L.S.tiles.map((T, c) => ({ n: T.n, cell: L.cells[c], piece: Z.pieceOn(L, laid, c), oil: [], route: [], feed: [],
      stake: L.stakeAt[c] ? { n: L.stakeAt[c], state: stakeState[L.stakeAt[c] - 1] } : null }));
    const solvedNow = !!run.solved;
    passes.forEach((s, i) => { if (i < oilTo) infos[s.c].oil.push({ a: s.a, b: s.b }); });
    infos[L.source.c].stub = oilTo > 0;
    infos[L.terminal.c].stub = oilTo > passes.length;
    if (!solvedNow) {
      for (const s of res.passes) infos[s.c].route.push({ a: s.a, b: s.b });
      for (const s of res.feed.passes) infos[s.c].feed.push({ a: s.a, b: s.b });
      const { end } = res, fend = res.feed.end;
      if (end.why === "open") infos[end.c].ring = "next";
      else if (end.why !== "terminal") infos[end.c].spill = true;
      if (fend.why === "open" && !(end.why === "open" && end.c === fend.c)) infos[fend.c].ring = "out";
    }
    if (hint) {
      for (const c of hint.wrong || []) infos[c].hint = "wrong";
      if (hint.piece) infos[hint.c].ghost = hint.piece;
    }
  }
  function drawBoard() {
    refresh();
    draw();
    drawHand();
    drawText();
  }
  function drawHand() {
    const q = $("queue"), left = handNow(), cur = sel(), n = L.S.tiles[0].n;
    q.className = "pi-queue pi-hand";
    const label = document.createElement("span");
    label.className = "pi-q-label";
    label.textContent = "Hand";
    const tiles = kinds().map(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pi-q pi-h${cur === k ? " sel" : ""}${left[k] ? "" : " none"}`;
      b.innerHTML = iconSvg(n, k);
      b.disabled = !!run.solved;
      b.setAttribute("aria-label", `${NAMES[k]}, ${left[k]} left`);
      b.setAttribute("aria-pressed", cur === k ? "true" : "false");
      const c = document.createElement("b");
      c.className = "pi-n";
      c.textContent = left[k];
      b.append(c);
      b.addEventListener("click", () => choose(k));
      return b;
    });
    q.replaceChildren(label, ...tiles);
  }

  // ---------- the line under the board, the numbers, the buttons ----------
  const WHY = { rock: "The oil runs into rock", shape: "The oil meets a piece that won't take it in", full: "The oil meets pipe it has already filled", loop: "The oil goes round in a circle" };
  function textOf() {
    const spec = LEVELS[index], left = res.left;
    if (run.solved) return `${spec.name} solved · ${STAR.repeat(run.solved)}${HOLLOW.repeat(3 - run.solved)}`;
    if (hint?.wrong?.length) return "The red pieces aren't in an answer: lift them";
    if (hint) return hint.done ? "Hint: nothing is left to lay" : "Hint: this piece goes in the dashed tile";
    if (lifting) return "Tap a piece you've laid to take it back";
    if (!res.placed) {
      const ch = CHAPTERS.find(c => c.key === spec.chapter);
      return LEVELS.findIndex(l => l.chapter === spec.chapter) === index ? `${ch.name}: ${ch.rule}` : `${spec.name}: lay all ${plural(L.total, "piece")}`;
    }
    if (!left) {
      if (res.end.why === "terminal") {
        if (res.strays.length) return `${plural(res.strays.length, "piece")} the oil never reaches`;
        if (res.missed.length) return "The oil misses old pipe";
        if (!res.stakesOk) return "The stakes must be passed in order";
        return "";
      }
      if (res.end.why === "open") return "No pieces left, and a gap in the route";
      return `${WHY[res.end.why] || "The oil is stopped"}, and no pieces left`;
    }
    const cur = sel(), reach = res.passes.length;
    if (res.end.why === "terminal") return `The oil is in the terminal with ${plural(left, "piece")} left: it must run through them all`;
    if (res.end.why !== "open" && reach) return `${WHY[res.end.why]} · ${plural(left, "piece")} left`;
    return `${cur ? `Tap a tile for the ${NAMES[cur].toLowerCase()}` : "Pick a piece from the hand"} · the oil runs ${plural(reach, "piece")}`;
  }
  function drawText() {
    $("status").textContent = textOf();
    $("stat1Label").textContent = "Level"; $("stat1").textContent = String(index + 1);
    $("stat3Label").textContent = "To lay"; $("stat3").textContent = run.solved ? "✓" : String(res.left);
    $("stat3").className = run.solved ? "met" : "";
    $("scoreLabel").textContent = "Stars";
    $("score").textContent = `${totalStars()}${STAR}`;
    const solved = !!run.solved;
    $("puzzleControls").classList.toggle("done", solved);
    $("puzzleControls").classList.toggle("net", !!view().net);
    $("pzUndo").hidden = solved; $("pzLift").hidden = solved; $("pzHint").hidden = solved; $("pzLook").hidden = solved || !!view().net; $("pzClear").hidden = true;
    $("pzAgain").hidden = !solved; $("pzNext").hidden = !solved;
    $("pzUndo").disabled = !undoStack.length;
    $("pzLift").disabled = !res.placed;
    $("pzLift").setAttribute("aria-pressed", lifting ? "true" : "false");
    $("pzLift").classList.toggle("on", lifting);
    $("pzNext").textContent = index + 1 < LEVELS.length ? "Next level" : "The levels";
  }

  // ---------- playing ----------
  const snap = () => { undoStack.push({ laid: laid.slice(), lifts: run.lifts, sel: run.sel, rot: { ...run.rot } }); if (undoStack.length > 300) undoStack.shift(); };
  const rememberTurn = piece => { if (piece && piece[0] !== "x") run.rot[piece[0]] = Z.parsePiece(piece).r; };
  function choose(k) {
    if (frame || run.solved) return;
    hint = null; lifting = false;
    run.sel = sel() === k ? null : k;
    persist();
    drawBoard();
  }
  function tap(c) {
    if (frame || run.solved || oilTimer || c < 0) return;
    hint = null; lookAt = 0;
    if (L.cells[c]) return drawBoard();
    const n = L.S.tiles[c].n, cur = sel(), here = laid[c];
    if (here && (lifting || here[0] === "x" && !cur)) {
      snap(); Z.lift(L, laid, c); run.lifts++; run.sel = here[0]; rememberTurn(here);       // taken up, it is in hand: tap another tile
    } else if (here && (!cur || cur === here[0])) {
      snap();
      laid[c] = Z.turned(n, here);                                                          // turned a step, kept where it lies
      rememberTurn(laid[c]);
    } else if (cur) {
      snap();
      const piece = Z.fitted(L, laid, c, cur, run.rot[cur] || 0, way), r = Z.lay(L, laid, c, piece);
      if (r === "swapped") { run.lifts++; run.sel = here[0]; }
      else if (r === "laid") { rememberTurn(piece); if (!(handNow()[cur] > 0)) run.sel = null; }
      else undoStack.pop();
    } else {
      const ks = kinds().filter(k => (handNow()[k] || 0) > 0);
      if (ks.length === 1) { run.sel = ks[0]; return tap(c); }
      toast("Pick a piece from the hand first", 1400);
      return drawBoard();
    }
    store();
    drawBoard();
    if (res.solved) solved();
  }
  function undo() {
    if (frame || run.solved || !undoStack.length) return;
    const s = undoStack.pop();
    laid = s.laid; run.lifts = s.lifts; run.sel = s.sel; run.rot = s.rot; hint = null;
    store();
    drawBoard();
  }
  function clear() {
    if (frame || run.solved || !laid.some(Boolean)) return;
    snap();
    laid = Z.emptyLaid(L); run.sel = null; hint = null;
    store();
    drawBoard();
  }
  function toggleLift() {
    if (frame || run.solved) return;
    lifting = !lifting; hint = null;
    if (lifting) run.sel = null;
    drawBoard();
  }
  /** Turns the solid to the end of the oil's way, then to the end of the way back from the terminal, then to the terminal. */
  function look() {
    if (run.solved) return;
    const goals = [res.end.why === "open" ? res.end.c : res.passes.length ? res.passes[res.passes.length - 1].c : L.source.c,
      res.feed.end.why === "open" ? res.feed.end.c : L.terminal.c, L.terminal.c, L.source.c].filter((c, i, a) => a.indexOf(c) === i);
    flyTo(goals[lookAt++ % goals.length]);
  }
  function solved() {
    run.solved = Z.starsFor(L, run);
    if (run.solved > starsOf(L.id)) { stars[L.id] = run.solved; if (!frame) write(KEY.stars, stars); }
    passes = res.passes;
    lifting = false;
    store();
    onSolved?.(run.solved);
    const spin = () => { if (!reduced()) { spinUntil = performance.now() + SPIN_MS; kick(); } };
    if (reduced()) { oilTo = Infinity; return void drawBoard(); }
    oilTo = 0;
    drawBoard();
    const tick = () => {
      oilTo++;
      if (oilTo >= passes.length + 1) { oilTo = Infinity; oilTimer = 0; drawBoard(); return spin(); }
      drawBoard();
      oilTimer = setTimeout(tick, OIL_STEP);
    };
    oilTimer = setTimeout(tick, OIL_STEP);
  }
  /** The hint caps the level at one star (starsFor); it also turns the solid to the tile it means. */
  async function giveHint() {
    if (frame || run.solved || oilTimer) return;
    if (!run.hints && !(await sure("A hint caps this level at one star. Show one?", { yes: "Hint" }))) return;
    hint = Z.hintFor(L, laid);
    if (!hint) return;
    lifting = false;
    run.hints++;
    persist();
    drawBoard();
    const at = hint.wrong?.[0] ?? hint.c;
    if (at !== undefined) flyTo(at);
  }
  function again() { if (!frame) { open(L.id, { fresh: true }); drawBoard(); } }
  function next() {
    if (frame) return;
    if (index + 1 >= LEVELS.length) return openMenu();
    go(LEVELS[index + 1].id);
  }
  function go(id) {
    open(id);
    size();
    drawBoard();
  }
  function setView(v) {
    view().net = v === "net";
    net = null;
    persist();
    drawBoard();
    if (!view().net && run.solved) { spinUntil = performance.now() + SPIN_MS; kick(); }
  }

  // ---------- fingers ----------
  const ptrs = new Map();
  let pinch = null;
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function tileAt([x, y]) {
    if (view().net) return netPick(net ||= netLayout(L.S, W, H), x, y);
    return Z.pick(L.S, camera(), x / W * 2 - 1, 1 - y / H * 2);
  }
  function wire() {
    canvas.addEventListener("pointerdown", e => {
      if (e.button === 2) return;
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = at(e);
      ptrs.set(e.pointerId, { x, y, x0: x, y0: y, moved: false });
      anim = null; spinUntil = 0;
      if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch = { d0: Math.hypot(p.x - q.x, p.y - q.y), z0: view().zoom }; }
    });
    canvas.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const [x, y] = at(e), dx = x - p.x, dy = y - p.y;
      p.x = x; p.y = y;
      if (view().net) return;
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        for (const q of ptrs.values()) q.moved = true;
        view().zoom = clamp(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d0), 1, 2.6);
        return draw();
      }
      if (!p.moved && Math.hypot(x - p.x0, y - p.y0) > 6) p.moved = true;
      if (!p.moved) return;
      view().yaw -= dx * .0085 / view().zoom;
      view().pitch = clamp(view().pitch + dy * .0085 / view().zoom, -Z.MAX_PITCH, Z.MAX_PITCH);
      draw();
    });
    const lift = e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const only = ptrs.size === 1;
      ptrs.delete(e.pointerId);
      if (!ptrs.size) pinch = null;
      if (p.moved) return keepView();
      if (only && e.type === "pointerup") tap(tileAt([p.x, p.y]));
    };
    canvas.addEventListener("pointerup", lift);
    canvas.addEventListener("pointercancel", lift);
    canvas.addEventListener("wheel", e => {
      if (view().net) return;
      e.preventDefault();
      view().zoom = clamp(view().zoom * Math.exp(-e.deltaY * .0015), 1, 2.6);
      draw();
    }, { passive: false });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  // ---------- the levels, in the menu ----------
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

  // ---------- showing ----------
  function mount() {
    const board = $("board");
    board.classList.add("solid");
    canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `The ${solid}: turn it with a finger, tap a tile to lay a piece`);
    ctx = canvas.getContext("2d");
    board.replaceChildren(canvas);
    wire();
  }
  const watchTheme = () => { forgetPalette(); if (shown) draw(); };
  new MutationObserver(watchTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", watchTheme);
  if (typeof ResizeObserver === "function") new ResizeObserver(() => { if (shown) { size(); draw(); } }).observe($("board"));
  load();
  return {
    show() {
      shown = true;
      $("queue").hidden = false; $("board").hidden = false;
      $("puzzleControls").classList.add("solid");
      $("pzLift").hidden = false; $("pzLook").hidden = false;
      mount();
      go(saved.id);
    },
    hide() {
      shown = false;
      clearTimeout(oilTimer); oilTimer = 0;
      cancelAnimationFrame(raf); raf = 0;
      $("puzzleControls").classList.remove("solid");
      $("pzLift").hidden = true; $("pzLook").hidden = true; $("pzClear").hidden = false;
      $("board").classList.remove("solid");
      $("board").replaceChildren();
      canvas = null; ctx = null;
      $("queue").hidden = true; $("board").hidden = true;
    },
    pause() { clearTimeout(oilTimer); oilTimer = 0; spinUntil = 0; },
    resume() { if (run?.solved && oilTo !== Infinity) { oilTo = Infinity; drawBoard(); } },
    resize() { size(); draw(); },
    levelList, go, again, next, undo, clear, look, toggleLift, setView, hint: giveHint,
    viewOptions: [["solid", solid === "cube" ? "Cube" : "Solid"], ["net", "Net"]],
    get view() { return view().net ? "net" : "solid"; },
    get id() { return saved.id; },
    get level() { return LEVELS[index]; },
    get index() { return index; },
    get run() { return run; },
    get stars() { return stars; },
    get camera() { return camera(); },
    tapTile: tap, tileAt,
    /** The page position of tile c's middle, or null when it is turned away (for tests that tap like a finger). */
    screenOf(c) {
      const r = canvas.getBoundingClientRect(), m = view().net ? (net ||= netLayout(L.S, W, H)).tiles[c].m : solidMatrix(L.S.tiles[c], camera(), W, H);
      return m ? [r.left + m[0] * 30 + m[2] * 30 + m[4], r.top + m[1] * 30 + m[3] * 30 + m[5]] : null;
    },
    firstOpen, totalStars,
    count: LEVELS.length,
    solvedCount: () => LEVELS.filter(l => stars[l.id]).length,
  };
}
