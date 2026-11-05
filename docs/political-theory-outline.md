# Structures of power: course outline (stage 1, for Korbi's review)

Status: outline only. No course UI, no code, no changes to `apps.js` or any shared file. Nothing here is a ruling of Korbi's yet.
**Second pass (5 November 2026, after an outside review): sections 8 to 14 below supersede the chapter list in section 3 where they differ.** The review's verdict, which I accept: section 3 is a good comparative-government outline but not yet a constitutional-law course, has no statecraft or strategy strand, leaves chapters 3 to 8 thin, and lets the US and EU crowd the rest. Section 8 recommends splitting into two courses; sections 9 and 10 give each course's chapters; 11 lists the additions; 12 the fact checks; 13 the questions; 14 attacks the revision. Working name "Political theory" (his word); the content is structures of power, globally and through history, so the tile name is open (question 1).
Brief (Korbi, 5 November 2026): replace the Music course (now in the Appendix) with "global and historical political theory"; "structures of power globally currently and historically. A lot of detail on certain structures such as US EU (what is a directive, decision, how are they made; how long does it typically take etc) and significant other regions or structures now and through history."
Framing rule (as for History of trade): facts about how power is organised and who can do what to whom, not advocacy. Present-day politics: describe the rules and what each side's defenders and critics say, never a verdict. Perishable facts carry a date stamp.

## 0. What I found and decided

- **Shape:** 17 chapters on the shared course sheet (`course.js`), `full titled` like the other courses. Chapters 1 to 13 are 3 lessons each; the two deep dives, **14 (United States)** and **15 (European Union)**, are 6 lessons each; 16 and 17 are 4 each. About 60 lessons: larger than History of trade's 50, so question 5 asks whether to cut.
- **Why two deep dives, and what "detail" means:** each procedure is taught as a *sequence you can put in order* and a *clock you can read* (how many months, with the range and what makes it slow), plus the vocabulary (directive, decision, cloture). The procedure lessons are the part of the course with right answers; the theory lessons are mostly source reading and "which is the defensible reading".
- **Sources opened on 5 November 2026** (the figures in chapters 14 and 15 marked *checked*): Council of the EU pages on the ordinary legislative procedure and on delegated and implementing acts; Clifford Chance, "How long is the EU legislative process" (Feb 2025); Pew Research, 15 October 2026, on the 119th Congress; CRS In Focus IF10003 on federal rulemaking (July 2026); Yackee and Yackee's rulemaking-duration finding via the Regulatory Review. Everything else is **recalled** from the reading lists. `(check)` marks what I am least sure of; a reviewer opens the book before a question is built (section 6).
- **No overlap:** History of trade has the Hanse, the companies and the treaty ports as trade; here they appear as *constitutions* (how the Hanse took decisions, what a charter gave the EIC) and point back. Art history, Navigation and Landfall are not touched.

## 1. Region and period weight

- Chapters 14 and 15 are the declared exception: Korbi asked for depth there.
- Outside them, no more than a quarter of key facts may have a European or US state as the subject; chapters 3 to 8 contain no European actor except as the other party in a relation (the Ottomans and Venice; the Mongols and Hungary).
- Every chapter names at least one voice from the place itself (Kautilya, Ibn Khaldun, Confucius, Han Feizi, the Kouroukan Fouga oral charter, use Zhu Xi, al-Mawardi, Nizam al-Mulk, Haudenosaunee speakers recorded at treaty councils).
- Tally per fact by region when the data file is built; the test prints it (as `tests/arthistory.mjs` does for dates).

## 2. Question styles (one palette)

