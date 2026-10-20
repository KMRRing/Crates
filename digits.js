// The digit grid (October 2026): the board Sudoku, Calcudoku and Kakuro are played on, its number pad and its keys.
// It draws and it listens; the game keeps every bit of state (what's in the cells, the selection, the Notes switch)
// and decides what a tap means, so a game's saved run is the whole picture, and a partner watching sees it as it is.
// Pure helpers for the entries (writing, pencil marks, undo and redo) are in digits-edit.js; the look is digits.css.
//
//   const board = createBoard(host, {
//     rows: 9, cols: 9,           // the grid's size (Kakuro's are rectangles); 4 to 12 a side reads well on a phone
//     digits: [1, …, 9],          // the symbols a cell can hold, in order: a cell's value v (1..k) shows digits[v-1],
//                                 // so a Calcudoku of 0..5 is digits [0, 1, 2, 3, 4, 5]; the pad has a key for each
//     regions: [region per cell], // a heavy rule runs between cells of different regions (Sudoku's boxes, a jigsaw's
//                                 // pieces, Calcudoku's cages); null: the frame only
//     cages: [{ cells, label }],  // Killer's cages, outlined in dashes inside their cells; label (a sum, "12×") in the
//                                 // corner of the cage's top-left cell. With cageRules, cages are drawn as heavy rules
//     cageRules: false,           //   instead (Calcudoku, which has no regions: pass its cages and no regions)
//     diagonals: false,           // the two long diagonals' cells shaded (Sudoku X)
//     kinds: [kind per cell],     // "" a cell to fill (the default), "block" blacked out, "clue" a block split by a
//     clues: { cell: { across, down } },  // diagonal holding Kakuro's sums: across upper right, down lower left
//     peers: cell => [cells],     // what to tint while a cell is selected (default: its row, column and region)
//     pad: element,               // where to draw the number pad (null: none)
//     tools: ["undo", "redo", "erase", "notes", { id: "hint", label: "Hint", note: "+30 s" }],  // the pad's buttons
//     onInput: action => {},      // what the player did, for the game to act on:
//                                 //   { type: "select", cell }        a cell tapped, or reached with the arrow keys
//                                 //   { type: "digit", value, note }  a digit key (note: in pencil: Notes on, or Shift)
//                                 //   { type: "erase" | "undo" | "redo" | "notes" }, { type: "tool", id }
//     name: "Sudoku grid",        // what a screen reader calls the board
//   });
//   board.draw({                  // the state, as the game keeps it; anything left out stays as last drawn
//     values: [v per cell],       // 0 for empty
//     fixed: [bool per cell],     // given digits: drawn in ink, heavier
//     notes: [mask per cell],     // pencil marks, bit v for value v
//     colours: [seat per cell],   // whose digit it is, drawn in that player's colour (--p0…); null: the game's accent
//     marks: { name: Set },       // classes for cells: conflict, wrong, lit (a hint's proof), focus (its target),
//                                 // sealed (a digit only a partner sees), lent (a partner's, shown while they're away)
//     selected: cell (-1: none), highlight: value (lit where no cell is selected), notesMode,
//     cursors: { cell: { seat, initial } },  // where the others at a table are, framed in their colour (--p<seat>)
//     counts: { value: still to place } (shown on the keys; 0 dims one), off: { undo: true, … } (buttons to grey),
//     veiled,                     // the game stands still (its menu is open): the digits hidden behind a plate
//     flash: { key, cells },      // cells swept with light once (a row finished); again only for a new key
//   });
//   board.destroy();
// On a keyboard: the arrows move (past blocks and clues), a digit's key writes it (with Shift, in pencil), Backspace
// or Delete erases, N switches Notes, Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes; nothing while a dialog is open.
// The board is as large as its host's box allows (give the host a size: style.css's .fit-grow.fit-box), at the grid's
// own proportions; every size inside it follows the cell, so it reads the same on a phone and a tablet. A game sets
// the board's accent with --dg-in (its own enamel) and lays the pad out with its own rules (digits.css has the rest).

