// Stow's Loose cargo (the game as it was until October 2026, Block Blast's rules, kept beside the manifests): three
// pieces at a time, dragged into the hold; a line full from end to end clears, and a level is won once every
// consignment (the stamped cargo) has gone out with a line. The rules, the deals and the solver are in stow-engine.js,
// the 72 levels in stow-levels.js, a hold in decks drawn in 3D by stow-3d.js. Solo: playing together is the manifests'.
import { makeField, placements, options, filledBy, put, marksLeft, anyFits, tray, startBoard, starsFor, pool } from "./stow-engine.js";
import { holdScene, drawPiece } from "./stow-3d.js";
import { CHAPTERS, LEVELS } from "./stow-levels.js";
import { part, action } from "./menu.js";
import { scale } from "./wide.js";

const SVG = "http://www.w3.org/2000/svg";
const RUN = "stow:run", PROGRESS = "stow:progress";
/** Each shape keeps one of the four enamels. */
const colourOf = p => (p.n % 4) + 1;
const sameCells = (a, b) => a.length === b.length && [...a].every((v, j) => v === b[j]);
const byId = new Map(LEVELS.map(l => [l.id, l]));
export const LOOSE_LEVELS = LEVELS;

/**
 * The mode, given the page's ctx: { $, read, write, toast, view() (the hold's turn), active() (whether this mode is
 * showing), stars() (after a win, to note the suite's total) }. Returns { enter, leave, render, redraw (the view
 * turned), scene, starsAll, menu(body, pickLevel), busy (an animation running) }.
 */
