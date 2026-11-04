// The Wine course, chapters 1 and 2: grapes and styles, and how wine is made.
import { S, Q, B, lesson, test } from "./wine-ask.js";

export const GRAPES = {
  id: "grapes", title: "Grapes and styles", lessons: [
    lesson("dials", "The three dials of a red", "red", [
      S("Place any red on three dials. Body: how heavy it feels, from tea to cream. Tannin: the grip on your gums, from skins, seeds and oak. Fruit: red (cherry, strawberry) or black (blackcurrant, plum). Warmth pushes all three up.",
        "Four reds on the dials", [["Pinot Noir", "light to medium body, low to medium tannin, red fruit"], ["Merlot", "medium to full, medium tannin, plum"], ["Cabernet Sauvignon", "full body, high tannin, blackcurrant"], ["Syrah", "full body, medium to high tannin, blackberry and pepper"]]),
      Q("Which red sits at the light, silky, red-fruit end of the dials?", "Pinot Noir", ["Cabernet Sauvignon", "Malbec", "Syrah"], "Pinot Noir is thin-skinned: pale, low in tannin, with cherry and strawberry. Cabernet, Malbec and Syrah are thick-skinned and darker."),
      S("Tannin is a texture, not a taste: the dry, gripping feel of strong black tea. It comes from skins, seeds, stems and new oak. White wines have little, because their juice leaves the skins early. A white's dial is acid, the mouth-watering sharpness."),
      Q("What does tannin do in the mouth?", "Dries and grips the gums", ["Waters the sides of the tongue", "Warms the back of the throat", "Coats the tongue with sweetness"], "Water at the sides of the tongue is acid, warmth in the throat is alcohol, and sweetness is sugar. Tannin is the drying grip."),
      S("Climate moves the dials. Warm: ripe grapes, more sugar (so more alcohol), fuller body, softer acid and darker, jammier fruit. Cool: less sugar, lighter body, high acid and tart red fruit. Burgundy is cool, Bordeaux moderate, the southern Rhône hot."),
      Q("Which description fits a cool-climate red?", "Light body, high acid, tart red cherry", ["Full body, low acid, baked blackberry jam", "Heavy body, soft acid, raisined plum", "Rich body, 15% alcohol, stewed fig"], "Cool years leave less sugar and keep the acid: lighter, tarter, red-fruited wine. The other three describe heat."),
    ]),
    lesson("reds", "The red grapes", "red", [
      S("Cabernet Sauvignon: small, thick-skinned, late-ripening; blackcurrant, cedar, firm tannin. Merlot ripens earlier and is plummier and softer. Bordeaux blends them, with Cabernet Franc (leafy, raspberry) as a third. Malbec is dark and plummy: Cahors, then Argentina.",
        "Bordeaux's reds", [["Cabernet Sauvignon", "the Médoc's backbone: blackcurrant, cedar, tannin"], ["Merlot", "Pomerol and Saint-Émilion: plum, soft"], ["Cabernet Franc", "leafy, raspberry; also Chinon in the Loire"], ["Malbec", "dark plum; Cahors, Mendoza"]]),
      Q("Which grape is Cabernet Sauvignon's earlier-ripening, plummier partner in Bordeaux?", "Merlot", ["Malbec", "Pinot Noir", "Syrah"], "Merlot ripens sooner and softer. Cabernet gives the frame, Merlot the flesh."),
      S("Pinot Noir: hard to grow, silky red fruit; red Burgundy, Oregon, Central Otago. Syrah: peppery and black-fruited; the northern Rhône, and Shiraz in Australia. Grenache: warm, sweet-fruited, high in alcohol; southern Rhône and Spain's Garnacha.",
        "One grape, several names", [["Pinot Noir", "Spätburgunder (Germany), Pinot Nero (Italy)"], ["Syrah", "Shiraz in Australia and South Africa"], ["Grenache", "Garnacha in Spain"], ["Mourvèdre", "Monastrell in Spain"], ["Zinfandel", "Primitivo in Puglia"]]),
      Q("Which pair of names is one grape?", "Syrah and Shiraz", ["Merlot and Malbec", "Gamay and Grenache", "Cabernet Franc and Cabernet Sauvignon"], "Syrah and Shiraz are the same grape. Cabernet Sauvignon is a cross of Cabernet Franc and Sauvignon Blanc, so a different grape."),
      S("Italy and Spain: Sangiovese (Chianti, Brunello) is cherry, high in acid, firm in tannin. Nebbiolo (Barolo) is pale but high in tannin and acid, with roses and tar. Tempranillo (Rioja) is medium-bodied with red fruit and leather. Gamay (Beaujolais) is light and juicy, with little tannin."),
      Q("Pale in the glass, yet high in tannin and acid, with roses and tar. Which grape?", "Nebbiolo", ["Gamay", "Merlot", "Grenache"], "Nebbiolo makes Barolo and Barbaresco: pale and perfumed, but tannic and acidic, and long-lived."),
    ]),
    lesson("whites", "The white grapes", "white", [
      S("Chardonnay is a blank page: lean, citrusy and stony in cool Chablis; rounder, with apple and peach, where it is warmer. Oak adds vanilla and toast, and malolactic conversion adds butter (chapter 2). Sauvignon Blanc: grass, gooseberry, sharp acid; Sancerre and Marlborough."),
      Q("Grass, gooseberry and sharp acid: which grape?", "Sauvignon Blanc", ["Chardonnay", "Pinot Grigio", "Viognier"], "Sauvignon Blanc is the herbaceous, zesty white of Sancerre and Marlborough."),
      S("Riesling: high acid, floral, lime to peach; dry to sweet; ages for decades and picks up a petrol note. Germany and Alsace. Chenin Blanc: honey, quince and acid; the Loire (Vouvray, Savennières) and South Africa. Pinot Gris is light in Italy (Pinot Grigio), rich and spicy in Alsace."),
      S("Some whites are known by their scent. Gewürztraminer smells of lychee and rose; Viognier of peach and apricot; Grüner Veltliner of white pepper; Albariño is citrusy and salty; Sémillon is waxy and, with noble rot, makes Sauternes.",
        "Whites by scent", [["Gewürztraminer", "lychee, rose; Alsace"], ["Viognier", "peach, apricot; Condrieu"], ["Grüner Veltliner", "white pepper; Austria"], ["Albariño", "citrus, salty; Rías Baixas"], ["Sémillon", "waxy; Sauternes, Hunter Valley"]]),
      B("WN-015"),
    ]),
    test("grapes-test", "Test: grapes and styles", "red", [
      B("WN-001"), B("WN-004"), B("WN-005"), B("WN-006"), B("WN-011"), B("WN-012"), B("WN-013"),
      Q("A light, juicy red with little tannin and a bubblegum note is most likely", "Gamay", ["Syrah", "Cabernet Sauvignon", "Tempranillo"], "Gamay, the grape of Beaujolais, gives light, fruity reds with soft tannin."),
    ]),
  ],
};

