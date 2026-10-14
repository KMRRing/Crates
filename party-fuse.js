// Fuse, the word game of a bomb passed round the table (the mechanics of word-bomb games): the player holding the bomb
// must type a word holding the letters it shows (ING: bringing, kingdom), one nobody has played this game; a word that
// counts passes the bomb on, with new letters, to the next player. The bomb goes off after a time nobody can see; whoever
// holds it then loses a life. Use every letter of the alphabet's common twenty-one in your words and win a life back.
// The last player with a life wins.
import { WORDS, PROMPTS } from "./party-fuse-words.js";
import { h, button, names } from "./party-kit.js";

export const LEVELS = ["easy", "medium", "hard"];
/** How long a bomb burns, in seconds, at random between these: long enough for a word or two, never the same. */
export const FUSES = { short: [7, 15], normal: [10, 25], long: [15, 40] };
/** The letters of the alphabet bonus: all but the rare ones (j and q are hard enough). */
export const BONUS = "abcdefghijlmnopqrstuv";
const BOOM_MS = 4500;

let dict = null;
/** The dictionary, decoded once (a set of 79,205 words: building it takes a moment, so only when first needed). */
export function dictionary() {
  if (dict) return dict;
  dict = new Set();
  let word = "", i = 0;
  while (i < WORDS.length) {
    const keep = WORDS.charCodeAt(i++) - 48;
    let j = i;
    while (j < WORDS.length && WORDS.charCodeAt(j) >= 97) j++;
    word = word.slice(0, keep) + WORDS.slice(i, j);
    dict.add(word);
    i = j;
  }
  return dict;
}
const clean = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
/** What's wrong with a word for these letters, in words, or "" for a word that counts. */
export function wordProblem(text, prompt, used = []) {
  const w = clean(text);
  if (!w) return "Type a word.";
  if (!w.includes(prompt)) return `No ${prompt.toUpperCase()} in it.`;
  if (used.includes(w)) return "Played already.";
  if (!dictionary().has(w)) return "Not in the dictionary.";
  return "";
}
/** A few words that would have done (the shortest, so the likeliest known), for after the bomb goes off. */
export function examples(prompt, used = [], n = 3) {
  const out = [];
  for (const w of dictionary()) if (w.includes(prompt) && !used.includes(w)) out.push(w);
  return out.sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).slice(0, n);
}
const shown = { key: "", words: [] };
const examplesOnce = (prompt, used) => { const key = `${prompt}:${used.length}`; if (shown.key !== key) Object.assign(shown, { key, words: examples(prompt, used) }); return shown.words; };

