// The Music course's notation and keyboard instruments: the keyboard (with a staff that writes down what you play), the staff you tap to
// place a note, the note-naming drill, and the circle of fifths. An instrument is { init, draw, down, move, up, ready, judge, reveal }
// (music-stage.js): `down` returns true to take the pointer ("quiet": without a redraw), `up` returns a verdict { ok, msg | why, done } or null.
import { W, H, f1, text, line, chip, inBox, flow, keyLayout, keyAt, drawKeyboard, staffFrame, staffNotes, esc } from "./music-draw.js";
import { parse, midiOf, spell, nameOf, fullName, freq, noteAtStep, staffStep, signatureLetters, CIRCLE, scale, signatureOf, note, LETTERS, LINE_NAMES, isBlack } from "./music-theory.js";
import { demoChips, demoSvg, demoHit, playDemo, widthOf } from "./music-play.js";

const hz = m => `${Math.round(freq(m) * 100) / 100}`.replace(/\.0+$/, "");
const play = (env, m, hold = 1.1, vel = 0.85) => env.audio.note(m, env.audio.at(), hold, vel);
const nm = (m, flats) => fullName(spell(m, flats));
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// ---------- the keyboard ----------
function keysLayout(s) {
  const lo = midiOf(parse(s.range?.[0] ?? "C4")), hi = midiOf(parse(s.range?.[1] ?? "B5")), chips = demoChips(s.demo);
  const bottom = chips.length ? Math.max(...chips.map(c => c.y + c.h)) + 6 : 4, readY = bottom + 14;
  const staffH = s.staff === "grand" ? 98 : s.staff ? 70 : 0, top = readY + 6, kTop = s.staff ? top + staffH + 4 : top + 6;
  return { lo, hi, chips, readY, top, staffH, keys: keyLayout(lo, hi, 10, kTop, 340, H - 6 - kTop) };
}
/** The staff above a keyboard, with `midis` written on it. */
function miniStaff(s, lay, midis) {
  const out = [], flats = !!s.flats, sp = s.staff === "grand" ? 6.4 : 7.4;
  const frames = s.staff === "grand" ? [["treble", lay.top + 12], ["bass", lay.top + 12 + 4 * sp + 20]] : [[s.staff, lay.top + 18]];
  const gs = frames.map(([clef, y]) => ({ clef, x: 10, y, w: 340, s: sp }));
  const fs = gs.map(g => staffFrame(g));
  fs.forEach(f => out.push(f.svg));
  const n = midis.length, first = Math.max(...gs.map(g => g.x + g.s * 3.3)) + (s.sig ? Math.abs(s.sig) * sp * 0.75 + 6 : 6);
  const step = n ? Math.min(30, (350 - first) / n) : 30;
  gs.forEach((g, gi) => {
    const mine = midis.map((m, i) => ({ m, i })).filter(({ m }) => (s.staff === "grand" ? (m >= 60) === (gi === 0) : true));
    out.push(staffNotes(fs[gi], g, mine.map(({ m, i }) => ({ n: spell(m, flats), x: first + step * (i + 0.5), acc: true })), s.sig || 0));
  });
  return out.join("");
}
export const keysInst = {
  init: () => ({ last: null, sel: new Set(), seq: [], hot: new Set(), glide: false, chip: false }),
  draw(s, v) {
    const lay = keysLayout(s), out = [], flats = !!s.flats, g = s.goal, setMode = !!g?.set;
    const on = new Set(setMode ? v.sel : v.last != null ? [v.last] : []), lit = new Set((s.lit || []).concat(s.litC ? lay.keys.filter(k => !k.black && k.midi % 12 === 0).map(k => k.midi) : []));
    out.push(demoSvg(lay.chips));
    const readText = v.last != null && s.readout !== false ? `${nm(v.last, flats)}  ·  ${hz(v.last)} Hz` : s.prompt || (g ? "" : "Tap the keys");
    out.push(text(10, lay.readY, readText, "mu-read"));
    if (s.seqShow && g?.seq) out.push(text(350, lay.readY, `${v.seq.length} of ${g.seq.length}`, "mu-cap", "end"));
    if (s.staff) out.push(miniStaff(s, lay, setMode ? [...v.sel].sort((a, b) => a - b) : v.last != null ? [v.last] : (s.shown || [])));
    out.push(drawKeyboard({ keys: lay.keys, labels: s.labels || "c", on, lit, hot: v.hot, flats, mark: s.mark }));
    return out.join("");
  },
  down(s, v, p, st, e, env) {
    const lay = keysLayout(s), c = demoHit(lay.chips, p);
    v.chip = false;
    if (c) { v.chip = true; playDemo(env, s.demo[c.demo]); return "quiet"; }
    const k = keyAt(lay.keys, p);
    if (!k) return false;
    v.glide = true; v.cur = k.midi; v.last = k.midi; v.hot = new Set();
    play(env, k.midi);
    if (s.goal?.set) { if (v.sel.has(k.midi)) v.sel.delete(k.midi); else v.sel.add(k.midi); }
    return true;
  },
  move(s, v, p, st, env) {
    if (!v.glide || s.goal) return false;
    const k = keyAt(keysLayout(s).keys, p);
    if (!k || k.midi === v.cur) return false;
    v.cur = k.midi; v.last = k.midi;
    play(env, k.midi);
    return true;
  },
  up(s, v, p, st, env) {
    const wasKey = v.glide;
    v.glide = false;
    const g = s.goal;
    if (!g || !wasKey || g.set) return null;
    const m = v.last, label = nm(m, s.flats);
    if (g.tap !== undefined) {
      const want = [].concat(g.tap), ok = want.some(w => (g.pc ? ((w % 12) + 12) % 12 === ((m % 12) + 12) % 12 : w === m));
      return ok ? { ok: true, msg: g.msg || `Right: ${label}.` } : { ok: false, why: g.why || `That was ${label}. Not the one.` };
    }
    if (g.seq) {
      const want = g.seq[v.seq.length];
      if (m === want || (g.pc && (((m - want) % 12) + 12) % 12 === 0)) {
        v.seq.push(m);
        if (v.seq.length === g.seq.length) return { ok: true, msg: g.msg || "Played in order." };
        return { ok: true, done: false, msg: `${label}: ${v.seq.length} of ${g.seq.length}.` };
      }
      v.seq = [];
      return { ok: false, why: `That was ${label}. Start again from the first note.` };
    }
    return null;
  },
  submits: s => !!s.goal?.set,
  ready: (s, v) => v.sel.size > 0,
  judge(s, v) {
    const g = s.goal, got = [...v.sel], want = g.set;
    const ok = g.pc ? same([...new Set(got.map(m => ((m % 12) + 12) % 12))], [...new Set(want.map(m => m % 12))]) : same(got, want);
    if (ok) return { ok: true, msg: g.msg || "Right." };
    const names = ms => ms.sort((a, b) => a - b).map(m => nameOf(spell(m, s.flats))).join(" ");
    const extra = got.filter(m => !(g.pc ? want.map(w => w % 12).includes(m % 12) : want.includes(m))), miss = want.filter(w => !(g.pc ? got.map(m => m % 12).includes(w % 12) : got.includes(w)));
    return { ok: false, why: `${extra.length ? `Not part of it: ${names(extra)}. ` : ""}${miss.length ? `${miss.length} note${miss.length > 1 ? "s" : ""} missing.` : ""}`.trim() || "Not quite." };
  },
  reveal(s, v) {
    const g = s.goal, lay = keysLayout(s);
    const want = g.set || g.seq || (g.tap !== undefined ? [].concat(g.tap) : []);
    v.hot = new Set(g.pc ? lay.keys.filter(k => want.some(w => ((w - k.midi) % 12 + 12) % 12 === 0)).map(k => k.midi) : want);
  },
};

