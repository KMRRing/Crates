// The Music course's ear trainer: a question is played (higher or lower, an interval, a chord's quality, a scale or mode, a melody of three to
// five notes) and answered from buttons or the keyboard. What is missed goes into the review pile (music-pile.js) and comes back later;
// "Skip" is always there, costs nothing, and counts the step as done, so the course can be finished without hearing (docs/music.md).
// While a question sounds, dots light in time with it (a cue that carries no pitch, so it shows that something is playing without giving the answer).
import { f1, text, chip, inBox, flow, keyLayout, keyAt, drawKeyboard } from "./music-draw.js";
import { IV, IV_NAMES, CHORDS, SCALES, midiOf, parse, scale, note, voicing, spell, nameOf, fullName } from "./music-theory.js";
import { pickFrom } from "./music-pile.js";
import { playEvents, widthOf } from "./music-play.js";

export const LABEL = {
  m2: "minor 2nd", M2: "major 2nd", m3: "minor 3rd", M3: "major 3rd", P4: "perfect 4th", A4: "tritone", P5: "perfect 5th", m6: "minor 6th", M6: "major 6th", m7: "minor 7th", M7: "major 7th", P8: "octave",
  maj: "major", min: "minor", dim: "diminished", aug: "augmented", dom7: "dominant 7th", maj7: "major 7th", min7: "minor 7th",
  major: "major", minor: "natural minor", dorian: "dorian", mixolydian: "mixolydian", lydian: "lydian", phrygian: "phrygian",
  higher: "higher", lower: "lower",
};
const PROMPT = { hl: "Is the second note higher or lower than the first?", int: "Which interval is it?", chord: "What kind of chord is it?", mode: "Which scale is it?", dict: "Play the melody back" };
const between = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

