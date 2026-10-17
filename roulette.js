// Roulette: a Macau table, as at the Venetian. The screen over the table (the last numbers, newest first, and what the
// last hundred came to), the layout (chips on numbers, splits, streets, corners, six lines and the outside bets; what a
// tap on the numbers bets is the mode under the layout), Spin: the wheel turns, the ball drops, the dolly stands on the
// number and the winning bets light up as they're paid. Learn, in the header, is the course on what the floor shows and
// says. The rules are roulette-engine.js's, the layout drawn by roulette-layout.js and the wheel by roulette-wheel.js;
// this file keeps the game and plays each spin out on the page.
import { START, CHIPS, LIMITS, UNIT, KINDS, colourOf, label, numbersOf, nameOf, kindOf, maxOf, validBet, newGame, spin, betsProblem, stats } from "./roulette-engine.js";
import { layoutFor, layoutSvg, betAt } from "./roulette-layout.js";
import { wheelSvg, spinTo } from "./roulette-wheel.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, toggle } from "./menu.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./roulette-course.js";
import { rouletteStage } from "./roulette-stage.js";
import { rulesHtml } from "./roulette-rules.js";
import { IN_FRAME } from "./suite.js";
import { hk, short, chipsHtml, toast } from "./casino.js";

const $ = id => document.getElementById(id);
const RUN = "roulette:run", OPTS = "roulette:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const SIDEWAYS = "(orientation: landscape) and (min-width: 700px)";
const MODES = [["number", "Number"], ["split", "Split"], ["street", "Street"], ["corner", "Corner"], ["line", "Line"]];

let S = null;                       // the game (roulette-engine.js's), as saved
const opts = { chip: 100, mode: "number", fast: false, ...read(OPTS, {}) };
let spinning = false;
let placed = [];                    // the chips put down since the last spin, in order, for Undo: [key, amount]
let shown = null;                   // the last spin, while its result stays on the layout: { pocket, lit, settled }
let rotor = 0;                      // where the wheel stopped, so the next spin starts from there

const valid = g => g && g.v === 1 && Array.isArray(g.history) && typeof g.balance === "number";
function save() { write(RUN, S); }
function saveOpts() { write(OPTS, opts); }

// ---------- drawing ----------
function drawStrip() {
  $("balance").textContent = S.balance.toLocaleString("en-GB");
  $("limits").textContent = `Min ${short(LIMITS.inside)} · outside ${short(LIMITS.outside)}`;
  $("limits").title = `At least ${hk(LIMITS.inside)} on the numbers a spin and ${hk(LIMITS.outside)} on each outside bet; up to ${hk(LIMITS.number)} on a number (a bet on several numbers takes as many times that), ${hk(LIMITS.dozen)} on a dozen or column, ${hk(LIMITS.even)} on an even-money bet`;
  $("spins").textContent = S.spins ? `Spin ${S.spins + 1}` : "First spin";
}
const dot = p => `<span class="rl-ball ${colourOf(p)}">${label(p)}</span>`;
/** The screen: the last numbers, newest first, and what the last hundred came to. */
function drawBoard() {
  const st = stats(S.history, 100);
  $("last").innerHTML = st.last.length ? st.last.map(dot).join("") : `<span class="rl-none">No numbers yet</span>`;
  const pct = n => (st.spins ? `${Math.round((100 * n) / st.spins)}%` : "–");
  $("stats").innerHTML = st.spins
    ? `<span><i class="red">Red</i> ${pct(st.red)}</span><span><i>Black</i> ${pct(st.black)}</span><span><i class="green">0</i> ${pct(st.green)}</span><span>Odd ${pct(st.odd)}</span><span>Even ${pct(st.even)}</span><span>Hot ${st.hot.slice(0, 3).map(label).join(" ")}</span><span>Cold ${st.cold.slice(0, 3).map(label).join(" ")}</span>`
    : `<span>The last hundred spins are counted here</span>`;
  $("stats").setAttribute("aria-label", st.spins ? `Of the last ${st.spins}: red ${st.red}, black ${st.black}, zero ${st.green}; hottest ${st.hot.map(label).join(", ")}; coldest ${st.cold.map(label).join(", ")}` : "No spins yet");
}
let plan = null;
/** The layout, as big as its box allows, upright or (held sideways) lying as the table's. */
function drawLayout() {
  const box = $("layout"), sideways = matchMedia(SIDEWAYS).matches;
  if (!box.clientWidth || !box.clientHeight) return;
  plan = layoutFor(box.clientWidth, box.clientHeight, sideways);
  const bets = shown && !Object.keys(S.bets).length ? Object.fromEntries(shown.settled.lines.filter(l => l.net > 0).map(l => [l.key, l.stake])) : S.bets;
  box.innerHTML = layoutSvg(plan, { bets, lit: shown?.lit || new Set(), dolly: shown && !Object.keys(S.bets).length ? shown.pocket : null });
}
function drawModes() {
  $("modes").innerHTML = MODES.map(([id, name]) => `<button type="button" role="radio" class="rl-mode" data-mode="${id}" aria-checked="${opts.mode === id}">${name}</button>`).join("");
}
function drawRail() {
  $("chips").innerHTML = chipsHtml(CHIPS, opts.chip);
  const any = Object.values(S.bets).some(v => v > 0), last = Object.values(S.lastBets || {}).some(v => v > 0);
  $("clearBtn").disabled = spinning || !any;
  $("undoBtn").textContent = any ? "Undo" : "Rebet";
  $("undoBtn").disabled = spinning || (!any && !last);
  $("spinBtn").disabled = spinning || !any;
}
// the layout last: it fills whatever room the rest leaves (and redraws when that changes: see the observer below)
function render() { drawStrip(); drawBoard(); drawModes(); drawRail(); drawLayout(); }

