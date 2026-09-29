(() => {
  "use strict";

  const PUZZLES = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(window.CRATES_DATA), c => c.charCodeAt(0))));
  const MAX_MISTAKES = 4;
  const MAX_CLUES = 3;
  const STORE_KEY = "crates:v1";
  const SQUARES = ["🟨", "🟩", "🟦", "🟥"];
  const NOUN = { country: "country", commodity: "commodity" };
  const PLURAL = { country: "Countries", commodity: "Commodities" };

  const $ = id => document.getElementById(id);
  const el = {
    grid: $("grid"), solved: $("solved"), toast: $("toast"), clue: $("clue"),
    cat: $("cat"), lives: $("lives"), clueDots: $("clueDots"), brief: $("brief"), pNum: $("pNum"),
    controls: $("controls"), submit: $("submitBtn"), shuffle: $("shuffleBtn"), clear: $("clearBtn"),
    result: $("result"), resultLine: $("resultLine"), shareGrid: $("shareGrid"),
    share: $("shareBtn"), next: $("nextBtn"),
    nameDlg: $("nameDlg"), nameForm: $("nameForm"), nameWords: $("nameWords"),
    nameLabel: $("nameLabel"), nameInput: $("nameInput"), skip: $("skipBtn"),
    pickBtn: $("pickBtn"), pickDlg: $("pickDlg"), pickList: $("pickList"),
    pickClose: $("pickClose"), stats: $("stats"), reset: $("resetBtn"),
  };

  // ---------- storage ----------
  const store = (() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  })();
  store.games = store.games || {};
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  };

  // ---------- helpers ----------
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");

  const editDistance = (a, b) => {
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = d[j];
        d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return d[b.length];
  };

  const nameMatches = (guess, group) => {
    const g = norm(guess);
    if (!g) return false;
    return [group.answer, ...group.aliases].map(norm).some(a => {
      if (a === g) return true;
      const slack = a.length >= 9 ? 2 : a.length >= 5 ? 1 : 0;
      return editDistance(a, g) <= slack;
    });
  };

  const shuffled = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- game state ----------
  let idx, game, selected = new Set(), pendingGroup = null;

  const puzzle = () => PUZZLES[idx];
  const groupOf = w => puzzle().groups.findIndex(gr => gr.words.includes(w));
  const clueFor = w => { const gr = puzzle().groups[groupOf(w)]; return gr.clues[gr.words.indexOf(w)]; };
  const cluesLeft = () => MAX_CLUES - game.revealed.length;

  function firstUnfinished() {
    const i = PUZZLES.findIndex((_, k) => !store.games[k]?.done);
    return i === -1 ? 0 : i;
  }

  function freshGame(p) {
    return {
      order: shuffled(p.groups.flatMap(gr => gr.words)),
      found: [],        // [{g, named, guess}]
      mistakes: 0,
      guesses: [],      // group levels of the four tiles in each submission
      tried: [],
      revealed: [],     // words whose clue has been opened
      done: false,
    };
  }

  function open(i) {
    idx = i;
    store.current = i;
    game = store.games[i] || (store.games[i] = freshGame(PUZZLES[i]));
    game.tried = game.tried || [];
    game.revealed = game.revealed || [];   // saves from before clues existed
    selected.clear();
    save();
    showClue(null);
    setToast("");
    render(true);
  }

  // ---------- render ----------
  function render(fresh = false) {
    const p = puzzle();
    el.pNum.textContent = idx + 1;
    el.cat.textContent = PLURAL[p.category];
    el.brief.textContent = `Sort the sixteen into four crates and name the ${NOUN[p.category]} behind each.`;
    el.nameLabel.textContent = `Which ${NOUN[p.category]} links these four?`;
    renderMeters();
    renderSolved(fresh);
    renderGrid();
    el.controls.hidden = game.done;
    el.result.hidden = !game.done;
    if (game.done) renderResult();
  }

  function renderMeters() {
    el.lives.innerHTML = "";
    for (let i = 0; i < MAX_MISTAKES; i++) {
      const b = document.createElement("i");
      if (i < MAX_MISTAKES - game.mistakes) b.className = "on";
      el.lives.appendChild(b);
    }
    el.clueDots.innerHTML = "";
    for (let i = 0; i < MAX_CLUES; i++) {
      const b = document.createElement("i");
      b.textContent = "?";
      if (i < cluesLeft()) b.className = "on";
      el.clueDots.appendChild(b);
    }
  }

  function renderGrid() {
    const p = puzzle();
    const taken = new Set(game.found.flatMap(f => p.groups[f.g].words));
    if (game.done) p.groups.forEach(gr => gr.words.forEach(w => taken.add(w)));
    el.grid.innerHTML = "";
    game.order.filter(w => !taken.has(w)).forEach(w => {
      const cell = document.createElement("div");
      cell.className = "cell" + (selected.has(w) ? " sel" : "");

      const tile = document.createElement("button");
      tile.className = "tile";
      tile.textContent = w;
      tile.setAttribute("aria-pressed", selected.has(w));
      tile.addEventListener("click", () => toggle(w));
      cell.appendChild(tile);

      const revealed = game.revealed.includes(w);
      if (revealed || selected.has(w)) {
        const hint = document.createElement("button");
        hint.className = "hint" + (!revealed && cluesLeft() === 0 ? " spent" : "");
        hint.setAttribute("aria-label", revealed ? `Show clue for ${w}` : `Use a clue on ${w}`);
        hint.innerHTML = "<span>?</span>";
        hint.addEventListener("click", e => { e.stopPropagation(); useClue(w); });
        cell.appendChild(hint);
      }
      el.grid.appendChild(cell);
    });
    fitTiles();
    el.submit.disabled = selected.size !== 4;
  }

  // Shrink a tile's text until its longest word fits on one line.
  function fitTiles() {
    el.grid.querySelectorAll(".tile").forEach(t => {
      t.style.fontSize = "";
      let size = parseFloat(getComputedStyle(t).fontSize);
      while (t.scrollWidth > t.clientWidth && size > 10) {
        size -= 0.5;
        t.style.fontSize = size + "px";
      }
    });
  }
  let fitTimer;
  window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitTiles, 100); });
  document.fonts?.ready.then(fitTiles);

  function renderSolved(fresh) {
    const p = puzzle();
    el.solved.innerHTML = "";
    const rows = game.found.map(f => ({ ...f, missed: false }));
    if (game.done) {
      p.groups.forEach((_, g) => {
        if (!rows.some(r => r.g === g)) rows.push({ g, named: false, missed: true });
      });
    }
    rows.forEach((r, k) => {
      const gr = p.groups[r.g];
      const b = document.createElement("button");
      b.className = `crate l${gr.level}${r.missed ? " missed" : ""}`;
      if (!fresh && k === rows.length - 1 && !r.missed) b.classList.add("land");
      const meta = r.missed ? "not found" : r.named ? "named" : "half: " + (r.guess ? `you said ${r.guess}` : "skipped");
      b.innerHTML = `<div><span class="crate-name"></span><span class="crate-meta"></span></div>
        <div class="crate-words"></div><p class="crate-note"></p>`;
      b.querySelector(".crate-name").textContent = gr.answer;
      b.querySelector(".crate-meta").textContent = meta;
      b.querySelector(".crate-words").textContent = gr.words.join(", ");
      b.querySelector(".crate-note").textContent = gr.note;
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", () => b.setAttribute("aria-expanded", b.classList.toggle("open")));
      el.solved.appendChild(b);
    });
  }

  const score = (g = game) => g.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);
  const cluesNote = (g = game) => {
    const n = (g.revealed || []).length;
    return n ? ` · ${n} clue${n === 1 ? "" : "s"}` : "";
  };

  function renderResult() {
    const pts = score();
    const won = game.found.length === 4;
    el.resultLine.textContent = (won
      ? `${pts} of 8 · ${game.mistakes} mistake${game.mistakes === 1 ? "" : "s"}`
      : `Out of lives · ${pts} of 8`) + cluesNote();
    el.shareGrid.textContent = shareText(false);
    el.next.hidden = PUZZLES.every((_, k) => store.games[k]?.done);
  }

  function shareText(withHeader = true) {
    const rows = game.guesses.map(ls => ls.map(l => SQUARES[l]).join("")).join("\n");
    const names = game.found.map(f => f.named ? "✓" : "½").join("");
    const body = rows + (names ? `\n${names}` : "");
    return withHeader ? `Crates No. ${idx + 1} · ${score()}/8${cluesNote()}\n${body}` : body;
  }

  let toastTimer;
  function setToast(msg, ms = 0) {
    clearTimeout(toastTimer);
    el.toast.textContent = msg;
    if (ms) toastTimer = setTimeout(() => (el.toast.textContent = ""), ms);
  }

  function showClue(w) {
    if (!w) { el.clue.hidden = true; el.clue.textContent = ""; return; }
    el.clue.innerHTML = "<b></b> <span></span>";
    el.clue.querySelector("b").textContent = `${w}:`;
    el.clue.querySelector("span").textContent = clueFor(w);
    el.clue.hidden = false;
  }

  // ---------- actions ----------
  function toggle(w) {
    if (game.done || pendingGroup !== null) return;
    if (selected.has(w)) selected.delete(w);
    else if (selected.size < 4) selected.add(w);
    else return;
    renderGrid();
  }

  function useClue(w) {
    if (game.done) return;
    if (!game.revealed.includes(w)) {
      if (cluesLeft() === 0) { setToast("No clues left on this puzzle", 1800); return; }
      game.revealed.push(w);
      save();
      renderMeters();
      renderGrid();
    }
    showClue(w);
  }

  function submit() {
    if (selected.size !== 4 || game.done) return;
    const words = [...selected];
    const key = words.slice().sort().join("|");
    if (game.tried.includes(key)) { setToast("Already tried", 1600); return; }
    game.tried.push(key);
    game.guesses.push(words.map(w => puzzle().groups[groupOf(w)].level));

    const counts = {};
    words.forEach(w => { const g = groupOf(w); counts[g] = (counts[g] || 0) + 1; });
    const best = Math.max(...Object.values(counts));

    if (best === 4) {
      pendingGroup = groupOf(words[0]);
      selected.clear();
      save();
      askName(pendingGroup);
      return;
    }
    game.mistakes++;
    el.grid.classList.remove("shake"); void el.grid.offsetWidth; el.grid.classList.add("shake");
    if (game.mistakes >= MAX_MISTAKES) {
      game.done = true;
      selected.clear();
      showClue(null);
      setToast("Out of lives");
    } else {
      setToast(best === 3 ? "One away" : "Not a crate", 1800);
    }
    save();
    setTimeout(() => render(), game.done ? 0 : 380);
  }

  function askName(g) {
    el.nameWords.textContent = puzzle().groups[g].words.join(", ");
    el.nameInput.value = "";
    el.nameDlg.showModal();
    setTimeout(() => el.nameInput.focus(), 50);
  }

  function resolveName(guess) {
    const g = pendingGroup;
    if (g === null) return;
    const gr = puzzle().groups[g];
    const named = guess !== null && nameMatches(guess, gr);
    game.found.push({ g, named, guess: named ? null : (guess || null) });
    pendingGroup = null;
    if (game.found.length === 4) game.done = true;
    save();
    el.nameDlg.close();
    showClue(null);
    setToast(named ? `${gr.answer}, full marks` : `It was ${gr.answer}, half marks`, 2200);
    render();
  }

  el.nameForm.addEventListener("submit", e => {
    e.preventDefault();
    const v = el.nameInput.value.trim();
    if (!v) { el.nameInput.focus(); return; }
    resolveName(v);
  });
  el.skip.addEventListener("click", () => resolveName(null));
  el.nameDlg.addEventListener("cancel", e => e.preventDefault());

  el.submit.addEventListener("click", submit);
  el.clear.addEventListener("click", () => { selected.clear(); renderGrid(); });
  el.shuffle.addEventListener("click", () => { game.order = shuffled(game.order); save(); renderGrid(); });
  el.next.addEventListener("click", () => {
    const later = PUZZLES.findIndex((_, k) => k > idx && !store.games[k]?.done);
    open(later !== -1 ? later : firstUnfinished());
  });
  el.share.addEventListener("click", async () => {
    const t = shareText();
    try {
      if (navigator.share) await navigator.share({ text: t });
      else { await navigator.clipboard.writeText(t); setToast("Copied", 1500); }
    } catch { /* share sheet dismissed */ }
  });

  // ---------- puzzle list ----------
  function renderPicker() {
    el.pickList.innerHTML = "";
    let played = 0, total = 0, full = 0;
    PUZZLES.forEach((p, k) => {
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
      b.firstChild.textContent = `No. ${k + 1}  ${PLURAL[p.category]}`;
      b.lastChild.textContent = st;
      if (k === idx) b.classList.add("cur");
      b.addEventListener("click", () => { el.pickDlg.close(); open(k); });
      li.appendChild(b);
      el.pickList.appendChild(li);
    });
    el.stats.textContent = played
      ? `${played} played · average ${(total / played).toFixed(1)} of 8 · ${full} perfect`
      : "Nothing played yet.";
  }
  el.pickBtn.addEventListener("click", () => { renderPicker(); el.pickDlg.showModal(); });
  el.pickClose.addEventListener("click", () => el.pickDlg.close());
  el.pickDlg.addEventListener("click", e => { if (e.target === el.pickDlg) el.pickDlg.close(); });
  el.reset.addEventListener("click", () => {
    if (!confirm(`Start No. ${idx + 1} again?`)) return;
    delete store.games[idx];
    el.pickDlg.close();
    open(idx);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && !el.nameDlg.open && !el.pickDlg.open && !el.submit.disabled) submit();
  });

  open(Math.min(store.current ?? firstUnfinished(), PUZZLES.length - 1));
})();
