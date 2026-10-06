// Everything that touches the page. Controllers hand render() a plain view model.
import { NOUN, RESULT_LABEL, TOPICS, WEIGHTS, GROUPS, PRESETS, POOL_CATS } from "./core.js";
import { weights } from "./menu.js";
import { dropdown } from "./dropdown.js";

const $ = id => document.getElementById(id);
const el = {
  pool: $("pool"), menuBtn: $("menuBtn"), pNum: $("pNum"),
  brief: $("brief"), players: $("players"), status: $("status"),
  solved: $("solved"), grid: $("grid"), clue: $("clue"), toast: $("toast"),
  controls: $("controls"), submit: $("submitBtn"), shuffle: $("shuffleBtn"), clear: $("clearBtn"),
  feed: $("feed"), result: $("result"), resultLine: $("resultLine"), subLine: $("subLine"),
  shareGrid: $("shareGrid"), share: $("shareBtn"), next: $("nextBtn"),
  nameDlg: $("nameDlg"), nameForm: $("nameForm"), nameWords: $("nameWords"),
  nameLabel: $("nameLabel"), nameInput: $("nameInput"), skip: $("skipBtn"),
  menuDlg: $("menuDlg"), menuBody: $("menuBody"), menuClose: $("menuClose"),
  whoDlg: $("whoDlg"), whoForm: $("whoForm"), whoInput: $("whoInput"),
};

let handlers = {};
let current = null;          // last view model
let landedKey = "";          // board + solved count, to animate only new crates
let nameOpenFor = null;      // pending key the naming sheet is open for

export function bind(h) { handlers = h; }

// ---------- one-time wiring ----------
el.submit.addEventListener("click", () => handlers.submit?.());
el.clear.addEventListener("click", () => handlers.clear?.());
el.shuffle.addEventListener("click", () => handlers.shuffle?.());
el.next.addEventListener("click", () => handlers.next?.());
el.share.addEventListener("click", () => handlers.share?.());
dropdown(el.pool);
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
window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitText, 100); });
document.fonts?.ready.then(fitText);

const anyDialogOpen = () => el.nameDlg.open || el.menuDlg.open || el.whoDlg.open;

// ---------- toast / clue ----------
let toastTimer;
export function toast(msg, ms = 2000) {
  clearTimeout(toastTimer);
  el.toast.textContent = msg || "";
  if (msg && ms) toastTimer = setTimeout(() => (el.toast.textContent = ""), ms);
}

/** The clue strip under the grid: { label, text, level (crate colour, or null if not yours to see), note }. */
function renderClue(clue) {
  el.clue.className = "clue" + (clue && clue.level != null ? ` lv${clue.level}` : "");
  el.clue.hidden = !clue;
  if (!clue) { el.clue.textContent = ""; return; }
  el.clue.innerHTML = "<b></b> <span></span>";
  el.clue.querySelector("b").textContent = `${clue.label}:`;
  el.clue.querySelector("span").textContent = clue.text;
  if (clue.note) {
    const n = document.createElement("small");
    n.textContent = clue.note;
    el.clue.appendChild(n);
  }
}

