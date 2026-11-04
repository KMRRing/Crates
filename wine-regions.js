// The Wine course, chapter 3: the regions of France, Italy, Spain (and Portugal), Germany (with Austria and Switzerland) and the New World.
import { S, Q, B, lesson, test } from "./wine-ask.js";

export const REGIONS = {
  id: "regions", title: "Regions of the world", lessons: [
    lesson("bordeaux", "France: Bordeaux", "red", [
      S("Bordeaux lies on the Gironde estuary, where the Garonne and Dordogne rivers join. Wines are blends, named by château and appellation, not grape. The reds use Cabernet Sauvignon, Merlot and Cabernet Franc, with a little Petit Verdot and Malbec."),
      S("Left Bank (west of the Gironde and Garonne: Médoc and Graves): gravel, Cabernet-led, blackcurrant and cedar, high tannin. Right Bank (east of the Dordogne: Saint-Émilion and Pomerol): clay and limestone, Merlot-led, plum and chocolate, softer.",
        "Two banks", [["Left Bank", "Pauillac, Margaux, Saint-Julien, Saint-Estèphe"], ["Soil", "gravel: Cabernet ripens late and needs the warmth"], ["Right Bank", "Saint-Émilion, Pomerol"], ["Soil", "clay and limestone: Merlot thrives"]]),
      Q("Which appellation is on the Right Bank, led by Merlot?", "Pomerol", ["Pauillac", "Margaux", "Saint-Julien"], "Pomerol and Saint-Émilion are Right Bank. Pétrus, from Pomerol, is nearly pure Merlot."),
      S("In 1855, for the Paris Exposition, Napoleon III asked Bordeaux's brokers to rank the best châteaux. They graded the Médoc reds (and Haut-Brion of Graves) in five growths, and Sauternes in its own list, on the prices the wines fetched. The only change since: Mouton Rothschild, promoted to first growth in 1973."),
      Q("The 1855 classification ranked châteaux by", "Their market price", ["A blind tasting by merchants", "Each estate's soil type", "The age of the vines"], "The brokers used what each wine had fetched over many years, so price stood in for quality."),
      B("WN-022"),
      S("White Bordeaux: Sauternes is sweet, Sémillon touched by noble rot (Yquem); Pessac-Léognan makes the best dry whites from Sauvignon Blanc and Sémillon. Saint-Émilion has its own classification, redone about every ten years. A second wine is made from a grand vin's younger vines."),
      Q("Sauternes is", "Sweet, from Sémillon touched by noble rot", ["Dry, from Merlot grown on gravel", "Sparkling, from Sauvignon Blanc", "Fortified, from Cabernet Franc"], "Noble rot shrivels the berries and concentrates sugar; the wine is golden and sweet."),
    ]),
    lesson("burgundy", "France: Burgundy and Beaujolais", "red", [
      S("Burgundy is a long strip from Chablis in the north to Beaujolais in the south. Pinot Noir for reds, Chardonnay for whites, and the plot is what counts. The Côte d'Or slope has two halves: Côte de Nuits (mostly reds: Gevrey-Chambertin, Vosne-Romanée) and Côte de Beaune (famous whites: Meursault, Puligny-Montrachet; and reds: Pommard, Volnay).",
        "The Côte d'Or", [["Côte de Nuits", "Gevrey-Chambertin, Chambolle-Musigny, Vosne-Romanée"], ["Côte de Beaune", "Meursault, Puligny-Montrachet, Pommard, Volnay"], ["Reds", "Pinot Noir"], ["Whites", "Chardonnay"]]),
      S("The ladder: regional Bourgogne, then a village (Gevrey-Chambertin), then Premier Cru (named plots), then Grand Cru (the best plots, each its own appellation: Chambertin, Montrachet, La Romanée-Conti). A 'climat' is a named plot. A monopole is a plot owned by one domaine. Plots are split among many owners, so the producer matters as much as the plot."),
      Q("What is true of a Burgundy Grand Cru?", "It is a named vineyard with its own appellation", ["It is a producer's top blend of several villages", "It is the best wine of a village, labelled with the village", "It is a ranking of châteaux, as in 1855"], "Burgundy ranks the land, not the producer. A Grand Cru's label carries the vineyard's name."),
      S("North: Chablis, cool, Chardonnay, steely, on Kimmeridgian limestone full of fossil oysters. South: the Mâconnais (Pouilly-Fuissé), warmer and cheaper Chardonnay. Just below lies Beaujolais: Gamay on granite, with ten named crus (Morgon, Fleurie, Moulin-à-Vent, Brouilly) above plain Beaujolais."),
      B("WN-038"),
      Q("Chablis is Chardonnay grown in", "Cool northern Burgundy on limestone", ["Warm southern Burgundy on granite", "The Côte de Nuits on red clay", "A high valley of the Jura"], "Chablis is Burgundy's coolest, northernmost zone: lean, steely wines from Kimmeridgian limestone."),
    ]),
    lesson("france-rest", "France: Rhône, Loire, Alsace", "white", [
      S("Northern Rhône: steep granite slopes, Syrah alone: Côte-Rôtie, Hermitage, Cornas, Crozes-Hermitage; the white Condrieu is Viognier. Southern Rhône: hot, flat, blends led by Grenache: Châteauneuf-du-Pape (up to thirteen grapes, on big round stones that store heat), Gigondas, plain Côtes du Rhône."),
      Q("Which describes the southern Rhône?", "Hot, with Grenache-led blends", ["Cool, with Syrah on granite slopes", "Cool, with single-plot Pinot Noir", "Maritime, with Cabernet and Merlot on gravel"], "Syrah on granite is the north. The south is warm and wide, and Grenache leads the blends."),
      B("WN-009"),
      S("Loire: Muscadet at the mouth (Melon de Bourgogne, briny, often sur lie). Anjou, Saumur and Vouvray in the middle: Chenin Blanc, dry to sweet, and Cabernet Franc at Chinon and Bourgueil. Upriver, Sancerre and Pouilly-Fumé: Sauvignon Blanc."),
      Q("Which pair of Loire wines are both Chenin Blanc?", "Vouvray and Savennières", ["Sancerre and Pouilly-Fumé", "Chinon and Bourgueil", "Muscadet and Sancerre"], "Sancerre and Pouilly-Fumé are Sauvignon Blanc, Chinon and Bourgueil Cabernet Franc, and Muscadet is Melon de Bourgogne."),
      S("Alsace labels name the grape, which is unusual in France: Riesling, Gewürztraminer, Pinot Gris, Muscat. Provence is mostly rosé; Bandol's reds are Mourvèdre. Languedoc-Roussillon has the largest vineyard area in France, with value reds and Mediterranean blends. Cahors makes Malbec, locally called Côt."),
    ]),
    lesson("piedmont", "Italy: Piedmont and the north", "red", [
      S("Italy grows grapes nearly everywhere, with hundreds of local varieties; the great names are Piedmont and Tuscany. Piedmont, under the Alps: Nebbiolo makes Barolo and Barbaresco in the Langhe hills. Barbera and Dolcetto are the everyday reds.",
        "Piedmont's reds", [["Barolo", "Nebbiolo: pale, tannic, acidic, roses and tar"], ["Barbaresco", "Nebbiolo: a little softer, earlier"], ["Barbera", "juicy, high acid, soft tannin"], ["Dolcetto", "dark, fruity, a little bitter"]]),
      Q("Which describes Barolo?", "Pale, tannic and high in acid, with roses and tar", ["Deep purple, soft and low in acid, with jam and vanilla", "Light, juicy and low in tannin, with bubblegum", "Dark, peppery and medium in acid, with olives and smoke"], "Nebbiolo is pale in colour yet strong in tannin and acid, so Barolo needs years in bottle."),
      S("Also Piedmont: Moscato d'Asti (sweet, lightly sparkling, low alcohol) and Gavi (Cortese, dry white). Veneto: Prosecco (Glera), Soave (Garganega), and Valpolicella, where Corvina grapes are dried for Amarone. Friuli and Alto Adige: crisp whites. Lombardy: Franciacorta, bottle-fermented sparkling wine."),
      Q("Which Italian sparkling wine has its second fermentation in the bottle, like Champagne?", "Franciacorta", ["Prosecco", "Asti", "Lambrusco"], "Prosecco, Asti and Lambrusco are tank-method wines. Franciacorta uses the traditional method."),
      B("WN-070"),
    ]),
    lesson("tuscany", "Italy: Tuscany and the south", "red", [
      S("Tuscany is Sangiovese: cherry, high acid, firm tannin, leather and dried herbs. Chianti Classico (a black rooster on the neck), Brunello di Montalcino (100% Sangiovese, at least five years of ageing), Vino Nobile di Montepulciano. The 'Super Tuscans' broke the rules with Cabernet and Merlot: Sassicaia, from Bolgheri."),
      Q("A 'Super Tuscan' is typically", "A Tuscan red outside the old rules, often with Cabernet", ["A Chianti Classico aged five years in oak", "A Brunello di Montalcino from the best slope", "A sweet Vin Santo made from dried grapes"], "They were first sold as plain table wine because they ignored the appellation rules; many are IGT today."),
      S("South and islands: Montepulciano d'Abruzzo is the Montepulciano grape, not the town. Puglia: Primitivo. Campania: Aglianico (Taurasi) and the whites Fiano and Greco. Sicily: Nero d'Avola, and Etna, where Nerello Mascalese grows on a volcano. Sardinia: Vermentino."),
      B("WN-010"),
      B("WN-072"),
    ]),
    lesson("spain", "Spain and Portugal", "red", [
      S("Spain has the largest vineyard area in the world. Rioja: Tempranillo, often with Garnacha, aged in oak and named Crianza, Reserva or Gran Reserva by its ageing. Ribera del Duero: bigger Tempranillo (Vega Sicilia). Priorat: Garnacha and Cariñena on black slate called llicorella, powerful.",
        "Spanish reds", [["Rioja", "Tempranillo; Alta, Alavesa, Oriental"], ["Ribera del Duero", "Tempranillo (Tinto Fino); Vega Sicilia"], ["Priorat", "Garnacha, Cariñena on llicorella slate"], ["Toro", "Tempranillo (Tinta de Toro), dark and strong"]]),
      Q("Rioja reds are named Crianza, Reserva or Gran Reserva by", "How long they were aged before release", ["The sweetness of the grapes", "The altitude of the vineyard", "The share of Tempranillo"], "The words are fixed by law: the longer the ageing in oak and bottle, the higher the term."),
      S("White Spain: Albariño from Rías Baixas in the green northwest, salty and peachy; Verdejo from Rueda; Cava from Penedès. Portugal: the Douro (Port, and now dry reds from Touriga Nacional), Vinho Verde (young, light, sometimes a little spritzy), Dão, Alentejo. Sherry and Port come in chapter 7."),
      B("WN-087"),
    ]),
    lesson("germany", "Germany", "white", [
      S("Germany is cool, northern and mostly white. Riesling is the leading grape: dry or sweet, low in alcohol and high in acid. The Mosel's steep slate slopes give delicate, mineral wines; the Rheingau and Pfalz fuller ones. Spätburgunder is Pinot Noir, good in Baden and the Pfalz."),
      Q("Where do steep slate slopes make Germany's most delicate Rieslings?", "The Mosel", ["The Rheingau", "The Pfalz", "Franken"], "The Mosel's slate stores heat and gives the wines a stony edge, light in alcohol and bright in acid."),
      S("Franken, in northern Bavaria, makes dry, earthy Silvaner, traditionally in the flat flask called the Bocksbeutel. Other grapes: Müller-Thurgau, Grauburgunder (Pinot Gris), Weissburgunder (Pinot Blanc). A German label shows the Prädikat (chapter 4), which measures ripeness at harvest."),
      B("WN-095"),
    ]),
    lesson("alps", "Austria and Switzerland", "white", [
      S("Austria: Grüner Veltliner (white pepper, citrus), Riesling, and the reds Blaufränkisch and Zweigelt. In the Wachau, on Danube terraces, dry wines are graded by weight: Steinfeder (light), Federspiel, Smaragd (richest). A 1985 scandal over wine sweetened with diethylene glycol led to some of Europe's strictest wine laws."),
      B("WN-097"),
      S("Switzerland drinks most of its wine itself. Vaud: Chasselas on the terraces of Lavaux, above Lake Geneva. Valais, in the Rhône valley: Fendant (Chasselas), Petite Arvine, Cornalin, Syrah. Geneva: Gamay, Chasselas, Gamaret. Ticino: Merlot. A cheese fondue wants a dry white such as Chasselas.",
        "Swiss wine", [["Vaud", "Chasselas; Lavaux, Dézaley"], ["Valais", "Fendant, Petite Arvine, Cornalin"], ["Geneva", "Gamay, Chasselas, Gamaret"], ["Ticino", "Merlot"]]),
      B("WN-099"),
      B("WN-103"),
    ]),
    lesson("nw-north", "The New World: the Americas", "red", [
      S("The New World names the grape on the label. California: Napa Valley's Cabernet Sauvignon (and Opus One), Sonoma's Chardonnay and Pinot Noir, Zinfandel. In 1976 the Judgment of Paris, a blind tasting by French judges, put Californian wines ahead of top French ones. Oregon's Willamette Valley: Pinot Noir. Washington State: Cabernet and Merlot."),
      B("WN-105"),
      S("Argentina: Mendoza, a desert high in the Andes, watered by snowmelt; Malbec. Chile: long and narrow between the Andes and the Pacific; Cabernet in the Maipo, Sauvignon Blanc near the cold coast, and Carménère, which was taken for Merlot until 1994."),
      B("WN-117"),
    ]),
    lesson("nw-south", "The New World: the south", "red", [
      S("Australia: Shiraz in the Barossa and McLaren Vale (Penfolds Grange), Cabernet on Coonawarra's red terra rossa soil, Sémillon in the Hunter Valley, Riesling in Clare, Chardonnay in Margaret River. New Zealand: Marlborough Sauvignon Blanc (Cloudy Bay), Pinot Noir in Central Otago.",
        "Australia and New Zealand", [["Barossa Valley", "old-vine Shiraz"], ["Coonawarra", "Cabernet on terra rossa over limestone"], ["Hunter Valley", "long-lived unoaked Sémillon"], ["Marlborough", "Sauvignon Blanc"], ["Central Otago", "Pinot Noir"]]),
      B("WN-108"),
      S("South Africa: Stellenbosch and Paarl; Chenin Blanc (once called Steen) is the most planted grape; Pinotage, a 1925 cross of Pinot Noir and Cinsault, is the national red. Constantia's sweet wine was famous in Napoleon's day."),
      B("WN-115"),
    ]),
    test("france-test", "Test: France", "red", [
      B("WN-021"), B("WN-024"), B("WN-029"), B("WN-031"), B("WN-032"), B("WN-034"), B("WN-056"), B("WN-057"), B("WN-061"), B("WN-064"),
    ]),
    test("south-test", "Test: Italy and Spain", "red", [
      B("WN-066"), B("WN-067"), B("WN-068"), B("WN-071"), B("WN-073"), B("WN-077"), B("WN-078"), B("WN-079"),
    ]),
    test("world-test", "Test: Germany to the New World", "white", [
      B("WN-092"), B("WN-094"), B("WN-100"), B("WN-104"), B("WN-107"), B("WN-109"), B("WN-112"), B("WN-114"),
    ]),
  ],
};
