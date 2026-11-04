// The Wine course, chapters 4 and 5: reading labels and appellation systems, and tasting method.
import { S, Q, B, lesson, test } from "./wine-ask.js";

export const LABELS = {
  id: "labels", title: "Labels and appellations", lessons: [
    lesson("place-grape", "Place or grape", "white", [
      S("Old World labels (France, Italy, Spain) name the place, and the place implies the grape and the style: Chablis is Chardonnay, Sancerre is Sauvignon Blanc, Barolo is Nebbiolo. New World labels name the grape. A grape named on the label must make up a minimum share: 85% in the EU and Australia, 75% in the USA.",
        "Minimum share of the named grape", [["EU", "85%"], ["Australia", "85%"], ["USA", "75%"]]),
      Q("Under EU rules, a wine labelled 'Merlot' must contain at least", "85% Merlot", ["51% Merlot", "75% Merlot", "100% Merlot"], "The EU and Australia ask for 85%; the USA for 75%. A wine called Merlot can therefore carry some other grape."),
      S("A label must say who made it, where it is from, the alcohol and usually the vintage: the harvest year. 'NV' is non-vintage, a blend of years. Vintage matters most in cool, changeable places such as Burgundy, Bordeaux and Germany, and least in steady, sunny ones. 'Reserve' on a US label has no legal meaning; 'Reserva' in Spain and 'Riserva' in Italy do."),
      Q("What does 'Reserve' mean on a California label?", "Nothing the law defines", ["At least two years in oak", "Grapes from a single vineyard", "Wine held back from an older vintage"], "In the USA the word is a marketing choice. In Spain and Italy the equivalent words are fixed by law and mean extra ageing."),
      B("WN-132"),
    ]),
    lesson("france-labels", "France: AOC and its ladders", "red", [
      S("France's pyramid: AOC (appellation d'origine contrôlée), now called AOP in EU terms, fixes the place, the grapes, the yields and the methods. Below it, IGP (indication géographique protégée; Pays d'Oc is the best known) is looser. Vin de France has no place at all but may name the grape and vintage.",
        "France's pyramid", [["AOC / AOP", "place, grapes, yields, methods fixed"], ["IGP", "wider region, more freedom"], ["Vin de France", "no place; grape and vintage allowed"]]),
      Q("Which French category gives a producer the most freedom?", "Vin de France", ["IGP", "A village AOC", "A Grand Cru"], "Vin de France names no place and so is free of an appellation's rules. IGP has fewer rules than AOC but still names a region."),
      S("Inside AOC, regions have their own ladders. Burgundy ranks the vineyard: Grand Cru above Premier Cru above village. Bordeaux ranks the producer: Grand Cru Classé (1855 in the Médoc; separate lists for Saint-Émilion and Graves), then Cru Bourgeois. 'Mis en bouteille au château' says it was bottled at the estate. Champagne ranks villages: 17 are Grand Cru."),
      Q("Burgundy's quality ladder ranks", "Vineyard plots", ["Châteaux", "Négociants", "Growers' cooperatives"], "A Grand Cru is a plot of land. Bordeaux's classifications rank châteaux; Burgundy's rank the ground."),
      B("WN-134"),
    ]),
    lesson("others-labels", "Italy, Spain and Germany", "red", [
      S("Italy: DOCG (denominazione di origine controllata e garantita) is the top tier, DOC below, IGT (indicazione geografica tipica) regional wine, where many Super Tuscans sit. 'Classico' marks the historic heartland of a zone; 'Riserva' means extra ageing; 'Superiore' means a higher minimum alcohol.",
        "Italy's ladder", [["DOCG", "the top, with a tasting panel"], ["DOC", "defined zones and rules"], ["IGT", "a wide region, freer rules"], ["Vino", "table wine, no place"]]),
      Q("'Classico' on an Italian label means", "The historic heart of the zone", ["Extra ageing in oak", "A higher minimum alcohol", "A single-vineyard wine"], "Chianti Classico is the original Chianti hills; the larger Chianti zone grew around it."),
      B("WN-065"),
      S("Spain: DOCa is the top, held only by Rioja and Priorat; DO below. Red ageing words are fixed by law: Joven (young), Crianza, Reserva, Gran Reserva. Germany ranks by grape ripeness at harvest, the Prädikat: Kabinett, Spätlese, Auslese, Beerenauslese, Trockenbeerenauslese, and Eiswein. 'Trocken' means dry."),
      Q("A German 'Spätlese' is a wine", "Made from late-picked, ripe grapes, sweet or dry", ["Always sweet, made from grapes with noble rot", "Always dry, made from the first grapes picked", "That is lightly sparkling, drunk young and cold"], "The Prädikat measures sugar in the grapes at harvest. The winemaker can ferment it dry, so a Spätlese may be dry or sweet."),
      B("WN-088"),
    ]),
    test("labels-test", "Test: labels and appellations", "white", [
      B("WN-075"), B("WN-089"), B("WN-091"), B("WN-063"),
      Q("In France, a label that names the grape rather than the place is most likely", "A Vin de France or an IGP wine", ["A Premier Cru from the Côte d'Or", "A classified growth of the Médoc", "A village wine of the Côte de Nuits"], "Most AOC wines name only the place (Alsace is the main exception). Vin de France and IGP wines often name the grape."),
      Q("Which Spanish tier is held only by Rioja and Priorat?", "DOCa", ["DO", "Vino de la Tierra", "Vino de Pago"], "DOCa (Denominación de Origen Calificada) is Spain's top tier. Plain DO covers most other named regions, such as Ribera del Duero."),
    ]),
  ],
};

