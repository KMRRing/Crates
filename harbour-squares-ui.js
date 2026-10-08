// Harbour's region screen on squares: the region's map (coasts, the networks the player builds, places with their tanks,
// vehicles on their way), the build tools (drag across squares), a card for each vehicle and pipeline flow, the month
// played back with the ledger, and what the player's plan for the feeding harbour (Rundown) is worth here, with a way
// back to it. The month itself comes from harbour-squares.js and is worked out the moment anything changes.
import { WATER, LAND, terrain, placesOf, route, simulate, feedOf } from "./harbour-squares.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = v => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(1)}k`;
const S = 22, SPEEDS = [8, 32, 128], LAST = 96;                       // a square's size; hours a second; the latest first hour
const COLORS = ["#2F6F9F", "#B8742A", "#3D8B5A", "#8A4F9E", "#A8443A", "#5E7A2E", "#1F6F9A", "#7A5A12", "#4B5D2E", "#6D3B7A"];
const TOOLS = [["road", "Road"], ["rail", "Rail"], ["pipe", "Pipeline"], ["depot", "Depot"], ["clear", "Bulldoze"]];
const fleetText = ships => Object.entries(ships).map(([t, n]) => `${n} ${t === "handy" ? (n > 1 ? "Handys" : "Handy") : n > 1 ? "coasters" : "coaster"}`).join(" and ");
const ICON = {
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path class="solid" d="M7 5l12 7-12 7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path class="solid" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  end: '<svg viewBox="0 0 24 24"><path class="solid" d="M5 5l9 7-9 7z"/><path d="M18 5v14"/></svg>',
};

