// Gallery, the drawing game of titles (Drawful's mechanics): everyone is given a strange title on their phone, secretly,
// and draws it. Then the drawings are hung one at a time, and everyone but the artist writes a title for it that might
// pass for the real one. Every title is shown together, and each player picks the one they believe is the artist's:
// find it and score, and the artist scores for each who did; fool someone with your title and score for each one
// fooled. The house adds titles of its own when there are too few.
import { TITLES } from "./party-draw-words.js";
import { h, button, countdown, waitingFor, scoreList, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { createPad, picture, sender, keep, decode } from "./party-draw.js";

export const POINTS = { truth: 1000, artist: 500, fool: 500 };
const TITLE_MS = 60000;           // to write a title for a drawing
const PICK_MS = 45000;            // to pick the real one
const revealMs = n => Math.min(20000, 6000 + 1500 * n);
const LONGEST = 50;

// ---------- telling a title from the real one ----------
const STOP = new Set(["a", "an", "the", "of", "in", "on", "at", "and", "to", "for", "with", "its", "his", "her", "their", "my", "your"]);
const wordsOf = s => String(s || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/['’]s\b/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ")
  .split(/\s+/).filter(w => w && !STOP.has(w)).map(w => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
/** Whether two titles are the same title: the same words, case, articles, apostrophes and plurals aside. */
export const sameTitle = (a, b) => { const x = wordsOf(a).join(" "); return !!x && x === wordsOf(b).join(" "); };
/** Whether a title is the real one, or too near it to stand as another: every one of the real title's words in it. */
export function nearTitle(text, title) {
  const t = new Set(wordsOf(text)), r = wordsOf(title);
  return !!r.length && r.every(w => t.has(w));
}
/** A title as the table sees it: tidied, short, no closing full stop. */
export const shownTitle = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, LONGEST).replace(/[.!]+$/, "");
/** What's wrong with a title, in words, or "". */
export function titleProblem(text, title) {
  const t = shownTitle(text);
  if (!t) return "Write a title.";
  if (nearTitle(t, title)) return "That's the real title, or too near it: write another.";
  return "";
}

// ---------- the game ----------
const whole = s => {
  for (const k of ["order", "art", "opts", "dealt"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.opts.forEach(o => { o.by = o.by ? Object.values(o.by) : []; });
  s.names ||= {}; s.scores ||= {}; s.prompts ||= {}; s.picks ||= {}; s.gained ||= {};
  return s;
};
const nameOfIn = s => u => s.names[u] || "Someone";
/** The titles for a round: one each, none dealt this game, those the party has had last. */
function deal(s, players, now, rng, shown) {
  const was = new Map(shown.map((t, i) => [t, i])), dealt = new Set(s.dealt);
  const fresh = shuffle(TITLES.filter(t => !was.has(t) && !dealt.has(t)), rng), old = TITLES.filter(t => was.has(t) && !dealt.has(t)).sort((a, b) => was.get(a) - was.get(b));
  const pool = [...fresh, ...old, ...shuffle(TITLES, rng)];
  s.prompts = {};
  const here = s.order.filter(u => players.some(p => p.uid === u));
  here.forEach((u, i) => { s.prompts[u] = pool[i]; s.dealt.push(pool[i]); });
  s.art = [];
  s.step = "draw";
  s.deadline = now + s.secs * 1000;
  return Object.values(s.prompts);
}
/** The next drawing on the wall: titles to write for it. */
function hang(s, now) {
  s.step = "title";
  s.opts = [];
  s.picks = {};
  s.gained = {};
  s.deadline = now + TITLE_MS;
  const nameOf = nameOfIn(s), a = s.art[s.at];
  return `${s.at === 0 ? "The first drawing" : "Next"}: ${nameOf(a.by)}'s. Everyone else, write a title that might pass for the real one.`;
}
function finish(s, nameOf) {
  s.step = "over";
  delete s.deadline;
  const top = Math.max(0, ...s.order.map(u => s.scores[u] || 0));
  s.winners = top > 0 ? s.order.filter(u => (s.scores[u] || 0) === top) : [];
  return `That's the gallery. ${s.winners.length ? `${names(s.winners.map(nameOf))} ${s.winners.length > 1 ? "win" : "wins"}, with ${top.toLocaleString("en-GB")}.` : "Nobody scored."}`;
}

export default {
  id: "gallery",
  name: "Gallery",
  min: 3,
  max: 10,
  css: "party-draw.css",
  keepsView: true,
  blurb: "Draw a strange title, then give the others' drawings titles good enough to pass for the real ones.",
  rules: [
    "Everyone is given a strange title on their phone (a nervous lighthouse; a dog doing its taxes) and draws it, in a minute and a half (or the time the lobby set), keeping the title to themselves.",
    "Then the drawings are hung one at a time. Everyone but the artist writes a title for it that might pass for the real one (not the real one, which the phone refuses, nor anything too near it; stuck? Title for me). Every title is shown together, in capitals so nobody's typing gives one away, and each player but the artist picks the one they believe is real, never their own.",
    "Find the real title: 1,000 points, and the artist scores 500 for each who did. Fool someone with your title: 500 for each one fooled. The house adds titles of its own when there are too few. One round or two; the most points wins.",
  ],
  options: [
    { id: "rounds", label: "Rounds", choices: [["1", "1"], ["2", "2"]], value: "1" },
    { id: "secs", label: "Time to draw", choices: [["60", "1 minute"], ["90", "90 seconds"], ["120", "2 minutes"]], value: "90" },
  ],

  start({ players, options, rng, now, shown }) {
    const s = { rounds: options.rounds === "2" ? 2 : 1, secs: [60, 90, 120].includes(Number(options.secs)) ? Number(options.secs) : 90, round: 0, dealt: [],
      order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])), scores: Object.fromEntries(players.map(p => [p.uid, 0])) };
    s.show = deal(s, players, now, rng, shown || []);
    s.say = `Gallery${s.rounds > 1 ? ", two rounds" : ""}. Everyone has a strange title on their phone: draw yours, and keep it to yourself.`;
    return s;
  },

  advance(state, { players, inputs, now, rng, shown }) {
    const s = whole(structuredClone(state)), here = players.map(p => p.uid).filter(u => s.order.includes(u)), nameOf = nameOfIn(s);
    const mine = u => (inputs[u]?.round === s.round && (s.step === "draw" || inputs[u]?.piece === s.at) ? inputs[u] : null);
    const late = now >= s.deadline;
    if (s.step === "draw") {
      if (here.length && !here.every(u => mine(u)?.done) && !late) return null;
      // the drawings hung in an order nobody knows; a blank page isn't hung
      s.art = shuffle(here.filter(u => typeof mine(u)?.d === "string" && mine(u).d).map(u => ({ by: u, title: s.prompts[u], d: mine(u).d })), rng);
      s.at = 0;
      if (!s.art.length) {
        s.round++;
        if (s.round >= s.rounds) return { state: s, say: finish(s, nameOf) };
        return { state: s, say: "Nothing was drawn. New titles: draw yours.", show: deal(s, players, now, rng, shown) };
      }
      return { state: s, say: `The gallery opens. ${hang(s, now)}` };
    }
    const a = s.art[s.at];
    if (!a) return null;                                                     // over
    const others = here.filter(u => u !== a.by);
    if (s.step === "title") {
      const title = u => { const t = shownTitle(mine(u)?.t); return t && !titleProblem(t, a.title) ? t : ""; };
      if (others.length && !others.every(u => title(u)) && !late) return null;
      // the real title, the players' (the same title twice is one, both its authors scoring from it), and the house's
      // to make up the numbers: four at least, and one more than there are players writing
      const opts = [{ text: a.title, truth: true, by: [] }];
      for (const u of others) {
        const t = title(u);
        if (!t) continue;
        const same = opts.find(o => !o.truth && sameTitle(o.text, t));
        if (same) same.by.push(u); else opts.push({ text: t, by: [u] });
      }
      const used = new Set([...s.dealt, ...opts.map(o => o.text)]);
      for (const t of shuffle(TITLES, rng)) {
        if (opts.length >= Math.max(4, others.length + 1)) break;
        if (!used.has(t) && !opts.some(o => sameTitle(o.text, t))) opts.push({ text: t, by: [], house: true });
      }
      s.opts = shuffle(opts, rng);
      s.step = "pick";
      s.deadline = now + PICK_MS;
      return { state: s, say: "The titles are in. Which is the real one?" };
    }
    if (s.step === "pick") {
      const ok = u => { const i = mine(u)?.pick; return Number.isInteger(i) && !!s.opts[i] && !s.opts[i].by.includes(u); };
      if (others.length && !others.every(ok) && !late) return null;
      s.picks = Object.fromEntries(others.filter(ok).map(u => [u, mine(u).pick]));
      s.gained = {};
      const add = (u, p) => { s.gained[u] = (s.gained[u] || 0) + p; s.scores[u] = (s.scores[u] || 0) + p; };
      for (const [u, i] of Object.entries(s.picks)) {
        const o = s.opts[i];
        if (o.truth) { add(u, POINTS.truth); add(a.by, POINTS.artist); } else for (const b of o.by) add(b, POINTS.fool);
      }
      const lines = [];
      s.opts.forEach((o, i) => {
        const fooled = Object.keys(s.picks).filter(u => s.picks[u] === i);
        if (!o.truth && fooled.length) lines.push(`${o.house ? "The house's title" : `${names(o.by.map(nameOf))}'s title`}, ${o.text}, fooled ${names(fooled.map(nameOf))}.`);
      });
      const ti = s.opts.findIndex(o => o.truth), found = Object.keys(s.picks).filter(u => s.picks[u] === ti);
      lines.push(`The real title: ${a.title}. ${found.length ? `${names(found.map(nameOf))} found it.` : "Nobody found it."}`);
      s.step = "reveal";
      s.span = revealMs(s.opts.length);
      s.deadline = now + s.span;
      return { state: s, say: lines.join(" ") };
    }
    if (s.step === "reveal") {
      if (!late && !(here.length && here.every(u => mine(u)?.next))) return null;
      s.at++;
      if (s.at < s.art.length) return { state: s, say: hang(s, now) };
      s.round++;
      if (s.round >= s.rounds) return { state: s, say: finish(s, nameOf) };
      return { state: s, say: "Round two: new titles. Draw yours.", show: deal(s, players, now, rng, shown) };
    }
    return null;
  },

  wakeAt: s => (["draw", "title", "pick", "reveal"].includes(s.step) ? s.deadline ?? null : null),

  view(stage, ctx) {
    const s = whole(structuredClone(ctx.state)), me = ctx.me.uid;
    const role = !s.order.includes(me) ? "watcher" : s.step !== "draw" && s.step !== "over" && s.art[s.at]?.by === me ? "artist" : "player";
    keep(stage, `${s.step}:${s.round}:${s.at ?? ""}:${role}`, ctx, () => SCREENS[s.step](stage, s, role, ctx));
  },
};

// ---------- the screens ----------
const nameIn = (ctx, s) => u => ctx.players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
// an input names the drawing it's for as `piece` (table.send stamps every input with its time as `at`)
const sentBy = (ctx, s, u) => { const v = ctx.inputs[u]; return v?.round === s.round && (s.step === "draw" || v?.piece === s.at) ? v : null; };
const playing = (ctx, s) => ctx.players.filter(p => s.order.includes(p.uid));
const pts = n => (n || 0).toLocaleString("en-GB");
/** The drawing on the wall, its artist named over it. */
const hung = (s, nameOf) => {
  const a = s.art[s.at];
  return [h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, `Drawing ${s.at + 1} of ${s.art.length}`), h("strong", {}, `${nameOf(a.by)}'s`))),
    h("div", { class: "dr-box fit-grow fit-box" }, picture(a.d, { label: `${nameOf(a.by)}'s drawing` }).el)];
};

