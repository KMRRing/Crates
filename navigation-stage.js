// The stage of the Navigation course (course.js shows it above the words of each step): the step's instrument, drawn as one SVG to a
// fixed box (navigation-ui.js: W by H), moved by the pointer. A step names its instrument (`inst`) and, to be a task, a `goal`; the
// instrument says when it is ready, judges, and shows its answer after two misses (the sheet's rule). Instruments are in
// navigation-sky.js and navigation-sea.js.
import { sky, alt, sext, corr } from "./navigation-sky.js";
import { chart, rose, plot, log, clock, clockerr, tide } from "./navigation-sea.js";
import { W, H } from "./navigation-ui.js";

export const INSTRUMENTS = { sky, alt, sext, corr, chart, rose, plot, log, clock, clockerr, tide };

export function navStage() {
  let box = null, api = null, step = null, st = null, active = null;
  const inst = s => INSTRUMENTS[s.inst];
  /** The pointer in the box's units: the SVG is fitted to the stage (meet), so undo its scale and its centring. */
  function point(e) {
    const svg = box.querySelector("svg");
    if (!svg) return null;
    const r = svg.getBoundingClientRect(), k = Math.min(r.width / W, r.height / H);
    return { x: (e.clientX - r.left - (r.width - W * k) / 2) / k, y: (e.clientY - r.top - (r.height - H * k) / 2) / k };
  }
  function state(s, t) {
    if (!t.v || t.vs !== s) { t.v = inst(s).init(s); t.vs = s; }
    return t.v;
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.classList.add("nv-stage");
      box.addEventListener("pointerdown", e => {
        if (!step || !st) return;
        const p = point(e), i = inst(step);
        if (!p || !i) return;
        if (i.down(step, state(step, st), p, st)) {
          active = e.pointerId;
          try { box.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
          e.preventDefault();
          api.changed();
        }
      });
      box.addEventListener("pointermove", e => {
        if (active !== e.pointerId || !step) return;
        const p = point(e);
        if (p && inst(step).move(step, state(step, st), p, st)) api.changed();
      });
      const lift = e => {
        if (active !== e.pointerId || !step) return;
        active = null;
        const p = point(e) || { x: 0, y: 0 }, res = e.type === "pointercancel" ? null : inst(step).up(step, state(step, st), p, st);
        if (res && !st.done) api.answer(res); else api.changed();
      };
      box.addEventListener("pointerup", lift);
      box.addEventListener("pointercancel", lift);
    },
    task: s => !!s.goal && !s.quiz,
    // a task with a Check button, or one the instrument judges as you tap (the sky)
    submits: s => !!inst(s).judge,
    ready: (s, t) => inst(s).ready(s, state(s, t)),
    label: s => s.check || "Check",
    submit: (s, t) => inst(s).judge(s, state(s, t)),
    hint(s, t) { inst(s).reveal(s, state(s, t)); },
    draw(s, t) {
      step = s;
      st = t;
      const v = state(s, t);
      box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="nv nvi-${s.inst}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${s.desc || "An instrument"}">${inst(s).draw(s, v, t)}</svg>`;
    },
  };
}
