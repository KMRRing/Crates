# History of trade: course outline (stage 1, for Korbi's review)

Status: outline only. No course UI, no code, no changes to `apps.js` or any shared file. Nothing here is a ruling of Korbi's yet.
Framing rule (Korbi, 4 November 2026): facts, not policy advocacy; no night-sky material (that is the Landfall course); no money or banking beyond trade-finance basics (bills of exchange, partnerships, silver as the means of payment between regions).

## 0. What I found and decided

- **There is no geography course.** `apps.js` has no such entry, `main` has no `geography*` file, and no branch carries one. What exists is the *Geography topic* in Settings and `kb/`, read by Chart, Origin and Punt. The closest trade-geography material is in `kb/entities.js`: 86 `trade-place` entities (chokepoints, ports, mines, fields), 24 `trade-history` (Bryggen, Elmina, Potosí, Dejima...), 16 `merchant-power` (Hanse, VOC, Sogdians, Ming treasure fleets...), 85 `geo-place`. I took "absorbs the geography course" to mean: this course becomes the home and the map layer for those entities. Nothing is deleted or moved out of `kb/` (the audit rule: nothing is deleted, a mark is changed). Open question 1 asks Korbi to confirm.
- **Shape:** 14 chapters, each 3 to 4 short lessons, on the shared course sheet (`course.js`) like Art history and Navigation. Door page `trade.html` (name open, question 2). Family: a course, so `full titled` (puzzle/quiz/course family in `tests/full-screen.mjs`).
- **Sourcing, per Korbi's update:** a short reading list per chapter; a source on a fact only where the figure is genuinely contested (deaths, volumes, dates), written as the range plus who disputes it. Uncontested facts carry no citation in this outline.
- **What I checked on the web (4 November 2026)** and what I only recalled. Opened and read: Slave Voyages methodology page; Koch et al. 2019 (White Rose eprint); the Indian indenture, Indian Ocean slave trade, Leopold II and Great Bengal famine pages on Wikipedia (as pointers to the scholars they cite, not as the authority); Britannica's Opium Wars summary; the Sogdian Ancient Letters (U. Washington); the Uluburun page (worldhistory.org); EIA's Hormuz note (id 65504); UNCTAD's maritime page; the BIMCO Suez note (30 January 2026); the Haiti indemnity note. Everything else below is **recalled** from the literature in the reading lists. Items marked `(check)` are the ones I am least sure of. A reviewer must open the books for every contested range before it is built into a question (section 6).

## 1. Region weight, so the course is not Eurocentric

Rule for the builder: count lessons and key facts by *where the action is*, not by who wrote the sources. Targets (checked by a test when built, like `tests/arthistory.mjs` checks dates):

- No more than about one fifth of key facts have Europeans as the acting party, and in the colonial chapters they are named as actors with the crimes stated (the Hanse and Venice get one lesson each, not a chapter each).
- Chapters 1 to 6 and 8 contain no European actor except where Europeans are the buyers at the end of a chain (Rome at Muziris; Genoa buying enslaved people at Caffa).
- Every chapter names at least two non-European primary voices: Ibn Battuta, al-Bakri, al-Umari, Zhao Rukuo, Ma Huan, Tomé Pires (a Portuguese but the best witness to Malacca), the Sogdian letters, Afonso I of Kongo, Lin Zexu, the Cuba Commission, the Florentine Codex (written by Nahua informants for Sahagún).
- No tally yet: the facts are not tagged by region in this outline. Tag each fact by region when the data file is built and have the test print the count. By eye, chapters 1 to 6 and 8 are non-European, 7 and 9 to 13 mix actors, and Europe is the main actor in about a dozen facts of roughly 120.

## 2. Question styles (one palette, chapters pick from it)

