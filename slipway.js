// Slipway: a shipyard where three alike make the next. The part in hand waits on the dock in front of the yard; drag it
// onto an empty square (or tap a square to see what it would make there, and tap it again to lay it), and while it's
// held the parts it would join are lifted and the line under the yard says what they'd make. A tap on the hold swaps
// the part in hand with the one kept there. Components go to the ship on the berth as they're made, and a ship with all
// she needs is launched. The rules are slipway-engine.js's; the yard is drawn by slipway-3d.js (flat, in SVG, where
// there's no WebGL); this file plays each turn out and keeps the game.
import { W, H, EMPTY, BLUEPRINT, KINDS, points, newGame, place, swap, kindOf, stageOf, shipAt, powered, partName, group } from "./slipway-engine.js";
import { createYard } from "./slipway-3d.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "slipway:run", BEST = "slipway:best", SEEN = "slipway:seen";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const KIND_NAMES = { sail: ["Hull", "Masts", "Sails", "Guns", ""], power: ["Hull", "Funnels", "Engines", "Deckhouses", "Screws"] };
const kindNames = i => KIND_NAMES[powered(i) ? "power" : "sail"];
// the four enamels, and copper for the screws (the fifth kind, under power): a colour none of the enamels is in any theme
const kindColour = k => (k < 4 ? `var(--c${k})` : "var(--p1)");
const NUMBER = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const cap = t => t[0].toUpperCase() + t.slice(1);
const plural = name => (name.includes(" of ") ? name.replace(/^(\w+)/, "$1s") : `${name}s`);
const an = name => (/^[aeiou]/.test(name) ? `an ${name}` : `a ${name}`);
/** A ship as the line names her: "the cog", "the East Indiaman", "the VLCC". */
const the = ship => `the ${/^[A-Z]{2}|East/.test(ship.name) ? ship.name : ship.name.toLowerCase()}`;

let S = null;            // the game (slipway-engine.js's), as saved
let view = null;         // the yard: slipway-3d.js's, or the flat one
let playing = false;     // a turn being played out
let drag = null;         // the part in hand being dragged: { id, x0, y0, moved, offset, at }
let preview = -1;        // the square a tap is showing the part on, to be laid there with a second tap

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === W * H && Array.isArray(g.fitted) && g.fitted.length === KINDS;
function save() { write(RUN, S); }
function newRun() {
  if (playing) return;
  dropDrag();
  preview = -1;
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  save();
  render();
}

