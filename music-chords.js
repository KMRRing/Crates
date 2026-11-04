// The Music course's chord instruments: the chord builder (a root and a quality stacked in thirds, spelled and sounded), the
// progression builder (the chords of a key, played in the order you choose), and the little piece the last lesson plays.
import { W, H, f1, text, chip, inBox, flow, keyLayout, drawKeyboard } from "./music-draw.js";
import { chordNotes, chordName, voicing, CHORDS, IV_NAMES, keyChords, keyOf, midiOf, nameOf, note, LETTERS, intervalBetween, PROGRESSIONS } from "./music-theory.js";
import { playEvents, widthOf } from "./music-play.js";

const Q_LABEL = { maj: "major", min: "minor", dim: "dim", aug: "aug", maj7: "maj 7", dom7: "dom 7", min7: "min 7", hdim: "half-dim", dim7: "dim 7" };
const ROOTS = LETTERS.map((l, i) => ({ l, i }));
const rootOf = v => note(v.root, v.acc, 4);
/** The notes of a chord as a player would voice it, in the octave the keyboard shows (the root between middle C and the B above it). */
export const shown = (root, q) => voicing(root, q, 60);

// ---------- the chord builder ----------
function chordChips(s, v) {
  const out = [];
  if (!s.fixedRoot) {
    ROOTS.forEach((r, i) => out.push({ id: `r${i}`, root: i, x: 16 + i * 48, y: 6, w: 40, h: 28, text: r.l, on: v.root === i }));
    [["♭", -1], ["♮", 0], ["♯", 1]].forEach(([t, a], i) => out.push({ id: `a${a}`, acc: a, x: 16 + i * 48, y: 40, w: 40, h: 28, text: t, on: v.acc === a }));
  }
  const qs = s.qualities || ["maj", "min", "dim", "aug"], qx = s.fixedRoot ? 16 : 16, qy = s.fixedRoot ? 6 : 76;
  out.push(...flow(qs.map(q => ({ id: `q${q}`, q, w: 76, text: Q_LABEL[q], on: v.q === q })), qx, qy, 328, 6, 28));
  const by = s.fixedRoot ? 6 : 40;
  out.push({ id: "play", x: 16 + 3 * 48 + 10, y: by + (s.fixedRoot ? 38 + (qs.length > 4 ? 36 : 0) : 0), w: 76, h: 28, text: "▶ Chord", act: "block" });
  out.push({ id: "arp", x: 16 + 3 * 48 + 94, y: by + (s.fixedRoot ? 38 + (qs.length > 4 ? 36 : 0) : 0), w: 96, h: 28, text: "▶ One by one", act: "arp" });
  return out;
}
const chordEvents = (v, arp) => {
  const m = shown(rootOf(v), v.q);
  return arp ? m.map((midi, i) => ({ t: i * 0.3, midi, dur: 0.6, vel: 0.8 })).concat(m.map(midi => ({ t: m.length * 0.3 + 0.2, midi, dur: 1.6, vel: 0.7 }))) : m.map(midi => ({ t: 0, midi, dur: 1.7, vel: 0.8 }));
};
export const chordInst = {
  init: s => ({ root: s.fixedRoot ? s.fixedRoot[0] : 0, acc: s.fixedRoot ? s.fixedRoot[1] : 0, q: s.start || "maj", hot: false }),
  draw(s, v) {
    const out = [], chips = chordChips(s, v), r = rootOf(v), ns = chordNotes(r, v.q), ms = shown(r, v.q);
    for (const c of chips) out.push(chip({ ...c, hot: v.hot && s.goal && (c.q === s.goal.chord.q || (c.root !== undefined && c.root === s.goal.chord.root[0]) || (c.acc !== undefined && c.acc === s.goal.chord.root[1])) }));
    const ky = s.fixedRoot ? 150 : 124, kh = 82;
    const keys = keyLayout(60, 83, 10, ky, 340, kh);
    const mark = {};
    ms.forEach((m, i) => { mark[m] = nameOf(ns[i]); });
    out.push(drawKeyboard({ keys, labels: "none", on: new Set(ms), mark }));
    out.push(text(180, ky + kh + 22, ns.map(nameOf).join("  –  "), "mu-read", "middle"));
    const parts = CHORDS[v.q].ivs.map(iv => IV_NAMES[iv]);
    out.push(text(180, ky + kh + 40, `${nameOf(r)} ${CHORDS[v.q].name}: root, ${parts.join(", ")}`, "mu-cap", "middle"));
    return out.join("");
  },
  down(s, v, p, st, e, env) {
    const c = chordChips(s, v).find(c => inBox(c, p));
    if (!c) return false;
    v.hot = false;
    if (c.root !== undefined) v.root = c.root;
    else if (c.acc !== undefined) v.acc = c.acc;
    else if (c.q) v.q = c.q;
    if (c.act) playEvents(env, chordEvents(v, c.act === "arp"));
    else playEvents(env, chordEvents(v, false));
    return true;
  },
  move: () => false,
  up: () => null,
  ready: () => true,
  judge(s, v) {
    const g = s.goal.chord, want = ((midiOf(note(g.root[0], g.root[1], 4)) % 12) + 12) % 12, got = (midiOf(rootOf(v)) % 12 + 12) % 12;
    if (want === got && v.q === g.q) return { ok: true, msg: s.goal.msg || `Right: ${chordName(rootOf(v), v.q)}.` };
    return { ok: false, why: want === got ? `Right root, but ${CHORDS[v.q].name} is not the quality asked for.` : v.q === g.q ? "Right quality, wrong root." : `${chordName(rootOf(v), v.q)} is not it.` };
  },
  reveal(s, v) { const g = s.goal.chord; v.root = g.root[0]; v.acc = g.root[1]; v.q = g.q; v.hot = true; },
};

