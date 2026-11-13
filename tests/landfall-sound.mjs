// Landfall's sea (landfall-sound.js): the region a latitude lies in, that every bird and beast a region names has a call, that every
// call can be made against a Web Audio that only keeps count (and stays quiet: no single peak above 0.2), and that a muted
// page makes no audio context at all. How it sounds is not tested: nobody has heard it. Run: node tests/landfall-sound.mjs
const made = { contexts: 0, peak: 0, nodes: 0 };
class Param {
  constructor(v = 0, gain = false) { this.value = v; this.gain = gain; }       // only a gain's values count towards the peak
  see(v) { if (this.gain) made.peak = Math.max(made.peak, Math.abs(v)); return this; }
  setValueAtTime(v) { return this.see(v); }
  linearRampToValueAtTime(v) { return this.see(v); }
  exponentialRampToValueAtTime(v) { return this.see(v); }
  setTargetAtTime() { return this; }
}
class Node { connect(n) { return n; } disconnect() {} }
class FakeContext {
  constructor() { made.contexts++; this.state = "running"; this.currentTime = 10; this.sampleRate = 44100; this.destination = new Node(); }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
  createGain() { const n = new Node(); n.gain = new Param(1, true); return n; }
  createBuffer(ch, n) { return { length: n, getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { const n = new Node(); n.playbackRate = new Param(1); n.start = () => made.nodes++; n.stop = () => {}; return n; }
  createOscillator() { const n = new Node(); n.frequency = new Param(); n.start = () => made.nodes++; n.stop = () => {}; return n; }
  createBiquadFilter() { const n = new Node(); n.frequency = new Param(); n.Q = new Param(); return n; }
  createDynamicsCompressor() { const n = new Node(); for (const k of ["threshold", "ratio", "attack", "release"]) n[k] = new Param(); return n; }
}
globalThis.window = { AudioContext: FakeContext };
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const { sound, REGIONS, CALLS, regionFor } = await import("../landfall-sound.js");
const { LEVELS } = await import("../landfall-levels.js");

check(regionFor(56) === "grey" && regionFor(40) === "temperate" && regionFor(10) === "trade" && regionFor(-20) === "trade" && regionFor(-35) === "temperate" && regionFor(-50) === "southern", "a latitude lies in the region its water is");
check(LEVELS.every(l => REGIONS[regionFor(l.origin.lat)]), "every level's origin is in a region that exists");
for (const [id, r] of Object.entries(REGIONS)) for (const t of [r.day, r.night]) check(Object.keys(t).every(k => typeof CALLS[k] === "function"), `${id}: every sound it names has a call`);

// muted (the default): nothing is made
sound.place(56); sound.conditions("storm"); sound.day(true); sound.bed(true); sound.unlock(); sound.bell(2); sound.mark();
check(made.contexts === 0, "while muted no audio context is made, whatever the page asks");

// unmuted: every call can be made, and none is loud
sound.setMuted(false); sound.unlock();
check(made.contexts === 1, "the first unmuted tap makes the one context");
made.peak = 0;
for (const [k, f] of Object.entries(CALLS)) {
  const before = made.nodes;
  f(new FakeContext(), 10);
  check(made.nodes > before, `${k}: makes a sound`);
}
check(made.peak <= 0.2, `no single call peaks above 0.2 (loudest ${made.peak.toFixed(3)})`);
// the bow wave and the rigging: a surge as the bow dips, quiet, and not two within three seconds
sound.weather(1); made.peak = 0;
let before = made.nodes; sound.surge(1);
const once = made.nodes - before; before = made.nodes; sound.surge(1);
check(once > 0 && made.nodes === before, "the bow's dip makes a surge, and the next dip so soon after makes none");
check(made.peak <= 0.2, `the surge stays quiet (loudest ${made.peak.toFixed(3)})`);
made.peak = 0; before = made.nodes; sound.lead(23); const cast = made.nodes - before; before = made.nodes; sound.lead(null);
check(cast > 20 && made.nodes - before > cast && made.peak <= 0.2, `the lead splashes and runs its line out, longer when it finds no bottom, and stays quiet (loudest ${made.peak.toFixed(3)})`);
sound.setMuted(true);
process.exit(bad ? 1 : 0);