// ---------- the flat yard, where there's no WebGL ----------
function createFlat(svg) {
  svg.removeAttribute("hidden");
  const SLOT = { hold: -2.05, hand: 0, next: 2.05 }, DOCK_Y = 6.15;
  let shown = null, hovered = null, lit = [];
  const el = (tag, attrs = {}, text) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const xy = i => [(i % W) - W / 2, Math.floor(i / W)];
  function partEl(c, x, y, size = .8) {
    const g = el("g", { transform: `translate(${x + .5} ${y + .5}) scale(${size / .8})` });
    if (c === BLUEPRINT) { g.append(el("rect", { x: -.4, y: -.4, width: .8, height: .8, rx: .08, class: "pallet", fill: "var(--c2)" }), el("text", { fill: "var(--sheet)" }, "?")); return g; }
    const k = kindOf(c), st = stageOf(c);
    g.append(el("rect", { x: -.4, y: -.4, width: .8, height: .8, rx: .08, class: "pallet", fill: kindColour(k) }));
    g.append(el("text", { y: -.06, fill: "var(--sheet)" }, kindNames(shown?.ship ?? 0)[k][0]));
    for (let j = 0; j < st; j++) g.append(el("circle", { class: "pip", cx: (j - (st - 1) / 2) * .16, cy: .24, r: .055 }));
    return g;
  }
  function draw() {
    if (!shown) return;
    const s = shown, kids = [];
    const ship = shipAt(s.ship);
    kids.push(el("rect", { class: "berth", x: -3.5, y: -3.8, width: 7, height: 3.4, rx: .1 }));
    kids.push(el("text", { class: "shipname", x: 0, y: -2.6 }, `${ship.name}, ${ship.year}`));
    kids.push(el("text", { x: 0, y: -1.7 }, ship.needs.map((n, k) => (n ? `${kindNames(s.ship)[k]} ${s.fitted[k]}/${n}` : "")).filter(Boolean).join(" · ")));
    for (let i = 0; i < W * H; i++) { const [x, y] = xy(i); kids.push(el("rect", { class: "tile", x: x + .03, y: y + .03, width: .94, height: .94, rx: .05 })); }
    s.cells.forEach((c, i) => { if (c !== EMPTY) { const [x, y] = xy(i); const g = partEl(c, x, y - (lit.includes(i) ? .08 : 0)); kids.push(g); } });
    if (hovered != null) { const [x, y] = xy(hovered); kids.push(el("rect", { class: "hover", x: x + .02, y: y + .02, width: .96, height: .96, rx: .06 })); if (s.cells[hovered] === EMPTY) { const g = partEl(s.hand, x, y); g.setAttribute("opacity", ".55"); kids.push(g); } }
    for (const [name, x] of Object.entries(SLOT)) {
      kids.push(el("circle", { class: "slot", cx: x, cy: DOCK_Y, r: name === "next" ? .36 : .5 }));
      const c = s[name];
      if (c !== null && c !== undefined) kids.push(partEl(c, x - .5, DOCK_Y - .5, name === "next" ? .55 : .8));
    }
    svg.replaceChildren(...kids);
  }
  const toSvg = (x, y) => { const m = svg.getScreenCTM(); if (!m) return null; const p = new DOMPoint(x, y).matrixTransform(m.inverse()); return p; };
  const squareAt = (px, py) => { const cx = Math.floor(px + W / 2), cy = Math.floor(py); return cx >= 0 && cx < W && cy >= 0 && cy < H ? cy * W + cx : null; };
  return {
    set(s) { shown = s; hovered = null; lit = []; draw(); },
    async play(steps, before, after, onStep) { for (const st of steps) onStep?.(st); this.set(after); },
    async swapped(after) { this.set(after); },
    hover(at, group = []) { hovered = at; lit = group; draw(); },
    lift(x, y, offset = 0) { if (x == null) return null; const p = toSvg(x, y); return p ? squareAt(p.x, p.y - offset) : null; },
    pick(x, y, offset = 0) {
      const p = toSvg(x, y);
      if (!p) return null;
      for (const [name, sx] of Object.entries(SLOT)) if (Math.hypot(p.x - sx, p.y - DOCK_Y) < .6) return { dock: name };
      const at = squareAt(p.x, p.y - offset);
      return at == null ? null : { square: at };
    },
    where(at) { const m = svg.getScreenCTM(), [x, y] = typeof at === "string" ? [SLOT[at], DOCK_Y] : [xy(at)[0] + .5, xy(at)[1] + .5], p = new DOMPoint(x, y).matrixTransform(m); return { clientX: p.x, clientY: p.y }; },
    shipWhere() { const m = svg.getScreenCTM(), p = new DOMPoint(0, -2.2).matrixTransform(m); return { clientX: p.x, clientY: p.y }; },
    theme() { draw(); }, resize() {}, busy: () => false, flat: true,
  };
}

