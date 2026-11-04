// Netting: trading houses round a table, arrows for what each owes another (in the colour of a currency they share), a
// gauge round each house for its net debt against its limit, a ring round an amount as interest comes due. Drag one of
// the three new obligations from its debtor onto the house it's to be owed to; while it's held over a house, the loops
// it would net are lit and what they'd score is shown, or the defaults it would cause. Let go on a house to book it (or
// tap the obligation, then the house). Houses with no currency in common book through a middle house, which you choose
// when there is more than one; tap a house with nothing in hand to open a currency line, where a level has them. The
// rules are netting-engine.js's, the levels netting-levels.js's; this file draws the table, plays each booking out and
// keeps the game.
import { INTEREST, LINE_COST, newGame, book, net, reach, canOpen, settle, wipe, goal, stars, moves, largest } from "./netting-engine.js";
import { SECTIONS, LEVELS, ENDLESS, CURRENCIES, levelById } from "./netting-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";
import { roundOver } from "./random.js";
import { sure } from "./sure.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "netting:run", BEST = "netting:best", STARS = "netting:stars";
const R = 36, DISC = 8.5;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (netting-engine.js's), as saved
let L = null;            // its level (netting-levels.js's)
let playing = false;     // a booking being played out
let drag = null;         // an obligation in hand: { slot, from, amount, id, x0, y0, moved, to, at }
let picked = -1;         // an obligation tapped, to book with a tap on a house
let choose = null;       // a choice waiting: { title, options: [{ label, sub, go }] } (a middle house, a line to open)
let browsing = false;    // the list of levels showing in place of the table

const N = () => S.cap.length;
const valid = g => { const l = g && g.v === 2 && levelById(g.level); return !!l && Array.isArray(g.owes) && g.owes.length === l.houses.length ** 2 && Array.isArray(g.hand) && Array.isArray(g.cur) && ["play", "won", "lost"].includes(g.status); };
const save = () => write(RUN, S);
const starsOf = () => read(STARS, {});
/** The level to play next: the first not yet won. */
const current = () => LEVELS.find(l => !starsOf()[l.id]) || null;
const unlocked = l => { const i = LEVELS.indexOf(l); return i <= 0 || !!starsOf()[LEVELS[i - 1].id]; };

function start(id, seed) {
  L = levelById(id);
  const sd = seed ?? (L.seeds?.length ? L.seeds[Math.floor(Math.random() * L.seeds.length)] : Math.floor(Math.random() * 2 ** 31));
  S = newGame(L, sd);
  drag = null; picked = -1; choose = null; browsing = false;
  save();
  render();
}

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const pos = (k, n = N()) => { const a = ((-90 + (360 / n) * k) * Math.PI) / 180; return [R * Math.cos(a), R * Math.sin(a)]; };
const text = (cls, x, y, t) => { const n = el("text", { class: cls, x: x.toFixed(2), y: y.toFixed(2) }); n.textContent = t; return n; };
const name = k => L.houses[k].n;
const list = ks => ks.map(name).join(", ").replace(/, ([^,]*)$/, " and $1");
const signed = n => (n < 0 ? `−${-n}` : String(n));
/** An arc round a centre, clockwise from the top, so far round (0 to 1; all the way round, two halves). */
function arc(cx, cy, r, share) {
  const top = `${cx.toFixed(2)} ${(cy - r).toFixed(2)}`;
  if (share >= 1) return `M${top}A${r} ${r} 0 1 1 ${cx.toFixed(2)} ${(cy + r).toFixed(2)}A${r} ${r} 0 1 1 ${top}`;
  const a = 2 * Math.PI * share, ex = cx + r * Math.sin(a), ey = cy - r * Math.cos(a);
  return `M${top}A${r} ${r} 0 ${share > .5 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}
/** The currency an arrow between two houses is drawn in: the first they share, or none (a pending one to a house they share none with). */
const currencyOf = (t, i, j) => t.cur[i].find(c => t.cur[j].includes(c));
/**
 * An arrow from house i to a point, or to house j: its line, its head, and the amount on it, nearer the debtor, with a
 * ring round the amount filling as the hands it has stood (age) bring interest due.
 */
function arrowEl(i, [tx, ty], amount, cls = "", toHouse = true, age = 0, edge = null, n = N()) {
  const [fx, fy] = pos(i, n), dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const sx = fx + ux * (DISC + 1), sy = fy + uy * (DISC + 1), ex = tx - ux * (toHouse ? DISC + 2.6 : 0), ey = ty - uy * (toHouse ? DISC + 2.6 : 0);
  const head = `M${(ex + ux * 2.6).toFixed(2)} ${(ey + uy * 2.6).toFixed(2)}L${(ex - uy * 1.6).toFixed(2)} ${(ey + ux * 1.6).toFixed(2)}L${(ex + uy * 1.6).toFixed(2)} ${(ey - ux * 1.6).toFixed(2)}Z`;
  const lx = sx + (ex - sx) * .42, ly = sy + (ey - sy) * .42;
  const chip = el("g", { class: "nt-chipg" }, el("circle", { class: "nt-chip", cx: lx.toFixed(2), cy: ly.toFixed(2), r: 2.9 }), text("nt-amount", lx, ly, amount));
  if (age > 0) chip.append(el("path", { class: `nt-age${age >= INTEREST - 1 ? " due" : ""}`, d: arc(lx, ly, 3.75, age / INTEREST) }));
  return el("g", { class: `nt-arrow ${cls}`.trim(), "data-edge": edge },
    el("line", { x1: sx.toFixed(2), y1: sy.toFixed(2), x2: ex.toFixed(2), y2: ey.toFixed(2), "stroke-width": (.5 + .3 * amount).toFixed(2) }), el("path", { class: "nt-head", d: head }), chip);
}
/** A house: its disc, its name, its net debt of its limit (below zero when it is owed more than it owes), its currencies and a gauge round it. */
function houseEl(k, t, cls = "") {
  const [x, y] = pos(k, t.cap.length), o = net(t, k), limit = t.cap[k], g = el("g", { class: `nt-house ${cls}`.trim(), "data-house": k, transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` });
  g.append(el("circle", { class: "nt-disc", r: DISC }));
  if (o > 0) g.append(el("path", { class: `nt-gauge${o >= limit - 2 ? " near" : ""}`, d: arc(0, 0, DISC + 1.2, o / limit) }));
  const of = text("nt-owed", 0, 2.4, `${signed(o)}/`);
  of.append(el("tspan", { class: limit < (L.limit || 10) ? "cut" : null }, String(limit)));
  const marks = text("nt-marks", 0, 6.1, "");
  for (const c of t.cur[k]) marks.append(el("tspan", { class: `cur${c}` }, CURRENCIES[c].mark));
  g.append(text("nt-name", 0, -2.2, name(k)), of, marks);
  return g;
}
/**
 * The table: what's owed, the limits, the currencies and the interest clocks (S's, or extra.table's), with extra: { lit
 * (loops to light: [[houses round]]), pending ({ edges: [[from, to]], amount, at: a point when held over no house }),
 * tag ([text, house]), from (the debtor in hand), to (the creditor held over), flash (a house defaulting), doomed
 * (houses that would default) }.
 */
