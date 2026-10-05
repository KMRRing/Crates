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

// ---------- the controls, the same in every game ----------
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** One of: a label and a segmented row; onChange(value) when another is tapped. options: [[value, text], …]. */
export function choice(label, options, value, onChange) {
  const row = el("div", "menu-row"), seg = el("div", "menu-seg");
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", label);
  for (const [v, text] of options) {
    const b = el("button", null, text);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(v === value));
    b.addEventListener("click", () => {
      if (v === value) return;
      value = v;
      for (const x of seg.children) x.setAttribute("aria-checked", String(x === b));
      onChange(v);
    });
    seg.appendChild(b);
  }
  row.append(el("span", "menu-label", label), seg);
  return row;
}
/** A switch: a label and on or off; onChange(on). */
export function toggle(label, on, onChange) {
  const row = el("div", "menu-row"), sw = el("button", "menu-switch");
  sw.type = "button";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(!!on));
  sw.setAttribute("aria-label", label);
  sw.addEventListener("click", () => { on = !on; sw.setAttribute("aria-checked", String(on)); onChange(on); });
  row.append(el("span", "menu-label", label), sw);
  return row;
}
/** A button: the menu closes, then fn runs. kind: "primary" (the one to press), "" (plain) or "link" (quiet). */
export function action(text, fn, kind = "") {
  const b = el("button", kind === "link" ? "link menu-link" : `btn wide${kind === "primary" ? " primary" : ""}`, text);
  b.type = "button";
  b.addEventListener("click", () => { document.getElementById("menuDlg")?.close(); fn(); });
  return b;
}
/**
 * The header's dropdown, in the menu too: the same choice, from the same <select> (a game's quick switch stays in its
 * header). A few options make a segmented row, many a grid; picking one closes the menu and changes the select, so
 * the game answers exactly as it does to the header.
 */
export function mirror(label, select) {
  const options = [...select.options].filter(o => !o.disabled).map(o => [o.value, o.label]);
  const pick = v => { document.getElementById("menuDlg")?.close(); select.value = v; select.dispatchEvent(new Event("change", { bubbles: true })); };
  if (options.length <= 6) return choice(label, options, select.value, pick);
  const wrap = el("div", "menu-grid-wrap"), grid = el("div", "menu-grid");
  grid.setAttribute("role", "radiogroup");
  grid.setAttribute("aria-label", label);
  for (const [v, text] of options) {
    const b = el("button", null, text);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(v === select.value));
    b.addEventListener("click", () => { if (v !== select.value) pick(v); });
    grid.appendChild(b);
  }
  wrap.append(el("span", "menu-label", label), grid);
  return wrap;
}
/** A short status line (a best, where you are). */
export const line = text => el("p", "menu-line", text);

const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
// the menu button: an astrolabe's rete, the openwork star map that turns over the plate (rim, the off-centre ecliptic
// ring, star pointers, the hub)
const RETE = `<svg class="rete" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.6"/><circle cx="12" cy="10.3" r="5.9"/>
  <circle cx="12" cy="12" r="1.5"/><path d="M12 2.4v3M12 18.6v3M2.4 12h3M18.6 12h3"/><path d="M6.4 6.2l2.1 2.4M17.6 6.2l-2.1 2.4M7 17.3l2.4-1.9M17 17.3l-2.4-1.9"/>
  <path d="M12 16.2l-.9 1.6h1.8z"/></svg>`;
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
      box.hidden = ![...box.children].some(c => !c.classList.contains("menu-h"));   // a part with nothing in it stays out of sight
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
  const btn = document.getElementById("menuBtn");
  if (btn) {                                                     // the rete stands still, and turns while the menu is open
    btn.classList.add("rete-btn");
    btn.setAttribute("aria-label", "Menu");
    btn.innerHTML = RETE;
    new MutationObserver(() => btn.classList.toggle("turning", dlg.open)).observe(dlg, { attributes: true, attributeFilter: ["open"] });
  }
  const body = document.getElementById("menuBody") || dlg;
  new MutationObserver(() => queueMicrotask(() => shape(body))).observe(body, { childList: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", upgrade); else upgrade();
