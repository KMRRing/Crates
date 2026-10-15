// Whispers, Chinese whispers with drawings (Telestrations' game, as Gartic Phone plays it on phones): everyone writes
// something to draw on the first page of a book of their own, and the books go round the table at once, each page made
// from the one before by the next player: a drawing of what's written, then what someone else makes of the drawing,
// then a drawing of that, until every book has had every player's hand in it. Then the books are shown to the whole
// table a page at a time, read out as they go, to see what the first page became.
import { PHRASES } from "./party-draw-words.js";
import { h, button, countdown, waitingFor, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { createPad, picture, sender, keep, decode } from "./party-draw.js";

/** Seconds for each kind of page, by the lobby's pace. */
export const PACES = { quick: { write: 30, draw: 60, guess: 30 }, normal: { write: 45, draw: 90, guess: 45 }, relaxed: { write: 60, draw: 120, guess: 60 } };
const LONGEST = 60;                 // a page's words, at most
const OFFERS = 3;                   // the book's suggestions each player can cycle through

/**
 * How many pages a book has at a table of n: the first written, then drawn and written in turn, ending on what someone
 * wrote, each player's hand in it once; at an even table the owner draws their own first page too, so it ends on words.
 */
export const pagesFor = n => (n % 2 ? n : n + 1);
/** What page k is: written first, then drawn and written in turn. */
export const kindOf = k => (k === 0 ? "write" : k % 2 ? "draw" : "guess");
const shiftOf = (k, n) => (n % 2 ? k : Math.max(0, k - 1));
/** Whose hand makes page k of book b (by seat), at a table of n: the owner's first, then each next player's round. */
export const workerOf = (b, k, n) => (b + shiftOf(k, n)) % n;
/** Which book the player in seat i works on at page k. */
export const bookOf = (i, k, n) => (((i - shiftOf(k, n)) % n) + n) % n;
const clean = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, LONGEST);

// the database keeps no empty list (a book with no pages yet) and may give a list back as an object with holes: each
// book and page put back in its place
const placed = x => { const out = []; for (const [i, v] of Object.entries(x || {})) out[Number(i)] = v; return out; };
const whole = s => {
  s.order = s.order ? Object.values(s.order) : [];
  const books = placed(s.books);
  s.books = s.order.map((_, i) => ({ pages: placed(books[i]?.pages) }));
  s.names ||= {};
  s.offer ||= {};
  for (const u of Object.keys(s.offer)) s.offer[u] = Object.values(s.offer[u] || {});
  return s;
};
/** The words a drawing is to be made from: the page before, or, if that was left blank, the last words in the book. */
export function wordsFor(book, k) {
  for (let j = k - 1; j >= 0; j--) if (kindOf(j) !== "draw" && book.pages[j]?.t) return book.pages[j].t;
  return "";
}

/** The phrases dealt from the book (the party's newest last, so a phrase comes round again only when the rest have). */
function dealPhrases(n, rng, shown) {
  const was = new Map(shown.map((p, i) => [p, i]));
  const fresh = shuffle(PHRASES.filter(p => !was.has(p)), rng), old = PHRASES.filter(p => was.has(p)).sort((a, b) => was.get(a) - was.get(b));
  const all = [...fresh, ...old];
  return Array.from({ length: n }, (_, i) => all[i % all.length]);
}
const sayStep = (kind, k, total) => (kind === "draw"
  ? `${k === 1 ? "Now draw" : "Draw"} what's written on the page you've been passed.`
  : `${k === 2 ? "Now write" : "Write"} what you make of the drawing you've been passed${k === total - 1 ? ": the last page" : ""}.`);
function readPage(s, nameOf) {
  const b = s.books[s.book], p = b.pages[s.page], kind = kindOf(s.page), who = nameOf(p?.by);
  const intro = s.page === 0 ? `${nameOf(s.order[s.book])}'s book. ` : "";
  if (!p || p.blank) return `${intro}${who} left this page blank.`;
  if (kind === "write") return `${intro}${p.house ? `${who} took from the book` : `${who} wrote`}: ${p.t}.`;
  if (kind === "draw") return `${intro}${who} drew that.`;
  return `${intro}${who} took it for: ${p.t}.${s.page === b.pages.length - 1 ? " And that's how it ended." : ""}`;
}

