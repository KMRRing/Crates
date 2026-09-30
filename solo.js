// Solo play: generated boards, progress in this browser's localStorage, and optionally synced to a run
// that other devices follow (run.js).
import { BANK, PLURAL, SQUARES, nameMatches, shuffled, wordsKey, cleanSettings, defaultSettings, formatTime } from "./core.js";
import { generate, encode, decode, describe, hintFor, classify, groupIndexOf } from "./gen.js";
import { emptyDeck, cleanDeck, learnFromBoard, deckStats, REVIEW_GAP } from "./learn.js";
import { createRun, cleanCode, validCode } from "./run.js";
import * as view from "./view.js";

const MAX_MISTAKES = 4;
const CLUES = 4;          // per board
const STORE_KEY = "crates:v2";
const RECENT_ANSWERS = 16, RECENT_WORDS = 120, HISTORY = 60;

/** Fills in anything missing from a stored run (old saves, or a run arriving from another device). */
function normalise(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  s.settings = cleanSettings(s.settings);
  s.pool = s.pool || "mixed";
  s.n = s.n || 0;
  s.history = s.history || [];
  s.recentA = s.recentA || [];
  s.recentW = s.recentW || [];
  s.learning = s.learning === true;
  s.deck = cleanDeck(s.deck);
  return s;
}

const syncError = e => (/permission/i.test(String(e?.message || e))
  ? "Syncing isn't switched on in Firebase yet" : "Couldn't reach the sync server");

