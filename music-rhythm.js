// The Music course's time: where each pulse of a bar falls on the audio clock, a look-ahead scheduler that queues sounds a little before
// they are due (so a busy page cannot make a beat late), the grading of taps against the beats they aimed at, and the tap-offset
// calibration. Planning and grading are pure (tests/music.mjs runs them on a fake clock); only createLoop touches the audio.
import { METERS, strengths } from "./music-theory.js";

/** Seconds between pulses at `bpm` beats a minute with `sub` pulses to a beat. */
export const pulseSec = (bpm, sub = 1) => 60 / bpm / sub;
/** What a pulse is: its bar, its beat in the bar, the place within the beat, and the click it gets (2 strong, 1 medium, 0 weak, -1 a subdivision). */
export function pulseInfo(p, { sig = "4/4", sub = 1, ticks = false }) {
  const m = METERS[sig], per = m.beats * sub, inBar = p % per, beat = Math.floor(inBar / sub), within = inBar % sub;
  return { bar: Math.floor(p / per), beat, within, level: within === 0 ? strengths(sig)[beat] : ticks ? -1 : null };
}

/**
 * A loop on the audio clock. cfg: { bpm, sig, sub, click (the beats sound), ticks (subdivisions too), pattern ("x..x.x..": one character a
 * pulse, x a hit; repeated), pulses (stop after this many; 0 for ever), hit (midi of the pattern's note, or null for a tick) }.
 * start(cfg, t0) queues pulses from t0; every `every` ms it queues those due within `lookahead` seconds. cues() hands the page the pulses
 * that have sounded by a time, to flash. A tempo change takes effect from the next pulse queued.
 */
export function createLoop(audio, { setTimer = (f, ms) => setInterval(f, ms), clearTimer = id => clearInterval(id), lookahead = 0.15, every = 25 } = {}) {
  let cfg = null, timer = null, next = 0, tNext = 0, t0 = 0, queue = [], onEnd = null, endAt = 0;
  const L = {
    get running() { return timer !== null; },
    get cfg() { return cfg; },
    get t0() { return t0; },
    start(c, start, end = null) {
      L.stop();
      cfg = { sub: 1, sig: "4/4", bpm: 80, click: true, ticks: false, pattern: "", pulses: 0, hit: null, ...c };
      t0 = tNext = start; next = 0; queue = []; onEnd = end; endAt = 0;
      timer = setTimer(L.tick, every);
      L.tick();
    },
    set(c) { cfg = { ...cfg, ...c }; },
    stop() { if (timer !== null) clearTimer(timer); timer = null; queue = []; },
    tick() {
      if (timer === null) return;
      while (tNext < audio.time + lookahead && (!cfg.pulses || next < cfg.pulses)) {
        const info = pulseInfo(next, cfg), hit = cfg.pattern && cfg.pattern[next % cfg.pattern.length] === "x";
        if (cfg.click && info.level !== null) audio.click(tNext, info.level);
        if (hit) { if (cfg.hit != null) audio.note(cfg.hit, tNext, 0.18, 0.9); else audio.click(tNext, 1); }
        queue.push({ t: tNext, p: next, ...info, hit: !!hit });
        tNext += pulseSec(cfg.bpm, cfg.sub);
        next++;
      }
      if (cfg.pulses && next >= cfg.pulses && !endAt) endAt = tNext;
      if (endAt && audio.time >= endAt) { const f = onEnd; L.stop(); f?.(); }
    },
    /** The queued pulses whose time has come by `time`, once each. */
    cues(time) {
      const out = [];
      while (queue.length && queue[0].t <= time) out.push(queue.shift());
      return out;
    },
  };
  return L;
}

// ---------- grading ----------
export const PERFECT = 0.055, GOOD = 0.11;                  // seconds: a tap this near its beat is "on it", this near "close"
/**
 * Taps against the beats they aim at (seconds, the taps already corrected by the calibration). Each beat takes the nearest unused tap
 * within `reach`; a tap no beat took is an extra. { rows: [{ at, offset | null, grade }], hits, extras, mean (signed average offset of the
 * matched taps), pass }. A pass is three beats in four close, and no more than a quarter as many extras.
 */
export function gradeTaps(expected, taps, { reach = 0.22 } = {}) {
  const used = new Set(), rows = [];
  for (const at of expected) {
    let best = -1;
    taps.forEach((t, i) => { if (!used.has(i) && Math.abs(t - at) <= reach && (best < 0 || Math.abs(t - at) < Math.abs(taps[best] - at))) best = i; });
    if (best < 0) { rows.push({ at, offset: null, grade: "miss" }); continue; }
    used.add(best);
    const offset = taps[best] - at, a = Math.abs(offset);
    rows.push({ at, offset, grade: a <= PERFECT ? "perfect" : a <= GOOD ? "good" : "miss" });
  }
  const hits = rows.filter(r => r.grade !== "miss").length, extras = taps.length - used.size, matched = rows.filter(r => r.offset !== null);
  const mean = matched.length ? matched.reduce((s, r) => s + r.offset, 0) / matched.length : 0;
  return { rows, hits, extras, mean, pass: expected.length > 0 && hits >= Math.ceil(expected.length * 0.75) && extras <= Math.floor(expected.length / 4) };
}
/** The hit times of a pattern ("x.x.xx.."): the pulses from `first` up to `last` that are hits, counted from `t0`. */
export function patternTimes(pattern, t0, bpm, sub, first, last) {
  const out = [];
  for (let p = first; p < last; p++) if (pattern[p % pattern.length] === "x") out.push(t0 + p * pulseSec(bpm, sub));
  return out;
}

// ---------- calibration ----------
/** The reader's tap offset in seconds: the median of (tap - click) for each tap near a click; null with fewer than 5. Positive: late. */
export function calibrationOffset(clicks, taps, reach = 0.3) {
  const d = [];
  for (const t of taps) {
    const c = clicks.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), clicks[0]);
    if (Math.abs(t - c) <= reach) d.push(t - c);
  }
  if (d.length < 5) return null;
  d.sort((a, b) => a - b);
  const m = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
  return Math.max(-0.3, Math.min(0.3, m));
}
