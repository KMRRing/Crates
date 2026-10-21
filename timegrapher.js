// Timegrapher: a mechanical watch on the phone's microphone, or a recording of one, measured as a watchmaker's
// timegrapher measures it: its rate (s/d), beat error (ms) and amplitude (degrees, roughly), with the dot trace.
// The signal chain is timegrapher-dsp.js's, the measuring timegrapher-measure.js's (both tested in Node), the
// microphone's tap timegrapher-worklet.js on the audio thread, the drawing timegrapher-trace.js's; this file listens,
// keeps the readings and draws the page.
import { createChain, bandLevel } from "./timegrapher-dsp.js";
import { measure, MANUAL } from "./timegrapher-measure.js";
import { createTrace } from "./timegrapher-trace.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { busy } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "timegrapher:opts", READINGS = "timegrapher:readings";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const WINDOW = 60;            // s: the live figures come from the last minute heard
const KEEP = 120;             // s: the most of a reading kept (a stop measures all of it)
const EVERY = 1;              // s of sound between live measurings
const SPAN = 20;              // s across the trace
const PHONE = 1.7;            // s/d: a phone's own clock, ±20 ppm, under every rate it measures

let opts = { vph: null, lift: 52, ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);
const readings = () => read(READINGS, []);

// ---------- the reading in progress ----------
// The envelope as it comes (chunks of the signal chain's output), the clock in envelope samples since the reading
// began, and the trace's anchor: the first tick heard and the period then, so every beat keeps its number.
let R = null;
function freshReading(fs, src) {
  R = { fs, src, chains: null, chain: null, fe: fs / 4, chunks: [], len: 0, dropped: 0, last: 0, busy: false, known: null, anchor: null, result: null, frame: null, at: Date.now(), levels: [0, 0] };
}
/** The last `secs` of the reading's envelope, and where it starts (envelope samples since the reading began). */
function envelope(secs) {
  const want = Math.min(R.len, Math.round(secs * R.fe)), out = new Float32Array(want);
  let at = want;
  for (let i = R.chunks.length - 1; i >= 0 && at > 0; i--) {
    const c = R.chunks[i], take = Math.min(at, c.length);
    out.set(c.subarray(c.length - take), at - take);
    at -= take;
  }
  return { env: out, from: R.dropped + R.len - want };
}
function append(env) {
  if (!env.length) return;
  R.chunks.push(env);
  R.len += env.length;
  const max = Math.round(KEEP * R.fe);
  while (R.len - R.chunks[0].length >= max) { R.len -= R.chunks[0].length; R.dropped += R.chunks.shift().length; }
}

// ---------- listening ----------
let audio = null, stream = null, source = null, node = null, workletReady = false, listening = false, lock = null;
async function listen() {
  if (IN_FRAME || listening) return;
  const ok = navigator.mediaDevices?.getUserMedia;
  if (!ok) { say("Listening needs the app opened from its own address (https).", "bad"); return; }
  try {
    audio ??= new AudioContext();
    const resumed = audio.resume();              // in the tap itself: iOS starts a page's sound only from one
    if (!audio.audioWorklet) { say("This browser can't listen: an iPhone needs iOS 14.5 or newer.", "bad"); return; }
    setListening(true, "Asking for the microphone…");
    // the phone's voice processing off: echo cancelling, noise suppression and level control all smear a tick
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 1 } } });
    await resumed;
    if (!workletReady) { await audio.audioWorklet.addModule("timegrapher-worklet.js"); workletReady = true; }
    source = audio.createMediaStreamSource(stream);
    node = new AudioWorkletNode(audio, "tg-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    node.port.onmessage = e => feed(e.data);
    source.connect(node).connect(audio.destination);        // it writes silence: connected so the graph runs it
    const track = stream.getAudioTracks()[0];
    track?.addEventListener("ended", () => stop("The microphone was taken away: stopped."));
    const set = track?.getSettings?.() || {};
    R = null;
    freshReading(audio.sampleRate, "mic");
    R.processing = set.echoCancellation === true || set.noiseSuppression === true || set.autoGainControl === true;
    awake(true);
    say(R.processing ? "The phone kept its voice processing on: readings may be poorer." : "Listening: press the case back to the microphone.");
    draw();
  } catch (e) {
    teardown();
    setListening(false);
    const why = e?.name === "NotAllowedError" ? "The microphone was refused: allow it for this site in the phone's settings, then Listen again."
      : e?.name === "NotFoundError" ? "There's no microphone here." : `The microphone wouldn't start (${e?.message || e}).`;
    say(why, "bad");
  }
}
function teardown() {
  try { source?.disconnect(); node?.disconnect(); } catch { /* already gone */ }
  if (node) node.port.onmessage = null;
  stream?.getTracks().forEach(t => t.stop());
  stream = source = node = null;
  awake(false);
}
/** Stops listening; the whole reading is measured once more and kept if it heard the watch. */
function stop(why = "") {
  if (!listening) return;
  teardown();
  setListening(false);
  const res = R && R.len ? finalMeasure() : null;
  if (res?.ok && res.secs >= 8) {
    keep(res, "mic");
    show(res);
    say(`${why ? `${why} ` : ""}Kept: ${rateText(res.rate)} s/d${res.be != null ? `, ${res.be.toFixed(1)} ms` : ""} over ${Math.round(res.secs)} s.`);
  } else say(why || (res ? whyText(res) : "Stopped."), why ? "bad" : "");
}
function setListening(on, text) {
  listening = on;
  $("listenBtn").textContent = on ? "Stop" : "Listen";
  $("listenBtn").setAttribute("aria-pressed", String(on));
  document.body.classList.toggle("tg-on", on);
  if (text) say(text);
}

