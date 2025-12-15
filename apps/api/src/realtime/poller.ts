import { fetchQuotes } from "../services/yahoo";

export function startQuotePoller(
  getSymbols: () => string[],
  intervalMs: number,
  onTick: (symbol: string, price: number, ts: number) => void
) {
  setInterval(async () => {
    const symbols = getSymbols();
    if (!symbols.length) return;

    const quotes = await fetchQuotes(symbols);
    for (const q of quotes) {
      if (q.price == null) continue;
      onTick(q.symbol, q.price, q.time ?? Date.now());
    }
  }, intervalMs);
}
