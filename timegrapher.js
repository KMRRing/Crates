// Timegrapher: a mechanical watch on the phone's microphone, or a recording of one, measured as a watchmaker's
// timegrapher measures it: its rate (s/d), beat error (ms) and amplitude (degrees, roughly), with the dot trace; a
// session through the six positions, judged against COSC's and Witschi's limits; and the rate as worn, from taps
// against the phone's clock days apart; a library of the watches (a photo, a reference, words, the last service), each
// learning its own sound so a reading can say which it is (Which?), and how each is keeping over the months. The signal chain is timegrapher-dsp.js's, the measuring
// timegrapher-measure.js's, the verdicts and the keeping timegrapher-records.js's (all tested in Node), the calibres
// timegrapher-calibres.js's, the microphone's tap timegrapher-worklet.js on the audio thread, the drawing
// timegrapher-trace.js's; this file listens and draws the page.
import { createChain, bandLevel } from "./timegrapher-dsp.js";
import { measure, detect, MANUAL, QUARTZ } from "./timegrapher-measure.js";
import { createTrace } from "./timegrapher-trace.js";
import { CALIBRES, byId, DEFAULT_LIFT, SURE } from "./timegrapher-calibres.js";
import { fingerprint, learn, identify, health, STATUS } from "./timegrapher-library.js";
import { POSITIONS, summarise, verdict, isochronism, readingWords, tapOffset, wornRate, cleanWatches, cleanReading, cleanSession, signed } from "./timegrapher-records.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { dropdown } from "./dropdown.js";
import { IN_FRAME } from "./suite.js";
import { busy } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const WATCHES = "timegrapher:watches", OPTS = "timegrapher:opts", SESSION = "timegrapher:session", OLD = "timegrapher:readings", LIB = "timegrapher:lib";
const photoKey = id => `timegrapher:photo:${id}`;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n0 = v => v.toLocaleString("en-GB");

const WINDOW = 30;            // s: the live figures come from the last half minute heard (±0.05 s/d, a phone's work kept light)
const KEEP = 120;             // s: the most of a reading kept (a stop measures all of it)
const EVERY = 1;              // s of sound between live measurings
const SPAN = 20;              // s across the trace
const PHONE = 1.7;            // s/d: a phone's own clock, ±20 ppm, under every absolute rate it measures
const MIN_KEEP = 8;           // s of the watch heard before a stopped reading is kept

let opts = { length: 40, settle: 15, ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);

// ---------- the watches ----------
// Each watch has a name, a calibre (its vph and lift angle, timegrapher-calibres.js) or "by ear", and may set either
// by hand; and its readings, positions sessions and worn-rate log. The first time, Korbi's watches are there.
const AUTO = { id: "auto", name: "By ear", cal: "any watch", vph: null, lift: DEFAULT_LIFT, src: "The vph found by ear; the lift angle the timegraphers' default." };
const IDS = new Set([...CALIBRES.map(c => c.id), "auto"]);
const calOf = w => byId(w?.cal) || AUTO;
let W = loadWatches();
function loadWatches() {
  const raw = read(WATCHES, null);
  if (raw) return cleanWatches(raw, IDS);
  const seed = ["jlc-822", "jlc-858", "fc-810", "rado-r763", "fc-310"].map(id => ({ id, name: byId(id).name, cal: id }));
  seed.push({ id: "other", name: "Another watch", cal: "auto" });
  const w = cleanWatches({ current: "jlc-822", list: seed }, IDS);
  const old = read(OLD, null);                                 // the readings kept before watches had names
  if (Array.isArray(old)) w.list.find(x => x.id === "other").readings = old.map(cleanReading).filter(Boolean);
  write(WATCHES, w);
  if (old) write(OLD, null);
  return w;
}
const blank = (id, name, cal = "auto", extra = {}) => ({ id, name, cal, vph: null, lift: null, ref: "", desc: "", served: null, photo: null, print: null, readings: [], sessions: [], log: [], ...extra });
// The library came in October 2026: Korbi's watches given their references and words as he gave them, and his second
// Grande Reverso Ultra Thin (the same calibre and case: a photo and a reference tell them apart, and its sound is learnt)
if (!IN_FRAME && !read(LIB, false)) {
  const SEED = {
    "jlc-822": { ref: "Q2788520 (277.8.62)", desc: "Steel, silvered vertical guilloché dial. Cal. 822, hand-wound." },
    "jlc-858": { ref: "270.2.58", desc: "The 1998 Géographique in rose gold. Cal. 858, hand-wound." },
    "fc-810": { desc: "Steel. FC-810: a silicon oscillator at 40 Hz, no balance." },
    "rado-r763": { ref: "R27077312", desc: "Green dial. R763 (ETA C07.611), automatic, 80 hours, Nivachron hairspring." },
    "fc-310": { desc: "FC-310 (Sellita SW200-1), automatic." },
  };
  for (const w of W.list) { const s = SEED[w.id]; if (s) { w.ref ||= s.ref || ""; w.desc ||= s.desc; } }
  const guts = W.list.filter(w => w.cal === "jlc-822");
  if (guts.length === 1) W.list.splice(W.list.indexOf(guts[0]) + 1, 0, blank("jlc-822-b", "Grande Reverso Ultra Thin II", "jlc-822", { desc: "The second one: its reference and a photo tell it from the first." }));
  write(WATCHES, W);
  write(LIB, true);
}
const saveW = () => write(WATCHES, W);
/** What a watch beats, as far as is known: its own vph, else its calibre's, else null (by ear). */
const vphOf = w => (w.vph > 0 ? w.vph : w.vph === 0 ? null : calOf(w).vph ?? null);
const watch = () => W.list.find(w => w.id === W.current) || W.list[0];
/** What the current watch is listened for: its vph (or null, by ear), its lift angle, and what kind of oscillator. */
function setting() {
  const w = watch(), c = calOf(w);
  return { vph: w?.vph ?? c.vph ?? null, lift: c.flexure ? null : w?.lift ?? c.lift ?? DEFAULT_LIFT, flexure: !!c.flexure, coaxial: !!c.coaxial, quartz: !!c.quartz, cal: c };
}
const measureOpts = () => {
  if (ident) return { vph: null, lift: DEFAULT_LIFT, flexure: false };      // which watch: heard by ear, whatever is chosen
  const s = setting();
  return { vph: s.vph, lift: s.coaxial || s.flexure ? null : s.lift, flexure: s.flexure };
};
let ident = false;            // listening to say which watch it is (Which?)
const IDENT_SECS = 20;        // s of the watch heard before it says: enough for its beat error to a few hundredths of a ms

