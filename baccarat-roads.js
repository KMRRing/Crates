// Baccarat's scoreboard drawn, as the screen over a Macau table shows it (the roads worked out by baccarat-engine.js):
// the big road across the top, the bead plate below it on the left, and beside the plate the three derived roads at half
// size, the big eye boy over the small road and the cockroach road. Banker red, Player blue, a tie green, in the suite's
// enamels: oxblood, cobalt and verdigris. Each road shows its latest columns, as the screen scrolls on through a shoe.
// The page (baccarat.js) and the course's stage (baccarat-course.js) both draw with it; the drawing is SVG markup.
import { beadPlate, bigColumns, layout, derived, runs, ask, ROADS } from "./baccarat-engine.js";

const ROWS = 6, COL = { B: "var(--bc-b)", P: "var(--bc-p)", T: "var(--bc-t)", red: "var(--bc-b)", blue: "var(--bc-p)" };
const ZH = { B: "莊", P: "閒", T: "和" };
const f = n => +n.toFixed(2);

/** The grid of a road w cells across and h down, each cell s units, at (x, y). */
function grid(x, y, w, h, s) {
  let d = "";
  for (let i = 0; i <= w; i++) d += `M${f(x + i * s)} ${f(y)}V${f(y + h * s)}`;
  for (let j = 0; j <= h; j++) d += `M${f(x)} ${f(y + j * s)}H${f(x + w * s)}`;
  return `<path class="bc-grid" d="${d}"/>`;
}
/** Of a road's marks laid out on columns, those that fit w columns: the latest, shifted to start at the left. */
function latest(marks, w) {
  const last = marks.reduce((m, p) => Math.max(m, p.x), -1), from = Math.max(0, last - w + 1);
  return marks.filter(p => p.x >= from).map(p => ({ ...p, x: p.x - from }));
}
const pairDots = (cx, cy, r, pp, bp) => `${bp ? `<circle cx="${f(cx - r * .72)}" cy="${f(cy - r * .72)}" r="${f(r * .3)}" fill="${COL.B}" class="bc-dot"/>` : ""}${pp ? `<circle cx="${f(cx + r * .72)}" cy="${f(cy + r * .72)}" r="${f(r * .3)}" fill="${COL.P}" class="bc-dot"/>` : ""}`;

/** The big road at (x, y), w cells across, cells s units: rings, a tie's green slash (and how many), pairs as dots. */
export function bigRoad(results, { x = 0, y = 0, w = 24, s = 10, flash = null } = {}) {
  const { cols, leading } = bigColumns(results);
  // the hand asked about: on down the last column if it's the same side's, else a column of its own
  if (flash) {
    const next = { w: flash, ties: 0, flash: true }, last = cols[cols.length - 1];
    if (last && last[0].w === flash) last.push(next); else cols.push([next]);
  }
  const marks = latest(layout(cols), w), r = s * .36;
  let out = grid(x, y, w, ROWS, s);
  if (!cols.length && leading) out += tieMark(x + s / 2, y + s / 2, r, leading);
  for (const { x: gx, y: gy, mark: m } of marks) {
    const cx = x + (gx + .5) * s, cy = y + (gy + .5) * s;
    out += `<g${m.flash ? ' class="bc-flash"' : ""}><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${COL[m.w]}" stroke-width="${f(s * .13)}"/>${m.ties ? tieMark(cx, cy, r, m.ties) : ""}${pairDots(cx, cy, r, m.pp, m.bp)}</g>`;
  }
  return out;
}
const tieMark = (cx, cy, r, n) => `<path d="M${f(cx - r)} ${f(cy + r)}L${f(cx + r)} ${f(cy - r)}" stroke="${COL.T}" stroke-width="${f(r * .34)}" stroke-linecap="round"/>${n > 1 ? `<text class="bc-tie-n" x="${f(cx)}" y="${f(cy)}" font-size="${f(r * 1.25)}">${n}</text>` : ""}`;

/** The bead plate at (x, y), w columns of six: every hand in order, a disc in its colour with its character. */
export function beadRoad(results, { x = 0, y = 0, w = 6, s = 10 } = {}) {
  const beads = latest(beadPlate(results), w), r = s * .42;
  let out = grid(x, y, w, ROWS, s);
  for (const { x: gx, y: gy, r: res } of beads) {
    const cx = x + (gx + .5) * s, cy = y + (gy + .5) * s;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${COL[res.w]}"/><text class="bc-bead-zh" x="${f(cx)}" y="${f(cy)}" font-size="${f(s * .52)}">${ZH[res.w]}</text>${pairDots(cx, cy, r, res.pp, res.bp)}`;
  }
  return out;
}

