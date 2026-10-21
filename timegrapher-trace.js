// Timegrapher's display, on a canvas that fills its box. Two views, a tap apart:
// - the trace, as a timegrapher prints it: a dot for every beat, time along, its offset from a perfect watch at the
//   nominal rate up (a beat early, the watch gaining, rises). Ticks and tocks make two parallel lines: their slope is
//   the rate and the gap between them the beat error. The offset wraps round the height, as a paper trace wraps its
//   drum, so a watch far off draws slanted stripes rather than leaving the screen.
// - the beat: tick and tock averaged (the matched filter's templates), the first and last noises marked, the lift's
//   time between them that the amplitude comes from.
// Colours come from the page's tokens, read as it draws, so every theme by day and night is its own.
import { scale } from "./wide.js";

export function createTrace(box) {
  const canvas = document.createElement("canvas");
  canvas.className = "tg-canvas";
  box.prepend(canvas);
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1, trace = null, beat = null, view = "trace";
  const css = name => getComputedStyle(box).getPropertyValue(name).trim() || "#888";

  function resize() {
    const r = box.getBoundingClientRect();
    dpr = Math.min(3, devicePixelRatio || 1);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    draw();
  }
  new ResizeObserver(resize).observe(box);

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (view === "beat") drawBeat(); else drawTrace();
  }
  const font = px => `600 ${px * scale()}px ${getComputedStyle(box).fontFamily}`;

  function drawTrace() {
    const s = scale(), pad = 10 * s, mid = h / 2, ink = css("--ink"), soft = css("--ink-soft"), rule = css("--rule");
    const half = trace?.half ?? 2, span = trace?.span ?? 20;
    const yOf = ms => mid - (ms / half) * (mid - pad);
    // the scale: a line each millisecond (each 5 at a wider range), the zero in brass, the range named at the edge
    const stepMs = half > 5 ? 5 : half > 2.5 ? 1 : 0.5;
    ctx.lineWidth = 1;
    for (let v = -half; v <= half + 1e-9; v += stepMs) {
      ctx.strokeStyle = Math.abs(v) < 1e-9 ? css("--brass") : rule;
      ctx.globalAlpha = Math.abs(v) < 1e-9 ? 0.9 : 0.7;
      ctx.beginPath(); ctx.moveTo(0, Math.round(yOf(v)) + 0.5); ctx.lineTo(w, Math.round(yOf(v)) + 0.5); ctx.stroke();
    }
    for (let t = 5; t < span; t += 5) {
      const x = Math.round(w - (t / span) * w) + 0.5;
      ctx.strokeStyle = rule; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = soft; ctx.font = font(10); ctx.textBaseline = "top";
    ctx.fillText(`+${fmt(half)} ms`, 6 * s, 4 * s);
    ctx.textBaseline = "bottom";
    ctx.fillText(`−${fmt(half)} ms`, 6 * s, h - 4 * s);
    ctx.textAlign = "right";
    ctx.fillText(`${span} s`, w - 6 * s, h - 4 * s);
    ctx.textAlign = "left";
    if (!trace?.points?.length) return;
    const tick = ink, tock = css("--tg-in"), r = 1.7 * s, from = trace.now - span;
    for (const p of trace.points) {
      if (p.x < from) continue;
      const x = ((p.x - from) / span) * w, y = yOf(wrap(p.y, half));
      ctx.fillStyle = p.tock ? tock : tick;
      ctx.globalAlpha = p.faint ? 0.35 : 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBeat() {
    const s = scale(), pad = 12 * s, soft = css("--ink-soft"), rule = css("--rule");
    ctx.fillStyle = soft; ctx.font = font(10); ctx.textBaseline = "top";
    if (!beat?.a) { ctx.fillText("The beat shows once the watch is heard.", 6 * s, 4 * s); return; }
    const { a, b, fe, W } = beat, n = a.length, top = Math.max(...a, ...(b || [0])) || 1;
    const xOf = i => pad + (i / (n - 1)) * (w - 2 * pad), base = h - pad - 12 * s, yOf = v => base - (v / top) * (base - pad - 10 * s);
    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, Math.round(base) + 0.5); ctx.lineTo(w - pad, Math.round(base) + 0.5); ctx.stroke();
    // a mark every 5 ms along the beat
    for (let ms = -Math.floor(W / fe * 1000 / 5) * 5; ms <= W / fe * 1000; ms += 5) {
      const x = xOf(W + (ms / 1000) * fe);
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base + 4 * s); ctx.stroke();
    }
    const line = (t, colour) => {
      ctx.strokeStyle = colour; ctx.lineWidth = 1.6 * s; ctx.beginPath();
      t.forEach((v, i) => (i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))));
      ctx.stroke();
    };
    if (b) line(b, css("--tg-in"));
    line(a, css("--ink"));
    // the noises the amplitude is timed between
    ctx.strokeStyle = css("--brass"); ctx.lineWidth = 1; ctx.setLineDash([3 * s, 3 * s]);
    for (const nz of [beat.noisesA, beat.noisesB]) for (const i of [nz?.first, nz?.last]) {
      if (i == null) continue;
      ctx.beginPath(); ctx.moveTo(xOf(i), pad + 8 * s); ctx.lineTo(xOf(i), base); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = soft;
    ctx.fillText(beat.label || "Tick and tock, averaged; dashes at the first and last noise", 6 * s, 4 * s);
    ctx.textBaseline = "bottom";
    ctx.fillText("5 ms", w - pad - 24 * s, h - 2 * s);
  }

  return {
    canvas,
    /** The trace's points: { points: [{ x (s), y (ms, unwrapped), tock }], now (s), span (s), half (ms) }. */
    trace(d) { trace = d; if (view === "trace") draw(); },
    /** The averaged beat: { a, b, fe, W, noisesA, noisesB, label }. */
    beat(d) { beat = d; if (view === "beat") draw(); },
    get view() { return view; },
    set view(v) { view = v === "beat" ? "beat" : "trace"; draw(); },
    redraw: draw,
  };
}
/** An offset wrapped into ±half, as the drum wraps the paper. */
const wrap = (y, half) => ((((y + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
const fmt = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));
