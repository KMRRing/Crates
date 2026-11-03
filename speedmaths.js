// Speed maths (README, Speed maths): mental arithmetic against the clock, in plain language. The page is speedmaths-ui.js,
// which Fuel maths shares; this says which pool it deals, that it has a race, and that a finished run is a round of random mode.
import { createSpeed } from "./speedmaths-ui.js";
import { roundOver } from "./random.js";

createSpeed({ id: "speedmaths", pool: "mercantile", name: "Speed maths", headline: "sprint", duel: true, onRound: () => roundOver("speedmaths") });
