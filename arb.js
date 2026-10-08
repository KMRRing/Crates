// Arb: get from one thing to another through the knowledge base's links, as cheaply as you can. Every step costs
// more the better-connected the thing you step onto: an obscure link costs 1, the United States about 9 (1 + log2 of
// its links), so the cheap route runs through what you specifically know, not through the hubs. Par is the cheapest
// route there is; matching it scores 100. Five routes a run, random or today's; every hop shows why the two are
// linked, and the end shows the cheapest route.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)
import "./pwa.js";

const $ = id => document.getElementById(id);
const PER_RUN = 5;
const RUN = "arb:run", BEST = "arb:best", DAILY = "arb:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- the graph ----------
const ENT = new Map(ENTITIES.map(e => [e.id, e]));
const CANON = id => ENT.get(id)?.same || id;   // a duplicate entry stands for the one it duplicates
const NEAR = new Map();                                     // id → Map(neighbour → why they're linked)
for (const l of LINKS) {
  if (!ENT.has(l.from) || !ENT.has(l.to) || l.from === l.to) continue;
  const why = l.hint || ({ in: "is in", "painted-by": "painted by", "hangs-in": "hangs in", movement: "belongs to", "designed-by": "designed by", style: "in the style of", city: "stands in" }[l.rel] || "");
  const [f, t] = [CANON(l.from), CANON(l.to)];
  if (f === t) continue;
  for (const [a, b] of [[f, t], [t, f]]) {
    if (!NEAR.has(a)) NEAR.set(a, new Map());
    if (!NEAR.get(a).has(b)) NEAR.get(a).set(b, { why, from: f });
  }
}
const degree = id => NEAR.get(id)?.size || 0;
/** What stepping onto a thing costs: 1 for an obscure one, more the better-connected it is. */
export const cost = id => 1 + Math.log2(Math.max(1, degree(id)));
const name = id => { const e = ENT.get(id); return e ? (e.qualifier ? `${e.name} (${e.qualifier})` : e.name) : id; };
const kind = id => (ENT.get(id)?.sets || []).find(s => !s.startsWith("group:")) || "";
/** The cheapest route from a to everything (Dijkstra, paying for each thing stepped onto). */
function cheapest(a) {
  const dist = new Map([[a, 0]]), prev = new Map(), hops = new Map([[a, 0]]), done = new Set();
  const queue = [[0, a]];
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[bi][0]) bi = i;
    const [d, u] = queue.splice(bi, 1)[0];
    if (done.has(u)) continue;
    done.add(u);
    for (const v of NEAR.get(u)?.keys() || []) {
      const nd = d + cost(v);
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); hops.set(v, hops.get(u) + 1); queue.push([nd, v]); }
    }
  }
  return { dist, prev, hops };
}
const routeTo = (prev, a, b) => { const r = [b]; while (r[0] !== a) r.unshift(prev.get(r[0])); return r; };
// the ends of a route: things with a few links (not hubs, not dead ends)
const ENDS = [...NEAR.keys()].filter(id => degree(id) >= 2 && degree(id) <= 25).sort();
/** A route for this seed: a start, and an end three to five hops away by the cheapest route. */
export function makeRoute(r) {
  for (let tries = 0; tries < 60; tries++) {
    const a = ENDS[Math.floor(r() * ENDS.length)], { dist, prev, hops } = cheapest(a);
    const far = ENDS.filter(b => b !== a && hops.get(b) >= 3 && hops.get(b) <= 5 && kind(b) !== kind(a) && !NEAR.get(a).has(b));
    if (!far.length) continue;
    const b = far[Math.floor(r() * far.length)];
    return { a, b, par: dist.get(b), parRoute: routeTo(prev, a, b) };
  }
  return null;
}

// ---------- a run ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(daily) {
  const seed = daily ? today() * 7919 + 29 : Math.floor(Math.random() * 2 ** 31), r = rng(seed);
  const routes = [];
  while (routes.length < PER_RUN) { const x = makeRoute(r); if (x) routes.push({ ...x, path: [x.a], done: null, points: 0 }); }
  S = { seed, daily, index: 0, total: 0, routes };
  save(); render();
}
const R = () => S.routes[S.index];
const spent = path => path.slice(1).reduce((t, id) => t + cost(id), 0);
function hop(id) {
  const x = R();
  if (x.done) return;
  x.path.push(id);
  if (id === x.b) { x.done = "arrived"; x.points = Math.round(100 * x.par / spent(x.path)); S.total += x.points; }
  $("filter").value = "";
  save(); render();
}
function back() { const x = R(); if (!x.done && x.path.length > 1) { x.path.pop(); save(); render(); } }
function giveUp() { const x = R(); if (!x.done) { x.done = "gave up"; x.points = 0; save(); render(); } }
function next() {
  if (S.index + 1 < S.routes.length) { S.index++; save(); render(); return; }
  S.over = true; save();
  const best = read(BEST, 0); if (S.total > best) write(BEST, S.total);
  if (S.daily) { const d = read(DAILY, {}); if (!(d[today()] >= S.total)) { d[today()] = S.total; write(DAILY, d); } }
  finish();
}

