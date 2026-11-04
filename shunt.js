// Shunt: shove gears onto a hexagonal plate from its rim and make trains of meshing gears (README, Idle; docs/shunt.md). The rules are
// shunt-engine.js's, the search that gives the Hint and rates a plate is shunt-bots.js's, the plates are shunt-levels.js's and
// the picture is shunt-view-2d.js's (a three-dimensional view can take its place: this file keeps the game and maps touches to moves,
// and never draws). Three modes (the menu's Mode): Levels (twelve plates, each opening the next, the first eight coached),
// Random (a fresh plate by difficulty) and Daily (today's plate, the same for everyone).
// A touch on a lever previews its shove; the same lever again (or Shove) makes it; sliding a finger over the levers shows each in
// turn. A game is the plate and its list of moves (-1 swaps, e shoves at entry e): that is all that is kept, as `shunt:run` (Levels),
// `shunt:rrun` (Random) or `shunt:drun` (Daily), so a partner watching draws the same plate from the same keys.
import { play, swap, shove, judge, goalCheck, effect, over, canSwap, legal, legalEntries, ENTRIES } from "./shunt-engine.js";
import { search } from "./shunt-bots.js";
import { LEVELS, COACHED, DIFFS, DIFF_NAMES, goalWords, randomPlate, dailyPlate, rating } from "./shunt-levels.js";
import { createView } from "./shunt-view-2d.js";
import { bindSwitcher } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, choice, onPause } from "./menu.js";
import { sure } from "./sure.js";
import { busy } from "./loading.js";
import { roundOver } from "./random.js";
import { IN_FRAME, today, arrivedForToday } from "./suite.js";
import { KEYS, RUN_KEY, keeper, migrate, readMode, readDiff, readCoach, readSeen, readDaily, readSel, readCamp, savedRun as savedRunOf } from "./shunt-keep.js";

const $ = id => document.getElementById(id);
// MODE: "levels", "random" or "daily". CAMP: { at (the level being played, 0 on), stars (the most won in each) }. BEST: stars won in all, the figure the
// games screen shows. RUN, RRUN, DRUN: the game of each mode (plate and moves). DAILY: the score of each day's plate, by the day (YYYYMMDD).
// SEL: the lever being previewed, so a partner sees it. COACH: coach lines on or off. DIFF: Random's difficulty. SEEN: terms already explained.
// Everything is read through shunt-keep.js, which drops (that key only) what is not a value this build made.
const MODE = KEYS.mode, CAMP = KEYS.camp, BEST = KEYS.best, RRUN = KEYS.rrun, DRUN = KEYS.drun, DAILY = KEYS.daily, SEL = KEYS.sel, COACH = KEYS.coach, DIFF = KEYS.diff, SEEN = KEYS.seen;
const kp = keeper(localStorage, IN_FRAME), { write } = kp;
const fmt = v => String(Math.round(v * 10) / 10);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const starStr = n => "★".repeat(n) + "☆".repeat(3 - n);

if (!IN_FRAME) migrate(kp);

const view = createView({ board: $("board"), tray: $("tray") });

let mode = readMode(kp);
let camp = readCamp(kp);
let diff = readDiff(kp);
let coachOn = readCoach(kp);
let spec = null;            // the plate being played: stud, jewels, start, deal, goal, stars (+ id, no, name, sol for a level)
let run = null;             // { kind, n | seed, diff | day, moves, spec? }
let S = null;               // the state now (the plate after its moves)
let pv = null;              // the shove being previewed: { e, before, s, moved, at, swapFirst }
let done = false, animating = false;
let hintInfo = null, thinking = 0, hintTok = 0, hints = 0;
let note = "", offer = false, undoStreak = 0;
let pulse = null;           // the coach's pulse: { e } (a lever) or { hold: true }
let demoE = -1, demoSeen = false;
let seen = readSeen(kp);
let epoch = 0;              // a new plate or level makes what a search or an animation was about to do void

// ---------- keeping ----------
function keepCamp() { write(CAMP, camp); write(BEST, camp.stars.reduce((a, b) => a + b, 0)); }
const isOpen = n => n === 0 || camp.stars[n - 1] >= 1;
const keyOf = () => RUN_KEY[mode];
const keepRun = () => write(keyOf(), { v: 1, ...run, hints, at: Date.now() });
const keepSel = () => write(SEL, pv ? { e: pv.e, swap: pv.swapFirst ? 1 : 0 } : null);

