"use client";

import { useEffect, useState } from "react";
import { API_BASE, isNative } from "./api";
import { getSignals } from "../lib/store";

export function SignalHistory({ symbol }: { symbol: string }) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!symbol) return;

    (async () => {
      if (isNative()) {
        const sigs = await getSignals(symbol, 200);
        setRows(sigs);
      } else {
        const r = await fetch(`${API_BASE}/api/signals?symbol=${encodeURIComponent(symbol)}&limit=50`);
        const j = await r.json();
        setRows(j.signals ?? []);
      }
    })();
  }, [symbol]);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-200">Signal history</div>
          <div className="text-xs text-slate-500">{symbol}</div>
        </div>
      </div>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400">
              <th className="text-left py-2">Time</th>
              <th className="text-left py-2">Side</th>
              <th className="text-left py-2">Price</th>
              <th className="text-left py-2">Stop</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800">
                <td className="py-2 text-slate-300">{new Date(r.ts).toLocaleString()}</td>
                <td className={"py-2 " + (r.side === "BUY" ? "text-emerald-400" : "text-red-400")}>{r.side}</td>
                <td className="py-2 text-slate-300">{Number(r.price).toFixed(2)}</td>
                <td className="py-2 text-slate-400">{Number(r.stop).toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  No signals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
