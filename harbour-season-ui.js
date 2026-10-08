// Harbour's region screen: a season board. One picture (the sea, your terminal and its tank, the plant or refineries
// feeding it, the towns with what they want in drops and a face for how last week went, the roads, rails and rivers with
// your vehicles on them, the ships at sea), this week's three offers, and Play the week. Everything else is a tap away:
// a town (send vehicles, call them back, take its contract), the terminal (what comes in, the yard). The rules are in
// harbour-season.js; the company (every region on one clock) is the page's to keep.
import { SEASONS, WEEKS, regionOf, LANES, seasonOf, weekOf, eventOf, offersOf, offerOpen, tendersOf, contractOf, demandOf, capacityOf,
  feedOf, act, playCompany, startRegion, engineOf, parRun, PAR } from "./harbour-season.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = v => (Math.round(v * 10) / 10).toString();
const signed = v => `${v < 0 ? "−" : "+"}${num(Math.abs(v))}`;
export const coins = v => (Math.abs(v) >= 100 ? String(Math.round(v)) : num(v));
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const lower = name => name.replace(/^The /, "the ");

// ---------- the boards: each region's picture, in board units (320 × 290), not to scale ----------
// Routes run from the terminal to a town, road (trucks), rail (trains) or river (barges), and come into it from the side,
// at the houses, so whatever is on them stays clear of the town's bubble above; ships come in from the sea's edge. A
// town is [x, y, houses]; the terminal's name sits at `label` ([x, y, anchor], on the sea if a fourth is true). A tall
// screen shows up to MORE units above the top edge, more of the sea there (and ARA's coast running on north).
export const W = 320, H = 290, MORE = 150;
const BOARDS = {
  baltic: {
    land: "M0,104C40,94 74,112 118,100C160,90 182,108 226,96C266,86 296,100 320,92V290H0Z",
    water: ["M290,178C306,172 318,194 316,218C314,242 298,252 288,238C278,222 278,186 290,178Z"],   // Lake Peipus
    names: [["Gulf of Finland", 214, 30], ["Peipus", 297, 266, "middle"]],
    waves: [[132, 30], [206, 52], [296, 58], [236, 76], [118, 84], [60, -24], [190, -46], [280, -90], [90, -110], [230, -140]],
    trees: [[18, 150], [30, 210], [44, 226], [118, 214], [96, 252], [266, 210], [22, 262], [132, 268]],
    terminal: [150, 112], feed: [200, 116], label: [134, 110, "end"],
    towns: { tallinn: [66, 170, 3], rakvere: [262, 158, 2], tartu: [218, 244, 2] },
    routes: {
      tallinn: { road: [[140, 122], [120, 174], [90, 172]] },
      rakvere: { road: [[162, 122], [200, 162], [244, 160]] },
      tartu: { road: [[158, 128], [166, 240], [202, 240]], rail: [[146, 130], [150, 254], [202, 250]] },
    },
    ship: [[-14, 84], [70, 80], [140, 106]], lane: [[-14, 40], [84, 52], [146, 100]],
  },
  ara: {
    land: "M64,-150C76,-100 62,-40 72,0C82,48 64,92 78,126C90,160 66,214 78,290H320V-150Z",
    water: ["M78,120C110,114 136,122 160,116C214,104 262,132 320,140V150C262,142 212,114 160,126C136,132 110,126 80,130Z",   // the Maas and the Rhine
      "M74,234C104,228 130,240 158,236V246C130,250 104,240 76,244Z"],                                                       // the Scheldt
    names: [["North Sea", 14, 270], ["Rhine", 226, 144]],
    waves: [[26, 40], [44, 140], [22, 236], [30, -40], [22, -120]],
    trees: [[214, 180], [226, 256], [292, 214], [214, 58], [100, 56], [250, 186], [300, 252], [116, 270], [150, -20], [260, -50], [110, -96], [200, -128], [290, 6]],
    terminal: [90, 108], feed: [150, 168], label: [8, 84, "start", true],
    towns: { rotterdam: [150, 76, 3], antwerp: [176, 240, 2], duisburg: [284, 100, 2] },
    routes: {
      rotterdam: { road: [[102, 98], [116, 78], [132, 78]] },
      antwerp: { road: [[100, 122], [118, 232], [158, 232]], river: [[84, 124], [52, 180], [66, 240], [160, 244]] },
      duisburg: { river: [[100, 124], [170, 118], [220, 118], [268, 132]] },
    },
    ship: [[-10, 226], [44, 206], [78, 120]], lane: [[-10, 30], [44, 44], [82, 94]],
  },
};
const ROUTE_OF = { truck: "road", train: "rail", barge: "river" };
/** A point along a route: quadratic through three points, cubic through four. */
function along(p, t) {
  const u = 1 - t;
  if (p.length === 3) return [0, 1].map(i => u * u * p[0][i] + 2 * u * t * p[1][i] + t * t * p[2][i]);
  return [0, 1].map(i => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]);
}
const pathOf = p => (p.length === 3 ? `M${p[0]}Q${p[1]} ${p[2]}` : `M${p[0]}C${p[1]} ${p[2]} ${p[3]}`);
/** A route measured: its length, and the point and heading a given distance along it (as animateMotion measures). */
function measure(p) {
  const pts = Array.from({ length: 49 }, (_, i) => along(p, i / 48)), acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = acc[acc.length - 1];
  return { length, at(d) {
    const i = Math.max(1, acc.findIndex(a => a >= d)), [x0, y0] = pts[i - 1], [x1, y1] = pts[i], f = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, dx: x1 - x0, dy: y1 - y0 };
  } };
}
/** A vehicle turned along its heading, the right way up: one heading left is mirrored, not rolled over. */
const heading = ({ dx, dy }) => (dx >= 0 ? `rotate(${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1)})` : `rotate(${(Math.atan2(-dy, -dx) * 180 / Math.PI).toFixed(1)}) scale(-1 1)`);

