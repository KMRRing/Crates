// The stage of the Maths course (maths-ch*.js) on the course sheet (course.js): what a step shows and what it asks.
// Widgets, by `w.kind`:
//   formula  display maths in TeX (Temml, as the banks do), with an optional note
//   rows     [label, text] pairs; either may carry $TeX$
//   plot     the plane: curves of x and of sliders' parameters, arrows, polygons, circles, points, a tangent, a secant, an area,
//            readouts of expressions, and a goal for the sliders. Vectors, matrices, the unit circle and triangles are all this.
//   riemann  strips under a curve (left, right, middle, trapezium) and how close their sum is to the area
//   taylor   a curve and its polynomial approximation, a degree at a time
//   epsdelta a limit's ε band and the δ band that keeps the curve inside it
// A step may also carry `num` (an answer typed on the stage's own keypad, so no system keyboard covers anything) or `bank`
// (a question from Punt's maths bank, drawn with its maths). Everything a step shows beside the words is data in the lesson;
// answers are judged here from expressions (maths-expr.js), never from a stored key.
import { setRich } from "./rich.js";
import { compile, valueOf } from "./maths-expr.js";
import { nm, simpson, deriv, riemann } from "./maths-math.js";

const NS = "http://www.w3.org/2000/svg";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cache = new Map();
/** An expression (or a number) as a function of a variables object; compiled once. */
const fn = e => { if (typeof e === "number") return () => e; let f = cache.get(e); if (!f) { f = compile(e); cache.set(e, f); } return f; };
const ev = (e, vars) => fn(e)(vars);
const pt = (p, vars) => [ev(p[0], vars), ev(p[1], vars)];
const piLabel = k => (k === 0 ? "0" : k % 2 === 0 ? `${k / 2 === 1 ? "" : k / 2 === -1 ? "−" : k / 2}π` : `${k === 1 ? "" : k === -1 ? "−" : k}π/2`);

