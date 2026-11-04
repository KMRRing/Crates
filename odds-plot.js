// The Odds course's pictures, as SVG strings: curves, histograms, the running mean's cone, wealth paths, the reliability
// plot, a range on a number line. Colours and strokes are classes (odds.css) so the three themes, day and night, restyle
// them; text is in the viewBox's units. No page, so the shapes are tested in Node.
import { growth, kelly, ruinPoint, expectedBrier, posterior, frac, num, waysTo } from "./odds-math.js";

const W = 320, H = 210, ML = 48, MR = 12, MT = 12, MB = 26;
const r1 = x => Math.round(x * 10) / 10;
/** A linear or log scale from a domain to a range of pixels, with its inverse. */
export function scale(d0, d1, p0, p1, log = false) {
  const t = v => (log ? (Math.log(v) - Math.log(d0)) / (Math.log(d1) - Math.log(d0)) : (v - d0) / (d1 - d0));
  const s = v => p0 + t(v) * (p1 - p0);
  s.inv = px => { const u = (px - p0) / (p1 - p0); return log ? Math.exp(Math.log(d0) + u * (Math.log(d1) - Math.log(d0))) : d0 + u * (d1 - d0); };
  return s;
}
const line = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const text = (x, y, s, cls = "", anchor = "middle") => `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" class="od-t ${cls}"${cls.includes("od-rot") ? ` transform="rotate(-90 ${r1(x)} ${r1(y)})"` : ""}>${esc(s)}</text>`;
const svg = (body, label) => `<svg class="od-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
/** The frame: ticks and gridlines for the given values. xs, ys: [[value, label]…]. */
function axes(X, Y, xs, ys) {
  const x0 = ML, x1 = W - MR, y0 = MT, y1 = H - MB;
  return `<g class="od-grid">${ys.map(([v]) => `<path d="M${x0} ${r1(Y(v))}H${x1}"/>`).join("")}${xs.map(([v]) => `<path d="M${r1(X(v))} ${y0}V${y1}"/>`).join("")}</g>`
    + `<path class="od-ax" d="M${x0} ${y0}V${y1}H${x1}"/>`
    + xs.map(([v, l]) => text(X(v), y1 + 14, l, "od-tick")).join("") + ys.map(([v, l]) => text(x0 - 5, Y(v) + 3.5, l, "od-tick", "end")).join("");
}
const clip = id => `<clipPath id="${id}"><rect x="${ML}" y="${MT}" width="${W - ML - MR}" height="${H - MT - MB}"/></clipPath>`;
const pctLabel = v => `${Math.round(v * 100)}%`;

// ---------- Kelly: the growth curve, its top and its ruin zone ----------
export function kellyPlot({ p, b, f, ruin = false, guide = true }) {
  const fs = kelly(p, b), gmax = growth(fs, p, b), z = ruinPoint(p, b);
  const top = Math.max(gmax * 1.35, 0.004), bot = -top * 2.2;
  const X = scale(0, 1, ML, W - MR), Y = scale(bot, top, H - MB, MT);
  const pts = [];
  for (let i = 0; i <= 200; i++) { const x = i / 200, g = growth(x, p, b); if (g >= bot) pts.push([X(x), Y(g)]); }
  const g = growth(f, p, b), shown = g >= bot ? g : bot;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(v => [v, pctLabel(v)]);
  const yt = [[0, "0"], [top * 0.8, `+${(100 * top * 0.8).toFixed(1)}%`], [bot * 0.8, `${(100 * bot * 0.8).toFixed(1)}%`]];
  return svg(`<defs>${clip("odc")}</defs>`
    + (z > 0 && ruin ? `<rect class="od-zone" x="${r1(X(z))}" y="${Y(top)}" width="${r1(X(1) - X(z))}" height="${r1(Y(bot) - Y(top))}"/>${text((X(z) + X(1)) / 2, MT + 12, "ruin zone", "od-zone-t")}` : "")
    + axes(X, Y, ticks, yt) + `<path class="od-zero" d="M${ML} ${r1(Y(0))}H${W - MR}"/>`
    + (guide && fs > 0 ? `<path class="od-guide" d="M${r1(X(fs))} ${MT}V${H - MB}"/>${text(X(fs), MT + 10, "Kelly", "od-guide-t", X(fs) > W - 60 ? "end" : "start")}` : "")
    + `<path class="od-curve" clip-path="url(#odc)" d="${line(pts)}"/><circle class="od-dot" cx="${r1(X(f))}" cy="${r1(Y(shown))}" r="5"/>`
    + text(W / 2, H - 1, "share of the bankroll staked", "od-cap") + text(9, H / 2, "growth per bet", "od-cap od-rot"), `Growth per bet against the share staked: ${pctLabel(f)} gives ${(100 * g).toFixed(2)}%`);
}
/** Growth at a fixed stake as the true chance moves (the cost of a wrong estimate). */
export function wrongPlot({ b, f, p, believed = 0.6 }) {
  const lo = 0.4, hi = 0.7, ys = [growth(f, lo, b), growth(f, hi, b)], bot = Math.min(...ys, -0.002), top = Math.max(...ys, 0.002);
  const X = scale(lo, hi, ML, W - MR), Y = scale(bot, top, H - MB, MT);
  const pts = []; for (let i = 0; i <= 120; i++) { const x = lo + (hi - lo) * i / 120; pts.push([X(x), Y(growth(f, x, b))]); }
  let zero = lo; for (let x = lo; x < hi; x += 0.0005) if (growth(f, x, b) > 0) { zero = x; break; }
  const xt = [0.4, 0.5, 0.6, 0.7].map(v => [v, pctLabel(v)]);
  return svg(axes(X, Y, xt, [[0, "0"], [top * 0.8, `+${(100 * top * 0.8).toFixed(1)}%`], [bot * 0.8, `${(100 * bot * 0.8).toFixed(1)}%`]])
    + `<rect class="od-zone" x="${ML}" y="${r1(Y(0))}" width="${r1(X(zero) - ML)}" height="${r1(Y(bot) - Y(0))}"/>`
    + `<path class="od-zero" d="M${ML} ${r1(Y(0))}H${W - MR}"/><path class="od-guide" d="M${r1(X(believed))} ${MT}V${H - MB}"/>${text(X(believed), MT + 10, "you think", "od-guide-t", "end")}`
    + `<path class="od-curve" d="${line(pts)}"/><circle class="od-dot" cx="${r1(X(p))}" cy="${r1(Y(growth(f, p, b)))}" r="5"/>`
    + text(W / 2, H - 1, "the true chance of winning", "od-cap") + text(9, H / 2, "growth per bet", "od-cap od-rot"), `Growth at a ${pctLabel(f)} stake if the true chance is ${pctLabel(p)}: ${(100 * growth(f, p, b)).toFixed(2)}%`);
}
/** Each side's expected profit as the price moves: the fair price is where both are zero. */
export function pricePlot({ fair, min, max, price, fmt }) {
  const span = max - min, X = scale(min, max, ML, W - MR), Y = scale(-span / 2, span / 2, H - MB, MT);
  const xt = [0, 0.25, 0.5, 0.75, 1].map(u => { const v = min + u * span; return [v, fmt(v, true)]; }), yt = [[0, "0"], [span / 4, fmt(span / 4, true)], [-span / 4, fmt(-span / 4, true)]];
  return svg(axes(X, Y, xt, yt) + `<path class="od-zero" d="M${ML} ${r1(Y(0))}H${W - MR}"/>`
    + `<path class="od-curve" d="${line([[X(min), Y(fair - min)], [X(max), Y(fair - max)]])}"/><path class="od-curve2" d="${line([[X(min), Y(min - fair)], [X(max), Y(max - fair)]])}"/>`
    + ""
    + `<path class="od-guide" d="M${r1(X(price))} ${MT}V${H - MB}"/><circle class="od-dot" cx="${r1(X(price))}" cy="${r1(Y(fair - price))}" r="5"/><circle class="od-dot2" cx="${r1(X(price))}" cy="${r1(Y(price - fair))}" r="5"/>`
    + text(W / 2, H - 1, "price", "od-cap") + text(9, H / 2, "expected profit", "od-cap od-rot"), `Expected profit to buyer and seller at a price of ${fmt(price)}`);
}
/** The expected Brier score of reporting q when the true chance is p. */
export function scorePlot({ p, q }) {
  const top = Math.max(expectedBrier(0, p), expectedBrier(1, p)), X = scale(0, 1, ML, W - MR), Y = scale(0, top, H - MB, MT);
  const pts = []; for (let i = 0; i <= 100; i++) pts.push([X(i / 100), Y(expectedBrier(i / 100, p))]);
  return svg(axes(X, Y, [0, 0.25, 0.5, 0.75, 1].map(v => [v, pctLabel(v)]), [0, 0.5, 1].map(u => [u * top, (u * top).toFixed(2)]))
    + `<path class="od-guide" d="M${r1(X(p))} ${MT}V${H - MB}"/>${text(X(p), MT + 10, "true chance", "od-guide-t", p > 0.7 ? "end" : "start")}`
    + `<path class="od-curve" d="${line(pts)}"/><circle class="od-dot" cx="${r1(X(q))}" cy="${r1(Y(expectedBrier(q, p)))}" r="5"/>`
    + text(W / 2, H - 1, "the probability you report", "od-cap") + text(9, H / 2, "expected Brier", "od-cap od-rot"), `Expected Brier score reporting ${pctLabel(q)}: ${expectedBrier(q, p).toFixed(3)}`);
}
/** The chance a flag is right as the base rate moves. */
export function priorPlot({ sens, fpr, prior, max }) {
  const post = x => num(posterior(frac(Math.round(x * 1e6), 1e6), frac(Math.round(sens * 1e6), 1e6), frac(Math.round(fpr * 1e6), 1e6)));
  const X = scale(0, max, ML, W - MR), Y = scale(0, 1, H - MB, MT), pts = [];
  for (let i = 1; i <= 120; i++) { const x = max * i / 120; pts.push([X(x), Y(post(x))]); }
  const at = post(prior);
  return svg(axes(X, Y, [0, 0.1, 0.2, 0.3].filter(v => v <= max + 1e-9).map(v => [v, pctLabel(v)]), [0, 0.25, 0.5, 0.75, 1].map(v => [v, pctLabel(v)]))
    + `<path class="od-zero" d="M${ML} ${r1(Y(0.5))}H${W - MR}"/>${text(W - MR - 2, Y(0.5) - 4, "coin flip", "od-tick", "end")}`
    + `<path class="od-curve" d="${line(pts)}"/><circle class="od-dot" cx="${r1(X(prior))}" cy="${r1(Y(at))}" r="5"/>`
    + text(W / 2, H - 1, "how common it is (the base rate)", "od-cap") + text(9, H / 2, "chance a flag is right", "od-cap od-rot"), `A flag is right ${pctLabel(at)} of the time when the base rate is ${(100 * prior).toFixed(1)}%`);
}

// ---------- simulations ----------
/** Totals of two dice: bars of what came up, outlined bars of what the ways say should. */
export function totalsPlot(counts, n) {
  const X = scale(1.5, 12.5, ML, W - MR), Y = scale(0, 0.2, H - MB, MT), bw = (X(3) - X(2)) * 0.78;
  const bars = [], marks = [];
  for (let t = 2; t <= 12; t++) {
    const exact = waysTo(t) / 36, seen = n ? counts[t] / n : 0, x = X(t) - bw / 2;
    bars.push(`<rect class="od-bar" x="${r1(x)}" y="${r1(Y(seen))}" width="${r1(bw)}" height="${r1(Y(0) - Y(seen))}"/>`);
    marks.push(`<rect class="od-exact" x="${r1(x)}" y="${r1(Y(exact))}" width="${r1(bw)}" height="${r1(Y(0) - Y(exact))}"/>`);
  }
  return svg(axes(X, Y, Array.from({ length: 11 }, (_, i) => [i + 2, String(i + 2)]), [0, 0.1, 0.2].map(v => [v, pctLabel(v)])) + bars.join("") + marks.join("")
    + text(W / 2, H - 1, "total of the two dice", "od-cap") + text(9, H / 2, "share of throws", "od-cap od-rot"), `Totals of ${n} throws of two dice`);
}
/** The running mean of n plays against the expected value, inside its cone of two standard errors. */
export function meanPlot({ path, ev, sd, n, lo, hi }) {
  const X = scale(1, 10000, ML, W - MR, true), Y = scale(lo, hi, H - MB, MT), cone = [], low = [];
  for (let i = 0; i <= 60; i++) { const k = Math.exp(Math.log(10000) * i / 60), e = 2 * sd / Math.sqrt(k); cone.push([X(k), Y(ev + e)]); low.push([X(k), Y(ev - e)]); }
  const step = Math.max(1, Math.floor(path.length / 260)), pts = path.filter((_, i) => i % step === 0 || i === path.length - 1).map(([k, m]) => [X(k), Y(m)]);
  const yt = [lo, ev, hi].map(v => [v, v.toFixed(Math.abs(v) < 10 && v !== Math.round(v) ? 2 : 0).replace("-", "−")]);
  return svg(`<defs>${clip("odm")}</defs>` + axes(X, Y, [1, 10, 100, 1000, 10000].map(v => [v, v >= 1000 ? `${v / 1000}k` : String(v)]), yt)
    + `<path class="od-cone" clip-path="url(#odm)" d="${line(cone)}${line(low.reverse()).replace("M", "L")}Z"/><path class="od-zero" d="M${ML} ${r1(Y(ev))}H${W - MR}"/>`
    + (pts.length ? `<path class="od-curve" clip-path="url(#odm)" d="${line(pts)}"/>` : "")
    + text(W - MR - 2, Y(ev) - 5, `EV ${ev.toFixed(Math.abs(ev) < 1 ? 3 : 1).replace("-", "−")}`, "od-tick", "end")
    + text(W / 2, H - 1, "plays so far", "od-cap") + text(9, H / 2, "average so far", "od-cap od-rot"), `Running average after ${n} plays`);
}
/** Wealth paths on a log scale, with the starting level and half of it marked. */
export function pathsPlot({ drawn, bets }) {
  const X = scale(0, bets, ML, W - MR), Y = scale(0.05, 200, H - MB, MT, true), cl = v => Math.min(200, Math.max(0.05, v));
  const lines = drawn.map(p => `<path class="od-path" clip-path="url(#odp)" d="${line(p.map((w, i) => [X(i), Y(cl(w))]))}"/>`).join("");
  return svg(`<defs>${clip("odp")}</defs>` + axes(X, Y, [0, 25, 50, 75, 100].map(v => [v * bets / 100, String(v * bets / 100)]), [0.1, 0.5, 1, 2, 10, 100].map(v => [v, `${v}×`]))
    + `<path class="od-zero" d="M${ML} ${r1(Y(1))}H${W - MR}"/><path class="od-guide" d="M${ML} ${r1(Y(0.5))}H${W - MR}"/>` + lines
    + text(W / 2, H - 1, "bets made", "od-cap") + text(9, H / 2, "bankroll (log scale)", "od-cap od-rot"), `${drawn.length} possible runs of ${bets} bets`);
}
/** Reliability: how often you were right at each confidence you used; the diagonal is calibration. points: [{ c, rate, n }]. */
export function relPlot(points) {
  const X = scale(45, 104, ML, W - MR), Y = scale(0, 100, H - MB, MT), max = Math.max(1, ...points.map(p => p.n));
  const pts = points.map(p => [X(p.c), Y(100 * p.rate)]);
  return svg(axes(X, Y, [50, 60, 70, 80, 90, 99].map(v => [v, String(v)]), [0, 25, 50, 75, 100].map(v => [v, String(v)]))
    + `<path class="od-diag" d="M${r1(X(45))} ${r1(Y(45))}L${r1(X(100))} ${r1(Y(100))}"/>${text(X(78), Y(78) - 8, "calibrated", "od-tick", "end")}`
    + (pts.length > 1 && points.every(p => p.n >= 5) ? `<path class="od-curve" d="${line(pts)}"/>` : "")
    + points.map((p, i) => `<circle class="od-dot" cx="${r1(pts[i][0])}" cy="${r1(pts[i][1])}" r="${r1(3 + 4 * Math.sqrt(p.n / max))}"/>`).join("")
    + text(W / 2, H - 1, "how sure you said you were (%)", "od-cap") + text(9, H / 2, "how often right (%)", "od-cap od-rot"), points.length ? "Reliability plot: how often you were right at each confidence" : "Reliability plot, no answers yet");
}
/** One range question settled: the slider's line (linear or log), your range as a band, the truth as a mark. */
export function rangePlot({ lo, hi, truth, min, max, log, hit, fmt }) {
  const X = scale(min, max, ML, W - MR, log), y = 70, ticks = log ? decades(min, max) : [0, 0.25, 0.5, 0.75, 1].map(u => min + u * (max - min));
  return svg(`<path class="od-ax" d="M${ML} ${y}H${W - MR}"/>${ticks.map(v => `<path class="od-ax" d="M${r1(X(v))} ${y - 3}V${y + 3}"/>${text(X(v), y + 22, fmt(v), "od-tick")}`).join("")}`
    + `<rect class="od-range ${hit == null ? "" : hit ? "ok" : "no"}" x="${r1(X(lo))}" y="${y - 12}" width="${Math.max(2, r1(X(hi) - X(lo)))}" height="24" rx="2"/>`
    + text(X(lo), y - 18, fmt(lo), "od-tick", X(lo) < ML + 20 ? "start" : "middle") + text(X(hi), y - 18, fmt(hi), "od-tick", X(hi) > W - MR - 20 ? "end" : "middle")
    + (truth != null ? `<path class="od-guide" d="M${r1(X(truth))} ${y - 30}V${y + 26}"/>${text(X(truth), y + 42, `${fmt(truth)}`, `od-key ${hit ? "ok" : "no"}`)}` : ""), "A range against the truth");
}
const decades = (min, max) => { const out = []; for (let v = 10 ** Math.ceil(Math.log10(min)); v <= max * 1.0001; v *= 10) out.push(v); return out.length ? out : [min, max]; };