// ---------- the chords of a key, in the order you choose ----------
const PK = { y: 190, h: 66 };
function progLayout(s, v) {
  const cs = keyChords(keyOf(s.key || "C"), !!s.minor, !!s.sevenths), nums = cs.map((c, i) => ({ id: `n${i}`, deg: i + 1, x: 10 + i * 49.5, y: 6, w: 44, h: 46, c }));
  const slots = Array.from({ length: s.slots || 4 }, (_, i) => ({ x: 10 + i * (340 / (s.slots || 4)), y: 66, w: 340 / (s.slots || 4) - 6, h: 44, i }));
  const presets = (s.presets || []).map((p, i) => ({ id: `p${i}`, text: p, w: widthOf(p) + 8, preset: p }));
  const prow = flow(presets, 10, 118, 340, 6, 26), py = prow.length ? Math.max(...prow.map(c => c.y)) + 32 : 118;
  const btns = [{ id: "play", x: 10, y: py, w: 120, h: 28, text: "▶ Play them", act: "play" }, { id: "clear", x: 138, y: py, w: 70, h: 28, text: "Clear", act: "clear" }];
  return { cs, nums, slots, prow, btns, ky: py + 40 };
}
const progEvents = (cs, degs) => degs.flatMap((d, bar) => {
  const c = cs[d - 1], ms = voicing(c.root, c.quality, 48);
  return [{ t: bar * 1.1, midi: ms[0] - 12, dur: 1.0, vel: 0.7, bar }, ...ms.map(midi => ({ t: bar * 1.1, midi, dur: 1.0, vel: 0.75, bar }))];
});
export const progInst = {
  init: s => ({ seq: s.start ? [...s.start] : [], hot: false }),
  draw(s, v) {
    const L = progLayout(s, v), out = [];
    for (const n of L.nums) {
      out.push(`<g class="mu-chip${v.hot && s.goal?.prog.includes(n.deg) ? " hot" : ""}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4"/>${text(n.x + n.w / 2, n.y + 20, n.c.numeral, "mu-chip-t", "middle")}${text(n.x + n.w / 2, n.y + 37, nameOf(n.c.root) + (n.c.quality === "min" ? "m" : n.c.quality === "dim" ? "°" : ""), "mu-cap", "middle")}</g>`);
    }
    for (const sl of L.slots) {
      const d = v.seq[sl.i], c = d && L.cs[d - 1];
      out.push(`<g class="mu-slot${c ? " full" : ""}" data-bar="${sl.i}"><rect x="${f1(sl.x)}" y="${sl.y}" width="${f1(sl.w)}" height="${sl.h}" rx="4"/>${c ? text(sl.x + sl.w / 2, sl.y + 20, c.numeral, "mu-read sm", "middle") + text(sl.x + sl.w / 2, sl.y + 36, nameOf(c.root) + (c.quality === "min" ? "m" : c.quality === "dim" ? "°" : ""), "mu-cap", "middle") : text(sl.x + sl.w / 2, sl.y + 27, `${sl.i + 1}`, "mu-cap", "middle")}</g>`);
    }
    for (const c of [...L.prow, ...L.btns]) out.push(chip(c));
    const keys = keyLayout(48, 72, 10, L.ky, 340, H - 8 - L.ky);
    out.push(drawKeyboard({ keys, labels: "none" }));
    return out.join("");
  },
  down(s, v, p, st, e, env) {
    const L = progLayout(s, v);
    v.hot = false;
    const n = L.nums.find(c => inBox(c, p));
    if (n) {
      const c = n.c, ms = voicing(c.root, c.quality, 48);
      playEvents(env, ms.map(midi => ({ t: 0, midi, dur: 1.2, vel: 0.8 })));
      if (v.seq.length < L.slots.length) v.seq.push(n.deg);
      return true;
    }
    const b = [...L.btns, ...L.prow].find(c => inBox(c, p));
    if (!b) return false;
    if (b.act === "clear") v.seq = [];
    else if (b.act === "play") { if (v.seq.length) playEvents(env, progEvents(L.cs, v.seq)); }
    else if (b.preset) { v.seq = [...PROGRESSIONS[b.preset]].slice(0, L.slots.length); playEvents(env, progEvents(L.cs, v.seq)); }
    return true;
  },
  move: () => false,
  up: () => null,
  ready: (s, v) => !!s.goal && v.seq.length >= s.goal.prog.length,
  judge(s, v) {
    const want = s.goal.prog;
    return want.length === v.seq.length && want.every((d, i) => d === v.seq[i]) ? { ok: true, msg: s.goal.msg || "Right." }
      : { ok: false, why: `That is ${v.seq.join(" – ")}. Check the order of the numerals.` };
  },
  reveal(s, v) { v.seq = [...s.goal.prog]; v.hot = true; },
};

