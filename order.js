// Order: put things in order. A card is dealt and you place it in your line, between the two it falls between; the
// line grows a card at a time. A wrong place costs a life (the card goes where it belongs, so the line is always
// right); three lives a run. Dates deal every dated question from Quote's bank, a painting's year among them;
// Quantities deal one family at a time, the same unit and the same kind of thing, so the comparison means something;
// History (the stories) deals one story's events (Heracles' labours, Odysseus's voyage home, Ragnarök…), where what's ordered is the
// story itself, a card's place in it (kb/items/sequences.js), and the line shows 1st, 2nd… instead of a number. The
// cards and the rules are order-engine.js's.
// A run of dates or quantities deals from your mix of topics (Quote's categories, each out, in or more), as Quote,
// Punt and Crates do; today's run is the same for everyone, whatever the mix.
// Together, one run for the table (together.js): one deck and one line for everyone at it, anyone placing the card in
// hand, the team's lives, each card marked with who placed it.
import { LIVES, MODES, BY_ID, DATES, FAMILIES, STORIES, dealRun, topicsIn, placeCard, freshTable, isTable, tidy, placeAt, newGameAt, tallies, resultOf } from "./order-engine.js";
import { withUnit, TOPIC_PRESETS, cleanTopics } from "./quote-engine.js";
import { presetOf } from "./topics.js";
import { showPicture, pictureName, nameIn } from "./pics.js";
import { sideways } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, topicMix, action, line } from "./menu.js";
import { today, arrivedForToday, dailyDue, soloHref } from "./suite.js";   // the day, the same for everyone (UTC)
import { roundOver } from "./random.js";
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { busy, sextant } from "./loading.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "order:run", BEST = "order:best", DAILY = "order:daily", TOPICS_KEY = "order:topics";
const APP = 2;                 // the table's version: one run for everyone (1 was a head-to-head, each on their own deck)
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
/** A card's value as the line shows it: a story's place (5th), or the number with its unit. */
const valueOf = q => (q.story ? ordinal(q.truth) : withUnit(q.truth, q));

// ---------- your mix of topics ----------
/** Your topics, each 0 (out), 1 (in) or 2 (more): Balanced until you change them. */
const mix = () => cleanTopics(read(TOPICS_KEY, null));
const keepMix = w => write(TOPICS_KEY, w);
/** Your mix of a mode's topics: a preset's (its id), or "custom". */
const presetFor = mode => presetOf(topicsIn(mode), TOPIC_PRESETS, mix());
/** A run counts for your best if it's today's, or dealt from a preset's mix of its topics (Balanced, Trader, Culture
 *  night); the stories have none. */
const ranked = (mode, daily) => daily || mode === "stories" || presetFor(mode) !== "custom";

