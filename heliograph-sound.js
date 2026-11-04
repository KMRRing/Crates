// Heliograph's sound, made with Web Audio (no files): a shattered crystal is a small glass tinkle (a few high partials that
// ring and fade, each colour its own note of a pentatonic scale), light through a colour crystal or a prism a soft rising
// chime, a lamp lit a clear bell, a crack a dry tick, a fall a duller run of glass. The context is made on the first sound (the
// player has just fired, so the browser allows it); any failure is silent. Whether to play at all is the page's choice (the
// menu's Sound, off in a watching frame).
let ctx = null;
const NOTES = [880, 1046.5, 1318.5, 1568];                 // gold, green, blue, red: a major pentatonic fragment, A5 C6 E6 G6

function audio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
/** One ringing partial: a sine at `f` that starts at `t`, decays over `len` seconds. */
function ring(a, f, t, len, vol) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + len + 0.05);
}
/** A burst of filtered noise: the glass breaking. */
function crackle(a, t, len, vol, freq) {
  const n = Math.floor(a.sampleRate * len), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = a.createBufferSource(), band = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf;
  band.type = "bandpass"; band.frequency.value = freq; band.Q.value = 1.4;
  g.gain.value = vol;
  src.connect(band).connect(g).connect(a.destination);
  src.start(t);
}
const safe = f => (...args) => { try { f(audio(), audio().currentTime, ...args); } catch { /* no audio here */ } };

/** A crystal of colour c shattering; `k` (0, 1, 2…) is how many have gone this shot, each a little higher so a run climbs. */
export const shatter = safe((a, t, c = 0, k = 0) => {
  const f = NOTES[c % 4] * (1 + 0.06 * Math.min(k, 8)) * (0.98 + Math.random() * 0.04);
  crackle(a, t, 0.09, 0.12, 5200);
  ring(a, f, t, 0.9, 0.09); ring(a, f * 2.76, t, 0.5, 0.045); ring(a, f * 5.4, t, 0.25, 0.02);
});
/** Light taking a colour: a short rising chime. */
export const colour = safe((a, t, c = 0) => { const f = NOTES[c % 4] / 2; ring(a, f, t, 0.5, 0.06); ring(a, f * 1.5, t + 0.07, 0.5, 0.05); });
/** A lamp lit: a clear bell. */
export const lampLit = safe((a, t) => { ring(a, 1760, t, 1.2, 0.08); ring(a, 2637, t, 0.9, 0.05); ring(a, 3520, t + 0.03, 0.6, 0.03); });
/** A frail crystal cracking, or the light stopped by a shutter: a dry tick. */
export const crack = safe((a, t) => { crackle(a, t, 0.05, 0.2, 3400); ring(a, 2300, t, 0.12, 0.03); });
/** What hung under a cut falling: a run of dull glass. */
export const fall = safe((a, t, n = 3) => { for (let i = 0; i < Math.min(n, 6); i++) { crackle(a, t + i * 0.05, 0.08, 0.07, 2400 - i * 150); ring(a, 660 - i * 40, t + i * 0.05, 0.25, 0.025); } });
/** A level won: the pentatonic scale, up. */
export const won = safe((a, t) => { NOTES.forEach((f, i) => { ring(a, f, t + i * 0.11, 0.9, 0.07); ring(a, f * 2, t + i * 0.11, 0.6, 0.03); }); });
