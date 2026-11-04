// desk3d: a 2D board with depth (November 2026). A grid or tile page opts in, and its board becomes a slab with a bevelled
// edge lying on a leather desk, softly lit, that tips a little with the phone (or the pointer) and presses under a tap.
// CSS 3D only: the board stays the page's own DOM (text, focus, typing, hit-testing exactly as before), nothing is drawn to a
// canvas, and the only thing that moves is one element's transform (composited: no layout, no paint). The look is desk3d.css.
//
//   <section id="stage" class="fit-box"><div id="board"></div></section>           (the page's own markup)
//   const d3 = desk3d($("stage"), $("board"));                                      // once, after the page's markup exists
//   const view = deskView("nonet");                                                  // Flat or Desk, default from mode3d.js
//   d3.set(view.get() === "desk");                                                    // and again whenever the choice changes
//   d3.glint();                                                                       // a sweep of light over the slab (solved)
//
// `host` is the element the game fills with its board (the board may be replaced at any time: the slab is whatever its first
// child is, and is dressed again each time). Where the page's #app is not the root, pass { root }. Options:
//   root:     the element that gets `d3-on` while the desk is showing (default: stage's #app, else <body>); the game's number pad
//             and anything else outside the stage may be styled `.d3-on .thing`
//   press:    selector for what dips under a finger (default ".dg-c", the digit grid's cell)
//   range:    degrees of parallax each way (default 3.2)
//   askMotion: on iOS, ask for motion permission at the first tap on the board (a system prompt; off by default)
import { defaultIs3D, wants3D, onDefaultChange } from "./mode3d.js";

const REST_X = 17, FIT = 0.95;                                   // the slab's rest tilt (deg) and the scale that keeps its near edge on the desk (match desk3d.css)

/** Flat or Desk for a game: the player's own choice if one is kept, else the suite's default (mode3d.js: flat under battery saver). A choice is written only when made. */
export function deskView(game) {
  const key = `suite:${game}-view`;                                // a device's own, like table3d-view.js's
  const frame = (() => { try { const q = new URLSearchParams(location.search); return q.has("watch") && q.has("frame"); } catch { return false; } })();
  const kept = () => { try { return localStorage.getItem(key); } catch { return null; } };
  let failed = false;
  const get = () => (frame || failed ? "flat" : wants3D(kept(), "desk") ? "desk" : "flat");
  const set = v => { if (frame) return; try { localStorage.setItem(key, v === "desk" ? "desk" : "flat"); } catch { /* private mode */ } };
  /** `fn(view)` when Settings' 2D mode changes and the player has chosen nothing. */
  const watch = fn => (frame ? () => {} : onDefaultChange(() => { if (!kept()) fn(get()); }));
  return { get, set, watch, fail: () => { failed = true; }, options: [["flat", "Flat"], ["desk", "Desk"]] };
}

