// The knowledge games' menus are one shape (Korbi, 9 Nov 2026: "heavily standardized ... a shared resource that just has flags
// (regions, learning, difficulty, topics), and a section for individual settings"). A game says which flags it has and gives
// the few settings of its own; this puts them in the same places in the same format everywhere:
//   Content   Region, Topics                       (what is dealt)
//   Settings  Learning, Level, Sound               (how it is played: Level is the shared row menu.js adds for a game with a
//                                                   ramp, Sound the one sfx.js adds for a game with sound)
//   <Game>    the game's own settings              (each has to earn its spot: nothing a flag already says)
// The Play and About parts stay the game's own. Not in a watching frame (it only shows a partner's game).
import { part, mirror, choice } from "./menu.js";
import { topicsPart } from "./topics-ui.js";
import { regionControl } from "./region.js";
import * as pile from "./pile.js";

/** The learning row: the one shared mode (pile.js), the same wherever it is changed. */
export const learningRow = () => choice("Learning", pile.MODES, pile.mode(), pile.setMode);

/**
 * spec: { name, game, region, topics, learning, own }
 *   region    true: the shared control (region.js), kept as `<game>:region`; { mirror: select } for a game whose region is a
 *             header dropdown; { onChange } to hear a change
 *   topics    the Topics button
 *   learning  the Learning row
 *   own       the game's own settings: elements made with menu.js's choice / toggle / ticks / action / line
 */
export function flags(body, { name, game, region, topics, learning, own = [] }) {
  const content = part(body, "content");
  if (region) content.append(region.mirror ? mirror("Region", region.mirror) : regionControl(game, region.onChange));
  if (topics) content.append(...topicsPart());
  if (learning) part(body, "settings").append(learningRow());
  if (own.length) { const box = part(body, "own"); box.dataset.label = name; box.append(...own); }
}