/** The mode's saved run, or null (and its key dropped) if it is not one this build made and can draw. */
const savedRun = () => savedRunOf(kp, mode, camp.at, today());
/** The plate of a run: a level's from the levels, the others' kept with the run (their goal came from a search). */
const specOf = r => (r.kind === "level" ? LEVELS[r.n] : r.spec);

// ---------- the plate in play ----------
function enter(r, sp) {
  epoch++;
  run = r; spec = sp;
  hints = r.hints || 0;
  S = play(spec, run.moves);
  pv = null; hintInfo = null; thinking = 0; hintTok++; note = ""; offer = false; undoStreak = 0; pulse = null;
  done = over(S);
  demoE = -1; demoSeen = run.moves.length > 0;
  const kept = readSel(kp);
  if (!done && kept && Number.isInteger(kept.e) && kept.e >= 0 && kept.e < ENTRIES.length) {
    const before = kept.swap ? (canSwap(S) ? swap(S) : null) : S, r2 = before && legal(before, kept.e) ? shove(before, kept.e) : null;
    if (r2) pv = { e: kept.e, before, s: r2.s, moved: r2.moved, at: r2.at, swapFirst: !!kept.swap };
  }
  keepRun();
  coachFor();
  render();
}
function playLevel(n) {
  camp.at = Math.max(0, Math.min(LEVELS.length - 1, n));
  keepCamp();
  write(SEL, null);
  mode = "levels";
  write(MODE, mode);
  const r = savedRun();
  enter(r || { kind: "level", n: camp.at, moves: [] }, LEVELS[camp.at]);
}
/** A plate rated by the beam search (with the mark showing), then played. */
async function rated(plate, diffName) {
  const t = ++epoch, finish = busy("Setting the plate");
  try {
    const sr = rating(plate, diffName);
    await new Promise(res => { const tick = () => { if (sr.step(25)) res(); else setTimeout(tick, 0); }; tick(); });
    return t === epoch ? sr.result() : null;
  } finally { finish(); }
}
async function newRandom() {
  const plate = randomPlate(Math.floor(Math.random() * 2 ** 31), diff), sp = await rated(plate, diff);
  if (!sp) return;
  write(SEL, null);
  enter({ kind: "random", seed: plate.seed, diff, spec: sp, moves: [] }, sp);
}
async function newDaily() {
  const day = today(), plate = dailyPlate(day), sp = await rated(plate, "hard");
  if (!sp) return;
  write(SEL, null);
  enter({ kind: "daily", day, spec: sp, moves: [] }, sp);
}
/** The mode's game as it was left, or a new one. */
async function resume() {
  const r = savedRun();
  if (mode === "levels") { enter(r || { kind: "level", n: camp.at, moves: [] }, LEVELS[camp.at]); return; }
  if (r) { enter(r, specOf(r)); return; }
  if (mode === "random") await newRandom(); else await newDaily();
}
async function setMode(next) {
  if (next === mode) return;
  mode = next;
  write(MODE, mode);
  write(SEL, null);
  await resume();
}

