// Harbour's world, which is the League's: a chart of the North Sea and the Baltic with every kontor (a trading house's
// post abroad) the Hanse kept, yours lit and the rest waiting for later chapters, and the lanes between yours. A lane's
// hulks carry metal from one of your warehouses to another, a cargo a week each; the League is where you put them on,
// and where you see the whole company at once. The lanes' rules are in harbour-season.js, with the regions'.
import { REGIONS, LANES, SEASONS, regionOf, seasonOf, weekOf, setMRs, engineOf, netOf, lacks, laneCtx } from "./harbour-season.js";
import { signed } from "./harbour-season-ui.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = v => (Math.round(v * 10) / 10).toString();
const lower = name => name.replace(/^The /, "the ");

// the chart: longitude −10 to 36, latitude 62.5 to 49.5, 7.826 units a degree across and 13.85 up (about right for the
// 55th parallel, where a degree of longitude is just over half a degree of latitude)
const X = lon => (lon + 10) * 7.826, Y = lat => (62.5 - lat) * 13.846;
const ring = pts => pts.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(" ");
// The coasts of the League's seas, drawn by hand from the atlas: the Narrow Seas and the North Sea, the Danish straits
// (the Sound a little wider than it is, or it would close at this scale) and the Baltic. Land runs on past the chart's
// edges, where the edges cut it.
const LAND = [
  // the continent: Brittany to Flanders, the Dutch and German coast, Jutland, the Baltic's south and east shores, the
  // Gulf of Finland, and Finland's coast up the Gulf of Bothnia
  [[-5, 48.4], [-4.5, 48.4], [-3.8, 48.7], [-2, 48.65], [-1.5, 48.65], [-1.6, 49], [-1.95, 49.7], [-1.25, 49.7], [-1.2, 49.4], [-0.3, 49.3], [0.1, 49.5],
    [1.1, 49.9], [1.6, 50.2], [1.6, 50.75], [1.85, 50.97], [2.35, 51.05], [3.2, 51.35], [3.6, 51.45], [3.8, 51.65], [4.1, 52], [4.55, 52.45],
    [4.75, 52.95], [5.5, 53.4], [6.2, 53.45], [7, 53.3], [7.2, 53.6], [8, 53.7], [8.5, 53.55], [8.7, 53.9], [8.9, 54], [8.65, 54.3], [8.6, 54.5],
    [8.4, 55.5], [8.1, 56], [8.2, 56.7], [8.6, 57.1], [10.6, 57.75], [10.5, 57.4], [10.9, 56.45], [10.2, 56], [9.9, 55.5], [9.9, 55], [9.4, 54.8],
    [10.15, 54.35], [11.1, 54.45], [10.87, 53.96], [11.45, 53.9], [12.1, 54.15], [12.5, 54.45], [13.1, 54.3], [13.7, 54.5], [14.25, 53.9], [15.55, 54.2],
    [16.85, 54.6], [17.55, 54.75], [18.8, 54.7], [18.65, 54.35], [19.4, 54.35], [19.9, 54.65], [20.5, 54.7], [21.1, 55.7], [21, 56.5], [21.55, 57.4],
    [22.6, 57.75], [24.1, 56.95], [24.5, 58.4], [23.5, 58.95], [24.1, 59.35], [24.75, 59.45], [25.9, 59.6], [26.5, 59.5], [28, 59.47], [30.3, 59.9],
    [28.7, 60.7], [26.9, 60.45], [25.7, 60.35], [24.95, 60.17], [23, 59.8], [22.2, 60.45], [21.5, 61.1], [21.5, 61.5], [21.2, 62.35], [21, 66], [40, 66], [40, 45], [-5, 45]],
  // Scandinavia: Norway's coast from Alesund to the Skagerrak, the Oslofjord, Sweden's coast round to Gavle and up
  [[6.2, 62.5], [5, 61], [5.2, 60.4], [5.4, 59.2], [5.7, 58.97], [6.6, 58.1], [8, 58.15], [8.8, 58.45], [9.8, 59], [10.5, 59.1], [10.7, 59.9], [10.9, 59.3],
    [11.2, 58.9], [11.9, 57.7], [12.8, 56.7], [12.9, 56.05], [13.15, 55.45], [13.8, 55.4], [14.3, 55.5], [15.6, 56.2], [16.4, 56.7], [16.5, 57.4], [16.7, 58.6],
    [18, 59.3], [17.1, 60.7], [17.3, 62.5], [17.3, 66], [6.2, 66]],
  [[-5.7, 50.1], [-4.1, 50.4], [-2.4, 50.5], [-1.3, 50.7], [0.25, 50.75], [1.4, 51.1], [1.4, 51.4], [1, 51.8], [1.75, 52.5], [1.3, 52.95], [0.3, 52.95],
    [0.35, 53.15], [0.1, 53.6], [-0.1, 54.1], [-0.6, 54.5], [-1.2, 54.6], [-1.4, 55], [-2, 55.8], [-3, 56], [-2.8, 56.3], [-2.1, 57.15], [-1.8, 57.5],
    [-3.5, 57.7], [-3, 58.6], [-5, 58.6], [-5.6, 57.5], [-5.5, 56.5], [-5.8, 55.3], [-3.5, 54.9], [-3, 54], [-4.6, 53.3], [-4.2, 52.5], [-5.3, 51.9],
    [-3, 51.4], [-4.2, 51.2], [-5, 50.4]],
  [[-6, 52.2], [-6.3, 53.3], [-6, 54], [-5.5, 54.5], [-6.2, 55.2], [-8, 55.2], [-9.5, 54.3], [-10, 53.5], [-10, 51.8], [-8.5, 51.6], [-7, 52.1]],
  // the Baltic's islands: Zealand, Funen, Bornholm, Gotland, Oland, Saaremaa, Hiiumaa and the Aland islands
  [[11, 55.6], [11.8, 56], [12.45, 56.05], [12.5, 55.6], [12.2, 55.15], [12, 54.75], [11.8, 54.57], [11.2, 54.7], [11, 54.95], [11.6, 55.3], [11, 55.3]],
  [[9.8, 55.3], [10.3, 55.65], [10.8, 55.5], [10.7, 55], [10.1, 55.05]],
  [[14.7, 55.15], [15.15, 55.1], [15, 55.3], [14.85, 55.28]],
  [[18.1, 57.2], [18.2, 57.9], [18.7, 57.95], [19.1, 57.85], [18.8, 57.5], [18.6, 57]],
  [[16.4, 56.2], [16.7, 56.6], [17.1, 57.35], [16.95, 57.3], [16.55, 56.8], [16.4, 56.45]],
  [[21.9, 58.2], [22.4, 58.6], [23.1, 58.5], [23, 58.1], [22.4, 58]],
  [[22, 58.85], [22.6, 59.1], [23, 58.9], [22.7, 58.6], [22.2, 58.6]],
  [[19.7, 60.1], [20.3, 60.45], [21, 60.3], [20.7, 59.95], [20, 59.9]],
];
// where each region sits: Reval, and the Zwin by Sluis; the ones with no region yet are the League's other kontors,
// the campaign still to come
const PLACES = {
  baltic: [24.75, 59.45], ara: [3.4, 51.3],
  med: [5.3, 60.4, "Bergen"], waf: [31.3, 58.5, "Novgorod"], usg: [10.7, 53.9, "Lübeck"], bra: [18.3, 57.6, "Visby"], ind: [18.65, 54.35, "Danzig"], sgp: [-0.1, 51.5, "London", "end"],
};
// each lane's way round the coasts: the Zwin to the Baltic up the North Sea, round Skagen, through the Sound and east of
// Gotland to Reval
const WAYS = { "ara-baltic": [[3.4, 51.3], [3, 51.7], [3.6, 52.5], [4.3, 54], [7.5, 54.6], [7.9, 55.6], [8, 57], [9.5, 58], [11, 57.9], [11.3, 57.2], [11.6, 56.5], [12.2, 56],
  [12.55, 55.6], [12.9, 55.2], [13.8, 54.95], [14.6, 54.8], [16.5, 55.4], [18.8, 56.4], [19.7, 57.4], [20.4, 58.6], [22.3, 59.7], [24.3, 59.7], [24.75, 59.45]] };

