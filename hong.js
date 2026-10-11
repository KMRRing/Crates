// Hong: Hong Kong mahjong at a table of four, you and three computer players (or you, your partner and two of them).
// The rules are hong-engine.js's, the players hong-bot.js's (they think in hong-worker.js, off this thread); this file
// lays the table, takes your tiles and calls, runs the players at a pace you can follow, keeps the score over a game of
// one, two or four rounds of wind, and coaches: what the computer would do in your seat and why, and after each hand
// where your play and its parted.
import * as E from "./hong-engine.js";
import { routeName, shantenWords } from "./hong-bot.js";
import { installTiles, tileSvg } from "./hong-tiles.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { GAMES, roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "hong:run", OPTS = "hong:opts", STATS = "hong:stats", BEST = "hong:best";
const APP = 1;                                                   // this code's version of the together state
const BOTS = ["Mei", "Wing", "Lok"];
const PACE = { quick: 380, steady: 750, slow: 1300 };            // a computer player's turn, in ms
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const clone = x => JSON.parse(JSON.stringify(x));

// ---------- state ----------
// G: the hand in play (the engine's state). S: the game around it: { seed, firstDealer, names, humans, results }.
// R: the coach's notes on your decisions this hand, for the review at its end.
let G = null, S = null, R = [];
let opts = { flowers: true, minFan: 3, rounds: 1, coach: true, pace: "steady", numbers: true, ...read(OPTS, {}) };
let me = 0;                                                      // your seat
let picked = null;                                               // the tile you've lifted to discard
let advice = null;                                               // { key, decision }: the coach's view of your decision now
const isHuman = seat => !!S?.humans?.includes(seat);
const nameOf = seat => S?.names?.[seat] || BOTS[seat % 3];
const windName = seat => E.WIND_NAMES[E.windOf(G, seat)];
const windGlyph = seat => E.WINDS[E.windOf(G, seat)];
const keyNow = () => (G ? `${G.hand}:${G.log.length}:${G.phase}` : "");

/** A state read from the room (or an old save) put back in shape: Firebase drops empty lists and nulls, and turns an
 *  object of seats into a list with holes. */
function normalize(g) {
  if (!g) return g;
  g.seats = [0, 1, 2, 3].map(i => {
    const s = g.seats?.[i] || {};
    return { hand: s.hand || [], melds: (s.melds || []).map(m => ({ ...m })), flowers: s.flowers || [], river: (s.river || []).map(d => ({ ...d })), passBlock: !!s.passBlock, ...(s.declinedFlowers ? { declinedFlowers: s.declinedFlowers } : {}) };
  });
  g.wall = g.wall || [];
  g.drawn = g.drawn ?? null;
  g.last = g.last ?? null;
  const claims = {};
  for (const [k, v] of Object.entries(g.claims || {})) if (v) claims[k] = v;
  g.claims = claims;
  g.liable = [0, 1, 2, 3].map(i => g.liable?.[i] ?? -1);
  g.flags = { afterKong: false, kongChain: 0, lastDraw: false, finalDiscard: false, heavenly: false, earthly: false, calls: 0, ...(g.flags || {}) };
  g.flags.firstTurn = [0, 1, 2, 3].map(i => !!g.flags.firstTurn?.[i]);
  g.log = g.log || [];
  g.scores = [0, 1, 2, 3].map(i => g.scores?.[i] || 0);
  g.result = g.result ?? null;
  if (g.result) {
    g.result.pay = [0, 1, 2, 3].map(i => g.result.pay?.[i] || 0);
    g.result.items = g.result.items || [];
  }
  g.opts = { ...E.DEFAULTS, ...(g.opts || {}) };
  return g;
}

