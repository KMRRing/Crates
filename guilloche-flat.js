// Guilloché's plate drawn flat, where there's no WebGL (guilloche-3d.js is the watch): one canvas that fills its box, a dial
// in the plate's own colour in a ring of the case's metal, the engraving on it (the passes of every cut, as the machine
// would have made them), the target faint beneath as a ghost, and in the corner the rosette of the cut being set, the disc
// whose edge pushes the cutting point in and out, so lobes and throw are seen where they come from. It answers to the same
// calls as the 3D watch, so the page doesn't know which it has: set, refresh, peek, ghost, carve, assemble, mark, orbit,
// zoom, resetView, showGauge, pause, repalette.
import { passes, settingsOf, grooveWidth, SHAPES } from "./guilloche-engine.js";
import { watchOf, METALS, ghostOf, pathOf, luma } from "./guilloche-watch.js";

const EDGE = [p => Math.sin(p), p => 2 * Math.abs(Math.sin(p / 2)) - 1, p => (2 / Math.PI) * Math.asin(Math.sin(p))];

export function createFlat(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "lg-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The plate: the engraving you have cut, with the target faint beneath it");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, colours = null;
  const view = { job: null, run: null, ghost: true, peek: false, carving: -1, carve: 1, assembled: 0, markCut: -1, gauge: true };
  const cache = new Map();                                   // a cut's passes by its settings: moving one knob cuts one cut again, not all
  const cached = c => {
    const key = JSON.stringify(c);
    let p = cache.get(key);
    if (!p) { if (cache.size > 80) cache.clear(); p = passes(c); cache.set(key, p); }
    return p;
  };

  // The page's own colours, resolved to something a canvas reads.
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.append(probe);
  function palette() {
    const get = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
    colours = { ink: get("--ink"), soft: get("--ink-soft"), rule: get("--rule"), brass: get("--brass"), tile: get("--tile"), sheet: get("--sheet"), accent: get("--lg-in") };
  }

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    draw();
  }

  /** One list of points drawn as a line. */
  function stroke(pts, cx, cy, R, upTo = pts.length / 2) {
    ctx.beginPath();
    const n = Math.min(upTo, pts.length / 2);
    for (let m = 0; m < n; m++) { const x = cx + pts[2 * m] * R, y = cy + pts[2 * m + 1] * R; if (m) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
  }
  /** A cut's passes drawn as lines `lw` wide in a colour, up to a part of them (0 to 1). */
  function engrave(s, cx, cy, R, colour, lw, part = 1, opacity = 1) {
    const list = cached(s), upTo = part * list.length;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = colour;
    ctx.globalAlpha = opacity;
    list.forEach((pts, j) => {
      if (j + 1 <= upTo) stroke(pts, cx, cy, R);
      else if (j < upTo) stroke(pts, cx, cy, R, Math.max(2, Math.round((upTo - j) * (pts.length / 2))));
    });
    ctx.globalAlpha = 1;
  }
  const sameVals = (a, b) => !!a && !!b && Object.keys(b).every(n => a[n] === b[n]);

  /** The rosette of a cut: a disc with a wavy edge (its lobes, its throw, its shape) and the block that rubs on it. */
  function rosette(s, cx, cy, r) {
    const edge = EDGE[s.shape] || EDGE[0], throwN = s.a / 10;
    ctx.save();
    ctx.lineWidth = 1.4;
    ctx.fillStyle = colours.sheet;
    ctx.strokeStyle = colours.brass;
    ctx.beginPath();
    const M = 240;
    for (let m = 0; m <= M; m++) {
      const t = (m / M) * 2 * Math.PI, rr = r * (0.74 + 0.26 * throwN * edge(s.k * t));
      const x = cx + rr * Math.sin(t), y = cy - rr * Math.cos(t);
      if (m) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colours.brass;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.09, 0, 2 * Math.PI); ctx.fill();
    // the rubbing block at twelve o'clock, riding on the edge
    const top = cy - r * (0.74 + 0.26 * throwN * edge(0));
    ctx.fillStyle = colours.ink;
    ctx.fillRect(cx - r * 0.12, top - r * 0.2, r * 0.24, r * 0.2);
    ctx.restore();
  }

  /** The hands at ten past ten, and a marker at each hour, once the watch is made. */
  function hands(cx, cy, rr, spec, ink) {
    ctx.save();
    ctx.globalAlpha = view.assembled; ctx.strokeStyle = METALS[spec.hands.metal].hex; ctx.lineCap = "round";
    for (let h = 0; h < 12; h++) { const a = (h / 12) * 2 * Math.PI; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * rr * 1.03, cy - Math.cos(a) * rr * 1.03); ctx.lineTo(cx + Math.sin(a) * rr * 1.1, cy - Math.cos(a) * rr * 1.1); ctx.stroke(); }
    for (const [len, w, a] of [[0.55, 4, (304 * Math.PI) / 180], [0.88, 3, (48 * Math.PI) / 180]]) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * rr * len, cy - Math.cos(a) * rr * len); ctx.stroke(); }
    ctx.restore();
  }

  function draw() {
    if (!colours) palette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { job, run } = view;
    if (!job || !W) return;
    const pad = 6, R = Math.max(10, Math.min(W, H) / 2 - pad), cx = W / 2, cy = H / 2;
    // the watch: a ring of the case's metal, the dial in its own colour inside it
    const spec = watchOf(job.id), metal = METALS[spec.case.metal].hex, dark = luma(spec.dial.base) < 0.42;
    const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ring.addColorStop(0, "#ffffff"); ring.addColorStop(0.3, metal); ring.addColorStop(0.7, metal); ring.addColorStop(1, "#00000055");
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fillStyle = ring; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.84, 0, 2 * Math.PI); ctx.fillStyle = spec.dial.base; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = spec.dial.ink; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.84 - 2, 0, 2 * Math.PI); ctx.stroke();
    ctx.globalAlpha = 1;
    const rr = R * 0.84 - 3, inkOn = dark ? "#f3efe4" : "#23262b", ghostOn = ghostOf(spec.dial.base);
    const lw = Math.max(0.7, Math.min(1.3, rr / 160));
    const goal = job.answer ? job.cuts.map((c, i) => settingsOf(c, job.answer[i])) : [], pathOn = pathOf(spec.dial.base);
    const width = s => Math.max(lw, 1.2 * grooveWidth(s.depth) * rr);       // wider the deeper the cut (a little under its full width, so a dense rose stays a lattice)
    // a register is edged with a ring of its own
    ctx.strokeStyle = inkOn; ctx.lineWidth = lw; ctx.globalAlpha = 0.7;
    for (const c of job.cuts) if (c.at) { ctx.beginPath(); ctx.arc(cx + c.at[0] * rr, cy + c.at[1] * rr, rr * c.size * 0.99, 0, 2 * Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (view.peek && job.answer) goal.forEach(s => engrave(s, cx, cy, rr, inkOn, width(s), 1, 0.6));
    else {
      // the target faint (a wash as wide as its grooves and a hairline down them), what is cut, and the machine's path as it is set
      if (view.ghost && job.answer && !run.done) goal.forEach(s => { engrave(s, cx, cy, rr, ghostOn, width(s), 1, 0.14); engrave(s, cx, cy, rr, ghostOn, lw, 1, 0.55); });
      job.cuts.forEach((c, i) => { const made = run.cut?.[i]; if (made) { const s = settingsOf(c, made); engrave(s, cx, cy, rr, inkOn, width(s), view.carving === i ? view.carve : 1, 0.6); } });
      const at = Math.min(run.at, job.cuts.length - 1);
      if (!run.done && view.carving < 0 && !sameVals(run.cut?.[at], run.vals[at])) engrave(settingsOf(job.cuts[at], run.vals[at]), cx, cy, rr, pathOn, lw, 1, 0.95);
      if (view.markCut >= 0 && !run.done) { ctx.strokeStyle = ghostOn; ctx.lineWidth = 2; ctx.beginPath(); const m = job.cuts[view.markCut]; ctx.arc(cx + (m.at ? m.at[0] : 0) * rr, cy + (m.at ? m.at[1] : 0) * rr, rr * (m.size || m.R), 0, 2 * Math.PI); ctx.stroke(); }
      if (view.assembled > 0) hands(cx, cy, rr, spec, inkOn);
    }
    // the rosette of the cut in hand, in the plate's corner, and which it is
    const rs = Math.min(W, H) * 0.065;                      // small and in the corner, clear of the plate's rim
    const inHand = settingsOf(job.cuts[Math.min(run.at, job.cuts.length - 1)], run.vals[Math.min(run.at, job.cuts.length - 1)]);
    if (!run.done && view.gauge && !(inHand.kind && !inHand.a)) rosette(inHand, rs * 1.2 + 4, rs * 1.2 + 4, rs);
    if (view.peek) {
      ctx.fillStyle = colours.soft; ctx.font = `700 ${Math.max(10, rr * 0.05)}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillText("THE TARGET", cx, H - 8);
    }
  }

  // ----- what the page asks of it -----
  const api = {
    canvas,
    set(job, run) { view.job = job; view.run = run; view.carving = -1; view.carve = 1; view.peek = false; draw(); },
    refresh() { draw(); },
    peek(on) { if (view.peek !== on) { view.peek = on; draw(); } },
    ghost(on) { view.ghost = on; draw(); },
    /** Cut `i` being cut, up to a part (0 to 1) of it; 1 is cut. */
    carve(i, t) { t = Math.max(0, Math.min(1, t)); view.carving = t < 1 ? i : -1; view.carve = t; draw(); },
    assemble(t) { view.assembled = t; draw(); },
    mark(cut) { view.markCut = cut; draw(); },
    orbit() {}, zoom() {}, pan() {}, resetView() {},
    showGauge(on) { view.gauge = on; draw(); },
    pause() {},
    get shapes() { return SHAPES; },
    repalette() { colours = null; draw(); },
  };
  new ResizeObserver(resize).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => api.repalette());
  new MutationObserver(() => api.repalette()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  resize();
  return api;
}
