// The Almanac's star chart: the knowledge base as a night sky you turn with a finger. Every thing in kb/ is a star, coloured by
// its subject (Settings' subjects), in regions by subject; faint lines join near neighbours that are linked; the things
// you have learned (the pile, pile.js) burn brighter the better you know them, and what you missed and must go back to
// twinkles. almanac.js loads this only when the sky is opened, so the list view carries none of it.
//
// What is where: almanac-sky-data.js builds the stars from kb/, -place.js their places (the stored layout), -camera.js the
// orbiting camera (pure), -gl.js the drawing, -learn.js the glow from the pile; this file is the page's side of it:
// touch, labels, the panel of subjects, the card of the chosen star, search, and what is kept.
//
// Kept under `lexicon:` (the game's id stays, the page is Almanac), so a partner watching sees the same sky:
//   lexicon:sky      { open, yaw, pitch, dist, at, off: [subjects switched off], sel: the chosen star's id }
//   lexicon:sky:lit  the glow, { id: percent } (negative: twinkling): the watcher's own pile is not yours
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { SUBJECTS } from "./topics.js";
import { subjectsOn } from "./topics-on.js";
import { SUBJECT_IDS, COLOURS } from "./almanac-sky-subjects.js";
import { LAYOUT } from "./almanac-sky-layout.js";
import { buildSky, regionMiddles, MAX_LENGTH } from "./almanac-sky-data.js";
import { jitter } from "./almanac-sky-place.js";
import * as C from "./almanac-sky-camera.js";
import { createSkyGL, canDrawSky } from "./almanac-sky-gl.js";
import { glowOf, encodeGlow, decodeGlow, summary } from "./almanac-sky-learn.js";
import * as pile from "./pile.js";
import { onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { scale, sideways } from "./wide.js";
import { waitMark } from "./loading.js";

const KEY = "lexicon:sky", LIT_KEY = "lexicon:sky:lit";
const DUST = 520, DUST_AT = 430;                    // faint stars far behind the chart, for the feel of a night sky: they belong to no thing and cannot be chosen
const HOME = { yaw: 0.6, pitch: 0.42, dist: 280, at: [0, 0, 0] };      // dist is only a start: the view that holds the whole sky depends on the screen's shape
const SUBJECT_NAME = Object.fromEntries(SUBJECTS.map(s => [s.id, s.label]));
const RGB = SUBJECT_IDS.map(id => { const h = COLOURS[id]; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); });
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const night = () => { const m = document.documentElement.dataset.mode; return m ? m === "night" : matchMedia("(prefers-color-scheme: dark)").matches; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The sky in the elements of `R` ({ section, stage, gl, ink, hint, subjectsBtn, homeBtn, panel, card }); `api` is almanac.js's
 * own: search(text) → things, label(thing), kindsOf(thing), open(id) to open an entry, and lookUp(id).
 */
export function createSky(R, api) {
  const inkCtx = R.ink.getContext("2d");
  const saved = read(KEY) || {};
  let fresh = !Number.isFinite(saved.dist);
  const S = {
    open: false,
    cam: C.cleanCamera(saved, HOME),
    off: new Set((Array.isArray(saved.off) ? saved.off : []).filter(id => SUBJECT_IDS.includes(id))),
    sel: typeof saved.sel === "string" ? saved.sel : null,
  };
  let sky = null, glx = null, glow = new Map(), size = { w: 1, h: 1, dpr: 1 };
  let drawn = null, col = null, misc = null, on = null, lit = null, tw = null, twinkles = false, order = [], middles = [], names = [];
  let raf = 0, timer = 0, last = 0, paused = false, shown = false, flightNow = null, vel = { x: 0, y: 0 }, dragging = false, saveTimer = 0;
  let panelMode = "", legendOpen = false, hits = [], sel = -1, labelBox = [];

  // ---------- what is kept ----------
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = 0;
    const c = S.cam, r = (v, k) => Math.round(v * k) / k;
    write(KEY, { open: S.open, yaw: r(c.yaw, 1000), pitch: r(c.pitch, 1000), dist: r(c.dist, 10), at: c.at.map(v => r(v, 10)), off: [...S.off], sel: S.sel });
  }
  // a moment after the last change: a watcher redraws on every change of these keys, so they are not written on every frame
  const save = () => { if (IN_FRAME) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); };
  addEventListener("pagehide", () => { if (saveTimer) saveNow(); });

  // ---------- building ----------
  async function ensure() {
    if (sky) return true;
    if (!canDrawSky()) {
      R.msg.replaceChildren(el("b", null, "This device can't draw the sky."), el("span", null, "It needs WebGL, which isn't switched on here. The list works as it always did."), R.listBtn);
      R.msg.hidden = false;
      return false;
    }
    R.msg.replaceChildren(waitMark(), el("span", null, "Laying out the stars…"));
    R.msg.hidden = false;
    await new Promise(done => requestAnimationFrame(() => setTimeout(done, 0)));      // let the words be drawn before the sums block the page
    try {
      sky = buildSky(ENTITIES, LINKS, LAYOUT);
      glx = createSkyGL(R.gl);
    } catch (e) {
      console.error(e); sky = null;
      R.msg.replaceChildren(el("b", null, "The sky wouldn't draw."), el("span", null, "WebGL failed to start here. The list works as it always did."), R.listBtn);
      return false;
    }
    R.msg.hidden = true;
    const n = sky.n;
    names = sky.stars.map(i => api.shortName(ENTITIES[i]));
    const all = n + DUST;
    col = new Float32Array(3 * all); misc = new Float32Array(4 * all); on = new Uint8Array(n); lit = new Float32Array(n); tw = new Uint8Array(n);
    drawn = new Float32Array(3 * all); drawn.set(sky.xyz);
    for (let d = 0; d < DUST; d++) {                                  // placed by a hash, so the same on every device
      const z = jitter("dust", 3 * d) * 2 - 1, a = jitter("dust", 3 * d + 1) * 2 * Math.PI, q = Math.sqrt(1 - z * z), r = n + d, warm = jitter("dust", 3 * d + 2);
      drawn[3 * r] = q * Math.cos(a) * DUST_AT; drawn[3 * r + 1] = z * DUST_AT; drawn[3 * r + 2] = q * Math.sin(a) * DUST_AT;
      col[3 * r] = 0.78 + 0.22 * warm; col[3 * r + 1] = 0.84; col[3 * r + 2] = 1 - 0.2 * warm;
      misc[4 * r] = 1.5 + 2.4 * jitter("dust", 3 * d + 7) ** 3; misc[4 * r + 1] = 0; misc[4 * r + 2] = 0; misc[4 * r + 3] = 1;
    }
    middles = regionMiddles(sky, SUBJECT_IDS.length);
    glx.setLines(new Float32Array(0));
    R.gl.addEventListener("webglcontextlost", e => { e.preventDefault(); });
    R.gl.addEventListener("webglcontextrestored", () => { glx.restore(); fit(); paintStars(); drawFocus(); invalidate(); });
    sel = S.sel && sky.rowOf.has(S.sel) ? sky.rowOf.get(S.sel) : -1;
    if (sel < 0) S.sel = null;
    loadGlow();
    buildLegend();
    return true;
  }
  function loadGlow() {
    const known = id => sky.rowOf.has(id);
    if (IN_FRAME) glow = decodeGlow(read(LIT_KEY));
    else {
      let items = [];
      try { items = pile.all(); } catch { /* no pile */ }
      glow = glowOf(items, { known });
      const enc = encodeGlow(glow), was = read(LIT_KEY);
      if (JSON.stringify(enc) !== JSON.stringify(was)) write(LIT_KEY, enc);
    }
    lit.fill(0); tw.fill(0);
    for (const [id, g] of glow) {
      const r = sky.rowOf.get(id);
      if (r == null) continue;
      if (g.lit > lit[r]) lit[r] = g.lit;
      if (g.twinkle) tw[r] = 1;
    }
    twinkles = tw.includes(1);
    // the best-connected first, but a burning star before an unlit one of any size: the labels favour what you know
    order = Array.from({ length: sky.n }, (_, r) => r).sort((a, b) => (lit[b] > 0) - (lit[a] > 0) || sky.degree[b] - sky.degree[a] || a - b);
    updateHint();
  }

  // ---------- painting the buffers ----------
  const offIx = () => new Set([...S.off].map(id => SUBJECT_IDS.indexOf(id)));
  function paintStars() {
    if (!sky) return;
    const off = offIx();
    for (let r = 0; r < sky.n; r++) {
      const subs = sky.subjects[r], k = subs.findIndex(s => !off.has(s)), c = RGB[k >= 0 ? subs[k] : subs[0]];
      on[r] = k >= 0 ? 1 : 0;
      col[3 * r] = c[0]; col[3 * r + 1] = c[1]; col[3 * r + 2] = c[2];
      misc[4 * r] = sky.size[r]; misc[4 * r + 1] = lit[r]; misc[4 * r + 2] = tw[r] && !reduced() ? 1 : 0; misc[4 * r + 3] = on[r];
    }
    glx.setStars({ xyz: drawn, col, misc });
    const L = sky.lines, out = new Float32Array(7 * L.length);
    for (let k = 0; k < L.length; k += 2) {
      const a = L[k], b = L[k + 1];
      const len = Math.hypot(sky.xyz[3 * a] - sky.xyz[3 * b], sky.xyz[3 * a + 1] - sky.xyz[3 * b + 1], sky.xyz[3 * a + 2] - sky.xyz[3 * b + 2]);
      const far = 1 - 0.65 * Math.min(1, len / MAX_LENGTH);                      // the longer a line, the fainter
      const alpha = on[a] && on[b] ? (lit[a] > 0 && lit[b] > 0 ? 0.34 : 0.11) * far : 0;
      for (const [j, r] of [[0, a], [1, b]]) {
        const o = 7 * (k + j);
        out[o] = sky.xyz[3 * r]; out[o + 1] = sky.xyz[3 * r + 1]; out[o + 2] = sky.xyz[3 * r + 2];
        out[o + 3] = col[3 * r]; out[o + 4] = col[3 * r + 1]; out[o + 5] = col[3 * r + 2]; out[o + 6] = alpha;
      }
    }
    glx.setLines(out);
    drawFocus();
  }
  /** The chosen star's own links, bright over the faint chart. */
  function drawFocus() {
    if (!sky) return;
    if (sel < 0) { glx.setFocus(new Float32Array(0)); return; }
    const to = sky.around[sel].filter(r => on[r]), out = new Float32Array(14 * to.length);
    to.forEach((r, k) => {
      const o = 14 * k;
      out.set([sky.xyz[3 * sel], sky.xyz[3 * sel + 1], sky.xyz[3 * sel + 2], 1, 0.9, 0.62, 0.5, sky.xyz[3 * r], sky.xyz[3 * r + 1], sky.xyz[3 * r + 2], col[3 * r], col[3 * r + 1], col[3 * r + 2], 0.3], o);
    });
    glx.setFocus(out);
  }

  // ---------- the camera, the loop ----------
  const homeCam = () => ({ ...HOME, dist: C.fitDistance(size.w / size.h) });
  function fit() {
    const w = R.stage.clientWidth, h = R.stage.clientHeight;
    if (!w || !h) return;
    const dpr = glx.resize(w, h);
    R.ink.width = Math.round(w * dpr); R.ink.height = Math.round(h * dpr);
    size = { w, h, dpr };
  }
  function invalidate() {
    if (!shown || paused || !sky || raf || timer || document.hidden) return;
    raf = requestAnimationFrame(frame);
  }
  function frame(t) {
    raf = 0;
    const real = last ? Math.min(250, t - last) : 16, dt = Math.min(64, real);        // a flight keeps to the clock however slow the frames; a flick's friction does not need to
    last = t;
    let moving = false;
    if (flightNow) {
      const r = C.step(flightNow, real);
      S.cam = r.cam; moving = !r.done; if (r.done) flightNow = null;
      save();
    }
    if (!dragging && (Math.abs(vel.x) > 0.002 || Math.abs(vel.y) > 0.002)) {             // a flick keeps turning, slowing
      S.cam = C.orbit(S.cam, vel.x * dt, vel.y * dt, size.h);
      const f = Math.exp(-dt / 320); vel.x *= f; vel.y *= f; moving = true; save();
    }
    draw(t);
    if (moving) raf = requestAnimationFrame(frame);
    else if (twinkles && !reduced()) { last = 0; timer = setTimeout(() => { timer = 0; invalidate(); }, 66); }   // twinkling alone is drawn about fifteen times a second
    else last = 0;
  }
  function draw(t = performance.now()) {
    if (!sky || glx.lost() || !size.w) return;
    const vp = C.viewProjection(S.cam, size.w / size.h), dark = night();
    glx.draw(vp, { dist: S.cam.dist, time: t / 1000, dim: dark ? 0.62 : 0.7, boost: dark ? 1.6 : 2.2 });
    drawInk(vp);
  }

  // ---------- the labels over the sky ----------
  const o3 = [0, 0, 0];
  function drawInk(vp) {
    const { w, h, dpr } = size, k = scale(), g = inkCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.textBaseline = "middle";
    const family = getComputedStyle(document.body).fontFamily;
    const d = S.cam.dist, off = offIx();
    // far out, the regions are named, in wide capitals, the biggest first and none over another; they fade as the stars
    // come near enough to name themselves
    // no label under the buttons in the corner, nor under the line at the foot
    const tools = R.homeBtn.parentElement;
    labelBox = [[w - tools.offsetWidth - 10 * k, 0, tools.offsetWidth + 10 * k, tools.offsetHeight + 12 * k]];
    if (!R.hint.hidden && R.hint.textContent) labelBox.push([0, h - R.hint.offsetHeight, w, R.hint.offsetHeight]);
    const far = clamp((d - 70) / 80, 0, 1);
    if (far > 0.02) {
      g.font = `700 ${11 * k}px ${family}`; g.textAlign = "center";
      try { g.letterSpacing = `${2 * k}px`; } catch { /* an older browser: no spacing */ }
      const seen = [];
      middles.forEach((m, s) => {
        if (!m || off.has(s)) return;
        const depth = C.projectInto(o3, vp, m[0], m[1], m[2], w, h);
        if (depth < C.NEAR) return;
        seen.push({ s, x: o3[0], y: o3[1], near: depth < d + 25 ? 1 : 0.4, n: m[3] });        // the far side of the sky is fainter
      });
      seen.sort((a, b) => b.n - a.n);
      for (const q of seen) {
        const name = SUBJECT_NAME[SUBJECT_IDS[q.s]].toUpperCase(), bw = g.measureText(name).width + 8 * k, bh = 15 * k, bx = q.x - bw / 2, by = q.y - bh / 2;
        if (bx < 2 || bx + bw > w - 2 || by < 2 || by + bh > h - 2) continue;
        if (labelBox.some(b => bx < b[0] + b[2] && bx + bw > b[0] && by < b[1] + b[3] && by + bh > b[1])) continue;
        labelBox.push([bx, by, bw, bh]);
        g.fillStyle = `rgba(${RGB[q.s].map(v => Math.round(120 + v * 135)).join(",")},${0.92 * far * q.near})`;
        g.strokeStyle = `rgba(0,0,0,${0.6 * far * q.near})`; g.lineWidth = 3; g.lineJoin = "round";
        g.strokeText(name, q.x, q.y); g.fillText(name, q.x, q.y);
      }
      try { g.letterSpacing = "0px"; } catch { /* as above */ }
    }
    // nearer in, the best-known stars by name, none over another
    const budget = d > 150 ? 0 : d > 90 ? 9 : d > 45 ? 18 : 32;
    g.font = `600 ${12 * k}px ${family}`; g.textAlign = "left";
    const putLabel = (r, bold) => {
      const depth = C.projectInto(o3, vp, sky.xyz[3 * r], sky.xyz[3 * r + 1], sky.xyz[3 * r + 2], w, h);
      if (depth < C.NEAR) return false;
      const x = o3[0], y = o3[1];
      if (x < 4 || x > w - 4 || y < 4 || y > h - 4) return false;
      const text = names[r], bw = g.measureText(text).width + 10 * k, bh = 15 * k;
      const rx = x + 6 * k + (sky.size[r] * 0.5), ry = y - bh / 2;
      const right = rx + bw > w - 2, bx = right ? x - 6 * k - sky.size[r] * 0.5 - bw : rx;
      if (!bold && labelBox.some(b => bx < b[0] + b[2] && bx + bw > b[0] && ry < b[1] + b[3] && ry + bh > b[1])) return false;
      labelBox.push([bx, ry, bw, bh]);
      g.fillStyle = bold ? "#fff" : "rgba(255,255,255,0.82)";
      g.strokeStyle = "rgba(0,0,0,0.65)"; g.lineWidth = 3; g.lineJoin = "round";
      const tx = bx + 5 * k;
      g.strokeText(text, tx, y); g.fillText(text, tx, y);
      return true;
    };
    if (sel >= 0 && on[sel]) putLabel(sel, true);
    let placed = 0;
    for (let i = 0; i < order.length && placed < budget; i++) {
      const r = order[i];
      if (!on[r] || r === sel) continue;
      if (putLabel(r, false)) placed++;
    }
    // the ring round the chosen star
    if (sel >= 0 && on[sel]) {
      const depth = C.projectInto(o3, vp, sky.xyz[3 * sel], sky.xyz[3 * sel + 1], sky.xyz[3 * sel + 2], w, h);
      if (depth > C.NEAR) {
        g.strokeStyle = "rgba(255,226,150,0.95)"; g.lineWidth = 1.6;
        g.beginPath(); g.arc(o3[0], o3[1], (9 + sky.size[sel] * 1.2) * k, 0, 2 * Math.PI); g.stroke();
      }
    }
  }

  // ---------- choosing a star ----------
  function subjectLine(r) {
    return sky.subjects[r].map(s => SUBJECT_NAME[SUBJECT_IDS[s]]);
  }
  function glowLine(r) {
    if (!(lit[r] > 0)) return "Not met in a game yet: dim";
    if (lit[r] >= 1) return "Learned: burning bright";
    return tw[r] ? "Missed, and due again: twinkling" : "Being learned: it burns brighter each time you get it right";
  }
  function showCard() {
    const card = R.card;
    if (sel < 0 || !sky) { card.hidden = true; syncHint(); return; }
    const e = ENTITIES[sky.stars[sel]];
    card.replaceChildren();
    const head = el("div", "sk-card-head"), title = el("h3", null, api.label(e)), close = el("button", "icon-btn sk-x", "×");
    close.type = "button"; close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => choose(-1));
    head.append(title, close);
    const meta = el("p", "sk-card-meta"), links = sky.around[sel].length;
    sky.subjects[sel].forEach((s, i) => {
      const dot = el("i", "sk-dot"); dot.style.background = COLOURS[SUBJECT_IDS[s]];
      meta.append(dot, document.createTextNode(`${SUBJECT_NAME[SUBJECT_IDS[s]]}${i < sky.subjects[sel].length - 1 ? ", " : ""}`));
    });
    const kinds = api.kindsOf(e).slice(0, 2).join(" · ");
    meta.append(document.createTextNode(` · ${[kinds, `${links} link${links === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}`));
    const foot = el("div", "sk-card-foot"), open = el("button", "btn primary sk-open", "Open entry");
    open.type = "button";
    open.addEventListener("click", () => api.open(e.id));
    foot.append(el("p", "sk-card-meta soft", glowLine(sel)), open);
    card.append(head, meta, foot);
    card.hidden = false;
    syncHint();
  }
  /** Chooses a star (or none: -1); `fly` moves the camera to it, to within `near` units. */
  function choose(r, { fly = false, near = 60 } = {}) {
    sel = r; S.sel = r >= 0 ? ENTITIES[sky.stars[r]].id : null;
    if (r >= 0) {
      const subs = sky.subjects[r], off = offIx();
      if (subs.every(s => off.has(s))) { S.off.delete(SUBJECT_IDS[subs[0]]); paintStars(); buildLegend(); }   // a star you ask for is not left switched off
      if (fly) goTo(aimAt(r, Math.min(S.cam.dist, near)));
    }
    drawFocus(); showCard(); updatePanel(); save(); invalidate();
  }
  /** A camera looking at star r from `dist` away, with the star a little above the middle where the card (over the sky's foot) would hide it. */
  function aimAt(r, dist) {
    const at = [...sky.xyz.slice(3 * r, 3 * r + 3)];
    if (!sideways()) {
      const m = C.viewMatrix(S.cam), up = [m[1], m[5], m[9]];
      const shift = 70 * scale() * 2 * Math.tan(C.FOV / 2) * dist / Math.max(1, size.h);      // about half the card's height, in sky units at that distance
      for (let i = 0; i < 3; i++) at[i] -= up[i] * shift;
    }
    return { ...S.cam, at, dist };
  }
  function goTo(cam) {
    const to = C.cleanCamera(cam, S.cam);
    if (reduced()) { S.cam = to; flightNow = null; } else flightNow = C.flight(S.cam, to, 800);
    vel.x = vel.y = 0; save(); invalidate();
  }

  // ---------- the panel: subjects, and what a search found ----------
  function buildLegend() {
    if (!sky) return;
    const count = new Array(SUBJECT_IDS.length).fill(0);
    for (let r = 0; r < sky.n; r++) count[sky.subjects[r][0]]++;
    const box = R.legend;
    box.replaceChildren();
    const row = el("div", "sk-legend-actions");
    const mk = (text, fn) => { const b = el("button", "link", text); b.type = "button"; b.addEventListener("click", fn); return b; };
    row.append(
      mk("All", () => { S.off.clear(); changed(); }),
      mk("None", () => { S.off = new Set(SUBJECT_IDS); changed(); }),
      mk("My topics", () => { const mine = subjectsOn(); S.off = new Set(SUBJECT_IDS.filter(id => !mine[id])); changed(); }));
    box.append(row);
    const list = el("div", "sk-legend-list");
    SUBJECT_IDS.forEach((id, s) => {
      if (!count[s]) return;
      const b = el("button", "sk-sub"), dot = el("i", "sk-dot");
      dot.style.background = COLOURS[id];
      b.type = "button"; b.setAttribute("aria-pressed", String(!S.off.has(id)));
      b.append(dot, el("span", null, SUBJECT_NAME[id]), el("small", null, count[s].toLocaleString("en-GB")));
      b.addEventListener("click", () => { if (S.off.has(id)) S.off.delete(id); else S.off.add(id); changed(); });
      list.append(b);
    });
    box.append(list);
    function changed() {
      if (sel >= 0 && sky.subjects[sel].every(s => S.off.has(SUBJECT_IDS[s]))) { sel = -1; S.sel = null; showCard(); }
      paintStars(); buildLegend(); updateHint(); save(); invalidate();
    }
  }
  function updatePanel() {
    const side = sideways(), searching = hits.length > 0 || R.query().trim() !== "";
    panelMode = searching ? "hits" : side || legendOpen ? "legend" : "";
    R.panel.hidden = !panelMode || !shown;
    R.panel.dataset.mode = panelMode;
    R.hitsBox.hidden = panelMode !== "hits";
    R.legend.hidden = panelMode !== "legend";
    R.subjectsBtn.setAttribute("aria-expanded", String(panelMode === "legend"));
    if (panelMode === "legend" && !side) R.card.hidden = true; else showCard();
    syncHint();
  }
  /** The line under the sky gives way to the card or the subjects where they cover it (held sideways they stand beside it). */
  function syncHint() { R.hint.hidden = !sideways() && (!R.card.hidden || panelMode === "legend"); }
  function updateHint() {
    if (!sky) return;
    const s = summary(glow);
    R.hint.textContent = !s.lit
      ? "Stars light up as you learn: miss something in a game, get it right later, and its star burns brighter the longer you keep it."
      : `${s.lit.toLocaleString("en-GB")} burning${s.learned ? `, ${s.learned.toLocaleString("en-GB")} learned` : ""}${s.twinkling ? `, ${s.twinkling.toLocaleString("en-GB")} twinkling to go back to` : ""}.`;
    if (S.off.size === SUBJECT_IDS.length) R.hint.textContent = "Every subject is switched off: open Subjects to bring some back.";
  }
  /** What the search box finds, as stars you can fly to (the Almanac's own search, so the same things in the same order). */
  function showHits(text) {
    hits = [];
    R.hitsBox.replaceChildren();
    if (sky && text.trim()) {
      for (const e of api.search(text)) {
        const r = sky.rowOf.get(e.id);
        if (r == null) continue;
        hits.push(r);
        if (hits.length >= 8) break;
      }
      if (!hits.length) R.hitsBox.append(el("p", "lx-lead", "Nothing by that name."));
      for (const r of hits) {
        const e = ENTITIES[sky.stars[r]], b = el("button", "lx-hit"), dot = el("i", "sk-dot");
        dot.style.background = COLOURS[SUBJECT_IDS[sky.subjects[r][0]]];
        b.type = "button";
        const name = el("b", null, api.label(e)); name.prepend(dot);
        b.append(name, el("small", null, api.kindsOf(e).slice(0, 2).join(" · ")));
        b.addEventListener("click", () => { hits = []; R.hitsBox.replaceChildren(); choose(r, { fly: true, near: 22 }); R.clearQuery(); updatePanel(); });
        R.hitsBox.append(b);
      }
    }
    updatePanel();
  }

  // ---------- touch, mouse, keys ----------
  const ptrs = new Map();
  let tapAt = null, pinch = null, lastMove = 0;
  const local = e => { const b = R.ink.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  R.ink.addEventListener("pointerdown", e => {
    if (!sky || IN_FRAME) return;
    R.ink.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, local(e));
    flightNow = null; vel.x = vel.y = 0;
    if (ptrs.size === 1) { tapAt = { p: local(e), t: performance.now(), moved: 0 }; dragging = true; lastMove = performance.now(); }
    else { tapAt = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
    invalidate();
  });
  R.ink.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    const was = ptrs.get(e.pointerId), now = local(e);
    ptrs.set(e.pointerId, now);
    if (ptrs.size >= 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (d > 4 && pinch.d > 4) S.cam = C.zoom(S.cam, pinch.d / d);
      S.cam = C.pan(S.cam, m[0] - pinch.m[0], m[1] - pinch.m[1], size.h);
      pinch = { d, m };
    } else if (ptrs.size === 1) {
      const dx = now[0] - was[0], dy = now[1] - was[1], t = performance.now(), dt = Math.max(1, t - lastMove);
      if (tapAt) { tapAt.moved = Math.max(tapAt.moved, Math.hypot(now[0] - tapAt.p[0], now[1] - tapAt.p[1])); }
      if (!tapAt || tapAt.moved > 6) {
        S.cam = C.orbit(S.cam, dx, dy, size.h);
        vel.x = vel.x * 0.6 + (dx / dt) * 0.4; vel.y = vel.y * 0.6 + (dy / dt) * 0.4;     // pixels a millisecond, for the flick
      }
      lastMove = t;
    }
    save(); invalidate();
  });
  const release = e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) {
      dragging = false;
      if (tapAt && tapAt.moved <= 6 && performance.now() - tapAt.t < 500 && e.type === "pointerup") {
        const vp = C.viewProjection(S.cam, size.w / size.h);
        const r = C.pick(vp, sky.xyz, size.w, size.h, p[0], p[1], 22 * scale(), sky.weight, i => on[i] === 1);
        choose(r, { fly: r >= 0, near: 60 });
        vel.x = vel.y = 0;
      } else if (reduced() || performance.now() - lastMove > 90) vel.x = vel.y = 0;       // held still before letting go: no flick
      tapAt = null;
    }
    invalidate();
  };
  R.ink.addEventListener("pointerup", release);
  R.ink.addEventListener("pointercancel", release);
  R.ink.addEventListener("wheel", e => {
    if (!sky || IN_FRAME) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1;
    S.cam = C.zoom(S.cam, Math.exp(clamp(e.deltaY * k, -240, 240) * 0.0014));
    save(); invalidate();
  }, { passive: false });
  R.stage.addEventListener("keydown", e => {
    if (!sky || IN_FRAME) return;
    const step = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[e.key];
    if (step) S.cam = C.orbit(S.cam, step[0], step[1], size.h);
    else if (e.key === "+" || e.key === "=") S.cam = C.zoom(S.cam, 0.8);
    else if (e.key === "-" || e.key === "_") S.cam = C.zoom(S.cam, 1.25);
    else if (e.key === "Escape") choose(-1);
    else return;
    e.preventDefault(); save(); invalidate();
  });
  R.homeBtn.addEventListener("click", () => { goTo(homeCam()); });
  R.subjectsBtn.addEventListener("click", () => { legendOpen = !legendOpen; updatePanel(); });

  // ---------- coming and going ----------
  new ResizeObserver(() => { if (glx && shown) { fit(); invalidate(); } }).observe(R.stage);
  matchMedia("(orientation: landscape)").addEventListener?.("change", () => updatePanel());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) invalidate(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => invalidate());
  new MutationObserver(() => invalidate()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-theme"] });
  onPause(() => { paused = true; cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; last = 0; }, () => { paused = false; invalidate(); });

  return {
    /** Opens the sky (from the list or an entry). */
    async show() {
      shown = true; S.open = true; save();
      R.section.hidden = false;
      const ok = await ensure();
      if (!ok || !shown) return;
      fit();
      if (fresh) { fresh = false; S.cam = homeCam(); }                   // a first visit starts with the whole sky in view, whatever the screen's shape
      paintStars(); showCard(); showHits(R.query()); invalidate();
      R.stage.focus({ preventScroll: true });
    },
    /** Leaves it, to the list or an entry. */
    hide() {
      shown = false; S.open = false; cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; last = 0;
      R.section.hidden = true; save();
    },
    get open() { return shown; },
    /** What was kept says the sky was open (a watching frame follows it). */
    wasOpen: () => !!saved.open,
    /** The search box changed: show what it found as stars to fly to. */
    typed: showHits,
    /** Enter in the search box: fly to the best match. */
    submit(text) {
      showHits(text);
      if (hits.length) { const r = hits[0]; hits = []; R.hitsBox.replaceChildren(); choose(r, { fly: true, near: 22 }); R.clearQuery(); updatePanel(); }
    },
    /** Flies to a thing by its id, if it is a star. */
    flyTo(id) { if (sky && sky.rowOf.has(id)) choose(sky.rowOf.get(id), { fly: true, near: 22 }); },
    /** Where the pile stands now (call when the sky is opened again after games were played). */
    refreshGlow() { if (sky) { loadGlow(); paintStars(); showCard(); invalidate(); } },
    dispose() { glx?.destroy(); },
  };
}
