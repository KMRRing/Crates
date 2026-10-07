// Harbour's region screen: the chart of a region (its coasts, the sea lane, the refinery and the customer with its tank),
// the fleet the player hires (each ship's load and the hour it first comes in), the month played back hour by hour with
// the ledger building, and a timeline of every ship's month under it. The month itself comes from harbour-region.js:
// it is worked out the moment the fleet changes, so the result shows at once; playing it shows why.
import { CAPACITY, DID, loadsFor, simulate, measures } from "./harbour-region.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = v => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(1)}k`;
const NAME = { coaster: "Coaster", handy: "Handy" };
const COLORS = ["#2F6F9F", "#B8742A", "#3D8B5A", "#8A4F9E", "#A8443A", "#5E7A2E"];   // a ship's colour, card to chart to timeline
const SPEEDS = [8, 32, 128];                                                            // hours a second
const STARTS = 72;                                                                      // the latest first hour offered

// The eastern Baltic, roughly: [lon, lat] rings, enough to know where you are. The mainland runs from the Curonian Spit
// north past Liepāja and Ventspils, round the Gulf of Riga, up to Tallinn and east to Narva; Finland's shore across the gulf.
const LAND = [
  [[20.95, 55.0], [21.05, 55.4], [21.13, 55.71], [21.07, 55.92], [21.0, 56.51], [21.18, 56.89], [21.56, 57.39], [22.0, 57.6], [22.59, 57.76],
    [22.8, 57.5], [23.2, 57.2], [23.6, 56.97], [24.1, 57.02], [24.4, 57.26], [24.36, 57.75], [24.45, 58.1], [24.5, 58.38], [24.0, 58.3],
    [23.51, 58.57], [23.54, 58.94], [23.68, 59.22], [24.05, 59.35], [24.4, 59.47], [24.75, 59.44], [24.96, 59.5], [25.7, 59.58],
    [26.53, 59.5], [27.2, 59.45], [27.76, 59.4], [28.04, 59.46], [28.4, 59.4], [28.4, 55.0]],
  [[21.85, 58.32], [22.2, 58.55], [22.65, 58.6], [23.25, 58.55], [23.35, 58.36], [22.95, 58.2], [22.55, 58.12], [22.2, 57.95], [22.05, 57.91], [22.0, 58.15]],   // Saaremaa
  [[22.05, 58.95], [22.45, 59.08], [22.9, 59.0], [22.95, 58.8], [22.55, 58.72], [22.2, 58.8]],                                                                       // Hiiumaa
  [[20.0, 60.4], [21.5, 60.3], [22.4, 60.05], [22.95, 59.82], [23.6, 59.98], [24.4, 60.1], [24.95, 60.15], [25.66, 60.3], [26.4, 60.4], [26.94, 60.45], [27.8, 60.5], [28.4, 60.6], [28.4, 61], [20.0, 61]],
];
const NAMES = [["LITHUANIA", 23.7, 55.6], ["LATVIA", 25.1, 56.85], ["ESTONIA", 25.3, 58.75], ["Gulf of Riga", 23.35, 57.62], ["Gulf of Finland", 22.75, 59.66], ["Baltic Sea", 20.15, 57.0]];
// cropped to the lane, with sea to the west of it and a sliver of Finland across the gulf
const BOUNDS = { lon0: 19.6, lon1: 26.2, lat0: 55.45, lat1: 60.08 }, K = 100, COS = Math.cos((57.8 * Math.PI) / 180);
const X = lon => (lon - BOUNDS.lon0) * COS * K, Y = lat => (BOUNDS.lat1 - lat) * K;
const W = X(BOUNDS.lon1), HGT = Y(BOUNDS.lat0);
const ring = pts => pts.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(" ");

const ICON = {
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path class="solid" d="M7 5l12 7-12 7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path class="solid" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  end: '<svg viewBox="0 0 24 24"><path class="solid" d="M5 5l9 7-9 7z"/><path d="M18 5v14"/></svg>',
};

