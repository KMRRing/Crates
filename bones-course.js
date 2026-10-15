// Bones' course (Learn, in the header): dominoes taught from nothing, on the course's sheet (course.js) with a stage of
// its own, the tiles drawn as the table draws them (bones-layout.js). The game: the tiles, laying them, doubles,
// knocking, and the three games, Partnership, Gaple and Fives and Threes, then a first game.
//
// A step's stage, as a lesson writes it:
//   rows: [{ label, tiles: "6-4 5-5" | text }]   examples, a row of tiles or a line of words
//   line: "1-3 3-6 [6-6] 6-2"                     the line on the table, left to right, the first tile in brackets
//   hand: "6-4 2-3 0-5"                           your tiles
//   total: true                                   the ends' total shown, as Fives and Threes counts it
//   game: "fives"                                 the game the line is played in (Partnership unless said)
// and the exercises:
//   fits: true, count                            tap every tile of your hand that fits an end (count: how many)
//   answer: "6-1@6", accept, wrong, why           lay a tile: the play Hint lays, the others as good, words for wrong ones
//   goal: "most", pts                             lay the tile that scores most (Fives and Threes; pts: what it scores)
//   quiz: [options], answer, why                  choose
// A play is written as its tile and the end number it's laid against ("6-1@6"); a lead as the tile alone.
import { TILES, idOf, legalPlays, endsOf, endsTotal, otherEnd, fivesPoints } from "./bones-rules.js";
import { layout, tileSvg } from "./bones-layout.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const tileName = t => `${TILES[t][0]}–${TILES[t][1]}`;

// ---------- tiles and lines as text ----------
const pair = tok => {
  const m = /^\[?([0-6])-([0-6])\]?$/.exec(tok);
  if (!m) throw new Error(`no tile "${tok}"`);
  return [Number(m[1]), Number(m[2])];
};
/** Tiles written "6-4 5-5" as ids. */
export function parseTiles(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).map(tok => idOf(...pair(tok)));
}
/**
 * A line written left to right, each tile as it lies (its left number first), the first tile laid in brackets:
 * "1-3 3-6 [6-6] 6-2" is the 6–6 laid first, 3–6 and then 1–3 on its left, 6–2 on its right. As the rules keep it:
 * { first, firstSides, left, right } (each arm from the first tile out, each tile with the number it leaves open).
 */
export function parseLine(text) {
  if (!text) return null;
  const toks = String(text).trim().split(/\s+/), at = toks.findIndex(t => t.startsWith("["));
  if (at < 0 || !toks[at].endsWith("]")) throw new Error(`no first tile in "${text}"`);
  const [fa, fb] = pair(toks[at]), left = [], right = [];
  let end = fa;
  for (let i = at - 1; i >= 0; i--) {
    const [a, b] = pair(toks[i]);
    if (b !== end) throw new Error(`"${toks[i]}" doesn't touch the ${end} in "${text}"`);
    left.push({ t: idOf(a, b), v: a });
    end = a;
  }
  end = fb;
  for (let i = at + 1; i < toks.length; i++) {
    const [a, b] = pair(toks[i]);
    if (a !== end) throw new Error(`"${toks[i]}" doesn't touch the ${end} in "${text}"`);
    right.push({ t: idOf(a, b), v: b });
    end = b;
  }
  return { first: idOf(fa, fb), firstSides: [fa, fb], left, right };
}
/** A step's table as the rules see it: your tiles in seat 0, the line as written. */
export function tableOf(step) {
  const line = parseLine(step.line);
  return {
    game: step.game || "partnership", seats: 4, opts: { target: 61 }, hands: [parseTiles(step.hand), [], [], []], dead: [[], [], [], []],
    first: line ? line.first : null, firstSides: line ? line.firstSides : null, left: line ? line.left : [], right: line ? line.right : [], log: [],
  };
}
/** Every tile a step writes, line, hand and rows: a lesson's table never shows one tile twice. */
export function tilesOf(step) {
  const line = parseLine(step.line);
  const laid = line ? [line.first, ...line.left.map(x => x.t), ...line.right.map(x => x.t)] : [];
  return { laid, hand: parseTiles(step.hand), rows: (step.rows || []).map(r => (r.tiles ? parseTiles(r.tiles) : null)) };
}

