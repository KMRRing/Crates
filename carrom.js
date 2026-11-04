// Carrom for two: against the computer, with a friend on the same phone, or at a table with a friend each on their own phone.
// The rules are carrom-rules.js's, the physics carrom-engine.js's, the computer carrom-bot.js's, the running seats.js's. This page
// holds what the board cannot show (the players and the men each has left, what is asked, the power of a pull, the buttons) and
// hands the 3D board (carrom-3d.js) each state: a shot that has just been played is replayed on it from the state before, by the
// same simulation that decided it, so both phones of a table watch the same shot.
import { rules, LEVEL_NAMES, downOf, leftOf, NAME } from "./carrom-rules.js";
import { freeXs, colourIds, XR } from "./carrom-engine.js";
import { createScene } from "./carrom-3d.js";
import { seatPage } from "./seats-ui.js";
import { applyMove } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "carrom:opts", RECORD = "carrom:record", AIM = "carrom:aim";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const FIRSTS = [["alternate", "Take turns"], ["white", "White"], ["black", "Black"]];
let opts = { level: "medium", opponent: "computer", guide: "line", first: "alternate", ...read(OPTS, {}) };
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "medium";
if (!FIRSTS.some(([k]) => k === opts.first)) opts.first = "alternate";
if (opts.guide !== "off") opts.guide = "line";
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the table ----------
let V = null, page = null, scene = null, animating = false, token = 0;
const hotseat = () => !!page && !page.atTable && opts.opponent === "friend";
const nameOf = seat => V?.seats?.[seat]?.name ?? (seat === 0 ? "You" : hotseat() ? "Friend" : "Computer");
const botName = seat => (seat === 0 ? "You" : opts.opponent === "friend" ? "Friend" : "Computer");
const isMe = seat => (hotseat() ? V?.toMove === seat : V?.seat === seat);
const who = seat => (V?.seat === seat && !hotseat() ? "You" : nameOf(seat));
/** The seat whose side of the board is nearest: yours at a table, the one to shoot when two share a phone. */
const viewer = v => (hotseat() ? (v.toMove ?? 0) : v.seat ?? 0);

const randomRounds = seatRounds("carrom");
page = seatPage({
  rules, id: "carrom", app: 1, botName, level: () => opts.level,
  pace: s => 650 + (s?.last?.steps ? Math.min(4200, s.last.steps * 8.4) : 0),     // the shot just played is watched before the computer answers
  hold: () => animating || (hotseat() && V?.toMove === 1),
  onView: v => { V = v; follow(v); draw(); randomRounds(v); },
  onOver, toast, newGame: () => newGame(true),
});

// ---------- the board: what changed since it was last drawn ----------
let seen = { key: "", shots: -1 }, drawn = null;
const copyOf = s => ({ px: s.px.slice(), py: s.py.slice(), st: s.st.slice(), n: s.n, shots: s.shots });
function follow(v) {
  if (!scene) return;
  if (animating) { token++; animating = false; scene.skip(); }
  if (!v.G) { seen = { key: "", shots: -1 }; drawn = null; return; }
  const key = `${v.G.seq}:${v.G.started}`, s = v.state, l = s.last;
  const next = key === seen.key && drawn && l?.shot && s.shots === seen.shots + 1;
  if (next) {
    const mine = ++token;
    animating = true;
    scene.replay(drawn, l.shot, l.seat, s, l.returned || []).then(() => {
      if (mine !== token) return;
      animating = false;
      draw();
      page.runner.kick();
    });
    setTimeout(() => { if (mine === token && animating) scene.skip(); }, 15000);     // a hidden page draws nothing, so nothing would end it
  } else if (key !== seen.key || s.shots !== seen.shots) scene.snap(s, l?.returned || []);
  seen = { key, shots: s.shots };
  drawn = copyOf(s);
}