export function createRegionScreen({ root, brief }) {
  let R = null, mine = [], plan = [], viewing = null, res = null, now = 0, speed = 0, playing = false, last = 0, raf = 0, lane = null;
  const fleetKey = () => `harbour:v2:region:${R.id}:fleet`, bestKey = () => `harbour:v2:region:${R.id}:best`;
  const $ = sel => root.querySelector(sel);
  const H = () => R.days * 24;

  // ---------- the chart ----------
  function laneOf() {   // the lane on the chart, measured, so a fraction of the voyage is a point and a heading
    const pts = R.lane.map(([lo, la]) => [X(lo), Y(la)]), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function pointAt(f) {
    const { pts, cum, len } = lane, d = Math.max(0, Math.min(1, f)) * len;
    let i = 1; while (i < pts.length - 1 && cum[i] < d) i++;
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: Math.atan2(y1 - y0, x1 - x0) };
  }
  function chart() {
    const ref = R.refinery, cu = R.customer, [rx, ry] = [X(ref.lon), Y(ref.lat)], [cx, cy] = [X(cu.lon), Y(cu.lat)];
    const mid = pointAt(.3);
    return `<svg class="hr-chart" viewBox="0 0 ${W.toFixed(0)} ${HGT.toFixed(0)}" role="img" aria-label="Chart of the eastern Baltic: ${esc(ref.name)} to ${esc(cu.name)}">
      <rect width="100%" height="100%" class="hr-water"/>
      ${LAND.map(r => `<polygon class="hr-land" points="${ring(r)}"/>`).join("")}
      ${NAMES.map(([t, lo, la]) => `<text class="hr-name${/^[A-Z]+$/.test(t) ? " caps" : ""}" x="${X(lo).toFixed(0)}" y="${Y(la).toFixed(0)}">${t}</text>`).join("")}
      <polyline class="hr-lane" points="${lane.pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}"/>
      <text class="hr-lane-t" x="${(mid.x + 9).toFixed(0)}" y="${mid.y.toFixed(0)}">${cu.hours} h each way</text>
      <g class="hr-port refinery"><rect x="${rx - 6}" y="${ry - 6}" width="12" height="12" rx="2"/><text x="${rx + 10}" y="${ry + 4}">${esc(ref.name)}</text><text class="small" x="${rx + 10}" y="${ry + 18}">one berth, ${ref.parcel} an hour</text></g>
      <g class="hr-port customer"><circle cx="${cx}" cy="${cy}" r="6"/><text x="${cx - 10}" y="${cy + 20}" style="text-anchor:end">${esc(cu.name)}</text></g>
      <g class="hr-gauge" transform="translate(${cx + 9} ${cy + 8})"><rect class="hr-gauge-box" width="12" height="44" rx="2"/><rect class="hr-gauge-fill" x="1.5" width="9" rx="1"/><text class="small" x="17" y="12">tank</text><text class="small hr-gauge-t" x="17" y="26"></text></g>
      <g class="hr-ships"></g>
    </svg>`;
  }
  // every ship at the hour shown: on the lane, or at a berth (side by side, so a queue shows as a queue)
  function drawShips() {
    if (!res) { $(".hr-ships").innerHTML = ""; return; }
    const h0 = Math.min(Math.floor(now), H() - 1), h1 = Math.min(h0 + 1, H() - 1), f = now - h0, rec = res.rec;
    const atRef = [], atCust = [];
    const out = plan.map((s, i) => {
      if (rec.did[i][h0] === DID.pre) return "";
      const a0 = rec.at[i][h0], a1 = rec.at[i][h1], at = Math.abs(a1 - a0) > .5 ? a0 : a0 + (a1 - a0) * f;
      let p = pointAt(at), back = a1 < a0 || (at <= 0 && rec.did[i][h0] === DID.sea);
      if (at <= 1e-6) { const k = atRef.push(i) - 1; p = { x: p.x - 16 - k * 24, y: p.y + 2, a: Math.PI / 2 }; back = false; }          // at Klaipėda's berth, or queueing beside it
      else if (at >= 1 - 1e-6) { const k = atCust.push(i) - 1; p = { x: p.x - 22 - k * 26, y: p.y - 12, a: 0 }; back = false; }  // at Muuga's, or waiting off it
      const ang = ((back ? p.a + Math.PI : p.a) * 180) / Math.PI, sc = s.type === "handy" ? 2.1 : 1.6;
      const wait = rec.did[i][h0] === DID.wait ? " waiting" : "";
      return `<g class="hr-boat${wait}" style="--ship:${COLORS[i % COLORS.length]}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(0)}) scale(${sc})"><path d="M-7,-3 L4,-3 L8,0 L4,3 L-7,3 Z"/><rect x="-5" y="-1.2" width="7" height="2.4"/></g>`;
    }).join("");
    $(".hr-ships").innerHTML = out;
    const lv = res.rec.level[h0] + (res.rec.level[h1] - res.rec.level[h0]) * f, cap = R.customer.tank.cap, hh = 41 * Math.max(0, lv) / cap;
    const fill = $(".hr-gauge-fill"); fill.setAttribute("y", (42.5 - hh).toFixed(1)); fill.setAttribute("height", hh.toFixed(1));
    $(".hr-gauge").classList.toggle("dry", lv < .01 && h0 > 0);
    $(".hr-gauge-t").textContent = `${lv.toFixed(1)} of ${cap}`;
  }

  // ---------- the fleet ----------
  function fleet() {
    const editable = !viewing, left = t => R.fleet[t] - plan.filter(s => s.type === t).length;
    const cards = plan.map((s, i) => `<div class="hr-card" style="--ship:${COLORS[i % COLORS.length]}" data-i="${i}">
      <span class="hr-chip" aria-hidden="true"></span><b>${NAME[s.type]}</b><span class="hr-soft">holds ${CAPACITY[s.type]}</span>
      <span class="hr-field">Load <span class="hr-step"><button type="button" data-act="load-1" ${editable && s.load > Math.min(...loadsFor(R, s.type)) ? "" : "disabled"} aria-label="Lighter load">−</button><output>${s.load}</output><button type="button" data-act="load+1" ${editable && s.load < CAPACITY[s.type] ? "" : "disabled"} aria-label="Heavier load">+</button></span></span>
      <span class="hr-field">First in, hour <span class="hr-step"><button type="button" data-act="start-1" ${editable && s.start > 0 ? "" : "disabled"} aria-label="An hour earlier">−</button><output>${s.start}</output><button type="button" data-act="start+1" ${editable && s.start < STARTS ? "" : "disabled"} aria-label="An hour later">+</button></span></span>
      ${editable ? `<button type="button" class="hr-x" data-act="drop" aria-label="Let ship ${i + 1} go">×</button>` : ""}</div>`).join("");
    const hire = editable ? Object.keys(R.fleet).map(t => `<button type="button" class="hr-hire" data-hire="${t}" ${left(t) > 0 ? "" : "disabled"}>Hire a ${t === "handy" ? "Handy" : NAME[t].toLowerCase()} <span class="hr-soft">holds ${CAPACITY[t]} · $${R.hire[t]}k a day · ${left(t)} left</span></button>`).join("") : "";
    $(".hr-fleet").innerHTML = (cards || `<p class="hr-soft hr-empty">No ships yet: hire one to start the deal.</p>`) + `<div class="hr-hires">${hire}</div>`;
  }
  function change(fn) {
    if (viewing) return;
    fn(); mine = plan; write(fleetKey(), mine); evaluate();
  }
  root.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !R) return;
    if (b.dataset.hire) return change(() => plan.push({ type: b.dataset.hire, load: CAPACITY[b.dataset.hire], start: 0 }));
    const card = b.closest(".hr-card"), i = card ? +card.dataset.i : -1, act = b.dataset.act;
    if (act === "drop") return change(() => plan.splice(i, 1));
    if (act?.startsWith("load")) return change(() => { const ls = loadsFor(R, plan[i].type).sort((a, z) => a - z), k = ls.indexOf(plan[i].load) + (act.endsWith("+1") ? 1 : -1); plan[i].load = ls[Math.max(0, Math.min(ls.length - 1, k))]; });
    if (act?.startsWith("start")) return change(() => { plan[i].start = Math.max(0, Math.min(STARTS, plan[i].start + (act.endsWith("+1") ? 1 : -1))); });
    if (b.id === "hrRun") return playing ? pause() : play();
    if (b.id === "hrReset") { pause(); now = 0; frame(); return; }
    if (b.id === "hrEnd") { pause(); now = H() - 1; frame(); finish(); return; }
    if (b.id === "hrSpeed") { speed = (speed + 1) % SPEEDS.length; b.textContent = `${[1, 4, 16][speed]}×`; return; }
    if (b.id === "hrMine") return back();
  });

  // ---------- the month: worked out at once, played back on demand ----------
  function evaluate() {
    pause(); now = 0;
    res = plan.length ? simulate(R, plan, true) : null;
    fleet(); timeline(); frame(); verdict(false);
  }
  function verdict(ended) {
    const st = $(".hr-status");
    if (!res) { st.className = "hr-status"; st.textContent = "Hire a ship to start the deal."; return; }
    const m = measures(res), head = ended ? "The month is done" : "This fleet's month";
    st.className = `hr-status ${res.profit > 0 ? "good" : "bad"}`;
    st.textContent = `${head}: profit ${money(res.profit)} (par ${money(R.par.profit)}) · ${res.waiting} h waiting · ${res.short ? `${res.short} units short` : "never dry"}${m.calm === 0 ? " · calm" : ""}`;
  }
  function finish() {
    verdict(true);
    if (viewing || !res) return;
    const m = measures(res), b = read(bestKey(), {}), was = JSON.stringify(b);
    if (b.profit == null || m.profit > b.profit) b.profit = m.profit;
    if (m.calm != null && (b.calm == null || m.calm < b.calm)) b.calm = m.calm;
    if (JSON.stringify(b) !== was) write(bestKey(), b);
  }
  function ledger() {
    const t = $(".hr-ledger"); if (!res) { t.innerHTML = ""; return; }
    const h = Math.min(Math.floor(now), H() - 1), end = h >= H() - 1, rec = res.rec, c = R.customer;
    const hire = end ? res.hire : res.hire * (h + 1) / H(), short = rec.dry[h] * c.penalty;
    const profit = end ? res.profit : rec.revenue[h] - rec.bought[h] - hire - rec.demurrage[h] - short;
    const row = (k, v, cls = "") => `<tr class="${cls}"><th>${k}</th><td>${v}</td></tr>`;
    t.innerHTML = `<caption>Day ${Math.floor(h / 24) + 1} of ${R.days}</caption>`
      + row(`Sold at ${esc(c.name)}`, money(rec.revenue[h])) + row(`Diesel bought at ${esc(R.refinery.name)}`, money(-rec.bought[h]))
      + row("Hire", money(-hire)) + row("Demurrage", money(-rec.demurrage[h])) + row("Units short, at the penalty", money(-short))
      + (end && res.aboard ? row("Cargo still aboard, at cost", money(res.aboard)) : "") + row(end ? "Profit" : "Profit so far", money(profit), "total");
  }
  function timeline() {
    const t = $(".hr-timeline"); if (!res) { t.innerHTML = ""; return; }
    const n = plan.length, Hh = H(), rowH = 9, top = n * rowH + 4, cap = R.customer.tank.cap, cls = ["pre", "sea", "wait", "load", "load", "dis"];
    const bars = res.rec.did.map((tr, i) => {
      let out = `<rect x="0" y="${i * rowH}" width="6" height="${rowH - 2}" fill="${COLORS[i % COLORS.length]}"/>`, x0 = 0;
      for (let h = 1; h <= Hh; h++) if (h === Hh || tr[h] !== tr[x0]) { if (tr[x0] !== DID.pre) out += `<rect class="tl-${cls[tr[x0]]}" x="${x0 + 8}" y="${i * rowH}" width="${h - x0}" height="${rowH - 2}"/>`; x0 = h; }
      return out;
    }).join("");
    const lvl = Array.from(res.rec.level, (v, h) => `${h + 8},${(top + 26 - (v / cap) * 24).toFixed(1)}`).join(" ");
    const weeks = Array.from({ length: R.days / 7 + 1 }, (_, k) => `<line class="tl-week" x1="${k * 168 + 8}" x2="${k * 168 + 8}" y1="0" y2="${top + 28}"/>`).join("");
    t.innerHTML = `<svg viewBox="0 0 ${Hh + 8} ${top + 28}" preserveAspectRatio="none" role="img" aria-label="Every ship's month, hour by hour, and ${esc(R.customer.name)}'s tank">${bars}<rect class="tl-tankbg" x="8" y="${top + 2}" width="${Hh}" height="24"/><polyline class="tl-level" points="${lvl}"/>${weeks}<line class="tl-now" x1="8" x2="8" y1="0" y2="${top + 28}"/></svg>
      <p class="hr-key"><i class="tl-load"></i>loading <i class="tl-sea"></i>at sea <i class="tl-dis"></i>discharging <i class="tl-wait"></i>waiting <i class="tl-tank"></i>${esc(R.customer.name)}'s tank; a line a week</p>`;
    t.querySelector("svg").addEventListener("pointerdown", e => { const r = e.currentTarget.getBoundingClientRect(); pause(); now = Math.max(0, Math.min(H() - 1, ((e.clientX - r.left) / r.width) * (H() + 8) - 8)); frame(); });
  }
  function frame() {
    drawShips(); ledger();
    const x = (Math.min(now, H() - 1) + 8).toFixed(1), ln = root.querySelector(".tl-now"); if (ln) { ln.setAttribute("x1", x); ln.setAttribute("x2", x); }
    const sc = $(".hr-scrub"); sc.max = H() - 1; sc.value = Math.floor(now); sc.disabled = !res;
    for (const id of ["hrRun", "hrReset", "hrEnd"]) $(`#${id}`).disabled = !res;
  }
  function play() {
    if (!res) return;
    if (now >= H() - 1) now = 0;
    playing = true; last = performance.now(); $("#hrRun").innerHTML = ICON.pause; $("#hrRun").setAttribute("aria-label", "Pause");
    const step = t => {
      if (!playing) return;
      now = Math.min(H() - 1, now + ((t - last) / 1000) * SPEEDS[speed]); last = t; frame();
      if (now >= H() - 1) { pause(); finish(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function pause() {
    playing = false; cancelAnimationFrame(raf);
    const b = $("#hrRun"); if (b) { b.innerHTML = ICON.play; b.setAttribute("aria-label", "Play the month"); }
  }

  // ---------- watching a par plan ----------
  function view(k) {
    const p = R.plans.find(x => x.par.includes(k)); if (!p) return;
    viewing = k; plan = p.ships.map(s => ({ ...s }));
    $(".hr-viewing").hidden = false;
    $(".hr-viewing-t").textContent = `Watching the par plan for ${k === "calm" ? "calm (never dry, fewest hours waiting)" : "profit"}.`;
    evaluate();
  }
  function back() { viewing = null; plan = mine; $(".hr-viewing").hidden = true; evaluate(); }

  return {
    open(region) {
      R = region; lane = laneOf(); viewing = null;
      mine = (read(fleetKey(), []) || []).filter(s => R.fleet[s.type] && loadsFor(R, s.type).includes(s.load)); plan = mine;
      brief.textContent = R.brief;
      root.innerHTML = `<p class="hr-viewing" hidden><span class="hr-viewing-t"></span> <button type="button" id="hrMine" class="hb-mine">Back to your fleet</button></p>
        ${chart()}
        <input class="hr-scrub hb-scrub" type="range" min="0" max="1" step="1" value="0" aria-label="The month, hour by hour">
        <div class="hr-run"><button id="hrReset" class="hb-ctl" type="button" aria-label="Back to the month's start">${ICON.reset}</button><button id="hrRun" class="hb-ctl primary" type="button" aria-label="Play the month">${ICON.play}</button><button id="hrSpeed" class="hb-ctl" type="button" aria-label="Speed">${[1, 4, 16][speed]}×</button><button id="hrEnd" class="hb-ctl" type="button" aria-label="To the month's end">${ICON.end}</button></div>
        <p class="hr-status hb-status" aria-live="polite"></p>
        <div class="hr-fleet"></div>
        <div class="hr-timeline"></div>
        <table class="hr-ledger"></table>
        <p class="hr-rules hr-soft">Diesel costs ${money(R.refinery.price)} a unit at ${esc(R.refinery.name)} and sells for ${money(R.customer.price)} at ${esc(R.customer.name)}. Hire is paid for the month; demurrage ${money(R.demurrage)} an hour a ship waits; ${money(R.customer.penalty)} a unit the trucks can't have.</p>`;
      $(".hr-scrub").addEventListener("input", e => { pause(); now = +e.target.value; frame(); if (now >= H() - 1) finish(); });
      root.hidden = false;
      evaluate();
    },
    close() { pause(); R = null; root.hidden = true; root.innerHTML = ""; },
    active: () => R,
    clear() { if (!R) return; back(); change(() => { plan = []; }); },
    view,
    /** The menu's table: this region's bests against its pars, each par a button to watch its plan. */
    menuTable() {
      const b = read(bestKey(), {}), t = document.createElement("table");
      t.className = "hb-bests";
      const rows = [["profit", "Profit", v => money(v)], ["calm", "Calm: never dry, fewest hours waiting", v => `${v} h`]];
      t.innerHTML = `<thead><tr><th>${esc(R.name)}</th><th>Your best</th><th>Par</th></tr></thead><tbody>${rows.map(([k, name, f]) =>
        `<tr><th>${name}</th><td>${b[k] != null ? f(b[k]) : "–"}</td><td><button type="button" class="hb-par" data-k="${k}" aria-label="Watch the par plan for ${name.toLowerCase()}">${f(R.par[k])}</button></td></tr>`).join("")}</tbody>`;
      return t;
    },
  };
}