// ---------- reading the plate ----------
const goal = () => spec.goal;
function starsFor(score, ok) {
  if (Object.keys(goal()).length && !ok) return 0;
  return 1 + (score >= spec.stars[0] ? 1 : 0) + (score >= spec.stars[1] ? 1 : 0);
}
const nextStar = n => spec.stars[n - 1];
const levelNo = () => (run.kind === "level" ? spec.no : 0);
const nameOf = () => (run.kind === "level" ? `<b>${spec.no}</b> ${spec.name}` : run.kind === "random" ? `<b>Random</b> ${DIFF_NAMES[run.diff]}` : `<b>Daily</b> ${dateWords(run.day)}`);
const dateWords = d => `${String(d % 100).padStart(2, "0")}/${String(Math.floor(d / 100) % 100).padStart(2, "0")}/${Math.floor(d / 10000)}`;
const coached = () => run.kind === "level" && levelNo() <= COACHED;
const DEFS = {
  train: "A train is a chain of touching gears that mesh; three or more score.",
  shear: "Shear: a shove slides a whole line, so gears can slip away from their neighbours and a train breaks.",
  jam: "A jam: gears touching in an odd ring cannot all turn, so the whole train locks and scores nothing.",
  bridge: "A bridge is one gear showing two pitches: it meshes both, so it joins their trains into one.",
  idler: "An idler (grey) meshes with every pitch.",
};
function define(term) {
  if (seen.has(term)) return "";
  seen.add(term);
  write(SEEN, [...seen]);
  return `<span class="def">${DEFS[term]}</span>`;
}
const PITCHES = ["gold", "blue", "violet"];
function colourName(t, st) {
  const cnt = [0, 0, 0];
  t.cells.forEach(c => { const g = st.cells[c]; if (g <= 2) cnt[g]++; });
  const m = Math.max(...cnt);
  return m === 0 ? "grey" : PITCHES[cnt.indexOf(m)];
}
/** What the previewed shove would do, in words: gears pushed, trains broken or joined, jams, the score. */
function effectOf(p) {
  const E = effect(p.before, { s: p.s, moved: p.moved, at: p.at }), bits = [];
  let tone = "", defs = "";
  bits.push(E.moved === 0 ? "Lands in an empty cell." : `Pushes <b>${E.moved}</b> gear${E.moved > 1 ? "s" : ""} one step.`);
  E.broken.forEach(t => { bits.push(`<b class="r">Breaks</b> the ${colourName(t, p.before)} train of ${t.n} (shear).`); defs += define("shear"); tone = "bad"; });
  E.joined.forEach(j => { bits.push(`Joins trains (${j.from.map(t => t.n).join(" + ")}) into one of ${j.t.n}.`); defs += define("train"); });
  if (E.newJams > 0) { bits.push(`<b class="r">Jams</b> a train of ${E.B.comps.filter(t => t.jam).sort((a, b) => b.n - a.n)[0].n}: it locks and scores nothing.`); defs += define("jam"); tone = "bad"; }
  else if (E.B.jams === 0) bits.push("Jams nothing.");
  const d = E.B.score - E.A.score;
  bits.push(`Score ${fmt(E.A.score)} → <b class="${d > 0 ? "g" : d < 0 ? "r" : ""}">${fmt(E.B.score)}</b>.`);
  if (!tone && d > 0) tone = "good";
  return { html: bits.join(" ") + defs, tone: goalCheck(p.s, E.B).ok && !tone ? "good" : tone, E };
}
function dropNote(before, r) {
  const E = effect(before, r), a = E.A.score, b = E.B.score;
  if (b >= a) return "";
  const why = E.broken.map(t => `broke the ${colourName(t, before)} train of ${t.n}`);
  if (E.newJams > 0) why.push("jammed a train");
  return `Score ${fmt(a)} → ${fmt(b)}: the shove ${why.join(" and ") || "split a train"}.`;
}

// ---------- the coach ----------
/** The lever or the cradle the coach would have pressed now: a level's own demonstration, or the best line (the stored one while you follow it). */
function coachFor() {
  pulse = null;
  if (done || IN_FRAME || !coachOn || run.kind !== "level") return;
  const lv = spec, k = run.moves.length;
  if (lv.demo && !demoSeen && k === 0) {
    const e = demoEntry(lv.demo);
    if (e >= 0) { demoE = e; pulse = { e }; }
    return;
  }
  if (lv.swap && k === 0 && lv.sol[0] === -1) { pulse = { hold: true }; return; }
  if (lv.guide) {
    if (lv.sol.length > k && lv.sol.slice(0, k).every((m, i) => m === run.moves[i])) { const m = lv.sol[k]; pulse = m === -1 ? { hold: true } : { e: m }; return; }
    quietSearch();
  }
}
/** The first lever whose shove shows a shear that costs score, or a jam. */
function demoEntry(kind) {
  const s0 = S;
  for (const e of legalEntries(s0)) {
    const E = effect(s0, shove(s0, e));
    if (kind === "shear" ? E.broken.length && E.B.score < E.A.score : E.newJams > 0) return e;
  }
  return -1;
}
function quietSearch() {
  const tok = hintTok, ep = epoch, sr = search(S, 120);
  const tick = () => {
    if (tok !== hintTok || ep !== epoch) return;
    if (!sr.step(14)) return void setTimeout(tick, 0);
    const r = sr.result();
    if (r.ok && r.first) { pulse = r.first[0] ? { hold: true } : { e: r.first[1] }; render(); }
  };
  setTimeout(tick, 0);
}
function coachLine() {
  const lv = spec;
  if (run.kind !== "level") return lv.tip || "";
  if (coachOn && lv.coach) return lv.coach[Math.min(run.moves.filter(m => m !== -1).length, lv.coach.length - 1)];
  return lv.tip;
}

