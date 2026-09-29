// Solo play: generated boards, progress in this browser's localStorage.
import { BANK, PLURAL, SQUARES, nameMatches, shuffled, wordsKey, cleanSettings, defaultSettings } from "./core.js";
import { generate, encode, decode, describe, hintFor, classify } from "./gen.js";
import * as view from "./view.js";

const MAX_MISTAKES = 4;
const MAX_CLUES = 3;
const STORE_KEY = "crates:v2";
const RECENT_ANSWERS = 16, RECENT_WORDS = 120, HISTORY = 60;

export function createSolo({ onTogether, setPoolParam, setBoardParam }) {
  const store = (() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  })();
  store.settings = cleanSettings(store.settings);
  store.pool = store.pool || "mixed";
  store.n = store.n || 0;
  store.history = store.history || [];
  store.recentA = store.recentA || [];
  store.recentW = store.recentW || [];
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  };

  let board, info, selected = new Set(), pendingGroup = null;
  const game = () => store.cur;
  const cluesLeft = () => MAX_CLUES - game().revealed.length;
  const score = g => g.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);

  function begin(b, code) {
    store.n += 1;
    store.cur = {
      code: code || encode(b), n: store.n, order: shuffled(describe(b).flatMap(g => g.words)),
      found: [], mistakes: 0, guesses: [], tried: [], revealed: [], done: false,
    };
    b.groups.forEach(g => {
      store.recentA = [g.a, ...store.recentA.filter(a => a !== g.a)].slice(0, RECENT_ANSWERS);
      g.w.forEach(i => { store.recentW = [`${g.a}.${i}`, ...store.recentW].slice(0, RECENT_WORDS); });
    });
    save();
    load();
  }

  function fresh() {
    let b = generate({ pool: store.pool, settings: store.settings, recentA: store.recentA, recentW: store.recentW });
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
    selected.clear();
    pendingGroup = null;
    setBoardParam(null);
    view.showClue(null);
    draw();
  }

  function vm() {
    const g = game();
    const taken = new Set(g.found.flatMap(f => info[f.g].words));
    if (g.done) info.forEach(gr => gr.words.forEach(w => taken.add(w)));
    const solved = g.found.map(f => ({ ...f }));
    if (g.done) info.forEach((_, i) => { if (!solved.some(r => r.g === i)) solved.push({ g: i, missed: true }); });
    const pts = score(g);
    const n = g.revealed.length;
    const cluesNote = n ? ` · ${n} clue${n === 1 ? "" : "s"}` : "";
    const rows = g.guesses.map(ls => ls.map(l => SQUARES[l]).join("")).join("\n");
    const names = g.found.map(f => f.named ? "✓" : "½").join("");
    const link = `${location.origin}${location.pathname}?b=${g.code}`;
    return {
      mode: "solo", category: board.cat, pool: store.pool, label: g.n, boardKey: g.code,
      groupsInfo: info, order: g.order, taken, solved,
      mySel: selected, partnerSel: new Map(),
      revealed: new Map(g.revealed.map(w => [w, 0])),
      myClues: cluesLeft(),
      players: [{ slot: 0, me: true, name: "", lives: MAX_MISTAKES - g.mistakes, maxLives: MAX_MISTAKES,
        clues: cluesLeft(), maxClues: MAX_CLUES }],
      pending: pendingGroup !== null ? { g: pendingGroup, mine: true } : null,
      canSubmit: selected.size === 4 && !g.done && pendingGroup === null,
      done: g.done,
      resultLine: (g.found.length === 4
        ? `${pts} of 8 · ${g.mistakes} mistake${g.mistakes === 1 ? "" : "s"}`
        : `Out of lives · ${pts} of 8`) + cluesNote,
      shareGrid: rows + (names ? `\n${names}` : ""),
      shareText: `Crates · ${PLURAL[board.cat]} · ${pts}/8${cluesNote}\n${rows}${names ? `\n${names}` : ""}\nSame board: ${link}`,
      canShare: true, canNext: true, nextLabel: "Next board",
    };
  }
  const draw = () => view.render(vm());

  function finish() {
    const g = game();
    store.history = [{ n: g.n, code: g.code, cat: board.cat, pts: score(g), won: g.found.length === 4,
      mistakes: g.mistakes, clues: g.revealed.length }, ...store.history].slice(0, HISTORY);
  }

  function settingsSheet() {
    view.openSettings({
      settings: store.settings, editable: true,
      note: "Changes apply from the next board.",
      onChange: s => { store.settings = cleanSettings(s); save(); },
      onBack: () => handlers.menu(),
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
      view.showClue(w, hintFor(board, w));
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
        g.done = true;
        selected.clear();
        view.showClue(null);
        finish();
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
      if (g.found.length === 4) { g.done = true; finish(); }
      save();
      view.showClue(null);
      view.toast(named ? `${ans.name}, full marks` : `It was ${ans.name}, half marks`, 2200);
      draw();
    },
    clear() { selected.clear(); draw(); },
    shuffle() { game().order = shuffled(game().order); save(); draw(); },
    next() { fresh(); },
    async share() {
      const t = vm().shareText;
      try {
        if (navigator.share) await navigator.share({ text: t });
        else { await navigator.clipboard.writeText(t); view.toast("Copied", 1500); }
      } catch { /* share sheet dismissed */ }
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
        const together = document.createElement("button");
        together.className = "btn primary wide";
        together.textContent = "Play together";
        together.addEventListener("click", () => { close(); onTogether(store.pool, store.settings); });
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
          b.lastChild.textContent = r.won ? `${r.pts}/8` : `out · ${r.pts}/8`;
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

        const done = store.history.length;
        if (done) {
          const total = store.history.reduce((s, r) => s + r.pts, 0);
          const perfect = store.history.filter(r => r.pts === 8).length;
          const stats = document.createElement("p");
          stats.className = "stats";
          stats.textContent = `${done} played · average ${(total / done).toFixed(1)} of 8 · ${perfect} perfect`;
          body.appendChild(stats);
        }
      });
    },
  };

  return {
    start(pool, code) {
      if (pool) { store.pool = pool; save(); }
      setPoolParam(store.pool);
      view.bind(handlers);
      const shared = code ? decode(code) : null;
      if (code && !shared) view.toast("That board link isn't valid", 3000);
      if (shared) begin(shared, code.trim().toLowerCase());
      else if (store.cur && decode(store.cur.code)) load();
      else fresh();
    },
    stop() {},
  };
}
