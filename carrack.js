// Carrack against computer players, or at a table with friends each on their own phone. The rules are carrack-rules.js's,
// the computer players carrack-bot.js's, the running seats.js's (seats-ui.js). This page draws the map (36 ports on a
// schematic board), takes your secret orders (up to three, built one at a time and checked by the rules as you go), and
// tells the year that resolved: what each power did, the dice, the era's events set down plainly, the standings.
import {
  rules, POWERS, ERAS, LEVELS, EVENTS, COST, CAP, MAX_ORDERS, SILVER_PER_POINT, checkOrders, orderCost, reach, attackOdds, standing, incomeOf, held, factors,
  hasFactor, sourcesOf, portValue, closedTo, active, fleetsAt,
} from "./carrack-rules.js";
import { PORTS, LANES, GOODS, REGIONS, BY_REGION, W, H, labelBox } from "./carrack-map.js";
import { createGlobe } from "./carrack-board.js";
import { seatPage } from "./seats-ui.js";
import { shuffle } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { sure } from "./sure.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { wants3D, onDefaultChange } from "./mode3d.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const LEVEL_NAMES = LEVELS.map(l => [l, l[0].toUpperCase() + l.slice(1)]);
const OPTS = "carrack:opts", RECORD = "carrack:record", DRAFT = "carrack:draft", SEEN = "carrack:seen";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const SHORT = { hanse: "Hanse", portugal: "Portugal", venice: "Venice", ottomans: "Ottomans", ming: "Ming", gujarat: "Gujarat", malacca: "Malacca", ryukyu: "Ryukyu", swahili: "Swahili" };
const ERA_TITLES = ["Before the Cape", "The Cape route", "Egypt falls, silver begins", "Silver and the coast", "The galleons", "The companies", "The Spice Islands", "Doors closing"];
/** Events that record enslavement, forced labour or an attack on a people: shown with a plain tag, and they cost grievance, never pay. */
const HARM = new Set(["afonso", "eastafrica", "mita", "banda", "kilwa", "goa", "malacca"]);
const REGION_NAMES = ["BALTIC", "ATLANTIC", "MEDITERRANEAN", "WEST AFRICA", "SWAHILI COAST", "ARABIAN SEA", "BAY OF BENGAL", "SOUTH CHINA SEA", "JAPAN"];

let opts = { level: "medium", n: 4, mine: "random", ...read(OPTS, {}) };
const saveOpts = () => write(OPTS, opts);
// how the map is looked at: the globe or the flat schematic, and whether the panel below it is folded away
const VIEW = "carrack:view";
const look = { min: false, ...read(VIEW, {}) };
// look.view ("globe" or "flat") is the player's own choice, kept only when they make one; with none the suite's default (mode3d.js)
// applies. (look.map was the old key and wrote "globe", the default, into every save: only its "flat" is carried over.)
if (look.map === "flat" && !look.view) look.view = "flat";
delete look.map;
if (look.view !== "globe" && look.view !== "flat") delete look.view;
const mapNow = () => (wants3D(look.view, "globe") ? "globe" : "flat");
const saveLook = () => write(VIEW, look);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- what the page holds besides the game ----------
// ui: the tab, the port picked, a sail being planned, and the orders drafted so far (kept per game and year in DRAFT, so a
// reload doesn't lose them; they are yours alone and go to the table only when sent)
const ui = { tab: "orders", sel: null, sail: null, to: null, n: 1, draft: [], draftKey: "", roundKey: "" };
let V = null, page = null;
const randomRounds = seatRounds("carrack");   // random mode's round: a game

page = seatPage({
  rules, id: "carrack", app: 1, pace: 650, level: () => opts.level, voice: () => false,
  botName: (seat, G) => POWERS[G?.state?.pw?.[seat]]?.name || `Seat ${seat + 1}`,
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const powerName = seat => (V?.state ? POWERS[V.state.pw[seat]]?.name ?? `Seat ${seat + 1}` : `Seat ${seat + 1}`);
const shortName = seat => SHORT[POWERS[V.state.pw[seat]]?.id] ?? powerName(seat);
const isMe = seat => V?.seat != null && seat === V.seat;
const seatColour = seat => `var(--p${seat})`;
const dot = seat => `<i class="cr-dot" style="background:${seatColour(seat)}"></i>`;
const nameOf = seat => (seat === -2 ? "the people of the port" : powerName(seat));

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("flat").innerHTML = ""; $("panel").innerHTML = ""; $("tabs").innerHTML = ""; $("strip").textContent = ""; drawBar(); return; }
  const s = v.state, seat = v.seat;
  // a new year (or game): the draft is read back for this year or started again, the year's tab shows what happened
  const roundKey = `${v.G.seq}:${s.round}:${s.step}`;
  if (roundKey !== ui.roundKey) {
    const first = ui.roundKey === "";
    ui.roundKey = roundKey;
    ui.sel = null; ui.sail = null; ui.to = null; ui.n = 1;
    ui.turned = !first;                       // the globe turns to last year's ports, once it is drawn
    if (!first && s.hist.length && seat != null) ui.tab = "year";
  }
  const dKey = `${v.G.seq}:${s.round}:${seat}`;
  if (dKey !== ui.draftKey) {
    ui.draftKey = dKey;
    const saved = read(DRAFT, null);
    ui.draft = saved?.k === dKey && Array.isArray(saved.orders) ? saved.orders : [];
  }
  drawStrip(s, seat);
  drawBoard(s, seat);
  drawTabs(s);
  drawPanel(s, seat);
  drawBar();
}
const saveDraft = () => write(DRAFT, { k: ui.draftKey, orders: ui.draft });

function drawStrip(s, seat) {
  const [a, b] = ERAS[Math.min(s.round, ERAS.length) - 1];
  if (s.step === "over") { $("strip").innerHTML = `<b>Game over</b> · ${ERAS[0][0]}–${b}`; return; }
  let t = `<b>${a}–${b}</b> · year <b>${s.round}</b> of ${s.opts.rounds}`;
  if (seat != null) {
    t += ` · silver <b>${s.si[seat]}</b>`;
    if (s.gr[seat]) t += ` · <span class="cr-bad">grievance ${s.gr[seat]}</span>`;
  }
  $("strip").innerHTML = t;
}