function drawBoard(extra = {}) {
  const t = extra.table || S, n = t.cap.length, lit = new Set(), doomed = new Set(extra.doomed);
  for (const loop of extra.lit || []) for (let k = 0; k < loop.length; k++) lit.add(loop[k] * n + loop[(k + 1) % loop.length]);
  const arrows = el("g", {});
  t.owes.forEach((a, e) => {
    if (a <= 0) return;
    const i = Math.floor(e / n), j = e % n, c = currencyOf(t, i, j);
    arrows.append(arrowEl(i, pos(j, n), a, `${lit.has(e) ? "lit " : ""}${c !== undefined ? "cur" + c : ""}`, true, t.age[e], e, n));
  });
  const p = extra.pending;
  if (p) for (const [a, b] of p.edges) arrows.append(arrowEl(a, b >= 0 ? pos(b, n) : p.at, p.amount, `pending${lit.has(a * n + b) ? " lit" : ""}`, b >= 0, 0, null, n));
  const houses = el("g", {});
  for (let k = 0; k < n; k++) houses.append(houseEl(k, t, k === extra.flash ? "flash" : doomed.has(k) ? "doomed" : k === extra.from ? "debtor" : k === extra.to ? "creditor" : ""));
  const marks = el("g", {});
  if (extra.tag) { const [x, y] = pos(extra.tag[1], n); marks.append(text("nt-tag", x, y < 0 ? y + DISC + 6.5 : y - DISC - 3.5, extra.tag[0])); }
  $("board").replaceChildren(el("circle", { class: "nt-table", r: 49 }), arrows, houses, marks, el("g", { id: "fx" }));
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  const lives = $("lives"), total = L.lives ?? 1;
  lives.replaceChildren(...Array.from({ length: total }, (_, k) => { const i = document.createElement("i"); if (k < S.lives) i.className = "on"; return i; }));
  lives.setAttribute("aria-label", `${S.lives} of ${total} ${total === 1 ? "life" : "lives"}`);
  const g = goal(L, S);
  const word = { gross: "Gross", loops: "Loops", houses: "Span", owed: "Owed" }[g.unit];
  $("goal").textContent = L.charter.type === "endless" ? `Best ${fmt(Math.max(read(BEST, 0), S.score))}` : g.of === 0 ? `${word} ${g.have}` : `${word} ${g.have}/${g.of}`;
  $("goal").style.setProperty("--done", g.frac);
}
/** What a result says, and its buttons. */
function drawResult() {
  const box = $("resultBtns"), btn = (label, fn, primary) => Object.assign(document.createElement("button"), { type: "button", className: primary ? "nt-go" : "nt-go quiet", textContent: label, onclick: fn });
  const next = LEVELS[LEVELS.indexOf(L) + 1];
  if (L.charter.type === "endless") {
    const best = read(BEST, 0);
    $("verdict").textContent = `A third default: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    box.replaceChildren(btn("New game", () => start(L.id), true), btn("Levels", showLevels));
  } else if (S.status === "won") {
    const n = stars(L, S);
    $("verdict").textContent = `${L.id} done: ${"★".repeat(n)}${"☆".repeat(3 - n)} ${L.charter.type === "hold" ? `${S.gross} gross cancelled` : `${S.booked} bookings, par ${L.par}`}, ${fmt(S.score)}`;
    box.replaceChildren(...(next ? [btn(`Next: ${next.id}`, () => start(next.id), true), btn("Again", () => start(L.id)), btn("Levels", showLevels)] : [btn("Again", () => start(L.id), true), btn("Levels", showLevels)]));
  } else {
    $("verdict").textContent = S.why;
    box.replaceChildren(btn("Try again", () => start(L.id), true), btn("Levels", showLevels));
  }
}
/** The line under the table (textLine, or what stands), and the obligations in hand (S's, or hand while one plays out). */
function drawSide(textLine, hand = S.hand) {
  const over = S.status !== "play";
  $("tray").hidden = over || !!choose;
  $("pick").hidden = over || !choose;
  $("result").hidden = !over;
  $("line").hidden = over;
  if (over) { drawResult(); return; }
  // the house with least room under its limit, and how many obligations the next hand will charge interest on
  const room = k => S.cap[k] - net(S, k), live = [...Array(N()).keys()].filter(k => net(S, k) > 0).sort((a, b) => room(a) - room(b))[0];
  const due = L.features?.interest ? S.owes.filter((a, e) => a && S.age[e] >= INTEREST - 1).length : 0;
  const pace = L.pace ? `Obligations up to ${largest(S.hands - 1)}; ` : L.hands ? `Hand ${S.hands} of ${L.hands}; ` : "";
  $("line").textContent = textLine ?? (S.booked === 0 && L.note ? `${L.id !== "endless" ? L.id + " " : ""}${L.note}`
    : `${pace}${live != null ? `${name(live)} nearest its limit, ${net(S, live)} of ${S.cap[live]}` : "nobody owes anything net"}${due ? `; ${due} due interest next hand` : ""}`);
  if (choose) {
    const box = $("pick");
    box.replaceChildren(...choose.options.map(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nt-card";
      b.append(Object.assign(document.createElement("b"), { textContent: o.label }), Object.assign(document.createElement("span"), { textContent: o.sub }));
      b.onclick = () => { choose = null; o.go(); };
      return b;
    }), Object.assign(document.createElement("button"), { type: "button", className: "nt-card nt-cancel", textContent: "Cancel", onclick: () => { choose = null; render(); } }));
    box.style.setProperty("--n", choose.options.length + 1);
    return;
  }
  for (const b of document.querySelectorAll(".nt-card[data-slot]")) {
    const slot = Number(b.dataset.slot), h = hand[slot];
    b.disabled = !h;
    b.classList.toggle("picked", slot === picked);
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.replaceChildren(...(h ? [Object.assign(document.createElement("b"), { textContent: h.amount }), Object.assign(document.createElement("span"), { textContent: `owed by ${name(h.from)}` })] : []));
    b.setAttribute("aria-label", h ? `${name(h.from)} owes ${h.amount}: drag it onto the house it's owed to` : "Booked");
  }
}
function render() {
  $("levels").hidden = !browsing;
  for (const id of ["ring", "side"]) $(id).hidden = browsing;
  document.querySelector(".nt-strip").hidden = browsing;
  if (browsing) { drawLevels(); return; }
  drawBoard({ from: picked >= 0 ? S.hand[picked]?.from : undefined });
  drawStrip();
  drawSide();
}