// ---------- drawing ----------
function chips(J) {
  const g = goalCheck(S, J), out = [];
  g.parts.forEach(p => {
    const t = p.id === "score" ? `Score ${fmt(p.have)}/${p.need}` : p.id === "trains" ? `${p.have}/${goal().trains.k} separate trains of ${goal().trains.m}+` : p.id === "jewels" ? `Jewels ${p.have}/${p.need}` : p.ok ? "No jam" : `No jam: ${p.have} jammed`;
    out.push(`<span class="sh-part${p.ok ? " ok" : p.id === "nojam" && p.have ? " bad" : ""}">${t}</span>`);
  });
  return `<span class="lab">Goal</span>${out.join("")}`;
}
function coachBox() {
  let cls = "", html;
  if (done) {
    const J = judge(S), g = goalCheck(S, J), n = starsFor(J.score, g.ok);
    const why = g.parts.filter(p => !p.ok).map(p => p.id === "score" ? `score ${fmt(J.score)} of ${p.need}` : p.id === "trains" ? `only ${p.have} separate train${p.have === 1 ? "" : "s"}` : p.id === "jewels" ? `${p.have} of ${p.need} jewels covered` : `${p.have} jammed`).join(", ");
    cls = g.ok ? "good" : "bad";
    html = g.ok ? `<b class="g">Plate judged: goal met.</b> Score ${fmt(J.score)}, ${starStr(n)}. ${n < 3 ? `Next star at ${nextStar(n)}.` : "Best possible stars."}` : `<b class="r">Plate judged: goal missed</b> (${why}). Undo to rewind, or Replay in the menu.`;
  } else if (pv) {
    const ef = effectOf(pv);
    cls = ef.tone;
    html = ef.html;
    if (demoE === pv.e && !demoSeen) html = `<b class="r">${spec.demo === "shear" ? "This shove would shear the train" : "This shove would jam"}.</b> ${spec.demo === "shear" ? "A shove slides a whole line, so it pulls a train apart: see it flash." : "Three gears in a ring cannot all turn: see the red."} Now tap another lever.`;
    else if (coachOn && pulse?.e === pv.e) html = `<b class="g">Good shove.</b> ${html} Tap it again to shove.`;
  } else if (thinking) html = "<b>Thinking…</b> searching the queue and the hold for a winning line.";
  else if (hintInfo) { cls = hintInfo.nowin ? "bad" : "good"; html = hintInfo.html; }
  else if (offer) { cls = "bad"; html = `${note ? `${note} ` : ""}<b>Stuck? Tap Hint.</b> It finds a line that wins, and costs nothing.`; }
  else if (note) { cls = "bad"; html = note; }
  else html = coachLine();
  const box = $("coach");
  box.className = `sh-coach${cls ? ` ${cls}` : ""}`;
  box.innerHTML = html;
}
function render() {
  const base = S, shown = pv ? pv.s : S, J = judge(shown), ok = goalCheck(shown, J).ok;
  $("plateName").innerHTML = nameOf();
  $("score").textContent = fmt(J.score);
  $("stars").textContent = starStr(starsFor(J.score, ok));
  $("goal").innerHTML = chips(J);
  coachBox();
  const fx = pv ? effect(pv.before, { s: pv.s, moved: pv.moved, at: pv.at }) : null;
  view.draw({ state: shown, base, preview: pv, fx, pulse: pv ? null : pulse, done });
  $("undoBtn").disabled = !run.moves.length || animating || IN_FRAME;
  $("swapBtn").disabled = done || animating || !canSwap(S) || IN_FRAME;
  $("hintBtn").disabled = done || animating || !!thinking || IN_FRAME;
  $("hintBtn").textContent = thinking ? "…" : "Hint";
  $("hintBtn").classList.toggle("hl", (offer || !!hintInfo?.nowin) && !thinking);
  $("swapBtn").classList.toggle("hl", !!pulse?.hold && !pv && !done);
  const sh = $("shoveBtn");
  if (done) {
    const g = goalCheck(S), won = g.ok;
    sh.textContent = run.kind === "level" ? (won ? (levelNo() < LEVELS.length ? "Next ›" : "Again") : "Replay") : run.kind === "random" ? "New plate" : "Share";
    sh.disabled = false;
  } else { sh.textContent = "Shove"; sh.disabled = !pv || animating || IN_FRAME; }
  if (IN_FRAME) document.querySelector(".sh-acts").hidden = true;
}

