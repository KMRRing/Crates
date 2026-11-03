// Refinery's flowsheet: the plant as a block flow diagram, crude in at the left, products out at the right. Each unit
// stands in its column of the process (distillation, residue, cracking, treating, octane) at the height of what it
// handles (light at the top, heavy at the bottom, as on the crude column itself, whose cuts leave it at their own
// heights), and each stream is an arrow as wide as its flow. The play screen, the lessons and the tests all draw with
// it; it lays out from the level alone, so nothing moves as the routing changes, but for what the player moved by hand
// (arrange) and the lines they hid (hide: a class of line is not drawn at all).
import { STREAMS, UNITS, POOLS, CRUDES, PROPS } from "./refinery-data.js";
import { streamsOf, poolsOf, specsOf, limitOf, fmtProp, destinations, culprits } from "./refinery-engine.js";

const NS = "http://www.w3.org/2000/svg";
/** How light a stream is: 0 the gases, 13 the coke. Units and pools sit at the height of what they take. */
export const RANK = { gas: 0, lpg: 1, propylene: 1.3, cumene: 1.5, butane: 1.7, c4: 2, raff: 2.1, lsr: 3, lcn: 3.1, lcnT: 3.15, isomerate: 3.2, alkylate: 3.4, mtbe: 3.5, etbe: 3.6, bzCut: 3.8, hsr: 4, icn: 4.1, hsrT: 4.2, reformate: 4.4, heavyReformate: 4.45, hcNaphtha: 4.5,
  catNaphtha: 4.6, catNaphthaT: 4.7, cokerNaphtha: 4.8, ethanol: 4.9, hcn: 5.5, kero: 6, jet: 6.1, spk: 6.15, hcJet: 6.2, lgo: 7, ulsd: 7.2, hcDiesel: 7.3, hvo: 7.4, fame: 7.5, lco: 7.6, lcgo: 7.65, goT: 7.8, mhcGo: 7.9,
  hgo: 8, fuelOilCutter: 8.2, cokerGo: 8.4, lvgo: 9, vgoT: 9.3, importVgoT: 9.4, hvgo: 9.5, importVgo: 9.6, vegOil: 9.8, tallow: 9.82, rso: 9.84, sbo: 9.85, cto: 9.86, pyro: 9.88, hcgo: 9.9, slurry: 10, dao: 10.5, atmResid: 11, visResid: 11.5, vacResid: 12, asphalt: 12.3, bitumen: 12.5, power: 12.9, coke: 13 };
const POOL_RANK = { gasPool: 0, lpg: 1.2, propylene: 1.6, cumene: 2, gasoline: 3.6, naphtha: 4.6, jet: 6, diesel: 7, hvo100: 7.6, gasoil: 8.1, vgoExport: 9.2, fuelOil: 10, hsfo: 11, bitumen: 12.3, power: 12.6, coke: 13, slops: 13, notBought: 12 };
const UNIT_RANK = { vdu: 11.4, coker: 12.2, visbreaker: 11.6, blowing: 12.8, hvoUnit: 9.8, safUnit: 6.8, fcc: 9.4, hcu: 8.6, merox: 5.6, kht: 6.3, nht: 4.2, dht: 7.6, hds: 7.9, reformer: 4.3, srReformer: 4.3, bzhc: 4.4, isom: 3, alky: 2, cnht: 5, smr: 0.2, sru: 13,
  vgoHt: 9, vgoHt2: 9.8, mtbeUnit: 2.2, cumeneUnit: 1.3, hght: 7.9, dht2: 7.4, sda: 12.4, igcc: 12.8 };
export const GROUP_COLOUR = { gas: "var(--rf-gas)", naphtha: "var(--rf-naphtha)", middle: "var(--rf-middle)", heavy: "var(--rf-heavy)", resid: "var(--rf-resid)", renewable: "var(--rf-renew)", other: "var(--rf-gas)" };
// sizes, in the diagram's own units
const NODE_W = 44, NODE_H = 22, COL = 60, TOP = 18, ROW = 25, POOL_W = 78, POOL_H = 29, TWIN = 28;

/**
 * The layout of a level's plant: { nodes: { id: { id, kind (crude | bought | unit | pool), x, y, w, h, col, dx, dy } },
 * width, height }. A level can place a unit itself (layout: { unit: [column, rank] }), as the whole refineries' chapters do.
 * `arrange` is the player's own: { id: [dx, dy] } moves a unit or a product that far from where the process puts it
 * (movable), kept inside the sheet and its room to grow, with the sheet growing to hold what is moved out.
 */