/** A chunk from the microphone: through the signal chain (the better of two channels, chosen in the first second). */
function feed({ frame, ch }) {
  if (!R || !listening) return;
  if (R.frame != null && frame !== R.frame) {                 // a block lost: the beats' count is broken, so start again
    const keepSrc = R.src;
    freshReading(R.fs, keepSrc);
    say("A gap in the sound: starting the reading again.");
  }
  R.frame = frame + ch[0].length;
  if (!R.chain) {
    R.chains ??= ch.map(() => createChain(R.fs));
    const outs = ch.map((c, i) => R.chains[i].push(c));
    R.chains.forEach((c, i) => { R.levels[i] += c.level(); });
    R.pending = (R.pending || []).concat([outs]);
    if (R.pending.length * ch[0].length >= R.fs) {              // a second in: keep the channel that hears more
      const best = R.levels.length > 1 && R.levels[1] > R.levels[0] * 1.05 ? 1 : 0;
      R.chain = R.chains[best];
      for (const outs2 of R.pending) append(outs2[best] || outs2[0]);
      R.chains = R.pending = null;
      R.best = best;
    }
  } else append(R.chain.push(ch[R.best] || ch[0]));
  const now = (R.dropped + R.len) / R.fe;
  if (now - R.last >= EVERY && !R.busy) { R.last = now; R.busy = true; setTimeout(liveMeasure, 0); }
}
function liveMeasure() {
  if (!R) return;
  try {
    const { env, from } = envelope(WINDOW);
    const res = measure(env, R.fe, { vph: opts.vph, lift: opts.lift, known: R.known });
    res.from = from / R.fe;
    R.result = res;
    if (res.ok) R.known = res.found; else if (res.why === "nothing") R.known = null;
    show(res);
  } catch (e) { console.error(e); }
  R.busy = false;
}
function finalMeasure() {
  const { env, from } = envelope(KEEP);
  const res = measure(env, R.fe, { vph: opts.vph, lift: opts.lift });
  res.from = from / R.fe;
  return res;
}

