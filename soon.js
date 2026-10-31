// A game that isn't built yet: its tile opens this page as soon.html?game=<id>, which says what the game will be and
// what's left to do (soon-data.js). Nothing is kept and nothing plays; the games screen is the way on.
import { bindSwitcher, APPS } from "./apps.js";
import { SOON } from "./soon-data.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get("game");
const game = SOON[id], app = APPS.find(a => a.id === id);
document.title = game ? `${game.name}: coming soon` : "Coming soon";
$("name").textContent = game?.name ?? "Almanac";
document.querySelector(".so-mark").innerHTML = app?.logo ?? "";
$("line").textContent = game?.line ?? "This game isn't on the list. The games screen has every game there is.";
$("todoHead").hidden = !game;
$("todo").replaceChildren(...(game?.todo ?? []).map(t => { const li = document.createElement("li"); li.textContent = t; return li; }));
bindSwitcher($("appsBtn"), id);
