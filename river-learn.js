// River's course on a sheet over the game: the map of its lessons, and a lesson's steps on a board of its own (the
// game's board and pieces, river-board.js), the words beside it and the buttons under them. The lessons are
// river-course.js's; this draws them and takes the answers: points tapped, moves made, an opening's moves played in
// turn with the other side's answered for you, a choice. Where you've got to is kept (river:course), so the course
// opens where you left it, and the map ticks what you've done.
import { COURSE, LESSONS, lessonById, fenOf, inScript, tapAnswers, judge, lineMoves } from "./river-course.js";
import * as X from "./river-rules.js";
import { mountBoard } from "./river-board.js";

const KEY = "river:course";
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const read = () => { try { return { done: {}, at: null, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { done: {}, at: null }; } };
const P = name => X.pointNamed(name);

/** How far through the course you are: { done, of, next (the first lesson not done) }. */
export function progress() {
  const pr = read(), done = LESSONS.filter(x => pr.done[x.lesson.id]).length;
  return { done, of: LESSONS.length, next: LESSONS.find(x => !pr.done[x.lesson.id]) || null };
}

/**
 * The course's sheet, made once. opts: script() (the reader's characters), onPlay() (the last lesson's game against
 * Beginner), inFrame (a partner watching: nothing is kept). Returns { open(lessonId?) }.
 */
export function createCourse({ script = () => "traditional", onPlay = () => {}, inFrame = false }) {
  const dlg = document.createElement("dialog");
  dlg.className = "rv-learn pauses";
  dlg.setAttribute("aria-label", "Learn Xiangqi");
  dlg.innerHTML = `<div class="rv-learn-in">
    <header class="rv-learn-head"><button class="icon-btn" type="button" data-back aria-label="All the lessons">${BACK}</button>
      <div class="rv-learn-title"><b></b><small></small></div>
      <button class="icon-btn" type="button" data-close aria-label="Close">${CLOSE}</button></header>
    <div class="rv-learn-map"></div>
    <div class="rv-learn-lesson"><div class="rv-learn-board"><div class="rv-learn-sq"></div></div>
      <div class="rv-learn-side"><div class="rv-learn-text" aria-live="polite"></div>
        <div class="rv-learn-bar"><button class="rv-go quiet" type="button" data-hint>Hint</button><button class="rv-go" type="button" data-next>Next</button></div></div></div>
  </div>`;
  document.body.appendChild(dlg);
  const $ = sel => dlg.querySelector(sel);
  let pr = read();
  const save = () => { if (!inFrame) try { localStorage.setItem(KEY, JSON.stringify(pr)); } catch { /* private mode */ } };

  // ---------- a lesson's step ----------
  let L = null;            // { entry, i (the step), st: the step's own state }
  const board = mountBoard($(".rv-learn-sq"), { onMove, legal, onTap });
  const step = () => L.entry.lesson.steps[L.i];
  const T = text => inScript(text, script());

  function startStep(i) {
    L.i = i;
    const s = step(), fen = fenOf(s);
    L.st = { pos: X.parseFen(fen), done: !s.tap && !s.pick && !s.goal && !s.line && !s.quiz, found: [], no: [], tries: 0, last: null, hint: false, msg: "", ply: 0, picked: null, played: [] };
    pr.at = { id: L.entry.lesson.id, step: i };
    save();
    draw();
    if (s.line) setTimeout(autoReply, 500);
  }
  /** In a line, the other side's move is played for you, a moment after yours. */
  function autoReply() {
    const s = step();
    if (!L || !s.line || L.st.ply >= lineMoves(s).length) return;
    const mv = lineMoves(s)[L.st.ply];
    if (mv.side === s.you) return;
    const m = X.parseUci(mv.uci);
    L.st.played.push({ fen: X.toFen(L.st.pos), uci: mv.uci });
    L.st.pos = X.after(L.st.pos, m.from, m.to);
    L.st.last = m;
    L.st.ply++;
    L.st.msg = "";
    if (L.st.ply >= lineMoves(s).length) L.st.done = true;
    draw();
  }
  function legal(from) {
    const s = step();
    if (!L || L.st.done) return [];
    if (s.goal) return X.movesFrom(L.st.pos, from).map(m => m.to);
    if (s.line) {
      const mv = lineMoves(s)[L.st.ply];
      if (!mv || mv.side !== s.you) return [];
      return X.movesFrom(L.st.pos, from).map(m => m.to);
    }
    return [];
  }
  function onMove(from, to) {
    const s = step(), uci = X.uciOf(from, to);
    if (s.goal) {
      const verdict = judge(s, uci, script());
      const before = L.st.pos;
      L.st.pos = X.after(before, from, to);
      L.st.last = { from, to };
      if (verdict.ok) { L.st.done = true; L.st.msg = s.then ? T(s.then) : "Right."; draw(); return; }
      L.st.tries++;
      L.st.msg = verdict.why || "Not that one.";
      draw();
      setTimeout(() => {                                            // the wrong move shown a moment, then taken back
        if (!L || step() !== s || L.st.done) return;
        L.st.pos = before; L.st.last = null;
        if (L.st.tries >= 2) L.st.hint = true;
        draw();
      }, 900);
      return;
    }
    if (s.line) {
      const mv = lineMoves(s)[L.st.ply];
      if (!mv || mv.side !== s.you) return;
      if (uci !== mv.uci) {
        L.st.tries++;
        const m = X.parseUci(mv.uci), n = X.notate(L.st.pos, m.from, m.to, script());
        L.st.msg = L.st.tries >= 2 ? `This line goes ${n.cn} (${n.wxf}): the arrow shows it.` : "Not the line's move: try again (Hint shows it).";
        if (L.st.tries >= 2) L.st.hint = true;
        draw();
        return;
      }
      L.st.played.push({ fen: X.toFen(L.st.pos), uci });
      L.st.pos = X.after(L.st.pos, from, to);
      L.st.last = { from, to };
      L.st.ply++;
      L.st.tries = 0; L.st.hint = false; L.st.msg = "";
      if (L.st.ply >= lineMoves(s).length) L.st.done = true;
      draw();
      setTimeout(autoReply, 700);
    }
  }
  function onTap(p) {
    const s = step();
    if (!L || L.st.done) return;
    const name = X.nameOf(p);
    if (s.tap) {
      const answers = tapAnswers(s);
      if (answers.includes(name)) { if (!L.st.found.includes(name)) L.st.found.push(name); L.st.msg = ""; }
      else if (name !== s.tap) { flashNo(name); L.st.msg = "It can't go there."; }
      if (L.st.found.length === answers.length) { L.st.done = true; L.st.msg = s.then ? T(s.then) : `That's all ${answers.length === 1 ? "of it" : `${answers.length} of them`}.`; }
      draw();
    } else if (s.pick) {
      if (s.pick.includes(name)) { L.st.done = true; L.st.picked = name; L.st.msg = s.then ? T(s.then) : "Right."; }
      else { flashNo(name); L.st.msg = "Not that one."; }
      draw();
    }
  }
  function flashNo(name) {
    L.st.no = [name];
    const at = L.st;
    setTimeout(() => { if (L?.st === at) { at.no = []; draw(); } }, 700);
  }

  function marksOf(s) {
    const m = s.marks || {}, out = {
      dots: (m.dots || []).map(P), crosses: (m.crosses || []).map(P), rings: (m.rings || []).map(P), zones: m.zones || [],
      arrows: (m.arrows || []).map(([a, b]) => [P(a), P(b)]), ok: [], no: L.st.no.map(P),
    };
    if (s.tap) {
      out.ok = L.st.found.map(P);
      out.rings.push(P(s.tap));
      if (L.st.hint) out.dots.push(...tapAnswers(s).filter(a => !L.st.found.includes(a)).map(P));
    }
    if (s.pick && L.st.picked) out.rings.push(P(L.st.picked));
    if (s.goal && L.st.hint && !L.st.done && s.hint) { const h = X.parseUci(s.hint); out.arrows.push([h.from, h.to]); }
    if (s.line && L.st.hint && !L.st.done) { const h = X.parseUci(lineMoves(s)[L.st.ply].uci); out.arrows.push([h.from, h.to]); }
    if (!s.tap && !s.pick && !s.goal && !s.line) { /* words only: the marks as written */ }
    return out;
  }

  function draw() {
    if (!L) return;
    const s = step(), lesson = L.entry.lesson, n = lesson.steps.length;
    $(".rv-learn-title b").textContent = lesson.title;
    $(".rv-learn-title small").textContent = `${T(lesson.zh)} · ${L.i + 1} of ${n}`;
    const pos = L.st.pos;
    let check = -1;
    if (X.inCheck(pos)) for (let q = 0; q < 90; q++) if (pos.b[q] === (pos.red ? X.GENERAL : -X.GENERAL)) check = q;
    const hand = !L.st.done && (!!s.goal || (!!s.line && lineMoves(s)[L.st.ply]?.side === s.you));
    board.draw({ pos, bottomRed: s.you !== "black", facing: false, script: script(), last: L.st.last, hand, check, slide: false,
      tap: !L.st.done && (!!s.tap || !!s.pick), marks: marksOf(s) });
    // the words: the step's, what the last answer earned, a line's moves so far
    const parts = [`<p class="rv-learn-say">${esc(T(s.say))}</p>`];
    if (s.tap && !L.st.done) parts.push(`<p class="rv-learn-count">${L.st.found.length} of ${tapAnswers(s).length} found</p>`);
    if (s.line) parts.push(lineHtml(s));
    if (s.quiz) parts.push(quizHtml(s));
    if (L.st.msg) parts.push(`<p class="rv-learn-msg${L.st.done ? " ok" : " no"}">${esc(L.st.msg)}</p>`);
    $(".rv-learn-text").innerHTML = parts.join("");
    $(".rv-learn-text").scrollTop = $(".rv-learn-text").scrollHeight;
    const last = L.i === n - 1, entry = L.entry;
    const next = $("[data-next]");
    next.disabled = !L.st.done;
    next.textContent = s.play ? "Play Beginner" : last ? (LESSONS[entry.index + 1] ? "Next lesson" : "Finish") : "Next";
    $("[data-hint]").hidden = !(s.tap || s.goal || s.line);
    $("[data-hint]").disabled = L.st.done;
  }
  function lineHtml(s) {
    const moves = lineMoves(s), done = L.st.played;
    const items = done.map((x, i) => {
      const pos = X.parseFen(x.fen), m = X.parseUci(x.uci), n = X.notate(pos, m.from, m.to, script()), red = moves[i].side === "red";
      return `<span class="${red ? "red" : "black"}${i === done.length - 1 ? " last" : ""}">${red ? `<small>${Math.floor(i / 2) + 1}.</small>` : ""}<b>${esc(n.cn)}</b></span>`;
    }).join("");
    const note = done.length ? T(s.notes[done.length - 1]) : "";
    const whose = L.st.ply < moves.length ? (moves[L.st.ply].side === s.you ? "Your move." : "") : "The line is played: on to the next.";
    return `<p class="rv-learn-line">${items || "<i>No moves yet</i>"}</p>${note ? `<p class="rv-learn-note">${esc(note)}</p>` : ""}${whose ? `<p class="rv-learn-whose">${whose}</p>` : ""}`;
  }
  function quizHtml(s) {
    return `<div class="rv-learn-quiz">${s.quiz.map((o, i) => {
      const cls = L.st.done ? (i === s.answer ? " ok" : L.st.picked === i ? " no" : "") : L.st.picked === i ? " no" : "";
      return `<button type="button" class="rv-learn-opt${cls}" data-opt="${i}" ${L.st.done ? "disabled" : ""}>${esc(T(o))}</button>`;
    }).join("")}</div>`;
  }
  $(".rv-learn-text").addEventListener("click", e => {
    const b = e.target.closest("[data-opt]");
    if (!b || !L || L.st.done) return;
    const s = step(), i = Number(b.dataset.opt);
    L.st.picked = i;
    if (i === s.answer) { L.st.done = true; L.st.msg = T(s.why || "Right."); }
    else L.st.msg = "Not quite: try again.";
    draw();
  });
  $("[data-hint]").addEventListener("click", () => {
    if (!L || L.st.done) return;
    const s = step();
    L.st.hint = true;
    if (s.tap) { L.st.msg = "There they are: tap them all."; }
    if (s.goal && !s.hint) L.st.msg = "Look at every move of the pieces that could do it.";
    draw();
  });
  $("[data-next]").addEventListener("click", () => {
    if (!L || !L.st.done) return;
    const s = step();
    if (s.play) { finish(); dlg.close(); onPlay(); return; }
    if (L.i < L.entry.lesson.steps.length - 1) { startStep(L.i + 1); return; }
    finish();
    const after = LESSONS[L.entry.index + 1];
    if (after) openLesson(after.lesson.id); else showMap();
  });
  function finish() {
    pr.done[L.entry.lesson.id] = Date.now();
    pr.at = null;
    save();
  }

  // ---------- the map ----------
  function showMap() {
    L = null;
    dlg.classList.add("map");
    $(".rv-learn-title b").textContent = "Learn Xiangqi";
    const p = progress();
    $(".rv-learn-title small").textContent = `象棋 · ${p.done} of ${p.of} lessons`;
    const cont = pr.at && lessonById(pr.at.id) ? lessonById(pr.at.id) : p.next;
    $(".rv-learn-map").innerHTML = `${cont ? `<button type="button" class="rv-go rv-learn-go" data-lesson="${cont.lesson.id}">${p.done || pr.at ? "Continue" : "Start"}: ${esc(cont.lesson.title)}</button>` : `<p class="rv-learn-all">Every lesson done. Play a game, or go over any lesson again.</p>`}`
      + COURSE.map(c => `<section class="rv-learn-ch"><h3>${esc(c.title)} <span>${esc(T(c.zh))}</span></h3><ol>${c.lessons.map(l => {
        const done = !!pr.done[l.id], here = cont?.lesson.id === l.id;
        return `<li><button type="button" data-lesson="${l.id}" class="${done ? "done" : ""}${here ? " here" : ""}"><span class="tick" aria-hidden="true">${done ? "✓" : here ? "●" : ""}</span><span class="t">${esc(l.title)}</span><span class="zh">${esc(T(l.zh))}</span></button></li>`;
      }).join("")}</ol></section>`).join("") + `<button type="button" class="rv-go quiet rv-learn-rules" data-rules>The rules on one page</button>`;
  }
  $(".rv-learn-map").addEventListener("click", e => {
    const b = e.target.closest("[data-lesson]");
    if (b) openLesson(b.dataset.lesson, pr.at?.id === b.dataset.lesson ? pr.at.step : 0);
  });
  function openLesson(id, at = 0) {
    const entry = lessonById(id);
    if (!entry) { showMap(); return; }
    dlg.classList.remove("map");
    L = { entry, i: 0, st: null };
    startStep(Math.min(at, entry.lesson.steps.length - 1));
  }
  $("[data-back]").addEventListener("click", () => { if (L) showMap(); else dlg.close(); });
  $("[data-close]").addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => { L = null; });
  addEventListener("resize", () => { if (dlg.open && L) draw(); });

  return {
    /** Opens the course on the map, or on a lesson. */
    open(id = null) {
      pr = read();
      if (!dlg.open) dlg.showModal();
      if (id) openLesson(id); else showMap();
    },
    get isOpen() { return dlg.open; },
  };
}