// ---------- the game ----------
const whole = s => {
  for (const k of ["order", "used", "winners"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.lives ||= {}; s.letters ||= {}; s.names ||= {}; s.played ||= {};
  return s;
};
const alive = (s, here) => s.order.filter(u => (s.lives[u] || 0) > 0 && (!here || here.has(u)));
/** The next player round the table after this one who still has a life (and is still here). */
function nextAfter(s, from, here) {
  const n = s.order.length, at = s.order.indexOf(from);
  for (let k = 1; k <= n; k++) { const u = s.order[(at + k) % n]; if ((s.lives[u] || 0) > 0 && here.has(u)) return u; }
  return null;
}
function newPrompt(s, rng) {
  const list = PROMPTS[s.level] || PROMPTS.medium;
  let p = s.prompt;
  for (let i = 0; i < 6 && p === s.prompt; i++) p = list[Math.floor(rng() * list.length)];
  return p;
}
/** A new bomb, lit, in a player's hands. */
function light(s, holder, now, rng, nameOfU) {
  const [lo, hi] = FUSES[s.fuse] || FUSES.normal;
  s.step = "play";
  s.holder = holder;
  s.prompt = newPrompt(s, rng);
  s.ends = now + Math.round((lo + rng() * (hi - lo)) * 1000);
  s.tn = (s.tn || 0) + 1;
  s.bombs = (s.bombs || 0) + 1;
  delete s.deadline; delete s.boom;
  return `${nameOfU(holder)} has the bomb: ${s.prompt.toUpperCase().split("").join("-")}.`;
}

export default {
  id: "fuse",
  name: "Fuse",
  min: 2,
  max: 12,
  css: "party-fuse.css",
  blurb: "Type a word with the letters on the bomb before it goes off, and pass it on.",
  rules: [
    "The bomb goes round the table. Whoever holds it types a word with its letters in it, together and in order: for ING, bringing or kingdom. A word counts if it's in the dictionary and nobody has played it this game; it passes the bomb, with new letters, to the next player.",
    "The bomb goes off after a time nobody can see. Whoever holds it then loses a life; the next player gets a new bomb. Out of lives, you're out. The last player with a life wins.",
    "Use every one of the alphabet's common letters (all but k, w, x, y and z) in the words you play, and you win a life back (never more than you started with); your letters show under the bomb.",
  ],
  options: [
    { id: "level", label: "Letters", choices: [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], value: "medium" },
    { id: "lives", label: "Lives", choices: [["2", "2"], ["3", "3"], ["4", "4"]], value: "3" },
    { id: "fuse", label: "Fuse", choices: [["short", "Short"], ["normal", "Normal"], ["long", "Long"]], value: "normal" },
  ],

  start({ players, options, rng, now }) {
    const lives = [2, 3, 4].includes(Number(options.lives)) ? Number(options.lives) : 3;
    const s = { level: LEVELS.includes(options.level) ? options.level : "medium", fuse: FUSES[options.fuse] ? options.fuse : "normal", start: lives,
      order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])), lives: Object.fromEntries(players.map(p => [p.uid, lives])),
      used: [], tn: 0 };
    const nameOfU = u => s.names[u] || "Someone";
    s.say = `Fuse: ${lives} lives each. ${light(s, players[Math.floor(rng() * players.length)].uid, now, rng, nameOfU)}`;
    return s;
  },

  advance(state, { players, inputs, now, rng }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const finish = say => {
      s.step = "over";
      delete s.deadline;
      s.winners = alive(s, here);
      const best = Object.entries(s.played).sort((a, b) => b[1] - a[1])[0];
      return { state: s, say: `${say} ${s.winners.length ? `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}!` : "Nobody's left."}${best ? ` Most words: ${nameOfU(best[0])}, ${best[1]}.` : ""}` };
    };
    if (s.step === "play") {
      if (alive(s, here).length <= 1) return finish("Everyone else has gone.");
      if (now >= s.ends) {
        // the bomb goes off in the holder's hands
        const u = s.holder;
        s.lives[u] = Math.max(0, (s.lives[u] || 0) - 1);
        s.boom = { uid: u, prompt: s.prompt, out: s.lives[u] === 0 };
        const say = `Boom! ${nameOfU(u)} ${s.lives[u] ? `loses a life: ${s.lives[u]} left.` : "is out."}`;
        if (alive(s, here).length <= 1) return finish(say);
        s.step = "boom";
        s.deadline = now + BOOM_MS;
        return { state: s, say };
      }
      if (!here.has(s.holder)) {
        // the holder has gone: the bomb passes on, its time still running
        s.holder = nextAfter(s, s.holder, here);
        s.tn++;
        return { state: s };
      }
      const said = inputs[s.holder];
      if (!said || said.tn !== s.tn || !said.word || wordProblem(said.word, s.prompt, s.used)) return null;
      const w = clean(said.word);
      s.used.push(w);
      s.played[s.holder] = (s.played[s.holder] || 0) + 1;
      if (!s.longest || w.length > s.longest.word.length) s.longest = { uid: s.holder, word: w };
      s.last = { uid: s.holder, word: w };
      // the alphabet bonus: every common letter used wins a life back, and the count starts again
      const got = [...new Set((s.letters[s.holder] || "") + [...w].filter(c => BONUS.includes(c)).join(""))].sort().join("");
      let say;
      if (got.length === BONUS.length) {
        s.letters[s.holder] = "";
        if (s.lives[s.holder] < s.start) { s.lives[s.holder]++; say = `${nameOfU(s.holder)} has used every letter: a life back!`; }
        else say = `${nameOfU(s.holder)} has used every letter.`;
      } else s.letters[s.holder] = got;
      s.holder = nextAfter(s, s.holder, here);
      s.prompt = newPrompt(s, rng);
      s.tn++;
      return say ? { state: s, say } : { state: s };
    }
    if (s.step === "boom") {
      if (now < s.deadline) return null;
      if (alive(s, here).length <= 1) return finish("");
      return { state: s, say: light(s, nextAfter(s, s.boom.uid, here), now, rng, nameOfU) };
    }
    return null;
  },

  wakeAt: state => (state.step === "play" ? state.ends ?? null : state.step === "boom" ? state.deadline ?? null : null),

  view(stage, ctx) {
    const { me, players, inputs } = ctx, s = whole(structuredClone(ctx.state));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const here = new Set(players.map(p => p.uid)), mine = s.holder === me.uid && s.step === "play", playing = s.order.includes(me.uid);
    // the table: everyone's lives, the bomb by whoever holds it
    const table = h("ul", { class: "fz-table" }, ...s.order.map(u => h("li", { class: `${u === s.holder && s.step !== "over" ? "holds" : ""}${(s.lives[u] || 0) <= 0 ? " out" : ""}${!here.has(u) ? " gone" : ""}${u === me.uid ? " me" : ""}` },
      h("span", { class: "fz-name" }, nameOfU(u)), h("span", { class: "fz-lives", "aria-label": `${s.lives[u] || 0} lives` }, "♥".repeat(Math.max(0, s.lives[u] || 0)) || "out"))));
    if (mine && buzzed !== `${ctx.seq}:${s.tn}`) { buzzed = `${ctx.seq}:${s.tn}`; if (navigator.userActivation?.hasBeenActive !== false) try { navigator.vibrate?.(60); } catch { /* not every phone can */ } }
    let bomb = null;
    const act = [], after = [];
    if (s.step === "play" || s.step === "boom") {
      const prompt = s.step === "boom" ? s.boom?.prompt : s.prompt;
      bomb = h("div", { class: `fz-bomb${s.step === "boom" ? " boom" : ""}${mine ? " mine" : ""}` }, bombArt(), h("span", { class: "fz-prompt" }, (prompt || "").toUpperCase()));
    }
    if (s.step === "play") {
      if (mine) {
        const input = h("input", { class: "pk-input fz-input", maxlength: 30, autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false",
          placeholder: `A word with ${s.prompt.toUpperCase()}`, "aria-label": "Your word", enterkeyhint: "send" });
        // why a word didn't count stays said through the redraws your own typing causes, until you type again
        const noteKey = `${ctx.seq}:${s.tn}`;
        const note = h("p", { class: "fz-note", role: "status" }, live.note.key === noteKey ? live.note.text : "");
        const say = text => { live.note = { key: noteKey, text }; note.textContent = text; };
        const go = () => {
          const problem = wordProblem(input.value, s.prompt, s.used);
          if (problem) { say(problem); input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake"); return; }
          ctx.send({ word: clean(input.value), tn: s.tn });
        };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        // the others watch you type: what's in the box goes out a few times a second
        live.input = input;
        input.addEventListener("input", () => {
          say("");
          if (live.timer) return;
          live.timer = setTimeout(() => { live.timer = 0; ctx.send({ typing: clean(live.input?.value).slice(0, 30), tn: s.tn }); }, 250);
        });
        ctx.keep(input, `word${s.tn}`);
        act.push(h("p", { class: "pk-ask fz-turn" }, "Your turn!"), h("div", { class: "fz-row" }, input, button("Go", go)), note);
      } else {
        const typing = inputs[s.holder]?.tn === s.tn ? inputs[s.holder].typing || "" : "";
        act.push(h("p", { class: "fz-typing", "aria-live": "off" }, h("span", { class: "fz-who" }, nameOfU(s.holder)), h("span", { class: "fz-typed" }, typing.toUpperCase(), h("span", { class: "fz-caret", "aria-hidden": "true" }))));
      }
      if (s.last) after.push(h("p", { class: "fz-last" }, `${nameOfU(s.last.uid)} played `, h("strong", {}, s.last.word.toUpperCase())));
    } else if (s.step === "boom") {
      const b = s.boom || {};
      act.push(h("div", { class: "fz-banner", role: "alert" }, h("strong", {}, "Boom!"), h("span", {}, `${nameOfU(b.uid)} ${b.out ? "is out" : `loses a life: ${s.lives[b.uid]} left`}`)));
      const ex = examplesOnce(b.prompt || "", s.used);
      if (ex.length) after.push(h("p", { class: "fz-last" }, "It could have been ", ...ex.flatMap((w, i) => [i ? (i === ex.length - 1 ? " or " : ", ") : "", h("strong", {}, w.toUpperCase())])));
    } else if (s.step === "over") {
      act.push(h("div", { class: "pk-verdict big" }, s.winners.length ? `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}` : "Nobody's left"));
      act.push(h("ol", { class: "fz-stats" }, ...s.order.map(u => h("li", {}, h("span", {}, nameOfU(u)), h("span", { class: "fz-n" }, `${s.played[u] || 0} ${s.played[u] === 1 ? "word" : "words"}`)))));
      if (s.longest) after.push(h("p", { class: "fz-last" }, "The longest word: ", h("strong", {}, s.longest.word.toUpperCase()), `, by ${nameOfU(s.longest.uid)}`));
      after.push(h("p", { class: "fz-last" }, `${s.used.length} ${s.used.length === 1 ? "word" : "words"} played, ${s.bombs || 0} ${s.bombs === 1 ? "bomb" : "bombs"}`));
    }
    // your letters towards a life back
    let letters = null;
    if (playing && s.step !== "over" && (s.lives[me.uid] || 0) > 0) {
      const got = s.letters[me.uid] || "";
      letters = h("div", { class: "fz-letters", "aria-label": `Letters used: ${got.length} of ${BONUS.length}` }, ...[...BONUS].map(c => h("span", { class: got.includes(c) ? "got" : "" }, c.toUpperCase())));
    }
    stage.replaceChildren(h("div", { class: `fz-col${s.step === "over" ? " over" : ""}` }, bomb, h("div", { class: "pk-col fz-act" }, ...act), table, ...after, letters));
  },
};

const live = { input: null, timer: 0, note: { key: "", text: "" } };
let buzzed = "";
/**
 * The bomb: a black iron ball with a brass fuse and its spark. Every move redraws the screen, so the spark's flicker is
 * set to where it would be by the clock, not started again (a CSS animation restarts with each new element).
 */
function bombArt() {
  const NS = "http://www.w3.org/2000/svg", el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const svg = el("svg", { viewBox: "0 0 120 120", class: "fz-art", "aria-hidden": "true" });
  svg.append(el("path", { class: "fz-fuse", d: "M78 30 C 86 18, 98 18, 102 8" }), el("rect", { class: "fz-cap", x: 70, y: 26, width: 18, height: 12, rx: 2, transform: "rotate(35 79 32)" }),
    el("circle", { class: "fz-ball", cx: 56, cy: 68, r: 44 }), el("circle", { class: "fz-shine", cx: 40, cy: 50, r: 9 }), el("circle", { class: "fz-spark", cx: 102, cy: 8, r: 5 }));
  svg.style.setProperty("--fz-phase", `${-(performance.now() % 600)}ms`);
  return svg;
}
