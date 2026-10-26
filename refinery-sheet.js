// Refinery's flowsheet: the plant as a block flow diagram, crude in at the left, products out at the right. Each unit
// stands in its column of the process (distillation, residue, cracking, treating, octane) at the height of what it
// handles (light at the top, heavy at the bottom, as on the crude column itself, whose cuts leave it at their own
// heights), and each stream is an arrow as wide as its flow. The play screen, the lessons and the tests all draw with
// it; it lays out from the level alone, so nothing moves as the routing changes.
import { STREAMS, UNITS, POOLS, CRUDES, PROPS } from "./refinery-data.js";
import { streamsOf, poolsOf, specsOf, limitOf, fmtProp, destinations } from "./refinery-engine.js";

const NS = "http://www.w3.org/2000/svg";
/** How light a stream is: 0 the gases, 13 the coke. Units and pools sit at the height of what they take. */
export const RANK = { gas: 0, lpg: 1, propylene: 1.3, butane: 1.7, c4: 2, lsr: 3, lcn: 3.1, lcnT: 3.15, isomerate: 3.2, alkylate: 3.4, etbe: 3.6, bzCut: 3.8, hsr: 4, icn: 4.1, hsrT: 4.2, reformate: 4.4, heavyReformate: 4.45, hcNaphtha: 4.5,
  catNaphtha: 4.6, catNaphthaT: 4.7, cokerNaphtha: 4.8, ethanol: 4.9, hcn: 5.5, kero: 6, jet: 6.1, spk: 6.15, hcJet: 6.2, lgo: 7, ulsd: 7.2, hcDiesel: 7.3, hvo: 7.4, fame: 7.5, lco: 7.6, lcgo: 7.65, goT: 7.8,
  hgo: 8, fuelOilCutter: 8.2, cokerGo: 8.4, lvgo: 9, hvgo: 9.5, importVgo: 9.6, vegOil: 9.8, hcgo: 9.9, slurry: 10, atmResid: 11, visResid: 11.5, vacResid: 12, bitumen: 12.5, coke: 13 };
const POOL_RANK = { gasPool: 0, lpg: 1.2, propylene: 1.6, gasoline: 3.6, naphtha: 4.6, jet: 6, diesel: 7, hvo100: 7.6, gasoil: 8.1, fuelOil: 10, hsfo: 11, bitumen: 12.3, coke: 13, slops: 13, notBought: 12 };
const UNIT_RANK = { vdu: 11.4, coker: 12.2, visbreaker: 11.6, blowing: 12.8, hvoUnit: 9.8, safUnit: 6.8, fcc: 9.4, hcu: 8.6, merox: 5.6, kht: 6.3, nht: 4.2, dht: 7.6, hds: 7.9, reformer: 4.3, srReformer: 4.3, bzhc: 4.4, isom: 3, alky: 2, cnht: 5, smr: 0.2, sru: 13 };
export const GROUP_COLOUR = { gas: "var(--rf-gas)", naphtha: "var(--rf-naphtha)", middle: "var(--rf-middle)", heavy: "var(--rf-heavy)", resid: "var(--rf-resid)", renewable: "var(--rf-renew)", other: "var(--rf-gas)" };
// sizes, in the diagram's own units
const NODE_W = 44, NODE_H = 22, COL = 60, TOP = 18, ROW = 25, POOL_W = 78, POOL_H = 29;

/**
 * The layout of a level's plant: { nodes: { id: { id, kind (crude | bought | unit | pool), x, y, w, h, col } },
 * width, height }. A level can place a unit itself (layout: { unit: [column, rank] }), as the whole refineries' chapters do.
 */