/** company(): the company as it stands; save(company); feeds(): ingots a week each region's harbours feed it;
 *  goTo(step): a region ("region:id") or a level. */
export function createWorldScreen({ root, brief, company, save, feeds, goTo }) {
  let on = false;
  function chart() {
    const c = company();
    let g = `<svg class="hw-world" viewBox="0 0 360 180" role="group" aria-label="The League's chart: your regions and the lanes between them"><rect class="hw-sea" width="360" height="180" rx="4"/>`;
    g += LAND.map(r => `<polygon class="hw-land" points="${ring(r)}"/>`).join("");
    for (const L of LANES) {
      const live = c.regions[L.from] && c.regions[L.to], mrs = live ? c.lanes[L.id].mrs : 0, way = WAYS[L.id];
      if (!live) continue;
      g += `<polyline class="hw-lane${mrs ? " on" : ""}" points="${ring(way)}"/>`;
      // a hulk halfway, heading the way the lane runs
      if (mrs) { const i = way.length >> 1, [lo, la] = way[i], [no, na] = way[i + 1], turn = Math.atan2(Y(na) - Y(la), X(no) - X(lo)) * 180 / Math.PI;
        g += `<g transform="translate(${X(lo).toFixed(1)} ${Y(la).toFixed(1)}) rotate(${turn.toFixed(0)})"><path class="hw-mr" d="M-6,-2H3L6,0L3,2H-6Z"/></g>`; }
    }
    for (const [id, [lo, la, name, side]] of Object.entries(PLACES)) {
      const R = regionOf(id), mine = R && c.regions[id], x = X(lo), y = Y(la);
      if (mine) g += `<g class="hw-tap" data-go="region:${id}" role="button" tabindex="0" aria-label="${esc(R.name)}"><circle class="hw-halo" cx="${x}" cy="${y}" r="7"/><circle class="hw-mine" cx="${x}" cy="${y}" r="4"/></g>`;
      else g += `<circle class="hw-later" cx="${x}" cy="${y}" r="2.6"/><text class="hw-later-name" x="${x + (side === "end" ? -5 : 5)}" y="${y + 3}" style="text-anchor:${side || "start"}">${esc(name || R?.name || "")}</text>`;
    }
    // your regions' names, set where they don't sit on each other
    const tag = (id, dx, dy, anchor) => c.regions[id] ? `<text class="hw-name" x="${(X(PLACES[id][0]) + dx).toFixed(1)}" y="${(Y(PLACES[id][1]) + dy).toFixed(1)}" style="text-anchor:${anchor}">${esc(regionOf(id).name)}</text>` : "";
    g += tag("baltic", 8, -6, "start") + tag("ara", 8, 12, "start");
    return g + `</svg>`;
  }
  function draw() {
    const c = company(), F = feeds();
    const net = Object.values(c.regions).reduce((a, s) => a + (netOf(s.last) || 0), 0);   // the company's net a week, last week
    const lanes = LANES.filter(L => c.regions[L.from] && c.regions[L.to]).map(L => {
      const l = c.lanes[L.id];
      return `<div class="hw-card"><div class="hw-card-head"><b>${esc(L.name)}</b><span class="hw-step"><button type="button" data-mrs="${L.id}:-1" ${l.mrs > 0 ? "" : "disabled"} aria-label="One hulk fewer">−</button><output>${l.mrs}</output><button type="button" data-mrs="${L.id}:1" ${l.mrs < L.mr.max ? "" : "disabled"} aria-label="One more hulk">+</button></span></div>`
        + `<p>${l.mrs ? `${l.mrs * L.mr.drops} a week of ${esc(lower(regionOf(L.from).name))}'s metal to ${esc(lower(regionOf(L.to).name))}` : "No hulk on it yet"}: ${L.mr.drops} a week a hulk, ${num(L.mr.hire)} a week to hire, at ${num(L.price)} an ingot. A cargo loads after ${esc(lower(regionOf(L.from).name))}'s contracts and lands the week after.</p></div>`;
    }).join("");
    const regions = REGIONS.filter(R => c.regions[R.id]).map(R => {
      const s = c.regions[R.id], e = s.solved ? engineOf(c, R.id, F) : null;
      return `<div class="hw-card hw-region"><div><b>${esc(R.name)}</b><span>${s.solved ? `Runs on its own · ${num(e)} a week` : `${SEASONS[seasonOf(s)]}, week ${weekOf(s) + 1}`} · ★ ${s.stars}${s.last && !s.solved ? ` · ${signed(netOf(s.last))} a week` : ""}</span></div><button type="button" class="btn" data-go="region:${R.id}">Open</button></div>`;
    }).join("");
    const L = LANES[0], lane = c.lanes[L.id], to = c.regions[L.to];
    const hint = !c.regions[L.from] ? `Open ${lower(regionOf(L.from).name)} to start its warehouse.`
      : !lane.mrs ? `Put a hulk on the lane: ${lower(regionOf(L.to).name)}'s long-term contracts need ${lower(regionOf(L.from).name)}'s metal.`
      : to && !to.solved && seasonOf(to) >= 2 ? (lacks(regionOf(L.to), { season: 2 }, laneCtx(c, L.to, F))
        ? `The lane's running: ${lower(regionOf(L.to).name)}'s long-term contracts also want more of its harbours' ingots.`
        : `The lane's running: take ${lower(regionOf(L.to).name)}'s long-term contracts.`)
      : "Every region runs on the company's clock: a week played in one is played in all.";
    root.innerHTML = `<div class="hs-hud"><span class="hs-when"><b>The League</b> · week ${c.week}</span><span class="hs-score"><span class="hs-coins" title="Net a week, every region together, last week">${signed(net)} a week</span></span></div>
      <div class="hs-boardbox">${chart()}</div>${lanes}${regions}<p class="hs-status hb-status" aria-live="polite">${esc(hint)}</p>`;
  }
  root.addEventListener("click", e => {
    if (!on) return;
    const t = e.target.closest("[data-go], [data-mrs]");
    if (!t) return;
    if (t.dataset.go) { goTo(t.dataset.go); return; }
    const [lane, by] = t.dataset.mrs.split(":");
    save(setMRs(company(), lane, company().lanes[lane].mrs + +by));
    draw();
  });
  root.addEventListener("keydown", e => { if (on && (e.key === "Enter" || e.key === " ") && e.target.dataset?.go) { e.preventDefault(); goTo(e.target.dataset.go); } });
  return {
    open() { on = true; brief.textContent = "Your regions on the League's chart, the lanes between them, and the kontors still to come."; root.hidden = false; root.scrollTop = 0; draw(); },
    close() { on = false; root.hidden = true; root.innerHTML = ""; },
    active: () => on,
    redraw() { if (on) draw(); },
  };
}