// ---------- your own run ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(mode, daily) {
  const seed = daily ? today() * 7919 + ({ dates: 3, quantities: 5, stories: 7 }[mode] || 5) : Math.floor(Math.random() * 2 ** 31);
  S = { ...dealRun(mode, seed, daily ? null : mix()), daily, day: daily ? today() : null, ranked: ranked(mode, daily) };
  save(); render();
  if (S.wide) toast("Too few cards in your topics: this run deals from all of them");
}
function place(slot) {
  if (G) { placeTogether(slot); return; }
  if (!S || S.over || !S.deck.length) return;
  const { id, ok, at } = placeCard(S, slot, { fresh: true });
  if (!ok) toast(`${valueOf(BY_ID.get(id))}: it goes ${whereIn(S.line, at)}`);
  if (S.over) end();
  save(); render();
}
function end() {
  const best = read(BEST, {}), key = S.mode === "dates" ? "dates" : S.mode === "stories" ? `s:${S.story}` : `q:${S.unit}`;
  if (S.ranked !== false && !(best[key] >= S.placed)) { best[key] = S.placed; write(BEST, best); }   // your own mix doesn't count
  if (S.daily) { const d = read(DAILY, {}), k = `${S.day ?? today()}/${S.mode}`; if (!(d[k] >= S.placed)) { d[k] = S.placed; write(DAILY, d); } }
  setTimeout(finish, 700);
  roundOver("order");
}
// a card's own words, without the question's lead-in. A picture goes by its title ("this" means the picture), and its
// question says what happened to it: "The year this was painted", "…was completed" (a painting, a building); a
// picture's quantity keeps its own words, the title for "this" ("This building's height" → "Ulm Minster's height").
const titleOf = q => q.title || pictureName(q.pic);   // its name, kept with it by the build
const doneTo = q => q.q.match(/\bthis was (\w+)/i)?.[1] || "made";
const withTitle = q => nameIn(q.q, titleOf(q));
const short = id => {
  const q = BY_ID.get(id);
  if (q.pic) return q.unit === "year" ? `${titleOf(q)}, ${doneTo(q)}`.replace(/^./, c => c.toUpperCase()) : withTitle(q);   // "the Parthenon" opening a line
  return q.q.replace(/^(The )?(year(?: of)?|number of|share of|population of|area of|land area of|size of|energy in|energy to|power of|length of|volume of)\s+(the\s+)?/i, "").replace(/^./, c => c.toUpperCase());   // "The year of the Battle of Plassey": Battle of Plassey
};
const cardText = q => (q.pic ? (q.unit === "year" ? `When was ${titleOf(q)} ${doneTo(q)}?` : withTitle(q)) : q.q);
/** Where a card placed wrong went instead, as the toast says it: first, last, or after the card before it. */
const whereIn = (line, at) => (at === 0 ? "first" : at === line.length - 1 ? "last" : `after ${short(line[at - 1].id)}`);

// ---------- drawing ----------
function render() {
  const R = G?.run || S;
  if (!R) { newRun("dates", false); return; }
  $("where").textContent = `${R.mode === "stories" ? STORIES.get(R.story)?.name || MODES.stories : MODES[R.mode]}${R.mode === "quantities" ? `, in ${R.unit}` : ""}${R.daily ? " · today's" : R.ranked === false ? " · your topics" : ""} · placed ${R.placed}`;
  $("lives").textContent = "●".repeat(Math.max(0, R.lives)) + "○".repeat(LIVES - Math.max(0, R.lives));
  const next = R.deck[0];
  $("deal").hidden = !next || R.over;
  if (next && !R.over) {
    const q = BY_ID.get(next);
    $("ask").textContent = R.mode === "dates" ? `When? Tap where it goes in ${G ? "the" : "your"} line` : R.mode === "stories" ? STORIES.get(R.story).ask : `How much, in ${R.unit}? Tap where it goes`;
    $("card").textContent = cardText(q);
    // a painting's card shows the painting (fetched once per card, like Quote's: not again on every redraw)
    const pic = $("cardPic");
    if (!q.pic) { showPicture(pic, null); delete pic.dataset.title; }
    else if (pic.dataset.title !== q.pic) { pic.dataset.title = q.pic; showPicture(pic, q.pic, { width: sideways() ? 960 : 500, alt: titleOf(q) }); }   // sideways it's drawn large
  }
  drawTeam();
  const box = $("line");
  box.setAttribute("aria-label", G ? "The table's line, smallest first" : "Your line, smallest first");
  box.classList.toggle("or-shared", !!G);
  box.replaceChildren();
  // at a table, a card that wasn't there when this game was last drawn has just come in, whoever placed it
  const before = G && drawn.n === G.n ? drawn.ids : null;
  const slot = i => {
    const b = el("button", "or-slot");
    b.type = "button"; b.disabled = R.over || !next;
    b.setAttribute("aria-label", i === 0 ? "Before the first" : i === R.line.length ? "After the last" : `Between ${short(R.line[i - 1].id)} and ${short(R.line[i].id)}`);
    b.addEventListener("click", () => place(i));
    const li = el("li", "or-gap"); li.append(b); return li;
  };
  R.line.forEach((c, i) => {
    box.append(slot(i));
    const q = BY_ID.get(c.id), li = el("li"), v = el("b", "", valueOf(q)), t = el("span", "", short(c.id));
    li.className = `or-item${c.ok ? "" : " wrong"}${(G ? before && !before.has(c.id) : c.fresh) ? " fresh" : ""}`;
    if (G) {                                                  // at a table: who placed it, a dot in their colour (the first card, dealt face up, by nobody)
      const dot = el("i", "or-by");
      if (c.by != null) {
        const who = nameOf(c.by);
        dot.style.background = `var(--p${c.by % 6})`;
        dot.setAttribute("role", "img"); dot.setAttribute("aria-label", `placed by ${who}`); dot.title = who;
      }
      li.append(dot);
    }
    li.append(v, t);
    if (q.pic) {                                               // a painting in the line keeps its picture, small
      const thumb = el("span", "or-thumb");
      li.classList.add("has-pic");
      li.append(thumb);
      showPicture(thumb, q.pic, { width: 120, alt: titleOf(q) });
    }
    box.append(li);
    delete c.fresh;
  });
  box.append(slot(R.line.length));
  if (G) drawn = { n: G.n, ids: new Set(R.line.map(c => c.id)) };
}
function finish() {
  const body = $("doneBody");
  body.replaceChildren();
  body.append(el("p", "or-sum", `${S.placed} placed${S.lives <= 0 ? ", then out of lives" : ", the whole deck"}.`));
  if (S.mode === "stories") body.append(el("p", "or-note", STORIES.get(S.story).note));
  if (dailyDue("order")) body.append(action("Today's run", () => { $("doneDlg").close(); newRun(S.mode, true); }, "primary"));
  body.append(action("Another run", () => { $("doneDlg").close(); newRun(S.mode, false); }, dailyDue("order") ? "" : "primary"));
  $("doneDlg").showModal();
}
let toastTimer;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2600); }

