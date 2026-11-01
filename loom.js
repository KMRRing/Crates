// Loom: weaving, as two games on one loom. The cloths are a nonogram of floats (loom-play.js, its rules in loom-float.js
// and its ladder in loom-levels.js): paint what shows at each crossing until every line's clue is met. The draft is the
// first Loom (loom-draft.js): thread the loom and plan the lifting until your cloth is the target's. This file is the page
// they share: which one is showing, the menu, and the header.
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, line, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { createPlay } from "./loom-play.js";
import { createDraft } from "./loom-draft.js";
import { $, read, write, opts, saveOpts, BEST } from "./loom-kit.js";
import "./pwa.js";

const TRACK = "loom:track";
const tracks = { levels: createPlay($("clothHost")), draft: createDraft($("draftHost")) };
const hosts = { levels: $("clothHost"), draft: $("draftHost") };
let track = read(TRACK, "levels") in tracks ? read(TRACK, "levels") : "levels";

function show(next) {
  tracks[track].leave();
  track = next;
  for (const [t, h] of Object.entries(hosts)) h.hidden = t !== track;
  write(TRACK, track);
  $("line").classList.remove("bad");
  tracks[track].enter();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const here = tracks[track];
  here.menu(body);
  // which of the two games, first in the content part
  part(body, "content").prepend(choice("Game", [["levels", "Cloths"], ["draft", "The draft"]], track, v => { show(v); openMenu(); }));
  const st = part(body, "settings");
  st.append(toggle("Show what's wrong in the cloth", opts.marks, on => { opts.marks = on; saveOpts(); here.marks(on); }));
  st.append(toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  const stars = read(BEST, 0);
  if (stars) part(body, "about").append(line(`${stars} star${stars === 1 ? "" : "s"} so far.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

bindSwitcher($("appsBtn"), "loom");
document.querySelector(".lm-mark").innerHTML = APPS.find(a => a.id === "loom")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("acts").addEventListener("click", e => tracks[track].click(e));
// the menu stands the shuttle still; a cloth being woven when it opens is finished when it closes
onPause(() => tracks[track].pause(), () => tracks[track].resume());
for (const [t, h] of Object.entries(hosts)) h.hidden = t !== track;
tracks[track].enter();
window.__loom = { get track() { return track; }, tracks, show, openMenu, play: tracks.levels.debug, draft: tracks.draft.debug };