/**
 * A derived road (k: 1 the big eye boy, 2 the small road, 3 the cockroach road) at (x, y), w half-cells across, each h
 * units: the big eye boy's rings, the small road's discs, the cockroach road's slashes.
 */
export function derivedRoad(results, k, { x = 0, y = 0, w = 36, h = 5, flash = null } = {}) {
  const cols = bigColumns(flash ? [...results, { w: flash, pp: false, bp: false }] : results).cols, marks = derived(cols, k), before = flash ? derived(bigColumns(results).cols, k).length : marks.length;
  const rs = runs(marks), placed = latest(layout(rs).map(p => ({ ...p, i: indexIn(rs, p.col, p.row) })), w), r = h * .34;
  let out = grid(x, y, w, ROWS, h);
  for (const { x: gx, y: gy, mark, i } of placed) {
    const cx = x + (gx + .5) * h, cy = y + (gy + .5) * h, col = COL[mark], cls = i >= before ? ' class="bc-flash"' : "";
    out += k === 1 ? `<circle${cls} cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${col}" stroke-width="${f(h * .15)}"/>`
      : k === 2 ? `<circle${cls} cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${col}"/>`
        : `<path${cls} d="M${f(cx - r)} ${f(cy + r)}L${f(cx + r)} ${f(cy - r)}" stroke="${col}" stroke-width="${f(h * .2)}" stroke-linecap="round"/>`;
  }
  return out;
}
/** A mark's place in the order its road made them, from its column and row. */
const indexIn = (cols, c, r) => cols.slice(0, c).reduce((a, col) => a + col.length, 0) + r;

/**
 * The whole scoreboard as one SVG: the big road w cells across over the bead plate (bead columns) and the derived roads
 * beside it; flash ("B" or "P") shows where the next hand would go if it went that way, blinking, as the ask buttons do.
 */
export function scoreboard(results, { w = 24, bead = 6, flash = null } = {}) {
  const s = 10, h = s / 2, rest = w - bead, half = rest * 2;
  const parts = [
    bigRoad(results, { x: 0, y: 0, w, s, flash }),
    beadRoad(results, { x: 0, y: ROWS * s, w: bead, s }),
    derivedRoad(results, 1, { x: bead * s, y: ROWS * s, w: half, h, flash }),
    derivedRoad(results, 2, { x: bead * s, y: ROWS * s + ROWS * h, w: rest, h, flash }),
    derivedRoad(results, 3, { x: bead * s + rest * h, y: ROWS * s + ROWS * h, w: rest, h, flash }),
  ];
  return `<svg class="bc-roads" viewBox="-0.5 -0.5 ${w * s + 1} ${ROWS * s * 2 + 1}" role="img" aria-label="The scoreboard">${parts.join("")}<path class="bc-frame" d="M0 ${ROWS * s}H${w * s}M${bead * s} ${ROWS * s}V${ROWS * s * 2}M${bead * s} ${ROWS * s + ROWS * h}H${w * s}M${bead * s + rest * h} ${ROWS * s + ROWS * h}V${ROWS * s * 2}"/><rect class="bc-frame" x="0" y="0" width="${w * s}" height="${ROWS * s * 2}" fill="none"/></svg>`;
}
/** One road on its own, for a lesson: "big", "bead", or a derived road's k (1–3), w across. */
export function roadSvg(kind, results, { w = 12, flash = null } = {}) {
  const s = 10;
  const inner = kind === "bead" ? beadRoad(results, { w, s }) : kind === "big" ? bigRoad(results, { w, s, flash }) : derivedRoad(results, kind, { w, h: s, flash });
  return `<svg class="bc-roads" viewBox="-0.5 -0.5 ${w * s + 1} ${ROWS * s + 1}" role="img" aria-label="${kind === "bead" ? "The bead plate" : kind === "big" ? "The big road" : ROADS[kind - 1].name}">${inner}<rect class="bc-frame" x="0" y="0" width="${w * s}" height="${ROWS * s}" fill="none"/></svg>`;
}
/** The ask road's marks for a side (B or P): each derived road's next mark as the screen's ask button shows it. */
export function askMarks(results, side) {
  const a = ask(results)[side];
  return a.map((m, i) => {
    if (!m) return `<svg class="bc-ask-mark" viewBox="0 0 10 10" aria-hidden="true"></svg>`;
    const c = COL[m];
    return `<svg class="bc-ask-mark" viewBox="0 0 10 10" role="img" aria-label="${ROADS[i].name}: ${m}">${i === 0 ? `<circle cx="5" cy="5" r="3.4" fill="none" stroke="${c}" stroke-width="1.5"/>` : i === 1 ? `<circle cx="5" cy="5" r="3.4" fill="${c}"/>` : `<path d="M1.8 8.2L8.2 1.8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`}</svg>`;
  }).join("");
}
