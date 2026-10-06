// Stories to put in order, for Order's Stories mode: each a sequence of events, in the order the sources tell them
// (the note says which). A card's place in its story is what's ordered; there's no number to know, only the story.
export const SEQUENCES = [
 {
  "id": "labours",
  "name": "The labours of Heracles",
  "unit": "labour",
  "ask": "Which labour came first? Tap where it goes",
  "note": "In the order Apollodorus gives. Eurystheus set ten, then added two because the Hydra (with help) and the stables (for pay) didn't count.",
  "steps": [
   "Strangle the Nemean lion",
   "Kill the many-headed Lernaean Hydra",
   "Catch the golden-horned Ceryneian hind",
   "Capture the Erymanthian boar alive",
   "Clean the Augean stables in a single day",
   "Drive off the Stymphalian birds",
   "Capture the Cretan bull",
   "Steal the man-eating mares of Diomedes",
   "Win the girdle of Hippolyta, the Amazon queen",
   "Steal the cattle of the giant Geryon",
   "Fetch the golden apples of the Hesperides",
   "Bring Cerberus up from the underworld"
  ]
 },
 {
  "id": "odyssey",
  "name": "Odysseus's voyage home",
  "unit": "stop",
  "ask": "Which came first on the way home? Tap where it goes",
  "note": "In the order the events happened; Homer tells most of them in flashback, at the Phaeacian court, before the last leg home.",
  "steps": [
   "Raid the Cicones at Ismarus",
   "Taste the lotus with the Lotus-eaters",
   "Blind the Cyclops Polyphemus",
   "Receive the bag of winds from Aeolus",
   "Lose ships to the cannibal Laestrygonians",
   "Circe turns the crew into pigs",
   "Consult the seer Tiresias among the dead",
   "Sail past the Sirens, tied to the mast",
   "Pass between Scylla and Charybdis",
   "The crew eat the cattle of Helios",
   "Seven years on Calypso's island",
   "Washed ashore among the Phaeacians",
   "Home to Ithaca: the suitors slain"
  ]
 },
 {
  "id": "troy",
  "name": "The Trojan War",
  "unit": "event",
  "ask": "Which came first? Tap where it goes",
  "note": "The Iliad covers only a few weeks of the tenth year, from the quarrel to Hector's funeral; the rest comes from the lost epics of the Cycle.",
  "steps": [
   "Paris judges Aphrodite the fairest",
   "Paris carries Helen off to Troy",
   "Agamemnon sacrifices Iphigenia at Aulis",
   "Nine years of siege",
   "Achilles quarrels with Agamemnon",
   "Hector kills Patroclus",
   "Achilles kills Hector",
   "Paris kills Achilles with an arrow",
   "The wooden horse is left on the shore",
   "Troy falls and burns"
  ]
 },
 {
  "id": "ragnarok",
  "name": "Ragnarök",
  "unit": "sign",
  "ask": "Which comes first? Tap where it goes",
  "note": "As the Prose Edda and the Völuspá tell it: Baldr's death begins the end; after the fire and the flood, a green world rises.",
  "steps": [
   "Baldr is killed by a mistletoe dart",
   "Loki is bound beneath a dripping serpent",
   "Fimbulwinter: three winters without summer",
   "Wolves swallow the sun and the moon",
   "Fenrir and Loki break free",
   "Heimdall blows the Gjallarhorn",
   "The gods fall: Odin to Fenrir, Thor to the serpent",
   "Surtr sets the world ablaze",
   "The earth sinks into the sea",
   "A green earth rises, and Baldr returns"
  ]
 },
 {
  "id": "perseus",
  "name": "The deeds of Perseus",
  "unit": "deed",
  "ask": "Which came first? Tap where it goes",
  "note": "Apollodorus's version: the prophecy that Danaë's son would kill her father comes true at the very end, by accident.",
  "steps": [
   "Danaë and the baby are cast adrift in a chest",
   "King Polydectes demands the Gorgon's head",
   "He steals the Graeae's one shared eye",
   "The nymphs lend sandals, a cap and a bag",
   "Medusa is beheaded, seen in his shield",
   "Pegasus springs from her neck",
   "Andromeda is saved from the sea monster",
   "Polydectes and his court are turned to stone",
   "A stray discus kills his grandfather Acrisius"
  ]
 },
 {
  "id": "argonauts",
  "name": "Jason and the Argonauts",
  "unit": "leg",
  "ask": "Which came first? Tap where it goes",
  "note": "Mostly as Apollonius of Rhodes tells it in the Argonautica; the end, with Pelias, comes from Euripides and Apollodorus.",
  "steps": [
   "Pelias sends Jason for the Golden Fleece",
   "The Argo is built, with Athena's help",
   "A long stay with the women of Lemnos",
   "Heracles is left behind, searching for Hylas",
   "Phineus is freed from the Harpies",
   "The Argo races through the Clashing Rocks",
   "Arrival at Colchis, ruled by Aeëtes",
   "Jason yokes the fire-breathing bulls",
   "Medea charms the dragon; the fleece is taken",
   "Medea tricks Pelias's daughters into killing him"
  ]
 },
 {
  "id": "kings-of-rome",
  "name": "The kings of Rome",
  "unit": "king",
  "ask": "Which king came first? Tap where he goes",
  "note": "Rome's seven legendary kings, traditionally 753 to 509 BC, when Tarquin the Proud was driven out and the Republic began.",
  "steps": [
   "Romulus",
   "Numa Pompilius",
   "Tullus Hostilius",
   "Ancus Marcius",
   "Tarquinius Priscus",
   "Servius Tullius",
   "Tarquinius Superbus"
  ]
 },
 {
  "id": "east-india-company",
  "name": "The East India Company",
  "unit": "event",
  "ask": "Which came first? Tap where it goes",
  "note": "1600 charter; 1639 Fort St George; 1668 Bombay; 1690 Calcutta; 1757 Plassey; 1765 the diwani; 1770 the famine; 1813 the Indian monopoly ends; 1857 the rebellion; 1874 dissolved.",
  "steps": [
   "Elizabeth I charters the company",
   "Fort St George is begun at Madras",
   "Bombay passes to the company from the Crown",
   "Job Charnock founds Calcutta",
   "Clive wins the Battle of Plassey",
   "The company takes Bengal's revenues, the diwani",
   "Famine kills millions in Bengal",
   "Parliament ends its monopoly on Indian trade",
   "The Indian Rebellion breaks out",
   "The company is dissolved"
  ]
 },
 {
  "id": "voc",
  "name": "The Dutch East India Company",
  "unit": "event",
  "ask": "Which came first? Tap where it goes",
  "note": "1602 founded; 1619 Batavia; 1621 Banda; 1623 Amboyna; 1641 Dejima; 1652 the Cape; 1656 Colombo; 1780–84 the Fourth Anglo-Dutch War; 1799 dissolved.",
  "steps": [
   "The VOC is founded, selling shares to anyone",
   "Coen founds Batavia on the ruins of Jayakarta",
   "The conquest of the Banda Islands",
   "The Amboyna massacre of English traders",
   "The Dutch are confined to Dejima, alone in Japan",
   "Jan van Riebeeck lands at the Cape",
   "Colombo is taken from the Portuguese",
   "The Fourth Anglo-Dutch War wrecks its fleet",
   "Bankrupt, the VOC is dissolved"
  ]
 },
 {
  "id": "hanse",
  "name": "The Hanseatic League",
  "unit": "event",
  "ask": "Which came first? Tap where it goes",
  "note": "1159 Lübeck refounded; 1241 Lübeck and Hamburg ally; 1356 the first Diet; 1370 the Peace of Stralsund; 1494 Novgorod closed; 1598 the Steelyard closed; 1669 the last Diet.",
  "steps": [
   "Henry the Lion refounds Lübeck",
   "Lübeck and Hamburg ally to guard their road",
   "The first Diet of the Hanse meets",
   "The Peace of Stralsund humbles Denmark",
   "Moscow closes the Novgorod counting-house",
   "Elizabeth I closes the London Steelyard",
   "The last Diet meets, with nine towns"
  ]
 },
 {
  "id": "peerage",
  "name": "The British peerage",
  "unit": "rank",
  "ask": "Which ranks higher? Tap where it goes",
  "note": "Precedence in the peerage, highest first; baronets and knights follow the barons, but they aren't peers.",
  "steps": [
   "Duke",
   "Marquess",
   "Earl",
   "Viscount",
   "Baron",
   "Baronet (hereditary, but not a peer)",
   "Knight bachelor (for life only)"
  ]
 },
 {
  "id": "german-ranks",
  "name": "The German nobility",
  "unit": "rank",
  "ask": "Which ranks higher? Tap where it goes",
  "note": "The usual order of German ranks. Prince-electors and archdukes ranked by their own rules, just above the dukes.",
  "steps": [
   "Kaiser (emperor)",
   "König (king)",
   "Großherzog (grand duke)",
   "Herzog (duke)",
   "Fürst (prince)",
   "Graf (count)",
   "Freiherr (baron)",
   "Ritter (knight)",
   "Edler (the lowest noble rank)"
  ]
 },
 {
  "id": "obe-grades",
  "name": "The Order of the British Empire",
  "unit": "grade",
  "ask": "Which grade is higher? Tap where it goes",
  "note": "Its five grades, highest first, and the medal attached to the order.",
  "steps": [
   "Knight or Dame Grand Cross (GBE)",
   "Knight or Dame Commander (KBE, DBE)",
   "Commander (CBE)",
   "Officer (OBE)",
   "Member (MBE)",
   "The British Empire Medal (BEM)"
  ]
 },
 {
  "id": "salvator-mundi",
  "name": "The Salvator Mundi",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "1958, 2005, 2005–11, 2011, 2013, 2013, 2017; it hasn't been seen in public since.",
  "steps": [
   "Sold at Sotheby's as a follower's copy, for £45",
   "Bought at a New Orleans auction for $1,175",
   "Restored, and claimed for Leonardo's own hand",
   "Shown as a Leonardo at London's National Gallery",
   "Sold privately to the dealer Yves Bouvier for $80m",
   "Resold to Dmitry Rybolovlev for $127.5m",
   "Sold at Christie's for $450.3m, a world record",
   "Bought for a Saudi prince, and not seen since"
  ]
 },
 {
  "id": "gurlitt",
  "name": "The Gurlitt hoard",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "1938–45, 1945, 1956, 2010, 2012, 2013, 2014, and from 2015 the first returns (a Matisse to the Rosenberg heirs).",
  "steps": [
   "Hildebrand Gurlitt sells 'degenerate art' for the Nazis",
   "He tells the Allies his collection burned in Dresden",
   "He dies in a car crash; his son inherits",
   "Cornelius is checked on a train from Zurich, with cash",
   "Customs raid his Munich flat and find 1,280 works",
   "A magazine reveals the hoard to the world",
   "Cornelius dies, leaving it all to Kunstmuseum Bern",
   "The first looted works go back to the owners' heirs"
  ]
 },
 {
  "id": "kings-of-bavaria",
  "name": "The kings of Bavaria",
  "unit": "king",
  "ask": "Which king came first? Tap where he goes",
  "note": "1806 to 1918. Prince Regent Luitpold ruled for King Otto from 1886 to 1912; Ludwig III fled the revolution in 1918.",
  "steps": [
   "Maximilian I Joseph",
   "Ludwig I",
   "Maximilian II",
   "Ludwig II",
   "Otto",
   "Ludwig III"
  ]
 },
 {
  "id": "ludwig-ii",
  "name": "The life of Ludwig II",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "1845, 1864, 1864, 1866, 1869, 1878, 1886, 1886.",
  "steps": [
   "Born at Nymphenburg Palace",
   "Crowned king at eighteen",
   "Summons Wagner to Munich and pays his debts",
   "Loses the war against Prussia, as Austria's ally",
   "Lays the foundation stone of Neuschwanstein",
   "Begins Herrenchiemsee, his Versailles",
   "Declared unfit to rule by his government",
   "Found drowned in Lake Starnberg"
  ]
 },
 {
  "id": "brewing",
  "name": "How beer is brewed",
  "unit": "step",
  "ask": "Which step comes first? Tap where it goes",
  "note": "Malting, kilning, mashing, lautering, boiling with hops, cooling and pitching the yeast, fermenting, then lagering for the bottom-fermented beers.",
  "steps": [
   "Steep the barley until it sprouts",
   "Dry the sprouted grain in a kiln: malt",
   "Mash the crushed malt in hot water",
   "Lauter: strain off the sweet wort",
   "Boil the wort with hops",
   "Cool it and pitch the yeast",
   "Ferment for a week or more",
   "Lager it cold for weeks"
  ]
 },
 {
  "id": "road-to-union",
  "name": "The road to the Union",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "1603, 1638, 1651, 1692, 1698, 1700, 1704, 1705, 1706, 1707.",
  "steps": [
   "James VI inherits the English crown",
   "Scots sign the National Covenant",
   "Cromwell's army occupies Scotland",
   "Soldiers massacre the MacDonalds at Glen Coe",
   "The Darien expedition sails for Panama",
   "Darien is abandoned, and the money with it",
   "Scotland's Act of Security defies England",
   "England's Alien Act threatens Scottish trade",
   "Commissioners agree the Treaty of Union",
   "The Acts of Union come into force"
  ]
 },
 {
  "id": "the-forty-five",
  "name": "The Forty-Five",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "July 1745 to September 1746.",
  "steps": [
   "Charles Edward Stuart lands on Eriskay",
   "He raises his standard at Glenfinnan",
   "The Jacobites take Edinburgh",
   "They rout Cope's army at Prestonpans",
   "They reach Derby, then turn back",
   "They win again at Falkirk",
   "They are crushed at Culloden",
   "Charles escapes 'over the sea to Skye'",
   "He sails for France, never to return"
  ]
 },
 {
  "id": "tudors",
  "name": "The Tudors",
  "unit": "monarch",
  "ask": "Who reigned first? Tap where they go",
  "note": "1485 to 1603, from Bosworth to Elizabeth I's death and the Union of the Crowns.",
  "steps": [
   "Henry VII",
   "Henry VIII",
   "Edward VI",
   "Lady Jane Grey, for nine days",
   "Mary I",
   "Elizabeth I"
  ]
 },
 {
  "id": "henry-viii-wives",
  "name": "The wives of Henry VIII",
  "unit": "wife",
  "ask": "Which wife came first? Tap where she goes",
  "note": "Divorced, beheaded, died; divorced, beheaded, survived.",
  "steps": [
   "Catherine of Aragon",
   "Anne Boleyn",
   "Jane Seymour",
   "Anne of Cleves",
   "Catherine Howard",
   "Catherine Parr"
  ]
 },
 {
  "id": "whisky-making",
  "name": "How Scotch is made",
  "unit": "step",
  "ask": "Which step comes first? Tap where it goes",
  "note": "Malt whisky by the book: two copper pot stills, and at least three years in oak in Scotland.",
  "steps": [
   "Steep the barley until it sprouts",
   "Dry the malt, sometimes over peat",
   "Mash the malt in hot water",
   "Ferment the sweet wort into wash",
   "Distil it once in the wash still",
   "Distil again in the spirit still",
   "Keep only the heart of the run",
   "Fill the spirit into oak casks",
   "Mature it at least three years"
  ]
 },
 {
  "id": "dynasties",
  "name": "China's dynasties",
  "unit": "dynasty",
  "ask": "Which came first? Tap where it goes",
  "note": "Shang (c. 1600 BC), Zhou, Qin (221 BC), Han, Sui (581), Tang (618), Song (960), Yuan (1271), Ming (1368), Qing (1644 to 1912).",
  "steps": [
   "Shang",
   "Zhou",
   "Qin",
   "Han",
   "Sui",
   "Tang",
   "Song",
   "Yuan",
   "Ming",
   "Qing"
  ]
 },
 {
  "id": "zodiac",
  "name": "The Chinese zodiac",
  "unit": "sign",
  "ask": "Which comes first? Tap where it goes",
  "note": "In the order of the Jade Emperor's race: the rat rode on the ox's back and jumped ahead at the line.",
  "steps": [
   "Rat",
   "Ox",
   "Tiger",
   "Rabbit",
   "Dragon",
   "Snake",
   "Horse",
   "Goat",
   "Monkey",
   "Rooster",
   "Dog",
   "Pig"
  ]
 },
 {
  "id": "road-to-1949",
  "name": "The road to 1949",
  "unit": "event",
  "ask": "Which came first? Tap where it goes",
  "note": "1839, 1850, 1900, 1911, 1919, 1921, 1934, 1937, 1949.",
  "steps": [
   "The First Opium War",
   "The Taiping Rebellion",
   "The Boxers besiege the legations",
   "The Wuchang uprising ends the Qing",
   "The May Fourth protests",
   "The Communist Party is founded in Shanghai",
   "The Long March",
   "War with Japan",
   "The People's Republic is proclaimed"
  ]
 },
 {
  "id": "reform-era",
  "name": "Reform and opening",
  "unit": "event",
  "ask": "Which came first? Tap where it goes",
  "note": "1978, 1980, 1992, 1997, 2001, 2008, 2013, 2018.",
  "steps": [
   "Deng Xiaoping launches 'reform and opening'",
   "Shenzhen becomes a Special Economic Zone",
   "Deng's southern tour revives the reforms",
   "Hong Kong returns to China",
   "China joins the WTO",
   "Beijing hosts the Olympics",
   "The Belt and Road is announced",
   "Yuan-priced crude futures open in Shanghai"
  ]
 },
 {
  "id": "streif",
  "name": "The Streif, top to bottom",
  "unit": "section",
  "ask": "Which comes first, from the top? Tap where it goes",
  "note": "Kitzbühel's Hahnenkamm downhill, about 3.3 km; the Mausefalle (mousetrap) sends racers 60 metres through the air.",
  "steps": [
   "The start house",
   "The Mausefalle",
   "The Karussell",
   "The Steilhang",
   "The Brückenschuss",
   "The Gschöss",
   "The Seidlalm jump",
   "The Lärchenschuss",
   "The Hausbergkante",
   "The Zielschuss"
  ]
 },
 {
  "id": "ski-history",
  "name": "Skiing becomes a sport",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "1864, 1868, 1896, 1922, 1924, 1934, 1936, 1980, 1985, 1998.",
  "steps": [
   "Badrutt's winter bet at St. Moritz",
   "Sondre Norheim jumps at Christiania",
   "Zdarsky's book on Alpine skiing",
   "Lunn sets the first slalom, at Mürren",
   "The first Winter Olympics, at Chamonix",
   "Constam's T-bar opens at Davos",
   "The first chairlift, at Sun Valley",
   "Lake Placid's Games use artificial snow",
   "Jan Boklöv first jumps in a V",
   "Snowboarding joins the Olympics"
  ]
 },
 {
  "id": "avalanche-rescue",
  "name": "Avalanche rescue",
  "unit": "step",
  "ask": "What comes first? Tap where it goes",
  "note": "The first fifteen minutes decide most outcomes, so companions dig before help arrives.",
  "steps": [
   "Mark where the victim was last seen",
   "Switch every transceiver to search",
   "Search for the first signal",
   "Follow the signal in close",
   "Pinpoint it, low over the snow",
   "Probe until you strike the victim",
   "Dig in from downhill, in a relay",
   "Clear the airway first"
  ]
 },
 {
  "id": "power-path",
  "name": "The power's path through a watch",
  "unit": "part",
  "ask": "Which part does the power reach first? Tap where it goes",
  "note": "From the mainspring through the wheels to the escapement, which lets it out in beats to the balance.",
  "steps": [
   "The mainspring, in its barrel",
   "The centre wheel, turning once an hour",
   "The third wheel",
   "The fourth wheel, turning once a minute",
   "The escape wheel",
   "The pallet fork",
   "The balance wheel and hairspring"
  ]
 },
 {
  "id": "horology-history",
  "name": "Watchmaking through time",
  "unit": "step",
  "ask": "Which came first? Tap where it goes",
  "note": "1675, 1761, 1801, 1886, 1926, 1931, 1953, 1969, 1972, 1983.",
  "steps": [
   "Huygens's balance spring",
   "Harrison's H4 crosses to Jamaica",
   "Breguet patents the tourbillon",
   "Geneva creates its Seal",
   "Rolex launches the waterproof Oyster",
   "Jaeger-LeCoultre makes the Reverso",
   "The Submariner and the Fifty Fathoms",
   "The Speedmaster goes to the Moon",
   "Genta's Royal Oak",
   "The Swatch"
  ]
 },
 {
  "id": "lake-shore",
  "name": "Along the lake, from Geneva",
  "unit": "town",
  "ask": "Which comes first, from Geneva? Tap where it goes",
  "note": "The Swiss shore, west to east: about 90 km from Geneva to Villeneuve.",
  "steps": [
   "Geneva",
   "Coppet",
   "Nyon",
   "Rolle",
   "Morges",
   "Lausanne",
   "Vevey",
   "Montreux",
   "Villeneuve"
  ]
 }
];
