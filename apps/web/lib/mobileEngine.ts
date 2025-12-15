import { UTBot } from "@utbot/shared";
import type { Candle, UTBotParams, UTBotSignal } from "@utbot/shared";

// Builds 1m candles from price ticks
export class CandleBuilder {
  private current: Candle | null = null;
  private bucketMs = 60_000;

  constructor(bucketMs = 60_000) {
    this.bucketMs = bucketMs;
  }

  private bucket(ts: number) {
    return Math.floor(ts / this.bucketMs) * this.bucketMs;
  }

  ingest(price: number, ts: number): { closed?: Candle; current: Candle } {
    const b = this.bucket(ts);

    if (!this.current) {
      this.current = { t: b, o: price, h: price, l: price, c: price };
      return { current: this.current };
    }

    if (b !== this.current.t) {
      const closed = this.current;
      this.current = { t: b, o: price, h: price, l: price, c: price };
      return { closed, current: this.current };
    }

    // same candle
    this.current.h = Math.max(this.current.h, price);
    this.current.l = Math.min(this.current.l, price);
    this.current.c = price;
    return { current: this.current };
  }

  setCurrent(c: Candle | null) {
    this.current = c;
  }

  getCurrent() {
    return this.current;
  }
}

export type EngineEvent =
  | { type: "bar"; bar: Candle }
  | { type: "signal"; signal: UTBotSignal };

export class SymbolEngine {
  private builder = new CandleBuilder(60_000);
  private bot: UTBot;

  constructor(params: UTBotParams) {
    this.bot = new UTBot(params);
  }

  // Warm-up using historical candles (oldest -> newest)
  warmup(candles: Candle[]) {
    for (const c of candles) this.bot.update(c);
    // set builder to the last candle (so next ticks continue correctly)
    if (candles.length) this.builder.setCurrent(candles[candles.length - 1]);
  }

  onTick(price: number, ts: number): EngineEvent[] {
    const evs: EngineEvent[] = [];
    const { closed, current } = this.builder.ingest(price, ts);

    if (closed) {
      // UT bot should run on closed candle
      const sig = this.bot.update(closed);
      evs.push({ type: "bar", bar: closed });
      if (sig) evs.push({ type: "signal", signal: { ...sig, t: sig.t } });
    }

    // We do not emit the "current" candle each tick to avoid noisy redraw.
    // If you want realtime candle painting, emit {type:'bar', bar: current} too.
    void current;
    return evs;
  }
}
