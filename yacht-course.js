// Yacht's course (Learn, in the header and the menu): the five-dice game as Yacht plays it, from the turn to a first game, in
// three chapters on the course sheet (course.js), drawn by yacht-course-stage.js. Every score a lesson quotes is the
// rules' (yacht-rules.js), every chance an exact count over the dice, every hold and box one the Hard computer player
// makes too: tests/yacht-course.mjs proves them from the `check` a step carries.
//
// A step: { say } words; { say, quiz, answer, why } a choice; and for the stage
//   dice "2 5 3 6 2" the dice lying, left the rolls still to come (3: none rolled), taken { ones: 2 } boxes already written
//   (shown with their score), panel: { lit: [ids] } the sheet of boxes shown with what these dice would score in each;
//   hold "4 4 4": tap the dice to hold (their faces), then (words) and after "4 4 4 4 2" (the dice once the rest are rolled);
//   pick "threes": tap the box to write the dice in, wrong { id: words } for the boxes people take instead;
//   miss: words for a hold that is wrong; play: the last step, a game.
// check (read only by the test): { scores: [[dice, id, points]], odds: [{ goal, dice, left, keep, pct | frac }],
//   mean: { choice: 17.5, aim: 2.1 }, upper: { taken, needs }, bonus: [{ taken, bonus }] }.
import { CATS, scoreOf } from "./yacht-rules.js";

export const IDS = CATS.map(c => c.id);
export const parseDice = text => String(text).trim().split(/\s+/).map(Number);

/** The hold, as dice in their places, that keeps these faces (the first dice showing each). */
export function maskFor(dice, faces) {
  const need = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) need[f]++;
  return dice.map(d => (need[d] > 0 ? (need[d]--, 1) : 0));
}

/** A hold judged against a hold step: { ok, msg } or { ok: false, why }. */
export function judgeHold(step, mask) {
  const dice = parseDice(step.dice), want = parseDice(step.hold).sort(), held = dice.filter((_, i) => mask[i]).sort();
  if (!held.length) return { ok: false, why: "Tap the dice to hold first." };
  if (held.join() === want.join()) return { ok: true, msg: step.then || "Held." };
  const left = [...want];
  const subset = held.every(d => { const k = left.indexOf(d); if (k < 0) return false; left.splice(k, 1); return true; });
  return { ok: false, why: subset ? "Hold all of them: a die kept is one not left to chance." : step.miss || "Hold only the dice you are building on." };
}

/** A box picked judged against a pick step. */
export function judgePick(step, c) {
  const id = IDS[c];
  if (id === step.pick) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: step.wrong?.[id] || `${CATS[c].name} would score ${scoreOf(c, parseDice(step.dice))}: look for a better place.` };
}

const UPPER = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
const LATE = { ones: 3, twos: 4, threes: 9, fours: 12, fives: 15, sixes: 18, house: 20, choice: 22 };
const SO_FAR = { ones: 2, twos: 6, threes: 9, fours: 12 };

