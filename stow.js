// Stow: a hold to fill. Its manifests (the game since October 2026): every piece of a list goes in, filling the hold
// exactly, one stowage rule more each chapter (the rules and the counter in stow-pack.js, the page's part in
// stow-plan.js, the campaign in stow-manifests.js); and Loose cargo, the game as it was, Block Blast's rules
// (stow-loose.js). Together (a pair, or a party of up to six), everyone stows one manifest, a move at a time round the
// table (stow-room.js). This file keeps your place, the menu, today's manifest, the table, and a hold in decks turning.
import { act, freshPlan } from "./stow-pack.js";
import { CHAPTERS, MANIFESTS } from "./stow-manifests.js";
import { createPlan } from "./stow-plan.js";
import { createLoose, levelButton } from "./stow-loose.js";
import { VIEW, EL_MIN, EL_MAX } from "./stow-3d.js";
import { freshTable, restart, planOf, presentSlots, turnNow, move, levelOf as roomLevel } from "./stow-room.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { GAMES, roomInAddress, otherHere, joiningWords } from "./rooms.js";
import "./pwa.js";
import { part, action, line, choice } from "./menu.js";
import { today, noteStars } from "./suite.js";
import { busy, sextant } from "./loading.js";

const $ = id => document.getElementById(id);
const MODE = "stow:mode", RUN = "stow:plan", PLANS = "stow:plans", DAILY = "stow:daily", DAYPLAN = "stow:dayplan", TURNED = "stow:view";
const APP = 3;                    // this code's version of the together state (3: one manifest shared; 2: Loose cargo's hands)
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const byId = new Map(MANIFESTS.map(l => [l.id, l]));
// the campaign in the order it's played: chapter by chapter, each in its own order (a level added later to a chapter
// comes last in the list of manifests, numbered on in its chapter)
const ORDER = [...MANIFESTS].sort((a, b) => a.chapter - b.chapter || a.n - b.n);
const after = lv => (lv && !lv.day ? ORDER[ORDER.indexOf(byId.get(lv.id)) + 1] || null : null);
const before = lv => ORDER.find(l => l.chapter === lv.chapter && l.n === lv.n - 1);
// until October 2026 today's hold (Loose cargo's) was kept whole here; today's manifest is kept under stow:dayplan
try { localStorage.removeItem("stow:day"); } catch { /* private mode */ }

let mode = read(MODE, "plan") === "loose" ? "loose" : "plan";
let view = { ...VIEW, ...read(TURNED, {}) };
let progress = read(PLANS, {});                                 // { manifestId: { stars, restows } }
let run = null;                                                 // the manifest in play solo: { id, plan, turns }
const inRoom = () => !!together?.room;
const showing = () => (inRoom() ? "plan" : mode);

// ---------- a tap of the phone ----------
// vibrate where there is one; on an iPhone (none), a switch toggled while the finger's down gives the same tap
let tick = null;
function haptic(kind) {
  const pattern = { seat: 8, tight: [12, 50, 18], won: [18, 60, 26, 60, 40] }[kind] || 8;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* not every phone can */ } return; }
  if (!tick) {
    tick = document.createElement("label");
    tick.className = "sw-tick";
    tick.setAttribute("aria-hidden", "true");
    tick.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    tick.addEventListener("click", e => e.stopPropagation());
    document.body.appendChild(tick);
  }
  tick.click();
  tick.firstChild.blur();
}

// ---------- the two modes ----------
const names = {
  level: lv => (lv.day ? "Today's manifest" : `${CHAPTERS.find(c => c.id === lv.chapter)?.title || "Manifest"} · ${lv.n}`),
  result: (done, text) => (inRoom() ? text.replace("Stowed", "Stowed together") : text),
};
const plan = createPlan({
  $, toast, haptic, names,
  view: () => view,
  active: () => showing() === "plan",
  canAct: () => !inRoom() || (!together.room.data?.done && turnNow(S(), present()) === mySlot()),
  commit: m => (inRoom() ? commitRoom(m) : commitSolo(m)),
  turned: turns => { if (!inRoom() && run) { run.turns = [...turns]; saveRun(); } },
  // the result's buttons: Next only where there's a next
  result: () => {
    const n = inRoom() ? after(roomLevel(S())) : nextPlan();
    $("nextBtn").hidden = !n;
    $("retryBtn").textContent = "Again";
    $("retryBtn").className = n ? "sw-go quiet" : "sw-go";
  },
});
const loose = createLoose({ $, read, write, toast, view: () => view, active: () => showing() === "loose", stars: () => noteStars("stow", starsAll()) });
const current = () => (showing() === "loose" ? loose : plan);
const starsAll = () => Object.values(progress).reduce((n, p) => n + (p?.stars || 0), 0) + loose.starsAll();