export function desk3d(stage, host, opts = {}) {
  const root = opts.root || stage.closest("#app") || document.body;
  const pressSel = opts.press || ".dg-c", range = opts.range ?? 3.2;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const world = document.createElement("div"), desk = document.createElement("div");
  world.className = "d3-world";
  desk.className = "d3-desk";
  desk.setAttribute("aria-hidden", "true");
  stage.classList.add("desk3d");
  host.before(world);
  world.append(desk, host);
  host.classList.add("d3-host");

  // the slab: whatever the game puts first in its host, dressed with an edge, a shadow and a sheen
  const dress = () => {
    const slab = host.firstElementChild;
    if (!slab || slab.classList.contains("d3-slab")) return;
    slab.classList.add("d3-slab");
    const part = (cls, tag = "i") => Object.assign(document.createElement(tag), { className: cls });
    const sheen = part("d3-sheen");
    sheen.append(part("d3-glint"));
    slab.prepend(part("d3-cast"), part("d3-frame"));
    slab.append(part("d3-side d3-n"), part("d3-side d3-e"), part("d3-side d3-s"), part("d3-side d3-w"), sheen);
    for (const el of slab.querySelectorAll(":scope > .d3-cast, :scope > .d3-frame, :scope > .d3-side, :scope > .d3-sheen")) el.setAttribute("aria-hidden", "true");
  };
  const seen = new MutationObserver(dress);
  seen.observe(host, { childList: true });
  dress();

  // the desk is as big as the stage (and a margin for the tilt), set once per resize
  const size = () => { desk.style.setProperty("--d3-sw", `${Math.round(stage.clientWidth * 1.4)}px`); desk.style.setProperty("--d3-sh", `${Math.round(stage.clientHeight * 1.4)}px`); };
  const sizer = typeof ResizeObserver === "function" ? new ResizeObserver(size) : null;

  // ---------- parallax and press: a target the transform eases towards, drawn only while it is moving ----------
  let on = false, raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, press = 0, cp = 0, base = null;
  const apply = () => {
    world.style.transform = `translateZ(${(-cp * 0.45).toFixed(3)}rem) rotateX(${(REST_X + cx).toFixed(3)}deg) rotateY(${cy.toFixed(3)}deg) scale(${FIT})`;
  };
  const tick = () => {
    raf = 0;
    const tp = press, k = 0.22;
    cx += (tx - cx) * k; cy += (ty - cy) * k; cp += (tp - cp) * (tp > cp ? 0.5 : 0.2);
    apply();
    if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01 || Math.abs(tp - cp) > 0.01) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };
  const clamp = v => Math.max(-range, Math.min(range, v));

  const onPointer = e => {                                          // a mouse or pen over the stage; a finger presses, below
    if (e.pointerType === "touch" || calm.matches) return;
    const r = stage.getBoundingClientRect();
    ty = clamp(((e.clientX - r.left) / r.width - 0.5) * 2 * range);
    tx = clamp(-((e.clientY - r.top) / r.height - 0.5) * 2 * range);
    kick();
  };
  const onLeave = () => { tx = ty = 0; kick(); };
  const onTilt = e => {                                             // the phone's tilt, eased by a slow baseline so holding it still comes back to rest
    if (calm.matches || e.gamma == null || e.beta == null) return;
    const turn = ((screen.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
    let a = e.gamma, b = e.beta;
    if (turn === 90) [a, b] = [e.beta, -e.gamma];
    else if (turn === 270) [a, b] = [-e.beta, e.gamma];
    base = base || { a, b };
    base.a += (a - base.a) * 0.02; base.b += (b - base.b) * 0.02;
    ty = clamp((a - base.a) * 0.35);
    tx = clamp(-(b - base.b) * 0.35);
    kick();
  };
  let down = null;
  const onDown = e => {
    const t = e.target.closest?.(pressSel);
    if (t) { down = t; t.classList.add("d3-down"); }
    if (!calm.matches) { press = 1; kick(); }
    if (opts.askMotion && typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      opts.askMotion = false;
      DeviceOrientationEvent.requestPermission().then(s => { if (s === "granted") addEventListener("deviceorientation", onTilt); }).catch(() => {});
    }
  };
  const onUp = () => { down?.classList.remove("d3-down"); down = null; if (press) { press = 0; kick(); } };

  const start = () => {
    stage.addEventListener("pointermove", onPointer);
    stage.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);
    addEventListener("deviceorientation", onTilt);
    sizer?.observe(stage);
    size();
  };
  const stop = () => {
    stage.removeEventListener("pointermove", onPointer);
    stage.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("pointerdown", onDown);
    removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onUp);
    removeEventListener("deviceorientation", onTilt);
    sizer?.disconnect();
    cancelAnimationFrame(raf); raf = 0; tx = ty = cx = cy = press = cp = 0; base = null;
    world.style.transform = "";
  };

  return {
    /** Shows the desk (true) or the page as it was (false). */
    set(yes) {
      yes = !!yes;
      if (yes === on) return;
      on = yes;
      root.classList.toggle("d3-on", on);
      on ? start() : stop();
    },
    get on() { return on; },
    /** A sweep of light across the slab, once (the board is solved). */
    glint() {
      const s = host.querySelector(".d3-sheen");
      if (!on || !s) return;
      s.classList.remove("d3-shine");
      void s.offsetWidth;                                           // restarts the sweep
      s.classList.add("d3-shine");
      s.addEventListener("animationend", () => s.classList.remove("d3-shine"), { once: true });
    },
    destroy() { this.set(false); seen.disconnect(); },
  };
}
