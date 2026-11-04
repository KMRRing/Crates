// The Music course's time instruments. `beat`: a metronome with accents (the bar drawn as pulses that flash as they sound), a tempo slider,
// subdivisions, and the graded exercises - tap a pattern against the click (graded on timing, after the reader's calibration), and the
// calibration itself. `dyn`: the dynamics from pp to ff. All timing is on the audio clock (music-rhythm.js); the drawing only follows it.
import { f1, text, chip, inBox, slider, sliderHit, W } from "./music-draw.js";
import { METERS, strengths, tempoName, DYNAMICS, midiOf, parse } from "./music-theory.js";
import { pulseSec, gradeTaps, patternTimes, calibrationOffset, PERFECT, GOOD } from "./music-rhythm.js";
import { playEvents } from "./music-play.js";

const COUNTS = { 1: n => String(n + 1), 2: (n, w) => (w ? "&" : String(n + 1)), 4: (n, w) => ["", "e", "&", "a"][w] || String(n + 1) };
const ms = sec => `${Math.abs(Math.round(sec * 1000))} ms ${sec < 0 ? "early" : "late"}`;
const SLIDER = { x1: 24, x2: 336, y: 196, min: 40, max: 200, step: 2 };
const PAD = { x: 10, y: 218, w: 340, h: 64 };
const CAL = { bpm: 76, lead: 4, clicks: 8 };

