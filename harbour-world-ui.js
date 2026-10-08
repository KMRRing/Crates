// Harbour's world: a chart of the oceans with every region a trading house could work, yours lit and the rest waiting
// for later chapters, and the lanes between yours. A lane's MRs carry diesel from one of your terminals to another, a
// cargo a week each; the world is where you put them on, and where you see the whole company at once. The lanes' rules
// are in harbour-season.js, with the regions'.
import { REGIONS, LANES, SEASONS, regionOf, seasonOf, weekOf, setMRs, engineOf } from "./harbour-season.js";
import { coins as whole } from "./harbour-season-ui.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = v => (Math.round(v * 10) / 10).toString();

// the chart: longitude −100 to 125, latitude 72 to −40, 1.6 units a degree
const X = lon => (lon + 100) * 1.6, Y = lat => (72 - lat) * 1.6;
const ring = pts => pts.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(" ");
const LAND = [
  [[-100, 68], [-80, 72], [-62, 60], [-55, 50], [-65, 45], [-75, 38], [-80, 30], [-81, 25], [-90, 29], [-97, 26], [-100, 20]],
  [[-100, 20], [-90, 16], [-83, 9], [-77, 8], [-80, 12], [-88, 20], [-97, 24], [-100, 24]],
  [[-80, 10], [-62, 11], [-50, 0], [-35, -8], [-40, -22], [-48, -28], [-57, -38], [-65, -40], [-72, -40], [-75, -15], [-81, -5]],
  [[-55, 60], [-42, 60], [-20, 70], [-35, 72], [-60, 72]],
  // Europe, the North Sea and the Baltic cut into it (the lane runs through the Danish straits)
  [[-9, 37], [-9, 43], [-2, 43.5], [-4.5, 48.5], [0, 49.5], [2, 51], [4.3, 52], [5, 53.3], [8, 54], [8.3, 57], [10.5, 57.7], [10.5, 56.5],
    [12.4, 55.6], [11, 54.5], [14, 54], [18.5, 54.8], [21, 55.5], [21, 57], [24, 57], [23.5, 58.5], [24, 59.4], [28, 59.5], [30, 60], [28, 60.5],
    [22.5, 60], [21.5, 61.5], [25, 65], [24, 66], [21, 64.5], [17, 62], [18.5, 60], [18, 59], [16.5, 57], [14.5, 56], [13, 55.5], [12.8, 56],
    [12, 57.7], [11, 59], [8, 58], [5, 59], [5, 62], [10, 64], [15, 69], [25, 71], [33, 69], [40, 66], [44, 68], [60, 68], [60, 45], [42, 42],
    [28, 41], [26, 38], [20, 40], [15, 38], [12, 44], [8, 44], [3, 43], [-5, 36]],
  [[-10, 51.5], [-6, 58], [-2, 58.5], [1.5, 52.5], [-5, 50]],
  [[-17, 21], [-17, 15], [-8, 5], [5, 4], [9, 4], [10, -2], [13, -12], [12, -17], [18, -35], [28, -33], [35, -22], [40, -12], [40, -2], [51, 11], [43, 12], [37, 22], [33, 31], [25, 32], [11, 37], [-6, 36], [-10, 30]],
  [[35, 32], [36, 37], [42, 42], [60, 45], [60, 68], [125, 72], [125, 40], [122, 30], [121, 22], [110, 20], [105, 10], [103, 1.5], [100, 13], [97, 17], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [56, 22], [52, 17], [45, 13], [42, 16], [35, 28]],
  [[95, 5], [105, -6], [120, -8], [119, 5], [110, 2]],
  [[114, -22], [125, -14], [125, -36], [115, -34]],
];
// where each region sits; the ones with no region yet are the campaign still to come
const PLACES = {
  baltic: [25, 59.5], ara: [4.3, 51.9],
  med: [14, 37, "The Med"], waf: [3.4, 6.4, "West Africa"], usg: [-95, 29.7, "US Gulf"], bra: [-46, -24, "Brazil"], ind: [69, 22.4, "India"], sgp: [103.8, 1.3, "Singapore"],
};
// each lane's way round the coasts: ARA to the Baltic up the North Sea, round Skagen and through the Sound
const WAYS = { "ara-baltic": [[4.3, 51.9], [4, 54], [7.5, 57.5], [9.5, 58], [11.6, 57], [12.7, 55.8], [15, 55.2], [19.5, 57], [22, 59], [24.5, 59.75], [25, 59.5]] };

/** company(): the company as it stands; save(company); feeds(): drops a week each region's harbour feeds it;
 *  goTo(step): a region ("region:id") or a level. */
