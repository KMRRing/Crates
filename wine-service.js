// The Wine course, chapters 6 to 8: storage, service and pairing; fortified and sparkling wine; buying and the market.
import { S, Q, B, lesson, test } from "./wine-ask.js";

export const SERVICE = {
  id: "service", title: "Storage, service and pairing", lessons: [
    lesson("storage", "Storage", "red", [
      S("Keep wine cool, steady, still and dark. About 10 to 15 °C is ideal, with little swing: long heat above about 25 °C cooks a wine, and sharp changes can push the cork out. Lay corked bottles on their side so the cork stays moist; screwcaps can stand. A kitchen shelf is the worst place."),
      Q("Where should a bottle you want to keep for years go?", "A cool, dark place at a steady temperature", ["The fridge door, always at 4 °C", "A warm kitchen, near the cooker", "A bright shelf in the living room"], "Heat, light and swings in temperature age wine early. A fridge is too cold and too dry for long storage."),
      S("Most wine is made to be drunk young. Ageing rewards wines with the structure to last: high acid (Riesling, Chenin), high tannin (Barolo, Cabernet), sugar (Sauternes, Port) or high alcohol (fortified wines). With age fruit fades, tannin softens and tertiary aromas grow; a wine improves for a time, then declines."),
      Q("Which is most likely to improve over fifteen years?", "Barolo", ["Beaujolais Nouveau", "Provence rosé", "Prosecco"], "Barolo has the tannin and acid to last. The other three are made to be drunk within a year or two of release."),
    ]),
    lesson("serving", "Serving", "white", [
      S("Temperature changes everything. Sparkling and sweet wines well chilled (6 to 8 °C), light whites 8 to 10 °C, rich whites and light reds 10 to 14 °C, full reds 15 to 18 °C. A warm bottle takes about three hours in the fridge, or 20 to 30 minutes in iced water.",
        "Serving temperatures", [["Sparkling, sweet whites", "6 to 8 °C"], ["Light whites, rosé", "8 to 10 °C"], ["Rich whites, light reds", "10 to 14 °C"], ["Full reds", "15 to 18 °C"]]),
      Q("A Provence rosé is best served", "Well chilled, about 8 to 10 °C", ["At room temperature, about 20 °C", "Barely chilled, about 16 °C", "Very cold, about 2 °C, from the freezer"], "Rosé is served like a light white. Freezing numbs the aroma; a warm rosé tastes flabby."),
      S("Decanting does two jobs: it pours an old wine off its sediment, and it lets air soften a young, tannic one. Old, fragile wines can fade within the hour, so decant them just before serving. Fill a glass only a third, to leave room to swirl."),
      B("WN-136"),
      S("Glass shape matters less than the sellers say: a clear tulip with a stem, so a hand does not warm the bowl, is enough. Champagne is better in a tulip than a wide coupe, which lets the bubbles and aroma escape. To open fizz, hold the cork and turn the bottle, not the cork."),
      Q("Why serve Champagne in a tulip rather than a wide coupe?", "The bubbles and aroma escape less quickly", ["It warms the wine so it tastes sweeter", "It lets sediment settle faster", "It stops the cork flavour reaching the nose"], "A narrower opening keeps the mousse (the bubbles) and the scent in the glass."),
    ]),
    lesson("pairing", "Pairing food and wine", "red", [
      S("Pair by weight: delicate food with a delicate wine, rich with rich. Then echo or contrast. Acid cuts fat and salt: Champagne with fried food, Sancerre with goat's cheese. Tannin grips protein and fat: steak with Cabernet. But tannin clashes with chilli and fish oils, and can taste metallic."),
      Q("Why does a tannic red suit a steak?", "Fat and protein soften the tannin's grip", ["The red's sweetness balances the salt", "The wine's acid thins the sauce", "Both are served at the same temperature"], "Tannin binds to protein and fat, so the meat makes the wine seem smoother, and the wine cleans the palate."),
      S("Sugar: a dessert wine should be at least as sweet as the dessert, or it tastes thin and sour. Spice: off-dry, low-alcohol wines (Riesling) soothe chilli; high alcohol and tannin make heat worse. Salt and sweet: blue cheese with Port or Sauternes. 'What grows together goes together': Sancerre with Crottin de Chavignol."),
      B("WN-143"),
      B("WN-144"),
    ]),
    test("service-test", "Test: storage, service and pairing", "red", [
      B("WN-135"), B("WN-141"), B("WN-142"), B("WN-145"), B("WN-146"), B("WN-147"), B("WN-148"),
      Q("A fridge is a poor place to keep wine for years mainly because", "It is too cold and dry for the cork", ["It makes the tannin bitter after some years", "It turns the alcohol slowly into acid", "It stops the fermentation from ever finishing"], "Years of cold, dry air can shrink a cork and let air in. A fridge is fine for chilling a bottle for a few hours."),
    ]),
  ],
};

