// Arb: get from one thing to another through the knowledge base's links, as cheaply as you can. Every step costs
// more the better-connected the thing you step onto: an obscure link costs 1, the United States about 9 (1 + log2 of
// its links), so the cheap route runs through what you specifically know, not through the hubs. Par is the cheapest
// route there is; matching it scores 100. Five routes a run, random or today's; every hop shows why the two are
// linked, and the end shows the cheapest route. A random run's routes run between things of your mix of the knowledge
// base's topics (each out, in or more, as Crates deals its clues); today's is the same for everyone, whatever the mix.
// Together, the same five routes for everyone at the table (duel.js), from the dealer's mix.
import { PER_RUN, NEAR, cost, name, kind, TOPIC_LIST, TOPIC_GROUPS, TOPIC_PRESETS, dealRun } from "./arb-engine.js";
import { cleanMix, presetOf, mixParam, mixFromParam } from "./topics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, topicMix, action, line } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "arb:run", BEST = "arb:best", DAILY = "arb:daily", TOPICS_KEY = "arb:topics";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

// ---------- your mix of topics ----------
const mix = () => cleanMix(TOPIC_LIST, read(TOPICS_KEY, null));
const keepMix = w => write(TOPICS_KEY, w);
const presetNow = () => presetOf(TOPIC_LIST, TOPIC_PRESETS, mix());

// ---------- a run ----------
let S = read(RUN, null);
const save = () => { if (S?.duel) { duel.keep(S); tell(); } else write(RUN, S); };   // a match's run is kept apart from yours
function newRun(daily) {
  // your own mix doesn't count for your best: today's run and the presets do
  S = { ...dealRun(daily ? today() * 7919 + 29 : Math.floor(Math.random() * 2 ** 31), daily, daily ? null : mix()), ranked: daily || presetNow() !== "custom" };
  save(); render();
}
const R = () => S?.routes[S.index];
const spent = path => path.slice(1).reduce((t, id) => t + cost(id), 0);
function hop(id) {
  const x = R();
  if (!x || x.done) return;
  x.path.push(id);
  if (id === x.b) { x.done = "arrived"; x.points = Math.round(100 * x.par / spent(x.path)); S.total += x.points; settled(); }
  $("filter").value = "";
  save(); render();
}
function back() { const x = R(); if (x && !x.done && x.path.length > 1) { x.path.pop(); save(); render(); } }
function giveUp() { const x = R(); if (x && !x.done) { x.done = "gave up"; x.points = 0; settled(); save(); render(); } }
/** The last route decided: the run's total is final at once, before Finish (a match's, for the table; yours, for your
 *  best and today's, which Finish counts again, changing nothing), and random mode goes on from here. */
function settled() {
  if (!S.routes.every(x => x.done)) return;
  if (S.duel) { tell(true); return; }
  count();
  roundOver("arb");
}
function count() {
  const best = read(BEST, 0); if (S.ranked !== false && S.total > best) write(BEST, S.total);
  if (S.daily) { const d = read(DAILY, {}); if (!(d[today()] >= S.total)) { d[today()] = S.total; write(DAILY, d); } }
}
function next() {
  if (S.index + 1 < S.routes.length) { S.index++; save(); render(); return; }
  S.over = true; save();
  if (S.duel) { duel.open(); return; }                    // the table's result, not your best or today's
  count();
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
  if (!S) { if (duel.on) lobby(); else newRun(false); return; }
  const x = R(), here = x.path[x.path.length - 1];
  $("route").hidden = false;
  $("where").textContent = `Route ${S.index + 1} of ${S.routes.length}${S.daily ? " · today's" : S.duel ? " · together" : ""}`;
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

// ---------- together: the same five routes for everyone at the table (duel.js) ----------
// Everyone at the table gets the match's five routes and finds their own way on their own phone; the others' scores
// show in the strip. The highest total wins, then the quicker. Your solo run, your best and today's stay as they were.
const duel = createDuel({
  game: "arb", name: "Arb", line: $("rival"), toast,
  // the match carries the dealer's mix (unless Balanced), so every phone deals the same routes from it
  deal: () => ({ seed: Math.floor(Math.random() * 2 ** 31), ...(presetNow() === "balanced" ? {} : { t: mixParam(TOPIC_LIST, mix()) }) }),
  describe: () => `The same ${PER_RUN} routes for everyone, as cheaply as you can`,
  play: (match, { kept }) => {
    S = kept?.seed === match.seed && kept.routes ? kept : { ...dealRun(match.seed, false, match.t ? mixFromParam(TOPIC_LIST, match.t) : null), duel: true };
    $("filter").value = "";
    save(); render();
  },
  onLobby: () => { S = null; render(); },
  onLeave: () => { S = read(RUN, null); $("filter").value = ""; if (!S || S.over) newRun(false); else render(); },
});
/** What the table sees of this run: the total, and how many routes are done. */
function tell(done = false) {
  const made = S.routes.filter(x => x.done === "arrived").length, decided = S.routes.filter(x => x.done).length;
  duel.report({ score: S.total, text: done ? `${S.total}, ${made} of ${PER_RUN} made` : `${S.total} · ${decided} of ${PER_RUN}`, ...(done ? { done: true } : {}) });
}
/** The page before a match: no route yet. */
function lobby() {
  $("where").textContent = `${PER_RUN} routes, together`;
  $("score").innerHTML = "Score <b>0</b>";
  $("route").hidden = true;
  $("pick").hidden = true;
  $("result").hidden = true;
}

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    const table = part(body, "together");
    duel.menu(table);
    table.append(topicMix(TOPIC_LIST, TOPIC_PRESETS, mix(), keepMix, { groups: TOPIC_GROUPS }));     // the next match's routes come from your mix
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= S?.daily ? "daily" : "random";
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  const content = part(body, "content");
  content.append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  // today's run is the same for everyone, so your topics are for random runs: what the routes run between
  if (pick === "random") content.append(topicMix(TOPIC_LIST, TOPIC_PRESETS, mix(), keepMix,
    { groups: TOPIC_GROUPS, note: w => (presetOf(TOPIC_LIST, TOPIC_PRESETS, w) === "custom" ? "Your own mix doesn't count for your best; today's run and the presets do." : null) }));
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
// a match in the address: its routes, with no solo run dealt under it
if (duel.inAddress) { S = null; duel.join().then(ok => { if (!ok) { S = read(RUN, null); if (S?.over) newRun(false); else render(); } }); }
else if (S?.over) newRun(false); else render();
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });

// for tests and debugging
window.__arb = { get state() { return S; }, hop, giveUp, next, back, duel };
