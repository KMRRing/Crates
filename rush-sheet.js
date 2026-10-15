// A puzzle rush on a sheet over a game (Bones', Schafkopf's): positions from the computer players' own games where one
// play is clearly best, as many as you can find in five minutes; three misses end the run. Laid out as the course's
// sheet (course.css), the position drawn by the game's course stage (its mount, draw, ready, label, hint), the play made
// with the button under the words. The verdict comes at once, what it does and what each was worth; the clock stands
// while you read it, while the sheet is closed and while the app is in the background. A run starts easy and rises,
// four puzzles at each rating, those seen lately last. The bank loads with the first run; the run is kept as it goes
// (<game>:rush), the best in <game>:rushBest, the puzzles seen lately in <game>:rushSeen.
import { busy } from "./loading.js";

export const RUSH_MS = 5 * 60 * 1000, STRIKES = 3;
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/**
 * The order a run deals its puzzles: rising difficulty, four at each rating (r, 1 to 10), chosen at random within a
 * rating from those not seen lately (`recent`: ids), any seen if a rating runs dry; then the rest, hardest first.
 */
export function runOrder(bank, seed, recent = []) {
  const r = rng(seed), seen = new Set(recent), out = [], used = new Set();
  for (let step = 1; step <= 10; step++) {
    const pool = bank.filter(p => p.r === step && !used.has(p.id));
    const fresh = pool.filter(p => !seen.has(p.id)), from = fresh.length >= 4 ? fresh : pool;
    for (let i = 0; i < 4 && from.length; i++) {
      const p = from.splice(Math.floor(r() * from.length), 1)[0];
      out.push(p.id);
      used.add(p.id);
    }
  }
  for (const p of bank.filter(x => !used.has(x.id)).sort((a, b) => b.r - a.r)) out.push(p.id);
  return out;
}

const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/**
 * The sheet, made once. game: { key (its storage prefix), cls (its class on the sheet, for its colours), loadBank()
 * (its puzzles, each with an id and a rating r), stage (its course stage), stepOf(p) (a puzzle as the stage's step,
 * its answer the best), picked(p, st) (the name of the play the stage has picked), judge(p, name) ({ verdict: "best" |
 * "fine" | "wrong", … }), ask(p) (the question, in words), verdict(p, j) (the verdict as markup), intro (the words before
 * a run) }; inFrame: a partner watching (nothing kept). Returns { open, label, best, isOpen, run }.
 */
export function createRushSheet(game, { inFrame = false } = {}) {
  const RUN = `${game.key}:rush`, BEST = `${game.key}:rushBest`, SEEN = `${game.key}:rushSeen`;
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

  // the run: { seed, order (ids), i, score, strikes, left (ms), answer ({ name, verdict }), over, log [{ id, verdict }] }
  let run = read(RUN, null), st = null, last = 0;
  const save = () => write(RUN, run);
  const puzzle = () => (run && bank ? bank.find(p => p.id === run.order[run.i]) || null : null);

  function start() {
    const seed = (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
    run = { v: 1, seed, order: runOrder(bank, seed, read(SEEN, [])), i: 0, score: 0, strikes: 0, left: RUSH_MS, answer: null, over: false, log: [] };
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
    if (run.over || run.strikes >= STRIKES || run.left <= 0) { finish(); draw(); return; }
    run.i++;
    run.answer = null;
    st = null;
    if (!puzzle()) finish();
    save();
    draw();
  }
  function finish() {
    run.over = true;
    const before = read(BEST, 0);
    if (run.score > before) write(BEST, run.score);
    run.wasBest = before;
    save();
  }

  // the clock: it runs while a puzzle waits for your play, the sheet open and the app in front
  setInterval(() => {
    const now = performance.now(), dt = last ? now - last : 0;
    last = now;
    if (!run || run.over || run.answer || !dlg.open || document.hidden || !bank || inFrame) return;
    run.left -= dt;
    if (run.left <= 0) { run.left = 0; finish(); draw(); return; }
    $(".ln-title small").textContent = statusText();
    if (Math.floor(run.left / 1000) % 5 === 0) save();
  }, 250);
  const statusText = () => `Puzzle ${run.i + 1} · ✓ ${run.score} · ${"✗".repeat(run.strikes)}${"○".repeat(Math.max(0, STRIKES - run.strikes))} · ${clock(run.left)}`;

  function draw() {
    const act = $("[data-act]");
    act.disabled = false;
    if (!run || run.over) { drawIntro(act); return; }
    const p = puzzle();
    if (!p) { finish(); drawIntro(act); return; }
    const step = game.stepOf(p);
    $(".ln-title small").textContent = statusText();
    if (!run.answer) {
      st ||= { done: false, tries: 0 };
      stage.draw(step, st);
      $(".ln-text").innerHTML = `<p class="ln-say">${esc(game.ask(p))}</p>`;
      act.textContent = stage.label(step, st);
      act.disabled = !stage.ready(step, st);
      return;
    }
    // the verdict: the best shown played, what it and yours were worth, what it does
    const best = { done: true };
    stage.hint(step, best);
    st = best;
    stage.draw(step, st);
    $(".ln-text").innerHTML = game.verdict(p, game.judge(p, run.answer.name));
    act.textContent = run.strikes >= STRIKES || run.left <= 0 ? "See the score" : "Next puzzle";
  }
  function drawIntro(act) {
    const best = read(BEST, 0), done = run?.over ? run : null;
    $(".ln-title small").textContent = done ? "The run's over" : best ? `Best ${best}` : "Five minutes";
    const missed = done ? done.log.filter(x => x.verdict === "wrong").length : 0;
    const rows = done
      ? [["Solved", String(done.score)], ["Answered", `${done.log.length}, ${missed} missed`], [done.score > (done.wasBest ?? 0) && done.score ? "Your best" : "Best", String(Math.max(best, done.score))]]
      : [["The clock", "five minutes"], ["Three misses", "end the run"], ...(best ? [["Your best", String(best)]] : [])];
    $(".ln-stage").innerHTML = `<div class="rush-rows">${rows.map(([label, text]) => `<div class="rush-row"><small>${esc(label)}</small><b>${esc(text)}</b></div>`).join("")}</div>`;
    $(".ln-text").innerHTML = done
      ? `<p class="ln-say">${done.left <= 0 ? "Time." : done.strikes >= STRIKES ? "Three misses." : "That's every puzzle in the bank."} ${done.score} found.</p>`
      : `<p class="ln-say">${esc(game.intro)}</p>`;
    act.textContent = done ? "Another run" : "Start";
  }

  $("[data-act]").addEventListener("click", async () => {
    if (!run || run.over) { await loadBank(); start(); return; }
    if (run.answer) next(); else play();
  });
  $("[data-close]").addEventListener("click", () => dlg.close());
  addEventListener("resize", () => { if (dlg.open) draw(); });

  return {
    /** Opens the sheet: the run under way where it was, or the start. */
    async open() {
      if (run && !run.over) await loadBank();
      if (!dlg.open) dlg.showModal();
      last = 0;
      draw();
    },
    /** The menu's words for it. */
    label: () => (run && !run.over ? `Puzzle rush: puzzle ${run.i + 1}, ${clock(run.left)} left` : "Puzzle rush"),
    best: () => read(BEST, 0),
    get isOpen() { return dlg.open; },
    get run() { return run; },
  };
}
