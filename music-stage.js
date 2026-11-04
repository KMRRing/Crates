// The stage of the Music course (course.js shows it above the words of each step): the step's instrument drawn as one SVG to a fixed box
// (music-draw.js: W by H), moved by the pointer, with a band above it that says plainly when sound is off and turns it on with a tap.
// A step names its instrument (`inst`) and, to be a task, a `goal`; the instrument says when it is ready, judges, and shows its answer
// after two misses (the sheet's rule). The stage also owns the one animation frame that lights keys and beats as they sound (cues on
// the audio clock), the audio, the rhythm loop and the review pile, which it hands to the instruments as `env`.
import { createLoop } from "./music-rhythm.js";
import { loadPile, savePile, record } from "./music-pile.js";
import { W, H } from "./music-draw.js";
import { keysInst, staffInst, readInst, circleInst } from "./music-keys.js";
import { chordInst, progInst, pieceInst } from "./music-chords.js";
import { beatInst, dynInst } from "./music-beat.js";
import { earInst } from "./music-ear.js";

export const INSTRUMENTS = { keys: keysInst, staff: staffInst, read: readInst, circle: circleInst, chord: chordInst, prog: progInst, piece: pieceInst, beat: beatInst, dyn: dynInst, ear: earInst };
const CALIB = "music:calib";                                  // the reader's tap offset in milliseconds

export function musicStage({ audio, inFrame = false }) {
  const timers = new Set();
  let box = null, api = null, step = null, st = null, active = null, raf = 0, cues = [];
  const loop = createLoop(audio);
  let pile = loadPile();
  const readCalib = () => { try { const n = Number(localStorage.getItem(CALIB)); return Number.isFinite(n) ? n / 1000 : 0; } catch { return 0; } };
  let calib = readCalib();
  const inst = s => INSTRUMENTS[s.inst];

  const env = {
    audio, loop,
    get pile() { return pile; },
    /** Notes the pile keeps: a miss or a right answer to an item. */
    note(id, ok) { record(pile, id, ok); if (!inFrame) savePile(pile); },
    reloadPile() { pile = loadPile(); },
    get calib() { return calib; },
    setCalib(sec) { calib = sec; if (!inFrame) try { localStorage.setItem(CALIB, String(Math.round(sec * 1000))); } catch { /* private mode */ } },
    /** Sounds that light keys (data-midi) and bars (data-bar) as they play: events [{ t, midi, dur, bar }] from `start` on the audio clock. */
    cue(events, start) { cues.push({ start, events, end: start + Math.max(0, ...events.map(e => e.t + (e.dur || 0.5))) }); kick(); },
    answer: res => { if (st && !st.done) api.answer(res); },
    redraw: () => api.changed(),
    kick: () => kick(),
    /** A timer that is cleared when the step is left. */
    later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
  };

  function point(e) {
    const svg = box.querySelector("svg");
    if (!svg) return null;
    const r = svg.getBoundingClientRect(), k = Math.min(r.width / W, r.height / H);
    return { x: (e.clientX - r.left - (r.width - W * k) / 2) / k, y: (e.clientY - r.top - (r.height - H * k) / 2) / k };
  }
  function state(s, t) {
    if (!t.v || t.vs !== s) { t.v = inst(s).init(s, env); t.vs = s; }
    return t.v;
  }
  function leave() {
    audio.silence();
    loop.stop();
    cues = [];
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (step && st?.v) inst(step).leave?.(step, st.v, env);
  }
  function kick() { if (!raf && box) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (!box || !step) return;
    const now = audio.time, midis = new Set(), bars = new Set();
    cues = cues.filter(c => c.end > now - 0.1);
    for (const c of cues) for (const e of c.events) if (c.start + e.t <= now && now < c.start + e.t + (e.dur || 0.5)) { if (e.midi != null) midis.add(e.midi); if (e.bar != null) bars.add(e.bar); }
    for (const el of box.querySelectorAll("[data-midi]")) el.classList.toggle("playing", midis.has(Number(el.dataset.midi)));
    for (const el of box.querySelectorAll("[data-bar]")) el.classList.toggle("now", bars.has(Number(el.dataset.bar)));
    const i = inst(step);
    const more = st?.v ? i.frame?.(step, st.v, box, now, env) : false;
    if (cues.length || more) kick();
  }

  const band = () => {
    const s = audio.state();
    if (s === "unavailable") return `<p class="mu-band off">${inFrame ? "A watching screen makes no sound." : "This device cannot make sound here."} Everything can be done by sight, or skipped.</p>`;
    if (audio.muted) return `<p class="mu-band off">Sound is muted in the menu.</p>`;
    if (s !== "running") return `<button type="button" class="mu-enable">Sound is off. Tap here to turn it on.</button>`;
    return "";
  };

  return {
    env,
    mount(b, a) {
      box = b;
      api = a;
      box.classList.add("mu-stage");
      const unlock = () => { if (audio.state() === "off" || audio.state() === "suspended") { audio.unlock(); } };
      box.addEventListener("pointerdown", e => {
        unlock();
        if (e.target.closest(".mu-enable")) return;
        if (!step || !st) return;
        const p = point(e), i = inst(step);
        if (!p || !i) return;
        const r = i.down(step, state(step, st), p, st, e, env);
        if (r) {
          active = e.pointerId;
          try { box.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
          e.preventDefault();
          if (r !== "quiet") api.changed();
        }
      });
      box.addEventListener("pointermove", e => {
        if (active !== e.pointerId || !step) return;
        const p = point(e);
        if (p && inst(step).move(step, state(step, st), p, st, env)) api.changed();
      });
      const lift = e => {
        if (active !== e.pointerId || !step) return;
        active = null;
        unlock();
        const p = point(e) || { x: 0, y: 0 }, res = e.type === "pointercancel" ? null : inst(step).up(step, state(step, st), p, st, env);
        if (res && !st.done) api.answer(res); else api.changed();
      };
      box.addEventListener("pointerup", lift);
      box.addEventListener("pointercancel", lift);
      box.addEventListener("click", e => {
        unlock();
        if (e.target.closest(".mu-enable")) { audio.unlock(); api.changed(); }
      });
      box.addEventListener("touchend", unlock, { passive: true });
      audio.onChange(() => { if (step && box?.isConnected && box.offsetParent !== null) api.changed(); });
    },
    task: s => !!s.goal && !s.quiz,
    submits: s => !!inst(s).judge && (inst(s).submits ? inst(s).submits(s) : true),
    ready: (s, t) => inst(s).ready(s, state(s, t)),
    label: (s, t) => (inst(s).label ? inst(s).label(s, state(s, t)) : s.check || "Check"),
    submit: (s, t) => inst(s).judge(s, state(s, t), env),
    hint(s, t) { inst(s).reveal(s, state(s, t), env); },
    draw(s, t) {
      if (s !== step) { leave(); step = s; }
      st = t;
      const v = state(s, t);
      box.innerHTML = `${band()}<svg viewBox="0 0 ${W} ${H}" class="mu mui-${s.inst}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${(s.desc || "An instrument").replace(/"/g, "'")}">${inst(s).draw(s, v, t, env)}</svg>`;
      kick();
    },
    /** The sheet is closed or the page stands still: nothing sounds, nothing is queued. */
    stop() { leave(); step = null; },
    pause() { loop.stop(); },
    mutedChanged() { if (step) api.changed(); },
  };
}