// ---------- the reading in progress ----------
// The envelope as it comes (the signal chain's output, in chunks), how much of it there has been, and the trace's
// anchor: the first tick heard, so every beat keeps its number while the window slides.
let R = null;
function freshReading(fs, src) {
  R = { fs, src, fe: fs / 4, chains: null, chain: null, best: 0, pending: null, levels: [0, 0], frame: null };
  restart();
}
/** Starts the reading over, keeping the microphone's channel and the signal chain. */
function restart() {
  Object.assign(R, { chunks: [], len: 0, dropped: 0, last: 0, busy: false, known: R?.known ?? null, anchor: null, result: null, at: Date.now(), asked: 0 });
}
const heard = () => (R ? (R.dropped + R.len) / R.fe : 0);
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
  if (IN_FRAME || listening) return listening;
  if (!ident && setting().quartz) { say("A quartz watch steps once a second from its crystal: there's no escapement for a timegrapher to hear.", "bad"); return false; }
  if (!navigator.mediaDevices?.getUserMedia) { say("Listening needs the app opened from its own address (https).", "bad"); return false; }
  try {
    audio ??= new AudioContext();
    const resumed = audio.resume();              // in the tap itself: iOS starts a page's sound only from one
    if (!audio.audioWorklet) { say("This browser can't listen: an iPhone needs iOS 14.5 or newer.", "bad"); return false; }
    R = null;                                    // the last reading is kept already: a stop while asking keeps nothing
    setListening(true, "Asking for the microphone…");
    // the phone's voice processing off: echo cancelling, noise suppression and level control all smear a tick
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 1 } } });
    await resumed;
    if (!workletReady) { await audio.audioWorklet.addModule("timegrapher-worklet.js"); workletReady = true; }
    if (!listening) { teardown(); return false; }             // stopped while the microphone was being asked for
    source = audio.createMediaStreamSource(stream);
    node = new AudioWorkletNode(audio, "tg-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    node.port.onmessage = e => feed(e.data);
    source.connect(node).connect(audio.destination);        // it writes silence: connected so the graph runs it
    const track = stream.getAudioTracks()[0];
    track?.addEventListener("ended", () => stop("The microphone was taken away:"));
    const got = track?.getSettings?.() || {};
    freshReading(audio.sampleRate, "mic");
    R.processing = got.echoCancellation === true || got.noiseSuppression === true || got.autoGainControl === true;
    awake(true);
    // a headset's microphone (Bluetooth earphones) samples at 16 or 24 kHz and filters for speech: no use for ticks
    const headset = got.sampleRate && got.sampleRate < 32000;
    say(headset ? "That's a headset's microphone: take the earphones off (or out of Bluetooth) and Listen again."
      : R.processing ? "The phone kept its voice processing on: readings may be poorer." : S ? stepWords() : "Listening: press the case back to the microphone.", headset ? "bad" : "");
    return true;
  } catch (e) {
    teardown();
    setListening(false);
    say(e?.name === "NotAllowedError" ? "The microphone was refused: allow it for this site in the phone's settings, then try again."
      : e?.name === "NotFoundError" ? "There's no microphone here." : `The microphone wouldn't start (${e?.message || e}).`, "bad");
    return false;
  }
}
function teardown() {
  try { source?.disconnect(); node?.disconnect(); } catch { /* already gone */ }
  if (node) node.port.onmessage = null;
  stream?.getTracks().forEach(t => t.stop());
  stream = source = node = null;
  awake(false);
}
/** Stops listening. Outside a session the whole reading is measured once more and kept if it heard the watch. */
function stop(why = "") {
  if (!listening) return;
  teardown();
  setListening(false);
  if (ident) { endIdentify(why); return; }
  if (S) { if (S.phase !== "place") { S.phase = "place"; saveS(); } drawSession(); say(why ? `${why} stopped.` : stepWords()); return; }
  const res = R?.len ? finalMeasure() : null;
  if (res?.ok && res.secs >= MIN_KEEP) {
    keep(res);
    show(res);
    say(`${why ? `${why} ` : ""}Kept: ${signed(res.rate)} s/d${res.be != null ? `, ${res.be.toFixed(1)} ms` : ""} over ${Math.round(res.secs)} s. ${readingWords(res.rate)}`);
  } else say(why ? `${why} stopped.` : res ? whyText(res) : "Stopped.", why ? "bad" : "");
}
function setListening(on, text) {
  listening = on;
  document.body.classList.toggle("tg-on", on);
  drawButtons();
  if (text) say(text);
}

/** A chunk from the microphone: through the signal chain (the better of two channels, chosen in the first second). */
function feed({ frame, ch }) {
  if (!R || !listening) return;
  if (R.frame != null && frame !== R.frame) {                 // a block lost: the beats' count is broken, so start again
    restart();
    if (S && S.phase !== "place") { S.phase = "settle"; S.from = 0; }
    say("A gap in the sound: starting the reading again.");
  }
  R.frame = frame + ch[0].length;
  if (!R.chain) {
    R.chains ??= ch.map(() => createChain(R.fs));
    const outs = ch.map((c, i) => R.chains[i].push(c));
    R.chains.forEach((c, i) => { R.levels[i] += c.level(); });
    (R.pending ??= []).push(outs);
    if (R.pending.length * ch[0].length >= R.fs) {              // a second in: keep the channel that hears more
      R.best = R.levels.length > 1 && R.levels[1] > R.levels[0] * 1.05 ? 1 : 0;
      R.chain = R.chains[R.best];
      for (const o of R.pending) append(o[R.best] || o[0]);
      R.chains = R.pending = null;
    }
  } else append(R.chain.push(ch[R.best] || ch[0]));
  if (S) sessionClock();
  if (heard() - R.last >= EVERY && !R.busy) { R.last = heard(); R.busy = true; setTimeout(liveMeasure, 0); }
}
function liveMeasure() {
  if (!R) return;
  try {
    const { env, from } = envelope(WINDOW), o = measureOpts();
    const res = measure(env, R.fe, { ...o, known: R.known });
    res.from = from / R.fe;
    R.result = res;
    if (res.ok) R.known = res.found; else if (res.why === "nothing") R.known = null;
    if (heard() - R.asked > 4) { R.asked = heard(); askOther(res, env, o); }      // asked every few seconds
    show(res);
    if (ident && res.ok && heard() >= IDENT_SECS) stop();
  } catch (e) { console.error(e); }
  R.busy = false;
}
function finalMeasure() {
  const { env, from } = envelope(KEEP), o = measureOpts();
  const res = measure(env, R.fe, o);
  res.from = from / R.fe;
  askOther(res, env, o);
  return res;
}
/** A calibre's vph that nothing beats, over eight seconds of sound: is it another watch? By ear, the rate it does beat. */
function askOther(res, env, o) {
  if (res.ok || !o.vph || env.length < 8 * R.fe) return;
  const other = detect(env.subarray(Math.max(0, env.length - 10 * R.fe)), R.fe);
  if (other.vph === QUARTZ) res.why = "quartz";
  else res.other = other.vph && other.vph !== o.vph ? other.vph : null;
}