// ---------- the yard as it stands ----------
const hintOn = () => !read(SEEN, false) && S.turns < 4;
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("ships").textContent = fmt(S.launched);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
}
function drawNeeds() {
  const box = $("needs"), ship = shipAt(S.ship), names = kindNames(S.ship);
  box.hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `The yard is full: ${fmt(S.score)}, ${S.launched === 1 ? "one ship" : `${NUMBER[S.launched] ?? fmt(S.launched)} ships`} launched${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  box.replaceChildren(...ship.needs.flatMap((n, k) => {
    if (!n) return [];
    const chip = document.createElement("span"), have = Math.min(n, S.fitted[k]);
    chip.className = `sw-need${have >= n ? " done" : ""}`;
    chip.style.setProperty("--k", kindColour(k));
    chip.title = names[k];
    chip.innerHTML = `<i></i><span>${names[k]}</span> <b>${have}/${n}</b>`;
    return [chip];
  }));
  fitNeeds();
}
// the chips' names go where the row won't hold them all
function fitNeeds() {
  const box = $("needs");
  box.classList.remove("tight");
  if (box.scrollWidth > box.clientWidth + 1) box.classList.add("tight");
}
function say(html) { $("line").innerHTML = html ?? ""; }
function idleLine() {
  if (S.over) return say("");
  if (hintOn()) return say("Drag the part in hand onto the yard: three alike together make the next");
  const ship = shipAt(S.ship);
  say(`<b>${ship.name}</b>, ${ship.year}: ${ship.note}`);
}
// the hold and the next part named under their places on the dock (put where the yard draws them)
function placeLabels() {
  for (const [slot, text] of [["hold", "Hold"], ["next", "Next"]]) {
    let t = document.querySelector(`.sw-slot[data-slot="${slot}"]`);
    if (!t) { t = document.createElement("span"); t.className = "sw-slot"; t.dataset.slot = slot; t.textContent = text; $("field").append(t); }
    const at = view.where(slot), box = $("field").getBoundingClientRect();
    t.style.left = `${at.clientX - box.left}px`;
    t.style.top = `${at.clientY - box.top}px`;
  }
}
function render() {
  view.set(S);
  placeLabels();
  preview = -1;
  drawStrip();
  drawNeeds();
  idleLine();
}

// ---------- what the part in hand would do ----------
/** The line for laying the part in hand on square i: what it would make, what's fitted or launched, the points. */
function describe(s, i, r = place(s, i)) {
  const name = c => partName(c, s.ship), ship = the(shipAt(s.ship));
  const placed = r.steps[0], merges = r.steps.filter(x => x.type === "merge"), fit = r.steps.find(x => x.type === "fit" && x.at === i), launched = r.steps.some(x => x.type === "launch");
  if (!merges.length) {
    if (placed.blueprint) return `The blueprint is ${an(name(placed.part))}, with nothing to join`;
    const n = group(r.state.cells, i).length;
    return n <= 1 ? `${cap(an(name(placed.part)))}: three together make ${an(name(placed.part + 1))}` : `${cap(NUMBER[n])} ${plural(name(placed.part))} together: one more makes ${an(name(placed.part + 1))}`;
  }
  const made = merges.map(m => `${NUMBER[m.from.length]} ${plural(name(m.part - 1))} make ${an(name(m.part))}`).join(", and ");
  let text = placed.blueprint ? `The blueprint is ${an(name(placed.part))}: ${made}` : cap(made);
  const top = merges.at(-1).part;
  if (stageOf(top) === 3) text += fit ? (launched ? `, and ${ship} is launched` : `, fitted to ${ship}`) : `: ${ship} doesn't need one, so it waits`;
  return `${text} <b>+${fmt(r.gain)}</b>`;
}
function showPreview(at) {
  if (at == null || S.cells[at] !== EMPTY) { view.hover(at, []); say(at == null ? "" : "That square is taken"); return; }
  const r = place(S, at), lift = new Set();
  for (const st of r.steps) if (st.type === "merge") for (const j of st.from) if (j !== at) lift.add(j);
  view.hover(at, [...lift]);
  say(describe(S, at, r));
}