export function layout(level) {
  const units = level.units.filter(u => UNITS[u]), pools = sheetPools(level);
  const stages = [...new Set(units.map(u => colOf(level, u)))].sort((a, b) => a - b);
  const colX = new Map(stages.map((s, i) => [s, 40 + i * COL]));
  const poolX = 40 + stages.length * COL + 6;
  const y = r => TOP + r * ROW;
  const nodes = {};
  nodes.crude = { id: "crude", kind: "crude", x: 0, y: y(9), w: 30, h: NODE_H, col: -1 };
  if (level.bought && Object.keys(level.bought).length) nodes.bought = { id: "bought", kind: "bought", x: 0, y: y(4.6), w: 30, h: NODE_H, col: -1 };
  // each column's units at the height of their work, pushed apart where they would touch
  for (const s of stages) {
    const list = units.filter(u => colOf(level, u) === s).map(u => ({ u, r: level.layout?.[u]?.[1] ?? UNIT_RANK[u] ?? 6 })).sort((a, b) => a.r - b.r);
    let last = -Infinity;
    for (const { u, r } of list) {
      if (u === "cdu") { nodes.cdu = { id: "cdu", kind: "unit", x: colX.get(s), y: y(0) - 6, w: 26, h: y(11) - y(0) + 12, col: s, column: true }; continue; }
      const top = Math.max(y(r) - NODE_H / 2, last + 6);
      nodes[u] = { id: u, kind: "unit", x: colX.get(s), y: top, w: NODE_W, h: NODE_H, col: s };
      last = top + NODE_H;
    }
  }
  let last = -Infinity;
  for (const p of pools.map(p => ({ p, r: POOL_RANK[p] ?? 7 })).sort((a, b) => a.r - b.r)) {
    const top = Math.max(y(p.r) - POOL_H / 2, last + 3);
    nodes[p.p] = { id: p.p, kind: "pool", x: poolX, y: top, w: POOL_W, h: POOL_H, col: 99 };
    last = top + POOL_H;
  }
  const height = Math.max(y(13) + NODE_H, last + 6), width = poolX + POOL_W + 4;
  return { nodes, width, height };
}
const colOf = (level, u) => level.layout?.[u]?.[0] ?? (u === "cdu" ? 1 : UNITS[u].stage);
/** The pools drawn: the level's, less those nothing in it can reach. */
export function sheetPools(level) {
  const reach = new Set(streamsOf(level).flatMap(s => destinations(level, s)));
  return poolsOf(level).filter(p => reach.has(p));
}

/**
 * The links: every stream's flow from where it's made to where it goes, as the run made it ({ id, stream, from, to,
 * vol }). A stream made by several units is drawn from each, in proportion.
 */
export function linksOf(level, result) {
  const links = [];
  for (const [s, st] of Object.entries(result.streams)) {
    if (st.vol < 1e-6) continue;
    const makers = [];
    const cut = CRUDES[level.crude].cuts[s];
    if (cut) makers.push(["cdu", cut * (level.feed ?? 100)]);
    if (level.bought?.[s]) makers.push(["bought", level.bought[s]]);
    for (const [u, unit] of Object.entries(result.units)) if (u !== "cdu" && unit.outputs[s]) makers.push([u, unit.outputs[s]]);
    const made = makers.reduce((a, [, v]) => a + v, 0) || 1;
    for (const [d, v] of Object.entries(st.to || {})) for (const [m, mv] of makers) {
      const vol = (v * mv) / made;
      if (vol > 1e-4) links.push({ id: `${s}:${m}>${d}`, stream: s, from: m, to: d, vol });
    }
  }
  return links;
}

const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const width = vol => Math.max(1.1, Math.min(14, 0.9 + vol * 0.32));
/** The key specs to show on a pool: the level's, value and whether it passes. */
export function poolSpecs(level, p, pool) {
  return specsOf(level, p).map(k => {
    const [lo, hi] = limitOf(level, p, k), v = pool?.props?.[k];
    const ok = pool ? !pool.fails.some(f => f.k === k) : null;
    return { k, v, lo, hi, ok, text: PROPS[k].flag ? (k === "grade" ? "jet grade" : "bitumen crude") : `${PROPS[k].name} ${v == null ? "–" : fmtProp(k, v)}` };
  });
}

