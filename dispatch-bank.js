// Dispatch's meetings: one significant, documented act or word of a notable person, put in a place and a year. Hanseatic and
// medieval trade to the late age of exploration, with the political and scientific turns beside the mercantile ones. The
// person "tells you" the `what` (a clause that follows the name: "Waldemar IV Atterdag has just stormed Visby."), and the
// `why` is the one line of what it meant, shown while you read and again when the notes are marked.
//
// Rules for an entry (tests/dispatch.mjs): the act is true and datable to that year; the place is where it was done, or where
// the person is most closely tied to it; `what` is under about fifty-five characters so it fits a slot in the notes; no two
// entries of one person share a place (a day never holds two of a place), and a person's later meetings are listed after the first. Korbi, 9 November 2026: mostly famous people, a few less so, so the names have to be learned; a person with several significant details has several meetings, and some facts have a second wording (`alt`) for the notes. `pid` is the person, `id` the meeting.
// regions: baltic germany italy iberia lowlands britain france asia levant americas africa
// fame: 1 a name most people know, 3 one few do, 2 the rest. Easy deals no 3s, so the first days are of names you have heard.
const FAMOUS = new Set("marco-polo christopher-columbus vasco-da-gama ferdinand-magellan martin-luther johannes-gutenberg galileo-galilei johannes-kepler nicolaus-copernicus leonardo-da-vinci niccolo-machiavelli henry-viii elizabeth-i francis-drake mehmed-ii zheng-he charles-v philip-ii henry-the-navigator lorenzo-de-medici francisco-pizarro moctezuma-ii kublai-khan mansa-musa".split(" "));
const OBSCURE = new Set("francesco-datini eric-of-pomerania aldus-manutius martin-waldseemuller afonso-de-albuquerque bartholomaus-welser jurgen-wullenwever thomas-gresham cornelis-de-houtman willem-barentsz will-adams willem-janszoon john-napier thomas-roe jan-pieterszoon-coen waldemar-iv-atterdag margaret-i albert-of-riga nasir-al-din-al-tusi rabban-bar-sauma johann-wittenborg bertram-wulflam hildebrand-veckinchusen georg-gisze ulugh-beg zara-yaqob oba-ewuare benedetto-cotrugli sonni-ali askia-muhammad the-zamorin-of-calicut afonso-i-of-kongo mahmud-shah-of-malacca piri-reis enrique-of-malacca koxinga nur-jahan nzinga-of-ndongo autshumato albert-iv-of-bavaria andrea-doria leonardo-loredan".split(" "));
const idOf = who => who.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
// nationality as the person is known (Korbi, 9 Nov 2026: always shown with the name), by person id
const NAT = {
  fibonacci: "Pisan", "enrico-dandolo": "Venetian", "frederick-ii": "Holy Roman", "marco-polo": "Venetian", "ibn-battuta": "Moroccan", "waldemar-iv-atterdag": "Danish", "francesco-datini": "Tuscan", "margaret-i": "Danish",
  "zheng-he": "Chinese", "eric-of-pomerania": "Pomeranian", "cosimo-de-medici": "Florentine", "henry-the-navigator": "Portuguese", "mehmed-ii": "Ottoman", "johannes-gutenberg": "German", "lorenzo-de-medici": "Florentine",
  "leonardo-da-vinci": "Florentine", "christopher-columbus": "Genoese", "bartolomeu-dias": "Portuguese", "ivan-iii": "Muscovite", "luca-pacioli": "Tuscan", "vasco-da-gama": "Portuguese", "john-cabot": "Venetian",
  "pedro-alvares-cabral": "Portuguese", "aldus-manutius": "Italian", "martin-waldseemuller": "German", "afonso-de-albuquerque": "Portuguese", "vasco-nunez-de-balboa": "Spanish", "niccolo-machiavelli": "Florentine",
  erasmus: "Dutch", "jakob-fugger": "German", "ferdinand-magellan": "Portuguese", "moctezuma-ii": "Aztec", "martin-luther": "German", "juan-sebastian-elcano": "Basque", "gustav-vasa": "Swedish", "bartholomaus-welser": "German",
  "francisco-pizarro": "Spanish", "jurgen-wullenwever": "German", "georg-gisze": "German", "hans-holbein-the-younger": "German", "henry-viii": "English", "jacques-cartier": "French", "nicolaus-copernicus": "Prussian",
  "andreas-vesalius": "Flemish", "francis-xavier": "Navarrese", "charles-v": "Habsburg", "gerardus-mercator": "Flemish", "abraham-ortelius": "Flemish", "thomas-gresham": "English", "tycho-brahe": "Danish",
  "francis-drake": "English", "william-of-orange": "Dutch", "philip-ii": "Spanish", "cornelis-de-houtman": "Dutch", "willem-barentsz": "Dutch", "elizabeth-i": "English", "will-adams": "English", "matteo-ricci": "Italian",
  "willem-janszoon": "Dutch", "galileo-galilei": "Tuscan", "johannes-kepler": "German", "henry-hudson": "English", "hugo-grotius": "Dutch", "john-napier": "Scottish", "thomas-roe": "English", "jan-pieterszoon-coen": "Dutch",
  "william-harvey": "English", "abel-tasman": "Dutch", "jan-van-riebeeck": "Dutch", "christiaan-huygens": "Dutch", "antonie-van-leeuwenhoek": "Dutch", "albert-of-riga": "German", "sundiata-keita": "Malian",
  "nasir-al-din-al-tusi": "Persian", "kublai-khan": "Mongol", "rabban-bar-sauma": "Turkic", "mansa-musa": "Malian", "johann-wittenborg": "German", "bertram-wulflam": "German", "hildebrand-veckinchusen": "German",
  "ulugh-beg": "Timurid", "zara-yaqob": "Ethiopian", "oba-ewuare": "Benin", "sejong-the-great": "Korean", "benedetto-cotrugli": "Ragusan", "sonni-ali": "Songhai", "askia-muhammad": "Songhai", "the-zamorin-of-calicut": "Keralan",
  "albert-iv-of-bavaria": "Bavarian", "afonso-i-of-kongo": "Kongolese", "leonardo-loredan": "Venetian", "mahmud-shah-of-malacca": "Malay", "piri-reis": "Ottoman", malintzin: "Nahua", "enrique-of-malacca": "Malay",
  "lapu-lapu": "Filipino", "andrea-doria": "Genoese", babur: "Timurid", akbar: "Mughal", "tokugawa-ieyasu": "Japanese", "nur-jahan": "Mughal", "nzinga-of-ndongo": "Mbundu", autshumato: "Khoikhoi",
  "kangxi-emperor": "Qing", koxinga: "Chinese", shivaji: "Maratha", "robert-the-bruce": "Scottish", "klaus-stortebeker": "German",
};
// The second wording (Korbi, 9 Nov 2026): a fact read as `what` comes back in the notes and the lists as `alt`, the same information
// from another side, so it has to be recognised and not just matched. Facts without one return as read. By meeting id; a later
// meeting of a person already in the bank gets its `alt` as the last argument of m().
const ALT = {
  fibonacci: "brings Arabic numerals into European business", "marco-polo": "recounts the court of Kublai Khan from a prison cell", "zheng-he": "leaves for the Indian Ocean with a Ming armada",
  "eric-of-pomerania": "taxes every ship passing Denmark's narrow strait", "henry-the-navigator": "pushes Portuguese ships beyond Africa's feared cape", "mehmed-ii": "ends the Byzantine empire by taking its capital",
  "johannes-gutenberg": "completes the first major book printed with type", "leonardo-da-vinci": "writes to Milan's ruler, stressing war machines", "christopher-columbus": "gets the sovereigns' terms for a western route",
  "bartolomeu-dias": "returns having found the way round Africa", "ivan-iii": "shuts the Hanseatic yard in Novgorod", "luca-pacioli": "prints the Venetian way of keeping accounts", "vasco-da-gama": "arrives at the pepper coast after rounding Africa",
  "john-cabot": "reaches North America under English colours", "afonso-de-albuquerque": "has made Goa Portugal's base in India", "ferdinand-magellan": "leaves Spain to reach the Spice Islands westward",
  "martin-luther": "stands his ground at the Diet of Worms", "juan-sebastian-elcano": "brings the surviving ship home round the world", "gustav-vasa": "wins the Swedish crown with Lübeck's fleet",
  "nicolaus-copernicus": "publishes the Sun-centred model of the planets", "andreas-vesalius": "overturns Galen with a book of dissections", "gerardus-mercator": "publishes a chart where compass courses are straight",
  "abraham-ortelius": "bundles uniform maps into the first atlas", "francis-drake": "brings home the Golden Hind loaded with Spanish silver", "william-of-orange": "declares the Dutch provinces free of Philip",
  "philip-ii": "launches a great fleet at Elizabeth's England", "elizabeth-i": "grants a monopoly to English traders in Asia", "galileo-galilei": "demonstrates a spyglass to Venice's rulers", "johannes-kepler": "gives Mars an oval orbit, not a circle",
  "hugo-grotius": "claims the ocean can belong to no nation", "john-napier": "invents a shortcut for long multiplication", "jan-pieterszoon-coen": "makes Batavia the Company's Asian capital", "william-harvey": "describes the heart as a pump",
  "christiaan-huygens": "makes a clock regulated by a pendulum", "antonie-van-leeuwenhoek": "peers at microbes with a lens he made himself", "kublai-khan": "takes the title of Great Khan of the Mongols",
  "mansa-musa": "floods Cairo with gold on his pilgrimage", "sejong-the-great": "has a simple script made for common readers", "sonni-ali": "makes Timbuktu a Songhai city", "tokugawa-ieyasu": "receives the shogunate from the emperor",
  koxinga: "drives the Dutch from Formosa",
};
// The picture of a meeting (Korbi, 9 Nov 2026: maps for the navigators, drafts for the scientists, paintings for the artists and
// rulers): the English Wikipedia page whose lead image pics.js shows, by meeting id. Only works and portraits made before 1700, so
// the image is public domain (docs/licences-images-and-engines.md); a person whose page leads with a statue or a photograph, or
// whose likeness is unknown, has none. The titles could not be looked up from the sandbox (Wikipedia is out of its reach): a title
// without an image shows nothing, as pics.js does for any page, so a wrong one costs the picture, not the game.
const PIC = {
  // maps and charts: navigators, explorers, merchants
  "zheng-he": "Mao Kun map", "marco-polo-1271": "Catalan Atlas", "mansa-musa": "Catalan Atlas", "ibn-battuta-1352": "Catalan Atlas", "vasco-da-gama": "Cantino planisphere",
  "martin-waldseemuller": "Waldseemüller map", "piri-reis": "Piri Reis map", "gerardus-mercator": "Mercator 1569 world map", "abraham-ortelius": "Theatrum Orbis Terrarum",
  // drafts: scientists, mathematicians, printers
  fibonacci: "Liber Abaci", "johannes-gutenberg": "Gutenberg Bible", "nicolaus-copernicus": "De revolutionibus orbium coelestium", "andreas-vesalius": "De humani corporis fabrica",
  "tycho-brahe": "Uraniborg", "tycho-brahe-1572": "SN 1572", "galileo-galilei-1610": "Sidereus Nuncius", "galileo-galilei-1633": "Galileo affair", "johannes-kepler": "Astronomia nova",
  "johannes-kepler-1619": "Harmonices Mundi", "johannes-kepler-1627": "Rudolphine Tables", "william-harvey": "De Motu Cordis", "hugo-grotius-1625": "De jure belli ac pacis",
  "erasmus-1511": "In Praise of Folly", "martin-luther-1522": "Luther Bible", "luca-pacioli": "Luca Pacioli",
  // paintings: artists, rulers, and the people painted
  "leonardo-da-vinci-1498": "The Last Supper (Leonardo)", "leonardo-da-vinci-1503": "Mona Lisa", "hans-holbein-the-younger": "The Ambassadors (Holbein)", "georg-gisze": "Portrait of Georg Gisze",
  "henry-viii-1520": "Field of the Cloth of Gold", "elizabeth-i-1588": "Armada Portrait",
};
// a person's page for the rest, where its lead is a portrait made before 1700 (or, for the later of two, a painting of the age)
const PERSON = {
  "henry-the-navigator": "Henry the Navigator", "christopher-columbus": "Christopher Columbus", "bartolomeu-dias": "Bartolomeu Dias", "pedro-alvares-cabral": "Pedro Álvares Cabral",
  "afonso-de-albuquerque": "Afonso de Albuquerque", "vasco-nunez-de-balboa": "Vasco Núñez de Balboa", "ferdinand-magellan": "Ferdinand Magellan", "juan-sebastian-elcano": "Juan Sebastián Elcano",
  "francisco-pizarro": "Francisco Pizarro", "moctezuma-ii": "Moctezuma II", "jacques-cartier": "Jacques Cartier", "henry-hudson": "Henry Hudson", "willem-barentsz": "Willem Barentsz", "abel-tasman": "Abel Tasman",
  "jan-van-riebeeck": "Jan van Riebeeck", "jan-pieterszoon-coen": "Jan Pieterszoon Coen", "francis-drake": "Francis Drake", koxinga: "Koxinga", "kublai-khan": "Kublai Khan", "ibn-battuta": "Ibn Battuta",
  "marco-polo": "Marco Polo", "galileo-galilei": "Galileo Galilei", "christiaan-huygens": "Christiaan Huygens", "john-napier": "John Napier", "antonie-van-leeuwenhoek": "Antonie van Leeuwenhoek",
  "aldus-manutius": "Aldus Manutius", "hugo-grotius": "Hugo Grotius", erasmus: "Erasmus", "niccolo-machiavelli": "Niccolò Machiavelli", "leonardo-da-vinci": "Leonardo da Vinci",
  "lorenzo-de-medici": "Lorenzo de' Medici", "cosimo-de-medici": "Cosimo de' Medici", "henry-viii": "Henry VIII of England", "elizabeth-i": "Elizabeth I of England", "charles-v": "Charles V, Holy Roman Emperor",
  "philip-ii": "Philip II of Spain", "jakob-fugger": "Jakob Fugger", "martin-luther": "Martin Luther", "william-of-orange": "William the Silent", "mehmed-ii": "Mehmed the Conqueror", "ivan-iii": "Ivan III of Russia",
  "gustav-vasa": "Gustav I of Sweden", "frederick-ii": "Frederick II, Holy Roman Emperor", "matteo-ricci": "Matteo Ricci", "francis-xavier": "Francis Xavier", "tokugawa-ieyasu": "Tokugawa Ieyasu", akbar: "Akbar",
  babur: "Babur", "nur-jahan": "Nur Jahan", shivaji: "Shivaji", "kangxi-emperor": "Kangxi Emperor", "nzinga-of-ndongo": "Nzinga of Ndongo and Matamba", malintzin: "La Malinche", "leonardo-loredan": "Leonardo Loredan",
  "andrea-doria": "Andrea Doria", "thomas-gresham": "Thomas Gresham", "gerardus-mercator-1541": "Gerardus Mercator",
  // portraits for the meetings whose picture is the work (a map, a book): the face beside the name (`face` below). Korbi, 9 Nov 2026:
  // "these people have been dead for centuries, these are historical depictions": a portrait of a long-dead person is a work in the
  // public domain, as the paintings in Punt are. Titles unverified from the sandbox, as above: a wrong one costs the portrait only.
  "johannes-gutenberg": "Johannes Gutenberg", "nicolaus-copernicus": "Nicolaus Copernicus", "andreas-vesalius": "Andreas Vesalius", "johannes-kepler": "Johannes Kepler",
  "tycho-brahe": "Tycho Brahe", "gerardus-mercator": "Gerardus Mercator", "abraham-ortelius": "Abraham Ortelius", "william-harvey": "William Harvey", "luca-pacioli": "Luca Pacioli",
  "hans-holbein-the-younger": "Hans Holbein the Younger", "thomas-roe": "Thomas Roe", "enrico-dandolo": "Enrico Dandolo", "francesco-datini": "Francesco Datini", "robert-the-bruce": "Robert the Bruce",
  "margaret-i": "Margaret I of Denmark", "zheng-he": "Zheng He", "mansa-musa": "Mansa Musa", "piri-reis": "Piri Reis", "ulugh-beg": "Ulugh Beg", "sejong-the-great": "Sejong the Great",
};
// the person's id in kb/ where kb/ had them first under a shorter one. A meeting's `fact` is `<person>~<meeting>` (kb/graph.js), the
// same in every game, so what Dispatch teaches the Deck and the other games ask again (Korbi, 10 Nov 2026)
const KB = { "johannes-gutenberg": "gutenberg", "christopher-columbus": "columbus", "ferdinand-magellan": "magellan", "nicolaus-copernicus": "copernicus",
  "jan-pieterszoon-coen": "coen", "antonie-van-leeuwenhoek": "leeuwenhoek", "klaus-stortebeker": "stortebeker" };
