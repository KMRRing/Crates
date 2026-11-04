// Survey's twists on the rows, pure: the solver for blocks whose readings are not one plain number. A rock may hold two ores,
// silver and gold, read apart (a plate says how many of each), and may be split by a fault, a plane through the rock where
// every row that crosses it is read in two halves, each its own number. Both are the same thing to the solver: a row has
// channels (an ore, a side of the fault) with a target count each, and a cube is in one of three states, waste, silver or
// gold. Reasoning keeps, for every cube, which of the three it can still be (a mask: bit 0 waste, bit 1 silver, bit 2 gold),
// and a round narrows each by the patterns every row could still be. Granite and air are cubes that are never ore.

export const WASTE = 1, SILVER = 2, GOLD = 4;
/** What a frame's cube may be before anything is known: waste or ore (one ore), or waste, silver or gold. */
export const fullOf = frame => (frame.ores === 2 ? 7 : 3);
/** The states a mask of a frame holds as the ore: silver and gold, or the one ore. */
export const oreOf = frame => (frame.ores === 2 ? 6 : 2);

/** How many sides a row along axis `a` is read in: two if the fault crosses it. */
export const sidesOf = (frame, a) => (frame.cut && frame.cut.axis === a ? 2 : 1);
/** The channels of a row along axis a: its sides times its ores. */
export const channelsOf = (frame, a) => sidesOf(frame, a) * (frame.ores === 2 ? 2 : 1);
/** The channel the i-th cube of a row along axis a counts in when it is ore of kind v (1 silver or the ore, 2 gold). */
export const channelOf = (frame, a, i, v) => (frame.cut && frame.cut.axis === a && i >= frame.cut.at ? (frame.ores === 2 ? 2 : 1) : 0) + (frame.ores === 2 ? v - 1 : 0);

/** A row's reading: the number of ore cubes in each of its channels. `states[i]` is 0 waste, 1 silver or ore, 2 gold (anything else not in the rock: 0). */
export function targetsOf(frame, a, states) {
  const t = new Array(channelsOf(frame, a)).fill(0);
  states.forEach((v, i) => { if (v > 0) t[channelOf(frame, a, i, v)]++; });
  return t;
}

/**
 * Every pattern of a row that fits: `dom[i]` is the mask of what its i-th cube may be, `t` the target of each channel (null
 * for a row nobody read: any pattern). Writes the union of what each cube is over the patterns into `out` and returns
 * whether there was one.
 */
export function fitRow(frame, a, t, dom, out) {
  const n = dom.length, nch = channelsOf(frame, a), cnt = new Array(nch).fill(0), cur = new Array(n).fill(0), top = frame.ores === 2 ? 2 : 1;
  // rem[i][ch]: how many of the cubes from i on could still be ore of that channel, so a pattern that can't reach its target is dropped early
  const rem = Array.from({ length: n + 1 }, () => new Array(nch).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let ch = 0; ch < nch; ch++) rem[i][ch] = rem[i + 1][ch];
    for (let v = 1; v <= top; v++) if (dom[i] >> v & 1) { rem[i][channelOf(frame, a, i, v)] += 1; }
  }
  let any = false;
  const go = i => {
    if (i === n) {
      if (t && cnt.some((c, j) => c !== t[j])) return;
      any = true;
      for (let j = 0; j < n; j++) out[j] |= 1 << cur[j];
      return;
    }
    for (let v = 0; v <= top; v++) {
      if (!(dom[i] >> v & 1)) continue;
      let ch = -1;
      if (v > 0) { ch = channelOf(frame, a, i, v); if (t && cnt[ch] >= t[ch]) continue; cnt[ch]++; }
      cur[i] = v;
      let fine = true;
      if (t) for (let c = 0; c < nch; c++) if (cnt[c] + rem[i + 1][c] < t[c]) { fine = false; break; }
      if (fine) go(i + 1);
      if (ch >= 0) cnt[ch]--;
    }
  };
  go(0);
  return any;
}

/**
 * One round: what every row's patterns leave of each cube, from `dom` (a mask per cube, 1 for a cube that is never ore).
 * Returns { dom, changed } or null if some row has no pattern that fits. `lines` is the block's rows (linesOf).
 */
export function round(frame, lines, clues, dom) {
  const next = Uint8Array.from(dom);
  let changed = false;
  const d = [], out = [];
  for (let k = 0; k < lines.length; k++) {
    const { a, cells } = lines[k];
    d.length = out.length = cells.length;
    let live = false;
    cells.forEach((c, i) => { d[i] = dom[c]; out[i] = 0; if (dom[c] !== 1) live = true; });
    const t = clues[k] ? clues[k].t : null;
    if (!live && !t) continue;
    if (!fitRow(frame, a, t, d, out)) return null;
    cells.forEach((c, i) => { const m = next[c] & out[i]; if (m !== next[c]) { next[c] = m; changed = true; } });
  }
  return { dom: next, changed };
}
