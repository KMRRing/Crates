// Refinery's flowsheet: the lines a player can hide (a hidden class of line is not drawn at all, and leaves nothing
// dangling: no box with nothing running into it, no cut label with no line, no unit that looks unconnected), the boxes
// a player can drag (the lines follow; the default layout is what an empty arrangement gives; an arrangement is for the
// units it was made for), and what an off-spec product says when the stream that does it is hidden. Quick: it draws the
// sheets without a page and never solves the LP (refinery.mjs, 2 minutes, checks the engine and par).
const { LEVELS } = await import("../refinery-levels.js");
const E = await import("../refinery-engine.js");
const S = await import("../refinery-sheet.js");
const { PAR } = await import("../refinery-par.js");
const D = await import("../refinery-data.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** A level as played, with par's routing (or its start), and the run of it. */
function played(lv) {
  const L = E.asPlayed(lv, lv.crude, lv.decks?.[0]?.id);
  const par = PAR[lv.id]?.[lv.decks ? `${lv.crude}/${L.deck}` : lv.crude] || PAR[lv.id]?.[lv.crude];
  return { L, R: E.evaluate(L, E.normalise(L, par?.routing || E.defaultRouting(L))) };
}
const fake = () => ({ html: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; } });
const count = (html, re) => (html.match(re) || []).length;
const ALL = HIDES => HIDES.map(c => c.id);
const EVERY = [[], ...S.HIDES.map(c => [c.id]), ALL(S.HIDES)], ENDS = [[], ALL(S.HIDES)];   // each class alone on the whole refineries and the renewables; none and all on the rest

// ---------- the filter, on every level, every class and all of them ----------
{
  const problems = [];
  let drawn = 0;
  for (const lv of LEVELS) {
    const { L, R } = played(lv), links = S.linksOf(L, R);
    for (const ids of lv.chapter >= 9 ? EVERY : ENDS) {
      const hide = new Set(ids), f = S.filtered(L, R, hide, {}, links), name = `${lv.id} hiding [${ids}]`;
      const ticked = S.HIDES.filter(c => hide.has(c.id));
      if (f.shown.length + f.hidden.length !== links.length) problems.push(`${name}: lines lost`);
      if (f.hidden.some(l => !ticked.some(c => c.of(L, l))) || f.shown.some(l => ticked.some(c => c.of(L, l)))) problems.push(`${name}: a line hidden or shown against its class`);
      for (const c of S.HIDES) if (f.counts[c.id] !== links.filter(l => c.of(L, l)).length) problems.push(`${name}: ${c.id} counts ${f.counts[c.id]}`);
      const touching = id => links.filter(l => l.from === id || l.to === id), shownTo = id => f.shown.filter(l => l.from === id || l.to === id);
      for (const id of f.gone) {
        if (shownTo(id).length) problems.push(`${name}: ${id} is gone with a line to it`);
        if (!POOLS_OR_BOUGHT(id)) problems.push(`${name}: ${id} is gone and is not a product or the bought-in box`);
        if (R.pools[id] && R.pools[id].vol > 1e-4 && !R.pools[id].inSpec) problems.push(`${name}: the off-spec ${id} is gone`);
      }
      for (const [id, n] of Object.entries(f.bare)) {
        if (f.gone.has(id) || shownTo(id).length || n !== touching(id).length) problems.push(`${name}: ${id} is bare wrongly`);
      }
      // nothing is left unconnected without being said: every node with lines, none shown, is gone or bare
      for (const id of new Set(links.flatMap(l => [l.from, l.to]))) {
        if (["crude", "cdu", "cdu2"].includes(id)) continue;
        if (!shownTo(id).length && !f.gone.has(id) && !(id in f.bare)) problems.push(`${name}: ${id} has nothing running to it and doesn't say so`);
      }
      // the drawing says the same: one group a line shown, no box gone, a stub a bare box, a label a cut with a line
      const svg = fake(), lay = S.drawSheet(svg, L, R, { hide, flow: false });
      drawn++;
      if (count(svg.html, /<g class="rf-link[ "]/g) !== f.shown.length) problems.push(`${name}: ${count(svg.html, /<g class="rf-link[ "]/g)} lines drawn of ${f.shown.length}`);
      for (const id of f.gone) if (svg.html.includes(`data-node="${id}"`)) problems.push(`${name}: ${id} drawn though gone`);
      if (count(svg.html, /class="rf-bare"/g) !== Object.keys(f.bare).length) problems.push(`${name}: stubs ${count(svg.html, /class="rf-bare"/g)} of ${Object.keys(f.bare).length}`);
      if (lay.filter.hidden.length !== f.hidden.length) problems.push(`${name}: the layout's count differs`);
      const cuts = Object.keys(D.CRUDES[L.crude].cuts).filter(s => !f.cuts.has(s)).length;
      if (count(svg.html, /class="rf-cut-label"/g) !== cuts) problems.push(`${name}: ${count(svg.html, /class="rf-cut-label"/g)} cut labels of ${cuts}`);
      // a label goes only with its lines
      for (const s of f.cuts) if (links.some(l => l.from.startsWith("cdu") && l.stream === s && !f.hidden.includes(l))) problems.push(`${name}: the ${s} label is gone with a line shown`);
    }
  }
  check(!problems.length, `hiding any class on any level leaves nothing dangling (${drawn} sheets drawn)${problems.length ? `: ${problems.slice(0, 5).join("; ")}` : ""}`);
}
function POOLS_OR_BOUGHT(id) { return id === "bought" || !!D.POOLS[id]; }