/** A question for an id ("hl", "int:M3", "chord:min", "mode:dorian", "dict"): its events, the right answer and the options to choose from. */
export function buildQuestion(id, pool = [], rnd = Math.random, o = {}) {
  const [kind, which] = id.split(":");
  const options = pool.map(p => ({ id: p.split(":")[1] || p, text: LABEL[p.split(":")[1] || p] }));
  if (kind === "hl") {
    const a = between(rnd, 55, 72), d = between(rnd, 1, o.far ? 9 : 4), up = rnd() < 0.5, b = up ? a + d : a - d;
    return { id, kind, prompt: PROMPT.hl, answer: up ? "higher" : "lower", options: [{ id: "higher", text: "Higher" }, { id: "lower", text: "Lower" }], events: [{ t: 0, midi: a, dur: 0.7, vel: 0.8 }, { t: 0.85, midi: b, dur: 0.9, vel: 0.8 }], lit: [a, b] };
  }
  if (kind === "int") {
    const root = between(rnd, 52, 64), semis = IV[which][1], down = o.down && rnd() < 0.5, a = down ? root + semis : root, b = down ? root : root + semis;
    const ev = o.harm ? [{ t: 0, midi: a, dur: 1.6, vel: 0.8 }, { t: 0, midi: b, dur: 1.6, vel: 0.8 }] : [{ t: 0, midi: a, dur: 0.8, vel: 0.8 }, { t: 0.9, midi: b, dur: 1.0, vel: 0.8 }];
    return { id, kind, prompt: PROMPT.int, answer: which, options, events: ev, lit: [a, b] };
  }
  if (kind === "chord") {
    const root = between(rnd, 48, 59), ms = voicing(spell(root), which, 48);
    const ms2 = ms.map(m => m + (root - ms[0]));
    return { id, kind, prompt: PROMPT.chord, answer: which, options, events: [...ms2.map((midi, i) => ({ t: i * 0.35, midi, dur: 0.5, vel: 0.75 })), ...ms2.map(midi => ({ t: ms2.length * 0.35 + 0.15, midi, dur: 1.6, vel: 0.7 }))], lit: ms2 };
  }
  if (kind === "mode") {
    const tonic = between(rnd, 55, 62), steps = SCALES[which], ms = [tonic];
    for (const st of steps) ms.push(ms.at(-1) + st);
    return { id, kind, prompt: PROMPT.mode, answer: which, options, events: ms.map((midi, i) => ({ t: i * 0.34, midi, dur: i === 7 ? 1.2 : 0.4, vel: 0.75 })), lit: ms };
  }
  // melodic dictation in C major from C4: the first note is given, then a few steps and thirds
  const len = o.len || 4, deg = [0], C = scale(note(0, 0, 4), "major").map(midiOf);
  while (deg.length < len) {
    const last = deg.at(-1), step = [-2, -1, 1, 1, 2][between(rnd, 0, 4)];
    let next = Math.max(0, Math.min(7, last + step));
    if (next === last) next = Math.max(0, Math.min(7, last - step));      // at an edge of the octave, turn back
    deg.push(next);
  }
  const ms = deg.map(d => C[d]);
  return { id: "dict", kind: "dict", prompt: PROMPT.dict, answer: ms, options: [], events: ms.map((midi, i) => ({ t: i * 0.6, midi, dur: 0.7, vel: 0.8 })), lit: ms };
}
const ids = (s) => (s.kind === "mix" ? ["int:m3", "int:M3", "int:P4", "int:P5", "int:M6", "int:m7", "chord:maj", "chord:min", "chord:dim", "chord:aug", "mode:major", "mode:minor", "mode:dorian"] : (s.pool || []).map(p => `${s.kind}:${p}`));
const optionsOf = (s, id) => (s.kind === "mix" ? (id.startsWith("int") ? ids(s).filter(x => x.startsWith("int")) : id.startsWith("chord") ? ids(s).filter(x => x.startsWith("chord")) : ids(s).filter(x => x.startsWith("mode"))) : ids(s));
function next(s, v, env) {
  const kind = s.kind;
  if (kind === "hl" || kind === "dict") { v.q = buildQuestion(kind === "hl" ? "hl" : "dict", [], Math.random, { far: s.far, len: s.len }); v.taps = []; return; }
  const pool = ids(s), id = pickFrom(env.pile, pool, { last: v.q?.id });
  v.q = buildQuestion(id, optionsOf(s, id), Math.random, { harm: s.harm, down: s.down });
  v.q.events = v.q.events.map((e, i) => ({ ...e, bar: i }));
  v.missed = false;
}
const withBars = q => q.events.map((e, i) => ({ ...e, bar: i }));