const SVG = "http://www.w3.org/2000/svg";
const ICONS = {
  undo: '<path d="M9.5 6.5L5 11l4.5 4.5"/><path d="M5.5 11H15a4.5 4.5 0 0 1 0 9h-3"/>',
  redo: '<path d="M14.5 6.5L19 11l-4.5 4.5"/><path d="M18.5 11H9a4.5 4.5 0 0 0 0 9h3"/>',
  erase: '<path d="M8.5 19.5L3.8 14.8a1.5 1.5 0 0 1 0-2.1l8.4-8.4a1.5 1.5 0 0 1 2.1 0l5.4 5.4a1.5 1.5 0 0 1 0 2.1l-8.2 8.2"/><path d="M8.5 19.5H20M7 10l7 7"/>',
  notes: '<path d="M4.5 19.5l1.2-4.6L15.6 5a1.8 1.8 0 0 1 2.6 0l.8.8a1.8 1.8 0 0 1 0 2.6l-9.9 9.9z"/><path d="M13.8 6.8l3.4 3.4"/>',
  hint: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.8.6 1.2 1.4 1.2 2.3v.2h4v-.2c0-.9.4-1.7 1.2-2.3a5.5 5.5 0 0 0-3.2-10z"/>',
};
const LABEL = { undo: "Undo", redo: "Redo", erase: "Erase", notes: "Notes" };