// ---------- the staff, to tap ----------
const STAFF = { x: 10, w: 340 };
function staffGeom(s) {
  if (s.clef === "grand") return [{ clef: "treble", ...STAFF, y: 42, s: 10 }, { clef: "bass", ...STAFF, y: 124, s: 10 }];
  return [{ clef: s.clef, ...STAFF, y: 96, s: 15 }];
}
/** The natural note at a step, with the key signature applied. */
const withSig = (n, sig) => (signatureLetters(sig).includes(LETTERS[n.l]) ? { ...n, a: sig > 0 ? 1 : -1 } : n);
export const staffInst = {
  init: () => ({ placed: null, drag: false }),
  draw(s, v) {
    const gs = staffGeom(s), out = [], fs = gs.map(g => staffFrame(g));
    fs.forEach(f => out.push(f.svg));
    const sig = s.sig || 0;
    gs.forEach((g, i) => {
      const items = [];
      for (const n of s.notes || []) {
        const m = typeof n === "number" ? spell(n, s.flats) : typeof n === "string" ? parse(n) : n;
        if (s.clef === "grand" ? (midiOf(m) >= 60) === (i === 0) : true) items.push({ n: m, x: 0, acc: true, cls: "given" });
      }
      if (v.placed && v.placed.clef === g.clef) items.push({ n: withSig(noteAtStep(v.placed.step, g.clef), sig), x: 0, cls: "placed" });
      // given notes in a row, the placed one at the right
      const gx = g.x + g.s * 3.3 + Math.abs(sig) * g.s * 0.75 + g.s * 3.2, per = Math.min(34, (g.x + g.w - gx - 20) / Math.max(1, items.length));
      items.forEach((it, k) => { it.x = it.cls === "placed" ? g.x + g.w - 40 : gx + per * k; });
      out.push(staffNotes(fs[i], g, items, sig));
    });
    const p = v.placed ? withSig(noteAtStep(v.placed.step, v.placed.clef), sig) : null;
    out.push(text(10, 22, p ? fullName(p) : s.prompt || "Tap a line or a space", "mu-read"));
    if (s.caption) out.push(text(350, 22, s.caption, "mu-cap", "end"));
    if (v.hot) {
      const g = gs.find(x => x.clef === (v.hot.clef || gs[0].clef)) || gs[0], f = fs[gs.indexOf(g)];
      out.push(`<circle cx="${f1(g.x + g.w - 40)}" cy="${f1(f.yOf(v.hot.step))}" r="${f1(g.s * 0.95)}" class="mu-ring"/>`);
    }
    return out.join("");
  },
  at(s, p) {
    const gs = staffGeom(s), fs = gs.map(g => staffFrame(g));
    let gi = 0;
    if (gs.length === 2) gi = Math.abs(p.y - (fs[0].bottom + 12)) < Math.abs(p.y - (gs[1].y - 12)) ? 0 : 1;
    const step = Math.max(-6, Math.min(14, fs[gi].step(p.y)));
    return { clef: gs[gi].clef, step };
  },
  down(s, v, p, st, e, env) {
    v.placed = this.at(s, p); v.drag = true; v.hot = null;
    const n = withSig(noteAtStep(v.placed.step, v.placed.clef), s.sig || 0);
    play(env, midiOf(n), 1);
    return true;
  },
  move(s, v, p, st, env) {
    if (!v.drag) return false;
    const was = v.placed, next = this.at(s, p);
    if (was.step === next.step && was.clef === next.clef) return false;
    v.placed = next;
    play(env, midiOf(withSig(noteAtStep(next.step, next.clef), s.sig || 0)), 0.8, 0.7);
    return true;
  },
  up(s, v) {
    v.drag = false;
    const g = s.goal;
    if (!g?.place || !v.placed) return null;
    const want = parse(g.place), got = noteAtStep(v.placed.step, v.placed.clef);
    return got.l === want.l && got.o === want.o ? { ok: true, msg: g.msg || `Right: ${g.place.replace(/[#b]/, c => (c === "#" ? "♯" : "♭"))}.` }
      : { ok: false, why: `That is ${fullName(got)}.` };
  },
  ready: () => false,
  judge: null,
  reveal(s, v) { const want = parse(s.goal.place); const gs = staffGeom(s); const clef = gs.length === 2 ? (midiOf(want) >= 60 ? "treble" : "bass") : gs[0].clef; v.hot = { clef, step: staffStep(want, clef) }; v.placed = { clef, step: staffStep(want, clef) }; },
};
// a step with a goal needs `judge` only if it has a Check button: the stage asks `submits(s)`, so staff (judged on release) has none
delete staffInst.judge;

