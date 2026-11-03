// The board both pages of Crates draw (README, Crates): Countries is crates.html and Classic is lots.html, and Korbi had them
// look the same, centred (3 November 2026). Sixteen tiles in a four by four, each lot found taking a row as a bar in its
// enamel; the strip above (what's on the board, the mistakes left), the line under it (what to do, what a guess came to),
// the buttons below. Styles are crates-board.css's; what a page keeps (its run, its clock, its taps) stays its own.

import { choice, line } from "./menu.js";

const landedOf = new WeakMap();

/**
 * Draws a board into box: lots (found ones first, as bars in their enamel, then at the end the ones missed) and the tiles
 * still in play.
 *  lots:  [{ g, rank, name, words, by, missed, onTap }]
 *  tiles: [{ id, text, sel, sealed, theirs, who, peek, mark (0-3), markPick, badge: { kind, level, label } }]
 *  on:    { tap(id), badge(id), mark(id) }; off: nothing can be tapped; fresh: a board just put down (no landing)
 */
export function drawBoard(box, { lots, tiles, on = {}, off = false, fresh = false }) {
  const key = lots.map(l => `${l.g}${l.missed ? "m" : ""}`).join(","), was = fresh ? null : landedOf.get(box);
  const grew = was != null && key.length > was.length && key.startsWith(was);
  landedOf.set(box, key);
  box.replaceChildren(
    ...lots.map((l, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `cb-lot l${l.rank}${l.missed ? " missed" : ""}${grew && i === lots.length - 1 ? " land" : ""}`;
      const name = document.createElement("span"), words = document.createElement("span");
      name.className = "cb-lot-name";
      name.textContent = l.name;
      words.className = "cb-lot-words";
      words.textContent = l.words.join(" · ");
      b.append(name, words);
      if (l.by) { const by = document.createElement("span"); by.className = "cb-lot-by"; by.textContent = l.by; b.append(by); }
      b.setAttribute("aria-label", `${l.name}: ${l.words.join(", ")}`);
      if (l.onTap) b.addEventListener("click", l.onTap);
      return b;
    }),
    ...tiles.map(t => {
      const cell = document.createElement("div");
      cell.className = `cb-cell${t.theirs ? " theirs" : ""}${t.peek ? " peek" : ""}`;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `cb-tile${t.sealed ? " sealed" : ""}`;
      const word = document.createElement("span");
      word.className = "cb-word";
      word.textContent = t.text;
      tile.append(word);
      tile.style.setProperty("--len", String(Math.max(5, t.text.length)));
      tile.setAttribute("aria-pressed", String(!!t.sel));
      if (t.sealed) tile.setAttribute("aria-label", t.theirs ? "Your partner's word, which they've picked" : "Your partner's word");
      tile.disabled = off || !!t.sealed;
      tile.addEventListener("click", () => on.tap?.(t.id));
      cell.append(tile);
      if (t.who) { const w = document.createElement("span"); w.className = "cb-who"; w.textContent = t.who; w.setAttribute("aria-hidden", "true"); cell.append(w); }
      if (t.markPick) {                                          // selected: the swatch, to mark it or move the mark on
        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = `cb-mark pick${t.mark != null ? ` m${t.mark}` : ""}`;
        pick.setAttribute("aria-label", t.mark != null ? `Marked ${MARK_NAMES[t.mark]}: tap for the next colour` : "Mark the crate you think it goes in");
        pick.addEventListener("click", e => { e.stopPropagation(); on.mark?.(t.id); });
        cell.append(pick);
      } else if (t.mark != null) {                               // let go: the note stays in the corner
        const dot = document.createElement("span");
        dot.className = `cb-mark m${t.mark}`;
        dot.setAttribute("aria-hidden", "true");
        cell.append(dot);
      }
      if (t.badge) {
        const hint = document.createElement("button");
        hint.type = "button";
        hint.className = `cb-hint ${t.badge.kind}${t.badge.level != null ? ` lv${t.badge.level}` : ""}`;
        hint.setAttribute("aria-label", t.badge.label);
        hint.innerHTML = "<span>?</span>";
        hint.addEventListener("click", e => { e.stopPropagation(); on.badge?.(t.id); });
        cell.append(hint);
      }
      return cell;
    }));
  fitWords(box);
}
export const MARK_NAMES = ["ochre", "verdigris", "cobalt", "oxblood"];

/** Each tile's word on one line, shrunk where its letters are wider than the tile (KANGAROO, REMBRANDT on a phone); a
 *  lot's words on one line too, down to a floor, then an ellipsis. */
export function fitWords(box) {
  for (const w of box.querySelectorAll(".cb-word")) {
    w.style.fontSize = "";
    const tile = w.parentElement, cs = getComputedStyle(tile);
    const room = tile.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (w.offsetWidth > room && room > 0) w.style.fontSize = `${(parseFloat(cs.fontSize) * room / w.offsetWidth) * 0.97}px`;
  }
  for (const w of box.querySelectorAll(".cb-lot-words")) {
    w.style.fontSize = "";
    const size = parseFloat(getComputedStyle(w).fontSize);
    if (w.scrollWidth > w.clientWidth && w.clientWidth > 0) w.style.fontSize = `${Math.max(9, size * w.clientWidth / w.scrollWidth * 0.97)}px`;
  }
}

