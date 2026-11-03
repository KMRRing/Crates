// Drawing helpers shared by the Navigation course's instruments (navigation-sea.js, navigation-sky.js): every instrument is an SVG
// drawn to one box, W by H, so it scales with the stage and a tablet draws it larger; the numbers in it are in that box's units.
import { RAD } from "./landfall-sky.js";

export const W = 360, H = 300;
export const f1 = n => Math.round(n * 10) / 10;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** An SVG text element: `cls` styles it (navigation.css), `anchor` is start, middle or end. */
export const text = (x, y, s, cls = "", anchor = "start") => `<text x="${f1(x)}" y="${f1(y)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
export const line = (x1, y1, x2, y2, cls = "") => `<path d="M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}" class="${cls}"/>`;
/** The point at `deg` degrees clockwise from north (up) at distance r from (cx, cy). */
export const polar = (cx, cy, r, deg) => [cx + r * Math.sin(deg * RAD), cy - r * Math.cos(deg * RAD)];
/** The point at `deg` degrees above the horizontal (to the right) at distance r from (cx, cy). */
export const elev = (cx, cy, r, deg) => [cx + r * Math.cos(deg * RAD), cy - r * Math.sin(deg * RAD)];
/** A four-pointed star, the Codex's own, centred on (x, y) with radius r. */
export const starShape = (x, y, r, cls = "nv-star") => `<path class="${cls}" d="M${f1(x)} ${f1(y - r)}L${f1(x + r * .28)} ${f1(y - r * .28)}L${f1(x + r)} ${f1(y)}L${f1(x + r * .28)} ${f1(y + r * .28)}L${f1(x)} ${f1(y + r)}L${f1(x - r * .28)} ${f1(y + r * .28)}L${f1(x - r)} ${f1(y)}L${f1(x - r * .28)} ${f1(y - r * .28)}Z"/>`;

/**
 * A slider drawn in the box: { id, x1, x2, y, min, max, step, value, label, show }. Its knob is 11 units across, so the hit area is
 * a band round the track (see sliderHit). Returns the SVG.
 */
export function slider(s) {
  const t = (s.value - s.min) / (s.max - s.min), x = s.x1 + t * (s.x2 - s.x1);
  return `<g class="nv-slider${s.off ? " off" : ""}">${s.label ? text(s.x1, s.y - 13, s.label, "nv-cap") : ""}${s.show ? text(s.x2, s.y - 13, s.show, "nv-val", "end") : ""}`
    + `<path d="M${s.x1} ${s.y}H${s.x2}" class="nv-track"/><path d="M${s.x1} ${s.y}H${f1(x)}" class="nv-fill"/><circle cx="${f1(x)}" cy="${s.y}" r="9" class="nv-knob"/>`
    + `<circle cx="${f1(x)}" cy="${s.y}" r="3" class="nv-pin"/></g>`;
}
/** Whether a point is on a slider's band (the whole width of the track, a finger's height); the value it asks for, snapped to the step, or null. */
export function sliderHit(s, p) {
  if (s.off || p.y < s.y - 18 || p.y > s.y + 18 || p.x < s.x1 - 14 || p.x > s.x2 + 14) return null;
  return sliderValue(s, p.x);
}
export function sliderValue(s, x) {
  const t = clamp((x - s.x1) / (s.x2 - s.x1), 0, 1), v = s.min + t * (s.max - s.min);
  return clamp(Math.round(v / s.step) * s.step, s.min, s.max);
}
/** A small button drawn in the box: a rectangle with a word, `on` when chosen. */
export function chip(c) {
  return `<g class="nv-chip${c.on ? " on" : ""}"><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h || 24}" rx="4"/>${text(c.x + c.w / 2, c.y + (c.h || 24) / 2 + 4, c.text, "nv-chip-t", "middle")}</g>`;
}
export const inBox = (c, p) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + (c.h || 24);