export function layout(level, arrange = null) {
  const units = level.units.filter(u => UNITS[u]), pools = sheetPools(level);
  const stages = [...new Set(units.map(u => colOf(level, u)))].sort((a, b) => a - b);
  // a second crude unit stands to the left of the first, and the rest of the plant moves over to make room
  const twin = units.includes("cdu2") ? TWIN : 0;
  const colX = new Map(stages.map((s, i) => [s, 40 + twin + i * COL]));
  const poolX = 40 + twin + stages.length * COL + 6;
  const y = r => TOP + r * ROW;
  const nodes = {};
  nodes.crude = { id: "crude", kind: "crude", x: 0, y: y(9), w: 30, h: NODE_H, col: -1 };
  if (level.bought && Object.keys(level.bought).length) nodes.bought = { id: "bought", kind: "bought", x: 0, y: y(4.6), w: 30, h: NODE_H, col: -1 };
  // each column's units at the height of their work, pushed apart where they would touch
  for (const s of stages) {
    const list = units.filter(u => colOf(level, u) === s).map(u => ({ u, r: level.layout?.[u]?.[1] ?? UNIT_RANK[u] ?? 6 })).sort((a, b) => a.r - b.r);
    let last = -Infinity;
    for (const { u, r } of list) {
      if (u === "cdu" || u === "cdu2") { nodes[u] = { id: u, kind: "unit", x: u === "cdu2" ? colX.get(s) - TWIN : colX.get(s), y: y(0) - 6, w: u === "cdu2" ? TWIN - 6 : 26, h: y(11) - y(0) + 12, col: s, column: true }; continue; }
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
  let height = Math.max(y(13) + NODE_H, last + 6), width = poolX + POOL_W + 4;
  const room = { w: width * ROOM, h: height * ROOM };
  for (const [id, off] of Object.entries(arrange || {})) {
    const n = nodes[id];
    if (!movable(n) || !Array.isArray(off) || !off.every(Number.isFinite)) continue;
    const x = Math.min(Math.max(n.x + off[0], 0), room.w - n.w), y0 = Math.min(Math.max(n.y + off[1], 0), room.h - n.h);
    n.dx = x - n.x; n.dy = y0 - n.y; n.x = x; n.y = y0;
    width = Math.max(width, x + n.w + 4); height = Math.max(height, y0 + n.h + 6);
  }
  return { nodes, width, height };
}
/** Units and products can be moved; the crude, the bought-in box and the crude columns stay where the process starts. */
export const movable = n => !!n && ((n.kind === "unit" && !n.column) || n.kind === "pool");
/** How far past its own size the sheet lets a moved box go. */
const ROOM = 1.5;
/** What a saved arrangement was made for: a level's units and where it places them; another sheet has none of it. */
export const layoutSig = level => {
  let h = 2166136261;   // FNV-1a, a few characters to keep rather than the whole of it
  for (const c of `${level.units.join(",")}|${JSON.stringify(level.layout || {})}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
/** A level's saved arrangement ({ sig, at: { id: [dx, dy] } }) as the offsets to use now: none if its units are not the ones it was made for. */
export const arrangedFor = (level, saved) => (saved?.sig === layoutSig(level) && saved.at ? saved.at : {});
const colOf = (level, u) => level.layout?.[u]?.[0] ?? (u === "cdu" || u === "cdu2" ? 1 : UNITS[u].stage);
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

// ---------- the lines a player can hide ----------
// Hiding is not fading: a hidden line is not drawn at all, so a busy plant can be read (Korbi's brief: waste, off-gas
// and fuel gas first, then what else clutters the whole refineries). Nothing is left dangling: a product whose every line
// is hidden goes with them (a refinery fuel box with nothing running into it), so does the bought-in box, and a cut's
// label at the crude column; a unit whose every line is hidden stays (it is running) and says how many are.
const LPG_STREAMS = ["lpg", "butane"], WASTE_POOLS = ["slops", "notBought"];
/** A line is a small flow under this share of the crude run: half a per cent. */
const SMALL = 0.005;
export const smallBelow = level => SMALL * (level.feed ?? 100);
/**
 * The classes of line: { id, name(level), has(level) (whether the level has any), of(level, link) (whether a link is in it) }.
 * A line can be in several; it is hidden when any class ticked has it.
 */
export const HIDES = [
  { id: "waste", name: () => "Waste & not bought", has: lv => sheetPools(lv).some(p => WASTE_POOLS.includes(p)), of: (lv, l) => WASTE_POOLS.includes(l.to) },
  { id: "gas", name: () => "Fuel gas", has: lv => streamsOf(lv).includes("gas"), of: (lv, l) => l.stream === "gas" },
  { id: "lpg", name: () => "LPG & butane", has: lv => streamsOf(lv).some(s => LPG_STREAMS.includes(s)), of: (lv, l) => l.to === "lpg" || LPG_STREAMS.includes(l.stream) },
  { id: "bought", name: () => "Bought in", has: lv => Object.keys(lv.bought || {}).length > 0, of: (lv, l) => l.from === "bought" },
  { id: "small", name: lv => `Under ${+smallBelow(lv).toFixed(2)} kb/d`, has: () => true, of: (lv, l) => !STREAMS[l.stream].per && l.vol < smallBelow(lv) },
];
/** A stream with less than this share of a limit's push isn't named as putting a product off spec. */
export const PUSH = 0.1;
/**
 * What the hide filter leaves of a run's lines: { shown, hidden (links), counts ({ class: how many of the lines it has,
 * ticked or not }), gone (ids of nodes not drawn), bare ({ id: lines hidden } of nodes drawn with nothing running to
 * them), cuts (streams whose cut label at the crude column goes), pairs ("stream>destination" no line of which is shown) }.
 * `hide` is a Set of class ids. `keep` ({ stream, node }) is what the player has open: never hidden. An off-spec product
 * stays, so that what is wrong stays in sight.
 */
export function filtered(level, result, hide, keep = {}, links = linksOf(level, result)) {
  const classes = HIDES.filter(c => hide?.has(c.id)), shown = [], hidden = [], counts = {}, touch = {};
  for (const c of HIDES) counts[c.id] = 0;
  const hit = l => keep.stream !== l.stream && classes.some(c => c.of(level, l));
  for (const l of links) {
    for (const c of HIDES) if (c.of(level, l)) counts[c.id]++;
    const out = hit(l);
    (out ? hidden : shown).push(l);
    for (const n of [l.from, l.to]) { const t = touch[n] || (touch[n] = { all: 0, shown: 0 }); t.all++; if (!out) t.shown++; }
  }
  const gone = new Set(), bare = {};
  for (const [id, t] of Object.entries(touch)) {
    if (t.shown || id === "cdu" || id === "cdu2" || id === "crude") continue;
    const off = result.pools[id] && result.pools[id].vol > 1e-4 && !result.pools[id].inSpec;
    if (keep.node !== id && !off && (id === "bought" || POOLS[id])) gone.add(id); else bare[id] = t.all;
  }
  // a cut's label at the column goes when every line it has is hidden; and a pair is hidden when none of its lines show
  const pairs = new Set(), seen = new Set(), cutLines = {};
  for (const l of shown) seen.add(`${l.stream}>${l.to}`);
  for (const l of hidden) if (!seen.has(`${l.stream}>${l.to}`)) pairs.add(`${l.stream}>${l.to}`);
  for (const l of links) if (l.from === "cdu" || l.from === "cdu2") { const c = cutLines[l.stream] || (cutLines[l.stream] = { all: 0, shown: 0 }); c.all++; if (!hit(l)) c.shown++; }
  const cuts = new Set(Object.entries(cutLines).filter(([, c]) => c.all && !c.shown).map(([s]) => s));
  return { shown, hidden, counts, gone, bare, cuts, pairs };
}
/** The streams a hidden line keeps out of sight that put a product off spec: [{ pool, s, k }], the product's misses furthest first. */
export function hiddenCulprits(level, result, hide, links = linksOf(level, result)) {
  if (!hide?.size) return [];
  const f = filtered(level, result, hide, {}, links), out = [];
  for (const [p, pool] of Object.entries(result.pools)) {
    if (pool.inSpec || pool.vol <= 1e-4) continue;
    for (const miss of culprits(level, result, p)) for (const c of miss.by) if (c.share >= PUSH && f.pairs.has(`${c.s}>${p}`) && !out.some(x => x.pool === p && x.s === c.s)) out.push({ pool: p, s: c.s, k: miss.k });
  }
  return out;
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
 * rest faint), fade (a stream → whether its links recede: faint, under the rest and not to be tapped, unless it's the
 * one selected), culprits (a Set of "stream>pool": the streams putting a pool off spec, drawn red and never faded),
 * labels ({ node id: text }), flow (animate the flow), mini (a lesson's small picture: no figures), hide (a Set of
 * HIDES' ids: those lines are not drawn), arrange (the player's offsets, see layout), lift (the id of a box being
 * dragged) }.
 * Returns the layout with what the hide filter left of the lines (`filter`, see filtered), so taps can be told apart (hitTest).
 */
export function drawSheet(svg, level, result, opts = {}) {
  const sel = opts.select || {}, only = opts.only ? new Set(opts.only) : null;
  const lay = layout(level, opts.arrange), N = lay.nodes, filter = filtered(level, result, opts.hide, { stream: sel.stream, node: sel.node }), links = filter.shown;
  const culprit = l => !!opts.culprits?.has(`${l.stream}>${l.to}`), recede = l => sel.stream !== l.stream && !culprit(l) && !!opts.fade?.(l.stream);
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
  // links under the nodes, those receding under the rest, then the widest first so the lightest are on top
  const linkSvg = [];
  for (const l of links.sort((a, b) => recede(b) - recede(a) || b.vol - a.vol)) {
    const a = N[l.from], b = N[l.to];
    if (!a || !b) continue;
    const x1 = a.x + a.w, x2 = b.x, y1 = l.y1 ?? a.y + a.h / 2, y2 = l.y2 ?? b.y + b.h / 2;
    const dx = Math.max(18, (x2 - x1) * 0.5), w = Math.min(width(l.vol), l.w2 ?? 99, a.column ? 99 : (l.w1 ?? 99));
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)} ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)} ${(x2 - 1.5).toFixed(1)} ${y2.toFixed(1)}`;
    const picked = sel.stream === l.stream, dim = (sel.stream && !picked) || (only && !(only.has(l.from) && only.has(l.to)) && !only.has(l.stream)), back = recede(l);
    const col = GROUP_COLOUR[STREAMS[l.stream].group] || GROUP_COLOUR.other;
    linkSvg.push(`<g class="rf-link${picked ? " sel" : ""}${dim ? " dim" : ""}${back ? " back" : ""}${culprit(l) ? " culprit" : ""}" data-stream="${l.stream}">` +
      (back ? "" : `<path class="rf-link-hit" d="${d}" stroke-width="${Math.max(10, w + 6)}"/>`) +
      `<path class="rf-link-line" d="${d}" stroke="${col}" stroke-width="${w.toFixed(2)}"/>` +
      (opts.flow !== false && !dim && !back ? `<path class="rf-link-flow" d="${d}" stroke-width="${Math.max(0.8, w * 0.35).toFixed(2)}"/>` : "") +
      `<path class="rf-link-head" d="M${(x2 - 4.5).toFixed(1)} ${(y2 - Math.max(2.2, w * 0.45)).toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${(x2 - 4.5).toFixed(1)} ${(y2 + Math.max(2.2, w * 0.45)).toFixed(1)}Z" fill="${col}"/></g>`);
  }
  parts.push(`<g class="rf-links">${linkSvg.join("")}</g>`);
  // the crude column's cut labels, beside their outlets
  const cdu = N.cdu;
  if (cdu) {
    const cuts = Object.keys(CRUDES[level.crude].cuts).filter(s => !filter.cuts.has(s));
    parts.push(`<g class="rf-cuts${only && !only.has("cdu") ? " dim" : ""}">${cuts.map(s => `<text x="${cdu.x + cdu.w + 2}" y="${(TOP + (RANK[s] ?? 6) * ROW - 2.5).toFixed(1)}" class="rf-cut-label">${esc(STREAMS[s].short)}</text>`).join("")}</g>`);
  }
  // the nodes
  for (const n of Object.values(N)) {
    if (filter.gone.has(n.id)) continue;
    const dim = only ? !only.has(n.id) : false, picked = sel.node === n.id;
    // a box being dragged is lifted: a halo of the brass round it
    if (opts.lift === n.id) parts.push(`<rect class="rf-halo" x="${n.x - 2.5}" y="${n.y - 2.5}" width="${n.w + 5}" height="${n.h + 5}" rx="5"/>`);
    if (n.kind === "crude") {
      const c = CRUDES[level.crude];
      parts.push(`<g class="rf-node rf-src${dim ? " dim" : ""}" data-node="crude"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/><text x="${n.x + n.w / 2}" y="${n.y + 9}" class="rf-n1">CRUDE</text><text x="${n.x + n.w / 2}" y="${n.y + 17.5}" class="rf-n2">${esc(c.name.split(" ")[0])}</text></g>`);
      const first = N.cdu2 || cdu;
      if (first) parts.push(`<path class="rf-feed" d="M${n.x + n.w} ${n.y + n.h / 2}L${first.x - 1} ${n.y + n.h / 2}" stroke-width="${width(level.feed ?? 100) * 0.7}"/>`);
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
        // a crude column: its trays, its name and what it runs; a second one's cuts leave through the first's outlets
        parts.push(`<g class="rf-node rf-unit rf-column${picked ? " sel" : ""}${dim ? " dim" : ""}" data-node="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8"/>` +
          Array.from({ length: 11 }, (_, i) => `<line x1="${n.x + 3}" x2="${n.x + n.w - 3}" y1="${n.y + 10 + i * (n.h - 20) / 10}" y2="${n.y + 10 + i * (n.h - 20) / 10}" class="rf-tray"/>`).join("") +
          `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2}" class="rf-n1 rf-vert" transform="rotate(-90 ${n.x + n.w / 2} ${n.y + n.h / 2})">${esc(u.short)}${opts.mini ? "" : ` · ${Math.round(run?.feed ?? level.feed ?? 100)} kb/d`}</text></g>`);
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
    const line2 = opts.labels?.[n.id] ?? (opts.mini ? "" : pool ? `${amount(n.id, pool.vol, { fine: true })} · $${+pool.price.toFixed(1)}` : "–");
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
  // a box drawn with every line to it hidden says how many: a stub and the count, so it never looks unconnected
  for (const [id, count] of Object.entries(filter.bare)) {
    const n = N[id];
    if (!n || filter.gone.has(id)) continue;
    const left = n.kind === "pool", x = left ? n.x : n.x + n.w, y = n.y + n.h / 2;
    parts.push(`<g class="rf-bare"><title>${count} line${count > 1 ? "s" : ""} hidden</title><path d="M${x} ${y}h${left ? -6 : 6}"/><text x="${left ? x - 7 : x + 7}" y="${y + 1.7}" text-anchor="${left ? "end" : "start"}" class="rf-bare-n">+${count}</text></g>`);
  }
  svg.setAttribute("viewBox", `-4 -4 ${lay.width + 8} ${lay.height + 8}`);
  svg.innerHTML = parts.join("");
  return { ...lay, filter };
}

/**
 * A volume as it reads: kb/d of oil, or for power (counted in thousand MWh a day) the megawatts it averages. Takes a
 * stream or a pool.
 */
export function amount(id, v, { fine = false } = {}) {
  if ((STREAMS[id] || POOLS[id])?.per === "MWh") return `${Math.round((v * 1000) / 24)} MW`;
  return `${v < 0.1 ? v.toFixed(2) : fine || v < 10 ? v.toFixed(1) : Math.round(v)} kb/d`;
}
/** A property in a pool's few characters: "RON 95.1", "S 9 ppm", "CN 51.2", "380 cSt". */
function shortProp(k, v) {
  if (v == null) return "–";
  const name = { ron: "RON", mon: "MON", cet: "CN", s: "S", d: "ρ", rvp: "RVP", arom: "Ar", olef: "Ol", benz: "Bz", oxy: "O₂", etoh: "EtOH", ether: "Eth", fame: "FAME", visc: "", bio: "Bio", flash: "FP", cfpp: "CFPP", e360: "360+" }[k] ?? k;
  return `${name}${name ? " " : ""}${fmtProp(k, v).replace(" kg/m³", "").replace(" kPa", "")}`;
}
/** What a tap on the diagram hit: { stream } on a link, { node } on a node, or null. */
export function hitTest(target) {
  const g = target?.closest?.("[data-stream], [data-node]");
  if (!g) return null;
  return g.dataset.stream ? { stream: g.dataset.stream } : { node: g.dataset.node };
}