// ---------- the striker's place ----------
let aimX = 0, freeKey = "", blocked = [], lookSeat = 0;
const turnKey = v => `${v.G.seq}:${v.state.shots}:${v.toMove}`;
/** The nearest free place on the baseline to x (the striker cannot stand on a man). */
function nearestFree(x, v = V) {
  if (!v?.G || v.toMove == null) return x;
  const s = v.state, xs = freeXs(v.toMove, s.px, s.py, s.st, 2);
  if (!xs.length) return x;
  let best = xs[0];
  for (const c of xs) if (Math.abs(c - x) < Math.abs(best - x)) best = c;
  return Math.round(best);
}
function placeStriker(v) {
  const key = turnKey(v);
  if (key === freeKey) return;
  freeKey = key;
  const kept = read(AIM, null);
  aimX = nearestFree(kept && kept.k === key ? kept.x : 0, v);
  const s = v.state, free = new Set(freeXs(v.toMove, s.px, s.py, s.st, 10));
  blocked = [];
  let from = null;
  for (let x = -XR; x <= XR; x += 10) {
    if (!free.has(x)) { from ??= x; } else if (from != null) { blocked.push([from - 5, x - 15]); from = null; }
  }
  if (from != null) blocked.push([from - 5, XR]);
}
const keepAim = () => V?.G && write(AIM, { k: turnKey(V), x: aimX });

