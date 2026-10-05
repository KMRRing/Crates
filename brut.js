// Brut: wine. Blind: a flight of six classic wines, the tasting note revealed stage by stage; name the wine from
// six candidates as early as you dare. Study: the wine bank's cards, each a fact to learn and then a question, on
// the pile. A wine you couldn't name until the palate goes to the pile too.
import { WINES } from "./brut-data.js";
import { STAGES, BASE, WRONG, FLIGHT, points, pickFlight, optionsFor, noteText, SWEET, LEVEL, byId } from "./brut-engine.js";
import { STAGES as UNITS, MATHS as CARDS } from "./wine-bank.js";
import * as pile from "./pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";

dropdown(document.getElementById("mode"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
const SAVE = "brut:save";
const NEW_A_DAY = 15, REVIEW_CAP = 30;
let P = read(SAVE, { mode: "blind", grapes: true, flight: null, best: {}, daily: {}, met: [], day: null });
let session = null;    // study session: { items, at, right, wrong }

function read(key, fallback) { try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return fallback; } }
function save() { try { localStorage.setItem(SAVE, JSON.stringify(P)); } catch { /* private mode */ } }
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (r, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };

// ---------- the glass ----------
function mix(hex, toward, k) {
  const a = hex.match(/\w\w/g).map(h => parseInt(h, 16)), b = toward.match(/\w\w/g).map(h => parseInt(h, 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}
function glassSvg(w) {
  const core = w.hue, rim = /orange rim|garnet/i.test(w.sight) ? mix(w.hue, "#c8743a", 0.45) : /magenta/i.test(w.sight) ? mix(w.hue, "#c0307a", 0.5) : mix(w.hue, "#ffffff", w.colour === "white" ? 0.45 : 0.3);
  const bubbles = w.sparkling ? Array.from({ length: 9 }, (_, i) => `<circle class="bubble" cx="${44 + (i * 7) % 34}" cy="${96 - (i % 3) * 6}" r="${1.2 + (i % 3) * 0.5}" style="animation-delay:${(i * 0.27).toFixed(2)}s"/>`).join("") : "";
  return `<svg viewBox="0 0 120 170" aria-label="${w.colour} wine">
    <defs><clipPath id="br-bowl"><path d="M28 16 C26 70 40 98 60 100 C80 98 94 70 92 16 Z"/></clipPath>
    <linearGradient id="br-wine" x1="0" x2="1"><stop offset="0" stop-color="${rim}"/><stop offset=".28" stop-color="${core}"/><stop offset=".72" stop-color="${core}"/><stop offset="1" stop-color="${rim}"/></linearGradient></defs>
    <g clip-path="url(#br-bowl)"><rect x="20" y="52" width="80" height="60" fill="url(#br-wine)"/><ellipse cx="60" cy="52" rx="31" ry="3.2" fill="${rim}" opacity=".9"/>${bubbles}</g>
    <path d="M28 16 C26 70 40 98 60 100 C80 98 94 70 92 16 Z" fill="rgba(255,255,255,.07)" stroke="var(--ink-soft)" stroke-width="2"/>
    <line x1="60" y1="100" x2="60" y2="150" stroke="var(--ink-soft)" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="60" cy="152" rx="26" ry="5" fill="none" stroke="var(--ink-soft)" stroke-width="2.5"/></svg>`;
}

// ---------- blind ----------
function newFlight(daily) {
  const seed = daily ? today() : Math.floor(Math.random() * 2 ** 31);
  P.flight = { seed, daily, wines: pickFlight(seed), at: 0, stage: 0, struck: [], scores: [], done: false };
  save();
  drawBlind();
}
const F = () => P.flight;
const wine = () => byId.get(F().wines[F().at]);
function drawBlind() {
  if (!F()) { newFlight(false); return; }
  const f = F(), w = wine(), settled = f.scores.length > f.at;
  $("flightPos").textContent = `${f.daily ? "Today's flight" : "Flight"} · wine ${f.at + 1} of ${FLIGHT}`;
  $("score").textContent = String(f.scores.reduce((a, b) => a + b, 0));
  $("stages").replaceChildren(...STAGES.map((s, i) => { const li = el("li", i < f.stage || settled ? "done" : i === f.stage ? "now" : ""); li.append(s, el("small", null, settled ? "" : `${BASE[i]}`)); return li; }));
  $("glass").innerHTML = glassSvg(w);
  drawNote(w, settled ? 3 : f.stage);
  const opts = optionsFor(w, f.seed + f.at);
  $("options").replaceChildren(...opts.map(id => {
    const x = byId.get(id), b = el("button", "br-option");
    b.type = "button";
    b.append(el("b", null, x.name), el("span", null, P.grapes ? `${x.grape} · ${x.region}` : x.region));
    if (f.struck.includes(id)) b.classList.add("struck");
    if (settled && id === w.id) b.classList.add("right");
    b.disabled = settled || f.struck.includes(id);
    b.addEventListener("click", () => call(id));
    return b;
  }));
  $("tasteBtn").hidden = settled || f.stage >= STAGES.length - 1;
  $("tasteBtn").textContent = `Taste further: ${STAGES[f.stage + 1] || ""}`;
  $("nextBtn").hidden = !settled;
  $("nextBtn").textContent = f.at + 1 < FLIGHT ? "Next wine" : "See the flight";
  const line = $("line");
  if (settled) { line.className = "br-line good"; line.textContent = `${w.name}: +${f.scores[f.at]}. ${w.tell}`; }
  else if (!f.struck.length) { line.className = "br-line"; line.textContent = f.stage === 0 ? "Look at it. Name it now for 100, or taste further." : `Worth ${points(f.stage, 0)} if you name it now.`; }
}
function drawNote(w, upto) {
  const box = $("note");
  box.replaceChildren();
  const section = (title, body) => { const d = el("div"); d.append(el("b", null, title), body); box.appendChild(d); };
  section("Sight", el("div", null, w.sight));
  if (upto >= 1) { const t = el("div", "tags"); t.append(...w.nose.map(n => el("span", null, n))); section("Nose", t); }
  else section("Nose", el("div", "faded", "…"));
  if (upto >= 2) {
    const s = el("div", "struct");
    const row = (label, v, text) => { s.append(el("span", null, label), el("span", "dots", text ?? `${"●".repeat(v)}${"○".repeat(5 - v)}`)); };
    row("Sweetness", 0, SWEET[w.sweet]);
    row("Acidity", w.acid);
    if (w.colour !== "white") row("Tannin", w.tannin);
    row("Alcohol", w.alc);
    row("Body", w.body);
    row("Finish", 0, w.finish);
    section("Palate", s);
  } else section("Palate", el("div", "faded", "…"));
  if (upto >= 3) section("Conclusions", el("div", null, `${w.world}; ${w.climate} climate; ${w.oak}.`));
}
function taste() { const f = F(); if (f.stage < STAGES.length - 1) { f.stage++; save(); drawBlind(); } }
function call(id) {
  const f = F(), w = wine();
  if (f.scores.length > f.at) return;
  if (id === w.id) {
    const pts = points(f.stage, f.struck.length);
    f.scores.push(pts);
    // the pile: a wine you needed the palate for, or called wrong, comes back in Study and Deck
    const right = f.stage < 2 && f.struck.length === 0;
    if (!right) pile.record("brut", `blind:${w.id}`, blindPayload(w, f.seed + f.at), "miss");
    else if (pile.has("brut", `blind:${w.id}`)) pile.answer("brut", `blind:${w.id}`, true);
    save();
    drawBlind();
    return;
  }
  f.struck.push(id);
  save();
  drawBlind();
  const line = $("line");
  line.className = "br-line bad";
  line.textContent = `Not ${byId.get(id).name}: −${WRONG}. ${f.stage < STAGES.length - 1 ? "Call again or taste further." : "Call again."}`;
  navigator.vibrate?.(40);
}
/** A missed wine as a review card: the full note, four candidates. */
function blindPayload(w, seed) {
  const opts = optionsFor(w, seed).slice(0, 4);
  if (!opts.includes(w.id)) opts[3] = w.id;
  const names = shuffle(rng(seed), opts.map(id => byId.get(id).name));
  return { prompt: noteText(w), ask: "Brut · name the wine", options: names, right: [names.indexOf(w.name)], need: 1, note: `${w.name} (${w.grape}, ${w.region}): ${w.tell}` };
}
function nextWine() {
  const f = F();
  if (f.at + 1 < FLIGHT) { f.at++; f.stage = 0; f.struck = []; save(); drawBlind(); return; }
  if (!f.done) {
    f.done = true;
    const total = f.scores.reduce((a, b) => a + b, 0), key = f.daily ? "daily" : "flight";
    P.best[key] = Math.max(P.best[key] || 0, total);
    if (f.daily) P.daily[today()] = Math.max(P.daily[today()] || 0, total);
    save();
  }
  showFlight();
}
function showFlight() {
  const f = F(), total = f.scores.reduce((a, b) => a + b, 0);
  $("doneTitle").textContent = f.daily ? "Today's flight" : "The flight";
  const body = $("doneBody");
  body.replaceChildren(el("p", "br-big", `${total}`), el("p", "stats", `of ${FLIGHT * 100}. Your best ${f.daily ? "on today's flight" : "flight"}: ${P.best[f.daily ? "daily" : "flight"] || total}.`));
  const list = el("ol", "br-flight");
  f.wines.forEach((id, i) => { const w = byId.get(id), li = el("li"); li.append(el("b", null, w.name), el("span", null, `+${f.scores[i] ?? 0}`), el("small", null, `${w.grape} · ${w.region}. ${w.tell}`)); list.appendChild(li); });
  body.appendChild(list);
  const again = el("button", "btn primary wide", "Another flight");
  again.type = "button";
  again.addEventListener("click", () => { $("doneDlg").close(); newFlight(false); });
  body.appendChild(again);
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- study ----------
const cardById = new Map(CARDS.map(c => [c.id, c]));
const unitName = Object.fromEntries(UNITS.map(u => [u.id, u.label]));
const met = () => new Set(P.met || []);
const newToday = () => (P.day?.d === today() ? P.day.n : 0);
function studyHome() {
  $("studyHome").hidden = false; $("studyCard").hidden = true;
  const m = met(), due = pile.due("brut").length;
  $("stats").replaceChildren(...[[m.size, "cards met", false], [due, "due now", true], [Math.max(0, NEW_A_DAY - newToday()), "new left today", false]].map(([v, label, hot]) => {
    const d = el("div"), b = el("b", hot && v ? "due" : "", String(v)); d.append(b, el("span", null, label)); return d;
  }));
  const next = UNITS.find(u => CARDS.some(c => c.lv === u.id && !m.has(c.id)));
  $("studyBtn").textContent = due ? `Study: ${Math.min(due, REVIEW_CAP)} due${newToday() < NEW_A_DAY && next ? `, then ${next.label}` : ""}` : newToday() < NEW_A_DAY && next ? `Study: ${next.label}` : "Nothing due: come back later";
  $("studyBtn").disabled = !due && (newToday() >= NEW_A_DAY || !next);
  $("units").replaceChildren(...UNITS.map(u => {
    const cards = CARDS.filter(c => c.lv === u.id), metHere = cards.filter(c => m.has(c.id)).length;
    const row = el("div", "br-unit"), left = el("div");
    left.append(el("b", null, u.label), el("small", null, `${metHere} of ${cards.length} cards`));
    const bar = el("div", "bar"); bar.innerHTML = `<i style="width:${metHere / cards.length * 100}%"></i>`; left.appendChild(bar);
    const b = el("button", null, metHere < cards.length ? "Study" : "Done ✓"); b.type = "button";
    b.disabled = metHere === cards.length && !pile.due("brut").some(it => cardById.get(it.key.replace("card:", ""))?.lv === u.id);
    b.addEventListener("click", () => startStudy(u.id));
    row.append(left, b);
    return row;
  }));
}
function startStudy(unit = null) {
  const m = met();
  const items = pile.due("brut").slice(0, REVIEW_CAP).map(it => (it.key.startsWith("card:") ? { kind: "drill", card: cardById.get(it.key.slice(5)), key: it.key } : { kind: "wine", payload: it.payload, key: it.key })).filter(x => x.card || x.payload);
  const pick = unit || UNITS.find(u => CARDS.some(c => c.lv === u.id && !m.has(c.id)))?.id;
  const fresh = newToday() < NEW_A_DAY && pick ? CARDS.filter(c => c.lv === pick && !m.has(c.id)).slice(0, NEW_A_DAY - newToday()).map(c => ({ kind: "learn", card: c, key: `card:${c.id}` })) : [];
  if (!items.length && !fresh.length) { toast(unit ? "That unit's cards are all met; nothing due there now." : "Nothing to study right now."); return; }
  session = { items: [...items, ...fresh], at: 0, right: 0, wrong: 0 };
  $("studyHome").hidden = true; $("studyCard").hidden = false;
  showItem();
}
function showItem() {
  const it = session.items[session.at];
  if (!it) { finishStudy(); return; }
  $("studyPos").textContent = `${session.at + 1} of ${session.items.length}`;
  $("verdict").textContent = ""; $("verdict").className = "br-verdict";
  $("explain").textContent = "";
  $("studyNext").hidden = true;
  const card = $("card"), box = $("answers");
  card.replaceChildren(); box.replaceChildren();
  if (it.kind === "learn") {
    const c = it.card;
    $("studyKind").textContent = `New · ${unitName[c.lv]}`;
    card.append(el("div", "fact", c.fact), el("div", null, c.x));
    const go = el("button", "br-go", "Got it: test me"); go.type = "button";
    go.addEventListener("click", () => {
      pile.add("brut", it.key, { prompt: c.q, ask: `Brut · ${unitName[c.lv]}`, options: c.o, right: c.a, need: 1, note: `${c.fact} ${c.x}` });
      P.met = [...met(), c.id];
      P.day = P.day?.d === today() ? { d: today(), n: P.day.n + 1 } : { d: today(), n: 1 };
      save();
      it.kind = "drill";
      showItem();
    });
    box.appendChild(go);
    return;
  }
  if (it.kind === "drill") {
    const c = it.card;
    $("studyKind").textContent = unitName[c.lv];
    card.append(el("div", "q", c.q));
    options(c.o, c.a[0], `${c.fact} ${c.x}`, it);
    return;
  }
  const p = it.payload;   // a wine missed in Blind
  $("studyKind").textContent = "Name the wine";
  card.append(el("div", "ask", "From the tasting note:"), el("div", null, p.prompt));
  options(p.options, p.right[0], p.note, it);
}
function options(labels, right, note, it) {
  const box = $("answers");
  const buttons = labels.map((label, i) => {
    const b = el("button", "br-option", label); b.type = "button";
    b.addEventListener("click", () => {
      buttons.forEach((x, k) => { x.disabled = true; if (k === right) x.classList.add("right"); else if (k === i) x.classList.add("wrong"); });
      const ok = i === right, after = pile.answer("brut", it.key, ok);
      session[ok ? "right" : "wrong"]++;
      $("verdict").className = `br-verdict ${ok ? "good" : "bad"}`;
      $("verdict").textContent = ok ? (after?.learned ? "Right: learned." : "Right.") : "Not quite: it'll be back.";
      $("explain").textContent = note;
      $("studyNext").hidden = false;
      $("studyNext").textContent = session.at + 1 < session.items.length ? "Next" : "Finish";
    });
    return b;
  });
  box.replaceChildren(...buttons);
}
function finishStudy() {
  const s = session; session = null;
  studyHome();
  if (s) toast(`${s.right} right, ${s.wrong} wrong.`, 3500);
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = el(tag, cls, text); body.appendChild(n); return n; };
  const button = (text, fn) => { const b = add("button", "btn wide", text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  if (P.mode === "blind") {
    add("p", "stats", `Blind: a flight of ${FLIGHT} classic wines. You see the wine; taste further for the nose, the palate and the taster's conclusions. Name it from six candidates: ${BASE.join(", ")} points at each stage, ${WRONG} off for each wrong call. A wine you needed the palate for goes to the pile, and comes back in Study. ${WINES.length} wines in all, from Chablis to Vintage Port.`);
    button("A new flight", () => newFlight(false));
    button("Today's flight", () => newFlight(true));
    const g = add("button", "btn wide", `Grapes on the candidates: ${P.grapes ? "shown" : "hidden"}`); g.type = "button";
    g.addEventListener("click", () => { P.grapes = !P.grapes; save(); $("menuDlg").close(); drawBlind(); });
    add("p", "stats", `Best flight ${P.best.flight || "–"}; best today's flight ${P.best.daily || "–"}${P.daily[today()] != null ? ` (today ${P.daily[today()]})` : ""}.`);
  } else {
    add("p", "stats", `Study: ${CARDS.length} cards in ${UNITS.length} units. A new card shows a fact, then asks a question on it; the pile brings back what you miss, with the wines you couldn't name in Blind. Up to ${NEW_A_DAY} new cards a day. The same cards make the Wine level in Punt.`);
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function setMode(m) {
  P.mode = m; save();
  $("mode").value = m;
  $("blind").hidden = m !== "blind";
  $("study").hidden = m !== "study";
  if (m === "blind") drawBlind(); else studyHome();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "brut");
document.querySelector(".br-mark").innerHTML = APPS.find(a => a.id === "brut").logo;
$("mode").addEventListener("change", e => setMode(e.target.value));
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("tasteBtn").addEventListener("click", taste);
$("nextBtn").addEventListener("click", nextWine);
$("studyBtn").addEventListener("click", () => startStudy());
$("studyNext").addEventListener("click", () => { session.at++; showItem(); });
window.__brut = { get flight() { return P.flight; }, get wine() { return P.flight && wine(); }, call, taste, newFlight, startStudy, setMode, get session() { return session; } };
setMode(P.mode === "study" ? "study" : "blind");
