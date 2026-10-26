// Refinery's pictures for the lessons and the exams. A picture is one of a few kinds, each drawn here into an svg:
//   sheet: a small plant on the flowsheet (refinery-sheet.js), its streams flowing, some of it lit and the rest faint
//   column: the crude column with its cuts drawn off at their heights and temperatures
//   curve: crudes' boiling curves: how much of each has boiled by each temperature
//   bars: values side by side (octane, cetane, prices, sulphur), with a spec's limit as a line
//   blend: components on a property's scale, and where their blend lands against the limit
//   molecules: skeletal formulae of the molecules a step is about
// playScene returns { stop, mark }: mark rings an answer on a flowsheet (an exam's tap question).
import { STREAMS, UNITS, POOLS, CRUDES, PROPS, toIndex, fromIndex } from "./refinery-data.js";
import { evaluate, defaultRouting, normalise, fmtProp, ownProps } from "./refinery-engine.js";
import { drawSheet, GROUP_COLOUR, RANK } from "./refinery-sheet.js";

const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Draws a picture into an svg; the level is the one the lesson belongs to (its crude, unless the picture names one). */
export function playScene(svg, scene, level) {
  svg.classList.remove("rf-scene-sheet");
  svg.innerHTML = "";
  if (!scene) return { stop() {}, mark() {} };
  if (scene.sheet) return sheetScene(svg, scene.sheet, level);
  if (scene.column) return still(svg, columnScene(scene.column, level));
  if (scene.curve) return still(svg, curveScene(scene.curve));
  if (scene.bars) return still(svg, barsScene(scene.bars));
  if (scene.blend) return still(svg, blendScene(scene.blend, level));
  if (scene.molecules) return still(svg, moleculesScene(scene.molecules));
  return { stop() {}, mark() {} };
}
const still = (svg, { vb, body }) => { svg.setAttribute("viewBox", vb); svg.innerHTML = body; return { stop() {}, mark() {} }; };

// ---------- a small plant ----------
/**
 * A plant of the units given (the level's own, unless the scene lists them), routed as the scene says (or as the
 * level's par, or as it starts), with only some of it lit. sheet: { units, crude, pools, routing, only, labels, plant }.
 */
