// Order: put things in order. A card is dealt and you place it in your line, between the two it falls between; the
// line grows a card at a time. A wrong place costs a life (the card goes where it belongs, so the line is always
// right); three lives a run. Dates deal every dated question from Quote's bank, a painting's year among them;
// Quantities deal one family at a time, the same unit and the same kind of thing, so the comparison means something;
// History (the stories) deals one story's events (Heracles' labours, Odysseus's voyage home, Ragnarök…), where what's ordered is the
// story itself, a card's place in it (kb/items/sequences.js), and the line shows 1st, 2nd… instead of a number.
// Together, the same cards for everyone at the table, in the same order (duel.js).
import { QUOTES } from "./quote-bank.js";
import { SEQUENCES } from "./kb/items/sequences.js";
import { withUnit } from "./quote-engine.js";
import { showPicture, pictureName, nameIn } from "./pics.js";
import { sideways } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { today, arrivedForToday, dailyDue } from "./suite.js";   // the day, the same for everyone (UTC)
import { createDuel } from "./duel.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const LIVES = 3, DATES_PER_RUN = 16;
const RUN = "order:run", BEST = "order:best", DAILY = "order:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the cards ----------
const BY_ID = new Map(QUOTES.map(q => [q.id, q]));
const DATES = QUOTES.filter(q => q.unit === "year").map(q => q.id);
// quantities: one family a run, a unit with enough cards to make a line
export const FAMILIES = Object.entries(QUOTES.filter(q => q.unit !== "year").reduce((f, q) => ((f[q.unit] ||= []).push(q.id), f), {}))
  .filter(([, ids]) => ids.length >= 6).map(([unit, ids]) => ({ unit, ids }));
// stories: each event a card whose truth is its place in the story
const STORIES = new Map(SEQUENCES.map(s => [s.id, s]));
for (const s of SEQUENCES) s.steps.forEach((text, i) => BY_ID.set(`st:${s.id}:${i + 1}`, { id: `st:${s.id}:${i + 1}`, q: text, truth: i + 1, unit: s.unit, story: s.id }));
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
/** A card's value as the line shows it: a story's place (5th), or the number with its unit. */
const valueOf = q => (q.story ? ordinal(q.truth) : withUnit(q.truth, q));
const MODES = { dates: "Dates", quantities: "Quantities", stories: "History" };   // History: the stories, once called Stories

// ---------- a run ----------
let S = read(RUN, null);
const save = () => { if (S?.duel) { duel.keep(S); tell(); } else write(RUN, S); };   // a match's run is kept apart from yours
/** The cards of a seed in a mode, the line starting with one face up. */
function dealRun(mode, seed, daily) {
  const r = rng(seed);
  let ids, unit = "year", story = null;
  if (mode === "dates") ids = shuffle(r, DATES).slice(0, DATES_PER_RUN);
  else if (mode === "stories") { const s = SEQUENCES[Math.floor(r() * SEQUENCES.length)]; story = s.id; unit = s.unit; ids = shuffle(r, s.steps.map((_, i) => `st:${s.id}:${i + 1}`)); }
  else { const fam = FAMILIES[Math.floor(r() * FAMILIES.length)]; unit = fam.unit; ids = shuffle(r, fam.ids); }
  return { seed, daily, day: daily ? today() : null, mode, unit, story, deck: ids.slice(1), line: [{ id: ids[0], ok: true }], lives: LIVES, placed: 0, over: false };
}
function newRun(mode, daily) {
  S = dealRun(mode, daily ? today() * 7919 + ({ dates: 3, quantities: 5, stories: 7 }[mode] || 5) : Math.floor(Math.random() * 2 ** 31), daily);
  save(); render();
}
const truth = id => BY_ID.get(id).truth;
/** Where a card belongs: the first slot whose neighbours hold it (ties go either side). */
const fits = (line, id, slot) => (slot === 0 || truth(line[slot - 1].id) <= truth(id)) && (slot === line.length || truth(id) <= truth(line[slot].id));
function place(slot) {
  if (!S || S.over || !S.deck.length) return;
  const id = S.deck[0], ok = fits(S.line, id, slot);
  let at = slot;
  if (!ok) { at = S.line.findIndex(c => truth(c.id) > truth(id)); if (at < 0) at = S.line.length; S.lives--; }
  else S.placed++;
  S.line.splice(at, 0, { id, ok, fresh: true });
  S.deck.shift();
  if (!ok) toast(`${valueOf(BY_ID.get(id))}: it goes ${at === 0 ? "first" : at === S.line.length - 1 ? "last" : `after ${short(S.line[at - 1].id)}`}`);
  if (S.lives <= 0 || !S.deck.length) end();
  save(); render();
}
function end() {
  S.over = true;
  if (S.duel) { tell(true); return; }                     // the table's result, not your best or today's
  const best = read(BEST, {}), key = S.mode === "dates" ? "dates" : S.mode === "stories" ? `s:${S.story}` : `q:${S.unit}`;
  if (!(best[key] >= S.placed)) { best[key] = S.placed; write(BEST, best); }
  if (S.daily) { const d = read(DAILY, {}), k = `${S.day ?? today()}/${S.mode}`; if (!(d[k] >= S.placed)) { d[k] = S.placed; write(DAILY, d); } }
  setTimeout(finish, 700);
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
  return q.q.replace(/^(The )?(year|number of|share of|population of|area of|land area of|size of|energy in|energy to|power of|length of|volume of)\s+(the\s+)?/i, "").replace(/^./, c => c.toUpperCase());
};
const cardText = q => (q.pic ? (q.unit === "year" ? `When was ${titleOf(q)} ${doneTo(q)}?` : withTitle(q)) : q.q);