// ---------- play ----------
function preview(e, swapFirst = false) {
  if (!swapFirst) hintInfo = null;
  const before = swapFirst ? swap(S) : S, r = shove(before, e);
  if (!r) return;
  pv = { e, before, s: r.s, moved: r.moved, at: r.at, swapFirst };
  if (demoE >= 0 && !demoSeen && e !== demoE) demoSeen = true;
  keepSel();
  render();
}
function clearPreview() { if (!pv) return; pv = null; keepSel(); render(); }
function commit() {
  if (!pv || animating || done) return;
  if (demoE >= 0 && !demoSeen && pv.e === demoE) { toast("Not that one: tap another lever."); return; }
  const p = pv, ep = epoch;
  const before = p.before, r = { s: p.s, moved: p.moved, at: p.at };
  const mv = p.swapFirst ? [-1, p.e] : [p.e];
  run.moves.push(...mv);
  const d = dropNote(before, r);
  S = p.s; pv = null; hintInfo = null; thinking = 0; hintTok++; undoStreak = 0;
  note = d; offer = coached() && !!d;
  demoSeen = true;
  keepSel(); keepRun(); coachFor();
  animating = true;
  render();
  view.animate({ state: S, base: S, preview: null, fx: null, pulse, done: false }, { moved: r.moved, at: r.at, e: p.e }, () => {
    if (ep !== epoch) return;
    animating = false;
    settle();
  });
}
function doSwap() {
  if (!canSwap(S) || done || animating) return;
  run.moves.push(-1);
  S = swap(S); pv = null; hintInfo = null; thinking = 0; hintTok++; keepSel(); keepRun(); coachFor(); render();
}
function undo() {
  if (!run.moves.length || animating) return;
  run.moves.pop();
  S = play(spec, run.moves);
  pv = null; hintInfo = null; thinking = 0; hintTok++; note = ""; done = false;
  undoStreak++;
  offer = coached() && undoStreak >= 2;
  keepSel(); keepRun(); coachFor(); render();
}
/** After a shove: if the plate is judged, count it. */
function settle() {
  if (over(S)) finish(); else render();
}
function finish() {
  done = true; pulse = null;
  const J = judge(S), ok = goalCheck(S, J).ok, n = starsFor(J.score, ok);
  if (run.kind === "level") {
    if (n > camp.stars[run.n]) { camp.stars[run.n] = n; keepCamp(); }
    if (ok) roundOver("shunt");
  } else {
    if (run.kind === "daily") { const days = readDaily(kp); if (!(days[run.day] >= J.score)) write(DAILY, { ...days, [run.day]: J.score }); }
    roundOver("shunt");
  }
  render();
}
async function primary() {
  if (IN_FRAME) return;
  if (!done) { commit(); return; }
  const ok = goalCheck(S).ok;
  if (run.kind === "level") { if (ok && levelNo() < LEVELS.length) playLevel(levelNo()); else replay(true); }
  else if (run.kind === "random") await newRandom();
  else await share();
}
async function replay(quiet = false) {
  if (!quiet && run.moves.length && !done && !(await sure("Replay this plate? Your moves on it are lost.", { yes: "Replay" }))) return;
  write(SEL, null);
  if (run.kind === "level") enter({ kind: "level", n: run.n, moves: [] }, LEVELS[run.n]);
  else enter({ ...run, moves: [], hints: 0 }, spec);
}
async function share() {
  const J = judge(S), text = `Shunt · ${dateWords(run.day)}\n${fmt(J.score)} · ${starStr(starsFor(J.score, goalCheck(S, J).ok))}`;
  try { await navigator.clipboard.writeText(text); toast("Result copied"); } catch { toast("Couldn't copy the result"); }
}

