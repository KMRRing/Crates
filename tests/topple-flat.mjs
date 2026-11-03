// Topple's flat table (topple-flat.js, drawn where there is no WebGL) in a stand-in for the page's DOM: a view made fresh draws
// Classic's table and the dominoes standing on it, and a level's. How it looks is a browser's: the flat table was found blank
// (nothing drawn at all in Classic, since the view began as the very rules it was first given and took them for "no change")
// only by running the page without WebGL. Run: node tests/topple-flat.mjs
class El {
  constructor(tag) { this.tag = tag; this.kids = []; this.attrs = {}; this.style = {}; this.dataset = {}; this.classList = { add() {}, remove() {}, toggle() {} }; this.textContent = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  append(...k) { this.kids.push(...k.filter(x => x instanceof El)); }
  prepend(...k) { this.kids.unshift(...k.filter(x => x instanceof El)); }
  replaceChildren(...k) { this.kids = k.filter(x => x instanceof El); }
  remove() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 358, height: 560 }; }
  /** Every element below this one with a class (the checks look for the table's frame, a domino's face) or a data-cell. */
  all() { return this.kids.flatMap(k => [k, ...k.all()]); }
  querySelectorAll(sel) { const m = /^\[data-([a-z]+)\]$/.exec(sel); return m ? this.all().filter(e => e.dataset[m[1]] !== undefined) : []; }
}
globalThis.document = { createElementNS: (ns, tag) => new El(tag) };
globalThis.ResizeObserver = class { observe() {} };
globalThis.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 0);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });

const { createFlat } = await import("../topple-flat.js");
const { newGame, rulesOf, lay, moves, CELLS } = await import("../topple-engine.js");

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const has = (root, cls) => root.all().filter(e => (e.attrs.class || "").split(" ").includes(cls));

/** What a page does to draw a game: the terrain of its rules, then the table as it stands. */
const show = (view, g) => { view.terrain(rulesOf(g)); view.set({ cells: g.cells, ax: g.ax, mod: g.mod || null, bell: g.bell, fresh: [] }); };

// ---------- Classic ----------
{
  const host = new El("div"), view = createFlat(host), svg = host.kids[0];
  let g = newGame(5, -1);
  show(view, g);
  check(has(svg, "tp-flat-frame").length === 1 && has(svg, "tp-flat-birch").length === 1, "a fresh flat view, given Classic's rules (the ones it starts as), draws the table: the frame and the birch");
  check(has(svg, "tp-flat-cell").length === CELLS.length, `the table has its ${CELLS.length} hexagons`);
  for (let k = 0; k < 3; k++) { const m = moves(g)[0]; g = lay(g, m.slot, m.q, m.r, m.floor).state; }
  show(view, g);
  const stood = g.cells.filter(c => c >= 0).length;
  check(stood > 3 && svg.querySelectorAll("[data-cell]").length === stood, `the ${stood} dominoes laid are drawn, one slab to each`);
  check(has(svg, "tp-pip").length > 0 && has(svg, "tp-face").length >= stood, "each has its face and its pips (the pips are how the colours are told apart)");
  const before = view.project(0, 0, 0);
  view.zoomAt(1.8, 179, 280);
  const after = view.project(0, 0, 0);
  check(view.zoom > 1 && (after[0] !== before[0] || after[1] !== before[1]), "the zoom moves the table's middle on the screen");
}

// ---------- a level's table, then Classic's again on the same view ----------
{
  const host = new El("div"), view = createFlat(host), svg = host.kids[0];
  show(view, newGame(5, 2));
  check(has(svg, "tp-flat-water").length > 0, "a level's table draws its water");
  show(view, newGame(5, -1));
  check(has(svg, "tp-flat-water").length === 0 && has(svg, "tp-flat-frame").length === 1, "and Classic's after it draws a plain table again");
}

// ---------- every level draws something ----------
{
  let ok = true;
  for (let n = 0; n < 14; n++) {
    const host = new El("div"), view = createFlat(host), svg = host.kids[0], g = newGame(7, n);
    show(view, g);
    if (!has(svg, "tp-flat-frame").length && !has(svg, "tp-flat-birch").length) ok = false;
  }
  check(ok, "all fourteen levels draw a table on a fresh view");
}

console.log(bad ? `${bad} problems` : "topple flat: every check passed");
if (bad) process.exitCode = 1;