export const earInst = {
  init(s, env) {
    const v = { n: 0, q: null, pick: null, hot: false, taps: [], missed: false, started: false, N: s.n || 5 };
    next(s, v, env);
    return v;
  },
  layout(s, v) {
    const q = v.q, listen = { id: "listen", x: 100, y: 52, w: 160, h: 42, text: v.started ? "▶ Again" : "▶ Listen", act: "listen" };
    const skip = { id: "skip", x: 10, y: 262, w: 150, h: 24, text: "Skip: I can't hear this", act: "skip", dim: true };
    if (q.kind === "dict") {
      const keys = keyLayout(60, 72, 10, 150, 340, 100);
      return { listen, skip, keys, undo: { id: "undo", x: 270, y: 112, w: 80, h: 28, text: "Undo", act: "undo" } };
    }
    const chips = flow(q.options.map(o => ({ id: o.id, text: o.text, w: Math.max(86, widthOf(o.text) + 8) })), 10, 116, 340, 8, 36);
    return { listen, skip, chips };
  },
  draw(s, v, t, env) {
    const L = this.layout(s, v), q = v.q, out = [];
    for (let i = 0; i < v.N; i++) out.push(`<circle cx="${f1(180 - (v.N - 1) * 8 + i * 16)}" cy="16" r="4.5" class="mu-dot${i < v.n ? " ok" : i === v.n ? " now" : ""}"/>`);
    out.push(text(180, 38, q.prompt, "mu-cap", "middle"));
    out.push(chip(L.listen));
    // the sound as dots in time, without pitch
    const n = q.events.length > 8 ? 8 : q.events.length, uniq = q.kind === "chord" ? q.events.length / 2 : n;
    const dots = q.kind === "chord" ? q.events.slice(0, uniq) : q.events;
    dots.forEach((e, i) => out.push(`<circle data-bar="${i}" class="mu-tone" cx="${f1(180 - (dots.length - 1) * 11 + i * 22)}" cy="104" r="6"/>`));
    if (q.kind === "dict") {
      const nn = q.answer.length;
      for (let i = 0; i < nn; i++) {
        const x = 10 + i * 46, m = i === 0 ? q.answer[0] : v.taps[i - 1];
        out.push(`<g class="mu-slot${m != null ? " full" : ""}"><rect x="${x}" y="112" width="40" height="28" rx="4"/>${m != null ? text(x + 20, 131, nameOf(spell(m)), "mu-chip-t", "middle") : ""}</g>`);
      }
      out.push(chip(L.undo));
      out.push(drawKeyboard({ keys: L.keys, labels: "names", hot: v.hot ? new Set(q.answer) : new Set(), lit: new Set([q.answer[0]]) }));
      out.push(text(180, 270, `The first note is given: ${fullName(spell(q.answer[0]))}. ${nn - 1} to play.`, "mu-cap", "middle"));
    } else {
      for (const c of L.chips) out.push(chip({ ...c, h: 36, on: v.pick === c.id, hot: v.hot && c.id === q.answer }));
    }
    out.push(chip(L.skip));
    return out.join("");
  },
  say(s, v, env) { v.started = true; playEvents(env, withBars(v.q)); },
  down(s, v, p, st, e, env) {
    const L = this.layout(s, v);
    if (inBox(L.listen, p)) { this.say(s, v, env); return "quiet"; }
    if (inBox(L.skip, p)) { env.answer({ ok: true, msg: "Skipped: it costs nothing." }); return "quiet"; }
    if (v.q.kind === "dict") {
      if (inBox(L.undo, p)) { v.taps.pop(); return true; }
      const k = keyAt(L.keys, p);
      if (!k || v.taps.length >= v.q.answer.length - 1) return false;
      env.audio.note(k.midi, env.audio.at(), 0.8, 0.85);
      v.taps.push(k.midi); v.hot = false; v.full = v.taps.length === v.q.answer.length - 1;
      return true;
    }
    const c = (L.chips || []).find(c => inBox(c, p));
    if (!c) return false;
    v.pick = c.id; v.hot = false;
    return true;
  },
  move: () => false,
  up(s, v, p, st, env) {
    const q = v.q;
    if (q.kind === "dict") {
      if (!v.full) return null;
      v.full = false;
      const got = [q.answer[0], ...v.taps], right = got.filter((m, i) => m === q.answer[i]).length;
      if (right === q.answer.length) return this.right(s, v, env, `That is the melody: ${q.answer.map(m => nameOf(spell(m))).join(" ")}.`);
      v.taps = [];
      env.later(() => this.say(s, v, env), 700);
      return { ok: false, why: `${right - 1} of ${q.answer.length - 1} notes right. Listen again and try the whole melody.` };
    }
    const pick = v.pick;
    v.pick = null;
    if (!pick) return null;
    if (pick === q.answer) return this.right(s, v, env, `Right: ${LABEL[q.answer]}.`);
    if (!v.missed) { v.missed = true; if (q.id !== "hl") env.note(q.id, false); }
    env.later(() => this.say(s, v, env), 600);
    return { ok: false, why: `Not ${LABEL[pick]}. Listen again.` };
  },
  right(s, v, env, msg) {
    const q = v.q;
    if (!v.missed && q.id !== "hl" && q.id !== "dict") env.note(q.id, true);
    v.n++; v.hot = false;
    if (v.n >= v.N) { v.n = v.N - 1; return { ok: true, msg: `${msg} All ${v.N} done.` }; }
    next(s, v, env);
    env.later(() => this.say(s, v, env), 900);
    return { ok: true, done: false, msg: `${msg} ${v.n} of ${v.N}.` };
  },
  ready: () => false,
  reveal(s, v) { v.hot = true; },
  leave(s, v) { v.hot = false; },
};