// ---------- drawing ----------
const canShoot = (v = V) => !!(v?.G && !v.over && !animating && !IN_FRAME && v.toMove != null && (hotseat() || v.seat === v.toMove) && !(!hotseat() && v.seats?.[v.toMove]?.bot));
function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { for (const id of ["strip", "them", "mine", "status"]) $(id).innerHTML = ""; $("controls").innerHTML = ""; scene?.setModel({ canPlay: false }); return; }
  const s = v.state, me = viewer(v);
  if (v.toMove != null) placeStriker(v);
  if (!animating) lookSeat = me;                      // two on a phone: the board turns once the shot has been watched
  scene?.look(lookSeat, !seen.shots);
  scene?.setModel({ seat: v.toMove ?? me, x: aimX, canPlay: canShoot(v), blocked, guide: opts.guide });
  $("strip").innerHTML = `Shot <b>${s.shots + 1}</b> · queen ${s.queen === 0 ? "on the board" : s.queen === 1 ? `down, ${esc(who(s.qs))} must cover it` : `${esc(who(s.qs))}`}`;
  $("them").innerHTML = seatRow(v, 1 - me);
  $("mine").innerHTML = seatRow(v, me);
  $("status").innerHTML = statusHtml(v);
  drawControls(v);
}
function seatRow(v, seat) {
  const s = v.state, c = seat === 0 ? "w" : "b", turn = !v.over && v.toMove === seat;
  const pips = colourIds(seat).map(i => `<i class="ca-pip ${c}${s.st[i] > 0 ? " gone" : ""}"></i>`).join("");
  const held = s.queen === 2 && s.qs === seat, pend = s.queen === 1 && s.qs === seat;
  const queen = `<i class="ca-pip q${held ? " held" : pend ? " held" : " gone"}" title="Queen"></i>`;
  const left = leftOf(s, seat).length;
  return `<span class="ca-swatch ${c}"></span><span class="ca-name">${esc(who(seat))}<small>${NAME[seat].toLowerCase()}</small></span><span class="ca-men" role="img" aria-label="${left} of 9 men left${held ? ", has the queen" : ""}">${pips}${queen}</span>`;
}
function describeLast(v) {
  const s = v.state, l = s.last;
  if (!l) return s.shots ? "" : `${esc(who(s.first))} ${who(s.first) === "You" ? "break" : "breaks"}.`;
  const name = who(l.seat), you = name === "You", verb = (a, b) => (you ? a : b);
  if (l.pass) return `${esc(name)} ${verb("cannot", "cannot")} place the striker: the turn passes.`;
  const mine = new Set(colourIds(l.seat)), p = l.pocketed || [];
  const own = p.filter(i => mine.has(i)).length, opp = p.filter(i => i !== 0 && !mine.has(i)).length, queen = p.includes(0);
  const bits = [];
  if (l.foul) bits.push(`${verb("you pocketed", "pocketed")} the striker, a foul${(l.returned || []).some(i => i !== 0) ? ": a man comes back" : ""}`);
  if (queen && !l.foul) bits.push(s.queen === 2 ? "the queen is down and covered" : "the queen is down: cover it");
  if (own) bits.push(`${own} of ${you ? "your" : "their"} own`);
  if (opp) bits.push(`${opp} of ${you ? "their" : "your"} men`);
  if (!bits.length) bits.push("no pocket");
  const back = (l.returned || []).length && !l.foul ? (queen ? "" : ", a man comes back") : "";
  const text = `${name}: ${bits.join(", ")}${back}.`;
  return esc(text.charAt(0).toUpperCase() + text.slice(1));
}
function statusHtml(v) {
  const s = v.state, last = describeLast(v);
  let ask;
  if (v.over) ask = `<b>${esc(who(s.winner))}</b> ${isMe(s.winner) && !hotseat() ? "clear" : "clears"} the board: ${s.points} point${s.points === 1 ? "" : "s"}.`;
  else if (animating) ask = "&nbsp;";
  else if (canShoot(v)) {
    if (hotseat()) ask = `<b>${esc(nameOf(v.toMove))}</b>: slide the striker, pull back to shoot`;
    else if (s.queen === 1 && s.qs === v.toMove) ask = "<b>Cover the queen</b>: pocket one of your men";
    else ask = s.last && s.last.seat === v.toMove && !s.last.foul && s.last.pocketed?.length ? "<b>Shoot again</b>: pull back from the striker" : "<b>Your shot</b>: slide the striker, pull back to shoot";
  } else ask = v.seats?.[v.toMove]?.bot ? `<b>${esc(nameOf(v.toMove))}</b> <span class="ca-dots">is lining up a shot</span>` : `<b>${esc(nameOf(v.toMove))}</b> is to shoot`;
  return `<span>${ask}</span><span class="last">${last || "&nbsp;"}</span>`;
}
function drawControls(v) {
  const box = $("controls"), play = canShoot(v);
  box.innerHTML = `<button class="btn ca-go nudge" type="button" data-act="left" aria-label="Striker left" ${play ? "" : "disabled"}>‹</button>
    <button class="btn ca-go nudge" type="button" data-act="right" aria-label="Striker right" ${play ? "" : "disabled"}>›</button>
    <button class="btn ca-go${v.over ? " primary" : ""}" type="button" data-act="new" ${page.host ? "" : "disabled"}>${v.over ? "Play again" : "New game"}</button>`;
}
function setPower(a) {
  const box = $("power"), pct = a ? Math.round(a.power * 100) : 0;
  box.className = `ca-power${!a ? "" : a.valid === false ? " off" : pct > 75 ? " high" : pct > 40 ? " mid" : ""}`;
  box.firstElementChild.style.width = `${pct}%`;
  box.setAttribute("aria-valuenow", String(pct));
}

// ---------- moves ----------
async function fire(shot) {
  const v = V;
  if (!canShoot(v)) return;
  const who2 = v.toMove;
  let why = "";
  if (hotseat() && who2 === 1) {
    const t = page.runner.table;
    const ok = await t.act(cur => {
      if (!cur.game) return false;
      const r = applyMove(rules, cur.game, 1, shot, t.now());
      if (r.error) { why = r.error; return false; }
      cur.game = r.G;
    });
    if (!ok && !why) why = "Couldn't make that shot: try again";
  } else if (v.seat === who2) why = await page.move(shot);
  else return;
  if (why) toast(why);
}
function slide(x, end) {
  if (!canShoot()) return;
  const to = nearestFree(Math.round(x));
  if (to !== aimX) { aimX = to; scene?.setModel({ x: aimX }); }
  if (end) keepAim();
}
function nudge(dir) {
  if (!canShoot()) return;
  for (const d of [12, 30, 70, 150]) {                // the next free place that way, over a man if need be
    const to = nearestFree(aimX + dir * d);
    if ((to - aimX) * dir > 0) { aimX = to; scene?.setModel({ x: aimX }); keepAim(); return; }
  }
}

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  if (b.dataset.act === "new") await newGame(false);
  else if (b.dataset.act === "left") nudge(-1);
  else if (b.dataset.act === "right") nudge(1);
});