// ---------- plays ----------
/** The same written with the end's number first ("6-1@6"), whichever way the lesson wrote the tile. */
const norm = (s, key) => {
  const m = /^([0-6])-([0-6])(?:@([0-6]))?$/.exec(key);
  if (!m) throw new Error(`no play "${key}"`);
  const [a, b, n] = [Number(m[1]), Number(m[2]), m[3] == null ? null : Number(m[3])];
  if (n == null) return `${Math.max(a, b)}-${Math.min(a, b)}`;
  return `${n}-${a === n ? b : a}@${n}`;
};
const playKey = (s, play) => {
  const [a, b] = TILES[play.tile];
  if (s.first == null) return `${Math.max(a, b)}-${Math.min(a, b)}`;
  const e = endsOf(s), n = play.end === "L" ? e.L : e.R;
  return `${n}-${a === n ? b : a}@${n}`;
};
/** The plays a step's play could be, by its key: [{ tile, end }]. */
export function playsFor(step, key) {
  const s = tableOf(step), want = norm(s, key);
  return legalPlays(s, 0).filter(p => playKey(s, p) === want);
}
/** The table after a play of seat 0's: the tile on the line, out of the hand. */
export function withPlay(s, play) {
  const t = { ...s, left: s.left.slice(), right: s.right.slice(), hands: s.hands.map((h, i) => (i ? h : h.filter(x => x !== play.tile))) };
  if (t.first == null) { t.first = play.tile; t.firstSides = [...TILES[play.tile]]; }
  else {
    const e = endsOf(t);
    (play.end === "L" ? t.left : t.right).push({ t: play.tile, v: otherEnd(play.tile, play.end === "L" ? e.L : e.R) });
  }
  return t;
}
/** What a play scores in Fives and Threes: the ends' total after it, and the points. */
export function scoreOf(s, play) {
  const total = endsTotal(withPlay(s, play));
  return { total, pts: fivesPoints(total) };
}
/** The most any play of a step's hand scores. */
export const bestScore = s => Math.max(0, ...legalPlays(s, 0).map(p => scoreOf(s, p).pts));

/** A play made, judged against the step: { ok, msg } or { ok: false, why }. */
export function judge(step, play) {
  const s = tableOf(step);
  if (!legalPlays(s, 0).some(p => p.tile === play.tile && (s.first == null || p.end === play.end))) {
    if (s.first == null) return { ok: false, why: "That can't lead." };
    const e = endsOf(s);
    return { ok: false, why: `${tileName(play.tile)} doesn't fit ${play.end === "L" ? `the ${e.L}` : `the ${e.R}`}.` };
  }
  const key = playKey(s, play);
  const wrong = Object.entries(step.wrong || {}).find(([k]) => norm(s, k) === key);
  if (wrong) return { ok: false, why: wrong[1] };
  if (step.goal === "most") {
    const { total, pts } = scoreOf(s, play), best = bestScore(s);
    if (pts === best) return { ok: true, msg: step.then || "Right." };
    return { ok: false, why: `That makes ${total}${pts ? `, ${pts} ${pts === 1 ? "point" : "points"}` : ": nothing"}. One of your tiles scores ${best}.` };
  }
  if ([step.answer, ...(step.accept || [])].some(k => norm(s, k) === key)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.why || "Not that one: try again." };
}
/** The tiles of a step's hand that fit an end. */
export const fittingOf = step => { const s = tableOf(step); return [...new Set(legalPlays(s, 0).map(p => p.tile))]; };

// ---------- the stage ----------
const isTask = s => !!(s.fits || (s.answer != null && !s.quiz) || s.goal);
/** The plays of a tile that make a difference: on either end, unless both ends are alike (then one). */
function placesFor(s, t) {
  const list = legalPlays(s, 0).filter(p => p.tile === t);
  if (list.length < 2 || s.first == null) return list.slice(0, 1);
  const e = endsOf(s);
  return e.L === e.R && e.Ld === e.Rd ? [list[0]] : list;
}
/**
 * The stage on the course's sheet: the examples, the line on the table (the ends' total, for Fives and Threes), your
 * tiles. In a fits exercise a tap on a tile says whether it fits; otherwise it picks the tile, and where it could go on
 * either end, both places show on the line, to tap; Lay lays it, and once it's right the line shows it laid.
 */