// ---------- naming the notes ----------
const RANGES = { treble: [-2, 10], bass: [-2, 10] };
export const readInst = {
  init(s) {
    const pool = s.steps || Array.from({ length: (RANGES[s.clef][1] - RANGES[s.clef][0]) + 1 }, (_, i) => RANGES[s.clef][0] + i), n = s.n || 6, qs = [];
    let last = null;
    for (let i = 0; i < n; i++) {
      const choices = pool.filter(x => x !== last);
      last = choices[Math.floor(Math.random() * choices.length)];
      qs.push(last);
    }
    return { qs, i: 0, pick: null, hot: false, shown: false };
  },
  chips: () => LETTERS.map((l, i) => ({ x: 10 + i * 49.5, y: 232, w: 43, h: 40, text: l, l })),
  draw(s, v) {
    const g = { clef: s.clef, x: 10, y: 96, w: 340, s: 15 }, f = staffFrame(g), out = [f.svg];
    const step = v.qs[Math.min(v.i, v.qs.length - 1)], n = noteAtStep(step, s.clef);
    out.push(staffNotes(f, g, [{ n, x: 190, cls: "given" }], 0));
    for (let i = 0; i < v.qs.length; i++) out.push(`<circle cx="${f1(180 - (v.qs.length - 1) * 8 + i * 16)}" cy="22" r="4.5" class="mu-dot${i < v.i ? " ok" : i === v.i ? " now" : ""}"/>`);
    out.push(text(180, 50, "Which note is it?", "mu-cap", "middle"));
    const right = LETTERS[n.l];
    for (const c of this.chips()) out.push(chip({ ...c, on: v.pick === c.l, hot: v.hot && c.l === right }));
    return out.join("");
  },
  down(s, v, p) { const c = this.chips().find(c => inBox(c, p)); if (!c) return false; v.pick = c.l; return true; },
  move: () => false,
  up(s, v, p, st, env) {
    const step = v.qs[v.i], n = noteAtStep(step, s.clef), pick = v.pick;
    v.pick = null;
    if (!pick) return null;
    if (pick !== LETTERS[n.l]) return { ok: false, why: `That is not ${pick}: it is the ${step % 2 ? "space" : "line"} you would count as ${LETTERS[n.l]}. Count up from ${s.clef === "treble" ? "E on the bottom line" : "G on the bottom line"}.` };
    play(env, midiOf(n), 0.9);
    v.i++; v.hot = false;
    if (v.i >= v.qs.length) { v.i = v.qs.length - 1; return { ok: true, msg: `All ${v.qs.length} named.` }; }
    return { ok: true, done: false, msg: `Right: ${LETTERS[n.l]}. ${v.i} of ${v.qs.length}.` };
  },
  ready: () => false,
  reveal(s, v) { v.hot = true; },
};
delete readInst.judge;