// ---------- the positions session ----------
// Six positions, each placed by hand (Start), settled (Witschi: 20 s after a change), then measured for the length
// set; one can be skipped, and the session ended early with two or more. It's kept as it goes, so a reload picks it up.
let S = loadSession();
function loadSession() {
  const s = read(SESSION, null);
  if (!s || !W.list.some(w => w.id === s.watch) || !Number.isInteger(s.i) || s.i < 0 || s.i > POSITIONS.length) return null;
  return { watch: s.watch, at: Number.isFinite(s.at) ? s.at : Date.now(), wind: ["full", "24h"].includes(s.wind) ? s.wind : null, i: s.i,
    steps: (Array.isArray(s.steps) ? s.steps : []).filter(x => x && POSITIONS.some(p => p.id === x.pos)), skipped: Array.isArray(s.skipped) ? s.skipped.filter(p => POSITIONS.some(q => q.id === p)) : [], phase: "place" };
}
const saveS = () => write(SESSION, S ? { watch: S.watch, at: S.at, wind: S.wind, i: S.i, steps: S.steps, skipped: S.skipped } : null);
function beginSession(wind) {
  if (IN_FRAME) return;
  if (listening && !S) stop();
  S = { watch: W.current, at: Date.now(), wind, i: 0, steps: [], skipped: [], phase: "place" };
  saveS();
  drawSession();
  say(stepWords());
}
const pos = () => POSITIONS[S.i];
function stepWords() {
  if (!S) return "";
  const p = pos();
  if (!p) return "";
  if (S.phase === "settle") return `${p.name}: settling, ${Math.max(0, Math.ceil(opts.settle - (heard() - S.from)))} s.`;
  if (S.phase === "measure") return `${p.name}: measuring, ${Math.max(0, Math.ceil(opts.length - heard()))} s.`;
  return `${S.i + 1} of 6, ${p.name.toLowerCase()}: place it so, the case back on the microphone, then Start.`;
}
/** The step's Start: listening if it wasn't, then the settling. */
async function stepStart() {
  if (!S || !pos()) return;
  if (!listening && !(await listen())) return;
  S.phase = "settle";
  S.from = heard();
  drawSession();
  say(stepWords());
}
/** Called with every chunk while a session runs: settling ends in a fresh reading, measuring in a result. A step
 *  waits while the menu is open (the pause), and finishes when it closes. */
function sessionClock() {
  if (!S || S.phase === "place") return;
  if (S.phase === "settle" && heard() - S.from >= opts.settle) { restart(); S.phase = "measure"; say(stepWords()); drawSession(); return; }
  if (S.phase === "measure" && heard() >= opts.length && !isPaused()) { finishStep(); return; }
  if (Math.floor(heard() * 2) !== S.tick) { S.tick = Math.floor(heard() * 2); if (!R.result?.ok || S.phase === "settle") say(stepWords()); }
}
function finishStep() {
  const res = finalMeasure(), p = pos();
  if (!res.ok) { S.phase = "place"; drawSession(); say(`Not enough signal ${p.name.toLowerCase()}: Start again, or Skip.`, "bad"); return; }
  S.steps = S.steps.filter(x => x.pos !== p.id).concat([{ pos: p.id, rate: res.rate, be: res.be, amp: res.amp, quality: res.quality }]);
  keep(res, p.id);
  nextStep(`${p.name}: ${signed(res.rate)} s/d${res.be != null ? `, ${res.be.toFixed(1)} ms` : ""}.`);
}
function nextStep(text) {
  S.i++;
  S.phase = "place";
  saveS();
  if (S.i >= POSITIONS.length) { endSession(); return; }
  drawSession();
  say(`${text ? `${text} ` : ""}${stepWords()}`);
}
function stepSkip() {
  if (!S || !pos()) return;
  S.skipped = S.skipped.filter(x => x !== pos().id).concat([pos().id]);
  if (S.phase !== "place") restart();
  nextStep(`${pos().name} skipped.`);
}
/** Ends the session: two positions or more are kept with their verdict, and shown. */
function endSession() {
  const s = S;
  S = null;
  saveS();
  if (listening) { teardown(); setListening(false); }        // its readings are kept already, step by step
  drawSession();
  const kept = cleanSession({ at: s.at, wind: s.wind, steps: s.steps });
  const sum = kept && summarise(kept.steps);
  if (!sum) { say("Ended: fewer than two positions, so nothing is kept."); return; }
  const w = W.list.find(x => x.id === s.watch) || watch();
  w.sessions.unshift(kept);
  w.sessions = w.sessions.slice(0, 30);
  saveW();
  const v = verdict(sum);
  say(`${v.title}: ${signed(sum.mean)} s/d on average, ${sum.delta.toFixed(1)} s/d between positions.`);
  showSession(kept, w);
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
      // an iPhone video (.mov) Safari won't decode (WebKit bug 228971): its sound is the AAC an .mp4 would hold, so
      // it's tried once more called one
      const b = new Uint8Array(bytes.slice(0));
      if (String.fromCharCode(...b.subarray(4, 12)) === "ftypqt  ") { b.set([0x6d, 0x70, 0x34, 0x32], 8); try { buf = await ctx.decodeAudioData(b.buffer); } catch { buf = null; } }
    }
    if (!buf) { say(/\.mov$/i.test(file.name) ? "Safari can't read the sound of this video: record a Voice Memo instead, or save the video as .mp4." : "This file's sound couldn't be read here.", "bad"); return; }
    const fs = buf.sampleRate, n = Math.round(Math.min(buf.duration, 150) * fs);
    let samples = buf.getChannelData(0).subarray(0, n);
    if (buf.numberOfChannels > 1) { const other = buf.getChannelData(1).subarray(0, n); if (bandLevel(other, fs) > bandLevel(samples, fs) * 1.05) samples = other; }
    freshReading(fs, "file");
    R.chain = createChain(fs);
    append(R.chain.push(samples));
    const res = finalMeasure();
    show(res);
    if (res.ok) { keep(res, null, file.name); say(`${file.name}: ${signed(res.rate)} s/d${res.be != null ? `, ${res.be.toFixed(1)} ms` : ""} over ${Math.round(res.secs)} s.`); }
    else say(`${file.name}: ${whyText(res)}`, "bad");
  } catch (e) {
    console.error(e);
    say("This file's sound couldn't be read here.", "bad");
  } finally { done(); }
}

