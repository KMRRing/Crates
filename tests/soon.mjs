// The games not built yet (soon-data.js; README, Coming soon): each has a tile on the games screen that opens soon.html, a logo in
// each of the three houses' drawings, a place in Random's left-out list, and a page that says what it will be. A tile and
// its entry must agree both ways, and a game that gets built must leave the list.
import fs from "node:fs";
import { SOON } from "../soon-data.js";
import { SOON_ALMANAC, SOON_MODERN, SOON_KONTOR } from "../soon-logos.js";
import { ROUNDS, LEFT_OUT } from "../random-core.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const apps = fs.readFileSync(root + "apps.js", "utf8");
const tiles = [...apps.matchAll(/\{ id: "(\w+)", sec: "(\w+)", name: "([^"]+)", href: "([^"]+)"[^\n]*?\bsoon: true \}/g)].map(m => ({ id: m[1], sec: m[2], name: m[3], href: m[4] }));
const ids = Object.keys(SOON);

check(ids.length > 0 && tiles.length === ids.length && ids.every(id => tiles.some(t => t.id === id)) && tiles.every(t => SOON[t.id]),
  `${ids.length} games to build, each with a tile marked soon and no tile marked soon without one`);
check(tiles.every(t => t.href === `./soon.html?game=${t.id}` && t.name === SOON[t.id].name && t.sec === SOON[t.id].sec), "each tile opens soon.html on its own game, in its section, under its name");
check(ids.every(id => SOON[id].line.length > 40 && SOON[id].todo.length >= 2 && SOON[id].todo.every(t => typeof t === "string" && t.length > 30)), "each says what the game is and has at least two things to do");
check(ids.every(id => !(id in ROUNDS) && LEFT_OUT[id]), "Random leaves each out (a game that's built moves to ROUNDS)");
check(!Object.keys(LEFT_OUT).some(id => LEFT_OUT[id] === "not built yet" && !SOON[id]), "…and a game that's built no longer says it isn't");
check(ids.every(id => SOON_ALMANAC[id] && SOON_MODERN[id] && SOON_KONTOR[id]) && Object.keys(SOON_ALMANAC).length === ids.length, "each has a logo in Almanac's, Modern's and Kontor's drawing, and none is left over");
check([SOON_ALMANAC, SOON_MODERN, SOON_KONTOR].every(set => Object.values(set).every(v => /^<svg [^>]*viewBox=/.test(v) && v.endsWith("</svg>") && !/\bwidth="\d+px"/.test(v))), "each logo is one svg that scales to its tile");
check(Object.values(SOON_KONTOR).every(v => /class="k-ico"/.test(v)) && Object.values(SOON_ALMANAC).every(v => /viewBox="0 0 100 100"/.test(v)) && Object.values(SOON_MODERN).every(v => /viewBox="0 0 20 20"/.test(v)), "…in the size of its house (100, 20, 24)");
check(/\.\.\.SOON_MODERN/.test(apps) && /\.\.\.SOON_KONTOR/.test(apps) && /!x\.soon/.test(apps), "apps.js takes the logos in, and leaves these games out of Start a game over");
const page = fs.readFileSync(root + "soon.js", "utf8"), html = fs.readFileSync(root + "soon.html", "utf8");
check(/SOON\[id\]/.test(page) && /bindSwitcher\(\$\("appsBtn"\), id\)/.test(page) && /src="soon\.js"/.test(html) && /id="appsBtn"/.test(html), "soon.html names the game, says what's to do, and has the games screen behind its title");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`soon: ${ids.length} games with a tile and a note, none dealt by Random`);
