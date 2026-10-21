// Timegrapher (timegrapher-dsp.js, timegrapher-measure.js) on synthetic watches (tests/timegrapher-synth.js): a
// lever escapement's beats, three noises each, tick and tock unalike, in a room with hum, hiss and pink noise, a
// level that drifts, knocks and voices. At 44.1 and 48 kHz, at every standard beat rate, the measuring must find
// the rate (vph), the rate in s/d within a quarter of a second a day, the beat error within 0.05 ms and the amplitude
// within 8°; say "nothing" for a room with no watch in it and for a buzz, "quartz" for a quartz watch's one step a
// second; find the Monolithic's 288,000 (rate only); keep its head in a noisy room, with knocks and voices; and the
// chunked signal chain must give what one block gives.
import { synthWatch, synthRoom, synthQuartz } from "./timegrapher-synth.js";
import { createChain, envelopeOf, BAND } from "../timegrapher-dsp.js";
import { measure, detect, fitBeats, amplitudeOf, liftTimeOf, STANDARD } from "../timegrapher-measure.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const f2 = v => (v == null ? "—" : v.toFixed(2));
const run = (synth, fs, opts) => { const { env, fe } = envelopeOf(synth.x, fs); return measure(env, fe, opts); };

// ---------- the chain ----------
{
  const { x } = synthWatch({ secs: 3, seed: 2 });
  const whole = envelopeOf(x, 48000).env, c = createChain(48000), parts = [];
  for (let i = 0; i < x.length; i += 1000 + (i % 7) * 37) parts.push(c.push(x.subarray(i, Math.min(x.length, i + 1000 + (i % 7) * 37))));
  const joined = Float32Array.from(parts.flatMap(p => [...p]));
  let worst = 0;
  for (let i = 0; i < whole.length; i++) worst = Math.max(worst, Math.abs(whole[i] - joined[i]));
  check(joined.length === whole.length && worst < 1e-6, `chunks of any length give what one block gives (${joined.length} of ${whole.length}, worst ${worst.toExponential(1)})`);
  check(BAND.hp === 3000 && BAND.lp === 12000, "the band is 3 to 12 kHz");
}

// ---------- the formulas ----------
{
  const T = 2 * 3600 / 21600;                                         // 21,600 vph: a full oscillation is a third of a second
  const dt = liftTimeOf(52, 280, T);
  check(Math.abs(amplitudeOf(52, dt, T) - 280) < 1e-9, `amplitude and lift time are each other's inverse (${(dt * 1000).toFixed(2)} ms at 280°, 52°, 21,600)`);
  check(Math.abs(amplitudeOf(52, 0.0092, 0.3333) - 52 / (2 * Math.sin(Math.PI * 0.0092 / 0.3333))) < 1e-9, "A = λ / (2 sin(π t / T))");
  const beats = Array.from({ length: 200 }, (_, k) => ({ k, t: 100 + k * 2000.5 + (k & 1 ? 3 : 0) + (k === 50 ? 400 : 0) }));
  const f = fitBeats(beats);
  check(f && Math.abs(f.P - 2000.5) < 1e-6 && Math.abs(f.d - 3) < 1e-6 && f.used === 199, "the fit finds the period and the tock's offset, and a knocked beat counts for nothing");
}

// ---------- every standard rate, at both sample rates ----------
const cases = [
  [14400, 2.5, 0.5, 250], [18000, 12, 0.8, 260], [19800, -3, 0.3, 270], [21600, 4, 0.4, 280],
  [25200, 1.5, 0.3, 275], [28800, -6, 0.2, 300], [36000, 1, 0.15, 290],
];
for (const fs of [44100, 48000]) {
  let vphOk = 0, rateOk = 0, beOk = 0, ampOk = 0, worstRate = 0, worstBe = 0, worstAmp = 0;
  for (const [vph, rate, be, amp] of cases) {
    const m = run(synthWatch({ fs, vph, rate, be, amp, secs: 20, seed: vph + fs, noise: 0.004, hiss: 0.0008, tock: 0.65 }), fs, { lift: 52 });
    if (m.ok && m.vph === vph) vphOk++;
    const dr = Math.abs((m.rate ?? 99) - rate), db = Math.abs((m.be ?? 99) - be), da = Math.abs((m.amp ?? 999) - amp);
    worstRate = Math.max(worstRate, dr); worstBe = Math.max(worstBe, db); worstAmp = Math.max(worstAmp, da);
    if (dr < 0.25) rateOk++;
    if (db < 0.05) beOk++;
    if (da < 8) ampOk++;
  }
  check(vphOk === cases.length, `${fs / 1000} kHz: the vph found at every standard rate (${vphOk} of ${cases.length})`);
  check(rateOk === cases.length, `${fs / 1000} kHz: rate within 0.25 s/d at every rate (worst ${f2(worstRate)})`);
  check(beOk === cases.length, `${fs / 1000} kHz: beat error within 0.05 ms (worst ${worstBe.toFixed(3)})`);
  check(ampOk === cases.length, `${fs / 1000} kHz: amplitude within 8° (worst ${worstAmp.toFixed(1)})`);
}

