// Figures for courses: small inline SVG diagrams drawn from a spec, so a lesson step can show the thing it says. Pure functions (a spec in, an SVG string out), used by
// lesson-kit.js and by any stage that wants a picture beside a step's words. Text sizes are the drawing's own units (an SVG drawn to a viewBox), colours are the suite's
// tokens through lesson-kit.css (.lf-*), so a figure follows Codex day, Codex night and Office.
//
// A spec is { type, ...}. Every type may carry `alt` (the figure's label for a screen reader).
//   graph     { w, h, nodes: [{ id, x, y, label ("\n" breaks a line), w?, h?, tone?, layer?, note?, slot? }], edges: [{ a, b, label?, kind?: "arrow"|"line"|"dash", layer? }] }
//             x, y is the node's centre. A node with `layer` is dimmed unless that layer is on (toggle steps); with `note` it can be tapped (explore steps); `slot` draws it empty
//             (build steps) until a piece is placed.
//   timeline  { from, to, items: [{ at, label, tone? }] }                       dated events along an axis, labels alternating above and below
//   scale     { min, max, unit?, marks: [{ at, label, tone? }], bands?: [{ from, to, label, tone? }], value? }   an axis with thresholds, bands and the slider's current value
//   bars      { max?, unit?, rows: [{ label, value, tone?, text? }] }
//   seats     { parties: [{ label, n, tone? }] }                                a hemicycle of dots, one per seat, in the order given (left to right)
//   stack     { rows: [{ label, sub?, tone? }] }                                layers from top to bottom, each wider than the one above (a hierarchy of norms)
// Tones: a, b, c, d (the enamels), ok, no, soft (default).
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const T = t => (t ? ` t-${t}` : "");
const lines = s => String(s ?? "").split("\n");
const textW = s => Math.max(...lines(s).map(l => l.length)) * 5.3 + 12;

function text(x, y, label, cls = "", size = 10, anchor = "middle") {
  const ls = lines(label), y0 = y - ((ls.length - 1) * size * 1.15) / 2 + size * 0.35;
  return `<text class="lf-t ${cls}" x="${x}" y="${y0.toFixed(1)}" text-anchor="${anchor}" font-size="${size}">${ls.map((l, i) => `<tspan x="${x}" dy="${i ? size * 1.15 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
}
/** Where a line from the centre of a box towards (px, py) leaves the box. */
function edgePoint(n, px, py) {
  const dx = px - n.x, dy = py - n.y;
  if (!dx && !dy) return [n.x, n.y];
  const k = Math.min(dx ? n.w / 2 / Math.abs(dx) : Infinity, dy ? n.h / 2 / Math.abs(dy) : Infinity);
  return [n.x + dx * k, n.y + dy * k];
}
const frame = (w, h, body, spec, uid) =>
  `<svg class="lf" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(spec.alt || "Diagram")}" preserveAspectRatio="xMidYMid meet"><defs><marker id="lfa${uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="lf-head"/></marker></defs>${body}</svg>`;