const SCREENS = {
  draw(stage, s, role, ctx) {
    const wait = h("p", { class: "pk-wait" }), clock = countdown(s.deadline, ctx.now, { total: s.secs * 1000 });
    if (role === "watcher" || !s.prompts[ctx.me.uid]) {
      stage.append(h("div", { class: "dr-wrap wh-words" }, h("p", { class: "pk-ask" }, "They're drawing…"), clock, wait,
        h("p", { class: "pk-line" }, "You joined mid-game: you'll see the drawings as they're hung.")));
      return { update(c) { wait.textContent = waitingFor(playing(c, s), s.order.filter(u => sentBy(c, s, u)?.done)); } };
    }
    let cur = ctx, done = false;
    const was = sentBy(cur, s, cur.me.uid);
    const flow = sender(d => cur.send({ round: s.round, d, done }), () => pad.text());
    const pad = createPad({ strokes: decode(was?.d), onChange: why => { if (why !== "full") flow.push(why !== "move"); } });
    const go = button("Done", () => { done = !done; pad.enable(!done); flow.flush(); cur.send({ round: s.round, d: pad.text(), done }); paint(); }, { cls: "wh-done" });
    const paint = () => { go.textContent = done ? "Change" : "Done"; go.classList.toggle("primary", !done); };
    stage.append(h("div", { class: "dr-wrap gl-draw" },
      h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, "Draw"), h("span", { class: "wh-words-big" }, s.prompts[cur.me.uid])), clock),
      h("div", { class: "dr-box fit-grow fit-box" }, pad.paper),
      h("div", { class: "dr-side" }, pad.tools, h("div", { class: "wh-row" }, wait, go))));
    done = !!was?.done;
    pad.enable(!done);
    paint();
    return { update(c) { cur = c; wait.textContent = waitingFor(playing(c, s), s.order.filter(u => sentBy(c, s, u)?.done)); }, leave() { flow.flush(); flow.stop(); pad.enable(false); } };
  },

  title(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), a = s.art[s.at], wait = h("p", { class: "pk-wait" }), clock = countdown(s.deadline, ctx.now, { total: TITLE_MS });
    const side = h("div", { class: "dr-side gl-side" });
    stage.append(h("div", { class: "dr-wrap gl-title" }, ...hung(s, nameOf), side));
    const writers = c => playing(c, s).filter(p => p.uid !== a.by);
    const written = c => writers(c).map(p => p.uid).filter(u => { const t = shownTitle(sentBy(c, s, u)?.t); return t && !titleProblem(t, a.title); });
    if (role !== "player") {
      side.append(h("p", { class: "pk-line gl-note" }, role === "artist" ? `Your drawing of ${a.title}: they're writing titles for it.` : "They're writing titles."), clock, wait);
      return { update(c) { wait.textContent = waitingFor(writers(c), written(c)); } };
    }
    let cur = ctx, help = 0;
    const input = h("input", { class: "pk-input", maxlength: LONGEST, autocomplete: "off", spellcheck: "false", enterkeyhint: "send", placeholder: "Its title", "aria-label": "Your title" });
    const note = h("p", { class: "gl-problem", role: "status" });
    const send = t => {
      const problem = titleProblem(t, a.title);
      note.textContent = problem;
      if (problem) return;
      cur.send({ round: s.round, piece: s.at, t: shownTitle(t) });
    };
    input.value = shownTitle(sentBy(cur, s, cur.me.uid)?.t);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(input.value); } });
    const go = button("Send", () => send(input.value), { cls: "gl-send" });
    // the house's titles, a different one each tap, never the real one or one already dealt
    const spare = shuffle(TITLES.filter(t => !s.dealt.includes(t)), Math.random);
    const mine = h("p", { class: "pk-line gl-mine" });
    side.append(h("div", { class: "sk-row" }, input, go), note, mine,
      button("Title for me", () => { input.value = spare[help++ % spare.length]; send(input.value); }, { primary: false, cls: "wh-help" }), clock, wait);
    return {
      update(c) {
        cur = c;
        const t = shownTitle(sentBy(c, s, c.me.uid)?.t);
        mine.replaceChildren(...(t ? ["Your title: ", h("strong", { class: "gl-caps" }, t)] : []));
        go.textContent = t ? "Change" : "Send";
        wait.textContent = waitingFor(writers(c), written(c));
      },
    };
  },

  pick(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), a = s.art[s.at], wait = h("p", { class: "pk-wait" });
    const list = h("div", { class: "gl-opts", role: "radiogroup", "aria-label": "The titles" });
    stage.append(h("div", { class: "dr-wrap gl-pick" }, ...hung(s, nameOf),
      h("div", { class: "dr-side gl-side" }, h("p", { class: "pk-ask" }, role === "artist" ? "Which will they pick?" : role === "player" ? "Which is the real title?" : "They're picking…"),
        list, countdown(s.deadline, ctx.now, { total: PICK_MS }), wait)));
    let cur = ctx;
    const pickers = c => playing(c, s).filter(p => p.uid !== a.by);
    return {
      update(c) {
        cur = c;
        const picked = sentBy(c, s, c.me.uid)?.pick;
        list.replaceChildren(...s.opts.map((o, i) => {
          const own = o.by.includes(c.me.uid);
          return h("button", { type: "button", role: "radio", class: `gl-opt${own ? " own" : ""}`, "aria-checked": String(picked === i), disabled: own || role !== "player",
            onclick: () => cur.send({ round: s.round, piece: s.at, pick: i }) }, h("span", { class: "gl-caps" }, o.text), own ? h("span", { class: "gl-tag" }, "Yours") : null);
        }));
        wait.textContent = waitingFor(pickers(c), pickers(c).map(p => p.uid).filter(u => Number.isInteger(sentBy(c, s, u)?.pick)));
      },
    };
  },

  reveal(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), a = s.art[s.at], me = ctx.me.uid, gain = s.gained[me] || 0;
    const rows = h("ul", { class: "gl-reveal" }, ...s.opts.map((o, i) => {
      const who = Object.keys(s.picks).filter(u => s.picks[u] === i).map(nameOf);
      return h("li", { class: `${o.truth ? "truth" : o.house ? "house" : "lie"}${s.picks[me] === i ? " picked" : ""}` }, h("span", { class: "gl-caps" }, o.text),
        h("span", { class: "gl-line" }, h("b", {}, o.truth ? `The real title, ${nameOf(a.by)}'s` : o.house ? "The house's" : `${names(o.by.map(nameOf))}'s`),
          who.length || o.truth ? ` · ${who.length ? `${o.truth ? "found by" : "fooled"} ${names(who)}` : "nobody found it"}` : ""));
    }));
    let cur = ctx;
    const next = role === "watcher" ? null : button(s.at + 1 < s.art.length ? "Next drawing" : s.round + 1 < s.rounds ? "Next round" : "See the scores", () => {
      cur.send({ round: s.round, piece: s.at, next: true }); next.disabled = true; next.textContent = "Waiting for the others…"; }, { primary: false });
    // what you scored beside the drawing's name, so the titles below have the room
    const [head, box] = hung(s, nameOf);
    if (role !== "watcher") head.querySelector(".sk-top").append(h("span", { class: `gl-gain${gain ? " up" : ""}`, "aria-label": `You scored ${pts(gain)}` }, `+${pts(gain)}`));
    stage.append(h("div", { class: "dr-wrap gl-pick gl-shown" }, head, box,
      h("div", { class: "dr-side gl-side" }, rows, countdown(s.deadline, ctx.now, { total: s.span || revealMs(s.opts.length) }), next,
        h("div", { class: "sk-board fit-scroll" }, scoreList(s.order.map(u => ({ uid: u, name: nameOf(u), score: s.scores[u] || 0, note: s.gained[u] ? `+${pts(s.gained[u])}` : "" })))))));
    return { update(c) { cur = c; } };
  },

  over(stage, s, role, ctx) {
    // the winners, everyone's points, and the gallery itself: each drawing with its real title
    const nameOf = nameIn(ctx, s);
    stage.append(h("div", { class: "dr-wrap sk-over gl-over" },
      h("div", { class: "pk-verdict big" }, s.winners?.length ? `${names(s.winners.map(nameOf))} ${s.winners.length > 1 ? "win" : "wins"}` : "Nobody scored"),
      h("div", { class: "fit-grow fit-scroll gl-end" },
        scoreList(s.order.map(u => ({ uid: u, name: nameOf(u), score: s.scores[u] || 0 })), { winners: s.winners || [] }),
        h("ul", { class: "gl-wall" }, ...s.art.map(a => h("li", {}, picture(a.d, { label: a.title }).el, h("span", { class: "gl-caps" }, a.title), h("span", { class: "gl-by" }, nameOf(a.by))))))));
    return {};
  },
};