// ---------- together: one run for the table (together.js) ----------
// The pair's duo match, or a party's table of up to six, each on their own phone: the same card in hand on every
// phone, and whoever taps a gap first places it, for the team. A tap made on a screen the table has moved on from
// (someone else's card went in first) does nothing, and says so. The team's three lives; each card shows who placed
// it; the end, the team's count and each player's right and wrong. Your solo run, bests and today's stay as they were.
let G = null;                  // the table as last seen, made whole (null: playing alone)
let drawn = { n: null, ids: new Set() };     // the cards of this game on the screen, so a new one comes in fresh
let told = { n: null, ids: new Set() };      // the cards of this game already seen placed, so a wrong one is told once
let shownOver = null, pickMode = null, placing = false;
let joining = null;            // the rete while this phone sits down at the table in its address, until it's drawn
const seated = () => { joining?.(); joining = null; };
const first = name => String(name || "Player").trim().split(/\s+/)[0];
/** Everyone seated at the table, by seat: [{ slot, name, me, here }] (here: this game open on a phone that's online). */
const people = () => (together.room && together.slot != null
  ? [{ slot: together.slot, name: together.room.name, me: true, here: true }, ...together.others()].sort((a, b) => a.slot - b.slot) : []);
const nameOf = slot => { const p = people().find(x => x.slot === slot); return p?.me ? "You" : first(p?.name); };

