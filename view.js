// Everything that touches the page. Controllers hand render() a plain view model.
import { NOUN, PLURAL, RESULT_LABEL, TOPICS, WEIGHTS, GROUPS, PRESETS } from "./core.js";

const $ = id => document.getElementById(id);
const el = {
  pool: $("pool"), menuBtn: $("menuBtn"), pNum: $("pNum"),
  brief: $("brief"), players: $("players"), status: $("status"),
  solved: $("solved"), grid: $("grid"), clue: $("clue"), toast: $("toast"),
  controls: $("controls"), submit: $("submitBtn"), shuffle: $("shuffleBtn"), clear: $("clearBtn"),
  feed: $("feed"), result: $("result"), resultLine: $("resultLine"), sessionLine: $("sessionLine"),
  shareGrid: $("shareGrid"), share: $("shareBtn"), next: $("nextBtn"),
  nameDlg: $("nameDlg"), nameForm: $("nameForm"), nameWords: $("nameWords"),
  nameLabel: $("nameLabel"), nameInput: $("nameInput"), skip: $("skipBtn"),
  menuDlg: $("menuDlg"), menuBody: $("menuBody"), menuClose: $("menuClose"),
  whoDlg: $("whoDlg"), whoForm: $("whoForm"), whoInput: $("whoInput"),
};

let handlers = {};
let current = null;          // last view model
let clueWord = null;         // word whose clue is on show
let landedKey = "";          // board + solved count, to animate only new crates
let nameOpenFor = null;      // pending key the naming sheet is open for

export function bind(h) { handlers = h; }

// ---------- one-time wiring ----------
el.submit.addEventListener("click", () => handlers.submit?.());
el.clear.addEventListener("click", () => handlers.clear?.());
el.shuffle.addEventListener("click", () => handlers.shuffle?.());
el.next.addEventListener("click", () => handlers.next?.());
el.share.addEventListener("click", () => handlers.share?.());
el.pool.addEventListener("change", () => handlers.pool?.(el.pool.value));
el.menuBtn.addEventListener("click", () => handlers.menu?.());
el.menuClose.addEventListener("click", () => el.menuDlg.close());
el.menuDlg.addEventListener("click", e => { if (e.target === el.menuDlg) el.menuDlg.close(); });
el.nameForm.addEventListener("submit", e => {
  e.preventDefault();
  const v = el.nameInput.value.trim();
  if (!v) { el.nameInput.focus(); return; }
  handlers.name?.(v);
});
el.skip.addEventListener("click", () => handlers.name?.(null));
el.nameDlg.addEventListener("cancel", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && !anyDialogOpen() && !el.submit.disabled) handlers.submit?.();
});
let fitTimer;
window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitTiles, 100); });
document.fonts?.ready.then(fitTiles);

const anyDialogOpen = () => el.nameDlg.open || el.menuDlg.open || el.whoDlg.open;

// ---------- toast / clue ----------
let toastTimer;
export function toast(msg, ms = 2000) {
  clearTimeout(toastTimer);
  el.toast.textContent = msg || "";
  if (msg && ms) toastTimer = setTimeout(() => (el.toast.textContent = ""), ms);
}

export function showClue(word, text) {
  clueWord = word;
  if (!word) { el.clue.hidden = true; el.clue.textContent = ""; return; }
  el.clue.innerHTML = "<b></b> <span></span>";
  el.clue.querySelector("b").textContent = `${word}:`;
  el.clue.querySelector("span").textContent = text;
  el.clue.hidden = false;
}

