// The header dropdown, themed: a button and a list in the suite's style stand in for a <select>, whose own list is
// drawn by the phone or the operating system and can't be styled. The select stays in the page, hidden, as the one
// place the choice lives: the game reads it, sets it and listens for its change events exactly as before, so a page
// takes this up with one call and no other change. Its options' data-note, if any, shows under each name in the list;
// the select's data-accent (a game's logo prefix, cr for Crates) gives the button and the tick that game's logo colours.
const CHEVRON = `<svg class="dd-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.6 4.4 6 7.8l3.4-3.4"/></svg>`;
const TICK = `<svg class="dd-tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 8.6 6.6 11.6 12.6 4.6"/></svg>`;
let made = 0;

/** Stands a themed dropdown in for `select`; returns { sync } to redraw it after a change the select can't report. */
export function dropdown(select) {
  if (!("popover" in HTMLElement.prototype)) return { sync() {} };   // before Safari 17: the plain select stays
  const id = `dd${++made}`, name = select.getAttribute("aria-label") || "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dd";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", `${id}-list`);
  button.innerHTML = `<span class="dd-label"></span>${CHEVRON}`;
  const label = button.firstElementChild;

  const list = document.createElement("div");
  list.id = `${id}-list`;
  list.className = "dd-list";
  list.popover = "auto";                   // the top layer: above everything, closed by Escape or a tap elsewhere
  list.tabIndex = -1;
  list.setAttribute("role", "listbox");
  if (name) list.setAttribute("aria-label", name);
  button.popoverTargetElement = list;      // so a tap on the button toggles the list instead of counting as "elsewhere"

  const accent = select.dataset.accent;
  if (accent) for (const e of [button, list])
    e.style.cssText = `--dd-tint: var(--${accent}-logo-tint); --dd-edge: var(--${accent}-logo-edge);`;
  select.classList.add("dd-native");
  select.after(button, list);

  let active = -1;                         // the option the keyboard is on
  let typed = "", typedAt = 0;             // typing a name's first letters jumps to it
  const isOpen = () => list.matches(":popover-open");
  const options = () => [...select.options];
  const usable = i => { const o = select.options[i]; return !!o && !o.disabled; };

  // The label holds every option's name in one spot, only the current one showing, so the button is as wide as its
  // widest option (as a select is) and doesn't change size when the choice does.
  let built = null;                        // the names the label was last built from
  function sync() {
    const all = options().map(o => o.label), i = select.selectedIndex, text = all[i] ?? "";
    if (all.join("\n") !== built) {
      built = all.join("\n");
      label.replaceChildren(...all.map(t => { const n = document.createElement("span"); n.textContent = t; return n; }));
    }
    [...label.children].forEach((n, k) => n.classList.toggle("cur", k === i));
    button.setAttribute("aria-label", name ? `${name}: ${text}` : text);
    button.disabled = select.disabled;
    button.hidden = select.hidden;
    if (isOpen()) build();
  }

  function build() {
    list.replaceChildren(...options().map((o, i) => {
      const row = document.createElement("div");
      row.className = "dd-opt";
      row.id = `${id}-${i}`;
      row.dataset.i = i;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(i === select.selectedIndex));
      if (o.disabled) row.setAttribute("aria-disabled", "true");
      const text = document.createElement("span");
      text.className = "dd-text";
      const title = document.createElement("span");
      title.className = "dd-name";
      title.textContent = o.label;
      text.appendChild(title);
      if (o.dataset.note) {
        const note = document.createElement("span");
        note.className = "dd-note";
        note.textContent = o.dataset.note;
        text.appendChild(note);
      }
      row.append(text);
      row.insertAdjacentHTML("beforeend", TICK);
      return row;
    }));
    highlight(active);
  }

  function highlight(i) {
    active = i;
    for (const row of list.children) row.classList.toggle("on", +row.dataset.i === i);
    const row = list.children[i];
    if (!row) { list.removeAttribute("aria-activedescendant"); return; }
    list.setAttribute("aria-activedescendant", row.id);
    // scroll the list, never the page (scrollIntoView would scroll every box around it too)
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }

  function step(from, by) {
    const n = select.options.length;
    for (let i = from + by; i >= 0 && i < n; i += by) if (usable(i)) return i;
    return from;
  }

  function choose(i) {
    if (!usable(i)) return;
    list.hidePopover();
    button.focus({ preventScroll: true });
    if (i === select.selectedIndex) return;
    select.selectedIndex = i;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Below the button and flush with its right edge (it sits at the right of the header): set before the list shows, so
  // its first frame is already in place, and moved in or above it once it has a size, if it would run off the screen.
  // The page itself never scrolls; a long list scrolls inside.
  function anchor() {
    const b = button.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    Object.assign(list.style, { minWidth: `${Math.round(b.width)}px`, maxWidth: `${vw - 16}px`,
      maxHeight: `${Math.round(innerHeight - b.bottom - 14)}px`, left: "auto", right: `${Math.round(vw - b.right)}px`,
      top: `${Math.round(b.bottom + 6)}px`, bottom: "auto" });
  }
  function fit() {
    const b = button.getBoundingClientRect(), l = list.getBoundingClientRect();
    if (l.left < 8) Object.assign(list.style, { left: "8px", right: "auto" });
    const below = innerHeight - b.bottom - 14, above = b.top - 14;
    if (list.scrollHeight > below && above > below)
      Object.assign(list.style, { top: "auto", bottom: `${Math.round(innerHeight - b.top + 6)}px`,
        maxHeight: `${Math.round(above)}px` });
  }
  // Once it shows: fitted, the keyboard on the current choice, focus in the list. The toggle event that reports it comes
  // a moment later, so opening from the keyboard does this at once too, or the next key would still go to the button.
  function opened() {
    if (!isOpen()) return;
    fit();
    highlight(active);
    if (document.activeElement !== list) list.focus({ preventScroll: true });
  }

  list.addEventListener("beforetoggle", e => {
    button.setAttribute("aria-expanded", String(e.newState === "open"));
    if (e.newState !== "open") return;
    active = select.selectedIndex;
    build();
    anchor();
  });
  list.addEventListener("toggle", opened);
  addEventListener("resize", () => { if (isOpen()) list.hidePopover(); });

  // Keys work the list wherever focus is while it's open: a click or Enter opens it a moment before focus can move in.
  button.addEventListener("keydown", e => {
    if (isOpen()) { opened(); key(e); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    list.showPopover({ source: button });
    opened();
  });
  list.addEventListener("keydown", key);
  function key(e) {
    const n = select.options.length;
    if (e.key === "ArrowDown") highlight(step(active, 1));
    else if (e.key === "ArrowUp") highlight(step(active, -1));
    else if (e.key === "Home") highlight(step(-1, 1));
    else if (e.key === "End") highlight(step(n, -1));
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") { list.hidePopover(); button.focus({ preventScroll: true }); }
    else if (e.key === "Tab") { list.hidePopover(); button.focus({ preventScroll: true }); return; }   // moves on from the button
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const c = e.key.toLowerCase(), lower = options().map(o => o.label.toLowerCase());
      const find = (prefix, from) => {
        for (let k = 0; k < n; k++) { const i = (from + k) % n; if (usable(i) && lower[i].startsWith(prefix)) return i; }
        return -1;
      };
      typed = e.timeStamp - typedAt > 700 ? c : typed + c;
      typedAt = e.timeStamp;
      // letters typed together spell a name's start; a single letter moves on to the next name with it, and so does
      // a run of letters that spells nothing (the new letter starts afresh)
      let i = typed.length > 1 ? find(typed, active) : find(typed, active + 1);
      if (i < 0 && typed.length > 1) { typed = c; i = find(c, active + 1); }
      if (i >= 0) highlight(i);
    } else return;
    e.preventDefault();
  }
  list.addEventListener("click", e => { const row = e.target.closest(".dd-opt"); if (row) choose(+row.dataset.i); });
  list.addEventListener("pointermove", e => {
    const row = e.target.closest(".dd-opt");
    if (row && e.pointerType === "mouse" && +row.dataset.i !== active && usable(+row.dataset.i)) highlight(+row.dataset.i);
  });

  // The game sets the select's value in code (a partner changing the pool, a link opening a level), which fires no
  // event: catching the setters keeps the button's label true without the game having to say so. React tracks its
  // inputs the same way. Options added or renamed later, or the select disabled or hidden, are seen by the observer, and
  // anything else a game does to it and then announces with a change event is caught by that.
  for (const prop of ["value", "selectedIndex"]) {
    const native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
    Object.defineProperty(select, prop, { configurable: true, enumerable: native.enumerable,
      get() { return native.get.call(this); }, set(v) { native.set.call(this, v); sync(); } });
  }
  new MutationObserver(sync).observe(select, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["disabled", "hidden", "label", "selected", "data-note"] });
  select.addEventListener("change", sync);
  sync();
  return { sync };
}