function enter(m) {
  mode = m;
  $("app").dataset.mode = m;
  if (m === "loose") loose.enter(); else startPlan();
}
/** Back to where you were: your manifest as you left it, else the first you haven't stowed. */
function startPlan() {
  const saved = read(RUN, null), lv = saved && levelFor(saved.id);
  if (lv && saved.plan && saved.sig === sigOf(lv)) { run = saved; plan.show(lv, run.plan, run.turns); return; }
  openPlan(lv || ORDER.find(l => !progress[l.id]?.stars) || ORDER[0]);
}
/** What a manifest is (its hold, cargo and pieces), short: a run kept for one that has since changed starts afresh. */
const sigOf = lv => { let h = 2166136261; for (const ch of JSON.stringify([lv.hold, lv.cargo, lv.plugs, lv.pieces])) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h.toString(36); };
const levelFor = id => (typeof id === "string" && id.startsWith("d") ? (read(DAYPLAN, null)?.level?.id === id ? read(DAYPLAN, null).level : null) : byId.get(id) || null);
const saveRun = () => { if (run) write(RUN, run); };
function openPlan(level) {
  if (!level) return;
  run = { id: level.id, sig: sigOf(level), plan: freshPlan(), turns: null };
  saveRun();
  plan.show(level, run.plan);
}
function commitSolo(m) {
  const L = plan.level, next = act(L, run.plan, m);
  if (!next) { plan.render(); return; }
  const was = run.plan;
  run.plan = next;
  saveRun();
  if (next.done && !was.done) stowed(L, next.done);
  plan.update(next, { move: m });
}
/** A manifest stowed: its stars kept the moment the last piece seats (today's by the day). */
function stowed(L, done) {
  if (L.day) { const d = read(DAILY, {}); if (!(d[L.day] >= done.stars)) { d[L.day] = done.stars; write(DAILY, d); } return; }
  const was = progress[L.id] || {};
  progress[L.id] = { stars: Math.max(was.stars || 0, done.stars), restows: Math.min(was.restows ?? Infinity, done.restows) };
  write(PLANS, progress);
  noteStars("stow", starsAll());
}
const nextPlan = () => after(plan.level);
/** Manifests you can open: each chapter's first, and every one after one you've stowed. */
const isOpen = lv => lv.n === 1 || progress[before(lv)?.id]?.stars > 0 || progress[lv.id]?.stars > 0;

// ---------- today's manifest: made on the device (the worker proves it has one stow), the same everywhere ----------
async function daily() {
  const day = today(), kept = read(DAYPLAN, null);
  if (kept?.day === day && kept.level) return kept.level;
  const done = busy("Loading today's manifest");
  try {
    const level = await new Promise((resolve, reject) => {
      const w = new Worker(new URL("./stow-worker.js", import.meta.url), { type: "module" });
      w.onmessage = e => { w.terminate(); resolve(e.data); };
      w.onerror = e => { w.terminate(); reject(e); };
      w.postMessage({ day });
    });
    if (level) write(DAYPLAN, { day, level });
    return level;
  } finally { done(); }
}
async function playDaily() {
  try {
    const lv = await daily();
    if (!lv) { toast("Couldn't make today's manifest"); return; }
    if (mode !== "plan") { mode = "plan"; write(MODE, mode); $("app").dataset.mode = mode; }
    const saved = read(RUN, null);
    if (saved?.id === lv.id && saved.plan && saved.sig === sigOf(lv)) { run = saved; plan.show(lv, run.plan, run.turns); } else openPlan(lv);
  } catch (e) { console.error(e); toast("Couldn't make today's manifest"); }
}

// ---------- together ----------
const S = () => together.room?.data;
const mySlot = () => together.slot ?? 0;
/** The seats here now (yours always); a player who's away is passed over. */
const present = () => (inRoom() && S() ? presentSlots(S(), together.room.here, together.room.uid) : [0]);
const firstName = name => String(name || "Player").split(" ")[0];
const seatName = slot => seatsOf(S()).find(([, p]) => p.slot === slot)?.[1].name || (slot === mySlot() ? "You" : "Your partner");
function seatChip(name, slot) {
  const b = document.createElement("b");
  b.className = "sw-seat";
  b.style.setProperty("--seat", `var(--p${(slot || 0) % 6})`);
  b.textContent = name;
  return b;
}
/** The line over the hold's tools at a table: whose turn it is, anyone passed over while away; your partner in
 *  another game of the room: where, and a link. */
