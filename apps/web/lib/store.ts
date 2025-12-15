import { Preferences } from "@capacitor/preferences";

export type StoredSignal = { side: "BUY" | "SELL"; ts: number; price: number; stop: number };

const KEY_WATCHLIST = "watchlist";

export async function getWatchlist(): Promise<string[]> {
  const { value } = await Preferences.get({ key: KEY_WATCHLIST });
  if (!value) return ["BBCA.JK", "BBRI.JK", "TLKM.JK"];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setWatchlist(symbols: string[]) {
  const uniq = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
  await Preferences.set({ key: KEY_WATCHLIST, value: JSON.stringify(uniq) });
  return uniq;
}

function sigKey(symbol: string) {
  return `signals:${symbol.toUpperCase()}`;
}

export async function getSignals(symbol: string, limit = 200): Promise<StoredSignal[]> {
  const { value } = await Preferences.get({ key: sigKey(symbol) });
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    const out = Array.isArray(arr) ? (arr as StoredSignal[]) : [];
    return out.slice(-limit).reverse(); // newest first for table
  } catch {
    return [];
  }
}

export async function appendSignal(symbol: string, sig: StoredSignal, maxKeep = 500) {
  const key = sigKey(symbol);
  const { value } = await Preferences.get({ key });
  let arr: StoredSignal[] = [];
  if (value) {
    try { arr = JSON.parse(value) as StoredSignal[]; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
  }
  arr.push(sig);
  if (arr.length > maxKeep) arr = arr.slice(-maxKeep);
  await Preferences.set({ key, value: JSON.stringify(arr) });
}