function graph(spec, o) {
  const nodes = spec.nodes.map(n => ({ ...n, w: Math.max(n.w || 0, n.slot ? 66 : 0, textW(n.label)), h: n.h || (lines(n.label).length > 1 ? 30 : n.slot || n.note ? 28 : 24) }));
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  const on = o.on || null, off = l => !!l && !!on && !on[l];
  const edges = (spec.edges || []).map(e => {
    const a = by[e.a], b = by[e.b];
    if (!a || !b) return "";
    const [x1, y1] = edgePoint(a, b.x, b.y), [x2, y2] = edgePoint(b, a.x, a.y), kind = e.kind || "arrow";
    return `<g class="lf-edge${off(e.layer) ? " off" : ""}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"${kind === "dash" ? ' stroke-dasharray="4 3"' : ""}${kind === "arrow" ? ` marker-end="url(#lfa${o.uid})"` : ""}/>`
      + (e.label ? text((x1 + x2) / 2, (y1 + y2) / 2 - 5, e.label, "lf-el", 8.5) : "") + "</g>";
  }).join("");
  const boxes = nodes.map(n => {
    const placed = o.placed?.[n.id], empty = n.slot && !placed, tap = n.note || n.slot;
    const cls = `lf-node${T(n.tone)}${empty ? " empty" : ""}${off(n.layer) ? " off" : ""}${o.seen?.[n.id] ? " seen" : ""}${o.sel === n.id ? " sel" : ""}${o.bad === n.id ? " bad" : ""}${placed ? " put" : ""}`;
    const label = empty ? "?" : placed || n.label;
    const attrs = tap ? ` data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(empty ? "Empty place" : String(label).replace(/\n/g, " "))}"` : "";
    const hit = tap ? `<rect class="lf-hit" x="${(n.x - Math.max(n.w, 40) / 2).toFixed(1)}" y="${(n.y - Math.max(n.h, 38) / 2).toFixed(1)}" width="${Math.max(n.w, 40)}" height="${Math.max(n.h, 38)}"/>` : "";
    return `<g class="${cls}"${attrs}>${hit}<rect x="${(n.x - n.w / 2).toFixed(1)}" y="${(n.y - n.h / 2).toFixed(1)}" width="${n.w.toFixed(1)}" height="${n.h}" rx="4"/>${text(n.x, n.y, label, "", 9.5)}</g>`;
  }).join("");
  return frame(spec.w || 300, spec.h || 180, edges + boxes, spec, o.uid);
}

function timeline(spec, o) {
  const W = 300, H = 120, x0 = 18, x1 = W - 18, y = 60, k = v => x0 + ((v - spec.from) / (spec.to - spec.from)) * (x1 - x0);
  const items = [...spec.items].sort((a, b) => a.at - b.at);
  const body = [`<line class="lf-axis" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`, text(x0, y + 12, String(spec.from), "lf-tick", 8), text(x1, y + 12, String(spec.to), "lf-tick", 8)];
  items.forEach((it, i) => {
    const up = i % 2 === 0, px = k(it.at), cx = Math.min(x1 - 16, Math.max(x0 + 16, px)), ty = up ? y - 34 : y + 30;
    body.push(`<line class="lf-stem" x1="${px.toFixed(1)}" y1="${y}" x2="${cx.toFixed(1)}" y2="${up ? y - 20 : y + 18}"/><circle class="lf-dot${T(it.tone)}" cx="${px.toFixed(1)}" cy="${y}" r="3.5"/>`
      + text(cx, ty - (up ? 8 : 0), `${it.at}`, "lf-yr", 8.5) + text(cx, ty + (up ? 2 : 10), it.label, "", 8.5));
  });
  return frame(W, H, body.join(""), spec, o.uid);
}

function scale(spec, o) {
  const W = 300, H = 100, x0 = 16, x1 = W - 16, y = 46, { min, max } = spec, k = v => x0 + ((v - min) / (max - min)) * (x1 - x0), u = spec.unit || "";
  const body = [];
  (spec.bands || []).forEach(b => body.push(`<rect class="lf-band${T(b.tone)}" x="${k(b.from).toFixed(1)}" y="${y - 9}" width="${(k(b.to) - k(b.from)).toFixed(1)}" height="18"/>${text((k(b.from) + k(b.to)) / 2, y, b.label || "", "lf-bl", 8)}`));
  body.push(`<line class="lf-axis" x1="${x0}" y1="${y + 9}" x2="${x1}" y2="${y + 9}"/>`, text(x0, y + 22, `${min}${u}`, "lf-tick", 8), text(x1, y + 22, `${max}${u}`, "lf-tick", 8));
  (spec.marks || []).forEach((m, i) => {
    const x = k(m.at), up = i % 2 === 0;
    body.push(`<line class="lf-mark${T(m.tone)}" x1="${x.toFixed(1)}" y1="${y - 14}" x2="${x.toFixed(1)}" y2="${y + 12}"/>${text(Math.min(x1 - 12, Math.max(x0 + 12, x)), up ? y - 22 : y + 34, `${m.label}`, "", 8.5)}`);
  });
  if (spec.value != null) body.push(`<path class="lf-pin" d="M${k(spec.value).toFixed(1)} ${y + 8} l-5 -14 h10 z"/>`);
  return frame(W, H, body.join(""), spec, o.uid);
}