// ---------- the levels ----------
function drawLevels() {
  const box = $("levels"), done = starsOf(), now = current(), best = read(BEST, 0);
  const tile = (l, label, sub, mark, off, on) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `nt-level${l === now ? " now" : ""}`;
    b.disabled = off;
    b.append(Object.assign(document.createElement("b"), { textContent: label }), Object.assign(document.createElement("span"), { textContent: sub }), Object.assign(document.createElement("i"), { textContent: mark }));
    b.onclick = on;
    return b;
  };
  const kids = SECTIONS.map(sec => {
    const g = document.createElement("section"), grid = document.createElement("div");
    grid.className = "nt-grid";
    grid.append(...sec.levels.map(l => tile(l, l.id, l.name, `${"★".repeat(done[l.id] || 0)}${"☆".repeat(3 - (done[l.id] || 0))}`, !unlocked(l), () => open(l.id))));
    g.className = "nt-sec";
    g.append(Object.assign(document.createElement("h2"), { textContent: `${sec.id}. ${sec.name}` }), Object.assign(document.createElement("p"), { textContent: sec.blurb }), grid);
    return g;
  });
  const end = document.createElement("section"), grid = document.createElement("div");
  grid.className = "nt-grid one";
  grid.append(tile(null, "Endless", "Three lives; obligations grow as it goes on", best ? `Best ${fmt(best)}` : "", false, () => open("endless")));
  end.className = "nt-sec";
  end.append(Object.assign(document.createElement("h2"), { textContent: "Endless" }), grid);
  box.replaceChildren(...kids, end);
}
function showLevels() {
  browsing = true;
  render();
}
/** Starts a level, asking first before it leaves a game you've begun. */
async function open(id) {
  if (S && S.status === "play" && S.booked > 0 && !(await sure("Leave this game and start another?", { yes: "Start" }))) return;
  start(id);
}