// ---------- a recording ----------
async function openFile(file) {
  if (!file || IN_FRAME) return;
  if (listening) stop();
  const done = busy("Reading the recording");
  try {
    const bytes = await file.arrayBuffer();
    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 48000);
    let buf = null;
    try { buf = await ctx.decodeAudioData(bytes.slice(0)); }
    catch {
      // an iPhone video (.mov) Safari won't decode (WebKit bug 228971): its sound is the same AAC an .mp4 holds, so
      // try once more calling it one
      const b = new Uint8Array(bytes.slice(0));
      if (String.fromCharCode(...b.subarray(4, 12)) === "ftypqt  ") { b.set([0x6d, 0x70, 0x34, 0x32], 8); try { buf = await ctx.decodeAudioData(b.buffer); } catch { buf = null; } }
    }
    if (!buf) { say(/\.mov$/i.test(file.name) ? "Safari can't read the sound of this video: record a Voice Memo instead, or save the video as .mp4." : "This file's sound couldn't be read here.", "bad"); return; }
    const fs = buf.sampleRate, secs = Math.min(buf.duration, 150), n = Math.round(secs * fs);
    // the channel that hears the watch better
    let samples = buf.getChannelData(0).subarray(0, n);
    if (buf.numberOfChannels > 1) { const other = buf.getChannelData(1).subarray(0, n); if (bandLevel(other, fs) > bandLevel(samples, fs) * 1.05) samples = other; }
    freshReading(fs, "file");
    append(createChain(fs).push(samples));
    const res = finalMeasure();
    show(res);
    if (res.ok) { keep(res, "file", file.name); say(`${file.name}: ${rateText(res.rate)} s/d${res.be != null ? `, ${res.be.toFixed(1)} ms` : ""} over ${Math.round(res.secs)} s.`); }
    else say(`${file.name}: ${whyText(res)}`, "bad");
  } catch (e) {
    console.error(e);
    say("This file's sound couldn't be read here.", "bad");
  } finally { done(); }
}

// ---------- keeping ----------
function keep(res, src, name = null) {
  const list = readings();
  list.unshift({ at: Date.now(), src, name, vph: res.vph, rate: round(res.rate, 2), rateErr: round(res.rateErr, 2), be: res.be == null ? null : round(res.be, 2),
    amp: res.amp == null ? null : Math.round(res.amp), quality: round(res.quality, 2), secs: Math.round(res.secs), lift: opts.lift });
  write(READINGS, list.slice(0, 200));
}
const round = (v, d) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// ---------- drawing ----------
const rateText = r => `${r > 0.05 ? "+" : r < -0.05 ? "−" : "±"}${Math.abs(r).toFixed(Math.abs(r) < 10 ? 1 : 0)}`;
function whyText(res) {
  if (res.why === "quartz") return "A step a second: a quartz watch. A timegrapher has nothing to hear in one.";
  if (res.why === "short") return "Listening: a few seconds more.";
  if (res.why === "nothing") return "No beat heard yet: press the case back to the microphone, in a quiet room.";
  return "Not enough signal: closer to the microphone, or quieter round it.";
}
let trace = null;
function show(res) {
  const ok = res?.ok;
  $("rate").textContent = ok ? rateText(res.rate) : "—";
  $("rateSub").textContent = ok ? `s/d ±${Math.max(0.1, res.rateErr).toFixed(1)} · phone ±${PHONE}` : "s/d";
  $("be").textContent = ok && res.be != null ? res.be.toFixed(1) : "—";
  $("beSub").textContent = ok && res.be != null ? "ms" : ok ? "tock unheard" : "ms";
  const amp = ok && res.amp != null;
  $("amp").textContent = amp ? `≈${Math.round(res.amp)}°` : "—";
  $("ampSub").textContent = amp ? `rough · lift ${opts.lift}°` : ok ? "noises unclear" : "°";
  meter(res);
  if (listening && !ok) say(whyText(res));
  else if (listening && ok) say(`${res.vph.toLocaleString("en-GB")} vph${opts.vph ? " (set)" : ""} · ${Math.round(res.secs)} s · ${Math.round(res.kept * 100)}% of beats`);
  plot(res);
}
/** The signal meter: before a beat is found, how much louder the band's peaks are than its floor; after, how well
 *  the beats match their templates and how many do. */
function meter(res) {
  let bars = 0;
  if (res?.ok) bars = Math.max(1, Math.round(5 * Math.min(1, Math.max(0, (res.quality - 0.3) / 0.6)) * Math.min(1, res.kept / 0.9)));
  else if (R?.len) {
    const { env } = envelope(1);
    let pk = 0, sum = 0;
    for (const v of env) { pk = Math.max(pk, v); sum += v; }
    const crest = env.length ? pk / (sum / env.length || 1e-12) : 0;
    bars = crest > 12 ? 2 : crest > 6 ? 1 : 0;
  }
  $("meter").querySelectorAll("i").forEach((el, i) => el.classList.toggle("on", i < bars));
  $("meter").setAttribute("aria-label", `Signal ${bars} of 5`);
}
/** The trace's dots: each beat numbered from the reading's first tick at the period measured, its offset from a
 *  perfect watch at the nominal rate. */