/** harbourBest(id): the player's bests for a harbour level; openLevel(id): go to it. */
export function createSquaresScreen({ root, brief, harbourBest, openLevel }) {
  let R = null, T = null, mine = null, plan = null, viewing = null, res = null, tool = "road", now = 0, speed = 0, playing = false, raf = 0, down = false, lastSq = -1;
  const planKey = () => `harbour:v2:squares:${R.id}:plan`, bestKey = () => `harbour:v2:squares:${R.id}:best`;
  const $ = sel => root.querySelector(sel), H = () => R.days * 24;
  const empty = () => ({ built: { road: [], rail: [], pipe: [] }, depots: [], vehicles: [], flows: [] });
  const feed = () => viewing ? plan.feed : feedOf(R, harbourBest(R.feeds));   // your harbour's pace, or the watched plan's

  // ---------- the map ----------
  function map() {
    const { cols, rows } = R.grid, P = placesOf(R, plan), ctr = k => [(k % cols + .5) * S, (Math.floor(k / cols) + .5) * S];
    let s = `<svg class="hs-map" viewBox="0 0 ${cols * S} ${rows * S}" role="img" aria-label="${esc(R.name)}: the map, square by square">`;
    for (let r = 0; r < rows; r++) { let c0 = 0; for (let c = 1; c <= cols; c++) if (c === cols || T[r * cols + c] !== T[r * cols + c0]) { s += `<rect class="hs-t${T[r * cols + c0]}" x="${c0 * S}" y="${r * S}" width="${(c - c0) * S}" height="${S}"/>`; c0 = c; } }
    let grid = ""; for (let c = 0; c <= cols; c++) grid += `M${c * S},0V${rows * S}`; for (let r = 0; r <= rows; r++) grid += `M0,${r * S}H${cols * S}`;
    s += `<path class="hs-grid" d="${grid}"/>`;
    const placeSq = new Set(Object.values(P).map(p => p.at[1] * cols + p.at[0]));
    for (const m of ["road", "rail", "pipe"]) {                                  // each built square joined to its built (or place) neighbours
      const set = new Set(plan.built[m]); let d = "";
      for (const k of set) { const [x, y] = ctr(k); d += `M${x},${y}h.01`; for (const n of [k + 1, k - 1, k + cols, k - cols]) if (n >= 0 && (n === k + 1 ? (k + 1) % cols : n === k - 1 ? k % cols : 1) && (set.has(n) && n > k || placeSq.has(n))) { const [x2, y2] = ctr(n); d += `M${x},${y}L${x2},${y2}`; } }
      if (d) s += `<path class="hs-net ${m}" d="${d}"/>` + (m === "rail" ? `<path class="hs-net sleepers" d="${d}"/>` : "");
    }
    const h = Math.min(Math.floor(now), H() - 1), level = id => res?.rec.tank[id]?.[h] ?? P[id]?.tank?.start ?? 0;
    const gauge = (x, y, id, cap) => { const f = Math.max(0, Math.min(1, level(id) / cap)); return `<g class="hs-gauge${f < .01 && h > 0 ? " dry" : ""}"><rect x="${x}" y="${y}" width="7" height="18" rx="1.5"/><rect class="lvl" x="${x + 1.2}" y="${y + 1.2 + 15.6 * (1 - f)}" width="4.6" height="${15.6 * f}"/></g>`; };
    for (const [id, p] of Object.entries(P)) {
      const [x, y] = ctr(p.at[1] * cols + p.at[0]), name = p.label === "left" ? `<text class="hs-name" x="${x - 10}" y="${y + 4}" style="text-anchor:end">${esc(p.name)}</text>` : `<text class="hs-name" x="${x}" y="${y - 13}">${esc(p.name)}</text>`;
      if (p.kind === "source") s += `<text class="hs-name" x="${x + 4}" y="${y - 9}" style="text-anchor:start">← ${esc(p.name)}, ${p.offmap} h</text>`;
      else if (p.kind === "town") s += `<circle class="hs-town" cx="${x}" cy="${y}" r="6"/>${name}${gauge(x + 9, y - 9, id, p.tank.cap)}`;
      else if (p.kind === "depot") s += `<rect class="hs-depot" x="${x - 7}" y="${y - 7}" width="14" height="14" rx="2"/>${gauge(x + 9, y - 9, id, p.tank.cap)}`;
      else s += `<rect class="hs-term" x="${x - 8}" y="${y - 8}" width="16" height="16" rx="2"/>${name}${gauge(x + 10, y - 9, id, p.tank.cap)}`;
      if (p.domestic) { const f = feed(); s += `<text class="hs-name small" x="${x + 24}" y="${y + 22}" style="text-anchor:start">${f ? `+${(R.round / f.hours).toFixed(2)} an hour from the plant` : "the plant is idle"}</text>`; }
    }
    if (res) plan.vehicles.forEach((v, i) => {
      const st = res.rec.state[i][h]; if (!res.rec.pos[i] || st === 0 || st === 6) return;
      const x = (res.rec.pos[i][h * 2] + .5) * S, y = (res.rec.pos[i][h * 2 + 1] + .5) * S, col = COLORS[i % COLORS.length], off = (i % 3 - 1) * 4, wait = st === 5 ? " waiting" : "";
      s += R.vehicles[v.type].mode === "sea" ? `<g class="hs-veh${wait}" transform="translate(${x + off} ${y + off}) scale(${v.type === "handy" ? 1.5 : 1.1})"><path d="M-7,-3 L4,-3 L8,0 L4,3 L-7,3 Z" style="stroke:${col}"/></g>`
        : `<rect class="hs-veh${wait}" x="${x - (v.type === "train" ? 8 : 5) + off}" y="${y - 4 + off}" width="${v.type === "train" ? 16 : 10}" height="8" rx="1.5" style="fill:${col}"/>`;
    });
    return s + `</svg>`;
  }
  const square = e => { const svg = $(".hs-map"); if (!svg) return -1; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()), { cols, rows } = R.grid, c = Math.floor(q.x / S), r = Math.floor(q.y / S); return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c; };
  function build(k) {                                                           // the tool in hand, on a square tapped or dragged over
    if (viewing || k < 0 || k === lastSq) return; lastSq = k;
    const { cols } = R.grid, P = placesOf(R, plan), isPlace = Object.values(P).some(p => p.at[1] * cols + p.at[0] === k), land = T[k] === LAND && !isPlace, b = plan.built;
    if (tool === "clear") { for (const m of ["road", "rail", "pipe"]) b[m] = b[m].filter(x => x !== k); plan.depots = plan.depots.filter(x => x !== k); }
    else if (tool === "depot") { if (land && !plan.depots.includes(k)) plan.depots.push(k); else return; }
    else if (land && !b[tool].includes(k)) b[tool].push(k); else return;
    changed();
  }

  // ---------- the vehicles and flows ----------
  function cards() {
    const P = placesOf(R, plan), editable = !viewing, n = t => plan.vehicles.filter(v => v.type === t).length;
    const ends = mode => Object.entries(P).filter(([, p]) => mode === "sea" ? p.kind === "source" || p.kind === "terminal" : p.kind !== "source");
    const opt = (list, cur) => list.map(([id, p]) => `<option value="${id}"${id === cur ? " selected" : ""}>${esc(p.name)}${p.kind === "depot" ? ` ${id.slice(5)}` : ""}</option>`).join("");
    const way = (mode, a, b, speedSq) => { const p = route(R, plan, T, mode, a, b); if (!p) return `<span class="hs-bad">no way yet: build ${mode === "pipe" ? "a pipeline" : `a ${mode}`} between them</span>`; const far = a === "klaipeda" || b === "klaipeda" ? R.places.klaipeda.offmap : 0; return `${p.length - 1} squares${speedSq ? `, ${(far + (p.length - 1) / speedSq).toFixed(1)} h each way` : ""}`; };
    const step = (i, k, v, lo, hi) => `<span class="hs-step"><button type="button" data-i="${i}" data-k="${k}" data-d="-1" ${editable && v > lo ? "" : "disabled"} aria-label="An hour earlier">−</button><output>${v}</output><button type="button" data-i="${i}" data-k="${k}" data-d="1" ${editable && v < hi ? "" : "disabled"} aria-label="An hour later">+</button></span>`;
    const vs = plan.vehicles.map((v, i) => { const V = R.vehicles[v.type]; return `<div class="hs-card" style="--c:${COLORS[i % COLORS.length]}" data-v="${i}"><b>${V.name}</b> <span class="hs-soft">holds ${V.cap} · $${V.hire}k a day</span>
      ${editable ? `<button type="button" class="hs-x" data-drop="${i}" aria-label="Let it go">×</button>` : ""}
      <div class="hs-row"><select data-k="from" ${editable ? "" : "disabled"} aria-label="From">${opt(ends(V.mode), v.from)}</select> → <select data-k="to" ${editable ? "" : "disabled"} aria-label="To">${opt(ends(V.mode), v.to)}</select><span class="hs-soft">first hour</span>${step(i, "start", v.start, 0, LAST)}</div>
      <div class="hs-soft">${way(V.mode, v.from, v.to, V.speed)}</div></div>`; }).join("");
    const fs = plan.flows.map((f, i) => `<div class="hs-card" style="--c:#7A5A12" data-f="${i}"><b>Pipeline flow</b> <span class="hs-soft">up to ${R.pipe.rate * 24} a day</span>
      ${editable ? `<button type="button" class="hs-x" data-fdrop="${i}" aria-label="Stop this flow">×</button>` : ""}
      <div class="hs-row"><select data-k="from" ${editable ? "" : "disabled"} aria-label="From">${opt(ends("pipe").filter(([, p]) => p.tank), f.from)}</select> → <select data-k="to" ${editable ? "" : "disabled"} aria-label="To">${opt(ends("pipe").filter(([, p]) => p.tank), f.to)}</select></div>
      <div class="hs-soft">${way("pipe", f.from, f.to, 0)}</div></div>`).join("");
    const add = editable ? Object.entries(R.vehicles).map(([t, V]) => `<button type="button" class="hs-add" data-add="${t}" ${n(t) >= V.max ? "disabled" : ""}>+ ${V.name}</button>`).join("") + `<button type="button" class="hs-add" data-addflow="1">+ Pipeline flow</button>` : "";
    return (vs + fs || `<p class="hs-soft">Nothing hired yet.</p>`) + `<div class="hs-adds">${add}</div>`;
  }

  // ---------- the feeding harbour: your plan's pace, what the faster ones are worth, the way back ----------
  function harbour() {
    const f = feedOf(R, harbourBest(R.feeds)), refs = [...R.rundown].sort((a, b) => b.hours - a.hours);
    const yours = f ? `Your Rundown: ${f.hours} hours with ${fleetText(f.ships)}, so the plant feeds ${(R.round / f.hours).toFixed(2)} an hour into Muuga.` : "You haven't finished Rundown yet, so the plant's tank isn't moving: everything has to be imported.";
    const rows = refs.map(x => `<tr${f && x.hours === f.hours ? ' class="mine"' : ""}><td>${x.hours} h, ${fleetText(x.ships)}${x.note ? ` <span class="hs-soft">· ${esc(x.note)}</span>` : ""}</td><td class="num">${(R.round / x.hours).toFixed(2)}/h</td><td class="num">${money(x.best)}</td></tr>`).join("");
    const star = refs.find(x => /speed star/.test(x.note || "")), mineBest = f ? refs.filter(x => x.hours >= f.hours).sort((a, b) => a.hours - b.hours)[0] : null;
    const nudge = star && (!f || f.hours > star.hours) ? `<p class="hs-nudge">Rundown's speed star (${star.hours} hours, ${fleetText(star.ships)}) would feed ${(R.round / star.hours).toFixed(2)} an hour: this region's best month with it is ${money(star.best)}${mineBest ? `, against ${money(mineBest.best)} at your pace` : ""}. <button type="button" class="hs-back" data-level="${R.feeds}">Back to Rundown</button></p>` : "";
    return `<div class="hs-harbour"><p>${yours}</p>${nudge}<details><summary>Rundown's plans, priced here</summary><table class="hs-ledger"><thead><tr><th>Rundown</th><th>Plant</th><th>Best month</th></tr></thead><tbody>${rows}</tbody></table></details></div>`;
  }

  // ---------- the month ----------
  function ledger() {
    if (!res) return "";
    const end = Math.floor(now) >= H() - 1, r = res, row = (k, v, cls = "") => `<tr class="${cls}"><th>${k}</th><td>${v}</td></tr>`;
    return `<table class="hs-ledger"><caption>${end ? "The month" : `Day ${Math.floor(now / 24) + 1} of ${R.days}: the month, as it will end`}</caption>
      ${row("Sold at the towns", money(r.revenue))}${row(`From the plant, ${r.domestic} units`, money(-r.domesticCost))}${row("Imported from Klaipėda", money(-r.bought))}
      ${row(`Hire${r.rdHire ? ` (Rundown's fleet ${money(r.rdHire)})` : ""}`, money(-r.hire))}${row("Running: trucks and trains", money(-r.running))}${row("Building", money(-r.build))}
      ${row(`Shortfall, ${r.short} units`, money(-r.penalty))}${row("Stock, end against start", money(r.stockChange))}${row("Profit", money(r.profit), "total")}</table>`;
  }
  function verdict(ended) {
    const st = $(".hs-status"); if (!st) return;
    if (!res) { st.className = "hs-status hb-status"; st.textContent = "Hire a ship to start the month."; return; }
    st.className = `hs-status hb-status ${res.short > 0 || res.profit < 0 ? "bad" : "good"}`;
    st.textContent = `${ended ? "The month is done" : "This plan's month"}: profit ${money(res.profit)} (par ${money(R.par.profit)})${res.short ? ` · ${res.short} units short` : " · no town ran dry"}${res.stuck ? ` · ${res.stuck} with no way to run` : ""}`;
  }
  function finish() {
    verdict(true);
    if (viewing || !res || res.short > 0 || res.stuck) return;                   // a best only for a month that kept every town supplied
    const b = read(bestKey(), {}); if (b.profit == null || res.profit > b.profit) { b.profit = res.profit; write(bestKey(), b); }
  }
  function changed() { if (viewing) return; mine = plan; write(planKey(), mine); evaluate(); }
  function evaluate() {
    pause(); now = 0;
    const f = feed();
    res = plan.vehicles.length || plan.flows.length ? simulate(R, { ...plan, feed: f || undefined }, true) : null;
    draw();
  }
  function draw() {
    const scrollTop = root.scrollTop;
    root.innerHTML = `<p class="hs-viewing"${viewing ? "" : " hidden"}>Watching the par plan, with Rundown at its speed star. <button type="button" class="hb-mine" data-mine="1">Back to your plan</button></p>
      ${harbour()}
      <div class="hs-tools" role="toolbar" aria-label="Build">${TOOLS.map(([k, name]) => `<button type="button" class="hs-tool${tool === k ? " on" : ""}" data-tool="${k}" ${viewing ? "disabled" : ""}>${name}</button>`).join("")}</div>
      <div class="hs-mapbox">${map()}</div>
      <input class="hs-scrub hb-scrub" type="range" min="0" max="${H() - 1}" step="1" value="${Math.floor(now)}" ${res ? "" : "disabled"} aria-label="The month, hour by hour">
      <div class="hs-run"><button type="button" class="hb-ctl" data-run="reset" aria-label="Back to the month's start" ${res ? "" : "disabled"}>${ICON.reset}</button><button type="button" class="hb-ctl primary" data-run="play" aria-label="Play the month" ${res ? "" : "disabled"}>${playing ? ICON.pause : ICON.play}</button><button type="button" class="hb-ctl" data-run="speed" aria-label="Speed">${[1, 4, 16][speed]}×</button><button type="button" class="hb-ctl" data-run="end" aria-label="To the month's end" ${res ? "" : "disabled"}>${ICON.end}</button></div>
      <p class="hs-status hb-status" aria-live="polite"></p>
      <div class="hs-cols"><div class="hs-fleet">${cards()}</div><div>${ledger()}<p class="hs-soft">Building: road $${R.build.road}k, rail $${R.build.rail}k, pipeline $${R.build.pipe}k a square; a depot $${R.build.depot}k. Diesel $${R.prices.domestic}k from the plant, $${R.prices.buy}k from Klaipėda, sold at $${R.prices.sell}k; $${R.prices.short}k a unit a town can't have.</p></div></div>`;
    root.scrollTop = scrollTop;
    verdict(false);
  }
  function frame() {                                                             // during play: the map and the clock only
    const box = $(".hs-mapbox"); if (box) box.innerHTML = map();
    const sc = $(".hs-scrub"); if (sc) sc.value = Math.floor(now);
  }
  function play() {
    if (!res) return; if (now >= H() - 1) now = 0;
    playing = true; let last = performance.now(); const b = $('[data-run="play"]'); if (b) b.innerHTML = ICON.pause;
    const tick = t => { if (!playing) return; now = Math.min(H() - 1, now + ((t - last) / 1000) * SPEEDS[speed]); last = t; frame(); if (now >= H() - 1) { pause(); finish(); draw(); return; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }
  function pause() { playing = false; cancelAnimationFrame(raf); const b = $('[data-run="play"]'); if (b) b.innerHTML = ICON.play; }

  // ---------- taps, drags and picks ----------
  root.addEventListener("pointerdown", e => { if (!R || !e.target.closest(".hs-map") || viewing) return; e.preventDefault(); down = true; lastSq = -1; e.target.closest(".hs-map").setPointerCapture?.(e.pointerId); build(square(e)); });
  root.addEventListener("pointermove", e => { if (down) build(square(e)); });
  root.addEventListener("pointerup", () => { down = false; lastSq = -1; });
  root.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !R) return;
    if (b.dataset.tool) { tool = b.dataset.tool; draw(); }
    else if (b.dataset.add) { const V = R.vehicles[b.dataset.add]; plan.vehicles.push(V.mode === "sea" ? { type: b.dataset.add, from: "klaipeda", to: "muuga", start: 0 } : { type: b.dataset.add, from: "muuga", to: "tallinn", start: 0 }); changed(); }
    else if (b.dataset.addflow) { plan.flows.push({ from: "muuga", to: "tallinn" }); changed(); }
    else if (b.dataset.drop) { plan.vehicles.splice(+b.dataset.drop, 1); changed(); }
    else if (b.dataset.fdrop) { plan.flows.splice(+b.dataset.fdrop, 1); changed(); }
    else if (b.dataset.d) { const v = plan.vehicles[+b.dataset.i]; v.start = Math.max(0, Math.min(LAST, v.start + +b.dataset.d)); changed(); }
    else if (b.dataset.run === "play") playing ? pause() : play();
    else if (b.dataset.run === "reset") { pause(); now = 0; frame(); }
    else if (b.dataset.run === "end") { pause(); now = H() - 1; finish(); draw(); }
    else if (b.dataset.run === "speed") { speed = (speed + 1) % SPEEDS.length; b.textContent = `${[1, 4, 16][speed]}×`; }
    else if (b.dataset.mine) back();
    else if (b.dataset.level) openLevel(b.dataset.level);
  });
  root.addEventListener("change", e => {
    const t = e.target, card = t.closest(".hs-card"); if (!card || !t.dataset.k || viewing) return;
    const o = card.dataset.v !== undefined ? plan.vehicles[+card.dataset.v] : plan.flows[+card.dataset.f]; o[t.dataset.k] = t.value; changed();
  });
  root.addEventListener("input", e => { if (e.target.classList.contains("hs-scrub")) { pause(); now = +e.target.value; frame(); if (now >= H() - 1) { finish(); draw(); } } });

  function view(k) { const p = R.plans.find(x => x.par.includes(k)); if (!p) return; viewing = k; plan = JSON.parse(JSON.stringify(p)); evaluate(); }
  function back() { viewing = null; plan = mine; evaluate(); }
  return {
    open(region) {
      R = region; T = terrain(R); viewing = null; tool = "road";
      const saved = read(planKey(), null);
      mine = saved?.built ? { ...empty(), ...saved } : empty(); plan = mine;
      brief.textContent = R.brief; root.hidden = false; root.scrollTop = 0;
      evaluate();
    },
    close() { pause(); R = null; root.hidden = true; root.innerHTML = ""; },
    active: () => R,
    clear() { if (!R) return; viewing = null; plan = mine = empty(); changed(); },
    view,
    /** The menu's table: this region's best against its par, the par a button to watch its plan. */
    menuTable() {
      const b = read(bestKey(), {}), t = document.createElement("table");
      t.className = "hb-bests";
      t.innerHTML = `<thead><tr><th>${esc(R.name)}</th><th>Your best</th><th>Par</th></tr></thead><tbody><tr><th>Profit</th><td>${b.profit != null ? money(b.profit) : "–"}</td><td><button type="button" class="hb-par" data-k="profit" aria-label="Watch the par plan for profit">${money(R.par.profit)}</button></td></tr></tbody>`;
      return t;
    },
  };
}