// ---------- the map ----------
const lanePath = l => {
  const a = PORTS[l.a], b = PORTS[l.b];
  const pts = [[a.x, a.y], ...(l.via || []), [b.x, b.y]];
  return "M" + pts.map(p => p.join(" ")).join("L");
};
const centroids = BY_REGION.map(list => [list.reduce((t, i) => t + PORTS[i].x, 0) / list.length, list.reduce((t, i) => t + PORTS[i].y, 0) / list.length]);

/** What stands at a port: [{ seat, n }] fleets, and the seats with a factor there. */
const fleetsHere = (s, p) => Array.from({ length: s.n }, (_, k) => ({ seat: k, n: s.fl[k][p] })).filter(f => f.n > 0);
const factorsHere = (s, p) => Array.from({ length: s.n }, (_, k) => k).filter(k => s.own[p] !== k && hasFactor(s, p, k));

let globe = null;
function drawBoard(s, seat) {
  const reachSet = ui.sail != null && seat != null ? reach(s, seat, ui.sail) : null;
  const onGlobe = mapNow() === "globe";
  $("board").classList.toggle("globe", onGlobe);
  $("flat").hidden = onGlobe;
  $("globe").hidden = !onGlobe;
  $("mapReset").hidden = !onGlobe;
  $("app").classList.toggle("cr-min", look.min);
  $("panelBtn").setAttribute("aria-expanded", String(!look.min));
  $("panelBtn").classList.toggle("on", look.min);
  $("panelBtn").textContent = look.min ? "Panel" : "Full map";
  if (!onGlobe) { drawFlat(s, seat, reachSet); return; }
  globe ??= createGlobe($("globe"), { onTap: p => { if (V?.G) tapPort(p); } });
  globe.render({ lanes: LANES.filter(l => active(s, l.a) && active(s, l.b)), ports: PORTS.filter(p => active(s, p.i)).map(p => portModel(s, p, reachSet)) });
  // the globe follows the play: to the ports of a sail being planned, and (once) to the ports of last year
  const key = `${ui.sail}:${ui.to}`;
  if (key !== ui.lookKey) { ui.lookKey = key; if (ui.sail != null) globe.focus(ui.to != null ? [ll(ui.sail), ll(ui.to)] : [ll(ui.sail), ...[...reachSet.keys()].map(ll)]); }
  if (ui.turned) { ui.turned = false; globe.focus(yearPorts(s).map(ll)); }
}
const ll = i => [PORTS[i].lon, PORTS[i].lat];
/** The ports last year's deeds name, for the globe to turn to. */
function yearPorts(s) {
  const text = s.log.filter(l => !isEventLine(l) && !l.startsWith("Income:")).join("\n");
  return PORTS.filter(p => text.includes(p.name)).map(p => p.i);
}
/** The ports an order is about. */
const orderPorts = o => (o.t === "move" ? [o.from, o.to] : o.port != null ? [o.port] : []);
function portModel(s, p, reachSet) {
  const own = s.own[p.i];
  const cls = [ui.sel === p.i && "sel", reachSet?.has(p.i) && "reach", ui.sail === p.i && "from", reachSet && !reachSet.has(p.i) && ui.sail !== p.i && "dim"].filter(Boolean).join(" ");
  return {
    i: p.i, name: p.name, lon: p.lon, lat: p.lat, lab: p.lab, value: p.value, cls, free: own < 0, fill: own >= 0 ? seatColour(own) : "", fort: !!s.fort[p.i],
    ring: ui.sel === p.i || ui.sail === p.i ? "on" : reachSet?.has(p.i) ? "reach" : null,
    items: [...fleetsHere(s, p.i).map(f => ({ kind: "fleet", n: f.n, fill: seatColour(f.seat) })), ...factorsHere(s, p.i).map(k => ({ kind: "fac", fill: seatColour(k) }))],
  };
}
/** Where each port's fleets and factors sit on the flat map: the first place round the dot that no name, dot or other chips
 *  are on (below it, above, beside, then further out), so a crowded coast (Guangzhou, Yuegang, Ningbo) stays readable. */
