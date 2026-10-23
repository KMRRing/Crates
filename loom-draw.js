// Loom's sheet, on one canvas that fills its box: the target cloth at the top; under it the threading (the shaft each warp
// thread goes through, a dot in its column), and under that your cloth as the draft weaves it, with the lifting plan to
// its right (a square for each shaft lifted on each pick) and each pick's weft yarn beside that. It is a weaver's draft,
// the way one is written down: the columns of the threading are the columns of the cloth, the rows of the lifting plan
// are its rows. loom.js takes the fingers; the rules are loom-engine.js's.
import { YARNS, clothOf, wrong } from "./loom-engine.js";

const hex = i => YARNS[i].hex;
const lerp = (a, b, t) => a + (b - a) * t;
/** A colour lightened (k > 0) or darkened (k < 0) towards white or black. */
function tone(h, k) {
  const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? lerp(v, 255, k) : lerp(v, 0, -k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function createLoom(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "lm-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The draft: the target cloth, the threading, your cloth and its lifting plan");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, L = null, colours = null;
  const view = { job: null, run: null, marks: true, reveal: 1 };
  let raf = 0;

  // The page's own colours, resolved to something a canvas reads (a custom property holds text, and may be a mix).
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.append(probe);
  function palette() {
    const get = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
    colours = { ink: get("--ink"), soft: get("--ink-soft"), rule: get("--rule"), brass: get("--brass"), tile: get("--tile"), sheet: get("--sheet"), bad: get("--lm-bad") };
  }

  // ----- where everything goes -----
  /** Columns and rows of the sheet: widths in thread widths (cw), heights in pick heights (rh), from the job and the box. */
  function layout() {
    const job = view.job;
    if (!job || !W) { L = null; return; }
    const pad = Math.max(6, Math.min(W, H) * .02), gapX = .5, liftX = job.S, chipX = 1.25, gapW = .35;
    const unitsX = job.W + gapX + liftX + gapW + chipX;
    const th = 1.2, gapA = .55, gapB = .95, strip = .5;                       // threading rows are a little taller, to tap
    const unitsY = job.shown + gapA + strip + job.S * th + gapB + job.rows;
    let cw = (W - 2 * pad) / unitsX, rh = (H - 2 * pad) / unitsY;
    // not too far from square, or a thread looks like a brick
    if (cw > rh * 1.45) cw = rh * 1.45; else if (rh > cw * 1.45) rh = cw * 1.45;
    const x0 = (W - unitsX * cw) / 2, y0 = (H - unitsY * rh) / 2;
    const x = { cloth: x0, lift: x0 + (job.W + gapX) * cw, chip: x0 + (job.W + gapX + liftX + gapW) * cw };
    const y = { target: y0, strip: y0 + (job.shown + gapA) * rh };
    y.thread = y.strip + strip * rh;
    y.cloth = y.thread + job.S * th * rh + gapB * rh;
    L = { cw, rh, th: th * rh, x, y, strip: strip * rh, chip: chipX * cw, gapB: gapB * rh };
  }

  // ----- drawing a thread -----
  /** One place on a cloth: the yarn on top, a warp thread (up and down) or a weft one (across), over a dark groove. */
  function cell(x, y, w, h, yarn, upright, tail) {
    const c = hex(yarn);
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.fillRect(x, y, w, h);
    const g = upright ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, tone(c, -.3)); g.addColorStop(.28, tone(c, .12)); g.addColorStop(.55, c); g.addColorStop(1, tone(c, -.32));
    ctx.fillStyle = g;
    if (upright) ctx.fillRect(x + w * .07, y - .5, w * .86, h + 1);
    else ctx.fillRect(x - .5, y + h * .07, w + 1, h * .86);
    // where a thread dips under a crossing one its end darkens
    if (tail) {
      const a = tail;                                                          // which ends meet a thread going the other way
      ctx.fillStyle = "rgba(0,0,0,.3)";
      if (upright) { if (a & 1) ctx.fillRect(x + w * .07, y, w * .86, h * .16); if (a & 2) ctx.fillRect(x + w * .07, y + h * .84, w * .86, h * .16); }
      else { if (a & 1) ctx.fillRect(x, y + h * .07, w * .16, h * .86); if (a & 2) ctx.fillRect(x + w * .84, y + h * .07, w * .16, h * .86); }
    }
  }
  /**
   * A cloth: rows of yarns, drawn from `faces`, where a place is a warp thread's if `up(c, r)` says so. `to` limits how far down
   * it's woven (the finale), in rows and a part of a row.
   */
  function drawCloth(x, y, rows, faces, up, to = rows) {
    const { cw, rh } = L, n = view.job.W;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, n * cw, rows * rh); ctx.clip();
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x, y, n * cw, rows * rh);
    for (let r = 0; r < rows; r++) {
      if (r >= Math.ceil(to)) break;
      const part = Math.min(1, to - r);
      for (let c = 0; c < n; c++) {
        if ((c + 1) / n > part + 1e-9 && part < 1) continue;
        const upv = up(c, r);
        let tail = 0;
        if (upv) { if (r === 0 || !up(c, r - 1)) tail |= 1; if (r === rows - 1 || !up(c, r + 1)) tail |= 2; }
        else { if (c === 0 || up(c - 1, r)) tail |= 1; if (c === n - 1 || up(c + 1, r)) tail |= 2; }
        cell(x + c * cw, y + r * rh, cw, rh, faces[r][c], upv, tail);
      }
    }
    ctx.restore();
  }

  // ----- the whole sheet -----
  function draw() {
    raf = 0;
    if (!L || !view.job) return;
    const { job, run } = view, { cw, rh, x, y } = L;
    if (!colours) palette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const lifted = (p, s) => run.lift[p % job.P][s] === 1;
    const upAt = (c, r) => run.thread[c] >= 0 && lifted(r, run.thread[c]);
    const goalUp = (c, r) => { const d = job.answer; return d.lift[r % job.P][d.thread[c]] === 1; };

    // the target
    drawCloth(x.cloth, y.target, job.shown, job.goal, goalUp);
    ctx.fillStyle = colours.soft; ctx.font = `700 ${Math.max(9, Math.min(13, rh * .62))}px system-ui, sans-serif`; ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.fillText("THE TARGET", x.lift, y.target + 1);
    ctx.font = `500 ${Math.max(9, Math.min(12, rh * .56))}px system-ui, sans-serif`;
    ctx.fillText(`${job.shown} picks of it`, x.lift, y.target + 1 + Math.max(11, rh * .78));
    const bad = wrong(job, run);
    ctx.fillStyle = bad.length ? colours.soft : colours.ink;
    const all = job.rows * job.W;
    ctx.font = `700 ${Math.max(10, Math.min(15, rh * .72))}px system-ui, sans-serif`;
    ctx.textBaseline = "bottom";
    ctx.fillText(run.done ? "Woven" : bad.length ? `${all - bad.length} of ${all} right` : "It matches", x.lift, y.target + job.shown * rh);

    // the warp's colours, over the threading
    for (let c = 0; c < job.W; c++) {
      const col = hex(job.warp[c]);
      const g = ctx.createLinearGradient(x.cloth + c * cw, 0, x.cloth + (c + 1) * cw, 0);
      g.addColorStop(0, tone(col, -.28)); g.addColorStop(.35, tone(col, .12)); g.addColorStop(1, tone(col, -.3));
      ctx.fillStyle = g;
      ctx.fillRect(x.cloth + c * cw + cw * .08, y.strip, cw * .84, L.strip);
    }

    // the threading: a dot where a thread goes through a shaft; shaft 1 at the foot, as a draft is written
    ctx.lineWidth = 1; ctx.strokeStyle = colours.rule;
    for (let s = 0; s < job.S; s++) {
      const ry = y.thread + (job.S - 1 - s) * L.th;
      for (let c = 0; c < job.W; c++) {
        ctx.strokeRect(x.cloth + c * cw + .5, ry + .5, cw - 1, L.th - 1);
        if (run.thread[c] === s) {
          ctx.fillStyle = colours.ink;
          ctx.beginPath(); ctx.arc(x.cloth + (c + .5) * cw, ry + L.th / 2, Math.min(cw, L.th) * .3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = colours.soft; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.max(10, Math.min(14, L.th * .55))}px system-ui, sans-serif`;
      ctx.fillText(`shaft ${s + 1}`, x.lift, ry + L.th / 2);
    }

    // the lifting plan's columns are the shafts, numbered, and the weft column's head says what it is
    ctx.fillStyle = colours.soft; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(9, Math.min(13, L.gapB * .55))}px system-ui, sans-serif`;
    const headY = y.cloth - L.gapB * .5;
    for (let s = 0; s < job.S; s++) ctx.fillText(String(s + 1), x.lift + (s + .5) * cw, headY);
    ctx.fillText("yarn", x.chip + L.chip / 2, headY);

    // your cloth, woven as the draft says
    const mine = clothOf(job, run), reveal = view.reveal;
    drawCloth(x.cloth, y.cloth, job.rows, mine, upAt, reveal >= 1 ? job.rows : reveal * job.rows);
    if (view.marks && reveal >= 1) {
      ctx.lineWidth = Math.max(1.5, Math.min(cw, rh) * .12);
      for (const [c, r] of bad) {
        const cx = x.cloth + (c + .5) * cw, cy = y.cloth + (r + .5) * rh, k = Math.min(cw, rh) * .2;
        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth += 2;
        ctx.beginPath(); ctx.moveTo(cx - k, cy - k); ctx.lineTo(cx + k, cy + k); ctx.moveTo(cx + k, cy - k); ctx.lineTo(cx - k, cy + k); ctx.stroke();
        ctx.lineWidth -= 2; ctx.strokeStyle = colours.bad;
        ctx.beginPath(); ctx.moveTo(cx - k, cy - k); ctx.lineTo(cx + k, cy + k); ctx.moveTo(cx + k, cy - k); ctx.lineTo(cx - k, cy + k); ctx.stroke();
      }
    }

    // the lifting plan and the yarn of each pick, in the rows of the cloth; the first repeat to set, the rest as it goes on
    for (let r = 0; r < job.rows; r++) {
      const p = r % job.P, ghost = r >= job.P, ry = y.cloth + r * rh;
      ctx.globalAlpha = ghost ? .38 : 1;
      for (let s = 0; s < job.S; s++) {
        const cx = x.lift + s * cw;
        ctx.strokeStyle = colours.rule; ctx.lineWidth = 1;
        ctx.strokeRect(cx + .5, ry + .5, cw - 1, rh - 1);
        if (run.lift[p][s]) { ctx.fillStyle = colours.brass; ctx.fillRect(cx + cw * .14, ry + rh * .14, cw * .72, rh * .72); }
      }
      const cx = x.chip + L.chip * .12, cwid = L.chip * .76;
      ctx.fillStyle = hex(job.weftYarns[run.weft[p]]);
      ctx.fillRect(cx, ry + rh * .16, cwid, rh * .68);
      ctx.strokeStyle = colours.ink; ctx.lineWidth = 1; ctx.strokeRect(cx + .5, ry + rh * .16 + .5, cwid - 1, rh * .68 - 1);
      ctx.globalAlpha = 1;
    }
    // where the repeat ends
    if (job.rows > job.P) {
      ctx.strokeStyle = colours.brass; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      const ly = y.cloth + job.P * rh;
      ctx.beginPath(); ctx.moveTo(x.cloth, ly); ctx.lineTo(x.chip + L.chip, ly); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (Math.round(r.width) === W && Math.round(r.height) === H && canvas.width === Math.ceil(W * dpr)) return false;
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    layout();
    return true;
  }
  new ResizeObserver(() => { if (resize()) schedule(); }).observe(host);
  // a theme or a day turning to night changes what the colours resolve to
  new MutationObserver(() => { colours = null; schedule(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { colours = null; schedule(); });

  return {
    canvas,
    set(job, run) { view.job = job; view.run = run; view.reveal = 1; resize(); layout(); schedule(); },
    refresh() { schedule(); },
    marks(on) { view.marks = on; schedule(); },
    /** How much of the cloth is woven, 0 to 1 (the finale); anything else draws it whole. */
    reveal(t) { view.reveal = t; schedule(); },
    /** The middle of a place on the sheet, in client pixels (for a test to tap it): a thread's shaft, a pick's shaft or a pick's yarn. */
    where(kind, a, b) {
      if (!L || !view.job) return null;
      const r = canvas.getBoundingClientRect(), { job } = view, { cw, rh, x, y } = L;
      if (kind === "thread") return { x: r.left + x.cloth + (a + .5) * cw, y: r.top + y.thread + (job.S - 1 - b + .5) * L.th };
      if (kind === "lift") return { x: r.left + x.lift + (b + .5) * cw, y: r.top + y.cloth + (a + .5) * rh };
      return { x: r.left + x.chip + L.chip / 2, y: r.top + y.cloth + (a + .5) * rh };
    },
    /** What a touch is on: a thread's shaft, a pick's shaft, a pick's yarn; or null. */
    hit(e) {
      if (!L || !view.job) return null;
      const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, { job } = view, { cw, rh, x, y } = L;
      // a little beyond the edge of a cell still counts: fingers are wider than threads
      const slop = Math.min(cw, rh) * .15;
      if (py >= y.thread - slop && py < y.thread + job.S * L.th + slop && px >= x.cloth - slop && px < x.cloth + job.W * cw + slop) {
        const c = Math.min(job.W - 1, Math.max(0, Math.floor((px - x.cloth) / cw))), row = Math.min(job.S - 1, Math.max(0, Math.floor((py - y.thread) / L.th)));
        return { kind: "thread", c, s: job.S - 1 - row };
      }
      if (py >= y.cloth && py < y.cloth + job.rows * rh) {
        const p = Math.floor((py - y.cloth) / rh) % job.P;
        if (px >= x.lift - slop && px < x.lift + job.S * cw + slop) return { kind: "lift", p, s: Math.min(job.S - 1, Math.max(0, Math.floor((px - x.lift) / cw))) };
        if (px >= x.chip - slop && px < x.chip + L.chip + slop) return { kind: "weft", p };
      }
      return null;
    },
  };
}