function plot(res) {
  if (!trace) return;
  if (!res?.ok || !R) { trace.trace({ points: R?.anchor ? trace.lastPoints || [] : [], now: R ? (R.dropped + R.len) / R.fe : 0, span: SPAN, half: 2 }); return; }
  const Tn = 3600 / res.vph, P = res.period;
  const beats = res.beats.map(b => ({ ...b, abs: res.from + b.t }));
  if (!R.anchor || R.anchor.vph !== res.vph) {
    const first = beats.filter(b => !b.odd).sort((a, b) => a.abs - b.abs)[0] || beats[0];
    R.anchor = { t: first.abs, vph: res.vph };
  }
  const points = beats.map(b => {
    const n = Math.round((b.abs - R.anchor.t) / P);
    return { x: b.abs, y: -(b.abs - R.anchor.t - n * Tn) * 1000, tock: (n & 1) === 1, faint: b.c < 0.5 };
  });
  const half = [1, 2, 5, 10, 20].find(v => v >= 2.5 * ((res.be ?? 0) + 4 * res.sigma)) ?? 20;
  trace.lastPoints = points;
  trace.trace({ points, now: (R.dropped + R.len) / R.fe, span: SPAN, half });
  const t = res.templates;
  trace.beat({ a: t.a, b: t.b, fe: t.fe, W: t.W, noisesA: t.noisesA, noisesB: t.noisesB,
    label: res.amp != null ? `Lift ${(((t.noisesA.last - t.noisesA.first) / t.fe) * 1000).toFixed(1)} ms: ≈${Math.round(res.amp)}° at ${opts.lift}°` : "Tick and tock, averaged" });
}
function say(text, tone = "") {
  const el = $("line");
  el.textContent = text;
  el.classList.toggle("bad", tone === "bad");
}
function draw() {
  $("vphTag").textContent = opts.vph ? `${opts.vph.toLocaleString("en-GB")} vph` : "vph by ear";
  $("liftTag").textContent = `lift ${opts.lift}°`;
}

// ---------- the screen kept on while listening ----------
async function awake(on) {
  try {
    if (on && !lock && !document.hidden && navigator.wakeLock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); }
    else if (!on && lock) { await lock.release(); lock = null; }
  } catch { /* refused: battery saver */ }
}
// a phone that puts the page away stops its microphone: the reading ends there, kept if it heard enough
document.addEventListener("visibilitychange", () => { if (document.hidden && listening) stop("The page was put away:"); });

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action(listening ? "Stop" : "Listen", () => (listening ? stop() : listen()), "primary"), action("Open a recording", () => $("file").click()));
  const content = part(body, "content");
  content.append(choice("Beat rate (vph)", [["auto", "By ear"], ...MANUAL.map(v => [String(v), v.toLocaleString("en-GB")])], opts.vph ? String(opts.vph) : "auto", v => {
    opts.vph = v === "auto" ? null : Number(v); saveOpts(); draw(); if (R) R.known = null;
  }));
  content.append(choice("Lift angle", [38, 44, 49, 50, 51, 52, 53, 54].map(v => [String(v), `${v}°`]), String(opts.lift), v => { opts.lift = Number(v); saveOpts(); draw(); }));
  const list = readings();
  part(body, "about").append(line(list.length ? `${list.length} reading${list.length === 1 ? "" : "s"} kept; the last ${rateText(list[0].rate)} s/d, ${new Date(list[0].at).toLocaleDateString("en-GB")}.` : "No readings kept yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "timegrapher");
document.querySelector(".tg-mark").innerHTML = APPS.find(a => a.id === "timegrapher")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("listenBtn").addEventListener("click", () => (listening ? stop() : listen()));
$("openBtn").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; openFile(f); });
trace = createTrace($("trace"));
$("trace").addEventListener("click", () => { trace.view = trace.view === "trace" ? "beat" : "trace"; $("viewTag").textContent = trace.view === "trace" ? "Trace" : "Beat"; });
if (IN_FRAME) { $("listenBtn").disabled = true; $("openBtn").disabled = true; }
draw();
show(null);
say(IN_FRAME ? "Your partner's Timegrapher: the microphone is theirs." : "Listen, with the watch's case back on the microphone.");
window.__timegrapher = { get R() { return R; }, get opts() { return opts; }, measure, openFile, listen, stop, readings, trace: () => trace };
