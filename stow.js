// Stow: three pieces at a time, dragged into the hold; a line full from end to end clears, and a level is won once
// every consignment (the stamped cargo) has gone out with a line. The rules, the deals and the solver are in
// stow-engine.js, the campaign in stow-levels.js; this file draws the hold, moves the pieces and keeps your progress.
// Together, the two of you fill one hold, each from a tray of your own the other can't see, taking turns.
import { makeField, placements, fits, filledBy, put, marksLeft, anyFits, tray, startBoard, starsFor, pool } from "./stow-engine.js";
import { CHAPTERS, LEVELS } from "./stow-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { GAMES, roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";
import { today, noteStars } from "./suite.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "stow:run", PROGRESS = "stow:progress", DAILY = "stow:daily", DAYLEVEL = "stow:day";
const APP = 1;                                                   // this code's version of the together state
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const byId = new Map(LEVELS.map(l => [l.id, l]));

// ---------- state ----------
// S: the level in play, as you left it: { id, board, tint, tray, slots, used, done } (tint: each placed cell's colour,
// 1–4; cargo and empty cells 0). L: that level, F: its field. In a room S is the room's state, hands and all.
let S = null, L = null, F = null;
let progress = read(PROGRESS, {});                               // { levelId: { stars, best } }
const levelOf = id => (typeof id === "string" && id.startsWith("d") ? read(DAYLEVEL, null)?.level : byId.get(id)) || null;

function fresh(level) {
  const f = makeField(level.field);
  return { id: level.id, board: [...startBoard(level, f)], tint: new Array(f.n).fill(0), tray: 0, slots: [true, true, true], used: 0, done: null };
}
function setLevel(level) {
  L = level;
  F = makeField(level.field);
  buildBoard();
}
function save() { if (!together.room) write(RUN, S); }
/** Opens a level fresh (or the one asked for again). */
function play(level) {
  if (!level) return;
  setLevel(level);
  S = fresh(level);
  clearDrag();
  save();
  render();
}

