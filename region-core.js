// The regions, pure (region.js has the menu control and the kept choice): the same seven everywhere. An item's regions are the
// continents it belongs to (chart-countries.js's `regions`); Worldwide keeps everything, and an item with no region is only in it.
export const REGIONS = [["world", "Worldwide"], ["europe", "Europe"], ["asia", "Asia"], ["africa", "Africa"], ["north-america", "North America"], ["south-america", "South America"], ["oceania", "Oceania"]];
export const known = r => REGIONS.some(([k]) => k === r);
export const inRegions = (region, regions) => region === "world" || [].concat(regions || []).includes(region);