// ---------- the computer players, in a worker ----------
let worker = null, asked = 0, local = null;
const answers = new Map();
function startWorker() {
  if (worker !== null) return;
  try {
    worker = new Worker(new URL("./hong-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { const done = answers.get(e.data.id); answers.delete(e.data.id); done?.(e.data); };
    worker.onerror = () => { worker = false; for (const done of answers.values()) done({ decision: null }); answers.clear(); };
  } catch { worker = false; }
}
/** What the computer would do in a seat now: { action, why, rows, threats }. */
async function think(state, seat) {
  startWorker();
  let reply = null;
  if (worker) reply = await new Promise(res => { const id = ++asked; answers.set(id, res); worker.postMessage({ id, state, seat }); });
  if (reply?.decision) return reply.decision;
  // no worker (or it failed): think here
  local ||= await import("./hong-bot.js");
  return local.decide(state, seat);
}

// ---------- the game: a hand, then the next, to the end of its rounds ----------
function newGame() {
  const seed = (Math.random() * 2 ** 32) >>> 0, firstDealer = Math.floor(Math.random() * 4);
  me = 0;
  S = { v: 1, seed, firstDealer, names: ["You", ...BOTS], humans: [0], results: [], started: Date.now() };
  G = E.deal({ seed, dealer: firstDealer, round: 0, hand: 0, opts: { flowers: opts.flowers, minFan: opts.minFan, rounds: opts.rounds } });
  R = [];
  closeDialogs();
  afterChange();
}
function nextHand() {
  if (!G || G.phase !== "over") return;
  if (together.room) { nextTogether(); return; }
  const cfg = E.nextHand(G, { seed: S.seed, firstDealer: S.firstDealer });
  $("resultDlg").close();
  if (!cfg) { newGame(); return; }
  G = E.deal(cfg);
  R = [];
  afterChange();
}
const gameOver = () => G?.phase === "over" && !E.nextHand(G, { seed: S.seed, firstDealer: S.firstDealer });
function save() { if (!together.room && !IN_FRAME) write(RUN, { G, S, R }); }

// ---------- the turn: who's to move, and moving them ----------
let timer = null, busyWith = null, gen = 0;
const paused = () => !together.room && isPaused();
function kick(ms = 0) { clearTimeout(timer); timer = setTimeout(step, ms); }
/** After any change: draw it, save it, and set the next move going. */
function afterChange() {
  gen++;
  picked = null;
  save();
  render();
  kick(0);
}
function step() {
  timer = null;
  if (!G || IN_FRAME) return;
  if (G.phase === "over") { handOver(); return; }
  // a seat with nothing it could do but pass passes at once (the engine leaves them while a win is pending)
  for (const s of E.waitingOn(G)) {
    const l = E.legal(G, s);
    if (l.length === 1 && l[0].t === "pass" && G.phase !== "act") { apply(s, l[0]); return; }
  }
  const waiting = E.waitingOn(G);
  askCoach();
  const bot = waiting.find(s => !isHuman(s));
  if (bot === undefined || busyWith !== null || paused()) { render(); return; }
  if (together.room && !runsBots()) { render(); return; }
  const g0 = gen, snap = clone(G), slow = G.phase === "act" ? PACE[opts.pace] || PACE.steady : (PACE[opts.pace] || PACE.steady) * 0.45;
  busyWith = bot;
  render();
  Promise.all([think(snap, bot), new Promise(r => setTimeout(r, slow))]).then(([d]) => {
    busyWith = null;
    if (g0 !== gen || !G || paused()) { render(); kick(0); return; }
    if (!d?.action) { console.error("no decision", d); render(); return; }
    apply(bot, d.action);
  }).catch(e => { busyWith = null; console.error(e); toast("A computer player stumbled; tap to carry on"); render(); });
}
/** A move: a seat's action applied (in a room, as one transaction on the room's copy). */
function apply(seat, act) {
  if (together.room) { applyTogether(seat, act); return; }
  try { E.act(G, seat, act); }
  catch (e) { console.error(e); toast("That move isn't allowed now"); render(); return; }
  afterChange();
}
/** Your move: noted against the coach's (for the review), then made. */
function mine(act) {
  if (!G) return;
  const seat = me;
  if (!E.legal(G, seat).some(a => a.t === act.t && (a.k ?? null) === (act.k ?? null) && (a.how ?? null) === (act.how ?? null))) { toast("That move isn't allowed now"); return; }
  note(act);
  picked = null;
  apply(seat, act);
}

// ---------- the coach ----------
function askCoach() {
  const key = keyNow(), seat = me;
  if (advice?.key === key || !G || !E.waitingOn(G).includes(seat) || E.legal(G, seat).length <= 1) return;
  advice = { key, decision: null };
  const snap = clone(G);
  think(snap, seat).then(d => {
    if (advice?.key !== key) return;
    advice.decision = d;
    render();
  });
}
/** Your decision beside the coach's: kept for the hand's review (what it would have done, and what that was worth). */
function note(act) {
  const d = advice?.key === keyNow() ? advice.decision : null;
  const entry = { wall: E.wallLeft(G), phase: G.phase, mine: act, coach: d?.action || null, why: d?.why || "", cost: 0 };
  if (d?.rows && act.t === "discard" && d.action.t === "discard") {
    const best = d.rows[0], mineRow = d.rows.find(r => r.k === act.k);
    entry.cost = mineRow ? Math.max(0, best.score - mineRow.score) : 0;
    entry.alt = mineRow ? { route: mineRow.route, sh: mineRow.sh, p: mineRow.p } : null;
  }
  if (!d) {                                                      // the coach hadn't answered yet: ask, and fill it in later
    const snap = clone(G), i = R.length;
    think(snap, me).then(x => {
      const e = R[i];
      if (!e || e.coach) return;
      e.coach = x.action; e.why = x.why;
      if (x.rows && act.t === "discard" && x.action.t === "discard") { const m = x.rows.find(r => r.k === act.k); e.cost = m ? Math.max(0, x.rows[0].score - m.score) : 0; }
    });
  }
  R.push(entry);
}
const sameAct = (a, b) => !!a && !!b && a.t === b.t && (a.k ?? null) === (b.k ?? null);

// ---------- the table ----------
const RW = 18, RH = 24, MW = 15, MH = 20, FW = 9.5, FH = 12.7;  // a discard, a meld's tile and a flower, in the table's units
const use = (k, x, y, w, h, cls = "") => `<use href="#hk-${k < 0 ? "back" : k}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}"${cls ? ` class="${cls}"` : ""}/>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
/** A meld's tiles as they lie: a concealed kong with its ends turned down. */
const meldTiles = m => (m.t === "chow" ? [m.k, m.k + 1, m.k + 2] : m.t === "kong" ? (m.open || m.added ? [m.k, m.k, m.k, m.k] : [-1, m.k, m.k, -1]) : [m.k, m.k, m.k]);
/** Tiles flowing left to right in rows of a given width: [{ k, x, y }] and the height used. */
function flow(groups, x0, y0, width, w, h, gap = 3) {
  const out = [];
  let x = x0, y = y0;
  for (const g of groups) {
    const gw = g.length * w;
    if (x > x0 && x + gw > x0 + width) { x = x0; y += h + 2; }
    g.forEach((k, i) => out.push({ k, x: x + i * w, y }));
    x += gw + gap;
  }
  return { tiles: out, height: groups.length ? y + h - y0 : 0 };
}
/** One player's label: their wind (the dealer's in jade), name and score, and the tiles in their hand. */
function label(seat, x, y, width, active) {
  const dealer = E.windOf(G, seat) === 0;
  let svg = `<g class="hk-label${active ? " on" : ""}${busyWith === seat ? " thinking" : ""}">`;
  svg += `<rect class="hk-badge${dealer ? " dealer" : ""}" x="${x}" y="${y}" width="15" height="15" rx="2.5"/><text class="hk-badge-t" x="${x + 7.5}" y="${y + 11.6}">${windGlyph(seat)}</text>`;
  svg += `<text class="hk-name" x="${x + 19}" y="${y + 11.2}">${esc(nameOf(seat))}<tspan class="hk-score" dx="5">${signed(G.scores[seat])}</tspan></text>`;
  svg += `<text class="hk-count" x="${x + width - 2}" y="${y + 11.2}">${busyWith === seat ? "…" : `${G.seats[seat].hand.length} held`}</text>`;
  return `${svg}</g>`;
}
/** A player's flowers and sets in rows within a width; centred, for the player across. */
function sets(seat, x, y, width, centre = false) {
  const s = G.seats[seat];
  if (!s.flowers.length && !s.melds.length) return { svg: "", height: 0 };
  const fw = s.flowers.length ? s.flowers.length * FW + 4 : 0;
  const md = flow(s.melds.map(meldTiles), 0, 0, width - fw, MW, MH);
  const used = md.tiles.length ? Math.max(...md.tiles.map(t => t.x)) + MW : 0;
  const x0 = centre ? x + (width - fw - used) / 2 : x;
  let svg = "";
  s.flowers.forEach((f, i) => { svg += use(f, x0 + i * FW, y + (MH - FH), FW, FH, "hk-flower"); });
  for (const t of md.tiles) svg += use(t.k, x0 + fw + t.x, y + t.y, MW, MH);
  return { svg, height: Math.max(MH, md.height) + 4 };
}
/** A player's discards in rows (of six, or eight in a wide side column). */
function river(seat, x, y, perRow = 6) {
  let svg = "";
  riverOf(seat).forEach((d, i) => {
    const rx = x + (i % perRow) * (RW + 1), ry = y + Math.floor(i / perRow) * (RH + 1);
    svg += use(d.k, rx, ry, RW, RH);
    if (d.last) svg += `<rect class="hk-last-ring" x="${rx - 1}" y="${ry - 1}" width="${RW + 2}" height="${RH + 2}" rx="3"/>`;
  });
  return svg;
}
/** A seat's discards still on the table (a claimed one went to the claimer's set), the latest marked. */
function riverOf(seat) {
  const r = G.seats[seat].river, lastAt = G.last && G.last.seat === seat && G.last.e === "discard" ? r.length - 1 : -1;
  return r.map((d, i) => ({ k: d.k, last: i === lastAt && d.by === undefined, by: d.by })).filter(d => d.by === undefined);
}
function drawTable() {
  const svg = $("board"), box = $("table");
  if (!G) { svg.innerHTML = ""; return; }
  const bw = box.clientWidth || 380, bh = box.clientHeight || 400;
  // the table takes the box's proportions: a phone's is about square, and a wider box (a tablet on its side) gets wider
  // side columns, eight discards to a row, rather than bare cloth either side
  const wide = bw / bh > 0.95;
  const W = wide ? Math.round(Math.min(560, 400 * bw / bh)) : 380, H = wide ? 400 : Math.round(Math.max(400, Math.min(560, 380 * bh / bw)));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const right = (me + 1) % 4, top = (me + 2) % 4, left = (me + 3) % 4;
  const turn = G.phase === "act" ? G.turn : -1;
  const on = seat => seat === turn || busyWith === seat;
  // across the table: its label and sets across the whole width, its discards in the middle column; the players either
  // side in their columns below; mine at the foot of the middle column; the round's dial between
  const sideRow = W >= 470 ? 8 : 6, colW = sideRow * (RW + 1) + 4, midX = (W - 118) / 2;
  let out = label(top, (W - 150) / 2, 2, 150, on(top));
  const topSets = sets(top, 0, 21, W, true);
  out += topSets.svg;
  const topRiverY = 21 + topSets.height + (topSets.height ? 0 : 2);
  out += river(top, midX + 2, topRiverY);
  const sideY = Math.max(64, 21 + topSets.height + 4);
  for (const [seat, x] of [[left, 0], [right, W - colW]]) {
    out += label(seat, x, sideY, colW, on(seat));
    const st = sets(seat, x, sideY + 19, colW);
    out += st.svg;
    out += river(seat, x, sideY + 19 + st.height, sideRow);
  }
  // my discards at the foot of the middle column, rows from the bottom up as they grow
  const mine = riverOf(me).length, rows = Math.max(4, Math.ceil(mine / 6)), my0 = H - rows * (RH + 1) - 2;
  out += river(me, midX + 2, my0);
  // the dial: the round's wind, the hand, the wall, and a pointer to whoever is to move
  const topRows = Math.max(1, Math.ceil(riverOf(top).length / 6));
  const dialTop = topRiverY + topRows * (RH + 1) + 6, dialBottom = my0 - 30;
  const cx = W / 2, cy = Math.max(dialTop + 28, Math.min(dialBottom - 28, (dialTop + dialBottom) / 2));
  out += `<g class="hk-dial"><circle cx="${cx}" cy="${cy}" r="25"/><text class="hk-dial-wind" x="${cx}" y="${cy + 8}">${E.WINDS[G.round]}</text>`;
  out += `<text class="hk-dial-t" x="${cx}" y="${cy + 44}">${E.WIND_NAMES[G.round]} round · hand ${G.hand + 1}</text>`;
  out += `<text class="hk-dial-t" x="${cx}" y="${cy + 56}">${E.wallLeft(G)} in the wall</text>`;
  const at = turn >= 0 ? turn : busyWith ?? -1;
  if (at >= 0) {
    const ang = { [me]: 90, [right]: 0, [top]: -90, [left]: 180 }[at] * Math.PI / 180;
    const px = cx + Math.cos(ang) * 31, py = cy + Math.sin(ang) * 31;
    out += `<path class="hk-pointer" d="M${px + Math.cos(ang) * 6} ${py + Math.sin(ang) * 6}L${px + Math.cos(ang + 2.3) * 5} ${py + Math.sin(ang + 2.3) * 5}L${px + Math.cos(ang - 2.3) * 5} ${py + Math.sin(ang - 2.3) * 5}Z"/>`;
  }
  out += "</g>";
  svg.innerHTML = out;
}

// ---------- your hand ----------
function drawMine() {
  const box = $("mine");
  if (!G) { box.replaceChildren(); return; }
  const s = G.seats[me];
  const myTurn = G.phase === "act" && G.turn === me;
  box.innerHTML = `<span class="hk-me${myTurn ? " on" : ""}"><b class="hk-wind${E.windOf(G, me) === 0 ? " dealer" : ""}">${windGlyph(me)}</b><span class="hk-me-name">${esc(nameOf(me))}</span><span class="hk-me-score">${signed(G.scores[me])}</span></span>`
    + `<span class="hk-me-flowers">${s.flowers.map(f => tileSvg(f, "hk-mini")).join("")}</span>`
    + `<span class="hk-me-rule">${opts.minFan} fan to win${s.passBlock ? " · passed a win: none off a discard till you draw" : ""}</span>`;
}
function drawHand() {
  const box = $("hand");
  if (!G) { box.replaceChildren(); return; }
  const s = G.seats[me], myTurn = G.phase === "act" && G.turn === me;
  const tiles = s.hand.slice();
  // the tile just drawn sits apart at the right
  let drawn = -1;
  if (myTurn && G.drawn !== null && tiles.includes(G.drawn)) { drawn = G.drawn; tiles.splice(tiles.lastIndexOf(drawn), 1); }
  const rec = coachOn() && advice?.key === keyNow() && advice.decision?.action?.t === "discard" ? advice.decision.action.k : null;
  const units = tiles.length + (drawn >= 0 ? 1.35 : 0) + s.melds.reduce((n, m) => n + meldTiles(m).length * 0.74 + 0.3, 0) + (s.melds.length ? 0.3 : 0);
  const room = box.clientWidth || 360;
  const tw = Math.max(18, Math.min(room / Math.max(units, 9.5), parseFloat(getComputedStyle(document.documentElement).fontSize) * 3.1));
  box.style.setProperty("--hk-t", `${tw.toFixed(1)}px`);
  const btn = (k, extra = "") => {
    const cls = ["hk-tile"];
    if (picked === k && myTurn) cls.push("picked");
    if (rec === k && myTurn) cls.push("advised");
    return `<button type="button" class="${cls.join(" ")}${extra}" data-k="${k}" aria-label="${E.tileName(k)}"${myTurn ? "" : " tabindex=\"-1\""}>${tileSvg(k)}</button>`;
  };
  let html = `<span class="hk-concealed${myTurn ? " live" : ""}">${tiles.map(k => btn(k)).join("")}`;
  if (drawn >= 0) html += btn(drawn, " drawn");
  html += "</span>";
  if (s.melds.length) html += `<span class="hk-melds">${s.melds.map(m => `<span class="hk-meld">${meldTiles(m).map(k => tileSvg(k)).join("")}</span>`).join("")}</span>`;
  box.innerHTML = html;
}
// the coach speaks at every decision when it's on; off, a Hint asks it about this one decision only
let hintFor = null;
const coachOn = () => opts.coach || hintFor === keyNow();

// ---------- what you can do now ----------
function drawActions() {
  const box = $("actions"), coach = $("coach");
  box.replaceChildren();
  coach.hidden = true;
  if (!G) return;
  if (G.phase === "over") {
    box.append(goBtn(gameOver() ? "The final score" : "Next hand", () => $("resultDlg").open ? null : showResult(), "primary"));
    return;
  }
  const waiting = E.waitingOn(G);
  const legal = waiting.includes(me) ? E.legal(G, me) : [];
  const d = advice?.key === keyNow() ? advice.decision : null;
  if (legal.length && coachOn()) {
    coach.hidden = false;
    coach.innerHTML = d ? `<b>Coach</b> ${esc(d.why)} <button type="button" class="link hk-why-btn">Why?</button>` : `<b>Coach</b> <span class="hk-thinking">thinking…</span>`;
    coach.querySelector(".hk-why-btn")?.addEventListener("click", () => showWhy(d));
  }
  if (!legal.length) {
    const who = busyWith !== null ? busyWith : waiting.find(s => !isHuman(s) || s !== me);
    const p = document.createElement("p");
    p.className = "hk-wait";
    p.textContent = paused() ? "Paused" : who !== undefined && who !== null ? `${nameOf(who)} (${windName(who)}) to move…` : "";
    box.append(p);
    return;
  }
  const hint = !coachOn() ? goBtn("Hint", () => { hintFor = keyNow(); askCoach(); render(); }, "quiet") : null;
  if (G.phase === "act") {
    const win = legal.find(a => a.t === "win"), flowers = legal.find(a => a.t === "flowers");
    if (win) box.append(goBtn(`Win · ${win.fan} fan`, () => mine({ t: "win" }), "primary"));
    if (flowers) box.append(goBtn("Seven flowers: win", () => mine({ t: "flowers" }), "primary"));
    for (const k of legal.filter(a => a.t === "kong")) box.append(goBtn(`Kong ${E.tileName(k.k)}`, () => mine({ t: "kong", k: k.k, how: k.how }), ""));
    if (picked !== null) box.append(goBtn(`Discard ${E.tileName(picked)}`, () => mine({ t: "discard", k: picked }), win ? "" : "primary"));
    else if (!win && !flowers) { const p = document.createElement("p"); p.className = "hk-wait"; p.textContent = "Your turn: tap a tile to let it go"; box.append(p); }
    if (hint) box.append(hint);
    return;
  }
  // a discard (or a kong being added) you could claim
  const k = G.last.k, from = nameOf(G.last.seat);
  const head = document.createElement("p");
  head.className = "hk-claim";
  head.innerHTML = `${esc(from)} ${G.phase === "rob" ? "adds to a kong" : "lets go"} ${tileSvg(k, "hk-mini")}`;
  box.append(head);
  const win = legal.find(a => a.t === "win");
  if (win) box.append(goBtn(G.phase === "rob" ? `Rob it · ${win.fan} fan` : `Win · ${win.fan} fan`, () => mine({ t: "win" }), "primary"));
  for (const a of legal.filter(x => x.t === "kong")) box.append(goBtn("Kong", () => mine({ t: "kong", k: a.k, how: a.how }), ""));
  for (const a of legal.filter(x => x.t === "pung")) box.append(goBtn("Pung", () => mine({ t: "pung", k: a.k }), ""));
  for (const a of legal.filter(x => x.t === "chow")) {
    const b = goBtn("", () => mine({ t: "chow", k: a.k }), "chow");
    b.innerHTML = [a.k, a.k + 1, a.k + 2].map(x => tileSvg(x, "hk-mini")).join("");
    b.setAttribute("aria-label", `Chow ${E.tileName(a.k)} to ${E.tileName(a.k + 2)}`);
    box.append(b);
  }
  box.append(goBtn("Pass", () => mine({ t: "pass" }), "quiet"));
  if (hint) box.append(hint);
}
function goBtn(text, fn, kind = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `hk-go${kind ? ` ${kind}` : ""}`;
  b.textContent = text;
  b.addEventListener("click", fn);
  return b;
}
$("hand").addEventListener("click", e => {
  const b = e.target.closest(".hk-tile");
  if (!b || !G || G.phase !== "act" || G.turn !== me) return;
  const k = Number(b.dataset.k);
  if (picked === k) { mine({ t: "discard", k }); return; }   // a second tap lets it go
  picked = k;
  render();
});

// ---------- the coach's reasons ----------
function showWhy(d) {
  if (!d) return;
  const body = $("whyBody");
  let html = `<p class="hk-why-lead">${esc(d.why)}</p>`;
  if (d.rows?.length) {
    html += `<table class="hk-cands"><thead><tr><th>Let go</th><th>Keeps</th><th>From ready</th><th>Tiles that help</th><th>Win</th><th>Danger</th></tr></thead><tbody>`;
    for (const r of d.rows.slice(0, 7)) {
      const other = r.routes?.find(x => x.route !== r.route && x.ev > 0);
      const or = other ? `<small>or ${esc(routeName(other.route).replace(/^a /, ""))}, ${other.sh <= 0 ? "ready" : `${other.sh} away`}</small>` : "";
      html += `<tr${sameAct(d.action, { t: "discard", k: r.k }) ? ' class="best"' : ""}><td>${tileSvg(r.k, "hk-mini")}</td><td>${esc(routeName(r.route).replace(/^a /, ""))}${or}</td><td>${r.sh <= 0 ? "ready" : r.sh}</td><td>${r.uk?.n ?? ""}</td><td>${Math.round((r.p || 0) * 100)}%</td><td>${r.risk >= 0.5 ? r.risk.toFixed(0) : "—"}</td></tr>`;
    }
    html += "</tbody></table>";
    html += `<p class="hk-note">Win: the chance this hand wins, from its live tiles, the draws left and how soon the others look to win. Danger: the points the tile is likely to cost, if someone ready can take it.</p>`;
  }
  if (d.threats?.length) {
    html += `<h3 class="hk-sub">The others</h3><ul class="hk-threats">`;
    for (const t of d.threats) {
      const bits = [];
      bits.push(t.melds ? `${t.melds} set${t.melds === 1 ? "" : "s"} down` : "nothing called");
      if (t.flushSuit >= 0) bits.push(`on a ${E.SUIT_NAMES[t.flushSuit]} flush, likely`);
      else if (t.pungish) bits.push("all pungs, likely");
      if (!t.canTake) bits.push("can't reach the minimum off a discard");
      else bits.push(`ready ${Math.round(t.ready * 100)}%, about ${t.fanEst} fan`);
      html += `<li><b>${esc(nameOf(t.seat))}</b> (${windName(t.seat)}): ${bits.join(", ")}.</li>`;
    }
    html += "</ul>";
  }
  body.innerHTML = html;
  $("whyDlg").showModal();
}

// ---------- the end of a hand ----------
let shownFor = null;
function handOver() {
  render();
  const id = `${S?.started}:${G.hand}`;
  if (shownFor === id) return;
  shownFor = id;
  record();
  setTimeout(() => { if (G?.phase === "over" && !$("resultDlg").open) showResult(); }, 650);
}
/** Your stats from a finished hand, and the game's best once it's over (solo only: a duo match is the pair's). */
function record() {
  if (together.room || IN_FRAME || !G?.result) return;
  const r = G.result;
  if (S.results.some(x => x.hand === G.hand)) return;
  S.results.push({ hand: G.hand, dealer: G.dealer, round: G.round, kind: r.kind, seat: r.seat ?? -1, how: r.how || "", fan: r.fan ?? 0, pay: r.pay });
  const st = read(STATS, { hands: 0, wins: 0, self: 0, dealIns: 0, bestFan: 0, games: 0, firsts: 0 });
  st.hands++;
  if (r.kind === "win" && r.seat === me) { st.wins++; if (r.how === "self") st.self++; st.bestFan = Math.max(st.bestFan, r.fan); }
  if (r.kind === "win" && r.from === me) st.dealIns++;
  if (gameOver()) {
    st.games++;
    const mineScore = G.scores[me];
    if (G.scores.every((x, i) => i === me || x < mineScore)) st.firsts++;
    const best = read(BEST, null);
    if (best == null || mineScore > best) write(BEST, mineScore);
  }
  write(STATS, st);
  save();
}
function showResult() {
  if (!G?.result) return;
  const r = G.result, over = gameOver();
  const head = $("resultHead"), body = $("resultBody");
  let html = "";
  if (r.kind === "win") {
    const who = r.seat === me ? "You win" : `${nameOf(r.seat)} wins`;
    const how = r.how === "self" ? "self-drawn" : r.how === "flowers" ? "on flowers" : r.how === "rob" ? `robbing ${nameOf(r.from)}'s kong` : `off ${r.from === me ? "your" : `${nameOf(r.from)}'s`} discard`;
    head.textContent = `${who}, ${how}`;
    const s = G.seats[r.seat];
    html += `<div class="hk-win-hand">${s.hand.map(k => tileSvg(k, k === r.tile ? "hk-won" : "")).join("")}${s.melds.length ? `<span class="hk-gap"></span>${s.melds.map(m => `<span class="hk-meld">${meldTiles(m).map(k => tileSvg(k)).join("")}</span>`).join("")}` : ""}${s.flowers.length ? `<span class="hk-gap"></span>${s.flowers.map(f => tileSvg(f, "hk-mini")).join("")}` : ""}</div>`;
    html += `<table class="hk-fan"><tbody>${r.items.map(i => `<tr><td class="zh">${esc(i.zh)}</td><td>${esc(i.en)}</td><td class="n">${i.fan}</td></tr>`).join("")}`;
    html += `<tr class="total"><td></td><td>${r.limit ? "A limit hand" : r.raw > r.fan ? `${r.raw} fan, capped at ${r.fan}` : "Fan"}</td><td class="n">${r.fan}</td></tr></tbody></table>`;
    const payer = r.liable >= 0 ? `${nameOf(r.liable)} pays it all (liable)` : r.how === "self" || r.how === "flowers" ? "each of the others pays 2 × base" : `${nameOf(r.from)} pays 4 × base`;
    html += `<p class="hk-pay-line">${r.fan} fan is ${r.base} base: ${payer}.</p>`;
  } else {
    head.textContent = "A drawn hand: the wall ran dry";
    html += `<p class="hk-pay-line">No one won; ${G.dealer === me ? "you keep" : `${esc(nameOf(G.dealer))} keeps`} the deal.</p>`;
  }
  html += `<table class="hk-scores"><tbody>${[0, 1, 2, 3].map(s => `<tr${s === me ? ' class="me"' : ""}><td>${E.WINDS[E.windOf(G, s)]}</td><td>${esc(nameOf(s))}</td><td class="n">${r.pay[s] ? signed(r.pay[s]) : ""}</td><td class="n tot">${signed(G.scores[s])}</td></tr>`).join("")}</tbody></table>`;
  html += review();
  if (over) {
    const order = [0, 1, 2, 3].sort((a, b) => G.scores[b] - G.scores[a]);
    const place = order.indexOf(me);
    html += `<p class="hk-final">${place === 0 ? "You finish first." : `You finish ${["first", "second", "third", "fourth"][place]}.`} The game is over.</p>`;
  }
  body.innerHTML = html;
  $("nextBtn").textContent = over ? "New game" : "Next hand";
  const dlg = $("resultDlg");
  dlg.showModal();
  dlg.scrollTop = 0;                                             // from the top: who won, before the review
  $("nextBtn").focus({ preventScroll: true });
}
/** The coach's review of your hand: how often you and it agreed, and where it would have gone another way. */
function review() {
  if (!R.length) return "";
  const decided = R.filter(e => e.coach);
  const agree = decided.filter(e => sameAct(e.mine, e.coach) || (e.mine.t === "pass" && e.coach.t === "pass"));
  const differ = decided.filter(e => !agree.includes(e)).sort((a, b) => b.cost - a.cost).slice(0, 3);
  let html = `<h3 class="hk-sub">Your play</h3><p class="hk-review-lead">You and the coach agreed on ${agree.length} of ${decided.length} decision${decided.length === 1 ? "" : "s"}.</p>`;
  if (differ.length) {
    html += `<ul class="hk-review">`;
    for (const e of differ) {
      const yours = e.mine.t === "discard" ? `You let go ${E.tileName(e.mine.k)}` : e.mine.t === "pass" ? "You passed" : `You called ${e.mine.t}`;
      html += `<li><span class="hk-when">${e.wall} in the wall</span> ${yours}. <b>Coach:</b> ${esc(e.why)}${e.cost >= 1 ? ` <span class="hk-cost">About ${Math.round(e.cost)} points better.</span>` : ""}</li>`;
    }
    html += "</ul>";
  }
  return html;
}