// ---------- nothing hidden is the sheet as it was ----------
{
  const lv = LEVELS.find(l => l.id === "11.5"), { L, R } = played(lv), a = fake(), b = fake(), c = fake();
  S.drawSheet(a, L, R, { flow: false });
  S.drawSheet(b, L, R, { flow: false, hide: new Set(), arrange: {} });
  S.drawSheet(c, L, R, { flow: false, hide: new Set(), arrange: { cdu: [30, 30], crude: [9, 9], nope: [1, 1] } });   // what can't move, and what isn't there
  check(a.html === b.html && a.html === c.html && a.attrs.viewBox === c.attrs.viewBox, "no hide and no arrangement draw the sheet as the process lays it out");
  check(JSON.stringify(S.layout(L)) === JSON.stringify(S.layout(L, {})) && JSON.stringify(S.layout(L)) === JSON.stringify(S.layout(L, null)), "an empty arrangement is the default layout");
}

// ---------- the three biggest plants, the waste streams hidden ----------
for (const id of ["10.5", "11.5", "13.5"]) {
  const lv = LEVELS.find(l => l.id === id), { L, R } = played(lv), links = S.linksOf(L, R);
  const f = S.filtered(L, R, new Set(["waste", "gas", "lpg", "small"]), {}, links);
  check(f.gone.has("gasPool") && f.hidden.length >= links.length / 4, `${id}: fuel gas, LPG and the small flows hidden take ${f.hidden.length} of ${links.length} lines and the refinery fuel box with them`);
  const w = S.filtered(L, R, new Set(["waste"]), {}, links);
  check(links.filter(l => l.to === "notBought").length === 0 || w.gone.has("notBought") || links.some(l => l.to === "notBought" && !w.hidden.includes(l)), `${id}: hiding the waste takes the not-bought box with its lines`);
}

