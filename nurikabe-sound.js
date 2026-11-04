// Atoll's two sounds, synthesised with Web Audio (no files): when the sea is the answer the lock gates knock as they lift and water
// runs in. The context is made on the solving tap (the browser allows it then); any failure is silent. Played only for the
// player's own solve, never in a watching frame or a shared board (the page decides).
let ctx = null;

/** Two wooden knocks (the gates) and a second of running water. */
export function solved() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    for (const [at, f] of [[0.3, 190], [0.52, 150]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f, t + at); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + at + 0.09);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.28, t + at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.14);
      o.connect(g).connect(ctx.destination); o.start(t + at); o.stop(t + at + 0.16);
    }
    const len = 1.4, n = Math.floor(ctx.sampleRate * len), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; band.type = "bandpass"; band.frequency.setValueAtTime(900, t + 0.5); band.frequency.linearRampToValueAtTime(1800, t + 1.8); band.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t + 0.5); g.gain.linearRampToValueAtTime(0.05, t + 0.9); g.gain.linearRampToValueAtTime(0.0001, t + 0.5 + len);
    src.connect(band).connect(g).connect(ctx.destination); src.start(t + 0.5);
  } catch { /* no audio here */ }
}