function chipSpots(s) {
  const here = PORTS.filter(p => active(s, p.i)), hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const taken = [...here.map(labelBox), ...here.map(p => ({ x: p.x - 4.5, y: p.y - 4.5, w: 9, h: 9 }))], spots = new Map();
  for (const p of here) {
    const n = fleetsHere(s, p.i).length + factorsHere(s, p.i).length;
    if (!n) continue;
    const w = n * 8.5 - 1.5, h = 7;
    const boxes = [[-w / 2, 6], [-w / 2, -13], [6, -3.5], [-6 - w, -3.5], [-w / 2, 14], [-w / 2, -21], [8, 4], [-8 - w, 4]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, w, h }));
    const pick = boxes.find(b => b.x >= 0 && b.x + w <= W && b.y >= 0 && b.y + h <= H && !taken.some(o => hit(o, b))) || boxes[0];
    taken.push(pick); spots.set(p.i, pick);
  }
  return spots;
}
function drawFlat(s, seat, reachSet) {
  let svg = `<svg class="cr-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="The map: 36 ports from the Baltic to Japan">`;
  svg += `<rect class="cr-sea" x="0" y="0" width="${W}" height="${H}" rx="4"/>`;
  REGION_NAMES.forEach((r, i) => {
    const half = r.length * 3.5 + 4;   // the name's half width at 8px with its letter spacing: kept inside the sea
    svg += `<text class="cr-region" x="${Math.min(W - half, Math.max(half, centroids[i][0])).toFixed(0)}" y="${(centroids[i][1] + (i === 0 ? -16 : i === 8 ? -22 : 20)).toFixed(0)}" text-anchor="middle">${r}</text>`;
  });
  for (const l of LANES) {
    const a = PORTS[l.a], b = PORTS[l.b];
    if (!active(s, l.a) || !active(s, l.b)) continue;
    svg += `<path class="cr-lane${[...l.f].map(c => " f" + c).join("")}" d="${lanePath(l)}"/>`;
    if (l.f.includes("p")) svg += `<text class="cr-pir" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 + 2.4}" text-anchor="middle">×</text>`;
  }
  const spots = chipSpots(s);
  for (const p of PORTS) {
    if (!active(s, p.i)) continue;
    const own = s.own[p.i], box = labelBox(p);
    const cls = ["cr-port", ui.sel === p.i && "sel", reachSet?.has(p.i) && "reach", ui.sail === p.i && "from", reachSet && !reachSet.has(p.i) && ui.sail !== p.i && "dim"].filter(Boolean).join(" ");
    svg += `<g class="${cls}" data-p="${p.i}">`;
    if (reachSet?.has(p.i)) svg += `<circle class="cr-ring" cx="${p.x}" cy="${p.y}" r="8"/>`;
    if (ui.sel === p.i || ui.sail === p.i) svg += `<circle class="cr-ring on" cx="${p.x}" cy="${p.y}" r="8"/>`;
    if (s.fort[p.i]) svg += `<rect class="cr-fort" x="${p.x - 5.6}" y="${p.y - 5.6}" width="11.2" height="11.2"/>`;
    svg += `<circle class="cr-dotp${own < 0 ? " free" : ""}" cx="${p.x}" cy="${p.y}" r="3.6"${own >= 0 ? ` style="fill:${seatColour(own)}"` : ""}/>`;
    svg += `<text class="cr-name" x="${box.x.toFixed(1)}" y="${(box.y + 6.3).toFixed(1)}">${esc(p.name)}</text>`;
    const items = [...fleetsHere(s, p.i).map(f => ({ ...f, kind: "fleet" })), ...factorsHere(s, p.i).map(k => ({ seat: k, kind: "fac" }))];
    if (items.length) {
      const spot = spots.get(p.i), y0 = +spot.y.toFixed(1);
      items.forEach((it, i) => {
        const x0 = spot.x + i * 8.5;
        if (it.kind === "fleet") svg += `<rect class="cr-chip" x="${x0.toFixed(1)}" y="${y0}" width="7" height="7" style="fill:${seatColour(it.seat)}"/><text class="cr-n" x="${(x0 + 3.5).toFixed(1)}" y="${y0 + 5.7}" text-anchor="middle">${it.n}</text>`;
        else svg += `<path class="cr-fac" d="M${(x0 + 3.5).toFixed(1)} ${y0 - .2}l3.7 3.7l-3.7 3.7l-3.7 -3.7z" style="fill:${seatColour(it.seat)}"/>`;
      });
    }
    svg += `</g>`;
  }
  // who is who, top right, with standings
  const order = Array.from({ length: s.n }, (_, k) => k).sort((a, b) => standing(s, b) - standing(s, a));
  order.forEach((k, i) => {
    const y = 12 + i * 11;
    svg += `<circle cx="238" cy="${y - 2.6}" r="3.4" style="fill:${seatColour(k)}"/><text class="cr-key${isMe(k) ? " me" : ""}" x="245" y="${y}">${esc(shortName(k))}${isMe(k) ? " (you)" : ""}</text><text class="cr-key num" x="383" y="${y}" text-anchor="end">${standing(s, k)}</text>`;
  });
  svg += `<text class="cr-key cap" x="238" y="${12 + s.n * 11 + 3}">STANDING NOW</text>`;
  svg += `</svg>`;
  $("flat").innerHTML = svg;
}
$("flat").addEventListener("click", e => {
  const svg = e.target.closest("svg");
  if (!svg || !V?.G) return;
  const r = svg.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  let best = -1, bd = 15 * 15;
  for (const p of PORTS) {
    if (!active(V.state, p.i)) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p.i; }
  }
  tapPort(best < 0 ? null : best);
});

function tapPort(p) {
  const s = V.state, seat = V.seat;
  if (ui.sail != null && p != null) {
    if (p === ui.sail) { ui.sail = null; ui.to = null; draw(); return; }
    const r = reach(s, seat, ui.sail);
    if (r.has(p)) { ui.to = p; ui.n = Math.min(ui.n, fleetsLeft(ui.sail)) || 1; ui.tab = "orders"; draw(); return; }
    toast(`${PORTS[p].name} is out of reach this year`);
    return;
  }
  ui.sel = p === ui.sel ? null : p;
  ui.sail = null; ui.to = null;
  if (p != null) ui.tab = "orders";
  draw();
}