// ---------- the little piece ----------
/** Events of a piece: { bpm, key, chords (degrees), melody (per bar: [beat, midi, beats]) }; bar numbers ride on the events to light the bars. */
export function pieceEvents(p) {
  const cs = keyChords(keyOf(p.key)), beat = 60 / p.bpm, out = [];
  p.chords.forEach((d, bar) => {
    const c = cs[d - 1], ms = voicing(c.root, c.quality, 48), t = bar * 4 * beat;
    out.push({ t, midi: ms[0] - 12, dur: 3.6 * beat, vel: 0.55, bar });
    ms.forEach(midi => out.push({ t, midi, dur: 3.4 * beat, vel: 0.4, bar }));
    for (const [b, midi, len] of p.melody[bar]) out.push({ t: t + b * beat, midi, dur: len * beat * 0.95, vel: 0.85, bar });
  });
  return out;
}
export const pieceInst = {
  init: () => ({ playing: false }),
  draw(s, v) {
    const p = s.piece, cs = keyChords(keyOf(p.key)), out = [], cw = 82, ch = 52;
    out.push(chip({ x: 10, y: 6, w: 100, h: 28, text: "▶ Play it", on: false }));
    out.push(text(350, 24, `${p.sig} · ${p.bpm} BPM · ${p.key} major`, "mu-cap", "end"));
    p.chords.forEach((d, i) => {
      const c = cs[d - 1], x = 10 + (i % 4) * (cw + 4), y = 46 + Math.floor(i / 4) * (ch + 6);
      out.push(`<g class="mu-slot full" data-bar="${i}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="4"/>${text(x + cw / 2, y + 22, c.numeral, "mu-read sm", "middle")}${text(x + cw / 2, y + 40, nameOf(c.root) + (c.quality === "min" ? "m" : ""), "mu-cap", "middle")}</g>`);
    });
    out.push(drawKeyboard({ keys: keyLayout(48, 84, 10, 176, 340, 106), labels: "none" }));
    return out.join("");
  },
  down(s, v, p, st, e, env) {
    if (!inBox({ x: 10, y: 6, w: 100, h: 28 }, p)) return false;
    playEvents(env, pieceEvents(s.piece));
    return "quiet";
  },
  move: () => false,
  up: () => null,
  ready: () => true,
  reveal() {},
};
delete pieceInst.reveal;
