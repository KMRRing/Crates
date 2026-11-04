// Portolan's materials, painted in code (no image files): the vellum with its stains, fibres, rhumb lines and graduated border; the walnut
// desk; an engraver's numerals in ink; a grain for the light to rake across. Each takes a canvas factory so the arithmetic stays out of the
// scene's way. A seed makes the same chart on every phone.
const rngOf = seed => { let a = (seed >>> 0) || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const make = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };
export const INK = "#2a2118", OXBLOOD = "#a8382b", GILT = "#c8923a", PENCIL = "#7b6a4f";
const SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;

/** The vellum for a chart of `C`x`R` cells with `m` cells of margin: returns the canvas and its pixels to a cell. */
export function vellum(C, R, m, seed = 1) {
  const ppc = Math.max(40, Math.min(112, Math.floor(1600 / (Math.max(C, R) + 2 * m)))), W = (C + 2 * m) * ppc, H = (R + 2 * m) * ppc, c = make(W, H), g = c.getContext("2d"), rnd = rngOf(seed);
  const X = x => (x + m) * ppc, Y = y => (y + m) * ppc;
  g.fillStyle = "#e8dcbc";
  g.fillRect(0, 0, W, H);
  // age: darker toward the edges, a few warm stains and large soft mottles
  const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vig.addColorStop(0, "rgba(255,248,224,0.55)"); vig.addColorStop(0.7, "rgba(214,190,140,0.0)"); vig.addColorStop(1, "rgba(150,112,60,0.38)");
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H, r = (0.4 + rnd() * 1.6) * ppc, a = g.createRadialGradient(x, y, 0, x, y, r);
    a.addColorStop(0, `rgba(${150 + rnd() * 60 | 0},${110 + rnd() * 50 | 0},${50 + rnd() * 40 | 0},${0.05 + rnd() * 0.06})`); a.addColorStop(1, "rgba(150,110,60,0)");
    g.fillStyle = a; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 3; i++) {                           // a water ring, as a damp cup left on vellum
    const x = rnd() * W, y = rnd() * H, r = (0.8 + rnd() * 1.1) * ppc;
    g.strokeStyle = `rgba(140,100,50,${0.07 + rnd() * 0.05})`; g.lineWidth = 0.05 * ppc + rnd() * 2; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.stroke();
  }
  // rhumb lines from two roses: sixteen from each, the principal winds in red-brown, the half-winds in verdigris
  const roses = [[C * 0.78, R * 0.28], [C * 0.2, R * 0.8]];
  g.lineCap = "round";
  for (const [rx, ry] of roses) for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2, major = k % 4 === 0, len = (C + R) * 1.2;
    g.strokeStyle = major ? "rgba(150,70,50,0.16)" : k % 2 ? "rgba(60,110,90,0.1)" : "rgba(90,70,50,0.11)";
    g.lineWidth = major ? Math.max(1, ppc * 0.018) : Math.max(0.8, ppc * 0.011);
    g.beginPath(); g.moveTo(X(rx), Y(ry)); g.lineTo(X(rx) + Math.cos(a) * len * ppc, Y(ry) + Math.sin(a) * len * ppc); g.stroke();
  }
  // a rose: an eight-point star in rings, drawn once under the lower-left
  const [rx, ry] = roses[1], rr = Math.min(C, R) * 0.2 * ppc;
  g.save(); g.translate(X(rx), Y(ry)); g.strokeStyle = "rgba(90,60,40,0.22)"; g.fillStyle = "rgba(150,70,50,0.13)"; g.lineWidth = Math.max(1, ppc * 0.02);
  for (const k of [1, 0.78, 0.5]) { g.beginPath(); g.arc(0, 0, rr * k, 0, 6.3); g.stroke(); }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, long = k % 2 === 0 ? 1.35 : 0.9;
    g.beginPath(); g.moveTo(Math.cos(a) * rr * long, Math.sin(a) * rr * long); g.lineTo(Math.cos(a + 0.2) * rr * 0.28, Math.sin(a + 0.2) * rr * 0.28); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
  // a graduated border: two rules with alternating bars between, as a chart's scale
  const o = 0.12 * m * ppc, i = 0.38 * m * ppc;
  g.strokeStyle = "rgba(60,44,28,0.7)"; g.lineWidth = Math.max(1, ppc * 0.025);
  g.strokeRect(o, o, W - 2 * o, H - 2 * o); g.strokeRect(i, i, W - 2 * i, H - 2 * i);
  g.fillStyle = "rgba(60,44,28,0.55)";
  const tick = ppc / 4;
  for (let x = i, n = 0; x < W - i - 1; x += tick, n++) if (n % 2 === 0) { const w = Math.min(tick, W - i - x); g.fillRect(x, o, w, i - o); g.fillRect(x, H - i, w, i - o); }
  for (let y = i, n = 0; y < H - i - 1; y += tick, n++) if (n % 2 === 0) { const h = Math.min(tick, H - i - y); g.fillRect(o, y, i - o, h); g.fillRect(W - i, y, i - o, h); }
  // grain: fibres and specks
  for (let n = 0; n < W * H / 1800; n++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * 6.3, l = 3 + rnd() * 12;
    g.strokeStyle = `rgba(${rnd() < 0.5 ? "110,84,50" : "255,250,230"},${0.04 + rnd() * 0.07})`; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 3, y + Math.sin(a) * l * 0.5 + rnd() * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let n = 0; n < W * H / 900; n++) { g.fillStyle = `rgba(90,64,34,${0.05 + rnd() * 0.12})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd(), 1 + rnd()); }
  return { canvas: c, ppc };
}
/** A tiling grain, grey, for a bump map: vellum is not quite flat. */
export function grain(seed = 2, size = 256) {
  const c = make(size, size), g = c.getContext("2d"), rnd = rngOf(seed);
  g.fillStyle = "#808080"; g.fillRect(0, 0, size, size);
  for (let n = 0; n < size * size / 18; n++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * 6.3, l = 2 + rnd() * 9, v = 90 + rnd() * 80 | 0;
    g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 0.8 + rnd();
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); }
  }
  return c;
}
/** The desk: walnut planks with their grain, along x. */
export function walnut(seed = 5, size = 1024) {
  const c = make(size, size), g = c.getContext("2d"), rnd = rngOf(seed), planks = 4, ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const base = 58 + rnd() * 16;
    g.fillStyle = `rgb(${base + 18 | 0},${base * 0.62 + 8 | 0},${base * 0.36 + 6 | 0})`;
    g.fillRect(0, p * ph, size, ph);
    for (let n = 0; n < 150; n++) {
      const y = p * ph + rnd() * ph, amp = 1 + rnd() * 5, ph0 = rnd() * 6.3, f = 0.004 + rnd() * 0.01, dark = rnd() < 0.7;
      g.strokeStyle = dark ? `rgba(20,10,4,${0.06 + rnd() * 0.14})` : `rgba(210,150,90,${0.03 + rnd() * 0.06})`;
      g.lineWidth = 0.6 + rnd() * 1.8;
      g.beginPath();
      for (let x = 0; x <= size; x += 16) { const yy = y + Math.sin(x * f + ph0) * amp; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
      g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, p * ph, size, 2);
  }
  return c;
}

/**
 * A numeral in an engraver's hand, on transparency: `state` is "n" (as set), "m" (quiet: all its lines drawn) or "o" (oxblood: too many).
 * The ink is drawn twice a pixel apart so it looks pressed into the vellum rather than printed.
 */
export function numeral(ch, state, size = 128) {
  const c = make(size, size), g = c.getContext("2d");
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `italic 700 ${size * 0.78}px ${SERIF}`;
  const col = state === "o" ? OXBLOOD : INK;
  g.globalAlpha = state === "m" ? 0.34 : 1;
  g.shadowColor = col; g.shadowBlur = size * 0.015;
  g.fillStyle = col;
  g.fillText(ch, size / 2, size * 0.54);
  g.globalAlpha *= 0.55; g.fillText(ch, size / 2 + size * 0.008, size * 0.545);
  return c;
}
/** A shaded clue: "i" the cell known to be inside the loop (a green wash, hatched), "o" known to be outside (three small waves). `bad` turns it oxblood. */
export function shadeMark(kind, bad, size = 128) {
  const c = make(size, size), g = c.getContext("2d");
  if (kind === "i") {
    g.fillStyle = bad ? "rgba(168,56,43,0.3)" : "rgba(104,140,66,0.34)";
    g.beginPath(); g.roundRect(size * 0.1, size * 0.1, size * 0.8, size * 0.8, size * 0.1); g.fill();
    g.strokeStyle = bad ? "rgba(168,56,43,0.75)" : "rgba(70,100,44,0.6)"; g.lineWidth = size * 0.012;
    for (let k = -size; k < size; k += size * 0.1) { g.save(); g.beginPath(); g.roundRect(size * 0.1, size * 0.1, size * 0.8, size * 0.8, size * 0.1); g.clip(); g.beginPath(); g.moveTo(k, size); g.lineTo(k + size, 0); g.stroke(); g.restore(); }
  } else {
    g.strokeStyle = bad ? OXBLOOD : "rgba(48,102,136,0.85)"; g.lineWidth = size * 0.04; g.lineCap = "round";
    for (const dy of [-0.16, 0.02, 0.2]) { g.beginPath(); for (let k = 0; k <= 4; k++) { const x = size * (0.22 + k * 0.14), y = size * (0.5 + dy) + (k % 2 ? -1 : 1) * size * 0.04; if (k) g.quadraticCurveTo(x - size * 0.07, y + (k % 2 ? -1 : 1) * size * 0.07, x, y); else g.moveTo(x, y); } g.stroke(); }
  }
  return c;
}
/** A dashed gilt ring, for the number or corner a hint points at. */
export function hintRing(size = 128) {
  const c = make(size, size), g = c.getContext("2d");
  g.strokeStyle = GILT; g.lineWidth = size * 0.045; g.setLineDash([size * 0.09, size * 0.06]); g.lineCap = "round";
  g.beginPath(); g.roundRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, size * 0.14); g.stroke();
  return c;
}
/** A soft round glow (the candle's), white in the middle. */
export function glow(size = 64) {
  const c = make(size, size), g = c.getContext("2d"), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, "rgba(255,240,200,1)"); r.addColorStop(0.35, "rgba(255,200,120,0.45)"); r.addColorStop(1, "rgba(255,170,80,0)");
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return c;
}