// ---------- boxes moved ----------
{
  const lv = LEVELS.find(l => l.id === "11.5"), { L, R } = played(lv), home = S.layout(L), N = home.nodes;
  const moved = S.layout(L, { fcc: [-30, -40], gasoline: [-25, 10], cdu: [50, 50], crude: [20, 20], bought: [5, 5] });
  check(moved.nodes.fcc.x === N.fcc.x - 30 && moved.nodes.fcc.y === N.fcc.y - 40 && moved.nodes.fcc.dx === -30 && moved.nodes.fcc.dy === -40, "a unit moves by its offset");
  check(moved.nodes.gasoline.x === N.gasoline.x - 25 && moved.nodes.gasoline.y === N.gasoline.y + 10, "a product moves by its offset");
  check(["cdu", "crude", "vdu", "nht"].every(id => moved.nodes[id].x === N[id].x && moved.nodes[id].y === N[id].y), "the crude column and the crude stay, and so does every box not moved");
  check(S.movable(N.fcc) && S.movable(N.gasoline) && !S.movable(N.cdu) && !S.movable(N.crude) && !S.movable(undefined), "units and products are movable; the columns and the crude are not");
  // the clamps: inside the sheet's room, and not a number that isn't
  const far = S.layout(L, { fcc: [1e6, 1e6], vdu: [-1e6, -1e6], nht: [NaN, 3], alky: "x" });
  check(far.nodes.fcc.x + far.nodes.fcc.w <= home.width * 1.5 + 1e-9 && far.nodes.fcc.y + far.nodes.fcc.h <= home.height * 1.5 + 1e-9 && far.nodes.vdu.x === 0 && far.nodes.vdu.y === 0, "a box kept inside the sheet's room");
  check(far.nodes.nht.x === N.nht.x && far.nodes.alky.x === N.alky.x && far.width >= far.nodes.fcc.x + far.nodes.fcc.w, "a bad offset is ignored, and the sheet grows to hold what is moved out");
  // its lines follow: slurry has only the FCC as maker, and its line leaves where the FCC stands now
  const svg = fake();
  S.drawSheet(svg, L, R, { flow: false, arrange: { fcc: [-30, -40], fuelOil: [7, 0] } });
  const d = svg.html.match(/<g class="rf-link[^"]*" data-stream="slurry">.*?class="rf-link-line" d="M([\d.]+) ([\d.]+)C([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/s);
  const m = S.layout(L, { fcc: [-30, -40], fuelOil: [7, 0] }).nodes, headed = +d[7] + 1.5;
  check(d && Math.abs(+d[1] - (m.fcc.x + m.fcc.w)) < 0.06 && Math.abs(headed - m.fuelOil.x) < 0.06, "a moved box's lines leave and arrive where it stands now");
  check(svg.html.includes(`<rect x="${m.fcc.x}" y="${m.fcc.y}" width="${m.fcc.w}"`), "the box is drawn where it was moved to");
  const lifted = fake();
  S.drawSheet(lifted, L, R, { flow: false, lift: "fcc" });
  check(count(lifted.html, /class="rf-halo"/g) === 1 && count(svg.html, /class="rf-halo"/g) === 0, "a box being dragged has a halo, and only it");
}

// ---------- an arrangement is for the units it was made for ----------
{
  const lv = LEVELS.find(l => l.id === "11.5"), { L } = played(lv), at = { fcc: [3, 4] }, saved = { sig: S.layoutSig(L), at };
  check(S.arrangedFor(L, saved) === at && !Object.keys(S.arrangedFor(L, undefined)).length && !Object.keys(S.arrangedFor(L, { at })).length, "a saved arrangement is read back for its own level, and not without its mark");
  const fewer = { ...L, units: L.units.filter(u => u !== "alky") }, placed = { ...L, layout: { ...L.layout, fcc: [6, 9.7] } };
  check(!Object.keys(S.arrangedFor(fewer, saved)).length && !Object.keys(S.arrangedFor(placed, saved)).length, "wiped when the level's units change, or where it places them");
  check(S.layoutSig(L) === S.layoutSig({ ...L }) && S.layoutSig(L) !== S.layoutSig(fewer), "the mark is the units and their places, and the same each time");
}

// ---------- a product off spec because of a hidden stream ----------
{
  const lv = LEVELS.find(l => l.id === "10.5"), L = E.asPlayed(lv, lv.crude), r = E.defaultRouting(L);
  r.butane = { gasoline: 1 };   // all the butane into petrol: vapour pressure far over its limit
  const R = E.evaluate(L, E.normalise(L, r)), links = S.linksOf(L, R);
  check(!R.pools.gasoline.inSpec && E.culprits(L, R, "gasoline").some(f => f.by.some(c => c.s === "butane" && c.share >= S.PUSH)), "all the butane in petrol puts it off spec, butane the culprit");
  const lpg = S.hiddenCulprits(L, R, new Set(["lpg"]), links);
  check(lpg.length === 1 && lpg[0].pool === "gasoline" && lpg[0].s === "butane", "hiding LPG & butane: the butane is named as a hidden culprit");
  check(!S.hiddenCulprits(L, R, new Set(["gas"]), links).some(x => x.s === "butane") && !S.hiddenCulprits(L, R, new Set(), links).length, "hidden culprits are only those whose lines are hidden");
  const f = S.filtered(L, R, new Set(["lpg"]), {}, links);
  check(f.pairs.has("butane>gasoline") && !S.filtered(L, R, new Set(["lpg"]), { stream: "butane" }, links).pairs.has("butane>gasoline"), "the stream the player has open is never hidden");
  // the off-spec product stays on the sheet, with its lines hidden, however few lines it had
  const bust = structuredClone(R); bust.pools.lpg.inSpec = false;
  const kept = S.filtered(L, bust, new Set(["lpg"]), {}, links), calm = S.filtered(L, R, new Set(["lpg"]), {}, links);
  check(calm.gone.has("lpg") && !kept.gone.has("lpg") && kept.bare.lpg > 0, "a product off spec is not taken off the sheet with its lines: it stays, marked with how many are hidden");
}

// ---------- the classes ----------
{
  const lv = LEVELS.find(l => l.id === "11.5"), { L } = played(lv), small = S.HIDES.find(c => c.id === "small");
  check(S.smallBelow(L) === 1 && small.name(L) === "Under 1 kb/d", "small flows are under half a per cent of the crude run (Brackwater's 200 kb/d: 1 kb/d)");
  check(S.HIDES.find(c => c.id === "bought").has(L) === !!Object.keys(L.bought || {}).length && S.HIDES.every(c => typeof c.name(L) === "string" && c.has(L) !== undefined), "each class says whether a level has it");
  const power = S.HIDES.find(c => c.id === "small").of(L, { stream: "power", vol: 0.001, from: "igcc", to: "power" });
  check(!power, "power, counted in megawatt-hours, is never a small flow of oil");
}

console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