// ---------- the tabs ----------
const TABS = [["orders", "Orders"], ["year", "Last year"], ["standing", "Standings"]];
function drawTabs(s) {
  $("tabs").innerHTML = TABS.map(([id, name]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" data-tab="${id}" class="${ui.tab === id ? "on" : ""}">${id === "year" && s.hist.length ? `Year ${s.hist.length}` : name}</button>`).join("");
}
$("tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  ui.tab = b.dataset.tab;
  draw();
});

function drawPanel(s, seat) {
  const box = $("panel"), keep = box.scrollTop, same = box.dataset.tab === ui.tab;
  box.dataset.tab = ui.tab;
  box.innerHTML = ui.tab === "orders" ? ordersHtml(s, seat) : ui.tab === "year" ? yearHtml(s) : standingHtml(s);
  box.scrollTop = same ? keep : 0;
}

// ---------- orders ----------
const fleetsLeft = p => V.state.fl[V.seat][p] - ui.draft.filter(o => o.t === "move" && o.from === p).reduce((t, o) => t + o.n, 0);
const test = o => checkOrders(V.state, V.seat, [...ui.draft, o]);
const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

function orderText(s, o) {
  const pn = i => PORTS[i].name;
  switch (o.t) {
    case "move": return `${o.atk != null ? "Attack" : "Sail"} with ${plural(o.n, "fleet")}: ${pn(o.from)} → ${pn(o.to)}${o.atk != null ? ` (${o.atk === -2 ? "the port's people" : powerName(o.atk)})` : ""}`;
    case "factor": return `Found a factor at ${pn(o.port)}`;
    case "build": return `Build a fleet at ${pn(o.port)}`;
    case "fort": return `Build a fort at ${pn(o.port)}`;
    case "claim": return `Claim ${pn(o.port)} by treaty`;
    case "refit": return "Buy ocean ships";
    case "redress": return "Pay compensation: one grievance token less";
    default: return "Pass";
  }
}
const costTag = (s, seat, o) => { const c = orderCost(s, seat, o); return c ? `<span class="cr-cost">${c} silver</span>` : ""; };

function draftHtml(s, seat, list, sent) {
  const spend = list.reduce((t, o) => t + orderCost(s, seat, o), 0);
  const inc = incomeOf(s, seat)[0];
  let h = sent ? "" : `<p class="cr-silver"><b>Orders ${list.length} of ${MAX_ORDERS}</b> · silver ${s.si[seat]}${spend ? ` → ${s.si[seat] - spend}` : ""} · income ${inc >= 0 ? "+" : ""}${inc} a year</p>`;
  if (list.length) {
    h += `<ol class="cr-draft${sent ? " sent" : ""}">`;
    list.forEach((o, i) => {
      if (o.t === "pass") h += `<li><span>No orders: the year passes</span></li>`;
      else h += `<li><span data-act="look" data-i="${i}">${esc(orderText(s, o))}${costTag(s, seat, o)}</span>${sent ? "" : `<button type="button" class="cr-x" data-act="drop" data-i="${i}" aria-label="Remove this order">×</button>`}</li>`;
    });
    h += `</ol>`;
  }
  return h;
}

function ordersHtml(s, seat) {
  const [a, b] = ERAS[Math.min(s.round, ERAS.length) - 1];
  const busy = seat != null && s.pend[seat] === 0 && (ui.sel != null || ui.sail != null);
  let h = busy ? "" : `<h3 class="cr-h">${s.step === "over" ? "The game is over" : `Year ${s.round} · ${a}–${b}`}<small>${esc(ERA_TITLES[Math.min(s.round, 8) - 1])}</small></h3>`;
  if (s.step === "over") return h + resultHtml(s);
  if (seat == null) return h + `<p class="cr-note">You are watching: you sit down at the next game.</p>` + comingHtml(s);
  const sent = s.pend[seat] !== 0;
  if (sent) {
    h += draftHtml(s, seat, s.pend[seat], true);
    const wait = Array.from({ length: s.n }, (_, k) => k).filter(k => s.pend[k] === 0);
    h += `<p class="cr-note">Your orders are in, in secret. ${wait.length ? `Waiting for ${wait.map(powerName).join(", ")}.` : "The year is resolving."}</p>`;
    return h + comingHtml(s);
  }
  h += draftHtml(s, seat, ui.draft, false);
  h += globalsHtml(s, seat);
  if (ui.draft.length >= MAX_ORDERS) h += `<p class="cr-note">Three orders are set: remove one to change it, or send them.</p>`;
  else if (ui.sail != null) h += sailHtml(s, seat);
  else if (ui.sel != null) h += portHtml(s, seat, ui.sel);
  else h += `<p class="cr-note">Tap a port on the map to see what you can do there. Up to three orders, set in secret; every power acts at once when the last is in.</p>`;
  return h + comingHtml(s);
}

function globalsHtml(s, seat) {
  const rows = [];
  if (!s.oc[seat]) rows.push(["refit", "Buy ocean ships", { t: "refit" }]);
  if (s.gr[seat] > 0) rows.push(["redress", `Pay compensation (−1 of ${s.gr[seat]} tokens)`, { t: "redress" }]);
  if (!rows.length || ui.draft.length >= MAX_ORDERS) return "";
  return `<div class="cr-globals">${rows.map(([k, label, o]) => { const why = test(o); return `<button type="button" class="cr-act" data-act="add" data-o='${JSON.stringify(o)}' ${why ? "disabled" : ""} title="${esc(why)}">${esc(label)}${costTag(s, seat, o)}</button>`; }).join("")}</div>`;
}

function comingHtml(s) {
  if (s.step === "over") return "";
  const names = EVENTS.filter(e => e.round === s.round && e.year).map(e => `${e.year} ${e.name}`);
  const east = s.round % 2 === 1;
  return `<p class="cr-coming"><b>This era brings</b> ${names.length ? esc(names.join(" · ")) : "no dated event"}, and one hazard of chance (typhoon, failed monsoon or plague). <b>Monsoon</b> lanes (dashed) can be sailed ${east ? "eastward" : "westward"} this year.</p>`;
}

function factsList(s, seat, p) {
  const own = s.own[p], out = [];
  out.push(own >= 0 ? `Held by ${dot(own)}${esc(powerName(own))}${isMe(own) ? " (you)" : ""}` : "Held by no power");
  out.push(`pays ${portValue(s, p)} a year`);
  if (s.fort[p]) out.push("fort");
  const fl = fleetsHere(s, p), fc = factorsHere(s, p);
  if (fl.length) out.push("fleets: " + fl.map(f => `${dot(f.seat)}${f.n}`).join(" "));
  if (fc.length) out.push("factors: " + fc.map(k => `${dot(k)}${esc(shortName(k))}`).join(", "));
  const goods = GOODS.filter((g, i) => sourcesOf(s, i).includes(p)).map(g => g.name.toLowerCase());
  if (goods.length) out.push("source of " + goods.join(" and "));
  if (closedTo(s, seat, p)) out.push(`<span class="cr-bad">shut to your ships and factors</span>`);
  return out.join(" · ");
}
const portFacts = (s, seat, p) => `<p class="cr-facts"><b>${esc(PORTS[p].name)}</b> · ${esc(REGIONS[PORTS[p].region])}<br>${factsList(s, seat, p)}</p>`;

function actRow(s, seat, label, o, extra = "") {
  const why = test(o);
  return `<button type="button" class="cr-act" data-act="add" data-o='${JSON.stringify(o)}' ${why ? "disabled" : ""}><span>${esc(label)}${costTag(s, seat, o)}</span>${why ? `<small>${esc(why)}</small>` : extra ? `<small>${extra}</small>` : ""}</button>`;
}

function portHtml(s, seat, p) {
  let h = portFacts(s, seat, p);
  const own = s.own[p], rows = [];
  if (fleetsLeft(p) > 0) rows.push(`<button type="button" class="cr-act go" data-act="sail" data-p="${p}"><span>Sail from here (${plural(fleetsLeft(p), "fleet")} free)</span><small>up to three days</small></button>`);
  if (own !== seat && !hasFactor(s, p, seat)) rows.push(actRow(s, seat, "Found a factor", { t: "factor", port: p }));
  if (own === seat) {
    rows.push(actRow(s, seat, "Build a fleet", { t: "build", port: p }));
    if (!s.fort[p]) rows.push(actRow(s, seat, "Build a fort", { t: "fort", port: p }));
  } else if (!s.fort[p] && POWERS[s.pw[seat]].id === "portugal" && hasFactor(s, p, seat)) rows.push(actRow(s, seat, "Raise a fort and hold the port", { t: "fort", port: p }, "Portugal only: one grievance token"));
  if (own === -1 && hasFactor(s, p, seat)) rows.push(actRow(s, seat, "Claim by treaty", { t: "claim", port: p }));
  return h + `<div class="cr-acts">${rows.join("") || `<p class="cr-note">Nothing to do here this year.</p>`}</div>`;
}

function sailHtml(s, seat) {
  const from = ui.sail, r = reach(s, seat, from), left = fleetsLeft(from);
  let h = `<p class="cr-facts"><b>Sail from ${esc(PORTS[from].name)}</b> · ${plural(left, "fleet")} free <button type="button" class="cr-link" data-act="cancel">Cancel</button></p>`;
  if (ui.to == null) {
    const list = [...r.entries()].sort((a, b) => a[1].days - b[1].days || PORTS[a[0]].name.localeCompare(PORTS[b[0]].name));
    h += `<p class="cr-note">Tap a ringed port on the map, or pick one:</p><div class="cr-chips">` + list.map(([to, v]) => {
      const notes = [days(v.days), v.tolls.length && "toll", v.pir && "pirates", v.closed && "attack only"].filter(Boolean).join(", ");
      return `<button type="button" class="cr-chip-btn" data-act="to" data-p="${to}"><b>${esc(PORTS[to].name)}</b><small>${notes}</small></button>`;
    }).join("") + `</div>`;
    return h;
  }
  const to = ui.to, v = r.get(to), n = Math.min(ui.n, left, CAP);
  h += `<p class="cr-facts">To <b>${esc(PORTS[to].name)}</b> · ${days(v.days)}${v.tolls.length ? ` · toll ${v.tolls.length} silver` : ""}${v.pir ? ` · pirates on ${plural(v.pir, "lane")}` : ""}${v.closed ? " · shut to your ships (an attack may still land)" : ""}<br>${factsList(s, seat, to)} <button type="button" class="cr-link" data-act="back">Other port</button></p>`;
  h += `<div class="cr-n-row"><span>Fleets</span><button type="button" class="btn" data-act="n" data-d="-1" ${n <= 1 ? "disabled" : ""}>−</button><b>${n}</b><button type="button" class="btn" data-act="n" data-d="1" ${n >= Math.min(left, CAP) ? "disabled" : ""}>+</button></div>`;
  const rows = [];
  if (!v.closed) rows.push(actRow(s, seat, `Sail ${plural(n, "fleet")} to ${PORTS[to].name}`, { t: "move", from, to, n }));
  const owner = s.own[to], targets = [];
  if (owner >= 0 && owner !== seat) targets.push(owner);
  if (owner === -1) targets.push(-2);
  for (let k = 0; k < s.n; k++) if (k !== seat && s.fl[k][to] > 0 && !targets.includes(k)) targets.push(k);
  for (const t of targets) {
    const takes = t === owner || t === -2;
    const od = attackOdds(s, seat, to, n, t);
    const label = t === -2 ? `Attack ${PORTS[to].name}, which no power holds` : takes ? `Attack ${powerName(t)} at ${PORTS[to].name}` : `Attack ${powerName(t)}'s fleets at ${PORTS[to].name}`;
    const odds = `${Math.round(od.take * 100)}% to ${takes ? "take the port" : "clear them"}, you lose ${od.aLoss.toFixed(1)} fleets on average${takes ? " · a bombardment: one grievance token even if it fails" : ""}`;
    rows.push(actRow(s, seat, label, { t: "move", from, to, n, atk: t }, odds));
  }
  return h + `<div class="cr-acts">${rows.join("")}</div>`;
}

$("panel").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act;
  if (act === "add") {
    if (ui.draft.length >= MAX_ORDERS) return;
    const o = JSON.parse(b.dataset.o);
    ui.draft.push(o);
    ui.sail = null; ui.to = null; ui.sel = null;
    saveDraft();
    globe?.focus(orderPorts(o).map(ll));
  } else if (act === "drop") { ui.draft.splice(Number(b.dataset.i), 1); saveDraft(); }
  else if (act === "look") { const o = (V.state.pend[V.seat] || ui.draft)[Number(b.dataset.i)]; if (o && mapNow() === "globe") globe?.focus(orderPorts(o).map(ll), true); return; }
  else if (act === "sail") { ui.sail = Number(b.dataset.p); ui.to = null; ui.n = 1; }
  else if (act === "cancel") { ui.sail = null; ui.to = null; }
  else if (act === "to") { ui.to = Number(b.dataset.p); ui.n = 1; }
  else if (act === "n") ui.n = Math.max(1, Math.min(CAP, ui.n + Number(b.dataset.d)));
  else if (act === "back") { ui.to = null; }
  draw();
});