// A life: filled while you have it, outlined once lost.
const HEART_PATH = "M12 20.5C12 20.5 3 14.8 3 8.9 3 6.1 5.1 4 7.7 4c1.8 0 3.4 1 4.3 2.6C12.9 5 14.5 4 16.3 4 18.9 4 21 6.1 21 8.9c0 5.9-9 11.6-9 11.6z";
const heart = on => `<svg class="${on ? "on" : ""}" viewBox="1.5 2.5 21 19.5" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;

// ---------- render ----------
export function render(vm) {
  current = vm;
  document.getElementById("app").classList.toggle("coop", vm.mode === "coop");

  el.pNum.textContent = vm.label && vm.label !== "–" ? `No. ${vm.label}` : "";   // in the menu's title
  renderPool(vm);
  // vm.brief: null = the standard line, "" = none
  el.brief.textContent = vm.brief ?? `Sort the sixteen into four crates and name the ${NOUN[vm.category]} behind each.`;
  if (vm.modeNote) {
    const m = document.createElement("span");
    m.className = "mode-note";
    m.textContent = vm.modeNote;
    el.brief.appendChild(m);
  }
  el.brief.hidden = !el.brief.textContent;
  if (vm.category) el.nameLabel.textContent = `Which ${NOUN[vm.category]} links these four?`;
  renderPlayers(vm);
  el.status.textContent = vm.status || "";
  el.status.hidden = !vm.status;
  renderSolved(vm);
  renderGrid(vm);
  renderClue(vm.clue);
  renderFeed(vm);

  el.controls.hidden = vm.done || vm.hideControls;
  el.submit.disabled = !vm.canSubmit;
  el.submit.textContent = vm.submitLabel || "Submit";
  el.result.hidden = !vm.done;
  if (vm.done) {
    el.resultLine.textContent = vm.resultLine;
    el.subLine.textContent = vm.subLine || "";
    el.subLine.hidden = !vm.subLine;
    el.shareGrid.textContent = vm.shareGrid || "";
    el.shareGrid.hidden = !vm.shareGrid;
    el.share.hidden = !vm.canShare;
    el.next.hidden = !vm.canNext;
    el.next.textContent = vm.nextLabel || "Next puzzle";
  }
  syncNameSheet(vm);
}

/** The pool menu keeps short labels, like the other games' headers; the line below says which kind this board is. */
function renderPool(vm) {
  el.pool.value = vm.pool;
}

function renderPlayers(vm) {
  el.players.innerHTML = "";
  if (vm.players) {
    const names = document.createElement("div");
    names.className = "names";
    vm.players.forEach(pl => {
      const nm = document.createElement("span");
      nm.className = `pl-name s${pl.slot}${pl.online === false || pl.elsewhere ? " away" : ""}`;
      nm.textContent = `${pl.me ? `${pl.name} (you)` : pl.name}${pl.ready ? " ✓" : ""}${pl.elsewhere ? ` · in ${pl.elsewhere}` : ""}`;
      names.appendChild(nm);
    });
    if (vm.players.length < 2) {
      const wait = document.createElement("span");
      wait.className = "pl-waiting";
      wait.textContent = "waiting for a partner…";
      names.appendChild(wait);
    }
    el.players.appendChild(names);
  }
  if (!vm.team) return;
  const team = document.createElement("div");
  team.className = "team";
  const lives = document.createElement("span");
  lives.className = "lives";
  lives.setAttribute("aria-label", `${vm.team.lives} of ${vm.team.maxLives} lives`);
  lives.innerHTML = Array.from({ length: vm.team.maxLives }, (_, i) => heart(i < vm.team.lives)).join("");
  const dots = document.createElement("span");
  dots.className = "clue-dots";
  dots.setAttribute("aria-label", `${vm.team.clues} clues`);
  for (let i = 0; i < vm.team.maxClues; i++) {
    const b = document.createElement("i");
    b.textContent = "?";
    if (i < vm.team.clues) b.className = "on";
    dots.appendChild(b);
  }
  team.append(lives, dots);
  el.players.appendChild(team);
}

/**
 * Red herrings for crate g. The other crate a herring also fits is only named once that crate is open too,
 * and then the herring shows in both: "Rotterdam also fits HVO" here, "also fits here, but belongs to FAME" there.
 */
function herringLines(vm, g, shown) {
  const info = vm.groupsInfo, lines = [];
  const words = [...new Set(info[g].herrings.map(h => h.word))];
  for (const word of words) {
    const others = info[g].herrings.filter(h => h.word === word && shown.has(h.other)).map(h => info[h.other].answer);
    lines.push(others.length ? `Red herring: ${word} also fits ${listJoin(others)}.` : `Red herring: ${word}.`);
  }
  info.forEach((o, k) => {
    if (k === g || !shown.has(k)) return;
    o.herrings.filter(h => h.other === g).forEach(h => lines.push(`Red herring: ${h.word} also fits here, but belongs to ${o.answer}.`));
  });
  return lines;
}

const listJoin = xs => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

function renderSolved(vm) {
  const shown = new Set(vm.solved.map(r => r.g));
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
    b.innerHTML = `<div class="crate-title"><span class="crate-name"></span><span class="crate-meta"></span></div>
      <div class="crate-words"></div><div class="crate-note"></div>`;
    b.querySelector(".crate-name").textContent = gr.answer;
    const flags = {};                       // learning mode: "↻ 2", "✓ 1" beside the crate name
    gr.details.forEach(([, , tag]) => { if (tag) flags[tag[0]] = (flags[tag[0]] || 0) + 1; });
    b.querySelector(".crate-meta").textContent = [meta, ...Object.entries(flags).map(([icon, n]) => `${icon} ${n}`)].join(" · ");
    b.querySelector(".crate-words").textContent = gr.words.join(", ");
    const note = b.querySelector(".crate-note");
    gr.details.forEach(([w, hint, tag]) => {
      const line = document.createElement("p");
      line.innerHTML = "<b></b> <span></span>";
      line.firstChild.textContent = `${w}:`;
      line.lastChild.textContent = hint;
      if (tag) {
        const t = document.createElement("em");
        t.className = "tag";
        t.textContent = tag;
        line.append(" ", t);
      }
      note.appendChild(line);
    });
    herringLines(vm, r.g, shown).forEach(text => {
      const line = document.createElement("p");
      line.className = "herring";
      line.textContent = text;
      note.appendChild(line);
    });
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", () => b.setAttribute("aria-expanded", b.classList.toggle("open")));
    el.solved.appendChild(b);
  });
}

const BADGE_LABEL = {
  offer: "Use a clue on this tile", spent: "No clues left", open: "Show the clue", used: "A clue was used on this word",
};

/** cells: [{ id, text, sealed, peek, sel, psel: [{ slot, name }], badge: { kind, level } | null }] */
function renderGrid(vm) {
  el.grid.innerHTML = "";
  vm.cells.forEach(c => {
    const partners = c.psel || [];
    const cell = document.createElement("div");
    cell.className = "cell" + (c.sel ? " sel" : "") + (c.peek ? " peek" : "") + (partners.length ? " psel" : "");

    const tile = document.createElement("button");
    tile.className = "tile" + (c.sealed ? " sealed" : "");
    tile.textContent = c.text;
    tile.setAttribute("aria-pressed", String(!!c.sel));
    if (c.sealed) tile.setAttribute("aria-label", "Your partner's tile");
    if (partners.length) tile.setAttribute("aria-description", `selected by ${partners.map(x => x.name).join(" and ")}`);
    tile.addEventListener("click", () => handlers.toggle?.(c.id));
    cell.appendChild(tile);

    if (partners.length && !c.sealed) {       // a sealed tile can only be your partner's pick
      const tag = document.createElement("span");
      tag.className = "ptag";
      tag.textContent = partners[0].name.slice(0, 1).toUpperCase();
      tag.setAttribute("aria-hidden", "true");
      cell.appendChild(tag);
    }
    if (c.badge) {
      const hint = document.createElement("button");
      hint.className = `hint ${c.badge.kind}` + (c.badge.level != null ? ` lv${c.badge.level}` : "");
      hint.setAttribute("aria-label", BADGE_LABEL[c.badge.kind]);
      hint.innerHTML = "<span>?</span>";
      hint.addEventListener("click", e => { e.stopPropagation(); handlers.clue?.(c.id); });
      cell.appendChild(hint);
    }
    el.grid.appendChild(cell);
  });
  fitText();
}

// Shrink a tile's text until its longest word fits on one line.
/** Shrinks text until it fits its box: tile words, and the one-line word list of each solved crate. */
function fitText() {
  const fit = (t, min) => {
    t.style.fontSize = "";
    let size = parseFloat(getComputedStyle(t).fontSize);
    while (t.scrollWidth > t.clientWidth && size > min) {
      size -= 0.5;
      t.style.fontSize = size + "px";
    }
  };
  el.grid.querySelectorAll(".tile").forEach(t => fit(t, 10));
  el.solved.querySelectorAll(".crate-words").forEach(t => fit(t, 8));
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
    li.querySelector(".g-res").textContent = RESULT_LABEL[g.res] + (g.note ? ` · ${g.note}` : "");
    li.querySelector(".g-words").textContent = g.words;
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
/** Fills the menu sheet. tag names what's on show ("game", "settings"…) so controllers can refresh it. */
export function openMenu(build, tag = "menu") {
  el.menuBody.innerHTML = "";
  build(el.menuBody, () => el.menuDlg.close());
  el.menuDlg.dataset.tag = tag;
  el.menuDlg.scrollTop = 0;
  if (!el.menuDlg.open) el.menuDlg.showModal();
}
export const closeMenu = () => el.menuDlg.open && el.menuDlg.close();
export const menuTag = () => (el.menuDlg.open ? el.menuDlg.dataset.tag : null);

/** Copies to the clipboard; falls back to a hidden text box where the clipboard API is refused. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(box);
    box.select();
    box.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  }
}

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
export function openSettings(opts) {
  const { settings, note, onChange, onBack, learning = null } = opts;
  const cats = POOL_CATS[opts.pool] || POOL_CATS.mixed;   // show only what the current pool deals from
  // editable: true, or { words, groups } when only part is yours to change (hidden mode)
  const canWords = opts.editable === true || !!opts.editable?.words;
  const canGroups = opts.editable === true || !!opts.editable?.groups;
  openMenu(body => {
    const add = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      body.appendChild(e);
      return e;
    };
    const segmented = (options, value, onPick, label, enabled = canWords) => {
      const row = document.createElement("div");
      row.className = "seg";
      row.setAttribute("role", "radiogroup");
      row.setAttribute("aria-label", label);
      options.forEach(([v, text]) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(v === value));
        b.disabled = !enabled;
        b.addEventListener("click", () => {
          row.querySelectorAll("button").forEach(o => o.setAttribute("aria-checked", String(o === b)));
          onPick(v);
        });
        row.appendChild(b);
      });
      return row;
    };

    const head = add("div", "set-head");
    const back = document.createElement("button");
    back.className = "link";
    back.textContent = "‹ Back";
    back.addEventListener("click", onBack);
    const h = document.createElement("h3");
    h.textContent = "Settings";
    head.append(back, h);

    if (learning) {
      add("h4", null, "Learning mode");
      body.appendChild(segmented(learning.modes, learning.mode, learning.onMode, "Learning mode", true));
      learning.lines.forEach(line => add("p", "stats set-note", line));
      if (learning.reset) add("button", "link", learning.reset.label).addEventListener("click", learning.reset.run);
    }

    if (note) add("p", `stats set-note${learning ? " sep" : ""}`, note);
    const s = structuredClone(settings);
    const change = mutate => { mutate(s); onChange(structuredClone(s)); };

    add("h4", null, "Preset");
    const presetRow = segmented(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), s.preset, v => {
      change(x => { x.preset = v; x.topics = { ...PRESETS[v].topics }; });
      openSettings({ ...opts, settings: s });                 // redraw the topic rows
    }, "Preset");
    body.appendChild(presetRow);

    add("h4", null, "Difficulty");
    body.appendChild(segmented([["easy", "Easy"], ["mixed", "Mixed"], ["hard", "Hard"]], s.difficulty,
      v => change(x => { x.difficulty = v; }), "Difficulty"));

    // each topic tapped round out, in and more (the same control as Punt's topics)
    for (const cat of cats) {
      body.appendChild(weights(cats.length > 1 ? `${NOUN[cat][0].toUpperCase()}${NOUN[cat].slice(1)} topics` : "Topics", TOPICS[cat], s.topics, w => {
        change(x => { for (const [k] of TOPICS[cat]) x.topics[k] = w[k] || 0; x.preset = "custom"; });
        presetRow.querySelectorAll("button").forEach(o => o.setAttribute("aria-checked", "false"));
      }));
    }

    for (const [cat, title] of [["country", "Countries from"], ["commodity", "Commodities from"]].filter(([c]) => cats.includes(c))) {
      add("h4", null, title);
      const chips = add("div", "chips");
      GROUPS[cat].forEach(([k, name]) => {
        const b = document.createElement("button");
        b.className = "chip";
        b.textContent = name;
        b.setAttribute("aria-pressed", String(!s.off.includes(k)));
        b.disabled = !canGroups;
        b.addEventListener("click", () => {
          change(x => { x.off = x.off.includes(k) ? x.off.filter(o => o !== k) : [...x.off, k]; });
          b.setAttribute("aria-pressed", String(!s.off.includes(k)));
        });
        chips.appendChild(b);
      });
    }
  }, "settings");
}