// ---------- drawing ----------
function render() {
  if (!G) return;
  drawTable();
  drawMine();
  drawHand();
  drawActions();
  drawPartner();
}
function closeDialogs() { for (const id of ["resultDlg", "whyDlg"]) if ($(id).open) $(id).close(); }

// ---------- together: you, your partner across the table, and two computer players ----------
// The room holds the hand and the game: { game, session }. Either device may move a computer player once its turn has
// come; a move is a transaction that checks the hand hasn't moved on since, so the two never move one twice.
// The two of you sit across from each other, at seats 0 and 2 (the first to sit down at 0).
const mySlot = () => (together.room ? seatsOf(roomData).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
let roomData = null, joining = null;                            // joining: the rete while you sit down, until the table's drawn
const seated = () => { joining?.(); joining = null; };
const runsBots = () => !!together.room;                           // both devices may; the transaction keeps one
function freshRoom(players) {
  const seed = (Math.random() * 2 ** 32) >>> 0, firstDealer = Math.floor(Math.random() * 4);
  const names = ["", BOTS[0], "", BOTS[2]];
  for (const [, p] of Object.entries(players)) names[p.slot === 1 ? 2 : 0] = p.name;
  const game = E.deal({ seed, dealer: firstDealer, round: 0, hand: 0, opts: { flowers: opts.flowers, minFan: opts.minFan, rounds: opts.rounds } });
  return { v: 1, app: APP, created: Date.now(), players, game, session: { v: 1, seed, firstDealer, names, humans: [0, 2], results: [], started: Date.now() } };
}
function onRoomState(g) {
  roomData = g;
  me = mySlot() === 1 ? 2 : 0;
  const names = [...(g.session?.names || [])];
  for (const [, p] of seatsOf(g)) names[p.slot === 1 ? 2 : 0] = p.name;
  for (const s of [0, 2]) names[s] ||= "Your partner";           // a seat kept for them until they sit down
  S = { ...g.session, names, humans: [0, 2], results: g.session?.results || [] };
  const was = G ? `${G.hand}:${G.log.length}` : "";
  G = normalize(clone(g.game));
  if (`${G.hand}:${G.log.length}` !== was) { gen++; picked = null; }
  if (G.phase !== "over" && $("resultDlg").open) $("resultDlg").close();
  render();
  seated();
  kick(0);
}
async function applyTogether(seat, act) {
  const len = G.log.length, hand = G.hand;
  const ok = await together.act(g => {
    const game = normalize(g.game);
    if (game.hand !== hand || game.log.length !== len) return false;   // someone moved first
    if (!E.legal(game, seat).some(a => a.t === act.t && (a.k ?? null) === (act.k ?? null) && (a.how ?? null) === (act.how ?? null))) return false;
    E.act(game, seat, act);
    g.game = game;
  });
  if (!ok) { render(); kick(300); }
}
async function nextTogether() {
  const hand = G.hand;
  $("resultDlg").close();
  await together.act(g => {
    const game = normalize(g.game);
    if (game.hand !== hand || game.phase !== "over") return false;
    const cfg = E.nextHand(game, { seed: g.session.seed, firstDealer: g.session.firstDealer });
    if (cfg) g.game = E.deal(cfg);
    else { const fresh = freshRoom(g.players); g.game = fresh.game; g.session = fresh.session; g.created = Date.now(); }
  });
}
function drawPartner() {
  if (!together.room) return;
  const p = together.partner();
  if (!p) { toastOnce("Waiting for your partner to join…"); return; }
  if (p.game && p.game !== "hong") toastOnce(`${p.name} is in ${GAMES[p.game]?.name || "another game"}`);
}
let toldAt = "";
function toastOnce(msg) { if (toldAt === msg) return; toldAt = msg; toast(msg, 3000); }
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "hong",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1 && !!g.game && !!g.session,
  fresh: freshRoom,
  onState: onRoomState,
  onPresence: render,
  onLeave: () => { roomData = null; seated(); load(); },
  // a game played to its end: the pair's record, by points; each of you for yourself against the other
  result: g => {
    const game = normalize(clone(g.game));
    if (game.phase !== "over" || E.nextHand(game, { seed: g.session.seed, firstDealer: g.session.firstDealer })) return null;
    const mineS = game.scores[mySlot() === 1 ? 2 : 0], theirs = game.scores[mySlot() === 1 ? 0 : 2];
    return { match: `${g.session.started}`, score: mineS, won: mineS > theirs ? true : mineS < theirs ? false : null, coop: false, lower: false };
  },
});