// ---------- the hint: the beam search over the queue and the hold, in slices so the page stays alive ----------
function runHint() {
  if (done || animating || thinking || IN_FRAME) return;
  pv = null; hintInfo = null; offer = false; hints++;
  thinking = 1;
  const tok = ++hintTok, ep = epoch, sr = search(S, 220);
  keepSel(); render();
  const tick = () => {
    if (tok !== hintTok || ep !== epoch) return;
    if (!sr.step(14)) return void setTimeout(tick, 0);
    thinking = 0;
    const r = sr.result();
    if (!r.ok || !r.first) {
      hintInfo = { nowin: true, html: `<b class="r">I can't find a winning line from here.</b> ${run.moves.length ? "Undo, then try another order." : "Replay the plate."}` };
      render();
      return;
    }
    const [sw, e] = r.first;
    preview(e, !!sw);
    const E = effectOf(pv).E, targetNote = goal().score != null ? ` I expect about <b>${fmt(r.score)}</b> against the goal of ${goal().score}.` : ` I expect about <b>${fmt(r.score)}</b> with the goal met.`;
    hintInfo = { e, html: `<b class="g">${sw ? "Swap first, then shove" : "Shove"} at the lit lever.</b> It ${E.broken.length ? `breaks the ${colourName(E.broken[0], pv.before)} train of ${E.broken[0].n}` : "keeps your trains intact"}, ${E.newJams > 0 ? "jams a train" : "jams nothing"}.${targetNote}` };
    render();
  };
  setTimeout(tick, 20);
}

// ---------- touches: the levers (a tap previews, the same lever again shoves; a slide shows each in turn) and the cradle ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
let touch = null;
function onDown(ev) {
  if (IN_FRAME || done || animating || (ev.pointerType === "mouse" && ev.button > 0)) return;
  const h = view.hit(ev.clientX, ev.clientY);
  touch = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false, was: pv?.e ?? -1, wasSwap: !!pv?.swapFirst, last: h, hold: h?.kind === "hold" };
  if (h?.kind === "entry" && h.legal) {
    if (!(pv && pv.e === h.e && !pv.swapFirst)) preview(h.e, false);
  }
  try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* not capturable */ }
}
function onMove(ev) {
  if (!touch || ev.pointerId !== touch.id) return;
  if (Math.hypot(ev.clientX - touch.x, ev.clientY - touch.y) > 6) touch.moved = true;
  const h = view.hit(ev.clientX, ev.clientY);
  if (h?.kind === "entry" && h.legal && h.e !== pv?.e && touch.moved) { touch.last = h; preview(h.e, false); }
  else if (h?.kind === "entry" && h.legal) touch.last = h;
}
function onUp(ev) {
  if (!touch || ev.pointerId !== touch.id) return;
  const t = touch; touch = null;
  const h = view.hit(ev.clientX, ev.clientY);
  if (h?.kind === "hold" && t.hold) { doSwap(); return; }
  if (h?.kind === "entry") {
    if (!h.legal) { toast("That line is full: no gap to shove into."); return; }
    if (!t.moved && t.was === h.e && !t.wasSwap) commit();                // the lever already chosen, touched again
    return;
  }
  if (!t.moved && !t.hold && (h === null || h.kind === "plate")) clearPreview();
}
function wireTouches() {
  for (const el of [$("plate"), $("tray")]) {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", () => { touch = null; });
  }
}