// ---------- betting ----------
function clearShown() { if (shown) { shown = null; $("call").innerHTML = ""; } }
function place(key) {
  if (spinning || !key || !validBet(key)) return;
  clearShown();
  const now = S.bets[key] || 0, onTable = Object.values(S.bets).reduce((a, v) => a + v, 0);
  if (onTable + opts.chip > S.balance) { toast("That's more than you hold"); return; }
  const add = Math.min(opts.chip, maxOf(key) - now);
  if (add <= 0) { toast(`${nameOf(key)} takes up to ${hk(maxOf(key))}`); return; }
  S.bets = { ...S.bets, [key]: now + add };
  placed.push([key, add]);
  save();
  drawLayout();
  drawRail();
  toastBet(key);
}
/** What a chip just bet, said once: the bet's name and what it pays. */
function toastBet(key) {
  const nums = numbersOf(key);
  toast(`${nameOf(key)}${nums.length > 1 && nums.length < 7 ? ` (${nums.map(label).join(", ")})` : ""} · pays ${KINDS[kindOf(key)].pays} to 1`);
}
function undo() {
  if (spinning) return;
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
function clearBets() { if (spinning) return; S.bets = {}; placed = []; save(); drawLayout(); drawRail(); }

// ---------- a spin ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
async function spinNow() {
  if (spinning) return;
  const problem = betsProblem(S.bets, S.balance);
  if (problem) { toast(problem); return; }
  const r = spin(S);
  S = r.state;
  save();
  spinning = true;
  placed = [];
  drawRail();
  // the wheel: over the layout on a phone; held sideways, the one beside the layout, when the side column has room for
  // it (a phone held sideways hasn't: there it spins over the layout, and the little one beside it turns in step)
  const sideways = matchMedia(SIDEWAYS).matches, docked = sideways && $("dock").clientHeight >= $("felt").clientHeight / 2;
  const boxes = docked ? [$("dock")] : sideways ? [$("wheel"), $("dock")] : [$("wheel")];
  $("wheel").hidden = docked;
  $("call").innerHTML = `<span class="rl-say">No more bets</span>`;
  [rotor] = await Promise.all(boxes.map(box => spinTo(box, r.pocket, { ms: opts.fast ? 1600 : 4200, from: rotor })));
  await wait(opts.fast ? 300 : 700);
  $("wheel").hidden = true;
  spinning = false;
  // the dolly on the number, the winners lit, the call
  const p = r.pocket, net = r.settled.net, lit = new Set(r.settled.lines.filter(l => l.net > 0).map(l => l.key));
  shown = { pocket: p, lit, settled: r.settled };
  const words = p === 0 ? "zero" : `${colourOf(p)} · ${p % 2 ? "odd" : "even"} · ${p <= 18 ? "low" : "high"}`;
  $("call").innerHTML = `${dot(p)}<span class="rl-say">${words}</span><small>${net > 0 ? `+${hk(net)}` : net < 0 ? `−${hk(net)}` : "even"}</small>`;
  render();
  if (S.balance < LIMITS.inside) toast("Below the table's minimum: Menu tops you up");
}

// ---------- the menu, the course, the rules ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml();
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
const course = createCourse({ id: "roulette", course: COURSE, stage: rouletteStage(), cls: "rl", inFrame: IN_FRAME, onRules: showRules, onPlay: () => {} });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New table", () => { if (spinning) return; S = { ...S, history: [], bets: {}, lastBets: {} }; placed = []; clearShown(); save(); render(); toast("A new table: the screen starts again"); }, "primary"));
  if (S.balance < START) play.append(action(`Top up to ${hk(START)}`, () => { S.balance = START; S.toppedUp++; save(); render(); }));
  const cp = progressOf("roulette", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn the floor: the bets, the wheel, the screen", () => course.open()), action("Roulette on one page", showRules, "link"));
  part(body, "settings").append(toggle("Quick spins", opts.fast, on => { opts.fast = on; saveOpts(); }));
  part(body, "about").append(line(`${S.spins} spin${S.spins === 1 ? "" : "s"}; you hold ${hk(S.balance)}${S.toppedUp ? `, topped up ${S.toppedUp} time${S.toppedUp === 1 ? "" : "s"}` : ""}. Play money: nothing real is staked.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "roulette");
document.querySelector(".rl-mark").innerHTML = APPS.find(a => a.id === "roulette")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("layout").addEventListener("click", e => {
  const svg = $("layout").querySelector("svg");
  if (!svg || !plan) return;
  const box = svg.getBoundingClientRect();
  place(betAt(plan, e.clientX - box.left, e.clientY - box.top, opts.mode));
});
$("modes").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (!b) return; opts.mode = b.dataset.mode; saveOpts(); drawModes(); });
$("chips").addEventListener("click", e => { const b = e.target.closest("[data-chip]"); if (!b) return; opts.chip = Number(b.dataset.chip); saveOpts(); drawRail(); });
$("clearBtn").addEventListener("click", clearBets);
$("undoBtn").addEventListener("click", undo);
$("spinBtn").addEventListener("click", spinNow);
new ResizeObserver(() => drawLayout()).observe($("layout"));

// for tests and debugging
window.__roulette = { get state() { return S; }, place, spinNow, course };

S = read(RUN, null);
if (!valid(S)) S = newGame(Math.floor(Math.random() * 2 ** 31));
if (S.bets && Object.values(S.bets).some(v => v % UNIT)) S.bets = {};
placed = Object.entries(S.bets);
save();
$("wheel").innerHTML = $("dock").innerHTML = wheelSvg();
render();
