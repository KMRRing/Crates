// The card games' shared 3D table (Menu, View: 3D). Korbi, 3 November 2026: "an aesthetic 3d mode ... a highly optimized
// interface one where it's pretty much just like dandan if it's a card game." Hong's, Tribute's and Dandan's views each draw
// a table as a plane tipped away from you in CSS perspective (the far side further off and smaller), seats standing round it
// as plates, cards flown from where they were to where they land; this is the part those share, for the games after them.
// It draws no card game: a game keeps its own state, its hand and buttons as the page's own elements, and tells the kit what
// to show. The cloth is DOM and CSS on the compositor (nothing is redrawn but what changes, and an animation only runs
// while a card is in the air), the cards are the suite's own (cards.js, cards.css), sized by one number, --cw, the width of
// a card, so one face serves the hand, the middle, a plate and a flight.
//
//   createCloth(host, { seats, clockwise }) the tipped cloth with a plate for each seat and a middle (table3d.css)
//   createMotion({ quiet })                 cards flown, swept, dealt, popped; a pause; none when motion is off
//   createParallax(el)                      the lamp and the rail's sheen slide with the phone's tilt or the pointer (Table 2.0)
//   card, back, plateHtml, pileHtml, fanHtml  the markup (pure strings)
//   seatSpots, slotOf, rowFit, flightBox, archOf, pileLayers, fanTurns  the arithmetic (pure; tests/table3d.mjs)
//
// Nothing here imports menu.js or suite.js, so Node can load it: the game wires the pause (`onPause(m.hold, …)`) and says
// what is `quiet` (a partner's watching frame shows no motion).
import { cardHtml, backHtml } from "./cards.js";
import { flatMode } from "./mode3d.js";

export const ASPECT = 1.4;                                       // a card's height over its width (cards.css: 2.5em by 3.5em)
export const TILT = 20;                                          // the plane's tilt, degrees
export const FLY_MS = 460, SWEEP_MS = 760, MOST_FLIGHTS = 24;
const EASE = "cubic-bezier(.3, .7, .2, 1)";
const SEAT_COLOURS = 6;                                          // --p0..--p5 (style.css), each with a pattern of its own

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- the arithmetic (pure) ----------
// Where each plate stands on the mat, [x, y, side]: x across and y down in per cent of the mat, y the plate's foot (it stands
// on the cloth); side b the foot, t the far edge (a row), l and r the left and right half, which stand as columns (two rows
// side by side would not fit a phone). In the order play goes round the
// table clockwise from you, the next seat on your left, as at a real table.
const SPOTS = {
  2: [[50, 99, "b"], [50, 16, "t"]],
  3: [[50, 99, "b"], [27, 36, "l"], [73, 36, "r"]],
  4: [[50, 99, "b"], [9, 52, "l"], [50, 16, "t"], [91, 52, "r"]],
  5: [[50, 99, "b"], [9, 74, "l"], [30, 36, "l"], [70, 36, "r"], [91, 74, "r"]],
  6: [[50, 99, "b"], [9, 72, "l"], [9, 42, "l"], [50, 16, "t"], [91, 42, "r"], [91, 72, "r"]],
};
/** The plates for n seats (2 to 6) from your own (slot 0, at the foot): [{ x, y, side }]. `clockwise: false` mirrors them, the
 *  next seat on your right, as Big Two and Landlord pass. */
export function seatSpots(n, { clockwise = true } = {}) {
  const base = SPOTS[Math.max(2, Math.min(6, Math.round(n) || 2))];
  return base.map(([x, y, side]) => (clockwise ? { x, y, side } : { x: 100 - x, y, side: side === "l" ? "r" : side === "r" ? "l" : side }));
}
/** The slot a seat sits in from where you sit (0: you), and the seat in a slot. */
export const slotOf = (seat, me, n) => (((seat - me) % n) + n) % n;
export const seatAt = (slot, me, n) => (me + slot) % n;
/** How the backs in a fan lean: n (at most `max`) places from the middle, in turns of the CSS's own (--j). */
export const fanTurns = (n, max = 5) => { const m = Math.min(Math.max(0, Math.floor(n) || 0), max); return Array.from({ length: m }, (_, j) => j - (m - 1) / 2); };
/** How many cards a pile of n draws as: more is taller, but only a little (one at 1, six from 32). */
export const pileLayers = (n, max = 6) => (n > 0 ? Math.min(max, 1 + (31 - Math.clz32(Math.floor(n)))) : 0);
/** The width of a card for n in a row in room { w, h }, `gap` of a card's width between, no wider than `max`. */
export function rowFit(room, n, { gap = 0.08, max = Infinity, aspect = ASPECT } = {}) {
  if (!(n > 0) || !(room.w > 0) || !(room.h > 0)) return 0;
  return Math.max(0, Math.min(room.w / (n + (n - 1) * gap), room.h / aspect, max));
}
/**
 * A card flown from the rect `from` to the rect `to` (both { x, y, w, h }, centres and sizes in px): the ghost is drawn as
 * large as the place it lands will take, laid there, and starts translated back to where it was, scaled to the size it was.
 */