// fame is the person's, so a later meeting of theirs has the same
const seen = new Set();
const m = (who, place, year, region, what, why, alt) => {
  const pid = idOf(who), id = seen.has(pid) ? `${pid}-${year}` : pid;
  seen.add(pid);
  if (!NAT[pid]) throw new Error(`dispatch-bank: no nationality for ${who}`);
  return { id, pid, who, nat: NAT[pid], place, year, region, what, alt: alt ?? ALT[id] ?? null, pic: PIC[id] ?? PERSON[id] ?? PERSON[pid] ?? null, face: PERSON[id] ?? PERSON[pid] ?? null, why, fame: FAMOUS.has(pid) ? 1 : OBSCURE.has(pid) ? 3 : 2,
    fact: `${KB[pid] ?? pid}~${id}` };
};

export const MEETINGS = [
  m("Fibonacci", "Pisa", 1202, "italy", "teaches merchants the Hindu-Arabic numerals", "His Liber Abaci made decimal arithmetic usable for trade accounts and exchange."),
  m("Enrico Dandolo", "Constantinople", 1204, "italy", "has helped the crusaders take the city", "Venice took trading privileges and island holdings from the diverted Fourth Crusade."),
  m("Frederick II", "Rimini", 1226, "germany", "grants Lübeck free imperial status", "Answerable only to the Emperor, Lübeck became the head of the Baltic trading towns."),
  m("Marco Polo", "Genoa", 1298, "italy", "dictates his Asian travels to a cellmate", "Il Milione became Europe's main picture of China and the Mongol world."),
  m("Ibn Battuta", "Fez", 1355, "levant", "dictates the story of nearly thirty years' travel", "His Rihla is the fullest first-hand account of the fourteenth-century Muslim world."),
  m("Waldemar IV Atterdag", "Visby", 1361, "baltic", "has just stormed Visby on Gotland", "The attack on the Baltic's trading hub led the Hansa to war against Denmark."),
  m("Francesco Datini", "Prato", 1395, "italy", "files every letter and ledger of his firms", "His archive of some 150,000 letters is the richest record of medieval business."),
  m("Margaret I", "Kalmar", 1397, "baltic", "crowns her heir king of three realms", "The Kalmar Union held Denmark, Norway and Sweden under one crown until 1523."),
  m("Zheng He", "Nanjing", 1405, "asia", "sets out with the first treasure fleet", "Seven Ming voyages reached the Indian Ocean and the coast of East Africa."),
  m("Eric of Pomerania", "Helsingør", 1429, "baltic", "begins charging tolls on ships through the Sound", "The Sound Toll was a main revenue of the Danish crown until 1857."),
  m("Cosimo de' Medici", "Florence", 1434, "italy", "has come home from exile to rule the city", "His bank's wealth turned the Medici into Florence's ruling family."),
  m("Henry the Navigator", "Sagres", 1434, "iberia", "sends Gil Eanes past Cape Bojador", "The cape had been the limit of what sailors dared on Africa's Atlantic coast."),
  m("Mehmed II", "Constantinople", 1453, "levant", "has taken the city for the Ottomans", "The end of Byzantium moved the Mediterranean's trade routes into Ottoman hands."),
  m("Johannes Gutenberg", "Mainz", 1455, "germany", "finishes printing the 42-line Bible", "Movable type made books cheap enough for merchants, scholars and clerks alike."),
  m("Lorenzo de' Medici", "Florence", 1478, "italy", "has survived the Pazzi conspiracy", "He ruled Florence and patronised its artists until his death in 1492."),
  m("Leonardo da Vinci", "Milan", 1482, "italy", "offers the duke his skills as a military engineer", "His letter to Ludovico Sforza lists bridges, guns and siege engines before art."),
  m("Christopher Columbus", "Santa Fe", 1492, "iberia", "wins royal backing to sail west to Asia", "The Capitulations of Santa Fe promised him titles and a tenth of the wealth found."),
  m("Bartolomeu Dias", "Lisbon", 1488, "iberia", "reports rounding Africa's southern tip", "The voyage proved the Atlantic and the Indian Ocean were joined."),
  m("Ivan III", "Novgorod", 1494, "baltic", "closes the Hansa's Peterhof depot", "Novgorod had been the Hansa's gateway to Russian furs and wax."),
  m("Luca Pacioli", "Venice", 1494, "italy", "sets out double-entry bookkeeping in print", "His Summa spread the Venetian method of keeping accounts across Europe."),
  m("Vasco da Gama", "Calicut", 1498, "asia", "reaches India by sea round Africa", "The Cape route let Portugal buy spices at the source, outside the Venetian trade."),
  m("John Cabot", "Newfoundland", 1497, "americas", "claims the new found land for England", "His voyage from Bristol grounded England's later claims in North America."),
  m("Pedro Álvares Cabral", "Porto Seguro", 1500, "americas", "lands on the coast of Brazil", "Portugal's claim followed from the line drawn at Tordesillas six years before."),
  m("Aldus Manutius", "Venice", 1501, "italy", "introduces italic type and pocket-size books", "His Aldine press made the Greek and Latin classics portable and affordable."),
  m("Martin Waldseemüller", "Saint-Dié", 1507, "germany", "puts the name America on a world map", "The name, from Amerigo Vespucci's first name, spread through later maps."),
  m("Afonso de Albuquerque", "Goa", 1510, "asia", "has taken Goa for Portugal", "Goa became the capital of Portugal's chain of trading forts in Asia."),
  m("Vasco Núñez de Balboa", "Isthmus of Panama", 1513, "americas", "has sighted the Pacific from a ridge", "He was the first European to see the Pacific from the Americas."),
  m("Niccolò Machiavelli", "San Casciano", 1513, "italy", "writes The Prince in forced retirement", "Removed from office, he wrote the best-known handbook of political power."),
  m("Erasmus", "Basel", 1516, "germany", "publishes the Greek New Testament", "His text and notes gave Luther and other reformers a base to argue from."),
  m("Jakob Fugger", "Augsburg", 1519, "germany", "bankrolls the election of Charles V", "The loans bound the Habsburgs to the Fuggers' bank for generations."),
  m("Ferdinand Magellan", "Sanlúcar de Barrameda", 1519, "iberia", "sets sail for the Spice Islands the western way", "The fleet that left with five ships and about 270 men became the first to circle the globe."),
  m("Moctezuma II", "Tenochtitlan", 1519, "americas", "welcomes Cortés into his capital", "The meeting began the Spanish conquest of the Aztec empire."),
  m("Martin Luther", "Worms", 1521, "germany", "refuses to recant before the Emperor", "He was outlawed, and the split in Western Christianity became permanent."),
  m("Juan Sebastián Elcano", "Sanlúcar de Barrameda", 1522, "iberia", "has completed the first circumnavigation", "One ship and eighteen men came back with a cargo of cloves."),
  m("Gustav Vasa", "Stockholm", 1523, "baltic", "ends Danish rule with Lübeck's help", "Lübeck's price was trading privileges in the new Swedish kingdom."),
  m("Bartholomäus Welser", "Augsburg", 1528, "germany", "wins Venezuela as security for the Emperor's debts", "The Welser's colony failed, but it shows how far banking houses reached."),
  m("Francisco Pizarro", "Cajamarca", 1532, "americas", "has seized the Inca ruler Atahualpa", "The Inca ransom of gold and silver began Spain's plunder of the Andes."),
  m("Jürgen Wullenwever", "Lübeck", 1533, "baltic", "tries to break Dutch trade in the Baltic", "His Count's Feud failed and cost Lübeck much of its Baltic lead."),
  m("Georg Gisze", "London", 1532, "britain", "sits for Holbein, a Hanseatic merchant at the Steelyard", "The Steelyard was the Hansa's London depot; the portrait shows his ledgers, letters and scales."),
  m("Hans Holbein the Younger", "London", 1533, "britain", "paints The Ambassadors", "The double portrait shows the instruments and books of a learned court."),
  m("Henry VIII", "London", 1534, "britain", "declares himself head of the English church", "The Act of Supremacy took England out of the papal church."),
  m("Jacques Cartier", "Gaspé", 1534, "americas", "plants a cross claiming the land for France", "His voyages opened the St Lawrence to French fur traders."),
  m("Nicolaus Copernicus", "Frombork", 1543, "germany", "completes the book that puts the Sun at the centre", "De revolutionibus began the shift from an Earth-centred to a Sun-centred sky."),
  m("Andreas Vesalius", "Basel", 1543, "germany", "publishes the Fabrica, correcting Galen's anatomy", "Dissection replaced a book as the basis of knowing the body."),
  m("Francis Xavier", "Kagoshima", 1549, "asia", "lands in Japan to preach", "He opened the Jesuit mission whose letters shaped Europe's view of Japan."),
  m("Charles V", "Brussels", 1555, "lowlands", "gives up the Netherlands to his son", "Philip II's rule from Spain led within a decade to the Dutch Revolt."),
  m("Gerardus Mercator", "Duisburg", 1569, "germany", "issues a world map for navigators", "On his projection a straight line follows a constant compass bearing."),
  m("Abraham Ortelius", "Antwerp", 1570, "lowlands", "publishes the first modern atlas", "Theatrum Orbis Terrarum bound uniform maps into one volume for sale."),
  m("Thomas Gresham", "London", 1571, "britain", "has built the Royal Exchange for the city", "The Elizabethan merchant-financier gave London a bourse to match Antwerp's."),
  m("Tycho Brahe", "Hven", 1576, "baltic", "builds the Uraniborg observatory", "His naked-eye measurements, the best of their time, let Kepler find the planets' orbits."),
  m("Francis Drake", "Plymouth", 1580, "britain", "returns from circling the globe with Spanish plunder", "The Golden Hind's cargo paid investors many times their stake."),
  m("William of Orange", "The Hague", 1581, "lowlands", "leads the provinces in renouncing Philip II", "The Act of Abjuration was the founding act of the Dutch Republic."),
  m("Philip II", "El Escorial", 1588, "iberia", "sends the Armada against England", "The fleet's defeat did not end Spain's power, but it ended its hope of invading England."),
  m("Cornelis de Houtman", "Banten", 1596, "asia", "brings the first Dutch fleet to Java", "Dutch ships now bought pepper directly, and the VOC followed in 1602."),
  m("Willem Barentsz", "Novaya Zemlya", 1596, "baltic", "winters on the ice seeking a northeast passage", "The crew survived the winter and the expedition's records were found in 1871."),
  m("Elizabeth I", "London", 1600, "britain", "charters the East India Company", "A trading monopoly with a royal charter became the instrument of Britain in Asia."),
  m("Will Adams", "Bungo", 1600, "asia", "arrives in Japan as pilot of a Dutch ship", "He became adviser to Tokugawa Ieyasu and a go-between for English and Dutch traders."),
  m("Matteo Ricci", "Beijing", 1601, "asia", "is admitted to the Ming court with clocks and maps", "Ricci's world map and his Chinese writings carried European science east."),
  m("Willem Janszoon", "Cape York", 1606, "asia", "makes the first recorded European landing in Australia", "The Duyfken's voyage was a Dutch search for New Guinea's trade."),
  m("Galileo Galilei", "Venice", 1609, "italy", "shows the Senate his telescope", "He soon turned it on the Moon, Jupiter and the Milky Way."),
  m("Johannes Kepler", "Prague", 1609, "germany", "shows that Mars moves in an ellipse", "Astronomia nova broke the old rule that heavenly motions must be circles."),
  m("Henry Hudson", "Hudson River", 1609, "americas", "sails up the river that now bears his name", "He sailed for the Dutch East India Company, and the Dutch based New Netherland on his voyage."),
  m("Hugo Grotius", "Leiden", 1609, "lowlands", "argues in print that the seas are free to all", "Mare Liberum defended Dutch trade against the Portuguese claim to the Indian Ocean."),
  m("John Napier", "Edinburgh", 1614, "britain", "publishes logarithms", "Logarithms turned long multiplications into sums, a boon to navigators and astronomers."),
  m("Thomas Roe", "Ajmer", 1616, "asia", "seeks trading rights from the Mughal emperor", "His embassy for the East India Company secured trade privileges in Mughal ports."),
  m("Jan Pieterszoon Coen", "Batavia", 1619, "asia", "founds Batavia as the Dutch base in Asia", "The VOC's headquarters grew where the town of Jayakarta had stood."),
  m("William Harvey", "London", 1628, "britain", "shows that the blood circulates", "De motu cordis replaced Galen's account of the blood with a pump and a loop."),
  m("Abel Tasman", "Tasmania", 1642, "asia", "has sighted Van Diemen's Land", "The voyage for the VOC also found the coast of New Zealand."),
  m("Jan van Riebeeck", "Table Bay", 1652, "asia", "founds a VOC supply station at the Cape", "The post to feed passing ships grew into Cape Town and a colony."),
  m("Christiaan Huygens", "The Hague", 1656, "lowlands", "builds the first pendulum clock", "The pendulum made clocks accurate enough for science, though not yet for finding longitude at sea."),
  m("Antonie van Leeuwenhoek", "Delft", 1676, "lowlands", "sees tiny living creatures through a single lens", "The cloth merchant turned microscopist described bacteria for the first time."),
  // The wider world (Korbi, 9 Nov 2026: a second cast, to make the Hansa and Europe one limb of the picture). Africa, the Indian
  // Ocean and Asia, interpreters and go-betweens as well as rulers; the Hansa's own merchants and mayors by name.
  m("Albert of Riga", "Riga", 1201, "baltic", "founds Riga as a base for the Baltic crusade", "Riga became a Hanseatic city and the gateway to Livonia's trade."),
  m("Sundiata Keita", "Kirina", 1235, "africa", "defeats Sumanguru and founds the Mali Empire", "Mali's gold made it one of the richest states of its age; griots, its oral historians, kept the story."),
  m("Nasir al-Din al-Tusi", "Maragha", 1259, "levant", "founds the Maragha observatory for the Mongol Ilkhan", "His Tusi couple, a device for planetary motion, later turns up in Copernicus's models."),
  m("Kublai Khan", "Shangdu", 1260, "asia", "is proclaimed Great Khan", "He completed the conquest of China and made paper money the realm's currency."),
  m("Rabban Bar Sauma", "Paris", 1287, "france", "carries the Mongol Ilkhan's plea for a crusader alliance", "The Chinese-born Nestorian monk met Philip IV, Edward I and the pope."),
  m("Mansa Musa", "Cairo", 1324, "africa", "spends so much gold that its price falls", "His pilgrimage showed Mali's wealth to the Mediterranean world."),
  m("Johann Wittenborg", "Helsingborg", 1362, "baltic", "loses a dozen Hanseatic ships off the town", "Lübeck's mayor and fleet commander was beheaded in 1363 for the defeat."),
  m("Bertram Wulflam", "Stralsund", 1370, "baltic", "helps seal the peace with Denmark", "The Treaty of Stralsund gave the Hansa trading rights in Denmark and pawned parts of Scania to it for 15 years."),
  m("Hildebrand Veckinchusen", "Bruges", 1409, "lowlands", "runs his Hanse trade by letter from Bruges", "About 600 letters and twelve account books survive in Tallinn, on UNESCO's Memory of the World list."),
  m("Ulugh Beg", "Samarkand", 1437, "asia", "completes a catalogue of over a thousand stars", "The Timurid ruler's observatory produced the most accurate star tables of its time."),
  m("Zara Yaqob", "Axum", 1436, "africa", "is crowned emperor of Ethiopia", "He reformed the church and tightened the emperor's hold on the Christian highlands."),
  m("Oba Ewuare", "Benin City", 1440, "africa", "begins making Benin a walled, ordered capital", "Benin's brass casters and ivory carvers later impressed the Portuguese."),
  m("Sejong the Great", "Hanyang", 1443, "asia", "has the Korean alphabet, hangul, devised", "Hangul was designed so ordinary people could learn to read quickly."),
  m("Benedetto Cotrugli", "Naples", 1458, "italy", "writes a handbook for the perfect merchant", "It is the earliest known account of double-entry bookkeeping, a generation before Pacioli."),
  m("Sonni Ali", "Timbuktu", 1468, "africa", "takes the city for the Songhai", "Songhai grew into the largest empire in the history of West Africa."),
  m("Askia Muhammad", "Gao", 1493, "africa", "seizes the throne of Songhai", "He reorganised the state and made the pilgrimage to Mecca in 1496-97."),
  m("The Zamorin of Calicut", "Calicut", 1498, "asia", "receives da Gama and is unimpressed by his gifts", "Calicut was the pepper port where Arab, Gujarati and Chinese merchants traded."),
  m("Albert IV of Bavaria", "Munich", 1506, "germany", "decrees that Bavaria passes undivided to one heir", "It ended the Wittelsbach habit of splitting the duchy among sons."),
  m("Afonso I of Kongo", "Mbanza Kongo", 1526, "africa", "begs Portugal's king to stop the slave raiding", "He ran a literate Christian court; the slave trade was eating away his kingdom."),
  m("Leonardo Loredan", "Venice", 1509, "italy", "holds Venice together after Agnadello", "The doge kept the republic's nerve after a crushing defeat by the League of Cambrai."),
  m("Mahmud Shah of Malacca", "Malacca", 1511, "asia", "loses the spice port to Portugal", "Malacca had been the great entrepôt of Southeast Asia; its fall shifted the trade to other ports."),
  m("Piri Reis", "Gelibolu", 1513, "levant", "draws a world map using Columbus's charts", "Only part survives; he later wrote a sailing manual of the Mediterranean."),
  m("Malintzin", "Tabasco", 1519, "americas", "is given to Cortés and becomes his interpreter", "Fluent in Maya and Nahuatl, she was central to Cortés's dealings with the Aztec court."),
  m("Enrique of Malacca", "Cebu", 1521, "asia", "interprets for Magellan in the Philippines", "A Malay captive bought in 1511; some historians say he was the first to circle the globe, which is disputed."),
  m("Lapu-Lapu", "Mactan", 1521, "asia", "defeats Magellan, who is killed in the fight", "The chief of Mactan resisted Spanish demands to submit."),
  m("Andrea Doria", "Genoa", 1528, "italy", "takes Genoa into the Habsburg camp", "The admiral reformed the city's government and tied its bankers to Charles V."),
  m("Babur", "Panipat", 1526, "asia", "defeats the sultan of Delhi with guns", "He founded the Mughal empire and wrote the Baburnama, a memoir."),
  m("Akbar", "Agra", 1564, "asia", "abolishes the tax on non-Muslims", "He built the Mughal state on a land-revenue system and on religious tolerance."),
  m("Tokugawa Ieyasu", "Fushimi", 1603, "asia", "is appointed shogun", "His family ruled Japan for 265 years."),
  m("Nur Jahan", "Agra", 1611, "asia", "marries the emperor Jahangir", "She had coins struck in her name and ran much of the court's business."),
  m("Nzinga of Ndongo", "Luanda", 1622, "africa", "negotiates with the Portuguese governor as an equal", "She later fought Portugal in alliance with the Dutch and built a state in Matamba."),
  m("Autshumato", "Table Bay", 1652, "africa", "interprets for the Dutch at the Cape", "The Khoikhoi leader had kept a letter post for passing English ships and was later held on Robben Island."),
  m("Kangxi Emperor", "Beijing", 1661, "asia", "becomes emperor at seven", "His long reign consolidated the Qing and took in Jesuit astronomers."),
  m("Koxinga", "Fort Zeelandia", 1662, "asia", "forces the Dutch out of Taiwan", "The Ming loyalist's regime on Taiwan outlasted him by two decades."),
  m("Shivaji", "Raigad", 1674, "asia", "is crowned head of the Maratha state", "He built a state out of hill forts and a navy against the Mughals."),
  m("Robert the Bruce", "Arbroath", 1320, "britain", "stands behind the Declaration of Arbroath to the pope", "It argued for Scotland's independence and is often cited as an early statement of popular sovereignty."),
  m("Klaus Störtebeker", "Hamburg", 1401, "baltic", "is beheaded after the Hansa crushes his pirates", "The Victual Brothers had raided Baltic shipping; his fate is Hanse legend."),
  // Further meetings of people already above (Korbi, 9 Nov 2026: individuals with several relevant details get several entries). The
  // last argument is the second wording.
  m("Christopher Columbus", "Barcelona", 1493, "iberia", "reports on the first voyage to Ferdinand and Isabella", "He brought gold, parrots and captives, and won a second fleet of seventeen ships.", "is received at court after returning from the Indies"),
  m("Christopher Columbus", "Jamaica", 1504, "americas", "uses a predicted eclipse to get food from islanders", "Stranded with his crews, he timed the eclipse of 29 February from an almanac of astronomical tables.", "awes his hosts with a foretold darkening of the Moon"),
  m("Martin Luther", "Wittenberg", 1517, "germany", "sends out ninety-five theses against indulgences", "Printed within weeks across Germany, the theses launched the Reformation.", "challenges the sale of pardons for sin"),
  m("Martin Luther", "Wartburg", 1522, "germany", "translates the New Testament into German in hiding", "His New Testament, printed in September, shaped the written German language.", "puts the Gospels in German while sheltered in a castle"),
  m("Galileo Galilei", "Padua", 1610, "italy", "sees four moons circling Jupiter", "Sidereus Nuncius showed a centre of motion other than the Earth.", "finds that not everything in the sky circles the Earth"),
  m("Galileo Galilei", "Rome", 1633, "italy", "is made to abjure the Sun-centred system", "The Inquisition's sentence kept him under house arrest for the rest of his life.", "bows to the Inquisition over Copernicus's theory"),
  m("Johannes Kepler", "Linz", 1619, "germany", "links a planet's year to its distance from the Sun", "Harmonices Mundi gave his third law of planetary motion.", "finds that distant planets move more slowly, by rule"),
  m("Johannes Kepler", "Ulm", 1627, "germany", "publishes planetary tables more exact than any before", "The Rudolphine Tables used Tycho's data and predicted the 1631 transit of Mercury.", "prints the tables that let astronomers place the planets"),
  m("Leonardo da Vinci", "Santa Maria delle Grazie", 1498, "italy", "finishes The Last Supper on a refectory wall", "His experiment with tempera on dry plaster began flaking within years.", "has covered a convent wall with the apostles at table"),
  m("Leonardo da Vinci", "Florence", 1503, "italy", "begins the Mona Lisa, a silk merchant's wife", "He kept working on the portrait for years and took it with him to France.", "starts the portrait of Lisa del Giocondo"),
  m("Nicolaus Copernicus", "Grudziądz", 1522, "baltic", "tells the Prussian diet that bad coin drives out good", "His coinage report anticipated what became known as Gresham's law.", "urges Royal Prussia to reform its currency"),
  m("Nicolaus Copernicus", "Olsztyn", 1521, "baltic", "holds Olsztyn castle for the chapter against the Order", "As the chapter's administrator he defended Olsztyn in the war with the Teutonic Knights.", "keeps the Teutonic Order out of a Prussian fortress"),
  m("Niccolò Machiavelli", "Florence", 1498, "italy", "takes office as secretary in the republic's chancery", "He served as diplomat and administrator until the Medici returned in 1512.", "starts a civil-service career at twenty-nine"),
  m("Elizabeth I", "Deptford", 1581, "britain", "knights Francis Drake aboard the Golden Hind", "The queen honoured the voyage that had paid her a great share of Spanish silver.", "rewards a privateer with a knighthood"),
  m("Elizabeth I", "Tilbury", 1588, "britain", "rallies her army as the Armada nears", "Her speech to the troops made her the figure of England's defence.", "speaks to her soldiers as the Spanish fleet approaches"),
  m("Francis Drake", "Gravelines", 1588, "lowlands", "fights the Armada off the Flemish coast", "As vice-admiral he helped drive the Spanish fleet into the North Sea.", "serves as vice-admiral as England turns back the Armada"),
  m("Philip II", "Tomar", 1581, "iberia", "is acclaimed king of Portugal", "Spain held Portugal and its overseas empire until 1640.", "joins two empires under one crown"),
  m("Charles V", "Frankfurt", 1519, "germany", "is elected Holy Roman Emperor", "Fugger loans helped win the electors against Francis I of France.", "wins the imperial crown over the French king"),
  m("Charles V", "Bologna", 1530, "italy", "is crowned emperor by the pope", "He was the last Holy Roman Emperor to be crowned by a pope.", "takes the crown from Clement VII's hands"),
  m("Jakob Fugger", "Fuggerei", 1521, "germany", "founds almshouses for poor townspeople of Augsburg", "The Fuggerei still stands, with its rent of one Rhenish guilder a year.", "builds housing that charges a guilder a year"),
  m("Erasmus", "Paris", 1511, "france", "publishes The Praise of Folly", "The satire, written for his friend Thomas More, mocked priests, kings and scholars.", "mocks kings, clergy and scholars in a book for More"),
  m("Gerardus Mercator", "Leuven", 1541, "lowlands", "completes a globe marked with rhumb lines", "Lines of constant bearing on a sphere led him toward his 1569 projection.", "makes a terrestrial globe that sailors could steer by"),
  m("Tycho Brahe", "Herrevad Abbey", 1572, "baltic", "observes a new star in Cassiopeia", "His measurements put it far beyond the Moon, so the heavens could change.", "finds that the sky beyond the Moon is not unchanging"),
  m("Marco Polo", "Venice", 1271, "italy", "sets out with his father and uncle for the Mongol court", "The journey to Kublai Khan took years; they came home in 1295.", "leaves home at seventeen for Kublai Khan's China"),
  m("Ibn Battuta", "Tangier", 1325, "africa", "leaves home for the pilgrimage to Mecca", "He did not see Morocco again for nearly twenty-five years.", "sets out at twenty-one on a journey of many years"),
  m("Ibn Battuta", "Mali", 1352, "africa", "visits the court of Mansa Sulayman", "His account is the main eyewitness record of the Mali Empire at its height.", "describes the king of Mali's gold and court ceremony"),
  m("Vasco da Gama", "Lisbon", 1497, "iberia", "sails with four ships for India", "The fleet left in July and rounded the Cape of Good Hope in November.", "leaves Portugal on the voyage that will reach Asia"),
  m("Vasco da Gama", "Cochin", 1524, "asia", "returns to India as viceroy", "He died at Cochin within months of arriving.", "comes back to rule Portuguese India and dies there"),
  m("Hugo Grotius", "Paris", 1625, "france", "publishes On the Law of War and Peace", "Written in exile, it became a foundation of international law.", "sets out rules for war and peace from exile"),
  m("Jan Pieterszoon Coen", "Banda", 1621, "asia", "seizes the Banda Islands for the nutmeg monopoly", "Most of the islanders were killed, enslaved or driven out.", "crushes the islanders to control the world's nutmeg"),
  m("Afonso de Albuquerque", "Malacca", 1511, "asia", "has captured Malacca, key to the spice trade", "Holding the strait let Portugal tax the passage between the Indian Ocean and China.", "takes the chokepoint of the spice route"),
  m("Ferdinand Magellan", "Strait of Magellan", 1520, "americas", "finds the strait into the Pacific", "Passing it took five weeks, and one of his ships turned back for Spain.", "enters the Pacific through a channel later named for him"),
  m("Henry VIII", "Guînes", 1520, "france", "meets Francis I at the Field of the Cloth of Gold", "Two kings spent a fortune on tents and jousts and signed no alliance.", "stages a show of splendour with the French king"),
  m("Henry VIII", "Westminster", 1536, "britain", "begins closing the smaller monasteries", "The Dissolution moved vast Church lands to the Crown and, by sale, to the gentry.", "takes over the property of the religious houses"),
  m("Henry the Navigator", "Ceuta", 1415, "africa", "fights in the capture of Ceuta", "The Moroccan port was Portugal's first overseas conquest.", "joins the conquest that began Portugal's empire abroad"),
  m("Jacques Cartier", "Stadacona", 1535, "americas", "records the Iroquoian word kanata for the land", "The word meant a village; it grew to name a country.", "takes a village's name as the name of a whole country"),
  m("Kublai Khan", "Dadu", 1271, "asia", "names his dynasty Yuan", "The name claimed the Chinese mandate; Dadu, now Beijing, became his capital.", "claims to rule China in the Chinese manner"),
  m("Akbar", "Fatehpur Sikri", 1575, "asia", "opens a house of worship for debate between faiths", "Scholars of several religions argued before him, and he grew sceptical of orthodoxy.", "hears Muslims, Hindus, Jains and Zoroastrians dispute"),
];

for (const table of [PIC, PERSON, ALT]) for (const k of Object.keys(table)) if (!MEETINGS.some(x => x.id === k || (table === PERSON && x.pid === k))) throw new Error(`dispatch-bank: ${k} is no meeting`);
export const REGIONS = [...new Set(MEETINGS.map(x => x.region))];
export const meetingOf = id => MEETINGS.find(x => x.id === id) || null;
/** Every meeting of one person, in the order of their years. */
export const meetingsOfPerson = pid => MEETINGS.filter(x => x.pid === pid).sort((a, b) => a.year - b.year);
