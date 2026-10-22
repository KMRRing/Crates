// Stow's manifests on the page (October 2026): the hold; the manifest, every piece of it in the tray at once, each
// turned by a tap and dragged into the hold; a piece taken back out (dragged off a flat hold, or Undo) is a restow. The
// fit is felt: the sides a piece seats flush against lit in gilt with a tap of the phone, a piece that fills a pocket
// exactly glowing "tight"; space no piece left can fill hatched; the rules' state in the orders over the tray; and when
// the last piece seats and nothing's broken, the hatch closes over the hold. The rules and the moves are stow-pack.js's,
// a hold in decks is drawn by stow-3d.js; the plan in play is the page's (solo) or the table's (stow-room.js), and this
// only draws it and asks for moves (ctx.commit), whose results come back through update.
import { placements, options } from "./stow-engine.js";
import { cellsOf, turned, extent, pieceFor, fieldOf, placedList, occupancy, boardOf, audit, seat, act, rulesOf, tonnes, lastIn, liftable, PORTS } from "./stow-pack.js";
import { holdScene, drawPiece, reachFor } from "./stow-3d.js";
import { scale } from "./wide.js";

const SVG = "http://www.w3.org/2000/svg";
const f3 = v => (Math.abs(v) < 5e-4 ? "0" : +v.toFixed(3));
// a cell's sides: the neighbour across it, and its ends from the cell's corner (top, right, bottom, left)
const SIDES = [[0, -1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 1], [0, 1, 1, 1, 0, 1], [-1, 0, 0, 1, 0, 0]];
// eight enamels for telling pieces apart: the four, and each lighter (stow.css .k1–.k8, and stow-3d's .t1–.t8)
const PALETTE = [1, 2, 4, 3, 5, 6, 8, 7];
// a port's enamel: Antwerp cobalt, Rotterdam oxblood, Amsterdam verdigris
const PORT_TINT = [0, 1, 4, 2];
const FLAKE = `<svg viewBox="-1 -1 2 2" aria-hidden="true"><path d="${[0, 1, 2].map(k => { const a = (k * Math.PI) / 3; return `M${f3(-Math.cos(a) * 0.8)} ${f3(-Math.sin(a) * 0.8)}L${f3(Math.cos(a) * 0.8)} ${f3(Math.sin(a) * 0.8)}`; }).join("")}"/></svg>`;
const HINTS = {
  "1/1": "Every piece of the manifest goes in: drag them into the hold.",
  "1/2": "Tap a piece to turn it.",
  "1/3": "Drag a piece back off to restow it: three stars for none.",
  "2/1": "The crane lowers each piece until it meets a crate.",
  "2/2": "Drag across the hold to turn it round.",
  "3/1": "Antwerp first, then Rotterdam, then Amsterdam: what comes off first goes on top.",
  "4/1": "Every reefer goes on a plug.",
  "5/1": "Class 3 and class 5.1 never touch, not even at a corner.",
  "6/1": "Port and starboard must weigh the same.",
  "4/9": "In a hold in decks the plugs are on the floor.",
  "5/9": "In decks they mustn't touch above or below either.",
  "6/9": "Port and starboard are lettered at the hold's sides, the bow marked.",
  "7/1": "Every rule at once.",
};

/**
 * The mode, given the page's ctx: { $, toast, haptic(kind), view() (a hold's turn), active(), canAct() (your turn),
 * commit(move) (the shell applies it, or sends it to the table, then calls update), turned(turns) (the tray's turns
 * changed: keep them), names: { level(lv), result(done, text) }, result() (the result's shown: its buttons) }.
 */