export function flightBox(from, to, aspect = ASPECT) {
  const h = Math.min(to.h, to.w * aspect), w = h / aspect;
  return { w, h, left: to.x - w / 2, top: to.y - h / 2, dx: from.x - to.x, dy: from.y - to.y, s0: Math.max(0.2, from.h / (h || 1)) };
}
/** The lean and drop of each of n cards in a hand held in an arch (for `--rot` and `--ly`): the middle upright, the ends
 *  turned out by `tilt` degrees and dropped by `drop` px, evenly across. */
export function archOf(n, { tilt = 4, drop = 9 } = {}) {
  return Array.from({ length: n }, (_, i) => { const t = n > 1 ? (2 * i) / (n - 1) - 1 : 0; return { rot: +(t * tilt).toFixed(2), ly: +(t * t * drop).toFixed(1) }; });
}

// ---------- the markup (pure) ----------
/** A card as markup, the suite's own (cards.js): face is { rank, suit } or { joker }; sized by --cw wherever it lies. */
export const card = (face, opts = {}) => cardHtml(face, { ...opts, cls: `tk-c${opts.cls ? ` ${opts.cls}` : ""}` });
export const back = (cls = "") => backHtml(`tk-c${cls ? ` ${cls}` : ""}`);
/** A hand of backs standing in a fan, at most five, the rest left to the count beside it. */
export const fanHtml = (n, max = 5) => (n > 0 ? `<span class="tk-fan" aria-hidden="true">${fanTurns(n, max).map(j => `<span class="cd back tk-fb" style="--j:${j}"></span>`).join("")}</span>` : "");
/** A pile of n cards, its top face up (top: a card's markup) or, without one, a back; the count beside it where `count`.
 *  The cards under the top peek out below it, the deepest furthest (--i). */
export function pileHtml({ n, top = "", count = true, label = "" }) {
  if (!(n > 0)) return `<span class="tk-pile empty" aria-label="${esc(label || "empty")}"></span>`;
  const under = pileLayers(n) - 1;
  const layers = Array.from({ length: under }, (_, i) => `<span class="cd back tk-pl" style="--i:${under - i}"></span>`).join("");
  return `<span class="tk-pile" aria-label="${esc(label ? `${label}, ${n}` : String(n))}">${layers}<span class="tk-pt">${top || back()}</span>${count ? `<b class="tk-pn">${n}</b>` : ""}</span>`;
}
const CROWN = '<i class="tk-crown"><svg viewBox="0 0 20 15" aria-hidden="true"><path d="M2 13.5L1 4l5 4 4-6.5L14 8l5-4-1 9.5Z" fill="#E2B865" stroke="#7A5518" stroke-width="1.1" stroke-linejoin="round"/><path d="M2.6 11.6h14.8" stroke="#7A5518" stroke-width=".9"/></svg></i>';
/**
 * What a seat's plate holds: a medallion with the name's initial (`mark`: a badge on its edge, such as the dealer's button;
 * `crown`: the one to beat), the name and a line under it (`meta`), a fan of `fan` backs and a `tally` beside them (a count,
 * a place, a stack). `name` is text; `meta`, `tally` and `mark` are markup, so the game escapes what it puts in them.
 */
export function plateHtml({ name = "", meta = "", tally = "", fan = 0, crown = false, mark = "" }) {
  const initial = [...String(name).trim()][0]?.toUpperCase() || "?";
  return `<span class="tk-med" aria-hidden="true"><b>${esc(initial)}</b>${mark ? `<i class="tk-mark">${mark}</i>` : ""}${crown ? CROWN : ""}</span>`
    + `<span class="tk-info"><b class="tk-name">${esc(name)}</b>${meta ? `<span class="tk-meta">${meta}</span>` : ""}</span>`
    + `<span class="tk-tally">${fanHtml(fan)}${tally}</span>`;
}

