// Solo play: generated boards, progress in this browser's localStorage, and optionally synced to a run
// that other devices follow (run.js).
import { APP_VERSION, BANK, BANK_SIZE, POOL_CATS, GROUPS, PLURAL, SQUARES, nameMatches, shuffled, wordsKey, cleanSettings, defaultSettings, dealTopics, formatTime } from "./core.js";
import { generate, encode, decode, describe, hintFor, classify, groupIndexOf } from "./gen.js";
import {
  MODES, emptyDeck, cleanDeck, learnFromBoard, learnFromClues, deckStats, clueStats,
  cleanSeen, markSeen, seenTexts, forgetSeen, seenStats,
} from "./learn.js";
import { createRun, cleanCode, validCode } from "./run.js";
import { busy } from "./loading.js";
import { recognised, pairKey } from "./known.js";
import * as view from "./view.js";
import { part, action, line, choice, ticks, isPaused, onPause, todayPart } from "./menu.js";
import { sure } from "./sure.js";
import { modeChoice } from "./crates-board.js";
import { topicsPart } from "./topics-ui.js";
import { subjectsOn } from "./topics-on.js";
import { today, noteComparable, noteStreak } from "./suite.js";
import { CRATES_MODES, cratesMode, setCratesMode } from "./crates-mode.js";
import { roundOver } from "./random.js";

const MAX_MISTAKES = 4;
const CLUES = 4;          // per board
const STORE_KEY = "crates:v2";
const RECENT_ANSWERS = 16, RECENT_WORDS = 120, HISTORY = 60;

/** Fills in anything missing from a stored run (old saves, or a run arriving from another device). */
function normalise(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  s.settings = cleanSettings(s.settings);
  s.settings.difficulty = "mixed";           // the Difficulty choice went on 4 November 2026 (Korbi: the menu is the minimum it needs to be)
  s.pool = "country";                       // Crates deals countries; Classic is Lots, a page of its own
  s.n = s.n || 0;
  s.history = s.history || [];
  s.recentA = s.recentA || [];
  s.recentW = s.recentW || [];
  s.mode = MODES.includes(s.mode) ? s.mode : s.learning === true ? "learn" : "off";   // was an on/off switch
  delete s.learning;
  if (s.cur && !("mode" in s.cur)) { s.cur.mode = s.cur.learn ? "learn" : "off"; delete s.cur.learn; }
  s.deck = cleanDeck(s.deck);
  s.seen = cleanSeen(s.seen);
  return s;
}

// ---------- today's board ----------
// The same board for everyone today: dealt from the date on the standard puzzles (countries) and settings, with nothing of
// yours passed in (recent words, learning, clues seen). It counts for your best, by points and then time, on the first
// go only: a second would know the answers.
const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** A board's result as one number, higher better: its points (up to 8), then the quicker the better. */
export const boardScore = (pts, ms) => pts * 100000 + (99999 - Math.min(99999, Math.round(ms / 1000)));

const syncError = e => (/permission/i.test(String(e?.message || e))
  ? "Syncing isn't switched on in Firebase yet" : "Couldn't reach the sync server");

