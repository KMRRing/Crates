// Bones' puzzle rush on the page (Menu, Puzzle rush): positions from the computer players' own games where one tile is
// clearly best, as many as you can find in five minutes; three misses end the run. On a sheet over the game, laid out
// as the course's (course.css), the table drawn by the course's stage (bones-course.js: the others with their tiles and
// knocks, the line, your tiles; tap a tile, its place, Lay). The verdict comes at once, with what each play was worth
// and what the best one does; the clock stands while you read it, while the sheet is closed and while the app is in the
// background. A run starts easy and rises, four puzzles at each rating, those seen lately last. The bank
// (bones-puzzles.js) loads with the first run; the run is kept as it goes (bones:rush), the best in bones:rushBest.
import { tileStage, tableOf, playName } from "./bones-course.js";
import { RUSH_MS, STRIKES, runOrder, stepOf, judge, playWords, worthText, doesText, whyText, askText } from "./bones-rush.js";
import { busy } from "./loading.js";

const RUN = "bones:rush", BEST = "bones:rushBest", SEEN = "bones:rushSeen";
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

let bank = null;
async function loadBank() {
  bank ||= (await import("./bones-puzzles.js")).PUZZLES;
  return bank;
}

/** The sheet, made once. inFrame: a partner watching (nothing kept). Returns { open, label, best }. */
export function createRush({ inFrame = false } = {}) {
  const write = (k, v) => { if (!inFrame) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
  const dlg = document.createElement("dialog");
  dlg.className = "ln-sheet bn bn-rush pauses";                   // pauses: the game stands still under it (menu.js)
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
  const stage = tileStage();
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
  /** A play laid: judged at once, the best laid on the line, the clock stopped until Next. */
  function lay() {
    const p = puzzle();
    if (!p || run.answer || run.over || !stage.ready(stepOf(p), st)) return;
    const name = playName(tableOf(stepOf(p)), { tile: st.sel, end: st.end }), j = judge(p, name);
    run.answer = { name, verdict: j.verdict };
    if (j.verdict === "wrong") run.strikes++; else run.score++;
    run.log.push({ id: p.id, verdict: j.verdict });
    write(SEEN, [...read(SEEN, []).filter(x => x !== p.id), p.id].slice(-240));
    save();
    draw();
  }
  /** After a verdict: the next puzzle, or the score once three are missed. */
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

  // ---------- the clock: it runs while a puzzle waits for your tile, the sheet open and the app in front ----------
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

  // ---------- drawing ----------
  function draw() {
    const act = $("[data-act]");
    act.disabled = false;
    if (!run || run.over) { drawIntro(act); return; }
    const p = puzzle();
    if (!p) { finish(); drawIntro(act); return; }
    const step = stepOf(p);
    $(".ln-title small").textContent = statusText();
    if (!run.answer) {
      st ||= { done: false, tries: 0 };
      stage.draw(step, st);
      $(".ln-text").innerHTML = `<p class="ln-say">${esc(askText(p))}</p>`;
      act.textContent = stage.label(step, st);
      act.disabled = !stage.ready(step, st);
      return;
    }
    // the verdict: the best laid on the line, what it and yours were worth, what it does
    const j = judge(p, run.answer.name), best = {};
    stage.hint(step, best);
    st = { done: true, tries: 0, sel: best.sel, end: best.end };
    stage.draw(step, st);
    // Fives and Threes counts a game won as 100 points: an average that big is mostly games won
    const big = (p.game === "fives" && [j.best, j.mine, j.next].some(x => x && Math.abs(x.value) >= 20 && x.value < 90)) ? ", a game won counted as 100" : "";
    const deals = `over ${p.n} deals of the tiles you couldn't see${big}`;
    const head = j.verdict === "best" ? `<b class="bn-hit">✓ Best</b> ${esc(playWords(p.best, p))} ${esc(doesText(p, j.best.value))} ${deals}${j.next ? `; the next best ${esc(worthText(p, j.next.value))}` : ""}.`
      : j.verdict === "fine" ? `<b class="bn-hit">✓ As good</b> Yours, ${esc(playWords(j.mine.name, p))}, ${esc(worthText(p, j.mine.value))}; the best, ${esc(playWords(p.best, p))}, ${esc(worthText(p, j.best.value))} ${deals}.`
        : `<b class="bn-miss">✗ Not the best</b> ${esc(playWords(p.best, p))} ${esc(doesText(p, j.best.value))} ${deals}; yours, ${esc(playWords(j.mine.name, p))}, ${esc(worthText(p, j.mine.value))}.`;
    const why = whyText(p);
    $(".ln-text").innerHTML = `<p class="ln-say">${head}</p>${why ? `<p class="ln-msg ${j.verdict === "wrong" ? "no" : "ok"}">${esc(why)}</p>` : ""}`;
    act.textContent = run.strikes >= STRIKES || run.left <= 0 ? "See the score" : "Next puzzle";
  }
  function drawIntro(act) {
    const best = read(BEST, 0), done = run?.over ? run : null;
    $(".ln-title small").textContent = done ? "The run's over" : best ? `Best ${best}` : "Five minutes";
    const missed = done ? done.log.filter(x => x.verdict === "wrong").length : 0;
    const rows = done
      ? [["Solved", String(done.score)], ["Answered", `${done.log.length}, ${missed} missed`], [done.score > (done.wasBest ?? 0) && done.score ? "Your best" : "Best", String(Math.max(best, done.score))]]
      : [["The clock", "five minutes"], ["Three misses", "end the run"], ...(best ? [["Your best", String(best)]] : [])];
    $(".ln-stage").innerHTML = `<div class="lb">${rows.map(([label, text]) => `<div class="lb-row"><small>${esc(label)}</small><b class="lb-word">${esc(text)}</b></div>`).join("")}</div>`;
    $(".ln-text").innerHTML = done
      ? `<p class="ln-say">${done.left <= 0 ? "Time." : done.strikes >= STRIKES ? "Three misses." : "That's every puzzle in the bank."} ${done.score} found.</p>`
      : `<p class="ln-say">Positions from the computer players' own games, Partnership, Gaple and Fives and Threes, where one tile is clearly best: worked out over hundreds of deals of the tiles you can't see, each played to the end of the hand. Find it. They start easy and get harder.</p>`;
    act.textContent = done ? "Another run" : "Start";
  }

  $("[data-act]").addEventListener("click", async () => {
    if (!run || run.over) {
      const done = busy("The puzzles");
      try { await loadBank(); } finally { done(); }
      start();
      return;
    }
    if (run.answer) next(); else lay();
  });
  $("[data-close]").addEventListener("click", () => dlg.close());
  addEventListener("resize", () => { if (dlg.open) draw(); });

  return {
    /** Opens the sheet: the run under way where it was, or the start. */
    async open() {
      if (run && !run.over) { const done = busy("The puzzles"); try { await loadBank(); } finally { done(); } }
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