// ---------- writing only what changed ----------
/** An element's contents, set only when they change (an animation inside runs on rather than restarts); true if they did. */
export const fill = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; return true; } return false; };
export const classes = (el, cls) => { if (el.className !== cls) el.className = cls; };
/** An element's centre and size on screen now, { x, y, w, h }, or null if it isn't there. */
export const rectOf = el => { const r = el?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null; };

// ---------- the cloth ----------
/**
 * The tipped cloth in `host` (an element with a size of its own, such as a flex child that grows): returns the elements a
 * game fills (`centre`, the middle, in which it lays what is on the table; `inlay`, a ring cut into the cloth that can carry
 * a word) and `set(slot, plate)` to draw a seat. A plate is { seat, name, meta, tally, fan, crown, mark, act, pass, state,
 * label }: `seat` (its colour and pattern: a player keeps both wherever they sit; default the slot), `act` the word it
 * last said at the seat, and `state` classes the CSS knows (on: to move; out; tobeat; thinking; mate and foe).
 * The cloth is the page's own colour: a game sets --tk-felt on its #app.
 */
export function createCloth(host, { seats = 4, clockwise = true } = {}) {
  const spots = seatSpots(seats, { clockwise });
  host.innerHTML = `<div class="tk-field tk-n${spots.length}"><div class="tk-stage"><div class="tk-mat">`
    + `<div class="tk-inlay" aria-hidden="true"></div><div class="tk-centre" aria-live="polite"></div>`
    + spots.map((s, i) => `<div class="tk-plate at-${s.side}" data-slot="${i}" style="--x:${s.x}%;--y:${s.y}%"><span class="tk-body"></span><span class="tk-act"></span></div>`).join("")
    + `</div></div></div>`;
  const field = host.firstElementChild, mat = field.querySelector(".tk-mat");
  createParallax(field);                                          // frees itself once the field has left the page
  const plates = [...mat.querySelectorAll(".tk-plate")], bodies = plates.map(p => p.firstElementChild), acts = plates.map(p => p.lastElementChild);
  return {
    field, mat, plates, centre: mat.querySelector(".tk-centre"), inlay: mat.querySelector(".tk-inlay"), spots,
    set(slot, p) {
      const el = plates[slot];
      if (!el) return;
      const seat = ((p.seat ?? slot) % SEAT_COLOURS + SEAT_COLOURS) % SEAT_COLOURS;
      classes(el, `tk-plate at-${spots[slot].side} tk-s${seat}${p.act ? " said" : ""}${p.state ? ` ${p.state}` : ""}`);
      fill(bodies[slot], plateHtml(p));
      const act = acts[slot], word = p.act || "";
      if (act.textContent !== word) act.textContent = word;
      classes(act, `tk-act${p.pass ? " pass" : ""}`);
      const label = p.label ?? p.name;
      if (el.getAttribute("aria-label") !== label) el.setAttribute("aria-label", label);
    },
  };
}

// ---------- motion ----------
/** A card that has landed on the cloth: it comes down from a little height, the shadow tightening, and settles with a small give. */
export function settle(el) {
  if (!el?.animate || still?.matches) return;
  el.animate([{ scale: 1.14, translate: "0 -.28em", boxShadow: "0 .6em .9em -.1em rgba(0, 0, 0, .42)" }, { scale: .97, translate: "0 0", offset: .6 }, { scale: 1 }], { duration: 300, easing: "ease-out" });
}
const still = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
/**
 * Cards in the air. Each is a ghost in a fixed layer over the page, flown by the Web Animations API from where it was to where
 * it lands (the real card is hidden until then), so nothing on the cloth is animated or laid out again. `quiet()`: a
 * watching frame, which shows none. With reduced motion, a hidden page, a pause or `quiet`, nothing flies (moving() says so)
 * and the game simply draws the table as it is. Rects are { x, y, w, h } from rectOf().
 */
