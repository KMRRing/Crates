// What the Cloth mode of Nonogram's page keeps: reading and writing what's saved, the sounds, the options and the dialog a finished cloth opens.
import { IN_FRAME } from "./suite.js";

// The cloth's parts share nonogram.html with the picture's, so the ones whose names Nonogram also uses carry a "cl" in front
// there (clLine, clNextBtn); menuDlg is the page's one menu.
const OWN = new Set(["line", "acts", "marker", "jobName", "jobNo", "jobStars", "clothHost", "doneDlg", "doneHead", "doneStars", "doneBody", "doneNote", "againBtn", "nextBtn"]);
export const $ = id => document.getElementById(OWN.has(id) ? `cl${id[0].toUpperCase()}${id.slice(1)}` : id);
export const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
/** Keeps a value; a partner's watching frame keeps nothing. */
export const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
export const starText = n => "★".repeat(n) + "☆".repeat(3 - n);

export const OPTS = "loom:opts", BEST = "loom:best";
export const opts = { sound: true, marks: true, ...read(OPTS, {}) };
export const saveOpts = () => write(OPTS, opts);

export const CAMP = "loom:camp";
const sum = o => Object.values(o).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0);
/** The games screen's number: every star won in the cloths (the draft's, `loom:jobs`, are kept but no longer counted). */
export const keepBest = () => write(BEST, sum(read(CAMP, {})));

// ---------- the sounds, made as they play (no files) ----------
let audio = null;
function noise(ms, { lo = 200, hi = 4000, gain = 0.25, decay = 0.6 } = {}) {
  if (!opts.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const n = Math.round(audio.sampleRate * ms / 1000), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
    const src = audio.createBufferSource(), bp = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = buf;
    bp.type = "bandpass"; bp.frequency.value = Math.sqrt(lo * hi); bp.Q.value = Math.sqrt(lo * hi) / (hi - lo);
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(audio.destination);
    src.start();
  } catch { /* no sound here */ }
}
export const SOUND = {
  tap: () => noise(40, { lo: 500, hi: 2200, gain: 0.2, decay: 3 }),                // a heddle clicking over
  shuttle: () => noise(1500, { lo: 900, hi: 5200, gain: 0.07, decay: 0.2 }),       // the shuttle across the cloth
  done: () => noise(240, { lo: 300, hi: 1800, gain: 0.2, decay: 2 }),
};

/** The dialog a finished cloth opens: { head, stars, rows: [[name, value]…], note, again: [text, fn], next: [text, fn] }. */
export function finished({ head, stars, rows, note, again, next }) {
  $("doneHead").textContent = head;
  $("doneStars").textContent = starText(stars);
  $("doneBody").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("doneNote").textContent = note;
  // set as properties, so that whichever game is showing is the only one that answers
  $("againBtn").textContent = again[0];
  $("againBtn").onclick = () => { $("doneDlg").close(); again[1](); };
  $("nextBtn").textContent = next[0];
  $("nextBtn").onclick = () => { $("doneDlg").close(); next[1](); };
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
