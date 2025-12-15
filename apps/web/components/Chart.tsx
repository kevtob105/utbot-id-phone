"use client";

import { useEffect, useRef } from "react";
import { createChart, type ISeriesApi } from "lightweight-charts";

type Bar = { time: any; open: number; high: number; low: number; close: number };
type Marker = { time: any; position: "aboveBar" | "belowBar"; shape: "arrowUp" | "arrowDown"; text: string };

export function Chart({ bars, markers }: { bars: Bar[]; markers: Marker[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const chart = createChart(ref.current, {
      height: 420,
      layout: { background: { color: "#0b0f14" }, textColor: "#cbd5e1" },
      grid: { vertLines: { color: "#111827" }, horzLines: { color: "#111827" } },
      timeScale: { borderColor: "#111827" },
      rightPriceScale: { borderColor: "#111827" }
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false
    });

    series.setData(bars);
    (series as any).setMarkers(markers);

    seriesRef.current = series;
    chart.timeScale().fitContent();

    const onResize = () => {
      if (!ref.current) return;
      chart.applyOptions({ width: ref.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(bars);
    (seriesRef.current as any).setMarkers(markers);
  }, [bars, markers]);

  return <div ref={ref} className="w-full rounded-lg overflow-hidden" />;
}
