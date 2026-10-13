// Cue: a party game. Tap anywhere and a simple word pops up, an animal, a thing, an action, to act, draw or describe;
// no word comes twice until every one has (cue-deck.js), and the deck is kept, so a reload or tomorrow's party carries
// on where it was. Under the word, a second to read it, then three counted down (cue-clock.js). The kinds of word, the
// kind shown over the word and the countdown are in the menu.
import { KINDS } from "./cue-words.js";
import { deal, next, back, current, valid, wordsOf } from "./cue-deck.js";
import { READ, COUNT, clockAt } from "./cue-clock.js";
import { part, ticks, toggle, action, line, onPause, isPaused } from "./menu.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const DECK = "cue:deck", OPTS = "cue:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const ALL = KINDS.map(k => k.id);
/** Plays a CSS animation again from its start: the class off and back on, with a layout between so it counts. */
const again = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

let opts = { kinds: ALL, kind: true, clock: true, ...read(OPTS, {}) };
opts.kinds = opts.kinds.filter(id => ALL.includes(id));
if (!opts.kinds.length) opts.kinds = ALL;
let deck = read(DECK, null);
if (!valid(deck) || deck.kinds.join() !== opts.kinds.join()) deck = deal(opts.kinds);
let shown = 0;                                                   // when the last word came, so a double tap counts once

// ---------- the countdown ----------
// A word's countdown runs from the moment it came up: `since`, on this page's clock, moved on by any pause (null: no
// countdown for the word up). The moment is kept with the deck as well (deck.when, the time of day), so a reload,
// another of your devices or a partner watching draws the same countdown.
let since = null, rung = false, frame = 0;
{
  const ago = Date.now() - (deck.when || 0);
  if (current(deck) && ago >= 0 && ago < READ + COUNT) since = performance.now() - ago;
}
/** The dial as the countdown stands, and again each frame until it reaches nought (not while the game stands still). */
function drawClock() {
  cancelAnimationFrame(frame);
  const dial = $("dial");
  if (dial.hidden) return;
  const now = performance.now(), c = since === null ? { phase: "idle", n: null, left: 0 } : clockAt(now - since);
  dial.dataset.phase = c.phase;
  $("dialArc").style.strokeDashoffset = String(100 * (1 - c.left));
  const num = $("dialNum"), n = c.n === null ? "" : String(c.n);
  if (num.textContent !== n) { num.textContent = n; if (n) again(num, "tick"); }
  if (c.phase === "over") {
    // the card flashes as the count reaches nought, not when the page comes back to a count long over
    if (!rung && now - since - READ - COUNT < 500) again($("stage"), "ding");
    rung = true;
  } else if (since !== null && !isPaused()) frame = requestAnimationFrame(drawClock);
}
onPause(() => cancelAnimationFrame(frame), ms => {
  // a count the menu or the games screen stopped goes on where it stood
  if (since !== null && clockAt(performance.now() - ms - since).phase !== "over") {
    since += ms;
    if (deck.when) { deck = { ...deck, when: deck.when + ms }; write(DECK, deck); }
  }
  drawClock();
});

// ---------- the word ----------
/** The word up, drawn as large as the card allows; `pop`, with the burst behind it as it comes. */
function draw(pop = false) {
  const w = current(deck), word = $("word"), kind = $("kind");
  $("hint").hidden = !!w;
  word.textContent = w ? w.word : "";
  kind.textContent = w && opts.kind ? KINDS.find(k => k.id === w.kind)?.one || "" : "";
  kind.hidden = !kind.textContent;
  $("dial").hidden = !(w && opts.clock);
  $("back").disabled = deck.at <= 1;
  $("count").textContent = w ? `${deck.at} of ${deck.order.length}${deck.round > 1 ? `, round ${deck.round}` : ""}` : `${deck.order.length} words`;
  fit();
  if (pop && w) { again(word, "pop"); again($("stage"), "burst"); }
  drawClock();
}
/** The word as large as the card holds: a third of its height at most, no more than the kind and the dial leave of it,
 *  and no wider than nine tenths of it; a word that would come out under 3rem in the wide capitals takes the narrower
 *  letters first, a quarter larger for it. */
function fit() {
  const word = $("word"), stage = $("stage"), card = word.parentElement;
  if (!word.textContent) return;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, css = getComputedStyle(card);
  const others = [...card.children].filter(el => el !== word && !el.hidden);
  const taken = others.reduce((h, el) => h + el.offsetHeight, 0) + others.length * parseFloat(css.rowGap) + parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
  const size = Math.min(stage.clientHeight * 0.32, rem * 9, (stage.clientHeight - taken) / 1.05), room = stage.clientWidth * 0.88;
  word.classList.remove("narrow");
  word.style.fontSize = `${size}px`;
  if ((size * room) / word.scrollWidth < rem * 3) word.classList.add("narrow");
  const need = word.scrollWidth;
  if (need > room) word.style.fontSize = `${(size * room) / need}px`;
}
/** A step through the deck, and the word it comes to gets its second to read and its countdown afresh. */
function step(move) {
  const was = deck;
  deck = move(deck);
  if (deck === was) return;                                      // nothing before the first word
  deck = { ...deck, when: Date.now() };
  write(DECK, deck);
  since = performance.now();
  rung = false;
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
  const dealt = d => { deck = d; since = null; write(DECK, deck); draw(); };
  body.replaceChildren();
  part(body, "play").append(action("Shuffle them all again", () => dealt(deal(opts.kinds, Math.random, deck.order[deck.at - 1] || null)), "primary"));
  part(body, "content").append(ticks("Words", KINDS.map(k => [k.id, k.name]), opts.kinds, kinds => {
    opts.kinds = kinds.length ? kinds : ALL;                       // none ticked: all of them
    write(OPTS, opts);
    dealt(deal(opts.kinds));
    say();
  }));
  part(body, "settings").append(
    toggle("The kind over the word", opts.kind, on => { opts.kind = on; write(OPTS, opts); draw(); }),
    // turned on, it counts from the next word: the one up has been read
    toggle("Count down 3, 2, 1", opts.clock, on => { opts.clock = on; write(OPTS, opts); since = null; draw(); }));
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