// ---------- the menu ----------
let toastTimer = null;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const set = (k, v) => { opts[k] = v; write(OPTS, opts); applyLook(); render(); };
  if (together.room) part(body, "together").append(line(`You and your partner sit across the table; ${BOTS[0]} and ${BOTS[2]} play the other two seats.`), action("Back to solo", () => together.leave(), "link"));
  else part(body, "play").append(action("New game", () => newGame(), "primary"));
  const content = part(body, "content");
  content.append(
    choice("Flowers", [[true, "With"], [false, "Without"]], opts.flowers, v => set("flowers", v)),
    choice("Minimum", [[3, "3 fan"], [1, "1 fan"], [0, "None"]], opts.minFan, v => set("minFan", v)),
    choice("Length", [[1, "East round"], [2, "Two rounds"], [4, "Four rounds"]], opts.rounds, v => set("rounds", v)),
  );
  if (G && (G.opts.flowers !== opts.flowers || G.opts.minFan !== opts.minFan || (G.opts.rounds || 1) !== opts.rounds)) content.append(line("These take effect with a new game."));
  part(body, "settings").append(
    toggle("Coach (learning mode)", opts.coach, v => { set("coach", v); if (v) askCoach(); }),
    choice("Pace", [["quick", "Quick"], ["steady", "Steady"], ["slow", "Slow"]], opts.pace, v => set("pace", v)),
    toggle("Numbers on the tiles", opts.numbers, v => set("numbers", v)),
  );
  const st = read(STATS, null), best = read(BEST, null);
  if (st?.hands) part(body, "about").append(line(`${st.hands} hand${st.hands === 1 ? "" : "s"}: won ${st.wins} (${st.self} self-drawn), dealt in ${st.dealIns}${st.bestFan ? ` · biggest ${st.bestFan} fan` : ""}${st.games ? ` · ${st.games} game${st.games === 1 ? "" : "s"}, first in ${st.firsts}` : ""}${best != null ? ` · best game ${signed(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function applyLook() { $("app").style.setProperty("--hk-num", opts.numbers ? "1" : "0"); }

// ---------- the rules ----------
function rules() {
  const fan = [
    ["自摸", "Self-drawn", 1], ["門前清", "Concealed hand (nothing called)", 1], ["無花", "No flowers", 1], ["正花", "Own flower or season (each)", 1], ["一台花", "All four flowers, or all four seasons", 2],
    ["平糊", "All chows", 1], ["對對糊", "All pungs", 3], ["混一色", "Half flush: one suit and honours", 3], ["清一色", "Full flush: one suit only", 7],
    ["中 發 白", "Pung of a dragon (each)", 1], ["門風 圈風", "Pung of your seat's or the round's wind (each)", 1], ["混么九", "Terminals and honours only", 1],
    ["小三元", "Little three dragons", 5], ["大三元", "Big three dragons", 8], ["小四喜", "Little four winds", 6],
    ["槓上開花", "Win on a kong's replacement", 1], ["槓上槓自摸", "Win on a second kong's replacement", 8], ["海底撈月", "Win on the last tile", 1], ["搶槓", "Robbing a kong", 1], ["花糊", "Seven flowers: an instant win", 3],
  ];
  const limits = [["天糊", "Heavenly hand: the dealer's deal is complete"], ["地糊", "Earthly hand: won off the dealer's first discard"], ["十三么", "Thirteen orphans"], ["九子連環", "Nine gates"], ["字一色", "All honours"], ["清么九", "All terminals"], ["大四喜", "Big four winds"], ["十八羅漢", "Four kongs"], ["坎坎糊", "Four concealed pungs"], ["大花糊", "All eight flowers"]];
  return `<p><b>The tiles.</b> Three suits, characters (萬), dots and bamboo, 1 to 9, four of each; the honours, four winds (東南西北) and three dragons (中發白), four of each${opts.flowers ? "; and eight flowers and seasons, one of each, set aside when drawn and replaced from the wall's end" : ""}.</p>
<p><b>A hand</b> is four sets and a pair: a set is a chow (three in a row in one suit), a pung (three alike) or a kong (four alike, which draws a replacement). Draw, then let one tile go; first to complete a hand that scores the minimum wins.</p>
<p><b>Calls.</b> Anyone may take a discard to win, or to make a pung or kong; only the next player may take it for a chow. A win comes first, then a pung or kong, then a chow; of two wins, the player first after the discarder takes it. Pass a win you could take and you can't win off a discard until you draw again. A kong added to a called pung can be robbed by anyone who wins on that tile.</p>
<p><b>Fan.</b> A win needs ${opts.minFan ? `${opts.minFan} fan` : "no fan (a chicken hand will do)"}; ten is the most a hand pays. Your seat's wind turns each time the deal passes; the dealer (東) keeps the deal on a win or a drawn hand.</p>
<table class="hk-fan"><tbody>${fan.map(([z, e, n]) => `<tr><td class="zh">${z}</td><td>${e}</td><td class="n">${n}</td></tr>`).join("")}</tbody></table>
<p><b>Limit hands</b> pay the most a hand pays, and nothing else counts: ${limits.map(([z, e]) => `${e} (${z})`).join(", ")}.</p>
<p><b>Paying.</b> Each fan doubles the base up to four, then every two (1 2 4 8 16 24 32 48 64 96 128 at ten). Off a discard, its discarder pays 4 × base; self-drawn, each of the others pays 2 × base. Let go the tile that makes someone's fourth set, or their third dragon set, and you pay all of their self-drawn win (包).</p>`;
}

// ---------- wiring ----------
installTiles();
bindSwitcher($("appsBtn"), "hong");
document.querySelector(".hk-mark").innerHTML = APPS.find(a => a.id === "hong")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("helpBtn").addEventListener("click", () => { $("rulesBody").innerHTML = rules(); $("rulesDlg").showModal(); });
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("whyClose").addEventListener("click", () => $("whyDlg").close());
$("nextBtn").addEventListener("click", () => { if (gameOver() && !together.room) { $("resultDlg").close(); newGame(); } else nextHand(); });
$("tableBtn").addEventListener("click", () => $("resultDlg").close());
for (const id of ["rulesDlg", "whyDlg"]) $(id).addEventListener("click", e => { if (e.target === $(id)) $(id).close(); });
onPause(() => { clearTimeout(timer); render(); }, () => kick(0));
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
let resizeTimer = null;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 60); });

// for tests and debugging
window.__hong = { get state() { return G; }, get session() { return S; }, get review() { return R; }, get advice() { return advice; }, get me() { return me; }, get together() { return together; },
  mine, newGame, nextHand, set(o) { Object.assign(opts, o); write(OPTS, opts); applyLook(); render(); } };

/** Back to where you were: your game as you left it, else a new one. */
function load() {
  const run = read(RUN, null);
  if (run?.G && run?.S && run.G.v === 1) {
    G = normalize(run.G); S = run.S; R = run.R || []; me = 0;
    closeDialogs();
    gen++;
    render();
    kick(0);
    return;
  }
  newGame();
}
applyLook();
// Opened for a duo match: your solo game isn't dealt or played on while you sit down (its computer players would
// move on without you); it waits as you left it, for Back to solo, or for a join that doesn't come off.
const code = roomInAddress();
if (code) {
  joining = busy("Joining your partner", { delay: 0 });
  together.join(code).then(ok => { if (!ok) { seated(); load(); } });
} else load();
