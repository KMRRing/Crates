// Factor's cards in the air. Each flight (factor-flights.js) is a ghost card in a fixed layer over the page, flown by the Web
// Animations API from where the card was to where it lands; a small deck stands up where a card comes from or goes to the
// bank or the development deck, and goes when the last card is down. Nothing on the page is animated or laid out again,
// and nothing here takes a tap (the layer is pointer-events: none), so a flight is never between you and a move.
//
// With reduced motion, a hidden page or a pause nothing flies: the page has already drawn the counts as they are.
// The page tells `where(point, flight)` (the centre of a place on screen, { x, y }) and `land(flight)` (a card arrived).
import { resFace, devFace, cardBack } from "./factor-icons.js";

export const FLY_MS = 380, STAGGER = 80, EASE = "cubic-bezier(.3, .7, .2, 1)";
const still = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

export function createFlights({ where, land = () => {} }) {
  const fx = document.createElement("div");
  fx.className = "fc-fx";
  fx.setAttribute("aria-hidden", "true");
  document.body.append(fx);
  const running = new Set();
  let held = false;
  const moving = () => !still?.matches && !document.hidden && !held;
  const track = a => { running.add(a); const done = () => running.delete(a); a.addEventListener("finish", done); a.addEventListener("cancel", done); return a; };
  const at = (p, s = 1) => `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%) scale(${s})`;

  /** A small deck at a point, there until `leave()`; one for each of the decks a batch touches. */
  function pile(kind, p) {
    const el = document.createElement("div");
    el.className = `fc-pile ${kind}`;
    el.innerHTML = `${cardBack()}${cardBack()}${cardBack()}`;
    el.style.transform = at(p);
    fx.append(el);
    track(el.animate([{ opacity: 0, transform: at(p, .7) }, { opacity: 1, transform: at(p, 1) }], { duration: 160, easing: "ease-out", fill: "both" }));
    return { el, p, leave() { track(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "both" })).onfinish = () => el.remove(); } };
  }

  /** Flights, each a card flown from its place to its place; the decks appear for the ones that touch them. */
  function run(list) {
    if (!list.length || !moving()) return;
    const piles = new Map();
    let last = 0;
    list.forEach((f, i) => {
      const a = where(f.from, f), b = where(f.to, f);
      if (!a || !b) return;
      for (const [pt, pos] of [[f.from, a], [f.to, b]]) {
        const k = pt.at === "bank" ? "bank" : pt.at === "devs" ? "devs" : null;
        if (k && !piles.has(k)) piles.set(k, pile(k, pos));
      }
      const delay = i * STAGGER + 120;                          // the deck stands up first
      last = Math.max(last, delay + FLY_MS);
      const g = document.createElement("div");
      g.className = `fc-ghost${f.what === "dev" ? " dev" : ""}`;
      const face = f.what === "dev" ? devFace(f.kind) : resFace(f.kind);
      g.innerHTML = `<div class="fc-gin"><div class="fc-gf">${face}</div><div class="fc-gb">${cardBack()}</div></div>`;
      g.style.transform = at(a);
      g.style.opacity = "0";
      fx.append(g);
      const flip = f.what === "dev" && f.from.at === "devs" && f.up;           // bought and yours: turned over on the way
      const t = { duration: FLY_MS, delay, easing: EASE, fill: "both" };
      const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.min(28, Math.hypot(b.x - a.x, b.y - a.y) * .18) };
      track(g.animate([
        { transform: at(a, .85), opacity: 0 },
        { transform: at(a, 1), opacity: 1, offset: .12 },
        { transform: at(mid, 1.12), opacity: 1, offset: .5 },
        { transform: at(b, 1), opacity: 1, offset: .88 },
        { transform: at(b, .7), opacity: 0 },
      ], t)).onfinish = () => { g.remove(); land(f); };
      // face up or down for the whole way, or turning over once, halfway
      const up0 = flip ? 0 : f.up ? 1 : 0, up1 = f.up ? 1 : 0;
      const gf = g.querySelector(".fc-gf"), gb = g.querySelector(".fc-gb");
      const show = (el, from, to) => track(el.animate([{ opacity: from }, { opacity: from, offset: .45 }, { opacity: to, offset: .55 }, { opacity: to }], t));
      show(gf, up0, up1);
      show(gb, 1 - up0, 1 - up1);
      if (flip) track(g.firstElementChild.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(.05)", offset: .5 }, { transform: "scaleX(1)" }], t));
    });
    setTimeout(() => { for (const p of piles.values()) p.leave(); }, last + 60);
  }

  /** The pause: what is flying stands still. */
  function hold(on) {
    held = on;
    for (const a of running) { try { on ? a.pause() : a.play(); } catch { /* finished */ } }
  }
  function dispose() { for (const a of running) { try { a.cancel(); } catch { /* gone */ } } running.clear(); fx.remove(); }
  return { run, hold, dispose, moving, fx };
}
