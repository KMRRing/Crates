// Everything that touches the page. Controllers hand render() a plain view model. The board's look is crates-board.js's,
// shared with Classic (lots.html), so the two pages look the same.
import { NOUN, RESULT_LABEL, GROUPS } from "./core.js";
import { topicsPart } from "./topics-ui.js";
import { drawBoard, fitWords, shake as shakeBoard, drawCount, createLine, setControls, lotSheet, MARK_NAMES } from "./crates-board.js";

const $ = id => document.getElementById(id);
const el = {
  menuBtn: $("menuBtn"), pNum: $("pNum"), what: $("what"), count: $("count"), sub: $("sub"), board: $("board"), line: $("line"),
  controls: $("controls"), submit: $("submitBtn"), shuffle: $("shuffleBtn"), clear: $("clearBtn"), feed: $("feed"),
  nameDlg: $("nameDlg"), nameForm: $("nameForm"), nameWords: $("nameWords"),
  nameLabel: $("nameLabel"), nameInput: $("nameInput"), skip: $("skipBtn"),
  menuDlg: $("menuDlg"), menuBody: $("menuBody"), menuClose: $("menuClose"),
  whoDlg: $("whoDlg"), whoForm: $("whoForm"), whoInput: $("whoInput"),
};

let handlers = {};
let current = null;          // last view model
let shownBoard = null;       // the board drawn last, so a new one doesn't land its lots
let nameOpenFor = null;      // pending key the naming sheet is open for
const talk = createLine(el.line, () => lineOf(current));

export function bind(h) { handlers = h; }

// ---------- one-time wiring ----------
el.submit.addEventListener("click", () => (el.controls.dataset.kind === "end" ? handlers.next?.() : handlers.submit?.()));
el.clear.addEventListener("click", () => (el.controls.dataset.kind === "end" ? handlers.share?.() : handlers.clear?.()));
el.shuffle.addEventListener("click", () => handlers.shuffle?.());
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
  if (e.key === "Enter" && !document.querySelector("dialog[open]") && !el.submit.disabled && !el.submit.hidden && el.controls.dataset.kind !== "end") handlers.submit?.();
});
let fitTimer;
window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => current && render(current), 100); });
document.fonts?.ready.then(() => fitWords(el.board));
setInterval(() => { if (talk.expired) talk.draw(); }, 400);

// ---------- the line: what to do, what a guess came to, a clue ----------
/** A message in the line for a moment: what a guess came to, a clue sent. tone: "good", "bad" or "". */
export function toast(msg, ms = 2000, tone = "") { talk.say(msg, tone, ms || 0); }
export const shake = () => shakeBoard(el.board);

/** What the line says when nothing has just happened: the clue on show, else where things stand. */
function lineOf(vm) {
  if (!vm) return "";
  if (vm.done) return [vm.resultLine, vm.subLine].filter(Boolean).join(". ") + ".";
  if (vm.clue) return { label: vm.clue.label, text: [vm.clue.text, vm.clue.note].filter(Boolean).join(" "), level: vm.clue.level };
  if (vm.status) return vm.status;
  if (vm.brief) return vm.brief;
  const picked = vm.cells.filter(c => c.sel).length;
  return picked === 4 ? "Submit, or change a pick." : picked ? "Pick four words that belong together." : `Find four crates of four words, then name the ${NOUN[vm.category] || "country"} behind each.`;
}

// ---------- render ----------
export function render(vm) {
  current = vm;
  document.getElementById("app").classList.toggle("coop", vm.mode === "coop");

  el.pNum.textContent = vm.label && vm.label !== "–" ? `No. ${vm.label}` : "";   // in the menu's title
  if (vm.category) el.nameLabel.textContent = `Which ${NOUN[vm.category]} links these four?`;
  const fresh = shownBoard !== vm.boardKey;
  shownBoard = vm.boardKey;
  el.what.textContent = vm.mode === "coop" ? "Countries · together" : "Countries";
  drawCount(el.count, vm.team ? { mistakes: { left: vm.team.lives, max: vm.team.maxLives }, clues: { left: vm.team.clues, max: vm.team.maxClues } } : {});
  renderSub(vm);
  renderBoard(vm, fresh);
  renderFeed(vm);

  el.controls.hidden = !!vm.hideControls;
  if (vm.done) setControls(el.controls, { kind: "end", share: !!vm.canShare, canNext: !!vm.canNext, next: vm.nextLabel || "Next board" });
  else {
    setControls(el.controls, { kind: "play" });
    el.submit.disabled = !vm.canSubmit;
    el.clear.disabled = !vm.cells.some(c => c.sel);
    el.shuffle.disabled = false;
  }
  talk.draw();
  syncNameSheet(vm);
}

/** The second line: your partner and whether they're here, or the learning mode's progress. */
function renderSub(vm) {
  el.sub.replaceChildren();
  if (vm.players) {
    vm.players.forEach(pl => {
      const nm = document.createElement("span");
      nm.className = `pl-name s${pl.slot}${pl.online === false || pl.elsewhere ? " away" : ""}`;
      nm.textContent = `${pl.me ? `${pl.name} (you)` : pl.name}${pl.ready ? " ✓" : ""}${pl.elsewhere ? ` · in ${pl.elsewhere}` : ""}`;
      el.sub.appendChild(nm);
    });
    if (vm.players.length < 2) { const wait = document.createElement("span"); wait.textContent = "waiting for a partner…"; el.sub.appendChild(wait); }
  } else if (vm.modeNote) el.sub.textContent = vm.modeNote;
  el.sub.hidden = !el.sub.childNodes.length;
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
    lines.push(others.length ? `${word} also fits ${listJoin(others)}.` : `${word}.`);
  }
  info.forEach((o, k) => {
    if (k === g || !shown.has(k)) return;
    o.herrings.filter(h => h.other === g).forEach(h => lines.push(`${h.word} also fits here, but belongs to ${o.answer}.`));
  });
  return lines;
}

