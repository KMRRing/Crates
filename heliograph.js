// Heliograph: white light falls from a port in the top of a glass tube; set mirrors in it to carry the light through a
// colour crystal, which colours it, and on into the chandelier of crystals hanging in the middle, where it shatters
// every crystal of its colour it meets until one of another colour stops it, and everything below on those strings
// falls; through both colour crystals it carries both colours. Fire takes a turn; setting the mirrors doesn't. The rules
// are heliograph-engine.js's; this file handles the hand (turning round the tube, choosing, setting, moving and turning
// mirrors, the light's way drawn as they move) and keeps the game. The tube is drawn by heliograph-3d.js, or
// heliograph-flat.js without WebGL, both through the camera in heliograph-view.js.
import { MIRRORS, MR, FIRST_MOVES, movesFor, canMove, newGame, trace, fire, pieces, addMirror, moveMirror, turnMirror, takeMirror, cantPlace, clampInside, facing, dropEvery } from "./heliograph-engine.js";
import { createView, onPlane, nearestOnSegment } from "./heliograph-view.js";
import { createFlat } from "./heliograph-flat.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "heliograph:run2", BEST = "heliograph:best", SEEN = "heliograph:seen2", MOVED = "heliograph:v2";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const fmt = n => n.toLocaleString("en-GB");

// The game on a flat field (to October 2026) scored on another scale and can't be carried over: its run and its best go,
// once, so the games screen doesn't show a best this game can't be measured against.
if (!read(MOVED, false)) {
  for (const k of ["heliograph:run", "heliograph:best", "heliograph:seen", "heliograph:relay"]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
  write(MOVED, true);
}

// ---------- state ----------
let S = null;            // the game (heliograph-engine.js's), as saved
let sel = null;          // the id of the mirror chosen: its handle shows, to turn it by
let hand = null;         // what a finger is doing: { kind, id, x0, y0, x, y, moved, draft, why, … }
let playing = false;     // a shot being played out
const valid = g => g && g.v === 4 && Array.isArray(g.layers) && Array.isArray(g.mirrors) && Array.isArray(g.crystals);
function save() { write(RUN, S); }
function newRun() {
  S = newGame(randomSeed());
  sel = null;
  save();
  render();
}

// ---------- the tube ----------
const view = createView();
let scene;
try {
  scene = (await import("./heliograph-3d.js")).createScene($("stage"), view);
} catch {
  scene = createFlat($("stage"), view);
}

/** Where the chosen mirror's handle stands: a step out from its face, on the side the eye sees. */
function knobOf(s) {
  const m = s.mirrors.find(x => x.id === sel);
  if (!m) return null;
  const toEye = [view.eye[0] - m.p[0], view.eye[1] - m.p[1], view.eye[2] - m.p[2]];
  const k = m.n[0] * toEye[0] + m.n[1] * toEye[1] + m.n[2] * toEye[2] < 0 ? -1.1 : 1.1;
  return [m.p[0] + m.n[0] * k, m.p[1] + m.n[1] * k, m.p[2] + m.n[2] * k];
}
let shown = null;        // what's drawn: { s, path, knob }
function render(s = hand?.draft || S) {
  const path = trace(s);
  shown = { s, path, knob: knobOf(s) };
  scene.draw({ s, path, sel, knob: shown.knob, targets: path.shattered });
  drawStrip();
  drawTray();
  say(s, path);
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  const drop = $("drop"), of = dropEvery(S.shots);
  drop.replaceChildren(...Array.from({ length: of }, (_, i) => { const p = document.createElement("i"); if (i < S.untilDrop) p.className = "on"; return p; }));
  drop.setAttribute("aria-label", `The cluster comes down in ${S.untilDrop} shot${S.untilDrop === 1 ? "" : "s"}`);
}
// each colour its own cut too, so the colours can be told apart without their colour
const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); n.append(...kids); return n; };
const hexPath = r => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`; }).join("L");
const CUTS = [() => el("circle", { r: 3.9 }), () => el("path", { d: "M0-4.6L3.6 0L0 4.6L-3.6 0Z" }), () => el("rect", { x: -3.5, y: -3.5, width: 7, height: 7, rx: 0.8 }), () => el("path", { d: `M${hexPath(4.2)}Z` })];
const gem = (c, cls) => el("svg", { viewBox: "-5.5 -5.5 11 11", class: cls, "aria-hidden": "true" }, el("g", { class: `hg-gem c${c}` }, CUTS[c](), el("path", { class: "hg-glint", d: "M-2.3-2.2Q-1.1-3.3.6-3.2" })));
const MIRROR_ICON = () => el("svg", { viewBox: "-10 -12 20 24", "aria-hidden": "true" },
  el("path", { class: "hg-stem", d: "M0 2V10M-4 10.5H4" }), el("ellipse", { class: "hg-disc", cx: 0, cy: -3, rx: 7.5, ry: 4.6, transform: "rotate(-24 0 -3)" }));
function drawTray() {
  const left = MIRRORS - S.mirrors.length;
  $("colour").replaceChildren(gem(S.crystals[0].c, "now"), gem(S.crystals[1].c, "now"), gem(S.next, "next"));
  const b = $("mirrorBtn");
  if (!b.firstChild) b.append(MIRROR_ICON(), Object.assign(document.createElement("b"), { className: "hg-count" }));
  b.querySelector(".hg-count").textContent = `×${left}`;
  b.disabled = S.over || playing || left <= 0 || !canMove(S);
  // the moves left this shot: a pip each, in the strip
  const mv = $("moves");
  mv.replaceChildren(...Array.from({ length: movesFor(S.shots) }, (_, i) => { const p = document.createElement("i"); if (i < S.moves) p.className = "on"; return p; }));
  mv.setAttribute("aria-label", `${S.moves} move${S.moves === 1 ? "" : "s"} left this shot`);
  b.classList.toggle("lifted", hand?.kind === "new" && hand.moved);
  $("takeBtn").disabled = S.over || playing || sel == null || !(S.placed.includes(sel) || canMove(S, sel));
  $("fireBtn").disabled = S.over || playing;
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `The chandelier reached the line: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
  }
}
/** The line under the tube: what a finger is doing, a first game's next step, or what Fire would do now. */
function say(s, path) {
  let text;
  if (hand?.why) text = `A mirror must stand ${hand.why}`;
  else if (S.over) text = "";
  else if (!read(SEEN, false) && S.shots < 4) text = firstSteps(s, path);
  else if (path.shattered.length) {
    const f = fire(s), n = f.shattered.length + f.fallen.length;
    text = `Fire brings down ${n}${f.fallen.length ? ` (${f.fallen.length} falling)` : ""}: +${fmt(f.gain)}`;
  } else if (!S.moves && hand?.kind !== "turn") text = "No moves left this shot: turn the mirrors, then fire";
  else if (path.crossed.length) text = "The light is coloured: turn a mirror to send it into the cluster";
  else if (sel != null) text = "Drag the mirror to move it, its handle to turn it";
  else if (s.mirrors.length) text = "Tap a mirror to choose it, then drag it or its handle";
  else text = "Set mirrors to carry the light through a colour crystal";
  $("say").textContent = text;
}
function firstSteps(s, path) {
  if (!s.mirrors.length) return "Drag a mirror into the light under the port";
  if (!path.crossed.length) return "Turn it by its handle: light a colour crystal";
  if (!path.shattered.length) return "Set a mirror in the coloured light; turn it into the cluster";
  return "Fire";
}