Built to the `CLAUDE.md` rules for questions (every wrong option as long and plausible as the right one; the right answer's place cycles by question id; `tests/banks.mjs`).

- **A. Tap the place:** a Natural Earth world map (`world.js`), tap the port, strait or mine. Stage-judged.
- **B. Follow the cargo:** match a commodity to its origin and its destination, or choose the true route of a named cargo (Uluburun, Belitung, Hermapollon).
- **C. Order three:** put three events in time. Never uses a contested date (a `loose` flag, as in Art history).
- **D. Read the source:** a 2 to 4 line primary text (Pliny, Ibn Battuta, Pires, Casement, the Sogdian letter), then "what does it show?". Translations only from public domain editions, quoted short.
- **E. Pick the range:** for a contested number the learner picks which range is defensible; the answer text shows who says what. A contested number is **never** asked as "what was the number".
- **F. Myth or fact:** a common claim and the corrected version (Constantinople 1453 did not close the spice routes; the Berlin Conference did not carve up Africa; Cai Lun did not invent paper alone).
- **G. Who bore the cost:** pick the correct statement of who paid and who gained in a trade (indenture, the Haitian indemnity, the opium trade).
- **H. Spot the connection:** link two places or goods across chapters (cowries from the Maldives to Dahomey; Changsha bowls to Siraf; Potosí silver to the Ming tax).
- Review pile like Music and Art history: a miss returns after a day, three, a week, three weeks.

## 3. The chapters

Format per chapter: goals, key facts (contested ones inline as **CONTESTED**), maps and pictures needed, styles, geography material that lands here, reading list. Reading lists use short names; full references are in section 5.

### 1. The first exchanges (to about 1200 BCE)
Goals: trade is older than states and writing; goods moved far before money; Africa, West Asia, South Asia and the early Americas were all part of it.
Facts:
1. Obsidian from Anatolia and from the Ethiopian and Kenyan rifts moved hundreds of kilometres in the Neolithic; chemical sourcing identifies the volcano.
2. The first proto-cuneiform tablets (Uruk, about 3300 BCE) record rations and goods: writing began as accounting.
3. Mesopotamian texts name Meluhha, usually read as the Indus region; Indus-type seals turn up at Ur and around the Gulf (Dilmun is Bahrain). Meluhha's exact identity is argued; the Indus reading is the majority one.
4. Old Assyrian merchants from Assur traded tin and textiles with Anatolia from Kültepe (Kanesh), about 1950 to 1750 BCE; the archive is some 23,000 tablets of private letters and contracts, and women managed the weaving at home (count `check`).
5. The Uluburun wreck (off Turkey, about 1330 to 1300 BCE, dated by radiocarbon and pottery) carried about 10 tonnes of copper in 348 ingots, 120 tin ingots, glass ingots, ivory, resin: Cyprus copper, tin probably from the Taurus or further east. (Checked: worldhistory.org page.)
6. Egypt sent ships to Punt under Hatshepsut (about 1470 BCE) for myrrh and incense. **CONTESTED:** where Punt was (Eritrea and Sudan versus Yemen and Somalia); isotope work on Punt baboon mummies has favoured the Eritrea and Ethiopia side (Dominy et al., PNAS 2020, `check`).
7. The Amarna letters (14th century BCE) show the great kings of Egypt, Babylonia, Mittani and Hatti exchanging "gifts" that were in effect traded goods, with complaints about quality.
8. In the Americas, Olmec centres of about 1200 BCE already drew obsidian and jade from far highlands.
Maps: Bronze Age Mediterranean and Gulf routes; the Uluburun cargo as a "follow the cargo" panel. Pictures: Kültepe tablet, Uluburun ingots (museum open-access only), Punt reliefs at Deir el-Bahari.
Styles: A, B, C, D (Amarna letter), E (Punt). Geography material: `socotra`, `bab-el-mandeb`, `strait-of-hormuz` as "old" places.
Reading: Larsen (Old Assyrian City-State), Pulak (Uluburun, in Aruz et al.), Possehl (Indus), Cohen and Westbrook (Amarna Diplomacy), Kitchen on Punt.

### 2. Monsoon and desert: the ancient Indian Ocean and Red Sea (about 1000 BCE to 600 CE)
Goals: the monsoon is a clock; South India, Arabia, East Africa and Southeast Asia traded with each other and with Rome.
Facts:
1. The monsoon reverses seasonally; ships sailed to India with the south-west wind in summer and home on the north-east in winter. The Periplus of the Erythraean Sea (a Greek-speaking Egyptian merchant's guide, mid 1st century CE; **CONTESTED** date, roughly 40 to 70 CE versus later, Casson) lists ports from Egypt to India and East Africa.
2. The Muziris papyrus (mid 2nd century CE) records a loan on the ship Hermapollon for a cargo from Muziris on the Kerala coast: pepper, nard, ivory, textiles. The cargo's value is **CONTESTED**: older readings give about 7 million sesterces; De Romanis's re-reading differs (`check` the range).
3. Berenike, a Red Sea port in Egypt, has yielded Indian pepper, teak and beads (Sidebotham).
4. Arabian frankincense and myrrh came from Hadramawt, Dhofar and Somalia and went north by caravan through Petra (Nabataeans).
5. Pliny (Natural History 12.84) says India, China and Arabia drain 100 million sesterces a year from Rome. **CONTESTED** as a measure: a rhetorical complaint, not an audit; the figure is quoted constantly and proves little.
6. Aksum (Ethiopia and Eritrea) minted gold coins and ran the port of Adulis, exporting ivory and tortoiseshell, 3rd to 7th centuries.
7. Funan's port at Oc Eo in the Mekong delta yielded a Roman gold medallion of Antoninus Pius (found 1944) beside Indian goods.
8. Austronesian-speaking sailors settled Madagascar. **CONTESTED:** when. Estimates run from the early centuries CE to about the 10th; recent genetic work points to a late, small founding group. Crop evidence on the East African coast (banana, rice) is dated to the first millennium.
Maps: monsoon wind arrows with sailing seasons; the Periplus ports. Pictures: Hermapollon papyrus (Vienna, check licence), Aksumite coin (Met open access), Berenike finds.
Styles: A, B (the Hermapollon), D (Pliny), E (Madagascar), F (the cinnamon route to Africa from Indonesia is a thesis, Miller 1969, mostly rejected).
Geography: `socotra`, `zanzibar`, `calicut`, `bab-el-mandeb`.
Reading: Casson (Periplus), De Romanis (Muziris), Chaudhuri, Pearson (Indian Ocean), Sidebotham, Sheriff.

### 3. The Silk Roads and the steppe (about 200 BCE to 1000 CE)
Goals: "Silk Road" is a modern name for many routes; the steppe peoples were traders, taxers and tribute-takers, not just raiders; Central Asian merchants (Sogdians) made much of it.
Facts:
1. The word "Seidenstrasse" was coined by the German geographer Ferdinand von Richthofen in 1877. The routes were many, mostly relay trade over short stretches.
2. Zhang Qian, sent by Han Wudi about 138 BCE to find allies against the Xiongnu, brought back news of Ferghana's horses and of Bactria.
3. The Xiongnu steppe confederation under Modun (r. 209 to 174 BCE) took silk and grain from Han China in marriage and tribute arrangements. Barfield's reading, that much of the silk flowing west began as steppe extraction, is an influential thesis, not a settled fact (mark as thesis).
4. The Sogdian Ancient Letters (about 313 CE, found by Aurel Stein in 1907 in a watchtower west of Dunhuang) are letters from Sogdian merchants and wives; they mention silver, musk, pepper and the burning of Luoyang by the "Huns". (Checked: U. Washington.)
5. Sogdian colonies stretched from Samarkand to Chang'an between the 4th and 8th centuries; An Lushan, whose revolt began in 755, was of Sogdian-Turkic descent.
6. Paper: the tradition of Cai Lun in 105 CE is a late reform, and paper fragments earlier than 105 CE have been found. The story that paper reached the Islamic world because of prisoners taken at Talas (751) is **CONTESTED** and largely discounted (Bloom).
7. Buddhism moved with merchants: Faxian went overland to India (399 to 412 CE) and came back by sea; Xuanzang travelled 629 to 645.
8. Silkworm eggs reached Byzantium by about 552 (Procopius) after monks carried them; sericulture had earlier reached Khotan.
Maps: the oases (Dunhuang, Kashgar, Samarkand, Merv) and the steppe belt, drawn as a net of routes not a line. Pictures: Tang tricolour camel and Sogdian figures (Met open access), Sogdian letter (British Library IDP, check licence).
Styles: A, D (letter), E (Xiongnu thesis), F (Talas).
Geography: `samarkand-timur-s-capital`, `kashgar`, `the-taklamakan`, `the-tarim-basin`, `the-karakum`.
Reading: Hansen, de la Vaissière, Barfield, Beckwith, Sen. Caution for the editor: Frankopan's popular *The Silk Roads* (2015) is criticised by specialists for overstating centrality; use Hansen as the backbone.

### 4. The Islamic world as hub (about 650 to 1250)
Goals: from Baghdad and Cairo, Muslim, Jewish and Christian merchants joined the Indian Ocean, the Sahara, the Mediterranean and China; trade law and credit were developed here.
Facts:
1. The Belitung wreck (an Arab or Indian Ocean sewn-plank ship, found off Belitung in 1998, about 826 CE by an inscribed bowl) carried tens of thousands of Chinese ceramics, mostly Changsha bowls, bound for the Gulf (cargo count `check`: the figure usually quoted is about 60,000 objects).
2. The Abbasid capital Baghdad was founded in 762; Basra and Siraf were its ocean ports, and Chinese ceramics are found at Siraf.
3. The Accounts of China and India (about 851, Sulayman the Merchant, continued by Abu Zayd) describe the sea route to Guangzhou. The foreign community of Guangzhou was massacred in 879 in the Huang Chao rebellion; the Arabic text gives 120,000 dead of four religions. **CONTESTED:** that number is widely judged implausible.
4. The Cairo Geniza is hundreds of thousands of fragments (estimates 300,000 to 400,000, **CONTESTED** count) including merchant letters of the 10th to 13th centuries; Goitein built his picture of Mediterranean and Indian Ocean trade from them, including the "India Book" of Ben Yijū in Mangalore.
5. Islamic commercial partnerships (qirad, mudaraba) let a financier and a travelling merchant share profit. **CONTESTED:** whether they were the source of the Italian commenda (Udovitch yes; others stress parallel invention) and whether Islamic law later held back finance (Kuran says so; many specialists disagree).
6. Radhanite Jewish merchants (Ibn Khordadbeh, about 870) are said to have travelled from Francia to China. **CONTESTED:** whether they were an organised guild at all.
7. Sugar and cotton spread through the Islamic world; sugar-estate work in the Iraqi marshes used enslaved East Africans, whose revolt (the Zanj, 869 to 883) ran for fourteen years. The "Arab agricultural revolution" thesis (Watson) is **CONTESTED**.
8. Ahmad ibn Majid wrote a pilot's manual in 1490. The story that he guided Vasco da Gama is doubted (see chapter 9).
Maps: the Baghdad, Siraf, Guangzhou axis; Geniza correspondents' towns. Pictures: Belitung ceramics (Smithsonian, check licence), an astrolabe or pilot text (Met/Gallica).
Styles: B, D (Abu Zayd), E (Guangzhou 879), F (Radhanites), G.
Geography: `strait-of-hormuz`, `muscat`, `cairo`.
Reading: Goitein, Hourani, Chaudhuri, Udovitch, Popovic (Zanj), McCormick (the Europe side).

### 5. Africa: gold, salt, ivory and the Swahili coast (about 300 to 1500)
Goals: West Africa's gold fed the Mediterranean and Islamic mints; the Swahili city-states and Great Zimbabwe were a trading system joined to the Indian Ocean; slavery was part of it from the start.
Facts:
1. The camel made Sahara crossings routine in the first millennium; regular caravan trade grew from about the 8th century. Sijilmasa in Morocco and Awdaghust were gateways; al-Bakri (1068) describes the road.
2. Taghaza, in the Sahara, was a salt mine whose buildings were made of salt blocks; Ibn Battuta saw it in 1352.
3. Mansa Musa of Mali made the pilgrimage in 1324 through Cairo with a famous caravan. **CONTESTED:** his dates (reign about 1312 to 1337 in most accounts; some give 1307 to 1332), the size of the caravan, and the amount of gold given away. Al-Umari, writing in Cairo some years later, reports gold falling in value there; the "richest man in history" claim cannot be measured.
4. The Catalan Atlas (1375) pictures a king of Mali holding a gold nugget: African gold was known in Mallorca.
5. Timbuktu was a scholarly centre; the manuscript collections number in the hundreds of thousands (**CONTESTED** count, commonly given as 300,000 to 700,000; many private).
6. The trans-Saharan slave trade lasted from the 7th century into the 20th. **CONTESTED:** the total. Austen's census-style estimate is about 9 million over the whole period; others differ (check).
7. Kilwa and the Swahili city-states (Mombasa, Zanzibar, Mogadishu) traded gold from the Zimbabwe plateau (shipped from Sofala), ivory and enslaved people for Indian cloth, Persian glass and Chinese porcelain.
8. Great Zimbabwe (about 11th to 15th centuries) is a stone-walled trading centre where Chinese celadon and Persian glass have been found; population estimates are **CONTESTED** (roughly 10,000 to 20,000).
9. Cowrie shells came from the Maldives, were traded through Bengal and later, in far greater volume, by European ships to West Africa, where they were money; Bengal used cowries as small change into the 19th century.
Maps: Sahara routes with salt, gold, copper and slave flows distinguished; Swahili coast to Sofala. Pictures: Catalan Atlas detail (BnF Gallica), Kilwa ruins (own or open-access), a Timbuktu manuscript (check licence), Ife heads.
Styles: A, B, D (Ibn Battuta), E (Mansa Musa, manuscripts), H (cowries).
Geography: `timbuktu`, `zanzibar`, `mombasa`, `richards-bay` (modern link), `tamanrasset-in-the-sahara`.
Reading: Austen, Levtzion and Hopkins (Arabic sources), Hunwick (Timbuktu), Horton and Middleton, Hopkins, Bulliet, Hogendorn and Johnson, Pikirayi.

### 6. Maritime Asia: China and Southeast Asia (about 600 to 1500)
Goals: the South China Sea and the straits were the centre of the world's sea trade; the Chinese state, Tamil guilds and Malay ports each shaped it.
Facts:
1. Srivijaya (7th to 13th centuries), based in Sumatra, controlled the Malacca and Sunda straits; the Chinese monk Yijing sailed there in 671.
2. In 1025 the Chola navy raided Srivijaya's ports. **CONTESTED:** why (trade rivalry, a quarrel over Chinese trade access, or something else); Tamil merchant guilds (the Ayyavole and Manigramam) were active across the region.
3. Song China (960 to 1279) ran licensed foreign trade at ports such as Quanzhou and taxed it; the Quanzhou wreck found in 1974 is a 13th century ocean-going ship.
4. Paper money appeared in Sichuan about 1000 (jiaozi) and was a state issue by 1024; coin shortage, not fashion, drove it.
5. The Song inspector of foreign trade at Quanzhou, Zhao Rukuo, compiled the Zhufan zhi (about 1225), a catalogue of countries and goods that mentions Zanzibar.
6. Zheng He (a Muslim from Yunnan) led seven Ming expeditions between 1405 and 1433 as far as East Africa; a giraffe from Malindi reached the court. **CONTESTED:** the ships' size ("120 metres" in later texts, doubted by many specialists) and the fleet numbers (about 300 ships and 27,000 men on the first voyage in the sources).
7. Malacca, founded about 1400 by Parameswara, became the entrepôt for Gujarati, Chinese, Javanese and Malay merchants. Tomé Pires (about 1515) wrote that whoever held Malacca had his hand on the throat of Venice.
8. Spices were geographically tiny: cloves came only from the northern Moluccas (Ternate, Tidore), nutmeg and mace only from the Banda Islands. Cloves were found in a Syrian kitchen of about 1700 BCE (check).
9. The Ryukyu Kingdom, trading under Ming tribute rules, called itself the bridge between nations (bell inscription, 1458).
Maps: the straits (Malacca, Sunda, Lombok); Chola raid; Zheng He's voyages as a labelled route (marking sources). Pictures: Mao Kun map (public domain), Quanzhou ship, Ming giraffe painting.
Styles: A, B, D (Pires), E (Zheng He), F (the Ming "treasure ships").
Geography: `strait-of-malacca`, `malacca`, `banda-islands`, `ming-treasure-fleets`, `ningbo-zhoushan`.
Reading: Wolters, Hall, Reid, Kulke and others (Chola), von Glahn, Dreyer, Ma Huan (Mills), Zhao Rukuo (Hirth and Rockhill), Pires (Cortesão).

### 7. The Mongol peace, plague, and Europe's merchant towns (about 1200 to 1450)
Goals: the Mongol Empire made the overland routes safer and more connected; plague travelled the same roads; Europe's town leagues were one regional network among several. (Europe is the last lesson of the chapter.)
Facts:
1. The Mongols ran the yam relay system with passport tablets (paiza); merchant partnerships (ortoq) were financed by the court (Allsen).
2. The "Pax Mongolica" is a historians' label, not a contemporary one; trade rose, but so did the violence of conquest.
3. Marco Polo's account (about 1298). **CONTESTED:** whether he reached China (Wood says no; Vogel and others find his details on salt and paper money credible).
4. The Black Death (1346 to 1353) reached the Genoese trading post of Caffa in 1346. Ancient-DNA work from graves at Lake Issyk-Kul (Kyrgyzstan) in 1338 to 1339 points to a Tian Shan origin. **CONTESTED:** the death toll in Europe (about 30 to 60 percent, Benedictow high and Hatcher and Campbell lower); the Middle East and Africa have thinner evidence.
5. Genoese merchants bought Kipchak and other Black Sea captives at Caffa and sold them to Mamluk Egypt; the Mamluk sultanate (from 1250) was itself ruled by former enslaved soldiers (Barker).
6. In 1204 the Fourth Crusade, financed and shipped by Venice, sacked Constantinople.
7. The Hanseatic League (Lübeck, founded as a merchant town 1143; its first general diet 1356) had its trading posts at Bergen's Bryggen, the London Steelyard, Novgorod's Peterhof and Bruges.
8. Delhi Sultanate and Gujarat: Cambay shipped Indian cotton cloth west and east; Indian textiles were the main manufactured export of the pre-1800 world (Riello and Roy).
Maps: Mongol routes, plague spread (shown as an estimate), Hanse posts. Pictures: Catalan Atlas, Hanse seal, Bryggen (own/open-access).
Styles: B, C, D (Pires/Polo extract), E (Black Death, Marco Polo), F, G.
Geography: `bryggen`, `lubeck`, `visby`, `novgorod`, `steelyard`, `rialto`, `the-resund`, `hanseatic-league`, `venetian-republic`, `medici-bank`.
Reading: Allsen, Abu-Lughod, Dollinger (Hansa), Dols, Barker, Spyrou et al. (plague DNA), Benedictow.

### 8. The Americas before 1492
Goals: America was not empty of trade: markets, long-distance merchants, a state without markets, and shell and metal routes along two coasts.
Facts:
1. Cacao: chocolate residues in pottery from the Soconusco (about 1900 BCE) and from Ecuador's Amazon edge (about 3300 BCE, Santa Ana-La Florida). **CONTESTED:** where cacao was first domesticated, but the Ecuador finding has moved the origin to South America.
2. Aztec pochteca were long-distance merchants of Tenochtitlan and Tlatelolco, state-backed, also gathering information; the Florentine Codex (Book 9) records their ranks and customs from Nahua informants.
3. Tlatelolco's market was described by Cortés and by Bernal Díaz as very large; the day-crowd figures (tens of thousands) are **CONTESTED** as colonial estimates. Cacao beans served as small change.
4. The Inca built the Qhapaq Ñan, about 30,000 km of roads (UNESCO-listed core network), and kept records on khipu. **CONTESTED:** whether the Inca economy ran without markets or money (Murra's redistribution model) or had regional merchants on the coast (Rostworowski).
5. Spondylus shells from Ecuador's warm waters travelled to Peru; the metallurgy of West Mexico shows Andean techniques about 600 to 800 CE, taken as evidence of sea contact. **CONTESTED:** how direct that contact was.
6. At Chaco Canyon, scarlet macaws were kept at Pueblo Bonito about AD 900 to 1100 (bones from Mesoamerica, over 1,000 km) and cacao residue has been found in its vessels (Crown and Hurst, PNAS 2009; Watson et al., PNAS 2015; `check`).
7. Cahokia (near St Louis, about 1050 to 1350) was a Mississippian city; Gulf shells, Great Lakes copper and Ozark chert moved through it. **CONTESTED:** peak population (about 10,000 to 20,000 or more).
8. A Norse site at L'Anse aux Meadows was occupied in 1021 CE (dated from felled trees, Kuitems et al.); Norse Greenland exported walrus ivory to Europe. It left no lasting link.
9. Sweet potato (kumara) was in Polynesia before European contact; genetic work argues for Native American and Polynesian contact about 1200 (Ioannidis et al. 2020). **CONTESTED**, both date and route.
Maps: Mesoamerican, Andean and Mississippian routes, the Pacific coast shell road. Pictures: Florentine Codex page (LoC/Gallica), Inca khipu (Met), Spondylus (Met), Chaco macaw burial.
Styles: A, B, D (Cortés/Díaz), E (Cahokia, Tlatelolco), H.
Geography: `lake-titicaca`, `the-escondida-mine`, `chuquicamata` (old copper regions).
Reading: Smith (The Aztecs), Berdan, Murra, Rostworowski, Pauketat, Hosler, Crown and Hurst, Denevan.

### 9. 1492 to 1650: the world joins up, and who paid
Goals: the Americas are connected to Asia and Africa; the Columbian exchange; silver; the Portuguese, Spanish and Dutch fit into an Asian system more than they remake it.
Facts:
1. Da Gama reached Calicut in May 1498 with a pilot taken on at Malindi; the story that Ahmad ibn Majid was the pilot is **CONTESTED** and doubted (Subrahmanyam).
2. The Portuguese Estado da Índia took Goa (1510), Malacca (1511) and Hormuz (1515) and sold passes (cartazes) for Asian ships. **CONTESTED:** how much of Asian trade they controlled. Older work (Boxer) said much; Chaudhuri, Pearson and Subrahmanyam say a small share.
3. Myth: Ottoman capture of Constantinople (1453) did not close the spice routes; the Mamluks and Ottomans taxed an active trade, and Venice was still buying.
4. Silver: Potosí (found 1545) and Mexican mines supplied about 80 percent of the world's silver in 1500 to 1800, and about 30 percent of it reached China (as cited in secondary accounts; **CONTESTED** in the detail). Silver at Potosí was dug by Indigenous draft labour (the mita), with heavy mortality.
5. The Manila galleons ran from 1565 to 1815 between Acapulco and Manila, carrying silver west and Chinese silk and porcelain east. Flynn and Giráldez date the origin of world trade to 1571 (Manila's founding); that framing is theirs and is disputed as a start date.
6. China's Ming state moved its taxes into silver (the "single whip" reforms, 1570s to 1580s), making China a sink for silver.
7. Columbian exchange. **CONTESTED:** the American population in 1492. Estimates run from about 8 million (Kroeber) through 54 million (Denevan) to 60.5 million (Koch et al. 2019, interquartile range 44.8 to 78.2 million) and 100 million or more (Dobyns). Koch et al. say about 90 percent died by 1600 (87 to 92 percent), about 54 to 56 million people. Causes disputed: epidemics (Crosby, Cook) versus conquest, forced labour and famine (Livi-Bacci). The paper's claim of a CO2 fall of 7 to 10 ppm and a link to the Little Ice Age is also contested.
8. American crops (maize, potato, sweet potato) reached China and Africa in the 16th century and changed what populations could be fed.
9. The Dutch East India Company (VOC, 1602) issued tradable shares and kept permanent capital; "first joint-stock company" is **CONTESTED** (the English Muscovy Company of 1555 and the East India Company of 1600 came earlier).
10. Mughal India absorbed silver and exported cotton cloth; its rupee was a standard silver coin.
Maps: Atlantic and Pacific wind systems; silver flows; Portuguese forts. Pictures: Potosí in Cieza de León (1553), Cerro Rico engraving, Manila galleon print.
Styles: A, B, C, E (Columbian exchange), F, G.
Geography: `potosi`, `goa`, `macau`, `castle-of-good-hope`, `the-cape-of-good-hope`, `portuguese-india`, `spanish-silver`, `fuggers`, `fuggerei`, `voc`.
Reading: Subrahmanyam, Chaudhuri, Flynn and Giráldez, Bakewell (Potosí), von Glahn, Crosby, Cook, Denevan, Livi-Bacci, Koch et al., Richards (Mughal).

### 10. The Atlantic slave trade and the plantation world (1500 to 1888)
Goals: the scale, the organisation and the human cost; who was enslaved, who sold, who bought, who profited; resistance; compensation to owners; what the trade did to Africa. Full weight, with the same depth as chapters 5 and 6.
Facts:
1. Voyages database: about 12.5 million (12,520,000) people embarked from Africa and about 10.7 million disembarked, on voyages from 1514 to 1866. Middle Passage mortality averaged 12.1 percent across the voyages with data (range 9 percent from the Windward Coast to 19.5 percent from south-east Africa). **CONTESTED:** the totals have been revised upward since Curtin (1969, about 9.6 million disembarked); the database covers about 80 percent of disembarking ships and imputes the rest. (Checked: slavevoyages.org methodology.)
2. Portuguese and Brazilian ships carried the largest share, roughly 45 percent, British ships about a quarter, French about a tenth (Eltis and Richardson; `check` the exact shares). Brazil received the largest number of any American territory and abolished slavery last in the Americas, in 1888.
3. African states took part as sellers, and some resisted: Kongo's king Afonso I wrote to Portugal in 1526 that the trade was depopulating his kingdom. Dahomey, Asante and Oyo built states around the trade. Historians differ on how much African agency shifts responsibility (Thornton emphasises African control of supply; Rodney and Inikori stress the pressure of European demand and guns).
4. Africa's population in 1850 was **CONTESTED** as reduced by about half relative to what it would have been (Manning 1990). Nunn (2008) links the regions that exported most to poorer outcomes today; this is disputed (selection and data critiques).
5. Plantation sugar moved west: the Mediterranean, Madeira, São Tomé, Pernambuco, then Barbados in the 1640s (Dutch capital and techniques), then Jamaica and Saint-Domingue. Sugar was the main plantation crop in the 17th and 18th centuries; tobacco, coffee, rice, indigo and cotton followed.
6. The asiento (the Spanish licence to supply enslaved people) passed to the British South Sea Company in 1713.
7. Saint-Domingue produced a large share of Europe's sugar and coffee in the 1780s (the figures usually quoted are about 40 and 60 percent, `check`). The revolution (1791 to 1804) made Haiti the first state founded by an enslaved people's revolt. In 1825 France demanded 150 million francs (about ten times Haiti's annual revenue); it was cut to 90 million, borrowed from French banks, and the debt service ran until 1947. **CONTESTED:** the modern value (a New York Times study gave about 22 billion dollars; economists disagree on the method).
8. British abolition: the trade in 1807, slavery in 1833 to 1834 (apprenticeship to 1838). The state borrowed 20 million pounds to compensate owners; the formerly enslaved received nothing; the loan was repaid in 2015. Legacies database at UCL names the owners.
9. The US had about 4 million enslaved people in 1860; cotton from the US South supplied most of Lancashire's raw cotton. **CONTESTED:** how central slavery was to industrialisation (Williams 1944 and Inikori say very; Drescher and others say little).
10. Benin bronzes and manillas: lead isotopes show much of the metal in the Benin bronzes came from the Rhineland, shipped as manillas in the trade (Skowronek et al., 2023, `check`). Brandenburg's African Company ran Groß Friedrichsburg on the Gold Coast, 1683 to 1717.
11. Eastern slavery. The Indian Ocean slave trade moved far fewer people per year but over more than a thousand years; estimates for East Africa are about 8 million from the 7th century to 1920 (secondary summaries; **CONTESTED**). European traders exported about 570,000 to 730,000 people within the Indian Ocean between 1500 and 1850 (Allen). Zanzibar's clove plantations (1840s onward) used enslaved labour under the Omani sultan.
Maps: the triangle redrawn from the data (embarkation regions, disembarkation regions, volumes); Brazil's Valongo; Gorée and Elmina; Indian Ocean flows. Pictures: the Brookes ship plan (LoC, public domain), a Dahomey or Asante object (Met), Haitian revolution print, an Elmina castle photograph (own).
Styles: A, B, D (Afonso's letter), E (totals), G (who paid for abolition), H (cowries and manillas).
Geography: `elmina`, `goree-island`, `royal-african-company`, `south-sea-company`, `mississippi-company`, `zanzibar`.
Reading: Eltis and Richardson, Voyages database, Thornton, Manning, Lovejoy, Rodney, Williams, Drescher, Inikori, Dubois, Draper, Mintz, Beckert, Allen, Campbell, Sheriff.

### 11. Companies, empires and the forced opening of markets (1600 to 1900)
Goals: the chartered companies (English, Dutch, others) as trading states; the Bengal takeover; opium; unequal treaties; and Asian states' own managed trade (Japan, Siam, Qing before 1842).
Facts:
1. The English East India Company was chartered on 31 December 1600; the VOC in 1602. By 1800 the EIC had a private army larger than Britain's (about 200,000 soldiers; `check`).
2. After Plassey (June 1757) and the grant of the diwani (1765), the Company collected the revenue of Bengal, Bihar and Orissa; it raised the land revenue by about 30 percent within a few years.
3. The Bengal famine of 1770. **CONTESTED:** deaths. The Company's own estimate was one third of the population (about 10 million); Sen (1983) repeats 10 million; Dutta proposes 1.2 million; Dyson and Irschick estimate at least 1 million; Dyson notes out-migration as well as death. Causes disputed: harvest failure versus tax pressure and Company grain purchases.
4. Textiles: Britain banned Indian printed calicoes in 1700 and 1721 to protect home weavers. India's share of world manufacturing, as estimated by Bairoch, fell from about 25 percent (1750) to about 2 percent (1900). **CONTESTED:** the size of the decline (Maddison's GDP shares, 24 percent in 1700; Broadberry, Gupta and Roy question the early figures) and the cause (deindustrialisation by competition and tariff versus longer trends). Patnaik's estimate of 45 trillion dollars "drained" from India between 1765 and 1938 depends on a chosen interest rate and is disputed on method. Present these as ranges, never as one number.
5. The opium trade. The Company monopolised Bengal opium; private firms (Jardine Matheson, Dent) sold it at Canton, which was illegal. Imports to China rose from a few thousand chests around 1800 to about 40,000 in 1838 to 1839 (chest about 60 to 65 kg; **CONTESTED**, the Chinese figures differ by source). Silver flowed out of China from the 1820s (Lin Man-houng; the size of the drain is argued).
6. In June 1839 Lin Zexu destroyed some 20,000 chests (about 20,000 to 21,000 in the sources) at Humen.
7. The Treaty of Nanking (29 August 1842): Hong Kong ceded, five treaty ports opened, 21 million dollars indemnity. The Tianjin treaties (1858) opened more ports and in later talks legalised opium imports; the Convention of Peking (1860) ceded Kowloon and followed the looting and burning of the Yuanmingyuan. (Checked: Britannica.) "Century of humiliation" is a modern political frame and historians (Callahan) debate its use.
8. Unequal treaties as a type: extraterritoriality and low fixed tariffs (about 5 percent) in China, Japan (1858 Harris Treaty), Siam (Bowring Treaty, 1855) and the Ottoman Empire (Balta Liman, 1838, about 3 percent on imports). Gallagher and Robinson's "imperialism of free trade" (1953) is the standard analysis.
9. The VOC and Banda (1621): Jan Pieterszoon Coen's conquest nearly depopulated the islands. **CONTESTED:** numbers (about 15,000 inhabitants before; most killed, enslaved or fled; roughly 1,000 remained, per Loth and Hanna).
10. Japan limited European trade to Dejima (Nagasaki) and managed Korea, Ryukyu and Ezo through other gateways: the "closed country" was a managed trade policy.
11. The Dutch Cultivation System on Java (1830 to 1870) forced villagers to grow export crops for the state; its yield to the Dutch treasury was large (share **CONTESTED**).
Maps: Canton and the treaty ports; Bengal; Banda; the opium triangle (India, China, silver). Pictures: Nemesis print (1843), opium godowns at Patna, Canton factories painting (Thirteen Factories), Dejima.
Styles: A, B, C, D (Lin Zexu's letter to Victoria; its delivery is doubtful, so quote as "written", not "received"), E (Bengal, Banda, India's share), F, G.
Geography: `east-india-company`, `fort-st-george`, `plassey`, `batavia`, `dejima`, `thirteen-factories`, `jardine-matheson`, `hudson-s-bay`, `york-factory`, `banda-islands`, `colombo`.
Reading: Stern, Chaudhuri (Asia), Trocki, Lovell, Chang, Lin Man-houng, Wang Dong, Gallagher and Robinson, Dalrymple (popular), Dyson (Population History of India), Riello and Roy, Loth.

### 12. Extraction, forced labour and the industrial world (1800 to 1914)
Goals: steam, the telegraph and canals; indenture; the Congo; labour for guano, rubber, gold and sugar; and the people who traded on their own terms.
Facts:
1. Singapore was founded as a free port in 1819; Hong Kong, Aden and Penang followed as British trading bases.
2. The Suez Canal opened 17 November 1869. Egyptian peasants dug it under forced labour (corvée) until Egypt's ruler stopped it in 1863; deaths are **CONTESTED** (from about 20,000 to over 100,000 in the older literature; none reliable). Egypt's debts led to British occupation in 1882.
3. Indian indenture. Between 1834 and 1920 about 1.6 million Indians were shipped to Mauritius (453,000), British Guiana (239,000), Trinidad (148,000), Natal (152,000), Fiji (61,000), Suriname (34,000) and elsewhere (a Wikipedia table summarising secondary work; other totals of 1.3 to 2 million exist, **CONTESTED**). Some ships lost over 17 percent; mortality among new arrivals in Mauritius sometimes exceeded 20 percent a year. Hugh Tinker called it "a new system of slavery"; Northrup stresses that regulation improved conditions. The British scheme ended in 1917.
4. Chinese coolie trade: about 125,000 Chinese went to Cuba (1847 to 1874) and about 90,000 to 100,000 to Peru, many under deceit or kidnap through Macau; the 1874 Cuba Commission took testimony; Macau's trade was banned in 1874 (check numbers).
5. Peru's guano boom (1840s to 1870s) used coolie labour; the War of the Pacific (1879 to 1884) over nitrate cost Bolivia its coast.
6. The Congo Free State (founded 5 February 1885 on the Berlin Conference's eve; Leopold II's personal possession until 15 November 1908) ran on forced rubber and ivory collection by the Force Publique; quotas were enforced by hostage-taking, killing and in some cases cutting off hands as proof. Roger Casement's report (1904) and photographs by the missionary Alice Seeley Harris forced reform; Belgium annexed the colony in 1908. **CONTESTED:** the death toll. Range 1 to 15 million; the usual figure is about 10 million (Hochschild, from the Belgian commission of 1919 and the 1924 census), with half the population dead (Vansina's local work agrees in direction). Critics (Louis and Stengers, Mignon, others) say there was no census, disease (sleeping sickness, smallpox) caused much, and the state was thinly staffed. Ndaywel è Nziem's Congolese history gives the Congolese perspective.
7. Myth: the Berlin Conference (1884 to 1885) did not divide Africa among Europeans; it set rules for claiming coasts ("effective occupation") and settled Congo access; the carving up came through later treaties and wars (Förster et al.).
8. Putumayo (Amazon, 1900s): the Peruvian Amazon Company's rubber regime killed or enslaved thousands of Indigenous people; Casement investigated again in 1910 to 1911 (numbers **CONTESTED**).
9. Gold and diamonds: Kimberley (1871), the Witwatersrand (1886) and De Beers (1888) set up migrant mine labour on racial lines. Panama Canal (1914): West Indian workers did most of the work; deaths on the US-era project were about 5,600 (McCullough, `check`; the French era higher).
10. Africans and Asians as principals too: Swahili-Omani trader Tippu Tip (c. 1832 to 1905) built an ivory and slave empire in the eastern Congo; Chettiar, Marwari and Hadhrami merchant networks financed trade across the Indian Ocean.
Maps: Congo basin with rubber and ivory regions; Suez; indenture destinations (flows scaled by numbers); Pacific guano. Pictures: Harris photographs of 1904 (licence trap: public in the US, the UK term may run to 2040; use a verified source), Suez opening print, an indenture ship plan, coolie contract.
Styles: A, B, D (Casement report extract), E (Congo, Suez, indenture), F (Berlin), G.
Geography: `suez-canal`, `panama-canal`, `zanzibar`, `rothschilds`, `richards-bay`, `durban`.
Reading: Hochschild, Vansina (Being Colonized), Ndaywel, Hunt (A Nervous State), Tinker, Northrup, Lal, Look Lai, Yun, Karabell, Greene, Cushman, Förster and others.

### 13. Wars, depression, oil and decolonisation (1914 to 1990)
Goals: the 1914 to 1945 collapse of world trade and what rebuilt it; Geneva's role; oil; containers; the new states' trade claims. Facts, not policy argument.
Facts:
1. World trade fell by about two thirds in value between 1929 and 1933 (League of Nations series, `check`). **CONTESTED:** the role of the US Smoot-Hawley tariff (1930): Irwin judges it modest next to deflation and the gold standard.
2. Bretton Woods (July 1944, 44 states) and the GATT, signed at Geneva in 1947 by 23 countries and in force from 1 January 1948.
3. The Bandung Conference (April 1955, 29 Asian and African states); UNCTAD was founded in Geneva in 1964. The Prebisch-Singer thesis (1950) that primary-commodity prices decline against manufactures has mixed empirical support (**CONTESTED**).
4. Containerisation: the Ideal X sailed from Newark to Houston on 26 April 1956 with 58 containers; Levinson reports loading cost fell from about 5.86 to 0.16 dollars a ton (check). ISO sizes were standardised in 1968.
5. Oil: the Anglo-Persian Oil Company (1909); Iran nationalised its oil in 1951 and the government was overthrown in 1953; OPEC was founded at Baghdad in September 1960 (Iran, Iraq, Kuwait, Saudi Arabia, Venezuela); the 1973 Arab embargo and price rise from about 3 to about 12 dollars a barrel.
6. The Suez Canal was closed from June 1967 to June 1975, which pushed shipowners to supertankers around the Cape.
7. China was largely outside the trading system from 1949; Deng's reforms (1978) and the Shenzhen Special Economic Zone (1980) opened it.
Maps: the interwar trade collapse as a bar chart; oil flows 1973; container routes. Pictures: Ideal X (public-domain US government photos), Bandung photos (check).
Styles: C, D (GATT preamble), E, G.
Geography: `diego-garcia`, `ras-tanura`, `kharg-island`, `the-ghawar-oilfield`, `the-port-of-rotterdam`.
Reading: Kindleberger, Irwin (both books), Levinson, Yergin, Prashad, Findlay and O'Rourke.

### 14. Today's flows and chokepoints
Goals: where the goods go now and what passes through which strait; learn to read a flow map; the 2020s disruptions as dated events. Money and banking only as trade-finance basics (letter of credit, bill of lading, who carries the risk). No policy advocacy.
Facts (each stamped with its year; numbers are drawn from stored datasets at build time, never typed from memory; chokepoint facts are perishable):
1. About 80 percent of the volume of international goods trade goes by sea (UNCTAD, Review of Maritime Transport; checked).
2. The Strait of Hormuz carried about 20 million barrels a day in 2024, about 20 percent of global petroleum liquids consumption (EIA; checked). In 2026 flows were disrupted by the Iran war; the EIA outlook (June 2026) expected shipments could resume in the third quarter with a full return in early 2027 (secondary report; re-check before building).
3. Suez/Red Sea: Houthi attacks began in November 2023; Suez transits in 2025 were 57 to 64 percent below 2023, with container ships 86 percent below in Q4 2025 (BIMCO, 30 January 2026; checked); Lloyd's List counted 99 attacks or hijackings since November 2023. Diverting around the Cape adds roughly 10 to 14 days Asia to north Europe (check).
4. Malacca carries roughly 23 million barrels a day of oil (EIA 2023 figure, `check`) and much of China's imports; the Panama Canal's capacity was cut in the 2023 to 2024 drought (`check`).
5. China joined the WTO on 11 December 2001. **CONTESTED:** the size of the "China shock" on US manufacturing jobs (Autor, Dorn and Hanson: a large share of the 1990 to 2007 decline; other studies find less).
6. Main commodity flows to include as maps (each with a dated dataset): iron ore (Australia and Brazil to China), soybeans (Brazil and the US to China), LNG (Qatar, the US, Australia), crude (Gulf to Asia; US to Europe), grain (Black Sea), copper (Chile, Peru, DRC), rare-earth processing (China the dominant refiner; IEA/USGS figures).
7. The Black Sea Grain Initiative ran from July 2022 to July 2023 (UN-brokered); volume to be taken from UN data.
8. Flags of convenience: Panama, Liberia and the Marshall Islands lead registries by deadweight tonnage (UNCTAD).
9. Trade in compliance products (biofuels, used cooking oil, certified fuels) is a flow whose rules differ by jurisdiction; one factual lesson on how a cargo's origin, sustainability proof and destination rules are linked, with no view on the rules. (Checked with the desk before it is built: Korbi's field.)
Maps: a live-style set of chokepoints with the share of oil, LNG, grain and containers (from datasets); the busiest container ports.
Styles: A (strait tap), B (route of a named cargo), E, G (who carries the risk in a letter-of-credit trade).
Geography: all of `trade-place` (chokepoints, ports, mines, fields): `strait-of-hormuz`, `strait-of-malacca`, `suez-canal`, `panama-canal`, `bab-el-mandeb` (and the duplicate `bab-el-mandeb-2`, to be merged by whoever owns `kb/`), `the-bosporus`, `the-strait-of-gibraltar`, `the-cape-of-good-hope`, `the-resund`, `algeciras`, `fujairah`, `jurong-island`, `the-port-of-rotterdam`, `the-port-of-antwerp`, `ningbo-zhoushan`, `the-port-of-santos`, `the-jamnagar-refinery`, and the mines and fields.
Reading: Rodrigue (Geography of Transport Systems), EIA Chokepoints, UNCTAD RMT, Levinson, Baldwin (Great Convergence), Autor et al.

## 4. What moves from where (the geography material)

- **Nothing is removed** from Chart, Origin, Punt or `kb/`. The course reads entities by id and adds a trade lesson per entity as a "place card".
- `trade-place` (86): into chapter 14, with the chokepoints and ports also as "old places" in chapters 1, 2, 6, 9 and 12 (Hormuz, Malacca, Suez, the Cape, Panama). Production sites (mines, fields) go to chapter 14's commodity-flow map only.
- `trade-history` (24): Bryggen, Lübeck, Visby, Novgorod, Steelyard, Rialto: ch. 7. Calicut: ch. 2 and 9. Potosí, Goa, Macau, Castle of Good Hope, Fuggerei: ch. 9. Elmina, Gorée: ch. 10. Plassey, Fort St George, Batavia, Dejima, Thirteen Factories, Banda, York Factory: ch. 11. Malacca: ch. 6. Samarkand: ch. 3. Frankfurt Judengasse: ch. 7 (Jewish merchants' quarter, with its restrictions).
- `merchant-power` (16): Sogdians: ch. 3. Ming treasure fleets: ch. 6. Hanse, Venice, Medici: ch. 7. Portuguese India, Spanish silver, Fuggers, VOC: ch. 9. Royal African Company, South Sea, Mississippi: ch. 10. EIC, Hudson's Bay, Jardine Matheson: ch. 11. Rothschilds: ch. 12.
- `geo-place` items that tell trade stories: Timbuktu, Kashgar, Zanzibar, Socotra, Banda, Diego Garcia, the deserts of the Silk Road.
- **Marks:** `trade-place` is currently marked personal (`p`) for removal in the public build; the history entities are marked by their own tier. The course should read marks the usual way (the Include setting) unless Korbi rules the course itself personal (question 3).
- **No overlap with Navigation, Landfall or Almanac:** the sky, sextant and chronometer are theirs. Navigation's lessons already give the East India Company 1600, the VOC 1602 and Brouwer's route 1611; this course points to them, not repeats them.

## 5. Sources register (proposed)

Priority is academic work and primary-source translations by historians from several regions. Reading lists in section 3 refer to these.

- **Global and method:** Findlay and O'Rourke, *Power and Plenty* (Princeton, 2007). Pomeranz and Topik, *The World That Trade Created* (Routledge). Abu-Lughod, *Before European Hegemony* (Oxford, 1989). Pomeranz, *The Great Divergence* (Princeton, 2000). Parthasarathi, *Why Europe Grew Rich and Asia Did Not* (Cambridge, 2011). Subrahmanyam, *Explorations in Connected History* (Oxford India, 2005). Bayly, *The Birth of the Modern World* (Blackwell, 2004). Osterhammel, *The Transformation of the World* (Princeton, 2014). Riello and Roy (eds), *How India Clothed the World* (Brill, 2009).
- **Indian Ocean:** Chaudhuri, *Trade and Civilisation in the Indian Ocean* (Cambridge, 1985). Pearson, *The Indian Ocean* (Routledge, 2003). Casson, *The Periplus Maris Erythraei* (Princeton, 1989). De Romanis, *The Indo-Roman Pepper Trade and the Muziris Papyrus* (Oxford, 2020). Sidebotham, *Berenike and the Ancient Maritime Spice Route* (California, 2011). Hourani, *Arab Seafaring*. Sheriff, *Slaves, Spices and Ivory in Zanzibar* (James Currey, 1987).
- **Islamic world:** Goitein, *A Mediterranean Society* (California, 1967 to 1993). Udovitch, *Partnership and Profit in Early Islam* (Princeton, 1970). Kuran, *The Long Divergence* (Princeton, 2011). Watson, *Agricultural Innovation in the Early Islamic World* (Cambridge, 1983). Popovic, *The Revolt of African Slaves in Iraq* (Markus Wiener, 1999). McCormick, *Origins of the European Economy* (Cambridge, 2001). Gibb (trans.), *The Travels of Ibn Battuta* (Hakluyt Society).
- **Africa:** Austen, *Trans-Saharan Africa in World History* (Oxford, 2010). Levtzion and Hopkins, *Corpus of Early Arabic Sources for West African History* (Cambridge, 1981). Hunwick, *Timbuktu and the Songhay Empire* (Brill, 1999). Horton and Middleton, *The Swahili* (Blackwell, 2000). Hopkins, *An Economic History of West Africa* (Longman, 1973). Bulliet, *The Camel and the Wheel* (Harvard, 1975). Hogendorn and Johnson, *The Shell Money of the Slave Trade* (Cambridge, 1986). Pikirayi, *The Zimbabwe Culture* (AltaMira, 2001). Green, *A Fistful of Shells* (Allen Lane, 2019). Vansina, *Paths in the Rainforests* (Wisconsin, 1990).
- **Silk Roads, steppe, China, Southeast Asia:** Hansen, *The Silk Road: A New History* (Oxford, 2012). de la Vaissière, *Sogdian Traders* (Brill, 2005). Barfield, *The Perilous Frontier* (Blackwell, 1989). Beckwith, *Empires of the Silk Road* (Princeton, 2009). Allsen, *Commodity and Exchange in the Mongol Empire* (Cambridge, 1997). Sen, *Buddhism, Diplomacy, and Trade* (Hawai'i, 2003). von Glahn, *Fountain of Fortune* (California, 1996) and *The Economic History of China* (Cambridge, 2016). Wolters, *Early Indonesian Commerce* (Cornell, 1967). Hall, *Maritime Trade and State Development in Early Southeast Asia* (Hawai'i, 1985). Reid, *Southeast Asia in the Age of Commerce* (Yale, 1988 to 1993). Kulke, Kesavapany and Sakhuja (eds), *Nagapattinam to Suvarnadwipa* (ISEAS, 2009). Dreyer, *Zheng He* (Pearson, 2007). Mills (trans.), *Ma Huan, Ying-yai Sheng-lan* (Hakluyt). Hirth and Rockhill, *Chau Ju-kua* (1911). Cortesão (trans.), *The Suma Oriental of Tomé Pires* (Hakluyt). Krahl et al. (eds), *Shipwrecked: Tang Treasures and Monsoon Winds* (Smithsonian, 2010).
- **Americas:** Smith, *The Aztecs* (Wiley-Blackwell). Berdan, *Aztec Archaeology and Ethnohistory* (Cambridge, 2014). Sahagún, *Florentine Codex* (Anderson and Dibble trans.). Murra, *The Economic Organization of the Inka State* (JAI, 1980). Rostworowski, *History of the Inca Realm* (Cambridge, 1999). Pauketat, *Cahokia* (Viking, 2009). Hosler, *The Sounds and Colors of Power* (MIT, 1994). Crown and Hurst (PNAS, 2009); Watson et al. (PNAS, 2015). Denevan, *The Native Population of the Americas in 1492* (Wisconsin, 1992). Crosby, *The Columbian Exchange* (1972). Cook, *Born to Die* (Cambridge, 1998). Livi-Bacci (Population and Development Review, 2006). Koch et al. (Quaternary Science Reviews, 2019).
- **Slavery and the Atlantic:** Eltis and Richardson, *Atlas of the Transatlantic Slave Trade* (Yale, 2010), with the Voyages database (slavevoyages.org). Thornton, *Africa and Africans in the Making of the Atlantic World* (Cambridge). Manning, *Slavery and African Life* (Cambridge, 1990). Lovejoy, *Transformations in Slavery* (Cambridge). Rodney, *How Europe Underdeveloped Africa* (1972). Inikori, *Africans and the Industrial Revolution in England* (Cambridge, 2002). Williams, *Capitalism and Slavery* (1944). Drescher, *Econocide* (Pittsburgh, 1977). Mintz, *Sweetness and Power* (Viking, 1985). Beckert, *Empire of Cotton* (Knopf, 2014). Dubois, *Avengers of the New World* (Harvard, 2004). Draper, *The Price of Emancipation* (Cambridge, 2010). Allen, *European Slave Trading in the Indian Ocean* (Ohio, 2014). Campbell (ed.), *The Structure of Slavery in Indian Ocean Africa and Asia*. Barker, *That Most Precious Merchandise* (Pennsylvania, 2019). Nunn, "The Long-Term Effects of Africa's Slave Trades" (QJE, 2008).
- **Companies, empire, opium, extraction:** Stern, *The Company-State* (Oxford, 2011). Lovell, *The Opium War* (Picador, 2011). Trocki, *Opium, Empire and the Global Political Economy* (Routledge, 1999). Chang, *Commissioner Lin and the Opium War* (Harvard, 1964). Lin Man-houng, *China Upside Down* (Harvard, 2006). Wang Dong, *China's Unequal Treaties* (Lexington, 2005). Gallagher and Robinson, "The Imperialism of Free Trade" (Economic History Review, 1953). Dyson, *A Population History of India* (Oxford, 2018). Roy, *The Economic History of India 1857 to 2010*. Maddison, *Contours of the World Economy* (Oxford, 2007). Patnaik, in Chakrabarti and Patnaik (eds), *Agrarian and Other Histories* (Columbia, 2018). Hochschild, *King Leopold's Ghost* (1998). Vansina, *Being Colonized* (Wisconsin, 2010). Ndaywel è Nziem, *Histoire générale du Congo* (De Boeck, 1998). Hunt, *A Nervous State* (Duke, 2016). Förster, Mommsen and Robinson (eds), *Bismarck, Europe, and Africa* (Oxford, 1988). Tinker, *A New System of Slavery* (Oxford, 1974). Northrup, *Indentured Labor in the Age of Imperialism* (Cambridge, 1995). Look Lai, *Indentured Labor, Caribbean Sugar* (Johns Hopkins, 1993). Yun, *The Coolie Speaks* (Temple, 2008). Karabell, *Parting the Desert* (Knopf, 2003). Greene, *The Canal Builders* (Penguin, 2009). Cushman, *Guano and the Opening of the Pacific World* (Cambridge, 2013). Primary: Casement's 1904 report; the 1874 Cuba Commission report; Lin Zexu's letters.
- **20th century and today:** Kindleberger, *The World in Depression* (California, 1973). Irwin, *Peddling Protectionism* (Princeton, 2011), and Irwin, Mavroidis and Sykes, *The Genesis of the GATT* (Cambridge, 2008). Levinson, *The Box* (Princeton). Yergin, *The Prize* (Simon and Schuster, 1991). Prashad, *The Darker Nations* (New Press, 2007). Baldwin, *The Great Convergence* (Harvard, 2016). Autor, Dorn and Hanson (American Economic Review, 2013). Rodrigue et al., *The Geography of Transport Systems* (Routledge). Data: EIA World Oil Transit Chokepoints; UNCTAD Review of Maritime Transport; BIMCO; Lloyd's List Intelligence; UN Comtrade; IEA critical minerals.

## 6. How a reviewer should check this outline

Read it for balance first: count facts per chapter by where the action is (section 1 has no tally yet), and ask whether chapters 10 to 12 are as full as 5 and 6. Then take only the facts marked **CONTESTED** or `(check)` and open the work named (or the reading list) for each: confirm the range quoted, that the people said to dispute it do so, and that no single number would be asked as settled (style E, never "what was the number"). Spot-check ten uncontested facts from different chapters against a general reference such as the Cambridge World History of Slavery, the Cambridge History of China, or the UNESCO General History of Africa. For the current-events facts in chapter 14, confirm the date stamp and re-pull the figure from the source (EIA, UNCTAD, BIMCO) the week the chapter is built. Check pictures last: each needs a named holder and an open licence (Met Open Access, Rijksmuseum, Smithsonian Open Access, Library of Congress, BnF Gallica, our own photographs), and the Harris Congo photographs need rights checked before use. Finally read every chapter for framing: facts and who did and suffered what, with no advocacy on present-day policy.

## 7. Open editorial questions for Korbi

1. There is no geography course in the repo. Do you mean the Geography topic and the `trade-place`/`trade-history` entities (my reading), or a course on another branch or machine?
2. Name and door: "History of trade" on `trade.html`, in the Courses section? Or "Trade"?
3. Is the course universal (a world-history topic taught in every national system: I think yes) or personal? That decides whether it is dealt in the public build or sits in the Include setting.
4. Pictures: `rules.md` forbids fetching pictures from Wikipedia at run time, but Art history fetches Wikipedia lead images through `pics.js`. Which rule governs this course? My proposal: open-access museum images and our own map drawings only, no run-time Wikipedia fetch.
5. Depth: about 3 to 4 lessons a chapter makes about 50 lessons, larger than Art history's 27. Cut to 40, or keep?
6. Atrocity material (slave ships, Congo, Opium Wars): short plain text with primary quotations and no graphic images; are photographs of mutilation acceptable at all (Harris 1904), or words only?
7. Chapter 14's contemporary facts are perishable: build as data with a date stamp and an "as of" line, or leave current events out of tested content and show them only as maps?
8. Chapter 14 fact 9 (compliance flows): include, or keep the course clear of your own desk's field?
9. Contested numbers: style E asks for defensible ranges. Is that the right treatment, or should contested figures be taught as reading only?
10. Colonial framing in Banda, Bengal and the opium chapters uses "crimes" where the source record supports it (massacre, forced labour, fraud); please confirm that wording level, and whether Britain's repayment of the 1833 loan in 2015 and the Haitian indemnity belong in the facts or the reading.
11. Note on `kb/`: `bab-el-mandeb-2` duplicates `bab-el-mandeb`, and `cape-of-good-hope` (geo) duplicates `the-cape-of-good-hope` (trade); `kb/` is a shared file, so I left it.