export function tileStage() {
  let box = null, api = null, step = null, st = null;
  const mini = t => `<svg class="lb-tile" viewBox="0 0 2 1" role="img" aria-label="${tileName(t)}">${tileSvg({ t, x: 1, y: 0.5, v: false, a: TILES[t][0], b: TILES[t][1] })}</svg>`;
  const head = text => (text ? `<small>${esc(text)}</small>` : "");
  function pick(t) {
    const s = tableOf(step);
    if (step.fits) {
      st.found ??= [];
      st.no ??= [];
      if (st.found.includes(t) || st.no.includes(t)) return;
      if (fittingOf(step).includes(t)) {
        st.found.push(t);
        if (st.found.length === fittingOf(step).length) api.answer({ ok: true, msg: step.then || "Every one found." });
        else api.changed();
      } else {
        st.no.push(t);
        const e = endsOf(s);
        api.answer({ ok: false, why: `${tileName(t)} has no ${e.L}${e.R !== e.L ? ` and no ${e.R}` : ""}.` });
      }
      return;
    }
    const places = placesFor(s, t);
    if (!places.length) {
      const e = endsOf(s);
      api.answer({ ok: false, why: s.first == null ? "That can't lead." : `${tileName(t)} fits neither a ${e.L} nor a ${e.R}.` });
      return;
    }
    if (st.sel === t) { st.sel = null; st.end = null; }
    else { st.sel = t; st.end = places.length === 1 ? places[0].end : null; }
    api.changed();
  }
  const chooseEnd = g => { if (st.sel != null) { st.end = g.dataset.end; api.changed(); } };
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done || !isTask(step)) return;
        const h = e.target.closest("[data-hand]");
        if (h) { pick(Number(h.dataset.hand)); return; }
        const g = e.target.closest("[data-end]");
        if (g) chooseEnd(g);
      });
      box.addEventListener("keydown", e => {
        const g = e.target.closest?.("[data-end]");
        if (g && step && !st.done && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); chooseEnd(g); }
      });
    },
    task: isTask,
    // tiles that fit are found tap by tap; a tile is laid with the button under the words
    submits: s => !s.fits,
    ready: (s, t) => t.sel != null && t.end != null,
    label: (s, t) => {
      if (t.sel == null) return "Lay a tile";
      if (t.end == null) return `${tileName(t.sel)}: tap an end`;
      const tb = tableOf(s);
      if (tb.first == null) return `Lead ${tileName(t.sel)}`;
      const e = endsOf(tb), n = t.end === "L" ? e.L : e.R;
      return `Lay ${n}–${otherEnd(t.sel, n)} on the ${n}`;
    },
    submit: (s, t) => judge(s, { tile: t.sel, end: t.end }),
    hint(s, t) {
      if (s.fits) { t.show = true; return; }
      const tb = tableOf(s);
      const p = s.goal === "most" ? legalPlays(tb, 0).find(x => scoreOf(tb, x).pts === bestScore(tb)) : playsFor(s, s.answer)[0];
      if (p) { t.sel = p.tile; t.end = p.end; }
    },
    draw(s, t) {
      step = s;
      st = t;
      // once a tile is laid right, the table shows it laid
      const laid = t.done && !s.fits && t.sel != null && t.end != null, tb = laid ? withPlay(tableOf(s), { tile: t.sel, end: t.end }) : tableOf(s);
      const parts = [];
      for (const r of s.rows || []) {
        const ts = r.tiles ? parseTiles(r.tiles) : null;
        parts.push(`<div class="lb-row">${head(r.label)}${ts ? `<span class="lb-tiles" style="--n:${Math.max(ts.length, 3)}">${ts.map(mini).join("")}</span>` : `<b class="lb-word">${esc(r.text || "")}</b>`}</div>`);
      }
      if (s.line != null) parts.push(`<div class="lb-board">${lineSvg(tb, laid ? null : t)}</div>${s.total && tb.first != null ? totalHtml(tb, laid) : ""}`);
      if (s.hand) {
        const fit = s.fits ? new Set(fittingOf(s)) : null, found = new Set(t.done ? fit || [] : t.found || []), no = new Set(t.no || []);
        const tiles = tb.hands[0].map(x => {
          const cls = ["bn-mine"];
          if (!laid && t.sel === x) cls.push("sel");
          if (found.has(x)) cls.push("ok");
          else if (no.has(x)) cls.push("dim");
          else if (t.show && fit?.has(x)) cls.push("hinted");
          return `<button type="button" class="${cls.join(" ")}" data-hand="${x}" aria-label="${tileName(x)}${found.has(x) ? ", fits" : ""}"><svg viewBox="0 0 1 2" aria-hidden="true">${tileSvg({ t: x, x: 0.5, y: 1, v: true, a: TILES[x][0], b: TILES[x][1] })}</svg></button>`;
        });
        parts.push(`<div class="lb-row lb-handrow">${head(s.handLabel || "Your tiles")}<div class="bn-hand lb-hand${t.done || !isTask(s) ? " still" : ""}">${tiles.join("")}</div></div>`);
      }
      box.innerHTML = `<div class="lb${s.line != null ? " with-line" : ""}">${parts.join("")}</div>`;
    },
  };
  /** The ends' total as Fives and Threes counts it, and what it scores. */
  function totalHtml(tb, laid) {
    const total = endsTotal(tb), pts = fivesPoints(total);
    return `<p class="lb-total">${laid ? "Now the ends make" : "The ends make"} <b>${total}</b>${pts ? `: <b>${pts}</b> ${pts === 1 ? "point" : "points"}` : ": nothing"}</p>`;
  }
  /** The line, as large as its box allows, with the picked tile's places on it to tap (t: the step's state, or null). */
  function lineSvg(tb, t) {
    if (tb.first == null) return `<p class="lb-empty">No tile laid yet: you lead.</p>`;
    const len = 12, L = layout(tb.first, tb.firstSides, tb.left, tb.right, len), e = endsOf(tb), ghosts = [];
    if (t?.sel != null) {
      for (const p of placesFor(tb, t.sel)) {
        const add = { t: p.tile, v: otherEnd(p.tile, p.end === "L" ? e.L : e.R) };
        const G = layout(tb.first, tb.firstSides, p.end === "L" ? [...tb.left, add] : tb.left, p.end === "R" ? [...tb.right, add] : tb.right, len);
        ghosts.push({ g: G.tiles.find(x => x.arm === p.end && x.i === (p.end === "L" ? tb.left.length : tb.right.length)), end: p.end, on: t.end === p.end });
      }
    }
    // the view: the line as the step sets it with room for a tile more on either end, so it keeps its size as a tile
    // is picked, and once it's laid
    const set = tableOf(step), more = { t: idOf(0, 1), v: 0 };
    const room = layout(set.first, set.firstSides, [...set.left, more], [...set.right, more], len).box;
    const hw = Math.max(-room.x0, room.x1, -L.box.x0, L.box.x1) + 0.3, hh = Math.max(1.3, -room.y0, room.y1, -L.box.y0, L.box.y1) + 0.3;
    const tiles = L.tiles.map(p => tileSvg(p)).join("");
    const g = ghosts.map(({ g: x, end, on }) => `<g class="bn-ghost${on ? " on" : ""}" data-end="${end}" role="button" tabindex="0" aria-label="On the ${end === "L" ? e.L : e.R}">${tileSvg(x)}</g>`).join("");
    return `<svg class="lb-line" viewBox="${-hw} ${-hh} ${2 * hw} ${2 * hh}" role="img" aria-label="The line: the ends show ${e.L} and ${e.R}">${tiles}${g}</svg>`;
  }
}

