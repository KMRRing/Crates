// Bones' line, laid out: the first tile in the middle, each arm along the middle row toward its edge, then turning (the
// right arm down, the left arm up) under the last tile's end and running back along the next row, as a line of
// dominoes snakes on a table. Units: a tile is 1 across and 2 along; a double lies across the line (in a turn, along
// it). Pure, so tests/bones.mjs can check no two tiles ever overlap.
import { TILES } from "./bones-rules.js";

/**
 * The tiles' places: [{ t, x, y, v (lies vertical), a, b (the numbers on its top and bottom, or left and right
 * halves), arm ("F", "L", "R"), i (its place in its arm) }] and the box round them. rowLen: the row's length in units.
 */
export function layout(first, firstSides, left, right, rowLen) {
  const out = [];
  if (first == null) return { tiles: out, box: { x0: -1, x1: 1, y0: -1, y1: 1 } };
  const half = rowLen / 2, fd = firstSides[0] === firstSides[1];
  out.push({ t: first, x: 0, y: 0, v: fd, a: firstSides[0], b: firstSides[1], arm: "F", i: 0 });
  const arm = (list, side, start) => {
    // side +1: the right arm, turning down; -1: the left arm, turning up
    let dir = side, x = side * (fd ? 0.5 : 1), y = 0, rowH = fd ? 1 : 0.5, inner = start;
    list.forEach(({ t, v }, i) => {
      const d = TILES[t][0] === TILES[t][1], len = d ? 1 : 2, tag = side === 1 ? "R" : "L";
      if (dir === 1 ? x + len <= half + 1e-9 : x - len >= -half - 1e-9) {
        if (d) out.push({ t, x: x + dir * 0.5, y, v: true, a: inner, b: inner, arm: tag, i });
        else out.push({ t, x: x + dir, y, v: false, a: dir === 1 ? inner : v, b: dir === 1 ? v : inner, arm: tag, i });
        x += dir * len;
        rowH = d ? 1 : 0.5;
      } else {
        // the turn: under (or over) the last tile's end, then the next row back, level with the turn's far half
        const ux = x - dir * 0.5, edge = y + side * rowH;
        out.push({ t, x: ux, y: edge + side, v: true, a: side === 1 ? inner : v, b: side === 1 ? v : inner, arm: tag, i });
        y = edge + side * 1.5;
        dir = -dir;
        x = ux + dir * 0.5;
        rowH = 0.5;
      }
      inner = v;
    });
  };
  arm(right, 1, firstSides[1]);
  arm(left, -1, firstSides[0]);
  const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const p of out) {
    const hw = p.v ? 0.5 : 1, hh = p.v ? 1 : 0.5;
    box.x0 = Math.min(box.x0, p.x - hw); box.x1 = Math.max(box.x1, p.x + hw);
    box.y0 = Math.min(box.y0, p.y - hh); box.y1 = Math.max(box.y1, p.y + hh);
  }
  return { tiles: out, box };
}

/**
 * The row length for a board of this shape (width over height): the shortest (so the largest tiles) whose rows can
 * hold `units` along each arm, and at least `minLen` (so a tablet's tiles aren't huge).
 */
export function rowLenFor(aspect, units = 30, minLen = 8) {
  for (let len = Math.max(8, minLen); len < 60; len += 2) {
    const height = (len + 1) / aspect, rows = Math.floor((height / 2 - 1.5) / 2);
    if (len / 2 + rows * (len - 1) >= units) return len;
  }
  return 60;
}

/** Where a number's pips go in a half (a unit square), for a half of a tile lying along x (wide) or along y. */
export function pipSpots(n, wide) {
  const c = [0.25, 0.5, 0.75], m = 0.5;
  const base = {
    0: [], 1: [[m, m]], 2: [[c[0], c[0]], [c[2], c[2]]], 3: [[c[0], c[0]], [m, m], [c[2], c[2]]],
    4: [[c[0], c[0]], [c[2], c[0]], [c[0], c[2]], [c[2], c[2]]], 5: [[c[0], c[0]], [c[2], c[0]], [m, m], [c[0], c[2]], [c[2], c[2]]],
    6: [[0.28, 0.22], [0.28, 0.5], [0.28, 0.78], [0.72, 0.22], [0.72, 0.5], [0.72, 0.78]],
  }[n];
  // a six's two rows of three run along the tile
  return n === 6 && wide ? base.map(([x, y]) => [y, x]) : base;
}

/** A tile as SVG, centred on (x, y) in units; cls for its state (last, ghost). */
export function tileSvg(p, cls = "") {
  const w = p.v ? 1 : 2, h = p.v ? 2 : 1, x0 = p.x - w / 2, y0 = p.y - h / 2, gap = 0.05;
  const pip = (n, hx, hy) => pipSpots(n, !p.v).map(([u, v]) => `<circle cx="${(hx + u).toFixed(3)}" cy="${(hy + v).toFixed(3)}" r="0.085"/>`).join("");
  const halves = p.v ? pip(p.a, x0, y0) + pip(p.b, x0, y0 + 1) : pip(p.a, x0, y0) + pip(p.b, x0 + 1, y0);
  const divider = p.v ? `M${x0 + 0.18} ${p.y}H${x0 + 0.82}` : `M${p.x} ${y0 + 0.18}V${y0 + 0.82}`;
  return `<g class="bn-tile${cls ? ` ${cls}` : ""}" data-t="${p.t}"><rect x="${(x0 + gap).toFixed(3)}" y="${(y0 + gap).toFixed(3)}" width="${w - 2 * gap}" height="${h - 2 * gap}" rx="0.13"/><path d="${divider}"/><g class="bn-pips">${halves}</g></g>`;
}
