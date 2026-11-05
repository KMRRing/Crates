// The interaction screens laid among the Statecraft lessons' own steps (Korbi, 5 November 2026: each screen its own way to interact, less on each, more screens, more visual aids).
// after[lessonId][stepId] = steps to put straight after that step (they are given the id "<stepId>+1", "+2"…); replace[lessonId][stepId] = a step to play instead of that one (its id stays).
// Every fact here is in the lesson's own words or its chapter's reading; what is not yet checked against a source carries check: true.
import { S, K } from "./statecraft-ask.js";

const X = { check: true };
const G = (nodes, edges = [], o = {}) => ({ type: "graph", w: 300, h: 170, nodes, edges, ...o });
const TL = (from, to, items) => ({ type: "timeline", from, to, items });

/** A "how long" question as a slider: [from, words, tone?] bands, the goal range in the unit shown. */
const long = (say, label, min, max, step, unit, goal, bands, why) => K("slider", say, { min, max, step, init: min, unit, label, goal, bands: bands.map(([from, text, tone]) => ({ from, text, ...(tone ? { tone } : {}) })), k: "long" }, why);

export const EXTRA = {
  // a figure beside a step that is already there
  fig: {
    s1b: { "s1b.2": TL(-500, 2000, [{ at: -432, label: "Megarian decree" }, { at: 1806, label: "Berlin Decree" }, { at: 1949, label: "COCOM", tone: "b" }, { at: 1973, label: "Oil embargo", tone: "no" }, { at: 1996, label: "Wassenaar", tone: "b" }]) },
    s6c: { "s6c.2": TL(14, 28, [{ at: 14, label: "Photos" }, { at: 16, label: "Briefing" }, { at: 22, label: "Quarantine", tone: "b" }, { at: 27, label: "U-2 shot down", tone: "no" }, { at: 28, label: "Missiles withdrawn", tone: "ok" }]) },
    s9i: { "s9i.1": TL(1860, 1895, [{ at: 1862, label: "Minister-president" }, { at: 1866, label: "Königgrätz" }, { at: 1870, label: "Sedan", tone: "no" }, { at: 1871, label: "Empire", tone: "b" }, { at: 1879, label: "Dual Alliance", tone: "c" }, { at: 1887, label: "Reinsurance", tone: "c" }, { at: 1890, label: "Dismissed", tone: "no" }]) },
    s9j: { "s9j.1": TL(1955, 1995, [{ at: 1959, label: "Prime minister" }, { at: 1963, label: "Malaysia" }, { at: 1965, label: "Separation", tone: "no" }, { at: 1967, label: "Britain to leave", tone: "b" }, { at: 1990, label: "Steps down" }]) },
    s9k: { "s9k.1": TL(1900, 1950, [{ at: 1902, label: "Riyadh" }, { at: 1915, label: "Britain treaty", tone: "b" }, { at: 1924, label: "Mecca", tone: "c" }, { at: 1929, label: "Sabilla", tone: "no" }, { at: 1932, label: "Kingdom" }, { at: 1938, label: "Oil found", tone: "ok" }]) },
    s9l: { "s9l.1": TL(1890, 1950, [{ at: 1893, label: "South Africa" }, { at: 1915, label: "India" }, { at: 1922, label: "Chauri Chaura", tone: "no" }, { at: 1930, label: "Salt March", tone: "b" }, { at: 1942, label: "Quit India", tone: "c" }, { at: 1947, label: "Independence", tone: "ok" }, { at: 1948, label: "Killed", tone: "no" }]) },
    s9m: { "s9m.1": TL(1975, 2000, [{ at: 1976, label: "Mao dies" }, { at: 1978, label: "Third plenum", tone: "b" }, { at: 1980, label: "Zones", tone: "c" }, { at: 1989, label: "June 1989", tone: "no" }, { at: 1992, label: "Southern tour", tone: "ok" }, { at: 1997, label: "Dies" }]) },
  },
  after: {
    // ---------- chapter 1: the tools ----------
    s1a: {
      "s1a.2": [K("explore", "Three ways to change what another state does. Tap each to see how it works.", { fig: G([
        { id: "aim", x: 150, y: 30, label: "Another state's choice", tone: "soft" },
        { id: "co", x: 50, y: 120, label: "Coercion", tone: "no", note: "Threat or force: massing troops on a border until a neighbour withdraws." },
        { id: "in", x: 150, y: 120, label: "Inducement", tone: "ok", note: "Reward or payment: tariff-free access, aid, a better price." },
        { id: "pe", x: 250, y: 120, label: "Persuasion", tone: "a", note: "Changing what the other side wants: attraction, shared ideas, legitimacy." }],
        [{ a: "co", b: "aim" }, { a: "in", b: "aim" }, { a: "pe", b: "aim" }], { alt: "Coercion, inducement and persuasion all point at another state's choice" }) }, "Real policy mixes the three. A Mongol commander who offers lighter terms and threatens ruin is using two at once.")],
    },
    s1b: {
    },
    s1c: {
      "s1c.4": [K("bins", "Sort these by what they are: gathering information, making someone believe something false, or spreading a message.", { bins: ["Intelligence", "Deception", "Propaganda"], items: [
        { t: "Agents posing as merchants to watch a foreign court", bin: 0, why: "Information about another state, got in secret." },
        { t: "A corpse with forged papers set adrift off Spain", bin: 1, why: "Operation Mincemeat made the enemy believe something false." },
        { t: "A radio programme made to win goodwill abroad", bin: 2, why: "A message spread on purpose to shape opinion." },
        { t: "Sun Tzu's five kinds of spy", bin: 0, why: "Intelligence work, listed in his last chapter." },
        { t: "A dummy camp built to look like an army", bin: 1, why: "It makes an opponent believe the army is somewhere it is not." }] }, "Intelligence gets the truth, deception hides it, propaganda spreads a chosen version.")],
    },
    s1d: {
      "s1d.2": [K("slider", "Slide the ruler's behaviour from just to unjust, and read what the Mandate of Heaven says.", { min: 0, max: 100, step: 5, init: 80, unit: "", label: "How virtuous the ruler is", need: 2, bands: [
        { from: 0, text: "Heaven withdraws the mandate; rebellion is justified, and a new dynasty may claim it.", tone: "no" },
        { from: 40, text: "A doubtful case: omens, floods and revolts are read as warnings.", tone: "soft" },
        { from: 70, text: "Heaven's favour holds; the ruler's right to rule stands.", tone: "ok" }] }, "The claim cuts both ways: it justifies a new dynasty and warns the old one.")],
    },
    // ---------- chapter 2: diplomacy ----------
    s2a: {
    },
    s2b: {
      "s2b.2": [K("explore", "Three kinds of talk. Tap each to see who is in the room and who can disown it.", { fig: G([
        { id: "c", x: 60, y: 40, label: "Congress", tone: "a", note: "Many states, in public, to settle a war or an order: Westphalia 1648, Vienna 1814 to 1815." },
        { id: "b", x: 240, y: 40, label: "Backchannel", tone: "b", note: "A private line that can be denied if it fails: Kissinger to Beijing, July 1971." },
        { id: "t", x: 150, y: 125, label: "Track II", tone: "c", note: "Unofficial talks among scholars or retired officials: the Pugwash meetings from 1957." },
        { id: "g", x: 150, y: 40, label: "Governments", tone: "soft" }],
        [{ a: "g", b: "c", kind: "line" }, { a: "g", b: "b", kind: "line" }, { a: "g", b: "t", kind: "dash" }]) }, "Public talks bind; private ones test; unofficial ones can be disowned.")],
      "s2b.3": [S("Four meetings of the order, on a line.", { fig: TL(1640, 1960, [{ at: 1648, label: "Westphalia" }, { at: 1815, label: "Vienna", tone: "b" }, { at: 1919, label: "Paris", tone: "c" }, { at: 1945, label: "San Francisco", tone: "d" }, { at: 1955, label: "Bandung", tone: "a" }]) })],
    },
    s2c: {
      "s2c.2": [K("toggle", "Who can stop a treaty? Switch the veto players on and off and watch what happens.", { fig: G([
        { id: "ex", x: 150, y: 28, label: "Signed by the executive", tone: "soft" },
        { id: "sen", x: 60, y: 90, label: "US Senate\ntwo thirds", tone: "a", layer: "sen" },
        { id: "wal", x: 240, y: 90, label: "Regional parliament\n(Wallonia, CETA)", tone: "b", layer: "wal" },
        { id: "in", x: 150, y: 148, label: "In force", tone: "ok" }],
        [{ a: "ex", b: "sen", layer: "sen" }, { a: "ex", b: "wal", layer: "wal" }, { a: "sen", b: "in", layer: "sen" }, { a: "wal", b: "in", layer: "wal" }]),
        toggles: [{ id: "sen", label: "US Senate must consent", on: true }, { id: "wal", label: "Regional parliament must consent" }],
        rules: [{ if: ["sen", "wal"], text: "Two veto players: either can stop it. In 1919 and 1920 the Senate did not give the Treaty of Versailles two thirds; in October 2016 Wallonia held up CETA until a declaration was added." },
          { if: ["sen", "!wal"], text: "One veto player: the executive needs two thirds of senators present." },
          { if: ["!sen", "wal"], text: "One veto player: a regional parliament can hold up consent for the whole Union." }],
        dflt: "No veto player: signature is enough, which is rare." }, "The more separate actors can say no, the harder a treaty is to ratify.")],
    },
    s2d: {
      "s2d.2": [K("pair", "Who decides in each way of settling a dispute? Pair the way with who decides.", { pairs: [["Mediation", "The sides, helped by a third party"], ["Arbitration", "Judges the sides choose"], ["Adjudication", "A standing court"]] }, "Only mediation leaves the decision wholly with the sides; the other two hand it to judges.")],
    },
    s2e: {
      "s2e.2": [K("slider", "A draft resolution in the Security Council. Slide the number of votes in favour and read what it needs.", { min: 0, max: 15, step: 1, init: 8, unit: " votes", label: "Votes in favour (no veto cast)", goal: [9, 15], bands: [
        { from: 0, text: "Fewer than nine: the resolution fails." }, { from: 9, text: "Nine or more and no permanent member against: it passes.", tone: "ok" }] }, "Nine of fifteen votes, and no veto from China, France, Russia, the United Kingdom or the United States.")],
    },
    // ---------- chapter 3: tribute, vassalage and neutrality ----------
    s3a: {
      "s3a.1": [K("order", "The steps of a tribute mission as the court pictured them. Put them in order.", { items: ["The foreign ruler sends envoys", "The envoys perform the kowtow", "They present local goods as tribute", "The court gives gifts and a seal of investiture"] }, "Tribute went in; gifts and a title came back, and trade often followed on the court's terms.")],
    },
    s3b: {
      "s3b.2": [K("explore", "Three kinds of Ottoman tie. Tap each.", { fig: G([
        { id: "d", x: 55, y: 70, label: "Directly\nruled", tone: "a", note: "Provinces governed by sultan's officials." },
        { id: "v", x: 150, y: 70, label: "Vassal", tone: "b", note: "Keeps its own government, pays tribute: Wallachia, Moldavia, the Crimean Khanate from 1475, Ragusa." },
        { id: "c", x: 245, y: 70, label: "Capitulation", tone: "c", note: "Trade privileges for a foreign power: low customs and its own courts. A favour, later a right." },
        { id: "s", x: 150, y: 20, label: "The sultan", tone: "soft" }],
        [{ a: "s", b: "d" }, { a: "s", b: "v" }, { a: "s", b: "c", kind: "dash" }]) }, "The same word capitulation meant a favour in the 16th century and an enforced right in the 19th.")],
    },
    s3c: {
      "s3c.2": [K("bins", "Sort these by what kind of neutrality or alliance each is.", { bins: ["Neutral state", "Alliance promise"], items: [
        { t: "Switzerland, recognised at Vienna in 1815", bin: 0, why: "Permanent and armed neutrality." },
        { t: "Article 5 of the North Atlantic Treaty", bin: 1, why: "A promise to act together, which may or may not be kept." },
        { t: "Belgium's status guaranteed in 1839", bin: 0, why: "A guaranteed neutrality, broken in 1914." },
        { t: "Siam as a buffer between British and French empires", bin: 0, why: "Independence kept as a buffer, not a pledge to fight." }] }, "A neutral state stays out; an ally promises to come in.")],
    },
    // ---------- chapter 4: the thinkers ----------
    s4a: {
      "s4a.1": [K("build", "Thucydides names the truest cause of the war. Put the three parts of it in order on the diagram.", { fig: G([
        { id: "a", x: 50, y: 85, label: "", slot: true }, { id: "b", x: 150, y: 85, label: "", slot: true }, { id: "c", x: 250, y: 85, label: "", slot: true }],
        [{ a: "a", b: "b", label: "caused" }, { a: "b", b: "c", label: "led to" }], { h: 150, alt: "Three empty places joined by arrows" }),
        pieces: [{ id: "a", label: "Athenian power grows" }, { id: "b", label: "Sparta fears it" }, { id: "c", label: "War from 431 BCE" }] }, "In his words the growth of Athenian power and the fear it caused in Sparta made the war unavoidable.")],
      "s4a.2": [K("decide", "You are the Melian council in 416 BCE, facing the Athenian envoys. Pick a reply and see what the Athenians say.", { actor: "Submit or be destroyed, they say.", options: [
        { label: "Appeal to what is right", bites: "The Athenians answer that justice counts only between equals; the strong do what they can and the weak accept what they must." },
        { label: "Hope that Sparta will come", bites: "They reply that Sparta looks to its own interest and will not risk much for Melos." },
        { label: "Trust in the gods", bites: "They say the gods and men alike rule wherever they have the power." },
        { label: "Submit", bites: "The Melians did not. Melos fell: its men were killed and its women and children enslaved." }] }, "Thucydides wrote the speeches himself, as close to what was said as he could make them; read them as his art, not as minutes.", { check: true })],
    },
    s4b: {
      "s4b.2": [K("tf", "Three statements about Sun Tzu's Art of War. Mark each true or false.", { items: [
        { t: "Its central claim is that the best victory is won without fighting", a: true, why: "That is the line from the third chapter." },
        { t: "Bamboo slips from a tomb at Yinqueshan prove it was written in the 2nd century CE", a: false, why: "The slips are 2nd century BCE copies, which show the book already circulated; the text itself is older." },
        { t: "Most scholars say one general named Sun Wu wrote it about 500 BCE", a: false, why: "Most place it in the Warring States period, probably by a school rather than one man." }] }, "The dating is argued; the method of winning by stratagem is not.")],
      "s4b.3": [K("explore", "Kautilya's circle (mandala) of states, with the ruler at the centre. Tap each to see how he reads it.", { fig: G([
        { id: "r", x: 40, y: 80, label: "Ruler", tone: "a", note: "The would-be conqueror, at the centre of the circle." },
        { id: "n", x: 115, y: 80, label: "Neighbour", tone: "no", note: "The state next door is the natural enemy: it is the one in the way." },
        { id: "f", x: 190, y: 80, label: "Beyond it", tone: "ok", note: "The neighbour of the neighbour is the natural friend." },
        { id: "e", x: 262, y: 80, label: "The friend's\nneighbour", tone: "soft", note: "And the next one along is again a rival of the friend; the circle repeats." }],
        [{ a: "r", b: "n", kind: "line" }, { a: "n", b: "f", kind: "line" }, { a: "f", b: "e", kind: "line" }], { h: 130, alt: "Four states in a row: the ruler, the neighbour, the state beyond, and the one beyond that" }) }, "Geography sorts friends and enemies; the six measures say what to do about each.")],
    },
    s4c: {
      "s4c.1": [K("slider", "Machiavelli compares fortune to a river in flood. Slide how well the ruler prepared and read what happens.", { min: 0, max: 100, step: 5, init: 10, unit: "", label: "Dykes built before the flood", need: 2, bands: [
        { from: 0, text: "No dykes: the flood sweeps the prince away. He trusted fortune to stay calm.", tone: "no" },
        { from: 40, text: "Some dykes: the damage is smaller, and he can recover.", tone: "soft" },
        { from: 75, text: "Well prepared: virtù (energy and skill) turns the flood's force aside.", tone: "ok" }] }, "Fortune rules part of what happens; skill decides how much it hurts.")],
      "s4c.2": [K("decide", "You are a new prince with an unpaid army. What do you do?", { actor: "Your soldiers want pay; your subjects are watching.", options: [
        { label: "Seize your subjects' property", bites: "Machiavelli says a prince must still avoid being hated, above all by seizing property or women." },
        { label: "Make yourself feared, not hated", bites: "His advice: if you cannot be both loved and feared, fear is safer, so long as you are not hated." },
        { label: "Rely on being loved", bites: "He thinks love is a bond men break when it suits them." }] }, "He separates fear from hatred; a feared prince who also leaves property alone keeps both his army and his people.")],
    },
    s4d: {
      "s4d.3": [K("slider", "Clausewitz says the political aim sets the effort a war is worth. Slide the size of the aim.", { min: 0, max: 100, step: 5, init: 15, unit: "", label: "Size of the political aim", need: 3, bands: [
        { from: 0, text: "A border village: a small war is all it is worth, and the effort stays small.", tone: "ok" },
        { from: 35, text: "A province: a campaign with limits on means and places.", tone: "soft" },
        { from: 70, text: "The enemy's government: the effort runs towards the extreme, held back only by friction and politics.", tone: "no" }] }, "Aim first, effort second. When the aim grows, so does the war.")],
    },
    s4f: {
      "s4f.3": [K("toggle", "Switch each tendency off and see what is left.", { fig: G([
        { id: "w", x: 150, y: 30, label: "War", tone: "soft" },
        { id: "p", x: 50, y: 110, label: "Passion\n(people)", tone: "no", layer: "p" },
        { id: "c", x: 150, y: 110, label: "Chance\n(army)", tone: "a", layer: "c" },
        { id: "r", x: 250, y: 110, label: "Reason\n(government)", tone: "ok", layer: "r" }],
        [{ a: "p", b: "w", layer: "p", kind: "line" }, { a: "c", b: "w", layer: "c", kind: "line" }, { a: "r", b: "w", layer: "r", kind: "line" }]),
        toggles: [{ id: "p", label: "Passion", on: true }, { id: "c", label: "Chance", on: true }, { id: "r", label: "Reason", on: true }],
        rules: [{ if: ["p", "c", "r"], text: "All three: war as Clausewitz sees it, a chameleon whose character changes with each pull." },
          { if: ["p", "c", "!r"], text: "No reason: violence and luck with no aim. Not a war in his sense, since there is no policy to serve." },
          { if: ["!p", "c", "r"], text: "No passion: a cool contest of skill and chance. Possible, but wars are rarely fought without hatred." },
          { if: ["p", "!c", "r"], text: "No chance: war would be a calculation. Friction and uncertainty make that impossible." }],
        dflt: "With fewer than two, there is hardly a war to speak of.", need: 3 }, "He compares war to an object held between three magnets: a theory that ignores one tendency misreads how war moves.")],
    },
    s4g: {
      "s4g.5": [K("slider", "An attacker advances. Slide how far from home, and read what is left of his strength.", { min: 0, max: 100, step: 5, init: 10, unit: "", label: "Distance advanced", need: 3, bands: [
        { from: 0, text: "Near the border: supply is short and the army is at full strength.", tone: "ok" },
        { from: 35, text: "Deep in the country: garrisons are left behind, supply lines lengthen, men tire.", tone: "soft" },
        { from: 70, text: "Past the culminating point: strength is spent, and a counterstroke can win.", tone: "no" }] }, "Napoleon in Russia in 1812 is the standard case.")],
    },
    // ---------- chapter 5: war and its ways ----------
    s5a: {
      "s5a.1": [K("build", "Strategy joins three things. Put each where it belongs on the diagram.", { fig: G([
        { id: "e", x: 50, y: 118, label: "", slot: true }, { id: "w", x: 150, y: 118, label: "", slot: true }, { id: "m", x: 250, y: 118, label: "", slot: true },
        { id: "s", x: 150, y: 30, label: "Strategy", tone: "soft" }],
        [{ a: "s", b: "e", label: "what for?" }, { a: "s", b: "w", label: "how?" }, { a: "s", b: "m", label: "with what?" }], { h: 160 }),
        pieces: [{ id: "e", label: "Ends" }, { id: "w", label: "Ways" }, { id: "m", label: "Means" }] }, "Ends are the political aim, ways are how force and other tools are used, means are the resources.")],
    },
    s5g: {
      "s5g.1": [K("slider", "The law of the sea cuts the water into zones by distance from the coast. Slide out from the shore.", { min: 0, max: 250, step: 2, init: 6, unit: " nm", label: "Distance from the coast (nautical miles)", need: 4, marks: [{ at: 12, label: "12" }, { at: 24, label: "24" }, { at: 200, label: "200" }], bands: [
        { from: 0, text: "Territorial sea: the coastal state's sovereignty, with the right of innocent passage for others.", tone: "no" },
        { from: 12, text: "Contiguous zone (to 24): the state may enforce customs, immigration and health rules.", tone: "soft" },
        { from: 24, text: "Exclusive economic zone (to 200): sovereign rights over fish, oil and gas, not sovereignty.", tone: "a" },
        { from: 201, text: "High seas: freedom of navigation for all.", tone: "ok" }] }, "The same ship passes through four legal regimes between a port and the open sea.", { check: true })],
    },
    // ---------- chapter 6: deterrence ----------
    s6d: {
      "s6d.2": [K("bins", "No first use? Sort three nuclear states by what the text says of their doctrine.", { bins: ["Declares no first use", "Has not adopted it"], items: [
        { t: "India (doctrine of 2003)", bin: 0, why: "No first use, with massive retaliation." },
        { t: "China (announced at its first test in 1964)", bin: 0, why: "It said at once it would never be the first to use nuclear weapons." },
        { t: "Pakistan", bin: 1, why: "It has not adopted no first use." }] }, "Doctrines are declarations. The stability-instability paradox asks whether they hold in a crisis.", { check: true })],
    },
    // ---------- chapter 9: each case, the actor's choice before the answer ----------
    s9a: { "s9a.2": [K("decide", "Two actors, two problems: Cao Cao in 196, and Zhuge Liang in the 220s. Pick a move and see what stood in the way.", { actor: "The Han court has lost control of its armies and provinces.", options: [
      { label: "Take the throne now", bites: "Many officials and allies still rallied to the Han name, and rivals could brand an open usurper a rebel. His son waited until 220." },
      { label: "Rule in the emperor's name", bites: "This is what Cao Cao chose. It kept legitimacy, but the emperor's seals did not bring Liu Bei or Sun Quan to heel." },
      { label: "Ally with Wu against Wei", bites: "Zhuge Liang's side: Shu had far fewer people and less grain than Wei, so it needed Sun Quan, who had his own aims." },
      { label: "Invade the north over the passes", bites: "Shu's small army could not stay long in the field, since supplies came over mountain roads. The expeditions ran from 228 to 234." }] }, "Each move met a constraint the actor could not remove.")] },
    s9b: { "s9b.2": [K("decide", "You are Saladin in 1174, master of Egypt, with Damascus ahead of you and the Franks on the coast.", { actor: "Which front first?", options: [
      { label: "Fight the Franks first", bites: "His emirs served in seasons and expected rewards, and Muslim rivals would strike while he was away." },
      { label: "Subdue the Muslim rivals first", bites: "He did: Damascus 1174, Aleppo 1183, Mosul 1186. It cost years, and he needed the Abbasid caliph in Baghdad to recognise him." },
      { label: "Make truces with the Franks", bites: "He did that too, to free his hand. But a truce could be broken by someone else, as Raynald's raid on a caravan showed." }] }, "He took the Muslim lands first, then struck in 1187.")] },
    s9c: { "s9c.2": [K("decide", "You are Ögedei in the 1230s, ruling farming lands you conquered and cannot yet tax.", { actor: "The steppe knows pasture and plunder, not tax rolls.", options: [
      { label: "Plunder and withdraw", bites: "It brings no lasting revenue for the armies and the relay posts of the yam." },
      { label: "Turn farmland to pasture", bites: "His Khitan minister Yelü Chucai is said to have argued that farmers who pay tax are worth more than empty grass. (A traditional account.)" },
      { label: "Tax the farmers through local officials", bites: "This is what he did, with a census. But there were few officials who knew how, so he used outsiders." },
      { label: "Divide the empire among sons", bites: "There was no fixed rule of succession: princes held armies and shares, and an election by the family left room for rivals." }] }, "Taxation through officials was the choice; succession stayed the open wound.", { check: true })] },
    s9d: { "s9d.2": [K("decide", "You are Talleyrand, sent by a defeated France to Vienna in September 1814.", { actor: "France has no army to threaten anyone.", options: [
      { label: "Accept what the four offer", bites: "The four had agreed to act together and wished to keep France weak." },
      { label: "Argue for legitimacy and a balance", bites: "He did. It worked only because the victors quarrelled over Poland and Saxony." },
      { label: "Seek a secret alliance with Britain and Austria", bites: "Signed in January 1815 against Russian and Prussian demands. Napoleon's return in March ended that room to manoeuvre." }] }, "He used the victors' quarrels, not any force of his own.")] },
    s9e: { "s9e.2": [K("decide", "You are Zhou Enlai in 1971, serving a chairman few can contradict.", { actor: "China is poor, isolated and close to war on the Soviet border.", options: [
      { label: "Stay with the Soviet Union", bites: "Soviet aid had gone with the split of about 1960, and the two states were now rivals." },
      { label: "Open to the United States", bites: "Chosen from 1971 to 1972. It needed Mao's consent, and it came after the Sino-Soviet split." },
      { label: "Fight the Soviet Union", bites: "A weak economy and a Party in turmoil could not carry a war with a neighbour of that size." }] }, "Zhou worked inside what Mao allowed.", { check: true })] },
    s9f: { "s9f.2": [K("decide", "You are Nehru in 1955, newly independent and in need of grain and arms.", { actor: "Two blocs court you; neither is free.", options: [
      { label: "Join a bloc", bites: "Aid would come, but the bloc would press for your foreign policy." },
      { label: "Stand alone", bites: "Their economies needed foreign aid and arms; standing alone left them with neither." },
      { label: "Bargain with both and build a group", bites: "This is what they did (Bandung 1955, Belgrade 1961). The members disagreed among themselves, as India and China did after 1962." }] }, "Non-alignment raised their joint prestige and their price.")] },
    s9g: { "s9g.2": [K("decide", "You are at the multi-party talks in 1991 to 1993, with violence outside.", { actor: "Boipatong, June 1992; Hani's murder, April 1993.", options: [
      { label: "Negotiate a settlement", bites: "Chosen. It needed the white electorate's approval, given in a March 1992 referendum, and the security forces' loyalty." },
      { label: "Keep up the armed struggle", bites: "Violence from several sides already threatened the talks, and capital and skills could leave." },
      { label: "Reform slowly, keeping white vetoes", bites: "Sanctions and the movement's own demands made a settlement that kept those vetoes hard to hold." }] }, "They negotiated, with a five-year coalition and a Constitutional Court.", { check: true })] },
    s9h: { "s9h.2": [K("decide", "You are Menelik in 1893, with the Wuchale treaty claiming a protectorate.", { actor: "Italy sits on the Red Sea coast.", options: [
      { label: "Accept a protectorate", bites: "He denounced the treaty in 1893: the Amharic text did not say what the Italian text said." },
      { label: "Fight alone", bites: "A poor state with limited revenue, and lords who could withdraw their armies, could not." },
      { label: "Buy rifles and play the powers off", bites: "Chosen. France, Russia and Britain had reasons to see Italy checked. Adwa followed in 1896." }] }, "Ethiopia stayed independent.")] },
    s9i: { "s9i.3": [K("toggle", "Bismarck's treaties, one by one. Switch them on and off and see where Germany stands.", { fig: G([
      { id: "de", x: 150, y: 80, label: "Germany", tone: "soft" },
      { id: "au", x: 150, y: 24, label: "Austria-Hungary", tone: "a", layer: "d" },
      { id: "ru", x: 245, y: 80, label: "Russia", tone: "b", layer: "r" },
      { id: "fr", x: 55, y: 80, label: "France", tone: "no" }],
      [{ a: "de", b: "au", layer: "d", kind: "line", label: "1879" }, { a: "de", b: "ru", layer: "r", kind: "line", label: "1887" }, { a: "fr", b: "ru", layer: "fr", kind: "dash", label: "1892" }], { h: 130 }),
      toggles: [{ id: "d", label: "Dual Alliance (1879)", on: true }, { id: "r", label: "Reinsurance Treaty (1887)", on: true }],
      rules: [{ if: ["d", "r"], text: "Both on: Germany is tied to Austria and has a line to Russia. France stays isolated. This is Bismarck's system at its height." },
        { if: ["d", "!r"], text: "Reinsurance gone: Russia is free to look elsewhere. After 1890 it drew close to France, with a military convention in 1892 (ratified 1894)." },
        { if: ["!d", "r"], text: "Only the Russian line: Austria is left out, and the Balkans rivalry pulls the two apart." }],
      dflt: "No treaties: Germany alone in the middle of Europe, the coalition he feared." }, "Each thread needed his hand. Removing one changed all the others.", { check: true })],
    "s9i.2": [K("decide", "You are Bismarck in 1875, with the army pressing for another war with France.", { actor: "Germany sits in the middle of Europe.", options: [
      { label: "Strike France first", bites: "In the War-in-Sight crisis of 1875 Britain and Russia let it be known they would not stand by, and he stepped back." },
      { label: "Ally with Russia only", bites: "Austria and Russia clash in the Balkans, so Germany could not hold both by one tie." },
      { label: "Ally with Austria-Hungary", bites: "The Dual Alliance of 1879. It offended Russia, which is why he added the Reinsurance Treaty in 1887." },
      { label: "A web of balancing treaties", bites: "Chosen. It needed his own hand on every thread, and fell apart when he left office in 1890." }] }, "He chose the web, and kept France isolated.", { check: true })] },
    s9j: { "s9j.2": [K("decide", "You are Lee Kuan Yew in August 1965, leading a city of about two million just pushed out of Malaysia.", { actor: "No land, no resources, water from Johor.", options: [
      { label: "Rejoin Malaysia", bites: "The separation was Malaysia's act; there was no way back." },
      { label: "Live off the British base", bites: "It provided jobs, but Britain announced its withdrawal in 1967." },
      { label: "Stay a trading post", bites: "With no hinterland, trade alone left it open to every shock." },
      { label: "Industrialise for export", bites: "Chosen: foreign factories drawn by the Economic Development Board (1961). It needed order and housing, and it cost opponents dearly." }] }, "Export industry, public housing, a tight civil service.", { check: true })] },
    s9k: { "s9k.2": [K("decide", "You are Abd al-Aziz in 1924, with the Hejaz open and the Ikhwan restless.", { actor: "Mecca and its pilgrims lie ahead.", options: [
      { label: "Take Mecca and the Hejaz", bites: "Chosen. It brought pilgrim revenue, but it set him against the Hashemites and made Britain watch." },
      { label: "Let the Ikhwan raid on", bites: "Their raids into Iraq, Kuwait and Transjordan brought British air strikes." },
      { label: "Break with the Ikhwan", bites: "He did, once they had served: at Sabilla in March 1929." },
      { label: "Seek foreign capital", bites: "He did in 1933, granting an oil concession to Standard Oil of California as pilgrim revenue fell." }] }, "Tribal ties, religion and foreign money, in that order of danger.", { check: true })] },
    s9l: { "s9l.2": [K("decide", "You are Gandhi in 1930, with the salt tax falling on every household.", { actor: "The Raj holds the army, the courts and the money.", options: [
      { label: "Petition the government", bites: "It is the way of the moderates; it has not moved the Raj so far." },
      { label: "Armed revolt", bites: "A movement that turned violent would be crushed. He called off the 1920 campaign in 1922 after Chauri Chaura." },
      { label: "Civil disobedience: the Salt March", bites: "Chosen: tens of thousands were jailed. It needed discipline from millions and a coalition he could not fully hold." }] }, "The march from Sabarmati to Dandi took 24 days.", { check: true })] },
    s9m: { "s9m.2": [K("decide", "You are Deng Xiaoping in December 1978; Mao is dead and the economy is in ruins.", { actor: "The Party elders still hold power.", options: [
      { label: "Stay with planning", bites: "The elders feared that markets would undo socialism, and they sat on this side." },
      { label: "Open the coast: special zones", bites: "Chosen (1980). Foreign exchange and know-how were short, and Hong Kong lay beside Shenzhen." },
      { label: "Leave villages to farm by household", bites: "Villages began it; the Party legalised it afterwards." }] }, "Reform by zones and trials, with Party rule kept.", { check: true })] },
  },
  replace: {
    s1a: {
      "s1a.5": K("bins", "Sort these acts by the tool each mainly uses.", { bins: ["Coercion", "Inducement", "Persuasion"], items: [
        { t: "Massing troops on a border until a neighbour withdraws", bin: 0, why: "A threat of force." },
        { t: "Offering tariff-free access if a neighbour lifts a blockade", bin: 1, why: "A reward for a change." },
        { t: "Broadcasting a country's news and culture abroad", bin: 2, why: "Winning goodwill by attraction." },
        { t: "Cutting off a small state's trade", bin: 0, why: "Hirschman's lever: the weaker side loses more." },
        { t: "A grant of aid for an agreed change in policy", bin: 1, why: "Payment for a change." },
        { t: "Chinese treasure fleets carrying gifts and display", bin: 2, why: "Recognition and prestige attract; the fleets also carried force." }] }, "A reward is inducement, a threat is coercion, and winning the wish itself is persuasion.", { w: 0 }),
    },
    s2b: { "s2b.6": long("Slide the years of negotiation behind the treaties of 1648.", "Years of negotiation", 0, 6, 0.5, " yr", [3.5, 6], [[0, "Under a year: far too short for a congress of this size."], [1, "One to two years: still short."], [2, "Two to three years: close, but the talks ran longer."], [3.5, "More than three years: the congress at Münster and Osnabrück met from the mid 1640s to October 1648.", "ok"]], "Several years, not months.") },
    s4a: { "s4a.7": long("Slide the length of the Peloponnesian War, 431 to 404 BCE.", "Years of war", 0, 40, 1, " yr", [20, 30], [[0, "Under 10 years: too short."], [10, "10 to 20 years: still short."], [20, "20 to 30 years: about 27, with a pause (the Peace of Nicias, 421) in the middle.", "ok"], [31, "Over 30 years: too long."]], "431 to 404 BCE: about 27 years.") },
    s5d: { "s5d.5": long("Slide the length of the Malayan Emergency, 1948 to 1960.", "Years", 0, 20, 1, " yr", [10, 15], [[0, "Under 5 years: too short."], [5, "5 to 10 years: still short."], [10, "10 to 15 years: June 1948 to July 1960, about twelve, though most fighting was over by the mid 1950s.", "ok"], [16, "Over 15 years: too long."]], "About twelve years.") },
    s5e: { "s5e.5": long("Slide the length of the Soviet-Afghan war, December 1979 to February 1989.", "Years", 0, 16, 1, " yr", [8, 12], [[0, "Under 4 years: too short."], [4, "4 to 8 years: still short."], [8, "8 to 12 years: about nine.", "ok"], [13, "Over 12 years: too long."]], "From December 1979 to the completion of the Soviet withdrawal in February 1989.") },
    s6c: { "s6c.7": long("Slide the days from Kennedy's briefing (16 October) to Khrushchev's announcement (28 October).", "Days", 0, 35, 1, " d", [7, 14], [[0, "Under a week: too short."], [7, "One to two weeks: twelve days, which is why the crisis is remembered as the thirteen days.", "ok"], [15, "Two to four weeks: too long."], [29, "Over four weeks: too long."]], "Twelve days, remembered as the thirteen days.") },
    s8b: { "s8b.4": long("Slide the months of India's Emergency, 25 June 1975 to 21 March 1977.", "Months", 0, 60, 3, " mo", [12, 24], [[0, "Under 6 months: too short."], [6, "6 to 12 months: still short."], [12, "1 to 2 years: about twenty-one months.", "ok"], [25, "2 to 4 years: too long."], [49, "Over 4 years: too long."]], "About twenty-one months.") },
    s8d: { "s8d.5": long("Slide the days of Gandhi's march to Dandi, 12 March to 5 April 1930.", "Days", 0, 40, 1, " d", [20, 30], [[0, "Under 10 days: too short."], [10, "10 to 20 days: still short."], [20, "20 to 30 days: 24 in all.", "ok"], [31, "Over 30 days: too long."]], "He left Sabarmati on 12 March and reached Dandi on 5 April: 24 days.") },
    s9d: { "s9d.6": long("Slide the months of the Congress of Vienna, from the first meetings to the Final Act of 9 June 1815.", "Months", 0, 24, 1, " mo", [6, 12], [[0, "Under 3 months: too short."], [3, "3 to 6 months: still short."], [6, "6 to 12 months: about nine, with Napoleon's return in the middle.", "ok"], [13, "12 to 18 months: too long."], [19, "Over 18 months: too long."]], "September 1814 to 9 June 1815.") },
    s9g: { "s9g.6": long("Slide the years from the unbanning of the ANC (February 1990) to the first democratic election (April 1994).", "Years", 0, 8, 0.5, " yr", [4, 5], [[0, "Under 2 years: too short."], [2, "2 to 3 years: too short."], [3, "3 to 4 years: close, but not enough."], [4, "4 to 5 years: four years and two months, with the talks interrupted more than once.", "ok"], [5.5, "Over 5 years: too long."]], "Four years and two months.") },
  },
};
