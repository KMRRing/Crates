// Gears' sound: a soft synthesised tick (a short click through a bandpass, like a movement's escapement) and a jam's grind, made
// with Web Audio: no files. The audio context is made on the first tick (a tap has just solved the level, so the browser allows it) and any
// failure is silent. Whether to play at all is the page's choice (the menu's Sound, off in a watching frame).
let ctx = null;
const audio = () => { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; };

/** One tick; `pitch` around 1 (0.7 is a duller one, the load's), `loud` around 1 (the escapement's beat is quiet, a second's jump loud). */
export function tick(pitch = 1, loud = 1) {
  try {
    audio();
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

/** A jam: teeth that cannot pass grinding against each other, a rough low rasp that stutters as they catch, over a dull knock. */
export function jam(loud = 1) {
  try {
    audio();
    const t = ctx.currentTime, sr = ctx.sampleRate, len = 0.26, n = Math.floor(sr * len);
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let rough = 0;
    for (let i = 0; i < n; i++) {
      const s = i / sr, fall = Math.pow(1 - i / n, 1.6);
      const catches = Math.sin(2 * Math.PI * 34 * s + 2.2 * Math.sin(2 * Math.PI * 6 * s)) > -0.2 ? 1 : 0.25;  // teeth catching, unevenly
      rough += 0.16 * ((Math.random() * 2 - 1) - rough);                                                  // noise, low-passed: a grind, not a hiss
      d[i] = fall * (2.6 * rough * catches) + 0.55 * Math.sin(2 * Math.PI * 78 * s) * Math.exp(-s * 26);
    }
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buf;
    band.type = "bandpass"; band.frequency.value = 520; band.Q.value = 0.7;
    gain.gain.setValueAtTime(0.3 * loud, t); gain.gain.exponentialRampToValueAtTime(0.001, t + len + 0.03);
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(t);
  } catch { /* no audio here */ }
}
