// The figures Firmament's stage draws (firmament-stage.js): each is a function of the lesson's parameters returning the inside of an SVG with
// the viewBox 0 0 320 190. They are drawn here, never fetched, so every lesson works offline. Colours come from classes in firmament.css (the
// suite's tokens, so the theme and the night follow); stroke widths are attributes and text sizes are viewBox units, as the rules for SVG ask.
import { tusiPoint } from "./firmament-calc.js";
import { num } from "./firmament-ask.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r1 = n => Math.round(n * 10) / 10;
const RAD = Math.PI / 180;
/** Text: o.a anchor (middle, start, end), o.s size, o.c extra class. */
const T = (x, y, s, o = {}) => `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1((o.s || 10) * 1.12)}" text-anchor="${o.a || "middle"}" class="ft${o.c ? ` ${o.c}` : ""}">${esc(s)}</text>`;
const L = (x1, y1, x2, y2, c = "fl", w = 1.4) => `<line class="${c}" stroke-width="${w}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
const C = (x, y, r, c = "fl", w = 1.4) => `<circle class="${c}" stroke-width="${w}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`;
const P = (d, c = "fl", w = 1.4) => `<path class="${c}" stroke-width="${w}" d="${d}"/>`;
export const yr = y => (y < 0 ? `${-y} BCE` : `${y} CE`);

/** A line of dated marks: { from, to, marks: [[year, label, "hi"?]] }. Labels alternate above and below on two tiers so they do not touch. */
function timeline({ from, to, marks }) {
  const x = y => 22 + (y - from) / (to - from) * 276, out = [L(18, 100, 302, 100, "fb", 2)];
  out.push(T(18, 134, yr(from), { a: "start", s: 8.5, c: "fm" }), T(302, 134, yr(to), { a: "end", s: 8.5, c: "fm" }));
  marks.forEach(([y, label, hi], i) => {
    const up = i % 2 === 0, tier = Math.floor(i / 2) % 2, len = 22 + tier * 24, px = x(y), ty = up ? 100 - len - 4 : 100 + len + 11;
    out.push(L(px, 100, px, up ? 100 - len : 100 + len, "fs", 1), C(px, 100, 3.2, hi ? "fa" : "ff", 1.4));
    const a = px < 60 ? "start" : px > 260 ? "end" : "middle";
    out.push(T(px, ty, label, { a, s: 9.5, c: hi ? "fh" : "" }), T(px, ty + (up ? -11 : 11), yr(y), { a, s: 8, c: "fm" }));
  });
  return out.join("");
}

/** Horizontal bars: { rows: [[label, value, "hi"?]], max, unit }. */
function bars({ rows, max, unit = "" }) {
  const m = max || Math.max(...rows.map(r => r[1])), h = 160 / rows.length, out = [];
  rows.forEach(([label, v, hi], i) => {
    const y = 16 + i * h, bw = Math.max(2, (v / m) * 214), bh = Math.min(26, h - 24);
    out.push(T(10, y + 10, label, { a: "start", s: 10 }), `<rect class="${hi ? "fa" : "ff"}" x="10" y="${r1(y + 16)}" width="${r1(bw)}" height="${r1(bh)}" rx="2"/>`,
      T(10 + bw + 6, y + 16 + bh / 2 + 4, `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${unit ? ` ${unit}` : ""}`, { a: "start", s: 9.5, c: "fm" }));
  });
  return out.join("");
}

/** A chart: { xl, yl, x: [min, max], y: [min, max], pts: [[x, y, label?]], lines: [[x1, y1, x2, y2, label?]], xlog, ylog, xt, yt: ticks }. */
function plot({ xl, yl, x, y, pts = [], lines = [], xlog, ylog, xt = [], yt = [] }) {
  const fx = v => 44 + ((xlog ? Math.log10(v) - Math.log10(x[0]) : v - x[0]) / (xlog ? Math.log10(x[1]) - Math.log10(x[0]) : x[1] - x[0])) * 254;
  const fy = v => 150 - ((ylog ? Math.log10(v) - Math.log10(y[0]) : v - y[0]) / (ylog ? Math.log10(y[1]) - Math.log10(y[0]) : y[1] - y[0])) * 126;
  const out = [P(`M44 24V150H298`, "fb", 1.6)];
  for (const t of xt) out.push(L(fx(t), 150, fx(t), 154, "fs", 1), T(fx(t), 164, String(t), { s: 8.5, c: "fm" }));
  for (const t of yt) out.push(L(40, fy(t), 44, fy(t), "fs", 1), T(38, fy(t) + 3, String(t), { a: "end", s: 8.5, c: "fm" }));
  out.push(T(171, 182, xl, { s: 9.5 }), `<text transform="translate(10 87) rotate(-90)" font-size="9.5" text-anchor="middle" class="ft">${esc(yl)}</text>`);
  for (const [x1, y1, x2, y2, lab] of lines) { out.push(L(fx(x1), fy(y1), fx(x2), fy(y2), "fa", 1.8)); if (lab) out.push(T((fx(x1) + fx(x2)) / 2 - 8, (fy(y1) + fy(y2)) / 2 - 8, lab, { a: "end", s: 9, c: "fh" })); }
  for (const [px, py, lab] of pts) { out.push(C(fx(px), fy(py), 3.4, "fa", 1.2)); if (lab) { const left = fx(px) > 232; out.push(T(fx(px) + (left ? -7 : 6), fy(py) + (left ? 14 : -5), lab, { a: left ? "end" : "start", s: 9 })); } }
  return out.join("");
}