// ---------- render ----------
export function render(vm) {
  current = vm;
  document.getElementById("app").classList.toggle("coop", vm.mode === "coop");

  el.pNum.textContent = vm.label;
  renderPool(vm);
  el.brief.textContent = `Sort the sixteen into four crates and name the ${NOUN[vm.category]} behind each.`;
  el.nameLabel.textContent = `Which ${NOUN[vm.category]} links these four?`;
  renderPlayers(vm);
  el.status.textContent = vm.status || "";
  el.status.hidden = !vm.status;
  renderSolved(vm);
  renderGrid(vm);
  renderFeed(vm);

  if (clueWord && (vm.taken.has(clueWord) || !vm.revealed.has(clueWord))) showClue(null);

  el.controls.hidden = vm.done;
  el.submit.disabled = !vm.canSubmit;
  el.submit.textContent = vm.submitLabel || "Submit";
  el.result.hidden = !vm.done;
  if (vm.done) {
    el.resultLine.textContent = vm.resultLine;
    el.sessionLine.textContent = vm.sessionLine || "";
    el.sessionLine.hidden = !vm.sessionLine;
    el.shareGrid.textContent = vm.shareGrid || "";
    el.shareGrid.hidden = !vm.shareGrid;
    el.share.hidden = !vm.canShare;
    el.next.hidden = !vm.canNext;
    el.next.textContent = vm.nextLabel || "Next puzzle";
  }
  syncNameSheet(vm);
}

function renderPool(vm) {
  const labels = { mixed: "Mixed", country: PLURAL.country, commodity: PLURAL.commodity };
  for (const opt of el.pool.options) {
    opt.textContent = opt.value === "mixed" && vm.pool === "mixed"
      ? `Mixed: ${PLURAL[vm.category]}` : labels[opt.value];
  }
  el.pool.value = vm.pool;
}

function renderPlayers(vm) {
  el.players.innerHTML = "";
  el.players.classList.toggle("duo", vm.players.length > 1 || vm.mode === "coop");
  vm.players.forEach(pl => {
    const row = document.createElement("div");
    row.className = `pl s${pl.slot}${pl.me ? " me" : ""}${pl.online === false ? " away" : ""}`;
    if (vm.mode === "coop") {
      const nm = document.createElement("span");
      nm.className = "pl-name";
      nm.textContent = pl.me ? `${pl.name} (you)` : pl.name;
      row.appendChild(nm);
    }
    const lives = document.createElement("span");
    lives.className = "lives";
    lives.setAttribute("aria-label", `${pl.lives} of ${pl.maxLives} lives`);
    for (let i = 0; i < pl.maxLives; i++) {
      const b = document.createElement("i");
      if (i < pl.lives) b.className = "on";
      lives.appendChild(b);
    }
    const dots = document.createElement("span");
    dots.className = "clue-dots";
    dots.setAttribute("aria-label", `${pl.clues} clues`);
    for (let i = 0; i < pl.maxClues; i++) {
      const b = document.createElement("i");
      b.textContent = "?";
      if (i < pl.clues) b.className = "on";
      dots.appendChild(b);
    }
    row.append(lives, dots);
    el.players.appendChild(row);
  });
  if (vm.mode === "coop" && vm.players.length < 2) {
    const wait = document.createElement("div");
    wait.className = "pl waiting";
    wait.textContent = "Waiting for a partner…";
    el.players.appendChild(wait);
  }
}

function renderSolved(vm) {
  const key = `${vm.boardKey}:${vm.solved.length}`;
  const animate = landedKey && landedKey !== key && landedKey.split(":")[0] === String(vm.boardKey);
  landedKey = key;
  el.solved.innerHTML = "";
  vm.solved.forEach((r, k) => {
    const gr = vm.groupsInfo[r.g];
    const b = document.createElement("button");
    b.className = `crate l${gr.level}${r.missed ? " missed" : ""}`;
    if (animate && k === vm.solved.length - 1 && !r.missed) b.classList.add("land");
    let meta = r.missed ? "not found" : r.named ? "named" : "half: " + (r.guess ? `said ${r.guess}` : "skipped");
    if (r.by && !r.missed) meta = `${r.by}, ${meta}`;
    b.innerHTML = `<div><span class="crate-name"></span><span class="crate-meta"></span></div>
      <div class="crate-words"></div><div class="crate-note"></div>`;
    b.querySelector(".crate-name").textContent = gr.answer;
    b.querySelector(".crate-meta").textContent = meta;
    b.querySelector(".crate-words").textContent = gr.words.join(", ");
    const note = b.querySelector(".crate-note");
    gr.details.forEach(([w, hint]) => {
      const line = document.createElement("p");
      line.innerHTML = "<b></b> <span></span>";
      line.firstChild.textContent = `${w}:`;
      line.lastChild.textContent = hint;
      note.appendChild(line);
    });
    gr.herrings.forEach(h => {
      const line = document.createElement("p");
      line.className = "herring";
      line.textContent = `Red herring: ${h}.`;
      note.appendChild(line);
    });
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", () => b.setAttribute("aria-expanded", b.classList.toggle("open")));
    el.solved.appendChild(b);
  });
}