// ---------- drawing ----------
function render() {
  if (!S) { if (duel.on) lobby(); else newRun("dates", false); return; }
  $("where").textContent = `${S.mode === "stories" ? STORIES.get(S.story)?.name || MODES.stories : MODES[S.mode]}${S.mode === "quantities" ? `, in ${S.unit}` : ""}${S.daily ? " · today's" : ""} · placed ${S.placed}`;
  $("lives").textContent = "●".repeat(Math.max(0, S.lives)) + "○".repeat(LIVES - Math.max(0, S.lives));
  const next = S.deck[0];
  $("deal").hidden = !next || S.over;
  if (next && !S.over) {
    const q = BY_ID.get(next);
    $("ask").textContent = S.mode === "dates" ? "When? Tap where it goes in your line" : S.mode === "stories" ? STORIES.get(S.story).ask : `How much, in ${S.unit}? Tap where it goes`;
    $("card").textContent = cardText(q);
    // a painting's card shows the painting (fetched once per card, like Quote's: not again on every redraw)
    const pic = $("cardPic");
    if (!q.pic) { showPicture(pic, null); delete pic.dataset.title; }
    else if (pic.dataset.title !== q.pic) { pic.dataset.title = q.pic; showPicture(pic, q.pic, { width: sideways() ? 960 : 500, alt: titleOf(q) }); }   // sideways it's drawn large
  }
  const box = $("line");
  box.replaceChildren();
  const slot = i => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "or-slot"; b.disabled = S.over || !next;
    b.setAttribute("aria-label", i === 0 ? "Before the first" : i === S.line.length ? "After the last" : `Between ${short(S.line[i - 1].id)} and ${short(S.line[i].id)}`);
    b.addEventListener("click", () => place(i));
    const li = document.createElement("li"); li.className = "or-gap"; li.append(b); return li;
  };
  S.line.forEach((c, i) => {
    box.append(slot(i));
    const q = BY_ID.get(c.id), li = document.createElement("li"), v = document.createElement("b"), t = document.createElement("span");
    li.className = `or-item${c.ok ? "" : " wrong"}${c.fresh ? " fresh" : ""}`;
    v.textContent = valueOf(q); t.textContent = short(c.id);
    li.append(v, t);
    if (q.pic) {                                               // a painting in the line keeps its picture, small
      const thumb = document.createElement("span");
      thumb.className = "or-thumb";
      li.classList.add("has-pic");
      li.append(thumb);
      showPicture(thumb, q.pic, { width: 120, alt: titleOf(q) });
    }
    box.append(li);
    delete c.fresh;
  });
  box.append(slot(S.line.length));
}
function finish() {
  const body = $("doneBody");
  body.replaceChildren();
  const p = document.createElement("p");
  p.className = "or-sum";
  p.textContent = `${S.placed} placed${S.lives <= 0 ? ", then out of lives" : ", the whole deck"}.`;
  body.append(p);
  if (S.mode === "stories") { const n = document.createElement("p"); n.className = "or-note"; n.textContent = STORIES.get(S.story).note; body.append(n); }
  if (dailyDue("order")) body.append(action("Today's run", () => { $("doneDlg").close(); newRun(S.mode, true); }, "primary"));
  body.append(action("Another run", () => { $("doneDlg").close(); newRun(S.mode, false); }, dailyDue("order") ? "" : "primary"));
  $("doneDlg").showModal();
}
let toastTimer;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2600); }