// ---------- the lessons ----------
export const COURSE = {
  title: "Learn Bones", zh: "",
  chapters: [
    {
      id: "game", title: "The game", zh: "",
      lessons: [
        {
          id: "tiles", title: "Twenty-eight tiles", zh: "",
          steps: [
            { rows: [{ label: "The seven doubles", tiles: "0-0 1-1 2-2 3-3 4-4 5-5 6-6" }, { label: "And every other pair once", tiles: "0-1 2-5 3-6 4-6" }], say: "Bones is played with the double-six set: 28 tiles, every pair of numbers from blank (0) to six once, the seven doubles among them. A tile's pips (its spots) are its count: 6–4 counts 10." },
            { rows: [{ label: "A hand", tiles: "6-5 3-1 0-0" }], quiz: ["Six", "Seven", "Eight"], answer: 1, say: "How many tiles carry a five?", why: "Seven: 5–0 to 5–6, the double among them. Every number is on seven tiles, and on eight halves, its double having two." },
            { rows: [{ label: "Every five", tiles: "5-0 5-1 5-2 5-3 5-4 5-5 5-6" }], say: "Every number is on seven tiles. Remember it: counting what's been laid of a number tells you what's still to come." },
            { rows: [{ label: "", tiles: "6-5" }], quiz: ["Eleven", "Six", "Thirty"], answer: 0, say: "What does 6–5 count?", why: "Eleven: six pips and five. A hand's pips decide a blocked hand, and what a hand scores." },
          ],
        },
        {
          id: "lay", title: "Laying a tile", zh: "",
          steps: [
            { line: "[6-3]", say: "The first tile starts the line, and every tile after it is laid against one of the line's two open ends, its matching half touching: here the ends show 6 and 3." },
            { line: "[6-3]", hand: "3-5 2-4 6-1 0-0 4-6", fits: true, count: 3, say: "Your tiles are along the foot. Tap every one that fits an end.", then: "3–5 fits the 3; 6–1 and 4–6 fit the 6." },
            { line: "[6-3]", hand: "3-5 2-4 6-1 0-0 4-6", answer: "6-1@6", say: "Lay 6–1 on the 6: tap it, then Lay.", then: "The 6 is covered: the ends show 1 and 3 now.", why: "This time the 6–1, on the 6." },
            { line: "1-6 [6-3] 3-5", quiz: ["1 and 5", "6 and 3", "1 and 3"], answer: 0, say: "Three tiles laid. What do the ends show?", why: "1 and 5: the tiles at the two ends of the line show them; everything between is covered." },
          ],
        },
        {
          id: "doubles", title: "Doubles", zh: "",
          steps: [
            { line: "2-2 [2-6] 6-6", say: "A double is laid across the line, and the end stays its number: after 6–6, the end still shows a 6. A double fits only its own number, so it's the hardest tile to get rid of." },
            { line: "2-2 [2-6] 6-6", hand: "6-4 2-1 5-5 3-6 0-4", fits: true, count: 3, say: "Tap every tile that fits.", then: "6–4 and 3–6 on the 6, 2–1 on the 2. The 5–5 waits for a five." },
          ],
        },
        {
          id: "knock", title: "Can't play? Knock", zh: "¡paso!",
          steps: [
            { line: "0-3 [3-5] 5-2", hand: "1-1 4-6 3-4 6-6", quiz: ["Lay 3–4", "Knock", "Lay 1–1"], answer: 1, say: "The ends show 0 and 2. What do you do?", why: "Knock: none of your tiles has a blank or a two. A knock (a tap on the table; ¡paso! at a Latin table) passes the turn. If any tile fits, you must lay one." },
            { line: "0-3 [3-5] 5-2", say: "Everyone sees you knock, and on what: now they know you hold no blank and no two. Remember who knocked on what; the computer players do." },
          ],
        },
        {
          id: "partnership", title: "Partnership", zh: "dominó en parejas",
          steps: [
            { rows: [{ label: "Across the table: your partner", text: "Tito" }, { label: "On your right and left", text: "Rosa and Marisol" }], say: "Partnership is the block game of Latin America and the Caribbean. Four play, partners across the table, seven tiles each, so all 28 are dealt. Play passes to the right. The first hand is led by whoever holds the 6–6, with it; after that the lead passes to the right, any tile." },
            { rows: [{ label: "Rosa holds", tiles: "6-5 2-0" }, { label: "Marisol holds", tiles: "4-4 3-1" }], quiz: ["25", "13", "33"], answer: 0, say: "A hand ends when someone lays their last tile (¡dominó!), and their side scores the pips left in the other side's hands. Tito goes out: what does your side score?", why: "25: 6–5 and 2–0 are 13, 4–4 and 3–1 are 12. Your own side's tiles count for nothing." },
            { line: "4-5 5-0 0-4 [4-4] 4-1 1-6 6-4 4-2 2-3 3-4", say: "If nobody can lay a tile, the hand is blocked (tranque): here both ends show a 4, and all seven fours are down. The side holding fewer pips scores the other side's; level, nobody does." },
            { rows: [{ label: "You and Tito hold", tiles: "5-2 1-0 6-6" }, { label: "Rosa and Marisol hold", tiles: "6-3 2-1 5-3 2-2" }], quiz: ["Us: 24", "Them: 20", "Neither"], answer: 0, say: "Blocked, with these tiles left. Who scores?", why: "Your side: you hold 20 between you, they hold 24. Fewer wins, and scores their 24." },
            { rows: [{ label: "The game", text: "First side to 100" }, { label: "Menu", text: "100 · 150 · 200" }], say: "The first side to 100 wins (Menu: 150 or 200; or score every hand's pips, the winners' own too)." },
          ],
        },
        {
          id: "gaple", title: "Gaple", zh: "gaple",
          steps: [
            { rows: [{ label: "The first lead", tiles: "0-0" }], say: "Gaple, Indonesia's: four play, each for themselves, seven tiles each. The first hand is led with the double blank (balak kosong); after that the last hand's winner leads a double. The hand goes to whoever goes out, or holds the fewest pips when it's blocked." },
            { rows: [{ label: "Blocked. Pips left", text: "You 9 · Budi 4 · Sari 12 · Agus 15" }], quiz: ["+4", "−5", "+9"], answer: 0, say: "Each player pays every other the difference between their pips. What do you get?", why: "+4: you pay Budi 5, and get 3 from Sari and 6 from Agus. Budi, with the fewest, wins the hand and takes 5 + 8 + 11 = 24." },
            { rows: [{ label: "The game", text: "4 · 8 · 12 deals" }, { label: "Menu: alone, it counts 25", tiles: "0-0" }], say: "After the deals agreed (Menu: 4, 8 or 12), the most chips win. Menu also lays a tile face down when you can't play, instead of passing (it counts against you), and counts a double blank as 25 when it's left with no other blank." },
          ],
        },
        {
          id: "fives", title: "Fives and Threes", zh: "",
          steps: [
            { rows: [{ label: "The ends add up to", text: "3 → 1 · 5 → 1 · 6 → 2 · 9 → 3 · 10 → 2" }, { label: "and", text: "12 → 4 · 15 → 8 · 18 → 6 · 20 → 4" }], say: "Fives and Threes, the English pub game: two to four play (four in partnerships), five tiles each (seven for two), the rest face down, out of play. Every tile laid scores the line's two ends added up, if that's a multiple of five or of three: a point for each five and each three in it." },
            { line: "[6-4]", game: "fives", total: true, say: "The first tile counts all its pips: 6–4 makes 10, two fives, 2 points." },
            { line: "2-2 [2-6]", game: "fives", total: true, say: "A double at an end counts both its halves: these ends make 4 and 6, 10 in all, 2 points." },
            { line: "5-1 [1-4] 4-5", hand: "5-6 5-0 5-5 2-3", game: "fives", total: true, goal: "most", pts: 8, say: "The ends make 10. Lay the tile that scores most.", then: "The 5–5: a double at an end counts both halves, 10, and the other end's 5 makes 15, three fives and five threes: 8 points." },
            { line: "4-1 [1-3]", hand: "4-5 3-6 0-4 6-6", game: "fives", total: true, goal: "most", pts: 2, say: "The ends make 7. Score as much as you can.", then: "3–6 on the 3: 4 and 6 make 10, 2 points." },
            { rows: [{ label: "Going out", text: "1 point" }, { label: "The game", text: "61 exactly" }], say: "Going out scores 1. The first to 61 exactly wins (Menu: 31 or 121): points that would take you past it don't count. In partnerships, a side's points are the two players' together, and a hand ends when both of a side are out." },
          ],
        },
        {
          id: "first", title: "A first game", zh: "",
          steps: [
            { say: "That's the game. Play one against the computer at Easy; Menu chooses the game (Partnership, Gaple or Fives and Threes), its target, and how strong the computer plays when you're ready.", play: true },
          ],
        },
      ],
    },
  ],
};
