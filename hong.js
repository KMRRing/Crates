// Hong: Hong Kong mahjong at a table of four, you and three computer players (or you, your partner and two of them).
// The rules are hong-engine.js's, the players hong-bot.js's (they think in hong-worker.js, off this thread); this file
// lays the table, takes your tiles and calls, runs the players at a pace you can follow, keeps the score over a game of
// one, two or four rounds of wind, and coaches: what the computer would do in your seat and why, or only where your move
// parted from its, by how many points and why; and after each hand, where your play and its parted.
import * as E from "./hong-engine.js";
import { routeName, shantenWords, differ, differWords } from "./hong-bot.js";
import { installTiles, tileSvg } from "./hong-tiles.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { GAMES, roomInAddress } from "./rooms.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause, isPaused } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { busy } from "./loading.js";
import { SIDEWAYS } from "./wide.js";

const $ = id => document.getElementById(id);
const RUN = "hong:run", OPTS = "hong:opts", STATS = "hong:stats", BEST = "hong:best";
const COACH = ["off", "hints", "check", "on"];                  // the coach's ways: see coachOn
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
let opts = { flowers: true, minFan: 3, rounds: 1, coach: "on", pace: "steady", numbers: true, bots: "hard", ...read(OPTS, {}) };
// the coach was on or off (with Hint) until October 2026, and "differ" for a day: kept as the way it means now
const coachWas = opts.coach;
opts.coach = coachWas === true ? "on" : coachWas === false ? "hints" : coachWas === "differ" ? "check" : COACH.includes(coachWas) ? coachWas : "on";
if (opts.coach !== coachWas && !IN_FRAME) write(OPTS, opts);
let me = 0;                                                      // your seat
let picked = null;                                               // the tile you've lifted to discard
let advice = null;                                               // { key, decision }: the coach's view of your decision now
const isHuman = seat => !!S?.humans?.includes(seat);
const nameOf = seat => S?.names?.[seat] || BOTS[seat % 3];
const windName = seat => E.WIND_NAMES[E.windOf(G, seat)];
const windGlyph = seat => E.WINDS[E.windOf(G, seat)];
const keyNow = () => (G ? `${G.hand}:${G.log.length}:${G.phase}` : "");
/** A phone held sideways (hong.css's last query): the table takes the screen, your tiles lie along its edge. */
const low = () => matchMedia(`${SIDEWAYS} and (max-height: 500px)`).matches;

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
/** How strong the computer players are: the room's setting at a table together, so both devices play the same. */
const skill = () => ((together.room ? S?.bots : opts.bots) === "medium" ? "medium" : "hard");
/** What the computer would do in a seat now: { action, why, rows, threats }. A computer player plays at the strength
 *  chosen; the coach, in your seat, is always hard's, and gives the same answer every time it's asked. */