// ---------- together: the same cards for everyone at the table (duel.js) ----------
// Everyone at the table gets the match's deck, the same cards in the same order with the same first card face up, and
// builds their own line on their own phone; the others' counts show in the strip. The most placed wins, then the most
// lives left, then the quicker. Your solo run, your bests and today's stay as they were.
let duelMode = null;                                         // the kind of order the next match deals (the menu's)
const duel = createDuel({
  game: "order", name: "Order", line: $("rival"), toast,
  deal: () => ({ seed: Math.floor(Math.random() * 2 ** 31), mode: MODES[duelMode] ? duelMode : S?.mode || "dates" }),
  describe: m => `${MODES[m.mode] || MODES.dates}: the same cards for everyone, in the same order`,
  compare: (a, b) => (b.score - a.score) || ((b.lives || 0) - (a.lives || 0)) || ((a.ms ?? Infinity) - (b.ms ?? Infinity)) || 0,
  play: (match, { kept }) => {
    const mode = MODES[match.mode] ? match.mode : "dates";
    S = kept?.seed === match.seed && kept.line ? kept : { ...dealRun(mode, match.seed, false), duel: true };
    duelMode = S.mode;
    save(); render();
  },
  onLobby: match => { S = null; duelMode = match.mode; render(); },
  onLeave: () => { S = read(RUN, null); if (!S || S.over) newRun(S?.mode || "dates", dailyDue("order")); else render(); },
});
/** What the table sees of this run: the count placed, and the lives. */
function tell(done = false) {
  const left = Math.max(0, S.lives);
  duel.report({ score: S.placed, lives: left, text: `${S.placed} placed${left < LIVES ? ` ${"●".repeat(left)}${"○".repeat(LIVES - left)}` : ""}`, ...(done ? { done: true } : {}) });
}
/** The page before a match: nothing dealt yet. */
function lobby() {
  $("where").textContent = `${MODES[duelMode] || MODES.dates}: the same cards for everyone`;
  $("lives").textContent = "●".repeat(LIVES);
  $("deal").hidden = true;
  $("line").replaceChildren();
}

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {                                             // a match: the table's own, and what the next one deals
    duel.menu(part(body, "together"));
    part(body, "content").append(choice("Order", Object.entries(MODES), duel.match?.mode || "dates", v => { duelMode = v; $("menuDlg").close(); if (!duel.newMatch()) duelMode = duel.match?.mode; }));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= { mode: S?.mode || "dates", daily: (!!S?.daily && !S.over) || dailyDue("order") };   // today's first, while it's still to play
  part(body, "play").append(action("New run", () => newRun(pick.mode, pick.daily), "primary"));
  part(body, "content").append(
    choice("Order", Object.entries(MODES), pick.mode, v => { pick.mode = v; }),
    choice("Run", [[false, "Random"], [true, "Today's"]], pick.daily, v => { pick.daily = v; }));
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
// opening: from the tile, today's; a finished run gives way to today's while it's still to play, else a random one;
// a match in the address, the match (no solo run under it)
function solo() {
  if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
  else if (!S || S.over) newRun(S?.mode || "dates", dailyDue("order"));
  else render();
}
if (duel.inAddress) { S = null; duel.join().then(ok => { if (!ok) { S = read(RUN, null); solo(); } }); }
else solo();
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });

// for tests and debugging
window.__order = { get state() { return S; }, place, duel };
