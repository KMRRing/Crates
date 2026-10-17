// Craps (花旗骰), as Macau deals it: the screen over the table (the last totals, and what the last hundred came to), the two
// dice in their tray, the layout (a chip on any bet: the lines with the odds behind them, come and don't come, the field,
// the Big bets, the hard ways, the one-roll bets), Roll: the dice tumble and land, the stickman calls them, and the bets
// they decide are paid while the rest stay up for the next roll. Learn, in the header, is the course on what each bet
// pays and keeps. The rules are craps-engine.js's, the layout drawn by craps-layout.js; this file keeps the game and
// plays each roll out on the page.
import { START, CHIPS, POINTS, LIMITS, valid, kindOf, flatOf, stepOf, maxOf, whyNot, takeable, takeDown, nameOf, paysText, betsProblem, newGame, roll, stats, totalOf } from "./craps-engine.js";
import { layoutHtml, lastHtml, statsHtml, statsLabel, placeableNow } from "./craps-layout.js";
import { dieSvg, tumble } from "./casino-dice.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle } from "./menu.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./craps-course.js";
import { crapsStage } from "./craps-stage.js";
import { rulesHtml } from "./craps-rules.js";
import { IN_FRAME } from "./suite.js";
import { hk, chipsHtml, toast } from "./casino.js";

const $ = id => document.getElementById(id);
const RUN = "craps:run", OPTS = "craps:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

let S = null;                       // the game (craps-engine.js's), as saved
const opts = { chip: 100, fast: false, ...read(OPTS, {}) };
let rolling = false;
let placed = [];                    // the chips put down since the last roll, in order, for Undo: [key, amount] (kept in the run, S.placed)
let shown = null;                   // the last roll, while its result stays on the layout: { dice, call, lit, results, net }

const valid_ = g => g && g.v === 1 && Array.isArray(g.history) && typeof g.balance === "number" && (g.point == null || POINTS.includes(g.point));
const sane = h => Array.isArray(h) && h.every(d => Array.isArray(d) && d.length === 2 && d.every(x => Number.isInteger(x) && x >= 1 && x <= 6));
const onTable = () => Object.values(S.bets).reduce((a, v) => a + v, 0);
function save() { S.placed = placed; write(RUN, S); }
function saveOpts() { write(OPTS, opts); }
/** A saved table's bets as the rules would have them: bets that can't stand in this phase or without their flat bet dropped. */
function soundBets(bets, point) {
  const out = {};
  for (const [key, v] of Object.entries(bets || {})) {
    if (!valid(key) || !(v > 0)) continue;
    const kind = kindOf(key), flat = flatOf(key);
    if ((kind === "come" || kind === "dcome") && point == null) continue;
    if ((key === "passo" || key === "donto") && point == null) continue;
    if (flat && !(bets[flat] > 0)) continue;
    if (v % stepOf(key, point)) continue;
    out[key] = v;
  }
  return out;
}