/** A wrong guess shakes the picks it was made of, once: the class goes when the shake is over, since every tap redraws. */
let shaking = 0;
export function shake(box) {
  box.classList.remove("shake");
  void box.offsetWidth;
  box.classList.add("shake");
  clearTimeout(shaking);
  shaking = setTimeout(() => box.classList.remove("shake"), 400);
  navigator.vibrate?.(40);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Counts in the strip: the mistakes left as dots (Crates also its clues left, as small ringed ones); or a line of words. */
export function drawCount(el, { mistakes = null, clues = null, text = null } = {}) {
  if (text != null) { el.replaceChildren(text); return; }
  const out = [];
  const dots = (label, left, max, cls) => {
    const box = document.createElement("span");
    box.className = `cb-dots ${cls}`;
    box.setAttribute("aria-label", `${plural(left, label.toLowerCase())} left`);
    for (let i = 0; i < max; i++) { const d = document.createElement("i"); if (i >= left) d.className = "gone"; if (cls === "clues") d.textContent = "?"; box.append(d); }
    out.push(label, box);
  };
  if (mistakes) dots("Mistakes", mistakes.left, mistakes.max, "mistakes");
  if (clues) dots("Clues", clues.left, clues.max, "clues");
  el.replaceChildren(...out);
}

/**
 * The line under the board: what to do, what a guess came to, a clue. prompt() is what it says when nothing has just
 * happened: a string, or { label, text, level } for a clue. Always the same height, so nothing moves.
 */
export function createLine(el, prompt) {
  let message = null;
  const draw = () => {
    if (message && Date.now() > message.until) message = null;
    const t = message?.text ?? prompt();
    el.className = `cb-line${message?.tone ? ` ${message.tone}` : ""}`;
    if (t && typeof t === "object") {
      el.classList.add("clue", ...(t.level != null ? [`lv${t.level}`] : []));
      const b = document.createElement("b"), span = document.createElement("span");
      b.textContent = `${t.label}: `;
      span.textContent = t.text;
      el.replaceChildren(b, span);
    } else if (el.textContent !== (t || "") || el.firstElementChild) el.textContent = t || "";
  };
  return {
    draw,
    say(text, tone = "", ms = 2600) { message = text ? { text, tone, until: ms ? Date.now() + ms : Infinity } : null; draw(); },
    clear() { message = null; },
    get active() { return !!message; },
    get expired() { return !!message && Date.now() > message.until; },
  };
}

/** The buttons under the board: play (Shuffle, Deselect, Submit), or the end of a board (Share, the way on). */
export function setControls(box, { kind = "play", share = true, next = "Next board", canNext = true } = {}) {
  const [shuffle, clear, submit] = box.querySelectorAll("button");
  box.dataset.kind = kind;
  if (kind === "end") {
    shuffle.hidden = true;
    clear.hidden = !share;
    clear.textContent = "Share";
    clear.disabled = false;
    submit.hidden = !canNext;
    submit.textContent = next;
    submit.disabled = false;
    box.classList.toggle("two", share && canNext);
    box.classList.toggle("one", !(share && canNext));
  } else {
    shuffle.hidden = clear.hidden = submit.hidden = false;
    clear.textContent = "Deselect";
    submit.textContent = "Submit";
    box.classList.remove("two", "one");
  }
}

/**
 * A lot's story in a sheet, when its bar is tapped: lines of [bold, plain] (or plain text). Built once, on the page.
 */
let sheet = null;
export function lotSheet({ title, lines }) {
  if (!sheet) {
    sheet = document.createElement("dialog");
    sheet.className = "sheet cb-sheet";
    sheet.innerHTML = '<div class="pick-head"><h2></h2><button class="btn" type="button">Close</button></div><div class="cb-sheet-body"></div>';
    sheet.querySelector("button").addEventListener("click", () => sheet.close());
    sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });
    document.body.append(sheet);
  }
  sheet.querySelector("h2").textContent = title;
  sheet.querySelector(".cb-sheet-body").replaceChildren(...lines.map(l => {
    const p = document.createElement("p");
    if (Array.isArray(l)) { const b = document.createElement("b"); b.textContent = l[0]; p.append(b, ` ${l[1]}`); } else p.textContent = l;
    return p;
  }));
  if (!sheet.open) sheet.showModal();
}

/**
 * The menu's first choice on both pages: Countries (crates.html) or Classic (lots.html), and in plain words what each is.
 * onPick(value) takes the player to the other page, asking first if a board is unfinished.
 */
export function modeChoice(current, onPick) {
  return [
    choice("Mode", [["country", "Countries"], ["classic", "Classic"]], current, v => { if (v !== current) onPick(v); }),
    line("Countries: find four crates of four words, then name the country behind each."),
    line("Classic: sixteen words, four hidden groups; find them, four mistakes allowed."),
  ];
}