export const TASTING = {
  id: "tasting", title: "Tasting method", lessons: [
    lesson("method", "Look, smell, taste", "red", [
      S("A tasting is a routine, so you notice the same things each time. Look: clarity and depth of colour. A red turns brick-orange at the rim as it ages; a white deepens to gold. Nose: swirl, then sniff for fruit, flowers and herbs. Palate: sweetness, acid, tannin, alcohol, body, flavour, finish."),
      Q("As a red wine ages, its colour", "Fades towards brick-orange and brown", ["Deepens towards black", "Turns green at the rim", "Gains a purple cast"], "Reds lose their purple and go brick-red, then brown; whites do the opposite and darken towards gold and amber."),
      S("Aromas come in layers. Primary, from the grape: citrus, apple, blackcurrant, rose, pepper. Secondary, from winemaking: butter from malolactic conversion, bread from the lees, often vanilla from oak. Tertiary, from ageing: mushroom, leather, dried fruit, nuts, and petrol in old Riesling.",
        "Three layers of aroma", [["Primary", "from the grape: fruit, flowers, herbs"], ["Secondary", "from winemaking: butter, bread, vanilla"], ["Tertiary", "from age: mushroom, leather, nuts"]]),
      Q("Mushroom, leather and dried fruit are which layer of aroma?", "Tertiary, from ageing", ["Primary, from the grape variety", "Secondary, from yeast and malolactic", "A fault, from poor winemaking"], "Tertiary aromas appear with age, in oak or in bottle. Primary aromas come from the grape, secondary from the cellar."),
    ]),
    lesson("structure", "The palate and quality", "red", [
      S("Five things to find. Sweetness: sugar, felt at the tip of the tongue. Acid: mouth-watering sharpness along the sides; high in cool-climate and young wines. Tannin: grip, in reds. Alcohol: warmth in the throat, a burn above about 14%. Body: the weight, light to full."),
      Q("Mouth-watering sharpness along the sides of the tongue is", "Acid", ["Tannin", "Alcohol", "Sweetness"], "Acid makes you salivate. Tannin dries, alcohol warms and sugar coats."),
      S("Quality is judged by balance (no one element sticks out), length (how long the flavour stays after you swallow), intensity and complexity (flavours that change in the glass). A wine can be well made yet not to your taste: those are separate questions."),
      Q("Which shows a long finish?", "The flavours linger well after you swallow", ["The flavours vanish as soon as you swallow", "A sharp bitter aftertaste replaces the fruit", "The wine tastes the same from first sip to last"], "Length is the time the flavour lasts after swallowing. A bitter tail is a flaw, and a flat taste is a lack of complexity."),
    ]),
    lesson("faults", "Faults", "red", [
      S("Faults are flaws of winemaking or storage, not matters of taste. Cork taint (TCA): wet cardboard, dull fruit. Oxidation: brown colour, bruised apple or sherry smell. Reduction: struck match or rotten egg. Volatile acidity: vinegar or nail varnish. Brettanomyces ('Brett'): barnyard and sweaty horse.",
        "Faults and their smell", [["Cork taint (TCA)", "wet cardboard, flat fruit"], ["Oxidation", "bruised apple, sherry, brown colour"], ["Reduction", "struck match, rotten egg"], ["Volatile acidity", "vinegar, nail varnish"], ["Brettanomyces", "barnyard, sweaty horse"]]),
      Q("A wine smells of struck matches. The likely fault is", "Reduction", ["Cork taint", "Oxidation", "Brettanomyces"], "Reduction is sulphur compounds formed without enough air; swirling or decanting often blows it off."),
      S("Not faults: tartrate crystals, 'wine diamonds', at the bottom of a bottle, harmless, formed in the cold; sediment in an old red; a faint prickle in a young white. In a restaurant you taste the wine to check for faults, not to decide whether you like it."),
      Q("Small crystals in a bottle of white that has been in a cold cellar are most likely", "Harmless tartrate crystals", ["Ground-up cork", "A sign of oxidation", "Undissolved sugar"], "Tartaric acid forms crystals in the cold. They are harmless and taste of nothing."),
    ]),
    test("tasting-test", "Test: tasting", "red", [
      B("WN-131"), B("WN-137"), B("WN-138"), B("WN-139"), B("WN-140"),
      Q("Swirling a glass helps because it", "Releases aromas by mixing in oxygen", ["Cools the wine", "Removes sediment", "Mixes the alcohol through the wine"], "Swirling spreads the wine in a thin film and lets more aroma into the glass."),
    ]),
  ],
};
