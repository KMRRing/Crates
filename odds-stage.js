// The stage of the Odds course (odds-course.js) on the course's sheet (course.js): what a step shows and what it asks. The
// widgets, by `w.kind`: formula and rows (things to read), grid (two dice: tap the pairs that fit), sim (thousands of throws,
// draws and bets in one tap), tree (a natural-frequency tree to fill), dial (a slider with the curve it moves along), chain
// (evidence tapped in, the odds updated), calib and range (rounds that build your own record), rel, pool and lab. Answers
// are judged by odds-math.js, never by a stored key. The sheet's own buttons submit (grid, dial, calib, range) or the stage
// judges as you tap (tree).
import * as M from "./odds-math.js";
import * as P from "./odds-plot.js";
import { STATEMENTS, QUANTITIES } from "./odds-data.js";
import { readCalib, noteAnswer, readRanges, noteRange } from "./odds-store.js";
import { stats as ledgerStats } from "./ledger-log.js";

const esc = P.esc;
const pct = (x, d = 0) => `${(100 * x).toFixed(d)}%`;
const signed = (x, d = 2) => `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(d)}`;
const grp = n => Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const seedNow = () => (Math.random() * 4294967296) >>> 0;
const die = n => { // a die face as pips, for the grid's edges
  const at = { 1: [[5, 5]], 2: [[2.8, 2.8], [7.2, 7.2]], 3: [[2.8, 2.8], [5, 5], [7.2, 7.2]], 4: [[2.8, 2.8], [7.2, 2.8], [2.8, 7.2], [7.2, 7.2]], 5: [[2.8, 2.8], [7.2, 2.8], [5, 5], [2.8, 7.2], [7.2, 7.2]], 6: [[2.8, 2.8], [7.2, 2.8], [2.8, 5], [7.2, 5], [2.8, 7.2], [7.2, 7.2]] }[n];
  return `<svg class="od-die" viewBox="0 0 10 10" aria-label="${n}"><rect x=".6" y=".6" width="8.8" height="8.8" rx="1.8"/>${at.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".95"/>`).join("")}</svg>`;
};

// ---------- the dial: a slider and the curve it moves along ----------
const FMT = {
  pct: (w, v) => `${(100 * v).toFixed(w.step < 0.01 ? 1 : 0)}%`,
  pence: (w, v) => `${(100 * v).toFixed(1)}p`,
  pound: (w, v) => `£${v.toFixed(2)}`,
};
const dialFmt = w => (v, axis = false) => (axis && w.fmt === "pence" ? `${v < 0 ? "−" : ""}${Math.round(100 * Math.abs(v))}p` : axis && w.fmt === "pound" ? `${v < 0 ? "−" : ""}£${Math.round(Math.abs(v) * 100) / 100}` : FMT[w.fmt](w, v));
/** The picture and the reading for a dial at value v. */
function dialView(w, v) {
  const f = dialFmt(w);
  switch (w.plot) {
    case "kelly": {
      const g = M.growth(v, w.p, w.b), z = M.ruinPoint(w.p, w.b);
      return { fig: P.kellyPlot({ p: w.p, b: w.b, f: v, ruin: !!w.ruin }), read: v <= 0 ? "Stake nothing: no growth." : g > 0 ? `Stake ${f(v)} · grows ${pct(g, 2)} a bet · doubles in about ${Math.round(Math.LN2 / g)} bets` : g === -Infinity ? `Stake ${f(v)} · one loss is ruin` : `Stake ${f(v)} · shrinks ${pct(-g, 2)} a bet${v > z ? " · in the ruin zone" : ""}` };
    }
    case "wrongp": {
      const g = M.growth(w.f, v, w.b);
      return { fig: P.wrongPlot({ b: w.b, f: w.f, p: v }), read: `True chance ${f(v)} · a ${pct(w.f)} stake ${g >= 0 ? "grows" : "shrinks"} ${pct(Math.abs(g), 2)} a bet` };
    }
    case "price":
      return { fig: P.pricePlot({ fair: w.fair, min: w.min, max: w.max, price: v, fmt: f }), read: `Price ${f(v)} · <b class="buy">buyer ${w.fmt === "pence" ? `${signed(100 * (w.fair - v), 1)}p` : signed(w.fair - v)}</b> · <b class="sell">seller ${w.fmt === "pence" ? `${signed(100 * (v - w.fair), 1)}p` : signed(v - w.fair)}</b>` };
    case "score":
      return { fig: P.scorePlot({ p: w.p, q: v }), read: `You report ${f(v)} · expected Brier ${M.expectedBrier(v, w.p).toFixed(3)} (lower is better)` };
    case "prior": {
      const post = M.num(M.posterior(M.frac(Math.round(v * 1e6), 1e6), M.frac(Math.round(w.sens * 1e6), 1e6), M.frac(Math.round(w.fpr * 1e6), 1e6)));
      return { fig: P.priorPlot({ sens: w.sens, fpr: w.fpr, prior: v, max: w.max }), read: `Base rate ${f(v)} · a flag is right ${pct(post, 1)} of the time` };
    }
    default: return { fig: "", read: f(v) };
  }
}
const dialMiss = (w, v) => {
  const view = dialView(w, v).read.replace(/<[^>]*>/g, "");
  if (w.plot === "kelly" && w.ruin) return `${view}. ${M.growth(v, w.p, w.b) > 0 ? "Still growing: go further up." : "Already shrinking: come back down."}`;
  if (w.plot === "kelly") return `${view}. ${v < M.kelly(w.p, w.b) ? "The curve is still climbing here." : "The curve has passed its top."}`;
  if (w.plot === "price") return `${view}. At the fair price both are zero.`;
  if (w.plot === "score") return `${view}. It goes lower somewhere nearer your real belief.`;
  return `${view}. Look for the line.`;
};

// ---------- the small renderers ----------
const formula = w => `<div class="od-formula">${w.lines.map(l => (typeof l === "string" ? `<p>${esc(l)}</p>` : `<span class="od-frac"><i>${esc(l.num)}</i><i>${esc(l.den)}</i></span>`)).join("")}${w.note ? `<small>${esc(w.note)}</small>` : ""}</div>`;
const rows = w => `<table class="od-rows"><tbody>${w.rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</tbody></table>`;
function pool(w) {
  const total = w.stakes.reduce((a, b) => a + b, 0);
  return `<table class="od-rows od-pool"><thead><tr><th></th><th>Staked</th><th>Share</th><th>Pays per 1</th></tr></thead><tbody>${w.stakes.map((s, i) => `<tr><th>Runner ${i + 1}</th><td>${s}</td><td>${pct(s / total)}</td><td>${w.pays[i].toFixed(2)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th>Total</th><td>${total}</td><td colspan="2">take ${pct(w.take)}: ${total * (1 - w.take)} shared</td></tr></tfoot></table>`;
}

// ---------- the grid of 36 throws ----------
function grid(w, st, task) {
  const marked = new Set(w.mark ? M.throwSet(w.mark, w.given) : []), given = new Set(w.given ? M.throwSet(w.given) : M.THROWS.map((_, i) => i));
  const need = task ? new Set(M.throwSet(w.tap, w.given)) : null, sel = st.sel || new Set(), done = st.done && task;
  const cells = M.THROWS.map(([a, b], i) => {
    const cls = ["od-cell", marked.has(i) ? "mark" : "", w.given && !given.has(i) ? "off" : "", sel.has(i) && !done ? "sel" : "", done && need.has(i) ? "mark" : "", st.shown && need?.has(i) && !sel.has(i) ? "miss" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${cls}" data-cell="${i}" aria-pressed="${sel.has(i)}" aria-label="${a} and ${b}" ${task && !done ? "" : "tabindex=-1"}>${a}·${b}</button>`;
  });
  const edge = k => `<span class="od-edge">${die(k)}</span>`;
  const rowsHtml = Array.from({ length: 6 }, (_, r) => edge(r + 1) + cells.slice(r * 6, r * 6 + 6).join("")).join("");
  const count = task ? (done ? `${need.size} of 36 pairs · ${M.fracText(M.frac(need.size, 36))}` : `${sel.size} tapped`) : w.mark ? `${marked.size} of ${w.given ? given.size : 36} pairs · ${M.fracText(M.probOf(w.mark, w.given))}` : "36 pairs";
  return `<div class="od-grid-wrap"><div class="od-cells"><span></span>${Array.from({ length: 6 }, (_, k) => edge(k + 1)).join("")}${rowsHtml}</div><p class="od-count">${count}</p></div>`;
}

// ---------- simulations ----------
const SIM_BUTTONS = {
  totals: [["Throw 1,000", 1000], ["Throw 36,000", 36000]],
  mean: [["10", 10], ["100", 100], ["1,000", 1000], ["10,000", 10000]],
  streak: [["Flip 400,000 coins", 400000]],
  aces: [["Deal 200,000 hands", 200000]],
  outs: [["Draw 100,000 hands", 100000]],
};
const BETS = {
  die: { play: r => 1 + Math.floor(r() * 6), ev: 3.5, sd: M.sd(M.DIE), lo: 1, hi: 6 },
  face: { play: r => (r() < 1 / 6 ? 4 : -1), ev: -1 / 6, sd: Math.sqrt((16 + 5) / 6 - 1 / 36), lo: -2.5, hi: 4.5 },
};
const KELLY_STAKES = [[0.5, "½ Kelly"], [1, "Kelly"], [2, "2 × Kelly"], [3, "3 × Kelly"]];
function simInit(w, st) {
  st.sim = st.sim || { seed: seedNow(), runs: 0, counts: Array(13).fill(0), n: 0, path: [], sum: 0, k: 0, heads: 0, tails: 0, back: 0, without: 0, hands: 0, hit: 0, mult: 1, res: null };
  return st.sim;
}
function simRun(w, st, add) {
  const s = simInit(w, st), r = M.rng(s.seed + 7919 * ++s.runs);
  if (w.sim === "totals") { const c = M.throwTotals(r, add); c.forEach((x, i) => { s.counts[i] += x; }); s.n += add; }
  else if (w.sim === "mean") {
    const room = 10000 - s.k, take = Math.min(add, room);
    if (take > 0) { const m = M.runningMean(r, take, { sum: s.sum, k: s.k }, BETS[w.bet].play); s.path.push(...m.out); s.sum = m.sum; s.k = m.k; }
  }
  else if (w.sim === "streak") { const [h, t] = M.afterRun(r, add, 5); s.heads += h; s.tails += t; }
  else if (w.sim === "aces") { s.back += M.drawTrials(r, { N: 52, K: 4, n: 2, back: true, times: add }); s.without += M.drawTrials(r, { N: 52, K: 4, n: 2, back: false, times: add }); s.hands += add; }
  else if (w.sim === "outs") { s.hit += M.outsTrials(r, { N: 47, K: 9, n: 2, times: add }); s.hands += add; }
}
function simPaths(w, st) {
  const s = simInit(w, st), K = M.kelly(w.p, w.b);
  s.res = M.wealthPaths(M.rng(s.seed + 104729 * ++s.runs), { p: w.p, b: w.b, f: K * s.mult, bets: w.bets, paths: 600, keep: 25 });
}
function simView(w, st) {
  const s = simInit(w, st);
  if (w.sim === "totals") return { fig: P.totalsPlot(s.counts, s.n), read: s.n ? `${grp(s.n)} throws · totals of 7: ${pct(s.counts[7] / s.n, 1)} (exact ${pct(1 / 6, 1)}) · totals of 2: ${pct(s.counts[2] / s.n, 1)} (exact ${pct(1 / 36, 1)})` : "Filled bars: what came up. Outlined: what the ways say." };
  if (w.sim === "mean") {
    const b = BETS[w.bet];
    return { fig: P.meanPlot({ path: s.path, ev: b.ev, sd: b.sd, n: s.k, lo: b.lo, hi: b.hi }), read: s.k ? `${grp(s.k)} plays · average ${(s.sum / s.k).toFixed(3)} · expected ${b.ev.toFixed(3)} · within ${(2 * b.sd / Math.sqrt(s.k)).toFixed(3)} about 19 times in 20` : "Play to add plays; the cone is two standard errors." };
  }
  if (w.sim === "streak") return { fig: bars([["Heads next", s.heads, s.heads + s.tails], ["Tails next", s.tails, s.heads + s.tails]], 0.5), read: s.heads + s.tails ? `${grp(s.heads + s.tails)} runs of five heads · next flip heads ${pct(s.heads / (s.heads + s.tails), 1)}, tails ${pct(s.tails / (s.heads + s.tails), 1)}` : "Tap to flip." };
  if (w.sim === "aces") {
    const exB = 1 / 169, exW = 1 / 221, top = 1 / 120;
    return { fig: bars([["First put back", s.back, s.hands, exB], ["Not put back", s.without, s.hands, exW]], top), read: s.hands ? `Two aces in ${grp(s.hands)} hands each: put back 1 in ${Math.round(s.hands / s.back)} (exact 1 in 169) · kept out 1 in ${Math.round(s.hands / s.without)} (exact 1 in 221)` : "Tap to deal." };
  }
  if (w.sim === "outs") return { fig: bars([["A heart in two cards", s.hit, s.hands, 378 / 1081]], 0.5), read: s.hands ? `${grp(s.hands)} tries · ${pct(s.hit / s.hands, 2)} hit (exact ${pct(378 / 1081, 2)})` : "Tap to draw." };
  if (w.sim === "paths") {
    const r = s.res;
    return { fig: r ? P.pathsPlot({ drawn: r.drawn, bets: w.bets }) : P.pathsPlot({ drawn: [], bets: w.bets }), read: r ? `Stake ${pct(M.kelly(w.p, w.b) * s.mult)} · median after ${w.bets} bets ${r.median.toFixed(1)}× · ${pct(r.below)} end below the start · ${pct(r.halved)} fell to half on the way` : "Tap a stake to run 600 runs of 100 bets." };
  }
  return { fig: "", read: "" };
}
/** Bars of observed shares against an exact mark: rows of [label, hits, tries, exact?]; `top` the share a full bar stands for. */
function bars(rowsIn, top, exactAll = null) {
  const rows_ = rowsIn.map(([label, hits, tries, exact]) => {
    const share = tries ? hits / tries : 0, e = exact ?? exactAll;
    return `<div class="od-bar-row"><span>${esc(label)}</span><div class="od-track"><i style="width:${Math.min(100, 100 * share / top)}%"></i>${e != null ? `<b style="left:${100 * e / top}%"></b>` : ""}</div><em>${tries ? pct(share, 2) : "–"}</em></div>`;
  }).join("");
  return `<div class="od-bars">${rows_}</div>`;
}

// ---------- the tree ----------
function tree(w, st) {
  const k = st.filled || 0, B = w.blanks, num = n => grp(n);
  const node = (blank, text, extra = "") => {
    const i = B.findIndex(b => b.id === blank), filled = i < k, active = i === k;
    return `<div class="od-node ${filled ? "ok" : "blank"}${active ? " active" : ""} ${extra}"><b>${filled ? esc(B[i].options[B[i].answer]) : "?"}</b><small>${esc(text)}</small></div>`;
  };
  const chips = k < B.length ? shuffled(B[k].options, k).map(([o, i]) => `<button type="button" class="od-chip" data-opt="${i}">${esc(o)}</button>`).join("") : "";
  return `<div class="od-tree">
    <div class="od-root"><b>${num(w.pop)}</b><small>cargoes</small></div>
    <div class="od-branch">
      <div class="od-limb">${node("have", "off-spec")}<div class="od-twig">${node("haveFlag", "flagged")}<div class="od-node ok"><b>${num(w.haveOk)}</b><small>passed</small></div></div></div>
      <div class="od-limb"><div class="od-node ok"><b>${num(w.clear)}</b><small>good</small></div><div class="od-twig">${node("clearFlag", "flagged")}<div class="od-node ok"><b>${num(w.clearOk)}</b><small>passed</small></div></div></div>
    </div>
    ${node("share", "of all flagged are off-spec", "wide")}
    <p class="od-ask" aria-live="polite">${k < B.length ? esc(B[k].label) : "Every gap filled."}</p>
    <div class="od-chips">${chips}</div>${st.treeMsg ? `<p class="od-note">${esc(st.treeMsg)}</p>` : ""}</div>`;
}
/** The options in an order that depends on the blank, so the right one is not always first. */
const shuffled = (opts, k) => opts.map((o, i) => [o, i]).sort((a, b) => ((a[1] * 7 + k * 3) % 5) - ((b[1] * 7 + k * 3) % 5) || a[1] - b[1]);

// ---------- the chain of evidence ----------
function chain(w, st) {
  const sens = M.frac(Math.round(w.sens * 1000), 1000), fpr = M.frac(Math.round(w.fpr * 1000), 1000), prior = M.frac(Math.round(w.prior * 1000), 1000);
  const hist = st.chain || [];
  let p = prior;
  for (const e of hist) p = M.update(p, e, sens, fpr);
  const odds = M.toOdds(p), lr = M.likelihoodRatio(sens, fpr), lrClear = M.div(M.sub(M.frac(1), sens), M.sub(M.frac(1), fpr));
  const oddsText = x => { const f = M.frac(x.n, x.d); return f.d === 1n ? `${f.n} : 1` : `${f.n} : ${f.d}`; };
  return `<div class="od-chain"><div class="od-meter"><i style="width:${100 * M.num(p)}%"></i><b>${pct(M.num(p), 1)}</b></div>
    <p class="od-odds">Odds late : not late &nbsp;<strong>${oddsText(odds)}</strong></p>
    <div class="od-hist">${hist.length ? hist.map(e => `<span class="${e ? "up" : "down"}">${e ? "Alert × " + M.fracText(lr) : "Clear × " + M.fracText(lrClear)}</span>`).join("") : "<span class='none'>Start: 5% late (odds 1 : 19)</span>"}</div>
    <div class="od-two"><button type="button" class="od-btn" data-ev="1">Alert</button><button type="button" class="od-btn" data-ev="0">Clear</button><button type="button" class="od-btn quiet" data-ev="reset">Start over</button></div></div>`;
}

// ---------- calibration: statements to rate ----------
function pickStatements(rec, n) {
  const r = M.rng(rec.n * 7919 + 13), pool = STATEMENTS.filter(s => !rec.seen.includes(s.id));
  const from = pool.length >= n ? pool : STATEMENTS, a = [...from];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
function calibInit(w, st) {
  if (!st.cal) st.cal = { items: pickStatements(readCalib(), w.n), i: 0, pick: null, conf: null, revealed: false, right: 0, sum: 0, rec: readCalib() };
  return st.cal;
}
function calibView(w, st) {
  const c = calibInit(w, st);
  if (st.finished) return calibSummary(c);
  const s = c.items[c.i], last = c.revealed ? (c.pick === s.t) : null;
  const conf = M.CONF.map(v => `<button type="button" class="od-chip${c.conf === v ? " sel" : ""}" data-conf="${v}" ${c.revealed ? "disabled" : ""} aria-pressed="${c.conf === v}">${v}%</button>`).join("");
  return `<div class="od-calib"><p class="od-prog">${c.i + 1} of ${c.items.length}</p><p class="od-claim">${esc(s.s)}</p>
    <div class="od-two"><button type="button" class="od-tf${c.pick === true ? " sel" : ""}${c.revealed && s.t ? " truth" : ""}" data-tf="1" ${c.revealed ? "disabled" : ""} aria-pressed="${c.pick === true}">True</button><button type="button" class="od-tf${c.pick === false ? " sel" : ""}${c.revealed && !s.t ? " truth" : ""}" data-tf="0" ${c.revealed ? "disabled" : ""} aria-pressed="${c.pick === false}">False</button></div>
    <p class="od-ask">How sure are you?</p><div class="od-chips six">${conf}</div>
    ${c.revealed ? `<p class="od-note ${last ? "ok" : "no"}">${last ? "Right" : "Wrong"}, at ${c.conf}%. ${esc(s.x)} Brier ${M.brierOne(c.conf / 100, last).toFixed(2)}.</p>` : ""}</div>`;
}
function calibSummary(c) {
  const rec = readCalib(), pts = M.reliability(rec), o = M.overconfidence(rec), b = M.meanBrier(rec);
  const round = `${c.right} of ${c.items.length} right this round, at ${(c.sum / c.items.length).toFixed(0)}% average confidence`;
  const verdict = rec.n < 20 ? "Too few answers to trust a plot: round again to sharpen it." : o > 0.05 ? "Overconfident: you claim more than you deliver." : o < -0.05 ? "Underconfident: you know more than you say." : "Close to calibrated.";
  return `<div class="od-sum">${P.relPlot(pts)}<p class="od-read">${esc(round)}</p><p class="od-read">All ${rec.n} answers: Brier ${b.toFixed(3)} (0.25 = always 50%) · ${esc(verdict)}</p></div>`;
}

// ---------- ranges to bracket ----------
function rangeValue(q, t) { // t: 0..1000 on the slider
  const raw = q.log ? Math.exp(Math.log(q.lo) + (t / 1000) * (Math.log(q.hi) - Math.log(q.lo))) : q.lo + (t / 1000) * (q.hi - q.lo);
  if (!q.log) return Math.round(raw);
  const mag = 10 ** (Math.floor(Math.log10(raw)) - 2);
  return Math.round(raw / mag) * mag;
}
const rangeText = (q, v) => `${grp(v)}${q.unit ? ` ${q.unit}` : ""}`;
function pickQuantities(done, n) {
  const r = M.rng(done * 104729 + 5), a = [...QUANTITIES];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
function rangeInit(w, st) {
  if (!st.rg) st.rg = { items: pickQuantities(readRanges()[1], w.n), i: 0, lo: 400, hi: 600, revealed: false, hits: 0 };
  return st.rg;
}
function rangeFig(g, reveal) {
  const q = g.items[g.i], lo = rangeValue(q, g.lo), hi = rangeValue(q, g.hi);
  return P.rangePlot({ lo, hi, truth: reveal ? q.t : null, min: q.lo, max: q.hi, log: q.log, hit: reveal ? M.inside(lo, hi, q.t) : null, fmt: v => grp(v) });
}
function rangeView(w, st) {
  const g = rangeInit(w, st);
  if (st.finished) {
    const [h, n] = readRanges();
    return `<div class="od-sum"><p class="od-big">${g.hits} of ${g.items.length}</p><p class="od-read">of your ranges held the truth this round. You aimed for 90%: five or six of six.</p><p class="od-read">All time: ${h} of ${n} (${n ? pct(h / n) : "–"}).</p></div>`;
  }
  const q = g.items[g.i], lo = rangeValue(q, g.lo), hi = rangeValue(q, g.hi), hit = g.revealed ? M.inside(lo, hi, q.t) : null;
  return `<div class="od-range-box"><p class="od-prog">${g.i + 1} of ${g.items.length}</p><p class="od-claim">${esc(q.q)}${q.unit ? ` (${esc(q.unit)})` : ""}</p>
    <div class="od-fig">${rangeFig(g, g.revealed)}</div>
    <label class="od-sl"><span>Low end <b data-lo-read>${rangeText(q, lo)}</b></span><input type="range" min="0" max="1000" step="1" value="${g.lo}" data-lo ${g.revealed ? "disabled" : ""}></label>
    <label class="od-sl"><span>High end <b data-hi-read>${rangeText(q, hi)}</b></span><input type="range" min="0" max="1000" step="1" value="${g.hi}" data-hi ${g.revealed ? "disabled" : ""}></label>
    ${g.revealed ? `<p class="od-note ${hit ? "ok" : "no"}">${hit ? "Inside" : "Missed"}: the truth is ${rangeText(q, q.t)}.</p>` : ""}</div>`;
}

// ---------- the lab: what Quote and Punt have recorded ----------
function lab(w) {
  const s = ledgerStats(), weeks = o => Object.values(o || {});
  let n = 0, inside = 0;
  for (const m of weeks(s.market)) { n += m.n || 0; inside += m.inside || 0; }
  const tenths = Array.from({ length: 10 }, () => [0, 0, 0]);
  for (const wk of weeks(s.stake)) for (const [t, v] of Object.entries(wk)) { const i = Number(t); if (i >= 0 && i < 10 && Array.isArray(v)) { tenths[i][0] += v[0]; tenths[i][1] += v[1]; tenths[i][2] += v[2]; } }
  const pts = tenths.map(([won, tried], i) => ({ c: i * 10 + 5, n: tried, rate: tried ? won / tried : 0 })).filter(p => p.n >= 3);
  const bets = tenths.reduce((a, t) => a + t[1], 0), brier = bets ? tenths.reduce((a, t) => a + t[2], 0) / bets : null;
  const quote = n ? `Quote: the truth lay inside ${inside} of your ${n} markets (${pct(inside / n)}).` : "Quote: no markets recorded yet.";
  const punt = bets ? `Punt: ${bets} staked bets, Brier ${brier.toFixed(3)} (0.25 is a 50/50 guess).` : "Punt: no staked bets recorded yet.";
  const links = w.links ? `<div class="od-two"><a class="od-btn" href="quote.html">Open Quote</a><a class="od-btn" href="punt.html">Open Punt</a></div>` : "";
  return `<div class="od-sum">${w.links ? "" : P.relPlot(pts)}<p class="od-read">${esc(quote)}</p><p class="od-read">${esc(punt)}</p>${links}</div>`;
}

// ---------- the stage ----------
/** Whether a step asks for an answer on the stage (the rest are figures to read or play with). */
const isTask = s => { const w = s.w; return !!w && (!!w.tap || w.kind === "tree" || w.kind === "calib" || w.kind === "range" || (w.kind === "dial" && w.target != null)); };
export function oddsStage() {
  let box = null, api = null, cur = { step: null, st: null };
  const W = () => cur.step?.w;
  const setDial = (v, live) => {
    const w = W(), st = cur.st; if (!w || w.kind !== "dial" || (isTask(cur.step) && st.done)) return;
    st.val = v;
    const view = dialView(w, v), fig = box.querySelector(".od-fig"), read = box.querySelector(".od-read");
    if (fig) fig.innerHTML = view.fig; if (read) read.innerHTML = view.read;
    const out = box.querySelector("[data-out]"); if (out) out.textContent = dialFmt(w)(v);
    if (!live) api.changed();
  };
  const setRange = (which, t, live) => {
    const g = cur.st.rg; if (!g || g.revealed) return;
    g[which] = Number(t); if (g.lo > g.hi) { if (which === "lo") g.hi = g.lo; else g.lo = g.hi; }
    const q = g.items[g.i];
    box.querySelector(".od-fig").innerHTML = rangeFig(g, false);
    box.querySelector("[data-lo-read]").textContent = rangeText(q, rangeValue(q, g.lo)); box.querySelector("[data-hi-read]").textContent = rangeText(q, rangeValue(q, g.hi));
    box.querySelector("[data-lo]").value = g.lo; box.querySelector("[data-hi]").value = g.hi;
    if (!live) api.changed();
  };
  return {
    mount(b, a) {
      box = b; api = a;
      box.addEventListener("click", e => {
        const { step, st } = cur; if (!step) return;
        const w = step.w || {}, t = e.target.closest("button, a");
        if (!t) return;
        if (t.dataset.cell != null && w.kind === "grid" && w.tap && !st.done) { const i = Number(t.dataset.cell), sel = (st.sel = st.sel || new Set()); sel.has(i) ? sel.delete(i) : sel.add(i); st.shown = false; api.changed(); }
        else if (t.dataset.run != null && w.kind === "sim") { simRun(w, st, Number(t.dataset.run)); api.changed(); }
        else if (t.dataset.reset != null && w.kind === "sim") { st.sim = null; api.changed(); }
        else if (t.dataset.mult != null && w.kind === "sim") { simInit(w, st).mult = Number(t.dataset.mult); simPaths(w, st); api.changed(); }
        else if (t.dataset.again != null && w.kind === "sim") { simPaths(w, st); api.changed(); }
        else if (t.dataset.step != null && w.kind === "dial" && !(isTask(step) && st.done)) { const v = Math.min(w.max, Math.max(w.min, Math.round(((st.val ?? w.start) + Number(t.dataset.step) * w.step) / w.step) * w.step)); setDial(Number(v.toFixed(6)), false); }
        else if (t.dataset.opt != null && w.kind === "tree" && !st.done) {
          const i = Number(t.dataset.opt), k = st.filled || 0, blank = w.blanks[k];
          if (i === blank.answer) { st.filled = k + 1; st.treeMsg = ""; if (st.filled === w.blanks.length) api.answer({ ok: true, msg: step.why }); else api.changed(); }
          else api.answer({ ok: false, why: `Not ${blank.options[i]}. ${k === 0 ? "One in 100 of 10,000 is off-spec." : k === 1 ? "90% of the off-spec ones are flagged." : k === 2 ? "9% of the good ones are flagged anyway." : "Divide the real flags by all the flags."}` });
        }
        else if (t.dataset.ev != null && w.kind === "chain") { if (t.dataset.ev === "reset") st.chain = []; else (st.chain = st.chain || []).push(t.dataset.ev === "1"); api.changed(); }
        else if (t.dataset.tf != null && w.kind === "calib") { const c = calibInit(w, st); if (!c.revealed) { c.pick = t.dataset.tf === "1"; api.changed(); } }
        else if (t.dataset.conf != null && w.kind === "calib") { const c = calibInit(w, st); if (!c.revealed) { c.conf = Number(t.dataset.conf); api.changed(); } }
      });
      box.addEventListener("input", e => {
        const t = e.target;
        if (t.matches("[data-dial]")) setDial(Number(t.value), true);
        else if (t.matches("[data-lo]")) setRange("lo", t.value, true);
        else if (t.matches("[data-hi]")) setRange("hi", t.value, true);
      });
      box.addEventListener("change", e => {
        const t = e.target;
        if (t.matches("[data-dial]")) setDial(Number(t.value), false);
        else if (t.matches("[data-lo]")) setRange("lo", t.value, false);
        else if (t.matches("[data-hi]")) setRange("hi", t.value, false);
      });
    },
    task: isTask,
    submits: s => !!s.w && (!!s.w.tap || s.w.kind === "calib" || s.w.kind === "range" || (s.w.kind === "dial" && s.w.target != null)),
    ready(s, st) {
      cur = { step: s, st };
      const w = s.w;
      if (w.kind === "grid") return (st.sel?.size || 0) > 0;
      if (w.kind === "calib") { const c = calibInit(w, st); return c.revealed || (c.pick != null && c.conf != null); }
      return true;
    },
    label(s, st) {
      cur = { step: s, st };
      const w = s.w;
      if (w.kind === "dial") return w.fmt === "pence" ? "Check price" : `Check ${dialFmt(w)(st.val ?? w.start)}`;
      if (w.kind === "calib") { const c = calibInit(w, st); return c.revealed ? (c.i + 1 < c.items.length ? "Next statement" : "See my plot") : "Lock in"; }
      if (w.kind === "range") { const g = rangeInit(w, st); return g.revealed ? (g.i + 1 < g.items.length ? "Next question" : "See my result") : "Lock in"; }
      return "Check";
    },
    submit(s, st) {
      cur = { step: s, st };
      const w = s.w;
      if (w.kind === "grid") {
        const need = new Set(M.throwSet(w.tap, w.given)), sel = st.sel || new Set();
        const missing = [...need].filter(i => !sel.has(i)).length, extra = [...sel].filter(i => !need.has(i)).length;
        if (!missing && !extra) return { ok: true, msg: s.why };
        st.shown = false;
        return { ok: false, why: `${missing ? `${missing} missing` : ""}${missing && extra ? " and " : ""}${extra ? `${extra} that don't fit` : ""}. Check the dice again.` };
      }
      if (w.kind === "dial") {
        const v = st.val ?? w.start;
        return Math.abs(v - w.target) <= w.tol + 1e-9 ? { ok: true, msg: s.why } : { ok: false, why: dialMiss(w, v) };
      }
      if (w.kind === "calib") {
        const c = calibInit(w, st);
        if (!c.revealed) {
          const it = c.items[c.i], right = c.pick === it.t;
          c.revealed = true; c.right += right ? 1 : 0; c.sum += c.conf; c.rec = noteAnswer(it.id, c.conf, right);
          return { ok: true, done: false, msg: "" };
        }
        if (c.i + 1 < c.items.length) { Object.assign(c, { i: c.i + 1, pick: null, conf: null, revealed: false }); return { ok: true, done: false, msg: "" }; }
        st.finished = true;
        return { ok: true, msg: s.why };
      }
      if (w.kind === "range") {
        const g = rangeInit(w, st);
        if (!g.revealed) {
          const q = g.items[g.i], hit = M.inside(rangeValue(q, g.lo), rangeValue(q, g.hi), q.t);
          g.revealed = true; g.hits += hit ? 1 : 0; noteRange(hit);
          return { ok: true, done: false, msg: "" };
        }
        if (g.i + 1 < g.items.length) { Object.assign(g, { i: g.i + 1, lo: 400, hi: 600, revealed: false }); return { ok: true, done: false, msg: "" }; }
        st.finished = true;
        return { ok: true, msg: s.why };
      }
      return { ok: true };
    },
    hint(s, st) {
      const w = s.w;
      if (w.kind === "grid") { st.sel = new Set(M.throwSet(w.tap, w.given)); st.shown = true; }
      else if (w.kind === "dial") st.val = w.target;
      else if (w.kind === "tree") { st.filled = w.blanks.length - 1; }
      else if (w.kind === "calib") calibInit(w, st);
    },
    draw(s, st) {
      cur = { step: s, st };
      const w = s.w;
      if (!w) { box.innerHTML = ""; return; }
      const task = isTask(s) && !st.done;
      let html = "";
      switch (w.kind) {
        case "formula": html = formula(w); break;
        case "rows": html = rows(w); break;
        case "pool": html = pool(w); break;
        case "rel": html = `<div class="od-sum">${P.relPlot(w.points)}</div>`; break;
        case "grid": html = grid(w, st, !!w.tap); break;
        case "tree": html = tree(w, st); break;
        case "chain": html = chain(w, st); break;
        case "calib": html = calibView(w, st); break;
        case "range": html = rangeView(w, st); break;
        case "lab": html = lab(w); break;
        case "dial": {
          const v = st.val ?? w.start, view = dialView(w, v), f = dialFmt(w);
          const lock = isTask(s) && st.done ? "disabled" : "";
          html = `<div class="od-dial"><div class="od-fig">${view.fig}</div><p class="od-read" aria-live="polite">${view.read}</p>
            <div class="od-slide"><button type="button" class="od-step" data-step="-1" aria-label="Less" ${lock}>−</button>
            <input type="range" min="${w.min}" max="${w.max}" step="${w.step}" value="${v}" data-dial aria-label="${esc(w.plot)}" ${lock}>
            <button type="button" class="od-step" data-step="1" aria-label="More" ${lock}>+</button></div><p class="od-out"><b data-out>${f(v)}</b></p></div>`;
          break;
        }
        case "sim": {
          if (w.sim === "paths" && !simInit(w, st).res) simPaths(w, st);
          const view = simView(w, st);
          let ctl;
          if (w.sim === "paths") ctl = `<div class="od-chips">${KELLY_STAKES.map(([m, l]) => `<button type="button" class="od-chip${simInit(w, st).mult === m && st.sim.res ? " sel" : ""}" data-mult="${m}">${l}</button>`).join("")}<button type="button" class="od-chip quiet" data-again="1">Run again</button></div>`;
          else ctl = `<div class="od-chips">${SIM_BUTTONS[w.sim].map(([l, n]) => `<button type="button" class="od-chip" data-run="${n}">${w.sim === "mean" ? `+${l} plays` : l}</button>`).join("")}${w.sim === "mean" || w.sim === "totals" ? `<button type="button" class="od-chip quiet" data-reset="1">Reset</button>` : ""}</div>`;
          html = `<div class="od-sim"><div class="od-fig">${view.fig}</div><p class="od-read" aria-live="polite">${esc(view.read)}</p>${ctl}</div>`;
          break;
        }
        default: html = "";
      }
      void task;
      box.innerHTML = html;
    },
  };
}
