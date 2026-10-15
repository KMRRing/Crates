// A puzzle rush on a sheet over a game (Schafkopf's, Gammon's, Banquet's, Bones'): positions from the computer players'
// own games where one play is clearly best, with the settings every game's rush shares (rush-core.js): Random or
// Today's; 3 min, 5 min or Survival; three misses end the run. Laid out as the course's sheet (course.css), the position
// drawn by the game's course stage (its mount, draw, ready, label, hint), the play made with the button under the words.
// Before a run the sheet shows the choices, the same controls as a menu's (rush-menu.js), and your best; the verdict
// comes at once, what it does and what each was worth, and the clock stands while you read it, while the sheet is closed
// and while the app is away. A run starts easy and rises, four puzzles at each rating, those seen lately last (runOrder;
// today's the same order for everyone). The bank loads with the first run; the run is kept as it goes (<game>:rush), the
// bests by clock in <game>:rushBest, today's runs in <game>:rushDaily, the puzzles seen lately in <game>:rushSeen.
import { busy } from "./loading.js";
import { today } from "./days.js";
import { MODES, STRIKES, modeOf, clockText, strikeMarks, clockFor, runDown, graceAgain, timeUp, bestsOf, noteRun, endTitle, runOrder } from "./rush-core.js";
import { runChoice, modeChoice } from "./rush-menu.js";

const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** A run as kept: one from before the clocks were chosen (v1) was a random five-minute one. */
const upgrade = r => (!r || typeof r !== "object" ? null : r.v === 1 ? { ...r, v: 2, kind: "random", mode: "five", wait: 0 } : r.v === 2 ? r : null);

/**
 * The sheet, made once. game: { key (its storage prefix), cls (its class on the sheet, for its colours), loadBank()
 * (its puzzles, each with an id and a rating r), stage (its course stage), stepOf(p) (a puzzle as the stage's step,
 * its answer the best), picked(p, st) (the name of the play the stage has picked), judge(p, name) ({ verdict: "best" |
 * "fine" | "wrong", … }), ask(p) (the question, in words), verdict(p, j) (the verdict as markup), intro (the words before
 * a run) }; inFrame: a partner watching (nothing kept). Returns { open, bests, daily, isOpen, run }.
 */
