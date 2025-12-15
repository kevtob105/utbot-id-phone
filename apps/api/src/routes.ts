import { z } from "zod";
import { prisma } from "./prisma";
import { fetchChart } from "./services/yahoo";

export async function registerRoutes(app: any, ctx: { broadcastSnapshot: () => Promise<void> }) {
  // health
  app.get("/health", async () => ({ ok: true }));

  // watchlist
  app.get("/api/watchlist", async () => {
    const rows = await prisma.watchSymbol.findMany({ orderBy: { addedAt: "asc" } });
    return { watchlist: rows.map(r => r.symbol) };
  });

  app.post("/api/watchlist", async (req: any, reply: any) => {
    const body = z.object({ symbol: z.string().min(1) }).parse(req.body);
    const symbol = body.symbol.trim().toUpperCase();

    await prisma.watchSymbol.upsert({
      where: { symbol },
      update: {},
      create: { symbol }
    });

    await ctx.broadcastSnapshot();
    reply.code(201).send({ ok: true, symbol });
  });

  app.delete("/api/watchlist/:symbol", async (req: any) => {
    const symbol = String(req.params.symbol).trim().toUpperCase();
    await prisma.watchSymbol.delete({ where: { symbol } }).catch(() => null);
    await ctx.broadcastSnapshot();
    return { ok: true };
  });

  // history (chart candles)
  app.get("/api/history", async (req: any) => {
    const q = z.object({
      symbol: z.string().min(1),
      range: z.string().default("5d"),
      interval: z.string().default("1m")
    }).parse(req.query);

    const candles = await fetchChart(q.symbol, q.range, q.interval);
    return { symbol: q.symbol, candles };
  });

  // signals history
  app.get("/api/signals", async (req: any) => {
    const q = z.object({
      symbol: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(2000).default(200)
    }).parse(req.query);

    const rows = await prisma.signalEvent.findMany({
      where: { symbol: q.symbol },
      orderBy: { ts: "desc" },
      take: q.limit
    });

    return {
      symbol: q.symbol,
      signals: rows.map(r => ({
        id: r.id,
        symbol: r.symbol,
        timeframe: r.timeframe,
        side: r.side,
        ts: r.ts.getTime(),
        price: r.price,
        stop: r.stop
      }))
    };
  });

  // alert rules
  app.post("/api/alerts", async (req: any) => {
    const body = z.object({
      symbol: z.string().min(1),
      side: z.enum(["BUY", "SELL", "ANY"]).default("ANY"),
      email: z.string().email().optional(),
      inApp: z.boolean().default(true)
    }).parse(req.body);

    const row = await prisma.alertRule.create({
      data: {
        symbol: body.symbol.trim().toUpperCase(),
        side: body.side,
        email: body.email,
        inApp: body.inApp
      }
    });

    return { ok: true, alert: row };
  });
}
