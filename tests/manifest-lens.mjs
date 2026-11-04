// Manifest's long lens (manifest-lens.js) keeps counting fair: for every recipe level and a sample of Random's rounds, every piece the
// engine says shows is projected through the lens (a perspective camera 15 degrees wide, the engine's own direction, swaying a degree
// or two) and checked not to be hidden by the pieces in front; pieces the engine says are hidden must not show more than a sliver,
// at rest and at both ends of the sway; and a tap on a piece finds it where the picture draws it. Numbers only: no WebGL here.
const M = await import("../manifest-engine.js");
const Mo = await import("../manifest-model.js");
const Lens = await import("../manifest-lens.js");
const Sh = await import("../manifest-shapes.js");
const R = await import("../manifest-rules.js");
const L = await import("../manifest-levels.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// a piece's own size on a 390 x 664 phone: the picture is as wide as the box allows (about 330 px wide, 430 high there)
const BOX_W = 330, BOX_H = 430, PAD = 24;
/** The scene's items for a stack, as the 3D drawing makes them (one per piece: a log is one mesh over its two cells). */
function itemsOf(cells, turns, frame, proj) {
  const cubes = Mo.layout(cells, turns, frame, (x, y, z, b) => Lens.facesBy(proj, x, y, z, b));
  return cubes.filter(c => c.half !== 1).map(c => {
    const long = c.half === 0, box = long ? Mo.joinBox(c.box, cubes.find(m => m.piece === c.piece && m.half === 1).box) : c.box;
    return { key: c.key, piece: Mo.pieceKey(c), cells: long ? [c.key, cubes.find(m => m.piece === c.piece && m.half === 1).key] : [c.key], ware: R.typeOf(c.c), box, yaw: Mo.yawOf(c, turns), faces: c.faces };
  });
}
const stats = { rounds: 0, clear: 0, visible: 0, hidden: 0, minClear: 1, minVisible: 1, minSway: 1, minIso: 1, taps: 0, tapMiss: 0, hairs: 0, hairsIso: 0, maxHidden: 0, worst: {}, edgeMin: Infinity, edgeMax: 0, ratioMax: 1 };
function inspect(cells, where) {
  const b = M.boxFor(0), X = cells.length, Y = cells[0].length, Z = cells[0][0].length;
  const frame = Mo.frameOf(X, Y, Z, b, { drop: true, pad: PAD }), lens = Lens.lensOf(frame, X, Y, Z, b);
  const clear = M.clearSet(cells), seen = M.visibleSet(cells);
  stats.rounds++;
  const pxUnit = Math.min(BOX_W / frame.W, BOX_H / (frame.H + frame.room));
  {                                                                    // the same stack through the isometric camera (the lens from very far off), for comparison
    const proj = Lens.projector({ ...lens, dist: lens.dist * 1e4 }), items = itemsOf(cells, 0, frame, proj), shown = Lens.shownBy(proj, items);
    for (const it of items) if (it.cells.some(k => seen.has(k))) { const s = shown.get(it.key), f = s.px / s.all; stats.minIso = Math.min(stats.minIso, f); stats.hairsIso += f < 0.03; }
  }
  for (const sway of [0, -Lens.SWAY, Lens.SWAY]) {
    const proj = Lens.projector(lens, sway), items = itemsOf(cells, 0, frame, proj), shown = Lens.shownBy(proj, items);
    for (const it of items) {
      const s = shown.get(it.key), frac = s.px / s.all, isClear = it.cells.some(k => clear.has(k)), isSeen = it.cells.some(k => seen.has(k));
      if (isClear) { stats.clear += sway === 0; if (frac < stats.minClear) { stats.minClear = frac; stats.worst.clear = `${where} ${it.key} sway ${sway}`; } }
      if (isSeen) { stats.visible += sway === 0; const k = sway === 0 ? "minVisible" : "minSway"; if (sway === 0) stats.hairs += frac < 0.03; if (frac < stats[k]) { stats[k] = frac; stats.worst[k] = `${where} ${it.key} sway ${sway}`; } }
      if (!isSeen) { stats.hidden += sway === 0; if (frac > stats.maxHidden) { stats.maxHidden = frac; stats.worst.hid = `${where} ${it.key} sway ${sway} ${s.px.toFixed(1)}px`; } }
      if (sway === 0) {
        const edge = Math.sqrt(s.all) * pxUnit / (it.cells.length > 1 ? Math.sqrt(2) : 1);   // a log's length over root two: the size of a cell's worth of it
        stats.edgeMin = Math.min(stats.edgeMin, edge); stats.edgeMax = Math.max(stats.edgeMax, edge);
      }
    }
    // the tap: the middle of what shows of every clearly shown piece finds that piece (a long log by its low cell)
    if (sway === 0) for (const it of items) {
      if (!it.cells.some(k => clear.has(k))) continue;
      stats.taps++;
      if (Lens.tapAt(proj, items, ...shown.get(it.key).at) !== it.piece) { stats.tapMiss++; stats.worst.tap ??= `${where} ${it.key}`; }
    }
  }
  // the long lens: the nearest piece against the furthest on screen, by the size of a unit cube at their places
  const near = proj0(lens, [X * b.X, 0, Y * b.Y]), far = proj0(lens, [0, 0, 0]);
  stats.ratioMax = Math.max(stats.ratioMax, near / far);
}
/** The size of a world unit on the picture at a point (how much the lens enlarges what is there), a hair's step along x. */
function proj0(lens, p) {
  const proj = Lens.projector(lens), a = proj(p), b = proj([p[0] + 1, p[1], p[2]]), c = proj([p[0], p[1], p[2] + 1]);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1]);
}

