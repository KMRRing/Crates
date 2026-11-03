// The sextant, as one thumb meets it. The eyepiece shows the horizon and the star's reflected image; the star sits above the horizon
// by (the true reading - the drum's reading) arcminutes plus the swell, so the navigator brings the drum up until the star kisses
// the horizon and rocks about it. The reading the engine uses is the drum's, to a tenth of an arcminute.
//
//  - Dragging anywhere on the eyepiece moves the star's image with the finger, one pixel for one pixel: coarse.
//  - The lens closes in as the star comes down (four steps, with hysteresis, so it never chatters): the same finger movement is
//    then a finer reading, and the swell's small bobbing becomes large enough to see and to centre.
//  - Dragging on the drum, the strip at the right, is five times finer again. -0.1 and +0.1 buttons nudge.
// The maths here is pure (tests/landfall-sextant.mjs); drawSextant is the page's.
import { skyColours } from "./landfall-skyview.js";

export const LENSES = [240, 60, 16, 5];             // half the eyepiece's height in arcminutes, from the widest lens to the closest
export const MAGNIFY = ["×1", "×4", "×15", "×48"];
export const FINE = 0.2;                            // the drum's reading for the finger, against the eyepiece's
const IN = 0.22, OUT = 0.92;                        // the lens steps in when the star is inside 0.22 of its half-height, out beyond 0.92 (each lens is 3 to 4 times closer than the last, so the two never meet)

export const quantise = r => Math.round(r * 10) / 10;
/** "55° 14.2′" for a reading in arcminutes. */
export function formatReading(arcmin) {
  const d = Math.floor(arcmin / 60 + 1e-9), m = arcmin - d * 60;
  return `${d}° ${m.toFixed(1).padStart(4, "0")}′`;
}
/** "+1° 12′" or "-0.8′": a distance above (+) or below (-) the horizon, in the unit that reads best. */
export function formatOffset(arcmin) {
  const a = Math.abs(arcmin), s = arcmin < 0 ? "-" : "+";
  return a >= 60 ? `${s}${Math.floor(a / 60)}° ${Math.round(a % 60)}′` : `${s}${a.toFixed(a < 10 ? 1 : 0)}′`;
}
/** The lens for a star `offset` arcminutes from the horizon, given the lens now in use (hysteresis: it steps one way at a time until it settles). */
export function lensFor(offset, cur) {
  let l = cur;
  for (let i = 0; i < 4; i++) {
    const a = Math.abs(offset);
    if (l < LENSES.length - 1 && a < IN * LENSES[l]) l++;
    else if (l > 0 && a > OUT * LENSES[l]) l--;
    else break;
  }
  return l;
}
/** Pixels in one arcminute at a lens, for an eyepiece whose half-height is `half` pixels. */
export const pxPerArcmin = (lens, half) => half / LENSES[lens];
/** The reading after a finger moves `dy` pixels down (the star's image moves down with it, so the reading goes up), coarse or on the drum. */
export const dragReading = (reading, dy, lens, half, fine = false) => quantise(reading + dy / pxPerArcmin(lens, half) * (fine ? FINE : 1));
/** How far above the horizon the star's image stands, in arcminutes: the true reading less the drum's, and the swell on top. */
export const offsetOf = (truth, reading, swell) => truth - reading + swell;

/** A sextant's state: the drum's reading, the lens and the marks. */
export function newSextant(reading) { return { reading: quantise(reading), lens: 0, marks: [], flash: 0 }; }
export const MAX_MARKS = 3;
export function mark(st) { if (st.marks.length >= MAX_MARKS) return false; st.marks.push(st.reading); st.flash = 1; return true; }
export function clearMarks(st) { st.marks = []; }

/** The layout of the sextant on a canvas w by h: the eyepiece's circle, and the drum's strip. */
export function layout(w, h) {
  const dw = Math.max(38, w * 0.095), zone = dw + 14, room = w - zone - 16;      // the drum's strip, and what is left for the eyepiece
  const rho = Math.min(room / 2, h * 0.34), cx = 8 + room / 2, cy = Math.max(rho + h * 0.12, h * 0.4);
  const drum = { x: w - dw - 6, y: cy - rho, w: dw, h: 2 * rho };
  return { cx, cy, rho, drum };
}
export const inDrum = (L, x, y) => x >= L.drum.x - 8 && x <= L.drum.x + L.drum.w + 8 && y >= L.drum.y && y <= L.drum.y + L.drum.h;

/**
 * Draws the eyepiece, the drum and the reading. `sc`: { offset (arcmin, now), swellPhase (-1..1, for the horizon's tilt), sunAlt, t (s), k (scale), mono (css font) }.
 */
