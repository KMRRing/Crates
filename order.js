// Order: put things in order. A card is dealt and you place it in your line, between the two it falls between; the
// line grows a card at a time. A wrong place costs a life (the card goes where it belongs, so the line is always
// right); three lives a run. Dates deal every dated question from Quote's bank, a painting's year among them;
// Quantities deal one family at a time, the same unit and the same kind of thing, so the comparison means something.
import { QUOTES } from "./quote-bank.js";
import { withUnit } from "./quote-engine.js";
import { showPicture } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const LIVES = 3, DATES_PER_RUN = 16;
const RUN = "order:run", BEST = "order:best", DAILY = "order:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the cards ----------
const BY_ID = new Map(QUOTES.map(q => [q.id, q]));
const DATES = QUOTES.filter(q => q.unit === "year").map(q => q.id);
// quantities: one family a run, a unit with enough cards to make a line
export const FAMILIES = Object.entries(QUOTES.filter(q => q.unit !== "year").reduce((f, q) => ((f[q.unit] ||= []).push(q.id), f), {}))
  .filter(([, ids]) => ids.length >= 6).map(([unit, ids]) => ({ unit, ids }));
const MODES = { dates: "Dates", quantities: "Quantities" };

// ---------- a run ----------
let S = read(RUN, null);
const save = () => write(RUN, S);
function newRun(mode, daily) {
  const seed = daily ? today() * 7919 + (mode === "dates" ? 3 : 5) : Math.floor(Math.random() * 2 ** 31), r = rng(seed);
  let ids, unit = "year";
  if (mode === "dates") ids = shuffle(r, DATES).slice(0, DATES_PER_RUN);
  else { const fam = FAMILIES[Math.floor(r() * FAMILIES.length)]; unit = fam.unit; ids = shuffle(r, fam.ids); }
  // the line starts with one card face up
  S = { seed, daily, mode, unit, deck: ids.slice(1), line: [{ id: ids[0], ok: true }], lives: LIVES, placed: 0, over: false };
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
  if (!ok) toast(`${withUnit(truth(id), BY_ID.get(id))}: it goes ${at === 0 ? "first" : at === S.line.length - 1 ? "last" : `after ${short(S.line[at - 1].id)}`}`);
  if (S.lives <= 0 || !S.deck.length) end();
  save(); render();
}
function end() {
  S.over = true;
  const best = read(BEST, {}), key = S.mode === "dates" ? "dates" : `q:${S.unit}`;
  if (!(best[key] >= S.placed)) { best[key] = S.placed; write(BEST, best); }
  if (S.daily) { const d = read(DAILY, {}), k = `${today()}/${S.mode}`; if (!(d[k] >= S.placed)) { d[k] = S.placed; write(DAILY, d); } }
  setTimeout(finish, 700);
}
// a card's own words, without the question's lead-in; a painting goes by its title ("this" means the picture)
const titleOf = q => q.pic.replace(/_/g, " ").replace(/\s*\(.*\)$/, "");
const short = id => {
  const q = BY_ID.get(id);
  if (q.pic) return `${titleOf(q)}, painted`;
  return q.q.replace(/^(The )?(year|number of|share of|population of)\s+(the\s+)?/i, "").replace(/^./, c => c.toUpperCase());
};
const cardText = q => (q.pic ? `When was ${titleOf(q)} painted?` : q.q);

// ---------- drawing ----------
function render() {
  if (!S) { newRun("dates", false); return; }
  $("where").textContent = `${MODES[S.mode]}${S.mode === "quantities" ? `, in ${S.unit}` : ""}${S.daily ? " · today's" : ""} · placed ${S.placed}`;
  $("lives").textContent = "●".repeat(Math.max(0, S.lives)) + "○".repeat(LIVES - Math.max(0, S.lives));
  const next = S.deck[0];
  $("deal").hidden = !next || S.over;
  if (next && !S.over) {
    const q = BY_ID.get(next);
    $("ask").textContent = S.mode === "dates" ? "When? Tap where it goes in your line" : `How much, in ${S.unit}? Tap where it goes`;
    $("card").textContent = cardText(q);
    const pic = $("cardPic");
    pic.hidden = !q.pic;
    if (q.pic) showPicture(pic, q.pic, { width: 330 });
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
    v.textContent = withUnit(q.truth, q); t.textContent = short(c.id);
    li.append(v, t); box.append(li);
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
  body.append(p, action("Another run", () => { $("doneDlg").close(); newRun(S.mode, false); }, "primary"));
  $("doneDlg").showModal();
}
let toastTimer;
function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2600); }

// ---------- the menu ----------
let pick = null;
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pick ??= { mode: S?.mode || "dates", daily: !!S?.daily };
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
if (S?.over) newRun(S.mode, false); else render();
