// The Maths course: GCSE (a UK 16-year-old's level) up through IB Higher Level to first-year university. The chapters live in
// maths-ch*.js, written with maths-kit.js, drawn by maths-stage.js on the shared course sheet (course.js).
import { NUMBER } from "./maths-ch1.js";
import { ALGEBRA, FUNCTIONS } from "./maths-ch2.js";
import { GEOMETRY, TRIG } from "./maths-ch3.js";
import { FURTHER, DIFF, INTEGRATION } from "./maths-ch4.js";

/** The level each chapter is pitched at, shown on the landing. */
export const LEVELS = { number: "GCSE", algebra: "GCSE to SL", functions: "SL", geometry: "GCSE to SL", trig: "SL to HL", further: "HL", diff: "SL to HL", integration: "SL to HL" };

export const COURSE = {
  title: "Maths",
  zh: "",
  chapters: [NUMBER, ALGEBRA, FUNCTIONS, GEOMETRY, TRIG, FURTHER, DIFF, INTEGRATION],
};