export function createSolo({ onTogether, modes, setPoolParam, setBoardParam }) {
  const store = normalise((() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
  })());
  let active = false;           // solo is on screen (not a together game)
  const run = createRun({ snapshot: () => store, adopt: adoptRun, notice: msg => view.toast(msg, 3500) });

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
    run() { this.book(); if (this.from === null && store.cur && !store.cur.done) this.from = Date.now(); },
    pause() { this.book(); this.from = null; },
  };
  const persistLocal = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  };
  const persist = () => { persistLocal(); run.changed(); };
  const save = () => { clock.book(); persist(); };
  const putAway = () => {
    if (active) { clock.pause(); persist(); }
    run.flush();
  };
  const wake = () => { if (active) clock.run(); };
  document.addEventListener("visibilitychange", () => (document.hidden ? putAway() : wake()));
  window.addEventListener("pagehide", putAway);
  window.addEventListener("pageshow", wake);
  document.addEventListener("pointerdown", wake, true);
  document.addEventListener("keydown", wake, true);

  let board, info, selected = new Set(), pendingGroup = null;
  let clueShown = null;         // word whose clue is on show
  const game = () => store.cur;
  const cluesLeft = () => CLUES - game().revealed.length;
  const score = g => g.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);

  function begin(b, code) {
    clock.pause();          // book the time so far to the board being left
    store.n += 1;
    store.cur = {
      code: code || encode(b), n: store.n, order: shuffled(describe(b).flatMap(g => g.words)),
      found: [], mistakes: 0, guesses: [], tried: [], revealed: [], done: false, ms: 0,
      learn: store.learning,
    };
    b.groups.forEach(g => {
      store.recentA = [g.a, ...store.recentA.filter(a => a !== g.a)].slice(0, RECENT_ANSWERS);
      g.w.forEach(i => { store.recentW = [`${g.a}.${i}`, ...store.recentW].slice(0, RECENT_WORDS); });
    });
    save();
    load();
  }

  function fresh() {
    const learn = store.learning ? store.deck : null;
    if (learn) learn.t += 1;
    let b = generate({ pool: store.pool, settings: store.settings, recentA: store.recentA, recentW: store.recentW, learn });
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
    const used = `Lives used ${g.mistakes}/${MAX_MISTAKES} · Clues used ${g.revealed.length}/${CLUES}`;
    const link = `${location.origin}${location.pathname}?b=${g.code}`;
    const tags = g.done && g.tags;
    return {
      mode: "solo", category: board.cat, pool: store.pool, label: g.n, boardKey: g.code,
      groupsInfo: tags ? info.map(gr => ({ ...gr, details: gr.details.map(([w, h]) => [w, h, tags[w]]) })) : info,
      modeNote: store.learning ? learningNote() : null,
      cells, clue, solved,
      team: { lives: MAX_MISTAKES - g.mistakes, maxLives: MAX_MISTAKES, clues: cluesLeft(), maxClues: CLUES },
      pending: pendingGroup !== null ? { g: pendingGroup, mine: true } : null,
      canSubmit: selected.size === 4 && !g.done && pendingGroup === null,
      done: g.done,
      resultLine: `${won ? "" : "Out of lives · "}${pts} of 8 in ${time}`,
      subLine: used,
      shareGrid: rows + (names ? `\n${names}` : ""),
      shareText: [`Crates · ${PLURAL[board.cat]}`, `${won ? "" : "Out of lives · "}${pts}/8 in ${time}`, used,
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
    if (store.cur && decode(store.cur.code)) load(); else fresh();
    view.toast("Caught up with your other device", 2500);
    if (view.menuTag() === "solo") handlers.menu();
  }

  const runLink = code => `${location.origin}${location.pathname}?run=${code}`;

  async function syncRun() {
    view.toast("Setting up sync…", 3000);
    try {
      const code = await run.create();
      view.toast(code ? `Synced as ${code}` : "Couldn't set up sync, try again", 3000);
    } catch (e) { console.error(e); view.toast(syncError(e), 4500); }
    if (view.menuTag() === "solo") handlers.menu();
  }

  async function joinRun(raw) {
    const code = cleanCode(raw);
    if (!validCode(code)) { view.toast("That code doesn't look right: it's 8 letters", 2500); return; }
    if (code === run.code()) { view.toast("This device already follows that run", 2200); return; }
    const progress = store.history.length > 0 || (store.cur && store.cur.guesses.length > 0);
    if (progress && !confirm("Switch this device to the synced run? Its own progress here will be replaced.")) return;
    view.toast("Fetching your run…", 3000);
    try {
      const ok = await run.join(code);
      view.toast(ok ? `This device now follows run ${code}` : "No run with that code", 3000);
    } catch (e) { console.error(e); view.toast(syncError(e), 4500); }
    if (view.menuTag() === "solo") handlers.menu();
  }

  function end() {
    const g = game();
    clock.pause();
    g.done = true;
    if (g.learn && store.learning) g.tags = learnFromBoard(store.deck, board, g);
    store.history = [{ n: g.n, code: g.code, cat: board.cat, pts: score(g), won: g.found.length === 4,
      mistakes: g.mistakes, clues: g.revealed.length, ms: g.ms }, ...store.history].slice(0, HISTORY);
  }

  function learningNote() {
    const n = deckStats(store.deck).review;
    return `Learning mode · ${n ? `${n} word${n === 1 ? "" : "s"} to review` : "nothing to review yet"}`;
  }

  function learningSummary() {
    const s = deckStats(store.deck), n = x => x.toLocaleString("en-GB");
    return `${n(s.review)} to review · ${n(s.learned)} learned · ${n(s.seen + s.unseen)} still to learn`;
  }

  function setLearning(on) {
    store.learning = on;
    save();
    const g = game();
    if (on && !g.done && !g.guesses.length && !g.revealed.length) fresh();   // untouched board: deal a learning one now
    else { view.toast(on ? "Learning mode starts with the next board" : "Learning mode off", 2200); draw(); }
    settingsSheet();
  }

  function settingsSheet() {
    view.openSettings({
      settings: store.settings, editable: true, pool: store.pool,
      note: "Everything below applies from the next board.",
      onChange: s => { store.settings = cleanSettings(s); save(); },
      onBack: () => handlers.menu(),
      learning: {
        on: store.learning,
        lines: [`Missed words come back ${REVIEW_GAP[0]} to ${REVIEW_GAP[1]} boards later, in a new crate with new companions. Words you get right retire to the bottom of the deck.`,
          learningSummary()],
        onToggle: setLearning,
        onReset: () => {
          if (!confirm("Forget everything learning mode knows about you?")) return;
          store.deck = emptyDeck();
          save();
          draw();
          settingsSheet();
        },
      },
    });
  }

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
        view.toast("Out of lives", 2500);
      } else {
        view.toast(r.res === "one" ? "One away" : "Not a crate", 1800);
      }
      save();
      const grid = document.getElementById("grid");
      grid.classList.remove("shake"); void grid.offsetWidth; grid.classList.add("shake");
      setTimeout(draw, g.done ? 0 : 380);
    },
    name(guess) {
      const g = game();
      if (pendingGroup === null) return;
      const ans = BANK[board.groups[pendingGroup].a];
      const named = guess !== null && nameMatches(guess, ans);
      g.found.push({ g: pendingGroup, named, guess: named ? null : (guess || null) });
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
    pool(value) {
      store.pool = value;
      setPoolParam(value);
      save();
      if (value !== "mixed" && value !== board.cat && !game().guesses.length) fresh();
      else { view.toast("Next board comes from the new pool", 2000); draw(); }
    },
    menu() {
      view.openMenu((body, close) => {
        const together = document.createElement("div");
        together.className = "together";
        Object.entries(modes).forEach(([mode, m]) => {
          const b = document.createElement("button");
          b.className = "btn primary";
          b.innerHTML = "<b></b><small></small>";
          b.firstChild.textContent = `Play ${m.label.toLowerCase()}`;
          b.lastChild.textContent = m.blurb;
          b.addEventListener("click", () => { close(); onTogether(mode, store.pool, store.settings); });
          together.appendChild(b);
        });
        body.appendChild(together);

        const row = document.createElement("div");
        row.className = "controls";
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "btn";
        settingsBtn.textContent = "Settings";
        settingsBtn.addEventListener("click", settingsSheet);
        const newBtn = document.createElement("button");
        newBtn.className = "btn";
        newBtn.textContent = game().done ? "New board" : "Skip board";
        newBtn.addEventListener("click", () => {
          if (!game().done && game().guesses.length && !confirm("Leave this board unfinished?")) return;
          close(); fresh();
        });
        row.append(settingsBtn, newBtn);
        body.appendChild(row);

        const h = document.createElement("h3");
        h.textContent = "Recent boards";
        body.appendChild(h);
        const list = document.createElement("ol");
        list.className = "pick-list";
        store.history.slice(0, 15).forEach(r => {
          const li = document.createElement("li");
          const b = document.createElement("button");
          b.innerHTML = "<span></span><span class=\"st\"></span>";
          b.firstChild.textContent = `No. ${r.n}  ${PLURAL[r.cat]}`;
          b.lastChild.textContent = `${r.won ? "" : "out · "}${r.pts}/8${r.ms ? ` · ${formatTime(r.ms)}` : ""}`;
          b.title = "Replay this board";
          b.addEventListener("click", () => { close(); const d = decode(r.code); if (d) begin(d, r.code); });
          li.appendChild(b);
          list.appendChild(li);
        });
        if (!store.history.length) {
          const li = document.createElement("li");
          li.className = "stats";
          li.textContent = "Nothing finished yet.";
          list.appendChild(li);
        }
        body.appendChild(list);

        if (store.learning) {
          const lp = document.createElement("p");
          lp.className = "stats";
          lp.textContent = `Learning: ${learningSummary()}`;
          body.appendChild(lp);
        }
        const done = store.history.length;
        if (done) {
          const total = store.history.reduce((s, r) => s + r.pts, 0);
          const perfect = store.history.filter(r => r.pts === 8).length;
          const stats = document.createElement("p");
          stats.className = "stats";
          stats.textContent = `${done} played · average ${(total / done).toFixed(1)} of 8 · ${perfect} perfect`;
          body.appendChild(stats);
        }

        // ---- carry this run over to other devices ----
        const add = (tag, cls, text, parent = body) => {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          if (text != null) e.textContent = text;
          parent.appendChild(e);
          return e;
        };
        add("h3", null, "Your other devices");
        const code = run.code();
        if (code) {
          add("p", "stats", `This run is synced as ${code}: the board you're on, your history, settings and learning. Open the link on your other device to carry on there.`);
          add("p", "room-link", runLink(code));
          const row = add("div", "controls");
          add("button", "btn", "Copy link", row).addEventListener("click", async () => {
            view.toast(await view.copyText(runLink(code)) ? "Link copied" : runLink(code), 2500);
          });
          if (navigator.share) {
            add("button", "btn", "Share link", row).addEventListener("click", async () => {
              try { await navigator.share({ title: "My Crates run", url: runLink(code) }); } catch { /* dismissed */ }
            });
          }
          add("button", "link", "Stop syncing on this device").addEventListener("click", () => {
            run.unlink();
            view.toast("This device keeps its own copy and stops syncing", 2500);
            handlers.menu();
          });
        } else {
          add("p", "stats", "Carry this run over to your phone or computer: the board you're on, your history, settings and learning.");
          add("button", "btn primary wide", "Sync this run").addEventListener("click", syncRun);
          const row = add("form", "join-run");
          const input = add("input", null, null, row);
          input.placeholder = "Code from other device";
          input.autocapitalize = "characters";
          input.autocomplete = "off";
          input.spellcheck = false;
          add("button", "btn", "Join", row).type = "submit";
          row.addEventListener("submit", e => { e.preventDefault(); joinRun(input.value); });
        }
      }, "solo");
    },
  };

  let following = false;
  return {
    settings: () => store.settings,
    /** runCode: from a ?run= link opened on this device. */
    start(pool, code, runCode) {
      active = true;
      if (!following) { following = true; run.start(); }
      if (pool) { store.pool = pool; save(); }
      setPoolParam(store.pool);
      view.bind(handlers);
      const shared = code ? decode(code) : null;
      if (code && !shared) view.toast("That board link isn't valid", 3000);
      if (shared) begin(shared, code.trim().toLowerCase());
      else if (store.cur && decode(store.cur.code)) load();
      else fresh();
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
