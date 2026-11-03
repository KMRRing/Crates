# Fuel maths: the deck, to review

Written 3 November 2026 for Korbi to check: the figures are a desk's, and nobody could ask him while building. **To review:** every chain below, with the figures it draws from and one worked answer (the first figure of each), and the barrels-a-tonne and energy figures under it. A figure that is wrong is one line in `speedfuels-data.js`; a chain that is not how the desk would say it is one `def` there. `tests/speedfuels.mjs` fails if a chain is added without its entry here or its worked answer here differs from the code's.

Every figure is written into the problem that uses it, so the exact answer is the exact answer of what is shown. The prices, savings, rates and volumes are round figures for drilling, not market data. Answers are typed to the stated significant figures (s.f.); a chain is let off a little more for each step past the third (README, Speed maths).

## The desk's conversion figures

| Fuel | Barrels a tonne | MJ a kg | Tonnes a m³ (15 °C) |
|---|---|---|---|
| diesel | 7.45 | 43 | 0.845 |
| gasoline | 8.45 | 43 | 0.745 |
| jet | 7.88 | 43 | 0.798 |
| FAME | 7.15 | 37 | 0.88 |
| HVO | 8.05 | 44 | 0.781 |
| ethanol | 7.95 | 27 | 0.791 |

Crude is 7.33 barrels a tonne (BP's Statistical Review). The fossil comparator is 94 gCO2e/MJ (RED II and RED III, Annex V). A barrel is 158.987 litres, 42 US gallons, so barrels a tonne is 6.2898 over the density. The heating values are Annex III of Directive (EU) 2018/2001, unchanged in (EU) 2023/2413. Check any of them before relying on them outside this drill.

## Estimates: one or two steps

### Tonnes to barrels (t-bbl)

Volume. 1 step, to 2 s.f., within 1%.

Start: 12 kt of diesel

1. × 7.45 barrels a tonne = 89.4 thousand barrels

Answer: 89.4 thousand barrels

Figures drawn from: kt 12, 18, 25, 32, 37, 45, 60, 75; fuel diesel, gasoline, jet, FAME, HVO, ethanol.

### Barrels to tonnes (bbl-t)

Volume. 1 step, to 2 s.f., within 1%.

Start: 150 thousand barrels of diesel

1. ÷ 7.45 barrels a tonne = 20.13 kt

Answer: 20.13 kt

Figures drawn from: kbbl 150, 250, 275, 300, 480, 600; fuel diesel, gasoline, jet, FAME, HVO, ethanol.

### A flow into a month (flow-month)

Volume. 2 steps, to 2 s.f., within 1%.

Start: 40 thousand barrels a day of diesel

1. × 30 days = 1,200 thousand barrels a month
2. ÷ 7.45 barrels a tonne = 161.1 kt a month

Answer: 161.1 kt a month

Figures drawn from: kbd 40, 75, 85, 120, 160, 250; fuel diesel, gasoline, jet.

### Dollars a tonne to a barrel (px-bbl)

Price. 1 step, to 2 s.f., within 1%.

Start: 695 dollars a tonne, diesel

1. ÷ 7.45 barrels a tonne = 93.29 dollars a barrel

Answer: 93.29 dollars a barrel

Figures drawn from: q diesel 695, diesel 760, diesel 820, gasoline 715, gasoline 840, jet 780, jet 880, FAME 1,100, HVO 1,750, ethanol 740.

### Dollars a barrel to a tonne (px-t)

Price. 1 step, to 2 s.f., within 1%.

Start: 85 dollars a barrel, diesel

1. × 7.45 barrels a tonne = 633.3 dollars a tonne

Answer: 633.3 dollars a tonne

Figures drawn from: q diesel 85, diesel 98, gasoline 82, gasoline 95, jet 90, jet 105.

### A barrel into gallons (px-gal)

Price. 1 step, to 2 s.f., within 1%.

Start: 78 dollars a barrel

1. ÷ 42 US gallons a barrel = 1.857 dollars a gallon

Answer: 1.857 dollars a gallon

Figures drawn from: px 78, 85, 92, 98, 105, 118.

### Energy in a cargo (energy)

Energy. 1 step, to 2 s.f., within 1%.

Start: 10 kt of diesel

1. × 43 MJ a kg = 430 TJ

Answer: 430 TJ

Figures drawn from: kt 10, 20, 28, 35, 40, 55; fuel diesel, gasoline, jet, FAME, HVO, ethanol.

### Emissions of the energy (co2-of-energy)

Carbon. 1 step, to 2 s.f., within 1%.

Start: 250 TJ

1. × 94 gCO2e/MJ (1 TJ at 1 gCO2e/MJ is 1 t) = 23,500 tonnes CO2e

Answer: 23,500 tonnes CO2e

Figures drawn from: tj 250, 480, 860, 1,200, 1,760, 3,000; ci 94, 20, 30, 41, 55.

### A cargo's emissions (cargo-co2)

Carbon. 2 steps, to 2 s.f., within 1%.

Start: 4 kt of diesel

1. × 43 MJ a kg = 172 TJ
2. × 94 gCO2e/MJ (the fossil comparator) = 16,168 tonnes CO2e

Answer: 16,168 tonnes CO2e

Figures drawn from: kt 4, 6, 10, 20, 30, 45; f diesel, gasoline, HVO, FAME.

### Tickets into money (ticket-value)

Money. 1 step, to 1 s.f., within 5%.

Start: 8 thousand tonnes CO2e saved

1. × 60 pounds a tonne = 480 thousand pounds

Answer: 480 thousand pounds

Figures drawn from: kt 8, 12, 15.6, 24, 38, 52; price 60, 75, 95, 110, 120, 135.

### The blend share (blend-share)

Blend. 1 step, to 1 s.f., within 5%.

Start: 90 kt of diesel

1. blend 5% = 4.5 kt of FAME

Answer: 4.5 kt of FAME

Figures drawn from: kt 90, 120, 180, 240, 330, 450; p 5, 7, 10, 20.

### Dollars, euros, pounds (fx-million)

Money. 1 step, to 2 s.f., within 1%.

Start: 12 million dollars

1. ÷ 1.3 dollars to the pound = 9.231 million pounds

Answer: 9.231 million pounds

Figures drawn from: fx 1.3 dollars to the pound, 1.1 dollars to the euro, 0.85 pounds to the euro; m 12, 25, 38, 64, 90.

### Cubic metres to tonnes (m3-t)

Volume. 1 step, to 2 s.f., within 1%.

Start: 40 thousand m³ of diesel

1. × 0.845 tonnes a m³ = 33.8 kt

Answer: 33.8 kt

Figures drawn from: km3 40, 85, 120, 210; fuel diesel, gasoline, jet, FAME, HVO, ethanol.

### A parcel's margin (parcel-margin)

Money. 2 steps, to 2 s.f., within 1%.

Start: 812 dollars a tonne sold

1. − 779 dollars a tonne bought = 33 dollars a tonne margin
2. × 28 kt = 924 thousand dollars

Answer: 924 thousand dollars

Figures drawn from: p sell 812 buy 779 kt 28, sell 845 buy 818 kt 35, sell 903 buy 861 kt 37, sell 765 buy 741 kt 30, sell 1,215 buy 1,172 kt 12.

## Chains: three to six steps

### From a flow to dollars a year (flow-co2-dollars)

Carbon. 6 steps, to 1 s.f., within 12.5%.

Start: 150 thousand barrels a day of diesel

1. × 30 days = 4,500 thousand barrels a month
2. ÷ 7.45 barrels a tonne = 604 kt a month
3. 2% of that = 12.08 kt a month
4. saves 60% of 94 gCO2e/MJ at 43 MJ/kg = 29.3 kt CO2e a month
5. × 90 pounds a tonne = 2,637 thousand pounds a month
6. × 1.25 dollars a pound, × 12 months, in millions = 39.55 million dollars a year

Answer: 39.55 million dollars a year

Figures drawn from: kbd 150, 200, 250, 300, 400, 450; share 2, 5, 8, 10; saving 60, 70, 75, 80, 85; price 90, 100, 110, 120, 135; fx 1.25, 1.3, 1.35.

### Barrels a day into a year (kbd-mt)

Volume. 3 steps, to 2 s.f., within 1%.

Start: 45 thousand barrels a day of diesel

1. × 365 days = 16,425 thousand barrels a year
2. ÷ 7.45 barrels a tonne = 2,205 kt a year
3. in millions = 2.205 million tonnes a year

Answer: 2.205 million tonnes a year

Figures drawn from: kbd 45, 60, 85, 110, 140, 190; fuel diesel, gasoline, jet.

### A barrel into pence a litre (bbl-pence)

Price. 3 steps, to 2 s.f., within 1%.

Start: 78 dollars a barrel

1. ÷ 159 litres a barrel = 0.4906 dollars a litre
2. × 100 cents a dollar = 49.06 cents a litre
3. × 0.8 pounds to the dollar = 39.25 pence a litre

Answer: 39.25 pence a litre

Figures drawn from: px 78, 85, 92, 98, 105, 120.

### What a B7 blend costs extra (fame-premium)

Blend. 4 steps, to 2 s.f., within 1.5%.

Start: 60 kt of diesel a month

1. blend 5% FAME = 3 kt of FAME a month
2. × 250 dollars a tonne over diesel = 750 thousand dollars a month
3. × 12 months = 9,000 thousand dollars a year
4. in millions = 9 million dollars a year

Answer: 9 million dollars a year

Figures drawn from: kt 60, 90, 120, 150, 210; p 5, 7, 10; prem 250, 300, 380, 420, 450.

### A cargo of HVO into euros (hvo-tickets)

Carbon. 4 steps, to 2 s.f., within 1.5%.

Start: 2 kt of HVO

1. × 44 MJ a kg = 88 TJ
2. × 94 gCO2e/MJ (the fossil comparator) = 8,272 tonnes CO2e if fossil
3. saves 80% = 6,618 tonnes CO2e saved
4. × €75 a tonne, in thousands = 496.3 thousand euros

Answer: 496.3 thousand euros

Figures drawn from: kt 2, 3, 4, 5.5, 8, 12; saving 80, 85, 88, 90; price 75, 85, 95, 110.

### A fuel's saving (saving-pct)

Carbon. 3 steps, to 2 s.f., within 1%.

Start: 94 gCO2e/MJ, the fossil comparator

1. − 8 gCO2e/MJ, this fuel = 86 gCO2e/MJ saved
2. ÷ 94 gCO2e/MJ = 0.9149 of the comparator
3. × 100 = 91.49 percent saved

Answer: 91.49 percent saved

Figures drawn from: ci 8, 14, 18, 25, 30, 41, 55.

### A parcel's year (parcel-year)

Money. 4 steps, to 2 s.f., within 1.5%.

Start: 812 dollars a tonne sold

1. − 765 dollars a tonne bought = 47 dollars a tonne margin
2. − 14 dollars a tonne freight and insurance = 33 dollars a tonne net
3. × 30 kt = 990 thousand dollars a parcel
4. × 12 parcels a year = 11,880 thousand dollars a year

Answer: 11,880 thousand dollars a year

Figures drawn from: p sell 812 buy 765 fr 14 kt 30 n 12, sell 905 buy 850 fr 18 kt 35 n 10, sell 778 buy 742 fr 11 kt 25 n 12, sell 1,210 buy 1,150 fr 22 kt 12 n 8.

### Tickets into dollars a year (ticket-month)

Money. 3 steps, to 1 s.f., within 5%.

Start: 6 thousand tonnes CO2e saved a month

1. × 85 pounds a tonne = 510 thousand pounds a month
2. × 12 months = 6,120 thousand pounds a year
3. × 1.25 dollars a pound = 7,650 thousand dollars a year

Answer: 7,650 thousand dollars a year

Figures drawn from: kt 6, 8, 12, 15, 22; price 85, 95, 110, 120, 135; fx 1.25, 1.3, 1.35.

### Ethanol in a gasoline market (e10-energy)

Blend. 4 steps, to 2 s.f., within 1.5%.

Start: 600 kt of gasoline a year

1. ÷ 0.745 tonnes a m³ = 805.4 thousand m³ of gasoline
2. 5% ethanol by volume = 40.27 thousand m³ of ethanol
3. × 0.791 tonnes a m³ = 31.85 kt of ethanol
4. × 27 MJ a kg = 860 TJ

Answer: 860 TJ

Figures drawn from: kt 600, 800, 1,200, 1,500, 2,400; p 5, 10.

### B7 over a year (b7-year)

Blend. 4 steps, to 2 s.f., within 1.5%.

Start: 300 kt of diesel a year

1. ÷ 0.845 tonnes a m³ = 355 thousand m³ of diesel
2. 7% FAME by volume = 24.85 thousand m³ of FAME
3. × 0.88 tonnes a m³ = 21.87 kt of FAME
4. × 1,050 dollars a tonne = 22,963 thousand dollars a year

Answer: 22,963 thousand dollars a year

Figures drawn from: kt 300, 450, 600, 900; prem 1,050, 1,150, 1,250.

### A tanker's freight a tonne (freight-t)

Price. 3 steps, to 2 s.f., within 1%.

Start: 30 kt of diesel

1. × 7.45 barrels a tonne = 223.5 thousand barrels
2. × 1.4 dollars a barrel freight = 312.9 thousand dollars
3. ÷ 30 kt = 10.43 dollars a tonne

Answer: 10.43 dollars a tonne

Figures drawn from: kt 30, 33, 37, 40, 45; fuel diesel, gasoline, jet; rate 1.4, 1.8, 2.2, 2.6.

### A refinery's month (refinery-month)

Money. 4 steps, to 2 s.f., within 1.5%.

Start: 80 thousand barrels a day run

1. × 12 dollars a barrel crack = 960 thousand dollars a day
2. × 30 days = 28,800 thousand dollars a month
3. less 20% running costs = 23,040 thousand dollars a month
4. in millions = 23.04 million dollars a month

Answer: 23.04 million dollars a month

Figures drawn from: kbd 80, 110, 140, 180, 220; crack 12, 15, 18, 22, 26; opex 20, 25, 30, 35.

### A litre of FAME in tickets (litre-of-fame)

Carbon. 4 steps, to 2 s.f., within 1.5%.

Start: 33 MJ in a litre of FAME

1. × 94 gCO2e/MJ (the fossil comparator) = 3,102 gCO2e if fossil
2. saves 60% = 1,861 gCO2e saved a litre
3. ÷ 1,000 g a kg = 1.861 kg CO2e saved a litre
4. × 9 pence a kg (£90 a tonne) = 16.75 pence a litre

Answer: 16.75 pence a litre

Figures drawn from: saving 60, 70, 80, 85; pkg 9, 10, 12, 14.

### FAME in a diesel pool, into euros (fame-ticket-month)

Carbon. 5 steps, to 2 s.f., within 2%.

Start: 40 kt of diesel a month

1. blend 5% FAME = 2 kt of FAME
2. × 37 MJ a kg = 74 TJ
3. × 94 gCO2e/MJ (the fossil comparator) = 6,956 tonnes CO2e if fossil
4. saves 60% = 4,174 tonnes CO2e saved
5. × €85 a tonne, in thousands = 354.8 thousand euros a month

Answer: 354.8 thousand euros a month

Figures drawn from: kt 40, 60, 90, 120; p 5, 7; saving 60, 70, 80; price 85, 95, 110.

### Crude into diesel value (crude-to-diesel)

Volume. 5 steps, to 2 s.f., within 2%.

Start: 100 thousand barrels a day of crude

1. × 30 days = 3,000 thousand barrels a month
2. ÷ 7.33 barrels a tonne = 409.3 kt of crude a month
3. 30% comes out as diesel = 122.8 kt of diesel a month
4. × 650 dollars a tonne = 79,809 thousand dollars a month
5. in millions = 79.81 million dollars a month

Answer: 79.81 million dollars a month

Figures drawn from: kbd 100, 150, 200, 250; yld 30, 35, 40; px 650, 700, 780.

### Used cooking oil to euros (uco-to-euros)

Carbon. 6 steps, to 2 s.f., within 2.5%.

Start: 60 kt of used cooking oil a year

1. 78% comes out as HVO = 46.8 kt of HVO
2. × 44 MJ a kg = 2,059 TJ
3. × 94 gCO2e/MJ (the fossil comparator) = 193,565 tonnes CO2e if fossil
4. saves 85% = 164,530 tonnes CO2e saved
5. × 85 euros a tonne = 13,985,057 euros a year
6. in millions = 13.99 million euros a year

Answer: 13.99 million euros a year

Figures drawn from: kt 60, 90, 120, 150; yld 78, 80, 82; saving 85, 88, 90; price 85, 95, 110.