// ---------- little pictures ----------
const DROP = (x, y) => `<path class="hs-drop" d="M${x},${y - 6}C${x + 2.8},${y - 2} ${x + 4.3},${y + .5} ${x + 4.3},${y + 2.3}A4.3,4.3 0 1,1 ${x - 4.3},${y + 2.3}C${x - 4.3},${y + .5} ${x - 2.8},${y - 2} ${x},${y - 6}Z"/>`;
function face(x, y, mood) {
  const mouth = mood === "happy" ? `M${x - 3.3},${y + 2}Q${x},${y + 5.2} ${x + 3.3},${y + 2}` : mood === "sad" ? `M${x - 3.3},${y + 4}Q${x},${y + .8} ${x + 3.3},${y + 4}` : `M${x - 3},${y + 2.8}H${x + 3}`;
  return `<g class="hs-face ${mood}"><circle cx="${x}" cy="${y}" r="7"/><circle class="eye" cx="${x - 2.4}" cy="${y - 1.6}" r="1"/><circle class="eye" cx="${x + 2.4}" cy="${y - 1.6}" r="1"/><path d="${mouth}"/></g>`;
}
const VEHICLE = {
  truck: `<g class="hs-veh truck"><rect x="-8" y="-4.2" width="10.5" height="8.4" rx="1.2"/><rect class="cab" x="3.2" y="-4.2" width="5" height="8.4" rx="1.2"/></g>`,
  train: `<g class="hs-veh train"><rect x="-11.5" y="-3.6" width="11" height="7.2" rx="1.2"/><rect x=".5" y="-3.6" width="11" height="7.2" rx="1.2"/></g>`,
  barge: `<g class="hs-veh barge"><path d="M-10.5,-3.2H9L12,0L9,3.2H-10.5Z"/></g>`,
};
const SHIP = (cls = "") => `<g class="hs-ship ${cls}"><path d="M-14,-4.6H6L14,0L6,4.6H-14Z"/><rect x="-9" y="-1.8" width="10" height="3.6"/></g>`;
const HOUSE = (x, y) => `<path class="hs-house" d="M${x - 7},${y + 2}L${x},${y - 5}L${x + 7},${y + 2}V${y + 9}H${x - 7}Z"/>`;
// the offers' pictures, 24 × 24
const ICON = {
  truck: '<rect x="2" y="7" width="13" height="10" rx="1.5"/><path d="M15 10h4l3 3.5V17h-7z"/><circle class="w" cx="7" cy="18.5" r="1.8"/><circle class="w" cx="18" cy="18.5" r="1.8"/>',
  train: '<rect x="1.5" y="7" width="9.5" height="9" rx="1.5"/><rect x="13" y="7" width="9.5" height="9" rx="1.5"/><path d="M1 19.5h22"/>',
  barge: '<path d="M2 14h18l2.5 3.5H4.5z"/><path d="M6 14v-3h7v3"/>',
  tank: '<ellipse cx="12" cy="6" rx="7" ry="2.4"/><path d="M5 6v11c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4V6"/><path d="M5 12c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4"/>',
  ship: '<path d="M1.5 14h21l-3 5H4.5z"/><path d="M5 14V9.5h5V14M13 14v-3h4v3"/>',
  cargo: '<path d="M12 3c3 4 5 7 5 9.5a5 5 0 0 1-10 0C7 10 9 7 12 3z"/><path d="M18.5 4.5v5M16 7h5"/>',
};
const icon = what => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[what]}</svg>`;

/**
 * company(): the company as it stands; save(company); feeds(): drops a week each region's harbour feeds it;
 * harbour(levelId): { name, hours (your fastest, or null), par } for a feeding level; goTo(step): a level, a region
 * ("region:id") or "world"; onWeek(before, after, reports): after every week played, for the page's news.
 */
export function createSeasonScreen({ root, brief, company, save, feeds, harbour, goTo, onWeek }) {
  let R = null, B = null, fresh = null, viewing = null, animate = false;
  const sheet = document.createElement("dialog");
  sheet.className = "sheet menu-sheet hs-sheet";
  sheet.setAttribute("aria-label", "Details");
  document.body.append(sheet);
  sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });

  const C = () => (viewing ? viewing.run.weeks[viewing.k].before : company());
  const S = () => C().regions[R.id];
  const lane = () => LANES.find(l => l.to === R.id || l.from === R.id);
  const feed = () => (viewing ? PAR.feeds[R.id] : feeds()[R.id] || 0);

  // ---------- the board ----------
  function board() {
    const s = S(), D = demandOf(R, s), last = s.last, ev = eventOf(R, s), L = lane(), c = C();
    let g = `<svg class="hs-board" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(R.name)}: your terminal, the towns, the routes">`;
    g += `<rect class="hs-sea" y="${-MORE}" width="${W}" height="${H + MORE}"/><path class="hs-land" d="${B.land}"/>${B.water.map(w => `<path class="hs-sea" d="${w}"/>`).join("")}`;
    g += B.waves.map(([x, y]) => `<path class="hs-wave" d="M${x - 8},${y}q4,-3 8,0t8,0"/>`).join("") + B.trees.map(([x, y]) => `<path class="hs-tree" d="M${x},${y - 7}L${x + 4.5},${y + 1.5}H${x + .8}V${y + 4}H${x - .8}V${y + 1.5}H${x - 4.5}Z"/>`).join("");
    g += B.names.map(([t, x, y, anchor = "start"]) => `<text class="hs-water-name" x="${x}" y="${y}" style="text-anchor:${anchor}">${esc(t)}</text>`).join("");
    // the routes, then what's on them
    for (const t of R.towns) for (const [kind, p] of Object.entries(B.routes[t.id])) g += `<path class="hs-route ${kind}" d="${pathOf(p)}"/>`;
    const [fx, fy] = B.feed, [tx, ty] = B.terminal;
    g += `<path class="hs-route pipe" d="M${fx},${fy}L${tx},${ty}"/>`;
    for (const t of R.towns) {
      const on = s.placed[t.id], seen = {};
      // each a vehicle's length apart from the terminal end, the fifth and later where the fourth is
      on.forEach(type => {
        const k = (seen[type] = (seen[type] || 0) + 1) - 1, p = B.routes[t.id][ROUTE_OF[type]], m = measure(p);
        const d = Math.min(m.length - 14, 22 + 20 * Math.min(k, 3)), at = m.at(d), turned = `<g transform="${heading(at)}">${VEHICLE[type]}</g>`;
        g += animate && !viewing ? `<g class="hs-moving">${turned}<animateMotion dur=".9s" fill="freeze" keyPoints="0;${(d / m.length).toFixed(3)}" keyTimes="0;1" calcMode="linear" path="${pathOf(p)}"/></g>`
          : `<g transform="translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})">${turned}</g>`;
      });
    }
    // ships at sea, halfway in along their way and a ship's length apart, level like counters on a board (the open sea
    // has no road to follow): your supply ships, and the lane's MRs bringing your own cargo (or taking it away), each
    // fleet's name and drops a week over its first
    const fleet = (way, n, cls, text) => {
      const m = measure(way);
      for (let k = 0; k < n; k++) { const at = m.at(m.length * .5 - 34 * k); g += `<g transform="translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})">${SHIP(cls)}</g>`; }
      const at = m.at(m.length * .5);
      g += `<text class="hs-tag sea" x="${at.x.toFixed(0)}" y="${(at.y - 9).toFixed(0)}">${text}</text>`;
    };
    if (s.ships) fleet(B.ship, s.ships, "", `${esc(R.ship.name)} +${R.ship.drops * s.ships}`);
    if (L && c.lanes[L.id].mrs && c.regions[L.from] && c.regions[L.to]) {
      const into = L.to === R.id, drops = into ? c.lanes[L.id].aboard : c.lanes[L.id].mrs * L.mr.drops;
      fleet(B.lane, c.lanes[L.id].mrs, "mr", into ? `From ${esc(regionOf(L.from).name)} +${num(drops)}` : `To ${esc(lower(regionOf(L.to).name))} ${num(drops)}`);
    }
    // the plant (or refineries) and the terminal with its tank
    const fd = feed();
    g += `<g class="hs-tap hs-plant" data-tap="terminal" role="button" tabindex="0" aria-label="${esc(R.feed.name)}: ${fd} a week"><path d="M${fx - 12},${fy + 9}V${fy - 4}L${fx - 5},${fy - 9}V${fy - 4}L${fx + 2},${fy - 9}V${fy - 16}H${fx + 7}V${fy + 9}Z"/></g>`;
    g += `<text class="hs-tag strong" x="${fx + 11}" y="${fy + 5}" style="text-anchor:start">${fd ? `+${fd}` : "idle"}</text>`;
    const f = Math.max(0, Math.min(1, s.tank / s.cap));
    g += `<g class="hs-tap hs-terminal" data-tap="terminal" role="button" tabindex="0" aria-label="${esc(R.terminal.name)}: ${num(s.tank)} of ${s.cap}"><rect class="hs-tank" x="${tx - 12}" y="${ty - 15}" width="24" height="30" rx="4"/><rect class="hs-level" x="${tx - 8}" y="${(ty - 11 + 22 * (1 - f)).toFixed(1)}" width="16" height="${(22 * f).toFixed(1)}" rx="1.5"/></g>`;
    const [lx, ly, anchor, sea] = B.label;
    g += `<text class="hs-name${sea ? " sea" : ""}" x="${lx}" y="${ly}" style="text-anchor:${anchor}">${esc(R.terminal.name)}</text><text class="hs-tag${sea ? " sea" : ""}" x="${lx}" y="${ly + 10}" style="text-anchor:${anchor}">${num(s.tank)} of ${s.cap}</text>`;
    // the towns: what they want this week, how last week went, a contract's seal, a tender's flag
    for (const t of R.towns) {
      const [x, y, houses] = B.towns[t.id], d = D.find(z => z.town === t.id), was = last?.towns[t.id];
      const mood = !was ? "none" : was.got >= was.want ? "happy" : was.got > 0 ? "sad" : "sad";
      const deal = tendersOf(R, s).filter(z => z.town === t.id), reach = deal.some(z => s.stars >= z.stars);
      const many = d.drops > 4, n = many ? 1 : d.drops, w = 14 + n * 10.5 + (many ? 15 : 0) + 18, bx = Math.max(3, Math.min(W - 3 - w, x - w / 2)), by = y - 42;
      // the whole town is one target, bubble to flag, not just its pictures: a finger between the houses still lands
      const hx = Math.min(bx, x - 30), hw = Math.max(bx + w, x + 30) - hx;
      g += `<g class="hs-tap hs-town${d.contract ? " held" : ""}" data-tap="town:${t.id}" role="button" tabindex="0" aria-label="${esc(t.name)}: wants ${d.drops}${d.contract ? `, contract: ${esc(d.contract.name)}` : ""}">`;
      g += `<rect class="hs-hit" x="${hx.toFixed(1)}" y="${by - 2}" width="${hw.toFixed(1)}" height="${y + 42 - (by - 2)}"/>`;
      for (let k = houses - 1; k >= 0; k--) g += HOUSE(x + (k - (houses - 1) / 2) * 12, y - (k % 2) * 4);
      if (d.contract) g += `<circle class="hs-seal" cx="${x + 6 * houses + 4}" cy="${y + 8}" r="5.5"/><text class="hs-seal-star" x="${x + 6 * houses + 4}" y="${y + 10.6}">★</text>`;
      g += `<rect class="hs-bubble${d.contract ? " held" : ""}" x="${bx.toFixed(1)}" y="${by}" width="${w}" height="22" rx="4"/>`;
      for (let k = 0; k < n; k++) g += DROP(bx + 11 + k * 10.5, by + 10);
      if (many) g += `<text class="hs-count" x="${(bx + 18).toFixed(1)}" y="${by + 15}">×${num(d.drops)}</text>`;
      if (!n) g += `<text class="hs-none" x="${(bx + 12).toFixed(1)}" y="${by + 15}">–</text>`;
      g += face(bx + w - 10.5, by + 11, mood);
      g += `<text class="hs-name" x="${x}" y="${y + 23}">${esc(t.name)}</text>`;
      if (deal.length && !viewing) g += `<g class="hs-flag${reach ? " on" : ""}"><rect x="${x - 17}" y="${y + 27}" width="34" height="13" rx="2"/><text x="${x}" y="${y + 37}">★${Math.min(...deal.map(z => z.stars))} deal</text></g>`;
      g += `</g>`;
    }
    if (ev) g += `<g class="hs-event"><rect x="5" y="5" width="${Math.min(W - 10, 14 + ev.text.length * 5.6)}" height="20" rx="3"/><text x="12" y="19">${esc(ev.text)}</text></g>`;
    return g + `</svg>`;
  }

  // ---------- the screen ----------
  function offers() {
    const s = S(), picked = viewing ? viewing.picked : s.picked;
    return offersOf(R, s).map(what => {
      const open = offerOpen(R, s, what), on = picked === what;
      const [name, more] = {
        truck: ["A truck", "into the yard"], train: ["A train", "into the yard"], barge: ["A barge", "into the yard"],
        tank: ["More tank", `holds ${s.cap + R.terminal.grow}`], ship: [`${R.ship.name}'s ship`, open ? `${R.ship.drops} a week` : "none to spare"],
        cargo: ["A cheap cargo", `${R.cargo.drops} drops now`],
      }[what];
      return `<button type="button" class="hs-offer${on ? " on" : ""}" data-offer="${what}" ${(picked && !on) || !open || viewing ? "disabled" : ""} aria-pressed="${on}">${icon(what)}<b>${name}</b><span>${more}</span></button>`;
    }).join("");
  }
  function hud() {
    const s = S(), season = seasonOf(s);
    const pips = Array.from({ length: WEEKS }, (_, k) => `<i${k <= weekOf(s) ? ' class="on"' : ""}></i>`).join("");
    return `<div class="hs-hud"><span class="hs-when"><b>${SEASONS[season]}</b><span class="hs-pips" role="img" aria-label="Week ${weekOf(s) + 1} of ${WEEKS}" title="Week ${weekOf(s) + 1} of ${WEEKS}">${pips}</span></span><span class="hs-score"><span class="hs-coins" title="Coins">${coins(s.coins)}</span><span class="hs-stars" title="Stars">★ ${s.stars}</span></span></div>`;
  }
  /** The status line: last week's result while it's fresh, else what to do next. */
  function status() {
    const s = S();
    if (viewing) return { text: viewing.say, tone: "" };
    if (fresh) return fresh;
    if (s.solved && !s.picked) return { text: "It runs on its own. Pick one and play on, or tidy it to make more a week." };
    if (!s.picked) return { text: s.age === 0 ? "Pick one, then tap a town to send it a truck." : "Pick one of the three." };
    const D = demandOf(R, s), idle = D.find(d => d.drops > 0 && capacityOf(R, s, d.town) < d.drops);
    if (idle) { const t = R.towns.find(x => x.id === idle.town); return { text: `${t.name} wants ${idle.drops}; your vehicles there carry ${num(capacityOf(R, s, idle.town))}. Tap it to send more.` }; }
    return { text: "Ready: play the week." };
  }
  function draw() {
    const s = S(), st = status();
    const bar = viewing ? `<div class="hs-viewing"><span>Par · week ${viewing.k + 1} of ${viewing.run.weeks.length}</span><span class="hs-pair"><button type="button" class="hs-small" data-par="-1" ${viewing.k > viewing.first ? "" : "disabled"} aria-label="The week before">◂</button><button type="button" class="hs-small" data-par="1" ${viewing.k < viewing.run.weeks.length - 1 ? "" : "disabled"} aria-label="The next week">▸</button></span>`
      + `<span class="hb-btns"><button type="button" class="hb-mine primary" data-use="1">Use this week</button><button type="button" class="hb-mine" data-mine="1">Back to yours</button></span></div>` : "";
    root.innerHTML = `${bar}${hud()}<div class="hs-boardbox">${board()}</div>
      <div class="hs-offers" role="group" aria-label="This week's offers: pick one">${offers()}</div>
      <button type="button" class="hs-play" data-play="1" ${!viewing && s.picked ? "" : "disabled"}>${viewing ? "Watching" : s.picked ? "Play the week" : "Pick one first"}</button>
      <p class="hs-status hb-status${st.tone ? ` ${st.tone}` : ""}" aria-live="polite">${esc(st.text)}</p>`;
    animate = false;
    fit();
  }
  /** The board as tall as its box allows, the extra above its top edge (a wide box centres it instead), and the
   *  event's banner at the top of what shows. */
  function fit() {
    const box = root.querySelector(".hs-boardbox"), svg = box?.querySelector(".hs-board");
    if (!svg || !box.clientWidth) return;
    const more = Math.max(0, Math.min(MORE, Math.floor(W * box.clientHeight / box.clientWidth - H)));
    svg.setAttribute("viewBox", `0 ${-more} ${W} ${H + more}`);
    svg.style.setProperty("--tall", ((H + more) / W).toFixed(4));
    svg.querySelector(".hs-event")?.setAttribute("transform", `translate(0 ${-more})`);
  }
  new ResizeObserver(() => { if (R) fit(); }).observe(root);

  // ---------- the sheets ----------
  function openSheet(title, body) {
    sheet.innerHTML = `<div class="pick-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn menu-x" data-close="1" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="hs-sheet-body">${body}</div>`;
    if (!sheet.open) sheet.showModal();
  }
  function townSheet(id) {
    const s = S(), t = R.towns.find(x => x.id === id), d = demandOf(R, s).find(z => z.town === id), was = s.last?.towns[id], ro = !!viewing;
    const cap = capacityOf(R, s, id), on = s.placed[id];
    let b = `<p class="hs-line">${d.contract ? `Contract: <b>${esc(d.contract.name)}</b>, ${d.contract.drops} a week at ${num(d.contract.price)} a drop.` : `Wants <b>${d.drops}</b> this week, at ${num(d.price)} a drop.`}${was ? ` Last week: ${num(was.got)} of ${was.want}.` : ""}</p>`;
    b += `<h4>On the way there</h4>`;
    b += on.length ? `<div class="hs-chips">${on.map(type => `<button type="button" class="hs-chip" data-unplace="${id}:${type}" ${ro ? "disabled" : ""}>${R.vehicles[type].name} · ${t.routes[type]} a week <span aria-hidden="true">×</span></button>`).join("")}</div>` : `<p class="hs-soft">Nothing yet.</p>`;
    b += `<p class="hs-soft">Carries ${num(cap)} a week${cap < d.drops ? `, ${num(d.drops - cap)} short of what it wants` : ""}.</p>`;
    b += `<div class="hs-sends">${Object.entries(t.routes).map(([type, per]) => `<button type="button" class="btn" data-place="${id}:${type}" ${!ro && s.pool[type] > 0 ? "" : "disabled"}>Send a ${R.vehicles[type].name.toLowerCase()} · ${per} a week</button>`).join("")}</div>`;
    const free = Object.entries(s.pool).filter(([, n]) => n > 0).map(([type, n]) => plural(n, R.vehicles[type].name.toLowerCase()));
    b += `<p class="hs-soft">${free.length ? `In the yard: ${free.join(", ")}.` : "The yard is empty: pick a vehicle from the offers."} ${R.vehicles.truck ? `A truck costs ${num(R.vehicles.truck.hire)} a week on the road` : ""}${Object.keys(R.vehicles).filter(v => v !== "truck").map(v => `, a ${v} ${num(R.vehicles[v].hire)}`).join("")}; in the yard, nothing.</p>`;
    const deals = tendersOf(R, s).filter(z => z.town === id);
    if (deals.length) {
      b += `<h4>Contracts on offer</h4>`;
      b += deals.map(z => `<div class="hs-deal"><div><b>${esc(z.name)}</b><span>${z.drops} a week at ${num(z.price)} a drop${z.long ? ", all year" : ""}</span></div><button type="button" class="btn${s.stars >= z.stars ? " primary" : ""}" data-accept="${z.id}" ${!ro && s.stars >= z.stars ? "" : "disabled"}>${s.stars >= z.stars ? "Take it" : `Needs ★${z.stars}`}</button></div>`).join("");
      b += `<p class="hs-soft">A contract is a promise: a week short costs a star, and ${R.penalty} a drop.</p>`;
    }
    openSheet(t.name, b);
  }
  function terminalSheet() {
    const s = S(), h = harbour(R.feed.level), fd = feed(), L = lane(), c = C(), ro = !!viewing;
    let b = `<p class="hs-line">Holds <b>${s.cap}</b>; has ${num(s.tank)}. Whatever comes in beyond what it holds is turned away, and not paid for.</p><h4>Comes in each week</h4>`;
    b += `<div class="hs-deal"><div><b>${esc(R.feed.name)}</b><span>${fd ? `${fd} a week at ${num(R.feed.price)} a drop` : "idle"}: as fast as your ${esc(h.name)} plan${h.hours ? ` (${h.hours} hours)` : ""}</span></div>${!ro && h.hours > h.par ? `<button type="button" class="btn" data-go="${R.feed.level}">${esc(h.name)}</button>` : ""}</div>`;
    if (!ro && h.hours > h.par) b += `<p class="hs-soft">${esc(h.name)} at its par, ${h.par} hours, would feed ${feedOf(R, h.par)} a week.</p>`;
    if (s.ships) b += `<div class="hs-deal"><div><b>${esc(R.ship.name)}'s ${s.ships > 1 ? `${s.ships} ships` : "ship"}</b><span>${R.ship.drops * s.ships} a week from ${esc(R.ship.from)}, at ${num(Math.min(...R.ship.price))}–${num(Math.max(...R.ship.price))} a drop, ${num(R.ship.hire * s.ships)} a week to hire</span></div><button type="button" class="btn" data-release="1" ${ro ? "disabled" : ""}>Let one go</button></div>`;
    if (L && c.regions[L.from] && c.regions[L.to]) {
      const mrs = c.lanes[L.id].mrs, into = L.to === R.id, other = regionOf(into ? L.from : L.to).name;
      b += `<div class="hs-deal"><div><b>${into ? `From ${esc(other)}` : `To ${esc(lower(other))}`}</b><span>${mrs ? `${plural(mrs, "MR")} on the world's lane, ${L.mr.drops * mrs} a week at ${num(L.price)} a drop` : "No MR on the world's lane yet"}</span></div>${ro ? "" : `<button type="button" class="btn" data-go="world">The world</button>`}</div>`;
    }
    const free = Object.entries(s.pool).filter(([, n]) => n > 0).map(([type, n]) => plural(n, R.vehicles[type].name.toLowerCase()));
    b += `<h4>The yard</h4><p class="hs-soft">${free.length ? `${free.join(", ")}: tap a town to send one.` : "Empty: every vehicle is out on a route."}</p>`;
    if (s.solved) { const e = engineOf(company(), R.id, feeds()); if (e != null && !ro) b += `<h4>The engine</h4><p class="hs-line">${num(e)} coins a week as it stands (par ${num(PAR.engine[R.id])}).</p>`; }
    openSheet(R.terminal.name, b);
  }
  /** The welcome, the first time a region opens: where its diesel comes from (your harbour plan's pace, the link back
   *  to the puzzles), how a week goes in three lines, and the seasons. The brief above the board says the rest. */
  function welcome() {
    const h = harbour(R.feed.level), fd = feed();
    openSheet(R.name, `<p class="hs-line"><b>${esc(R.terminal.name)}</b>, your terminal, gets ${fd} drops a week from ${esc(lower(R.feed.name))}: as fast as your ${esc(h.name)} plan runs${h.hours ? ` (${h.hours} hours)` : ""}. A faster plan feeds it more.</p>`
      + `<ol class="hs-how"><li><b>Pick one</b> of three offers each week: a vehicle, more tank, a ship.</li><li><b>Tap a town</b> to send it vehicles from the yard.</li><li><b>Play the week.</b> Supply every town for a star; stars win contracts.</li></ol>`
      + `<p class="hs-soft">A season is ${WEEKS} weeks: ${SEASONS.map(x => x.toLowerCase()).join(", then ")}. A region whose long-term contracts are all kept runs on its own.</p><button type="button" class="btn primary wide" data-close="1">Start</button>`);
  }

  // ---------- moves ----------
  function move(id, a) { if (viewing) return; save(act(company(), id, a)); fresh = null; draw(); }
  function play() {
    if (viewing || !S().picked) return;
    const before = company(), out = playCompany(before, feeds());
    save(out.company);
    const r = out.reports[R.id], others = Object.entries(out.reports).filter(([id]) => id !== R.id);
    const towns = R.towns.map(t => `${t.name} ${num(r.towns[t.id].got)}/${r.towns[t.id].want}`).join(" · ");
    fresh = { text: `${towns} · ${signed(r.coins)}${r.star > 0 ? " · ★" : r.star < 0 ? " · a star lost" : ""}${others.length ? ` · ${others.map(([id, x]) => `${regionOf(id).name} ${signed(x.coins)}`).join(", ")}` : ""}`,
      tone: r.star < 0 ? "bad" : r.star > 0 ? "good" : "" };
    animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    draw();
    // news: a new season, the region solved; the page adds what this opened elsewhere
    const s = S(), news = [];
    if (r.solved) news.push([`${R.name} runs on its own`, `All its long-term contracts kept. It keeps running while you play elsewhere; tidy it (vehicles it doesn't need, ships it no longer wants) to make more a week.`]);
    else if (seasonOf(s) !== r.season) news.push([SEASONS[seasonOf(s)], seasonOf(s) === 1 ? `The towns now offer contracts: tap one with a ★ flag. A contract is steadier than spot orders and bigger, but it's a promise.` : `The long-term contracts are open: bigger still, for a region that runs on its own once they're all kept.`]);
    onWeek(before, out.company, out.reports, news);
  }
  function watch(k) {
    const run = viewing?.run || parRun(), w = PAR.weeks[k] || {};
    const say = [...(w.world || []).map(a => `puts ${plural(a[2], "MR")} on the lane`), ...(w[R.id] || []).map(a => describe(a))].filter(Boolean);
    const first = run.weeks.findIndex(x => x.before.regions[R.id]);
    if (k < first) return watch(first);
    viewing = { run, k, first, picked: (w[R.id] || []).find(a => a[0] === "pick")?.[1] || null, say: say.length ? `The par ${say.join(", ")}.` : "The par plays the week as it stands." };
    fresh = null; draw();
  }
  /** The cheat, as a level's Use this plan: this region becomes the par's as it stands at the week watched, its moves
   *  made, ready to play. The other regions and the lanes stay yours. */
  function usePar() {
    const before = company(), par = JSON.parse(JSON.stringify(viewing.run.weeks[viewing.k].before.regions[R.id]));
    save({ ...before, regions: { ...before.regions, [R.id]: par } });
    viewing = null;
    fresh = { text: `The par's week ${weekOf(par) + 1} of ${SEASONS[seasonOf(par)].toLowerCase()} is yours now: play it.` };
    draw();
    onWeek(before, company(), {}, []);
  }
  function describe([m, ...a]) {
    const town = id => R.towns.find(t => t.id === id)?.name, v = type => R.vehicles[type]?.name.toLowerCase();
    if (m === "start") return "opens the region";
    if (m === "pick") return `picks ${{ tank: "more tank", ship: `${R.ship.name}'s ship`, cargo: "a cheap cargo" }[a[0]] || `a ${v(a[0])}`}`;
    if (m === "place") return `sends a ${v(a[1])} to ${town(a[0])}`;
    if (m === "unplace") return `calls a ${v(a[1])} back from ${town(a[0])}`;
    if (m === "accept") return `takes ${R.tenders.find(t => t.id === a[0]).name}`;
    if (m === "release") return `lets a ship go`;
    return "";
  }

  root.addEventListener("click", e => {
    if (!R) return;
    const t = e.target.closest("[data-tap], button");
    if (!t) return;
    if (t.dataset.tap) { const [kind, id] = t.dataset.tap.split(":"); fresh = null; if (kind === "town") townSheet(id); else terminalSheet(); return; }
    if (t.dataset.offer) move(R.id, ["pick", t.dataset.offer]);
    else if (t.dataset.play) play();
    else if (t.dataset.par) watch(viewing.k + +t.dataset.par);
    else if (t.dataset.mine) { viewing = null; draw(); }
    else if (t.dataset.use) usePar();
  });
  root.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset?.tap) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
  sheet.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || !R) return;
    if (b.dataset.close) { sheet.close(); return; }
    if (b.dataset.go) { sheet.close(); goTo(b.dataset.go); return; }
    const [town, type] = (b.dataset.place || b.dataset.unplace || "").split(":");
    if (b.dataset.place) { move(R.id, ["place", town, type]); townSheet(town); }
    else if (b.dataset.unplace) { move(R.id, ["unplace", town, type]); townSheet(town); }
    else if (b.dataset.accept) { const id = R.tenders.find(z => z.id === b.dataset.accept).town; move(R.id, ["accept", b.dataset.accept]); townSheet(id); }
    else if (b.dataset.release) { move(R.id, ["release"]); terminalSheet(); }
  });

  return {
    open(region) {
      R = region; B = BOARDS[R.id]; viewing = null; fresh = null;
      brief.textContent = R.brief;
      root.hidden = false; root.scrollTop = 0;
      const first = !company().regions[R.id];
      if (first) save(startRegion(company(), R.id));
      draw();
      if (first) welcome();
    },
    close() { R = null; viewing = null; if (sheet.open) sheet.close(); root.hidden = true; root.innerHTML = ""; },
    active: () => R,
    redraw() { if (R) draw(); },
    /** The par run, week by week, in place of your company (Menu's cheat). */
    view() { if (R) watch(0); },
    news(items, actions = []) {
      if (!items.length) return;
      openSheet(items[0][0], items.map(([h, t], i) => `${i ? `<h4>${esc(h)}</h4>` : ""}<p class="hs-line">${esc(t)}</p>`).join("")
        + actions.map(([label, to]) => `<button type="button" class="btn primary wide" data-go="${to}">${esc(label)}</button>`).join("")
        + `<button type="button" class="btn wide" data-close="1">${actions.length ? "Stay here" : "OK"}</button>`);
    },
    restart() { if (!R) return; const c = company(); const n = { ...c, regions: { ...c.regions } }; delete n.regions[R.id]; save(startRegion(n, R.id)); fresh = null; draw(); welcome(); },
  };
}