export const BUBBLES = {
  id: "fortified", title: "Fortified and sparkling wine", lessons: [
    lesson("champagne", "Champagne", "fizz", [
      S("Champagne: northern France, chalk soil, a cool climate. Chardonnay, Pinot Noir and Pinot Meunier. The traditional method: a still base wine is blended, bottled with yeast and a little sugar, and ferments again in the bottle; the bubbles are the carbon dioxide trapped by this second fermentation. The dead yeast stays in the bottle for months or years, giving a bread and brioche note."),
      S("The bottle is turned and tilted (riddling) so the yeast settles in the neck; the neck is frozen and the yeast plug is shot out (disgorgement); a 'dosage' of wine and sugar tops it up. Non-vintage Champagne must age at least 15 months in all, vintage at least three years. Pressure in the bottle is about six atmospheres."),
      S("The dosage decides how sweet it tastes.", "Champagne sweetness, sugar per litre", [["Brut Nature", "0 to 3 g, no added sugar"], ["Extra Brut", "0 to 6 g"], ["Brut", "up to 12 g"], ["Extra Dry", "12 to 17 g"], ["Sec", "17 to 32 g"]]),
      Q("Which of these Champagne styles is the driest?", "Brut Nature", ["Brut", "Extra Dry", "Sec"], "Brut Nature has no sugar added. Extra Dry, confusingly, is sweeter than Brut."),
      Q("Blanc de Blancs Champagne is made from", "Chardonnay only", ["Pinot Noir only", "Pinot Noir and Pinot Meunier", "White and red wine blended"], "Blanc de Blancs means white from white grapes: Chardonnay. Blanc de Noirs is white from black grapes."),
    ]),
    lesson("sparkling", "Other sparkling wine", "fizz", [
      S("The method sets cost and style. Traditional method (second fermentation in each bottle): Champagne, Cava, Crémant, Franciacorta, English sparkling wine. Tank method (second fermentation in a pressurised tank, then bottled): Prosecco, Asti, Lambrusco; fresher and fruitier, and cheaper.",
        "Two methods", [["Traditional", "Champagne, Cava, Crémant, Franciacorta"], ["Tank", "Prosecco, Asti, Lambrusco"]]),
      B("WN-051"),
      Q("Crémant is", "French bottle-fermented fizz from outside Champagne", ["A semi-sparkling wine made in Champagne itself", "A sweet sparkling wine made only in the Loire", "Champagne that is sold without a vintage year"], "Crémant d'Alsace, de Loire and de Bourgogne are made as Champagne is, from the local grapes, and cost much less."),
      S("Cava is Spain's, mostly from Penedès (Macabeo, Xarel·lo, Parellada). Sekt is German. English sparkling wine, from Sussex and Kent, grows on the same chalk as Champagne. Pét-nat is bottled before its first fermentation ends: cloudy and rustic."),
      B("WN-052"),
    ]),
    lesson("fortified", "Sherry, Port and Madeira", "gold", [
      S("A fortified wine has grape spirit added, which lifts alcohol to 15 to 22% and stabilises it. Port (the Douro, Portugal) is fortified during fermentation, so it keeps natural sugar and is sweet. Sherry (Jerez, Spain, Palomino) is fortified after fermentation, so it is usually dry; it is aged in a solera, a stack of barrels blended fraction by fraction."),
      B("WN-084"),
      S("Sherry: Fino and Manzanilla (Sanlúcar), pale, salty and dry, aged under a veil of yeast called flor. Amontillado starts under flor, then ages in air. Oloroso: no flor, walnut and dark. Pedro Ximénez: treacle-sweet, from sun-dried grapes. Port: Ruby (young, fruity), Tawny (aged in wood, nutty), Vintage (a declared year, aged in bottle, throws sediment).",
        "The styles", [["Fino, Manzanilla", "under flor: pale, dry, salty"], ["Oloroso", "no flor: dark, nutty, dry"], ["Pedro Ximénez", "sun-dried grapes: sweet"], ["Tawny Port", "aged in wood: amber, nutty"], ["Vintage Port", "bottle-aged: needs decanting"]]),
      Q("Which Port is aged in wood and is amber and nutty?", "Tawny", ["Vintage", "Ruby", "Late Bottled Vintage"], "Tawny ages for years in barrels and fades to amber. Vintage Port is bottled young and ages in glass."),
      S("Madeira, from an Atlantic island, is heated as it ages, in tanks or warm lofts, which makes it almost indestructible: an open bottle lasts for months. Styles run from dry to sweet: Sercial, Verdelho, Bual, Malmsey. Marsala (Sicily) and the French vins doux naturels (Banyuls, Muscat de Beaumes-de-Venise) are fortified too."),
    ]),
    test("fortified-test", "Test: fortified and sparkling wine", "fizz", [
      B("WN-043"), B("WN-044"), B("WN-047"), B("WN-080"), B("WN-081"), B("WN-082"), B("WN-085"), B("WN-086"),
    ]),
  ],
};

