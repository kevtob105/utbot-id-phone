"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, isNative, wsUrl } from "./api";
import { ChartView } from "./ChartView";
import { SignalHistory } from "./SignalHistory";

import { fetchQuotes, fetchChart } from "../lib/yahooNative";
import { getWatchlist, setWatchlist, appendSignal } from "../lib/store";
import { SymbolEngine } from "../lib/mobileEngine";
import { LocalNotifications } from "@capacitor/local-notifications";

type WSMsg =
  | { type: "snapshot"; watchlist: string[] }
  | { type: "price"; symbol: string; price: number; ts: number }
  | { type: "bar"; symbol: string; bar: { t: number; o: number; h: number; l: number; c: number } }
  | { type: "signal"; symbol: string; side: "BUY" | "SELL"; ts: number; price: number; stop: number }
  | { type: "notify"; title: string; body: string; ts: number };

const UT_PARAMS = { a: 1, c: 10, useHeikin: false };

export default function Dashboard() {
  const [watchlist, setWatchlistState] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [lastSignal, setLastSignal] = useState<Record<string, { side: string; ts: number; price: number }>>({});
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const chartBus = useRef<{ onBar?: (bar: any) => void; onSignal?: (sig: any) => void }>({});
  const enginesRef = useRef<Record<string, SymbolEngine>>({});
  const watchlistRef = useRef<string[]>([]);
  const selectedRef = useRef<string>("");

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // =========
  // WEB mode: use backend WS/API
  // =========
  useEffect(() => {
    if (isNative()) return;

    const ws = new WebSocket(wsUrl());
    ws.onmessage = (ev) => {
      const msg: WSMsg = JSON.parse(ev.data);

      if (msg.type === "snapshot") {
        setWatchlistState(msg.watchlist);
        if (!selectedRef.current && msg.watchlist[0]) setSelected(msg.watchlist[0]);
      }

      if (msg.type === "price") {
        setPrices((p) => ({ ...p, [msg.symbol]: msg.price }));
      }

      if (msg.type === "bar") {
        if (msg.symbol === selectedRef.current) chartBus.current.onBar?.(msg.bar);
      }

      if (msg.type === "signal") {
        setLastSignal((s) => ({ ...s, [msg.symbol]: { side: msg.side, ts: msg.ts, price: msg.price } }));
        if (msg.symbol === selectedRef.current) chartBus.current.onSignal?.(msg);
      }

      if (msg.type === "notify") {
        setToast({ title: msg.title, body: msg.body });
        setTimeout(() => setToast(null), 3500);
      }
    };

    return () => ws.close();
  }, []);

  // =========
  // NATIVE mode: phone-only (no backend). Uses Capacitor native HTTP + local storage.
  // Yahoo endpoints are CORS-blocked in browsers; native HTTP avoids that.
  // =========
  useEffect(() => {
    if (!isNative()) return;

    let alive = true;
    let timer: any = null;

    (async () => {
      // notifications permission (in-app alerts)
      try {
        await LocalNotifications.requestPermissions();
      } catch {}

      const wl = await getWatchlist();
      if (!alive) return;
      watchlistRef.current = wl;
      setWatchlistState(wl);
      if (!selectedRef.current && wl[0]) setSelected(wl[0]);

      // warm up engines with recent history so ATR/stop is ready
      await Promise.all(
        wl.map(async (sym) => {
          if (enginesRef.current[sym]) return;
          const eng = new SymbolEngine(UT_PARAMS);
          try {
            const hist = await fetchChart(sym, "2d", "1m");
            eng.warmup(hist);
          } catch {}
          enginesRef.current[sym] = eng;
        })
      );

      // poll quotes every ~2s and generate 1m bars + UT signals
      timer = setInterval(async () => {
        const symbols = watchlistRef.current;
        if (!symbols.length) return;

        try {
          const quotes = await fetchQuotes(symbols);
          for (const q of quotes) {
            if (!alive) return;
            if (!q.symbol || q.price == null) continue;

            setPrices((p) => ({ ...p, [q.symbol]: q.price }));

            const eng = enginesRef.current[q.symbol] ?? (enginesRef.current[q.symbol] = new SymbolEngine(UT_PARAMS));
            const events = eng.onTick(q.price, q.time ?? Date.now());

            for (const ev of events) {
              if (ev.type === "bar" && q.symbol === selectedRef.current) {
                chartBus.current.onBar?.(ev.bar);
              }
              if (ev.type === "signal") {
                const sig = ev.signal;
                const side = sig.side;
                const ts = sig.t;

                setLastSignal((s) => ({ ...s, [q.symbol]: { side, ts, price: sig.price } }));
                if (q.symbol === selectedRef.current) chartBus.current.onSignal?.({ symbol: q.symbol, side, ts, price: sig.price, stop: sig.stop });

                // persist + notify
                await appendSignal(q.symbol, { side, ts, price: sig.price, stop: sig.stop });

                const title = `${q.symbol} ${side}`;
                const body = `Price: ${sig.price.toFixed(2)} • Stop: ${sig.stop.toFixed(2)}`;
                setToast({ title, body });
                setTimeout(() => setToast(null), 3500);

                try {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        id: Math.floor(Date.now() % 2_000_000_000),
                        title,
                        body,
                        schedule: { at: new Date(Date.now() + 200) }
                      }
                    ]
                  });
                } catch {}
              }
            }
          }
        } catch {
          // ignore transient network errors
        }
      }, 2000);
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  async function addSymbol(symbol: string) {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    if (isNative()) {
      const next = await setWatchlist([...watchlistRef.current, sym]);
      watchlistRef.current = next;
      setWatchlistState(next);
      if (!selectedRef.current) setSelected(sym);

      if (!enginesRef.current[sym]) {
        const eng = new SymbolEngine(UT_PARAMS);
        try {
          const hist = await fetchChart(sym, "2d", "1m");
          eng.warmup(hist);
        } catch {}
        enginesRef.current[sym] = eng;
      }
      return;
    }

    const res = await fetch(`${API_BASE}/api/watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: sym })
    });
    if (!res.ok) alert("Failed to add symbol");
  }

  async function removeSymbol(symbol: string) {
    const sym = symbol.trim().toUpperCase();

    if (isNative()) {
      const next = await setWatchlist(watchlistRef.current.filter((s) => s !== sym));
      watchlistRef.current = next;
      setWatchlistState(next);
      if (selectedRef.current === sym) setSelected(next[0] ?? "");
      // keep engine in memory (cheap) or delete:
      // delete enginesRef.current[sym];
      return;
    }

    const res = await fetch(`${API_BASE}/api/watchlist/${encodeURIComponent(sym)}`, { method: "DELETE" });
    if (!res.ok) alert("Failed to remove symbol");
    if (selected === sym) setSelected("");
  }

  const tiles = useMemo(
    () =>
      watchlist.map((s) => {
        const p = prices[s];
        const sig = lastSignal[s];
        return { s, p, sig };
      }),
    [watchlist, prices, lastSignal]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">UT Bot IDX Dashboard</h1>
          <p className="text-sm text-slate-400">
            {isNative() ? "Phone-only mode • Yahoo Finance (native HTTP)" : "Backend mode • Yahoo Finance API"} • 1m candles • Dark trading view
          </p>
        </div>
        <AddSymbol onAdd={addSymbol} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
          <div className="text-sm font-medium text-slate-200 mb-2">Watchlist</div>
          <div className="space-y-2">
            {tiles.map(({ s, p, sig }) => (
              <button
                key={s}
                onClick={() => setSelected(s)}
                className={
                  "w-full text-left rounded-lg border px-3 py-2 transition " +
                  (selected === s ? "border-slate-600 bg-slate-900/60" : "border-slate-800 bg-slate-950 hover:bg-slate-900/30")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{s}</div>
                    <div className="text-xs text-slate-400">{p ? p.toFixed(2) : "—"}</div>
                  </div>
                  <div className="text-right">
                    {sig ? (
                      <div className={"text-xs font-medium " + (sig.side === "BUY" ? "text-emerald-400" : "text-red-400")}>
                        {sig.side} • {new Date(sig.ts).toLocaleTimeString()}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">no signal</div>
                    )}
                    <div className="mt-1">
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSymbol(s);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300 underline"
                      >
                        remove
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {!watchlist.length && (
              <div className="text-sm text-slate-500 p-2">
                Add symbols like <span className="text-slate-300">BBCA.JK</span>, <span className="text-slate-300">TLKM.JK</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <ChartView symbol={selected} bindBus={(b) => (chartBus.current = b)} />
          <SignalHistory symbol={selected} />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 max-w-sm rounded-xl border border-slate-700 bg-slate-950/90 p-4 shadow-xl">
          <div className="text-sm font-semibold text-slate-100">{toast.title}</div>
          <div className="text-sm text-slate-300 mt-1">{toast.body}</div>
        </div>
      )}
    </div>
  );
}

function AddSymbol({ onAdd }: { onAdd: (symbol: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add symbol (e.g. BBCA.JK)"
        className="w-64 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-600"
      />
      <button
        onClick={() => {
          if (value.trim()) onAdd(value.trim());
          setValue("");
        }}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800"
      >
        Add
      </button>
    </div>
  );
}