const listJoin = xs => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** A crate's bar, and what its sheet tells when it's tapped: each word's clue, and the red herrings. */
function lotsOf(vm) {
  const shown = new Set(vm.solved.map(r => r.g));
  return vm.solved.map(r => {
    const gr = vm.groupsInfo[r.g];
    let meta = r.missed ? "not found" : r.named ? "named" : "half: " + (r.guess ? `said ${r.guess}` : "skipped");
    if (r.by && !r.missed) meta = `${r.by}, ${meta}`;
    const flags = {};                       // learning mode: "↻ 2", "✓ 1" beside the crate name
    gr.details.forEach(([, , tag]) => { if (tag) flags[tag[0]] = (flags[tag[0]] || 0) + 1; });
    const by = [meta, ...Object.entries(flags).map(([icon, n]) => `${icon} ${n}`)].join(" · ");
    const lines = gr.details.map(([w, hint, tag]) => [`${w}:`, tag ? `${hint} (${tag})` : hint]);
    herringLines(vm, r.g, shown).forEach(t => lines.push(["Red herring:", t]));
    return { g: r.g, rank: gr.level, name: gr.answer, words: gr.words, by, missed: !!r.missed, onTap: () => lotSheet({ title: gr.answer, lines }) };
  });
}

const BADGE_LABEL = {
  offer: "Use a clue on this tile", spent: "No clues left", open: "Show the clue", used: "A clue was used on this word",
};

// ---------- marks: your note of which crate a tile goes in ----------
// A selected tile shows a swatch in its bottom-left corner: a tap marks it with a crate's colour (ochre, verdigris,
// cobalt, oxblood) and the next tap moves it on, to none after the last. The colour stays in that corner once the tile
// is let go, a note of where you think it belongs. Marks are yours alone: kept on this device by board, never sent to
// a partner, the last few boards remembered.
const MARKS_KEY = "crates:marks";
const readMarks = () => { try { return JSON.parse(localStorage.getItem(MARKS_KEY)) || {}; } catch { return {}; } };
function cycleMark(board, word) {
  const all = readMarks(), m = { ...(all[board] || {}) }, now = m[word];
  if (now == null) m[word] = 0; else if (now >= MARK_NAMES.length - 1) delete m[word]; else m[word] = now + 1;
  delete all[board];
  all[board] = m;                                               // the board marked last is the newest
  const boards = Object.keys(all);
  while (boards.length > 8) delete all[boards.shift()];
  try { localStorage.setItem(MARKS_KEY, JSON.stringify(all)); } catch { /* private mode */ }
}

/** The crates found (and, once it's over, missed) as bars, then the tiles still in play. cells: [{ id, text, sealed, peek, sel, psel: [{ slot, name }], badge: { kind, level } | null }] */
function renderBoard(vm, fresh = false) {
  const board = vm.boardKey && vm.boardKey !== "lobby" ? String(vm.boardKey) : null, marks = board ? readMarks()[board] || {} : {};
  const tiles = vm.cells.map(c => {
    const partners = c.psel || [];
    return {
      id: c.id, text: c.text, sel: c.sel, sealed: c.sealed, peek: c.peek, theirs: partners.length > 0,
      who: partners.length && !c.sealed ? partners[0].name.slice(0, 1).toUpperCase() : "",
      mark: c.sealed ? null : marks[c.id], markPick: !!board && c.sel && !c.sealed,
      badge: c.badge ? { ...c.badge, label: BADGE_LABEL[c.badge.kind] } : null,
    };
  });
  drawBoard(el.board, { lots: lotsOf(vm), tiles, fresh,
    on: { tap: id => handlers.toggle?.(id), badge: id => handlers.clue?.(id), mark: id => { cycleMark(board, id); renderBoard(vm); } } });
}

/** Your guesses and your partner's, beside the board when it's held sideways (a phone has no room). */
function renderFeed(vm) {
  el.feed.replaceChildren(...(vm.feed || []).slice().reverse().map(g => {
    const li = document.createElement("li"), b = document.createElement("b");
    b.textContent = `${g.by}: ${(RESULT_LABEL[g.res] || g.res).toLowerCase()}${g.note ? ` · ${g.note}` : ""}`;
    li.append(b, ` ${g.words}`);
    return li;
  }));
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
  // editable: true, or { words, groups } when only part is yours to change (hidden mode)
  const canGroups = opts.editable === true || !!opts.editable?.groups;
  openMenu(body => {
    const add = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      body.appendChild(e);
      return e;
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
      add("h4", null, `Learning: ${learning.label}`);
      add("p", "stats set-note", "Set on the games screen, under Choose.");
      learning.lines.forEach(line => add("p", "stats set-note", line));
      if (learning.reset) add("button", "link", learning.reset.label).addEventListener("click", learning.reset.run);
    }

    if (note) add("p", `stats set-note${learning ? " sep" : ""}`, note);
    const s = structuredClone(settings);
    const change = mutate => { mutate(s); onChange(structuredClone(s)); };

    add("h4", null, "Topics");
    for (const node of topicsPart(body)) body.appendChild(node);           // the subjects are Settings’, not this game’s

    add("h4", null, "Countries from");
    const chips = add("div", "chips");
    GROUPS.country.forEach(([k, name]) => {
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
  }, "settings");
}