export function createBoard(host, opts = {}) {
  const rows = opts.rows || 9, cols = opts.cols || rows, cells = rows * cols;
  const digits = opts.digits || Array.from({ length: Math.min(rows, 9) }, (_, i) => i + 1), k = digits.length;
  const kinds = opts.kinds || new Array(cells).fill("");
  const playable = i => !kinds[i];
  const regions = opts.regions || null;
  const peersOf = opts.peers || (i => {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    for (let j = 0; j < cells; j++) if (j !== i && (Math.floor(j / cols) === r || j % cols === c || (regions && regions[j] === regions[i]))) out.push(j);
    return out;
  });
  const onInput = opts.onInput || (() => {});

  // ---------- the grid ----------
  const root = document.createElement("div");
  root.className = "dg";
  root.style.setProperty("--rows", rows);
  root.style.setProperty("--cols", cols);
  root.style.setProperty("--nc", k > 4 ? 3 : 2);                    // the pencil marks' columns in a cell
  root.setAttribute("role", "grid");
  root.setAttribute("aria-label", opts.name || "Grid");
  // layers, bottom up: the diagonals' shading, the cells, their rules and cages, the cages' labels, the veil
  const under = document.createElementNS(SVG, "svg");
  under.setAttribute("class", "dg-under");
  under.setAttribute("viewBox", `0 0 ${cols * 100} ${rows * 100}`);
  under.setAttribute("preserveAspectRatio", "none");
  under.setAttribute("aria-hidden", "true");
  if (opts.diagonals) under.innerHTML = [...Array(cells).keys()].filter(i => Math.floor(i / cols) === i % cols || Math.floor(i / cols) + (i % cols) === cols - 1)
    .map(i => `<rect x="${(i % cols) * 100}" y="${Math.floor(i / cols) * 100}" width="100" height="100"/>`).join("");
  const grid = document.createElement("div");
  grid.className = "dg-cells";
  const cellEls = [];
  const tags = document.createElement("div"), tagged = new Set();
  tags.className = "dg-tags";
  tags.setAttribute("aria-hidden", "true");
  if (opts.cages?.length && !opts.cageRules) root.classList.add("caged");     // pencil marks keep inside the dashes
  for (const cg of opts.cages || []) {
    if (cg.label == null || cg.label === "") continue;
    const first = Math.min(...cg.cells), tag = document.createElement("small");
    tagged.add(first);
    tag.className = "dg-l";
    tag.textContent = cg.label;
    tag.style.left = `${((first % cols) / cols) * 100}%`;
    tag.style.top = `${(Math.floor(first / cols) / rows) * 100}%`;
    tags.append(tag);
  }
  for (let i = 0; i < cells; i++) {
    const el = document.createElement("div");
    el.className = `dg-c${kinds[i] ? ` dg-${kinds[i]}` : ""}`;
    el.dataset.i = i;
    el.setAttribute("role", "gridcell");
    if (kinds[i] === "clue") {
      const cl = opts.clues?.[i] || {};
      if (cl.across != null) el.append(Object.assign(document.createElement("small"), { className: "dg-across", textContent: cl.across }));
      if (cl.down != null) el.append(Object.assign(document.createElement("small"), { className: "dg-down", textContent: cl.down }));
      el.setAttribute("aria-label", `clue${cl.across != null ? `, across ${cl.across}` : ""}${cl.down != null ? `, down ${cl.down}` : ""}`);
    } else if (!kinds[i]) {
      const v = document.createElement("b");
      v.className = "dg-v";
      const n = document.createElement("span");
      n.className = "dg-n";
      for (let d = 1; d <= k; d++) n.append(document.createElement("i"));
      el.append(v, n);
    }
    cellEls.push(el);
    grid.append(el);
  }
  const lines = document.createElementNS(SVG, "svg");
  lines.setAttribute("class", "dg-lines");
  lines.setAttribute("viewBox", `0 0 ${cols * 100} ${rows * 100}`);
  lines.setAttribute("preserveAspectRatio", "none");
  lines.setAttribute("aria-hidden", "true");
  lines.innerHTML = linesOf({ rows, cols, kinds, regions, cages: opts.cages || [], cageRules: !!opts.cageRules });
  const veil = document.createElement("div");
  veil.className = "dg-veil";
  veil.textContent = "Paused";
  root.append(under, grid, lines, tags, veil);
  host.replaceChildren(root);

  grid.addEventListener("pointerdown", e => {
    const el = e.target.closest(".dg-c");
    if (!el || e.button > 0) return;
    const i = Number(el.dataset.i);
    if (!playable(i)) return;
    e.preventDefault();
    onInput({ type: "select", cell: i });
  });

  // ---------- the pad ----------
  const pad = opts.pad || null, keyEls = [], toolEls = new Map();
  if (pad) {
    pad.classList.add("dg-pad");
    pad.style.setProperty("--keys", k);
    const keys = document.createElement("div");
    keys.className = "dg-keys";
    digits.forEach((d, j) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dg-key";
      b.dataset.v = j + 1;
      b.innerHTML = `<b>${d}</b><small></small>`;
      b.setAttribute("aria-label", String(d));
      b.addEventListener("click", () => onInput({ type: "digit", value: j + 1, note: notesOn }));
      keyEls.push(b);
      keys.append(b);
    });
    const tools = document.createElement("div");
    tools.className = "dg-tools";
    for (const t of opts.tools || ["undo", "redo", "erase", "notes"]) {
      const spec = typeof t === "string" ? { id: t, label: LABEL[t] } : t;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `dg-tool dg-${spec.id}`;
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[spec.id] || ICONS.hint}</svg><span>${spec.label}</span>${spec.note ? `<small>${spec.note}</small>` : ""}`;
      if (spec.id === "notes") b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => onInput(LABEL[spec.id] ? { type: spec.id } : { type: "tool", id: spec.id }));
      toolEls.set(spec.id, b);
      tools.append(b);
    }
    pad.replaceChildren(keys, tools);
  }

  // ---------- the keys of a keyboard ----------
  let selected = -1, notesOn = false;
  const typing = () => document.querySelector("dialog[open]") || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  const step = (from, dr, dc) => {
    let r = from < 0 ? 0 : Math.floor(from / cols), c = from < 0 ? 0 : from % cols;
    for (let t = 0; t < Math.max(rows, cols); t++) {
      r = (r + dr + rows) % rows; c = (c + dc + cols) % cols;
      if (playable(r * cols + c)) return r * cols + c;
    }
    return from;
  };
  const onKey = e => {
    if (typing() || !root.isConnected) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); onInput({ type: e.shiftKey ? "redo" : "undo" }); return; }
    if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); onInput({ type: "redo" }); return; }
    if (mod || e.altKey) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); onInput({ type: "select", cell: step(selected < 0 ? -1 : selected, ...arrows[e.key]) }); return; }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onInput({ type: "erase" }); return; }
    if (e.key === "n" || e.key === "N") { e.preventDefault(); onInput({ type: "notes" }); return; }
    // a digit by its key, or (with Shift, which turns 1 into !) by its place on the keyboard
    const code = /^(Digit|Numpad)(\d)$/.exec(e.code || "")?.[2], ch = e.shiftKey && code != null ? code : e.key;
    const j = digits.map(String).indexOf(ch);
    if (j >= 0) { e.preventDefault(); onInput({ type: "digit", value: j + 1, note: notesOn || e.shiftKey }); }
  };
  document.addEventListener("keydown", onKey);

  // ---------- drawing ----------
  let view = { values: new Array(cells).fill(0), fixed: new Array(cells).fill(false), notes: new Array(cells).fill(0), colours: null, marks: {}, selected: -1, highlight: 0, notesMode: false, counts: null, off: {}, veiled: false };
  const drawn = new Array(cells).fill(""), flashed = { key: null };
  const has = (set, i) => !!set && (set instanceof Set ? set.has(i) : set[i]);
  function draw(next = {}) {
    view = { ...view, ...next };
    selected = view.selected ?? -1;
    notesOn = !!view.notesMode;
    const { values, fixed, notes, colours, marks } = view;
    const sel = selected >= 0 && playable(selected) ? selected : -1;
    const peers = new Set(sel >= 0 ? peersOf(sel) : []);
    const lit = sel >= 0 ? values[sel] : view.highlight || 0;
    const markNames = Object.keys(marks || {}), cursors = view.cursors || {};
    for (let i = 0; i < cells; i++) {
      if (!playable(i)) continue;
      const v = values[i] || 0, n = v ? 0 : notes[i] || 0, own = colours?.[i], who = cursors[i];
      const cls = ["dg-c", tagged.has(i) ? "tagged" : "", v ? (has(fixed, i) ? "given" : "entered") : "", i === sel ? "sel" : "", peers.has(i) ? "peer" : "", lit && v === lit ? "same" : "",
        who ? "other" : "", ...markNames.filter(m => has(marks[m], i))].filter(Boolean).join(" ");
      const sig = `${cls}|${v}|${n}|${own ?? ""}|${lit && n & (1 << lit) ? lit : 0}|${who ? `${who.seat}${who.initial}` : ""}`;
      if (drawn[i] === sig) continue;
      drawn[i] = sig;
      const el = cellEls[i];
      el.className = cls;
      if (who) { el.style.setProperty("--who", `var(--p${who.seat % 6})`); el.dataset.who = who.initial || ""; }
      else { el.style.removeProperty("--who"); delete el.dataset.who; }
      el.firstChild.textContent = v ? digits[v - 1] : "";
      if (own != null && v && !has(fixed, i)) el.style.setProperty("--own", `var(--p${own % 6})`); else el.style.removeProperty("--own");
      const marksEl = el.children[1].children;
      for (let d = 1; d <= k; d++) {
        const on = !!(n & (1 << d));
        marksEl[d - 1].textContent = on ? digits[d - 1] : "";
        marksEl[d - 1].className = on && d === lit ? "same" : "";
      }
      el.setAttribute("aria-label", `row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}: ${v ? digits[v - 1] : n ? `notes ${[...Array(k).keys()].filter(d => n & (1 << (d + 1))).map(d => digits[d]).join(" ")}` : "empty"}`);
      el.setAttribute("aria-selected", String(i === sel));
    }
    root.classList.toggle("veiled", !!view.veiled);
    if (view.flash && view.flash.key !== flashed.key) {
      flashed.key = view.flash.key;
      view.flash.cells.forEach((i, j) => {
        const el = cellEls[i];
        el.style.setProperty("--k", j);
        el.classList.remove("flash");
        void el.offsetWidth;                                 // restarts the sweep on a cell swept before
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 900 + j * 40);
      });
    }
    if (pad) {
      pad.classList.toggle("notes", notesOn);
      keyEls.forEach((b, j) => {
        const left = view.counts?.[j + 1];
        b.querySelector("small").textContent = left > 0 ? String(left) : "";
        b.classList.toggle("done", left === 0);
        b.classList.toggle("lit", !!lit && lit === j + 1);
      });
      toolEls.get("notes")?.setAttribute("aria-pressed", String(notesOn));
      for (const [id, b] of toolEls) b.disabled = !!view.off?.[id];
    }
  }
  draw();

  return {
    draw,
    get root() { return root; },
    /** The element of a cell (to place a hint's bubble by it, say). */
    cellEl: i => cellEls[i],
    destroy() { document.removeEventListener("keydown", onKey); host.replaceChildren(); pad?.replaceChildren(); },
  };
}

/**
 * The board's lines, as SVG in units of a hundredth of a cell: the cells' hairlines, the heavy rules between regions
 * (and the frame), cages in dashes just inside their cells, and the diagonal of each clue cell.
 */
export function linesOf({ rows, cols, kinds = [], regions = null, cages = [], cageRules = false }) {
  const U = 100, out = [];
  const thin = [];
  for (let c = 1; c < cols; c++) thin.push(`M${c * U} 0V${rows * U}`);
  for (let r = 1; r < rows; r++) thin.push(`M0 ${r * U}H${cols * U}`);
  out.push(`<path class="dg-thin" d="${thin.join("")}"/>`);
  // heavy rules: between cells of different regions (or cages, drawn as rules)
  const group = cageRules ? (() => { const g = new Array(rows * cols).fill(-1); cages.forEach((cg, j) => cg.cells.forEach(i => { g[i] = j; })); return g; })() : regions;
  const heavy = [];
  if (group) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols && group[i] !== group[i + 1]) heavy.push(`M${(c + 1) * U} ${r * U}V${(r + 1) * U}`);
      if (r + 1 < rows && group[i] !== group[i + cols]) heavy.push(`M${c * U} ${(r + 1) * U}H${(c + 1) * U}`);
    }
  }
  if (heavy.length) out.push(`<path class="dg-heavy" d="${heavy.join("")}"/>`);
  if (!cageRules && cages.length) out.push(`<path class="dg-cage" d="${cages.map(cg => cageOutline(cg.cells, cols)).join("")}"/>`);
  for (let i = 0; i < rows * cols; i++) if (kinds[i] === "clue") {
    const r = Math.floor(i / cols), c = i % cols;
    out.push(`<path class="dg-split" d="M${c * U} ${r * U}L${(c + 1) * U} ${(r + 1) * U}"/>`);
  }
  out.push(`<rect class="dg-frame" x="0" y="0" width="${cols * U}" height="${rows * U}"/>`);
  return out.join("");
}
/**
 * A cage's outline, just inside its cells: each side of a cell that faces out of the cage, set in by a little, its ends
 * stretched or drawn in so the sides meet at the corners (in by the inset at an outer corner, out by it at an inner
 * one, where the cage turns round a cell that isn't in it).
 */
function cageOutline(cellsIn, cols) {
  const U = 100, d = 9, inCage = new Set(cellsIn), at = (r, c) => c >= 0 && c < cols && r >= 0 && inCage.has(r * cols + c);
  const segs = [];
  for (const i of cellsIn) {
    const r = Math.floor(i / cols), c = i % cols, x0 = c * U, y0 = r * U, x1 = x0 + U, y1 = y0 + U;
    // the end of a side: in by d at an outer corner, out by d past an inner one, flush where the cage carries on
    const end = (along, across) => (along ? (across ? -d : 0) : d);
    if (!at(r - 1, c)) segs.push(`M${x0 + end(at(r, c - 1), at(r - 1, c - 1))} ${y0 + d}H${x1 - end(at(r, c + 1), at(r - 1, c + 1))}`);
    if (!at(r + 1, c)) segs.push(`M${x0 + end(at(r, c - 1), at(r + 1, c - 1))} ${y1 - d}H${x1 - end(at(r, c + 1), at(r + 1, c + 1))}`);
    if (!at(r, c - 1)) segs.push(`M${x0 + d} ${y0 + end(at(r - 1, c), at(r - 1, c - 1))}V${y1 - end(at(r + 1, c), at(r + 1, c - 1))}`);
    if (!at(r, c + 1)) segs.push(`M${x1 - d} ${y0 + end(at(r - 1, c), at(r - 1, c + 1))}V${y1 - end(at(r + 1, c), at(r + 1, c + 1))}`);
  }
  return segs.join("");
}
