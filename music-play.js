// What the instruments share for playing a demonstration: a row of buttons ("Hear it", "Hear the scale") and the sounds behind them.
// A demonstration is { label, notes: [midi], gap (seconds between notes), dur, chord (all together), both (the notes one by one, then together),
// vel, events (a ready list of { t, midi, dur, bar }) }.
import { chip, flow, inBox } from "./music-draw.js";

export const widthOf = s => Math.max(56, Math.round(String(s).length * 6.5 + 20));
/** The events of a demonstration. */
export function demoEvents(d) {
  if (d.events) return d.events;
  const gap = d.gap ?? 0.5, dur = d.dur ?? (d.chord ? 1.6 : gap * 1.5), vel = d.vel ?? 0.8, ns = d.notes || [];
  if (d.chord) return ns.map(midi => ({ t: 0, midi, dur, vel }));
  const seq = ns.map((midi, i) => ({ t: i * gap, midi, dur, vel }));
  if (!d.both) return seq;
  const at = ns.length * gap + 0.25;
  return [...seq, ...ns.map(midi => ({ t: at, midi, dur: 1.6, vel }))];
}
/** The demonstration buttons as laid-out chips from (x, y) over `width`. */
export const demoChips = (demos, x = 8, y = 6, width = 344) => flow((demos || []).map((d, i) => ({ text: `▶ ${d.label}`, w: widthOf(d.label) + 14, demo: i })), x, y, width);
export const demoSvg = chips => chips.map(c => chip({ ...c, text: c.text })).join("");
export const demoHit = (chips, p) => chips.find(c => inBox(c, p)) || null;
/** Plays a list of events now (stopping what sounds), lights their keys, and returns when they end. */
export function playEvents(env, events) {
  const start = env.audio.at();
  env.audio.silence();
  env.audio.play(events, start);
  env.cue(events, start);
  return start + Math.max(0, ...events.map(e => e.t + (e.dur || 0.5)));
}
export const playDemo = (env, d) => playEvents(env, demoEvents(d));
