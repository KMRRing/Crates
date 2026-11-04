// Courier's sound: every event the engine emits makes a sound (EVENTS) or is deliberately silent (SILENT), so a new event cannot be forgotten;
// and the synthesis runs end to end on a stand-in for Web Audio (a typo in a voice shows here, not on Korbi's phone).
import { readFileSync } from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// A stand-in for the Web Audio graph: any node accepts any call, and connect() hands back a node.
const node = () => new Proxy(function () {}, {
  get: (t, k) => (k in t ? t[k] : k === "getChannelData" ? (() => new Float32Array(8)) : typeof k === "symbol" || k === "then" ? undefined : (t[k] = node())),
  set: (t, k, v) => { t[k] = v; return true; },
  apply: () => node(),
});
let made = 0, vib = [], now = null;
class Ctx {
  constructor() { this.state = "running"; this.currentTime = 100; now = this; this.sampleRate = 8000; this.destination = node(); }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { made++; return node(); } createOscillator() { made++; return node(); }
  createGain() { return node(); } createBiquadFilter() { return node(); } createDynamicsCompressor() { return node(); } createStereoPanner() { return node(); }
}
globalThis.AudioContext = Ctx;
globalThis.StereoPannerNode = class {};
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener: () => {} };
Object.defineProperty(globalThis, "navigator", { value: { vibrate: p => { vib.push(p); return true; } }, configurable: true });

const sound = await import("../reckoning-sound.js");
const src = readFileSync(new URL("../reckoning-engine.js", import.meta.url), "utf8");
const emitted = [...new Set([...src.matchAll(/\{ type: "(\w+)"/g)].map(m => m[1]))];
check(emitted.length > 20, `found ${emitted.length} events in the engine`);
for (const t of emitted) check(!!sound.EVENTS[t] !== sound.SILENT.includes(t), `${t}: ${sound.EVENTS[t] ? "has a sound" : sound.SILENT.includes(t) ? "silent on purpose" : "NEITHER mapped nor listed silent"}`);
for (const t of [...Object.keys(sound.EVENTS), ...sound.SILENT]) check(emitted.includes(t), `${t} is still an event the engine emits`);

// before the first touch nothing is made; the haptics still go
sound.cue({ type: "hurt" });
check(made === 0, "no sound before the first gesture");
check(vib.length === 1, "a hit vibrates even before audio is unlocked");
const samples = [
  { type: "jump" }, { type: "jump", air: true }, { type: "lane", dir: 1 }, { type: "lunge", dir: -1, how: "side" }, { type: "dive", slam: true }, { type: "roll" },
  { type: "land", slam: true, v: 20 }, { type: "land", v: 30 }, { type: "land", v: 3 }, { type: "shockwave", n: 2 },
  ...["gull", "crab", "barrel", "balloon"].flatMap(kind => [{ type: "kill", id: 7, kind, how: "up" }, { type: "kill", id: 8, kind, how: "slam" }, { type: "kill", id: 9, kind, how: "crash" }, { type: "wind", kind, lane: 1 }, { type: "launch", kind, lane: -1 }]),
  { type: "stagger", id: 5 }, { type: "kill", id: 5, kind: "crab", how: "up" }, { type: "clang" },
  { type: "pick", what: "coin" }, { type: "pick", what: "coin" }, { type: "pick", what: "gem" }, { type: "pick", what: "token" }, { type: "coins", n: 3 },
  { type: "heart" }, { type: "heart", gem: true }, { type: "seized" }, { type: "hurt" }, { type: "fall" },
  { type: "answer", ok: true }, { type: "answer", ok: false }, { type: "answer", ok: null },
  { type: "walljump" }, { type: "wallrun", side: 1 }, { type: "pad" }, { type: "finish", won: true }, { type: "finish", won: false },
];
// the stand-in context starts only once unlocked: drive the module's own handler through a fake gesture
let handler = null;
globalThis.addEventListener = (e, f) => { handler = f; };
sound.unlock();
globalThis.removeEventListener = () => {};
handler();
vib = [];
for (const ev of samples) {
  try { sound.cue({ ...ev }); } catch (e) { check(false, `${ev.type} ${ev.kind || ""} threw ${e.message}`); }
  made += 0;
}
check(made > 40, `the samples made voices (${made})`);
check(vib.length === 5, `a hit, a seized goods, a fall and two wrong answers vibrate (${vib.length})`);
sound.setHaptics(false); vib = []; sound.cue({ type: "hurt" });
check(vib.length === 0, "haptics off: no vibration");

// footsteps: nothing while not live, steps tied to distance run once live; the bed starts and stops with setLive
made = 0;
sound.feet(1, 12, true);
check(made === 0, "no footsteps while paused or over");
sound.setLive(true);
const m0 = made;
now.currentTime = 200;
for (let i = 0; i < 120; i++) { now.currentTime += 1 / 60; sound.feet(1 / 60, 12, true); }       // 2 s at 12 m/s: 24 m, a step every 3.3 m
check(made - m0 >= 14 && made - m0 <= 32, `about seven steps in two seconds (${(made - m0) / 2} voices)`);
const m1 = made;
for (let i = 0; i < 120; i++) sound.feet(1 / 60, 12, false);
check(made === m1, "no footsteps in the air");
sound.setLive(false);
const m2 = made;
sound.feet(1, 12, true);
check(made === m2, "no footsteps once stopped");
sound.setOn(false);
check(true, "sound off does not throw");
sound.setOn(true);
sound.sample(); sound.biome();
process.exit(bad ? 1 : 0);