function sheetScene(svg, sc, level) {
  const lv = { ...level, ...(sc.plant || {}) };
  if (sc.units) lv.units = sc.units;
  if (sc.crude) lv.crude = sc.crude;
  if (sc.pools) lv.pools = sc.pools;
  if (sc.bought !== undefined) lv.bought = sc.bought;
  // a lit unit is fed what it takes (unless the picture routes it otherwise), so it's shown running; a feed two lit
  // units take is shared between them (vacuum gas oil between the crackers)
  const demo = { ...(sc.routing || {}) }, takers = {};
  // and what feeds it is made: the units upstream that make its feed are fed too (residue to the vacuum unit for a coker)
  const cuts = CRUDES[lv.crude].cuts;
  const feedUnit = (u, depth = 0) => {
    if (!UNITS[u] || !lv.units.includes(u) || depth > 3) return;
    for (const f of UNITS[u].feeds) {
      if (sc.routing?.[f] || takers[f]?.includes(u)) continue;
      const maker = cuts[f] || lv.bought?.[f] ? null : lv.units.find(m => UNITS[m].yields && Object.values(UNITS[m].yields).some(y => f in y) && m !== u);
      if (!cuts[f] && !lv.bought?.[f] && !maker) continue;
      (takers[f] ||= []).push(u);
      if (maker) feedUnit(maker, depth + 1);
    }
  };
  for (const u of sc.only || []) feedUnit(u);
  for (const [f, us] of Object.entries(takers)) demo[f] = Object.fromEntries(us.map(u => [u, 1 / us.length]));
  const routing = normalise(lv, { ...defaultRouting(lv), ...demo });
  const res = evaluate(lv, routing);
  svg.classList.add("rf-scene-sheet");
  drawSheet(svg, lv, res, { only: sc.only, labels: sc.labels, mini: !sc.figures, flow: !matchMedia("(prefers-reduced-motion: reduce)").matches });
  if (sc.only?.length && sc.frame !== false) frame(svg, sc.only);
  return {
    stop() {},
    // rings the right answer, and a wrong tap too, each named
    mark(answer, given, right) {
      const ring = (id, cls) => {
        const g = id?.startsWith("stream:") ? svg.querySelector(`[data-stream="${id.slice(7)}"]`) : svg.querySelector(`[data-node="${id}"]`);
        if (g) g.classList.add(cls);
      };
      ring(answer, "rf-right");
      if (!right) ring(given, "rf-wrong");
    },
  };
}
/** Frames the picture on some of its nodes, with room round them. */
function frame(svg, ids) {
  const boxes = ids.map(id => svg.querySelector(`[data-node="${id}"] rect`)).filter(Boolean).map(r => ({ x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") }));
  if (!boxes.length) return;
  const x0 = Math.min(...boxes.map(b => b.x)) - 30, y0 = Math.min(...boxes.map(b => b.y)) - 20, x1 = Math.max(...boxes.map(b => b.x + b.w)) + 30, y1 = Math.max(...boxes.map(b => b.y + b.h)) + 20;
  const vb = svg.viewBox.baseVal;
  // never tighter than a third of the whole, so the arrows in and out still read
  const w = Math.max(x1 - x0, vb.width / 3), h = Math.max(y1 - y0, vb.height / 3), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  svg.setAttribute("viewBox", `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
}

// ---------- the crude column ----------
// cut temperatures, top to bottom: what each cut boils between
const CUTS = [["gas", "LPG and gas", "< 30 °C"], ["lsr", "Light naphtha", "30–80 °C"], ["hsr", "Heavy naphtha", "80–180 °C"], ["kero", "Kerosene", "160–240 °C"],
  ["lgo", "Light gas oil", "240–320 °C"], ["hgo", "Heavy gas oil", "320–370 °C"], ["atmResid", "Residue", "> 370 °C"]];
/** column: { crude, lit: [cuts], yields (show each cut's share of the barrel) } */
function columnScene(sc, level) {
  const crude = CRUDES[sc.crude || level.crude], lit = new Set(sc.lit || []);
  const W = 300, H = 230, cx = 92, top = 16, bot = 200;
  const parts = [];
  // furnace and feed
  parts.push(`<path class="rf-col-feed" d="M8 ${bot - 16}H40"/><rect class="rf-furnace" x="18" y="${bot - 34}" width="22" height="36" rx="2"/><path class="rf-flame" d="M24 ${bot - 4}q5 -14 10 0z"/><text class="rf-sc-small" x="29" y="${bot + 16}">furnace 360 °C</text>`);
  parts.push(`<path class="rf-col-feed" d="M40 ${bot - 16}H${cx - 22}"/>`);
  // the column, its trays, and the temperature falling up it
  parts.push(`<rect class="rf-col" x="${cx - 22}" y="${top}" width="44" height="${bot - top}" rx="18"/>`);
  for (let i = 0; i < 14; i++) { const y = top + 14 + i * ((bot - top - 28) / 13); parts.push(`<line class="rf-col-tray" x1="${cx - 18 + (i % 2) * 8}" x2="${cx + 10 + (i % 2) * 8}" y1="${y}" y2="${y}"/>`); }
  parts.push(`<text class="rf-sc-small rf-col-t" x="${cx}" y="${top - 4}">~110 °C at the top</text>`);
  // the cuts, drawn off at their heights, wider for a bigger share of the barrel
  const ys = CUTS.map((_, i) => top + 10 + i * ((bot - top - 10) / (CUTS.length - 1)));
  CUTS.forEach(([s, name, temp], i) => {
    const share = s === "gas" ? (crude.cuts.gas || 0) + (crude.cuts.lpg || 0) + (crude.cuts.butane || 0) : crude.cuts[s] || 0;
    const y = ys[i], w = Math.max(1.5, share * 40), on = !lit.size || lit.has(s);
    const col = GROUP_COLOUR[STREAMS[s].group];
    parts.push(`<g class="rf-cut${on ? "" : " dim"}"><path d="M${cx + 22} ${y}H${cx + 64}" stroke="${col}" stroke-width="${w.toFixed(1)}" class="rf-cut-line"/>` +
      `<text class="rf-sc-label" x="${cx + 70}" y="${y + 1}">${esc(name)}</text><text class="rf-sc-small" x="${cx + 70}" y="${y + 11}">${temp}${sc.yields ? ` · ${(share * 100).toFixed(0)}%` : ""}</text></g>`);
  });
  parts.push(`<text class="rf-sc-small" x="${cx}" y="${bot + 16}">${esc(crude.name)}</text>`);
  return { vb: `0 0 ${W} ${H}`, body: parts.join("") };
}

// ---------- boiling curves ----------
const CUT_END = { gas: 20, lpg: 20, butane: 25, lsr: 80, hsr: 180, kero: 240, lgo: 320, hgo: 370 };
/** How much of a crude has boiled by each temperature, from its cuts and its vacuum split (to 550 °C), as points. */
function boilingPoints(c) {
  const crude = CRUDES[c], pts = [[0, 0]];
  let sum = 0;
  for (const s of ["gas", "lpg", "butane", "lsr", "hsr", "kero", "lgo", "hgo"]) { sum += crude.cuts[s] || 0; if (CUT_END[s] > 25 || s === "butane") pts.push([CUT_END[s], sum]); }
  pts.push([450, sum + crude.cuts.atmResid * crude.vgoShare * 0.45], [550, sum + crude.cuts.atmResid * crude.vgoShare]);
  return pts;
}
/** curve: { crudes: [ids] } */
function curveScene(sc) {
  const W = 300, H = 210, x0 = 34, y0 = 176, w = 212, h = 156;
  const X = t => x0 + (t / 600) * w, Y = f => y0 - f * h;
  const parts = [`<path class="rf-axis" d="M${x0} ${y0 - h}V${y0}H${x0 + w}"/>`];
  for (const t of [0, 100, 200, 300, 400, 500]) parts.push(`<text class="rf-sc-small" x="${X(t)}" y="${y0 + 12}">${t}</text>`);
  for (const f of [0.25, 0.5, 0.75, 1]) parts.push(`<line class="rf-grid" x1="${x0}" x2="${x0 + w}" y1="${Y(f)}" y2="${Y(f)}"/><text class="rf-sc-small rf-end" x="${x0 - 4}" y="${Y(f) + 3}">${f * 100}%</text>`);
  parts.push(`<text class="rf-sc-small" x="${x0 + w / 2}" y="${y0 + 26}">boiling point, °C</text>`);
  parts.push(`<line class="rf-limit" x1="${X(370)}" x2="${X(370)}" y1="${y0 - h}" y2="${y0}"/><text class="rf-sc-small" x="${X(370) - 3}" y="${y0 - 6}" style="text-anchor:end">residue above 370 °C</text>`);
  // each curve named at its end, the names pushed apart so none sits on another
  const ends = (sc.crudes || []).map((c, i) => { const pts = boilingPoints(c); return { c, i, pts, y: Y(pts[pts.length - 1][1]) }; }).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 10);
  for (const { c, i, pts, y } of ends) {
    const d = pts.map(([t, f], j) => `${j ? "L" : "M"}${X(t).toFixed(1)} ${Y(f).toFixed(1)}`).join("");
    parts.push(`<path class="rf-curve rf-curve-${i}" d="${d}"/><text class="rf-sc-label rf-curve-label rf-curve-${i}" x="${X(550) + 4}" y="${(y + 3).toFixed(1)}">${esc(CRUDES[c].short || CRUDES[c].name)}</text>`);
  }
  return { vb: `0 0 ${W} ${H}`, body: parts.join("") };
}

// ---------- bars ----------
/** bars: { items: [[label, value, group?]], unit, limit: [value, label], max, min } */
function barsScene(sc) {
  const items = sc.items, n = items.length, W = 300, rowH = Math.min(26, 190 / n), H = n * rowH + 34, x0 = 104, w = 150;
  const lo = sc.min ?? Math.min(0, ...items.map(i => i[1])), top = Math.max(...items.map(i => i[1]), sc.limit?.[0] ?? 0), hi = sc.max ?? lo + (top - lo) * 1.3;
  const X = v => x0 + ((v - lo) / (hi - lo)) * w;
  const parts = [];
  items.forEach(([label, v, group], i) => {
    const y = 10 + i * rowH, col = group ? GROUP_COLOUR[group] || group : "var(--rf-in)";
    parts.push(`<text class="rf-sc-label rf-end" x="${x0 - 6}" y="${y + rowH / 2 + 3}">${esc(label)}</text><rect class="rf-bar-rect" x="${X(Math.min(lo, 0) < 0 ? 0 : lo)}" y="${y + 3}" width="${Math.max(1, X(v) - X(Math.max(lo, 0)))}" height="${rowH - 7}" fill="${col}"/>` +
      `<text class="rf-sc-small" x="${X(v) + 4}" y="${y + rowH / 2 + 3}" style="text-anchor:start">${esc(sc.fmt ? sc.fmt(v) : `${+v.toFixed(1)}${sc.unit ? ` ${sc.unit}` : ""}`)}</text>`);
  });
  if (sc.limit) parts.push(`<line class="rf-limit" x1="${X(sc.limit[0])}" x2="${X(sc.limit[0])}" y1="4" y2="${10 + n * rowH}"/><text class="rf-sc-small rf-limit-label" x="${X(sc.limit[0])}" y="${16 + n * rowH}">${esc(sc.limit[1])}</text>`);
  return { vb: `0 0 ${W} ${H}`, body: parts.join("") };
}

// ---------- a blend on a property's scale ----------
/** blend: { prop, parts: [[stream or label, volume, value?]], limit, dir ("max" | "min") } */
function blendScene(sc, level) {
  const k = sc.prop, W = 300, H = 160, x0 = 24, w = 252;
  const parts = sc.parts.map(([s, v, val]) => ({ label: STREAMS[s]?.short || s, v, val: val ?? ownProps(level, s)[k] ?? STREAMS[s]?.p?.[k], group: STREAMS[s]?.group }));
  const vals = parts.map(p => p.val).concat(sc.limit);
  const log = k === "s" || k === "visc";
  const tr = v => (log ? Math.log10(Math.max(v, 0.1)) : v), lo = Math.min(...vals.map(tr)), hi = Math.max(...vals.map(tr)), pad = (hi - lo) * 0.08 || 1;
  const X = v => x0 + ((tr(v) - lo + pad) / (hi - lo + 2 * pad)) * w;
  // the blend, by the property's own rule
  let wsum = 0, isum = 0;
  for (const p of parts) { const wt = PROPS[k].basis === "mass" ? p.v * (STREAMS[sc.parts.find(q => (STREAMS[q[0]]?.short || q[0]) === p.label)?.[0]]?.p?.d ?? 850) : p.v; wsum += wt; isum += wt * toIndex(k, p.val); }
  const blendVal = fromIndex(k, isum / wsum);
  const y = 84, out = [`<line class="rf-axis" x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}"/>`];
  // labels stacked in rows over their blobs, left to right, each on the lowest row it doesn't overlap
  const row = new Map(), ends = [];
  for (const p of [...parts].sort((a, b) => X(a.val) - X(b.val))) {
    const half = Math.max(p.label.length * 2.7, fmtProp(k, p.val).length * 2.1), x = X(p.val);
    let at = ends.findIndex(e => e < x - half - 3);
    if (at < 0) at = ends.length < 3 ? ends.length : ends.indexOf(Math.min(...ends));
    ends[at] = x + half; row.set(p, at);
  }
  parts.forEach(p => {
    const r = 4 + Math.sqrt(p.v) * 2.2, yy = y - r - 12 - row.get(p) * 18;
    out.push(`<circle cx="${X(p.val)}" cy="${y}" r="${r.toFixed(1)}" fill="${GROUP_COLOUR[p.group] || "var(--rf-in)"}" class="rf-blob"/><text class="rf-sc-label" x="${X(p.val)}" y="${yy}">${esc(p.label)}</text><text class="rf-sc-small" x="${X(p.val)}" y="${yy + 10}">${esc(fmtProp(k, p.val))}</text>`);
  });
  const ok = sc.dir === "min" ? blendVal >= sc.limit - 1e-9 : blendVal <= sc.limit + 1e-9;
  out.push(`<line class="rf-limit" x1="${X(sc.limit)}" x2="${X(sc.limit)}" y1="${y - 54}" y2="${y + 40}"/><text class="rf-sc-small rf-limit-label" x="${X(sc.limit)}" y="${y + 52}">limit ${esc(fmtProp(k, sc.limit))}</text>`);
  out.push(`<path class="rf-blend-mark ${ok ? "ok" : "no"}" d="M${X(blendVal)} ${y + 8}l-6 12h12z"/><text class="rf-sc-label ${ok ? "rf-ok" : "rf-no"}" x="${X(blendVal)}" y="${y + 32}">blend ${esc(fmtProp(k, blendVal))}</text>`);
  if (log) out.push(`<text class="rf-sc-small" x="${x0 + w}" y="${H - 6}" style="text-anchor:end">log scale</text>`);
  return { vb: `0 0 ${W} ${H}`, body: out.join("") };
}

// ---------- molecules ----------
// skeletal formulae: a carbon at every bend and end, hydrogens left out, as chemists draw them
const MOL = {
  nheptane: { name: "n-heptane", note: "RON 0", chain: 7 },
  nhexane: { name: "n-hexane", note: "RON 25", chain: 6 },
  dmb: { name: "2,2-dimethylbutane", note: "RON 92", dmb: true },
  isooctane: { name: "iso-octane", note: "RON 100", branched: true },
  benzene: { name: "benzene", note: "aromatic", ring: 6, aromatic: true },
  toluene: { name: "toluene", note: "RON 120", ring: 6, aromatic: true, methyl: true },
  cyclohexane: { name: "cyclohexane", note: "naphthene", ring: 6 },
  hexadecane: { name: "cetane (hexadecane)", note: "cetane 100", chain: 12 },
  methylnaphthalene: { name: "α-methylnaphthalene", note: "cetane 0", naphthalene: true },
  thiophene: { name: "thiophene", note: "sulphur in a ring", thiophene: true },
  triglyceride: { name: "a triglyceride", note: "vegetable oil", tri: true },
  ethanol: { name: "ethanol", note: "RON 109", ethanol: true },
  etbe: { name: "ETBE", note: "RON 118", ether: true },
};
function molecule(key, ox, oy) {
  const m = MOL[key], b = 11, out = [];
  const line = pts => `<path class="rf-bond" d="${pts.map(([x, y], i) => `${i ? "L" : "M"}${(ox + x).toFixed(1)} ${(oy + y).toFixed(1)}`).join("")}"/>`;
  if (m.chain) out.push(line(Array.from({ length: m.chain }, (_, i) => [i * b * 0.87, i % 2 ? -b / 2 : 0])));
  else if (m.branched) {
    out.push(line([[0, 0], [9.5, -5.5], [19, 0], [28.5, -5.5], [38, 0]]));
    out.push(line([[9.5, -5.5], [9.5, -16.5]]), line([[9.5, -5.5], [0, -11]]), line([[28.5, -5.5], [28.5, -16.5]]));
  } else if (m.dmb) {
    out.push(line([[0, 0], [9.5, -5.5], [19, 0], [28.5, -5.5]]), line([[9.5, -5.5], [9.5, -16.5]]), line([[9.5, -5.5], [0, -11]]));
  } else if (m.ring || m.naphthalene) {
    const hex = (cx, cy) => Array.from({ length: 7 }, (_, i) => [cx + b * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), cy + b * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
    out.push(line(hex(14, -6)));
    if (m.aromatic) out.push(`<circle class="rf-bond" cx="${ox + 14}" cy="${oy - 6}" r="6" fill="none"/>`);
    if (m.methyl) out.push(line([[14, -6 - b], [14, -6 - 2 * b]]));
    if (m.naphthalene) { out.push(line(hex(14 + b * 1.732, -6))); out.push(`<circle class="rf-bond" cx="${ox + 14}" cy="${oy - 6}" r="6" fill="none"/><circle class="rf-bond" cx="${ox + 14 + b * 1.732}" cy="${oy - 6}" r="6" fill="none"/>`); out.push(line([[14, -6 - b], [14, -6 - 2 * b]])); }
  } else if (m.thiophene) {
    const pts = Array.from({ length: 6 }, (_, i) => [14 + 10 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 5), -6 + 10 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 5)]);
    out.push(line(pts), `<text class="rf-atom" x="${ox + 14}" y="${oy - 13}">S</text>`);
  } else if (m.tri) {
    for (let r = 0; r < 3; r++) out.push(line(Array.from({ length: 9 }, (_, i) => [8 + i * 8, -16 + r * 10 + (i % 2 ? -2.5 : 0)])));
    out.push(line([[4, -16], [4, 4]]), `<text class="rf-atom" x="${ox - 2}" y="${oy - 4}">O₆</text>`);
  } else if (m.ethanol) out.push(line([[0, 0], [9.5, -5.5], [19, 0]]), `<text class="rf-atom" x="${ox + 24}" y="${oy + 3}">OH</text>`);
  else if (m.ether) {
    // a tertiary butyl, its carbon holding three methyls, joined through the oxygen to an ethyl
    out.push(line([[0, 0], [9.5, -5.5], [16.5, -1.5]]), line([[9.5, -5.5], [9.5, -16.5]]), line([[9.5, -5.5], [0, -11]]),
      `<text class="rf-atom" x="${ox + 19}" y="${oy + 3}">O</text>`, line([[21.5, -1.5], [28.5, -5.5], [38, 0]]));
  }
  const mid = m.chain ? ((m.chain - 1) * b * 0.87) / 2 : m.naphthalene ? 14 + b * 0.87 : m.tri ? 36 : m.branched || m.ether ? 19 : 14;
  out.push(`<text class="rf-sc-label" x="${ox + mid}" y="${oy + 22}">${esc(m.name)}</text><text class="rf-sc-small" x="${ox + mid}" y="${oy + 32}">${esc(m.note)}</text>`);
  return out.join("");
}
/** molecules: [keys] */
function moleculesScene(keys) {
  const per = Math.min(3, keys.length), W = 300;
  let rowsNeeded = 1, cx = 0;
  for (const k of keys) { const m = MOL[k], wide = m.chain ? (m.chain - 1) * 11 * 0.87 : m.tri ? 76 : m.naphthalene ? 48 : 40; if (cx && cx + wide > W - 30) { cx = 0; rowsNeeded++; } cx += Math.max(wide + 40, W / per); }
  const H = rowsNeeded * 72 + 10;
  // a long chain takes a row of its own
  let x = 0, y = 0;
  const body = keys.map(k => {
    const m = MOL[k], wide = m.chain ? (m.chain - 1) * 11 * 0.87 : m.tri ? 76 : m.naphthalene ? 48 : 40;
    if (x && x + wide > W - 30) { x = 0; y++; }
    const at = molecule(k, 26 + x, 40 + y * 72);
    x += Math.max(wide + 40, W / per);
    return at;
  }).join("");
  return { vb: `0 0 ${W} ${H}`, body };
}
export const MOLECULES = Object.keys(MOL);
export { RANK };
