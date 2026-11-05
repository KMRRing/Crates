// The places the Statecraft course's maps need that neither trade-places.js nor kb/ has: [id, name, latitude, longitude], to about half a degree
// (a dot on a regional map, not a survey point). They are added to the trade course's own table, which trade-map.js reads, so the maps and the
// "tap the place" steps are the trade course's. Import this before drawing a map.
import { OWN_BY_ID } from "./trade-places.js";

const PLACES = [
  ["otrar", "Otrar", 42.85, 68.3], ["tashkent", "Tashkent", 41.3, 69.24], ["lahore", "Lahore", 31.55, 74.34], ["kabul", "Kabul", 34.53, 69.17],
  ["ragusa", "Ragusa (Dubrovnik)", 42.65, 18.09], ["athens", "Athens", 37.98, 23.73], ["sparta", "Sparta", 37.07, 22.43], ["melos", "Melos", 36.72, 24.43],
  ["syracuse", "Syracuse", 37.08, 15.29], ["florence", "Florence", 43.77, 11.26], ["rome", "Rome", 41.9, 12.5], ["jena", "Jena", 50.93, 11.59],
  ["vienna", "Vienna", 48.21, 16.37], ["paris", "Paris", 48.86, 2.35], ["bach-dang", "Bạch Đằng river", 20.95, 106.8], ["hanoi", "Hanoi", 21.03, 105.85],
  ["busan", "Busan", 35.18, 129.08], ["chongqing", "Chongqing", 29.56, 106.55], ["izmir", "Izmir", 38.42, 27.14], ["ankara", "Ankara", 39.93, 32.86],
  ["sokoto", "Sokoto", 13.06, 5.24], ["kano", "Kano", 12.0, 8.52], ["lagos", "Lagos", 6.52, 3.38], ["dandi", "Dandi", 20.88, 72.8],
  ["ahmedabad", "Ahmedabad", 23.02, 72.57], ["london", "London", 51.51, -0.13], ["chengdu", "Chengdu", 30.66, 104.07], ["chibi", "Chibi (Red Cliffs)", 29.72, 113.88],
  ["damascus", "Damascus", 33.51, 36.29], ["jerusalem", "Jerusalem", 31.77, 35.21], ["yanan", "Yan'an", 36.6, 109.5], ["belgrade", "Belgrade", 44.82, 20.46],
  ["delhi", "Delhi", 28.61, 77.21], ["jakarta", "Jakarta", -6.2, 106.85], ["cape-town", "Cape Town", -33.92, 18.42], ["pretoria", "Pretoria", -25.75, 28.19],
  ["durban", "Durban", -29.86, 31.02], ["addis-ababa", "Addis Ababa", 9.03, 38.74], ["adwa", "Adwa", 14.17, 38.89], ["harar", "Harar", 9.31, 42.12],
  ["djibouti", "Djibouti", 11.59, 43.15], ["hormuz", "Strait of Hormuz", 26.57, 56.25], ["suez", "Suez", 29.97, 32.55], ["tsushima", "Tsushima Strait", 34.4, 129.3],
  ["vladivostok", "Vladivostok", 43.12, 131.89], ["moscow", "Moscow", 55.75, 37.62], ["kuala-lumpur", "Kuala Lumpur", 3.14, 101.69], ["riyadh", "Riyadh", 24.71, 46.68],
  ["jeddah", "Jeddah", 21.54, 39.17], ["dammam", "Dammam", 26.43, 50.1], ["porbandar", "Porbandar", 21.64, 69.6], ["johannesburg", "Johannesburg", -26.2, 28.04],
  ["sedan", "Sedan", 49.7, 4.94], ["koniggratz", "Königgrätz", 50.21, 15.83], ["gibraltar", "Strait of Gibraltar", 35.97, -5.6], ["istanbul-strait", "Bosporus", 41.12, 29.07],
  ["kunming", "Kunming", 25.04, 102.71], ["prenzlau", "Prenzlau", 53.32, 13.86], ["zhuhai", "Zhuhai", 22.27, 113.58], ["xiamen", "Xiamen", 24.48, 118.09],
];
for (const [id, name, lat, lon] of PLACES) if (!OWN_BY_ID.has(id)) OWN_BY_ID.set(id, { id, name, lat, lon });
