// Sic Bo (骰寶), as Macau deals it: the screen over the table (the last totals, newest first, and what the last hundred
// came to), the dice in their tray, the layout (a chip on any of the 50 bets, each with its dice and what it pays), Roll:
// the dice tumble, land one by one, and the cells they win light up as the bets are paid. Learn, in the header, is the
// course on what the floor shows and says, and what each bet keeps for the house. The rules are sicbo-engine.js's, the
// layout drawn by sicbo-layout.js; this file keeps the game and plays each round out on the page.
import { START, CHIPS, LIMITS, UNIT, LAYOUT, nameOf, paysText, maxOf, valid, multiple, betsProblem, newGame, roll, stats, totalOf, sizeOf } from "./sicbo-engine.js";
import { layoutHtml, lastHtml, statsHtml, statsLabel } from "./sicbo-layout.js";
import { dieSvg } from "./casino-dice.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle } from "./menu.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./sicbo-course.js";
import { sicboStage } from "./sicbo-stage.js";
import { rulesHtml } from "./sicbo-rules.js";
import { IN_FRAME } from "./suite.js";
import { hk, short, chipsHtml, toast } from "./casino.js";

const $ = id => document.getElementById(id);
const RUN = "sicbo:run", OPTS = "sicbo:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

let S = null;                       // the game (sicbo-engine.js's), as saved
const opts = { chip: 100, fast: false, ...read(OPTS, {}) };
let rolling = false;
let placed = [];                    // the chips put down since the last round, in order, for Undo: [key, amount]
let shown = null;                   // the last round, while its result stays on the layout: { dice, lit, results, net }

const valid_ = g => g && g.v === 1 && Array.isArray(g.history) && typeof g.balance === "number";
const sane = h => Array.isArray(h) && h.every(d => Array.isArray(d) && d.length === 3 && d.every(x => Number.isInteger(x) && x >= 1 && x <= 6));
const onTable = () => Object.values(S.bets).reduce((a, v) => a + v, 0);
function save() { write(RUN, S); }
function saveOpts() { write(OPTS, opts); }

// ---------- drawing ----------
function drawStrip() {
  $("balance").textContent = S.balance.toLocaleString("en-GB");
  $("limits").textContent = `Min ${short(LIMITS.min)} a bet`;
  $("limits").title = `At least ${hk(LIMITS.min)} on each bet, in ${hk(UNIT)}s; up to ${hk(LIMITS.even)} on Big or Small, ${hk(LIMITS.single)} on a single number, ${hk(LIMITS.pair)} on two numbers, ${hk(LIMITS.double)} on a double or a total, ${hk(LIMITS.any)} on any triple and ${hk(LIMITS.triple)} on a triple`;
  $("rounds").textContent = S.rounds ? `Round ${S.rounds + 1}` : "First round";
}
/** The screen: the last totals, newest first, and what the last hundred came to. */
function drawBoard() {
  const st = stats(S.history, 100);
  $("last").innerHTML = lastHtml(st);
  $("stats").innerHTML = statsHtml(st);
  $("stats").setAttribute("aria-label", statsLabel(st));
}
const BLANK = `<svg class="cdi empty" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4.6"/></svg>`;
/** What the dice make, as the croupier calls it: the total, and Big, Small or the triple; with what the round paid, once it has. */
function callHtml(d, net = null) {
  const size = sizeOf(d), words = size === "triple" ? `Triple ${d[0]}` : size === "big" ? "Big" : "Small";
  const paid = net == null ? "" : `<small class="${net > 0 ? "win" : net < 0 ? "lose" : ""}">${net > 0 ? `+${hk(net)}` : net < 0 ? `−${hk(net)}` : "even"}</small>`;
  return `<span class="say ${size}"><b>${totalOf(d)}</b>${words}</span>${paid}`;
}
/** The tray: the last round's dice and call (or empty dice before the first), still. */
function drawTray() {
  if (rolling) return;
  const d = shown?.dice || S.history.at(-1);
  $("dice").classList.remove("rolling");
  $("dice").innerHTML = d ? d.map(f => dieSvg(f)).join("") : BLANK.repeat(3);
  $("call").innerHTML = d ? callHtml(d, shown ? shown.net : null) : `<small>Place your bets</small>`;
}
/** The layout, as big as its box allows. */
function drawLayout() {
  const box = $("layout"), top = box.scrollTop;
  const settled = shown && !Object.keys(S.bets).length;
  box.innerHTML = layoutHtml(settled ? { lit: shown.lit, results: shown.results } : { bets: S.bets });
  box.scrollTop = top;
}
function drawRail() {
  $("chips").innerHTML = chipsHtml(CHIPS, opts.chip);
  const any = Object.values(S.bets).some(v => v > 0), last = Object.values(S.lastBets || {}).some(v => v > 0);
  $("clearBtn").disabled = rolling || !any;
  $("undoBtn").textContent = any ? "Undo" : "Rebet";
  $("undoBtn").disabled = rolling || (!any && !last);
  $("rollBtn").disabled = rolling || !any;
}
function render() { drawStrip(); drawBoard(); drawTray(); drawRail(); drawLayout(); }