// ---------- last year ----------
const isEventLine = l => /^(\d{4}|Hazard): /.test(l);
function diceHtml(text) {
  const chips = d => d === "none" ? `<i class="cr-die none">–</i>` : d.split("·").map(n => `<i class="cr-die">${n}</i>`).join("");
  return esc(text).replace(/dice ([\d·]+) \(([+-]\d)\) against ([\d·]+|none) \(([+-]\d)\)/, (_, a, ma, d, md) =>
    `<span class="cr-roll">${chips(a)}<em>${ma}</em><span>against</span>${chips(d)}<em>${md}</em></span>`);
}
function yearHtml(s) {
  const r = s.hist.length;
  if (!r) {
    return `<h3 class="cr-h">1480<small>${esc(ERA_TITLES[0])}</small></h3><ul class="cr-log"><li>${esc(s.log[0] || "")}</li></ul><p class="cr-note">Nothing has happened yet. Set your orders: when every power has, they are carried out together and the year is told here, with the dice.</p>`;
  }
  const [a, b] = ERAS[Math.min(r, ERAS.length) - 1];
  const lines = s.log;
  const deeds = lines.filter(l => !isEventLine(l) && !l.startsWith("Income:"));
  const events = lines.filter(isEventLine);
  const income = lines.find(l => l.startsWith("Income:"));
  let h = `<h3 class="cr-h">Year ${r} · ${a}–${b}<small>${esc(ERA_TITLES[Math.min(r, 8) - 1])}</small></h3>`;
  h += `<h4 class="cr-h4">What the powers did</h4>`;
  h += deeds.length ? `<ul class="cr-log">${deeds.map(l => `<li>${diceHtml(l)}</li>`).join("")}</ul>` : `<p class="cr-note">Nobody sailed, built or fought.</p>`;
  if (income) h += `<p class="cr-income">${esc(income)}</p>`;
  const dated = EVENTS.filter(e => e.round === r && e.year);
  h += `<h4 class="cr-h4">In history</h4>`;
  h += dated.length ? dated.map(e => `<article class="cr-ev${HARM.has(e.id) ? " harm" : ""}"><h5>${e.year} · ${esc(e.name)}${HARM.has(e.id) ? `<span>grievance</span>` : ""}</h5><p>${esc(e.note)}</p></article>`).join("") : `<p class="cr-note">No dated event this era.</p>`;
  if (events.length) h += `<p class="cr-sub">What it did in the game</p><ul class="cr-log">${events.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
  if (HARM_ROUND(r)) h += `<p class="cr-note">Grievance is a cost, never a reward: no order earns silver or standing from anyone's suffering. A token is −2 standing at the end and is paid down only in silver.</p>`;
  if (s.step === "over") h += `<p class="cr-note"><b>${esc(lines[lines.length - 1] || "")}</b></p>`;
  return h;
}
const HARM_ROUND = r => EVENTS.some(e => e.round === r && HARM.has(e.id));

