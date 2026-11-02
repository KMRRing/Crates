// Arb: get from one thing to another through the knowledge base's links, as cheaply as you can. Every step costs
// more the better-connected the thing you step onto: an obscure link costs 1, the United States about 9 (1 + log2 of
// its links), so the cheap route runs through what you specifically know, not through the hubs. Par is the cheapest
// route there is; matching it scores 100. Five routes a run, random or today's; every hop shows why the two are
// linked, and the end shows the cheapest route. A random run's routes run between things of the topics that are on (the
// suite's one set, in Settings: topics.js, topics-on.js), read when the run is dealt; today's is the same for everyone,
// whatever is on. Together, the same five routes for everyone at the table (duel.js), from the dealer's topics.
// Help: a "?" beside any thing (the two ends, every link on offer) gives its description a clue at a time, and files it
// in the pile as not known (Deck); no points are lost, but a thing you had to ask about is one you didn't know. Hint and Show
// cost points, in the steps' own currency: a hint is half a step (three, each a little more: what the next best word is,
// something about it, its first letter), Show a whole one: it marks the next best word in the list, or, from a dead end
// (no way on that doesn't cross your own route), takes you back to where the way on starts and says which word to take.
import { PER_RUN, NEAR, cost, name, kind, TOPIC_LIST, topicsOf, dealRun, bestOn, backOut } from "./arb-engine.js";
import { clueLines, whatCard } from "./thing-clues.js";
import * as pile from "./pile.js";
import { subjectPreset, even, mixParam, mixFromParam } from "./topics.js";
import { subjectsOn } from "./topics-on.js";
import { topicsPart } from "./topics-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "arb:run", BEST = "arb:best", DAILY = "arb:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

// ---------- your topics ----------
// The suite's one set (Settings, or Change topics in the menu), read when a run is dealt, never kept here; the old
// arb:topics key is no longer read or written. A preset counts for your best, your own mix doesn't.
const mix = () => topicsOf(subjectsOn());
const onPreset = () => subjectPreset(subjectsOn()) !== "custom";

