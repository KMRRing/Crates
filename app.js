(() => {
  "use strict";

  const PUZZLES = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(window.CRATES_DATA), c => c.charCodeAt(0))));
  const MAX_MISTAKES = 4;
  const STORE_KEY = "crates:v1";
  const SQUARES = ["🟨", "🟩", "🟦", "🟥"];
  const NOUN = { country: "country", commodity: "commodity" };

  const $ = id => document.getElementById(id);
  const el = {
    grid: $("grid"), solved: $("solved"), toast: $("toast"), lives: $("lives"),
    brief: $("brief"), pNum: $("pNum"), controls: $("controls"),
    submit: $("submitBtn"), shuffle: $("shuffleBtn"), clear: $("clearBtn"),
    result: $("result"), resultLine: $("resultLine"), shareGrid: $("shareGrid"),
    share: $("shareBtn"), next: $("nextBtn"),
    nameDlg: $("nameDlg"), nameForm: $("nameForm"), nameWords: $("nameWords"),
    nameLabel: $("nameLabel"), nameInput: $("nameInput"), skip: $("skipBtn"),
    pickBtn: $("pickBtn"), pickDlg: $("pickDlg"), pickList: $("pickList"),
    pickClose: $("pickClose"), stats: $("stats"), reset: $("resetBtn"),
  };

  // ---------- storage ----------
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  };
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
  };
  const store = load();
  store.games = store.games || {};

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
  let idx = Math.min(store.current ?? firstUnfinished(), PUZZLES.length - 1);
  let game, selected = new Set(), pendingGroup = null;

  function firstUnfinished() {
    const i = PUZZLES.findIndex((_, k) => !store.games[k]?.done);
    return i === -1 ? 0 : i;
  }

  function freshGame(p) {
    return {
      order: shuffled(p.groups.flatMap(gr => gr.words)),
      found: [],        // [{g, named, guess}]
      mistakes: 0,
      guesses: [],      // each: array of group levels for the 4 tiles
      done: false,
    };
  }

  const puzzle = () => PUZZLES[idx];
  const groupOf = w => puzzle().groups.findIndex(gr => gr.words.includes(w));

  function open(i) {
    idx = i;
    store.current = i;
    game = store.games[i] || (store.games[i] = freshGame(PUZZLES[i]));
    selected.clear();
    save();
    render(true);
  }

  // ---------- render ----------
  function render(fresh = false) {
    const p = puzzle();
    el.pNum.textContent = idx + 1;
    el.brief.textContent = `Sort the sixteen into four crates and name the ${NOUN[p.category]} behind each.`;
    el.nameLabel.textContent = `Which ${NOUN[p.category]} links these four?`;

    el.lives.innerHTML = "";
    for (let i = 0; i < MAX_MISTAKES; i++) {
      const b = document.createElement("i");
      if (i < MAX_MISTAKES - game.mistakes) b.className = "on";
      el.lives.appendChild(b);
    }

    renderSolved(fresh);

    const taken = new Set(game.found.flatMap(f => p.groups[f.g].words));
    if (game.done) p.groups.forEach(gr => gr.words.forEach(w => taken.add(w)));
    el.grid.innerHTML = "";
    game.order.filter(w => !taken.has(w)).forEach(w => {
      const b = document.createElement("button");
      b.className = "tile" + (Math.max(...w.split(/\s+/).map(t => t.length)) > 9 ? " long" : "");
      b.textContent = w;
      b.setAttribute("aria-pressed", selected.has(w));
      b.addEventListener("click", () => toggle(w, b));
      el.grid.appendChild(b);
    });

    el.controls.hidden = game.done;
    el.result.hidden = !game.done;
    if (game.done) renderResult();
    el.submit.disabled = selected.size !== 4;
    if (fresh) setToast("");
  }

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
      b.addEventListener("click", () => {
        const o = b.classList.toggle("open");
        b.setAttribute("aria-expanded", o);
      });
      el.solved.appendChild(b);
    });
  }

  function score(g = game) {
    return g.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);
  }

  function renderResult() {
    const pts = score();
    const won = game.found.length === 4;
    el.resultLine.textContent = won
      ? `${pts} of 8 · ${game.mistakes} mistake${game.mistakes === 1 ? "" : "s"}`
      : `Out of lives · ${pts} of 8`;
    el.shareGrid.textContent = shareText(false);
    el.next.hidden = idx >= PUZZLES.length - 1 && PUZZLES.every((_, k) => store.games[k]?.done);
  }

  function shareText(withHeader = true) {
    const rows = game.guesses.map(ls => ls.map(l => SQUARES[l]).join("")).join("\n");
    const names = game.found.map(f => f.named ? "✓" : "½").join("");
    const body = rows + (names ? `\n${names}` : "");
    return withHeader ? `Crates No. ${idx + 1} · ${score()}/8\n${body}` : body;
  }

  let toastTimer;
  function setToast(msg, ms = 0) {
    clearTimeout(toastTimer);
    el.toast.textContent = msg;
    if (ms) toastTimer = setTimeout(() => (el.toast.textContent = ""), ms);
  }

  // ---------- actions ----------
  function toggle(w, b) {
    if (game.done || pendingGroup !== null) return;
    if (selected.has(w)) selected.delete(w);
    else if (selected.size < 4) selected.add(w);
    else return;
    b.setAttribute("aria-pressed", selected.has(w));
    el.submit.disabled = selected.size !== 4;
  }

  function submit() {
    if (selected.size !== 4 || game.done) return;
    const words = [...selected];
    const levels = words.map(w => puzzle().groups[groupOf(w)].level);
    const key = words.slice().sort().join("|");
    game.tried = game.tried || [];
    if (game.tried.includes(key)) { setToast("Already tried", 1600); return; }
    game.tried.push(key);
    game.guesses.push(levels);

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
      setToast("Crates shipped without you");
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
  el.clear.addEventListener("click", () => { selected.clear(); render(); });
  el.shuffle.addEventListener("click", () => {
    game.order = shuffled(game.order); save(); render();
  });
  el.next.addEventListener("click", () => {
    const n = PUZZLES.findIndex((_, k) => k > idx && !store.games[k]?.done);
    const m = n !== -1 ? n : PUZZLES.findIndex((_, k) => !store.games[k]?.done);
    open(m !== -1 ? m : (idx + 1) % PUZZLES.length);
  });
  el.share.addEventListener("click", async () => {
    const t = shareText();
    try {
      if (navigator.share) await navigator.share({ text: t });
      else { await navigator.clipboard.writeText(t); setToast("Copied", 1500); }
    } catch { /* user cancelled */ }
  });

  // ---------- puzzle picker ----------
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
      b.innerHTML = `<span></span><span class="st"></span>`;
      b.firstChild.textContent = `No. ${k + 1}  ${p.category === "country" ? "Countries" : "Commodities"}`;
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

  open(idx);
})();
