// Gears' sound: a soft synthesised tick (a short click through a bandpass, like a movement's escapement) made with Web Audio:
// no files. The audio context is made on the first tick (a tap has just solved the level, so the browser allows it) and any
// failure is silent. Whether to play at all is the page's choice (the menu's Sound, off in a watching frame).
let ctx = null;

/** One tick; `pitch` around 1 (0.7 is a duller one, the load's), `loud` around 1 (the escapement's beat is quiet, a second's jump loud). */
export function tick(pitch = 1, loud = 1) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime, len = 0.03, n = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buf;
    band.type = "bandpass"; band.frequency.value = 2400 * pitch; band.Q.value = 2.5;
    gain.gain.setValueAtTime(0.16 * loud, t); gain.gain.exponentialRampToValueAtTime(0.001, t + len + 0.02);
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(t);
  } catch { /* no audio here */ }
}