// ---------- a run ----------
let S = read(RUN, null);
const save = () => { if (S?.duel) { duel.keep(S); tell(); } else write(RUN, S); };   // a match's run is kept apart from yours
function newRun(daily) {
  // your own mix doesn't count for your best: today's run and the presets do
  S = { ...dealRun(daily ? today() * 7919 + 29 : Math.floor(Math.random() * 2 ** 31), daily, daily ? null : mix()), ranked: daily || onPreset() };
  save(); render();
}
const R = () => S?.routes[S.index];
const spent = path => path.slice(1).reduce((t, id) => t + cost(id), 0);
const HINT_FEE = 0.5, SHOW_FEE = 1;
/** What a route has cost: the steps on the way, and the help taken (which stays when Back or Show takes steps away). */
const spentOf = x => spent(x.path) + (x.fees || 0);
function hop(id) {
  const x = R();
  if (!x || x.done) return;
  x.path.push(id);
  if (id === x.b) { x.done = "arrived"; x.points = Math.round(100 * x.par / spentOf(x)); S.total += x.points; settled(); }
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
  $("par").textContent = `Par ${fmtCost(x.par)} · spent ${fmtCost(spentOf(x))}${x.fees ? ` (${fmtCost(x.fees)} for help)` : ""}`;
  drawPath($("path"), x.path);
  $("path").lastElementChild?.scrollIntoView({ block: "nearest" });
  const playing = !x.done;
  $("pick").hidden = !playing;
  $("result").hidden = playing;
  if (playing) {
    $("backBtn").disabled = x.path.length < 2;
    $("hintBtn").textContent = stageOf(x) ? `Hint · ${stageOf(x)}` : "Hint";
    const filter = $("filter").value.trim().toLowerCase();
    // no dead ends: a link is offered only if it leads somewhere new (the goal always is), so a step never forces a
    // step back; a thing whose only link is the one you came along, or whose links all lead back onto your route, isn't
    const onward = id => id === x.b || [...NEAR.get(id).keys()].some(n => n !== here && !x.path.includes(n));
    const options = [...NEAR.get(here).keys()].filter(id => !x.path.includes(id) && onward(id) && (!filter || name(id).toLowerCase().includes(filter)))
      .sort((p, q) => (p === x.b ? -1 : q === x.b ? 1 : name(p).localeCompare(name(q))));
    $("links").replaceChildren(...options.map(id => {
      const li = document.createElement("li"), btn = document.createElement("button");
      const shown = x.shown?.at === x.path.length && x.shown.id === id;
      btn.type = "button"; btn.className = `ab-link${id === x.b ? " goal" : ""}${shown ? " shown" : ""}`;
      btn.innerHTML = "<b></b><small></small><span class=\"ab-cost\"></span>";
      btn.firstChild.textContent = name(id);
      btn.children[1].textContent = kind(id);
      btn.lastChild.textContent = fmtCost(cost(id));
      btn.setAttribute("aria-label", `${name(id)}, costs ${fmtCost(cost(id))}`);
      btn.addEventListener("click", () => hop(id));
      li.append(btn, whatBtn(id)); return li;
    }));
    $("links").scrollTop = 0;
    $("links").querySelector(".shown")?.scrollIntoView({ block: "nearest" });
  } else {
    const arrived = x.done === "arrived";
    $("verdict").className = `ab-verdict ${arrived ? "good" : "bad"}`;
    $("verdict").textContent = arrived ? `Arrived for ${fmtCost(spentOf(x))}: +${x.points}` : `The cheapest route cost ${fmtCost(x.par)}`;
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

// ---------- help: what a thing is, a hint, the best next word shown ----------
const kindLabel = id => kind(id).replace(/^(kind|feature):/, "").replace(/-/g, " ");
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** The cheapest route's things between the ends: a description of anything else on this route mustn't name them, which would give the way. */
const hiddenOf = (x, id) => x.parRoute.slice(1, -1).filter(t => t !== id).map(name);
/** Only an end has its hints: a thing among the links has them written for its own, one of which could be the way. */
const cluesOf = (x, id) => clueLines(id, hiddenOf(x, id), { hints: id === x.a || id === x.b });
function whatBtn(id) {
  const b = el("button", "ab-what", "?");
  b.type = "button"; b.setAttribute("aria-label", `What is ${name(id)}?`);
  b.addEventListener("click", () => openWhat(id, false));
  return b;
}
let looking = null;                                               // the thing whose clues the dialog shows
function drawWhat() {
  const x = R(), all = cluesOf(x, looking), n = Math.min(x.looked?.[looking] || 0, all.length);
  $("whatTitle").textContent = name(looking);
  $("whatList").replaceChildren(...(all.length ? all.slice(0, n).map(t => el("li", null, t)) : [el("li", null, "Nothing more is known of it here.")]));
  $("whatMore").disabled = n >= all.length;
  $("whatMore").textContent = n >= all.length ? "No more clues" : "Another clue";
  $("whatNote").hidden = !!S.duel || !whatCard(looking);          // only what Deck can be asked about is marked
}
/** A thing's description, a clue at a time: free, but marks it as not known for Deck (once a route, and not in a match, whose routes are no one's to learn from). */
function openWhat(id, more) {
  const x = R();
  if (!x) return;
  looking = id;
  x.looked ??= {};
  if (more || !x.looked[id]) x.looked[id] = Math.min(cluesOf(x, id).length, (x.looked[id] || 0) + 1);
  if (!S.duel && !(x.marked ??= []).includes(id)) { x.marked.push(id); const card = whatCard(id); if (card) pile.record("nexus", card.key, card.payload, "clue"); }
  save(); drawWhat();
  if (!$("whatDlg").open) $("whatDlg").showModal();
}
/** How many hints this spot has had: a hint is about where you stand, so a step either way starts again (and costs again). */
const stageOf = x => (x.hint?.at === x.path.length ? x.hint.n : 0);
/** The hints for where you stand, vague to specific; from a dead end, the one that says so. */
function hintLines(x) {
  const way = bestOn(x.path, x.b);
  if (!way) {
    const out = backOut(x.path, x.b), back = out ? x.path.length - out.keep : 0;
    return [out ? `A dead end: every way on to ${name(x.b)} runs back into your route. Go back ${back} step${back === 1 ? "" : "s"}.` : "A dead end, with no way round it."];
  }
  const next = way[0], words = name(next).trim().split(/\s+/).length;
  const lines = [`The best next step is a ${kindLabel(next)}.`];
  const more = clueLines(next, [name(next), ...hiddenOf(x, next)], { hints: false }).slice(1)[0];
  lines.push(more || `It costs ${fmtCost(cost(next))}.`);
  lines.push(`It starts with ${name(next)[0].toUpperCase()}, ${words === 1 ? "one word" : `${words} words`}.`);
  return lines;
}
function drawHint() {
  const x = R(), all = hintLines(x), n = Math.min(stageOf(x), all.length);
  $("hintList").replaceChildren(...all.slice(0, n).map(t => el("li", null, t)));
  $("hintMore").disabled = n >= all.length;
  $("hintMore").textContent = n >= all.length ? "No more hints" : `Another hint (costs ${fmtCost(HINT_FEE)})`;
  $("hintNote").textContent = `Help so far on this route: ${fmtCost(x.fees || 0)}.`;
}
/** The first hint at a spot costs half a step, and each further one the same; looking at the ones you have costs nothing. */
function askHint(more) {
  const x = R();
  if (!x || x.done) return;
  const n = stageOf(x);
  if (!n || (more && n < hintLines(x).length)) { x.hint = { at: x.path.length, n: n + 1 }; x.fees = (x.fees || 0) + HINT_FEE; save(); render(); }
  drawHint();
  if (!$("hintDlg").open) $("hintDlg").showModal();
}
/**
 * Show: the next best word, marked in the list, for a whole step (looking again from the same spot is free). From a dead
 * end it takes you back to where a way on starts, for the same, and says which word to take instead.
 */
function show() {
  const x = R();
  if (!x || x.done) return;
  const way = bestOn(x.path, x.b);
  if (way) {
    if (x.shown?.at !== x.path.length) x.fees = (x.fees || 0) + SHOW_FEE;
    x.shown = { at: x.path.length, id: way[0] };
    $("filter").value = ""; save(); render();
    return;
  }
  const out = backOut(x.path, x.b);
  if (!out) { toast("There is no way on from here."); return; }
  const took = x.path.length - out.keep;
  x.path = x.path.slice(0, out.keep);
  x.fees = (x.fees || 0) + SHOW_FEE;
  x.shown = { at: x.path.length, id: out.way[0] };
  $("filter").value = ""; save(); render();
  toast(`A dead end. Back ${took} step${took === 1 ? "" : "s"}: take ${name(out.way[0])} from ${name(x.path.at(-1))}.`, 5000);
}
function toast(text, ms = 2600) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- together: the same five routes for everyone at the table (duel.js) ----------
// Everyone at the table gets the match's five routes and finds their own way on their own phone; the others' scores
// show in the strip. The highest total wins, then the quicker. Your solo run, your best and today's stay as they were.
const duel = createDuel({
  game: "arb", name: "Arb", line: $("rival"), toast,
  // the match carries the dealer's mix (unless every topic is in), so every phone deals the same routes from it
  deal: () => { const w = mix(); return { seed: Math.floor(Math.random() * 2 ** 31), ...(even(TOPIC_LIST, w) ? {} : { t: mixParam(TOPIC_LIST, w) }) }; },
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
// topics changed (in the sheet Change topics opens) with today's picked: the next run is a random one, which they are for
addEventListener("topics:changed", () => { if (pick === "daily") pick = "random"; });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    const table = part(body, "together");
    duel.menu(table);
    table.append(...topicsPart(table, "The next match is dealt from your topics"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= S?.daily ? "daily" : "random";
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  const content = part(body, "content");
  content.append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  // today's run is the same for everyone, so your topics are for random runs (what the routes run between), but shown
  // either way: a game opens on today's, and topics shown only with Random were never found
  content.append(...topicsPart(content, pick === "daily" ? "Today's run deals every topic" : onPreset() ? "" : "Your own mix doesn't count for your best"));
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
$("fromWhat").addEventListener("click", () => openWhat(R().a, false));
$("toWhat").addEventListener("click", () => openWhat(R().b, false));
$("whatMore").addEventListener("click", () => openWhat(looking, true));
$("whatClose").addEventListener("click", () => $("whatDlg").close());
$("hintBtn").addEventListener("click", () => askHint(false));
$("hintMore").addEventListener("click", () => askHint(true));
$("hintClose").addEventListener("click", () => $("hintDlg").close());
$("showBtn").addEventListener("click", show);
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
// a match in the address: its routes, with no solo run dealt under it
if (duel.inAddress) { S = null; duel.join().then(ok => { if (!ok) { S = read(RUN, null); if (S?.over) newRun(false); else render(); } }); }
else if (S?.over) newRun(false); else render();
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });

// for tests and debugging
window.__arb = { get state() { return S; }, hop, giveUp, next, back, duel, openWhat, askHint, show };