// ---------- drawing ----------
const fmtCost = c => (Math.round(c * 10) / 10).toLocaleString("en-GB");
/** A route as a list: each thing, and why it's linked to the one before. */
function drawPath(box, path) {
  box.replaceChildren(...path.map((id, i) => {
    const li = document.createElement("li"), b = document.createElement("b");
    b.textContent = name(id);
    li.append(b);
    if (i > 0) {
      const link = NEAR.get(path[i - 1]).get(id), why = document.createElement("span");
      why.textContent = link.why ? `${link.from === id ? name(id) : name(path[i - 1])}: ${link.why}` : "";
      li.append(why);
    }
    return li;
  }));
}
function render() {
  if (!S) { newRun(false); return; }
  const x = R(), here = x.path[x.path.length - 1];
  $("where").textContent = `Route ${S.index + 1} of ${S.routes.length}${S.daily ? " · today's" : ""}`;
  $("score").innerHTML = `Score <b>${S.total}</b>`;
  $("from").textContent = name(x.a); $("to").textContent = name(x.b);
  $("par").textContent = `Par ${fmtCost(x.par)} · spent ${fmtCost(spent(x.path))}`;
  drawPath($("path"), x.path);
  $("path").lastElementChild?.scrollIntoView({ block: "nearest" });
  const playing = !x.done;
  $("pick").hidden = !playing;
  $("result").hidden = playing;
  if (playing) {
    $("backBtn").disabled = x.path.length < 2;
    const filter = $("filter").value.trim().toLowerCase();
    // no dead ends: a link is offered only if it leads somewhere new (the goal always is), so a step never forces a
    // step back; a thing whose only link is the one you came along, or whose links all lead back onto your route, isn't
    const onward = id => id === x.b || [...NEAR.get(id).keys()].some(n => n !== here && !x.path.includes(n));
    const options = [...NEAR.get(here).keys()].filter(id => !x.path.includes(id) && onward(id) && (!filter || name(id).toLowerCase().includes(filter)))
      .sort((p, q) => (p === x.b ? -1 : q === x.b ? 1 : name(p).localeCompare(name(q))));
    $("links").replaceChildren(...options.map(id => {
      const li = document.createElement("li"), btn = document.createElement("button");
      btn.type = "button"; btn.className = `ab-link${id === x.b ? " goal" : ""}`;
      btn.innerHTML = "<b></b><small></small><span class=\"ab-cost\"></span>";
      btn.firstChild.textContent = name(id);
      btn.children[1].textContent = kind(id);
      btn.lastChild.textContent = fmtCost(cost(id));
      btn.setAttribute("aria-label", `${name(id)}, costs ${fmtCost(cost(id))}`);
      btn.addEventListener("click", () => hop(id));
      li.append(btn); return li;
    }));
    $("links").scrollTop = 0;
  } else {
    const arrived = x.done === "arrived";
    $("verdict").className = `ab-verdict ${arrived ? "good" : "bad"}`;
    $("verdict").textContent = arrived ? `Arrived for ${fmtCost(spent(x.path))}: +${x.points}` : `The cheapest route cost ${fmtCost(x.par)}`;
    $("note").textContent = arrived ? (x.points >= 100 ? "That's par: the cheapest route there is." : `Par was ${fmtCost(x.par)}, this way:`) : "This way:";
    drawPath($("parPath"), x.parRoute);
    $("parPath").hidden = arrived && x.points >= 100;
    $("nextBtn").textContent = S.index + 1 < S.routes.length ? "Next route" : "Finish";
  }
}
function finish() {
  const body = $("doneBody");
  body.replaceChildren();
  const p = document.createElement("p");
  p.className = "ab-sum";
  p.textContent = `${S.total} of ${PER_RUN * 100}: ${S.routes.filter(x => x.done === "arrived").length} of ${S.routes.length} routes made.`;
  body.append(p, action("Another run", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  $("doneDlg").showModal();
}

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= S?.daily ? "daily" : "random";
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  part(body, "content").append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  const best = read(BEST, 0), day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${best}` : "No finished run yet"}${day != null ? `, today ${day}` : ""} · ${NEAR.size.toLocaleString("en-GB")} things, linked`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".ab-mark").innerHTML = APPS.find(a => a.id === "arb").logo;
bindSwitcher($("appsBtn"), "arb");
$("filter").addEventListener("input", render);
$("backBtn").addEventListener("click", back);
$("giveBtn").addEventListener("click", () => { if (confirm("Give up on this route?")) giveUp(); });
$("nextBtn").addEventListener("click", next);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
if (S?.over) newRun(false); else render();