/** What booking an obligation to a house would do, shown on the table and in the line. */
function show(slot, to, at) {
  const h = S.hand[slot];
  if (to < 0) { drawBoard({ pending: { edges: [[h.from, -1]], at, amount: h.amount }, from: h.from }); drawSide(`${name(h.from)} owes ${h.amount}: to whom?`); return; }
  const vias = reach(S, slot)[to];
  if (vias.length > 1) {
    drawBoard({ pending: { edges: [[h.from, to]], amount: h.amount }, from: h.from, to });
    drawSide(`${name(h.from)} and ${name(to)} share no currency: through ${list(vias)}`);
    return;
  }
  const r = book(L, S, { slot, to, via: vias[0] }), later = r.dealt?.defaulted || [], [, ...tipped] = r.defaulted, via = vias[0];
  const o = net(r.state, h.from), cap = S.cap[h.from];
  drawBoard({ pending: { edges: r.edges, amount: h.amount }, lit: r.loops.map(l => l.houses), tag: r.gain ? [`+${fmt(r.gain)}`, to] : null, from: h.from, to, doomed: [...r.defaulted, ...later] });
  drawSide((r.defaulted.length ? `${name(h.from)} would carry ${signed(o)} of ${cap}, and default${tipped.length ? `, taking ${list(tipped)} with it` : ""}`
    : r.state.status === "won" ? `Charter met${r.gain ? `: +${fmt(r.gain)}` : ""}`
    : r.gross ? `${r.loops.length === 1 ? `A loop of ${r.loops[0].houses.length}` : `${r.loops.length} loops`} nets out ${r.gross}: +${fmt(r.gain)}`
      : `No loop: ${name(h.from)} would carry ${signed(o)} of ${cap}`)
    + (via != null ? `, through ${name(via)}` : "")
    + (later.length ? `; with the new hand's interest, ${list(later)} ${later.length === 1 ? "defaults" : "default"}` : ""));
}