// ---------- standings ----------
function standingHtml(s) {
  const order = Array.from({ length: s.n }, (_, k) => k).sort((a, b) => standing(s, b) - standing(s, a));
  let h = `<h3 class="cr-h">Standings<small>${s.step === "over" ? "final" : "if the game ended now"}</small></h3><table class="cr-table"><thead><tr><th></th><th>Power</th><th title="Standing">Pts</th><th title="Ports held">Ports</th><th title="Factors">Fac.</th><th title="Monopolies">Mon.</th><th>Silver</th><th title="Grievance tokens">Griev.</th></tr></thead><tbody>`;
  for (const k of order) {
    const mono = s.mono.filter(m => m === k).length;
    h += `<tr class="${isMe(k) ? "me" : ""}"><td>${dot(k)}</td><td>${esc(powerName(k))}</td><td><b>${standing(s, k)}</b></td><td>${held(s, k)}</td><td>${factors(s, k)}</td><td>${mono}</td><td>${s.si[k]}</td><td class="${s.gr[k] ? "cr-bad" : ""}">${s.gr[k]}</td></tr>`;
  }
  h += `</tbody></table><p class="cr-sub">Pts = 2 a port + 1 a factor + 3 a monopoly + 1 per ${SILVER_PER_POINT} silver − 2 a grievance token. Griev. = grievance tokens.</p>`;
  h += `<h4 class="cr-h4">Goods</h4><ul class="cr-goods">`;
  GOODS.forEach((g, i) => {
    const src = sourcesOf(s, i);
    h += `<li><b>${esc(g.name)}</b> ${s.mono[i] >= 0 ? `<span class="cr-mono">monopoly: ${dot(s.mono[i])}${esc(shortName(s.mono[i]))}</span>` : `<span class="cr-sub2">no monopoly</span>`}<div>` +
      src.map(p => { const o = s.own[p], f = factorsHere(s, p); return `<span class="cr-src">${o >= 0 ? dot(o) : `<i class="cr-dot free"></i>`}${esc(PORTS[p].name)}${f.map(k => `<i class="cr-dia" style="background:${seatColour(k)}"></i>`).join("")}</span>`; }).join("") + `</div></li>`;
  });
  h += `</ul><p class="cr-sub">A monopoly is the most source ports of a good (held, or a factor in), at least two, alone. Round dots: held; diamonds: factors.</p>`;
  if (s.hist.length > 1) h += `<h4 class="cr-h4">Standing by year</h4>${chartHtml(s)}`;
  return h;
}
function chartHtml(s) {
  const w = 340, h = 96, all = s.hist.flat(), lo = Math.min(0, ...all), hi = Math.max(1, ...all), n = s.hist.length;
  const X = i => 8 + (n === 1 ? 0 : i * (w - 16) / (n - 1)), Y = v => h - 8 - (v - lo) * (h - 16) / (hi - lo || 1);
  let svg = `<svg class="cr-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Standing of each power after each year"><line x1="8" x2="${w - 8}" y1="${Y(0)}" y2="${Y(0)}" class="zero"/>`;
  for (let k = 0; k < s.n; k++) svg += `<polyline fill="none" style="stroke:${seatColour(k)}" stroke-width="${isMe(k) ? 2.4 : 1.5}" points="${s.hist.map((r, i) => `${X(i).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(" ")}"/>`;
  return svg + `</svg>`;
}

// ---------- the bar ----------
function drawBar() {
  const bar = $("bar"), v = V;
  if (!v?.G) { bar.innerHTML = `<button type="button" class="btn primary cr-go" data-act="new">New game</button>`; return; }
  const s = v.state, seat = v.seat;
  if (s.step === "over") { bar.innerHTML = page.host ? `<button type="button" class="btn primary cr-go" data-act="new">New game</button>` : ""; return; }
  if (seat == null) { bar.innerHTML = ""; return; }
  if (s.pend[seat] !== 0) { bar.innerHTML = `<button type="button" class="btn primary cr-go" disabled>Orders in</button>`; return; }
  if (ui.tab !== "orders") { bar.innerHTML = `<button type="button" class="btn primary cr-go" data-act="orders">Set orders for ${ERAS[Math.min(s.round, 8) - 1][0]}</button>`; return; }
  const n = ui.draft.length;
  bar.innerHTML = `<button type="button" class="btn primary cr-go" data-act="send">${n ? `Send ${plural(n, "order")}` : "Pass this year"}</button>`;
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "orders") { ui.tab = "orders"; draw(); return; }
  if (act === "send") {
    if (!ui.draft.length && !(await sure("Pass the year with no orders?"))) return;
    const why = await page.move({ t: "orders", orders: ui.draft.length ? ui.draft : [{ t: "pass" }] });
    if (why) { toast(why); return; }
    ui.draft = []; ui.sel = null; ui.sail = null; ui.to = null;
    write(DRAFT, null);
    draw();
  }
});