function niceStep(span) {
  const raw = span / 6, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

// ---------- the plane ----------
/** The picture of a plot widget for the parameter values `vars`, in a box W × H pixels. */
function planeSvg(w, vars, W, H) {
  let [x0, x1, y0, y1] = w.win || [-6, 6, -4, 4];
  if (w.eq) {                                              // equal scales: widen whichever range the box has room for
    const kx = W / (x1 - x0), ky = H / (y1 - y0), k = Math.min(kx, ky), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - W / k / 2; x1 = cx + W / k / 2; y0 = cy - H / k / 2; y1 = cy + H / k / 2;
  }
  const X = x => ((x - x0) / (x1 - x0)) * W, Y = y => H - ((y - y0) / (y1 - y0)) * H;
  const o = [];
  const sx = niceStep(x1 - x0), sy = niceStep(y1 - y0), piMode = !!w.pi, stepX = piMode ? Math.PI / 2 : sx;
  // grid and labels
  const g = [], lab = [];
  for (let k = Math.ceil(x0 / stepX - 1e-9); k * stepX <= x1 + 1e-9; k++) {
    const v = k * stepX, px = X(v);
    g.push(`M${px.toFixed(1)} 0V${H}`);
    if (k !== 0 && !w.bare) lab.push(`<text class="mx-tk" x="${(px + 3).toFixed(1)}" y="${Math.min(H - 3, Math.max(11, Y(0) + 12)).toFixed(1)}">${piMode ? piLabel(k) : nm(v, 3)}</text>`);
  }
  for (let k = Math.ceil(y0 / sy - 1e-9); k * sy <= y1 + 1e-9; k++) {
    const v = k * sy, py = Y(v);
    g.push(`M0 ${py.toFixed(1)}H${W}`);
    if (k !== 0 && !w.bare) lab.push(`<text class="mx-tk" x="${Math.min(W - 24, Math.max(3, X(0) + 4)).toFixed(1)}" y="${(py - 3).toFixed(1)}">${nm(v, 3)}</text>`);
  }
  o.push(`<path class="mx-grid" d="${g.join("")}"/>`);
  if (y0 < 0 && y1 > 0) o.push(`<path class="mx-axis" d="M0 ${Y(0).toFixed(1)}H${W}"/>`);
  if (x0 < 0 && x1 > 0) o.push(`<path class="mx-axis" d="M${X(0).toFixed(1)} 0V${H}"/>`);
  o.push(lab.join(""));
  // an area under the first curve
  if (w.shade) {
    const f = fn(w.fns[w.shade.fn || 0].e), a = ev(w.shade.a, vars), b = ev(w.shade.b, vars), n = 80, pts = [];
    if (b > a) {
      for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n, y = f({ ...vars, x }); pts.push(`${X(x).toFixed(1)} ${Y(Number.isFinite(y) ? y : 0).toFixed(1)}`); }
      o.push(`<path class="mx-area" d="M${X(a).toFixed(1)} ${Y(0).toFixed(1)}L${pts.join("L")}L${X(b).toFixed(1)} ${Y(0).toFixed(1)}Z"/>`);
    }
  }
  for (const s of w.polys || []) o.push(`<path class="mx-poly ${s.k || "a"}" d="M${s.pts.map(p => pt(p, vars)).map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join("L")}Z"/>`);
  for (const c of w.circs || []) { const [cx, cy] = pt(c.c, vars), r = ev(c.r, vars); o.push(`<ellipse class="mx-circ ${c.k || "c"}" cx="${X(cx).toFixed(1)}" cy="${Y(cy).toFixed(1)}" rx="${(Math.abs(r) * W / (x1 - x0)).toFixed(1)}" ry="${(Math.abs(r) * H / (y1 - y0)).toFixed(1)}"/>`); }
  // curves, broken where they jump (a pole) or leave the number line
  (w.fns || []).forEach((cv, i) => {
    const f = fn(cv.e), from = cv.from != null ? ev(cv.from, vars) : x0, to = cv.to != null ? ev(cv.to, vars) : x1, n = Math.max(60, Math.round(W)), parts = [];
    let pen = false, prev = null;
    for (let j = 0; j <= n; j++) {
      const x = x0 + ((x1 - x0) * j) / n;
      if (x < from - 1e-12 || x > to + 1e-12) { pen = false; prev = null; continue; }
      const y = f({ ...vars, x });
      if (!Number.isFinite(y) || Math.abs(y) > 1e6 || (prev != null && Math.abs(y - prev) > (y1 - y0) * 1.2 && cv.jump !== false)) { pen = false; prev = Number.isFinite(y) && Math.abs(y) <= 1e6 ? y : null; if (prev != null) { parts.push(`M${X(x).toFixed(1)} ${Y(y).toFixed(1)}`); pen = true; } continue; }
      parts.push(`${pen ? "L" : "M"}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`); pen = true; prev = y;
    }
    o.push(`<path class="mx-fn ${cv.k || (i === 0 ? "a" : i === 1 ? "b" : "c")}${cv.dash ? " dash" : ""}" d="${parts.join("")}"/>`);
  });
  for (const l of w.lines || []) { const [ax, ay] = pt(l.a, vars), [bx, by] = pt(l.b, vars); o.push(`<path class="mx-line ${l.k || "c"}" d="M${X(ax).toFixed(1)} ${Y(ay).toFixed(1)}L${X(bx).toFixed(1)} ${Y(by).toFixed(1)}"/>`); }
  // a tangent and a secant on the first curve
  const f0 = w.fns?.[0] && fn(w.fns[0].e), F0 = x => f0({ ...vars, x }), extra = [];
  if (w.tangent) {
    const t = ev(w.tangent.at, vars), m = deriv(F0, t, 1e-4), y = F0(t);
    o.push(`<path class="mx-line b" d="M${X(x0).toFixed(1)} ${Y(y + m * (x0 - t)).toFixed(1)}L${X(x1).toFixed(1)} ${Y(y + m * (x1 - t)).toFixed(1)}"/><circle class="mx-dot b" cx="${X(t).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="4.5"/>`);
    extra.push(["gradient", m]);
  }
  if (w.secant) {
    const t = ev(w.secant.at, vars), h = ev(w.secant.h, vars), ya = F0(t), yb = F0(t + h), m = (yb - ya) / h;
    o.push(`<path class="mx-line b" d="M${X(x0).toFixed(1)} ${Y(ya + m * (x0 - t)).toFixed(1)}L${X(x1).toFixed(1)} ${Y(ya + m * (x1 - t)).toFixed(1)}"/><circle class="mx-dot b" cx="${X(t).toFixed(1)}" cy="${Y(ya).toFixed(1)}" r="4.5"/><circle class="mx-dot b" cx="${X(t + h).toFixed(1)}" cy="${Y(yb).toFixed(1)}" r="4.5"/>`);
    extra.push(["gradient", m]);
  }
  for (const a of w.arrows || []) {
    const [fx, fy] = pt(a.from || [0, 0], vars), [tx, ty] = pt(a.to, vars), ax = X(fx), ay = Y(fy), bx = X(tx), by = Y(ty), len = Math.hypot(bx - ax, by - ay);
    if (len < 1) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len, hd = Math.min(10, len / 2);
    o.push(`<path class="mx-line ${a.k || "a"}" d="M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}"/><path class="mx-head ${a.k || "a"}" d="M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx - hd * ux + hd * 0.45 * uy).toFixed(1)} ${(by - hd * uy - hd * 0.45 * ux).toFixed(1)}L${(bx - hd * ux - hd * 0.45 * uy).toFixed(1)} ${(by - hd * uy + hd * 0.45 * ux).toFixed(1)}Z"/>`);
    if (a.label) o.push(`<text class="mx-lb ${a.k || "a"}" x="${(bx + 6 * (ux >= 0 ? 1 : -2)).toFixed(1)}" y="${(by - 6 * (uy >= 0 ? -1 : 1)).toFixed(1)}">${esc(a.label)}</text>`);
  }
  for (const p of w.pts || []) {
    const [x, y] = pt(p.p, vars);
    o.push(`<circle class="mx-dot ${p.k || "c"}${p.open ? " open" : ""}" cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="4.5"/>`);
    if (p.label) o.push(`<text class="mx-lb ${p.k || "c"}" x="${(X(x) + 7).toFixed(1)}" y="${(Y(y) - 7).toFixed(1)}">${esc(p.label)}</text>`);
  }
  for (const t of w.texts || []) { const [x, y] = pt(t.p, vars); o.push(`<text class="mx-lb ${t.k || "c"}" x="${X(x).toFixed(1)}" y="${Y(y).toFixed(1)}" text-anchor="${t.anchor || "start"}">${esc(t.s)}</text>`); }
  return { svg: `<svg class="mx-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(w.alt || "graph")}">${o.join("")}</svg>`, extra };
}

