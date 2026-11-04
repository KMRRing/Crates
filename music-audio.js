// The Music course's sound: everything is made as it plays (Web Audio), so there is nothing to license and it works offline.
//   voice    one note: a band-limited wave (soft organ's partials) through a low-pass filter that closes as the note dies, under a
//            plucked envelope (quick attack, exponential fall). One oscillator a note; at most VOICES at once, the oldest let go first.
//   click    a woodblock-like tick for the metronome: three heights for strong, medium and weak pulses.
// Rules the page leans on (docs/music.md): nothing is made before a tap (iOS starts audio only inside a user gesture, so the context
// is made and resumed in `unlock()`, called from a pointer or click handler); `state()` says "off" / "suspended" / "running" so the
// page can show an Enable sound button; a watching frame (`frame`) makes no sound at all; the page's pause stops the clock
// (`pause()`); times given to `note` and `click` are on the audio clock, so rhythm is exact whatever the page is doing.
import { freq } from "./music-theory.js";

export const VOICES = 24;
export const LEAD = 0.03;                                  // seconds of lead given to a sound played "now", so its start is not clipped
const PARTIALS = [1, 0.46, 0.26, 0.12, 0.07, 0.035];      // a soft organ with a little bite; the filter takes the rest of the edge

/** ctxFactory: () => AudioContext (injected, so a test can give a fake). */
export function createAudio({ makeContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(), frame = false, now = () => globalThis.performance?.now() ?? 0 } = {}) {
  let ctx = null, master = null, wave = null, voices = [], paused = false, muted = false, level = 0.7, failed = false, keep = null;
  const listeners = new Set();
  const emit = () => { for (const f of listeners) f(); };

  function build() {
    ctx = makeContext();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16; squash.ratio.value = 4; squash.attack.value = 0.003; squash.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = level;
    master.connect(squash);
    squash.connect(ctx.destination);
    const re = new Float32Array(PARTIALS.length + 1), im = new Float32Array(PARTIALS.length + 1);
    PARTIALS.forEach((a, i) => { im[i + 1] = a; });
    wave = ctx.createPeriodicWave(re, im);
    ctx.onstatechange = emit;
  }

  const api = {
    /** Whether this device can make sound at all and the page may. */
    get supported() { return !frame && !failed && !!(globalThis.AudioContext || globalThis.webkitAudioContext || ctx); },
    /** "off" (nothing made yet), "suspended" (made, but not allowed to run: iOS before a tap, or paused), "running", "unavailable". */
    state() {
      if (frame || failed) return "unavailable";
      if (!ctx) return "off";
      return ctx.state === "running" && !paused ? "running" : "suspended";
    },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** Call from a tap: makes the context once, resumes it, plays one silent sample (iOS wants an actual start inside the gesture),
     *  and asks iOS to treat the page as playback, so the ringer switch need not mute it (Safari 17 and later). */
    unlock() {
      if (frame || failed) return false;
      try {
        if (!ctx) build();
        if (!paused && ctx.state !== "running") ctx.resume?.()?.then?.(emit, () => {});
        const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
        try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = "playback"; } catch { /* not iOS */ }
        keepAwake();
        emit();
        return true;
      } catch { failed = true; emit(); return false; }
    },
    get ctx() { return ctx; },
    get time() { return ctx ? ctx.currentTime : 0; },
    /** An audio-clock time `s` seconds from now (never in the past). */
    at(s = 0) { return (ctx ? ctx.currentTime : 0) + LEAD + s; },
    get volume() { return level; },
    setVolume(v) { level = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : level; },
    setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : level; },
    get muted() { return muted; },
    /** The output delay the browser reports, in seconds: { base, output } (output is missing on Safari). */
    latency() { return { base: ctx?.baseLatency ?? null, output: ctx?.outputLatency ?? null }; },
    /** A DOM event's time (performance.now's scale) on the audio clock as the listener hears it, or null before a context exists. */
    audioTimeOf(perfMs) {
      if (!ctx) return null;
      const t = ctx.getOutputTimestamp?.();
      if (t && t.performanceTime > 0 && t.contextTime > 0) return t.contextTime + (perfMs - t.performanceTime) / 1000;
      return ctx.currentTime - (now() - perfMs) / 1000;
    },
    /** One note at audio time `when`: midi (or Hz if hz), `dur` seconds long, `vel` 0..1. Returns its end time, or 0 if nothing was made. */
    note(midi, when, dur = 0.9, vel = 0.8, hz = null) {
      if (!ctx || paused || muted || ctx.state === "closed") return 0;
      const t = Math.max(when, ctx.currentTime), f = hz || freq(midi);
      voices = voices.filter(v => v.end > ctx.currentTime);
      while (voices.length >= VOICES) { const v = voices.shift(); steal(v); }
      const o = ctx.createOscillator(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
      o.setPeriodicWave(wave);
      o.frequency.setValueAtTime(f, t);
      filt.type = "lowpass"; filt.Q.value = 0.7;
      filt.frequency.setValueAtTime(Math.min(9000, f * 7), t);
      filt.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.8), t + Math.max(0.2, dur));
      const peak = 0.34 * Math.max(0.05, vel), end = t + dur + 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);                       // the pluck: a very short attack ...
      g.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.12);            // ... a quick fall to the body ...
      g.gain.exponentialRampToValueAtTime(peak * 0.2, t + dur);              // ... a slow one while held ...
      g.gain.exponentialRampToValueAtTime(0.0001, end);                      // ... and the release
      o.connect(filt); filt.connect(g); g.connect(master);
      o.start(t); o.stop(end + 0.02);
      voices.push({ o, g, end, t });
      return end;
    },
    /** A metronome tick at `when`: level 2 (strong, high), 1 (medium) or 0 (weak, low) - and a soft one (level -1) for a subdivision. */
    click(when, level = 0) {
      if (!ctx || paused || muted || ctx.state === "closed") return;
      const t = Math.max(when, ctx.currentTime), f = [880, 1175, 1568, 660][level === -1 ? 3 : level], o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level === -1 ? 0.1 : 0.32, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.09);
    },
    /** A short thud for the reader's own tap on the rhythm pad. */
    thud(when) {
      if (!ctx || paused || muted || ctx.state === "closed") return;
      const t = Math.max(when, ctx.currentTime), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(95, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.36, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.15);
    },
    /** Plays [{ t (seconds after `start`), midi, dur, vel }] and returns the time it all ends. */
    play(events, start = this.at()) {
      let last = start;
      for (const e of events) last = Math.max(last, this.note(e.midi, start + e.t, e.dur, e.vel ?? 0.8, e.hz) || start + e.t);
      return last;
    },
    /** Stops what sounds now (a new question, a page that goes away). */
    silence() {
      if (!ctx) return;
      for (const v of voices) steal(v);
      voices = [];
    },
    /** The page stands still (a menu, a hidden tab): the clock stops, so nothing scheduled sounds late. */
    pause() { paused = true; if (ctx && ctx.state === "running") ctx.suspend?.()?.then?.(emit, () => {}); stopKeep(); emit(); },
    resume() { paused = false; if (ctx && ctx.state !== "running" && ctx.state !== "closed") ctx.resume?.()?.then?.(emit, () => {}); emit(); },
    get paused() { return paused; },
  };
  /** A voice let go at once (10 ms fade): its gain falls from where it is. */
  function steal(v) {
    try {
      const t = ctx.currentTime;
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setTargetAtTime(0.0001, t, 0.008);
      v.o.stop(t + 0.06);
    } catch { /* already stopped */ }
  }
  /** iOS before 17 mutes Web Audio on the ringer switch unless an audio element is playing: a silent clip made here, in memory. */
  function keepAwake() {
    if (keep || typeof document === "undefined" || typeof Audio === "undefined" || globalThis.navigator?.audioSession) return;
    try {
      const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
      const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
      a.loop = true; a.volume = 0.01; a.setAttribute("playsinline", "");
      a.play().catch(() => {});
      keep = a;
    } catch { /* no audio element */ }
  }
  function stopKeep() { try { keep?.pause(); } catch { /* gone */ } keep = null; }
  return api;
}