// ---------- the hard cases ----------
{
  const quiet = run(synthWatch({ vph: 28800, rate: 2, be: 0.3, tock: 0.3, secs: 20, seed: 11 }), 48000, { lift: 52 });
  check(quiet.ok && quiet.vph === 28800 && Math.abs(quiet.rate - 2) < 0.25, `a tock a third as loud as its tick: still 28,800, not 14,400 (${quiet.vph}, ${f2(quiet.rate)} s/d)`);
  const room = run(synthWatch({ vph: 21600, rate: 4, be: 0.4, secs: 30, seed: 12, noise: 0.02, hiss: 0.003, knocks: 4, voices: 2 }), 48000, { lift: 52 });
  check(room.ok && room.vph === 21600 && Math.abs(room.rate - 4) < 0.3 && Math.abs(room.be - 0.4) < 0.1,
    `a noisy room, four knocks and two voices: ${f2(room.rate)} ± ${f2(room.rateErr)} s/d, ${room.be?.toFixed(2)} ms, ${Math.round((room.kept ?? 0) * 100)}% of beats`);
  const talk = run(synthWatch({ vph: 21600, rate: -2, be: 0.3, secs: 30, seed: 13, voices: 3 }), 48000, { lift: 52 });
  check(talk.ok && Math.abs(talk.rate + 2) < 0.25, `someone talking over a quiet watch: ${f2(talk.rate)} s/d`);
  const knock = run(synthWatch({ vph: 28800, rate: 7, be: 0.2, secs: 20, seed: 14, knocks: 6 }), 48000, { lift: 52 });
  check(knock.ok && Math.abs(knock.rate - 7) < 0.25, `six knocks on the table: ${f2(knock.rate)} s/d`);
  const wander = run(synthWatch({ vph: 21600, rate: 10, be: 0.5, secs: 30, seed: 15, wander: 1.5, jitter: 3e-5 }), 48000, { lift: 52 });
  check(wander.ok && Math.abs(wander.rate - 10) < 4 * wander.rateErr + 0.3, `a rate that wanders ±1.5 s/d: ${f2(wander.rate)} ± ${f2(wander.rateErr)}, the truth inside its uncertainty`);
  const fast = run(synthWatch({ vph: 28800, rate: 240, be: 1.2, secs: 20, seed: 16 }), 48000, { lift: 52 });
  check(fast.ok && Math.abs(fast.rate - 240) < 0.5 && Math.abs(fast.be - 1.2) < 0.1, `a magnetised watch, +240 s/d and 1.2 ms out of beat: ${f2(fast.rate)}, ${fast.be?.toFixed(2)} ms`);
}

// ---------- the Monolithic, quartz, and nothing ----------
{
  const mono = run(synthWatch({ vph: 288000, rate: 1.5, be: 0, secs: 20, seed: 21, unlock: 0, impulse: 0, level: 0.02 }), 48000, { lift: null, flexure: true });
  check(mono.ok && mono.vph === 288000 && Math.abs(mono.rate - 1.5) < 0.25 && mono.amp == null, `the Monolithic's 40 Hz found, rate only: ${f2(mono.rate)} s/d`);
  const quartz = run(synthQuartz({ secs: 16 }), 48000, {});
  check(!quartz.ok && quartz.why === "quartz", "a quartz watch's one step a second is quartz, not a reading");
  const empty = [synthRoom({ secs: 15, seed: 31 }), synthRoom({ secs: 15, seed: 32, knocks: 4, voices: 3 }), synthRoom({ secs: 15, seed: 33, noise: 0.03, hiss: 0.004 })];
  check(empty.every(s => run(s, 48000, {}).ok === false && run(s, 48000, {}).why === "nothing"), "a quiet room, a busy room and a loud one with no watch: nothing");
  const buzz = [synthRoom({ secs: 15, buzz: 0.01 }), synthRoom({ secs: 15, buzz: 0.01, mains: 60 })];
  check(buzz.every(s => run(s, 48000, {}).ok === false), "a lamp's buzz at 50 or 60 Hz is not a watch");
  const lost = run(synthWatch({ vph: 21600, secs: 20, seed: 34, noise: 0.06, hiss: 0.008 }), 48000, { lift: 52 });
  check(!lost.ok, `a watch lost in the noise gives no number (${lost.why})`);
  const forced = run(synthWatch({ vph: 21600, rate: 3, secs: 15, seed: 35 }), 48000, { vph: 28800 });
  check(!forced.ok, "a vph set by hand that the watch doesn't beat finds nothing");
  const right = run(synthWatch({ vph: 21600, rate: 3, secs: 15, seed: 35 }), 48000, { vph: 21600, lift: 52 });
  check(right.ok && Math.abs(right.rate - 3) < 0.25, `a vph set by hand that it does: ${f2(right.rate)} s/d`);
  const short = run(synthWatch({ secs: 2 }), 48000, {});
  check(!short.ok && short.why === "short", "two seconds is too short");
  check(STANDARD.includes(288000) && STANDARD.includes(21600) && STANDARD.length === 8, "the standard rates");
  const d = detect(envelopeOf(synthWatch({ vph: 19800, secs: 12, seed: 36 }).x, 48000).env, 12000);
  check(d.vph === 19800, "detect alone names 19,800");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("timegrapher: rate, beat error, amplitude and vph from synthetic watches; nothing from a room");