export const COURSE = {
  title: "Learn Yacht",
  chapters: [
    {
      id: "game", title: "The game",
      lessons: [
        {
          id: "turn", title: "The turn",
          steps: [
            { dice: "2 5 3 6 2", left: 2, say: "Yacht is an old game of five dice and a score sheet. This is the version played here: twelve rounds, and in each you write one result in one of twelve boxes, each box once. No bonus yachts, no jokers. A box you can't fill takes a 0. The highest total wins." },
            { dice: "4 4 4 1 6", left: 2, hold: "4 4 4", after: "4 4 4 4 2", say: "A turn: roll all five dice, then up to twice more, each time holding the dice you like and rolling the rest. You rolled 4 4 4 1 6. Tap the three 4s to hold them.", then: "Held. The 1 and the 6 roll again: a 4 and a 2. Four 4s." },
            { dice: "6 6 6 6 3", left: 1, quiz: ["Yes: stop after any roll", "No: all three rolls are compulsory"], answer: 0, say: "Four sixes after the second roll. May you stop and write them down now?", why: "Yes. You may stop after any roll; only holding all five dice and rolling is not allowed, so rolling on always rolls at least one." },
          ],
        },
        {
          id: "upper", title: "Ones to Sixes",
          steps: [
            { dice: "4 4 2 4 6", left: 0, panel: { lit: ["fours", "twos", "sixes"] }, say: "Ones to Sixes add up the dice showing that face. These dice are 12 in Fours (three of them), 6 in Sixes and 2 in Twos.", check: { scores: [["4 4 2 4 6", "fours", 12], ["4 4 2 4 6", "sixes", 6], ["4 4 2 4 6", "twos", 2]] } },
            { dice: "5 5 1 5 3", left: 0, pick: "fives", say: "Three fives and two others. Write the dice in the box that counts the fives.", then: "Fives: 15.", check: { scores: [["5 5 1 5 3", "fives", 15]] } },
            { dice: "6 6 6 1 1", left: 0, quiz: ["2", "6", "18"], answer: 0, say: "Three sixes and two ones. What do these score in Ones?", why: "2: Ones count only the ones. The sixes would be 18 in Sixes.", check: { scores: [["6 6 6 1 1", "ones", 2], ["6 6 6 1 1", "sixes", 18]] } },
            { taken: UPPER, say: "The bonus: if Ones to Sixes add up to 63 or more, you get 35 more. 63 is exactly three of each face: 3 + 6 + 9 + 12 + 15 + 18.", check: { upper: { taken: UPPER, needs: 0 }, bonus: [{ taken: UPPER, bonus: 35 }] } },
          ],
        },
        {
          id: "lower", title: "The other six",
          steps: [
            { dice: "3 3 3 5 5", left: 0, panel: { lit: ["house"] }, say: "Full house: three of one face and two of another. You score all five dice added: 19.", check: { scores: [["3 3 3 5 5", "house", 19]] } },
            { dice: "4 4 4 4 4", left: 0, quiz: ["0", "20", "50"], answer: 0, say: "Five alike. What do these score in Full house?", why: "0: five alike is not three and two. They score 20 in Four of a kind and 50 in Yacht.", check: { scores: [["4 4 4 4 4", "house", 0], ["4 4 4 4 4", "four", 20], ["4 4 4 4 4", "yacht", 50]] } },
            { dice: "6 6 6 6 2", left: 0, panel: { lit: ["four"] }, say: "Four of a kind: at least four alike. You score all five dice, 26, not just the four sixes.", check: { scores: [["6 6 6 6 2", "four", 26]] } },
            { dice: "1 2 3 4 5", left: 0, panel: { lit: ["little", "big"] }, say: "Little straight is 1 2 3 4 5, Big straight 2 3 4 5 6: 30 each, whatever the dice add up to. All five dice must be in the run: 1 2 3 4 6 scores nothing.", check: { scores: [["1 2 3 4 5", "little", 30], ["1 2 3 4 5", "big", 0], ["1 2 3 4 6", "little", 0], ["1 2 3 4 6", "big", 0]] } },
            { dice: "2 3 4 5 6", left: 0, pick: "big", say: "A run of five. Write it in the box it fits.", then: "Big straight: 30. Choice would give only 20.", check: { scores: [["2 3 4 5 6", "big", 30], ["2 3 4 5 6", "choice", 20]] } },
            { dice: "4 4 4 4 4", left: 0, pick: "yacht", say: "Five alike is a Yacht. Write it where it scores most.", then: "Yacht: 50. Anywhere else these dice score 20.", wrong: { fours: "20. Yacht pays 50.", four: "20. Yacht pays 50.", choice: "20. Yacht pays 50." }, check: { scores: [["4 4 4 4 4", "yacht", 50], ["4 4 4 4 4", "fours", 20], ["4 4 4 4 4", "four", 20], ["4 4 4 4 4", "choice", 20]] } },
            { dice: "6 5 5 2 1", left: 0, panel: { lit: ["choice"] }, say: "Choice takes any five dice and adds them: 19 here. It never scores 0, so it is the place for a turn that fits nothing else. Five dice average 17.5.", check: { scores: [["6 5 5 2 1", "choice", 19]], mean: { choice: 17.5 } } },
          ],
        },
      ],
    },
    {
      id: "well", title: "Playing well",
      lessons: [
        {
          id: "hold", title: "What to hold",
          steps: [
            { dice: "6 6 3 4 2", left: 2, hold: "6 6", after: "6 6 6 1 5", say: "Hold the face you have most of and roll the rest: alike dice are the way to Yacht, Four of a kind, a full house and the upper boxes. Here: the pair of sixes.", then: "A third six. The Hard computer player holds the same." },
            { dice: "3 3 3 6 1", left: 2, hold: "3 3 3", after: "3 3 3 3 3", miss: "Keep only the threes: the 6 fits nothing here, and rolling it gives another chance.", say: "Three 3s, a 6 and a 1. What do you hold?", then: "Five 3s: a Yacht." },
          ],
        },
        {
          id: "odds", title: "Going for a Yacht",
          steps: [
            { dice: "5 5 5 5 2", left: 1, hold: "5 5 5 5", say: "Four 5s and one roll left. Hold them.", then: "The fifth die matches 1 time in 6: 16.7%.", check: { odds: [{ goal: "yacht", dice: "5 5 5 5 2", left: 1, pct: 16.7 }] } },
            { dice: "3 3 3 6 1", left: 2, quiz: ["2.8%", "9.3%", "27.8%"], answer: 1, say: "Three 3s held, two rolls left. How likely is a Yacht by the end of the turn?", why: "9.3% (121 in 1296): both dice show a 3 now, 1 in 36; or one does (10 in 36) and the other follows, 1 in 6; or neither (25 in 36) and both follow, 1 in 36.", check: { odds: [{ goal: "yacht", dice: "3 3 3 6 1", left: 2, pct: 9.3, frac: [121, 1296] }] } },
            { quiz: ["0.5%", "4.6%", "20%"], answer: 1, say: "Holding the commonest face every time, how likely is a Yacht from a fresh turn with all three rolls?", why: "4.6%, about 1 in 22. Worth 2.3 points a turn (4.6% of 50): a Yacht is a bonus to take when it comes, rarely a plan.", check: { odds: [{ goal: "yacht", dice: null, left: 3, pct: 4.6 }], mean: { yachtPoints: 2.3 } } },
            { dice: "3 3 3 6 1", left: 2, quiz: ["30.6%", "51.8%", "83.3%"], answer: 1, say: "Three 3s held, two rolls left. How likely are four or more alike?", why: "51.8%: one roll gives a 3 on at least one of two dice 11 times in 36 (30.6%); the second roll gives the same chance again if the first missed.", check: { odds: [{ goal: "four", dice: "3 3 3 6 1", left: 2, pct: 51.8 }, { goal: "four", dice: "3 3 3 6 1", left: 1, pct: 30.6 }] } },
          ],
        },
        {
          id: "shapes", title: "Straights and full houses",
          steps: [
            { dice: "2 3 4 5 5", left: 2, hold: "2 3 4 5", after: "2 3 4 5 6", say: "A straight needs five different faces. Hold one of each in the run and roll the spare 5.", then: "A 6: a Big straight." },
            { dice: "2 3 4 5 5", left: 1, quiz: ["16.7%", "33.3%", "50%"], answer: 1, say: "2 3 4 5 held, one roll left. How likely is a straight?", why: "33.3%: a 1 makes the Little straight, a 6 the Big. With two rolls left, 55.6%.", check: { odds: [{ goal: "straight", keep: "2 3 4 5", dice: "2 3 4 5 5", left: 1, pct: 33.3 }, { goal: "straight", keep: "2 3 4 5", dice: "2 3 4 5 5", left: 2, pct: 55.6 }] } },
            { dice: "1 2 3 4 4", left: 1, quiz: ["16.7%", "33.3%"], answer: 0, say: "1 2 3 4 held instead, one roll left. How likely is a straight?", why: "16.7%: only a 5 helps. A run open at both ends is twice as good.", check: { odds: [{ goal: "little", keep: "1 2 3 4", dice: "1 2 3 4 4", left: 1, pct: 16.7 }] } },
            { dice: "3 3 5 5 2", left: 1, quiz: ["16.7%", "33.3%", "66.7%"], answer: 1, say: "Two pairs, one roll left, both pairs held. How likely is a full house?", why: "33.3%: the loose die must be a 3 or a 5.", check: { odds: [{ goal: "house", keep: "3 3 5 5", dice: "3 3 5 5 2", left: 1, pct: 33.3 }] } },
            { dice: "3 3 5 5 2", left: 2, hold: "5 5", after: "4 1 5 5 5", say: "Yet the Hard computer player holds only the pair of 5s here. A full house scores just its dice added, 19 or 21, and Choice pays that too; a pair keeps four of a kind and Yacht in reach.", then: "Three 5s after the roll.", check: { scores: [["3 3 3 5 5", "house", 19], ["3 3 5 5 5", "house", 21]] } },
          ],
        },
        {
          id: "bonus", title: "The upper bonus",
          steps: [
            { taken: SO_FAR, say: "63 is three of each face, so count each box against three: four 5s is 5 over, two 6s is 6 under. A die short of three costs its face in points. Here Ones to Fours stand at 29.", check: { upper: { taken: SO_FAR, needs: 34 } } },
            { taken: SO_FAR, quiz: ["33", "34", "35"], answer: 1, say: "With 29 so far, how many do Fives and Sixes need together for the bonus?", why: "34 (63 - 29). Three of each makes 33: one short, so one of them needs four.", check: { upper: { taken: SO_FAR, needs: 34 } } },
            { taken: SO_FAR, quiz: ["Fives 15, Sixes 18", "Fives 20, Sixes 18", "Fives 10, Sixes 18"], answer: 1, say: "Which finish gets the 35?", why: "Fives 20, Sixes 18: 29 + 38 = 67. Three of each is 62, and Fives 10 only 57.", check: { bonus: [{ taken: { ...SO_FAR, fives: 15, sixes: 18 }, bonus: 0 }, { taken: { ...SO_FAR, fives: 20, sixes: 18 }, bonus: 35 }, { taken: { ...SO_FAR, fives: 10, sixes: 18 }, bonus: 0 }] } },
            { quiz: ["About 1 in 3", "About 1 in 2", "About 4 in 5"], answer: 0, say: "Going for one face with all three rolls, how often do you end with at least three of it?", why: "35.5%, about 1 in 3. Four or more: 10.4%, about 1 in 10. On average you end with 2.1 of the face.", check: { odds: [{ goal: "face3", dice: null, left: 3, pct: 35.5 }, { goal: "face4", dice: null, left: 3, pct: 10.4 }], mean: { aim: 2.1 } } },
            { say: "So the bonus is a plan, not a gift: three of a face comes only about 1 time in 3 when you aim. Take four of a face in its own box when you get them, and put a bad turn where a short score costs least: in Ones a die short is 1 point, in Sixes 6." },
          ],
        },
        {
          id: "box", title: "Choosing the box",
          steps: [
            { dice: "3 3 3 3 5", left: 0, pick: "threes", say: "Four 3s. Four of a kind would pay 17; Threes pay 12. Where does the Hard computer player write them?", then: "Threes. Four 3s put you 3 points over the bonus pace.", wrong: { four: "17 is tempting, but Hard writes four 3s in Threes: 3 over the pace for the bonus." }, check: { scores: [["3 3 3 3 5", "threes", 12], ["3 3 3 3 5", "four", 17]] } },
            { dice: "6 6 6 2 4", left: 0, pick: "choice", say: "Three sixes would be 18 in Sixes, exactly on the bonus pace. What else do these dice score?", then: "Choice: 24, far above the 17.5 that five dice average. Sixes will come round again.", wrong: { sixes: "18 is only on pace; Choice pays more here." }, check: { scores: [["6 6 6 2 4", "choice", 24], ["6 6 6 2 4", "sixes", 18]] } },
          ],
        },
        {
          id: "dump", title: "When nothing fits",
          steps: [
            { dice: "1 2 4 6 6", left: 0, pick: "ones", say: "Nothing here: a 1, a 2, a 4 and a pair of sixes. Take the loss where it costs least.", then: "Ones: 1. Even when you go for them, Ones average only 2.1.", check: { scores: [["1 2 4 6 6", "ones", 1]], mean: { aim: 2.1 } } },
            { dice: "1 2 4 6 6", left: 0, taken: { ones: 1, yacht: 0 }, pick: "choice", say: "The same dice, but Ones and Yacht are already written. Choice takes anything.", then: "Choice: 19, above the 17.5 of five random dice.", check: { scores: [["1 2 4 6 6", "choice", 19]] } },
            { dice: "1 2 3 5 6", left: 0, taken: LATE, pick: "yacht", say: "Four boxes open: Four of a kind, both straights and Yacht. These dice fit none of them. Write the 0 in the box least likely ever to be filled.", then: "Yacht: a Yacht comes in only 4.6% of turns, even when you chase it.", wrong: { four: "Four of a kind comes much oftener than a Yacht (51.8% from three alike).", little: "A straight is easier to make than a Yacht.", big: "A straight is easier to make than a Yacht." }, check: { odds: [{ goal: "yacht", dice: null, left: 3, pct: 4.6 }, { goal: "four", dice: "3 3 3 6 1", left: 2, pct: 51.8 }] } },
          ],
        },
        {
          id: "first", title: "A first game",
          steps: [
            { say: "That is the game. Play one now. Menu, Hint tells you the box the Hard computer player would write your dice in; Menu, Computer players sets how strong the others are at a table.", play: true },
          ],
        },
      ],
    },
  ],
};
