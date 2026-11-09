// Which games and topics Deck covers (README, Deck, "Scope"): the banner's Choose button (banner.js) opens the sheet where
// they are left in or out, and Deck's own page opens it too. Deck itself is a tile in Knowledge again (Korbi, 9 Nov 2026:
// its banner plate is gone). The rules are deck-scope.js's; the choice is kept on this device (suite:deck, the games and
// topics taken out; suite: keys don't sync). Deck's own page asks the same scope for its review.
//
// A topic is a subject of the knowledge base, whose index (kb-index.js, 118 KB) every page would otherwise carry just
// for this sheet: it's fetched only when the sheet lists them.
import { ticks, line, CLOSE } from "./menu.js";
import { waitMark } from "./loading.js";
import * as pile from "./pile.js";
import { GAMES } from "./pile.js";
import { scopeOf, keptScope, topicsOf, afterTicks, sayScope } from "./deck-scope.js";

const KEY = "suite:deck";

let index = null;                          // kb-index.js, once it's here: { SUBJECTS, SUBJECT }

// ---------- what's kept ----------
export function scopeNow() { try { return scopeOf(JSON.parse(localStorage.getItem(KEY))); } catch { return scopeOf(null); } }
function keepScope(scope) {
  try {
    const kept = keptScope(scope);
    if (kept) localStorage.setItem(KEY, JSON.stringify(kept)); else localStorage.removeItem(KEY);
  } catch { /* private mode */ }
}
/** A subject's label for an entity of the knowledge base, from its index. */
export const labelOf = ({ SUBJECTS, SUBJECT }) => id => SUBJECTS[SUBJECT[id]]?.label;
/** The index, fetched once (null if it can't be: topics are then left out of the sums, and the games still count). */
function loadIndex() {
  if (index) return Promise.resolve(index);
  return import("./kb-index.js").then(m => (index = m), () => null);
}

// ---------- the sheet: which games and topics ----------
/**
 * The games and topics Deck covers, each ticked or not (all at first), with All and None, drawn into `body`: the pane of
 * the banner's Choose sheet and of Deck's own. `subjects` is the knowledge base's index when the caller has it (Deck's
 * page does), `onChange(scope)` after every tap. The topics are those the piles have something about, so the list is
 * the ones that matter; they come when the index has (it's fetched only now), if `body` is still on show.
 */
export function deckPane(body, { subjects = null, onChange = null } = {}) {
  if (subjects) index = subjects;
  const say = line("");
  let scope = scopeNow();
  const tell = () => { say.textContent = sayScope(scope); };
  const change = (kind, all) => ticked => { scope = afterTicks(scope, kind, all, ticked); keepScope(scope); tell(); onChange?.(scope); };
  const gameIds = Object.keys(GAMES);
  const games = ticks("Games", gameIds.map(id => [id, GAMES[id]]), gameIds.filter(id => !scope.games.includes(id)), change("games", gameIds), Infinity, { all: true });
  tell();
  const wait = line("");
  wait.prepend(waitMark());
  wait.append("Reading the topics");
  body.replaceChildren(say, games, ...(index ? [] : [wait]));
  const topics = () => {
    const labels = index.SUBJECTS.map(s => s.label), of = labelOf(index);
    const list = topicsOf(pile.all(), labels, scope, of);
    wait.remove();
    if (!list.length) { body.append(line("Topics appear here once the piles hold cards about them.")); return; }
    body.append(ticks("Topics", list.map(l => [l, l]), list.filter(l => !scope.subjects.includes(l)), change("subjects", list), Infinity, { all: true }));
  };
  if (index) topics(); else loadIndex().then(i => { if (i && body.closest("dialog")?.open) topics(); else wait.remove(); });
}
/** Deck's own sheet of the same (Deck's page: its menu and its overview), in `host`. */
export function openScope(host, options = {}) {
  let sheet = host.querySelector(":scope > dialog.rd-scope");
  if (!sheet) {
    sheet = document.createElement("dialog");
    sheet.className = "apps-pop rd-scope";
    sheet.setAttribute("aria-label", "What Deck covers");
    sheet.innerHTML = `<div class="pick-head"><h2>Deck</h2><button class="icon-btn" type="button" aria-label="Close">${CLOSE}</button></div><div class="rd-sheet-body"></div>`;
    sheet.querySelector(".pick-head button").addEventListener("click", () => sheet.close());
    sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });
    host.appendChild(sheet);
  }
  deckPane(sheet.querySelector(".rd-sheet-body"), options);
  sheet.showModal();
  return sheet;
}