function cfgOf(s, v) { return { bpm: v.bpm, sig: v.sig, sub: v.sub, click: true, ticks: v.sub > 1 && !s.tap && !s.calib }; }
function cellsOf(s, v) {
  const per = METERS[v.sig].beats * v.sub, n = s.pattern ? s.pattern.length : per, cw = Math.min(40, 336 / n);
  return { per, n, cw, x0: 180 - (n * cw) / 2 };
}
function chipsOf(s, v) {
  const out = [{ id: "start", x: 10, y: 6, w: 86, h: 28, text: v.phase === "idle" || v.phase === "done" ? (s.tap || s.calib ? "▶ Start" : "▶ Play") : "■ Stop", act: "start", on: v.phase === "count" || v.phase === "play" || v.phase === "run" }];
  let x = 104;
  if (s.hear) { out.push({ id: "hear", x, y: 6, w: 76, h: 28, text: "▶ Hear it", act: "hear" }); x += 84; }
  if (s.meters) for (const m of s.meters) { out.push({ id: `m${m}`, x, y: 6, w: 40, h: 28, text: m, sig: m, on: v.sig === m }); x += 46; }
  if (s.subs) { out.push({ id: "s1", x, y: 6, w: 40, h: 28, text: "♩", sub: 1, on: v.sub === 1 }, { id: "s2", x: x + 46, y: 6, w: 48, h: 28, text: "♪♪", sub: 2, on: v.sub === 2 }); }
  if (s.goal) out.push({ id: "skip", x: 262, y: 40, w: 88, h: 24, text: "Skip: can't hear", act: "skip", dim: true });
  return out;
}
export const beatInst = {
  init: s => ({ sig: s.sig || "4/4", sub: s.sub || 1, bpm: s.bpm || 80, phase: "idle", taps: [], plan: null, result: null, cur: -1, status: "" }),
  draw(s, v, t, env) {
    const out = [], c = cellsOf(s, v), st = strengths(v.sig);
    for (const k of chipsOf(s, v)) out.push(chip(k));
    // the pattern (what to play) above, the pulses (the click) below
    const lat = env.audio.latency();
    for (let i = 0; i < c.n; i++) {
      const x = c.x0 + (i + 0.5) * c.cw, inBar = i % c.per, beat = Math.floor(inBar / v.sub), w = inBar % v.sub, level = w === 0 ? st[beat] : -1;
      const hit = s.pattern ? s.pattern[i] === "x" : level >= 0;
      const verdict = v.result?.cells?.[i];
      out.push(`<g class="mu-cell${hit ? " hit" : ""}${verdict ? " " + verdict : ""}" data-pulse="${i}">`
        + (s.pattern ? `<circle cx="${f1(x)}" cy="86" r="${f1(Math.min(13, c.cw * 0.34))}" class="mu-pulse${hit ? " on" : ""}"/>` : `<circle cx="${f1(x)}" cy="86" r="${level === 2 ? 17 : level === 1 ? 13 : level === 0 ? 9 : 5}" class="mu-pulse on${level === 2 ? " strong" : ""}"/>`)
        + `<path d="M${f1(x)} 116V${f1(124)}" class="mu-cellmark${w === 0 ? " beat" : ""}"/>${text(x, 140, (COUNTS[v.sub] || COUNTS[1])(beat, w), `mu-count${w === 0 ? " beat" : ""}`, "middle")}</g>`);
      if (inBar === 0 && i > 0) out.push(`<path d="M${f1(c.x0 + i * c.cw)} 66V150" class="mu-barline"/>`);
    }
    out.push(text(10, 170, v.status || s.prompt || (s.tap ? "Tap the dots when the click reaches them" : ""), "mu-cap mu-status", ""));
    if (s.slider) out.push(slider({ ...SLIDER, value: v.bpm, label: "Tempo", show: `${v.bpm} BPM${s.names ? " · " + tempoName(v.bpm) : ""}` }));
    if (s.tap || s.calib) {
      out.push(`<rect class="mu-pad" x="${PAD.x}" y="${PAD.y}" width="${PAD.w}" height="${PAD.h}" rx="8"/>${text(180, PAD.y + 38, "TAP", "mu-padt", "middle")}`);
      if (s.calib) out.push(text(10, 208, `Your device reports: output ${lat.output != null ? Math.round(lat.output * 1000) + " ms" : "n/a"}, base ${lat.base != null ? Math.round(lat.base * 1000) + " ms" : "n/a"}. Saved offset: ${Math.round(env.calib * 1000)} ms`, "mu-cap"));
    }
    if (v.result) out.push(text(10, s.tap || s.calib ? 190 : 190, v.result.line, "mu-read sm"));
    return out.join("");
  },
  stop(v, env) { env.loop.stop(); v.phase = "idle"; v.status = ""; },
  start(s, v, env) {
    const a = env.audio, t0 = a.at(0.05);
    v.result = null; v.taps = []; v.cur = -1;
    if (s.calib) {
      const beat = pulseSec(CAL.bpm), clicks = Array.from({ length: CAL.clicks }, (_, i) => t0 + (CAL.lead + i) * beat);
      v.plan = { clicks }; v.phase = "count"; v.status = "Count in…";
      env.loop.start({ bpm: CAL.bpm, sig: "4/4", sub: 1, click: true, pulses: CAL.lead + CAL.clicks }, t0, () => this.finish(s, v, env));
    } else if (s.tap) {
      const c = cellsOf(s, v), count = (s.tap.count ?? 1) * c.per, bars = s.tap.bars ?? 2, total = count + bars * c.n;
      v.plan = { t0, count, expected: patternTimes(s.pattern, t0 + count * pulseSec(v.bpm, v.sub), v.bpm, v.sub, 0, bars * c.n) };
      v.phase = "count"; v.status = "Count in…";
      env.loop.start({ ...cfgOf(s, v), pulses: total }, t0, () => this.finish(s, v, env));
    } else {
      v.phase = "run";
      env.loop.start({ ...cfgOf(s, v), pattern: s.pattern || "", hit: s.hit != null ? midiOf(parse(s.hit)) : null }, t0);
    }
  },
  finish(s, v, env) {
    const taps = v.taps.map(t => t - env.calib * (s.calib ? 0 : 1));
    v.phase = "done"; v.status = "";
    if (s.calib) {
      const off = calibrationOffset(v.plan.clicks, v.taps);
      if (off === null) { v.result = { line: "Too few taps heard." }; env.answer({ ok: false, why: `I heard ${v.taps.length} taps; tap on each click, at least 5 times. Try again.` }); return; }
      env.setCalib(off);
      v.result = { line: `Your taps land ${ms(off)}.` };
      env.answer({ ok: true, msg: `Your taps land ${ms(off)} the click, on average. Saved: later exercises allow for it.` });
      return;
    }
    const g = gradeTaps(v.plan.expected, taps), c = cellsOf(s, v);
    // which cell of the pattern each expected hit belongs to, so the result colours the pattern (a cell is "miss" if any bar missed it)
    const cells = {}; let k = 0;
    for (let i = 0; i < s.tap.bars * c.n; i++) if (s.pattern[i % c.n] === "x") { const cell = i % c.n, ok = g.rows[k++].grade !== "miss"; cells[cell] = cells[cell] === "miss" || !ok ? "miss" : "ok"; }
    const late = g.mean;
    v.result = { cells, line: `${g.hits} of ${g.rows.length} close · ${Math.abs(late) < 0.01 ? "dead on average" : "average " + ms(late)}` };
    env.answer(g.pass ? { ok: true, msg: `${g.hits} of ${g.rows.length} within ${Math.round(GOOD * 1000)} ms${g.extras ? `, ${g.extras} extra tap${g.extras > 1 ? "s" : ""}` : ""}.` }
      : { ok: false, why: `${g.hits} of ${g.rows.length} close${g.extras > 1 ? `, ${g.extras} extra taps` : ""}. ${Math.abs(late) > 0.03 ? `You were ${ms(late)} on average. ` : ""}Listen to the click and try again.` });
  },
  down(s, v, p, st, e, env) {
    const a = env.audio;
    const c = chipsOf(s, v).find(k => inBox(k, p));
    if (c) {
      if (c.act === "start") { if (v.phase === "count" || v.phase === "play" || v.phase === "run") this.stop(v, env); else this.start(s, v, env); }
      else if (c.act === "hear") { this.stop(v, env); v.phase = "run"; env.loop.start({ bpm: v.bpm, sig: v.sig, sub: v.sub, click: true, pattern: s.pattern, pulses: cellsOf(s, v).n * 2, hit: s.hit != null ? midiOf(parse(s.hit)) : null }, a.at(0.05), () => { v.phase = "idle"; env.redraw(); }); }
      else if (c.act === "skip") { this.stop(v, env); env.answer({ ok: true, msg: "Skipped: it costs nothing." }); }
      else if (c.sig) { v.sig = c.sig; v.sub = METERS[v.sig].sub > 1 && v.sub === 1 ? 1 : v.sub; if (env.loop.running) this.start(s, v, env); }
      else if (c.sub) { v.sub = c.sub; if (env.loop.running) this.start(s, v, env); }
      return true;
    }
    if (s.slider) { const b = sliderHit({ ...SLIDER }, p); if (b !== null) { v.bpm = b; v.drag = true; env.loop.set({ bpm: b }); return true; } }
    if ((s.tap || s.calib) && inBox(PAD, p)) {
      a.thud(a.at());
      if (v.phase === "count" || v.phase === "play" || v.phase === "run") {
        const t = a.audioTimeOf(e.timeStamp);
        if (t !== null) v.taps.push(t);
      }
      const pad = e.currentTarget?.querySelector?.(".mu-pad");
      if (pad) { pad.classList.add("hit"); setTimeout(() => pad.classList.remove("hit"), 90); }
      return "quiet";
    }
    return false;
  },
  move(s, v, p, st, env) {
    if (!v.drag) return false;
    const b = sliderHit({ ...SLIDER }, p);
    if (b === null || b === v.bpm) return false;
    v.bpm = b; env.loop.set({ bpm: b });
    return true;
  },
  up(s, v) { v.drag = false; return null; },
  ready: () => false,
  reveal() {},
  /** The animation frame: the pulse now sounding lights, and the status says whose turn it is. */
  frame(s, v, box, now, env) {
    const c = cellsOf(s, v);
    for (const q of env.loop.cues(now)) {
      const inPlay = v.plan?.count != null ? q.p - v.plan.count : q.p, cell = s.pattern ? ((inPlay % c.n) + c.n) % c.n : q.p % c.per;
      v.cur = cell;
      const say = msg => { if (v.status !== msg) { v.status = msg; const el = box.querySelector(".mu-status"); if (el) el.textContent = msg; } };
      if (v.plan?.count != null && v.phase !== "done") {
        const turn = q.p >= v.plan.count;
        if (turn && v.phase === "count") v.phase = "play";
        say(turn ? "Your turn: tap the dots" : `Count in… ${q.beat + 1}`);
      }
      if (v.plan?.clicks && v.phase !== "done") {
        const turn = q.p >= CAL.lead;
        if (turn && v.phase === "count") v.phase = "play";
        say(turn ? "Tap on every click" : `Count in… ${q.p + 1}`);
      }
    }
    for (const el of box.querySelectorAll("[data-pulse]")) el.classList.toggle("now", Number(el.dataset.pulse) === v.cur && env.loop.running);
    return env.loop.running;
  },
  leave(s, v, env) { env.loop.stop(); v.phase = "idle"; },
};
delete beatInst.reveal;
// the loop ends on its own, calling `finish`; Skip and Stop end it by hand
beatInst.label = () => "Check";