// ---------- the menu ----------
function levelList() {
  const list = document.createElement("div");
  list.className = "sh-levels";
  LEVELS.forEach((L, n) => {
    const b = document.createElement("button"), open = isOpen(n), won = camp.stars[n];
    b.type = "button"; b.disabled = !open;
    if (mode === "levels" && n === camp.at) b.setAttribute("aria-current", "true");
    b.setAttribute("aria-label", `Level ${L.no}, ${L.name}${open ? "" : ", locked: beat the one before it"}${won ? `, ${plural(won, "star")}` : ""}`);
    b.innerHTML = `<b></b><span></span><span class="st"></span>`;
    b.children[0].textContent = `${L.no}  ${L.name}`;
    b.children[1].textContent = goalWords(L.goal);
    b.children[2].textContent = open ? starStr(won) : "locked";
    b.addEventListener("click", () => { $("menuDlg").close(); if (mode !== "levels" || n !== camp.at) playLevel(n); });
    list.append(b);
  });
  return list;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action(run.kind === "level" ? `Replay level ${levelNo()}` : run.kind === "random" ? "New plate" : "Replay today's plate", () => (run.kind === "random" ? newRandomAsk() : replay()), "primary"));
  const content = part(body, "content");
  content.append(choice("Mode", [["levels", "Levels"], ["random", "Random"], ["daily", "Daily"]], mode, v => { $("menuDlg").close(); setMode(v); }));
  if (mode === "levels") content.append(levelList());
  else if (mode === "random") content.append(choice("Difficulty", DIFFS.map(d => [d, DIFF_NAMES[d]]), diff, v => { diff = v; write(DIFF, v); $("menuDlg").close(); newRandomAsk(); }));
  else {
    const got = readDaily(kp)[today()];
    content.append(line(got != null ? `Today's plate: you scored ${fmt(got)}. It is the same for everyone, and a better score replaces it.` : "Today's plate is the same for everyone. Your score counts the moment the plate is judged."));
  }
  part(body, "settings").append(toggle("Coach lines (levels 1 to 8)", coachOn, on => { coachOn = on; write(COACH, on); coachFor(); render(); }));
  const total = camp.stars.reduce((a, b) => a + b, 0), beaten = camp.stars.filter(Boolean).length;
  const about = part(body, "about");
  about.append(line(`${plural(beaten, "level")} of ${LEVELS.length} beaten, ${plural(total, "star")} of ${LEVELS.length * 3}.`));
  about.append(line("You never place a gear: the next one of the queue is shoved in from a lever on the rim, and pushes the gears in its way one step along. Gears of one pitch that touch mesh and turn opposite ways; a chain of three or more is a train and scores, half as much again for each jewel under it. A ring of an odd number of gears jams and scores nothing. The idler meshes every pitch, a bridge two. The plate is judged when it is full or the queue is out."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
async function newRandomAsk() {
  if (run.kind === "random" && run.moves.length && !done && !(await sure("Start a new plate? Your moves on this one are lost.", { yes: "New plate" }))) return;
  if (mode !== "random") { mode = "random"; write(MODE, mode); }
  await newRandom();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "shunt");                  // hidden by the full-screen frame: the menu's "Back to menu" clicks it
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("undoBtn").addEventListener("click", undo);
$("swapBtn").addEventListener("click", doSwap);
$("hintBtn").addEventListener("click", runHint);
$("shoveBtn").addEventListener("click", primary);
wireTouches();
onPause(() => view.setMotion(false), () => view.setMotion(true));

window.__shunt = {
  get S() { return S; }, get spec() { return spec; }, get run() { return run; }, get pv() { return pv; }, get done() { return done; }, get pulse() { return pulse; }, get camp() { return camp; },
  view, preview, commit, doSwap, undo, playLevel, newRandom, newDaily, setMode, runHint, get hintInfo() { return hintInfo; }, get offer() { return offer; }, get mode() { return mode; },
};

(async () => {
  const wantsDaily = arrivedForToday() && !IN_FRAME;     // the games screen's tile opens today's plate while it is still to play
  if (wantsDaily) { mode = "daily"; write(MODE, mode); }
  try { await resume(); } catch (e) {
    // a kept value that passed its checks and still broke the page: let go of the runs and start at the first level
    console.warn("Shunt: starting afresh", e);
    for (const k of [...Object.values(RUN_KEY), SEL]) write(k, null);
    mode = "levels"; write(MODE, mode); camp = readCamp(kp);
    await resume();
  }
})();