const think = (state, seat) => ask(state, seat, { how: isHuman(seat) ? { skill: "hard", noise: false } : { skill: skill(), seed: seat + 1 } });
/** The coach's choice set against a move of yours, in words (a puzzle's verdict): hong-bot.js's explainMove. */
const explain = (state, seat, action) => ask(state, seat, { kind: "explain", action });
async function ask(state, seat, extra) {
  startWorker();
  let reply = null;
  if (worker) reply = await new Promise(res => { const id = ++asked; answers.set(id, res); worker.postMessage({ id, state, seat, ...extra }); });
  if (reply?.decision) return reply.decision;
  // no worker (or it failed): think here
  local ||= await import("./hong-bot.js");
  return extra.kind === "explain" ? local.explainMove(state, seat, extra.action) : local.decide(state, seat, extra.how);
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
function save() {
  if (together.room || IN_FRAME) return;
  if (rush) write(RUSH, rush);                                    // a puzzle's table is the bank's: the game waits as it was
  else write(RUN, { G, S, R });
}

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
  if (rush) { render(); return; }                                // a puzzle: nobody else moves
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
  const g0 = gen, snap = clone(G), slow = G.phase === "act" ? PACE[opts.pace] || PACE.steady : (PACE[opts.pace] || PACE.steady) * 0.45;
  busyWith = bot;
  render();
  sleep(backup() ? BACKUP_MS : 0)
    .then(() => (g0 !== gen ? [null] : Promise.all([think(snap, bot), sleep(slow)])))
    .then(([d]) => {
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
  if (rush) { rushAnswer(act); return; }
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
/**
 * Your decision beside the coach's, for the hand's review and the coach's word on it: what it would have done, and
 * where it would have done otherwise, how many points worse it values yours and why (hong-bot.js's explainMove and
 * differ). The words are kept in the note, so they're there after a reload; the coach's reckoning, for Why?, isn't.
 */
const reckoned = new WeakMap();                                  // a note → the coach's answer it came from
function note(act) {
  if (opts.coach === "off") return;
  const entry = { wall: E.wallLeft(G), phase: G.phase, mine: act, coach: null, why: "", gap: null, against: [] }, notes = R;
  R.push(entry);
  explain(clone(G), me, act).then(j => {
    if (!j || notes !== R) return;                               // a new hand since
    const o = differ(j, act);
    entry.coach = o?.coach || act;
    entry.why = j.decision.why;
    if (o) { entry.gap = o.gap; entry.against = o.against; }
    reckoned.set(entry, j);
    save(); render();
  }).catch(e => console.error(e));
}
const sameAct = (a, b) => !!a && !!b && a.t === b.t && (a.k ?? null) === (b.k ?? null);
/** A noted decision the coach would have made otherwise. */
const differed = e => !!e?.coach && !sameAct(e.mine, e.coach);
const pts = x => (Math.abs(x) >= 10 ? `${Math.round(x)}` : x.toFixed(1)).replace("-", "−");

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
/** One player's label: their wind (the dealer's in jade), name and score, and the tiles in their hand (at the end of
 *  its width, or, `tight`, straight after the score). */
function label(seat, x, y, width, active, tight = false) {
  const dealer = E.windOf(G, seat) === 0, held = busyWith === seat ? "…" : `${G.seats[seat].hand.length} held`;
  let svg = `<g class="hk-label${active ? " on" : ""}${busyWith === seat ? " thinking" : ""}">`;
  svg += `<rect class="hk-badge${dealer ? " dealer" : ""}" x="${x}" y="${y}" width="15" height="15" rx="2.5"/><text class="hk-badge-t" x="${x + 7.5}" y="${y + 11.6}">${windGlyph(seat)}</text>`;
  svg += `<text class="hk-name" x="${x + 19}" y="${y + 11.2}">${esc(nameOf(seat))}<tspan class="hk-score" dx="5">${signed(G.scores[seat])}</tspan>${tight ? `<tspan class="hk-count" dx="7">${held}</tspan>` : ""}</text>`;
  if (!tight) svg += `<text class="hk-count" x="${x + width - 2}" y="${y + 11.2}">${held}</text>`;
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
/** The round's dial: its wind, and a pointer to whoever is to move. */
function dial(cx, cy, r) {
  const right = (me + 1) % 4, top = (me + 2) % 4, left = (me + 3) % 4;
  const at = G.phase === "act" ? G.turn : busyWith ?? -1;
  let out = "";
  if (at >= 0) {
    const ang = { [me]: 90, [right]: 0, [top]: -90, [left]: 180 }[at] * Math.PI / 180, d = r + 6;
    const px = cx + Math.cos(ang) * d, py = cy + Math.sin(ang) * d;
    out += `<path class="hk-pointer" d="M${px + Math.cos(ang) * 6} ${py + Math.sin(ang) * 6}L${px + Math.cos(ang + 2.3) * 5} ${py + Math.sin(ang + 2.3) * 5}L${px + Math.cos(ang - 2.3) * 5} ${py + Math.sin(ang - 2.3) * 5}Z"/>`;
  }
  return out;
}
/**
 * A phone on its side: the table as it lies. The four rivers round the dial, yours below it and the one across above
 * it in rows, the others' in columns of six either side, each starting next to the dial and growing away from it;
 * each player's name and sets at their own edge. Drawn to the height (300 units, about a pixel each), so the tiles
 * keep their size however wide the phone, and the extra width goes between the players.
 */
function drawLow(svg) {
  const bw = svg.clientWidth || 560, bh = svg.clientHeight || 300;
  const H = 302, W = Math.max(440, Math.round(H * bw / bh));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const right = (me + 1) % 4, top = (me + 2) % 4, left = (me + 3) % 4;
  const turn = G.phase === "act" ? G.turn : -1;
  const on = seat => seat === turn || busyWith === seat;
  const row = W >= 560 ? 8 : 6, pond = row * (RW + 1) - 1, cx = W / 2, cy = 174, r = 23;
  const lay = (seat, at) => riverOf(seat).map((d, i) => {
    const { x, y } = at(i);
    return use(d.k, x, y, RW, RH) + (d.last ? `<rect class="hk-last-ring" x="${x - 1}" y="${y - 1}" width="${RW + 2}" height="${RH + 2}" rx="3"/>` : "");
  }).join("");
  let out = label(top, cx - 60, 3, 150, on(top), true) + sets(top, cx - 160, 21, 320, true).svg;
  out += lay(top, i => ({ x: cx - pond / 2 + (i % row) * (RW + 1), y: cy - r - 8 - RH - Math.floor(i / row) * (RH + 1) }));
  out += lay(me, i => ({ x: cx - pond / 2 + (i % row) * (RW + 1), y: cy + r + 8 + Math.floor(i / row) * (RH + 1) }));
  const inner = pond / 2 + 9, colTop = cy - 3 * (RH + 1);
  out += lay(left, i => ({ x: cx - inner - RW - Math.floor(i / 6) * (RW + 1), y: colTop + (i % 6) * (RH + 1) }));
  out += lay(right, i => ({ x: cx + inner + Math.floor(i / 6) * (RW + 1), y: colTop + (i % 6) * (RH + 1) }));
  // the players either side: from the edge to where four columns of their river would reach
  const zone = Math.max(96, cx - inner - 4 * (RW + 1) - 10);
  out += label(left, 4, colTop, zone - 4, on(left), true) + sets(left, 4, colTop + 19, zone - 4).svg;
  out += label(right, W - zone, colTop, zone - 4, on(right), true) + sets(right, W - zone, colTop + 19, zone - 4).svg;
  // the dial: the round's wind over the tiles left in the wall (the round and the hand are in the console)
  out += `<g class="hk-dial"><circle cx="${cx}" cy="${cy}" r="${r}"/><text class="hk-dial-wind" x="${cx}" y="${cy + 3}">${E.WINDS[G.round]}</text>`;
  out += `<text class="hk-dial-t" x="${cx}" y="${cy + 15}">${E.wallLeft(G)}</text>${dial(cx, cy, r)}</g>`;
  svg.innerHTML = out;
}
function drawTable() {
  const svg = $("board"), box = $("table");
  if (!G) { svg.innerHTML = ""; return; }
  if (low()) { drawLow(svg); return; }
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
  out += `${dial(cx, cy, 25)}</g>`;
  svg.innerHTML = out;
}

// ---------- your hand ----------
function drawMine() {
  const box = $("mine");
  if (!G) { box.replaceChildren(); return; }
  const s = G.seats[me];
  const myTurn = G.phase === "act" && G.turn === me;
  // on a phone on its side the dial has room only for the wind and the wall: the round and the hand are said here
  const round = low() ? ` · ${E.WIND_NAMES[G.round]} round, hand ${G.hand + 1}` : "";
  box.innerHTML = `<span class="hk-me${myTurn ? " on" : ""}"><b class="hk-wind${E.windOf(G, me) === 0 ? " dealer" : ""}">${windGlyph(me)}</b><span class="hk-me-name">${esc(nameOf(me))}</span><span class="hk-me-score">${signed(G.scores[me])}</span></span>`
    + `<span class="hk-me-flowers">${s.flowers.map(f => tileSvg(f, "hk-mini")).join("")}</span>`
    + (rush ? rushStatus() : `<span class="hk-me-rule">${G.opts.minFan} fan to win${round}${s.passBlock ? " · passed a win: none off a discard till you draw" : ""}</span>`);
}
function drawHand() {
  const box = $("hand");
  if (!G) { box.replaceChildren(); return; }
  const s = G.seats[me], myTurn = G.phase === "act" && G.turn === me;
  const tiles = s.hand.slice();
  // the tile just drawn sits apart at the right
  let drawn = -1;
  if (myTurn && G.drawn !== null && tiles.includes(G.drawn)) { drawn = G.drawn; tiles.splice(tiles.lastIndexOf(drawn), 1); }
  // the coach's tile: in a puzzle, the best, once you've answered
  const rec = rush ? rushBest()?.k ?? null : coachOn() && advice?.key === keyNow() && advice.decision?.action?.t === "discard" ? advice.decision.action.k : null;
  const units = tiles.length + (drawn >= 0 ? 1.35 : 0) + s.melds.reduce((n, m) => n + meldTiles(m).length * 0.74 + 0.3, 0) + (s.melds.length ? 0.3 : 0);
  const pad = getComputedStyle(box), room = (box.clientWidth || 360) - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // on a phone on its side the row lies on the table, which leaves room for it at its foot (--hk-reserve): on the
  // shortest phones a little smaller, so the table keeps its share of the height
  const tw = Math.max(18, Math.min(room / Math.max(units, 9.5), low() ? Math.min(rem * 2.3, innerHeight * 0.095) : rem * 3.1));
  box.style.setProperty("--hk-t", `${tw.toFixed(1)}px`);
  if (low()) $("app").style.setProperty("--hk-reserve", `${(tw * 4 / 3 + 1.25 * rem).toFixed(1)}px`);
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
// The coach: "off", silent; "hints", a Hint asks it about one decision; "check", a Hint too, and once you've moved, a
// word only where it would have done otherwise: what, how many points worse it values yours, and why; "on" (Always),
// what it would do at every decision, and the same word after a move it advised against; and, unless it's off, the
// hand's review at its end.
let hintFor = null;
const coachOn = () => opts.coach === "on" || hintFor === keyNow();
const checking = () => opts.coach === "check" || opts.coach === "on";
/** The coach's word on your last move it would have made otherwise, until a turn of yours it agrees with (a claim you
 *  pass on as it would doesn't end it: there may be one before you've read it). */
function lesson() {
  if (!checking() || rush) return null;
  for (let i = R.length - 1; i >= 0; i--) {
    if (differed(R[i])) return R[i];
    if (R[i].phase === "act" && R[i].coach) return null;
  }
  return null;
}

// ---------- what you can do now ----------
function drawActions() {
  const box = $("actions"), coach = $("coach");
  box.replaceChildren();
  coach.hidden = true;
  coach.classList.remove("rush");
  // a coach that speaks unasked keeps its room under your tiles, so the table doesn't change size as it speaks and falls quiet
  coach.classList.toggle("kept", checking() && !rush && G?.phase !== "over");
  if (!G) return;
  if (rush) { drawRush(box, coach); return; }
  if (G.phase === "over") {
    box.append(goBtn(gameOver() ? "The final score" : "Next hand", () => $("resultDlg").open ? null : showResult(), "primary"));
    return;
  }
  const waiting = E.waitingOn(G);
  const legal = waiting.includes(me) ? E.legal(G, me) : [];
  const d = advice?.key === keyNow() ? advice.decision : null;
  const last = lesson();
  if (legal.length && coachOn()) {
    coach.hidden = false;
    coach.innerHTML = d ? `<b>Coach</b> ${esc(d.why)} <button type="button" class="link hk-why-btn">Why?</button>` : `<b>Coach</b> <span class="hk-thinking">thinking…</span>`;
    coach.querySelector(".hk-why-btn")?.addEventListener("click", () => showWhy(d));
  } else if (last) {
    const j = reckoned.get(last);
    coach.hidden = false;
    coach.innerHTML = `<b class="hk-miss">Coach</b> ${esc(differWords(last.mine, last))}${j ? ' <button type="button" class="link hk-why-btn">Why?</button>' : ""}`;
    coach.querySelector(".hk-why-btn")?.addEventListener("click", () => showWhy(reasonsFor(j, last.mine), last.mine));
  } else if (coach.classList.contains("kept")) { coach.hidden = false; coach.replaceChildren(); }
  if (!legal.length) {
    const who = busyWith !== null ? busyWith : waiting.find(s => !isHuman(s) || s !== me);
    const p = document.createElement("p");
    p.className = "hk-wait";
    p.textContent = paused() ? "Paused" : who !== undefined && who !== null ? `${nameOf(who)} (${windName(who)}) to move…` : "";
    box.append(p);
    return;
  }
  moveButtons(box, legal);
  if (!coachOn() && opts.coach !== "off") box.append(goBtn("Hint", () => { hintFor = keyNow(); askCoach(); render(); }, "quiet"));
}
/** Your moves now as buttons: a win, flowers, kongs and the tile you've lifted; offered a discard, its calls. */
function moveButtons(box, legal) {
  if (G.phase === "act") {
    const win = legal.find(a => a.t === "win"), flowers = legal.find(a => a.t === "flowers");
    if (win) box.append(goBtn(`Win · ${win.fan} fan`, () => mine({ t: "win" }), "primary"));
    if (flowers) box.append(goBtn("Seven flowers: win", () => mine({ t: "flowers" }), "primary"));
    for (const k of legal.filter(a => a.t === "kong")) box.append(goBtn(`Kong ${E.tileName(k.k)}`, () => mine({ t: "kong", k: k.k, how: k.how }), ""));
    if (picked !== null) box.append(goBtn(`Discard ${E.tileName(picked)}`, () => mine({ t: "discard", k: picked }), win ? "" : "primary"));
    else if (!win && !flowers) { const p = document.createElement("p"); p.className = "hk-wait"; p.textContent = "Your turn: tap a tile to let it go"; box.append(p); }
    return;
  }
  // a discard (or a kong being added) you could claim
  box.append(claimHead());
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
}
/** The discard on offer: who let it go, and the tile. */
function claimHead() {
  const head = document.createElement("p");
  head.className = "hk-claim";
  head.innerHTML = `${esc(nameOf(G.last.seat))} ${G.phase === "rob" ? "adds to a kong" : "lets go"} ${tileSvg(G.last.k, "hk-mini")}`;
  return head;
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
  if (!b || !G || G.phase !== "act" || G.turn !== me || rush?.answer || rush?.over) return;
  const k = Number(b.dataset.k);
  if (picked === k) { mine({ t: "discard", k }); return; }   // a second tap lets it go
  picked = k;
  render();
});

// ---------- the coach's reasons ----------
/** The coach's reasons: its choice and the others in words, the discards side by side, what the others look to be up
 *  to. `yours`: in a puzzle, the move you made, marked among them. */
function showWhy(d, yours = null) {
  if (!d) return;
  const body = $("whyBody");
  let html = `<p class="hk-why-lead">${esc(d.why)}</p>`;
  // the choices in words: the coach's first, each with what speaks for it (+) and against it (−)
  if (d.options?.length > 1) {
    const up = x => x.charAt(0).toUpperCase() + x.slice(1);
    html += `<ol class="hk-opts">${d.options.map((o, i) => {
      const pc = [...o.pros.map(x => `<li class="pro">${esc(up(x))}</li>`), ...o.cons.map(x => `<li class="con">${esc(up(x))}</li>`)].join("");
      const mineToo = yours && sameAct(o.action, yours);
      return `<li class="hk-opt${i === 0 ? " best" : ""}${mineToo && i ? " missed" : ""}"><b>${esc(o.title)}</b>${mineToo ? '<span class="hk-yours">yours</span>' : ""}${pc ? `<ul class="hk-pc">${pc}</ul>` : ""}</li>`;
    }).join("")}</ol>`;
  }
  if (d.rows?.length) {
    const rows = d.rows.slice(0, 7);
    if (yours?.t === "discard" && !rows.some(r => r.k === yours.k)) rows.push(...d.rows.filter(r => r.k === yours.k));
    html += `<table class="hk-cands"><thead><tr><th>Let go</th><th>Keeps</th><th>From ready</th><th>Tiles that help</th><th>Win</th><th>Danger</th>${yours ? "<th>Points</th>" : ""}</tr></thead><tbody>`;
    for (const r of rows) {
      const other = r.routes?.find(x => x.route !== r.route && x.ev > 0);
      const or = other ? `<small>or ${esc(routeName(other.route).replace(/^a /, ""))}, ${other.sh <= 0 ? "ready" : `${other.sh} away`}</small>` : "";
      const mineToo = yours && sameAct(yours, { t: "discard", k: r.k });
      html += `<tr${sameAct(d.action, { t: "discard", k: r.k }) ? ' class="best"' : ""}><td>${tileSvg(r.k, "hk-mini")}${mineToo ? "<small>yours</small>" : ""}</td><td>${esc(routeName(r.route).replace(/^a /, ""))}${or}</td><td>${r.sh <= 0 ? "ready" : r.sh}</td><td>${r.uk?.n ?? ""}</td><td>${Math.round((r.p || 0) * 100)}%</td><td>${r.risk >= 0.5 ? r.risk.toFixed(0) : "—"}</td>${yours ? `<td>${pts(r.score)}</td>` : ""}</tr>`;
    }
    html += "</tbody></table>";
    html += `<p class="hk-note">Tiles that help: those still unseen (not in your hand, on the table or in a set) that would bring the hand a step nearer. Win: the chance this hand wins, from its live tiles, the draws left and how soon the others look to win. Danger: the points the tile is likely to cost, if someone ready can take it.${yours ? " Points: what the hand is worth after it on average (each win it could make, by what it pays and how likely it comes; a little more with a second way open), less the danger." : ""}</p>`;
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
/** The coach's review of your hand: how often it would have done as you did (or valued yours as well), and the costliest
 *  decisions where it wouldn't: what yours was worth against its move, why, and its move's reason. */
function review() {
  if (!R.length || opts.coach === "off") return "";
  const decided = R.filter(e => e.coach), differs = decided.filter(differed);
  const worst = differs.slice().sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)).slice(0, 3);
  let html = `<h3 class="hk-sub">Your play</h3><p class="hk-review-lead">You and the coach agreed on ${decided.length - differs.length} of ${decided.length} decision${decided.length === 1 ? "" : "s"}${differs.length > worst.length ? `; the ${worst.length} that cost most:` : "."}</p>`;
  if (worst.length) {
    html += `<ul class="hk-review">`;
    for (const e of worst) html += `<li><span class="hk-when">${e.wall} in the wall</span> ${esc(differWords(e.mine, e))} <b>Coach:</b> ${esc(e.why)}</li>`;
    html += "</ul>";
  }
  return html;
}

// ---------- drawing ----------
function render() {
  if (!G) return;
  const box = $("table"), size = () => `${box.clientWidth}x${box.clientHeight}`;
  if (low()) drawHand();                       // on a phone on its side the table leaves your row its room: sized first
  drawTable();
  const drawnFor = size();
  drawMine();
  if (!low()) drawHand();
  drawActions();
  drawPartner();
  // the rows under the table changed height (a claim's buttons, a verdict, the first draw after a reload): the table's
  // box changed with them, and the drawing takes its proportions
  if (size() !== drawnFor) drawTable();
}
function closeDialogs() { for (const id of ["resultDlg", "whyDlg", "rushDlg"]) if ($(id).open) $(id).close(); }

// ---------- puzzle rush ----------
// Positions from the computer players' own hands where one discard (or one call) is clearly best by the coach's
// reckoning, which is exact this near ready (hong-rush.js; the bank, hong-puzzles.js, loads with the first rush). Find it
// while five minutes run: the clock stands while you read a verdict and while the menu or the rules are open; three
// misses end the run. The verdict is the puzzle's; its reasons are the coach's, worked out again at the table. The run is
// kept as it goes (hong:rush), the best score in hong:rushBest; your game waits as you left it.
const RUSH = "hong:rush", RUSH_BEST = "hong:rushBest", RUSH_SEEN = "hong:rushSeen", RUSH_MS = 5 * 60 * 1000;
let rush = null, bank = null, rushLib = null, ticking = null, savedAt = 0;
let words = null;                                                // { at, j }: the coach's reasons for the puzzle answered
const here = () => `${rush.seed}:${rush.i}`;                      // which puzzle of which run
async function loadRush() {
  rushLib ||= await import("./hong-rush.js");
  bank ||= (await import("./hong-puzzles.js")).PUZZLES;
}
const rushPuzzle = () => (rush && bank ? bank.find(p => p.id === rush.order[rush.i]) : null);
/** The best move, once you've answered. */
const rushBest = () => (rush?.answer && rushPuzzle() ? rushLib.decodeAction(rushPuzzle().best) : null);
const clockText = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
function rushStatus() {
  const marks = "✗".repeat(rush.strikes) + "○".repeat(Math.max(0, 3 - rush.strikes));
  return `<span class="hk-me-rule hk-rush"><b>Puzzle ${rush.i + 1}</b> · ✓ ${rush.score} · <span class="hk-strikes" aria-label="${rush.strikes} of 3 missed">${marks}</span> · <span id="rushClock">${clockText(rush.left)}</span></span>`;
}
async function startRush() {
  const done = busy("Dealing the puzzles", { delay: 150 });
  try { await loadRush(); } finally { done(); }
  const seed = (Math.random() * 2 ** 32) >>> 0;
  rush = { v: 1, seed, order: rushLib.runOrder(bank, seed, read(RUSH_SEEN, [])), i: 0, score: 0, strikes: 0, left: RUSH_MS, answer: null, over: false, log: [] };
  closeDialogs();
  showRushPuzzle();
}
/** The puzzle in hand laid on the table: its seat yours, the others named as at your own table. */
function showRushPuzzle() {
  const p = rushPuzzle();
  if (!p) { endRush(); return; }
  G = rushLib.replay(p); me = p.seat;
  const names = []; names[me] = "You";
  for (let k = 1; k < 4; k++) names[(me + k) % 4] = BOTS[k - 1];
  S = { v: 1, seed: p.s, firstDealer: p.dl, names, humans: [me], results: [], started: 0 };
  R = []; advice = null; hintFor = null; gen++;
  picked = rush.answer?.action.t === "discard" ? rush.answer.action.k : null;
  save(); render(); tick();
  if (rush.answer && words?.at !== here()) explainRush();
}
function tick() {
  clearInterval(ticking);
  if (!rush || rush.over || IN_FRAME) return;
  let last = Date.now();
  ticking = setInterval(() => {
    const now = Date.now(), dt = now - last;
    last = now;
    if (!rush || rush.answer || rush.over || isPaused() || document.hidden) return;
    rush.left -= dt;
    const el = $("rushClock");
    if (el) el.textContent = clockText(rush.left);
    if (rush.left <= 0) { rush.left = 0; endRush(); }
    else if (now - savedAt > 3000) { savedAt = now; save(); }
  }, 250);
}
/** Your answer: judged at once from the puzzle, then the coach's reasons, yours among the options it weighed. */
function rushAnswer(act) {
  if (!rush || rush.answer || rush.over) return;
  const p = rushPuzzle(), verdict = rushLib.verdictOf(p, act);
  rush.answer = { action: act, verdict };
  if (verdict === "wrong") rush.strikes++; else rush.score++;
  rush.log.push({ id: p.id, verdict });
  write(RUSH_SEEN, [...read(RUSH_SEEN, []).filter(id => id !== p.id), p.id].slice(-150));
  if (rush.strikes >= 3) rush.over = true;
  picked = act.t === "discard" ? act.k : null;
  save(); render();
  explainRush();
}
async function explainRush() {
  const at = here(), j = await explain(clone(G), me, rush.answer.action);
  if (!rush || here() !== at || !rush.answer) return;
  words = { at, j };
  render();
}
function nextRush() {
  if (!rush) return;
  if (rush.over || rush.left <= 0) { endRush(); return; }
  rush.i++; rush.answer = null;
  showRushPuzzle();
}
function endRush() {
  if (!rush) return;
  rush.over = true;
  clearInterval(ticking);
  const before = read(RUSH_BEST, 0), best = Math.max(before, rush.score);
  if (best > before) write(RUSH_BEST, best);
  save(); render();
  $("rushHead").textContent = rush.left <= 0 ? "Time" : rush.strikes >= 3 ? "Three misses" : "The end of the bank";
  const missed = rush.log.filter(x => x.verdict === "wrong").length;
  $("rushBody").innerHTML = `<p class="hk-rush-score"><b>${rush.score}</b> solved${rush.score > before ? " · your best" : before ? ` · best ${before}` : ""}</p>`
    + `<p class="hk-rush-sub">${rush.log.length} answered, ${missed} missed, ${clockText(rush.left)} left on the clock.</p>`;
  if (!$("rushDlg").open) $("rushDlg").showModal();
}
function leaveRush() {
  rush = null; words = null;
  clearInterval(ticking);
  try { localStorage.removeItem(RUSH); } catch { /* private mode */ }
  closeDialogs();
  load();
}
/** A rush left open: back where it was (an answer and its reasons too), or its score if it was over. */
async function resumeRush(r) {
  await loadRush();
  rush = r;
  if (!rushPuzzle()) { leaveRush(); return; }
  showRushPuzzle();
  if (rush.over) endRush();
}
const worse = gap => (gap == null ? "" : gap >= 0.5 ? `about ${pts(gap)} points worse` : "a shade worse");
/** The question while it's open, and your moves; then the verdict, its reasons and the next puzzle. */
function drawRush(box, coach) {
  const a = rush.answer;
  coach.hidden = false;
  coach.classList.add("rush");
  if (!a) {
    const ask = G.phase === "act" ? ["Find the best discard", "Which tile goes?"] : ["Find the best call", "Call it, or let it go by?"];
    coach.innerHTML = `<b>${ask[0]}</b> ${G.opts.minFan} fan to win, ${E.wallLeft(G)} tiles in the wall. ${ask[1]}`;
    if (rush.over) { box.append(goBtn("See the score", endRush, "primary")); return; }
    moveButtons(box, E.legal(G, me));
    return;
  }
  const j = words?.at === here() ? words.j : null;
  let html;
  if (a.verdict === "best") html = `<b class="hk-hit">✓ Best</b> ${j ? esc(j.decision.why) : ""}`;
  else if (a.verdict === "fine") html = `<b class="hk-hit">✓ As good</b> ${j ? `${esc(j.decision.why)} Yours does as well${j.gap >= 0.05 ? `, within ${pts(j.gap)} points` : ""}.` : ""}`;
  else {
    // what tells most against yours: further from ready, then fewer wins, then whatever the coach says first
    const cons = (j?.mine?.cons || []).filter(c => !/on balance$/.test(c));
    const against = cons.find(c => c.includes("further from ready")) || cons.find(c => c.startsWith("wins less")) || cons[0];
    html = `<b class="hk-miss">✗ Not the best</b> ${j ? `${esc(j.decision.why)} Yours: ${against ? `${esc(against)}, ` : ""}${worse(j.gap)}.` : ""}`;
  }
  coach.innerHTML = `${html}${j ? ' <button type="button" class="link hk-why-btn">Why?</button>' : ' <span class="hk-thinking">…</span>'}`;
  coach.querySelector(".hk-why-btn")?.addEventListener("click", () => showWhy(reasonsFor(j, a.action), a.action));
  if (G.phase !== "act") box.append(claimHead());
  box.append(goBtn(rush.over ? "See the score" : "Next puzzle", nextRush, "primary"));
}
/** The coach's decision for the Why sheet, set against a move of yours: its options the best first, then yours, then
 *  the rest as it ranked them. */
function reasonsFor(j, act) {
  const best = j.options.find(o => sameAct(o.action, j.best.action)) || j.options[0];
  const yours = j.options.find(o => o !== best && sameAct(o.action, act));
  return { ...j.decision, options: [best, ...(yours ? [yours] : []), ...j.options.filter(o => o !== best && o !== yours)] };
}

// ---------- together: you, your partner across the table, and two computer players ----------
// The room holds the hand and the game: { game, session }. Either device may move a computer player once its turn has
// come; a move is a transaction that checks the hand hasn't moved on since, so the two never move one twice.
// The two of you sit across from each other, at seats 0 and 2 (the first to sit down at 0).
const mySlot = () => (together.room ? seatsOf(roomData).find(([id]) => id === together.room.uid)?.[1].slot ?? 0 : 0);
let roomData = null, joining = null;                            // joining: the rete while you sit down, until the table's drawn
const seated = () => { joining?.(); joining = null; };
/**
 * At a table together, the device that sat down first moves the computer players while its player is here; the
 * other steps in only when a move hasn't come for a few seconds (that page asleep, or gone). Both used to work out
 * every move and race to save it: twice the work on each phone, and the loser's try thrown away.
 */
const BACKUP_MS = 4000;
const backup = () => !!together.room && mySlot() !== 0 && !!together.partner()?.online && !together.partner()?.game;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function freshRoom(players) {
  const seed = (Math.random() * 2 ** 32) >>> 0, firstDealer = Math.floor(Math.random() * 4);
  const names = ["", BOTS[0], "", BOTS[2]];
  for (const [, p] of Object.entries(players)) names[p.slot === 1 ? 2 : 0] = p.name;
  const game = E.deal({ seed, dealer: firstDealer, round: 0, hand: 0, opts: { flowers: opts.flowers, minFan: opts.minFan, rounds: opts.rounds } });
  return { v: 1, app: APP, created: Date.now(), players, game, session: { v: 1, seed, firstDealer, names, humans: [0, 2], results: [], started: Date.now(), bots: opts.bots } };
}
function onRoomState(g) {
  roomData = g;
  me = mySlot() === 1 ? 2 : 0;
  const names = [...(g.session?.names || [])];
  for (const [, p] of seatsOf(g)) names[p.slot === 1 ? 2 : 0] = p.name;
  // a seat kept for your partner until they sit down: theirs by the name they go by here, if they're about
  const partner = together.partner()?.name;
  for (const s of [0, 2]) names[s] ||= s === me ? together.room?.name || "You" : partner || "Your partner";
  S = { ...g.session, names, humans: [0, 2], results: g.session?.results || [] };
  // your own discard already on the table, on its way: an older state meanwhile doesn't take it back
  const behind = pending && g.game?.hand === pending.hand && (g.game.log?.length || 0) < pending.len;
  if (!behind) {
    const was = G ? `${G.hand}:${G.log.length}` : "";
    G = E.fromRoom(clone(g.game));
    if (`${G.hand}:${G.log.length}` !== was) { gen++; picked = null; }
  }
  if (G.phase !== "over" && $("resultDlg").open) $("resultDlg").close();
  render();
  seated();
  if (!behind) kick(0);
}
let pending = null;                                              // your discard on its way to the room: { hand, len } it makes
/** A move at the table together, as one transaction on the room's copy. Your own discard shows at once: the room's
 *  answer is a round trip away, and on your turn nobody else can move, so it comes back as you made it or not at all
 *  (then the room's state is put back). A call waits for the room: your partner may be answering the same discard. */
async function applyTogether(seat, act) {
  const len = G.log.length, hand = G.hand;
  let shown = null;
  if (seat === me && G.phase === "act" && G.turn === me) {
    try {
      const next = clone(G);
      E.act(next, seat, act);
      G = next; gen++; picked = null;
      pending = shown = { hand, len: G.log.length };
      render();
    } catch { /* not a move the rules allow: the room's own check turns it down */ }
  }
  const ok = await together.act(g => {
    const game = E.fromRoom(g.game);
    if (game.hand !== hand || game.log.length !== len) return false;   // someone moved first
    if (!E.legal(game, seat).some(a => a.t === act.t && (a.k ?? null) === (act.k ?? null) && (a.how ?? null) === (act.how ?? null))) return false;
    E.act(game, seat, act);
    g.game = game;
  });
  if (pending === shown) pending = null;
  if (!ok) {
    if (roomData) G = E.fromRoom(clone(roomData.game));
    render(); kick(300);
  }
}
async function nextTogether() {
  const hand = G.hand;
  $("resultDlg").close();
  await together.act(g => {
    const game = E.fromRoom(g.game);
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
    const game = E.fromRoom(clone(g.game));
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
  else if (rush) part(body, "play").append(action("New puzzle rush", () => startRush(), "primary"), action("Back to the game", () => leaveRush(), "link"));
  else part(body, "play").append(action("New game", () => newGame(), "primary"), action("Puzzle rush", () => startRush(), ""));
  // a puzzle's table keeps its own rules: the game's are for the game
  if (!rush) {
    const content = part(body, "content");
    content.append(
      choice("Flowers", [[true, "With"], [false, "Without"]], opts.flowers, v => set("flowers", v)),
      choice("Minimum", [[3, "3 fan"], [1, "1 fan"], [0, "None"]], opts.minFan, v => set("minFan", v)),
      choice("Length", [[1, "East round"], [2, "Two rounds"], [4, "Four rounds"]], opts.rounds, v => set("rounds", v)),
    );
    if (G && (G.opts.flowers !== opts.flowers || G.opts.minFan !== opts.minFan || (G.opts.rounds || 1) !== opts.rounds)) content.append(line("These take effect with a new game."));
  }
  part(body, "settings").append(
    choice("Computer players", [["medium", "Medium"], ["hard", "Hard"]], together.room ? S?.bots || "hard" : opts.bots, v => {
      set("bots", v);
      if (together.room) together.act(g => { if (!g.session) return false; g.session.bots = v; });
    }),
    choice("Coach", [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]], opts.coach, v => { set("coach", v); if (v === "on") askCoach(); }),
    choice("Pace", [["quick", "Quick"], ["steady", "Steady"], ["slow", "Slow"]], opts.pace, v => set("pace", v)),
    toggle("Numbers on the tiles", opts.numbers, v => set("numbers", v)),
  );
  const st = read(STATS, null), best = read(BEST, null);
  if (st?.hands) part(body, "about").append(line(`${st.hands} hand${st.hands === 1 ? "" : "s"}: won ${st.wins} (${st.self} self-drawn), dealt in ${st.dealIns}${st.bestFan ? ` · biggest ${st.bestFan} fan` : ""}${st.games ? ` · ${st.games} game${st.games === 1 ? "" : "s"}, first in ${st.firsts}` : ""}${best != null ? ` · best game ${signed(best)}` : ""}`));
  const rushBest = read(RUSH_BEST, 0);
  if (rushBest) part(body, "about").append(line(`Puzzle rush: best ${rushBest} solved`));
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
$("rushAgain").addEventListener("click", () => startRush());
$("rushLeave").addEventListener("click", () => leaveRush());
onPause(() => { clearTimeout(timer); render(); }, () => kick(0));
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
let resizeTimer = null;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 60); });

// for tests and debugging
window.__hong = { get state() { return G; }, get session() { return S; }, get review() { return R; }, get advice() { return advice; }, get me() { return me; }, get together() { return together; },
  get rush() { return rush; }, get words() { return words; }, startRush, nextRush, leaveRush,
  mine, newGame, nextHand, set(o) { Object.assign(opts, o); write(OPTS, opts); applyLook(); render(); } };

/** Back to where you were: a puzzle rush left open, else your game as you left it, else a new one. */
function load() {
  const r = read(RUSH, null);
  if (r?.v === 1) { resumeRush(r); return; }
  const run = read(RUN, null);
  if (run?.G && run?.S && run.G.v === 1) {
    G = E.fromRoom(run.G); S = run.S; R = run.R || []; me = 0;
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