export function createMotion({ quiet = () => false } = {}) {
  const fx = document.createElement("div");
  fx.className = "tk-fx";
  fx.setAttribute("aria-hidden", "true");
  document.body.append(fx);
  const running = new Set();                                      // the animations going, so a pause can hold them
  let held = false;
  const moving = () => !still?.matches && !document.hidden && !quiet() && !held;
  const track = a => { running.add(a); const done = () => running.delete(a); a.addEventListener("finish", done); a.addEventListener("cancel", done); return a; };

  /** A card flown from `from` to `to`, turning over on the way where it's face down at one end (`up0`, `up1`); `land`: the
   *  element it lands as, hidden until then and given a small bounce; `fade`: it dissolves on arrival (a card dealt to a hand). */
  function fly({ face, back: behind = back(), from, to, up0 = true, up1 = true, delay = 0, ms = FLY_MS, fade = false, land = null }) {
    if (!from || !to || !moving()) return;
    const b = flightBox(from, to), g = document.createElement("div");
    g.className = "tk-ghost";
    g.style.cssText = `width:${b.w}px;height:${b.h}px;left:${b.left}px;top:${b.top}px;--cw:${b.w}px`;
    g.innerHTML = `<div class="tk-gin"><div class="tk-gf">${face}</div><div class="tk-gb">${behind}</div></div>`;
    fx.append(g);
    if (land) { land.classList.add("tk-coming"); setTimeout(() => land.classList.remove("tk-coming"), ms + delay + 150); }
    const t = { duration: ms, delay, easing: EASE, fill: "both" }, turn = x => `rotateY(${x ? 0 : 180}deg)`;
    track(g.firstElementChild.animate([{ transform: turn(up0) }, { transform: `rotateY(${up0 === up1 ? (up0 ? 0 : 180) : 90}deg) scale(1.12)`, offset: 0.5 }, { transform: turn(up1) }], t));
    const a = track(g.animate([{ transform: `translate(${b.dx}px, ${b.dy}px) scale(${b.s0})`, opacity: 1 }, { transform: "none", opacity: fade ? 0 : 1 }], t));
    a.onfinish = () => {
      g.remove();
      if (!land) return;
      land.classList.remove("tk-coming");
      settle(land);
    };
  }
  /** Cards that lay on the cloth gathered into a stack, a beat, then swept to `to` (a plate), shrinking as they go: items are
   *  { at: rect, html: the card's markup }. */
  function sweep(items, to, { delay = 160 } = {}) {
    if (!to || !moving()) return;
    const list = items.filter(t => t.at).slice(-MOST_FLIGHTS);
    if (!list.length) return;
    const mx = list.reduce((s, t) => s + t.at.x, 0) / list.length, my = list.reduce((s, t) => s + t.at.y, 0) / list.length;
    list.forEach((t, i) => {
      const g = document.createElement("div");
      g.className = "tk-ghost sweep";
      g.style.cssText = `width:${t.at.w}px;height:${t.at.h}px;left:${t.at.x - t.at.w / 2}px;top:${t.at.y - t.at.h / 2}px;--cw:${t.at.w}px`;
      g.innerHTML = t.html;
      fx.append(g);
      const stack = `translate(${mx - t.at.x + (i - list.length / 2) * 1.2}px, ${my - t.at.y - i * 1.5}px) rotate(${(i % 3 - 1) * 5}deg)`;
      track(g.animate([{ transform: "none", opacity: 1 }, { transform: stack, opacity: 1, offset: 0.3 }, { transform: stack, opacity: 1, offset: 0.46 },
        { transform: `translate(${to.x - t.at.x}px, ${to.y - t.at.y}px) scale(.3) rotate(${(i % 3 - 1) * 5}deg)`, opacity: 0 }],
        { duration: SWEEP_MS, delay: delay + i * 14, easing: "cubic-bezier(.4, 0, .6, 1)", fill: "both" })).onfinish = () => g.remove();
    });
  }
  /** Backs dealt from `from` to each rect of `to` (a plate's fan): `per` rounds, round by round, one after another. */
  function deal({ from, to, per = 5, ms = 520, gap = 55 }) {
    if (!from || !moving()) return;
    let k = 0;
    for (let r = 0; r < per; r++) {
      for (const t of to) {
        if (!t || k >= MOST_FLIGHTS) continue;
        fly({ face: back(), from: { ...from, h: t.h }, to: { ...t, w: 26, h: 36 }, up0: false, up1: false, delay: k++ * gap, ms, fade: true });
      }
    }
  }
  /** A word or a count popped into view. */
  function pop(el) {
    if (el && moving()) track(el.animate([{ scale: 0.5, opacity: 0 }, { scale: 1.18, opacity: 1, offset: 0.55 }, { scale: 1, opacity: 1 }], { duration: 360, easing: "ease-out" }));
  }
  /** The pause: what's flying stands still, and so does what the CSS animates (the glow round whose turn it is). */
  function hold(on) {
    held = on;
    document.documentElement.classList.toggle("tk-held", on);
    for (const a of running) { try { on ? a.pause() : a.play(); } catch { /* finished */ } }
  }
  function dispose() { document.documentElement.classList.remove("tk-held"); for (const a of running) { try { a.cancel(); } catch { /* gone */ } } running.clear(); fx.remove(); }
  return { fly, sweep, deal, pop, hold, moving, dispose, fx };
}