// ---------- dynamics ----------
export const dynInst = {
  init: () => ({ at: null }),
  chips: () => DYNAMICS.map(([id], i) => ({ id, x: 10 + i * 57, y: 150, w: 52, h: 40, text: id, i })),
  draw(s, v) {
    const out = [];
    DYNAMICS.forEach(([id, name, g], i) => {
      const h = 20 + g * 100, x = 14 + i * 57;
      out.push(`<rect x="${x}" y="${f1(138 - h)}" width="44" height="${f1(h)}" rx="3" class="mu-bar${v.at === i ? " on" : ""}"/>`);
    });
    for (const c of this.chips()) out.push(chip({ ...c, on: v.at === c.i }));
    out.push(text(180, 222, v.at === null ? "Tap a mark to hear the same four notes at that loudness" : `${DYNAMICS[v.at][0]}: ${DYNAMICS[v.at][1]}`, "mu-read sm", "middle"));
    out.push(text(180, 244, "The marks are Italian: piano (soft) and forte (loud)", "mu-cap", "middle"));
    return out.join("");
  },
  down(s, v, p, st, e, env) {
    const c = this.chips().find(c => inBox(c, p));
    if (!c) return false;
    v.at = c.i;
    const g = DYNAMICS[c.i][2];
    playEvents(env, [60, 64, 67, 72].map((midi, k) => ({ t: k * 0.32, midi, dur: 0.5, vel: g })));
    return true;
  },
  move: () => false,
  up: () => null,
  ready: () => false,
};