function drawPartner() {
  const el = $("partner");
  el.hidden = !inRoom();
  if (!inRoom()) return;
  el.replaceChildren();
  if (!together.online) { el.append(sextant(), "Reconnecting…"); return; }
  const g = S(), others = together.others(), people = g?.people || 2;
  if (people === 2) {
    const there = otherHere(together.room.here, together.room.uid, together.room.pid, "stow");
    if (there && there.game !== "stow" && GAMES[there.game]) {
      const a = document.createElement("a");
      a.href = `${GAMES[there.game].page}?room=${together.room.code}`;
      a.textContent = "Join them";
      el.append(seatChip(firstName(there.name), others[0]?.slot ?? 1), ` is in ${GAMES[there.game].name}. `, a);
      return;
    }
  }
  if (!others.length) { el.append(sextant(), people > 2 ? "Waiting for the others to join" : "Waiting for your partner to join"); return; }
  if (!g || g.done) { el.hidden = true; return; }                       // the result says how it went
  const pres = present(), now = turnNow(g, pres), skipped = (g.turn ?? 0) !== now && !pres.includes(g.turn) ? seatsOf(g).find(([, p]) => p.slot === g.turn)?.[1] : null;
  el.append(seatChip(now === mySlot() ? "Your turn" : `${firstName(seatName(now))}'s turn`, now));
  if (skipped) el.append(`: ${firstName(skipped.name)} is away.`);
  else el.append(now === mySlot() ? ": a piece in, or one moved." : "");
}
let joining = null, shownTable = null, seenMoves = 0;          // the table shown (its manifest, when dealt), its moves seen
const seated = () => { joining?.(); joining = null; };
function onState(g) {
  seated();
  const level = roomLevel(g), key = `${g.id}/${g.created}`;
  $("app").dataset.mode = "plan";
  if (shownTable !== key) {
    shownTable = key;
    seenMoves = g.moves || 0;
    plan.show(level, planOf(g));                                            // the tray's turns are each phone's own
  } else {
    const fresh = (g.moves || 0) > seenMoves;
    seenMoves = g.moves || 0;
    plan.update(planOf(g), fresh && g.last ? { move: g.last } : {});
  }
  drawPartner();
}
async function commitRoom(m) {
  const slot = mySlot(), pres = present();
  if (!(await together.act(g => move(g, slot, m, pres)))) plan.render();
}
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
// a new table starts at your manifest (today's is yours alone: the first you haven't stowed, then)
const tableLevel = () => (plan.level && !plan.level.day ? plan.level : ORDER.find(l => !progress[l.id]?.stars) || ORDER[0]);
const together = createTogether({
  game: "stow",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 2 && byId.has(g.id),
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => freshTable(tableLevel(), players, { app: APP, ask }),
  onState,
  onPresence: () => { if (S()) { drawPartner(); plan.render(); } },        // someone away is passed over
  onLeave: () => { seated(); shownTable = null; enter(mode); },
  result: g => (g.done ? { match: `${g.id}-${g.created}`, score: g.done.restows ?? g.restows ?? 0, won: true, coop: true, lower: true } : null),
});