export function createSolo({ setPoolParam, setBoardParam }) {
  const store = normalise((() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
  })());
  let active = false;           // solo is on screen (not a together game)
  const run = createRun({
    snapshot: () => store, adopt: adoptRun, notice: msg => view.toast(msg, 4500),
    version: BANK_SIZE, app: APP_VERSION, usable: s => !s.cur || !!decode(s.cur.code),
  });

  // Playing time. The clock runs while a board is open and pauses only on an explicit sign the page
  // was put away (hidden, or left). It never trusts a one-off read of document.visibilityState: some
  // iPhone browsers report "hidden" for a page you're looking at. Any tap restarts a paused clock.
  const clock = {
    from: null,                                   // start of the current stretch; null = paused
    book() {                                      // add the stretch so far to the open board
      const g = store.cur;
      if (this.from === null) return;
      if (g && !g.done) g.ms = (g.ms || 0) + Math.max(0, Date.now() - this.from);
      this.from = Date.now();
    },
    run() { this.book(); if (this.from === null && store.cur && !store.cur.done && !isPaused()) this.from = Date.now(); },
    pause() { this.book(); this.from = null; },
  };
  const persistLocal = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  };
  const persist = () => { persistLocal(); run.changed(); };
  const save = () => { clock.book(); persist(); };
  const putAway = () => {
    if (active && clock.from !== null) { clock.pause(); persist(); }   // nothing to save if it wasn't running
    run.flush();
  };
  const wake = () => { if (active) clock.run(); };
  document.addEventListener("visibilitychange", () => (document.hidden ? putAway() : wake()));
  onPause(() => clock.pause(), () => clock.run());   // the menu stops the board's clock too
  window.addEventListener("pagehide", putAway);
  window.addEventListener("pageshow", wake);
  document.addEventListener("pointerdown", wake, true);
  document.addEventListener("keydown", wake, true);

  let board, info, selected = new Set(), pendingGroup = null;
  let clueShown = null;         // word whose clue is on show
  const game = () => store.cur;
  const cluesLeft = () => CLUES - game().revealed.length;
  const score = g => g.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);

  function begin(b, code, day = null) {
    clock.pause();          // book the time so far to the board being left
    store.n += 1;
    store.cur = {
      code: code || encode(b), n: store.n, order: shuffled(describe(b).flatMap(g => g.words)),
      found: [], mistakes: 0, guesses: [], tried: [], revealed: [], done: false, ms: 0,
      mode: day ? "off" : store.mode, ...(day && { daily: day }),
    };
    if (day) store.daily = { key: day };                 // today's board is had: one go
    markSeen(store.seen, b);
    b.groups.forEach(g => {
      store.recentA = [g.a, ...store.recentA.filter(a => a !== g.a)].slice(0, RECENT_ANSWERS);
      g.w.forEach(i => { store.recentW = [`${g.a}.${i}`, ...store.recentW].slice(0, RECENT_WORDS); });
    });
    save();
    load();
  }

  /** Today's board, or (already had) what it scored. */
  function daily() {
    const day = today();
    if (store.daily?.key === day) {
      const d = store.daily;
      view.toast(d.pts != null ? `Today's board: ${d.pts}/8 in ${formatTime(d.ms)}. A new one tomorrow` : "You've had today's board. A new one tomorrow", 3500);
      return false;
    }
    const b = generate({ pool: "country", settings: defaultSettings(), rng: seeded(day) });
    if (!b) { view.toast("Today's board couldn't be dealt", 3000); return false; }
    begin(b, null, day);
    return true;
  }

  function fresh() {
    const mode = store.mode;
    const learn = mode === "learn" || mode === "clues" ? store.deck : null;
    if (learn) learn.t += 1;
    const opts = { pool: store.pool, settings: { ...store.settings, topics: dealTopics(subjectsOn()) }, recentA: store.recentA, recentW: store.recentW,
      learn, review: mode === "clues" ? "clues" : "all" };
    const deal = () => generate(mode === "norepeat" ? { ...opts, seen: seenTexts(store.seen) } : opts);
    let b = deal();
    if (!b && mode === "norepeat") {
      forgetSeen(store.seen, POOL_CATS[store.pool]);
      view.toast("You've seen every clue these settings allow, so they start over", 3500);
      b = deal();
    }
    if (!b) {
      view.toast("Not enough words for those settings, so this board uses Balanced", 3500);
      b = generate({ pool: store.pool, settings: defaultSettings(), recentA: store.recentA });
    }
    begin(b);
  }

  function load() {
    board = decode(game().code);
    if (!board) { store.cur = null; fresh(); return; }
    info = describe(board);
    clock.run();            // start, or resume, this board's clock
    selected.clear();
    pendingGroup = null;
    setBoardParam(null);
    clueShown = null;
    draw();
  }

  function vm() {
    const g = game();
    const taken = new Set(g.found.flatMap(f => info[f.g].words));
    if (g.done) info.forEach(gr => gr.words.forEach(w => taken.add(w)));
    const levelOf = w => board.groups[groupIndexOf(board, w)].level;
    const cells = g.order.filter(w => !taken.has(w)).map(w => {
      const open = g.revealed.includes(w);
      const badge = open ? { kind: "open", level: levelOf(w) }
        : selected.has(w) && !g.done ? { kind: cluesLeft() > 0 ? "offer" : "spent" } : null;
      return { id: w, text: w, sel: selected.has(w), badge };
    });
    const clue = clueShown && g.revealed.includes(clueShown) && !taken.has(clueShown)
      ? { label: clueShown, text: hintFor(board, clueShown), level: levelOf(clueShown) } : null;
    const solved = g.found.map(f => ({ ...f }));
    if (g.done) info.forEach((_, i) => { if (!solved.some(r => r.g === i)) solved.push({ g: i, missed: true }); });
    const pts = score(g), won = g.found.length === 4, time = formatTime(g.ms || 0);
    const rows = g.guesses.map(ls => ls.map(l => SQUARES[l]).join("")).join("\n");
    const names = g.found.map(f => f.named ? "✓" : "½").join("");
    const used = `Mistakes ${g.mistakes}/${MAX_MISTAKES} · Clues used ${g.revealed.length}/${CLUES}`;
    const link = `${location.origin}${location.pathname}?b=${g.code}`;
    const tags = g.done && g.tags;
    return {
      mode: "solo", category: board.cat, pool: store.pool, label: g.n, boardKey: g.code,
      groupsInfo: tags ? info.map(gr => ({ ...gr, details: gr.details.map(([w, h]) => [w, h, tags[w]]) })) : info,
      modeNote: modeNote(),
      cells, clue, solved,
      team: { lives: MAX_MISTAKES - g.mistakes, maxLives: MAX_MISTAKES, clues: cluesLeft(), maxClues: CLUES },
      pending: pendingGroup !== null ? { g: pendingGroup, mine: true } : null,
      canSubmit: selected.size === 4 && !g.done && pendingGroup === null,
      done: g.done,
      resultLine: `${won ? "" : "Out of mistakes · "}${pts} of 8 in ${time}`,
      subLine: used,
      shareGrid: rows + (names ? `\n${names}` : ""),
      shareText: [`Crates · ${PLURAL[board.cat]}`, `${won ? "" : "Out of mistakes · "}${pts}/8 in ${time}`, used,
        rows, ...(names ? [`Named ${names}`] : []), link].join("\n"),
      canShare: true, canNext: true, nextLabel: "Next board",
    };
  }
  const draw = () => view.render(vm());

  /** Another device moved the run on: take its whole state over. */
  function adoptRun(data) {
    clock.pause();
    const next = normalise(data);
    for (const k of Object.keys(store)) delete store[k];
    Object.assign(store, next);
    persistLocal();
    if (!active) return;
    setPoolParam(store.pool);
    if (takeMode() || !store.cur || !decode(store.cur.code)) fresh(); else load();
    clock.pause();          // the other device is the one being played: this clock waits for a tap here
    view.toast("Caught up with your other device", 2500);
    if (view.menuTag() === "solo") handlers.menu();
  }

  // an old ?run= link (from before the solo code) still joins its run
  async function joinRun(raw) {
    const code = cleanCode(raw);
    if (!validCode(code)) { view.toast("That code doesn't look right: it's 8 letters", 2500); return; }
    if (code === run.code()) { view.toast("This device already follows that run", 2200); return; }
    const progress = store.history.length > 0 || (store.cur && store.cur.guesses.length > 0);
    if (progress && !(await sure("Switch this device to the synced run? Its own progress here will be replaced.", { yes: "Switch" }))) return;
    const done = busy("Fetching your run");
    try {
      const ok = await run.join(code);
      done();
      view.toast(ok ? `This device now follows run ${code}` : "No run with that code", 3000);
    } catch (e) { done(); console.error(e); view.toast(syncError(e), 4500); }
    if (view.menuTag() === "solo") handlers.menu();
  }

  function end() {
    const g = game();
    clock.pause();
    g.done = true;
    if (g.mode === store.mode && g.mode === "learn") g.tags = learnFromBoard(store.deck, board, g);
    if (g.mode === store.mode && g.mode === "clues") g.tags = learnFromClues(store.deck, board, g);
    store.history = [{ n: g.n, code: g.code, cat: board.cat, pts: score(g), won: g.found.length === 4,
      mistakes: g.mistakes, clues: g.revealed.length, ms: g.ms }, ...store.history].slice(0, HISTORY);
    if (g.mode !== "learn" && g.mode !== "clues") noteStreak("crates", g.found.length === 4);   // the longest win streak, on the games screen
    if (g.daily) {                                         // today's board: it counts for your best, points then time
      store.daily = { key: g.daily, pts: score(g), ms: g.ms || 0 };
      noteComparable("crates", boardScore(score(g), g.ms || 0), g.daily);
    }
    roundOver("crates");
  }

  const count = x => x.toLocaleString("en-GB");

  /** The line under the board. */
  function modeNote() {
    const review = n => (n ? `${n} to review` : "nothing to review yet");
    if (store.mode === "learn") return `Learn · ${review(deckStats(store.deck).review)}`;
    if (store.mode === "clues") return `Clue learn · ${review(clueStats(store.deck).review)}`;
    if (store.mode === "norepeat") {
      const s = seenStats(store.seen), left = POOL_CATS[store.pool].reduce((n, c) => n + s[c].total - s[c].seen, 0);
      return `No repeats · ${count(left)} new clues left`;
    }
    return null;
  }

  /** The mode set on the games screen's Choose sheet (learning-mode.js) becomes the run's. A board not yet touched is
   *  dealt again under it; one begun finishes as it was dealt. */
  function takeMode() {
    const mode = cratesMode();
    if (mode === store.mode) return false;
    store.mode = mode;
    save();
    const g = store.cur;
    return !!g && mode !== "off" && !g.done && !g.guesses.length && !g.revealed.length && !g.daily;
  }

  // Crates' cards and seen clues forgotten from the games screen (crates-mode.js): drop this run's copy too, so it isn't written back
  addEventListener("crates-learning-reset", () => { store.deck = emptyDeck(); store.seen = {}; save(); draw(); });

  const handlers = {
    toggle(w) {
      const g = game();
      if (g.done || pendingGroup !== null) return;
      if (selected.has(w)) selected.delete(w);
      else if (selected.size < 4) selected.add(w);
      else return;
      draw();
    },
    clue(w) {
      const g = game();
      if (g.done) return;
      if (!g.revealed.includes(w)) {
        if (cluesLeft() === 0) { view.toast("No clues left on this board", 1800); return; }
        g.revealed.push(w);
        save();
      }
      clueShown = w;
      draw();
    },
    submit() {
      const g = game();
      if (selected.size !== 4 || g.done || pendingGroup !== null) return;
      const words = [...selected];
      const key = wordsKey(words);
      if (g.tried.includes(key)) { view.toast("Already tried", 1600); return; }
      g.tried.push(key);
      const r = classify(board, words);
      g.guesses.push(r.lv);
      if (r.res === "right") {
        pendingGroup = r.g;
        selected.clear();
        save();
        draw();
        return;
      }
      g.mistakes++;
      if (g.mistakes >= MAX_MISTAKES) {
        end();
        selected.clear();
        clueShown = null;
        view.toast("Out of mistakes", 2500, "bad");
      } else {
        view.toast(r.res === "one" ? "One away" : "Not a crate", 1800, "bad");
      }
      save();
      view.shake();
      setTimeout(draw, g.done ? 0 : 380);
    },
    name(guess) {
      const g = game();
      if (pendingGroup === null) return;
      const ans = BANK[board.groups[pendingGroup].a];
      const named = guess !== null && nameMatches(guess, ans);
      g.found.push({ g: pendingGroup, named, guess: named ? null : (guess || null) });
      // a crate solved and named: its four clues are recognised, so Punt can ask you to name them (known.js)
      if (named) { const grp = board.groups[pendingGroup], A = BANK[grp.a]; recognised(grp.w.map(i => A.words[i]?.entity).filter(Boolean).map(e => pairKey(A.entity, e))); }   // w: positions in the answer's clues }
      pendingGroup = null;
      if (g.found.length === 4) end();
      save();
      clueShown = null;
      view.toast(named ? `${ans.name}, full marks` : `It was ${ans.name}, half marks`, 2200);
      draw();
    },
    clear() { selected.clear(); draw(); },
    shuffle() { game().order = shuffled(game().order); save(); draw(); },
    next() { fresh(); },
    async share() {
      view.toast(await view.copyText(vm().shareText) ? "Result copied" : "Couldn't copy", 1600);
    },
    // the menu's Mode: Countries is this page; Classic is Lots, which is Crates' other half (README, Crates and Lots)
    async classic() {
      if (!game().done && game().guesses.length && !(await sure("Leave this board unfinished?", { yes: "Leave it" }))) { handlers.menu(); return; }
      location.href = "lots.html";
    },
    menu() {
      // the menu: Play (a new board, or skip this one), Content (topics and difficulty, in Settings), About (your stats,
      // learning, recent boards to replay). Your other devices follow this run through the solo code on the games screen.
      view.openMenu(body => {
        const g = game();
        part(body, "play").append(action(g.done ? "New board" : "Skip board", async () => {
          if (!g.done && g.guesses.length && !(await sure("Leave this board unfinished?", { yes: "Leave it" }))) return;
          // clue learn: a tile whose clue you opened comes back even if you skip the board
          if (!g.done && g.mode === "clues" && store.mode === "clues") learnFromClues(store.deck, board, g);
          fresh();
        }, "primary"));
        const had = store.daily?.key === today(), playing = g.daily === today() && !g.done;
        todayPart(body, {
          done: had && !playing, result: store.daily?.pts != null ? `${store.daily.pts} of 8 in ${formatTime(store.daily.ms)}` : "",   // one go: leaving it unfinished is a go had
          play: () => { daily(); }, playing, busy: !g.done && g.guesses.length > 0,
        });
        part(body, "content").append(...modeChoice("country", handlers.classic),
          // Korbi, 7 Nov 2026: learning and the regions are settings here like the mode, not a sheet of their own
          choice("Learning", CRATES_MODES, store.mode, v => { setCratesMode(v); if (takeMode()) fresh(); draw(); }),
          ticks("Countries from", GROUPS.country, GROUPS.country.map(([k]) => k).filter(k => !store.settings.off.includes(k)),
            on => { store.settings = cleanSettings({ ...store.settings, off: GROUPS.country.map(([k]) => k).filter(k => !on.includes(k)) }); save(); }),
          ...topicsPart());
        const about = part(body, "about"), done = store.history.length;
        if (done) {
          const total = store.history.reduce((t, r) => t + r.pts, 0), perfect = store.history.filter(r => r.pts === 8).length;
          about.append(line(`${done} played · average ${(total / done).toFixed(1)} of 8 · ${perfect} perfect`));
        }
      }, "solo");
    },
  };

  let following = false;
  return {
    settings: () => store.settings,
    pool: () => store.pool,
    /** runCode: from a ?run= link opened on this device. */
    start(pool, code, runCode) {
      active = true;
      if (!following) { following = true; run.start(); }
      if (pool && pool !== store.pool) { store.pool = pool; save(); }
      setPoolParam(store.pool);
      view.bind(handlers);
      const redeal = takeMode();
      const shared = code ? decode(code) : null;
      if (code && !shared) view.toast("That board link isn't valid", 3000);
      if (shared) begin(shared, code.trim().toLowerCase());
      else if (redeal || !store.cur || !decode(store.cur.code)) fresh();
      else load();
      if (runCode) joinRun(runCode);
    },
    /** A together game takes the screen: stop the clock, keep the run as it is. */
    suspend() {
      if (!active) return;
      clock.pause();
      persist();
      active = false;
    },
  };
}
