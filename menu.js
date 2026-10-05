// Every game's menu, the same everywhere. A game still fills its menu (#menuBody) as it always has; this module
// shapes what it puts there each time it opens:
//  - the sheet: a title, an × at the top right, a tap outside closes it; it rises from the bottom on a phone and
//    stands as a card on a wide screen (style.css)
//  - the order: a game that marks its parts with data-part (or uses part() below) has them laid out as Play, Content,
//    Together, Settings, About, whatever order it added them in, each under the same small heading
//  - the clutter: a long explanation (more than a sentence or two) goes into one closed "How it works" at the
//    bottom, so the menu shows choices and buttons, and the reading is there for whoever opens it
// Loaded by every page through pwa.js.

export const PARTS = ["play", "content", "together", "settings", "about"];
const LABEL = { play: "", content: "Content", together: "Together", settings: "Settings", about: "About" };
const LONG = 120;                           // characters: longer than this, an explanation folds away

/** A part of the menu, made in `body` and laid out in its place: part(body, "settings").append(...). */
export function part(body, name) {
  let box = body.querySelector(`:scope > [data-part="${name}"]`);
  if (!box) { box = document.createElement("section"); box.dataset.part = name; box.className = "menu-part"; body.appendChild(box); }
  return box;
}

const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
let shaping = false;
/** Lays out what the game just put in the menu: parts in order, under their headings; long explanations folded away. */
function shape(body) {
  if (shaping) return;
  shaping = true;
  try {
    // parts in the standard order, each with its heading (Play needs none: it's the top), after anything unmarked
    for (const box of body.querySelectorAll(":scope > [data-part]")) {
      const name = box.dataset.part;
      if (LABEL[name] && !box.querySelector(":scope > .menu-h")) { const h = document.createElement("h4"); h.className = "menu-h"; h.textContent = LABEL[name]; box.prepend(h); }
    }
    // long explanations, wherever they are, into one closed "How it works" at the very bottom
    let about = body.querySelector(":scope > details.menu-how");
    const long = [...body.querySelectorAll("p.stats, p.set-note, p.note")].filter(p => !p.closest("details.menu-how") && !p.dataset.keep && p.textContent.trim().length > LONG);
    if (long.length) {
      if (!about) { about = document.createElement("details"); about.className = "menu-how"; about.innerHTML = "<summary>How it works</summary>"; }
      for (const p of long) about.appendChild(p);
    }
    // the order: unmarked things as the game added them, then the parts in standard order, then How it works; nodes
    // are only moved when the order is wrong, so laying it out doesn't set itself off again
    const kids = [...body.children];
    const want = [...kids.filter(k => !k.dataset.part && k !== about), ...PARTS.map(p => kids.find(k => k.dataset.part === p)).filter(Boolean), ...(about ? [about] : [])];
    if (want.some((k, i) => kids[i] !== k)) for (const k of want) body.appendChild(k);
    // headings left with nothing under them (their only line folded away) go too
    for (const h of body.querySelectorAll(":scope > h3, :scope > h4:not(.menu-h)")) { const next = h.nextElementSibling; if (!next || /^H[34]$/.test(next.tagName) || next === about) h.remove(); }
  } finally { shaping = false; }
}

/** Gives the page's menu its shape: the × at the top right, a tap outside closes, and the contents laid out on each open. */
function upgrade() {
  const dlg = document.getElementById("menuDlg");
  if (!dlg || dlg.dataset.shaped) return;
  dlg.dataset.shaped = "1";
  dlg.classList.add("menu-sheet");
  const close = document.getElementById("menuClose") || dlg.querySelector(".pick-head .btn");
  if (close) {                                                   // the game's own Close button, as an ×: its listener stays
    close.className = "icon-btn menu-x";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = CLOSE;
  }
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });   // the backdrop: outside the sheet
  const body = document.getElementById("menuBody") || dlg;
  new MutationObserver(() => queueMicrotask(() => shape(body))).observe(body, { childList: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", upgrade); else upgrade();