// ---------- drawing ----------
function drawStrip() {
  $("balance").textContent = S.balance.toLocaleString("en-GB");
  $("point").textContent = S.point ? `Point ${S.point}` : "Come-out roll";
  $("point").title = S.point ? `The point is ${S.point}: a ${S.point} before a seven wins the pass line` : `Before the point: a 7 or 11 wins the pass line, a 2, 3 or 12 loses it`;
  $("rounds").textContent = S.rolls ? `Roll ${S.rolls + 1}` : "First roll";
}
function drawBoard() {
  const st = stats(S.history, 100);
  $("last").innerHTML = lastHtml(st);
  $("stats").innerHTML = statsHtml(st);
  $("stats").setAttribute("aria-label", statsLabel(st));
}
const BLANK = `<svg class="cdi empty" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4.6"/></svg>`;
/** What the stickman calls: the total, the call (Natural, Seven out, Point 6…), and what the roll paid you, once it has. */
function callHtml(d, call, net = null) {
  const paid = net == null ? "" : `<small class="${net > 0 ? "win" : net < 0 ? "lose" : ""}">${net > 0 ? `+${hk(net)}` : net < 0 ? `−${hk(net)}` : "even"}</small>`;
  return `<span class="say ${call?.side || ""}"><b>${totalOf(d)}</b>${call?.words || ""}</span>${paid}`;
}
/** The tray: the last roll's dice and call (or empty dice before the first), still. */
function drawTray() {
  if (rolling) return;
  const d = shown?.dice || S.history.at(-1);
  $("dice").classList.remove("rolling");
  $("dice").innerHTML = d ? d.map(f => dieSvg(f)).join("") : BLANK.repeat(2);
  $("call").innerHTML = d ? callHtml(d, shown ? shown.call : S.call, shown ? shown.net : null) : `<small>Place your bets</small>`;
}
/** The layout, as big as its box allows. */
function drawLayout() {
  const box = $("layout"), top = box.scrollTop;
  box.innerHTML = layoutHtml({ bets: S.bets, lit: shown?.lit, results: shown?.results, point: S.point, placeable: placeableNow(S.bets, S.point) });
  box.scrollTop = top;
}
/** The bets from before the last roll that may go down again now, in order, as far as the bankroll goes. */
function rebetList() {
  const out = [], bets = { ...S.bets };
  let room = S.balance - onTable();
  for (const [key, v] of Object.entries(S.lastBets || {})) {
    if (bets[key] || whyNot(key, bets, S.point) || v > maxOf(key, bets, S.point) || v > room) continue;
    bets[key] = v; room -= v; out.push([key, v]);
  }
  return out;
}
function drawRail() {
  $("chips").innerHTML = chipsHtml(CHIPS, opts.chip);
  const down = Object.keys(S.bets).some(takeable);
  $("clearBtn").textContent = !placed.length && down ? "Take down" : "Clear";
  $("clearBtn").title = !placed.length && down ? "Take down the odds, the hard ways and the Big bets" : "Take back the chips you've put down since the last roll";
  $("clearBtn").disabled = rolling || !(placed.length || down);
  $("undoBtn").textContent = placed.length ? "Undo" : "Rebet";
  $("undoBtn").disabled = rolling || (!placed.length && !rebetList().length);
  $("rollBtn").disabled = rolling || !Object.keys(S.bets).length;
}
function render() { drawStrip(); drawBoard(); drawTray(); drawRail(); drawLayout(); }

// ---------- betting ----------
function clearShown() { if (shown) { shown = null; drawTray(); drawLayout(); } }
function place(key) {
  if (rolling || !key || !valid(key)) return;
  const why = whyNot(key, S.bets, S.point);
  if (why) { toast(why); return; }
  clearShown();
  const step = stepOf(key, S.point), now = S.bets[key] || 0, most = maxOf(key, S.bets, S.point);
  // a chip goes in as many steps as it holds (the Horn in 100s, Big 6 in 300s), at least one
  let add = Math.max(step, Math.floor(opts.chip / step) * step);
  add = Math.min(add, Math.floor((most - now) / step) * step);
  if (add <= 0) { toast(`${nameOf(key)} takes up to ${hk(most)}`); return; }
  if (onTable() + add > S.balance) { toast("That's more than you hold"); return; }
  S.bets = { ...S.bets, [key]: now + add };
  placed.push([key, add]);
  save();
  drawLayout();
  drawRail();
  toast(`${nameOf(key)} · pays ${paysText(key)}`);
}
function take(key, amount) {
  const left = (S.bets[key] || 0) - amount, { [key]: _, ...rest } = S.bets;
  S.bets = left > 0 ? { ...rest, [key]: left } : rest;
}
function undo() {
  if (rolling) return;
  if (!placed.length) { rebet(); return; }
  const [key, amount] = placed.pop();
  take(key, amount);
  save();
  drawLayout();
  drawRail();
}
function rebet() {
  const list = rebetList();
  if (!list.length) { toast("Nothing from the last roll goes down now"); return; }
  clearShown();
  for (const [key, v] of list) { S.bets = { ...S.bets, [key]: v }; placed.push([key, v]); }
  save();
  drawLayout();
  drawRail();
}
/** Clear takes back this roll's chips, last first; with none put down, it takes down what may come down. */
function clearBets() {
  if (rolling) return;
  if (placed.length) { while (placed.length) take(...placed.pop()); }
  else if (Object.keys(S.bets).some(takeable)) { S.bets = takeDown(S.bets); toast("The odds, hard ways and Big bets are down"); }
  save();
  drawLayout();
  drawRail();
}