/**
 * Draws the plant into an svg: the layout, the links as the result runs them, the units with what they're running at,
 * the pools with their volumes and key specs. opts: { select: { stream } | { node }, only (node ids to draw full; the
 * rest faint), labels ({ node id: text }), flow (animate the flow), mini (a lesson's small picture: no figures) }.
 * Returns the layout, so taps can be told apart (hitTest).
 */
export function drawSheet(svg, level, result, opts = {}) {
  const lay = layout(level), N = lay.nodes, links = linksOf(level, result);
  const sel = opts.select || {}, only = opts.only ? new Set(opts.only) : null;
  const faint = id => (only && !only.has(id)) || (sel.stream && false);
  const parts = [];
  // ports: where each link leaves its source (stacked by the stream's lightness) and enters its destination
  const outs = {}, ins = {};
  for (const l of links) { (outs[l.from] || (outs[l.from] = [])).push(l); (ins[l.to] || (ins[l.to] = [])).push(l); }
  const port = (node, list, side) => {
    if (!node) return;
    list.sort((a, b) => (RANK[a.stream] ?? 6) - (RANK[b.stream] ?? 6) || (N[side === "out" ? a.to : a.from]?.y ?? 0) - (N[side === "out" ? b.to : b.from]?.y ?? 0));
    if (node.column && side === "out") {
      // the crude column: each cut leaves at its own height
      for (const l of list) l.y1 = TOP + (RANK[l.stream] ?? 6) * ROW + (list.filter(m => m.stream === l.stream).indexOf(l) - 0) * 0;
      return;
    }
    const total = list.reduce((a, l) => a + width(l.vol), 0), span = Math.min(node.h - 4, total), gap = list.length > 1 ? Math.max(0, (node.h - 4 - span) / (list.length - 1)) * 0.25 : 0;
    let at = node.y + node.h / 2 - (span + gap * (list.length - 1)) / 2;
    const scale = total > node.h - 4 ? (node.h - 4) / total : 1;
    for (const l of list) { const w = width(l.vol) * scale; l[side === "out" ? "y1" : "y2"] = at + w / 2; l[side === "out" ? "w1" : "w2"] = w; at += w + gap; }
  };
  for (const [id, list] of Object.entries(outs)) port(N[id], list, "out");
  for (const [id, list] of Object.entries(ins)) port(N[id], list, "in");
  // links under the nodes, lightest on top
  const linkSvg = [];
  for (const l of links.sort((a, b) => b.vol - a.vol)) {
    const a = N[l.from], b = N[l.to];
    if (!a || !b) continue;
    const x1 = a.x + a.w, x2 = b.x, y1 = l.y1 ?? a.y + a.h / 2, y2 = l.y2 ?? b.y + b.h / 2;
    const dx = Math.max(18, (x2 - x1) * 0.5), w = Math.min(width(l.vol), l.w2 ?? 99, a.column ? 99 : (l.w1 ?? 99));
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)} ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)} ${(x2 - 1.5).toFixed(1)} ${y2.toFixed(1)}`;
    const picked = sel.stream === l.stream, dim = (sel.stream && !picked) || (only && !(only.has(l.from) && only.has(l.to)) && !only.has(l.stream));
    const col = GROUP_COLOUR[STREAMS[l.stream].group] || GROUP_COLOUR.other;
    linkSvg.push(`<g class="rf-link${picked ? " sel" : ""}${dim ? " dim" : ""}" data-stream="${l.stream}">` +
      `<path class="rf-link-hit" d="${d}" stroke-width="${Math.max(10, w + 6)}"/>` +
      `<path class="rf-link-line" d="${d}" stroke="${col}" stroke-width="${w.toFixed(2)}"/>` +
      (opts.flow !== false && !dim ? `<path class="rf-link-flow" d="${d}" stroke-width="${Math.max(0.8, w * 0.35).toFixed(2)}"/>` : "") +
      `<path class="rf-link-head" d="M${(x2 - 4.5).toFixed(1)} ${(y2 - Math.max(2.2, w * 0.45)).toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${(x2 - 4.5).toFixed(1)} ${(y2 + Math.max(2.2, w * 0.45)).toFixed(1)}Z" fill="${col}"/></g>`);
  }
  parts.push(`<g class="rf-links">${linkSvg.join("")}</g>`);
  // the crude column's cut labels, beside their outlets
  const cdu = N.cdu;
  if (cdu) {
    const cuts = Object.keys(CRUDES[level.crude].cuts);
    parts.push(`<g class="rf-cuts${only && !only.has("cdu") ? " dim" : ""}">${cuts.map(s => `<text x="${cdu.x + cdu.w + 2}" y="${(TOP + (RANK[s] ?? 6) * ROW - 2.5).toFixed(1)}" class="rf-cut-label">${esc(STREAMS[s].short)}</text>`).join("")}</g>`);
  }
  // the nodes
  for (const n of Object.values(N)) {
    const dim = only ? !only.has(n.id) : false, picked = sel.node === n.id;
    if (n.kind === "crude") {
      const c = CRUDES[level.crude];
      parts.push(`<g class="rf-node rf-src${dim ? " dim" : ""}" data-node="crude"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/><text x="${n.x + n.w / 2}" y="${n.y + 9}" class="rf-n1">CRUDE</text><text x="${n.x + n.w / 2}" y="${n.y + 17.5}" class="rf-n2">${esc(c.name.split(" ")[0])}</text></g>`);
      if (cdu) parts.push(`<path class="rf-feed" d="M${n.x + n.w} ${n.y + n.h / 2}L${cdu.x - 1} ${n.y + n.h / 2}" stroke-width="${width(level.feed ?? 100) * 0.7}"/>`);
      continue;
    }
    if (n.kind === "bought") {
      parts.push(`<g class="rf-node rf-src${dim ? " dim" : ""}" data-node="bought"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/><text x="${n.x + n.w / 2}" y="${n.y + 9}" class="rf-n1">BOUGHT</text><text x="${n.x + n.w / 2}" y="${n.y + 17.5}" class="rf-n2">in</text></g>`);
      continue;
    }
    if (n.kind === "unit") {
      const u = UNITS[n.id], run = result.units[n.id], cap = level.caps?.[n.id];
      const idle = !run && !["smr", "sru", "cdu"].includes(n.id) || (n.id === "smr" && !(result.h2.plant > 0.01)) || (n.id === "sru" && !(result.sulphur.removed > 0.01));
      if (n.column) {
        parts.push(`<g class="rf-node rf-unit rf-column${picked ? " sel" : ""}${dim ? " dim" : ""}" data-node="cdu"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8"/>` +
          Array.from({ length: 11 }, (_, i) => `<line x1="${n.x + 3}" x2="${n.x + n.w - 3}" y1="${n.y + 10 + i * (n.h - 20) / 10}" y2="${n.y + 10 + i * (n.h - 20) / 10}" class="rf-tray"/>`).join("") +
          `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2}" class="rf-n1 rf-vert" transform="rotate(-90 ${n.x + n.w / 2} ${n.y + n.h / 2})">CDU${opts.mini ? "" : ` · ${Math.round(run?.feed ?? level.feed ?? 100)} kb/d`}</text></g>`);
        continue;
      }
      const util = cap && run ? Math.min(1, run.feed / cap) : null;
      const sub = opts.labels?.[n.id] ?? (opts.mini ? "" : n.id === "smr" ? (result.h2.plant > 0.01 ? `${result.h2.plant.toFixed(0)} MMscf/d` : "idle") : n.id === "sru" ? `${Math.round(result.sulphur.removed)} t/d S` : run ? `${run.feed.toFixed(1)}${cap ? `/${cap}` : ""}` : "idle");
      parts.push(`<g class="rf-node rf-unit${idle ? " idle" : ""}${picked ? " sel" : ""}${dim ? " dim" : ""}${util != null && util > 0.999 ? " full" : ""}" data-node="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/>` +
        (util != null ? `<rect class="rf-util" x="${n.x + 2}" y="${n.y + n.h - 3.4}" width="${((n.w - 4) * util).toFixed(1)}" height="1.6"/>` : "") +
        `<text x="${n.x + n.w / 2}" y="${n.y + (sub ? 9.5 : 14)}" class="rf-n1">${esc(u.short)}</text>${sub ? `<text x="${n.x + n.w / 2}" y="${n.y + 17.5}" class="rf-n2">${esc(sub)}</text>` : ""}</g>`);
      continue;
    }
    // a pool: its name, its volume and price, and its key specs passing or failing
    // a lesson's small picture shows where things go, not whether they pass: no verdicts on it
    // a pool with a rounding's worth in it is empty, not off spec
    const pool = result.pools[n.id]?.vol > 1e-4 ? result.pools[n.id] : null, def = POOLS[n.id], specs = poolSpecs(level, n.id, pool), off = pool && !pool.inSpec && !opts.mini;
    const line2 = opts.labels?.[n.id] ?? (opts.mini ? "" : pool ? `${pool.vol.toFixed(1)} kb/d · $${+pool.price.toFixed(1)}` : "–");
    // the key specs, value by value, each ticked or crossed: as many as the box holds, the failing first, then those
    // nearest their limits, and a count of the rest (a pool held to all ten of petrol's would run far past its box)
    let line3 = "";
    if (!opts.mini && pool && specs.length) {
      const slack = s => { if (PROPS[s.k].flag || s.v == null) return Infinity; const span = Math.max(Math.abs(s.hi ?? s.lo), 1); return Math.min(s.lo != null ? (s.v - s.lo) / span : Infinity, s.hi != null ? (s.hi - s.v) / span : Infinity); };
      const words = [...specs].sort((a, b) => a.ok - b.ok || slack(a) - slack(b)).map(s => [s.ok, PROPS[s.k].flag ? (s.k === "grade" ? "grade" : "asph.") : shortProp(s.k, s.v)]);
      const fit = [];
      for (const w of words) { if (fit.length && fit.reduce((n, [, t]) => n + t.length + 2, 0) + w[1].length + 2 > 24) break; fit.push(w); }
      line3 = fit.map(([ok, t]) => `<tspan class="${ok ? "ok" : "no"}">${ok ? "✓" : "✗"}</tspan>${esc(t)}`).join(" ") + (words.length > fit.length ? ` +${words.length - fit.length}` : "");
    }
    parts.push(`<g class="rf-node rf-pool${off ? " off" : ""}${!pool ? " empty" : ""}${picked ? " sel" : ""}${dim ? " dim" : ""}" data-node="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/>` +
      `<text x="${n.x + 4}" y="${n.y + 9.5}" class="rf-p1">${esc(def.short)}${off ? ` → ${esc(POOLS[pool.soldAs].short)}` : ""}</text>${line2 ? `<text x="${n.x + 4}" y="${n.y + 17.5}" class="rf-p2">${esc(line2)}</text>` : ""}${line3 ? `<text x="${n.x + 4}" y="${n.y + 25}" class="rf-p3">${line3}</text>` : ""}</g>`);
  }
  svg.setAttribute("viewBox", `-4 -4 ${lay.width + 8} ${lay.height + 8}`);
  svg.innerHTML = parts.join("");
  return lay;
}

/** A property in a pool's few characters: "RON 95.1", "S 9 ppm", "CN 51.2", "380 cSt". */
function shortProp(k, v) {
  if (v == null) return "–";
  const name = { ron: "RON", mon: "MON", cet: "CN", s: "S", d: "ρ", rvp: "RVP", arom: "Ar", olef: "Ol", benz: "Bz", oxy: "O₂", etoh: "EtOH", ether: "Eth", fame: "FAME", visc: "", bio: "Bio", flash: "FP" }[k] ?? k;
  return `${name}${name ? " " : ""}${fmtProp(k, v).replace(" kg/m³", "").replace(" kPa", "")}`;
}
/** What a tap on the diagram hit: { stream } on a link, { node } on a node, or null. */
export function hitTest(target) {
  const g = target?.closest?.("[data-stream], [data-node]");
  if (!g) return null;
  return g.dataset.stream ? { stream: g.dataset.stream } : { node: g.dataset.node };
}
