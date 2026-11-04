// Shoe: a deck on a table, no rules. One phone is the table (the piles, who holds how many, a log of what was done); the
// others hold private hands. The cards are shoe-core.js's, kept in the table's `game` (table.js); every change is an act
// transaction. Playing with others goes through a party (the menu's Invite players), as the other table games do.
import * as S from "./shoe-core.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { openTable, inviteSheet, tableInAddress } from "./table-ui.js";
import { IN_FRAME } from "./suite.js";
import { scale } from "./wide.js";
import { busy } from "./loading.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "shoe:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const opts = { decks: 1, jokers: false, ...read(OPTS, {}) };
const saveOpts = () => { try { localStorage.setItem(OPTS, JSON.stringify(opts)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let toastTimer = 0;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

let G = null, sel = new Set(), sortBy = "suit", selPile = null, asked = false;
const party = /[?&]party=[A-Za-z]{4}\b/.test(location.search);

// ---------- the table ----------
const remote = openTable({
  game: "shoe", app: 1, max: 10, toast,
  onState: () => { invite.update(); ensureGame(); draw(); },
  onLeave: () => { invite.close(); G = null; draw(); },
});
const invite = inviteSheet(remote, { title: "Invite players", note: "Scan with the camera, or open the link: no app needed. Whoever scans gets a hand; this phone is the table." });

/** The host's phone sets the table out the first time it's here: a shuffled shoe, this phone the table. */
function ensureGame() {
  if (!remote.me?.host || remote.data?.game || asked) return;
  asked = true;
  remote.act(b => { if (b.game) return false; b.game = S.fresh(opts); S.setTable(b.game, remote.uid, true); }).finally(() => { asked = false; });
}
const P = () => ({ uid: remote.uid, name: remote.me?.name || "Someone" });
/** One change to the cards, as one transaction; fn(G, me) says whether it did anything. */
async function go(fn, nothing = "") {
  if (!remote.code) return false;
  const ok = await remote.act(b => (b.game && fn(b.game, P()) ? undefined : false));
  if (!ok && nothing) toast(nothing);
  return ok;
}

// ---------- drawing ----------
const faceMarkup = (id, cls = "", data = {}) => cardHtml(S.faceOf(id), { cls, data, label: S.nameOf(id) });
const pileCard = (c, data = {}) => (S.downC(c) ? backHtml().replace('class="cd back', `${Object.entries(data).map(([k, v]) => `data-${k}="${v}" `).join("")}class="cd back`) : faceMarkup(S.idOf(c), "", data));
const pileName = k => (k === "stock" ? "Draw pile" : k === "discard" ? "Discard" : `Pile ${k.slice(1)}`);
const myHand = () => (G && remote.uid ? S.hand(G, remote.uid) : []);
const isTable = () => !!(G && remote.uid && G.tv?.[remote.uid]);

function draw() {
  const app = $("app"), at = !!(remote.code && remote.me);
  G = at ? remote.data?.game || null : null;
  const tv = isTable();
  app.classList.toggle("is-tv", !!G && tv);
  app.classList.toggle("is-hand", !!G && !tv);
  sel = new Set([...sel].filter(id => myHand().includes(id)));
  if (selPile && !S.pile(G || {}, selPile).length) selPile = null;
  drawStrip();
  drawBoard();
  drawLog();
  drawHand();
  drawBar();
}

function drawStrip() {
  const el = $("strip");
  if (!G) { el.textContent = ""; return; }
  const n = S.playersOf(G, remote.players).length;
  el.innerHTML = `Table ${remote.code} · <b>${n}</b> ${n === 1 ? "player" : "players"} · <b>${S.total(G)}</b> cards`;
}

function drawBoard() {
  const board = $("board");
  if (!G) {
    const text = remote.code ? "Setting the table…" : "A deck of cards for people in one room. One phone is the table, the others hold private hands.";
    board.innerHTML = `<div class="sh-empty"><p>${esc(text)}</p></div>`;
    if (!remote.code && !IN_FRAME) {
      const b = Object.assign(document.createElement("button"), { className: "btn primary", type: "button", textContent: "Invite players" });
      b.addEventListener("click", inviteNow);
      board.querySelector(".sh-empty").append(b);
    }
    return;
  }
  const seats = S.playersOf(G, remote.players);
  board.innerHTML = `<div class="sh-seats"></div><div class="sh-felt"></div>`;
  const seatBox = board.firstChild, felt = board.lastChild;
  for (const p of seats) {
    const h = S.hand(G, p.uid), d = document.createElement("div");
    d.className = `sh-seat${p.uid === remote.uid ? " me" : ""}${p.online === false ? " away" : ""}`;
    d.innerHTML = `<b>${esc(p.name)}</b><span class="sh-n" title="Cards held">${h.length}</span>`;
    if (G.open?.[p.uid] && h.length) d.innerHTML += `<span class="sh-shown">${h.map(id => faceMarkup(id)).join("")}</span>`;
    seatBox.append(d);
  }
  if (!seats.length) seatBox.innerHTML = `<span class="sh-seat">Nobody has a hand yet</span>`;
  const keys = ["stock", "discard", ...S.freePiles(G)];
  const size = fitPiles(felt, keys);
  felt.style.setProperty("--sh-size", `${size.px}px`);
  felt.innerHTML = keys.map(k => pileHtml(k, size.step[k])).join("");
}

/** The largest card size at which every pile fits the felt, and how far apart a fanned pile's cards lie. */
function fitPiles(felt, keys) {
  const w = felt.clientWidth, h = felt.clientHeight, rem = 16 * scale(), gx = .9 * rem, gy = .55 * rem, lab = 1.4 * rem;
  let px = 6, step = {};
  for (let s = 56 * scale(); s >= 6; s -= .5) {
    step = {};
    let x = 0, y = 0, rowH = 0, rows = 1, fits = true;
    for (const k of keys) {
      const n = S.pile(G, k).length;
      let iw = Math.max(2.5 * s, 5.4 * rem * .8);
      if (G.spread?.[k] && n > 1) {
        const want = Math.min(w, 2.5 * s + (n - 1) * 1.1 * s);
        iw = Math.max(iw, want);
        step[k] = Math.max(.35, (want - 2.5 * s) / ((n - 1) * s));
      }
      const ih = 3.5 * s + lab;
      if (x && x + iw > w) { y += rowH + gy; x = 0; rowH = 0; rows++; }
      x += iw + gx; rowH = Math.max(rowH, ih);
      if (iw > w + 1) fits = false;
    }
    if (fits && y + rowH <= h) { px = s; break; }
    px = s;
  }
  return { px, step };
}

function pileHtml(k, step) {
  const l = S.pile(G, k), n = l.length;
  const label = `${pileName(k)}${n ? ` · ${n}` : ""}`;
  let top;
  if (!n) top = `<span class="sh-slot"></span>`;
  else if (G.spread?.[k] && n > 1) top = `<span class="sh-spread" style="--sh-step:${step ?? 1.1}em">${l.map((c, i) => pileCard(c, { i })).join("")}</span>`;
  else top = `<span class="sh-top">${pileCard(l[n - 1])}</span>`;
  return `<button type="button" class="sh-pile${n > 1 && !G.spread?.[k] ? " deep" : ""}${selPile === k ? " sel" : ""}" data-k="${k}" aria-label="${esc(label)}">${top}<span class="sh-lab">${esc(label)}</span></button>`;
}

function drawLog() {
  const log = $("log"), lines = (G?.log || []).slice(isTable() ? -5 : -1);
  log.replaceChildren(...lines.map(t => Object.assign(document.createElement("p"), { textContent: t })));
}

function drawHand() {
  const box = $("hand"), h = myHand();
  box.hidden = !G || isTable();
  box.replaceChildren();
  if (box.hidden) return;
  if (!h.length) { box.innerHTML = `<p class="sh-none">No cards in your hand.<br>Draw from the pile, or wait for the deal.</p>`; return; }
  const rem = 16 * scale(), w = box.clientWidth, avail = box.clientHeight - .5 * rem;
  let rows = 1;
  for (; rows < 4; rows++) {
    const size = Math.min(2.6 * rem, (avail / rows - .6 * rem) / 3.5), cw = 2.5 * size, c = Math.ceil(h.length / rows);
    if (c <= 1 || (w - cw) / (c - 1) >= .42 * cw) break;
  }
  const per = Math.ceil(h.length / rows);
  for (let r = 0; r < rows; r++) {
    const row = document.createElement("div");
    row.className = "sh-row";
    row.innerHTML = h.slice(r * per, (r + 1) * per).map(id => faceMarkup(id, sel.has(id) ? "sel" : "", { id })).join("");
    box.append(row);
    fitRow(row, Math.min(per, h.length - r * per), { max: 2.6, min: .7 });
  }
}

function drawBar() {
  const bar = $("bar");
  bar.replaceChildren();
  if (!G) return;
  const btn = (text, fn, cls = "", off = false) => {
    const b = Object.assign(document.createElement("button"), { type: "button", className: `btn ${cls}`.trim(), textContent: text, disabled: off });
    b.addEventListener("click", fn);
    return b;
  };
  const row = (...b) => { const r = document.createElement("div"); r.className = "row"; r.append(...b); bar.append(r); };
  if (isTable()) {
    row(btn("Deal…", dealSheet, "primary main"), btn("Shuffle", () => go(S.shuffle, "Nothing to shuffle")));
    row(btn("Turn a card", () => go(g => S.move(g, "stock", 1, "discard", true), "The draw pile is empty")), btn("Collect all", collectAll));
    return;
  }
  const n = sel.size;
  row(btn("Draw", drawSheet), btn(n ? `Play ${n}` : "Play", playSheet, "primary main", !n), btn("Pass", passSheet, "", !n));
  row(btn("◀", () => shift(-1), "small", !n), btn("▶", () => shift(1), "small", !n),
    btn(`By ${sortBy}`, () => { const by = sortBy; sortBy = by === "suit" ? "rank" : "suit"; go(g => S.sortHand(g, remote.uid, by)); }, "mid"),
    btn(G.open?.[remote.uid] ? "Hide" : "Show", () => go((g, p) => S.reveal(g, p, !g.open?.[p.uid]), "Nothing to show yet")));
}
const shift = dir => go(g => S.shift(g, remote.uid, [...sel].sort((a, b) => myHand().indexOf(a) - myHand().indexOf(b)), dir));

// ---------- asking what to do ----------
/** groups: [{ label, buttons: [[text, fn]…] }]; a button closes the sheet, then runs. */
function ask(title, groups) {
  $("askHead").textContent = title;
  const body = $("askBody");
  body.replaceChildren();
  for (const g of groups) {
    if (!g.buttons.length) continue;
    const box = document.createElement("div");
    box.className = "grp";
    if (g.label) box.innerHTML = `<span>${esc(g.label)}</span>`;
    const row = document.createElement("div");
    for (const [text, fn, kind] of g.buttons) {
      const b = Object.assign(document.createElement("button"), { type: "button", className: `btn ${kind || ""}`.trim(), textContent: text });
      b.addEventListener("click", () => { $("askDlg").close(); fn(); });
      row.append(b);
    }
    box.append(row);
    body.append(box);
  }
  if (!$("askDlg").open) $("askDlg").showModal();
}

const others = () => S.playersOf(G, remote.players).filter(p => p.uid !== remote.uid);

function dealSheet() {
  const to = S.playersOf(G, remote.players).map(p => p.uid), have = S.pile(G, "stock").length;
  if (!to.length) { toast("Nobody has a hand yet"); return; }
  const go1 = n => go(g => S.deal(g, n, S.playersOf(g, remote.players).map(p => p.uid)), "The draw pile is empty");
  ask("Deal to everyone", [{ label: `${have} in the draw pile, ${to.length} to deal to`, buttons: [1, 2, 3, 4, 5, 6, 7, 10].map(n => [`${n} each`, () => go1(n)]).concat([["All of it", () => go1(999)]]) }]);
}

function drawSheet() {
  const d = S.pile(G, "discard"), top = d.length ? S.nameOf(S.idOf(d.at(-1))) : "";
  ask("Draw", [
    { label: "From the draw pile", buttons: [1, 2, 3, 5].map(n => [`${n}`, () => go((g, p) => S.draw(g, p, "stock", n), "The draw pile is empty")]) },
    { label: "From the discard", buttons: d.length ? [[`The top card (${top})`, () => go((g, p) => S.draw(g, p, "discard", 1))], ["The whole pile", () => go((g, p) => S.take(g, p, "discard"))]] : [] },
  ]);
}

function playSheet() {
  const ids = [...sel].sort((a, b) => myHand().indexOf(a) - myHand().indexOf(b));
  if (!ids.length) return;
  const run = (to, up) => { sel = new Set(); go((g, p) => S.play(g, p, ids, { to, up }), "Those cards have moved"); };
  const groups = [
    { label: "Discard, face up", buttons: [["Discard", () => run("discard", true)]] },
    { label: "A new pile", buttons: [["Face up", () => run("new", true)], ["Face down", () => run("new", false)]] },
  ];
  for (const k of S.freePiles(G)) groups.push({ label: `Onto ${pileName(k).toLowerCase()}`, buttons: [["Face up", () => run(k, true)], ["Face down", () => run(k, false)]] });
  ask(`Play ${ids.length === 1 ? "this card" : `these ${ids.length} cards`}`, groups);
}

function passSheet() {
  const ids = [...sel], to = others();
  if (!to.length) { toast("There's nobody else to pass to"); return; }
  ask(`Pass ${ids.length === 1 ? "this card" : `these ${ids.length} cards`} to…`, [{ buttons: to.map(o => [o.name, () => {
    sel = new Set();
    go((g, p) => { const n = S.pass(g, p, o.uid, ids); if (n) S.logPass(g, p, o.name, n); return n; }, "Those cards have moved");
  }]) }]);
}

async function collectAll() {
  if (await sure("Collect every card and shuffle them into the draw pile?", { yes: "Collect" })) go(g => S.collect(g));
}

function pileSheet(k) {
  selPile = k;
  const n = S.pile(G, k).length, tv = isTable(), spread = !!G.spread?.[k];
  const groups = [];
  if (!tv) {
    if (k === "stock") groups.push({ label: "Draw", buttons: [1, 2, 3, 5].filter(c => c <= n).map(c => [`${c}`, () => go((g, p) => S.draw(g, p, "stock", c))]) });
    else groups.push({ label: "Take", buttons: [["The top card", () => go((g, p) => S.draw(g, p, k, 1))], ["The whole pile", () => go((g, p) => S.take(g, p, k))]] });
  } else if (k === "stock") {
    groups.push({ label: "Turn over", buttons: [["One onto the discard", () => go(g => S.move(g, "stock", 1, "discard", true))], ["One, as a new pile", () => go(g => S.move(g, "stock", 1, "new", true))]] });
  }
  const tidy = [];
  if (k !== "stock" && n > 0) tidy.push(["Turn the top card over", () => go(g => S.flipCard(g, k))]);
  tidy.push(["Turn the pile over", () => go(g => S.flipPile(g, k))]);
  if (n > 1) tidy.push([spread ? "Close the fan" : "Fan it out", () => go(g => S.toggleSpread(g, k))]);
  if (n > 1) tidy.push(["Shuffle", () => go(g => S.shuffle(g, k))]);
  groups.push({ label: "The pile", buttons: tidy });
  const targets = ["stock", "discard", ...S.freePiles(G)].filter(x => x !== k);
  if (n && targets.length) groups.push({ label: "Put it on…", buttons: targets.map(t => [pileName(t), () => go(g => S.merge(g, k, t))]) });
  ask(`${pileName(k)}, ${n} ${n === 1 ? "card" : "cards"}`, groups);
  drawBoard();
}

function cardSheet(k, i) {
  const c = S.pile(G, k)[i];
  if (c == null) return;
  const buttons = [];
  if (!isTable()) buttons.push(["Take it", () => go((g, p) => S.take(g, p, k, i))]);
  buttons.push(["Turn it over", () => go(g => S.flipCard(g, k, i))]);
  ask(S.downC(c) ? "A face-down card" : S.nameOf(S.idOf(c)), [{ buttons }, { buttons: [["The whole pile…", () => pileSheet(k)]] }]);
}

// ---------- taps ----------
$("board").addEventListener("click", e => {
  const pile = e.target.closest(".sh-pile");
  if (!pile || !G) return;
  const card = e.target.closest(".cd[data-i]");
  if (card) cardSheet(pile.dataset.k, Number(card.dataset.i)); else pileSheet(pile.dataset.k);
});
$("hand").addEventListener("click", e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c) return;
  const id = Number(c.dataset.id);
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  drawHand();
  drawBar();
});
$("askDlg").addEventListener("close", () => { selPile = null; if (G) drawBoard(); });
$("askClose").addEventListener("click", () => $("askDlg").close());

// ---------- menu ----------
function inviteNow() {
  if (remote.code && !party) { invite.open(); return; }
  if (IN_FRAME) return;
  location.href = "party.html?game=shoe&invite=1";
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (remote.code && G) {
    play.append(choice("This phone is", [["hand", "A hand"], ["tv", "The table"]], isTable() ? "tv" : "hand", v => go((g, p) => S.setTable(g, p.uid, v === "tv"))));
    play.append(action("Collect everything and reshuffle", collectAll));
  }
  if (!remote.code) { if (!IN_FRAME) play.append(action("Invite players", inviteNow, "primary")); }
  else if (!party) {
    const n = remote.players.length;
    play.append(line(`Table ${remote.code}: ${n} ${n === 1 ? "person" : "people"} at it.`));
    play.append(action("Invite players", () => invite.open()));
    play.append(action("Leave the table", () => remote.leave(), "link"));
  }
  const set = part(body, "settings");
  set.append(choice("Decks", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], opts.decks, v => { opts.decks = Number(v); saveOpts(); }));
  set.append(toggle("Jokers", opts.jokers, v => { opts.jokers = !!v; saveOpts(); }));
  if (remote.code && G) set.append(action("Start a new shoe with these", async () => {
    if (await sure("Put every card back and start a new shoe?", { yes: "New shoe" })) go(g => S.reshoe(g, opts.decks, opts.jokers));
  }));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "shoe");
document.querySelector(".sh-mark").innerHTML = APPS.find(a => a.id === "shoe")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
addEventListener("resize", () => draw());

if (tableInAddress() && !IN_FRAME) {
  const done = busy("Joining the table", { delay: 0 });
  remote.joinAddress().then(() => { invite.update(); ensureGame(); draw(); }).finally(done);
}
window.__shoe = { remote, get G() { return G; }, get sel() { return sel; } };
draw();
