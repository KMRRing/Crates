// What the Casino section's games share (Baccarat, Blackjack, Roulette; casino.css draws it): money as Macau's tables
// write it, in Hong Kong dollars; the rail of chips to bet with; and a message along the foot of the screen.
export const hk = n => `HK$${Math.abs(n).toLocaleString("en-GB")}`;
/** An amount as a chip or a stake badge prints it: 500, 1K, 10K. */
export const short = n => (n >= 1000 ? `${n / 1000}K` : String(n));
/** The rail's chips as a radio group (data-chip on each), the one picked raised. */
export const chipsHtml = (values, picked) => values.map(v => `<button type="button" class="cs-chip c${v}" role="radio" aria-checked="${picked === v}" data-chip="${v}" aria-label="HK$${v.toLocaleString("en-GB")} chip"><span>${short(v)}</span></button>`).join("");

let timer = 0;
/** Shows a message in the page's #toast for a few seconds. */
export function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove("show"), 2800);
}