// ---------- the circle of fifths ----------
const CC = { x: 180, y: 126, R: 112, r1: 78, r0: 46 };
const arc = (r0, r1, a0, a1) => {
  const p = (r, a) => [CC.x + r * Math.sin(a * Math.PI / 180), CC.y - r * Math.cos(a * Math.PI / 180)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${f1(x0)} ${f1(y0)}A${r1} ${r1} 0 0 1 ${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}A${r0} ${r0} 0 0 0 ${f1(x3)} ${f1(y3)}Z`;
};
const sigText = n => (n === 0 ? "no ♯ or ♭" : `${Math.abs(n)} ${n > 0 ? "sharp" : "flat"}${Math.abs(n) > 1 ? "s" : ""}`);
export const circleInst = {
  init: () => ({ sel: null, minor: false, hot: null }),
  draw(s, v) {
    const out = [];
    CIRCLE.forEach((k, i) => {
      const a0 = i * 30 - 15, a1 = a0 + 30, mid = i * 30, on = v.sel === i;
      const lp = (r, a) => [CC.x + r * Math.sin(a * Math.PI / 180), CC.y - r * Math.cos(a * Math.PI / 180)];
      const [mx, my] = lp((CC.R + CC.r1) / 2, mid), [nx, ny] = lp((CC.r1 + CC.r0) / 2, mid);
      out.push(`<path d="${arc(CC.r1, CC.R, a0, a1)}" class="mu-wedge${on && !v.minor ? " on" : ""}${v.hot?.i === i && v.hot.ring === "major" ? " hot" : ""}" data-i="${i}"/>`);
      out.push(`<path d="${arc(CC.r0, CC.r1, a0, a1)}" class="mu-wedge minor${on && v.minor ? " on" : ""}${v.hot?.i === i && v.hot.ring === "minor" ? " hot" : ""}" data-i="${i}"/>`);
      out.push(text(mx, my + 5, i === 6 ? "F♯" : k.major, "mu-wedge-t", "middle"), text(nx, ny + 4, i === 6 ? "d♯" : `${k.minor[0].toLowerCase()}${k.minor.slice(1)}`, "mu-wedge-t small", "middle"));
    });
    if (v.sel !== null && !s.hideSig) {
      const k = CIRCLE[v.sel], sc = scale(v.minor ? k.minorTonic : k.tonic, v.minor ? "minor" : "major").map(n => nameOf(n)).slice(0, 7);
      out.push(text(CC.x, CC.y - 10, `${v.minor ? k.minor + " minor" : k.major + " major"}`, "mu-read sm", "middle"), text(CC.x, CC.y + 7, sigText(k.sig), "mu-cap", "middle"));
      out.push(text(CC.x, 258, sc.join("  "), "mu-read sm", "middle"));
      out.push(text(CC.x, 276, k.letters.length ? `${k.sig > 0 ? "♯" : "♭"} on ${k.letters.join(" ")}` : "all the white keys", "mu-cap", "middle"));
    } else out.push(text(CC.x, CC.y + 5, s.centre || "Tap a key", "mu-cap", "middle"));
    return out.join("");
  },
  at(p) {
    const dx = p.x - CC.x, dy = CC.y - p.y, r = Math.hypot(dx, dy);
    if (r < CC.r0 || r > CC.R) return null;
    const a = (Math.atan2(dx, dy) * 180 / Math.PI + 360 + 15) % 360;
    return { i: Math.floor(a / 30) % 12, ring: r > CC.r1 ? "major" : "minor" };
  },
  down(s, v, p, st, e, env) {
    const hit = this.at(p);
    if (!hit) return false;
    v.sel = hit.i; v.minor = hit.ring === "minor"; v.hit = hit; v.hot = null;
    const k = CIRCLE[hit.i], sc = scale(v.minor ? k.minorTonic : k.tonic, v.minor ? "minor" : "major"), start = env.audio.at();
    env.audio.silence();
    env.audio.play(sc.map((n, j) => ({ t: j * 0.18, midi: midiOf(n), dur: 0.3, vel: 0.7 })), start);
    return true;
  },
  move: () => false,
  up(s, v) {
    const g = s.goal, hit = v.hit;
    v.hit = null;
    if (!g || !hit) return null;
    const k = CIRCLE[hit.i];
    const ok = g.sig !== undefined ? k.sig === g.sig && hit.ring === (g.ring || "major") : g.key !== undefined ? hit.i === g.key && hit.ring === (g.ring || "major") : false;
    return ok ? { ok: true, msg: g.msg || `Right: ${hit.ring === "major" ? k.major + " major" : k.minor + " minor"}, ${sigText(k.sig)}.` }
      : { ok: false, why: `${hit.ring === "major" ? k.major + " major" : k.minor + " minor"} has ${sigText(k.sig)}.` };
  },
  ready: () => false,
  reveal(s, v) {
    const g = s.goal, i = g.key !== undefined ? g.key : CIRCLE.findIndex(k => k.sig === g.sig || (g.sig === 6 && k.sig === 6));
    v.hot = { i, ring: g.ring || "major" };
  },
};
delete circleInst.judge;
