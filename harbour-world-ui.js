// Harbour's world screen: the forward curve, ARA against Muuga, and the desk's cargoes on it as arrows from the day an MR
// lifts at your export terminal to the day it lands at your import terminal. Tap a day to fix a cargo for the MR picked.
// Under the chart: what each cargo really did once both regions played their months with it, and the three books with
// their sum. The month itself comes from harbour-world.js.
import { cargo, connect, pars } from "./harbour-world.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = v => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(1)}k`;
const MR = ["#2F6F9F", "#B8742A"];

/** regionPlan(id): a region's saved plan (with its feed); openRegion(id): go to a region. */
export function createWorldScreen({ root, brief, regionPlan, openRegion }) {
  let W = null, plan = null, mine = null, ship = 0, hover = -1, hints = false, viewing = null, P = null, month = null;
  const planKey = () => `harbour:v2:world:${W.id}:plan`, bestKey = () => `harbour:v2:world:${W.id}:best`;
  function chart() {
    const N = W.muuga.length, x0 = 46, x1 = 624, y0 = 26, y1 = 226, all = [...W.ara, ...W.muuga], Hh = hints ? 292 : 252;
    const lo = Math.min(...all) - .03, hi = Math.max(...all) + .03, X = d => x0 + (d / (N - 1)) * (x1 - x0), Y = v => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
    const line = (arr, cls) => `<polyline class="${cls}" points="${arr.map((v, d) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
    const arrow = (c, cls, col, below) => `<g class="${cls}"><line x1="${X(c.load)}" y1="${Y(c.buy)}" x2="${X(c.sell)}" y2="${Y(c.price)}" stroke="${col}" marker-end="url(#hwArr)"/><circle cx="${X(c.load)}" cy="${Y(c.buy)}" r="3.5" fill="${col}"/><text class="hw-lab${c.margin < 0 ? " neg" : ""}" x="${(X(c.load) + X(c.sell)) / 2 + (below ? 16 : 0)}" y="${below ? (Y(c.buy) + Y(c.price)) / 2 + 16 : Math.min(Y(c.buy), Y(c.price)) - 7}">${money(c.margin)}</text></g>`;
    let s = `<svg class="hw-chart" viewBox="0 0 640 ${Hh}" role="img" aria-label="The forward curve: ARA and Muuga, day by day"><defs><marker id="hwArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.6"/></marker></defs>`;
    s += `<rect class="hw-month" x="${X(0) - 6}" y="${y0 - 8}" width="${X(W.days - 1) - X(0) + 12}" height="${y1 - y0 + 16}"/>`;
    for (let d = 0; d < N; d += 7) s += `<line class="hw-grid" x1="${X(d)}" y1="${y0 - 8}" x2="${X(d)}" y2="${y1 + 8}"/><text class="hw-ax" x="${X(d)}" y="${y1 + 22}">day ${d + 1}</text>`;
    s += line(W.ara, "hw-ara") + line(W.muuga, "hw-muu") + `<text class="hw-key ara" x="${x1}" y="${Y(W.ara[N - 1]) + 16}">ARA</text><text class="hw-key muu" x="${x1}" y="${Y(W.muuga[N - 1]) - 8}">Muuga</text>`;
    for (const c of month.desk.cargoes) s += arrow(c, "hw-cargo", MR[c.ship], c.ship === 1);
    if (hover >= 0 && !month.desk.cargoes.some(c => c.load === hover)) s += arrow(cargo(W, hover), "hw-preview", MR[ship], false);
    if (hints) for (let d = 0; d < W.days; d++) { const m = cargo(W, d).margin, h = Math.min(22, Math.abs(m) * 1.4); s += `<rect class="${m < 0 ? "hw-neg" : "hw-pos"}" x="${X(d) - 5}" y="${m < 0 ? 266 : 266 - h}" width="10" height="${h}"/>`; }
    for (let d = 0; d < W.days; d++) s += `<rect class="hw-hit" data-day="${d}" x="${X(d) - (X(1) - X(0)) / 2}" y="0" width="${X(1) - X(0)}" height="${Hh}"/>`;
    return s + `</svg>`;
  }
  function draw() {
    month = connect(W, plan, regionPlan);
    if (!viewing && !month.desk.errors.length) { const b = read(bestKey(), {}); if (b.desk == null || month.desk.profit > b.desk) b.desk = month.desk.profit; if (b.total == null || month.total > b.total) b.total = month.total; write(bestKey(), b); }
    const d = month.desk, edit = !viewing;
    const ships = plan.ships.map((days, i) => `<button type="button" class="hw-mr${ship === i ? " on" : ""}" data-mr="${i}" style="--c:${MR[i]}">MR ${i + 1}: ${days.length} cargo${days.length === 1 ? "" : "es"}</button>`).join("");
    const rows = month.cargoes.map(c => { const l = c.landed, short = c.units < W.cargo - 1e-9; return `<tr><td><i class="hw-dot" style="background:${MR[c.ship]}"></i>MR ${c.ship + 1}</td><td>day ${c.load + 1} → ${c.sell + 1}</td><td class="${short ? "hw-bad" : ""}">lifted ${c.units} of ${W.cargo}</td><td class="${l && l.waited > 12 ? "hw-bad" : ""}">${l ? (l.end >= 0 ? `landed by day ${Math.floor(l.end / 24) + 1}${l.waited ? `, ${l.waited} h waiting for room` : ""}` : `${l.delivered} of ${c.units} in by month's end`) : ""}</td><td class="num">${money(c.margin)}</td></tr>`; }).join("");
    const book = (name, v, id) => `<tr><th>${name}</th><td class="num">${money(v)}</td><td>${id ? `<button type="button" class="hw-go" data-region="${id}">Open</button>` : ""}</td></tr>`;
    brief.textContent = W.brief;
    root.innerHTML = `<p class="hs-viewing"${viewing ? "" : " hidden"}>Watching the desk's par plan. <button type="button" class="hb-mine" data-mine="1">Back to your plan</button></p>
      <div class="hw-bar">${ships}${edit ? `<label class="hw-check"><input type="checkbox" data-two ${plan.ships.length > 1 ? "checked" : ""}> A second MR</label>` : ""}<label class="hw-check"><input type="checkbox" data-hints ${hints ? "checked" : ""}> What each day's cargo makes</label></div>
      ${chart()}
      <p class="hw-hint">${edit ? "Tap a day to fix a cargo for the MR picked, or tap its dot to drop it." : ""} A round takes ${W.turn} days; ARA sells one cargo a day; $${W.costs}k a voyage; hire $${W.hire}k a day an MR.</p>
      ${d.errors.length ? `<p class="hw-bad">${d.errors.map(esc).join("<br>")}</p>` : ""}
      ${rows ? `<table class="hs-ledger hw-cargoes"><tbody>${rows}</tbody></table>` : `<p class="hs-soft">No cargoes fixed yet.</p>`}
      <table class="hs-ledger hw-books"><caption>The month across the company</caption><tbody>${book("Your export terminal (Maasvlakte)", month.from.profit, W.from.region)}${book(`The desk: cargoes ${money(d.made)}, hire ${money(-d.hire)}`, d.profit)}${book("Your terminal (Muuga)", month.to.profit, W.to.region)}<tr class="total"><th>The company</th><td class="num">${money(month.total)}</td><td></td></tr></tbody></table>
      <p class="hs-soft">Desk par ${money(P.profit.ev.profit)} with ${P.profit.ev.ships} MRs; each region plays its own plan with these cargoes, so a region left as it was may not want them: re-plan it to take them.</p>`;
  }
  const redraw = () => { const c = root.querySelector(".hw-chart"); if (c) c.outerHTML = chart(); };
  function changed() { if (viewing) return; mine = plan; write(planKey(), mine); draw(); }
  root.addEventListener("pointermove", e => { if (!W) return; const t = e.target.closest?.(".hw-hit"), d = t ? +t.dataset.day : -1; if (d !== hover) { hover = d; redraw(); } });
  root.addEventListener("click", e => {
    if (!W) return;
    const t = e.target.closest(".hw-hit"), b = e.target.closest("button");
    if (t && !viewing) {
      const d = +t.dataset.day, k = plan.ships[ship].indexOf(d), other = plan.ships.findIndex((s, i) => i !== ship && s.includes(d));
      if (k >= 0) plan.ships[ship].splice(k, 1); else if (other >= 0) plan.ships[other].splice(plan.ships[other].indexOf(d), 1); else plan.ships[ship].push(d);
      changed(); return;
    }
    if (!b) return;
    if (b.dataset.mr) { ship = +b.dataset.mr; draw(); }
    else if (b.dataset.region) openRegion(b.dataset.region);
    else if (b.dataset.mine) { viewing = null; plan = mine; draw(); }
  });
  root.addEventListener("change", e => {
    if (!W) return;
    if (e.target.dataset.two !== undefined) { plan.ships = e.target.checked ? [plan.ships[0], []] : [plan.ships[0]]; ship = 0; changed(); }
    if (e.target.dataset.hints !== undefined) { hints = e.target.checked; redraw(); }
  });
  return {
    open(world) { W = world; P = pars(W); viewing = null; ship = 0; hover = -1; mine = read(planKey(), null) || { ships: [[]] }; plan = mine; root.hidden = false; root.scrollTop = 0; draw(); },
    close() { W = null; root.hidden = true; root.innerHTML = ""; },
    active: () => W,
    clear() { if (!W) return; viewing = null; plan = mine = { ships: plan.ships.map(() => []) }; changed(); },
    view(k) { viewing = k; plan = JSON.parse(JSON.stringify(P[k === "lean" ? "lean" : "profit"].plan)); draw(); },
    /** The menu's table: the desk's best against its par, and the company's best month. */
    menuTable() {
      const b = read(bestKey(), {}), t = document.createElement("table");
      t.className = "hb-bests";
      t.innerHTML = `<thead><tr><th>${esc(W.name)}</th><th>Your best</th><th>Par</th></tr></thead><tbody><tr><th>The desk</th><td>${b.desk != null ? money(b.desk) : "–"}</td><td><button type="button" class="hb-par" data-k="profit" aria-label="Watch the desk's par plan">${money(P.profit.ev.profit)}</button></td></tr><tr><th>The company</th><td>${b.total != null ? money(b.total) : "–"}</td><td>–</td></tr></tbody>`;
      return t;
    },
  };
}