export function createPlan(ctx) {
  const { $ } = ctx;
  let L = null, F = null, P = null, turns = [], scene = null, colour = [], reach = 1, ext = 4, plugAt = new Set();
  // hatch: "open" (the stow under way, or just done and seating), "closing" (sliding shut), "shut", "peek" (lifted by a
  // tap to look at the stow done)
  let drag = null, press = null, fx = null, anim = null, hatch = "open";
  const on = () => ctx.active();

  // ---------- a level ----------
  function show(level, plan, kept = null) {
    L = level; F = fieldOf(level); P = plan;
    turns = level.pieces.map((_, j) => kept?.[j] ?? 0);
    colour = coloursOf(level);
    plugAt = new Set(F.decks ? [] : (level.plugs || []).map(i => F.cells[i].c.join(",")));
    ext = Math.max(...level.pieces.map(p => Math.max(...extent(cellsOf(p.c))))) + 0.7;
    hatch = P.done ? "shut" : "open";                              // a stow already done opens with its hatch shut
    fx = null; anim = null;
    clearDrag();
    const svg = $("board");
    svg.replaceChildren();
    if (F.decks) {
      svg.dataset.kind = "deck";
      scene = holdScene(svg, F, ctx.view());
      reach = reachFor(F, level.pieces.flatMap(p => [0, 1, 2, 3].map(o => pieceFor(turned(cellsOf(p.c), o), true))));
      frame();
    } else {
      scene = null;
      svg.dataset.kind = "plan";
      const pad = 0.35, w = F.box.w + 2 * pad, h = F.box.h + 2 * pad;
      svg.setAttribute("viewBox", `${f3(F.box.x - pad)} ${f3(F.box.y - pad)} ${f3(w)} ${f3(h)}`);
      svg.style.setProperty("--ar", (w / h).toFixed(4));
    }
    render();
  }
  /** Pieces next to each other in the stow get different enamels; in decks with ports, each its port's, a piece by
   *  one of the same port in its lighter tone. */
  function coloursOf(level) {
    const F0 = fieldOf(level), occ = occupancy(level, level.solution.map(([o, at]) => ({ o, at })), F0), n = level.pieces.length;
    const touch = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < F0.n; i++) if (occ[i] >= 0) for (const j of F0.cells[i].nb) if (occ[j] >= 0 && occ[j] !== occ[i]) touch[occ[i]].add(occ[j]);
    // each piece the enamel its neighbours don't wear that's been worn least so far (the full four before the lighter)
    const out = new Array(n).fill(0), worn = new Map(PALETTE.map(t => [t, 0]));
    for (let j = 0; j < n; j++) {
      const port = level.pieces[j].port, used = new Set([...touch[j]].map(k => out[k]));
      if (port) { const t = PORT_TINT[port]; out[j] = used.has(t) ? t + 4 : t; continue; }
      const free = PALETTE.filter(t => !used.has(t)), from = free.some(t => t <= 4) ? free.filter(t => t <= 4) : free;
      out[j] = from.length ? from.reduce((a, t) => (worn.get(t) < worn.get(a) ? t : a)) : PALETTE[j % 8];
      worn.set(out[j], worn.get(out[j]) + 1);
    }
    return out;
  }
  const unitsPer = () => { const m = $("board").getScreenCTM(); return m ? m.a : 30; };
  function frame() { const [, , w, h] = scene.frame; $("board").style.setProperty("--ar", (w / h).toFixed(4)); scene.px = unitsPer() / scale(); }
  const placed = () => placedList(L, P);
  const cellsAt = (j, o) => turned(cellsOf(L.pieces[j].c), o);

  // ---------- the flat hold ----------
  /** A piece's cells drawn: its fill (one path, so its crates join without seams), the faint seams between its crates,
   *  its outline, and its tag at the cell nearest its middle. */
  function pieceMarkup(j, xy, cls = "", { bare = false } = {}) {
    const set = new Set(xy.map(([x, y]) => `${x},${y}`));
    let fill = "", seam = "", line = "";
    for (const [x, y] of xy) {
      fill += `M${x} ${y}h1v1h-1Z`;
      for (const [dx, dy, ax, ay, bx, by] of SIDES) {
        const seg = `M${x + ax} ${y + ay}L${x + bx} ${y + by}`;
        if (!set.has(`${x + dx},${y + dy}`)) line += seg; else if (dx > 0 || dy > 0) seam += seg;
      }
    }
    // the tag at the cell nearest the piece's middle that has no plug (a plug's drawn over everything)
    const mx = xy.reduce((s, c) => s + c[0], 0) / xy.length, my = xy.reduce((s, c) => s + c[1], 0) / xy.length;
    const free = xy.filter(([x, y]) => !plugAt.has(`${x},${y}`)), from = free.length ? free : xy;
    const [lx, ly] = from.reduce((b, c) => (Math.hypot(c[0] - mx, c[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? c : b), from[0]);
    return `<g class="pc k${colour[j]}${tonnes(L.pieces[j]) > 1 ? " heavy" : ""}${cls}" data-j="${j}"><path class="f" d="${fill}"/><path class="s" d="${seam}"/><path class="o" d="${line}"/>${bare ? "" : glyph(L.pieces[j], lx + 0.5, ly + 0.5)}</g>`;
  }
  /** A piece's tag drawn at (x, y): a reefer's snowflake, a dangerous good's placard, a heavy piece's tonnes. */
  function glyph(p, x, y) {
    if (p.reefer) {
      let d = "";
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a), r = 0.27;
        d += `M${f3(x)} ${f3(y)}L${f3(x + c * r)} ${f3(y + s * r)}`;
        const bx = x + c * r * 0.62, by = y + s * r * 0.62;
        for (const t of [a + 0.9, a - 0.9]) d += `M${f3(bx)} ${f3(by)}L${f3(bx + Math.cos(t) * 0.09)} ${f3(by + Math.sin(t) * 0.09)}`;
      }
      return `<path class="gl flake" d="${d}"/>`;
    }
    if (p.dg) {
      const r = 0.33;
      return `<g class="gl dg d${p.dg === "3" ? "3" : "5"}"><path d="M${f3(x)} ${f3(y - r)}L${f3(x + r)} ${f3(y)}L${f3(x)} ${f3(y + r)}L${f3(x - r)} ${f3(y)}Z"/><text x="${f3(x)}" y="${f3(y + 0.005)}">${p.dg}</text></g>`;
    }
    if (tonnes(p) > 1) return `<g class="gl wt"><rect x="${f3(x - 0.27)}" y="${f3(y - 0.16)}" width="0.54" height="0.32" rx="0.05"/><text x="${f3(x)}" y="${f3(y + 0.005)}">${tonnes(p)}t</text></g>`;
    return "";
  }
  const xyOf = idx => [...idx].map(i => F.cells[i].c.slice(0, 2));
  function drawFlat(au, ghost) {
    const occ = occupancy(L, placed().map((p, j) => (drag?.j === j && drag.from === "hold" ? null : p)), F), out = [];
    const b = F.box, pad = 0.35;
    out.push(`<defs><pattern id="sw-hatch" width="0.25" height="0.25" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.25" height="0.25" class="hatch-bg"/><path d="M0 0V0.25" class="hatch-ln"/></pattern>`,
      `<clipPath id="sw-clip"><rect x="${f3(b.x - pad)}" y="${f3(b.y - pad)}" width="${f3(b.w + 2 * pad)}" height="${f3(b.h + 2 * pad)}" rx="0.12"/></clipPath></defs>`);
    // the floor, and the crates aboard
    for (const cell of F.cells) {
      const [x, y] = cell.c;
      if (occ[cell.i] === -2) out.push(`<g class="crate"><rect x="${x}" y="${y}" width="1" height="1"/><rect class="lid" x="${x + 0.12}" y="${y + 0.12}" width="0.76" height="0.76"/><path d="M${x + 0.12} ${y + 0.88}L${x + 0.88} ${y + 0.12}"/></g>`);
      else out.push(`<rect class="fl" x="${x}" y="${y}" width="1" height="1"/>`);
    }
    // the side the bow is: up the page; port and starboard marked where it matters
    if (L.keel) out.push(`<text class="side-mark" x="${f3(b.x - 0.17)}" y="${f3(b.y + b.h / 2)}">P</text><text class="side-mark" x="${f3(b.x + b.w + 0.17)}" y="${f3(b.y + b.h / 2)}">S</text>`);
    // the pieces stowed
    const bad = new Set([...au.unplugged, ...au.clash.flat()]);
    placed().forEach((p, j) => {
      if (!p || (drag?.j === j && drag.from === "hold")) return;
      const xy = [];
      for (let i = 0; i < F.n; i++) if (occ[i] === j) xy.push(F.cells[i].c.slice(0, 2));
      out.push(pieceMarkup(j, xy, `${bad.has(j) ? " bad" : ""}${fx?.j === j ? ` seat${fx.tight ? " tight" : ""}` : ""}`));
    });
    // dead space: no piece left could fill it
    for (const i of au.dead) { const [x, y] = F.cells[i].c; out.push(`<rect class="dead" x="${x}" y="${y}" width="1" height="1"/>`); }
    // where the piece in hand would go
    if (ghost) out.push(pieceMarkup(drag.j, xyOf(ghost), " ghost"));
    // the plugs, over everything: lit under a reefer, struck under anything else
    for (const i of L.plugs || []) {
      const [x, y] = F.cells[i].c, o = occ[i], state = o >= 0 ? (L.pieces[o].reefer ? " live" : " blocked") : "";
      out.push(`<g class="plug${state}"><circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.2"/><circle class="pin" cx="${x + 0.43}" cy="${y + 0.5}" r="0.035"/><circle class="pin" cx="${x + 0.57}" cy="${y + 0.5}" r="0.035"/></g>`);
    }
    // the sides the piece just seated is flush against, a moment in gilt
    if (fx?.flush) out.push(`<path class="flush" d="${fx.flush}"/>`);
    out.push(hatchMarkup([b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad]));
    $("board").innerHTML = out.join("");
  }
  /** The hatch covers over the hold's frame: shut once the stow's done (sliding shut the first time). */
  function hatchMarkup([x, y, w, h], clip = true) {
    if (!P.done || hatch === "open" || hatch === "peek") return "";
    const closing = hatch === "closing";
    const cover = (cx, side) => `<g class="cover ${side}"><rect x="${f3(cx)}" y="${f3(y)}" width="${f3(w / 2)}" height="${f3(h)}"/><path d="${[0.25, 0.5, 0.75].map(k => `M${f3(cx)} ${f3(y + h * k)}h${f3(w / 2)}`).join("")}"/></g>`;
    return `<g class="hatch${closing ? " closing" : ""}"${clip ? ' clip-path="url(#sw-clip)"' : ""}>${cover(x, "l")}${cover(x + w / 2, "r")}<path class="seam" d="M${f3(x + w / 2)} ${f3(y)}v${f3(h)}"/><text class="stamp" x="${f3(x + w / 2)}" y="${f3(y + h / 2)}" style="font-size:${f3(Math.min(w, h) * 0.11)}px">Stowed</text></g>`;
  }

  // ---------- a hold in decks ----------
  function drawDeep(au, ghost) {
    const occ = occupancy(L, placed(), F), board = new Array(F.n).fill(0), tint = new Array(F.n).fill(0);
    const marks = new Map(), heavy = new Set(), bad = new Set(), wrong = new Set([...au.over.map(([j]) => j), ...au.unplugged, ...au.clash.flat()]);
    const tag = (i, j) => { const m = markOf(L.pieces[j]); if (m) marks.set(i, m); if (tonnes(L.pieces[j]) > 1) heavy.add(i); };
    for (let i = 0; i < F.n; i++) if (occ[i] !== -1) {
      board[i] = 1;
      if (occ[i] < 0) continue;
      tint[i] = colour[occ[i]];
      tag(i, occ[i]);
      if (wrong.has(occ[i])) bad.add(i);
    }
    if (ghost) for (const i of ghost) tag(i, drag.j);
    scene.px = unitsPer() / scale();
    const o = { board, tint, ghost, ghostTint: drag ? colour[drag.j] : 1, bad, marks, heavy, plugs: L.plugs, sides: !!L.keel };
    if (anim) Object.assign(o, anim.frame());
    if (fx?.cells) o.seat = fx.cells;
    scene.draw(o);
    $("board").insertAdjacentHTML("beforeend", hatchMarkup(scene.frame, false));
  }

  /** What a piece wears on its crates in 3D: a dangerous good's placard, a reefer's snowflake. */
  const markOf = p => (p.dg === "3" ? "dg3" : p.dg ? "dg5" : p.reefer ? "flake" : null);

  // ---------- the tray: the manifest ----------
  function drawTray() {
    if (drag) return;
    const box = $("tray"), list = placed(), canUndo = lastIn(L, P) >= 0 && ctx.canAct() && !P.done;
    box.className = "sw-tray plan";
    box.hidden = !!P.done;
    // as big as the tray allows, every piece on one scale, the Undo last
    const n = L.pieces.length + 1, r = box.getBoundingClientRect(), gap = 6 * scale();
    let cols = 1, best = 0;
    for (let c = 1; c <= n; c++) {
      const rows = Math.ceil(n / c), t = Math.min((r.width - gap * (c - 1)) / c, (r.height - gap * (rows - 1)) / rows);
      if (t > best + 0.5) { best = t; cols = c; }
    }
    box.style.setProperty("--cols", cols);
    box.style.setProperty("--rows", Math.ceil(n / cols));
    box.replaceChildren(...L.pieces.map((p, j) => tile(p, j, !!list[j])));
    const u = document.createElement("button");
    u.type = "button";
    u.className = "sw-undo";
    u.disabled = !canUndo;
    u.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H15A5 5 0 0 1 15 17H8"/><path d="M11.5 3.5L8 7L11.5 10.5"/></svg><span>Undo</span>`;
    u.setAttribute("aria-label", "Undo: take the last piece back out (a restow)");
    u.addEventListener("click", () => { if (!u.disabled) undo(); });
    box.appendChild(u);
  }
  function tile(p, j, stowed) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `sw-mf${stowed ? " stowed" : ""}`;
    b.dataset.j = j;
    b.setAttribute("aria-label", `${describe(p)}${stowed ? ", stowed" : ": tap to turn, drag into the hold"}`);
    b.appendChild(pieceSvg(j, turns[j], true));
    // its tag, legible at the tray's size, in the corner: the port it's for, a snowflake, a placard, the tonnes
    const tag = document.createElement("span");
    if (p.port) { tag.className = `sw-tag sw-port p${p.port}`; tag.textContent = PORTS[p.port - 1]; }
    else if (p.reefer) { tag.className = "sw-tag flake"; tag.innerHTML = FLAKE; }
    else if (p.dg) { tag.className = "sw-tag"; tag.innerHTML = `<i class="dgi d${p.dg === "3" ? "3" : "5"}">${p.dg}</i>`; }
    else if (tonnes(p) > 1) { tag.className = "sw-tag wt"; tag.textContent = `${tonnes(p)} t`; }
    if (tag.className) b.appendChild(tag);
    if (stowed) b.disabled = true;
    else {
      b.addEventListener("pointerdown", e => startPress(j, e, "tray", b));
      b.addEventListener("click", e => { if (e.detail === 0) turnPiece(j); });   // a key's press turns it too
    }
    return b;
  }
  const describe = p => `${p.reefer ? "Reefer, " : ""}${p.dg ? `class ${p.dg}, ` : ""}${p.port ? `for ${PORTS[p.port - 1]}, ` : ""}${tonnes(p) > 1 ? `${tonnes(p)} t a crate, ` : ""}${cellsOf(p.c).length} crates`;
  /** A piece on its own: in the tray (fit: every piece on the level's one scale, centred) or in hand (at the hold's). */
  function pieceSvg(j, o, fit) {
    const svg = document.createElementNS(SVG, "svg");
    if (F.decks) {
      svg.setAttribute("class", "sw-piece deck");
      svg.dataset.kind = "deck";
      svg.shape = drawPiece(svg, F, pieceFor(cellsAt(j, o), true), ctx.view(), { fit, tint: colour[j], reach, mark: markOf(L.pieces[j]), heavy: tonnes(L.pieces[j]) > 1 });
      return svg;
    }
    const xy = cellsAt(j, o), [w, h] = extent(xy);
    svg.setAttribute("class", "sw-piece plan");
    svg.dataset.kind = "plan";
    svg.setAttribute("viewBox", fit ? `${f3(w / 2 - ext / 2)} ${f3(h / 2 - ext / 2)} ${f3(ext)} ${f3(ext)}` : `0 0 ${w} ${h}`);
    svg.innerHTML = pieceMarkup(j, xy, "", { bare: fit });
    const mx = xy.reduce((s, c) => s + c[0] + 0.5, 0) / xy.length, my = xy.reduce((s, c) => s + c[1] + 0.5, 0) / xy.length;
    svg.shape = { box: { x: 0, y: 0, w, h }, cx: mx, cy: my };
    return svg;
  }
  /** A tap turns a piece a quarter clockwise (drawn turning, then as it now lies, in its tile as the tray now is). */
  function turnPiece(j) {
    turns[j] = (turns[j] + 1) % 4;
    ctx.turned(turns);
    const tileNow = () => $("tray").querySelector(`.sw-mf[data-j="${j}"]`), svg = tileNow()?.querySelector("svg");
    const swap = () => { const b = tileNow(); if (!drag && b) b.replaceChild(pieceSvg(j, turns[j], true), b.querySelector("svg")); };
    if (svg && !F.decks && !still()) { svg.classList.add("turning"); setTimeout(swap, 150); }
    else swap();
  }

  // ---------- pressing, dragging ----------
  function clearDrag() { drag?.el?.remove(); drag?.tile?.classList.remove("lifted"); drag = null; press = null; }
  function toBoard(px, py) {
    const svg = $("board"), m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = px; pt.y = py;
    return pt.matrixTransform(m.inverse());
  }
  function startPress(j, e, from, tileEl = null) {
    if (!on() || P.done || anim || e.button > 0) return;
    e.preventDefault();
    press = { j, from, x0: e.clientX, y0: e.clientY, id: e.pointerId, tile: tileEl };
    try { (tileEl || $("board")).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  }
  /** Where piece j turned o could go now (a hold in decks: where the crane would bring it to rest), each with its
   *  middle as drawn, for snapping to the nearest. */
  function targetsFor(j, o, without) {
    const cells = cellsAt(j, o), board = boardOf(L, P, without, F);
    const list = F.decks ? options(F, board, pieceFor(cells, true)) : placements(F, pieceFor(cells, false)).filter(idx => [...idx].every(i => !board[i]));
    return list.map(idx => {
      let x = 0, y = 0;
      for (const i of idx) { const [cx, cy] = scene ? scene.centre(i) : [F.cells[i].x, F.cells[i].y]; x += cx; y += cy; }
      return { idx, x: x / idx.length, y: y / idx.length };
    });
  }
  function beginDrag(e) {
    const { j, from, tile: t } = press, o = from === "hold" ? placed()[j].o : turns[j];
    const u = unitsPer(), el = pieceSvg(j, o, false), sh = el.shape;
    el.classList.add("sw-float");
    el.style.width = `${sh.box.w * u}px`;
    el.style.height = `${sh.box.h * u}px`;
    document.body.appendChild(el);
    t?.classList.add("lifted");
    // held above the finger, so it can see where the piece goes (a mouse needs no lift)
    const lift = e.pointerType === "mouse" ? 0 : Math.max(56, (sh.box.h / 2) * u + 34);
    drag = { j, from, o, el, u, lift, sh, list: targetsFor(j, o, from === "hold" ? j : -1), place: null, tile: t, id: press.id };
    press = null;
  }
  function moveDrag(e) {
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 8) {
      if (!ctx.canAct()) { ctx.toast("Not your turn yet"); press = null; return; }
      beginDrag(e);
    }
    if (!drag || e.pointerId !== drag.id) return;
    const { el, u, sh, lift } = drag, cx = e.clientX, cy = e.clientY - lift;
    el.style.left = `${cx - (sh.cx - sh.box.x) * u}px`;
    el.style.top = `${cy - (sh.cy - sh.box.y) * u}px`;
    const at = toBoard(cx, cy);
    let best = null, d = Infinity;
    if (at) for (const t of drag.list) { const dd = Math.hypot(t.x - at.x, t.y - at.y); if (dd < d) { d = dd; best = t; } }
    const t = best && d <= (F.decks ? 0.9 : 0.75) ? best : null;
    // in a hold, a piece with a place to go is drawn there, among the crates; anywhere else, it's in hand
    el.style.visibility = scene && t ? "hidden" : "visible";
    if (t === drag.place && drag.drawn) return;
    drag.place = t; drag.drawn = true;
    drawBoard(t?.idx || null);
  }
  function endDrag(e) {
    if (press && e.pointerId === press.id) {                       // a tap: a piece in the tray turns
      const { j, from } = press;
      press = null;
      if (from === "tray") turnPiece(j);
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const { j, from, o, place } = drag, r = $("board").getBoundingClientRect();
    const overHold = e.clientX >= r.left && e.clientX <= r.right && e.clientY - drag.lift >= r.top && e.clientY - drag.lift <= r.bottom;
    clearDrag();
    const had = placed()[j];
    if (place) {
      if (from === "hold" && had.o === o && had.at === place.idx[0]) { render(); return; }
      send({ kind: from === "hold" ? "move" : "place", j, o, at: place.idx[0] });
      return;
    }
    // dropped off the hold, a stowed piece comes back out (a restow); over it but nowhere it fits, it stays where it was
    if (from === "hold" && !overHold) { send({ kind: "lift", j }); return; }
    render();
  }
  /** A move of yours: felt at once (a tap of the phone needs the finger still on it), then made. */
  function send(move) {
    const next = act(L, P, move, F);
    if (!next) { render(); return; }
    if (move.kind !== "lift") {
      const occ = occupancy(L, placedList(L, next), F), idx = [];
      for (let i = 0; i < F.n; i++) if (occ[i] === move.j) idx.push(i);
      ctx.haptic(next.done ? "won" : seat(F, occ, idx).tight ? "tight" : "seat");
    }
    ctx.commit(move);
  }
  addEventListener("pointermove", e => { if (on()) moveDrag(e); });
  addEventListener("pointerup", e => { if (on()) endDrag(e); });
  addEventListener("pointercancel", e => { if (on() && (drag?.id === e.pointerId || press?.id === e.pointerId)) { clearDrag(); render(); } });
  // a stowed piece in a flat hold is dragged out of it (in decks the board turns the hold, and Undo takes pieces out)
  $("board").addEventListener("pointerdown", e => {
    if (!on() || scene || !P) return;
    if (P.done) { peek(); return; }
    const at = toBoard(e.clientX, e.clientY), i = at && F.index.get(`${Math.floor(at.x)},${Math.floor(at.y)}`);
    if (i === undefined || i === null) return;
    const occ = occupancy(L, placed(), F), j = occ[i];
    if (j >= 0) startPress(j, e, "hold");
  });
  /** A tap on a hold stowed lifts its hatch to look, and another shuts it. */
  function peek() {
    if (!P?.done || hatch === "closing") return;
    hatch = hatch === "peek" ? "shut" : "peek";
    render();
  }
  function undo() {
    const j = lastIn(L, P);
    if (j < 0 || P.done || !ctx.canAct() || !liftable(L, P, j, F)) return;
    send({ kind: "lift", j });
  }

  // ---------- a move made: felt and shown ----------
  /**
   * A new plan (the move just made here, or at the table): a piece in shown seating, its flush sides lit, tight when
   * it fills a pocket exactly; the hatch closing on the last. `move` is what was done ({ kind, j }).
   */
  function update(plan, { move = null } = {}) {
    const was = P;
    P = plan;
    if (!L) return;
    const j = move?.j, p = j != null ? placed()[j] : null;
    if (p && (move.kind === "place" || move.kind === "move")) {
      const occ = occupancy(L, placed(), F), idx = [];
      for (let i = 0; i < F.n; i++) if (occ[i] === j) idx.push(i);
      const s = seat(F, occ, idx);
      if (!F.decks) {
        let d = "";
        for (const side of s.sides) if (side.flush) { const [x, y] = F.cells[side.i].c, k = SIDES.findIndex(q => q[0] === side.d[0] && q[1] === side.d[1]), q = SIDES[k]; d += `M${x + q[2]} ${y + q[3]}L${x + q[4]} ${y + q[5]}`; }
        fx = { j, flush: d, tight: s.tight };
        if (s.tight) pop("Tight", idx);
        setTimeout(() => { if (fx?.j === j) { fx = null; render(); } }, 700);
        render();
      } else lower(j, idx, s.tight);
    } else if (move?.kind === "lift" && F.decks && was) rise(move.j, was);
    else render();
    if (P.done && !was?.done) setTimeout(() => {
      if (!P.done || hatch !== "open") return;
      hatch = still() ? "shut" : "closing";
      render();
      setTimeout(() => { if (hatch === "closing") hatch = "shut"; }, 700);
    }, F.decks ? 560 : 360);
  }
  /** A word rising from where a piece seated. */
  function pop(text, idx) {
    const el = $("pop"), host = $("hold").getBoundingClientRect(), svg = $("board").getScreenCTM();
    if (!el || !svg) return;
    let x = 0, y = 0;
    for (const i of idx) { const [cx, cy] = scene ? scene.centre(i) : [F.cells[i].x, F.cells[i].y]; x += cx / idx.length; y += cy / idx.length; }
    const pt = $("board").createSVGPoint();
    pt.x = x; pt.y = y;
    const s = pt.matrixTransform(svg);
    el.textContent = text;
    el.style.left = `${s.x - host.left}px`;
    el.style.top = `${s.y - host.top}px`;
    el.classList.remove("go");
    void el.offsetWidth;
    el.classList.add("go");
  }
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** A piece lowered into a hold in decks: from over the hatch to where it rests, then its crates lit a moment. */
  function lower(j, idx, tight) {
    const seated = { cells: new Set(idx) };
    const done = () => { anim = null; fx = seated; if (tight) pop("Tight", idx); render(); setTimeout(() => { if (fx === seated) { fx = null; render(); } }, 420); };
    if (still()) { done(); return; }
    const low = Math.min(...idx.map(i => Math.floor(i / F.n2))), rise0 = F.decks + 0.6 - low, ease = t => 1 - (1 - t) * (1 - t), t0 = performance.now();
    const mine = anim = { frame: () => ({ lift: new Map(idx.map(i => [i, rise0 * (1 - ease(Math.min(1, (performance.now() - t0) / 190)))])) }) };
    const step = now => { if (anim !== mine) return; render(); if (now - t0 < 190) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  }
  /** A piece lifted back out of a hold in decks: drawn rising out of the hatch from where it was. */
  function rise(j, was) {
    if (still()) { render(); return; }
    const occ = occupancy(L, placedList(L, was), F), idx = [];
    for (let i = 0; i < F.n; i++) if (occ[i] === j) idx.push(i);
    const low = Math.min(...idx.map(i => Math.floor(i / F.n2))), up = F.decks + 0.6 - low, t0 = performance.now(), keep = P;
    // drawn as it was, the piece rising, then the hold as it is now
    P = was;
    const mine = anim = { frame: () => ({ lift: new Map(idx.map(i => [i, up * Math.min(1, (performance.now() - t0) / 170) ** 2])) }) };
    const step = now => { if (anim !== mine) { if (P === was) P = keep; return; } render(); if (now - t0 < 170) requestAnimationFrame(step); else { anim = null; P = keep; render(); } };
    requestAnimationFrame(step);
  }

  // ---------- drawing ----------
  function drawBoard(ghost = null) {
    const au = audit(L, placed(), F);
    if (scene) drawDeep(au, ghost); else drawFlat(au, ghost);
    return au;
  }
  function render() {
    if (!on() || !L || !P) return;
    $("where").textContent = ctx.names.level(L);
    const left = L.pieces.length - placed().filter(Boolean).length, r = P.restows || 0;
    $("tally").textContent = `${left ? `${left} left` : "All in"} · ${r ? `${r} restow${r === 1 ? "" : "s"}` : "no restows"}`;
    const au = drawBoard(drag?.place?.idx || null);
    drawOrders(au);
    drawTray();
    drawResult();
  }
  /** The rules over the tray, each with how it stands now; and a line saying what matters most. */
  function drawOrders(au) {
    const box = $("orders"), rules = rulesOf(L);
    box.hidden = !rules.length;
    box.replaceChildren(...rules.map(rule => order(rule, au)));
    let say = "", tone = "";
    if (P.done) say = "";
    else if (au.dead.length) { say = au.hollow ? "Dead space under a piece: no crane can reach it" : `Dead space: no piece left fills ${au.dead.length === 1 ? "that cell" : `those ${au.dead.length} cells`}`; tone = "bad"; }
    else if (au.clash.length) { say = "Class 3 is touching 5.1: restow one of them"; tone = "bad"; }
    else if (au.over.length) { const [a, b] = au.over[0]; say = `${PORTS[L.pieces[a].port - 1]} cargo over ${PORTS[L.pieces[b].port - 1]}'s: a restow at ${PORTS[L.pieces[b].port - 1]}`; tone = "bad"; }
    else if (au.unplugged.length) { say = "A reefer off its plug: it needs the power"; tone = "bad"; }
    else if (au.blocked) { say = "A plug under cargo that isn't a reefer: a reefer will go without"; tone = "bad"; }
    else if (!au.left && au.keel && au.keel.port !== au.keel.star) { const d = au.keel.port - au.keel.star; say = `Listing ${Math.abs(d)} t to ${d > 0 ? "port" : "starboard"}: shift the heavy cargo`; tone = "bad"; }
    else say = !P.restows && !Object.keys(P.placed || {}).length ? HINTS[`${L.chapter}/${L.n}`] || "" : "";
    const el = $("say");
    el.textContent = say;
    el.className = `sw-say${tone ? ` ${tone}` : ""}`;
  }
  function order(rule, au) {
    const s = document.createElement("span");
    let ok = false, bad = false, html = "";
    const all = !au.left;
    if (rule === "reefer") {
      const n = L.pieces.filter(p => p.reefer).length, on2 = placed().filter((p, j) => p && L.pieces[j].reefer && !au.unplugged.includes(j)).length;
      bad = au.unplugged.length > 0; ok = on2 === n;
      html = `${FLAKE}On plugs <b>${on2}/${n}</b>`;
    } else if (rule === "dg") {
      bad = au.clash.length > 0; ok = all && !bad;
      html = `<i class="dgi d3">3</i><i class="dgi d5">5.1</i>${bad ? "Touching" : "Apart"}`;
    } else if (rule === "port") {
      bad = au.over.length > 0; ok = all && !bad;
      html = PORTS.map((p, k) => `<i class="pt p${k + 1}">${p}</i>`).join("") + (bad ? "Out of order" : "First off on top");
    } else if (rule === "keel") {
      const { port, star } = au.keel, tilt = Math.max(-28, Math.min(28, (star - port) * 4));
      bad = all && port !== star; ok = all && port === star;
      html = `<svg class="clino" viewBox="-12 -2 24 14" aria-hidden="true"><path class="arc" d="M-10 0A10 10 0 0 0 10 0"/><path class="tick" d="M0 8.6V10.4M-5 7.1L-5.6 8.4M5 7.1L5.6 8.4"/><path class="needle" d="M0 0L0 9" transform="rotate(${f3(-tilt)})"/><circle r="1.3"/></svg>P <b>${port}</b> · S <b>${star}</b> t`;
    }
    s.className = `sw-order${bad ? " bad" : ok ? " ok" : ""}`;
    s.innerHTML = html;
    return s;
  }
  function drawResult() {
    const box = $("result");
    box.hidden = !P.done;
    if (!P.done) return;
    const r = P.done.restows || 0;
    $("verdict").textContent = ctx.names.result(P.done, r ? `Stowed, ${r} restow${r === 1 ? "" : "s"}` : "Stowed clean, nothing moved twice");
    $("stars").textContent = "★★★".slice(0, P.done.stars) + "☆☆☆".slice(P.done.stars);
    ctx.result?.();
  }

  return {
    show, update, render, undo, peek,
    redraw() { if (!L) return; if (scene) frame(); render(); },
    get scene() { return scene; },
    get busy() { return !!(drag || anim); },
    get level() { return L; },
    get plan() { return P; },
    get turns() { return turns; },
    /** For tests: the targets of piece j at its tray turn, by the cell its first cell goes to. */
    targetOf(j, at) { return targetsFor(j, turns[j], -1).find(t => t.idx[0] === at) || null; },
  };
}