export function createWorldScreen({ root, brief, company, save, feeds, goTo }) {
  let on = false;
  function chart() {
    const c = company();
    let g = `<svg class="hw-world" viewBox="0 0 360 180" role="group" aria-label="The world: your regions and the lanes between them"><rect class="hw-sea" width="360" height="180" rx="4"/>`;
    g += LAND.map(r => `<polygon class="hw-land" points="${ring(r)}"/>`).join("");
    for (const L of LANES) {
      const live = c.regions[L.from] && c.regions[L.to], mrs = live ? c.lanes[L.id].mrs : 0, way = WAYS[L.id];
      if (!live) continue;
      g += `<polyline class="hw-lane${mrs ? " on" : ""}" points="${ring(way)}"/>`;
      // an MR halfway, heading the way the lane runs
      if (mrs) { const i = way.length >> 1, [lo, la] = way[i], [no, na] = way[i + 1], turn = Math.atan2(Y(na) - Y(la), X(no) - X(lo)) * 180 / Math.PI;
        g += `<g transform="translate(${X(lo).toFixed(1)} ${Y(la).toFixed(1)}) rotate(${turn.toFixed(0)})"><path class="hw-mr" d="M-6,-2H3L6,0L3,2H-6Z"/></g>`; }
    }
    for (const [id, [lo, la, name]] of Object.entries(PLACES)) {
      const R = regionOf(id), mine = R && c.regions[id], x = X(lo), y = Y(la);
      if (mine) g += `<g class="hw-tap" data-go="region:${id}" role="button" tabindex="0" aria-label="${esc(R.name)}"><circle class="hw-halo" cx="${x}" cy="${y}" r="7"/><circle class="hw-mine" cx="${x}" cy="${y}" r="4"/></g>`;
      else g += `<circle class="hw-later" cx="${x}" cy="${y}" r="2.6"/><text class="hw-later-name" x="${x + 5}" y="${y + 3}">${esc(name || R?.name || "")}</text>`;
    }
    // your regions' names, set where they don't sit on each other
    const tag = (id, dx, dy, anchor) => c.regions[id] ? `<text class="hw-name" x="${(X(PLACES[id][0]) + dx).toFixed(1)}" y="${(Y(PLACES[id][1]) + dy).toFixed(1)}" style="text-anchor:${anchor}">${esc(regionOf(id).name)}</text>` : "";
    g += tag("baltic", 8, -6, "start") + tag("ara", -8, 10, "end");
    return g + `</svg>`;
  }
  function draw() {
    const c = company(), F = feeds();
    const coins = Object.values(c.regions).reduce((a, s) => a + s.coins, 0);
    const lanes = LANES.filter(L => c.regions[L.from] && c.regions[L.to]).map(L => {
      const l = c.lanes[L.id];
      return `<div class="hw-card"><div class="hw-card-head"><b>${esc(L.name)}</b><span class="hw-step"><button type="button" data-mrs="${L.id}:-1" ${l.mrs > 0 ? "" : "disabled"} aria-label="One MR fewer">−</button><output>${l.mrs}</output><button type="button" data-mrs="${L.id}:1" ${l.mrs < L.mr.max ? "" : "disabled"} aria-label="One more MR">+</button></span></div>`
        + `<p>${l.mrs ? `${l.mrs * L.mr.drops} a week of ${esc(regionOf(L.from).name)}'s diesel to ${esc(regionOf(L.to).name.replace(/^The /, "the "))}` : "No MR on it yet"}: ${L.mr.drops} a week an MR, ${num(L.mr.hire)} a week to hire, at ${num(L.price)} a drop. A cargo loads after ${esc(regionOf(L.from).name)}'s contracts and lands the week after.</p></div>`;
    }).join("");
    const regions = REGIONS.filter(R => c.regions[R.id]).map(R => {
      const s = c.regions[R.id], e = s.solved ? engineOf(c, R.id, F) : null;
      return `<div class="hw-card hw-region"><div><b>${esc(R.name)}</b><span>${s.solved ? `Runs on its own · ${num(e)} a week` : `${SEASONS[seasonOf(s)]}, week ${weekOf(s) + 1}`} · ★ ${s.stars} · ${whole(s.coins)} coins</span></div><button type="button" class="btn" data-go="region:${R.id}">Open</button></div>`;
    }).join("");
    const L = LANES[0], lane = c.lanes[L.id], to = c.regions[L.to];
    const hint = !c.regions[L.from] ? `Open ${regionOf(L.from).name} to start its terminal.`
      : !lane.mrs ? `Put an MR on the lane: ${regionOf(L.to).name.replace(/^The /, "the ")}'s long-term contracts need ${regionOf(L.from).name}'s diesel.`
      : to && !to.solved && seasonOf(to) >= 2 ? `The lane's running: take ${regionOf(L.to).name.replace(/^The /, "the ")}'s long-term contracts.`
      : "Every region runs on the company's clock: a week played in one is played in all.";
    root.innerHTML = `<div class="hs-hud"><span class="hs-when"><b>The world</b> · week ${c.week}</span><span class="hs-score"><span class="hs-coins" title="Coins, every region together">${whole(coins)}</span></span></div>
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
    open() { on = true; brief.textContent = "Your regions on the world's chart, the lanes between them, and the regions still to come."; root.hidden = false; root.scrollTop = 0; draw(); },
    close() { on = false; root.hidden = true; root.innerHTML = ""; },
    active: () => on,
    redraw() { if (on) draw(); },
  };
}