/** Eratosthenes: two sticks on a round Earth under parallel rays; the angle at the centre equals the angle between stick and ray. */
function shadow({ deg = 7.2 }) {
  const cx = 160, cy = 120, R = 56, d = deg * RAD, out = [], len = 28;
  const ax = cx + R * Math.sin(d), ay = cy - R * Math.cos(d), nx = Math.sin(d), ny = -Math.cos(d), tx = ax + nx * len, ty = ay + ny * len;
  for (const rx of [112, 134, 186, 208]) out.push(L(rx, 34, rx, cy - Math.sqrt(R * R - (rx - cx) ** 2), "fs", 1));
  out.push(L(cx, 34, cx, cy - R - len, "fs", 1), L(tx, 34, tx, ty, "fs", 1));
  out.push(C(cx, cy, R, "ff", 1.8), T(cx, cy + 4, "Earth", { s: 11, c: "fm" }), L(cx, cy, cx, cy - R, "fs", 1), L(cx, cy, ax, ay, "fs", 1));
  out.push(L(cx, cy - R, cx, cy - R - len, "fb", 3), L(ax, ay, tx, ty, "fb", 3), L(ax, ay, ax - nx * 14, ay - ny * 14, "fs", 1));
  const a0 = -90 * RAD, a1 = a0 + d, rr = 26, ar = 18, b0 = Math.atan2(ny, nx), b1 = -90 * RAD;
  out.push(P(`M${r1(cx + rr * Math.cos(a0))} ${r1(cy + rr * Math.sin(a0))}A${rr} ${rr} 0 0 1 ${r1(cx + rr * Math.cos(a1))} ${r1(cy + rr * Math.sin(a1))}`, "fh", 1.8));
  out.push(P(`M${r1(tx + ar * Math.cos(b1))} ${r1(ty + ar * Math.sin(b1))}A${ar} ${ar} 0 0 0 ${r1(tx + ar * Math.cos(b0))} ${r1(ty + ar * Math.sin(b0))}`, "fh", 1.8));
  out.push(T(cx - 6, 22, "Syene: sun overhead", { a: "end", s: 9.5 }), T(tx + 6, 22, `Alexandria: ${deg}°`, { a: "start", s: 9.5 }), T(cx + 12, cy - 30, `${deg}°`, { a: "start", s: 10.5, c: "fh" }));
  return out.join("");
}

/** Aristarchus: at half Moon the angle at the Moon is a right angle; the angle at the Earth gives the ratio of the two sides. */
function halfmoon({ deg = 87, note = "" }) {
  const out = [], E = [34, 160], M = [250, 160], Sx = [250, 34];
  out.push(P(`M${E} L${M} L${Sx} Z`, "ff", 1.6), P(`M${M[0] - 12} ${M[1]}V${M[1] - 12}H${M[0]}`, "fs", 1.2));
  out.push(C(E[0], E[1], 6, "fa", 1.2), C(M[0], M[1], 4.5, "ff", 1.4), C(Sx[0], Sx[1], 9, "fh", 1.2));
  out.push(T(E[0], E[1] + 16, "Earth", { s: 10 }), T(M[0], M[1] + 16, "Moon (half lit)", { s: 10 }), T(Sx[0] - 14, Sx[1] + 4, "Sun", { a: "end", s: 10 }));
  out.push(T(E[0] + 44, E[1] - 5, `${deg}°`, { a: "start", s: 11, c: "fh" }), T(M[0] - 20, M[1] - 18, "90°", { a: "end", s: 9.5 }));
  out.push(T(160, 18, note || "(not to scale)", { s: 9, c: "fm" }));
  return out.join("");
}