/** A new game: asks first if one is in play (the tally is kept); `fresh` is the first game on this page. */
async function newGame(fresh) {
  const v = V;
  if (!fresh && v?.G && !v.over && v.state.shots > 2 && !IN_FRAME && !(await sure("Leave this game and start a new one?", { yes: "New game" }))) return;
  freeKey = "";
  const first = opts.first === "white" ? 0 : opts.first === "black" ? 1 : null;
  page.deal(first == null ? {} : { first }, 2);
}

// ---------- the end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (s.winner === v.seat && !hotseat()) r.won++;
  write(RECORD, r);
  if (!hotseat()) noteStreak("carrom", s.winner === v.seat);
}

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Carrom for two. Nine white men, nine black and a red queen are set out in the middle of a board with a pocket in each corner. White shoots from the bottom baseline, black from the top. Pocket all nine of your colour, and the queen, before the other player does.</p>
    <h3>A shot</h3>
    <p>Slide the striker along your baseline (drag along the baseline, or the arrows below the board), then pull back from the striker and let go: the farther you pull, the harder it goes. The striker is flicked forwards only. It cannot stand on a man.</p>
    <h3>Pocketing</h3>
    <p>A man of yours down means you shoot again. A man of theirs down counts for them, and your turn ends. The striker down is a foul: your turn ends and the man you pocketed last comes back to the middle.</p>
    <h3>The queen</h3>
    <p>The queen must be covered: pocket her and, with the same shot or the very next, one of your own men. If you do not, she goes back to the middle. Pocketing your last man while the queen is still out puts that man back.</p>
    <h3>Winning</h3>
    <p>The first colour with all nine men down, whoever put them there, wins the board. Points are the other player's men left on the board, and three more for a queen you covered.</p>
    <h3>Here</h3>
    <p>The computer plays by trying many shots in the same physics you play in and taking the best; the levels differ in how many it tries and how steady its hand is. The guide shows where the striker first touches and which way the man will go (Menu, Aim guide). Two on one phone turn the board to whoever is to shoot.</p>`;
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", () => newGame(false), "primary"));
  page.menu(play);
  play.append(action("The rules on one page", showRules, "link"));
  if (!page.atTable && page.host) {
    const content = part(body, "content");
    content.append(choice("Opponent", [["computer", "Computer"], ["friend", "Two on this phone"]], opts.opponent, v => { opts.opponent = v; saveOpts(); page.runner.kick(); draw(); }));
    if (opts.opponent === "computer") content.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  }
  const set = part(body, "settings");
  set.append(choice("Aim guide", [["line", "Line"], ["off", "Off"]], opts.guide, v => { opts.guide = v; saveOpts(); draw(); }));
  set.append(choice("Who breaks", FIRSTS, opts.first, v => { opts.first = v; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("carrom:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "carrom");
document.querySelector(".ca-mark").innerHTML = APPS.find(a => a.id === "carrom")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());

try {
  scene = createScene($("stage"), {
    slide, shoot: fire, aim: setPower, refuse: toast,
    lost: () => { $("stage").innerHTML = '<p class="ca-none">The graphics were lost. Reload the page.</p>'; scene = null; },
  });
} catch (e) {
  console.error(e);
  $("stage").innerHTML = '<p class="ca-none">Carrom is drawn in 3D, and this device cannot draw it.</p>';
}
onPause(() => scene?.pause(), () => scene?.resume());
const reskin = () => scene?.redraw();
new MutationObserver(reskin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", reskin);
window.__carrom = { page, get view() { return V; }, opts, get scene() { return scene; }, fire, get animating() { return animating; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame(true);
if (V) follow(V);       // a view that came before the board was ready
draw();
