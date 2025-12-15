import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { env } from "./env";
import { prisma } from "./prisma";
import { WSHub } from "./wsHub";
import { registerRoutes } from "./routes";
import { startQuotePoller } from "./realtime/poller";
import { CandleEngine } from "./realtime/candleEngine";
import type { Candle } from "@utbot/shared";
import { fetchChart } from "./services/yahoo";

const app = Fastify({ logger: true });
const hub = new WSHub();

const utParams = { a: env.UT_A, c: env.UT_C, useHeikin: env.UT_USE_HEIKIN };

const engine = new CandleEngine(
  env.TIMEFRAME,
  utParams,
  (ev) => hub.broadcast({ type: "bar", symbol: ev.symbol, bar: ev.bar }),
  (ev) => hub.broadcast({ type: "signal", ...ev }),
  (title, body) => hub.broadcast({ type: "notify", title, body, ts: Date.now() })
);

async function getWatchlist() {
  const rows = await prisma.watchSymbol.findMany({ orderBy: { addedAt: "asc" } });
  return rows.map(r => r.symbol);
}

async function broadcastSnapshot() {
  const list = await getWatchlist();
  hub.broadcast({ type: "snapshot", watchlist: list });
}

async function primeBots() {
  const list = await getWatchlist();
  for (const symbol of list) {
    try {
      // Prime with last 2 days 1m bars (good enough to seed ATR)
      const candles = await fetchChart(symbol, "2d", "1m");
      const mapped: Candle[] = candles.map(c => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
      await engine.prime(symbol, mapped);
      app.log.info({ symbol, bars: mapped.length }, "primed bot");
    } catch (e) {
      app.log.warn({ symbol, err: String(e) }, "failed to prime bot");
    }
  }
}

async function main() {
  // CORS for dev (simple)
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "content-type");
    return payload;
  });
  app.options("/*", async () => ({}));

  await registerRoutes(app, { broadcastSnapshot });

  // start http
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  app.log.info(`API listening on ${env.API_PORT}`);

  // ws server (shares same port via standalone server is tricky with fastify; easiest: separate WSS on same port not available here)
  // We'll bind WSS to the underlying Node server:
  const server: any = app.server;
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    hub.add(ws);
    broadcastSnapshot().catch(() => null);
  });

  await primeBots();

  // poller
  startQuotePoller(
    () => [],
    env.POLL_INTERVAL_MS,
    () => {}
  );

  // We need fresh watchlist for each interval; do it inside poll loop:
  setInterval(async () => {
    const symbols = await getWatchlist();
    for (const s of symbols) engine.ensure(s);
  }, 5000);

  startQuotePoller(
    async () => await getWatchlist(),
    env.POLL_INTERVAL_MS,
    async (symbol, price, ts) => {
      hub.broadcast({ type: "price", symbol, price, ts });
      await engine.onTick(symbol, price, ts);
    }
  );

  app.log.info("poller started");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
