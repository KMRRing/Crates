// Solo play: progress lives in this browser's localStorage.
import { PUZZLES, PLURAL, SQUARES, inPool, poolIndices, nameMatches, shuffled,
  clueFor, wordsKey, classify } from "./core.js";
import * as view from "./view.js";

const MAX_MISTAKES = 4;
const MAX_CLUES = 3;
const STORE_KEY = "crates:v1";

export function createSolo({ onTogether, setPoolParam }) {
  const store = (() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  })();
  store.games = store.games || {};
  store.pool = store.pool || "mixed";
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  };

  let idx, game, selected = new Set(), pendingGroup = null;
  const puzzle = () => PUZZLES[idx];
  const cluesLeft = () => MAX_CLUES - game.revealed.length;
  const score = g => g.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);
  const unfinished = k => !store.games[k]?.done;

  function firstUnfinished(pool = store.pool) {
    const list = poolIndices(pool);
    return list.find(unfinished) ?? list[0];
  }

  function freshGame(p) {
    return { order: shuffled(p.groups.flatMap(gr => gr.words)), found: [], mistakes: 0,
      guesses: [], tried: [], revealed: [], done: false };
  }

  function open(i) {
    idx = i;
    store.current = i;
    game = store.games[i] || (store.games[i] = freshGame(PUZZLES[i]));
    game.tried = game.tried || [];
    game.revealed = game.revealed || [];
    selected.clear();
    pendingGroup = null;
    save();
    view.showClue(null);
    view.toast("");
    draw();
  }

  function vm() {
    const p = puzzle();
    const taken = new Set(game.found.flatMap(f => p.groups[f.g].words));
    if (game.done) p.groups.forEach(gr => gr.words.forEach(w => taken.add(w)));
    const solved = game.found.map(f => ({ ...f }));
    if (game.done) p.groups.forEach((_, g) => { if (!solved.some(r => r.g === g)) solved.push({ g, missed: true }); });
    const pts = score(game);
    const n = game.revealed.length;
    const cluesNote = n ? ` · ${n} clue${n === 1 ? "" : "s"}` : "";
    const rows = game.guesses.map(ls => ls.map(l => SQUARES[l]).join("")).join("\n");
    const names = game.found.map(f => f.named ? "✓" : "½").join("");
    return {
      mode: "solo", puzzle: p, idx, pool: store.pool,
      order: game.order, taken, solved,
      mySel: selected, partnerSel: new Map(),
      revealed: new Map(game.revealed.map(w => [w, 0])),
      myClues: cluesLeft(),
      players: [{ slot: 0, me: true, name: "", lives: MAX_MISTAKES - game.mistakes, maxLives: MAX_MISTAKES,
        clues: cluesLeft(), maxClues: MAX_CLUES }],
      pending: pendingGroup !== null ? { g: pendingGroup, mine: true } : null,
      canSubmit: selected.size === 4 && !game.done && pendingGroup === null,
      done: game.done,
      resultLine: (game.found.length === 4
        ? `${pts} of 8 · ${game.mistakes} mistake${game.mistakes === 1 ? "" : "s"}`
        : `Out of lives · ${pts} of 8`) + cluesNote,
      shareGrid: rows + (names ? `\n${names}` : ""),
      shareText: `Crates No. ${idx + 1} · ${pts}/8${cluesNote}\n${rows}${names ? `\n${names}` : ""}`,
      canShare: true,
      canNext: poolIndices(store.pool).some(k => k !== idx && unfinished(k)),
      nextLabel: "Next puzzle",
    };
  }
  const draw = () => view.render(vm());

  const handlers = {
    toggle(w) {
      if (game.done || pendingGroup !== null) return;
      if (selected.has(w)) selected.delete(w);
      else if (selected.size < 4) selected.add(w);
      else return;
      draw();
    },
    clue(w) {
      if (game.done) return;
      if (!game.revealed.includes(w)) {
        if (cluesLeft() === 0) { view.toast("No clues left on this puzzle", 1800); return; }
        game.revealed.push(w);
        save();
      }
      view.showClue(w, clueFor(puzzle(), w));
      draw();
    },
    submit() {
      if (selected.size !== 4 || game.done || pendingGroup !== null) return;
      const words = [...selected];
      const key = wordsKey(words);
      if (game.tried.includes(key)) { view.toast("Already tried", 1600); return; }
      game.tried.push(key);
      const r = classify(puzzle(), words);
      game.guesses.push(r.lv);
      if (r.res === "right") {
        pendingGroup = r.g;
        selected.clear();
        save();
        draw();
        return;
      }
      game.mistakes++;
      if (game.mistakes >= MAX_MISTAKES) {
        game.done = true;
        selected.clear();
        view.showClue(null);
        view.toast("Out of lives", 2500);
      } else {
        view.toast(r.res === "one" ? "One away" : "Not a crate", 1800);
      }
      save();
      document.getElementById("grid").classList.remove("shake");
      void document.getElementById("grid").offsetWidth;
      document.getElementById("grid").classList.add("shake");
      setTimeout(draw, game.done ? 0 : 380);
    },
    name(guess) {
      if (pendingGroup === null) return;
      const gr = puzzle().groups[pendingGroup];
      const named = guess !== null && nameMatches(guess, gr);
      game.found.push({ g: pendingGroup, named, guess: named ? null : (guess || null) });
      pendingGroup = null;
      if (game.found.length === 4) game.done = true;
      save();
      view.showClue(null);
      view.toast(named ? `${gr.answer}, full marks` : `It was ${gr.answer}, half marks`, 2200);
      draw();
    },
    clear() { selected.clear(); draw(); },
    shuffle() { game.order = shuffled(game.order); save(); draw(); },
    next() {
      const list = poolIndices(store.pool);
      const later = list.find(k => k > idx && unfinished(k));
      open(later ?? firstUnfinished());
    },
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
      if (!inPool(idx, value)) open(firstUnfinished(value));
      else draw();
    },
    menu() {
      view.openMenu((body, close) => {
        const together = document.createElement("button");
        together.className = "btn primary wide";
        together.textContent = "Play together";
        together.addEventListener("click", () => { close(); onTogether(store.pool); });
        body.appendChild(together);

        const h = document.createElement("h3");
        h.textContent = store.pool === "mixed" ? "All puzzles" : PLURAL[store.pool];
        body.appendChild(h);

        const list = document.createElement("ol");
        list.className = "pick-list";
        let played = 0, total = 0, full = 0;
        poolIndices(store.pool).forEach(k => {
          const g = store.games[k];
          let st = "new";
          if (g?.done) {
            played++; total += score(g);
            if (score(g) === 8) full++;
            st = `${score(g)}/8`;
          } else if (g && (g.guesses.length || g.found.length)) st = "in progress";
          const li = document.createElement("li");
          const b = document.createElement("button");
          b.innerHTML = "<span></span><span class=\"st\"></span>";
          b.firstChild.textContent = `No. ${k + 1}  ${PLURAL[PUZZLES[k].category]}`;
          b.lastChild.textContent = st;
          if (k === idx) b.classList.add("cur");
          b.addEventListener("click", () => { close(); open(k); });
          li.appendChild(b);
          list.appendChild(li);
        });
        body.appendChild(list);

        const stats = document.createElement("p");
        stats.className = "stats";
        stats.textContent = played
          ? `${played} played · average ${(total / played).toFixed(1)} of 8 · ${full} perfect`
          : "Nothing played yet.";
        body.appendChild(stats);

        const reset = document.createElement("button");
        reset.className = "link";
        reset.textContent = "Reset this puzzle";
        reset.addEventListener("click", () => {
          if (!confirm(`Start No. ${idx + 1} again?`)) return;
          delete store.games[idx];
          close();
          open(idx);
        });
        body.appendChild(reset);
      });
    },
  };

  return {
    start(pool) {
      if (pool) { store.pool = pool; save(); }
      setPoolParam(store.pool);
      view.bind(handlers);
      const cur = store.current;
      open(cur != null && cur < PUZZLES.length && inPool(cur, store.pool) ? cur : firstUnfinished());
    },
    stop() {},
    get pool() { return store.pool; },
  };
}