export function createRushSheet(game, { inFrame = false } = {}) {
  const RUN = `${game.key}:rush`, BEST = `${game.key}:rushBest`, DAILY = `${game.key}:rushDaily`, SEEN = `${game.key}:rushSeen`;
  const write = (k, v) => { if (!inFrame) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
  let bank = null;
  const loadBank = async () => { if (bank) return; const done = busy("The puzzles"); try { bank = await game.loadBank(); } finally { done(); } };
  const dlg = document.createElement("dialog");
  dlg.className = `ln-sheet ${game.cls} rush-sheet pauses`;       // pauses: the game stands still under it (menu.js)
  dlg.setAttribute("aria-label", "Puzzle rush");
  dlg.innerHTML = `<div class="ln-in">
    <header class="ln-head"><span aria-hidden="true"></span>
      <div class="ln-title"><b>Puzzle rush</b><small></small></div>
      <button class="icon-btn" type="button" data-close aria-label="Close">${CLOSE}</button></header>
    <div class="ln-lesson"><div class="ln-stage"></div>
      <div class="ln-side"><div class="ln-text" aria-live="polite"></div>
        <div class="ln-bar"><button class="ln-go" type="button" data-act></button></div></div></div>
  </div>`;
  document.body.appendChild(dlg);
  const $ = sel => dlg.querySelector(sel);
  const stage = game.stage;
  stage.mount($(".ln-stage"), { changed: () => draw(), answer: () => {} });

  // the run: { v, kind, mode, seed, order (ids), i, score, strikes, left (ms; null with no clock), wait (this puzzle's
  // grace left), answer ({ name, verdict }), over, why, log [{ id, verdict }], best, was }
  let run = upgrade(read(RUN, null)), st = null, last = 0, savedAt = 0;
  // the next run's kind and clock: the last run's, until the sheet's choices change them
  const pick = { kind: run?.kind === "daily" ? "daily" : "random", mode: modeOf(run?.mode) };
  const save = () => write(RUN, run);
  const puzzle = () => (run && bank ? bank.find(p => p.id === run.order[run.i]) || null : null);

  function start() {
    const daily = pick.kind === "daily", seed = daily ? today() : (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
    run = { v: 2, kind: daily ? "daily" : "random", mode: modeOf(pick.mode), seed, order: runOrder(bank, seed, daily ? [] : read(SEEN, [])), i: 0, score: 0, strikes: 0,
      ...clockFor(pick.mode), answer: null, over: false, why: null, log: [] };
    st = null;
    save();
    draw();
  }
  /** A play made: judged at once, the best shown played, the clock stopped until Next. */
  function play() {
    const p = puzzle();
    if (!p || run.answer || run.over || !stage.ready(game.stepOf(p), st)) return;
    const name = game.picked(p, st), j = game.judge(p, name);
    run.answer = { name, verdict: j.verdict };
    if (j.verdict === "wrong") run.strikes++; else run.score++;
    run.log.push({ id: p.id, verdict: j.verdict });
    write(SEEN, [...read(SEEN, []).filter(x => x !== p.id), p.id].slice(-240));
    save();
    draw();
  }
  /** After a verdict: the next puzzle, or the score once three are missed or the time is up. */
  function next() {
    if (!run) return;
    if (run.over || run.strikes >= STRIKES || timeUp(run)) { finish(run.strikes >= STRIKES ? "strikes" : "time"); draw(); return; }
    run.i++;
    run.answer = null;
    graceAgain(run);
    st = null;
    if (!puzzle()) finish("bank");
    save();
    draw();
  }
  /** The run's end: its best by clock, and today's for today's run. */
  function finish(why) {
    if (!run || run.over) return;
    run.over = true;
    run.why = why;
    const res = noteRun(read(BEST, {}), read(DAILY, {}), { kind: run.kind, mode: run.mode, score: run.score }, today());
    write(BEST, res.bests);
    if (run.kind === "daily") write(DAILY, res.daily);
    run.best = res.best;
    run.was = res.was;
    save();
  }

  // the clock: it runs while a puzzle waits for your play, the sheet open and the app in front; each puzzle's grace first
  setInterval(() => {
    const now = performance.now(), dt = last ? now - last : 0;
    last = now;
    if (!run || run.over || run.answer || !dlg.open || document.hidden || !bank || inFrame) return;
    if (runDown(run, dt)) { finish("time"); draw(); return; }
    $(".ln-title small").textContent = statusText();
    if (now - savedAt > 3000) { savedAt = now; save(); }
  }, 250);
  const statusText = () => `Puzzle ${run.i + 1} · ✓ ${run.score} · ${strikeMarks(run.strikes)} · ${run.left == null ? MODES.survival.label : clockText(run.left)}`;

  function draw() {
    const act = $("[data-act]");
    act.disabled = false;
    if (!run || run.over) { drawIntro(act); return; }
    const p = puzzle();
    if (!p) { finish("bank"); drawIntro(act); return; }
    const step = game.stepOf(p);
    $(".ln-title small").textContent = statusText();
    // the words first: the stage sizes itself to the room they leave
    if (!run.answer) {
      st ||= { done: false, tries: 0 };
      $(".ln-text").innerHTML = `<p class="ln-say">${esc(game.ask(p))}</p>`;
      stage.draw(step, st);
      act.textContent = stage.label(step, st);
      act.disabled = !stage.ready(step, st);
      return;
    }
    // the verdict: the best shown played, what it and yours were worth, what it does
    const best = { done: true };
    stage.hint(step, best);
    st = best;
    $(".ln-text").innerHTML = game.verdict(p, game.judge(p, run.answer.name));
    stage.draw(step, st);
    act.textContent = run.strikes >= STRIKES || timeUp(run) ? "See the score" : "Next puzzle";
  }
  /** Before a run, and after one: how it went (after), the next run's choices, your best on its clock. */
  function drawIntro(act) {
    const done = run?.over ? run : null, bests = bestsOf(read(BEST, {})), mine = bests[modeOf(pick.mode)] || 0;
    const label = MODES[modeOf(pick.mode)].label, todays = read(DAILY, {})[`${today()}/${modeOf(pick.mode)}`];
    $(".ln-title small").textContent = done ? "The run's over" : `${label}${mine ? ` · best ${mine}` : ""}`;
    const missed = done ? done.log.filter(x => x.verdict === "wrong").length : 0;
    const rows = done
      ? [["Solved", String(done.score)], ["Answered", `${done.log.length}, ${missed} missed`],
        [done.kind === "daily" ? "Best today" : `${done.score > (done.was ?? 0) && done.score ? "Your best" : "Best"}, ${MODES[modeOf(done.mode)].label}`, String(done.best ?? done.score)]]
      : [["Three misses", "end the run"], [`Your best, ${label}`, mine ? String(mine) : "none yet"], ...(todays != null ? [["Today's run", String(todays)]] : [])];
    const box = $(".ln-stage");
    box.innerHTML = `<div class="rush-setup"><div class="rush-rows">${rows.map(([l, t]) => `<div class="rush-row"><small>${esc(l)}</small><b>${esc(t)}</b></div>`).join("")}</div><div class="rush-pick"></div></div>`;
    if (!inFrame) box.querySelector(".rush-pick").append(runChoice(pick, [], () => draw()), modeChoice(pick, () => draw()));
    $(".ln-text").innerHTML = done
      ? `<p class="ln-say">${esc(endTitle(done.why || (timeUp(done) ? "time" : done.strikes >= STRIKES ? "strikes" : "bank")))}. ${done.score} found.</p>`
      : `<p class="ln-say">${esc(game.intro)}</p>`;
    act.textContent = done ? "Another run" : "Start";
    act.disabled = inFrame;
  }

  $("[data-act]").addEventListener("click", async () => {
    if (!run || run.over) { await loadBank(); start(); return; }
    if (run.answer) next(); else play();
  });
  $("[data-close]").addEventListener("click", () => dlg.close());
  addEventListener("resize", () => { if (dlg.open) draw(); });

  return {
    /** Opens the sheet: the run under way where it was, or the choices for the next. */
    async open() {
      if (run && !run.over) await loadBank();
      if (!dlg.open) dlg.showModal();
      last = 0;
      draw();
    },
    /** Your bests by clock, and today's runs, as rush-core.js reads them. */
    bests: () => bestsOf(read(BEST, {})),
    daily: () => read(DAILY, {}),
    get isOpen() { return dlg.open; },
    get run() { return run; },
  };
}