// ---------- whose pieces, and which ----------
const mySlot = () => (together.room ? seatsOf(S).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
const handOf = slot => (together.room ? S.hands?.[slot] || { tray: 0, slots: [true, true, true] } : { tray: S.tray, slots: S.slots });
const piecesOf = slot => tray(L, handOf(slot).tray, together.room ? slot : 0);
const myTurn = () => !together.room || (S.turn ?? 0) === mySlot();
const colourOf = p => (p.n % 4) + 1;                            // each shape keeps one of the four enamels

// ---------- the hold ----------
let cellEls = [];
const unitsPer = () => { const m = $("board").getScreenCTM(); return m ? m.a : 30; };
function buildBoard() {
  const svg = $("board"), pad = F.kind === "hex" ? 0.55 : F.kind === "tri" ? 0.3 : 0.35;
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
  // the consignments' stamps sit over their cells
  const stamps = document.createElementNS(SVG, "g");
  stamps.setAttribute("class", "stamps");
  svg.appendChild(stamps);
}
/** The hold as it stands, with what a piece held over it would do: its cells (ghost) and the lines it would fill. */
function drawBoard(ghost = null, clearing = null, board = S.board) {
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
// A piece drawn on its own, at a scale every piece of its kind shares (so a big piece looks big): its cells as they lie
// in the hold, or, for one the hold's outline can't take whole, in a roomy field of the same kind
const roomy = new Map();
const bigField = kind => roomy.get(kind) || roomy.set(kind, makeField(kind === "square" ? { kind, w: 9, h: 9 } : kind === "hex" ? { kind, radius: 5 } : { kind, size: 5 })).get(kind);
function shapeOf(p) {
  let f = F, idx = placements(F, p)[0];
  if (!idx) { f = bigField(F.kind); idx = placements(f, p)[0]; }
  const cells = [...idx].map(i => f.cells[i]);
  const xs = cells.flatMap(c => c.pts.map(q => q[0])), ys = cells.flatMap(c => c.pts.map(q => q[1]));
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return { cells, box, cx: cells.reduce((a, c) => a + c.x, 0) / cells.length, cy: cells.reduce((a, c) => a + c.y, 0) / cells.length };
}
const extents = new Map();
/** The tray's scale for a kind of field: room for its largest piece. */
function extent(kind) {
  if (!extents.has(kind)) {
    let w = 3, h = 3;
    for (const p of pool(kind)) { const b = shapeOf(p).box; w = Math.max(w, b.w); h = Math.max(h, b.h); }
    extents.set(kind, { w, h });
  }
  return extents.get(kind);
}
function pieceSvg(p, { fit = null } = {}) {
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
  const box = $("tray"), mine = mySlot(), hand = handOf(mine), pieces = piecesOf(mine);
  const turn = myTurn() && !S.done;
  box.replaceChildren();
  box.classList.toggle("waiting", !turn);
  pieces.forEach((p, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw-slot";
    if (!hand.slots[k]) { b.classList.add("used"); b.disabled = true; b.setAttribute("aria-label", "Placed"); box.appendChild(b); return; }
    const fitsNow = placements(F, p).some(idx => fits(S.board, idx));
    if (!fitsNow) b.classList.add("nofit");
    if (drag?.slot === k) b.classList.add("lifted");
    if (picked === k) b.classList.add("picked");
    b.setAttribute("aria-label", `Piece of ${p.size}${fitsNow ? "" : ", fits nowhere"}`);
    b.disabled = !turn;
    b.appendChild(pieceSvg(p, { fit: true }));
    b.addEventListener("pointerdown", e => startDrag(k, p, e));
    box.appendChild(b);
  });
  // together: your partner's tray, face down (theirs to describe)
  const theirs = $("theirs");
  theirs.hidden = !together.room;
  if (together.room) {
    const other = handOf(1 - mine);
    theirs.replaceChildren();
    for (let k = 0; k < 3; k++) { const d = document.createElement("span"); d.className = `sw-slot back${other.slots[k] ? "" : " used"}`; theirs.appendChild(d); }
  }
}

// ---------- dragging (and tapping: a piece picked up, then a tap in the hold) ----------
let drag = null, picked = null, flashing = null;
function clearDrag() { drag?.el?.remove(); drag = null; picked = null; }
/** The valid placements of a piece now, each with its centre: for snapping to the nearest. */
function targets(p) {
  return placements(F, p).filter(idx => fits(S.board, idx)).map(idx => {
    let x = 0, y = 0;
    for (const i of idx) { x += F.cells[i].x; y += F.cells[i].y; }
    return { idx, x: x / idx.length, y: y / idx.length };
  });
}
const spacing = () => (F.kind === "hex" ? Math.sqrt(3) : F.kind === "tri" ? 0.58 : 1);
function toBoard(px, py) {
  const svg = $("board"), m = svg.getScreenCTM();
  if (!m) return null;
  const pt = svg.createSVGPoint();
  pt.x = px; pt.y = py;
  return pt.matrixTransform(m.inverse());
}
function nearest(list, at) {
  if (!at) return null;
  let best = null, d = Infinity;
  for (const t of list) { const dd = Math.hypot(t.x - at.x, t.y - at.y); if (dd < d) { d = dd; best = t; } }
  return best && d <= spacing() * 0.75 ? best : null;
}
function startDrag(k, p, e) {
  if (!myTurn() || S.done || flashing || e.button > 0) return;
  e.preventDefault();
  const was = picked;
  clearDrag();
  const scale = unitsPer(), shapeInfo = shapeOf(p), el = pieceSvg(p);
  el.classList.add("sw-float");
  el.style.width = `${shapeInfo.box.w * scale}px`;
  el.style.height = `${shapeInfo.box.h * scale}px`;
  // held above the finger, so it can see where the piece goes (a mouse needs no lift)
  const lift = e.pointerType === "mouse" ? 0 : Math.max(56, (shapeInfo.box.h / 2) * scale + 34);
  drag = { slot: k, piece: p, el, scale, lift, shape: shapeInfo, list: targets(p), place: null, colour: colourOf(p), x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId, was, button: e.currentTarget };
  document.body.appendChild(el);
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
  const { el, scale, shape: s, lift } = drag;
  const cx = e.clientX, cy = e.clientY - (drag.moved ? lift : 0);
  el.style.left = `${cx - (s.cx - s.box.x) * scale}px`;
  el.style.top = `${cy - (s.cy - s.box.y) * scale}px`;
  el.style.visibility = drag.moved ? "visible" : "hidden";
  drag.button.classList.toggle("lifted", drag.moved);
  const t = drag.moved ? nearest(drag.list, toBoard(cx, cy)) : null;
  drag.place = t;
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
  if (picked == null || !myTurn() || S.done || flashing) return;
  const p = piecesOf(mySlot())[picked], at = toBoard(e.clientX, e.clientY);
  const t = nearest(targets(p), at) || (() => {               // a tap a little off: the closest it fits
    let best = null, d = Infinity;
    for (const x of targets(p)) { const dd = Math.hypot(x.x - at.x, x.y - at.y); if (dd < d) { d = dd; best = x; } }
    return best && d <= spacing() * 1.4 ? best : null;
  })();
  if (!t) { toast("It doesn't fit there"); return; }
  const k = picked;
  picked = null;
  placePiece(k, t.idx);
}
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", e => { if (drag && e.pointerId === drag.id) { clearDrag(); drawTray(); render(); } });

// ---------- a move ----------
function placePiece(k, idx) {
  if (together.room) { moveTogether(k, idx); return; }
  const p = piecesOf(0)[k];
  if (!S.slots[k] || !fits(S.board, idx)) return;
  const r = put(F, S.board, idx);
  const tint = S.tint.slice();
  for (const i of idx) tint[i] = colourOf(p);
  for (const i of r.cleared) tint[i] = 0;
  const before = S.board;
  S.board = [...r.board];
  S.tint = tint;
  S.used++;
  S.slots = S.slots.slice(); S.slots[k] = false;
  if (!S.slots.some(Boolean)) { S.tray++; S.slots = [true, true, true]; }
  settle();
  save();
  flash(before, idx, r.cleared);
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
/** After a move: won when the last consignment has gone, stuck when nothing left in hand fits. */
function settle() {
  if (marksLeft(S.board) === 0) {
    const stars = starsFor(S.used, L.par);
    S.done = { won: true, stars };
    if (L.day) { const d = read(DAILY, {}); if (!(d[L.day] >= stars)) { d[L.day] = stars; write(DAILY, d); } }
    else {
      const was = progress[L.id] || {};
      progress[L.id] = { stars: Math.max(was.stars || 0, stars), best: Math.min(was.best ?? Infinity, S.used) };
      write(PROGRESS, progress);
      noteStars("stow", starsAll());
    }
  } else if (!anyFits(F, S.board, piecesOf(0).filter((_, j) => S.slots[j]))) S.done = { won: false };
}
const starsAll = () => Object.values(progress).reduce((n, p) => n + (p?.stars || 0), 0);

// ---------- drawing ----------
const levelName = lv => (lv.day ? "Today's hold" : `${CHAPTERS.find(c => c.id === lv.chapter).title} · ${lv.n}`);
function render() {
  if (!S || !L) return;
  $("where").textContent = levelName(L);
  const left = marksLeft(S.board);
  $("tally").replaceChildren();
  const m = document.createElement("b"); m.className = "sw-left"; m.textContent = `◆ ${left}`;
  $("tally").append(m, ` · ${S.used} piece${S.used === 1 ? "" : "s"} · par ${L.par}`);
  drawBoard(null, flashing?.cells, flashing?.board);
  drawTray();
  drawResult();
  drawPartner();
}
function drawResult() {
  const box = $("result");
  box.hidden = !S.done;
  $("tray").hidden = !!S.done;
  if (S.done) $("theirs").hidden = true;
  if (!S.done) return;
  const won = S.done.won;
  const under = L.par - S.used, n = `${S.used} piece${S.used === 1 ? "" : "s"}`;
  $("verdict").textContent = !won ? (together.room ? "Out of room: nothing in hand fits" : "Out of room")
    : under > 0 ? `Stowed in ${n}, ${under} under par` : under === 0 ? `Stowed in ${n}, on par` : `Stowed in ${n} (par ${L.par})`;
  $("stars").textContent = won && !together.room ? "★★★".slice(0, S.done.stars) + "☆☆☆".slice(S.done.stars) : "";
  const next = nextLevel();
  $("nextBtn").hidden = !won || !next || !!L.day;
  $("retryBtn").textContent = won ? "Again" : "Try again";
  $("retryBtn").className = won ? "sw-go quiet" : "sw-go";
}
const nextLevel = () => (L.day ? null : LEVELS.find(l => l.id === L.id + 1) || null);
/** Levels you can open: every one up to the one after your furthest win, and each chapter's first. */
const isOpen = lv => lv.n === 1 || LEVELS.some(l => l.id === lv.id - 1 && progress[l.id]?.stars) || progress[lv.id]?.stars > 0;

// ---------- today's hold: made on the device (the worker proves it), the same everywhere ----------
async function daily() {
  const day = today(), kept = read(DAYLEVEL, null);
  if (kept?.day === day && kept.level) return kept.level;
  const done = busy("Loading today's hold");
  try {
    const level = await new Promise((resolve, reject) => {
      const w = new Worker(new URL("./stow-worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => { w.terminate(); resolve(e.data); };
      w.onerror = e => { w.terminate(); reject(e); };
      w.postMessage({ day });
    });
    write(DAYLEVEL, { day, level });
    return level;
  } finally { done(); }
}
async function playDaily() {
  try { const lv = await daily(); if (lv) play(lv); }
  catch (e) { console.error(e); toast("Couldn't make today's hold"); }
}

// ---------- together ----------
const seatName = slot => seatsOf(S).find(([, p]) => p.slot === slot)?.[1].name || (slot === mySlot() ? "You" : "Your partner");
function drawPartner() {
  const el = $("partner");
  el.hidden = !together.room;
  if (!together.room) return;
  const p = together.partner();
  el.replaceChildren();
  if (!p) { el.textContent = "Waiting for your partner to join…"; return; }
  if (p.game) {
    const a = document.createElement("a");
    a.href = (GAMES[p.game]?.page || "./") + `?room=${together.room.code}`;
    a.textContent = "Join them";
    el.append(`${p.name} is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  if (S.done) { el.textContent = S.done.won ? `Stowed together in ${S.used} pieces.` : "Out of room."; return; }
  const b = document.createElement("b");
  b.textContent = myTurn() ? "Your turn" : `${p.name}'s turn`;
  el.append(b, myTurn() ? `: ${p.name} sees only their own pieces.` : ": say what you're holding.");
}
function freshRoom(players) {
  const level = L && !L.day ? L : LEVELS[0], f = makeField(level.field);
  return { v: 1, app: APP, created: Date.now(), id: level.id, board: [...startBoard(level, f)], tint: new Array(f.n).fill(0),
    hands: [{ tray: 0, slots: [true, true, true] }, { tray: 0, slots: [true, true, true] }], turn: 0, used: 0, done: false, players };
}
function roomLevel(g, id) {
  const level = byId.get(id) || LEVELS[0], f = makeField(level.field);
  Object.assign(g, { id: level.id, board: [...startBoard(level, f)], tint: new Array(f.n).fill(0), hands: [{ tray: 0, slots: [true, true, true] }, { tray: 0, slots: [true, true, true] }], turn: 0, used: 0, done: false, created: Date.now() });
}
let joining = null;                                              // the rete while you sit down, until the shared hold's drawn
const seated = () => { joining?.(); joining = null; };
function onState(g) {
  seated();
  const level = byId.get(g.id) || LEVELS[0];
  if (L?.id !== level.id || !F) setLevel(level);
  const before = S?.board, was = S?.used;
  S = { ...g, board: [...(g.board || [])], tint: [...(g.tint || [])], hands: [0, 1].map(s => ({ tray: g.hands?.[s]?.tray || 0, slots: [0, 1, 2].map(k => !!g.hands?.[s]?.slots?.[k]) })), done: g.done || null };
  if (drag) return;                                              // your piece in the air: the hold redraws when it lands
  picked = null;
  // your partner's move: their lines go out as yours do
  if (before && was != null && S.used === was + 1 && before.length === S.board.length) {
    const cleared = [], placed = [];
    S.board.forEach((v, i) => { if (before[i] && !v) cleared.push(i); if (!before[i] && v) placed.push(i); });
    flash(before, placed, cleared);
  } else render();
}
async function moveTogether(k, idx) {
  const slot = mySlot();
  const ok = await together.act(g => {
    if (g.done || (g.turn ?? 0) !== slot) return false;
    const level = byId.get(g.id), f = makeField(level.field);
    const hand = { tray: g.hands?.[slot]?.tray || 0, slots: [0, 1, 2].map(j => !!g.hands?.[slot]?.slots?.[j]) };
    const pieces = tray(level, hand.tray, slot), board = Uint8Array.from(g.board || []);
    const p = pieces[k];
    if (!hand.slots[k] || !p || !placements(f, p).some(x => x.length === idx.length && x.every((v, j) => v === idx[j])) || !fits(board, idx)) return false;
    const r = put(f, board, idx), tint = [...(g.tint || new Array(f.n).fill(0))];
    for (const i of idx) tint[i] = colourOf(p);
    for (const i of r.cleared) tint[i] = 0;
    hand.slots[k] = false;
    if (!hand.slots.some(Boolean)) { hand.tray++; hand.slots = [true, true, true]; }
    g.hands = g.hands || [];
    g.hands[slot] = hand;
    g.board = [...r.board]; g.tint = tint; g.used = (g.used || 0) + 1; g.turn = 1 - slot;
    if (marksLeft(r.board) === 0) g.done = { won: true, at: Date.now() };
    else {
      const next = 1 - slot, h = g.hands[next] || { tray: 0, slots: [true, true, true] };
      const theirs = tray(level, h.tray || 0, next).filter((_, j) => h.slots?.[j] !== false);
      if (!anyFits(f, r.board, theirs)) g.done = { won: false, at: Date.now() };
    }
  });
  if (!ok) render();
}
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "stow",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1 && Array.isArray(g.board),
  fresh: freshRoom,
  onState,
  onPresence: drawPartner,
  onLeave: () => { seated(); S = read(RUN, null); start(); },
  result: g => (g.done ? { match: `${g.id}-${g.created}`, score: g.used, won: !!g.done.won, coop: true, lower: true } : null),
});

// ---------- the menu ----------
let toastTimer = null;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const pick = lv => () => { if (together.room) together.act(g => roomLevel(g, lv.id)); else play(lv); };
  if (together.room) part(body, "together").append(action("Start this level again", pick(L.day ? LEVELS[0] : L), "primary"), action("Back to solo", () => together.leave(), "link"));
  else {
    const play_ = part(body, "play"), next = nextLevel();
    if (S?.done?.won && next) play_.append(action(`Next: ${levelName(next)}`, () => play(next), "primary"));
    play_.append(action(S?.done ? "Play it again" : "Start this level again", () => play(L.day ? L : byId.get(L.id)), S?.done?.won && next ? "" : "primary"));
    play_.append(action("Today's hold", playDaily));
  }
  // the campaign: each chapter's levels, with their stars; the locked ones greyed
  const list = document.createElement("div");
  list.className = "sw-levels";
  for (const ch of CHAPTERS) {
    const h = document.createElement("p"); h.className = "sw-chapter"; h.textContent = ch.title;
    const row = document.createElement("div"); row.className = "sw-row";
    for (const lv of LEVELS.filter(l => l.chapter === ch.id)) {
      const b = document.createElement("button");
      b.type = "button";
      const st = progress[lv.id]?.stars || 0;
      b.className = st ? "done" : "";
      if (L && lv.id === L.id) b.setAttribute("aria-current", "true");
      b.disabled = !together.room && !isOpen(lv);
      const n = document.createElement("b"); n.textContent = String(lv.n);
      const s = document.createElement("span"); s.textContent = st ? "★".repeat(st) : "";
      b.append(n, s);
      b.setAttribute("aria-label", `${ch.title} ${lv.n}${st ? `, ${st} stars` : ""}${b.disabled ? ", locked" : ""}`);
      b.addEventListener("click", () => { $("menuDlg").close(); pick(lv)(); });
      row.appendChild(b);
    }
    list.append(h, row);
  }
  part(body, "content").append(list);
  const day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${starsAll()} of ${LEVELS.length * 3} stars${day ? ` · today's hold ${"★".repeat(day)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "stow");
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "stow").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("retryBtn").addEventListener("click", () => { if (together.room) together.act(g => roomLevel(g, g.id)); else play(L.day ? L : byId.get(L.id)); });
$("nextBtn").addEventListener("click", () => { const n = nextLevel(); if (!n) return; if (together.room) together.act(g => roomLevel(g, n.id)); else play(n); });
$("board").addEventListener("click", tapHold);
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
addEventListener("resize", () => { if (!drag) render(); });

// for tests and debugging
window.__stow = { get state() { return S; }, get level() { return L; }, get field() { return F; }, get together() { return together; }, play, placePiece, LEVELS,
  // a move by its tray slot and the cell its first cell goes to (the levels' solutions are kept this way)
  placeAt(k, at) { const idx = placements(F, piecesOf(mySlot())[k]).find(x => x[0] === at); if (!idx || !fits(S.board, idx)) return false; placePiece(k, idx); return true; },
  targetOf(k, at) { return targets(piecesOf(mySlot())[k]).find(t => t.idx[0] === at) || null; } };

/** Back to where you were: your level as you left it, else the first you haven't won. */
function start() {
  const saved = S && levelOf(S.id) ? S : null;
  if (saved) {
    setLevel(levelOf(saved.id));
    // a run saved by older code, or one for a level that has changed under it, starts that level afresh
    if (!Array.isArray(saved.board) || saved.board.length !== F.n) { play(levelOf(saved.id)); return; }
    S = { ...saved, tint: saved.tint?.length === F.n ? saved.tint : new Array(F.n).fill(0) };
    render();
    return;
  }
  play(LEVELS.find(l => !progress[l.id]?.stars) || LEVELS[0]);
}
S = read(RUN, null);
start();
noteStars("stow", starsAll());
// Opened for a duo match: the rete covers your own hold while you sit down (a new hold starts at your level), so
// nothing is placed in it by mistake; it waits as you left it, for Back to solo.
const code = roomInAddress();
if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) seated(); });
}
