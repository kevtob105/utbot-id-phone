import type { Candle, UTBotParams } from "@utbot/shared";
import { UTBot } from "@utbot/shared";
import { prisma } from "../prisma";
import { sendEmail } from "../alerts";

type BarEvent = { symbol: string; bar: Candle };
type SignalEvent = { symbol: string; side: "BUY" | "SELL"; ts: number; price: number; stop: number };

export class CandleEngine {
  private timeframe: "1m";
  private params: UTBotParams;

  // current building bar per symbol
  private current = new Map<string, Candle>();
  private bots = new Map<string, UTBot>();

  // callbacks
  constructor(timeframe: "1m", params: UTBotParams,
    private onBar: (ev: BarEvent) => void,
    private onSignal: (ev: SignalEvent) => void,
    private onNotify: (title: string, body: string) => void
  ) {
    this.timeframe = timeframe;
    this.params = params;
  }

  ensure(symbol: string) {
    if (!this.bots.has(symbol)) this.bots.set(symbol, new UTBot(this.params));
  }

  async prime(symbol: string, history: Candle[]) {
    this.ensure(symbol);
    const bot = this.bots.get(symbol)!;
    // feed historical closed candles to warm up ATR + stop state
    for (const bar of history) bot.update(bar);
  }

  private minuteBucket(ts: number) {
    return Math.floor(ts / 60000) * 60000;
  }

  async onTick(symbol: string, price: number, ts: number) {
    this.ensure(symbol);

    const bucket = this.minuteBucket(ts);
    const cur = this.current.get(symbol);

    if (!cur) {
      this.current.set(symbol, { t: bucket, o: price, h: price, l: price, c: price });
      return;
    }

    if (cur.t !== bucket) {
      // close previous bar
      const closed = cur;
      this.onBar({ symbol, bar: closed });

      // run signal on closed bar
      const bot = this.bots.get(symbol)!;
      const sig = bot.update(closed);
      if (sig) {
        const ev = { symbol, side: sig.side, ts: sig.t, price: sig.price, stop: sig.stop } as SignalEvent;
        this.onSignal(ev);
        await this.persistSignal(ev);
        await this.dispatchAlerts(ev);
      }

      // start new bar
      this.current.set(symbol, { t: bucket, o: price, h: price, l: price, c: price });
      return;
    }

    // update current bar
    cur.h = Math.max(cur.h, price);
    cur.l = Math.min(cur.l, price);
    cur.c = price;
    this.current.set(symbol, cur);
  }

  private async persistSignal(ev: SignalEvent) {
    await prisma.signalEvent.create({
      data: {
        symbol: ev.symbol,
        timeframe: this.timeframe,
        side: ev.side,
        ts: new Date(ev.ts),
        price: ev.price,
        stop: ev.stop,
        a: this.params.a,
        c: this.params.c,
        useHeikin: this.params.useHeikin
      }
    });
  }

  private async dispatchAlerts(ev: SignalEvent) {
    const rules = await prisma.alertRule.findMany({
      where: {
        symbol: ev.symbol,
        OR: [{ side: ev.side }, { side: "ANY" }]
      }
    });

    if (!rules.length) return;

    const title = `${ev.side} ${ev.symbol}`;
    const body = `Signal ${ev.side} on ${ev.symbol} @ ${ev.price.toFixed(2)} | stop=${ev.stop.toFixed(2)} | ${new Date(ev.ts).toLocaleString()}`;

    for (const r of rules) {
      if (r.inApp) this.onNotify(title, body);
      if (r.email) {
        try { await sendEmail(r.email, title, body); } catch {}
      }
    }
  }
}
