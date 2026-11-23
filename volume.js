// The app's volume (Korbi, 23 Nov 2026: "replace sound on/off with a slider on volume"): one level for every game, from silent to
// full, kept on this device (suite: keys aren't synced: a phone and an iPad want their own) and set by the Volume slider in any
// game's Settings (menu.js's volume()). A game's sound plays through speaker(ctx) instead of ctx.destination, so a change is heard
// at once in sounds already playing, and makes nothing while audible() is false.
const KEY = "suite:volume";
const clamp = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);
let level = 1;
try { const raw = localStorage.getItem(KEY); if (raw != null) level = clamp(Number(raw)); } catch { /* private mode */ }
const outlets = new Set();
// loudness heard goes roughly with the square of the gain's fraction, so the slider's middle sounds like the middle
const gainOf = v => v * v;

export const volumeNow = () => level;
export const audible = () => level > 0;

/** A gain node on its way to ctx's speakers at the app's volume: a sound module's master goes into this. */
export function speaker(ctx) {
  const g = ctx.createGain();
  g.gain.value = gainOf(level);
  g.connect(ctx.destination);
  outlets.add(g);
  return g;
}

function apply() {
  for (const g of outlets) {
    try { g.gain.setTargetAtTime(gainOf(level), g.context.currentTime, 0.03); } catch { outlets.delete(g); }
  }
}
/** Sets the volume (0 to 1), keeps it, and turns every speaker to it. */
export function setVolume(v) {
  level = clamp(v);
  try { localStorage.setItem(KEY, String(level)); } catch { /* private mode */ }
  apply();
}
// another tab of the app moved it
globalThis.addEventListener?.("storage", e => { if (e.key === KEY) { level = clamp(Number(e.newValue)); apply(); } });