// ---------- the menu ----------
let toastTimer = null;
function toast(msg, ms = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openMenu() {
  const body = $("menuBody"), close = () => $("menuDlg").close();
  body.replaceChildren();
  if (inRoom()) {
    // at a table, a new manifest is everyone's: asked first while this one is under way
    const pick = lv => () => {
      const g = S();
      if (g && Object.keys(g.placed || {}).length && !g.done && !confirm("Start a new manifest for everyone at the table? This one isn't stowed.")) return;
      together.act(t => restart(t, lv));
    };
    part(body, "together").append(action("Start this manifest again", pick(plan.level), "primary"), action("Back to solo", () => together.leave(), "link"));
    part(body, "content").append(campaign(lv => { close(); pick(lv)(); }, () => false));
  } else {
    part(body, "content").append(choice("Cargo", [["plan", "Manifests"], ["loose", "Loose cargo"]], mode, m => { write(MODE, m); enter(m); openMenu(); }));
    if (mode === "loose") loose.menu(body, close);
    else {
      const p = part(body, "play"), next = nextPlan(), done = plan.plan?.done;
      if (done && next) p.append(action(`Next: ${names.level(next)}`, () => openPlan(next), "primary"));
      p.append(action(done ? "Stow it again" : "Start this manifest again", () => openPlan(plan.level), done && next ? "" : "primary"));
      p.append(action("Today's manifest", playDaily));
      part(body, "content").append(campaign(lv => { close(); openPlan(lv); }, lv => !isOpen(lv)));
    }
  }
  const day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${starsAll()} of ${(MANIFESTS.length * 3) + loose.total} stars${day ? ` · today's ${"★".repeat(day)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The manifests, chapter by chapter, with their stars. */
function campaign(go, locked) {
  const list = document.createElement("div");
  list.className = "sw-levels";
  for (const ch of CHAPTERS) {
    const h = document.createElement("p"), row = document.createElement("div");
    h.className = "sw-chapter"; h.textContent = ch.title;
    row.className = "sw-row";
    for (const lv of ORDER.filter(l => l.chapter === ch.id)) row.appendChild(levelButton(lv, ch, progress[lv.id]?.stars || 0, plan.level && lv.id === plan.level.id, locked(lv), () => go(lv), !!lv.hold.decks));
    list.append(h, row);
  }
  return list;
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "stow");
document.querySelector(".sw-mark").innerHTML = APPS.find(a => a.id === "stow").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("retryBtn").addEventListener("click", () => {
  if (inRoom()) together.act(g => restart(g, roomLevel(g)));
  else if (showing() === "loose") loose.again();
  else openPlan(plan.level);
});
$("nextBtn").addEventListener("click", () => {
  if (showing() === "loose") { loose.next(); return; }
  const n = inRoom() ? after(roomLevel(S())) : nextPlan();
  if (!n) return;
  if (inRoom()) together.act(g => restart(g, n)); else openPlan(n);
});
$("board").addEventListener("click", e => { if (showing() === "loose" && !loose.scene) loose.tap(e); });
// A hold in decks turns: a drag across it turns it round, a drag up or down tilts it, the arrows turn it an eighth; a
// tap that doesn't drag puts Loose cargo's picked piece down, or lifts a stowed manifest's hatch. The turn is kept
// (stow:view) once you let go.
let turning = null, queued = 0;
function turnBy(dir) {
  const scene = current().scene;
  if (turning || current().busy || !scene) return;
  const from = view.az, to = from + 45 * dir, t0 = performance.now() - (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1e6 : 0);
  const step = now => {
    const k = Math.min(1, (now - t0) / 260), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    view = { ...view, az: Math.round((((from + (to - from) * e) % 360) + 360) % 360) };
    scene.setCam(view);
    current().redraw();
    if (k < 1) requestAnimationFrame(step); else write(TURNED, view);
  };
  requestAnimationFrame(step);
}
$("board").addEventListener("pointerdown", e => {
  const scene = current().scene;
  if (!scene || e.button > 0 || current().busy) return;
  const arrow = e.target.closest?.(".turn");
  if (arrow) { e.preventDefault(); turnBy(+arrow.dataset.turn); return; }
  turning = { id: e.pointerId, x0: e.clientX, y0: e.clientY, az: view.az, el: view.el, moved: false };
  try { $("board").setPointerCapture(e.pointerId); } catch { /* synthetic */ }
});
$("board").addEventListener("pointermove", e => {
  if (!turning || e.pointerId !== turning.id) return;
  const dx = e.clientX - turning.x0, dy = e.clientY - turning.y0;
  if (!turning.moved && Math.hypot(dx, dy) < 8) return;
  turning.moved = true;
  view = { az: Math.round(((turning.az - dx * 0.45) % 360 + 360) % 360), el: Math.round(Math.max(EL_MIN, Math.min(EL_MAX, turning.el + dy * 0.3))) };
  current().scene?.setCam(view);
  queued ||= requestAnimationFrame(() => { queued = 0; current().redraw(); });
});
const endTurn = e => {
  if (!turning || e.pointerId !== turning.id) return;
  const was = turning;
  turning = null;
  if (was.moved) write(TURNED, view);
  else if (e.type === "pointerup") { if (showing() === "loose") loose.tap(e); else plan.peek(); }
};
$("board").addEventListener("pointerup", endTurn);
$("board").addEventListener("pointercancel", endTurn);
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
addEventListener("resize", () => { if (!current().busy) current().redraw(); });

// for tests and debugging
window.__stow = {
  get mode() { return showing(); }, get plan() { return plan; }, get loose() { return loose; }, get together() { return together; }, MANIFESTS,
  enter, openPlan, commit: m => (inRoom() ? commitRoom(m) : commitSolo(m)),
  get turn() { return inRoom() && S() ? turnNow(S(), present()) : null; }, get mine() { return mySlot(); },
};

$("app").dataset.mode = mode;
enter(mode);
noteStars("stow", starsAll());
// Opened for a duo match or a party's table: the rete covers your own hold while you sit down (a new manifest starts at
// yours), so nothing's stowed in it by mistake; it waits as you left it, for Back to solo.
const code = roomInAddress();
if (code) {
  joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { if (!ok) seated(); });
}
