// Cue: a party game. Tap anywhere and a simple word pops up, an animal, a thing, an action, to act, draw or describe;
// no word comes twice until every one has (cue-deck.js), and the deck is kept, so a reload or tomorrow's party carries
// on where it was. The kinds of word, and whether the kind is shown over the word, are in the menu.
import { KINDS } from "./cue-words.js";
import { deal, next, back, current, valid, wordsOf } from "./cue-deck.js";
import { part, ticks, toggle, action, line } from "./menu.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const DECK = "cue:deck", OPTS = "cue:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const ALL = KINDS.map(k => k.id);

let opts = { kinds: ALL, kind: true, ...read(OPTS, {}) };
opts.kinds = opts.kinds.filter(id => ALL.includes(id));
if (!opts.kinds.length) opts.kinds = ALL;
let deck = read(DECK, null);
if (!valid(deck) || deck.kinds.join() !== opts.kinds.join()) deck = deal(opts.kinds);
let shown = 0;                                                   // when the last word came, so a double tap counts once

// ---------- the word ----------
/** The word up, drawn as large as the card allows; `pop`, with the burst behind it as it comes. */
function draw(pop = false) {
  const w = current(deck), word = $("word"), kind = $("kind");
  $("hint").hidden = !!w;
  word.textContent = w ? w.word : "";
  kind.textContent = w && opts.kind ? KINDS.find(k => k.id === w.kind)?.one || "" : "";
  kind.hidden = !kind.textContent;
  $("back").disabled = deck.at <= 1;
  $("count").textContent = w ? `${deck.at} of ${deck.order.length}${deck.round > 1 ? `, round ${deck.round}` : ""}` : `${deck.order.length} words`;
  fit();
  if (pop && w) for (const [el, cls] of [[word, "pop"], [$("stage"), "burst"]]) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
}
/** The word as large as the card holds: a third of its height at most, and no wider than nine tenths of it; a word
 *  that would come out under 3rem in the wide capitals takes the narrower letters first, a quarter larger for it. */
function fit() {
  const word = $("word"), stage = $("stage");
  if (!word.textContent) return;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const size = Math.min(stage.clientHeight * 0.32, rem * 9), room = stage.clientWidth * 0.88;
  word.classList.remove("narrow");
  word.style.fontSize = `${size}px`;
  if ((size * room) / word.scrollWidth < rem * 3) word.classList.add("narrow");
  const need = word.scrollWidth;
  if (need > room) word.style.fontSize = `${(size * room) / need}px`;
}
function step(move) {
  deck = move(deck);
  write(DECK, deck);
  draw(move === next);
}
/** A tap anywhere on the card: the next word (a second tap within a third of a second is the same tap). */
function tap() {
  const now = performance.now();
  if (now - shown < 330) return;
  shown = now;
  step(next);
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody"), about = line("");
  const say = () => { about.textContent = `${wordsOf(opts.kinds).length} words in play; none comes twice until every one has.`; };
  body.replaceChildren();
  part(body, "play").append(action("Shuffle them all again", () => { deck = deal(opts.kinds, Math.random, deck.order[deck.at - 1] || null); write(DECK, deck); draw(); }, "primary"));
  part(body, "content").append(ticks("Words", KINDS.map(k => [k.id, k.name]), opts.kinds, kinds => {
    opts.kinds = kinds.length ? kinds : ALL;                       // none ticked: all of them
    write(OPTS, opts);
    deck = deal(opts.kinds);
    write(DECK, deck);
    draw();
    say();
  }));
  part(body, "settings").append(toggle("The kind over the word", opts.kind, on => { opts.kind = on; write(OPTS, opts); draw(); }));
  part(body, "about").append(about);
  say();
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "cue");
document.querySelector(".cu-mark").innerHTML = APPS.find(a => a.id === "cue")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("stage").addEventListener("click", tap);
$("stage").addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); } });
$("back").addEventListener("click", () => step(back));
addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "ArrowRight") tap();
  else if (e.key === "ArrowLeft") step(back);
});
let resizing = null;
addEventListener("resize", () => { clearTimeout(resizing); resizing = setTimeout(fit, 60); });
window.__cue = { get deck() { return deck; }, tap, back: () => step(back) };
draw();
