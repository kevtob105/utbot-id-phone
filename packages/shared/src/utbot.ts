import type { Candle, UTBotParams, UTBotSignal } from "./types";

function trueRange(h: number, l: number, prevC: number) {
  return Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
}

// Wilder ATR (TradingView atr() smoothing style)
class WilderATR {
  private period: number;
  private n = 0;
  private atr: number | null = null;
  private trSum = 0;

  constructor(period: number) {
    this.period = period;
  }

  update(tr: number) {
    this.n += 1;

    if (this.n <= this.period) {
      this.trSum += tr;
      if (this.n === this.period) this.atr = this.trSum / this.period; // seed
      return this.atr;
    }

    this.atr = ((this.atr as number) * (this.period - 1) + tr) / this.period;
    return this.atr;
  }

  value() {
    return this.atr;
  }
}

// UT Bot Alerts engine (matches the Pine logic)
export class UTBot {
  private p: UTBotParams;
  private atr: WilderATR;
  private prevClose: number | null = null;

  private prevSrc: number | null = null;
  private stop = 0; // xATRTrailingStop init 0.0
  private pos = 0;

  constructor(params: UTBotParams) {
    this.p = params;
    this.atr = new WilderATR(params.c);
  }

  private srcFromCandle(c: Candle) {
    return this.p.useHeikin ? (c.o + c.h + c.l + c.c) / 4 : c.c;
  }

  update(c: Candle): UTBotSignal | null {
    const src = this.srcFromCandle(c);

    const prevC = this.prevClose ?? c.c;
    const tr = trueRange(c.h, c.l, prevC);
    const atrVal = this.atr.update(tr);

    this.prevClose = c.c;

    if (atrVal == null) {
      this.prevSrc = src;
      return null;
    }

    const nLoss = this.p.a * atrVal;

    const prevStop = this.stop;
    const prevSrc = this.prevSrc ?? src;

    // trailing stop update (Pine equivalent)
    if (src > prevStop && prevSrc > prevStop) {
      this.stop = Math.max(prevStop, src - nLoss);
    } else if (src < prevStop && prevSrc < prevStop) {
      this.stop = Math.min(prevStop, src + nLoss);
    } else if (src > prevStop) {
      this.stop = src - nLoss;
    } else {
      this.stop = src + nLoss;
    }

    // position state
    if (prevSrc < prevStop && src > prevStop) this.pos = 1;
    else if (prevSrc > prevStop && src < prevStop) this.pos = -1;

    // crossover rules (ema(src,1) == src)
    const buy = src > this.stop && prevSrc <= prevStop;
    const sell = src < this.stop && prevSrc >= prevStop;

    this.prevSrc = src;

    if (buy) return { side: "BUY", t: c.t, price: src, stop: this.stop };
    if (sell) return { side: "SELL", t: c.t, price: src, stop: this.stop };
    return null;
  }

  getStop() {
    return this.stop;
  }

  getPos() {
    return this.pos;
  }
}