export const MAKING = {
  id: "making", title: "How wine is made", lessons: [
    lesson("ferment", "From grape to alcohol", "rose", [
      S("Wine is fermented grape juice: yeast eats the sugar and makes alcohol and carbon dioxide. Nearly all grape juice is clear, whatever the skin. The colour lives in the skin."),
      Q("Why can white wine be made from black grapes?", "Their juice is clear; the colour sits in the skins", ["Yeast bleaches the pigment as it ferments", "Black grapes lose their colour when ripe", "The pigment is filtered out after ageing"], "Press black grapes at once and the juice stays pale. This is how a Blanc de Noirs is made."),
      S("Red: crushed grapes ferment with their skins, taking colour and tannin. White: pressed first, so only juice ferments, usually cool, to keep fresh fruit. Rosé: black grapes sit on their skins for a few hours, then are pressed and the pink juice ferments like a white."),
      Q("In a still rosé, the pink usually comes from", "A few hours of contact with black grape skins", ["Stopping a red's fermentation early", "A little red dye added to a white wine", "Ageing a white in red-wine barrels"], "Short skin contact gives pale colour and little tannin; the longer the contact, the darker the rosé."),
      S("Sugar becomes alcohol. A dry wine is fermented until almost no sugar is left. Stop early, or start from very sweet juice, and sugar remains: a sweet wine. In cool regions sugar is sometimes added to the juice before fermentation to raise alcohol: chaptalisation."),
      Q("Chaptalisation means adding", "Sugar to the juice before fermentation", ["Tartaric acid to a flat wine after fermentation", "Grape spirit to a wine during fermentation", "Oak chips to a wine during ageing"], "Chaptalisation raises alcohol, not sweetness, as the added sugar ferments out. It is banned in much of southern Europe. Adding spirit during fermentation is how Port is made."),
    ]),
    lesson("oak", "Oak, lees and time", "red", [
      S("Where a wine ferments and rests changes it. Stainless steel is neutral and keeps fruit fresh. Oak barrels let in a little air and add vanilla, spice and toast, most when new. A Bordeaux barrique holds 225 litres; Burgundy's pièce 228."),
      Q("What does new oak add to a wine?", "Vanilla, toast and tannin", ["Mineral salinity and acidity", "Ripe fruit and sweetness", "Honey and noble-rot flavours"], "New oak gives vanilla, toast and spice, and some tannin. Old barrels give little flavour and only let air in."),
      S("Malolactic conversion: bacteria turn sharp malic acid (green apple) into softer lactic acid (milk). Nearly all reds go through it; whites by choice. It rounds the wine and, in Chardonnay, makes the butter note. A winemaker blocks it to keep a white sharp."),
      Q("Which process turns sharp malic acid into softer lactic acid?", "Malolactic conversion", ["Carbonic maceration", "Cold stabilisation", "Chaptalisation"], "Cold stabilisation chills the wine so tartrate crystals fall out. Carbonic maceration is a way of making light reds."),
      S("Lees are the dead yeast cells left after fermentation. Resting on them, sometimes stirred (bâtonnage), gives a creamy texture and a bready note. Muscadet 'sur lie' is kept on its lees until bottling; Champagne rests on them for years."),
      Q("'Sur lie' means a wine was kept on", "Its dead yeast cells", ["Its grape skins", "Its grape stems", "Its oak chips"], "Lees are the dead yeast. Skins and stems are what a red ferments on; oak chips are a cheap substitute for barrels."),
    ]),
    lesson("methods", "Other ways to make wine", "gold", [
      S("Sweet wines concentrate sugar. Noble rot (botrytis) is a fungus that dries the berries on the vine: Sauternes, Tokaji, German Beerenauslese. Eiswein: grapes frozen on the vine, pressed frozen. Passito: grapes dried indoors. Amarone also dries them, but ferments dry."),
      Q("Which sweet wine is made from grapes frozen on the vine?", "Eiswein", ["Sauternes", "Tokaji Aszú", "Moscato d'Asti"], "Sauternes and Tokaji use noble rot. Moscato d'Asti is sweet because fermentation is stopped early."),
      S("Carbonic maceration: whole bunches sealed in a tank of carbon dioxide start fermenting inside each berry. The wine is purple, fruity and low in tannin, with a bubblegum or banana note: Beaujolais. Orange wine: white grapes fermented on their skins, like a red."),
      Q("What does carbonic maceration make?", "A purple, fruity, low-tannin red", ["A pale, tannic, oak-aged white", "A sweet, botrytised dessert wine", "A dry, salty, yeast-aged white"], "It is the Beaujolais method: whole bunches, no crushing, bright fruit and almost no tannin."),
      S("Sulphur dioxide is added to nearly all wine in small doses to stop oxidation and microbes. 'Natural' wine uses none or very little but has no EU legal definition. Phylloxera, an American aphid, destroyed most European vines from the 1860s; the cure was grafting onto American roots."),
    ]),
    test("making-test", "Test: how wine is made", "red", [
      B("WN-121"), B("WN-122"), B("WN-124"), B("WN-126"), B("WN-127"), B("WN-129"), B("WN-130"), B("WN-133"),
    ]),
  ],
};