export function drawSextant(ctx, w, h, st, sc) {
  const { cx, cy, rho, drum } = layout(w, h), k = sc.k || 1, col = skyColours(sc.sunAlt), lens = LENSES[st.lens], ppa = rho / lens;
  const rgb = (c, a = 1) => `rgba(${c.map(Math.round).join(",")},${a})`;
  // the eyepiece: sky above the horizon, sea below, both lit by the twilight
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rho, 0, 6.283); ctx.clip();
  const tilt = (sc.swellPhase || 0) * 0.012;
  ctx.translate(cx, cy); ctx.rotate(tilt);
  const g = ctx.createLinearGradient(0, -rho, 0, 0);
  g.addColorStop(0, rgb(col.top.map(x => x * 0.7 + 4))); g.addColorStop(1, rgb(col.hor));
  ctx.fillStyle = g; ctx.fillRect(-rho, -rho, 2 * rho, rho);
  const sg = ctx.createLinearGradient(0, 0, 0, rho), dark = col.hor.map(x => x * 0.2 + 4);
  sg.addColorStop(0, rgb(col.hor.map((x, i) => (x + dark[i]) / 2))); sg.addColorStop(0.25, rgb(dark)); sg.addColorStop(1, rgb(dark.map(x => x * 0.5)));
  ctx.fillStyle = sg; ctx.fillRect(-rho, 0, 2 * rho, rho);
  ctx.strokeStyle = rgb(col.hor.map(x => Math.min(255, x * 1.4 + 20)), 0.95); ctx.lineWidth = 1.6 * k;
  ctx.beginPath(); ctx.moveTo(-rho, 0); ctx.lineTo(rho, 0); ctx.stroke();
  // a ruler down the left edge, in the lens's own steps
  const step = lens >= 200 ? 60 : lens >= 50 ? 15 : lens >= 12 ? 4 : 1;
  ctx.fillStyle = "rgba(240,226,190,.8)"; ctx.strokeStyle = "rgba(240,226,190,.55)"; ctx.lineWidth = 1; ctx.font = `${10.5 * k}px ${sc.mono || "monospace"}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let a = -Math.floor(lens / step) * step; a <= lens; a += step) {
    const y = -a * ppa;
    ctx.beginPath(); ctx.moveTo(-rho * 0.86, y); ctx.lineTo(-rho * 0.86 + (a === 0 ? 14 : 8) * k, y); ctx.stroke();
    if (a !== 0 && Math.abs(y) < rho * 0.92) ctx.fillText(step >= 60 ? `${a / 60}°` : `${a}′`, -rho * 0.86 + 12 * k, y);
  }
  // the star's image
  const off = sc.offset, y = -off * ppa;
  if (Math.abs(y) < rho - 6) {
    const r = 3.2 * k, gg = ctx.createRadialGradient(0, y, 0, 0, y, r * 6);
    gg.addColorStop(0, "rgba(255,248,226,.95)"); gg.addColorStop(0.25, "rgba(255,240,200,.45)"); gg.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, y, r * 6, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#fffdf4"; ctx.beginPath(); ctx.arc(0, y, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(255,246,220,.55)"; ctx.lineWidth = 1 * k;
    ctx.beginPath(); ctx.moveTo(-r * 3.2, y); ctx.lineTo(r * 3.2, y); ctx.moveTo(0, y - r * 3.2); ctx.lineTo(0, y + r * 3.2); ctx.stroke();
  }
  ctx.restore();
  // beyond the field: an arrow at the edge toward the star, and how far
  if (Math.abs(off * ppa) >= rho - 6) {
    const up = off > 0, ay = cy + (up ? -rho + 20 * k : rho - 20 * k);
    ctx.fillStyle = "rgba(255,246,220,.95)"; ctx.beginPath();
    ctx.moveTo(cx, ay + (up ? -9 : 9) * k); ctx.lineTo(cx - 9 * k, ay + (up ? 5 : -5) * k); ctx.lineTo(cx + 9 * k, ay + (up ? 5 : -5) * k); ctx.closePath(); ctx.fill();
    ctx.font = `${12 * k}px ${sc.mono || "monospace"}`; ctx.textAlign = "center"; ctx.textBaseline = up ? "top" : "bottom";
    ctx.fillText(formatOffset(off), cx, ay + (up ? 12 : -12) * k);
  }
  // the rim: brass
  ctx.strokeStyle = "rgba(214,176,98,.9)"; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(cx, cy, rho, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, rho - 2.5 * k, 0, 6.283); ctx.stroke();
  if (st.flash > 0) { ctx.fillStyle = `rgba(255,236,190,${0.35 * st.flash})`; ctx.beginPath(); ctx.arc(cx, cy, rho, 0, 6.283); ctx.fill(); }
  // the lens
  ctx.font = `700 ${11 * k}px ${sc.mono || "monospace"}`; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = "rgba(240,226,190,.9)";
  ctx.fillText(MAGNIFY[st.lens], cx - rho + 10 * k, cy - rho + 8 * k);
  // the drum: ridged, turning with the reading
  ctx.save();
  ctx.beginPath(); ctx.roundRect(drum.x, drum.y, drum.w, drum.h, 6 * k); ctx.clip();
  const dg = ctx.createLinearGradient(drum.x, 0, drum.x + drum.w, 0);
  dg.addColorStop(0, "#3a3123"); dg.addColorStop(0.35, "#8f7a4c"); dg.addColorStop(0.5, "#c9b27a"); dg.addColorStop(0.65, "#8f7a4c"); dg.addColorStop(1, "#33291b");
  ctx.fillStyle = dg; ctx.fillRect(drum.x, drum.y, drum.w, drum.h);
  const pitch = 11 * k, ph = ((st.reading * 10 * k) % pitch + pitch) % pitch;
  ctx.strokeStyle = "rgba(30,22,10,.65)"; ctx.lineWidth = 1.4 * k;
  for (let y2 = drum.y - pitch + ph; y2 < drum.y + drum.h + pitch; y2 += pitch) { ctx.beginPath(); ctx.moveTo(drum.x + 2, y2); ctx.lineTo(drum.x + drum.w - 2, y2); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = "rgba(214,176,98,.9)"; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.roundRect(drum.x, drum.y, drum.w, drum.h, 6 * k); ctx.stroke();
  ctx.save(); ctx.translate(drum.x + drum.w / 2, drum.y + drum.h + 4 * k); ctx.font = `700 ${9.5 * k}px ${sc.mono || "monospace"}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(240,226,190,.85)"; ctx.fillText("FINE", 0, 0); ctx.restore();
}
