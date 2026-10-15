// Sketch, the drawing game of guessing (Pictionary's, as phones play it): in turn round the table one player chooses a
// word from three and draws it on their phone, everyone else watching it appear on theirs and typing guesses. The
// sooner a right guess, the more it scores; the one drawing scores what the guessers scored on average, so a drawing
// only one of them gets scores little. As the clock runs down, letters of the word show. Each player draws once a
// round; the most points wins.
import { WORDS } from "./party-draw-words.js";
import { h, button, countdown, scoreList, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { createPad, picture, sender, keep, decode, guessIs, guessNear } from "./party-draw.js";

const CHOOSE_MS = 15000;              // to choose a word, before the phone chooses
const SHOW_MS = 7000;                 // the word and its drawing stand this long after a turn
const LATE_MS = 800;                  // a guess typed as the clock ran out reaches the table a moment later and counts
export const POINTS = { soon: 300, late: 50 };       // a right guess at once, and on the bell
export const LEVELS = { easy: [1, 1, 1], mixed: [1, 2, 3], hard: [2, 3, 3] };
const BY_ID = new Map(WORDS.map(w => [w.id, w]));

// ---------- words and guesses ----------
/** A word as the table plays it: what the one drawing sees (in the table's language), and every answer taken as right. */
export function wordFor(id, lang) {
  const w = BY_ID.get(id);
  if (!w) return { show: "", say: "", answers: [] };
  return { show: lang === "zh" ? w.zh[0] : lang === "both" ? `${w.zh[0]} · ${w.en[0]}` : w.en[0], say: w.en[0], answers: [...w.en, ...w.zh] };
}
const isLetter = ch => /[\p{L}\p{N}]/u.test(ch);
/** Where the letters are in what's shown, so a hint knows which it can give away. */
export const letterPlaces = text => [...text].flatMap((ch, i) => (isLetter(ch) ? [i] : []));
/**
 * The word as the guessers see it: a blank for each letter, the rest as it is (a space, a hyphen, the dot between the
 * languages); half way through the clock one letter shows, three quarters through a second (a word of five or more).
 */
export function hintOf(s, now) {
  const text = [...wordFor(s.word, s.lang).show], places = letterPlaces(text.join(""));
  const gone = s.span ? (now - s.started) / s.span : 0;
  const n = Math.min(gone >= 0.75 ? 2 : gone >= 0.5 ? 1 : 0, Math.floor(places.length / 3), places.length >= 5 ? 2 : 1);
  const open = new Set((s.reveal || []).slice(0, n));
  return text.map((ch, i) => (!isLetter(ch) ? ch : open.has(i) ? ch : "_")).join("");
}
/** What a right guess scores: the most at once, the least on the bell, in fives. */
export const pointsFor = (left, span) => Math.round((POINTS.late + ((POINTS.soon - POINTS.late) * Math.max(0, Math.min(1, left / span)))) / 5) * 5;
/** A guesser's guesses, as the database may give them back (a list with holes). */
const guessesOf = v => (v?.g ? Object.values(v.g).filter(x => x && typeof x.t === "string") : []);

// ---------- the game ----------
const whole = s => {
  for (const k of ["order", "offer", "reveal", "dealt"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.names ||= {}; s.scores ||= {}; s.got ||= {};
  if (s.last) s.last.got = s.last.got ? Object.values(s.last.got) : [];
  return s;
};
const guessersOf = (s, here) => s.order.filter(u => u !== s.drawer && here.has(u));

/** Three words for the one drawing, at the game's levels, none dealt this game, those the party hasn't drawn first. */
function deal(s, rng, shown) {
  const was = new Map(shown.map((id, i) => [id, i])), dealt = new Set(s.dealt);
  s.offer = LEVELS[s.level].map(level => {
    const pool = shuffle(WORDS.filter(w => w.level === level && !dealt.has(w.id)), rng);
    // the party's oldest drawing again only when it has drawn them all
    const w = pool.find(x => !was.has(x.id)) || pool.sort((a, b) => was.get(a.id) - was.get(b.id))[0] || WORDS[0];
    dealt.add(w.id);
    return w.id;
  });
  s.dealt = [...dealt];
}
/** The next turn: the next player round the table still here, a new round after the last; the game over after the last round. */
function nextTurn(s, players, rng, now, shown) {
  const here = new Set(players.map(p => p.uid)), n = s.order.length, nameOf = u => s.names[u] || "Someone", was = s.round;
  let tries = n + 1;
  do {
    s.at++;
    if (s.at >= n) { s.at = 0; s.round++; }
  } while (s.round < s.rounds && !here.has(s.order[s.at]) && --tries > 0);
  if (s.round >= s.rounds || tries <= 0 || !here.size) return finish(s, nameOf);
  s.turn++;
  s.drawer = s.order[s.at];
  s.step = "choose";
  s.got = {};
  delete s.word;
  deal(s, rng, shown);
  s.deadline = now + CHOOSE_MS;
  return `${s.round !== was ? `Round ${s.round + 1}. ` : ""}${nameOf(s.drawer)} draws${s.turn === 1 ? " first" : " next"}: choose your word.`;
}
function finish(s, nameOf) {
  s.step = "over";
  delete s.deadline;
  const top = Math.max(0, ...s.order.map(u => s.scores[u] || 0));
  s.winners = top > 0 ? s.order.filter(u => (s.scores[u] || 0) === top) : [];
  return `That's the game. ${s.winners.length ? `${names(s.winners.map(nameOf))} ${s.winners.length > 1 ? "win" : "wins"}, with ${top.toLocaleString("en-GB")} points.` : "Nobody scored."}`;
}
/** The turn over: the guessers' points stand, the one drawing scores their average, and the drawing is kept to show. */
function endTurn(s, inputs, players, now, why = "") {
  const here = new Set(players.map(p => p.uid)), nameOf = u => s.names[u] || "Someone";
  const guessers = guessersOf(s, here), got = Object.entries(s.got).sort((a, b) => a[1].at - b[1].at);
  const drew = guessers.length ? Math.round(got.reduce((t, [, g]) => t + g.pts, 0) / guessers.length / 5) * 5 : 0;
  s.gained = Object.fromEntries(got.map(([u, g]) => [u, g.pts]));
  if (drew) s.gained[s.drawer] = drew;
  for (const [u, p] of Object.entries(s.gained)) s.scores[u] = (s.scores[u] || 0) + p;
  const d = inputs[s.drawer]?.turn === s.turn ? String(inputs[s.drawer].d || "") : "";
  s.last = { by: s.drawer, word: s.word, d, got: got.map(([u]) => u), drew };
  s.step = "show";
  s.deadline = now + SHOW_MS;
  const word = wordFor(s.word, s.lang).say;
  return why || (got.length ? `The word was ${word}. ${names(got.map(([u]) => nameOf(u)))} got it.` : `Nobody got it: the word was ${word}.`);
}

export default {
  id: "sketch",
  name: "Sketch",
  min: 2,
  max: 12,
  css: "party-draw.css",
  keepsView: true,
  blurb: "Draw a word on your phone while the others guess it on theirs: the sooner they get it, the more you both score.",
  rules: [
    "In turn round the table, one player draws. They choose one of three words and draw it on their phone, in a minute and twenty seconds (or the time the lobby set), with a choice of inks and pens, an eraser and undo; everyone else watches the drawing appear on their own phone and types guesses, as many as they like. No letters or numbers in the drawing: that's the one rule the phone can't keep for you.",
    "A right guess scores 300 at once, falling to 50 on the bell, and the one drawing scores what the guessers scored on average, so a drawing that only one of them gets scores little. Your wrong guesses show to the others; a near miss is shown only to you, as close. Half way through the clock a letter of the word shows, three quarters through another. When everyone has it, or the time's up, the word is shown with its drawing and who got it.",
    "Each player draws once a round, for one, two or three rounds; the most points wins. The words are in English, Chinese or both, and a guess in either language counts.",
  ],
  options: [
    { id: "lang", label: "Words", choices: [["en", "English"], ["zh", "中文"], ["both", "Both"]], value: "en" },
    { id: "level", label: "Difficulty", choices: [["easy", "Easy"], ["mixed", "Mixed"], ["hard", "Hard"]], value: "mixed" },
    { id: "rounds", label: "Rounds", choices: [["1", "1"], ["2", "2"], ["3", "3"]], value: "2" },
    { id: "secs", label: "Time to draw", choices: [["60", "1 minute"], ["80", "80 seconds"], ["120", "2 minutes"]], value: "80" },
  ],

  start({ players, options, rng, now, shown }) {
    const s = {
      lang: ["en", "zh", "both"].includes(options.lang) ? options.lang : "en",
      level: LEVELS[options.level] ? options.level : "mixed",
      rounds: Math.min(3, Math.max(1, Number(options.rounds) || 2)),
      secs: [60, 80, 120].includes(Number(options.secs)) ? Number(options.secs) : 80,
      order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])),
      scores: Object.fromEntries(players.map(p => [p.uid, 0])), round: 0, at: -1, turn: 0, dealt: [],
    };
    s.say = `Sketch: ${s.rounds === 1 ? "one round" : `${s.rounds} rounds`}. ${nextTurn(s, players, rng, now, shown || [])}`;
    return s;
  },

  advance(state, { players, inputs, now, rng, shown }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid)), nameOf = u => s.names[u] || "Someone";
    const mine = u => (inputs[u]?.turn === s.turn ? inputs[u] : null);
    if (s.step === "choose") {
      if (!here.has(s.drawer)) return { state: s, say: `${nameOf(s.drawer)} has gone. ${nextTurn(s, players, rng, now, shown)}` };
      const pick = mine(s.drawer)?.pick;
      const chosen = Number.isInteger(pick) && s.offer[pick] ? pick : now >= s.deadline ? Math.floor(rng() * s.offer.length) : null;
      if (chosen === null) return null;
      s.word = s.offer[chosen];
      s.step = "draw";
      s.started = now;
      s.span = s.secs * 1000;
      s.deadline = now + s.span;
      s.reveal = shuffle(letterPlaces(wordFor(s.word, s.lang).show), rng);
      s.got = {};
      return { state: s, say: `${nameOf(s.drawer)} is drawing. Guess away!`, show: [s.word] };
    }
    if (s.step === "draw") {
      if (!here.has(s.drawer)) return { state: s, say: endTurn(s, inputs, players, now, `${nameOf(s.drawer)} has gone: the word was ${wordFor(s.word, s.lang).say}.`) };
      // who has guessed it since the table last looked, each at the moment they typed it (on the table's clock)
      const { answers } = wordFor(s.word, s.lang), fresh = [];
      for (const u of guessersOf(s, here)) {
        if (s.got[u]) continue;
        const right = guessesOf(mine(u)).find(g => guessIs(g.t, answers) && Number(g.at) <= s.deadline + LATE_MS);
        if (!right) continue;
        const at = Math.min(Math.max(Number(right.at) || now, s.started), s.deadline);
        s.got[u] = { at, pts: pointsFor(s.deadline - at, s.span) };
        fresh.push(u);
      }
      const all = guessersOf(s, here).every(u => s.got[u]);
      if (all || now >= s.deadline) return { state: s, say: endTurn(s, inputs, players, now, all && guessersOf(s, here).length > 1 ? `Everyone got it: ${wordFor(s.word, s.lang).say}.` : "") };
      if (!fresh.length) return null;
      return { state: s, say: `${names(fresh.map(nameOf))} got it.` };
    }
    if (s.step === "show") {
      if (now < s.deadline) return null;
      return { state: s, say: nextTurn(s, players, rng, now, shown) };
    }
    return null;
  },

  wakeAt: s => (["choose", "draw", "show"].includes(s.step) ? s.deadline ?? null : null),

  view(stage, ctx) {
    const s = whole(structuredClone(ctx.state)), me = ctx.me.uid;
    const role = s.step === "over" ? "" : s.drawer === me ? "drawer" : s.order.includes(me) ? "guesser" : "watcher";
    keep(stage, `${s.step}:${s.turn}:${role}`, ctx, () => SCREENS[s.step](stage, s, role, ctx));
  },
};