/** The pole's slow circle: { marks: [[year, label]] }, the circle one turn of precession. */
function precession({ marks, period = 25772, nowYear = 2100 }) {
  const cx = 160, cy = 98, R = 62, out = [C(cx, cy, R, "fs", 1.4), T(cx, cy + 4, "path of the pole", { s: 9.5, c: "fm" }), T(cx, cy + 17, `one turn: ${num(period)} years`, { s: 8.5, c: "fm" })];
  marks.forEach(([y, label, hi]) => {
    const a = (-90 + 360 * (y - nowYear) / period) * RAD, x = cx + R * Math.cos(a), yy = cy + R * Math.sin(a), right = Math.cos(a) >= 0;
    out.push(C(x, yy, 4, hi ? "fa" : "ff", 1.4), T(x + (right ? 8 : -8), yy + 3, label, { a: right ? "start" : "end", s: 9.5, c: hi ? "fh" : "" }), T(x + (right ? 8 : -8), yy + 13, y < 0 ? `${-y} BCE` : `${y} CE`, { a: right ? "start" : "end", s: 8, c: "fm" }));
  });
  return out.join("");
}

/** The Tusi couple: a circle rolling inside one twice its size; its rim point runs back and forth along a diameter. */
function tusi({ ang: t = 60 }) {
  const cx = 160, cy = 95, R = 70, r = 35, out = [C(cx, cy, R, "ff", 1.6), L(cx - R, cy, cx + R, cy, "fh", 2.4)];
  const ang = t * RAD, ox = cx + (R - r) * Math.cos(ang), oy = cy - (R - r) * Math.sin(ang), [px] = tusiPoint(R, r, t);
  out.push(C(ox, oy, r, "fs", 1.6), L(cx, cy, ox, oy, "fs", 1), C(cx + px, cy, 4.5, "fa", 1.4), C(ox, oy, 2, "ff", 1), C(cx, cy, 2, "ff", 1));
  out.push(T(cx, cy + R + 18, "two steady turns, one straight line", { s: 10 }), T(cx + R + 6, cy - 4, "big circle", { a: "start", s: 8.5, c: "fm" }));
  return out.join("");
}

/** Ptolemy's machinery for one planet: a deferent, an epicycle, the equant and the Earth off the centre. */
function epicycle({ alpha = 40, beta = 200 }) {
  const cx = 150, cy = 96, R = 66, e = 14, out = [C(cx, cy, R, "ff", 1.4)];
  const ex = cx - e, eq = cx + e, a = alpha * RAD, b = beta * RAD, px = cx + R * Math.cos(a), py = cy - R * Math.sin(a), rr = 22;
  out.push(C(px, py, rr, "fs", 1.4), L(eq, cy, px, py, "fs", 1), C(ex, cy, 4, "fa", 1.2), C(eq, cy, 2.6, "fh", 1.2), C(cx, cy, 1.8, "fm", 1));
  out.push(C(px + rr * Math.cos(b), py - rr * Math.sin(b), 3.6, "fh", 1.2), C(px, py, 1.6, "fm", 1));
  out.push(T(ex - 6, cy + 16, "Earth", { s: 9.5 }), T(eq + 6, cy + 16, "equant", { s: 9.5, c: "fh" }), T(cx, cy - R - 8, "deferent", { s: 9, c: "fm" }), T(px + rr + 5, py - 14, "epicycle", { a: "start", s: 9, c: "fm" }));
  out.push(T(cx + 126, 170, "planet", { s: 9.5, c: "fh" }), L(cx + 122, 163, px + rr * Math.cos(b) + 5, py - rr * Math.sin(b) + 3, "fs", 0.8));
  return out.join("");
}

/** The Moon entering the Earth's round shadow. */
function lunareclipse({ cover = .55 }) {
  const mx = 150, my = 96, mr = 34, sr = 62, sx = mx + mr - cover * 2 * mr + sr;
  return [`<clipPath id="fmMoon"><circle cx="${mx}" cy="${my}" r="${mr}"/></clipPath>`,
    C(mx, my, mr, "ff", 1.6), `<circle class="fshade" cx="${r1(sx - 0)}" cy="${my}" r="${sr}" clip-path="url(#fmMoon)"/>`, C(sx, my, sr, "fd", 1.4),
    T(sx + 6, my - sr - 6, "Earth's shadow", { s: 10 }), T(mx - 4, my + mr + 18, "the edge is always round", { a: "end", s: 9.5, c: "fm" })].join("");
}