// ---------- keeping ----------
function keep(res, pos = null, name = null) {
  const w = W.list.find(x => x.id === (S?.watch ?? W.current)) || watch();
  const r = cleanReading({ at: Date.now(), src: R?.src === "file" ? "file" : "mic", name, vph: res.vph, rate: round(res.rate, 2), rateErr: round(res.rateErr, 2),
    be: res.be == null ? null : round(res.be, 2), amp: res.amp == null ? null : Math.round(res.amp), quality: round(res.quality, 2), secs: Math.round(res.secs), lift: measureOpts().lift, pos });
  if (!r) return;
  w.readings.unshift(r);
  w.readings = w.readings.slice(0, 100);
  // every reading teaches the watch its own sound, so Which? can tell it later (one that beats otherwise than it should isn't it)
  const fp = fingerprint(res), want = vphOf(w);
  if (fp && (!want || want === fp.vph)) w.print = learn(w.print, fp);
  saveW();
}
const round = (v, d) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// ---------- which watch ----------
async function whichWatch() {
  if (IN_FRAME || S) return;
  if (listening) stop();
  ident = true;
  if (!(await listen())) { ident = false; drawButtons(); return; }
  say(`Listening for which watch it is: about ${IDENT_SECS} seconds, the case back on the microphone.`);
}
/** Which? stopped (by itself after IDENT_SECS, or by hand): the reading by ear set against every watch's print. */
let heardRes = null;
function endIdentify(why) {
  const res = R?.len ? finalMeasure() : null;
  ident = false;
  drawButtons();
  if (!res?.ok || res.secs < MIN_KEEP) { say(why ? `${why} stopped.` : res ? whyText(res) : "Stopped.", "bad"); return; }
  heardRes = res;
  show(res);
  const fp = fingerprint(res), r = identify(W.list.map(w => ({ id: w.id, vph: vphOf(w), quartz: !!calOf(w).quartz, print: w.print })), fp);
  const byId = id => W.list.find(w => w.id === id), top = r.ranked[0] && byId(r.ranked[0].id);
  $("idHead").textContent = r.sure ? top.name : r.ranked.length ? "Which is it?" : "None of yours";
  $("idWhat").textContent = `${n0(fp.vph)} vph · ${signed(fp.rate)} s/d${fp.be != null ? ` · ${fp.be.toFixed(1)} ms` : ""}${fp.amp != null ? ` · ≈${Math.round(fp.amp)}°` : ""}. `
    + (!r.ranked.length ? "Nothing in your library beats so: add it as another watch."
      : r.sure ? "Tap it to keep the reading with it."
      : r.ranked[0].learnt && r.ranked.slice(1).some(x => !x.learnt) ? `Most like ${top.name}, but some that beat alike haven't been heard yet: tap the one it is, and it learns.`
      : r.twins ? "These beat alike and it hasn't learnt them apart yet: tap the one it is, and it learns its sound."
      : "Not sure: tap the one it is, and it learns.");
  $("idList").innerHTML = r.ranked.slice(0, 4).map(x => {
    const w = byId(x.id);
    return `<li><button type="button" class="tg-lrow" data-id="${esc(w.id)}">${thumb(w)}<span class="tg-ltext"><b>${esc(w.name)}</b><small>${esc([w.ref, x.why[0]].filter(Boolean).join(" · ") || calOf(w).cal)}</small></span><em class="tg-pc">${Math.round(x.p * 100)}%</em></button></li>`;
  }).join("");
  $("idDlg").showModal();
}
/** The watch it was, by the player's word: the reading measured again as that watch (its own lift angle) and kept with it. */
function itWas(id) {
  $("idDlg").close();
  if (!W.list.some(w => w.id === id)) return;
  W.current = id;
  if (R) R.known = null;
  const res = R?.len ? finalMeasure() : null, use = res?.ok ? res : heardRes;
  keep(use);
  drawWatch();
  show(use);
  say(`Kept with ${watch().name}: ${signed(use.rate)} s/d${use.be != null ? `, ${use.be.toFixed(1)} ms` : ""}. ${readingWords(use.rate)}`);
}
$("idList").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) itWas(b.dataset.id); });
$("idOther").addEventListener("click", async () => {
  $("idDlg").close();
  const name = await askName("This watch's name");
  if (!name) return;
  const id = `w${Date.now().toString(36)}`;
  W.list.push(blank(id, name));
  itWas(id);
});

