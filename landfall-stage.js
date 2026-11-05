// Landfall's 3D stage: the scene (landfall-scene.js) and the navigator's body in it. Fingers become looks: drag down to look at the
// chart table, up to the sky, sideways to turn; a pinch or the wheel looks closer; a tap on a star chooses it, on the chart works the
// dividers or the course, on a thing on the table does what its button does. A button does the same for anyone who cannot drag, and
// the arrow keys turn the head. The phase of the voyage moves the head too (to the table while the dividers are set, up to the sky
// while a star is found), and a look is kept: dragging down and up again comes back to the bearing it left.
import { createScene, TABLE, STAND } from "./landfall-scene.js";
import { clamp, smooth, lerp, D2R, wrapDiff, poseOf, dragLook, ease, tableBlend, HFOV, adapt, PITCH_MIN, PITCH_MAX, vfovOf, dirOf } from "./landfall-look.js";

const TABLE_PITCH_BASE = 70, TABLE_VFOV = 62;

/**
 * `host` is the element the canvas goes in; `hooks` are what the page answers: pick(star), prop(id), chart(kind, x, y) with kind
 * "down" | "move" | "up" and a point on the chart canvas, canChart(), canPick(), reduced(), bottom() (css px of controls over the view's foot).
 */
export function createStage(host, hooks) {
  const sc = createScene(host, { reduced: hooks.reduced });
  const cv = sc.canvas;
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", "The deck at night: the sky above the horizon, the chart table below");
  cv.tabIndex = 0;
  const look = { az: 0, pitch: 38 };
  let hfov = HFOV.stand, goal = null, raised = null, raiseLevel = 0, raiseGoal = 0, lastLook = { az: 0, pitch: 38 };
  const quality = { ratio: Math.min(devicePixelRatio || 1, 2), slow: 0, fast: 0 };
  const cap = quality.ratio;
  let w = 0, h = 0, portrait = true, last = 0, lastFrame = 0, kick = 0, chartDirty = true, twink = 0, dragging = false, resolveRaise = null;

  // ---------- size ----------
  function resize() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (Math.round(r.width) !== w || Math.round(r.height) !== h) {
      w = Math.round(r.width); h = Math.round(r.height);
      sc.setRatio(quality.ratio); sc.resize(w, h);
      portrait = h >= w * 0.9;
      const c = sc.sizeChart(portrait, Math.min(2, quality.ratio * 1.1));
      if (c) hooks.chartResized?.(c);
      chartDirty = true;
    }
    return true;
  }

  // ---------- the table pose: where the eye goes to look at the chart ----------
  function tablePose() {
    const aspect = w / Math.max(1, h), bottom = clamp((hooks.bottom?.() || 0) / Math.max(1, h), 0, 0.5);
    const { cw, ch } = sc.chart;
    const vf = TABLE_VFOV * (1 - bottom) , hf = 2 * Math.atan(Math.tan(TABLE_VFOV * D2R / 2) * aspect) / D2R;
    const phi = TABLE_PITCH_BASE * D2R;
    const D = Math.max((cw * 1.08) / (2 * Math.tan(hf * D2R / 2)), (ch * Math.sin(phi) * 1.08) / (2 * Math.tan(vf * D2R / 2)), 0.55);
    // the eye above and behind the chart's middle, looking a little below it so the chart sits in the part the controls leave clear
    const eye = [TABLE.x, TABLE.y + 0.03 + Math.sin(phi) * D, TABLE.z + Math.cos(phi) * D];
    return { eye, pitch: -TABLE_PITCH_BASE - bottom * TABLE_VFOV * 0.5, az: null, hfov: hf };
  }

  // ---------- the pose ----------
  let table = tablePose();
  function pose() {
    table = tablePose();
    table.az = sc.S.heading;
    const p = poseOf(look, table, STAND);
    sc.S.hfov = lerp(hfov, table.hfov, p.b);
    return p;
  }

  // ---------- moving the head ----------
  const setGoal = (g, rate = 3.2) => { goal = { ...g, rate }; kick = 1; };
  const api = {
    scene: sc, canvas: cv, look, get hfov() { return hfov; }, get blend() { return tableBlend(look.pitch); }, get raised() { return raiseLevel; },
    lookTable() { if (look.pitch > -60) { lastLook = { az: look.az, pitch: look.pitch }; } setGoal({ pitch: -78 }, 3.6); },
    lookSky(az, pitch = 38) { setGoal({ az: az ?? lastLook.az, pitch }, 3); },
    /** Back to where the head was before it looked down (or to the north when it never looked up). */
    lookBack() { setGoal({ az: lastLook.az, pitch: Math.max(lastLook.pitch, 12) }, 3); },
    isDown: () => look.pitch < -34,
    toggleLook() { if (api.isDown()) api.lookBack(); else api.lookTable(); },
    snap(az, pitch) { look.az = az; look.pitch = pitch; goal = null; kick = 1; },
    zoom(f) { hfov = clamp(hfov * f, HFOV.min, HFOV.max); kick = 1; },
    resetNorth() { setGoal({ az: 0, pitch: 38 }, 3); hfov = HFOV.stand; },
    /** The sextant up to the eye on a bearing and a height; resolves when it is there. */
    raise(az, alt, instant = false) {
      raised = { az, alt };
      raiseGoal = 1;
      if (instant) { look.az = az; look.pitch = alt; raiseLevel = 1; goal = null; return Promise.resolve(); }
      setGoal({ az, pitch: clamp(alt, 2, 80) }, 3.4);
      return new Promise(res => { resolveRaise = res; setTimeout(() => { if (resolveRaise === res) { resolveRaise = null; res(); } }, 2600); });
    },
    lower() { raised = null; raiseGoal = 0; resolveRaise?.(); resolveRaise = null; kick = 1; },
    chartChanged() { chartDirty = true; kick = 1; },
    pokeChart() { chartDirty = true; kick = 1; },
    wake() { kick = 1; },
    setWorld(wd) { Object.assign(sc.S, wd.S); if (wd.refresh) sc.refreshSky(); if (wd.clouds) sc.setClouds(); },
    refreshSky: () => sc.refreshSky(true),
    setClouds: () => sc.setClouds(),
    setDividers: sc.setDividers, setRules: sc.setRules,
    screenOf: sc.screenOf,
    resize,
    dispose() { sc.dispose(); },
  };

  // ---------- fingers ----------
  const ptrs = new Map();
  let g = null;                                     // the gesture: { x0, y0, moved, mode: "look" | "chart", pinch, hfov0 }
  const spread = () => { const [a, b] = [...ptrs.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  cv.addEventListener("pointerdown", e => {
    hooks.unlock?.();
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      goal = null;
      const onChart = hooks.canChart?.() && tableBlend(look.pitch) > 0.55 ? sc.chartAt(e.clientX, e.clientY) : null;
      g = { x0: e.clientX, y0: e.clientY, moved: 0, mode: onChart ? "chart" : "look" };
      if (onChart) hooks.chart("down", onChart.x, onChart.y);
      dragging = true;
    } else if (g) { g = { ...g, mode: "look", pinch: spread(), hfov0: hfov, moved: 99 }; }
  });
  cv.addEventListener("pointermove", e => {
    const p = ptrs.get(e.pointerId);
    if (!p || !g) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) { if (g.pinch > 10) { hfov = clamp(g.hfov0 * g.pinch / Math.max(10, spread()), HFOV.min, HFOV.max); kick = 1; } return; }
    g.moved += Math.hypot(dx, dy);
    if (g.mode === "chart") { const c = sc.chartAt(e.clientX, e.clientY); if (c) hooks.chart("move", c.x, c.y); return; }
    if (g.moved < 6) return;
    // a degree of azimuth is shorter by the cosine of the height, so the same drag turns the view further high up; a drag down is longer than a turn is wide
    const n = dragLook(look, dx / Math.max(0.35, Math.cos(clamp(look.pitch, -60, 70) * D2R)), dy * 1.8, Math.max(2, sc.pxPerDeg()));
    look.az = n.az; look.pitch = n.pitch;
    if (look.pitch > -20) lastLook = { az: look.az, pitch: look.pitch };
    kick = 1;
  });
  const up = e => {
    if (!ptrs.delete(e.pointerId) || !g) return;
    if (g.mode === "chart") hooks.chart("up", 0, 0);
    else if (e.type === "pointerup" && ptrs.size === 0 && g.moved < 8) tap(e.clientX, e.clientY);
    if (ptrs.size === 0) { g = null; dragging = false; }
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", e => { e.preventDefault(); hfov = clamp(hfov * Math.exp(e.deltaY * 0.001), HFOV.min, HFOV.max); kick = 1; }, { passive: false });
  cv.addEventListener("keydown", e => {
    const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
    if (!k) return;
    e.preventDefault(); goal = null;
    look.az = (look.az + k[0] + 360) % 360; look.pitch = clamp(look.pitch + k[1], PITCH_MIN, PITCH_MAX);
    if (look.pitch > -20) lastLook = { az: look.az, pitch: look.pitch };
    kick = 1;
  });
  function tap(x, y) {
    const prop = tableBlend(look.pitch) < 0.9 ? sc.propAt(x, y) : null;
    if (prop) { hooks.prop(prop); return; }
    if (hooks.canPick?.()) {
      const s = sc.pickStar(x, y, hooks.stars(), 22);
      if (s) { hooks.pick(s); return; }
    }
    hooks.tapEmpty?.();
  }

  // ---------- one frame ----------
  /** Draws the scene if anything changed or the sea is moving. `now` in ms. Returns whether it drew. */
  api.tick = function tick(now, force = false) {
    if (!resize()) return false;
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    // the head
    if (goal) {
      let moved = 0;
      if (goal.az !== undefined) { const n = ease(look.az, goal.az, dt, goal.rate, true); moved += Math.abs(wrapDiff(look.az, goal.az)); look.az = n; }
      if (goal.pitch !== undefined) { const n = ease(look.pitch, goal.pitch, dt, goal.rate); moved += Math.abs(goal.pitch - look.pitch); look.pitch = n; }
      if (moved < 0.15) {
        if (goal.az !== undefined) look.az = goal.az;
        if (goal.pitch !== undefined) look.pitch = goal.pitch;
        goal = null;
      }
    }
    if (look.pitch > -20 && !goal && !raised) lastLook = { az: look.az, pitch: look.pitch };
    // the sextant
    const dl = raiseGoal - raiseLevel;
    if (Math.abs(dl) > 0.001) raiseLevel = clamp(raiseLevel + Math.sign(dl) * Math.min(Math.abs(dl), dt * (hooks.reduced?.() ? 6 : 1.25)), 0, 1);
    sc.setSextant(raiseLevel);
    if (raiseGoal === 1 && raiseLevel >= 0.98 && resolveRaise && !goal) { resolveRaise(); resolveRaise = null; }
    // the chart's texture
    if (chartDirty && hooks.drawChart) { chartDirty = false; if (tableBlend(look.pitch) > 0.02 || force) { hooks.drawChart(); sc.chartTexture(); } else chartDirty = true; }
    twink += dt;
    if (twink > (hooks.reduced?.() ? 4 : 0.15)) { twink = 0; sc.refreshSky(); }
    const ms = now - lastFrame;
    lastFrame = now;
    const p = pose();
    sc.frame(now / 1000, dt, p);
    if (!dragging && adapt(quality, ms, cap)) { sc.setRatio(quality.ratio); chartDirty = true; }
    return true;
  };
  api.hfovNow = () => hfov;
  api.pose = pose;
  void smooth; void vfovOf; void dirOf;
  return api;
}