// ---------- parallax ----------
/** Pure: a tilt (device beta and gamma in degrees, from the first reading) as the table's two numbers, each -1 to 1. */
export const tiltOf = (beta, gamma, base = { beta: 0, gamma: 0 }, span = 22) => {
  const c = x => Math.max(-1, Math.min(1, x));
  return { x: c((gamma - base.gamma) / span), y: c((beta - base.beta) / span) };
};
/**
 * Table 2.0's depth: --tk-px and --tk-py (-1 to 1) on `el`, which the CSS turns into the lamp pool and the rail's sheen sliding a
 * little and, on the tipped cloth, the plane leaning. Driven by the phone's tilt (a first reading is the rest pose) or a mouse;
 * eased, at most one write a frame and none when nothing moves. Off under reduced motion, Settings' 2D mode, a hidden page and a
 * battery below a fifth and not charging. (iPhones ask permission for tilt: this never asks, and the pointer is all they have.)
 * Returns { dispose }.
 */
export function createParallax(el) {
  const none = { dispose() {} };
  if (!el || typeof addEventListener !== "function" || still?.matches) return none;
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, base = null, low = false, off = false;
  const on = () => !off && !low && !document.hidden && !flatMode() && !still?.matches;
  const write = () => {
    raf = 0;
    if (!on()) { tx = ty = 0; }
    x += (tx - x) * 0.14; y += (ty - y) * 0.14;
    if (Math.abs(tx - x) < 0.004) x = tx;
    if (Math.abs(ty - y) < 0.004) y = ty;
    el.style.setProperty("--tk-px", x.toFixed(3));
    el.style.setProperty("--tk-py", y.toFixed(3));
    if (x !== tx || y !== ty) raf = requestAnimationFrame(write);
  };
  const aim = (a, b) => { if (!el.isConnected) { api.dispose(); return; } if (!on()) return; tx = Number.isFinite(a) ? a : 0; ty = Number.isFinite(b) ? b : 0;   // (a NaN would void the table's whole transform: flat)
    if (!raf) raf = requestAnimationFrame(write); };
  const tilt = e => {
    if (e.beta == null || e.gamma == null) return;
    base ||= { beta: e.beta, gamma: e.gamma };
    base.beta += (e.beta - base.beta) * 0.002;               // the rest pose follows how the phone is held, slowly
    base.gamma += (e.gamma - base.gamma) * 0.002;
    const t = tiltOf(e.beta, e.gamma, base);
    aim(t.x, t.y);
  };
  const point = e => {
    if (e.pointerType !== "mouse") return;
    aim((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
  };
  const hide = () => { if (document.hidden) { tx = ty = 0; base = null; } };
  addEventListener("deviceorientation", tilt, { passive: true });
  // an iPhone sends no tilt until a tap has asked for it (Korbi, 7 Nov 2026: the pivot with the mouse should be the phone's movement on mobile)
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    const ask = () => { removeEventListener("pointerup", ask); DeviceOrientationEvent.requestPermission().catch(() => {}); };
    addEventListener("pointerup", ask);
  }
  addEventListener("pointermove", point, { passive: true });
  document.addEventListener("visibilitychange", hide);
  try { navigator.getBattery?.().then(b => { const f = () => { low = b.level < 0.2 && !b.charging; }; f(); b.addEventListener("levelchange", f); b.addEventListener("chargingchange", f); }).catch(() => {}); } catch { /* no battery api */ }
  const api = { dispose() { off = true; removeEventListener("deviceorientation", tilt); removeEventListener("pointermove", point); document.removeEventListener("visibilitychange", hide); cancelAnimationFrame(raf); } };
  return api;
}