// ---------- the library ----------
const photoOf = w => (w?.photo ? read(photoKey(w.id), null) : null);
/** A watch's photo, small, or the plate it has until it has one. */
function thumb(w, cls = "tg-lthumb") {
  const src = photoOf(w);
  return src ? `<span class="${cls}"><img src="${src}" alt=""></span>` : `<span class="${cls} none" aria-hidden="true">${esc((w.name || "?").trim()[0] || "?")}</span>`;
}
const CHIP = { good: "Well", watch: "Watch it", service: "Service" };
function openLibrary() {
  $("libList").innerHTML = W.list.map(w => {
    const h = health(w), c = calOf(w);
    return `<li><button type="button" class="tg-lrow${w.id === W.current ? " cur" : ""}" data-id="${esc(w.id)}">${thumb(w)}<span class="tg-ltext"><b>${esc(w.name)}</b><small>${esc([w.ref, c.id === "auto" ? "" : c.short || c.cal].filter(Boolean).join(" · ") || "Add its reference")}</small></span>${h.status === "unknown" ? "" : `<em class="tg-chip ${h.status}">${CHIP[h.status]}</em>`}</button></li>`;
  }).join("");
  if (!$("libDlg").open) $("libDlg").showModal();
}
$("libList").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) openWatch(b.dataset.id); });
$("libAdd").addEventListener("click", async () => {
  const name = await askName("A watch's name");
  if (!name) return;
  const id = `w${Date.now().toString(36)}`;
  W.list.push(blank(id, name));
  saveW();
  drawWatch();
  openLibrary();
  openWatch(id);
});
let shownW = null;            // the watch the watch sheet shows
function openWatch(id) {
  const w = W.list.find(x => x.id === id);
  if (!w) return;
  shownW = w;
  $("wName").value = w.name;
  $("wRef").value = w.ref || "";
  $("wDesc").value = w.desc || "";
  $("wServed").value = w.served || "";
  $("wServed").max = new Date().toISOString().slice(0, 10);
  const cal = $("wCal");
  cal.replaceChildren(new Option("By ear", "auto"), ...CALIBRES.map(c => new Option(c.short ? `${c.name} · ${c.short}` : c.name, c.id)));
  cal.value = w.cal;
  $("photoBtn").innerHTML = photoOf(w) ? `<img src="${photoOf(w)}" alt="${esc(w.name)}">` : `<span>Add a photo</span>`;
  $("wUse").hidden = w.id === W.current;
  drawHealth(w);
  if (!$("watchDlg").open) $("watchDlg").showModal();
}
/** How the watch is keeping: its status, what tells, and its rate, amplitude and beat error over time. */
function drawHealth(w) {
  const h = health(w);
  $("wStatus").className = `tg-status ${h.status}`;
  $("wStatus").textContent = `${STATUS[h.status]}${h.served != null ? ` · serviced ${h.served < 1 ? `${Math.max(1, Math.round(h.served * 12))} months` : `${h.served.toFixed(1)} years`} ago` : ""}`;
  $("wLines").innerHTML = h.lines.map(l => `<p>${esc(l)}</p>`).join("");
  const chart = (pts, label, unit, digits, base) => {
    if (pts.length < 2) return "";
    const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1, vs = pts.map(p => p[1]).concat(base != null ? [base] : []);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12, X = at => (t1 > t0 ? ((at - t0) / (t1 - t0)) * 100 : 50), Y = v => 28 - ((v - lo + pad) / (hi - lo + 2 * pad)) * 26;
    const line = pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), last = pts[pts.length - 1][1];
    return `<figure class="tg-chart"><figcaption><small>${label}</small><b>${digits ? (unit === "s/d" ? signed(last, digits) : last.toFixed(digits)) : Math.round(last)}</b><span>${unit}</span></figcaption>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">${base != null ? `<line class="base" x1="0" x2="100" y1="${Y(base).toFixed(1)}" y2="${Y(base).toFixed(1)}"/>` : ""}<polyline points="${line}"/>${pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="1.2"/>`).join("")}</svg></figure>`;
  };
  $("wCharts").innerHTML = chart(h.series.rate, "Rate", "s/d", 1, h.baseline?.rate) + chart(h.series.amp, "Amplitude", "°", 0, h.baseline?.amp) + chart(h.series.be, "Beat error", "ms", 1, h.baseline?.be);
}
const edited = () => { saveW(); drawWatch(); };
$("wName").addEventListener("change", e => { if (shownW && e.target.value.trim()) { shownW.name = e.target.value.trim().slice(0, 60); edited(); } });
$("wRef").addEventListener("change", e => { if (shownW) { shownW.ref = e.target.value.trim().slice(0, 40); edited(); } });
$("wDesc").addEventListener("change", e => { if (shownW) { shownW.desc = e.target.value.trim().slice(0, 1000); edited(); } });
$("wServed").addEventListener("change", e => { if (shownW) { shownW.served = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : null; edited(); drawHealth(shownW); } });
$("wCal").addEventListener("change", e => { if (shownW) { shownW.cal = e.target.value; shownW.vph = null; shownW.lift = null; if (shownW.id === W.current && R) R.known = null; edited(); } });
$("photoBtn").addEventListener("click", () => { if (!IN_FRAME) $("photoFile").click(); });
$("photoFile").addEventListener("change", async e => {
  const f = e.target.files?.[0], w = shownW;
  e.target.value = "";
  if (!f || !w) return;
  const ok = await setPhoto(w, f);
  if (ok) openWatch(w.id); else say("That photo couldn't be kept: the phone's storage for this app is full, or the picture couldn't be read.", "bad");
});
/** A photo made small (480 px on its long side, a JPEG of 30 to 60 kB) and kept under its own key, so the list of
 *  watches stays light and a photo travels to the other devices only when it changes. */
async function setPhoto(w, file) {
  try {
    const url = URL.createObjectURL(file), img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    URL.revokeObjectURL(url);
    const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    localStorage.setItem(photoKey(w.id), JSON.stringify(c.toDataURL("image/jpeg", 0.8)));
    w.photo = Date.now();
    edited();
    return true;
  } catch { return false; }
}
$("wUse").addEventListener("click", () => { if (shownW) { chooseWatch(shownW.id); $("watchDlg").close(); $("libDlg").close(); } });
$("wHist").addEventListener("click", () => { if (shownW) openHistory(shownW); });
$("wRemove").addEventListener("click", () => { if (shownW && removeWatch(shownW)) { $("watchDlg").close(); if ($("libDlg").open) openLibrary(); } });
$("thumbBtn").addEventListener("click", () => openWatch(W.current));

// ---------- drawing ----------
function whyText(res) {
  if (res.why === "quartz") return "A step a second: a quartz watch. A timegrapher has nothing to hear in one.";
  if (res.why === "short") return "Listening: a few seconds more.";
  if (res.other) return `It beats ${n0(res.other)}, not ${n0(setting().vph)}: another watch? Choose it in the menu.`;
  if (res.why === "nothing") return "No beat heard yet: press the case back to the microphone, in a quiet room.";
  return "Not enough signal: closer to the microphone, or quieter round it.";
}
let trace = null;
function show(res) {
  const ok = res?.ok, s = setting();
  $("rate").textContent = ok ? signed(res.rate) : "—";
  $("rateSub").textContent = ok ? `s/d ±${Math.max(0.1, res.rateErr).toFixed(1)} · phone ±${PHONE}` : "s/d";
  $("be").textContent = ok && res.be != null && !s.flexure ? res.be.toFixed(1) : "—";
  $("beSub").textContent = ok && res.be == null ? "tock unheard" : s.flexure ? "no balance" : "ms";
  const amp = ok && res.amp != null;
  $("amp").textContent = amp ? `≈${Math.round(res.amp)}°` : "—";
  $("ampSub").textContent = s.flexure ? "no balance" : s.coaxial ? "co-axial: none" : amp ? `rough · lift ${s.lift}°` : ok ? "noises unclear" : "°";
  meter(res);
  if (listening && ident) say(ok ? `Listening for which watch it is: ${Math.max(0, Math.ceil(IDENT_SECS - heard()))} s more · ${n0(res.vph)} vph` : whyText(res));
  else if (listening && (!S || S.phase === "measure")) {                // a session's placing and settling keep their own words
    if (!ok) say(whyText(res), res.other ? "bad" : "");
    else if (!S) say(`${n0(res.vph)} vph · ${Math.round(res.secs)} s · ${Math.round(res.kept * 100)}% of beats`);
    else if (S.phase === "measure") say(`${pos().name}: ${Math.max(0, Math.ceil(opts.length - heard()))} s more · ${signed(res.rate)} s/d so far`);
  }
  plot(res);
}
/** The signal meter: before a beat is found, how far the band's peaks stand over its floor; after, how well the beats
 *  match their templates and how many do. */
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
  if (!res?.ok || !R) { trace.trace({ points: R?.anchor ? trace.lastPoints || [] : [], now: heard(), span: SPAN, half: trace.lastHalf || 2 }); return; }
  const Tn = 3600 / res.vph, P = res.period, beats = res.beats.map(b => ({ ...b, abs: res.from + b.t }));
  if (!R.anchor || R.anchor.vph !== res.vph) {
    const first = beats.filter(b => !b.odd).sort((a, b) => a.abs - b.abs)[0] || beats[0];
    R.anchor = { t: first.abs, vph: res.vph };
  }
  const points = beats.map(b => {
    const n = Math.round((b.abs - R.anchor.t) / P);
    return { x: b.abs, y: -(b.abs - R.anchor.t - n * Tn) * 1000, tock: (n & 1) === 1, faint: b.c < 0.5 };
  });
  // the window shown is centred on its own dots, as a timegrapher's screen is: a watch within a few s/d draws two
  // clean sloped lines, and only one far off wraps round into stripes
  const shown = points.filter(p => p.x >= heard() - SPAN).map(p => p.y).sort((a, b) => a - b);
  const mid = shown.length ? shown[shown.length >> 1] : 0;
  for (const p of points) p.y -= mid;
  const half = [1, 2, 5, 10, 20].find(v => v >= 2.5 * ((res.be ?? 0) + 4 * res.sigma)) ?? 20;
  trace.lastPoints = points;
  trace.lastHalf = half;
  trace.trace({ points, now: heard(), span: SPAN, half });
  const t = res.templates, lift = measureOpts().lift;
  trace.beat({ a: t.a, b: t.b, fe: t.fe, W: t.W, noisesA: t.noisesA, noisesB: t.noisesB,
    label: res.amp != null ? `Lift ${(((t.noisesA.last - t.noisesA.first) / t.fe) * 1000).toFixed(1)} ms: ≈${Math.round(res.amp)}° at ${lift}°` : "Tick and tock, averaged" });
}
function say(text, tone = "") {
  const el = $("line");
  el.textContent = text;
  el.classList.toggle("bad", tone === "bad");
}
/** What the current watch is listened for, in the strip; the watches in its dropdown. */
let dd = null;
function drawWatch() {
  const sel = $("watchSel"), s = setting();
  sel.replaceChildren(...W.list.map(w => new Option(w.name, w.id, false, w.id === W.current)), new Option("Add a watch…", "+"));
  for (const o of sel.options) if (o.value !== "+") { const c = calOf(W.list.find(w => w.id === o.value)); o.dataset.note = c.id === "auto" ? "vph by ear" : c.cal; }
  sel.value = W.current;
  dd?.sync();
  $("thumbBtn").innerHTML = thumb(watch(), "tg-sthumb");
  $("calTag").textContent = s.quartz ? "quartz" : `${s.vph ? n0(s.vph) : "by ear"}${s.flexure ? " · rate only" : s.coaxial ? " · co-axial" : ` · ${s.lift}°`}`;
}
function drawButtons() {
  const sess = !!S;
  $("acts").classList.toggle("session", sess);
  $("openBtn").hidden = sess;
  $("whichBtn").hidden = sess;
  $("whichBtn").disabled = IN_FRAME || (listening && !ident);
  $("whichBtn").textContent = ident ? "Hearing…" : "Which?";
  $("skipBtn").hidden = !sess;
  $("endBtn").hidden = !sess;
  const main = $("listenBtn");
  if (sess) main.textContent = S.phase === "place" ? "Start" : "Stop";
  else main.textContent = listening ? "Stop" : "Listen";
  main.setAttribute("aria-pressed", String(listening));
  $("listenBtn").disabled = IN_FRAME;
  $("openBtn").disabled = IN_FRAME;
}
/** The session's six positions: done (its rate), the one in hand, skipped, still to come. */
function drawSession() {
  const box = $("steps");
  box.hidden = !S;
  document.getElementById("app").classList.toggle("tg-session", !!S);
  if (S) box.innerHTML = POSITIONS.map((p, i) => {
    const st = S.steps.find(x => x.pos === p.id), skipped = S.skipped.includes(p.id), cur = i === S.i;
    return `<li class="${st ? "done" : skipped ? "skipped" : cur ? "cur" : ""}"><b>${p.id}</b><small>${st ? signed(st.rate) : skipped ? "—" : cur ? (S.phase === "place" ? "next" : "…") : ""}</small></li>`;
  }).join("");
  drawButtons();
}

// ---------- the sheets: a session's result, the history, the worn-rate log, a name ----------
function showSession(s, w) {
  const sum = summarise(s.steps), v = verdict(sum), byPos = p => s.steps.find(x => x.pos === p.id);
  $("resHead").textContent = v.title;
  $("resWhat").textContent = `${w.name} · ${new Date(s.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${s.wind === "full" ? " · fully wound" : s.wind === "24h" ? " · after 24 h" : ""}`;
  $("resTable").innerHTML = `<thead><tr><th>Position</th><th>s/d</th><th>ms</th><th>°</th></tr></thead><tbody>${POSITIONS.map(p => {
    const x = byPos(p);
    return `<tr${x ? "" : ' class="off"'}><th>${p.name}</th><td>${x ? signed(x.rate) : "—"}</td><td>${x?.be != null ? x.be.toFixed(1) : "—"}</td><td>${x?.amp != null ? `≈${Math.round(x.amp)}` : "—"}</td></tr>`;
  }).join("")}</tbody>`;
  const iso = isochronism(w.sessions);
  $("resChecks").innerHTML = v.checks.map(k => `<div class="${k.ok ? "ok" : "no"}"><dt>${k.what}</dt><dd>${k.value}<small>${k.limit}</small></dd></div>`).join("")
    + `<div><dt>Spread</dt><dd>${sum.delta.toFixed(1)} s/d<small>fastest to slowest</small></dd></div>`
    + (iso ? `<div><dt>Full wind to 24 h</dt><dd>${signed(iso.change)} s/d<small>${signed(iso.full)} then ${signed(iso.day)}</small></dd></div>` : "");
  $("resWords").innerHTML = v.lines.map(l => `<p>${esc(l)}</p>`).join("");
  $("resultDlg").showModal();
}
let histW = null;             // the watch the history shows
function openHistory(w = watch()) {
  histW = w;
  const rows = [];
  const date = t => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  w.sessions.forEach((s, i) => {
    const sum = summarise(s.steps), v = verdict(sum);
    rows.push(`<li><button type="button" class="tg-hrow" data-session="${i}"><span><b>${v.title}</b><small>${date(s.at)} · ${sum.n} positions${s.wind === "24h" ? " · 24 h" : s.wind === "full" ? " · full wind" : ""}</small></span><em>${signed(sum.mean)} s/d · Δ ${sum.delta.toFixed(1)}</em></button><button type="button" class="tg-del" data-del-session="${i}" aria-label="Delete">×</button></li>`);
  });
  w.readings.forEach((r, i) => {
    const what = r.pos ? POSITIONS.find(p => p.id === r.pos).name : r.src === "file" ? (r.name || "A recording") : "Listening";
    rows.push(`<li><span class="tg-hrow"><span><b>${esc(what)}</b><small>${date(r.at)} · ${r.vph ? n0(r.vph) : "—"} vph · ${r.secs ?? "—"} s</small></span><em>${signed(r.rate)} s/d${r.be != null ? ` · ${r.be.toFixed(1)} ms` : ""}${r.amp != null ? ` · ≈${r.amp}°` : ""}</em></span><button type="button" class="tg-del" data-del-reading="${i}" aria-label="Delete">×</button></li>`);
  });
  const worn = wornRate(w.log);
  $("histHead").textContent = w.name;
  $("histWorn").textContent = worn ? `As worn: ${signed(worn.rate, 2)} s/d over ${worn.days.toFixed(1)} days (±${worn.err.toFixed(2)}), ${worn.n} readings.` : w.log.length ? "As worn: tap again a day or more after the first reading." : "";
  $("histList").innerHTML = rows.length ? rows.join("") : `<li class="tg-empty">Nothing kept for this watch yet.</li>`;
  if (!$("histDlg").open) $("histDlg").showModal();
}
$("histList").addEventListener("click", e => {
  const w = histW || watch(), b = e.target.closest("button");
  if (!b || IN_FRAME) return;
  if (b.dataset.session != null) { showSession(w.sessions[+b.dataset.session], w); return; }
  if (b.dataset.delSession != null && confirm("Delete this session?")) { w.sessions.splice(+b.dataset.delSession, 1); saveW(); openHistory(w); }
  if (b.dataset.delReading != null && confirm("Delete this reading?")) { w.readings.splice(+b.dataset.delReading, 1); saveW(); openHistory(w); }
});

// the worn-rate log: the phone's clock to a tenth, a tap the moment the seconds hand reaches 12
let clockRaf = 0, setNext = false;
function openWorn() {
  setNext = false;
  drawWorn();
  if (!$("wornDlg").open) $("wornDlg").showModal();
  const tick = () => {
    const d = new Date();
    $("wornClock").textContent = `${d.toLocaleTimeString("en-GB", { hour12: false })}.${Math.floor(d.getMilliseconds() / 100)}`;
    if ($("wornDlg").open) clockRaf = requestAnimationFrame(tick);
  };
  cancelAnimationFrame(clockRaf);
  tick();
}
function drawWorn() {
  const w = watch(), worn = wornRate(w.log), last = w.log[w.log.length - 1];
  $("wornHead").textContent = `Worn rate · ${w.name}`;
  $("wornRate").textContent = worn ? `${signed(worn.rate, 2)} s/d` : "—";
  $("wornNote").textContent = worn ? `over ${worn.days.toFixed(1)} days, ${worn.n} readings, ±${worn.err.toFixed(2)}`
    : last ? "Tap again a day or more from now: the longer apart, the finer (a week: about ±0.03 s/d)." : "Tap the moment its seconds hand reaches 12, against the phone's clock.";
  $("wornLast").hidden = !last;
  if (last) $("wornOff").textContent = `Last: ${new Date(last.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, the watch ${last.off >= 0 ? "+" : "−"}${Math.abs(last.off).toFixed(1)} s${last.set ? " (just set)" : ""}`;
  $("setBtn").setAttribute("aria-pressed", String(setNext));
  $("wornList").innerHTML = [...w.log].reverse().slice(0, 30).map((e, i) => `<li><span>${new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}${e.set ? " · set" : ""}</span><b>${e.off >= 0 ? "+" : "−"}${Math.abs(e.off).toFixed(1)} s</b><button type="button" class="tg-del" data-del-log="${w.log.length - 1 - i}" aria-label="Delete">×</button></li>`).join("");
}
$("tapBtn").addEventListener("pointerdown", e => {
  if (IN_FRAME) return;
  e.preventDefault();
  const ms = Date.now() - (performance.now() - e.timeStamp);   // the moment of the touch, not of the code that heard it
  const w = watch();
  w.log.push({ at: ms, off: tapOffset(ms), ...(setNext ? { set: true } : {}) });
  w.log = w.log.slice(-200);
  setNext = false;
  saveW();
  drawWorn();
  navigator.vibrate?.(15);
});
$("minusBtn").addEventListener("click", () => { const w = watch(), e = w.log[w.log.length - 1]; if (e) { e.off -= 60; saveW(); drawWorn(); } });
$("plusBtn").addEventListener("click", () => { const w = watch(), e = w.log[w.log.length - 1]; if (e) { e.off += 60; saveW(); drawWorn(); } });
$("setBtn").addEventListener("click", () => { setNext = !setNext; drawWorn(); });
$("wornList").addEventListener("click", e => {
  const b = e.target.closest("[data-del-log]");
  if (!b || IN_FRAME || !confirm("Delete this reading?")) return;
  watch().log.splice(+b.dataset.delLog, 1);
  saveW();
  drawWorn();
});

/** A name or a number, asked in a sheet of the page's own (resolves to the trimmed text, or null). */
function askName(title, value = "", { numeric = false } = {}) {
  return new Promise(resolve => {
    const dlg = $("askDlg"), input = $("askInput");
    $("askHead").textContent = title;
    input.value = value;
    input.inputMode = numeric ? "decimal" : "text";
    const done = v => { dlg.close(); resolve(v); };
    $("askOk").onclick = () => done(input.value.trim().slice(0, 60) || null);
    $("askCancel").onclick = () => done(null);
    dlg.onclose = () => resolve(null);
    dlg.showModal();
    input.focus();
  });
}
async function addWatch() {
  const name = await askName("A watch's name");
  if (!name) { drawWatch(); return; }
  const id = `w${Date.now().toString(36)}`;
  W.list.push(blank(id, name));
  W.current = id;
  saveW();
  drawWatch();
  openWatch(id);
}
/** Removes a watch with all it has kept, its photo too; the last stays. True if it went. */
function removeWatch(w = watch()) {
  if (W.list.length < 2) { say("The last watch stays: rename it instead."); return false; }
  if (!confirm(`Remove ${w.name}, with its photo, readings, sessions and worn-rate log?`)) return false;
  W.list = W.list.filter(x => x !== w);
  if (W.current === w.id) W.current = W.list[0].id;
  write(photoKey(w.id), null);
  saveW();
  drawWatch();
  return true;
}
function chooseWatch(id) {
  if (id === "+") { addWatch(); return; }
  if (!W.list.some(w => w.id === id) || id === W.current) return;
  if (S) endSession();
  W.current = id;
  saveW();
  if (R) R.known = null;
  drawWatch();
  show(null);
  say(`${watch().name}: ${calOf(watch()).cal}.`);
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
  const body = $("menuBody"), w = watch(), c = calOf(w), s = setting();
  body.replaceChildren();
  const play = part(body, "play");
  play.append(
    action(S ? "End the session" : listening ? "Stop" : "Listen", () => (S ? endSession() : listening ? stop() : listen()), "primary"),
    ...(S ? [] : [action("Positions: fully wound", () => beginSession("full")), action("Positions: after 24 hours", () => beginSession("24h"))]),
    action("Worn rate", openWorn), action("Open a recording", () => $("file").click()));
  const content = part(body, "content");
  content.append(mirror("Watch", $("watchSel")));
  content.append(choice("Calibre", [["auto", "By ear"], ...CALIBRES.map(x => [x.id, x.short || x.name])], c.id, v => {
    w.cal = v; w.vph = null; w.lift = null; saveW(); drawWatch(); if (R) R.known = null; openMenu();
  }));
  content.append(line(`${c.id === "auto" ? AUTO.src : `${c.cal}: ${c.src}`}${c.lift && !c.flexure ? ` Lift angle ${SURE[c.sure] ? `(${SURE[c.sure]})` : ""}.` : ""}`));
  if (!c.quartz) {
    // the calibre's figure, by ear, the rates a timegrapher offers, the watch's own if it has one, or another typed in
    // (w.vph 0 is "by ear" over a calibre that has a rate)
    const ownVph = w.vph && !MANUAL.includes(w.vph) && w.vph !== c.vph ? [[String(w.vph), n0(w.vph)]] : [];
    content.append(choice("Beat rate (vph)", [["cal", c.vph ? `${n0(c.vph)} (calibre)` : "By ear"], ...(c.vph ? [["auto", "By ear"]] : []), ...MANUAL.filter(v => v !== c.vph).map(v => [String(v), n0(v)]), ...ownVph, ["other", "Other…"]],
      w.vph ? String(w.vph) : w.vph === 0 ? "auto" : "cal", async v => {
        if (v === "other") {
          $("menuDlg").close();
          const typed = await askName("Beats an hour (vph)", w.vph || "", { numeric: true });
          if (typed == null) return;
          const got = Number(typed.replace(/[\s,]/g, ""));
          if (!(got >= 3600 && got <= 360000)) { say("A beat rate is 3,600 to 360,000 vph.", "bad"); return; }
          w.vph = Math.round(got);
        }
        else w.vph = v === "cal" ? null : v === "auto" ? 0 : Number(v);
        saveW(); drawWatch(); if (R) R.known = null;
      }));
    if (!c.flexure) {
      const base = c.lift ?? DEFAULT_LIFT, list = [38, 44, 49, 50, 51, 52, 53, 54].filter(v => v !== base), ownLift = w.lift && !list.includes(w.lift) && w.lift !== base ? [[String(w.lift), `${w.lift}°`]] : [];
      content.append(choice("Lift angle", [["cal", `${base}° (calibre)`], ...list.map(v => [String(v), `${v}°`]), ...ownLift, ["other", "Other…"]], w.lift ? String(w.lift) : "cal", async v => {
        if (v === "other") {
          $("menuDlg").close();
          const typed = await askName("Lift angle (degrees)", w.lift || base, { numeric: true });
          if (typed == null) return;
          const got = Number(typed.replace(",", "."));
          if (!(got >= 20 && got <= 90)) { say("A lift angle is 20 to 90°.", "bad"); return; }
          w.lift = Math.round(got * 10) / 10;
        }
        else w.lift = v === "cal" ? null : Number(v);
        saveW(); drawWatch();
      }));
    }
  }
  content.append(action("Your watches", openLibrary), action("This watch: photo, reference, health", () => openWatch(W.current)), action("Which watch is this? (listen)", whichWatch));
  const settings = part(body, "settings");
  settings.append(choice("Each position", [["20", "20 s"], ["40", "40 s"], ["60", "60 s"]], String(opts.length), v => { opts.length = Number(v); saveOpts(); }));
  settings.append(choice("Settling", [["10", "10 s"], ["15", "15 s"], ["20", "20 s"]], String(opts.settle), v => { opts.settle = Number(v); saveOpts(); }));
  const about = part(body, "about");
  about.append(action("History of this watch", openHistory));
  const last = w.readings[0];
  about.append(line(last ? `Last: ${signed(last.rate)} s/d, ${new Date(last.at).toLocaleDateString("en-GB")}. ${w.sessions.length} session${w.sessions.length === 1 ? "" : "s"} kept.` : "Nothing kept for this watch yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "timegrapher");
document.querySelector(".tg-mark").innerHTML = APPS.find(a => a.id === "timegrapher")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const id of ["histClose", "wornClose", "resClose", "libClose", "watchClose", "idClose"]) $(id).addEventListener("click", e => e.target.closest("dialog").close());
$("watchDlg").addEventListener("close", () => { if ($("libDlg").open) openLibrary(); });
for (const d of ["histDlg", "wornDlg", "resultDlg", "askDlg", "libDlg", "watchDlg", "idDlg"]) $(d).addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$("listenBtn").addEventListener("click", () => {
  if (S) { if (S.phase === "place") stepStart(); else { restart(); S.phase = "place"; drawSession(); say(stepWords()); } return; }
  if (listening) stop(); else listen();
});
$("skipBtn").addEventListener("click", stepSkip);
$("endBtn").addEventListener("click", () => { if (S && (S.steps.length < 2 || confirm("End the session here?"))) endSession(); });
$("openBtn").addEventListener("click", () => $("file").click());
$("whichBtn").addEventListener("click", () => (ident ? stop() : whichWatch()));
$("file").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; openFile(f); });
$("watchSel").addEventListener("change", e => chooseWatch(e.target.value));
dd = dropdown($("watchSel"));
trace = createTrace($("trace"));
$("trace").addEventListener("click", () => { trace.view = trace.view === "trace" ? "beat" : "trace"; $("viewTag").textContent = trace.view === "trace" ? "Trace" : "Beat"; });
onPause(() => {}, () => { if (S?.phase === "measure" && R && heard() >= opts.length) finishStep(); });   // a step due while the menu was open
drawWatch();
drawSession();
show(null);
say(IN_FRAME ? "Your partner's Timegrapher: the microphone is theirs." : S ? stepWords() : "Listen, with the watch's case back on the microphone.");
window.__timegrapher = { get R() { return R; }, get S() { return S; }, get W() { return W; }, opts, measure, openFile, listen, stop, beginSession, stepStart, stepSkip, endSession, openWorn, openHistory, openMenu, openLibrary, openWatch, whichWatch, setPhoto, trace: () => trace };
