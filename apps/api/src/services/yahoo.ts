import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

export async function fetchQuotes(symbols: string[]) {
  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      const q: any = await yahooFinance.quote(symbol);
      return {
        symbol,
        price: q?.regularMarketPrice ?? null,
        time: q?.regularMarketTime ? (q.regularMarketTime * 1000) : Date.now()
      };
    } catch {
      return { symbol, price: null, time: Date.now() };
    }
  }));
  return results;
}

export type YahooCandle = { t: number; o: number; h: number; l: number; c: number; v?: number };

export async function fetchChart(symbol: string, range = "5d", interval = "1m"): Promise<YahooCandle[]> {
  // yahoo-finance2 chart response structure can vary; normalize carefully.
  const resp: any = await (yahooFinance as any).chart(symbol, { range, interval });
  const result = resp?.chart?.result?.[0];
  if (!result) return [];

  const ts: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const opens: (number | null)[] = quote?.open ?? [];
  const highs: (number | null)[] = quote?.high ?? [];
  const lows: (number | null)[] = quote?.low ?? [];
  const closes: (number | null)[] = quote?.close ?? [];
  const vols: (number | null)[] = quote?.volume ?? [];

  const candles: YahooCandle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      t: ts[i] * 1000,
      o, h, l, c,
      v: vols[i] ?? undefined
    });
  }
  return candles;
}