function bars(spec, o) {
  const rows = spec.rows, max = spec.max || Math.max(...rows.map(r => r.value)), rh = 22, W = 300, lw = 100, H = rows.length * rh + 8;
  const body = rows.map((r, i) => {
    const y = 4 + i * rh, w = Math.max(2, (r.value / max) * (W - lw - 54));
    return text(lw - 6, y + 9, r.label, "lf-bl", 9, "end") + `<rect class="lf-bar${T(r.tone)}" x="${lw}" y="${y + 1}" width="${w.toFixed(1)}" height="16" rx="2"/>${text(lw + w + 4, y + 9, r.text ?? `${r.value}${spec.unit || ""}`, "lf-v", 9, "start")}`;
  });
  return frame(W, H, body.join(""), spec, o.uid);
}

function seats(spec, o) {
  const total = spec.parties.reduce((a, p) => a + p.n, 0), W = 300, H = 152, cx = W / 2, cy = 130;
  const rows = Math.max(2, Math.min(7, Math.round(Math.sqrt(total / 3)))), radii = Array.from({ length: rows }, (_, i) => 48 + (i * 88) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0), pos = [];
  let left = total;
  radii.forEach((r, i) => {
    const n = i === rows - 1 ? left : Math.round((total * r) / sum);
    left -= n;
    for (let j = 0; j < n; j++) pos.push({ a: Math.PI - (n === 1 ? Math.PI / 2 : (j / (n - 1)) * Math.PI), r });
  });
  pos.sort((p, q) => q.a - p.a || p.r - q.r);
  let k = 0;
  const dots = spec.parties.map(p => Array.from({ length: p.n }, () => pos[k++]).map(s => `<circle class="lf-seat${T(p.tone)}" cx="${(cx + Math.cos(s.a) * s.r).toFixed(1)}" cy="${(cy - Math.sin(s.a) * s.r).toFixed(1)}" r="${rows > 4 ? 3 : 4}"/>`).join("")).join("");
  const legend = spec.parties.map((p, i) => `<tspan class="lf-lg${T(p.tone)}" dx="${i ? 10 : 0}">${esc(p.label)} ${p.n}</tspan>`).join("");
  return frame(W, H, `${dots}<text class="lf-t" x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="9">${legend}</text>`, spec, o.uid);
}

function stack(spec, o) {
  const n = spec.rows.length, W = 300, rh = 32, H = n * rh + 8;
  const body = spec.rows.map((r, i) => {
    const w = 120 + (i / Math.max(1, n - 1)) * 170, x = (W - w) / 2, y = 4 + i * rh;
    return `<rect class="lf-layer${T(r.tone)}" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rh - 4}" rx="3"/>${text(W / 2, y + (rh - 4) / 2, r.sub ? `${r.label}\n${r.sub}` : r.label, "", r.sub ? 8.5 : 9.5)}`;
  });
  return frame(W, H, body.join(""), spec, o.uid);
}

const DRAW = { graph, timeline, scale, bars, seats, stack };
let UID = 0;
/** The SVG for a spec; opts: { on (layers), seen (nodes opened), sel, bad, placed ({ slotId: label }) }. Empty string for an unknown type. */
export function figHtml(spec, opts = {}) {
  const f = DRAW[spec?.type];
  if (!f) return "";
  return f(spec, { ...opts, uid: opts.uid ?? ++UID });
}
export const FIG_TYPES = Object.keys(DRAW);