export const MARKET = {
  id: "market", title: "Buying and the market", lessons: [
    lesson("buying", "Buying wine", "red", [
      S("A bottle's price is land, labour, oak, time and reputation, then tax, shipping and margins. Restaurants often mark wine up to two or three times its shop price. Bargains sit beside famous names: the Languedoc beside the Rhône, Cahors beside Bordeaux, the Beaujolais crus beside Burgundy, the Douro and Dão in Portugal, southern Italy."),
      B("WN-158"),
      B("WN-054"),
      S("Critics' scores move prices. Robert Parker's 100-point scale made his name with the 1982 Bordeaux, and a high score lifts a price. A high score and a high price mean demand; they do not mean you will enjoy the wine more. Ask the merchant to let you taste first."),
      B("WN-154"),
    ]),
    lesson("fine", "The fine-wine market", "gold", [
      S("Fine wine is traded like a commodity. En primeur: Bordeaux sells a new vintage in the spring after the harvest, from barrel samples, and delivers about two years later. The château sells through brokers (courtiers) to merchants (négociants) on the Place de Bordeaux. Liv-ex, a London exchange, is where merchants trade, and it tracks price indices."),
      Q("What is the main risk of buying en primeur?", "Paying now for a wine you will not receive for two years", ["Receiving wine that has already passed its peak", "Paying duty twice, at the château and at the port", "Buying a wine the château has not yet made"], "You pay before the wine is bottled or shipped, so you depend on the merchant, the château and the market two years on."),
      S("Provenance, how a bottle has been stored, is a large part of its value. 'In bond' means duty and VAT have not been paid and the wine stays in a licensed warehouse; leaving bond triggers tax. An OWC (original wooden case) keeps a case intact. Fakes are real: Rudy Kurniawan was convicted in 2013 of selling counterfeit wine."),
      S("Demand moves prices. After Hong Kong dropped its wine duty in 2008, it became a trading hub; Chinese buyers lifted Lafite, which engraved a Chinese eight on its 2008 bottles. As an investment, wine earns nothing while it sits and costs storage, insurance and dealer margins. Wine's by-products have a use of their own: under the EU's renewable-energy rules, grape marc and wine lees are advanced feedstocks for biofuel."),
      B("WN-160"),
    ]),
    test("market-test", "Test: buying and the market", "gold", [
      B("WN-149"), B("WN-150"), B("WN-151"), B("WN-152"), B("WN-153"), B("WN-156"), B("WN-157"), B("WN-159"), B("WN-161"),
    ]),
  ],
};