export function createLoose(ctx) {
  const { $, read, write, toast } = ctx;
  // S: the level in play, as you left it: { id, board, tint, tray, slots, used, done } (tint: each placed cell's
  // colour, 1–4; cargo and empty cells 0). L: that level, F: its field.
  let S = null, L = null, F = null, scene = null;
  let progress = read(PROGRESS, {});                               // { levelId: { stars, best } }
  let cellEls = [], drag = null, picked = null, flashing = null;
  const on = () => ctx.active();

  function fresh(level) {
    const f = makeField(level.field);
    return { id: level.id, board: [...startBoard(level, f)], tint: new Array(f.n).fill(0), tray: 0, slots: [true, true, true], used: 0, done: null };
  }
  function setLevel(level) { L = level; F = makeField(level.field); buildBoard(); }
  const save = () => write(RUN, S);
  function play(level) {
    if (!level) return;
    setLevel(level);
    S = fresh(level);
    clearDrag();
    save();
    render();
  }
  const piecesNow = () => tray(L, S.tray, 0);

  // ---------- the hold ----------
  const unitsPer = () => { const m = $("board").getScreenCTM(); return m ? m.a : 30; };
  function buildBoard() {
    const svg = $("board");
    if (F.decks) { svg.dataset.kind = "deck"; scene = holdScene(svg, F, ctx.view()); frameHold(); return; }
    scene = null;
    const pad = F.kind === "hex" ? 0.55 : F.kind === "tri" ? 0.3 : 0.35;
    const w = F.box.w + 2 * pad, h = F.box.h + 2 * pad;
    svg.setAttribute("viewBox", `${F.box.x - pad} ${F.box.y - pad} ${w} ${h}`);
    svg.style.setProperty("--ar", (w / h).toFixed(4));               // the frame hugs the hold at its own proportions
    svg.dataset.kind = F.kind;
    svg.replaceChildren();
    cellEls = F.cells.map(cell => {
      const p = document.createElementNS(SVG, "polygon");
      p.setAttribute("points", cell.pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" "));
      p.setAttribute("class", "c");
      svg.appendChild(p);
      return p;
    });
    const stamps = document.createElementNS(SVG, "g");             // the consignments' stamps sit over their cells
    stamps.setAttribute("class", "stamps");
    svg.appendChild(stamps);
  }
  /** Everything a move in a hold would clear, every wave of it, lit where it stands now (each crate followed through
   *  the move by its own number, so one the second wave clears is lit in its place before the first). */
  function foresee(idx, board) {
    const r = put(F, board, idx, Array.from({ length: F.n }, (_, i) => i + 1), true), out = new Set();
    for (const w of r.waves) for (const i of w.cleared) out.add(w.carried[i] - 1);
    return out;
  }
  function frameHold() { const [, , w, h] = scene.frame; $("board").style.setProperty("--ar", (w / h).toFixed(4)); scene.px = unitsPer() / scale(); }
  /** The hold as it stands, with what a piece held over it would do: its cells (ghost) and the lines it would fill. */
  function drawBoard(ghost = null, clearing = null, board = S.board) {
    if (scene) {
      scene.px = unitsPer() / scale();
      const ghostTint = drag?.colour || (picked != null ? colourOf(piecesNow()[picked]) : 1);
      scene.draw({ board, tint: S.tint, ghost, ghostTint, lit: ghost && foresee(ghost, board), gone: clearing });
      return;
    }
    const will = new Set(), mine = new Set(ghost || []);
    if (ghost) for (const li of filledBy(F, board, ghost)) for (const i of F.lines[li].cells) will.add(i);
    const stamps = $("board").querySelector(".stamps");
    stamps.replaceChildren();
    const r = F.kind === "hex" ? 0.5 : F.kind === "tri" ? 0.19 : 0.3;
    F.cells.forEach((cell, i) => {
      const v = board[i], t = S.tint?.[i] || 0;
      let cls = "c";
      if (v === 2) cls += " mark";
      else if (v === 1) cls += t ? ` full t${t}` : " cargo";
      if (mine.has(i)) cls += ` ghost t${drag?.colour || 1}`;
      if (will.has(i)) cls += " clear";
      if (clearing?.has(i)) cls += " gone";
      cellEls[i].setAttribute("class", cls);
      if (v === 2) {                                               // a consignment: a brass lozenge stamped on its crate
        const d = document.createElementNS(SVG, "path");
        d.setAttribute("d", `M${cell.x} ${cell.y - r}L${cell.x + r} ${cell.y}L${cell.x} ${cell.y + r}L${cell.x - r} ${cell.y}Z`);
        d.setAttribute("class", will.has(i) ? "stamp going" : clearing?.has(i) ? "stamp gone" : "stamp");
        stamps.appendChild(d);
      }
    });
  }

  // ---------- the tray ----------
  // A piece drawn on its own, at a scale every piece of its kind shares (so a big piece looks big): its cells as they
  // lie in the hold, or, for one the hold's outline can't take whole, in a roomy field of the same kind
  const roomy = new Map(), extents = new Map();
  const bigField = kind => roomy.get(kind) || roomy.set(kind, makeField(kind === "square" ? { kind, w: 9, h: 9 } : kind === "hex" ? { kind, radius: 5 } : { kind, size: 5 })).get(kind);
  function shapeOf(p) {
    let f = F, idx = placements(F, p)[0];
    if (!idx) { f = bigField(F.kind); idx = placements(f, p)[0]; }
    const cells = [...idx].map(i => f.cells[i]);
    const xs = cells.flatMap(c => c.pts.map(q => q[0])), ys = cells.flatMap(c => c.pts.map(q => q[1]));
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    return { cells, box, cx: cells.reduce((a, c) => a + c.x, 0) / cells.length, cy: cells.reduce((a, c) => a + c.y, 0) / cells.length };
  }
  function extent(kind) {                                          // the tray's scale for a kind: room for its largest
    if (!extents.has(kind)) {
      let w = 3, h = 3;
      for (const p of pool(kind)) { const b = shapeOf(p).box; w = Math.max(w, b.w); h = Math.max(h, b.h); }
      extents.set(kind, { w, h });
    }
    return extents.get(kind);
  }
  function pieceSvg(p, { fit = false } = {}) {
    if (F.decks) {                                                 // in the hold's own view; shape: its frame and middle
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "sw-piece deck");
      svg.dataset.kind = "deck";
      svg.shape = drawPiece(svg, F, p, ctx.view(), { fit, tint: colourOf(p) });
      return svg;
    }
    const s = shapeOf(p), svg = document.createElementNS(SVG, "svg");
    if (fit) {                                                     // the tray: every piece on the same scale, centred
      const e = extent(F.kind), w = e.w + 0.4, h = e.h + 0.4;
      svg.setAttribute("viewBox", `${s.box.x + s.box.w / 2 - w / 2} ${s.box.y + s.box.h / 2 - h / 2} ${w} ${h}`);
    } else svg.setAttribute("viewBox", `${s.box.x} ${s.box.y} ${s.box.w} ${s.box.h}`);
    svg.setAttribute("class", `sw-piece t${colourOf(p)}`);
    svg.dataset.kind = F.kind;
    for (const c of s.cells) {
      const poly = document.createElementNS(SVG, "polygon");
      poly.setAttribute("points", c.pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" "));
      svg.appendChild(poly);
    }
    return svg;
  }
  function drawTray() {
    if (drag) return;
    const box = $("tray"), pieces = piecesNow();
    box.className = "sw-tray";
    box.style.removeProperty("--cols");
    box.replaceChildren();
    pieces.forEach((p, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sw-slot";
      if (!S.slots[k]) { b.classList.add("used"); b.disabled = true; b.setAttribute("aria-label", "Placed"); box.appendChild(b); return; }
      const fitsNow = options(F, S.board, p).length > 0;
      if (!fitsNow) b.classList.add("nofit");
      if (picked === k) b.classList.add("picked");
      b.setAttribute("aria-label", `Piece of ${p.size}${fitsNow ? "" : ", fits nowhere"}`);
      b.disabled = !!S.done;
      b.appendChild(pieceSvg(p, { fit: true }));
      b.addEventListener("pointerdown", e => startDrag(k, p, e));
      box.appendChild(b);
    });
  }

  // ---------- dragging (and tapping: a piece picked up, then a tap in the hold) ----------
  function clearDrag() { drag?.el?.remove(); drag = null; picked = null; }
  /** The valid placements of a piece now, each with its centre (in a hold, where it comes to rest, as drawn). */
  function targets(p) {
    return options(F, S.board, p).map(idx => {
      let x = 0, y = 0;
      for (const i of idx) { const [cx, cy] = scene ? scene.centre(i) : [F.cells[i].x, F.cells[i].y]; x += cx; y += cy; }
      return { idx, x: x / idx.length, y: y / idx.length };
    });
  }
  // how far apart two places are, about: a hold's drops lie a crate apart, nearer as the view looks along them
  const spacing = () => (F.decks ? 1.2 : F.kind === "hex" ? Math.sqrt(3) : F.kind === "tri" ? 0.58 : 1);
  function toBoard(px, py) {
    const svg = $("board"), m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = px; pt.y = py;
    return pt.matrixTransform(m.inverse());
  }
  function nearest(list, at, reach = 0.75) {
    if (!at) return null;
    let best = null, d = Infinity;
    for (const t of list) { const dd = Math.hypot(t.x - at.x, t.y - at.y); if (dd < d) { d = dd; best = t; } }
    return best && d <= spacing() * reach ? best : null;
  }
  function startDrag(k, p, e) {
    if (!on() || S.done || flashing || e.button > 0) return;
    e.preventDefault();
    const was = picked;
    clearDrag();
    const u = unitsPer(), el = pieceSvg(p), shapeInfo = el.shape || shapeOf(p);
    el.classList.add("sw-float");
    el.style.width = `${shapeInfo.box.w * u}px`;
    el.style.height = `${shapeInfo.box.h * u}px`;
    // held above the finger, so it can see where the piece goes (a mouse needs no lift)
    const lift = e.pointerType === "mouse" ? 0 : Math.max(56, (shapeInfo.box.h / 2) * u + 34);
    drag = { slot: k, piece: p, el, scale: u, lift, shape: shapeInfo, list: targets(p), place: null, colour: colourOf(p), x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId, was, button: e.currentTarget };
    document.body.appendChild(el);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    moveDrag(e);
  }
  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
    const { el, scale: u, shape: s, lift } = drag;
    const cx = e.clientX, cy = e.clientY - (drag.moved ? lift : 0);
    el.style.left = `${cx - (s.cx - s.box.x) * u}px`;
    el.style.top = `${cy - (s.cy - s.box.y) * u}px`;
    drag.button.classList.toggle("lifted", drag.moved);
    const t = drag.moved ? nearest(drag.list, toBoard(cx, cy)) : null, same = t === drag.place && drag.drawn;
    drag.place = t;
    // in a hold, a piece with a place to go is drawn there, among the crates; held anywhere else, it's in hand
    el.style.visibility = drag.moved && !(scene && t) ? "visible" : "hidden";
    if (same) return;
    drag.drawn = true;
    drawBoard(t?.idx || null);
  }
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { slot, place, moved, was } = drag;
    drag.el.remove();
    drag = null;
    if (place) { picked = null; placePiece(slot, place.idx); return; }
    // a tap, not a drag: the piece is picked up (or put down again); a tap in the hold then puts it there
    picked = moved || was === slot ? null : slot;
    drawBoard();
    drawTray();
  }
  function tapHold(e) {
    if (!on() || picked == null || S.done || flashing) return;
    const p = piecesNow()[picked], at = toBoard(e.clientX, e.clientY), list = targets(p);
    const t = nearest(list, at) || nearest(list, at, 1.4);           // a tap a little off: the closest it fits
    if (!t) { toast("It doesn't fit there"); return; }
    const k = picked;
    picked = null;
    placePiece(k, t.idx);
  }
  addEventListener("pointermove", moveDrag);
  addEventListener("pointerup", endDrag);
  addEventListener("pointercancel", e => { if (drag && e.pointerId === drag.id) { clearDrag(); render(); } });

  // ---------- a move ----------
  function placePiece(k, idx) {
    const p = piecesNow()[k];
    if (!S.slots[k] || !options(F, S.board, p).some(x => sameCells(x, idx))) return;
    const tint = S.tint.slice();
    for (const i of idx) tint[i] = colourOf(p);
    const r = put(F, S.board, idx, tint, !!F.decks);
    const before = S.board, tintBefore = S.tint;
    S.board = [...r.board];
    S.tint = [...r.extra];
    S.used++;
    S.slots = S.slots.slice(); S.slots[k] = false;
    if (!S.slots.some(Boolean)) { S.tray++; S.slots = [true, true, true]; }
    settle();
    save();
    if (scene) lower(before, tintBefore, idx, colourOf(p), r.waves);
    else flash(before, idx, r.cleared);
  }
  /** The lines a move filled go out where they stood (the board just before, the piece in), then the hold is as it is. */
  function flash(before, idx, cleared) {
    if (!cleared.length) { render(); return; }
    const shown = [...before];
    for (const i of idx) shown[i] = 1;
    flashing = { cells: new Set(cleared), board: shown };
    render();
    setTimeout(() => { flashing = null; render(); }, 380);
  }
  /** A move in a hold, shown as it happens: the piece lowered from over the hatch to where it rests, then each wave of
   *  the clearing: the lines lit and gone, and the crates over them settling down, which may fill more. */
  function lower(before, tintBefore, idx, colour, waves) {
    const ease = t => 1 - (1 - t) * (1 - t), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const withPiece = [...before], tint = [...tintBefore];
    for (const i of idx) { withPiece[i] = 1; tint[i] = colour; }
    const low = Math.min(...[...idx].map(i => Math.floor(i / F.n2))), rise = F.decks + 0.6 - low;
    const phases = [{ ms: 170, draw: t => scene.draw({ board: withPiece, tint, lift: new Map([...idx].map(i => [i, rise * (1 - ease(t))])) }) }];
    for (const w of waves) {
      phases.push({ ms: 300, once: true, draw: () => scene.draw({ board: w.before, tint: w.carried, gone: new Set(w.cleared) }) });
      if (w.moved.length) phases.push({ ms: 190, draw: t => scene.draw({ board: w.after, tint: w.carry, lift: new Map(w.moved.map(([a, b]) => [b, (Math.floor(a / F.n2) - Math.floor(b / F.n2)) * (1 - ease(t))])) }) });
    }
    if (still) { render(); return; }
    flashing = { anim: true };
    render();                                                       // the tally, the tray (or how it went) at once
    let at = 0, t0 = null;
    const step = now => {
      const ph = phases[at];
      t0 ??= now;
      const t = Math.min(1, (now - t0) / ph.ms);
      if (!ph.once || !ph.shown) { ph.draw(t); ph.shown = true; }
      if (t >= 1) { at++; t0 = null; if (at >= phases.length) { flashing = null; render(); return; } }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /** After a move: won when the last consignment has gone, stuck when nothing left in hand fits. */
  function settle() {
    if (marksLeft(S.board) === 0) {
      const stars = starsFor(S.used, L.par), was = progress[L.id] || {};
      S.done = { won: true, stars };
      progress[L.id] = { stars: Math.max(was.stars || 0, stars), best: Math.min(was.best ?? Infinity, S.used) };
      write(PROGRESS, progress);
      ctx.stars();
    } else if (!anyFits(F, S.board, piecesNow().filter((_, j) => S.slots[j]))) S.done = { won: false };
  }
  const starsAll = () => Object.values(progress).reduce((n, p) => n + (p?.stars || 0), 0);

  // ---------- drawing ----------
  const levelName = lv => `${CHAPTERS.find(c => c.id === lv.chapter).title} · ${lv.n}`;
  function render() {
    if (!on() || !S || !L) return;
    $("where").textContent = levelName(L);
    const left = marksLeft(S.board), m = document.createElement("b");
    m.className = "sw-left";
    m.textContent = `◆ ${left}`;
    $("tally").replaceChildren(m, ` · ${S.used} piece${S.used === 1 ? "" : "s"} · par ${L.par}`);
    $("orders").hidden = true;
    if (!flashing?.anim) drawBoard(null, flashing?.cells, flashing?.board);
    drawTray();
    drawResult();
  }
  function drawResult() {
    const box = $("result");
    box.hidden = !S.done;
    $("tray").hidden = !!S.done;
    if (!S.done) return;
    const won = S.done.won, under = L.par - S.used, n = `${S.used} piece${S.used === 1 ? "" : "s"}`;
    $("verdict").textContent = !won ? "Out of room" : under > 0 ? `Stowed in ${n}, ${under} under par` : under === 0 ? `Stowed in ${n}, on par` : `Stowed in ${n} (par ${L.par})`;
    $("stars").textContent = won ? "★★★".slice(0, S.done.stars) + "☆☆☆".slice(S.done.stars) : "";
    $("nextBtn").hidden = !won || !nextLevel();
    $("retryBtn").textContent = won ? "Again" : "Try again";
    $("retryBtn").className = won ? "sw-go quiet" : "sw-go";
  }
  const nextLevel = () => LEVELS.find(l => l.id === L.id + 1) || null;
  /** Levels you can open: every one up to the one after your furthest win, and each chapter's first. */
  const isOpen = lv => lv.n === 1 || progress[lv.id - 1]?.stars > 0 || progress[lv.id]?.stars > 0;

  return {
    get scene() { return scene; },
    get busy() { return !!(drag || flashing); },
    get level() { return L; },
    get state() { return S; },
    starsAll,
    total: LEVELS.length * 3,
    /** Back to where you were: your level as you left it, else the first you haven't won. */
    enter() {
      progress = read(PROGRESS, {});
      const saved = read(RUN, null), lv = saved && byId.get(saved.id);
      if (lv) {
        setLevel(lv);
        // a run saved by older code, or one for a level that has changed under it, starts that level afresh
        if (!Array.isArray(saved.board) || saved.board.length !== F.n) { play(lv); return; }
        S = { ...saved, tint: saved.tint?.length === F.n ? saved.tint : new Array(F.n).fill(0) };
        render();
        return;
      }
      play(LEVELS.find(l => !progress[l.id]?.stars) || LEVELS[0]);
    },
    leave() { clearDrag(); },
    render,
    redraw() { if (scene) frameHold(); drawBoard(); drawTray(); },
    tap: tapHold,
    again() { play(byId.get(L.id)); },
    next() { const n = nextLevel(); if (n) play(n); },
    /** The menu's parts for this mode: what to play next, and the campaign's levels with their stars. */
    menu(body, close) {
      const p = part(body, "play"), next = nextLevel();
      if (S?.done?.won && next) p.append(action(`Next: ${levelName(next)}`, () => play(next), "primary"));
      p.append(action(S?.done ? "Play it again" : "Start this level again", () => play(byId.get(L.id)), S?.done?.won && next ? "" : "primary"));
      const list = document.createElement("div");
      list.className = "sw-levels";
      for (const ch of CHAPTERS) {
        const h = document.createElement("p"), row = document.createElement("div");
        h.className = "sw-chapter"; h.textContent = ch.title;
        row.className = "sw-row";
        for (const lv of LEVELS.filter(l => l.chapter === ch.id)) row.appendChild(levelButton(lv, ch, progress[lv.id]?.stars || 0, L && lv.id === L.id, !isOpen(lv), () => { close(); play(lv); }, !!lv.field.decks));
        list.append(h, row);
      }
      part(body, "content").append(list);
    },
  };
}
/** A level's button in the menu's campaign: its number and stars, the one in play marked, a locked one greyed, a hold
 *  in decks with a cube in its corner. */
export function levelButton(lv, ch, stars, current, locked, go, deep = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `${stars ? "done" : ""}${deep ? " deep" : ""}`;
  if (current) b.setAttribute("aria-current", "true");
  b.disabled = locked;
  const n = document.createElement("b"), s = document.createElement("span");
  n.textContent = String(lv.n);
  s.textContent = stars ? "★".repeat(stars) : "";
  b.append(n, s);
  if (deep) b.insertAdjacentHTML("beforeend", '<svg class="sw-cube" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5L10.5 4V8.5L6 11L1.5 8.5V4Z M1.5 4L6 6.5L10.5 4 M6 6.5V11"/></svg>');
  b.setAttribute("aria-label", `${ch.title} ${lv.n}${deep ? ", in decks" : ""}${stars ? `, ${stars} stars` : ""}${locked ? ", locked" : ""}`);
  b.addEventListener("click", go);
  return b;
}
