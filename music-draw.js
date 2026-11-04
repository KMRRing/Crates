// Drawing helpers for the Music course's instruments (music-stage.js, music-keys.js, music-rhythm-ui.js, music-ear.js): every instrument
// is one SVG drawn to a box, W by H, so it scales with the stage and a tablet draws it larger. The keyboard and the staff are here, since
// several instruments show them. Classes (`mu-`) are styled in music.css from the suite's tokens.
import { isBlack, midiOf, spell, staffStep, CLEFS, LETTERS, nameOf, signatureLetters, SHARPS, FLATS } from "./music-theory.js";

export const W = 360, H = 290;
export const f1 = n => Math.round(n * 10) / 10;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const text = (x, y, s, cls = "", anchor = "start") => `<text x="${f1(x)}" y="${f1(y)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
export const line = (x1, y1, x2, y2, cls = "") => `<path d="M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}" class="${cls}"/>`;
/** A button drawn in the box: a rectangle with a word, `on` when chosen, `dim` when it cannot be used. */
export function chip(c) {
  return `<g class="mu-chip${c.on ? " on" : ""}${c.dim ? " dim" : ""}${c.hot ? " hot" : ""}"><rect x="${f1(c.x)}" y="${f1(c.y)}" width="${f1(c.w)}" height="${c.h || 26}" rx="4"/>${text(c.x + c.w / 2, c.y + (c.h || 26) / 2 + 4.2, c.text, "mu-chip-t", "middle")}</g>`;
}
export const inBox = (c, p) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + (c.h || 26);
/** Lays chips out in rows of the given width starting at (x, y): each { text, w } gets its place; returns the chips with x, y, h. */
export function flow(items, x0, y0, width, gap = 6, h = 26) {
  let x = x0, y = y0;
  return items.map(it => {
    if (x > x0 && x + it.w > x0 + width + 0.5) { x = x0; y += h + gap; }
    const c = { ...it, x, y, h };
    x += it.w + gap;
    return c;
  });
}

/** A slider drawn in the box: { x1, x2, y, min, max, step, value, label, show }. */
export function slider(s) {
  const t = (s.value - s.min) / (s.max - s.min), x = s.x1 + t * (s.x2 - s.x1);
  return `<g class="mu-slider">${s.label ? text(s.x1, s.y - 13, s.label, "mu-cap") : ""}${s.show ? text(s.x2, s.y - 13, s.show, "mu-val", "end") : ""}`
    + `<path d="M${s.x1} ${s.y}H${s.x2}" class="mu-track"/><path d="M${s.x1} ${s.y}H${f1(x)}" class="mu-fill"/><circle cx="${f1(x)}" cy="${s.y}" r="9" class="mu-knob"/><circle cx="${f1(x)}" cy="${s.y}" r="3" class="mu-pin"/></g>`;
}
export function sliderHit(s, p) {
  if (p.y < s.y - 18 || p.y > s.y + 18 || p.x < s.x1 - 14 || p.x > s.x2 + 14) return null;
  return sliderValue(s, p.x);
}
export function sliderValue(s, x) {
  const t = clamp((x - s.x1) / (s.x2 - s.x1), 0, 1), v = s.min + t * (s.max - s.min);
  return clamp(Math.round(v / s.step) * s.step, s.min, s.max);
}

// ---------- the keyboard ----------
/** The keys from midi `lo` to `hi` (both white keys), laid in a box: [{ midi, black, x, y, w, h }], blacks last so they are hit first. */
export function keyLayout(lo, hi, x, y, w, h) {
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const kw = w / whites.length, keys = whites.map((m, i) => ({ midi: m, black: false, x: x + i * kw, y, w: kw, h }));
  for (let m = lo; m <= hi; m++) if (isBlack(m)) {
    const left = keys.find(k => k.midi === m - 1);
    if (left) keys.push({ midi: m, black: true, x: left.x + kw * 0.66, y, w: kw * 0.62, h: h * 0.6 });
  }
  return keys;
}
/** The key under a point (blacks first), or null. */
export const keyAt = (keys, p) => [...keys].reverse().find(k => p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h) || null;
/**
 * Draws a keyboard. o: { keys, labels ("none" | "c" | "names" | "all"), on (Set of midi chosen), lit (midi shown as given), hot (midi hinted),
 * flats (spell black keys with flats), mark ({ midi: "text" } small captions on keys) }. `data-midi` lets the cue loop light keys as they sound.
 */
export function drawKeyboard(o) {
  const out = [], on = o.on || new Set(), lit = o.lit || new Set(), hot = o.hot || new Set(), mark = o.mark || {};
  const cls = k => `${k.black ? "mu-bk" : "mu-wk"}${on.has(k.midi) ? " on" : ""}${lit.has(k.midi) ? " lit" : ""}${hot.has(k.midi) ? " hot" : ""}`;
  for (const k of o.keys.filter(k => !k.black)) out.push(`<rect data-midi="${k.midi}" class="${cls(k)}" x="${f1(k.x)}" y="${f1(k.y)}" width="${f1(k.w)}" height="${f1(k.h)}" rx="2.5"/>`);
  for (const k of o.keys.filter(k => k.black)) out.push(`<rect data-midi="${k.midi}" class="${cls(k)}" x="${f1(k.x)}" y="${f1(k.y)}" width="${f1(k.w)}" height="${f1(k.h)}" rx="2"/>`);
  const labels = o.labels || "c";
  for (const k of o.keys) {
    const pc = ((k.midi % 12) + 12) % 12, nm = nameOf(spell(k.midi, o.flats));
    if (mark[k.midi]) { out.push(text(k.x + k.w / 2, k.y + k.h - (k.black ? 8 : 22), mark[k.midi], `mu-key-mark${k.black ? " black" : ""}`, "middle")); continue; }
    if (labels === "none") continue;
    if (k.black) { if (labels === "all") out.push(text(k.x + k.w / 2, k.y + k.h - 8, nm, "mu-key-t black", "middle")); continue; }
    if (labels === "c" && pc !== 0) continue;
    out.push(text(k.x + k.w / 2, k.y + k.h - 8, labels === "c" ? `C${Math.floor(k.midi / 12) - 1}` : nm, `mu-key-t${pc === 0 ? " c" : ""}`, "middle"));
  }
  return out.join("");
}

// ---------- the staff ----------
const SIG_STEPS = {
  treble: { sharp: [8, 5, 9, 6, 3, 7, 4], flat: [4, 7, 3, 6, 2, 5, 1] },
  bass: { sharp: [6, 3, 7, 4, 1, 5, 2], flat: [2, 5, 1, 4, 0, 3, 6] },
};
/**
 * One five-line staff with a clef. g: { clef, x, y (the top line), w, s (a space, in box units) }. Returns { svg, yOf(step), step(y) }.
 * Notes are added with staffNotes(g, notes).
 */
export function staffFrame(g) {
  const { clef, x, y, w, s } = g, bottom = y + 4 * s, yOf = st => bottom - st * s / 2, out = [];
  for (let i = 0; i < 5; i++) out.push(line(x, y + i * s, x + w, y + i * s, "mu-line"));
  out.push(line(x, y, x, bottom, "mu-line bar"));
  out.push(clef === "treble" ? clefTreble(x + s * 0.4, yOf(2), s) : clefBass(x + s * 0.4, yOf(6), s));
  return { svg: out.join(""), yOf, step: py => Math.round((bottom - py) / (s / 2)), bottom };
}
const clefTreble = (x, yG, s) => `<path class="mu-clef" transform="translate(${f1(x + s * 0.9)} ${f1(yG)}) scale(${f1(s)})" d="M0.1 2.9C-0.3 3.9 0.9 4 1 3.1C1.1 2.4 0.5 1.8 0.4 1.2L0.2 -3.2C0.1 -4.4 0.9 -4.9 1.1 -3.9C1.3 -2.8 0.1 -1.6 -0.7 -0.6C-1.6 0.5 -1.3 1.6 -0.2 1.9C1.1 2.2 1.9 0.9 1.2 -0.1C0.5 -1 -0.8 -0.5 -0.6 0.5"/>`;
const clefBass = (x, yF, s) => `<g class="mu-clef-b" transform="translate(${f1(x + s * 0.5)} ${f1(yF)}) scale(${f1(s)})"><circle cx="0" cy="0" r="0.42" class="fill"/><path d="M-0.4 0.1C0.2 -0.7 1.5 -0.3 1.4 1C1.2 2.3 0 3.1 -1 3.9" /><circle cx="1.9" cy="-0.5" r="0.2" class="fill"/><circle cx="1.9" cy="0.7" r="0.2" class="fill"/></g>`;
/**
 * Draws the key signature (n sharps or flats) and notes on a staff made by staffFrame. notes: [{ n (a note), x, cls, acc (draw its accidental) }].
 * Returns the SVG. A note's accidental is drawn if `acc` (or its own accidental isn't in the signature).
 */
export function staffNotes(f, g, notes, sig = 0) {
  const out = [], { s } = g, steps = SIG_STEPS[g.clef][sig >= 0 ? "sharp" : "flat"];
  let kx = g.x + s * 3.3;
  for (let i = 0; i < Math.abs(sig); i++) { out.push(text(kx + i * s * 0.75, f.yOf(steps[i]) + s * 0.45, sig > 0 ? "♯" : "♭", "mu-acc")); }
  g.firstX = kx + Math.abs(sig) * s * 0.75 + s * 0.6;
  for (const it of notes) {
    const st = staffStep(it.n, g.clef), cy = f.yOf(st), cx = it.x;
    for (let k = -2; k >= st; k -= 2) out.push(line(cx - s * 0.95, f.yOf(k), cx + s * 0.95, f.yOf(k), "mu-line ledger"));
    for (let k = 10; k <= st; k += 2) out.push(line(cx - s * 0.95, f.yOf(k), cx + s * 0.95, f.yOf(k), "mu-line ledger"));
    const up = st < 4;
    out.push(`<g class="mu-note ${it.cls || ""}" data-step="${st}"><ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(s * 0.62)}" ry="${f1(s * 0.46)}" transform="rotate(-20 ${f1(cx)} ${f1(cy)})"/>`
      + (it.stem === false ? "" : line(up ? cx + s * 0.58 : cx - s * 0.58, cy, up ? cx + s * 0.58 : cx - s * 0.58, cy + (up ? -3.3 : 3.3) * s, "mu-stem"))
      + (it.acc && it.n.a ? text(cx - s * 1.35, cy + s * 0.42, { "-1": "♭", 1: "♯", 0: "♮", 2: "♯♯", "-2": "♭♭" }[it.n.a], "mu-acc") : "")
      + `</g>`);
  }
  return out.join("");
}
export { LETTERS, CLEFS, signatureLetters, SHARPS, FLATS, midiOf };