export default {
  id: "whispers",
  name: "Whispers",
  min: 3,
  max: 10,
  css: "party-draw.css",
  keepsView: true,
  blurb: "Chinese whispers in pictures: draw what you read, write what you see, and find out what your words became.",
  rules: [
    "Everyone writes something to draw on the first page of their own book: a few words, the odder the better (stuck? Give me one takes a line from the game's book). Then the books go round the table, all at once. You draw what's written on the page you're passed, without the page before it; the next player sees only your drawing and writes what they make of it; the next draws that; and so on, until every book has had every player's hand in it once and ends on someone's words. At an even table you draw your own first page too.",
    "Each page has a clock (quicker or slower, as the lobby set), and Done when you're happy; the next page comes when everyone's done or the clock runs out, taking what you had. Then the books are shown to everyone, a page at a time, read out as they go: anyone can tap Next. There are no points; there's what your words became.",
  ],
  options: [
    { id: "first", label: "First pages", choices: [["own", "Written by you"], ["book", "From the book"]], value: "own" },
    { id: "pace", label: "Time for a page", choices: [["quick", "Quick"], ["normal", "Normal"], ["relaxed", "Relaxed"]], value: "normal" },
  ],

  start({ players, options, rng, now, shown }) {
    const n = players.length, order = players.map(p => p.uid);
    const s = { pace: PACES[options.pace] ? options.pace : "normal", first: options.first === "book" ? "book" : "own",
      order, names: Object.fromEntries(players.map(p => [p.uid, p.name])), books: order.map(() => ({ pages: [] })), k: 0 };
    // what the book offers each player (Give me one), and, from the book, their first page
    const dealt = dealPhrases(n * OFFERS, rng, shown || []);
    s.offer = Object.fromEntries(order.map((u, i) => [u, Array.from({ length: OFFERS }, (_, j) => dealt[i + j * n])]));   // everyone's first the freshest
    if (s.first === "book") {
      s.books.forEach((b, i) => { b.pages.push({ by: order[i], t: s.offer[order[i]][0], house: true }); });
      s.k = 1;
    }
    s.step = kindOf(s.k);
    s.deadline = now + PACES[s.pace][s.step] * 1000;
    s.show = s.first === "book" ? order.map(u => s.offer[u][0]) : [];
    s.say = s.first === "book" ? `Whispers: ${n} books. Each of you has a page from the book: draw what it says.`
      : `Whispers: ${n} books. Write something to draw on your first page.`;
    return s;
  },

  advance(state, { players, inputs, now }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid)), n = s.order.length, nameOf = u => s.names[u] || "Someone";
    const mine = u => (inputs[u]?.k === s.k ? inputs[u] : null);
    if (["write", "draw", "guess"].includes(s.step)) {
      const workers = s.order.filter(u => here.has(u));
      if (workers.length && !workers.every(u => mine(u)?.done) && now < s.deadline) return null;
      // every book's page from its worker this time round: what they sent, or a blank (the book's own words for a
      // first page nobody wrote, so the book has something to pass on)
      const used = [];
      s.books.forEach((b, i) => {
        const u = s.order[workerOf(i, s.k, n)], v = mine(u);
        if (s.step === "draw") { const d = typeof v?.d === "string" ? v.d : ""; b.pages[s.k] = d ? { by: u, d } : { by: u, blank: true }; return; }
        const t = clean(v?.t);
        if (t) b.pages[s.k] = { by: u, t };
        else if (s.step === "write") { const p = s.offer[u]?.[0] || PHRASES[i % PHRASES.length]; b.pages[s.k] = { by: u, t: p, house: true }; used.push(p); }
        else b.pages[s.k] = { by: u, blank: true };
      });
      s.k++;
      if (s.k >= pagesFor(n)) {
        s.step = "show";
        s.book = 0;
        s.page = 0;
        delete s.deadline;
        return { state: s, show: used, say: `Every book has been round. ${readPage(s, nameOf)}` };
      }
      s.step = kindOf(s.k);
      s.deadline = now + PACES[s.pace][s.step] * 1000;
      return { state: s, show: used, say: sayStep(s.step, s.k, pagesFor(n)) };
    }
    if (s.step === "show") {
      // Next from any phone moves the books on a page, however many tap it for that page
      const at = `${s.book}.${s.page}`;
      if (!Object.values(inputs).some(v => v?.next === at)) return null;
      s.page++;
      if (s.page >= s.books[s.book].pages.length) { s.book++; s.page = 0; }
      if (s.book >= n) {
        s.step = "over";
        s.winners = [];
        return { state: s, say: "That's every book." };
      }
      return { state: s, say: readPage(s, nameOf) };
    }
    return null;
  },

  wakeAt: s => (["write", "draw", "guess"].includes(s.step) ? s.deadline ?? null : null),

  view(stage, ctx) {
    const s = whole(structuredClone(ctx.state)), me = ctx.me.uid;
    const role = s.order.includes(me) ? "player" : "watcher";
    const key = s.step === "show" ? `show:${s.book}` : `${s.step}:${s.k}:${role}`;
    keep(stage, key, ctx, () => SCREENS[s.step === "write" || s.step === "guess" ? "words" : s.step](stage, s, role, ctx));
  },
};