// ---------- a game's end ----------
function resultHtml(s) {
  const res = s.res;
  if (!res) return "";
  const rows = res.order.map((k, i) => `<li class="${res.winners.includes(k) ? "won" : ""}${isMe(k) ? " me" : ""}">${dot(k)}<span class="nm">${esc(powerName(k))}</span><span class="sub">${held(s, k)} ports, ${factors(s, k)} factors, ${s.mono.filter(m => m === k).length} monopolies, ${s.si[k]} silver${s.gr[k] ? `, <span class="cr-bad">${plural(s.gr[k], "grievance token")}</span>` : ""}</span><b>${res.stand[k]}</b></li>`).join("");
  return `<ol class="cr-standings">${rows}</ol><p class="cr-note">${res.how === "early" ? "Ended early: twelve ports and two monopolies." : "Eight years of trade, 1480 to 1650."}</p>`;
}
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.res?.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("carrack", !!won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1200);
}
function showEnd(v) {
  const s = v.state, res = s.res;
  $("endHead").textContent = res.winners.includes(v.seat) ? "You win" : `${res.winners.map(powerName).join(" and ")} wins`;
  $("endBody").innerHTML = resultHtml(s);
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
$("endAgain").addEventListener("click", () => newGame());
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- a new game ----------
/** Powers for a table of n with `mine` in seat 0: the rest drawn at random, at most three of the four European or Mediterranean. */
function drawPowers(n, mine) {
  const me = mine === "random" || mine == null ? Math.floor(Math.random() * POWERS.length) : POWERS.findIndex(p => p.id === mine);
  const out = [me < 0 ? 0 : me];
  let euro = POWERS[out[0]].euro;
  for (const i of shuffle(POWERS.map((_, k) => k).filter(k => k !== out[0]), Math.random)) {
    if (out.length === n) break;
    if (POWERS[i].euro) { if (euro >= 3) continue; euro++; }
    out.push(i);
  }
  return out;
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  ui.tab = "orders"; ui.roundKey = ""; ui.draftKey = "";
  write(DRAFT, null);
  page.deal({ powers: drawPowers(opts.n, opts.mine) }, opts.n);
}

// ---------- rules, learning, menu ----------
const SPECIAL = {
  hanse: "Founds factors in the Baltic and at London and Antwerp without a fleet there (London until the Steelyard closes in 1598). Home seas (the Baltic, the North Sea and the Atlantic) give +1 on every die; beyond them, without ocean ships, −1.",
  portugal: "Starts with ocean ships. Defends with +1 in the ocean seas until the VOC (1602). Can raise a fort at a port where it has a factor and hold it, for one grievance token. Pays 3 a year for the Estado's upkeep.",
  venice: "Three fleets at home and factors at Alexandria and Constantinople. Earns 1 for each factor at Alexandria, Constantinople or Aleppo (the Levant premium) unless Portugal holds the pepper monopoly.",
  ottomans: "Collects a toll of 1 from others using Constantinople and, after Egypt falls in 1517, the Red Sea lane. Earns from Constantinople, Alexandria, Aden and Aleppo. Ships built outside the Mediterranean cost double.",
  ming: "Earns 3 a year from each of Guangzhou and Ningbo. Until 1567 the sea ban keeps its fleets in its own seas, costs 1 and a die, and wokou raiders (pirate-smugglers) may hit the coast.",
  gujarat: "Sails the monsoon lanes of the rim at any time, and carries for others (earns up to 2 from rivals' factors in its ports). One fleet a port, a die weaker, ships cost 1 more.",
  malacca: "Earns 1 at home plus 1 for each rival factor in the strait (up to 3), and pays no toll at Malacca. Portugal may take it in 1511.",
  ryukyu: "The go-between: earns for each factor it keeps at Guangzhou, Yuegang and Ningbo (double during the sea ban). Can enter Ningbo and does not fight Ming.",
  swahili: "Earns 2 a year for each of Sofala and Kilwa it holds (gold). The coast is where the east-coast enslavement event lands, and it costs the holders grievance.",
};
const RULES = `
<p><b>Carrack</b> is a contest for trade from the Baltic to China, 1480 to 1650, for two to six of nine powers. Eight years, each standing for an era. Every power sets up to three secret orders, all are carried out together, then income and the era's events. Most standing at the end wins.</p>
<h3>The year</h3>
<p>Set up to three orders, then send them. When the last power has sent, the year resolves in this order: payments (ocean ships, fleets built, compensation), moves (tolls and pirates on the way), battles, factors, forts and claims, income, events. The year is then told on the <i>Last year</i> tab.</p>
<h3>The orders</h3>
<p><b>Sail</b> one to three fleets up to three sailing days along the lanes (a port holds at most three of your fleets). <b>Found a factor</b> (2 silver) at a port where you have a fleet. <b>Build a fleet</b> (3) or a <b>fort</b> (3) at a port you hold. <b>Claim</b> (4) a port no power holds where you have a factor and a fleet: the one with more fleets there wins. <b>Buy ocean ships</b> (4, 2 after 1602) to sail the open ocean lanes. <b>Pay compensation</b> (4) to remove a grievance token.</p>
<h3>Lanes</h3>
<p>Solid lanes are sea. Dashed lanes are monsoon lanes: sailed one way a year (east in odd years, west in even years). Dotted lanes are caravan roads, escorted by fleets. A × marks pirates: each crossing risks a fleet on a 1 (a 1 or 2 if you have 3 or more grievance tokens). Open-ocean lanes need ocean ships.</p>
<h3>Fighting</h3>
<p>A fleet can attack a port's holder, another power's fleets there, or a port no power holds. Each side rolls one die per fleet, up to three (the holder defending its own port, or a port no power holds, adds one die). Dice are paired highest to highest; the attacker wins a pair when die plus modifier is higher. Modifiers: +1 in your home seas, +1 attacking with ocean ships in ocean seas, +1 to a defender behind a fort. A port is taken when the attack breaks through and the defenders' fleets are gone.</p>
<p><b>Attacking a port is a bombardment</b> of the people who live there: one grievance token for the attacker, win or lose.</p>
<h3>Goods and monopolies</h3>
<p>Six goods (pepper, silk, silver, spices, furs, gold) come from three or four source ports each. A good is a power's if it holds or has a factor in any source: 1 silver a year per good. A <b>monopoly</b> is the most source ports of a good, at least two, alone: 3 silver a year and 3 standing.</p>
<h3>Standing</h3>
<p>2 for each port held, 1 for each factor, 3 for each monopoly, 1 for each 8 silver, minus 2 for each grievance token. The game ends after eight years, or at once if a power holds twelve ports and two monopolies.</p>
<h3>Grievance</h3>
<p>Force and enslavement are costs here, never rewards. No order earns anything from anyone's suffering. Attacking a port costs a token. The events that record enslavement (the Atlantic trade from 1526, the east coast from about 1550) or forced labour (Potosí's mita, 1573) give the holders of the ports concerned tokens and take nothing else. A token is −2 standing at the end and is only paid down in silver. A power with four or more tokens suffers unrest: it loses a fort or a fleet.</p>
<h3>The nine powers</h3>
${POWERS.map(p => `<p><b>${esc(p.name)}</b>. ${esc(SPECIAL[p.id])}</p>`).join("")}
<p>At most three of the Hanse, Portugal, Venice and the Ottomans sit at one table. Each power also has a fixed yearly line in its income (dues, upkeep, revenue) that evens the nine out. Fleets cost upkeep: half a silver each, rounded down.</p>
<h3>History</h3>
<p>Dates are the history's: the Peterhof closed 1494 to 1514; da Gama at Calicut 1498; Goa 1510; Malacca 1511; Egypt 1517; Iwami silver 1526; Potosí 1545; the galleons from 1565; Yuegang opened 1567; the VOC 1602; Banda 1621; Japan closed 1633 to 1639; the Ming fall 1644. Figures that historians dispute (the enslaved, deaths at Banda) are given as argued in the event's note.</p>`;
function showRules() { $("rulesHead").textContent = "Rules"; $("rulesBody").innerHTML = RULES; $("rulesDlg").showModal(); }

let step = 0;
function walkSteps() {
  const s = V?.state, seat = V?.seat ?? 0;
  const pw = s ? POWERS[s.pw[seat]] : POWERS[0];
  const home = s ? PORTS.filter(p => s.fl[seat][p.i] > 0).map(p => `${p.name} (${s.fl[seat][p.i]})`).join(", ") : "";
  return [
    ["You are " + pw.name, `<p>${esc(SPECIAL[pw.id])}</p>${s ? `<p>You start with <b>${s.si[seat]} silver</b>, fleets at ${esc(home)}, and hold ${held(s, seat)} ${held(s, seat) === 1 ? "port" : "ports"}. Your colour on the map is <i class="cr-dot" style="background:${seatColour(seat)}"></i>.</p>` : ""}<p>You play the whole game against the other powers: computers, or friends at a table. Nobody sees anyone's orders until the year resolves.</p>`],
    ["The map", `<p>Thirty-six ports from Lübeck to Nagasaki. Lines are sea lanes: solid is open water, dashed is the monsoon (one way a year), dotted a caravan road, × pirates. A round dot is a port: coloured when a power holds it, hollow when none does. A coloured square with a number is that power's fleets, a diamond a factor, a frame round the dot a fort.</p><p>The list in the top right is the standing now. Tap any port to read it.</p>`],
    ["Your first order", `<p>Tap a port where you have a fleet. The <b>Orders</b> tab offers <i>Sail from here</i>. The ports you can reach in three days are ringed; tap one, choose how many fleets, and add the order. A toll or pirates may be on the way, and the tab says so.</p><p>A fleet in a port with a free source of goods is worth a factor next.</p>`],
    ["Factors, fleets and forts", `<p>A <b>factor</b> (2 silver) is a counting-house in a port you do not hold: it counts a point and puts you in a good's source (two factors together earn 1 silver a year). It needs a fleet in the port. Later, a <b>claim</b> (4) turns a factor in an unheld port into a port you hold, worth 2 and its yearly value.</p><p>Build fleets and forts only at ports you hold.</p>`],
    ["Goods and monopolies", `<p>The <b>Standings</b> tab lists the six goods and who is in each source port. One port in a good pays 1 a year. The most ports of a good, at least two, alone, is a <b>monopoly</b>: 3 a year and 3 standing. Contest a rival's monopoly by getting a factor into their source ports.</p>`],
    ["Fighting, and what it costs", `<p>To attack, sail with the attack option in the destination's list. It shows your chance of taking the port. Attacking a port is a bombardment of the people living there: <b>one grievance token, win or lose</b>, −2 standing each at the end, paid down only in silver. Four tokens bring unrest at home.</p>`],
    ["The year resolves", `<p>Send your orders (three at most). When every power has, the <b>Last year</b> tab tells it: sailings, builds, battles with the dice, income, and the era's events from history set down plainly, with the grievance they cost the powers concerned.</p><p>Eight years run from 1480 to 1650. Most standing wins.</p>`],
  ];
}
function showWalk() {
  const steps = walkSteps(), [title, html] = steps[step];
  $("rulesHead").textContent = `First game ${step + 1}/${steps.length}`;
  $("rulesBody").innerHTML = `<h3 class="cr-walk-h">${esc(title)}</h3>${html}<div class="cr-walk-go"><button type="button" class="btn" id="walkBack" ${step ? "" : "disabled"}>Back</button><button type="button" class="btn primary" id="walkNext">${step === steps.length - 1 ? "Play" : "Next"}</button></div>`;
  $("walkBack").onclick = () => { step--; showWalk(); };
  $("walkNext").onclick = () => { if (step === steps.length - 1) $("rulesDlg").close(); else { step++; showWalk(); } };
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
function openWalk() { step = 0; write(SEEN, 1); showWalk(); }

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  play.append(action("First game: a walkthrough", openWalk, "link"));
  play.append(action("The rules", showRules, "link"));
  const content = part(body, "content");
  content.append(choice("Powers at the table", [2, 3, 4, 5, 6].map(n => [n, String(n)]), opts.n, v => { opts.n = Number(v); saveOpts(); }));
  content.append(choice("Your power", [["random", "Random"], ...POWERS.map(p => [p.id, p.name])], opts.mine, v => { opts.mine = v; saveOpts(); }));
  content.append(line("Applies from the next game. At a table the other seats go to the friends who sit down."));
  const set = part(body, "settings");
  set.append(choice("Map", [["globe", "Globe"], ["flat", "Flat"]], mapNow(), v => { look.view = v; saveLook(); draw(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("carrack:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "carrack");
document.querySelector(".cr-mark").innerHTML = APPS.find(a => a.id === "carrack")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
$("mapReset").addEventListener("click", () => globe?.reset());
$("panelBtn").addEventListener("click", () => { look.min = !look.min; saveLook(); draw(); });
onDefaultChange(() => { if (!look.view && V) draw(); });   // Settings' 2D mode, live
onPause(() => {}, () => {});
window.__carrack = { page, get view() { return V; }, ui, opts, look, get globe() { return globe; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
if (!read(SEEN, 0) && !IN_FRAME && !page.atTable && !new URLSearchParams(location.search).get("table")) setTimeout(openWalk, 400);