// ---------- the screens ----------
// Each built once for its step, turn and part, then updated where it stands as the table changes (party.js keeps the
// stage), so the pad under a finger and the box being typed in are never rebuilt.
const nameIn = (ctx, s) => u => ctx.players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
const pts = n => (n || 0).toLocaleString("en-GB");
const board = (s, nameOf, opts = {}) => scoreList(s.order.map(u => ({ uid: u, name: nameOf(u), score: s.scores[u] || 0, note: opts.note?.(u) || "" })), { winners: opts.winners || [] });
const TAGS = { 1: "Easy", 2: "Medium", 3: "Hard" };
const SCREENS = {
  choose(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), clock = countdown(s.deadline, ctx.now, { total: CHOOSE_MS });
    if (role !== "drawer") {
      stage.append(h("div", { class: "dr-wrap sk-choose" }, h("p", { class: "pk-ask" }, `${nameOf(s.drawer)} is choosing a word…`), clock,
        h("div", { class: "sk-board fit-grow fit-scroll" }, board(s, nameOf, { note: u => (u === s.drawer ? "drawing next" : "") }))));
      return {};
    }
    let cur = ctx, sent = null;
    const btns = s.offer.map((id, i) => h("button", { type: "button", class: "sk-word", onclick: () => { if (sent !== null) return; sent = i; cur.send({ pick: i, turn: s.turn }); mark(); } },
      h("span", { class: "sk-word-text" }, wordFor(id, s.lang).show), h("span", { class: "sk-word-tag" }, TAGS[BY_ID.get(id)?.level] || "")));
    const mark = () => btns.forEach((b, i) => { b.setAttribute("aria-pressed", String(sent === i)); b.disabled = sent !== null && sent !== i; });
    stage.append(h("div", { class: "dr-wrap sk-choose" }, h("p", { class: "pk-ask" }, "Choose what to draw"), h("div", { class: "sk-words" }, ...btns), clock,
      h("p", { class: "pk-wait" }, "Nobody else sees them. If the clock runs out, the phone chooses for you.")));
    return { update(c) { cur = c; } };
  },

  draw(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), word = wordFor(s.word, s.lang);
    const top = h("div", { class: "sk-top" }), status = h("span", { class: "sk-count" });
    const box = h("div", { class: "dr-box fit-grow fit-box" }), under = h("div", { class: "sk-under" });
    const feed = h("ol", { class: "sk-feed", "aria-label": "Guesses" });
    stage.append(h("div", { class: "dr-wrap sk-draw" },
      h("div", { class: "dr-head" }, top, h("div", { class: "sk-clock" }, countdown(s.deadline, ctx.now, { total: s.span }), status)),
      box, h("div", { class: "dr-side" }, under, feed)));
    let cur = ctx, timer = 0, noteTimer = 0, pad = null, pic = null, flow = null, mine = [], gotIt = false;
    const note = text => { clearTimeout(noteTimer); status.textContent = text; noteTimer = setTimeout(() => { noteTimer = 0; update(cur); }, 3000); };
    const sentBy = u => (cur.inputs[u]?.turn === s.turn ? cur.inputs[u] : null);
    const guessers = () => s.order.filter(u => u !== s.drawer && cur.players.some(p => p.uid === u));

    if (role === "drawer") {
      // your pad: what you draw goes to the table as you draw it (and comes back to the pad after a reload)
      top.append(h("span", { class: "sk-label" }, "Draw"), h("span", { class: "sk-word-big" }, word.show));
      flow = sender(d => cur.send({ d, turn: s.turn }), () => pad.text());
      pad = createPad({ strokes: decode(sentBy(cur.me.uid)?.d), onChange: why => (why === "full" ? note("The page is full: undo to make room") : flow.push(why !== "move")) });
      box.append(pad.paper);
      under.append(pad.tools);
    } else {
      pic = picture("", { label: `${nameOf(s.drawer)}'s drawing` });
      box.append(pic.el);
      const hint = h("span", { class: "sk-hint", "aria-label": "The word" });
      top.append(h("span", { class: "sk-label" }, `${nameOf(s.drawer)} draws`), hint);
      const paintHint = () => { hint.textContent = gotIt ? word.show : hintOf(s, cur.now()); hint.className = gotIt ? "sk-word-big" : "sk-hint"; };
      paintHint();
      // the letters as the clock runs down; stopped by leave(), or once the page has gone (the game ended under it)
      timer = setInterval(() => (hint.isConnected ? paintHint() : clearInterval(timer)), 500);
      if (role === "guesser") {
        mine = guessesOf(sentBy(cur.me.uid));
        const input = h("input", { class: "pk-input sk-input", maxlength: 40, autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "send",
          placeholder: "Your guess", "aria-label": "Your guess" });
        const says = h("p", { class: "sk-says", role: "status" });
        const go = () => {
          const t = input.value.replace(/\s+/g, " ").trim().slice(0, 40);
          if (!t || mine.length >= 80) return;
          input.value = "";
          mine.push({ t, at: Math.round(cur.now()) });
          cur.send({ g: mine, turn: s.turn });
          // a near miss said in the box too, where it shows with the keyboard up (the line under it may be covered)
          const near = guessNear(t, word.answers);
          says.textContent = near ? `${t}: close!` : "";
          says.classList.toggle("near", near);
          input.placeholder = near ? `${t}: close!` : "Your guess";
          update(cur);
        };
        input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
        under.append(h("div", { class: "sk-row" }, input, button("Guess", go, { cls: "sk-go" })), says);
      } else under.append(h("p", { class: "pk-line" }, "You joined mid-game: watch this one."));
    }

    // every guess at the table, oldest first: a right one as "got it", a near miss only to whoever may know the word
    function drawFeed(st) {
      const all = [];
      for (const [u, v] of Object.entries(cur.inputs)) if (v.turn === s.turn) for (const g of guessesOf(v)) all.push({ u, t: g.t, at: Number(g.at) || 0 });
      all.sort((a, b) => a.at - b.at);
      const knows = role !== "guesser" || gotIt, rows = [];
      for (const g of all) {
        const right = guessIs(g.t, word.answers), near = !right && guessNear(g.t, word.answers), self = g.u === cur.me.uid;
        if (right) { if (!rows.some(r => r.u === g.u && r.right)) rows.push({ u: g.u, right: true }); continue; }
        if (near && !knows && !self) continue;
        rows.push({ u: g.u, t: g.t, near: near && (knows || self) });
      }
      feed.replaceChildren(...rows.slice(-12).map(r => h("li", { class: r.right ? "right" : r.near ? "near" : "" }, h("b", {}, nameOf(r.u)),
        r.right ? " got it" : ` ${r.t}`, r.near ? h("span", { class: "sk-near" }, "close") : null)));
      feed.scrollTop = feed.scrollHeight;
    }
    function update(c) {
      cur = c;
      const st = whole(structuredClone(c.state)), n = guessers().length, got = guessers().filter(u => st.got[u]).length;
      if (!noteTimer) status.textContent = n ? `${got} of ${n} ${got === 1 && n > 1 ? "has" : "have"} it` : "";
      pic?.set(sentBy(s.drawer)?.d);
      if (role === "guesser" && !gotIt && (st.got[c.me.uid] || mine.some(g => guessIs(g.t, word.answers)))) {
        // you have it: the word in place of the box, and what it scored once the table has it
        gotIt = true;
        under.replaceChildren(h("p", { class: "sk-got" }, "You got it: ", h("strong", {}, word.show)));
      }
      if (gotIt && st.got[c.me.uid] && !under.querySelector(".sk-got b")) under.querySelector(".sk-got")?.append(h("b", {}, ` +${pts(st.got[c.me.uid].pts)}`));
      drawFeed(st);
    }
    return { update, leave() { clearInterval(timer); clearTimeout(noteTimer); flow?.flush(); flow?.stop(); pad?.enable(false); } };
  },

  show(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), last = s.last || { got: [] }, word = wordFor(last.word, s.lang);
    const pic = picture(last.d, { label: `${nameOf(last.by)}'s drawing of ${word.show}` });
    const gains = h("ul", { class: "sk-gains" },
      ...last.got.map(u => h("li", { class: u === ctx.me.uid ? "me" : "" }, nameOf(u), h("b", {}, `+${pts(s.gained?.[u])}`))),
      last.drew ? h("li", { class: `drew${last.by === ctx.me.uid ? " me" : ""}` }, `${nameOf(last.by)}, drawing`, h("b", {}, `+${pts(last.drew)}`)) : null);
    stage.append(h("div", { class: "dr-wrap sk-show" },
      h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, `${nameOf(last.by)} drew`), h("strong", { class: "sk-word-big" }, word.show))),
      h("div", { class: "dr-box fit-grow fit-box" }, pic.el),
      h("div", { class: "dr-side" }, last.got.length ? gains : h("p", { class: "pk-line sk-none" }, "Nobody got it."), countdown(s.deadline, ctx.now, { total: SHOW_MS }),
        h("div", { class: "sk-board fit-scroll" }, board(s, nameOf)))));
    return {};
  },

  over(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s);
    stage.append(h("div", { class: "dr-wrap sk-over" },
      h("div", { class: "pk-verdict big" }, s.winners?.length ? `${names(s.winners.map(nameOf))} ${s.winners.length > 1 ? "win" : "wins"}` : "Nobody scored"),
      h("div", { class: "sk-board fit-grow fit-scroll" }, board(s, nameOf, { winners: s.winners || [] }))));
    return {};
  },
};