Built to the `CLAUDE.md` rules (wrong options as long and plausible as the right one; right answer's place cycles; `tests/banks.mjs`).

- **A. Tap the seat:** world map, tap the capital, the institution's city or the realm at its height. Stage-judged.
- **B. Put the steps in order:** a legislative or rule-making procedure as 4 to 6 cards to sequence (a bill to a law; a directive from proposal to national law). Judged by order.
- **C. Match the instrument:** regulation, directive, decision, recommendation, opinion; executive order, statute, rule, guidance; or a Roman, Chinese, Ottoman equivalent, to its description.
- **D. Read the source:** 2 to 4 lines of a primary text (Magna Carta c. 39, the Kouroukan Fouga, the Arthashastra, the Federalist 10, TFEU Article 288), then "what does it show?". Public-domain translations, short.
- **E. Pick the reading:** for a contested interpretation the learner chooses which account is defensible; the answer text shows who says what. A contested number is **never** asked as a number.
- **F. Myth or fact:** Westphalia "invented" sovereignty; the Iroquois "wrote" the US Constitution; a bill must pass the Senate by majority; a directive applies directly.
- **G. Who can stop it:** given a proposal and a structure, name the actors with a veto (the Senate's 60, the Council's blocking minority, the Security Council's five).
- **H. How long:** choose the bracket a thing usually takes (under 6 months, 6 to 12, 12 to 24, over 24), never an exact figure; the answer shows the range, the median or mean where one exists, and what makes cases fast or slow.
- **I. Name the form:** from a short description of who appoints whom and who can dismiss them, name the regime type (parliamentary, presidential, semi-presidential, monarchy with a council, one-party).
- Review pile like Music and Art history.

## 3. The chapters

Format per chapter: goals, key facts (**CONTESTED** inline), pictures and maps, styles, reading.

### 1. What power is made of
Goals: the working vocabulary every later chapter uses, taught from cases not definitions.
Facts:
1. Weber's definition of the state (1919): the claim to a monopoly of legitimate force within a territory; his three types of authority (traditional, charismatic, legal-rational). Both are tools, not laws of nature.
2. Sovereignty, legitimacy, the state, the government and the regime are different things (a regime can change while the state continues).
3. Separation of powers (executive, legislature, judiciary) is Montesquieu's 1748 summary of what he took from England; checks and balances is the US addition. Federal versus unitary: who holds the residual power.
4. Charles Tilly's thesis, "war made the state and the state made war": taxation for armies built bureaucracies. **CONTESTED** as a general law; it fits early modern Europe best (Centeno on Latin America; Herbst on Africa, where low population density mattered more).
5. Dahl's polyarchy and the idea of regime types as a spectrum, not a pair; the term "hybrid regime".
6. Veto points (Tsebelis): the more actors who must agree, the more stable the status quo. This one idea explains most of the "how long does it take" ranges in chapters 14 and 15.
Styles: C, F, I. Reading: Weber (Politics as a Vocation), Tilly, Dahl, Tsebelis, Finer (History of Government, the global backbone).

### 2. City-states and republics: Athens, Sparta, Rome
Goals: the Greek and Roman vocabulary is borrowed constantly; here are the actual mechanics.
Facts:
1. Athens after Cleisthenes (508/7 BCE): 10 tribes, a Council of 500 (boule) chosen by lot, an assembly (ekklesia) open to adult male citizens. Women, enslaved people and resident foreigners were excluded; citizens were a minority (the share is **CONTESTED**, commonly about 10 to 20 percent of residents).
2. Selection by lot for most offices; elections only for generals and some finance posts (Aristotle's observation: lot is democratic, election oligarchic).
3. Ostracism (a vote to exile for ten years, quorum 6,000 per Plutarch, `check`) and the graphe paranomon (a suit against an illegal proposal): the Athenian checks on the assembly.
4. Sparta: two kings, a gerousia of 28 elders over 60, five annually elected ephors with power over the kings; a citizen caste supported by helots (the helot system was serf-like; its scale is argued).
5. The Roman Republic (509 to 27 BCE): two annual consuls, the Senate, assemblies and the tribunes' veto; the cursus honorum. The mixed constitution described by Polybius (book 6) is the model Montesquieu and the US framers read.
6. Rome's slide: the dictatorship, the Gracchi, Sulla, Caesar. **CONTESTED:** why the Republic fell (Syme: faction and armies; Millar: the people mattered more than assumed; Flower: the Republic had several lives).
7. Augustus (27 BCE) kept the offices and held the powers: the principate as a legal fiction that lasted.
Styles: B (a law in the assembly), D (Aristotle, Polybius), E (Rome's fall), F, I. Reading: Hansen (Athenian Democracy), Ober, Cartledge, Polybius, Millar, Flower, Syme.

### 3. China: from the Mandate to the examination
Goals: the longest-running bureaucratic state; Confucian and Legalist ideas about order.
Facts:
1. The Mandate of Heaven (Zhou, from about 1046 BCE): rule is conditional on virtue; Heaven withdraws it, shown by disaster and revolt.
2. Warring States (475 to 221 BCE): Shang Yang's reforms in Qin (from 356 BCE) put the population in registered households with collective liability, rewarded military merit, and made laws public. Han Feizi: rule by law (fa), technique (shu) and position (shi). Confucius, Mencius and Xunzi: rule by moral example and ritual. Mencius wrote that a ruler who ignored the people could be removed.
3. Qin unified China in 221 BCE and standardised script, weights and axle widths; fell in 206. The Han kept the Qin administrative skeleton under Confucian language ("Confucian on the outside, Legalist inside" is a common but **CONTESTED** gloss).
4. The commandery-county system (junxian) replaced inherited fiefs with appointed officials who rotated; the "law of avoidance" kept officials away from their home districts.
5. Examinations: partial under the Han, systematic from the Sui and Tang (587/605 on), mature under the Song; abolished in 1905. Social mobility through them was real but limited by cost; the share of officials from commoner families is **CONTESTED** (Ho; Hartwell; Elman on the education side).
6. The Song state: civilian control over the military, the censorate that criticised officials, local gentry. The Ming (1368) abolished the chancellor and put the emperor at the head of six ministries; the Qing ruled through Manchu banners and Han bureaucrats.
7. Contemporary link (one fact, date-stamped; the full treatment is in chapter 13).
Pictures: Qin terracotta warriors, the Song "Qingming" scroll detail (open access), examination hall plan. Styles: D (Han Feizi, Mencius), E, F, G. Reading: Creel, Hsu, Loewe, Elman, Ho, Wang Gungwu, Fairbank and Goldman, Hucker, Zhao Dingxin (The Confucian-Legalist State).

### 4. India: the Arthashastra to the Mughals
Goals: a long tradition of political writing, an imperial bureaucracy, and village and guild self-government.
Facts:
1. The Arthashastra, attributed to Kautilya (the Mauryan minister Chanakya in tradition; the text's dating and authorship are **CONTESTED**, with Olivelle placing the final text in the 1st to 3rd century CE from earlier layers). It covers spies, taxation, the mandala theory (the neighbour is the natural enemy, the neighbour's neighbour the friend) and a ruler's daily routine.
2. Ashoka (r. c. 268 to 232 BCE) published edicts in stone across the empire; they show an attempt to rule by dhamma and also the administrative reach.
3. Gupta and post-Gupta states: land grants to Brahmins and temples, local assemblies. The Chola inscriptions at Uttaramerur (10th century) describe village assembly elections by lot among qualified candidates, with disqualification rules.
4. The Delhi Sultanate (1206 to 1526) and the Mughals (1526 to 1857): the mansabdari system ranked all officers by numerical rank (zat) and cavalry obligation (sawar); the iqta and later jagir assigned revenue in place of salary; Akbar's revenue settlement (Todar Mal). **CONTESTED:** how centralised the Mughal state was (Habib: heavily extractive; Richards and Alam: negotiated with local elites).
5. British paramountcy by treaties with some 560 princely states, indirect rule; the constitutional road to 1950 appears in chapter 11 and chapter 12.
6. Kautilya is sometimes called "India's Machiavelli"; the label is a European one and the Arthashastra is also a manual of administration and welfare. (Myth-or-fact material.)
Styles: D (Ashoka edicts, Arthashastra extracts, Uttaramerur), E, F. Reading: Olivelle (trans.), Trautmann, Thapar, Habib, Richards, Chandra, Kulke and Rothermund.

### 5. Caliphates, sultanates and the Ottoman system
Goals: how the Islamic world organised authority; consultative and legal traditions; the best-documented premodern bureaucracy outside China.
Facts:
1. The caliphate after 632: the first four caliphs chosen by consultation and acclamation; the Umayyads (661) made it dynastic; the Abbasids (750) built a vizierate and a bureaucracy of secretaries.
2. Shura (consultation) is in the Qur'an (42:38 and 3:159) and has been read as everything from advice to binding assembly. **CONTESTED**, for centuries.
3. Al-Mawardi (d. 1058) wrote the *Ordinances of Government* defining the caliph's duties; Nizam al-Mulk (d. 1092), the Seljuk vizier, wrote the *Siyasatnama*, a mirror for princes.
4. Ibn Khaldun (1332 to 1406): the *Muqaddima* explains the rise and fall of dynasties by *asabiyya* (group solidarity), strongest in the desert, which fades in settled luxury over about three generations of some 40 years each, a dynasty's life being about 120 years (`check` against Rosenthal). The most-cited premodern general theory of states.
5. The Mamluk Sultanate (1250 to 1517): rule by a military caste of purchased soldiers; succession by the strongest amir.
6. The Ottomans (c. 1299 to 1922): the timar system granted revenue to cavalrymen for service; the devshirme levy took Christian boys for the Janissaries and the palace service (**CONTESTED:** numbers and how coercive it was); the millet system gave non-Muslim communities (Orthodox, Armenian, Jewish) their own courts and leaders under the state. The classical view of the millet as a long-standing institution has been revised: it took its familiar form in the 19th-century Tanzimat (Braude).
7. Qanun: the sultan's own law beside the sharia; Suleiman was "Kanuni" for it.
8. Safavid Iran (1501 to 1736) made Twelver Shi'ism the state religion; the Qajar and Pahlavi and 1979 sequence is covered in chapter 13.
Styles: D (al-Mawardi, Ibn Khaldun), E (millet, devshirme), F, I. Reading: Lambton, Hodgson, Lapidus, Hourani, Ibn Khaldun (Rosenthal trans.), Imber, Inalcik, Braude and Lewis (Christians and Jews), Crone, Black.

### 6. Africa: charters, confederacies and kingdoms without kings
Goals: the continent's range of arrangements: states, councils, age-sets, charters; avoid the "tribe" frame.
Facts:
1. The Kouroukan Fouga (the "Mande Charter"), an oral constitution said to have been proclaimed at the founding of Mali under Sundiata about 1235/6: social groups and their roles, a ban on mistreating prisoners and slaves of certain kinds, rules on property and the duty to protect life. Written down in 1998 from the oral tradition of the jeliw (griots) and in UNESCO's list since 2009. **CONTESTED:** its age and the exact content (the written text is a modern reconstruction).
2. Songhai (Askia dynasty, 15th to 16th centuries) set up provincial governors and a standing force; Timbuktu's scholars acted as a judicial class.
3. The Asante Confederacy (c. 1701 on): a union of Akan states under the Asantehene, bound by the Golden Stool as a spiritual symbol; a council of paramount chiefs balanced the king; the queen mother nominated successors.
4. Igbo-speaking communities of south-eastern Nigeria and many others ran without kings: councils of elders, titles, age grades, and the Aro oracle as a judicial centre. "Stateless" is a poor word; these are decentralised systems of government.
5. Ethiopia: the Solomonic dynasty traced its descent to Solomon in the *Kebra Nagast*; the empire was never colonised, apart from Italy's 1936 to 1941 occupation, and the Ethiopian state also expanded through conquest under Menelik (1880s to 1890s).
6. Kongo's king ruled through appointed governors; Afonso I (r. 1509 to 1542) wrote to Portugal as a fellow sovereign and later protested slave raids (his 1526 letter is the one in the trade course).
7. Swahili city-states (Kilwa, Mombasa, Zanzibar) were run by councils of merchant families and a sultan; they show the pattern of a coastal merchant republic.
8. Colonial borders in Africa left a state system with many unusual features: the OAU (1963) chose to keep them (Cairo Declaration 1964). **CONTESTED:** the later effects (Herbst, Englebert, Michalopoulos and Papaioannou).
Styles: D (Kouroukan Fouga extract), E, F, I. Reading: Vansina (Kingdoms of the Savanna, Paths in the Rainforests), Wilks (Asante), Fage, Ajayi and Crowder, Mamdani (Citizen and Subject), Herbst, Niane (Sundiata), Conrad, Ehret.

### 7. The Americas and the Pacific before and under colonisation
Goals: confederacies and tribute empires; how councils worked.
Facts:
1. The Haudenosaunee (Iroquois) Confederacy: five (later six) nations joined by a founding agreement, the Great Law of Peace; fifty hereditary chiefs (hoyaneh) sit in the Grand Council, with clan mothers who nominate and can remove them; decisions by consensus within each nation. The date of the founding is **CONTESTED** (estimates range from about 1142 CE by one solar-eclipse reading to the 15th or 16th century; Mann and Fields; Snow).
2. Myth or fact: the claim that the US Constitution was modelled on the Haudenosaunee. Franklin knew the confederacy and in 1751 praised it as a model for the colonies; the 1988 US Senate resolution acknowledged its influence. Historians (Johansen and Grinde for influence; Tooker, Levy against) dispute how much. Taught as **CONTESTED**.
3. The Aztec Triple Alliance (1428): Tenochtitlan, Texcoco and Tlacopan shared tribute, with Tenochtitlan dominant; conquered cities kept their own rulers and paid tribute.
4. The Inca: the Tawantinsuyu was divided into four suyus under a governor; labour tax (mit'a), the road system and khipu accounting. The decimal organisation of households into units of 10 to 10,000 is in the sources (Murra).
5. The Maya: a cluster of kingdoms (Tikal, Calakmul) with a warring "star-war" politics; kingship ritualised and recorded in glyphs.
6. In the Pacific: Hawaiian and Tongan chiefdoms with ranked chiefly lines (ali'i), a priestly tapu system, and the Tu'i Tonga's maritime reach; Māori iwi and hapū with rangatira chiefs, and the Treaty of Waitangi (1840) with a Māori and an English text that differ (the treaty's meaning is argued in law, **CONTESTED**).
Styles: D (Great Law extract, Franklin 1751), E, F. Reading: Fenton, Snow, Johansen, Tooker, Hassig, D'Altroy, Murra, Martin and Grube, Kirch, Orange.

### 8. The steppe: confederations and the Mongol system
Goals: mobile pastoralist politics and their administrative inventions.
Facts:
1. The Xiongnu (209 BCE on) and their successors organised in decimal units; the Mongols reused the model: tens, hundreds, thousands (mingghan), tens of thousands (tumen).
2. Chinggis Khan (proclaimed 1206) at a quriltai (assembly of princes and commanders): the quriltai chose khans and could take years to convene after a death; the *Yassa* law code is known only from later reports and its content is **CONTESTED** (Ayalon doubted it; Morgan and Aigle argue for something real).
3. Appanages (ulus) for sons, the keshig (imperial guard that was also a school for officials), the yam relay system with passport tablets, the census, and religious tolerance with tax exemptions for clergy.
4. Four successor khanates (Yuan, Ilkhanate, Chagatai, Golden Horde); Yuan China used non-Chinese officials and suspended the examinations (1315 resumed). Golden Horde rule over Rus' princes was by tribute and a license (yarlyk) to rule.
5. Timur (1370 to 1405) and the Timurids kept Chinggisid legitimacy by naming a puppet khan. Babur, founder of the Mughals, was a Timurid; this is the Mughal link in chapter 4.
Styles: B, D (Persian chronicles: Juvaini, Rashid al-Din, short), E, F. Reading: Allsen, May, Morgan, Jackson, Atwood, Biran, Ostrowski.

### 9. Medieval and early modern Europe: lords, towns, estates and churches
Goals: the European forms that later states grew out of, kept to their proper size.
Facts:
1. Feudalism as a term is a later invention (Brown; Reynolds: *Fiefs and Vassals*), and the word describes very different arrangements in different places. **CONTESTED**, whether it should be used at all.
2. The Church and the Empire: the Investiture Contest (1075 to 1122, ended at Worms); the Holy Roman Empire elected its king by seven prince-electors under the Golden Bull of 1356; its imperial diet (Reichstag) and the Reichskammergericht were the empire's institutions.
3. Magna Carta (1215): King John's concession to barons, clause 39 (no free man to be imprisoned except by lawful judgment of his peers or by the law of the land) and 12 (no scutage without common counsel). Reissued repeatedly; it is a feudal document that later became a constitutional symbol.
4. Estates and parliaments: the Cortes of León (1188), England's Parliament from the 13th century (Simon de Montfort's of 1265; the Model Parliament of 1295), the French Estates-General (1302), the Polish Sejm with the *liberum veto* (a single member could end a session; used from 1652 and one of the factors in the partitions, **CONTESTED** how decisive).
5. Italian commune and Venice: the Venetian Republic elected its doge by a long multi-stage procedure of lots and votes (to keep any one family from fixing the result), with a Great Council, a Senate, and the Council of Ten; it lasted from the late 7th century (tradition) to 1797.
6. The Hanse (13th to 17th centuries): a league of some 200 towns by its peak, with its diet (Hansetag), no standing army and no fixed membership; decisions by agreement of the towns, with a trade embargo as its main weapon (against Bruges, 1358; against Bergen). **CONTESTED:** whether it was a league at all (Dollinger and Schildhauer, and Selzer, discuss it as a network).
7. The Dutch Republic (1581 on): seven sovereign provinces, a Stadtholder, the States General where decisions needed unanimity on key matters. Called "the Republic of the Seven United Netherlands".
8. Switzerland: the Old Confederacy from 1291 (traditional date), cantons with Landsgemeinde assemblies; a very old non-monarchical federation.
Styles: B, D (Magna Carta extract), E, F, G (the liberum veto). Reading: Reynolds, Brown, Wilson (The Holy Roman Empire), Holt, Ertman (Birth of the Leviathan), Blockmans, Lane (Venice), Israel (The Dutch Republic), Dollinger, Zimmerman.

### 10. Sovereignty, revolution and the modern state (1648 to 1914)
Goals: the theories that justified and challenged power, and the revolutions that put them in constitutions.
Facts:
1. Westphalia (1648): a myth that it created the sovereign state system; the treaties of Münster and Osnabrück settled the Thirty Years' War, recognised princes' rights within the empire, and gave no general doctrine of sovereignty (Osiander; Teschke). Still taught as the usual "start" of the system: **CONTESTED**.
2. Bodin (1576) defined sovereignty as absolute and perpetual power; Hobbes (1651): sovereign authority from a contract to escape the war of all against all; Locke (1689): rights before government and a right to resist; Rousseau (1762): the general will; Montesquieu (1748): separation of powers; Hume and Smith on commerce and order; Kant (1795): a league of republics as a route to peace.
3. Outside Europe, in the same period: the Qing's Qianlong emperor told Macartney in 1793 that China needed nothing from Britain; Tokugawa Japan (1603 to 1868) ran *bakuhan*, with the shogun directly ruling a quarter of the land and some 260 domains (daimyo) ruling the rest under the system of alternate attendance (sankin-kotai), which kept lords' families as hostages in Edo.
4. England's Glorious Revolution (1688 to 1689): the Bill of Rights set parliamentary consent for taxation and a standing army; the Act of Settlement (1701).
5. The American founding: Articles of Confederation (1781) failed on taxation and the need for unanimity to amend; the Constitution (1787) was ratified in 1788; Federalist 10 (Madison) on factions and large republics; Federalist 51 on ambition checking ambition. The Bill of Rights followed (1791). Detail is in chapter 14.
6. The French Revolution (1789): the Declaration of the Rights of Man and the Citizen; the Terror; Napoleon's Civil Code (1804), the most-exported law code.
7. Haiti (1791 to 1804) was the first state founded by an enslaved people's revolt; the 1805 constitution abolished slavery and defined all citizens as "Black". Bolívar and the Latin American independence constitutions (1810 to 1830) mixed US and French models with strong presidents.
8. The 19th-century franchise: property limits to male suffrage to women's suffrage (New Zealand 1893 first self-governing country with national votes for women; the Finnish 1906 law was the first allowing them to stand as candidates; `check` both).
9. The Meiji Constitution of 1889 and the Ottoman constitution of 1876 (suspended 1878, restored 1908) are the non-Western constitutional experiments of the period.
Styles: D (Hobbes, Locke, Federalist 10), E (Westphalia), F, G. Reading: Skinner (Foundations), Pocock, Israel (Radical Enlightenment), Osiander, Beaulac, Dunn, Armitage (Declaration of Independence), Dubois, Gluck (Japan), Hanioğlu.

### 11. Empire, mandate, decolonisation
Goals: how empires ruled, how they ended, and how the new states inherited their forms.
Facts:
1. Direct and indirect rule: Britain's Indirect Rule in Northern Nigeria (Lugard), French assimilationism, Belgian paternalism, Portuguese "overseas provinces". The difference mattered for what the state looked like afterwards (Mamdani: the "decentralised despotism" of the native authority; **CONTESTED** as a general account).
2. Other empires: Russian (a land empire with a nobility serving the tsar and a table of ranks from 1722), Ottoman (chapter 5), Habsburg (the 1867 Compromise made Austria-Hungary a dual monarchy), Qing (the Lifan Yuan handled Mongols and Tibetans), Japan's colonies (Taiwan 1895, Korea 1910).
3. The Berlin Conference (1884 to 1885) set rules on claiming African coasts; it did not divide Africa (see History of trade).
4. The League of Nations mandates (1920): territories of the defeated empires held "in trust"; categories A, B and C; the UN trusteeship system followed (1945).
5. After 1945: India and Pakistan (1947), Indonesia (1949), Ghana (1957), the "year of Africa" (1960, 17 new states). Algeria's war (1954 to 1962). The Bandung conference (1955) and the Non-Aligned Movement (1961).
6. The Westminster export: parliamentary forms in the Commonwealth. Many new states shifted to presidential or one-party rule within a decade or two (the reasons are **CONTESTED**: Cold War, ethnic politics, fragile institutions).
7. The UN General Assembly Resolution 1514 (1960) declared that colonial rule should end; the Security Council's make-up reflected 1945 (chapter 16).
8. Soviet and Chinese "unions": the USSR's formal federation with a right of secession, never used until 1991; China's autonomous regions.
Styles: A, D (Resolution 1514, Lugard), E, F, I. Reading: Cooper (Colonialism in Question), Darwin, Mamdani, Pedersen (The Guardians), Jansen and Osterhammel, Burbank and Cooper (Empires in World History), Manela.

### 12. How modern states are built: forms, courts, elections
Goals: the working categories from comparative politics, each with a concrete state.
Facts:
1. Parliamentary: government depends on the legislature's confidence and can fall by a vote (the UK, Germany, India, Japan). Presidential: a separately elected head of government with a fixed term (the US, Brazil, Mexico). Semi-presidential: both (France, Taiwan, Portugal). Linz argued (1990) that presidentialism is less stable; **CONTESTED** (Cheibub).
2. Electoral systems: first-past-the-post, proportional lists, mixed-member (Germany: half by constituency, the rest topped up by party list; 5 percent threshold), single transferable vote (Ireland, Malta), the two-round run-off (France). Duverger's law: single-member plurality tends to two parties.
3. Federations: the US, Germany (the Bundesrat represents the Länder governments and must approve certain laws), India (a "union of states" with a strong centre, President's Rule, Article 356), Switzerland (cantons with strong powers; direct democracy with referendums and initiatives), Nigeria, Brazil. Unitary states: France, Japan, the UK (devolved but unitary in law).
4. Constitutional courts and judicial review: the US (Marbury v. Madison 1803), Austria's Kelsen model (1920), Germany's Federal Constitutional Court (1951), India's basic-structure doctrine (Kesavananda Bharati 1973), South Africa's Constitutional Court (1995). The UK's parliamentary sovereignty with no strike-down power (the Human Rights Act can declare incompatibility only).
5. Independent bodies: central banks, ombudsmen, election commissions, audit offices: a "fourth branch" in many constitutions (South Africa's Chapter 9; India's Election Commission).
6. Direct democracy: Swiss referendums (hundreds of federal votes since 1848); Ireland's constitutional referendums; Brexit (2016) as a case of a referendum within a parliamentary system. Neutral on outcomes.
7. Local government: from Swiss communes to the French départements (1790) to China's five tiers (centre, province, prefecture, county, township).
Styles: C, G, I. Reading: Lijphart (Patterns of Democracy), Linz and Valenzuela, Duverger, Elgie, Shugart and Carey, Ginsburg, Elazar, Kelsen.

### 13. One-party states, monarchies, juntas and hybrid regimes
Goals: how non-competitive systems actually run; the descriptions of their rules, with no moral verdict (the reader is not told what to think of them).
Facts (each current fact date-stamped):
1. The Soviet system (1917 to 1991): formally the soviets elected the Supreme Soviet and the Council of Ministers; in practice the Politburo and the Party's Secretariat decided (the nomenklatura lists controlled appointments). The 1936 and 1977 constitutions had broad rights on paper.
2. China today: the Party leads the state. The National People's Congress (nearly 3,000 delegates) meets about a week each year and passes laws; its Standing Committee (about 170 members) legislates between sessions; the Politburo (24) and its Standing Committee (7 at present, `check` at build) decide the line. The 2018 constitutional amendment removed the two-term limit on the presidency. Facts only; criticism and defence are both listed in the reading.
3. Gulf and other monarchies: Saudi Arabia (the Basic Law of 1992, a Consultative Council appointed by the king), Jordan, Morocco (the 2011 constitution), Oman, the UAE (a federation of seven emirates ruled by hereditary rulers, with a Federal National Council half elected by an electoral college). The UK, Japan, the Netherlands and Spain are constitutional monarchies and are a different type.
4. Iran: a layered structure combining elections (president, Majlis) with unelected bodies: the Supreme Leader, the Guardian Council (vets candidates and laws), the Assembly of Experts (elects the Leader).
5. Military regimes and coups: Thailand (a dozen successful coups since 1932), Myanmar (1962, 2021), the Sahel coups of 2020 to 2023 (Mali, Burkina Faso, Niger) and their Alliance (AES, 2023); Latin American juntas (1960s to 80s). Powell and Thyne's coup dataset counts attempts.
6. Competitive authoritarianism and hybrid regimes (Levitsky and Way): elections that are held but tilted. Indices (V-Dem, Freedom House, Polity) disagree on classifications and measure different things. **CONTESTED:** how to measure. Always taught as "this index says" with the year.
7. Russia: the 1993 constitution created a strong presidency; 2020 amendments allowed the incumbent to run for two further terms (`check`).
8. Single-party dominant democracies: Japan's LDP (1955 to 2009 with one short gap), South Africa's ANC (1994 to 2024, then a coalition), India's Congress (1947 to 1977).
9. Theocratic elements: Vatican City, an elective monarchy where cardinals under 80 elect the Pope by a two-thirds majority; Tibet's Dalai Lama system of reincarnation (disputed by Beijing).
Styles: D (constitution extracts), E (index classification), F, I. Reading: Svolik (Politics of Authoritarian Rule), Levitsky and Way, Geddes, Linz, Brooker, Gandhi, Dickson, Lieberthal, Heilmann (Red Swan), Gregory (Soviet), Brownlee.

### 14. The United States in detail
Goals: the learner can say, for any federal action, who can start it, who can stop it, and how long it typically takes. Six lessons.
Lesson 14.1, The structure. Constitution (signed 17 September 1787, in force 1789), Articles I to III (Congress, President, courts), the Bill of Rights, 27 amendments (the 27th ratified in 1992 after 202 years). Enumerated powers, the Supremacy Clause, the Tenth Amendment. Congress: House 435 voting members (fixed by statute since 1929), Senate 100. President elected through the Electoral College (538 votes, 270 to win; the national popular-vote loser has won the presidency in 1876, 1888, 2000 and 2016; 1824 is often added but is **CONTESTED**, as not every state held a popular vote and the House decided it).
Lesson 14.2, A bill becomes a law (put in order). Introduced by a member; referred to a committee (the real filter: most bills die there); committee hearing and markup; reported to the floor; House Rules Committee sets terms of debate; House passage by simple majority; Senate: no general limit on debate, so ending debate needs cloture, 60 of 100 votes since 1975 (it was two thirds before); the two chambers must pass identical text (by passing one bill, amending, or a conference committee); the President signs, vetoes, or lets ten days (Sundays excepted) pass, and if Congress has adjourned a bill not signed is a pocket veto; a veto is overridden by two thirds in each chamber, which is rare. Exceptions: reconciliation (budget bills with 51 votes in the Senate and limits on content, the Byrd rule), treaties (two thirds of senators present), nominations (simple majority since 2013/2017 for the executive and judiciary).
Facts, how often: each Congress sees roughly 10,000 or more bills introduced (**data to pull**: the 118th had about 19,000 bills and resolutions, `check`) and a small share becomes law. *Checked:* Pew (15 October 2026): the 119th Congress had enacted 121 public laws by 14 October 2026 (109 substantive, 12 ceremonial), the second-fewest at that point of any Congress in 40 years (the 118th had 106 and 84); Congresses in the 1980s to 2000s averaged about 440 before Election Day.
Lesson 14.3, The budget clock. Appropriations: 12 bills before 1 October each year, in practice often replaced by continuing resolutions; shutdowns (the longest, 35 days Dec 2018 to Jan 2019; a longer one in autumn 2025 `check`); the debt limit (a statutory ceiling).
Lesson 14.4, The executive. Executive orders (numbered, published in the Federal Register, bind the executive branch only, based on the Constitution or on a statute; courts can strike them down: Youngstown 1952), presidential memoranda and proclamations, signing statements. The Cabinet departments (15) and independent agencies (the Fed, the SEC, the FCC). The Office of Management and Budget and the Office of Information and Regulatory Affairs (OIRA).
Lesson 14.5, Rules: from statute to regulation (put in order). Congress passes a statute giving an agency power. The agency drafts; for significant rules OIRA reviews under Executive Order 12866 (1993); a Notice of Proposed Rulemaking is published in the Federal Register under the Administrative Procedure Act section 553; the public comments, usually at least 30 days (often 60; *checked*: CRS); the agency responds to comments and publishes a final rule with a statement of basis; a final rule generally takes effect at least 30 days after publication; Congress may overturn it with a joint resolution under the Congressional Review Act (fast-track in the Senate, a simple majority; the President can veto it). Courts review under the APA's arbitrary-and-capricious test. **How long:** the Yackee study found a median of about 12 months and a mean of about 18 from the proposal to the final rule (*checked*, via the Regulatory Review); major rules can take several years and many are stuck; the Unified Agenda is published twice a year. Exemptions: guidance documents, internal management, "good cause". **CONTESTED:** the "ossification" claim (McGarity) that rulemaking has become too slow against the finding that it is quick for most rules.
Lesson 14.6, The courts and the states. Judicial review (Marbury 1803); nine justices (fixed by statute since 1869), life tenure, nominated by the President and confirmed by the Senate; about 60 argued cases a term out of some 4,000 to 7,000 petitions for certiorari (`check`); the rule of four to grant review. Deference to agencies: the Chevron doctrine (1984) was overruled in *Loper Bright v. Raimondo* (2024) (`check` wording at build). Federalism: states as laboratories, the 50 state constitutions, the commerce clause, preemption, the anti-commandeering rule; most criminal and family law is state law. Local: counties, cities, school districts, special districts.
Styles: B (bill, rule), C (statute, EO, rule, guidance, proclamation), G (cloture, veto, certiorari), H (how long, with the checked ranges), D (Federalist 10 and 51, the Constitution's text), F.
Reading: the Constitution; Federalist Papers; Congress.gov's "How Our Laws Are Made"; CRS In Focus on rulemaking, on cloture and on the Congressional Review Act; Sinclair (Unorthodox Lawmaking), Mayhew (Divided We Govern), Binder (Stalemate); Kerwin and Furlong (Rulemaking), West, Yackee and Yackee, McGarity; Kagan, Chemerinsky.

### 15. The European Union in detail
Goals: the learner can say what a regulation, a directive and a decision are, how each is made, who can block it, and how long it takes. Six lessons.
Lesson 15.1, The structure. Founded step by step: the ECSC (Treaty of Paris 1951), the Treaties of Rome (1957), the Single European Act (1986), Maastricht (1992), Amsterdam, Nice, Lisbon (2007, in force 1 December 2009). The Treaty on European Union (TEU) and the Treaty on the Functioning of the EU (TFEU). 27 member states since the UK left (31 January 2020). Institutions: the **Commission** (one commissioner per state, proposes law and enforces it: the "right of initiative"); the **Council of the EU** (ministers of the states, the legislator with Parliament; the presidency rotates every six months); the **European Parliament** (720 MEPs after the 2024 election, directly elected for five years, `check` at build); the **European Council** (heads of state and government; sets direction, does not legislate); the **Court of Justice** (interprets EU law; its principles of direct effect (*Van Gend en Loos* 1963) and supremacy (*Costa v ENEL* 1964) are not in the treaties); the Court of Auditors, the ECB. Competences: exclusive (customs union, competition rules, monetary policy for the euro), shared (internal market, environment, energy, transport), supporting (health, culture, education), and the limits of conferral, subsidiarity and proportionality (TEU Article 5).
Lesson 15.2, The five instruments (Article 288 TFEU; match them). A **regulation** has general application, is binding in its entirety and is directly applicable in all member states: no national law is needed (the GDPR, 2016/679). A **directive** binds each state to which it is addressed as to the *result* to be achieved, leaving form and methods to national authorities: member states must **transpose** it into national law by a stated deadline, usually around 18 to 24 months after entry into force (`check` the typical range); if a state does not, the Commission can open **infringement proceedings** (Article 258; letter of formal notice, reasoned opinion, referral to the Court; financial penalties under Article 260), and individuals may in limited cases rely on a directive's provisions against the state (vertical direct effect, *Van Duyn* 1974). A **decision** is binding in its entirety; if it names addressees it binds only them (a state-aid decision to one company; a competition fine; an authorisation for a product), and since Lisbon the general decision without addressees also exists (the Council's decision to open accession talks, or to appoint). **Recommendations** and **opinions** have no binding force (Article 288's last paragraph). Confusions to teach: "EU law" is not all directives; many acts are called "decisions" with different effects; "Commission Implementing Regulation" is a regulation made by the Commission under delegated power. *Checked:* the table of effects above is the standard reading of Article 288; the EUR-Lex fetch returned no text, so confirm wording from the Treaty text before building.
Lesson 15.3, The ordinary legislative procedure (put in order; Articles 289 and 294 TFEU). The Commission proposes (after an impact assessment and consultations; Parliament and Council can ask but cannot draft). Parliament adopts its first-reading position (a committee prepares a report, a rapporteur leads, then plenary). The Council adopts its position, by qualified majority in most fields (55 percent of states representing at least 65 percent of the population, *checked* in the Council's comitology page; unanimity in tax, foreign policy, accession and some other fields). If they agree, the act is adopted at first reading. Otherwise a second reading: three months for each institution, extendable by one (*checked*), then a conciliation committee if still no agreement (it has not been used in recent terms; *checked*: no files went to conciliation in 2014 to 2016, `check` later). Informal **trilogues** (Commission, Council presidency, Parliament's rapporteurs) agree a text between the formal steps; each institution then approves it formally. *Checked:* more than 85 percent of laws are adopted at the end of the first reading or the beginning of the second (Council); in 2014 to 2019, 33 of 34 acts, and in 2019 to 2024, 44 of 46, were adopted at first reading (Clifford Chance). Afterwards: signed, published in the Official Journal, entering into force on the date it states (often 20 days after publication). Special procedures: consent (Parliament can accept or reject but not amend, e.g. accession, trade agreements), consultation (Parliament is heard only; for example in tax and some competition matters), and the Council acting alone.
Lesson 15.4, How long it takes (style H). *Checked* (Clifford Chance, February 2025): from the Commission's proposal to publication in the Official Journal, about **24 months on average in 2014 to 2019 and 25 in 2019 to 2024**, with the shortest at 12 and 2 months (emergency files) and the longest at 47 and 51. The Commission proposal to Parliament adoption took about 20 and 23 months; Parliament adoption to publication about 4 and 2 months (lawyer-linguists, translation into 24 languages, formal Council adoption). Why it is slow or fast: a Council presidency wanting a deal before its six months end; Parliament's term ending (an election cuts files); how many states hold a vote at the Council; the sensitivity. The EU time clock includes the later steps: transposition (a directive adds 18 to 24 months), the date of application (some acts apply two to three years after entry into force), and enforcement. **Example in Korbi's field (a worked case):** the Renewable Energy Directive III, Directive (EU) 2023/2413, proposed by the Commission on 14 July 2021, adopted 18 October 2023 (about 27 months), with transposition due 21 May 2025; by that date all member states except Denmark had missed it (a trade report of May 2025, `check` against the Commission's infringement notices). The learner follows this single file through the lesson.
Lesson 15.5, Delegated and implementing acts, and the comitology machine (*checked*: Council). A legislative act may give the Commission power to adopt *non-legislative acts*. **Delegated acts** (Article 290) supplement or amend non-essential elements; Parliament and Council can each object within two months (extendable) or revoke the delegation at any time; the Commission first consults national experts. **Implementing acts** (Article 291) give uniform conditions for applying a law; the Commission adopts them with a committee of national experts (**comitology**), using the advisory procedure (a simple majority, non-binding) or the examination procedure (qualified majority; a negative opinion blocks adoption; if no opinion, the Commission may usually proceed, with exceptions such as taxation, financial services, safety; then an appeal committee within a month or a revised draft within two). Urgent cases: adopt first and consult within 14 days. Most of the EU's volume of acts is in these two: by the thousands. A "Commission Delegated Regulation" and a "Commission Implementing Regulation" are regulations in effect; learners are asked to say which is which.
Lesson 15.6, Enforcement and the rest. The Commission as guardian of the treaties (infringements; the annual numbers `to pull`); the Court's preliminary reference procedure (Article 267: national courts ask Luxembourg); the budget (multiannual financial framework of seven years, unanimity); foreign and security policy (unanimity, the High Representative); the euro area and the ECB; enlarged and enhanced cooperation (Schengen, the euro, opt-outs for Denmark and Ireland); the Council's unanimity rule as a veto point (Hungary's use of it on sanctions and enlargement 2022 to 2025; neutral wording); Article 50 (the UK's exit: notice 29 March 2017, departure 31 January 2020). EU law in Korbi's field as a reading list, not content: RED, the Fuel Quality Directive, ReFuelEU Aviation and FuelEU Maritime (Regulations), the Emissions Trading System (a directive).
Styles: B (OLP, a directive from proposal to national law), C (instruments), G (QMV and blocking minority; the Council's unanimity), H, D (Article 288 and 294 text), F (a directive applies directly; the Commission can pass laws alone).
Reading: the TEU and TFEU (consolidated); EUR-Lex "Legal acts" and "Ordinary legislative procedure"; the Council's and Parliament's "how the EU makes laws" pages; Craig and de Búrca, *EU Law*; Hix and Høyland, *The Political System of the EU*; Hartley; Schütze; Rasmussen; Corbett, Jacobs and Neville (*The European Parliament*); Wallace, Pollack and Young (*Policy-Making in the European Union*); Clifford Chance, "How long is the EU legislative process" (February 2025).

### 16. Regions and global bodies: other ways to share power
Goals: the many other structures, with the same three questions (who starts, who can stop, how long).
Facts:
1. The African Union (2002, successor to the OAU): the Assembly of heads of state, the Commission in Addis Ababa, the Peace and Security Council, Agenda 2063; the Constitutive Act's Article 4(h) allows intervention in cases of genocide and war crimes. Regional blocs: ECOWAS (1975), the EAC, SADC, and the AfCFTA (2018/2021), a free trade area covering 54 of 55 AU members (`check`).
2. ASEAN (1967; 11 members since Timor-Leste was admitted at the October 2025 summit, confirmed in several news reports of 30 October 2025): the "ASEAN way" of consensus and non-interference; the charter (2008) gave it legal personality; decisions by consensus, with the "ASEAN minus X" formula in economic matters.
3. Mercosur (1991) and the Andean Community, CELAC, the OAS (1948); USMCA (2020) as a trade treaty with dispute panels but no legislature.
4. The Arab League (1945), the GCC (1981), the OIC (1969), the Eurasian Economic Union (2015), the Commonwealth (a voluntary association of 56, with no common law).
5. The United Nations: the Security Council has five permanent members (the US, UK, France, Russia, China) with a veto, and ten elected members for two years; resolutions need 9 votes of 15 and no veto; the General Assembly (193 members) decides by majority (two thirds on important questions) and its resolutions are recommendations. The ICJ, the Secretariat.
6. The WTO (1995; consensus; the Appellate Body has been unable to hear cases since December 2019 because new members were not appointed, a US position; `check`). The IMF and the World Bank: weighted votes by quota, the US holding about 16.5 percent of the IMF's votes, enough to block an 85 percent decision (`check` current).
7. Informal clubs: the G7, G20 (since 1999; leaders' level since 2008), BRICS (enlarged in 2024), OPEC and OPEC+ (consensus; a producer cartel, with a meeting cycle every six months). OPEC is relevant to a fuels trader and is treated as a case of a body whose decisions are announced but not enforced.
8. International courts and law: the ICC (Rome Statute in force 2002; the US, Russia, China and India are not parties). **The party count moves**: Burkina Faso, Mali and Niger announced withdrawal in September 2025 and began the formal process in 2026, and Hungary's withdrawal has been reported reversed (search headlines of 2026, not yet read); take the number from the ICC's list on the build date, the International Court of Justice, the Permanent Court of Arbitration; the principle that treaties bind only those who ratify them.
Styles: A, C, G (the veto: which actors can block), H, I. Reading: Acharya, Archer (International Organizations), Weiss (What's Wrong with the UN), Bradford, Mansfield and Milner, Slaughter, Hurd, Cooper (Getting past the Stalemate).

### 17. Comparing: how long, who can stop it, what survives
Goals: put the structures side by side; the capstone and the mixed review.
Lessons:
1. **A law's life across systems:** the same type of rule (a fuel standard) in the US (statute or rule), the EU (directive or regulation), China (State Council regulation or NPC Standing Committee law), India (an Act and rules), Brazil, the UK (statutory instrument). The learner orders steps and picks the bracket (style B, H).
2. **Veto points counted:** the number of actors whose agreement is needed to change the status quo in each system; Tsebelis's idea applied.
3. **What outlasts a regime:** institutions that survived (the examinations, the vizierate, the Roman law, the Swiss cantons, the comitology system) and those that did not.
4. **Mixed gauntlet:** all styles from all chapters.
Reading: Tsebelis, Lijphart, Finer, Fukuyama (The Origins of Political Order and Political Order and Political Decay), Acemoglu and Robinson (**CONTESTED**: their institutions thesis is influential and criticised), Scott (Seeing Like a State).

## 4. Where it fits

- **Not in `kb/` yet.** The course reads two things from `kb/` once they exist: the `pol` subject (Policy & institutions) and `hist`. Entities for institutions (Parliament, Council, Politburo...) and rulers do not exist, and `kb/` is shared. I suggest the course's data stays in its own file for the first build, and the entities are moved to `kb/` after Korbi has seen the course (question 6).
- **Topic:** the course counts under `pol` and `hist` in Settings' subjects (`topics.js`), so a miss feeds the review pile and the learning modes.
- **Tile:** a course in the Courses section, `full titled`, with the shared course sheet; Office line icon in `apps.js` `OFFICE_ICONS`; no entry in `random-core.js` `LEFT_OUT` since a course of lessons has an entry like Music had. When the tile lands the live count goes from 107 back to 108.
- **Perishable facts** (number of member states, the number of laws a Congress has enacted, who holds the seats): stored with an "as of" date and pulled from a source at build time, not typed from memory.

## 5. Sources register (proposed)

- **Method and global:** Finer, *The History of Government from the Earliest Times* (Oxford, 1997). Fukuyama, *The Origins of Political Order* (2011) and *Political Order and Political Decay* (2014). Tilly, *Coercion, Capital and European States* (Blackwell, 1990). Weber, *Politics as a Vocation* (1919). Dahl, *Polyarchy* (Yale, 1971). Tsebelis, *Veto Players* (Princeton, 2002). Lijphart, *Patterns of Democracy* (Yale, 2012). Scott, *Seeing Like a State* (Yale, 1998). Acemoglu and Robinson, *Why Nations Fail* (2012).
- **Ancient and classical:** Hansen, *The Athenian Democracy in the Age of Demosthenes* (Blackwell, 1991). Ober, *Mass and Elite in Democratic Athens* (Princeton, 1989). Cartledge, *The Spartans*. Aristotle, *Politics*; Polybius, *Histories* book 6. Flower, *Roman Republics* (Princeton, 2010). Millar, *The Crowd in Rome*. Syme, *The Roman Revolution* (1939).
- **China:** Creel, *The Origins of Statecraft in China*; Hsu, *Ancient China in Transition*; Zhao Dingxin, *The Confucian-Legalist State* (Oxford, 2015); Elman, *A Cultural History of Civil Examinations in Late Imperial China* (California, 2000); Ho Ping-ti, *The Ladder of Success in Imperial China* (Columbia, 1962); Loewe, *The Government of the Qin and Han Empires* (Hackett, 2006); Hucker, *The Traditional Chinese State in Ming Times*; Lieberthal, *Governing China*; Heilmann, *Red Swan*.
- **India:** Olivelle (trans.), *King, Governance, and Law in Ancient India: Kautilya's Arthasastra* (Oxford, 2013); Trautmann, *Kautilya and the Arthasastra* (Brill, 1971); Thapar, *Aśoka and the Decline of the Mauryas* (Oxford, 1961); Habib, *The Agrarian System of Mughal India* (1963); Richards, *The Mughal Empire* (Cambridge, 1993); Kulke and Rothermund, *A History of India*.
- **Islamic world:** Lambton, *State and Government in Medieval Islam*; Lapidus, *A History of Islamic Societies*; Hodgson, *The Venture of Islam*; Ibn Khaldun, *The Muqaddimah*, trans. Rosenthal (Princeton); al-Mawardi, *The Ordinances of Government*, trans. Wafa Wahba; Nizam al-Mulk, *The Book of Government*, trans. Darke; Imber, *The Ottoman Empire 1300 to 1650*; Inalcik, *The Ottoman Empire: The Classical Age*; Braude and Lewis, *Christians and Jews in the Ottoman Empire* (Holmes and Meier, 1982); Crone, *God's Rule* (Columbia, 2004).
- **Africa:** Vansina, *Kingdoms of the Savanna* (Wisconsin, 1966) and *Paths in the Rainforests*; Wilks, *Asante in the Nineteenth Century*; Niane, *Sundiata*; Mamdani, *Citizen and Subject* (Princeton, 1996); Herbst, *States and Power in Africa* (Princeton, 2000); Hunwick (Songhai); Ehret, *The Civilizations of Africa* (Virginia, 2002).
- **Americas and Pacific:** Fenton, *The Great Law and the Longhouse* (Oklahoma, 1998); Snow, *The Iroquois*; Johansen and Grinde, *Exemplar of Liberty*; Tooker (*Ethnohistory*, 1988); Hassig, *Aztec Warfare*; D'Altroy, *The Incas* (Blackwell); Murra; Martin and Grube, *Chronicle of the Maya Kings and Queens*; Kirch, *On the Road of the Winds*; Orange, *The Treaty of Waitangi*.
- **Steppe:** Allsen, *Mongol Imperialism* (California, 1987); May, *The Mongol Empire* (Edinburgh, 2018); Jackson, *The Mongols and the West*; Atwood, *Encyclopedia of Mongolia and the Mongol Empire*; Morgan on the Yasa (BSOAS, 1986); Ostrowski, *Muscovy and the Mongols*.
- **Europe:** Reynolds, *Fiefs and Vassals* (Oxford, 1994); Wilson, *The Holy Roman Empire: A Thousand Years of Europe's History* (2016); Holt, *Magna Carta*; Ertman, *Birth of the Leviathan* (Cambridge, 1997); Lane, *Venice: A Maritime Republic*; Israel, *The Dutch Republic*; Dollinger, *The German Hansa*; Skinner, *The Foundations of Modern Political Thought* (1978); Osiander, "Sovereignty, International Relations, and the Westphalian Myth" (International Organization, 2001); Dubois, *Avengers of the New World*.
- **Empire and states:** Cooper, *Colonialism in Question* (California, 2005); Burbank and Cooper, *Empires in World History* (Princeton, 2010); Pedersen, *The Guardians* (Oxford, 2015); Manela, *The Wilsonian Moment*; Linz and Valenzuela, *The Failure of Presidential Democracy*; Cheibub, *Presidentialism, Parliamentarism, and Democracy*; Svolik, *The Politics of Authoritarian Rule*; Levitsky and Way, *Competitive Authoritarianism* (Cambridge, 2010).
- **United States:** the Constitution, the Federalist Papers; *Marbury v. Madison*; Congress.gov, "How Our Laws Are Made"; CRS In Focus IF10003 (federal rulemaking, July 2026) and CRS reports on cloture and on the Congressional Review Act; Sinclair, *Unorthodox Lawmaking* (CQ Press); Binder, *Stalemate*; Kerwin and Furlong, *Rulemaking* (CQ Press); Yackee and Yackee, "Administrative Procedures and Bureaucratic Performance" (Journal of Public Administration Research and Theory, 2010, `check` the venue); Pew Research Center, 15 October 2026 (the 119th Congress).
- **European Union:** TEU and TFEU; the Council of the EU, "Ordinary legislative procedure" and "Implementing and delegated acts"; Clifford Chance, "How long is the EU legislative process?" (February 2025); European Parliament, "Facts and figures" (2024); Craig and de Búrca, *EU Law: Text, Cases, and Materials* (Oxford); Hix and Høyland, *The Political System of the European Union* (Palgrave); Wallace, Pollack, Roederer-Rynning and Young (eds), *Policy-Making in the European Union* (Oxford); Corbett, Jacobs and Neville, *The European Parliament* (John Harper).
- **Global bodies:** Archer, *International Organizations* (Routledge); Weiss, *What's Wrong with the United Nations* (Polity); Acharya, *Constructing a Security Community in Southeast Asia* (Routledge); the UN Charter; the WTO Agreement; the IMF's quota and voting tables.

## 6. How a reviewer should check this outline

Open each **CONTESTED** and `(check)` item against the work named. For chapters 14 and 15 do it twice: (a) the *procedure* against the Treaty text (TFEU 288, 289, 290, 291, 294) and the Constitution/Congress.gov, and (b) every *duration and count* against its dated source, pulled again the week the chapter is built. Read chapters 1 to 13 for balance (section 1 has no tally yet) and check that no question asks a contested number as a number (style E and H). Read chapter 13 and the present-day facts of chapters 14 to 16 for framing: rules and facts, the same tone for every system, no verdict. Check pictures last (open-access museum images and our own drawings; no run-time Wikipedia fetch unless Korbi rules otherwise).

## 7. Open editorial questions for Korbi

1. **Name and door:** "Political theory", "Structures of power" or "How power is organised"? (`power.html`?) The content is mostly institutions; theory appears in chapters 1, 5, 9 and 10.
2. **Depth in 14 and 15:** six lessons each, as written. Is that right, or should the EU get more (it is where the "how long" detail is richest) and the US less?
3. **Perishable facts:** stamped and pulled from sources at build time (my proposal), or leave 2026 politics out of tested content and keep chapters 14 to 16 to rules and history?
4. **Chapter 13 framing:** rules and organisation of authoritarian systems and the indexes' disagreements, with no verdict. Is that the wording level you want?
5. **Size:** about 60 lessons. Cut to 45, or keep?
6. **`kb/`:** a data file of the course's own first (my proposal), with institution and ruler entities moved to `kb/` afterwards by whoever owns it?
7. **Universal or personal?** As for History of trade: a public course (universal subject) or in the Include setting.
8. **Fuels field:** chapter 15's worked case is the Renewable Energy Directive, and chapter 16 treats OPEC. Keep, or keep the course clear of your own desk's field?
9. **Pictures:** open-access museum images, maps and diagrams of procedures (the diagrams of the two legislative paths are the course's own drawings).


## 8. Revision: one course or two (recommendation: two)

Brief as widened by Korbi (5 November 2026, via the outside review): constitutions, institutions, diplomacy, statecraft and strategy, with significant actors used as case studies in constraint, not as heroes; Clausewitz as a thinker of politics, friction, chance and the link between war and policy, balanced by other traditions.

- **Option A, one course of 60 lessons:** keeps one tile and the Music swap one for one. Against it: 60 lessons is more than twice Art history's 27; the two halves need different questions (institutions have right answers, strategy has defensible readings); a learner who wants the EU's directive clock does not want the culminating point.
- **Option B, two courses of about 45 lessons each:** **Constitutions and institutions** and **Statecraft and strategy**. Each fits the suite's course size, each has one question palette, each can ship alone. Cost: a second tile (the live count goes 107, then 108, then 109) and Korbi's choice to give up a slot.
- **Recommendation: B**, built in order: Constitutions first (it is the original brief and its US and EU parts are already researched), Statecraft second. If Korbi wants one tile, merge by cutting section 9's chapters 6 and 8 to half and section 10's chapters 6 and 7 to half; the list of cuts is in section 14.
- **Music:** already in the Appendix. Musical literacy survives where the suite already carries it: composers and movements as Almanac stars and Order period decks, instrument lots in Crates, audio in Punt topics. A small ear-training mode is a separate idea and not part of this course.
- **Tiles:** "Constitutions" (door `constitutions.html`) and "Statecraft". Names are open (question 1).

## 9. Course 1: Constitutions and institutions (about 45 lessons)

Principle: a constitutional-law spine first, then a world tour of cases that uses it. Lesson counts in brackets.

1. **What a constitution does (4).** Constituent power (who may make a constitution) versus constituted power; codified, uncodified (UK, New Zealand, Israel's Basic Laws) and mixed; amendment and entrenchment (US Article V, Germany's eternity clause Article 79(3), India's basic structure doctrine, France's 1958 text, Switzerland's mandatory referendum); convention versus law (the UK's Salisbury convention; the US two-term custom before 1951); constitutional identity (a court's claim that some core cannot be amended).
2. **Separating, fusing and checking (3).** Separation (US) versus fusion (UK, most parliaments); parliamentary sovereignty and its limits; judicial review in four models (US, Kelsen's constitutional court, Commonwealth dialogue models, no review); basic structure (Kesavananda Bharati 1973); who guards the guardians (appointment, term, jurisdiction-stripping).
3. **Rights and emergencies (3).** Rights catalogues (negative, positive, social); limits and proportionality (Germany, Canada, South Africa, the European Convention); emergency powers (Weimar Article 48, France's Article 16, India's Articles 352 and 356, Turkey 2016, the US National Emergencies Act of 1976), sunset clauses; impeachment and removal (US, Brazil 2016, South Korea 2017 and 2025), dissolution (the UK's Fixed-term Parliaments Act 2011 and its repeal in 2022), succession (monarchy, vice-presidency, interim rules).
4. **Where power is divided (3).** Federal (US, Germany, India, Nigeria, Brazil, Canada, Australia), unitary (France, Japan, Turkey), devolved (UK), consociational power-sharing (Lebanon, Belgium, Northern Ireland, Bosnia); local government and subnational constitutions (US states, German Länder, Swiss cantons).
5. **The regime typology (3).** Parliamentary, presidential, semi-presidential, directorial (Switzerland's Federal Council), assembly government, constitutional monarchy; military rule, one-party, dominant-party, competitive-authoritarian, hybrid, theocratic, transitional; where the indices disagree (V-Dem, Freedom House, Polity). Name-the-form questions live here.
6. **Old republics and city-states (3).** Athens, Sparta, the Roman Republic; Venice, the Dutch Republic, the Swiss Confederacy, the Polish-Lithuanian Commonwealth (a "republic" of nobles with an elected king and the *liberum veto*). Material from section 3 chapters 2 and 9, cut to constitutional questions: who could propose, who could veto, how was a decision enforced.
7. **Imperial bureaucracies (3).** China (Mandate, Legalist and Confucian rule, the examinations), the Roman principate, the Mughal and Ottoman systems (mansabdari, timar, millet). Question: how did the centre control its agents.
8. **Law and administration beyond Europe (3).** Islamic legal and administrative traditions (the caliphate, shura, qadi and mufti, Ibn Khaldun); Persia before and after Islam (Achaemenid satraps, the Sasanian and the Abbasid inheritance); South Asia beyond the Arthashastra (Ashoka, village assemblies, Mughal revenue).
9. **Japan, Korea and Southeast Asia (3, new).** Japan before 1603 (the Yamato court, the shogunate from 1185, the Sengoku warring states) and the Tokugawa bakuhan system; Korea's Joseon (a bureaucratic state with examinations and a censorate, the 1392 to 1910 period); the mandala states of Southeast Asia (Srivijaya, Angkor, Majapahit: authority as circles of tribute, not borders).
10. **Africa, the Americas, the steppe (3).** Kouroukan Fouga and Mali, Asante, Igbo systems, Ethiopia; the Haudenosaunee, Aztec and Inca systems, the Mississippian world (Cahokia), post-independence Latin American constitutions; the Mongol quriltai and decimal system, Central Asian khanates.
11. **The United States (3).** Structure and the bill-to-law path with cloture; the executive, the budget and rulemaking (figures in section 3 chapter 14); courts, federalism and the end of Chevron deference. Cut from six lessons to three; the ordering and "how long" questions stay.
12. **The European Union (4).** Institutions and competences; the five instruments of Article 288; the ordinary legislative procedure and its clock; delegated and implementing acts, enforcement and the Renewable Energy Directive III worked case. Kept at four because Korbi asked for the detail.
13. **Westminster and its relatives (2).** The UK (uncodified, parliamentary sovereignty, devolution), Canada and Australia (Westminster with federalism), India (parliamentary federalism with a basic structure), with the Commonwealth.
14. **Germany, France, Japan (2).** Germany's Basic Law, militant democracy and the constructive vote of no confidence; France's semi-presidential Fifth Republic and cohabitation; Japan's constitution of 1947 and its Article 9 (peace clause) with the reinterpretation debate.
15. **China, Russia, Singapore (2).** The Party-state and democratic centralism; Russian super-presidentialism (1993 constitution, the 2020 amendments); Singapore's dominant-party constitutionalism. Facts and structure, not verdicts.
16. **Iran, Turkey, Egypt, Pakistan (2).** Iran's theocratic republic and its elected and unelected layers; Turkey's presidential shift (2017 referendum); Egypt's military-backed constitutions; Pakistan's judiciary and the army.
17. **Brazil, South Africa, Nigeria, Indonesia, Malaysia (2).** Coalition presidentialism; South Africa's 1996 constitution and the Constitutional Court; Nigeria's federalism and its military legacy; Indonesia's post-1998 amendments; Malaysia's monarchy rotating among nine rulers and its federal structure.
18. **Beyond the state (2).** The UN, the AU, ASEAN, the WTO, the ICC as constitutional orders without a single people; the EU as a constitutional order without one demos (Maastricht judgments, Costa v ENEL).
19. **Comparison and capstone (3).** The same rule traced through five systems; the veto-player count; what outlasts a regime.

Total: 4+3+3+3+3+3+3+3+3+3+3+4+2+2+2+2+2+2+3 = 51. To land at 45, cut lessons 6 to 10 to two each (history gets 10 instead of 15) and merge 13 and 14. Section 14 lists the choice.

## 10. Course 2: Statecraft and strategy (about 45 lessons)

Principle: organised around problems of power, not around famous people. Every thinker is a tool, every actor a case of constraint. The eight questions asked of every case: what was the problem; what constrained the actor; what options existed; what did they choose; which institutions mattered; what was luck; what was the outcome; what do historians dispute.

1. **The tools of statecraft (4).** Coercion, inducement and persuasion; hard, soft and "smart" power (Nye; the labels are contested as analysis); sanctions, aid, investment, export controls; intelligence, deception and propaganda; legitimacy, prestige, honour and ideology.
2. **Diplomacy in practice (5).** Envoys and immunity (Greek proxenoi, Roman fetial priests, Islamic embassies, the Mongol envoy protected by the yam, the Italian resident ambassador from the 15th century); Westphalian congresses, the Concert of Europe, summits, backchannels and Track II; recognition, treaties and ratification (domestic veto players: the US Senate's two-thirds, referendums); mediation, arbitration and adjudication (the Alabama claims 1872, the ICJ); the UN Security Council, General Assembly and Secretary-General.
3. **Tribute, vassalage and neutrality (3).** The Chinese tributary system (kowtow, gifts, investiture); Ottoman capitulations and vassal states; Swiss and other neutrality; alliance formation and the commitment problem (NATO Article 5 as an obligation to "such action as it deems necessary").
4. **Thinkers of strategy (5).** Thucydides (fear, honour and interest; the Melian dialogue; the claim that he teaches realism is a reading, **CONTESTED**); Sun Tzu (winning without fighting; text and date contested, Warring States composition by a school); Kautilya (the mandala and six policies); Machiavelli (virtù and fortuna, the prince as constrained by the people and the nobles); Clausewitz in two lessons, below.
5. **Clausewitz (2, inside 4).** Lesson one: war as "continuation of politics by other means" (the formulation is a summary of a longer argument; he also calls war a chameleon); the "remarkable trinity" of passion, chance and reason, mapped to people, army and government, and not three social groups as popular summaries say; friction and fog; the culminating point of the attack and of victory; centre of gravity (a hotly debated term). Lesson two: what he did not say (a formula; a claim that all war is total; that policy must always dominate); the 1832 posthumous *On War* is unfinished and Book 8 is a late revision; critics (Keegan on culture, Van Creveld on non-state war) and defenders (Echevarria, Strachan); his Prussian context (Jena 1806).
6. **War and its ways (5).** Ends, ways and means; attrition versus manoeuvre (Delbrück's two strategies); theory of victory; sea power (Mahan's concentration and Corbett's sea control and limited war, with the contrast); blockade, commerce raiding and amphibious war; air power and its claims (Douhet, Pape's critique); guerrilla war and counterinsurgency (Mao's three stages, the Algerian war, Galula); proxy war.
7. **Deterrence and the nuclear age (4).** Deterrence and compellence (Schelling's *Arms and Influence*); escalation ladders; the Kennan containment telegram of 1946 and its later regrets; mutually assured destruction, second-strike, the Cuban Missile Crisis of 1962 as a bargaining case; alliance management and extended deterrence.
8. **Economy, information and new domains (3).** Economic statecraft and its limits; information warfare; cyber and space as domains with no settled doctrine (facts dated).
9. **Empire, state-building and revolution (4).** Imperial administration and co-optation; repression and emergency rule; nation-building and civil-military relations; revolutionary strategy (Lenin's vanguard, Mao's protracted war, Gandhi's non-cooperation, Algeria) and decolonisation.
10. **Actors inside constraints (8 case lessons, listed below).**
11. **Capstone (2).** Compare two cases on the eight questions; the mixed gauntlet.

Count: 4+5+3+5+0 (inside 4)+5+4+3+4+8+2 = 43.

**Case studies (pick 8 of 16; each is one lesson, each answers the eight questions).**
- Pericles and Alcibiades: a democracy's empire and its overreach (Sicily 415 to 413 BCE).
- Augustus: dismantling a republic while keeping its offices.
- Cao Cao and Zhuge Liang: legitimacy and a failing coalition after the Han.
- Saladin: coalition-building, reputation and diplomacy among Muslim and Frankish rulers.
- Ögedei and Kublai: succession and administration after Chinggis.
- Talleyrand, Metternich and Castlereagh at Vienna 1814 to 1815: how a defeated state returned to the table.
- Bismarck: alliance management and the limits of a system that depended on one man.
- Lenin to Gorbachev as a sequence on the party-state, terror, reform and collapse.
- Mao, Zhou Enlai and Deng: revolution, chaos, reform.
- Nehru, Nasser, Sukarno and Tito: non-alignment and prestige.
- Lee Kuan Yew, Park Chung-hee, Suharto: developmental authoritarianism (one lesson, with the economic record as contested).
- Mandela and de Klerk: the 1990 to 1996 transition and the constitutional settlement.
- Menelik II, Samori Touré, Cetshwayo, Shivaji, Nzinga: resistance, modernisation and statecraft outside Europe.
- Churchill, Roosevelt, Truman, Attlee: total war and the postwar order.
- Frederick II, Maria Theresa, Joseph II: reform and survival under attack.
- Ivan III, Peter I, Catherine II: centralisation and westernisation in a continental state.
Rule: no more than two Western cases among the eight; none presented as a hero. Every case shows a decision the actor could not take or a thing luck did.

## 11. Lesson-level additions (what to add, beyond sections 9 and 10)

Core unless marked. Format: lesson, bullets, question style, verification note.

- **Constituent power and amendment (core).** Sieyès and the idea that a nation makes a constitution; the US convention exceeded its mandate in 1787; Germany's 1949 Basic Law as a provisional text; India's 105 amendments in the 75 years to 2025 (`check`); the amendment-rule spectrum from Britain's ordinary law to Article V's three-fourths of states. Styles: B (Article V steps), E, G. Verify: the Article V text; the count of amendments at the build date.
- **Emergency powers (core).** Weimar Article 48 and its use from 1930; the Roman dictator, bounded to six months; India's 1975 to 1977 Emergency; sunset and review rules. Styles: D, F, G. Verify: dates in the Weimar record and India's 1975 proclamation (25 June 1975).
- **Basic structure (core).** *Kesavananda Bharati v. State of Kerala* (1973), decided 7 to 6; Germany's Article 79(3); a court's claim over amendments is itself contested. Style: E. Verify: the 7 to 6 vote.
- **Consociationalism (enrichment).** Lijphart's four features (grand coalition, mutual veto, proportionality, segmental autonomy); Lebanon's confessional quotas, Belgium, Northern Ireland's 1998 Agreement; critics argue it freezes divisions. Styles: C, I.
- **Persia (core).** Achaemenid satraps and the royal road; Sasanian state religion and its administrators; the Abbasid takeover of Persian bureaucratic models; Safavid Shi'ism. Style: D, A. Verify: dates in Frye or Daryaee.
- **Japan before 1603 (core).** The Taika reforms 645 to 649 (Chinese-style law), the Heian regency, the Kamakura shogunate (1185 or 1192, **CONTESTED**), the Sengoku wars, Hideyoshi's sword hunt of 1588. Style: B, E.
- **Southeast Asian mandalas (enrichment).** Wolters's mandala concept; authority measured by tribute from circles of rulers; the model fits poorly where a state kept borders (Vietnam). Style: E.
- **Cahokia and North America (enrichment).** Population contested (about 10,000 to 20,000); a city without clear evidence of writing; decline by about 1350 contested. Style: E.
- **Thucydides and Melos (core).** The Melian dialogue as text; why it is read as realism and why others read it as a warning about Athenian hubris; the plague. Style: D, E.
- **Sun Tzu and Kautilya compared (core).** "The supreme art is to subdue the enemy without fighting" versus the six measures of foreign policy; both are books for a ruler with advisers. Style: C, E.
- **Mahan and Corbett (core).** Command of the sea through decisive battle versus control of communications and limited war; their influence on the Kaiser's fleet versus Britain's blockade. Style: C, F.
- **Mao (core).** *On Protracted War* (1938): defence, stalemate, counter-offensive; the claim is about political mobilisation as much as arms. Style: B.
- **Schelling and Kennan (core).** The credibility of threats, commitment, "the threat that leaves something to chance"; Kennan's containment and his later objection to the militarised version. Styles: C, E.
- **Treaty ratification (core).** US Senate two-thirds; the Treaty of Versailles vote of 1919 and 1920; the EU's mixed agreements needing all national parliaments (the Wallonia veto on CETA, 2016). Style: G.

## 12. Fact checks done and still owed (second pass)

Checked on 5 November 2026 by opening the source or reading a search result's title only (marked "title only" where I did not read the text):

| Claim | Status | Action |
|---|---|---|
| Second reading limits: three months per institution, plus one | Checked: Council's OLP page | none |
| QMV: 55% of states and 65% of population | Checked: Council's comitology page (in the committee context); the treaty rule for Council votes is the same, **verify in TEU Article 16(4)** | confirm wording from the treaty |
| Over 85% of laws agreed at first or early second reading | Checked: Council | none |
| EU proposal to publication: 24 months (2014 to 19), 25 (2019 to 24) | Checked: Clifford Chance | date-stamp |
| Delegated acts: two months to object, extendable | Checked: Council | none |
| Article 288 instruments | **Not verified:** EUR-Lex returned no text | read the Treaty |
| Typical transposition period 18 to 24 months | **Not verified** | take the range from a Commission note on transposition; do not ask as an exact number |
| Renewable Energy Directive III: proposal 14 July 2021, directive of 18 October 2023, transposition 21 May 2025 | Directive number and date seen in a search result; proposal date and transposition deadline recalled | check on EUR-Lex |
| Conciliation unused since the mid 2010s | Council page: none in 2014 to 2016; later terms **not verified** | check Parliament's activity reports |
| US rulemaking: 30-day comment (at least), 30-day delay, OIRA review, CRA | Checked: CRS IF10003 | none |
| Rulemaking median about 12, mean about 18 months | Checked: a summary of the Yackees' study (older data, 1990s to 2000s) | stamp as dated; **may not fit major rules** |
| 119th Congress: 121 laws by 14 October 2026 | Checked: Pew | pull again on the build date |
| Chevron overruled by *Loper Bright* (2024) | Recalled, high confidence | verify the decision date (28 June 2024) |
| Electoral College: 538 votes, 270 to win | Recalled, certain | none |
| Popular-vote loser winning: four clear cases, 1824 contested | Corrected above | none |
| Autumn 2025 shutdown length | Recalled (about 43 days); outline says "longer than 35 days `check`" | confirm |
| Politburo 24 members, Standing Committee 7 (20th, from October 2022) | Search results (title only) agree; the 21st Congress is due in 2027 | stamp |
| ASEAN: 11 members from October 2025 | Checked: several news reports | stamp |
| ICC parties | Count unstable: three Sahel withdrawals (2025 to 2026) and a reported Hungarian reversal (title only) | pull the list on the build date; no number in the outline |
| WTO Appellate Body paralysed since December 2019; MPIA as workaround | Search results (title only) agree the Body is still paralysed in 2026 | verify at build |
| IMF: US about 16.5% of votes | Recalled | check the IMF's table at build |
| Kouroukan Fouga date, Yassa, Westphalia, Iroquois influence | Marked CONTESTED already | keep as style E |

## 13. Ten sample questions

1. **Ordering (EU/US procedure).** Put in order: Commission proposal; Parliament first-reading position; Council adopts the same text; signature and publication in the Official Journal. (Then a second version for the US: committee markup, House passage, cloture vote, signature.)
2. **Matching (instruments).** Match each to its effect: regulation, directive, decision addressed to a firm, recommendation. Answers: binding and directly applicable; binding as to result and needs transposition; binding on its addressee only; not binding.
3. **Veto players.** A treaty needs ratification. In which system can a referendum in a single constituent country block it for all? (EU mixed agreements, with Wallonia's 2016 veto as the case.) Options are as long and specific as the right one.
4. **Defensible reading.** Which is the best-supported statement about the Westphalian settlement of 1648? One saying it created the sovereign state system; one saying it settled a war in the Empire and the sovereignty story came later; one saying it was a purely religious treaty; one saying it created the first international organisation. Answer text names who argues each.
5. **Map tap.** Tap Hamburg, Lübeck and Bruges as the three posts named by a Hanseatic letter. (Or: tap the city of the Congress of Vienna.)
6. **How long.** From the Commission's proposal to publication of an average EU act in 2019 to 2024: under 6, 6 to 12, 12 to 24, over 24 months? Answer: about 25 months on average (Clifford Chance), with a range of 2 to 51.
7. **Clausewitz.** "War is the continuation of politics by other means" is best read as: (a) war should always be total; (b) war is a tool whose purpose and limits come from political aims and whose course is shaped by friction and chance; (c) generals should never obey governments; (d) war is a mere technical matter. Answer (b); the text names the trinity and friction.
8. **Non-European statecraft.** Which description fits the Chinese tributary system best? (Rulers sent envoys, performed the ritual and received gifts and investiture, and trade followed on the court's terms; this is a description that historians also qualify as an idealised picture, Fairbank versus Perdue.)
9. **Constitutional law.** *Kesavananda Bharati* (1973) held that Parliament may amend the constitution but not: (a) change any article; (b) alter its basic structure; (c) amend fundamental rights at all; (d) amend the preamble only. Answer (b); the note records the 7 to 6 vote and that the doctrine is argued.
10. **Regime type.** The head of government is chosen by the legislature and can be dismissed by it; the head of state is a hereditary monarch with symbolic duties. Name it. Answer: constitutional monarchy within a parliamentary system. (A second version: a directly elected president and a prime minister who needs the parliament's confidence is semi-presidential.)

## 14. Attack on the revision

- **Still Eurocentric?** Course 1 chapters 11 to 14 (US, EU, Westminster, Germany, France) are 11 lessons of 45, about a quarter, which fits the rule; but the first six "foundation" lessons draw their examples mostly from Europe and the US. Fix: each foundation lesson carries one non-Western case (India's basic structure and Japan's Article 9 are already in).
- **Too elite and too male?** Constitutions and states are written by elites; ordinary people appear mostly as electorates. Add social moments: the Athenian assembly's makeup, a Roman plebeian secession, the Chinese Taiping revolt, Indian village assemblies, women's suffrage dates, the Swiss Landsgemeinde, indigenous claims under constitutions (Waitangi, Canada's section 35). Case studies in Course 2 are overwhelmingly male; add Nzinga and Maria Theresa (already), Empress Dowager Cixi, Elizabeth I, Indira Gandhi, Golda Meir, Angela Merkel as a constrained decision-maker (one pair of lessons).
- **Too state-centric and war-centric?** Course 2 is mostly states and armies. Add one lesson on non-state actors: merchant companies (EIC, the Hanse), churches, NGOs, rebel governance, and one on civil resistance (Chenoweth and Stephan's study; its sample and conclusions are argued).
- **Great-actor causation.** The eight-question template guards against it; test: a case lesson fails review if its questions can be answered without naming a constraint.
- **Hard to assess with multiple choice.** Defensible-reading and constraint questions are weak where the options are all arguable. Use ordering, matching and "which of these is not a constraint they faced". Mark every such item with a source line and let the learner see the dispute afterwards. Cut any question that cannot be answered from the lesson's text.
- **What to cut to land at 45:** Course 1: merge Westminster with Germany and France (one lesson each country group), cut the history block (lessons 6 to 10) from 15 to 10, and keep US at three. Course 2: cut cases from eight to six if time is short, and fold "new domains" into deterrence.
- **What goes to the knowledge base instead of a lesson:** entities for institutions, constitutions, rulers and treaties (with dates and places), the instruments and their effects, the country-by-regime table, the thinkers and their works. Lessons read them by id; Chart and Punt's learning modes reuse them. `kb/` is a shared file, so the move waits until Korbi has ruled on this outline.

## 15. Open questions added by the second pass

12. One course or two? (Section 8 recommends two, built Constitutions first.)
13. Is "Constitutions" the right tile name, with "Statecraft" for the second, or do you prefer one name that covers both?
14. Is a lesson on living political leaders acceptable (Merkel, Xi), or only historical actors (the outline's cases stop at 1996)? Neutral wording would be required either way.
15. Source depth: for Clausewitz and the war lessons, should the questions use primary text extracts (from *On War*, Howard and Paret's translation is in copyright; the older Graham translation of 1873 is public domain) or paraphrase?