// ---------- booking ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
/** Books an obligation to a house, asking which middle house first when there are several. */
function bookTo(slot, to) {
  const vias = reach(S, slot)[to], h = S.hand[slot];
  if (!vias || !h) return;
  if (vias.length === 1) { commit({ slot, to, via: vias[0] }); return; }
  choose = {
    options: vias.map(via => {
      const r = book(L, S, { slot, to, via });
      return { label: `via ${name(via)}`, sub: r.defaulted.length || r.dealt?.defaulted.length ? "default" : r.gain ? `+${fmt(r.gain)}` : "no loop", go: () => commit({ slot, to, via }) };
    }),
  };
  picked = -1;
  render();
  drawBoard({ pending: { edges: [[h.from, to]], amount: h.amount }, from: h.from, to });
  $("line").textContent = `${name(h.from)} and ${name(to)} share no currency: which house carries it?`;
}
async function commit(mv) {
  if (playing || S.status !== "play") return;
  playing = true;
  picked = -1;
  const before = S, r = book(L, S, mv);
  S = r.state;
  save();
  if (mv.line) {
    toast(`${name(mv.house)} opened a ${CURRENCIES[mv.cur].name} line`);
    playing = false;
    render();
    return;
  }
  if (L.charter.type === "endless" && S.score > read(BEST, 0)) write(BEST, S.score);
  const n = before.cap.length, amount = before.hand[mv.slot].amount;
  // booked, then each loop lit and netted, then any defaults written off one by one, then the new hand's interest
  const was = { owes: before.owes.slice(), age: before.age.slice(), cap: before.cap, cur: before.cur };
  for (const [a, b] of r.edges) { was.owes[a * n + b] += amount; was.age[a * n + b] = 0; }
  drawBoard({ table: was });
  drawStrip();
  // the hand as it was, less the one booked, until a new one comes at the end
  drawSide(" ", before.hand.map((h, k) => (k === mv.slot ? null : h)));
  if (r.loops.length) {
    drawBoard({ table: was, lit: r.loops.map(l => l.houses) });
    await wait(420);
    const owes = was.owes.slice();
    settle(owes, n);
    Object.assign(was, { owes });
    drawBoard({ table: was });
    popup(r.loops.flatMap(l => l.houses), r.gain);
    await wait(380);
  }
  if (r.defaulted.length) await fall(r.defaulted, was, Math.max(0, before.lives - r.defaulted.length), "");
  if (r.dealt && (r.dealt.interest.length || r.dealt.defaulted.length)) {
    drawBoard({ table: r.dealt.table });
    for (const e of r.dealt.interest) pop($("board").querySelector(`[data-edge="${e}"] .nt-chip`));
    pulse(r.dealt.interest.map(e => `[data-edge="${e}"] .nt-chipg`));
    await wait(650);
    if (r.dealt.defaulted.length) await fall(r.dealt.defaulted, r.dealt.table, S.lives, "with interest, ");
  }
  if (S.status === "won") {
    const done = starsOf(), n2 = stars(L, S);
    if (n2 > (done[L.id] || 0)) { done[L.id] = n2; write(STARS, done); }
  }
  render();
  if (r.dealt && S.status === "play") for (const b of document.querySelectorAll(".nt-card[data-slot]")) animate(b, [{ transform: "scale(.85)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220, easing: "ease-out" });
  playing = false;
  if (S.status !== "play") roundOver("netting");
}
/**
 * Houses defaulting one after another from the table as it stood, each flashed as its debts go (and its creditors lose
 * what they were owed, so carry more), a word for them all.
 */
async function fall(houses, table, lives, how) {
  const [first, ...tipped] = houses, lead = how ? how[0].toUpperCase() + how.slice(1) : "";
  toast(`${lead}${name(first)} defaults${tipped.length ? `, taking ${list(tipped)} with it` : ""}: ${lives ? `${lives} ${lives === 1 ? "life" : "lives"} left` : "no lives left"}`);
  let now = table;
  for (const d of houses) {
    drawBoard({ table: now, flash: d });
    await wait(520);
    now = wipe(now, d);
  }
  drawBoard({ table: now });
  await wait(300);
}
/** Whatever the selectors find on the table swells and settles: an obligation grown. */
function pulse(selectors) {
  for (const sel of selectors) animate($("board").querySelector(sel), [{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }], { duration: 520, easing: "ease-in-out" });
}
/** "+1" rising from an amount that interest grew. */
function pop(chip) {
  if (!chip) return;
  const t = text("nt-pop interest", Number(chip.getAttribute("cx")), Number(chip.getAttribute("cy")) - 4, "+1");
  $("board").querySelector("#fx").append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-6px)", opacity: 0 }], { duration: 900, easing: "ease-out" });
}
function popup(houses, gain) {
  const fx = $("board").querySelector("#fx"), u = [...new Set(houses)].map(k => pos(k));
  const t = text(`nt-pop${gain >= 1000 ? " big" : ""}`, u.reduce((a, p) => a + p[0], 0) / u.length, u.reduce((a, p) => a + p[1], 0) / u.length, `+${fmt(gain)}`);
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-10px)", opacity: 0 }], { duration: 1100, easing: "ease-out" });
}

// ---------- dragging an obligation, opening a line ----------
const pointIn = (px, py) => { const m = $("board").getScreenCTM(); return m ? new DOMPoint(px, py).matrixTransform(m.inverse()) : null; };
/** The house under a point on the screen, or -1. */
function houseAt(px, py) {
  const p = pointIn(px, py);
  if (!p) return -1;
  for (let k = 0; k < N(); k++) { const [x, y] = pos(k); if (Math.hypot(p.x - x, p.y - y) <= DISC + 3.5) return k; }
  return -1;
}
function startDrag(e, slot) {
  const h = S.hand[slot];
  if (playing || S.status !== "play" || !h || choose || e.button > 0) return;
  e.preventDefault();
  drag = { slot, from: h.from, amount: h.amount, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, to: -1 };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; picked = -1; drawSide(); }
  if (!drag.moved) return;
  const k = houseAt(e.clientX, e.clientY), to = k === drag.from ? -1 : k, p = pointIn(e.clientX, e.clientY);
  if (to === drag.to && to >= 0) return;
  drag.to = to;
  show(drag.slot, to, p ? [p.x, p.y] : pos(drag.from));
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, to, moved } = drag;
  drag = null;
  if (moved && to >= 0) { bookTo(slot, to); return; }
  // a tap: the obligation picked up (or put down), to book with a tap on a house
  if (!moved) picked = picked === slot ? -1 : slot;
  render();
}
/** A line a house could open: the choices, or a word on why not. */
function lineMenu(k) {
  const opts = moves(L, S).filter(m => m.line && m.house === k);
  if (!opts.length) { toast(canOpen(S, k) ? `${name(k)} already trades in every currency` : `${name(k)} can't spare ${LINE_COST} of its limit`); return; }
  choose = { options: opts.map(m => ({ label: `${CURRENCIES[m.cur].mark} ${CURRENCIES[m.cur].name}`, sub: `${name(k)} limit −${LINE_COST}`, go: () => commit(m) })) };
  render();
  $("line").textContent = `${name(k)}: open a currency line? Its limit falls from ${S.cap[k]} to ${S.cap[k] - LINE_COST}, for good`;
}
/** A tap on a house with an obligation picked up books it there (with none, it offers a line); a mouse over a house shows it first. */
function tapBoard(e) {
  if (playing || S.status !== "play" || drag || choose) return;
  const k = houseAt(e.clientX, e.clientY);
  if (k < 0) return;
  if (picked < 0) { if (L.features?.lines) lineMenu(k); return; }
  const h = S.hand[picked];
  if (!h) return;
  if (k === h.from) { toast("An obligation is owed to another house"); return; }
  bookTo(picked, k);
}
function hoverBoard(e) {
  if (e.pointerType !== "mouse" || picked < 0 || drag || playing || choose || !S.hand[picked]) return;
  const k = houseAt(e.clientX, e.clientY), to = k === S.hand[picked].from ? -1 : k;
  if (to >= 0) show(picked, to);
  else render();
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (!browsing) play.append(action(L.charter.type === "endless" ? "New game" : "Restart this level", () => open(L.id), "primary"));
  play.append(action(browsing ? "Back to the table" : "Levels", () => { browsing = !browsing; render(); }, browsing ? "primary" : ""));
  const best = read(BEST, 0), won = LEVELS.filter(l => starsOf()[l.id]).length;
  part(body, "about").append(line(`Levels won: ${won} of ${LEVELS.length}${best ? `; endless best ${fmt(best)}` : ""}`));
  if (S && !browsing) part(body, "about").append(line(`This game: ${fmt(S.score)}, ${S.gross} gross netted in ${S.booked} booking${S.booked === 1 ? "" : "s"}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "netting");
document.querySelector(".nt-mark").innerHTML = APPS.find(a => a.id === "netting").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".nt-card[data-slot]")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { drag = null; render(); } });
$("board").addEventListener("pointerup", tapBoard);
$("board").addEventListener("pointermove", hoverBoard);

// for tests and debugging
window.__netting = { get state() { return S; }, get level() { return L; }, commit, bookTo, houseAt, start, showLevels, render, ENDLESS };

S = read(RUN, null);
if (valid(S)) { L = levelById(S.level); render(); }
else start((current() || ENDLESS).id);