function renderGrid(vm) {
  el.grid.innerHTML = "";
  vm.order.filter(w => !vm.taken.has(w)).forEach(w => {
    const mine = vm.mySel.has(w);
    const partners = vm.partnerSel.get(w) || [];
    const cell = document.createElement("div");
    cell.className = "cell" + (mine ? " sel" : "") + (partners.length ? ` psel ps${partners[0].slot}` : "");

    const tile = document.createElement("button");
    tile.className = "tile";
    tile.textContent = w;
    tile.setAttribute("aria-pressed", mine);
    if (partners.length) tile.setAttribute("aria-description", `selected by ${partners.map(x => x.name).join(" and ")}`);
    tile.addEventListener("click", () => handlers.toggle?.(w));
    cell.appendChild(tile);

    if (partners.length) {
      const tag = document.createElement("span");
      tag.className = "ptag";
      tag.textContent = partners[0].name.slice(0, 1).toUpperCase();
      tag.setAttribute("aria-hidden", "true");
      cell.appendChild(tag);
    }

    const revealedBy = vm.revealed.get(w);
    if (revealedBy !== undefined || (mine && !vm.done)) {
      const hint = document.createElement("button");
      const spent = revealedBy === undefined && vm.myClues === 0;
      hint.className = "hint" + (spent ? " spent" : "") + (revealedBy !== undefined ? ` by${revealedBy}` : "");
      hint.setAttribute("aria-label", revealedBy !== undefined ? `Show clue for ${w}` : `Use a clue on ${w}`);
      hint.innerHTML = "<span>?</span>";
      hint.addEventListener("click", e => { e.stopPropagation(); handlers.clue?.(w); });
      cell.appendChild(hint);
    }
    el.grid.appendChild(cell);
  });
  fitTiles();
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

function renderFeed(vm) {
  el.feed.innerHTML = "";
  el.feed.hidden = !vm.feed || !vm.feed.length;
  (vm.feed || []).slice().reverse().forEach(g => {
    const li = document.createElement("li");
    li.className = `guess r-${g.res}`;
    li.innerHTML = `<span class="g-who"></span><span class="g-res"></span><span class="g-words"></span>`;
    li.querySelector(".g-who").textContent = g.by;
    li.querySelector(".g-who").classList.add(`s${g.slot}`);
    li.querySelector(".g-res").textContent = RESULT_LABEL[g.res];
    li.querySelector(".g-words").textContent = g.words.join(", ");
    el.feed.appendChild(li);
  });
}

function syncNameSheet(vm) {
  const want = vm.pending && vm.pending.mine ? `${vm.boardKey}:${vm.pending.g}` : null;
  if (want && nameOpenFor !== want) {
    nameOpenFor = want;
    el.nameWords.textContent = vm.groupsInfo[vm.pending.g].words.join(", ");
    el.nameInput.value = "";
    if (!el.nameDlg.open) el.nameDlg.showModal();
    setTimeout(() => el.nameInput.focus(), 50);
  } else if (!want && el.nameDlg.open) {
    nameOpenFor = null;
    el.nameDlg.close();
  }
}

// ---------- menu sheet ----------
export function openMenu(build) {
  el.menuBody.innerHTML = "";
  build(el.menuBody, () => el.menuDlg.close());
  if (!el.menuDlg.open) el.menuDlg.showModal();
}
export const closeMenu = () => el.menuDlg.open && el.menuDlg.close();

// ---------- "who are you" sheet ----------
export function askWho(defaultName = "") {
  return new Promise(resolve => {
    el.whoInput.value = defaultName;
    const done = e => {
      e.preventDefault();
      const v = el.whoInput.value.trim();
      if (!v) { el.whoInput.focus(); return; }
      el.whoForm.removeEventListener("submit", done);
      el.whoDlg.close();
      resolve(v.slice(0, 16));
    };
    el.whoForm.addEventListener("submit", done);
    el.whoDlg.showModal();
    setTimeout(() => el.whoInput.focus(), 50);
  });
}

// ---------- settings sheet ----------
/** Renders the settings editor into the menu sheet. onChange gets a fresh settings object. */
export function openSettings({ settings, editable, note, onChange, onBack }) {
  openMenu((body) => {
    const head = document.createElement("div");
    head.className = "set-head";
    const back = document.createElement("button");
    back.className = "link";
    back.textContent = "‹ Back";
    back.addEventListener("click", onBack);
    const h = document.createElement("h3");
    h.textContent = "Settings";
    head.append(back, h);
    body.appendChild(head);
    if (note) {
      const p = document.createElement("p");
      p.className = "stats";
      p.textContent = note;
      body.appendChild(p);
    }
    const s = structuredClone(settings);
    const change = mutate => { if (!editable) return; mutate(s); onChange(structuredClone(s)); };

    const section = title => {
      const t = document.createElement("h4");
      t.textContent = title;
      body.appendChild(t);
    };
    const segmented = (options, value, set, label) => {
      const row = document.createElement("div");
      row.className = "seg";
      row.setAttribute("role", "radiogroup");
      if (label) row.setAttribute("aria-label", label);
      options.forEach(([v, text]) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(v === value));
        b.disabled = !editable;
        b.addEventListener("click", () => {
          change(x => set(x, v));
          row.querySelectorAll("button").forEach(o => o.setAttribute("aria-checked", String(o === b)));
        });
        row.appendChild(b);
      });
      return row;
    };

    section("Preset");
    const presetRow = segmented(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), s.preset, (x, v) => {
      x.preset = v; x.topics = { ...PRESETS[v].topics };
      openSettings({ settings: x, editable, note, onChange, onBack });      // redraw the topic rows
    }, "Preset");
    body.appendChild(presetRow);

    section("Difficulty");
    body.appendChild(segmented([["easy", "Easy"], ["mixed", "Mixed"], ["hard", "Hard"]], s.difficulty, (x, v) => { x.difficulty = v; }, "Difficulty"));

    section("Topics");
    TOPICS.forEach(([k, name]) => {
      const row = document.createElement("div");
      row.className = "topic-row";
      const lab = document.createElement("span");
      lab.textContent = name;
      row.append(lab, segmented(WEIGHTS, s.topics[k], (x, v) => {
        x.topics[k] = v; x.preset = "custom";
        presetRow.querySelectorAll("button").forEach(o => o.setAttribute("aria-checked", "false"));
      }, name));
      body.appendChild(row);
    });

    for (const [cat, title] of [["country", "Countries from"], ["commodity", "Commodities from"]]) {
      section(title);
      const chips = document.createElement("div");
      chips.className = "chips";
      GROUPS[cat].forEach(([k, name]) => {
        const b = document.createElement("button");
        b.className = "chip";
        b.textContent = name;
        b.setAttribute("aria-pressed", String(!s.off.includes(k)));
        b.disabled = !editable;
        b.addEventListener("click", () => {
          change(x => { x.off = x.off.includes(k) ? x.off.filter(o => o !== k) : [...x.off, k]; });
          b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
        });
        chips.appendChild(b);
      });
      body.appendChild(chips);
    }
  });
}