// ---------- a roll ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
async function rollNow() {
  if (rolling) return;
  const problem = betsProblem(S.bets, S.balance, S.point);
  if (problem) { toast(problem); return; }
  const r = roll(S), before = S.point;
  S = r.state;
  placed = [];
  save();
  rolling = true;
  shown = null;
  drawRail();
  $("call").innerHTML = `<span class="say">${before ? "Dice are away" : "Come-out roll"}</span>`;
  await tumble($("dice"), r.dice, opts.fast ? 700 : 1500);
  await wait(opts.fast ? 200 : 450);
  rolling = false;
  const decided = r.settled.lines.filter(l => l.how !== "moved"), t = totalOf(r.dice);
  shown = {
    dice: r.dice, call: S.call, net: decided.length ? decided.reduce((a, l) => a + l.net, 0) : null,
    lit: new Set([...decided.filter(l => l.net > 0).map(l => l.key), ...(POINTS.includes(t) ? [`n${t}`] : [])]),
    results: Object.fromEntries(decided.map(l => [l.key, l.net])),
  };
  render();
  const moved = r.settled.lines.filter(l => l.how === "moved");
  if (moved.length) toast(`${moved.map(l => nameOf(l.key)).join(" and ")} to the ${t}`);
  else if (S.balance < LIMITS.min && !Object.keys(S.bets).length) toast("Below the table's minimum: Menu tops you up");
}

// ---------- the menu, the course, the rules ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml();
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
const course = createCourse({ id: "craps", course: COURSE, stage: crapsStage(), cls: "cr", inFrame: IN_FRAME, onRules: showRules, onPlay: () => {} });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New table", () => { if (rolling) return; S = { ...S, history: [], bets: {}, lastBets: {}, point: null, call: null }; placed = []; shown = null; save(); render(); toast("A new table: the screen starts again, the puck is off"); }, "primary"));
  if (S.balance < START) play.append(action(`Top up to ${hk(START)}`, () => { S.balance = START; S.toppedUp++; save(); render(); }));
  const cp = progressOf("craps", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn the table: the bets, the odds, the traps", () => course.open()), action("Craps on one page", showRules, "link"));
  part(body, "settings").append(toggle("Quick rolls", opts.fast, on => { opts.fast = on; saveOpts(); }));
  part(body, "about").append(line(`${S.rolls} roll${S.rolls === 1 ? "" : "s"}; you hold ${hk(S.balance)}${S.toppedUp ? `, topped up ${S.toppedUp} time${S.toppedUp === 1 ? "" : "s"}` : ""}. Play money: nothing real is staked.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "craps");
document.querySelector(".cr-mark").innerHTML = APPS.find(a => a.id === "craps")?.logo || "";
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
window.__craps = { get state() { return S; }, set state(g) { S = g; render(); }, place, rollNow, course };

S = read(RUN, null);
if (!valid_(S) || !sane(S.history)) S = newGame(Math.floor(Math.random() * 2 ** 31));
S.point = S.point ?? null;
S.lastBets = S.lastBets || {};
S.bets = soundBets(S.bets, S.point);
placed = (Array.isArray(S.placed) ? S.placed : []).filter(([k, a]) => S.bets[k] >= a);
save();
render();