const sliderHtml = (name, p, v) => `<label class="mx-sl"><span>${esc(p.label || name)}</span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" data-p="${name}" aria-label="${esc(p.label || name)}"><b data-pv="${name}"></b></label>`;
const fmtP = (p, v) => nm(v, p.step < 0.01 ? 3 : p.step < 0.1 ? 2 : p.step < 1 ? 1 : 0);

/** Whether the sliders sit where the goal says. */
function planeGoal(w, vars) {
  const g = w.goal;
  if (!g) return true;
  if (g.p) return Object.entries(g.p).every(([k, v]) => Math.abs(vars[k] - v) <= (g.tol ?? w.params[k].step * 1.01));
  return Math.abs(ev(g.e, vars) - g.v) <= (g.tol ?? 0.05);
}

// ---------- the stage ----------
export function mathsStage() {
  let box = null, api = null, bank = null;
  const loadBank = () => (bank ||= import("./maths-bank.js").then(m => m.MATHS));

  const task = s => !!(s.num || s.bank || s.w?.goal);
  const ws = st => (st.ws ||= {});

  /** Display maths into an element. */
  const tex = (el, t) => setRich(el, `$$${t}$$`);

  // ----- the widgets: each fills `host` and keeps its state in st.ws -----
  function planeWidget(host, w, st) {
    const S = ws(st);
    S.p ||= Object.fromEntries(Object.entries(w.params || {}).map(([k, p]) => [k, p.v ?? p.min]));
    host.innerHTML = `<div class="mx-fig"></div><p class="mx-read" aria-live="polite"></p>${Object.entries(w.params || {}).map(([k, p]) => sliderHtml(k, p, S.p[k])).join("")}`;
    const fig = host.querySelector(".mx-fig"), read = host.querySelector(".mx-read");
    const paint = () => {
      const r = fig.getBoundingClientRect(), W = Math.max(120, Math.round(r.width) || 300), H = Math.max(90, Math.round(r.height) || 200), vars = { ...S.p };
      const { svg, extra } = planeSvg(w, vars, W, H);
      fig.innerHTML = svg;
      const bits = [...(w.read || []).map(([label, e, d = 2]) => `${esc(label)} <b>${nm(ev(e, vars), d)}</b>`), ...extra.map(([l, v]) => `${l} <b>${nm(v, 3)}</b>`)];
      if (w.shade) { const a = ev(w.shade.a, vars), b = ev(w.shade.b, vars), f = fn(w.fns[w.shade.fn || 0].e); bits.push(`area <b>${nm(simpson(x => f({ ...vars, x }), a, b), 3)}</b>`); }
      read.innerHTML = bits.join(" · ");
      for (const [k, p] of Object.entries(w.params || {})) host.querySelector(`[data-pv="${k}"]`).textContent = fmtP(p, S.p[k]);
    };
    host.addEventListener("input", e => {
      const k = e.target.dataset?.p;
      if (!k) return;
      S.p[k] = Number(e.target.value); S.moved = true;
      paint();
    });
    host.addEventListener("change", () => api.changed());
    paint();
  }

  function riemannWidget(host, w, st) {
    const S = ws(st);
    S.n ??= w.n?.v ?? 4; S.how ??= w.how || "left";
    const f = fn(w.f), F = x => f({ x }), exact = simpson(F, w.a, w.b);
    const HOWS = [["left", "Left"], ["right", "Right"], ["mid", "Middle"], ["trap", "Trapezium"]];
    host.innerHTML = `<div class="mx-fig"></div><p class="mx-read" aria-live="polite"></p>
      <div class="mx-chips">${(w.hows || ["left", "right", "mid", "trap"]).map(h => `<button type="button" class="mx-chip${S.how === h ? " sel" : ""}" data-how="${h}">${HOWS.find(x => x[0] === h)[1]}</button>`).join("")}</div>
      <label class="mx-sl"><span>strips</span><input type="range" min="${w.n?.min ?? 1}" max="${w.n?.max ?? 60}" step="1" value="${S.n}" data-n aria-label="strips"><b data-nv></b></label>`;
    const fig = host.querySelector(".mx-fig"), read = host.querySelector(".mx-read");
    const paint = () => {
      const r = fig.getBoundingClientRect(), W = Math.max(120, Math.round(r.width) || 300), H = Math.max(90, Math.round(r.height) || 200);
      const [x0, x1, y0, y1] = w.win, X = x => ((x - x0) / (x1 - x0)) * W, Y = y => H - ((y - y0) / (y1 - y0)) * H, h = (w.b - w.a) / S.n, bars = [];
      for (let i = 0; i < S.n; i++) {
        const a = w.a + i * h, b = a + h;
        if (S.how === "trap") bars.push(`<path class="mx-bar" d="M${X(a).toFixed(1)} ${Y(0).toFixed(1)}L${X(a).toFixed(1)} ${Y(F(a)).toFixed(1)}L${X(b).toFixed(1)} ${Y(F(b)).toFixed(1)}L${X(b).toFixed(1)} ${Y(0).toFixed(1)}Z"/>`);
        else { const yv = S.how === "left" ? F(a) : S.how === "right" ? F(b) : F((a + b) / 2); bars.push(`<rect class="mx-bar" x="${X(a).toFixed(1)}" y="${Math.min(Y(yv), Y(0)).toFixed(1)}" width="${(X(b) - X(a)).toFixed(1)}" height="${Math.abs(Y(yv) - Y(0)).toFixed(1)}"/>`); }
      }
      const { svg } = planeSvg({ win: w.win, fns: [{ e: w.f }] }, {}, W, H);
      fig.innerHTML = svg.replace(/(<path class="mx-fn)/, `${bars.join("")}$1`);
      const sum = riemann(F, w.a, w.b, S.n, S.how), err = exact ? (sum - exact) / exact : 0;
      read.innerHTML = `${S.n} strips · sum <b>${nm(sum, 4)}</b> · area <b>${nm(exact, 4)}</b> · off by <b>${nm(100 * err, 2)}%</b>`;
      host.querySelector("[data-nv]").textContent = S.n;
      S.err = Math.abs(err);
    };
    host.addEventListener("input", e => { if (e.target.matches("[data-n]")) { S.n = Number(e.target.value); S.moved = true; paint(); } });
    host.addEventListener("change", () => api.changed());
    host.addEventListener("click", e => { const b = e.target.closest("[data-how]"); if (b) { S.how = b.dataset.how; S.moved = true; api.changed(); } });
    paint();
  }

  function taylorWidget(host, w, st) {
    const S = ws(st);
    S.deg ??= w.deg?.v ?? 1;
    const f = fn(w.f), P = (x, n) => { let s = 0; for (let k = 0; k <= n; k++) s += (w.c[k] || 0) * x ** k; return s; };
    host.innerHTML = `<div class="mx-fig"></div><p class="mx-read" aria-live="polite"></p>
      <div class="mx-step"><button type="button" class="mx-chip" data-d="-1" aria-label="lower degree">−</button><span>degree <b data-dv></b></span><button type="button" class="mx-chip" data-d="1" aria-label="higher degree">+</button></div>`;
    const fig = host.querySelector(".mx-fig"), read = host.querySelector(".mx-read");
    const r = fig.getBoundingClientRect(), W = Math.max(120, Math.round(r.width) || 300), H = Math.max(90, Math.round(r.height) || 200);
    const poly = Array.from({ length: S.deg + 1 }, (_, k) => w.c[k] || 0);
    const pe = poly.map((c, k) => `${c}*x^${k}`).join("+");
    const { svg } = planeSvg({ win: w.win, fns: [{ e: w.f }, { e: pe, k: "b" }], pts: [{ p: [w.at, w.f.includes("x") ? ev(w.f, { x: w.at }) : 0], k: "c" }], pi: w.pi }, {}, W, H);
    fig.innerHTML = svg;
    const fa = ev(w.f, { x: w.at }), pa = P(w.at, S.deg);
    S.err = Math.abs(fa - pa);
    read.innerHTML = `at x = ${nm(w.at, 2)}: function <b>${nm(fa, 5)}</b> · polynomial <b>${nm(pa, 5)}</b> · error <b>${S.err < 1e-5 ? "under 0.00001" : nm(S.err, 5)}</b>`;
    host.querySelector("[data-dv]").textContent = S.deg;
    host.addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (!b) return; S.deg = Math.max(0, Math.min(w.deg?.max ?? 8, S.deg + Number(b.dataset.d))); S.moved = true; api.changed(); });
  }

  /** The biggest δ for which every x within δ of a stays within ε of L, by search over the window. */
  function bestDelta(w) {
    const f = fn(w.f), F = x => f({ x }), holds = d => { for (let i = 0; i <= 200; i++) { const x = w.a - d + (2 * d * i) / 200; if (Math.abs(x - w.a) < 1e-12) continue; if (!(Math.abs(F(x) - w.L) < w.eps)) return false; } return true; };
    let lo = 0, hi = w.dmax || 2;
    if (holds(hi)) return hi;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (holds(m)) lo = m; else hi = m; }
    return lo;
  }
  function epsdeltaWidget(host, w, st) {
    const S = ws(st);
    S.delta ??= w.delta0 ?? (w.dmax || 2) / 2;
    host.innerHTML = `<div class="mx-fig"></div><p class="mx-read" aria-live="polite"></p>${sliderHtml("delta", { label: "δ", min: 0.01, max: w.dmax || 2, step: 0.01 }, S.delta)}`;
    const fig = host.querySelector(".mx-fig"), read = host.querySelector(".mx-read");
    const f = fn(w.f), F = x => f({ x });
    const paint = () => {
      const r = fig.getBoundingClientRect(), W = Math.max(120, Math.round(r.width) || 300), H = Math.max(90, Math.round(r.height) || 200), [x0, x1, y0, y1] = w.win;
      const X = x => ((x - x0) / (x1 - x0)) * W, Y = y => H - ((y - y0) / (y1 - y0)) * H;
      const { svg } = planeSvg({ win: w.win, fns: [{ e: w.f, jump: false }], pts: [{ p: [w.a, w.L], k: "b", open: w.open }] }, {}, W, H);
      let bad = null;
      for (let i = 0; i <= 200; i++) { const x = w.a - S.delta + (2 * S.delta * i) / 200; if (Math.abs(x - w.a) < 1e-12) continue; if (!(Math.abs(F(x) - w.L) < w.eps)) { bad = x; break; } }
      S.holds = bad == null;
      const bands = `<rect class="mx-band y" x="0" y="${Y(w.L + w.eps).toFixed(1)}" width="${W}" height="${(Y(w.L - w.eps) - Y(w.L + w.eps)).toFixed(1)}"/><rect class="mx-band x ${S.holds ? "ok" : "no"}" x="${X(w.a - S.delta).toFixed(1)}" y="0" width="${(X(w.a + S.delta) - X(w.a - S.delta)).toFixed(1)}" height="${H}"/>`;
      fig.innerHTML = svg.replace(/(<path class="mx-grid")/, `${bands}$1`);
      read.innerHTML = `ε = <b>${nm(w.eps, 3)}</b> · δ = <b>${nm(S.delta, 2)}</b> · ${S.holds ? "every x within δ of " + nm(w.a, 2) + " keeps f within ε of " + nm(w.L, 2) : "f escapes the band at x = " + nm(bad, 2)}`;
      host.querySelector('[data-pv="delta"]').textContent = nm(S.delta, 2);
    };
    host.addEventListener("input", e => { if (e.target.dataset?.p === "delta") { S.delta = Number(e.target.value); S.moved = true; paint(); } });
    host.addEventListener("change", () => api.changed());
    paint();
  }

  // ----- a typed answer on the stage's keypad -----
  const KEYS = ["7", "8", "9", "⌫", "4", "5", "6", "−", "1", "2", "3", "/", "0", ".", "π", "√"];
  function numWidget(host, s, st) {
    const S = ws(st);
    S.text ??= "";
    const n = s.num;
    host.innerHTML = `<div class="mx-out" aria-live="polite">${n.pre ? `<i>${esc(n.pre)}</i>` : ""}<b>${esc(S.text) || "<span class='mx-ph'>type the answer</span>"}</b>${n.unit ? `<i>${esc(n.unit)}</i>` : ""}</div>
      ${st.hint ? `<p class="mx-read">The answer is <b>${esc(n.show || nm(valueOf(n.ans), 4))}</b>. Type it in.</p>` : ""}
      <div class="mx-keys">${KEYS.map(k => `<button type="button" class="mx-key${k === "⌫" ? " del" : ""}" data-key="${k}" aria-label="${k === "⌫" ? "delete" : k}">${k}</button>`).join("")}</div>`;
    host.addEventListener("click", e => {
      const b = e.target.closest("[data-key]");
      if (!b || st.done) return;
      const k = b.dataset.key;
      S.text = k === "⌫" ? S.text.slice(0, -1) : (S.text + k).slice(0, 18);
      api.changed();
    });
  }
  function judgeNum(s, st) {
    const S = ws(st), n = s.num, got = valueOf(S.text), want = valueOf(n.ans);
    if (!Number.isFinite(got)) return { ok: false, why: "That is not a number yet: digits, a point, / for a fraction, π and √ are allowed." };
    const tol = n.tol ?? Math.max(3e-3 * Math.abs(want), 1e-9);
    if (Math.abs(got - want) <= tol) return { ok: true, msg: s.why || "Right." };
    if (Math.abs(Math.abs(got) - Math.abs(want)) <= tol) return { ok: false, why: "Right size, wrong sign." };
    return { ok: false, why: n.miss || "Not that. Check the working once more." };
  }

  // ----- a question from Punt's maths bank -----
  function bankWidget(host, s, st) {
    const S = ws(st);
    host.innerHTML = `<div class="mx-bank"><div class="mx-q" data-q>…</div><div class="mx-opts" data-o></div><div class="mx-x" data-x></div></div>`;
    loadBank().then(all => {
      if (!host.isConnected) return;
      const q = all.find(x => x.id === s.bank);
      if (!q) { host.querySelector("[data-q]").textContent = "That question is not in the bank."; return; }
      setRich(host.querySelector("[data-q]"), q.q);
      const o = host.querySelector("[data-o]");
      q.o.forEach((text, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = `mx-opt${S.picked === i ? (q.a.includes(i) ? " ok" : " no") : ""}${(st.done || S.hint) && q.a.includes(i) ? " ok" : ""}`; b.disabled = !!st.done;
        setRich(b, text);
        b.addEventListener("click", () => {
          if (st.done) return;
          S.picked = i;
          if (q.a.includes(i)) { S.why = q.x; api.answer({ ok: true, msg: "Right." }); }
          else api.answer({ ok: false, why: "Not that: try again." });
        });
        o.appendChild(b);
      });
      if (st.done || S.why) setRich(host.querySelector("[data-x]"), S.why || q.x);
    });
  }

  return {
    mount(el, a) { box = el; api = a; },
    task,
    submits: s => !!(s.num || s.w?.goal),
    submit(s, st) {
      if (s.num) return judgeNum(s, st);
      const S = ws(st), w = s.w;
      if (w.kind === "riemann") return S.err <= w.goal.err ? { ok: true, msg: s.why || "Right." } : { ok: false, why: `Still ${nm(100 * S.err, 1)}% off: more strips, or a better rule.` };
      if (w.kind === "taylor") return S.err <= w.goal.err ? { ok: true, msg: s.why || "Right." } : { ok: false, why: "Still too far off at that point: add terms." };
      if (w.kind === "epsdelta") {
        if (!S.holds) return { ok: false, why: "The curve still leaves the horizontal band inside your δ: narrow it." };
        return S.delta >= 0.5 * bestDelta(w) ? { ok: true, msg: s.why || "Right." } : { ok: false, why: "That works, but it is needlessly tiny: find a δ close to the largest that works." };
      }
      return planeGoal(w, { ...S.p }) ? { ok: true, msg: s.why || "Right." } : { ok: false, why: w.goal.miss || "Not yet: the picture does not match what was asked." };
    },
    ready: (s, st) => (s.num ? !!ws(st).text : true),
    label: () => "Check",
    hint(s, st) {
      const S = ws(st), w = s.w;
      if (!w) return;
      if (w.goal?.p) S.p = { ...S.p, ...w.goal.p };
      else if (w.goal?.e) {                               // an expression to reach: the nearest slider position, by search
        const [k, p] = Object.entries(w.params)[0];
        let best = Infinity;
        for (let v = p.min; v <= p.max + 1e-9; v += p.step) { const d = Math.abs(ev(w.goal.e, { ...S.p, [k]: v }) - w.goal.v); if (d < best) { best = d; S.p = { ...S.p, [k]: Math.round(v / p.step) * p.step }; } }
      }
      if (w.kind === "riemann") S.n = w.goal.show ?? w.n?.max ?? 60;
      if (w.kind === "taylor") S.deg = w.goal.show ?? w.deg?.max ?? 8;
      if (w.kind === "epsdelta") S.delta = Math.max(0.01, Math.round(bestDelta(w) * 90) / 100);
    },
    draw(s, st) {
      box.replaceChildren();
      const root = document.createElement("div");
      root.className = "mx";
      box.appendChild(root);
      if (s.bank) { bankWidget(root, s, st); return; }
      const w = s.w;
      if (w?.tex) { const t = document.createElement("div"); t.className = "mx-tex"; root.appendChild(t); tex(t, w.tex); }
      if (w?.kind === "formula") { const t = root.querySelector(".mx-tex"); t.classList.add("big"); if (w.note) { const n = document.createElement("p"); n.className = "mx-note"; n.textContent = w.note; root.appendChild(n); } }
      else if (w?.kind === "rows") {
        const tbl = document.createElement("table"); tbl.className = "mx-rows";
        for (const [a, b] of w.rows) { const tr = tbl.insertRow(), th = document.createElement("th"); tr.append(th); setRich(th, a); setRich(tr.insertCell(), b); }
        root.appendChild(tbl);
      } else if (w) {
        const host = document.createElement("div");
        host.className = "mx-host";
        root.appendChild(host);
        ({ plot: planeWidget, riemann: riemannWidget, taylor: taylorWidget, epsdelta: epsdeltaWidget })[w.kind]?.(host, w, st);
      }
      if (s.num) { const host = document.createElement("div"); host.className = "mx-host num"; root.appendChild(host); numWidget(host, s, st); }
    },
  };
}
