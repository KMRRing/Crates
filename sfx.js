// Sound for every page that has none of its own (Korbi, 8 November 2026: "everything should get sound"). One small module a
// page loads with <script type="module" src="sfx.js">: a tick for a tap on anything pressable, a rising ding when something
// on the page turns correct and a low nope when it turns wrong (found by the class the game puts on it), a chime when a round
// ends (random.js's roundOver announces it), and a Sound switch put into the menu's Settings. Made as they play (Web Audio, no
// files); nothing at all while off, in a watching frame or before the first touch (browsers start audio only from one).
// A game that wants its own sounds has its own module (settle-sound.js is the model) and does not load this.
import { IN_FRAME } from "./suite.js";
import { part, toggle } from "./menu.js";

const KEY = `${(location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index"}:sound`;
let ctx = null, master = null, on = true;
try { on = localStorage.getItem(KEY) !== "false"; } catch { /* private mode */ }
if (IN_FRAME) on = false;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const squash = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function note(c, t, freq, dur, gain, drop = 1, type = "sine") {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * drop), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const SOUNDS = {
  tick: (c, t) => note(c, t, 1500, 0.04, 0.12, 0.7),
  ding: (c, t) => { note(c, t, 880, 0.18, 0.16); note(c, t + 0.09, 1320, 0.28, 0.14); },
  nope: (c, t) => { note(c, t, 220, 0.2, 0.18, 0.7, "triangle"); note(c, t + 0.07, 165, 0.25, 0.16, 0.7, "triangle"); },
  chime: (c, t) => [523, 659, 784, 1047].forEach((f, i) => note(c, t + i * 0.1, f, 0.45, 0.14)),
};
let last = 0;
/** Plays a sound, but never two within 70 ms (a class change that touches many tiles is one sound). */
export function play(name) {
  const c = audio(), now = performance.now();
  if (!c || c.state !== "running" || now - last < 70) return;
  last = now;
  SOUNDS[name](c, c.currentTime + 0.005);
}
export const sfx = { play, get on() { return on; }, set on(v) { on = !!v; try { localStorage.setItem(KEY, String(on)); } catch { /* private mode */ } } };

// a tap on anything pressable (the first one also starts the audio)
const PRESSABLE = "button, [role=button], [role=switch], [role=tab], a[href], summary, select, label, .cell, [data-cell], canvas, input[type=range], input[type=checkbox]";
document.addEventListener("pointerdown", e => {
  audio();
  const hit = e.target.closest?.(PRESSABLE);
  if (hit && !hit.disabled && hit.getAttribute("aria-disabled") !== "true") play("tick");
}, true);

// something the page marks right or wrong: the class a game puts on it, as it is put
const RIGHT = /(?:^|[-_\s])(correct|right|solved|won|win|good|ok)(?:$|[-_\s])/i, WRONG = /(?:^|[-_\s])(wrong|bad|miss|missed|error|lost|lose|invalid|fail|failed)(?:$|[-_\s])/i;
const app = document.getElementById("app");
if (app) {
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type !== "attributes" || m.attributeName !== "class") continue;
      const was = m.oldValue || "", now = m.target.getAttribute("class") || "";
      if (was === now) continue;
      const added = now.split(/\s+/).filter(x => x && !was.split(/\s+/).includes(x)).join(" ");
      if (!added) continue;
      if (WRONG.test(added)) { play("nope"); return; }
      if (RIGHT.test(added)) { play("ding"); return; }
    }
  }).observe(app, { attributes: true, attributeOldValue: true, attributeFilter: ["class"], subtree: true });
}

// a round ends (random.js announces it)
addEventListener("round-over", () => play("chime"));

// the menu's Settings gets the Sound switch, as every game with sound has one (not in a watching frame, which has none)
const dlg = document.getElementById("menuDlg"), body = document.getElementById("menuBody");
if (dlg && body && !IN_FRAME) {
  new MutationObserver(() => {
    if (!dlg.open) return;
    queueMicrotask(() => {
      if (body.querySelector('[role="switch"][aria-label="Sound"]')) return;
      part(body, "settings").append(toggle("Sound", on, v => { sfx.on = v; if (v) { audio(); play("tick"); } }));
    });
  }).observe(dlg, { attributes: true, attributeFilter: ["open"] });
}