// ---------- a turn ----------
function settle() {
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.turns >= 4) write(SEEN, true);
  save();
}
async function commit(at) {
  if (playing || S.over || S.cells[at] !== EMPTY) return;
  playing = true;
  preview = -1;
  const before = S, r = place(S, at);
  S = r.state;
  settle();
  drawStrip();
  say("");
  // the points pop up as the first merge is made (all the turn's merges and fittings), and at the launch
  const made = r.steps.reduce((a, x) => a + (x.type === "merge" ? x.gain : x.type === "fit" ? points.fit : 0), 0);
  let shownPoints = false;
  await view.play(r.steps, before, S, st => {
    if (st.type === "merge" && !shownPoints) { shownPoints = true; popup(view.where(at), made, ""); }
    if (st.type === "launch") { const ship = shipAt(st.ship); popup(view.shipWhere(), st.gain, `${ship.name} launched`, true); }
    if (st.type === "lay") { const ship = shipAt(st.ship); toast(`Laid down: ${the(ship)}, ${ship.year}`); }
  });
  playing = false;
  render();
}
async function doSwap() {
  if (playing || S.over) return;
  playing = true;
  preview = -1;
  const before = S;
  S = swap(S);
  save();
  if (before.hold === null) toast("Kept in the hold: tap the hold to swap it back");
  await view.swapped(S);
  playing = false;
  render();
}
function popup(at, gain, label, big = false) {
  if (!gain && !label) return;
  const t = document.createElement("div");
  t.className = `sw-pop${big ? " big" : ""}`;
  t.style.left = `${at.clientX}px`;
  t.style.top = `${at.clientY}px`;
  t.textContent = `+${fmt(gain)}`;
  if (label) { const s = document.createElement("small"); s.textContent = label; t.append(s); }
  $("fx").append(t);
  const a = t.animate?.([{ transform: "translate(-50%, -50%)", opacity: 1 }, { transform: "translate(-50%, calc(-50% - 2.2rem))", opacity: 0 }], { duration: big ? 1800 : 1100, delay: 150, easing: "ease-out", fill: "both" });
  if (a) a.finished.then(() => t.remove(), () => t.remove()); else setTimeout(() => t.remove(), 1500);
}

// ---------- holding the part ----------
function dropDrag() { if (drag) view.lift(null); drag = null; }
function onDown(e) {
  if (playing || S.over || e.button > 0) return;
  const touch = e.pointerType !== "mouse", hit = view.pick(e.clientX, e.clientY);
  if (!hit) { preview = -1; showPreview(null); idleLine(); return; }
  e.preventDefault();
  if (hit.dock === "hand") {
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, offset: touch ? .9 : 0, at: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    return;
  }
  if (hit.dock === "hold") { doSwap(); return; }
  if (hit.dock) return;
  // a mouse lays the part where it clicks (it's been shown there as the mouse passed); a finger sees it first
  if (!touch || preview === hit.square) { commit(hit.square); return; }
  preview = hit.square;
  showPreview(hit.square);
}
function onMove(e) {
  if (drag && e.pointerId === drag.id) {
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
    if (!drag.moved) return;
    const at = view.lift(e.clientX, e.clientY, drag.offset);
    if (at !== drag.at) { drag.at = at; showPreview(at); }
    return;
  }
  if (e.pointerType === "mouse" && !playing && !S.over && !drag) {
    const hit = view.pick(e.clientX, e.clientY), at = hit?.square ?? null;
    if (at !== preview) { preview = at ?? -1; if (at == null) { view.hover(null); idleLine(); } else showPreview(at); }
  }
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { moved, at } = drag;
  drag = null;
  if (moved && at != null && S.cells[at] === EMPTY) { commit(at); return; }
  view.lift(null);
  view.hover(null);
  if (!moved) say("Drag it onto the yard, or tap a square to see what it would make there");
  else idleLine();
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
  const best = read(BEST, 0), ship = shipAt(S.ship);
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${S.launched === 1 ? "one ship" : `${fmt(S.launched)} ships`} launched in ${fmt(S.turns)} turns, ${the(ship)} on the slipway${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
try { view = createYard($("field")); }
catch (err) { console.warn("Slipway: no WebGL here, so the yard is drawn flat.", err); view = createFlat($("flat")); }
bindSwitcher($("appsBtn"), "slipway");
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "slipway").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
const surface = view.flat ? $("flat") : $("field").querySelector("canvas");
surface.addEventListener("pointerdown", onDown);
addEventListener("pointermove", onMove);
addEventListener("pointerup", onUp);
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { dropDrag(); view.hover(null); idleLine(); } });
surface.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !drag && preview >= 0) { preview = -1; view.hover(null); idleLine(); } });
$("againBtn").addEventListener("click", newRun);
// the theme (Almanac, Modern, Office, Kontor) and day or night re-skin the yard as they change
new MutationObserver(() => { view.theme(); if (S) view.set(S); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { view.theme(); if (S) view.set(S); });
new ResizeObserver(() => requestAnimationFrame(placeLabels)).observe($("field"));
new ResizeObserver(() => fitNeeds()).observe($("needs"));

// for tests and debugging
window.__slipway = { get state() { return S; }, commit, doSwap, newRun, view: () => view, describe: at => describe(S, at) };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