// ---------- picking ----------
const local = e => { const r = $("stage").getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
/** The mirror under a point of the tube's frame, the nearest the eye. */
function mirrorAt(x, y, s = S) {
  let best = null, bz = Infinity;
  for (const m of s.mirrors) {
    const [sx, sy, z] = view.project(m.p);
    if (Math.hypot(sx - x, sy - y) <= view.pixels(z) * MR + 8 && z < bz) { best = m; bz = z; }
  }
  return best;
}
/**
 * Where a mirror goes for a point of the frame: onto the light where the point is near it (the light as it would be
 * without this mirror), else on the upright plane facing the eye through `through`. { p, on (the leg it's on), why }.
 */
function placeFor(x, y, id, through) {
  const ray = view.ray(x, y), without = id == null ? S : takeMirror(S, id);
  let best = null, bd = 30;
  for (const leg of trace(without).legs) {
    const q = nearestOnSegment(ray, leg.a, leg.b), [sx, sy] = view.project(q), d = Math.hypot(sx - x, sy - y);
    if (d < bd && !cantPlace(S, q, id)) { best = { p: q, on: leg }; bd = d; }
  }
  if (best) return { ...best, why: null };
  const p = clampInside(onPlane(ray, through, view.facingFlat()) ?? through);
  return { p, on: null, why: cantPlace(S, p, id) };
}
/** A new mirror's first facing: in the light, turned to send it level toward the middle of the tube, where there's room
 *  for the next mirror; out of it, facing the eye. */
function firstFacing(p, leg) {
  const flat = view.facingFlat();
  if (!leg) return [-flat[0], 0, -flat[2]];
  const d = [leg.b[0] - leg.a[0], leg.b[1] - leg.a[1], leg.b[2] - leg.a[2]], l = Math.hypot(...d), r = Math.hypot(p[0], p[2]);
  const inward = r > 0.5 ? [-p[0] / r, 0, -p[2] / r] : [flat[0], 0, flat[2]];
  return facing(d.map(v => v / l), p, [p[0] + inward[0], p[1], p[2] + inward[2]]) || [0, 1, 0];
}
/** A direction turned about an axis (a unit vector) by an angle. */
function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map(i => v[i] * c + x[i] * s + k[i] * d * (1 - c));
}