// ---------- betting ----------
function clearShown() { if (shown) { shown = null; drawTray(); } }
function place(key) {
  if (rolling || !key || !valid(key)) return;
  clearShown();
  const now = S.bets[key] || 0;
  if (onTable() + opts.chip > S.balance) { toast("That's more than you hold"); return; }
  const add = Math.min(opts.chip, maxOf(key) - now);
  if (add <= 0) { toast(`${nameOf(key)} takes up to ${hk(maxOf(key))}`); return; }
  S.bets = { ...S.bets, [key]: now + add };
  placed.push([key, add]);
  save();
  drawLayout();
  drawRail();
  toast(`${nameOf(key)} · pays ${paysText(key)}`);
}
function undo() {
  if (rolling) return;
  if (!Object.keys(S.bets).length) { rebet(); return; }
  const [key, amount] = placed.pop() || Object.entries(S.bets).at(-1);
  const left = (S.bets[key] || 0) - amount;
  const { [key]: _, ...rest } = S.bets;
  S.bets = left > 0 ? { ...rest, [key]: left } : rest;
  save();
  drawLayout();
  drawRail();
}
function rebet() {
  const sum = Object.values(S.lastBets).reduce((a, v) => a + v, 0);
  if (sum > S.balance) { toast("Not enough left for the same bets"); return; }
  clearShown();
  S.bets = { ...S.lastBets };
  placed = Object.entries(S.bets);
  save();
  drawLayout();
  drawRail();
}
function clearBets() { if (rolling) return; S.bets = {}; placed = []; save(); drawLayout(); drawRail(); }

// ---------- a round ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const element = html => { const t = document.createElement("template"); t.innerHTML = html; return t.content.firstElementChild; };
/** The dice tumbling in the tray for `ms`, landing one after another on their faces. */
async function tumble(dice, ms) {
  const box = $("dice"), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  box.classList.toggle("rolling", !still);
  box.innerHTML = dice.map(() => dieSvg(1 + Math.floor(Math.random() * 6))).join("");
  const at = [0.55, 0.78, 1].map(f => f * ms), t0 = performance.now(), landed = [false, false, false];
  await new Promise(done => {
    const tick = () => {
      const t = performance.now() - t0;
      [...box.children].forEach((el, i) => {
        if (landed[i]) return;
        if (t >= at[i]) { landed[i] = true; el.replaceWith(element(dieSvg(dice[i], "land"))); }
        else if (!still) el.replaceWith(element(dieSvg(1 + Math.floor(Math.random() * 6))));
      });
      if (landed.every(Boolean)) { done(); return; }
      setTimeout(tick, 90);
    };
    tick();
  });
  box.classList.remove("rolling");
}
async function rollNow() {
  if (rolling) return;
  const problem = betsProblem(S.bets, S.balance);
  if (problem) { toast(problem); return; }
  const r = roll(S);
  S = r.state;
  save();
  rolling = true;
  placed = [];
  shown = null;
  drawRail();
  $("call").innerHTML = `<span class="say">No more bets</span>`;
  await tumble(r.dice, opts.fast ? 700 : 1500);
  await wait(opts.fast ? 200 : 450);
  rolling = false;
  const net = r.settled.net;
  shown = { dice: r.dice, net, lit: new Set(LAYOUT.filter(k => multiple(k, r.dice) > 0)), results: Object.fromEntries(r.settled.lines.map(l => [l.key, l.net])) };
  render();
  if (S.balance < LIMITS.min) toast("Below the table's minimum: Menu tops you up");
}

// ---------- the menu, the course, the rules ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml();
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
const course = createCourse({ id: "sicbo", course: COURSE, stage: sicboStage(), cls: "sb", inFrame: IN_FRAME, onRules: showRules, onPlay: () => {} });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New table", () => { if (rolling) return; S = { ...S, history: [], bets: {}, lastBets: {} }; placed = []; shown = null; save(); render(); toast("A new table: the screen starts again"); }, "primary"));
  if (S.balance < START) play.append(action(`Top up to ${hk(START)}`, () => { S.balance = START; S.toppedUp++; save(); render(); }));
  const cp = progressOf("sicbo", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn the floor: the bets, the dice, what each keeps", () => course.open()), action("Sic Bo on one page", showRules, "link"));
  part(body, "settings").append(toggle("Quick rolls", opts.fast, on => { opts.fast = on; saveOpts(); }));
  part(body, "about").append(line(`${S.rounds} round${S.rounds === 1 ? "" : "s"}; you hold ${hk(S.balance)}${S.toppedUp ? `, topped up ${S.toppedUp} time${S.toppedUp === 1 ? "" : "s"}` : ""}. Play money: nothing real is staked.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "sicbo");
document.querySelector(".sb-mark").innerHTML = APPS.find(a => a.id === "sicbo")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("layout").addEventListener("click", e => { const c = e.target.closest("[data-bet]"); if (c) place(c.dataset.bet); });
$("chips").addEventListener("click", e => { const b = e.target.closest("[data-chip]"); if (!b) return; opts.chip = Number(b.dataset.chip); saveOpts(); drawRail(); });
$("clearBtn").addEventListener("click", clearBets);
$("undoBtn").addEventListener("click", undo);
$("rollBtn").addEventListener("click", rollNow);

// for tests and debugging
window.__sicbo = { get state() { return S; }, place, rollNow, course };

S = read(RUN, null);
if (!valid_(S) || !sane(S.history)) S = newGame(Math.floor(Math.random() * 2 ** 31));
S.lastBets = S.lastBets || {};
S.bets = Object.fromEntries(Object.entries(S.bets || {}).filter(([k, v]) => valid(k) && v > 0 && v % UNIT === 0));
placed = Object.entries(S.bets);
save();
render();
