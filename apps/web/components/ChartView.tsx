"use client";

import { useEffect, useState } from "react";
import { API_BASE, isNative } from "./api";
import { Chart } from "./Chart";
import { fetchChart as fetchChartNative } from "../lib/yahooNative";
import { getSignals } from "../lib/store";

type Candle = { t: number; o: number; h: number; l: number; c: number };
type Bar = { time: any; open: number; high: number; low: number; close: number };
type Marker = { time: any; position: "aboveBar" | "belowBar"; shape: "arrowUp" | "arrowDown"; text: string };

function toBar(c: Candle): Bar {
  return {
    time: Math.floor(c.t / 1000) as any,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c
  };
}

export function ChartView({
  symbol,
  bindBus
}: {
  symbol: string;
  bindBus: (bus: { onBar: (bar: Candle) => void; onSignal: (sig: any) => void }) => void;
}) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);

  useEffect(() => {
    if (!symbol) return;

    (async () => {
      if (isNative()) {
        const c = await fetchChartNative(symbol, "2d", "1m");
        setBars(c.map((x) => toBar({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c })));

        const sigs = await getSignals(symbol, 500);
        setMarkers(
          sigs
            .map((s) => ({
              time: Math.floor(s.ts / 1000) as any,
              position: s.side === "BUY" ? "belowBar" : "aboveBar",
              shape: s.side === "BUY" ? "arrowUp" : "arrowDown",
              text: s.side
            }))
            .reverse()
        );
      } else {
        const r = await fetch(`${API_BASE}/api/history?symbol=${encodeURIComponent(symbol)}&range=2d&interval=1m`);
        const j = await r.json();
        const c: Candle[] = (j.candles ?? []).map((x: any) => ({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c }));
        setBars(c.map(toBar));
        setMarkers([]);
      }
    })();

    // bind realtime handlers
    bindBus({
      onBar: (bar) => {
        setBars((prev) => {
          const next = prev.slice();
          next.push(toBar(bar));
          return next.slice(-1000);
        });
      },
      onSignal: (sig) => {
        setMarkers((prev) => {
          const m: Marker = {
            time: Math.floor(sig.ts / 1000) as any,
            position: sig.side === "BUY" ? "belowBar" : "aboveBar",
            shape: sig.side === "BUY" ? "arrowUp" : "arrowDown",
            text: sig.side
          };
          return [...prev, m].slice(-500);
        });
      }
    });
  }, [symbol]);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm font-medium text-slate-200">{symbol || "—"}</div>
          <div className="text-xs text-slate-500">1m candles • UT Bot signals</div>
        </div>
      </div>
      <div className="mt-3">
        <Chart bars={bars} markers={markers} />
      </div>
    </div>
  );
}
