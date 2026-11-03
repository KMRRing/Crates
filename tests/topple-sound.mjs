// Topple's sound (topple-sound.js) against a Web Audio that only keeps count: nothing is made before a gesture or while the
// sound is off, a fall's sounds are scheduled on the audio clock (never in the past, evenly along a long chain, those within
// 25 ms one louder sound), a context a phone has shut ("suspended", or "interrupted" when the page was away) is asked to
// run again at the next touch, and the menu holds it still. How it sounds is not tested: nobody has heard it. Run: node tests/topple-sound.mjs
const made = { contexts: 0, nodes: [], resumed: 0, suspended: 0, silent: 0 };
let allow = false;            // whether the "phone" lets the context run when asked
class Param {
  constructor(v = 0) { this.value = v; this.peak = 0; }
  setValueAtTime(v) { this.peak = Math.max(this.peak, v); return this; }
  exponentialRampToValueAtTime(v) { this.peak = Math.max(this.peak, v); return this; }
}
class Node { connect(n) { return n; } }
class FakeContext {
  constructor() { made.contexts++; made.last = this; this.state = "suspended"; this.currentTime = 10; this.sampleRate = 44100; this.destination = new Node(); }
  resume() { made.resumed++; if (allow) this.state = "running"; return Promise.resolve(); }
  suspend() { made.suspended++; this.state = "suspended"; return Promise.resolve(); }
  createGain() { const n = new Node(); n.gain = new Param(1); return n; }
  createBuffer(channels, n) { return { length: n, getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { const n = new Node(); n.kind = "noise"; n.start = (t = 0) => { n.at = t; made.nodes.push(n); }; n.stop = t => { n.until = t; }; return n; }
  createOscillator() { const n = new Node(); n.kind = "tone"; n.frequency = new Param(); n.start = (t = 0) => { n.at = t; made.nodes.push(n); }; n.stop = t => { n.until = t; }; return n; }
  createBiquadFilter() { const n = new Node(); n.frequency = new Param(); n.Q = new Param(); return n; }
  createDynamicsCompressor() { const n = new Node(); made.compressor = (made.compressor || 0) + 1; for (const k of ["threshold", "ratio", "attack", "release"]) n[k] = new Param(); return n; }
  createStereoPanner() { const n = new Node(); n.pan = new Param(); return n; }
}
globalThis.StereoPannerNode = class {};
globalThis.window = { AudioContext: FakeContext };

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const { sound } = await import("../topple-sound.js");
const reset = () => { made.nodes.length = 0; };

// ---------- nothing before a gesture, nothing while it is off ----------
check(made.contexts === 0, "importing the sound makes no audio context (an iPhone would hold it shut, and a page that never plays pays for nothing)");
sound.on = false;
sound.unlock(); sound.play("clack"); sound.run([{ kind: "clack", at: 0.1 }]);
check(made.contexts === 0 && made.nodes.length === 0, "with the Sound switch off nothing is made at all, a tap or a fall");
check(sound.on === false, "the switch reads back as it was set");

// ---------- the first touch opens it, and a shut context is asked again until it runs ----------
sound.on = true;
sound.unlock();
check(made.contexts === 1 && made.resumed === 1, "the first touch makes the context and asks it to run");
const silent = () => made.nodes.filter(n => n.kind === "noise" && n.until === undefined).length;   // the opening buffer is started and never stopped
const before = silent();
sound.unlock(); sound.unlock();
check(made.resumed === 3 && silent() === before + 2, "a context the phone has not opened yet is asked again, with its silent buffer, at each touch (an iPhone opens it at the end of one, not the start)");
allow = true;
sound.unlock();
const opened = made.resumed, played = silent();
sound.unlock(); sound.unlock();
check(made.last.state === "running" && made.resumed === opened && silent() === played && made.contexts === 1, "once it runs, a touch asks no more and makes no second context");

// ---------- a fall is scheduled on the audio clock ----------
reset();
const chain = [];
for (let k = 0; k < 40; k++) { chain.push({ kind: "clack", at: 0.03 + k * 0.098, power: 0.62, pitch: 1, pan: (k - 20) / 20 }); chain.push({ kind: "land", at: 0.03 + k * 0.098 + 0.26, power: 0.5, pitch: 1, pan: (k - 20) / 20 }); }
sound.run(chain);
const tones = made.nodes.filter(n => n.kind === "tone"), noises = made.nodes.filter(n => n.kind === "noise");
check(noises.length === 80 && tones.length === 40 * 2 + 40, `forty clacks and forty landings are 80 noise bursts and 120 tones, none lost or doubled (${noises.length} and ${tones.length})`);
const NOW = 10;
check(made.nodes.every(n => n.at >= NOW), "nothing is scheduled in the past of the audio clock");
check(made.nodes.every(n => n.until > n.at && n.until - n.at < 0.5), "every burst and tone has its stop after its start, and none runs on long");
const bursts = noises.map(n => n.at).sort((a, b) => a - b), gaps = bursts.slice(1).map((t, i) => t - bursts[i]);
check(Math.max(...gaps) < 0.2 && made.nodes.every(n => n.at < NOW + 5), "the sounds of a long chain follow one another a tenth of a second apart, none seconds after the rest");
check(made.compressor === 1, "a compressor sits before the speakers, one for the page, so a run of clacks does not clip");

// ---------- many at once are one louder sound ----------
reset();
sound.run([{ kind: "clack", at: 0.5, power: 0.6 }, { kind: "clack", at: 0.51, power: 0.6 }, { kind: "clack", at: 0.512, power: 0.6 }, { kind: "clack", at: 0.9, power: 0.6 }]);
check(made.nodes.filter(n => n.kind === "noise").length === 2, "three clacks within 25 ms are one (a fork or a cone of dominoes is not a racket), a later one is another");
reset();
sound.run([{ kind: "clack", at: 0.5, power: 0.6 }, { kind: "land", at: 0.5, power: 0.6 }]);
check(made.nodes.filter(n => n.kind === "noise").length === 2, "a clack and a landing at the same moment stay two sounds");

// ---------- every voice makes something and ends ----------
for (const kind of ["clack", "land", "tap", "shove", "ring"]) {
  reset();
  sound.play(kind, { power: 0.6 });
  check(made.nodes.length > 0 && made.nodes.every(n => n.until > n.at && n.until - n.at < 1.5), `${kind}: makes sounds, and each ends within a second and a half`);
}
reset();
sound.play("nonesuch");
check(made.nodes.length === 0, "an unknown sound is nothing, not an error");

// ---------- the menu holds it still; a phone that shut it is asked again ----------
{
  const s0 = made.suspended, r0 = made.resumed;
  sound.hold();
  check(made.suspended === s0 + 1, "the menu opening holds the sound still");
  sound.release();
  check(made.resumed === r0 + 1, "and closing it lets it go on");
  sound.on = false;
  sound.hold(); sound.release();
  const r1 = made.resumed;
  sound.release();
  check(made.resumed === r1, "with the Sound switch off nothing is resumed behind its back");
  sound.on = true;
}
{
  // the page was away and an iPhone "interrupted" the context: the next sound asks it to run
  made.last.state = "interrupted";
  const r0 = made.resumed;
  sound.play("tap");
  check(made.resumed > r0, "a context the phone interrupted is asked to run before a sound");
  made.last.state = "suspended";
  const r1 = made.resumed;
  sound.play("tap");
  check(made.resumed > r1, "and one that is suspended too");
}

console.log(bad ? `${bad} problems` : "topple sound: every check passed");
if (bad) process.exitCode = 1;