// every recipe level, a round or two of each (the ladder's own seeds), then Random's twelve rounds from a few seeds
for (let i = 0; i < L.COUNT; i++) for (let k = 1; k <= 2; k++) {
  const round = M.makeRound(L.seedOf(i), k, 0, L.recipeAt(i, k));
  inspect(round.cells, `level ${i + 1} round ${k}`);
}
for (const seed of [11, 4242, 90210]) for (let r = 1; r <= 12; r++) inspect(M.makeRound(seed, r).cells, `random ${seed}/${r}`);

console.log(`  ${stats.rounds} stacks: ${stats.clear} clearly shown pieces, ${stats.visible} visible, ${stats.hidden} hidden (by the engine)`);
console.log(`  smallest share of a clearly shown piece's outline that shows: ${(stats.minClear * 100).toFixed(1)}% (${stats.worst.clear})`);
console.log(`  smallest share of a visible piece (the engine counts a hair of 1.2%): ${(stats.minVisible * 100).toFixed(1)}% at rest (${stats.worst.minVisible}), ${(stats.minSway * 100).toFixed(1)}% swaying (${stats.worst.minSway}); most of a hidden piece that shows: ${(stats.maxHidden * 100).toFixed(1)}% (${stats.worst.hid})`);
console.log(`  pieces the engine counts as visible but under 3% showing: ${stats.hairs} in the long lens, ${stats.hairsIso} in the isometric view (the least there: ${(stats.minIso * 100).toFixed(1)}%)`);
console.log(`  on-screen piece at 390x664 (a cell's worth of its outline, root of its area): smallest ${stats.edgeMin.toFixed(1)} px, largest ${stats.edgeMax.toFixed(1)} px; the lens makes the near corner of a stack ${stats.ratioMax.toFixed(2)} times the far one at most`);
check(stats.taps > 1000 && stats.tapMiss === 0, `a tap on the middle of what shows of a piece lands on that piece: ${stats.taps} taps, ${stats.tapMiss} wrong${stats.worst.tap ? ` (${stats.worst.tap})` : ""}`);
check(stats.minClear >= 0.1, "every piece a question may point at shows at least a tenth of its outline in the long lens, at rest and swaying");
check(stats.minVisible >= 0.004 && stats.minSway >= 0.0005, "every piece the engine says shows keeps something of it in the long lens (the engine's own threshold is a hair, 1.2% of a cell: 0.4% here at rest, 0.05% at the sway's ends)");
check(stats.hairs <= stats.hairsIso * 1.3 + 4, "the lens leaves no more pieces showing as a hair than the isometric view does (the engine's visible set is a hair's threshold; questions point only at clear ones)");
check(stats.maxHidden <= 0.05, "a piece the engine says is hidden shows at most a twentieth of its outline, swaying or not");
check(stats.ratioMax < 1.35, "the lens is long: the nearest corner of any stack is under 1.35 times the furthest");
process.exit(bad ? 1 : 0);