function onState(val) {
  seated();
  const was = G;
  G = tidy(structuredClone(val));
  if (was?.n !== G.n) {                                       // a new game, or this one seen for the first time
    if ($("doneDlg").open) $("doneDlg").close();
    if (was) toast(`A new game: ${MODES[G.run.mode]}`);
    pickMode = null;
    told = { n: G.n, ids: new Set(G.run.line.map(c => c.id)) };     // what's already there isn't news
  }
  tellMisses();
  render();
  if (G.run.over && shownOver !== G.n) {                      // the end, on every phone (a moment to see the last card first)
    const n = shownOver = G.n;
    setTimeout(() => { if (G?.n === n && G.run.over) finishTogether(); }, was?.n === n ? 700 : 0);
  }
}
/** A card placed in the wrong gap since the last state, by anyone: where it goes, as when playing alone. */
function tellMisses() {
  G.run.line.forEach((c, at) => {
    if (told.ids.has(c.id)) return;
    told.ids.add(c.id);
    if (!c.ok) toast(`${c.by === together.slot ? `${valueOf(BY_ID.get(c.id))}: it` : `${nameOf(c.by)} missed: ${valueOf(BY_ID.get(c.id))}`} goes ${whereIn(G.run.line, at)}`);
  });
}
/** Places the card in hand where this phone's player tapped, if it's still the card in hand on the same line. */
async function placeTogether(at) {
  const run = G.run;
  if (run.over || !run.deck.length || placing) return;
  const n = G.n, id = run.deck[0], len = run.line.length, slot = together.slot;
  let placed = null, by = null;
  placing = true;
  $("line").querySelectorAll(".or-slot")[at]?.classList.add("on");        // the gap tapped, until the table answers
  const ok = await together.act(g => {
    placed = placeAt(tidy(g), { n, id, len, at, slot });
    by = placed || g.n !== n ? null : g.run.line.find(c => c.id === id)?.by ?? null;   // who got there first, in this game
    return !!placed;
  });
  placing = false;
  if (!ok && !placed) toast(by != null && by !== slot ? `Too late: ${nameOf(by)} placed it` : "Too late: the table moved on");
  if (!ok) render();
}
/** A new game for the table in a mode: asks first while this one is under way. */
async function dealAgain(mode) {
  if (!G) return;
  const n = G.n;
  if (!G.run.over && G.run.line.length > 1 && !confirm("Deal a new game for the table? This one isn't finished.")) return;
  const seed = Math.floor(Math.random() * 2 ** 31), weights = mix();      // the table's next game, from the dealer's topics
  await together.act(g => newGameAt(tidy(g), { n, mode, seed, weights }));
}
/** Who's at the table, each by their colour (the cards they placed carry it); those away greyed. */
function drawTeam() {
  const box = $("team"), all = people();
  box.hidden = !G;
  if (!G) return;
  const initials = all.length > 4;                            // five or six: initials, so all of them fit
  box.replaceChildren(...all.map(p => {
    const who = el("span", `or-who${p.me ? " me" : ""}${p.here ? "" : " away"}`), dot = el("i", "or-by");
    dot.style.background = `var(--p${p.slot % 6})`;
    who.append(dot, initials ? (Array.from(first(p.name))[0] || "?").toUpperCase() : p.me ? "You" : first(p.name));
    if (initials || !p.here) who.title = `${p.me ? "You" : p.name}${p.here ? "" : " (away)"}`;
    return who;
  }));
}
/** The end of a game at the table: the team's count, and each player's part. */
function finishTogether() {
  const run = G.run, counts = tallies(run), body = $("doneBody");
  body.replaceChildren();
  body.append(el("p", "or-sum", `${run.placed} placed together${run.lives <= 0 ? ", then out of lives" : ", the whole deck"}.`));
  const rows = el("ul", "or-tally");
  for (const p of people()) {
    const t = counts[p.slot] || { right: 0, wrong: 0 }, li = el("li", p.me ? "me" : ""), who = el("b"), dot = el("i", "or-by");
    dot.style.background = `var(--p${p.slot % 6})`;
    who.append(dot, p.me ? "You" : p.name);
    li.append(who, el("span", "", `${t.right} right · ${t.wrong} wrong`));
    rows.append(li);
  }
  body.append(rows);
  if (run.mode === "stories") body.append(el("p", "or-note", STORIES.get(run.story).note));
  body.append(action("Another game", () => { $("doneDlg").close(); dealAgain(run.mode); }, "primary"),
    action("Back to solo", () => { $("doneDlg").close(); together.leave(); }, "link"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
/** The name this player goes by at a table (the suite's, asked once). */
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "order",
  app: APP,
  toast,
  askName,
  valid: isTable,
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => freshTable(players, { mode: S?.mode, seed: Math.floor(Math.random() * 2 ** 31), people: ask?.people, app: APP, weights: mix() }),
  onState,
  onPresence: () => { if (G) drawTeam(); },
  onLeave: () => {
    seated();
    G = null; shownOver = null; pickMode = null; placing = false;
    if ($("doneDlg").open) $("doneDlg").close();
    S = read(RUN, null);
    solo();
  },
  result: resultOf,                                            // a team result: the count placed
});
/** Back to your own run: from the table, or from the address while still sitting down at it. */
const backToSolo = () => { if (together.room) together.leave(); else location.replace(soloHref()); };

// ---------- the menu ----------
let pick = null;
/** The mix of topics for a mode, in the menu: a preset, or each topic tapped out, in or more (none for the stories);
 *  alone, with what your own mix counts for. changed: after a tap, once the mix is kept. */
function topicsPart(box, mode, solo = false, changed = () => {}) {
  const list = topicsIn(mode), note = w => (presetOf(list, TOPIC_PRESETS, w) === "custom" ? "Your own mix doesn't count for your best; today's run and the presets do." : null);
  if (list.length) box.append(topicMix(list, TOPIC_PRESETS, mix(), w => { keepMix(w); changed(); }, { note: solo ? note : null }));
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room || joining) {                             // at the table: its next game, who's there, back to solo
    const table = part(body, "together");
    if (G) {
      pickMode ??= G.run.mode;
      const all = people().map(p => `${p.me ? "you" : p.name}${p.here ? "" : " (away)"}`);
      table.append(action("New game", () => dealAgain(pickMode), "primary"),
        choice("Order", Object.entries(MODES), pickMode, v => { pickMode = v; openMenu(); }));
      topicsPart(table, pickMode);
      table.append(line(`At the table: ${all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all.join("")}`));
    } else { const wait = line(joiningWords()); wait.prepend(sextant()); table.append(wait); }
    table.append(action("Back to solo", backToSolo, "link"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= { mode: S?.mode || "dates", daily: (!!S?.daily && !S.over) || dailyDue("order") };   // today's first, while it's still to play
  part(body, "play").append(action("New run", () => newRun(pick.mode, pick.daily), "primary"));
  const content = part(body, "content");
  content.append(
    choice("Order", Object.entries(MODES), pick.mode, v => { pick.mode = v; openMenu(); }),
    choice("Run", [[false, "Random"], [true, "Today's"]], pick.daily, v => { pick.daily = v; openMenu(); }));
  // your topics are for random runs (today's is the same for everyone), so they're shown either way, and one changed
  // with today's picked turns the next run to a random one
  topicsPart(content, pick.mode, true, () => { if (pick.daily) { pick.daily = false; openMenu(); } });
  const best = read(BEST, {});
  part(body, "about").append(line(`Best: dates ${best.dates ?? "–"}${FAMILIES.some(f => best[`q:${f.unit}`] != null) ? `, quantities ${Math.max(...FAMILIES.map(f => best[`q:${f.unit}`] ?? 0))}` : ""} · ${DATES.length} dated cards, ${FAMILIES.length} families of quantities`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".or-mark").innerHTML = APPS.find(a => a.id === "order").logo;
bindSwitcher($("appsBtn"), "order");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
/** Today's run, still to play: asks before leaving a run you've started. */
function openToday() {
  if (S && !S.over && S.line.length > 1 && !confirm("Start today's run? This one isn't finished.")) return;
  newRun(S?.mode || "dates", true);
}
// opening: from the tile, today's; a finished run gives way to today's while it's still to play, else a random one
function solo() {
  if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
  else if (!S || S.over) newRun(S?.mode || "dates", dailyDue("order"));
  else render();
}
// a table in the address (a duo match, a party's game): the rete until it's drawn, and no solo run under it
const code = roomInAddress();
if (code) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { seated(); solo(); } }); }
else solo();
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });

// for tests and debugging
window.__order = { get state() { return S; }, get table() { return G; }, place, together };