// ---------- the screens ----------
const nameIn = (ctx, s) => u => ctx.players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
const doneOf = (ctx, s) => s.order.filter(u => ctx.inputs[u]?.k === s.k && ctx.inputs[u]?.done);
const here = (ctx, s) => ctx.players.filter(p => s.order.includes(p.uid));
/** The book in your hands at this page, and its page before (what you're to draw or name). */
function inHand(s, me) {
  const n = s.order.length, i = s.order.indexOf(me), b = bookOf(i, s.k, n);
  return { b, book: s.books[b], owner: s.order[b] };
}
/** Typing that's sent as it's typed (a moment after the last key) so the clock running out keeps it, and on Done. */
function drafting(send, ms = 800) {
  let timer = 0;
  return { soon(v) { clearTimeout(timer); timer = setTimeout(() => send(v), ms); }, now(v) { clearTimeout(timer); send(v); }, stop() { clearTimeout(timer); } };
}

const SCREENS = {
  // the first page, or what you make of a drawing: words in a box, Done
  words(stage, s, role, ctx) {
    const first = s.step === "write", nameOf = nameIn(ctx, s), clock = countdown(s.deadline, ctx.now, { total: PACES[s.pace][s.step] * 1000 });
    const wait = h("p", { class: "pk-wait" });
    if (role !== "player") {
      stage.append(h("div", { class: "dr-wrap wh-words" }, h("p", { class: "pk-ask" }, first ? "They're writing their first pages…" : "They're naming the drawings…"),
        clock, wait, h("p", { class: "pk-line" }, "You joined mid-game: you'll see the books at the end.")));
      return { update(c) { wait.textContent = waitingFor(here(c, s), doneOf(c, s)); } };
    }
    let cur = ctx, done = false, offered = 0;
    const was = cur.inputs[cur.me.uid]?.k === s.k ? cur.inputs[cur.me.uid] : null;
    const input = h("input", { class: "pk-input wh-input", maxlength: LONGEST, autocomplete: "off", spellcheck: "false", enterkeyhint: "done",
      placeholder: first ? "Something to draw" : "What is it?", "aria-label": first ? "Your first page" : "What the drawing shows" });
    input.value = was?.t || "";
    const draft = drafting(t => cur.send({ k: s.k, t, done }));
    const go = button("Done", () => setDone(!done), { cls: "wh-done" });
    const setDone = yes => {
      const t = clean(input.value);
      if (yes && !t) { input.focus(); return; }
      done = yes;
      draft.now(t);
      paint();
    };
    const paint = () => { input.disabled = done; go.textContent = done ? "Change" : "Done"; go.classList.toggle("primary", !done); };
    input.addEventListener("input", () => draft.soon(clean(input.value)));
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); setDone(true); } });
    const parts = [];
    if (first) {
      parts.push(h("p", { class: "pk-ask" }, "Write something to draw"), h("p", { class: "pk-line wh-note" }, "A few words, the odder the better: the next player draws it."));
    } else {
      const { book } = inHand(s, cur.me.uid), prev = book.pages[s.k - 1];
      const pic = picture(prev?.d || "", { label: "The drawing you've been passed" });
      parts.push(h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, "What is it?"))),
        h("div", { class: "dr-box fit-grow fit-box" }, pic.el));
      if (!prev?.d) parts.push(h("p", { class: "pk-line wh-note" }, "This page was left blank: write anything you like."));
    }
    const help = first ? button("Give me one", () => {
      const list = s.offer[cur.me.uid] || [];
      if (!list.length) return;
      input.value = list[offered++ % list.length];
      draft.now(clean(input.value));
    }, { primary: false, cls: "wh-help" }) : null;
    parts.push(h("div", { class: first ? "wh-side" : "dr-side wh-side" }, h("div", { class: "sk-row" }, input, go), help, clock, wait));
    stage.append(h("div", { class: `dr-wrap wh-words${first ? " wh-first" : ""}` }, ...parts));
    done = !!was?.done;
    paint();
    return { update(c) { cur = c; wait.textContent = waitingFor(here(c, s), doneOf(c, s)); }, leave() { draft.stop(); } };
  },

  // a drawing of the words you've been passed
  draw(stage, s, role, ctx) {
    const clock = countdown(s.deadline, ctx.now, { total: PACES[s.pace].draw * 1000 }), wait = h("p", { class: "pk-wait" });
    if (role !== "player") {
      stage.append(h("div", { class: "dr-wrap wh-words" }, h("p", { class: "pk-ask" }, "They're drawing…"), clock, wait,
        h("p", { class: "pk-line" }, "You joined mid-game: you'll see the books at the end.")));
      return { update(c) { wait.textContent = waitingFor(here(c, s), doneOf(c, s)); } };
    }
    let cur = ctx, done = false;
    const { book } = inHand(s, cur.me.uid), was = cur.inputs[cur.me.uid]?.k === s.k ? cur.inputs[cur.me.uid] : null;
    const flow = sender(d => cur.send({ k: s.k, d, done }), () => pad.text());
    const pad = createPad({ strokes: decode(was?.d), onChange: why => { if (why !== "full") flow.push(why !== "move"); } });
    const go = button("Done", () => { done = !done; pad.enable(!done); flow.flush(); cur.send({ k: s.k, d: pad.text(), done }); paint(); }, { cls: "wh-done" });
    const paint = () => { go.textContent = done ? "Change" : "Done"; go.classList.toggle("primary", !done); };
    stage.append(h("div", { class: "dr-wrap wh-draw" },
      h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, "Draw"), h("span", { class: "wh-words-big" }, wordsFor(book, s.k) || "anything you like")), clock),
      h("div", { class: "dr-box fit-grow fit-box" }, pad.paper),
      h("div", { class: "dr-side" }, pad.tools, h("div", { class: "wh-row" }, wait, go))));
    done = !!was?.done;
    pad.enable(!done);
    paint();
    return { update(c) { cur = c; wait.textContent = waitingFor(here(c, s), doneOf(c, s)); }, leave() { flow.flush(); flow.stop(); pad.enable(false); } };
  },

  // the books shown, a page at a time, everyone on the same page
  show(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), n = s.order.length, total = pagesFor(n);
    const title = h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, `Book ${s.book + 1} of ${n}`), h("strong", { class: "wh-owner" }, `${nameOf(s.order[s.book])}'s`));
    const count = h("span", { class: "sk-count" });
    const pages = h("ol", { class: "wh-pages fit-grow fit-scroll", "aria-live": "polite" });
    let cur = ctx, shown = 0, asked = "";
    const next = button("Next", () => { asked = `${cur.state.book}.${cur.state.page}`; cur.send({ next: asked }); paint(cur); }, { cls: "wh-next" });
    stage.append(h("div", { class: "dr-wrap wh-show" }, h("div", { class: "dr-head wh-head" }, title, count), pages, next));
    const paint = c => {
      const st = whole(structuredClone(c.state));
      if (st.step !== "show" || st.book !== s.book) return;
      const book = st.books[s.book];
      while (shown <= st.page) { pages.append(pageItem(book, shown, nameOf)); shown++; }
      pages.scrollTo({ top: pages.scrollHeight, behavior: shown > 1 ? "smooth" : "auto" });
      count.textContent = `page ${st.page + 1} of ${total}`;
      const last = st.page >= book.pages.length - 1;
      next.textContent = !last ? "Next page" : st.book < n - 1 ? "Next book" : "The end";
      next.disabled = asked === `${st.book}.${st.page}`;
    };
    return { update(c) { cur = c; paint(c); } };
  },

  over(stage, s, role, ctx) {
    // every book to look through again on your own phone, the others' choices not moving yours
    const nameOf = nameIn(ctx, s), n = s.order.length;
    let at = Math.max(0, s.order.indexOf(ctx.me.uid));
    const pages = h("ol", { class: "wh-pages fit-grow fit-scroll" });
    const tabs = h("div", { class: "wh-books", role: "tablist", "aria-label": "The books" });
    const pick = i => {
      at = i;
      [...tabs.children].forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
      pages.replaceChildren(...s.books[i].pages.map((_, k) => pageItem(s.books[i], k, nameOf)));
      pages.scrollTop = 0;
    };
    for (let i = 0; i < n; i++) tabs.append(h("button", { type: "button", role: "tab", onclick: () => pick(i) }, nameOf(s.order[i])));
    stage.append(h("div", { class: "dr-wrap wh-show wh-over" }, h("p", { class: "pk-ask" }, "Every book"), tabs, pages));
    pick(at);
    return {};
  },
};

/** A page of a book as the table sees it: who made it, and the words or the drawing. */
function pageItem(book, k, nameOf) {
  const p = book.pages[k] || { blank: true }, who = nameOf(p.by), kind = kindOf(k);
  const by = h("span", { class: "wh-by" }, p.blank ? `${who} left it blank` : kind === "draw" ? `${who} drew` : k === 0 ? (p.house ? `${who}, from the book` : `${who} wrote`) : `${who} saw`);
  if (kind === "draw") return h("li", { class: `wh-page pic${p.blank ? " blank" : ""}` }, by, picture(p.d || "", { label: `${who}'s drawing` }).el);
  return h("li", { class: `wh-page text${k === 0 ? " first" : ""}${p.blank ? " blank" : ""}` }, by, h("p", { class: "wh-text" }, p.blank ? "…" : p.t));
}