/** A dial of cells along a spiral, as on the Antikythera mechanism: { dials: [[cells, turns, label]] }. */
function spirals({ dials }) {
  const out = [];
  dials.forEach(([cells, turns, label], k) => {
    const cx = dials.length === 1 ? 160 : 90 + k * 140, cy = 92, r0 = 14, r1_ = 56, step = turns * 2 * Math.PI / cells;
    let d = "";
    for (let i = 0; i <= 120 * turns; i++) { const th = i / 120 * 2 * Math.PI, r = r0 + (r1_ - r0) * th / (turns * 2 * Math.PI); d += `${i ? "L" : "M"}${r1(cx + r * Math.cos(th - Math.PI / 2))} ${r1(cy + r * Math.sin(th - Math.PI / 2))}`; }
    out.push(P(d, "fs", 1.2));
    for (let i = 0; i <= cells; i++) { const th = i * step, r = r0 + (r1_ - r0) * th / (turns * 2 * Math.PI), a = th - Math.PI / 2; out.push(L(cx + (r - 2.6) * Math.cos(a), cy + (r - 2.6) * Math.sin(a), cx + (r + 2.6) * Math.cos(a), cy + (r + 2.6) * Math.sin(a), "fl", .8)); }
    out.push(T(cx, cy + 82, label, { s: 10 }), T(cx, cy + 94, `${cells} cells, ${turns} turns`, { s: 8.5, c: "fm" }));
  });
  return out.join("");
}

/** A star compass: the horizon from above, thirty-two points, stars rising and setting on fixed bearings. */
function compass() {
  const cx = 160, cy = 96, R = 68, out = [C(cx, cy, R, "ff", 1.6)];
  for (let i = 0; i < 32; i++) { const a = i * 11.25 * RAD, big = i % 8 === 0, len = big ? 10 : i % 4 === 0 ? 7 : 4; out.push(L(cx + (R - len) * Math.sin(a), cy - (R - len) * Math.cos(a), cx + R * Math.sin(a), cy - R * Math.cos(a), big ? "fb" : "fs", big ? 2 : 1)); }
  for (const [lab, a] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) out.push(T(cx + (R + 11) * Math.sin(a * RAD), cy - (R + 11) * Math.cos(a * RAD) + 3.5, lab, { s: 10.5 }));
  for (const a of [60, 72, 84, 96]) out.push(L(cx, cy, cx + R * Math.sin(a * RAD), cy - R * Math.cos(a * RAD), "fh", 1), C(cx + R * Math.sin(a * RAD), cy - R * Math.cos(a * RAD), 2.6, "fa", 1));
  for (const a of [276, 264, 288, 276]) out.push(L(cx, cy, cx + R * .6 * Math.sin(a * RAD), cy - R * .6 * Math.cos(a * RAD), "fs", .8));
  out.push(P(`M${cx - 9} ${cy + 4}Q${cx} ${cy + 10} ${cx + 9} ${cy + 4}L${cx + 5} ${cy - 5}H${cx - 5}Z`, "fa", 1.2), T(cx + 84, cy - 52, "stars rise", { a: "start", s: 9, c: "fh" }), T(cx - 84, cy + 44, "set", { a: "end", s: 9, c: "fm" }));
  return out.join("");
}

/** Al-Biruni's dip: from a hilltop the horizon lies below the level line by an angle that grows with the height and shrinks with the Earth's size (not to scale). */
function dip() {
  const R = 300, cx = 160, cy = 150 + R, h = 30, ox = cx, oy = cy - R - h, cosd = R / (R + h), d = Math.acos(cosd), tx = cx + R * Math.sin(d), ty = cy - R * Math.cos(d);
  const out = [`<path class="ff" stroke-width="1.8" d="M${cx - 150} ${r1(cy - Math.sqrt(R * R - 150 * 150))}A${R} ${R} 0 0 1 ${cx + 150} ${r1(cy - Math.sqrt(R * R - 150 * 150))}V190H${cx - 150}Z"/>`];
  out.push(L(ox, oy, ox, cy - R, "fb", 3), L(ox, oy, 300, oy, "fs", 1), L(ox, oy, tx, ty, "fh", 1.8), C(tx, ty, 3, "fa", 1.2), C(ox, oy, 3.4, "fa", 1.2));
  out.push(P(`M${ox + 52} ${oy}A52 52 0 0 1 ${r1(ox + 52 * Math.cos(Math.atan2(ty - oy, tx - ox)))} ${r1(oy + 52 * Math.sin(Math.atan2(ty - oy, tx - ox)))}`, "fh", 1.6));
  out.push(T(ox + 60, oy + 17, "dip", { a: "start", s: 10.5, c: "fh" }), T(ox - 8, oy - 4, "hill: height h", { a: "end", s: 9.5 }), T(tx - 8, ty - 9, "horizon", { a: "end", s: 9.5 }), T(160, 176, "Earth, radius R (not to scale)", { s: 9.5, c: "fm" }));
  return out.join("");
}

export const FIGS = { timeline, bars, plot, shadow, halfmoon, precession, tusi, epicycle, lunareclipse, spirals, compass, dip };
/** A figure as the inside of an svg; a lesson without one of its own gets a timeline if it has dates, else nothing. */
export function draw(fig) { return fig && FIGS[fig.t] ? FIGS[fig.t](fig) : ""; }
