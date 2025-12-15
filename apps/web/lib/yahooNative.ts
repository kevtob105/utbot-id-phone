import { CapacitorHttp } from "@capacitor/core";
import type { Candle } from "@utbot/shared";

const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

// Quote endpoint (unofficial)
const QUOTE_URL = "https://query2.finance.yahoo.com/v7/finance/quote";
// Chart endpoint for OHLCV
const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

export async function fetchQuotes(symbols: string[]) {
  if (!symbols.length) return [];
  const { data } = await CapacitorHttp.get({
    url: QUOTE_URL,
    params: { symbols: symbols.join(",") },
    headers: { "User-Agent": UA, Accept: "application/json" },
  });

  const rows: any[] = data?.quoteResponse?.result ?? [];
  return rows.map((r) => ({
    symbol: String(r.symbol ?? "").toUpperCase(),
    price: typeof r.regularMarketPrice === "number" ? r.regularMarketPrice : null,
    time: r.regularMarketTime ? r.regularMarketTime * 1000 : Date.now(),
  }));
}

export async function fetchChart(symbol: string, range = "2d", interval = "1m"): Promise<Candle[]> {
  const { data } = await CapacitorHttp.get({
    url: `${CHART_BASE}${encodeURIComponent(symbol)}`,
    params: { range, interval, includePrePost: "false" },
    headers: { "User-Agent": UA, Accept: "application/json" },
  });

  const result = data?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const open: (number | null)[] = quote.open ?? [];
  const high: (number | null)[] = quote.high ?? [];
  const low: (number | null)[] = quote.low ?? [];
  const close: (number | null)[] = quote.close ?? [];

  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = open[i], h = high[i], l = low[i], c = close[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ t: ts[i] * 1000, o, h, l, c });
  }
  return out;
}