// ---------- the hand ----------
const LIFT = 44;         // a mirror brought from the tray is held this far above a finger, so it can be seen
function down(e) {
  if (hand || e.button > 0) return;
  const [x, y] = local(e);
  const knob = sel != null && shown?.knob ? view.project(shown.knob) : null;
  let kind = "empty", id = null, grab = [0, 0];
  if (!playing && !S.over && knob && Math.hypot(knob[0] - x, knob[1] - y) < 26) { kind = "turn"; id = sel; }
  else if (!playing && !S.over) {
    // only the mirror chosen moves: a drag from another turns round the tube, as from empty space, and a tap chooses it,
    // so a drag meant to look round the tube can't spend a move
    const m = mirrorAt(x, y);
    if (m && m.id === sel) { kind = "mirror"; id = m.id; const [sx, sy] = view.project(m.p); grab = [sx - x, sy - y]; }
    else if (m) { kind = "pick"; id = m.id; }
  }
  hand = { kind, id, grab, x0: x, y0: y, x, y, moved: false, draft: null, why: null, pid: e.pointerId };
  try { $("stage").setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  e.preventDefault();
}
function move(e) {
  if (!hand || e.pointerId !== hand.pid) return;
  const [x, y] = local(e), dx = x - hand.x, dy = y - hand.y;
  hand.x = x; hand.y = y;
  if (!hand.moved && Math.hypot(x - hand.x0, y - hand.y0) < 7) return;
  hand.moved = true;
  if (hand.kind === "empty" || hand.kind === "pick") { view.orbit(-dx * 0.009, dy * 0.006); render(); return; }
  if (hand.kind === "mirror") {
    // moving is the scarce thing: two a shot (a mirror set or moved this shot moves again free); turning is free
    if (!canMove(S, hand.id)) { hand.kind = "stuck"; sel = hand.id; toast("Two moves a shot: turn it by its handle, or fire"); render(); return; }
    const m = S.mirrors.find(k => k.id === hand.id), at = placeFor(x + hand.grab[0], y + hand.grab[1], m.id, m.p);
    hand.draft = moveMirror(S, m.id, at.p);
    hand.why = at.why;
    sel = m.id;
  } else if (hand.kind === "turn") {
    // the handle follows the finger as on a ball: across the screen turns the mirror about the screen's upright, up and
    // down about its level; slowly, so a beam can be laid on a crystal by hand
    const m = (hand.draft || S).mirrors.find(k => k.id === hand.id), TURN = 0.009;
    const n = rotate(rotate(m.n, view.u, dx * TURN), view.r, dy * TURN);
    hand.draft = turnMirror(hand.draft || S, m.id, n);
  } else if (hand.kind === "new") placeNew(e);
  render();
}
function up(e) {
  if (!hand || e.pointerId !== hand.pid) return;
  const h = hand;
  hand = null;
  if (h.kind === "new") { dropNew(h, e); return; }
  if (!h.moved) tap(h);
  else if (h.kind === "mirror") { if (!h.why && h.draft) S = h.draft; else if (h.why) toast(`A mirror must stand ${h.why}`); }
  else if (h.kind === "turn" && h.draft) S = h.draft;
  save();
  render();
}
function cancel(e) { if (hand && e.pointerId === hand.pid) { hand = null; render(); } }
/** A tap: on a mirror, chooses it (or, on the one chosen, lets it go); on the handle, keeps it; elsewhere, lets it go. */
function tap(h) {
  if (playing || S.over) return;
  sel = h.kind === "pick" || h.kind === "turn" ? h.id : null;
}

// a mirror from the tray: dragged into the tube (onto the light where it's near), or with a tap, set in the light where
// it ends; it comes turned to send the light level toward the middle, to be turned from there
function trayDown(e) {
  if (hand || playing || S.over || S.mirrors.length >= MIRRORS || !canMove(S) || e.button > 0) return;
  hand = { kind: "new", pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, draft: null, why: null, lift: e.pointerType === "mouse" ? 0 : LIFT };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  e.preventDefault();
}
function placeNew(e) {
  const r = $("stage").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top - hand.lift;
  if (x < 0 || y < 0 || x > r.width || y > r.height) { hand.draft = null; hand.why = null; return; }
  const at = placeFor(x, y, null, [0, view.look[1], 0]);
  const s = addMirror(S, at.p, firstFacing(at.p, at.on));
  hand.draft = s;
  hand.why = at.why;
  hand.newId = s.mirrors[s.mirrors.length - 1].id;
}
function trayMove(e) {
  if (!hand || hand.kind !== "new" || e.pointerId !== hand.pid) return;
  if (!hand.moved && Math.hypot(e.clientX - hand.x0, e.clientY - hand.y0) < 7) return;
  hand.moved = true;
  placeNew(e);
  render();
}
function dropNew(h) {
  if (!h.moved) { autoPlace(); return; }
  if (h.draft && !h.why) { S = h.draft; sel = h.newId; save(); }
  else if (h.why) toast(`A mirror must stand ${h.why}`);
  render();
}
/** A mirror set with a tap: in the light, near where it ends (or failing that, further back along it). */
function autoPlace() {
  const legs = trace(S).legs;
  for (let k = legs.length - 1; k >= 0; k--) {
    const { a, b } = legs[k];
    for (const f of [0.72, 0.55, 0.85, 0.4, 0.25]) {
      const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      if (cantPlace(S, p)) continue;
      S = addMirror(S, p, firstFacing(p, legs[k]));
      sel = S.mirrors[S.mirrors.length - 1].id;
      save();
      render();
      return;
    }
  }
  toast("There's no room in the light for a mirror");
}

// ---------- a shot ----------
async function shoot() {
  if (playing || S.over) return;
  const before = S, r = fire(S);
  playing = true;
  sel = null;
  render();
  await scene.shot(before, r);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);           // the games screen shows it at once
  if (S.shots >= 4) write(SEEN, true);
  playing = false;
  render();
  if (S.over) roundOver("heliograph");
  if (r.gain) pop(r, before);
  if (r.cleared) toast(`The chandelier is cleared: ${fmt(1000)} more`);
  else if (r.crushed.length) toast(r.crushed.length === 1 ? "The cluster came down on a mirror: it's back in hand" : `The cluster came down on ${r.crushed.length} mirrors: they're back in hand`);
  else if (!r.path.crossed.length && !r.gain) toast("The light never reached a colour crystal");
}
/** What the shot brought in, rising from where it did most. */
function pop(r, before) {
  const by = new Map(pieces(before).map(p => [p.id, p])), at = [...r.shattered, ...r.fallen].map(id => by.get(id)).filter(Boolean);
  if (!at.length) return;
  const [x, y] = view.project([0, 1, 2].map(k => at.reduce((a, p) => a + p.p[k], 0) / at.length));
  const p = $("pop");
  p.textContent = `+${fmt(r.gain)}`;
  p.style.left = `${x}px`; p.style.top = `${y}px`;
  p.classList.toggle("big", at.length >= 8);
  p.classList.remove("go"); void p.offsetWidth; p.classList.add("go");
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  const best = read(BEST, 0), about = part(body, "about");
  about.append(line(`This game: ${fmt(S.score)} in ${S.shots} shot${S.shots === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "heliograph");
document.querySelector(".hg-mark").innerHTML = APPS.find(a => a.id === "heliograph").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("stage").addEventListener("pointerdown", down);
$("stage").addEventListener("pointermove", move);
$("stage").addEventListener("pointerup", up);
$("stage").addEventListener("pointercancel", cancel);
$("mirrorBtn").addEventListener("pointerdown", trayDown);
$("mirrorBtn").addEventListener("pointermove", trayMove);
$("mirrorBtn").addEventListener("pointerup", e => { if (hand?.kind === "new" && e.pointerId === hand.pid) { const h = hand; hand = null; dropNew(h); } });
$("mirrorBtn").addEventListener("pointercancel", cancel);
$("takeBtn").addEventListener("click", () => { if (sel == null) return; S = takeMirror(S, sel); sel = null; save(); render(); });
$("fireBtn").addEventListener("click", shoot);
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__heliograph = { get state() { return S; }, set state(s) { S = s; sel = null; render(); }, get sel() { return sel; }, set sel(id) { sel = id; render(); }, view, shoot, newRun, project: p => view.project(p), get shown() { return shown; } };

S = read(RUN, null);
if (!valid(S)) newRun();
else {
  // a game kept on its first shot from before that shot had three moves gets the third (every mirror then is new this
  // shot, so the moves spent are the mirrors touched)
  if (!S.shots) S.moves = FIRST_MOVES - S.touched.length;
  render();
}
