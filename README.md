# UT Bot IDX (Yahoo) — Node/TS Fullstack

A dark-theme trading dashboard for Indonesian stocks (IDX, `.JK`) using Yahoo Finance data.
- Real-time-ish price updates (polling by default; WS to browser)
- UT Bot Alerts signals (ATR trailing stop)
- Historical chart with signal markers
- Signal history
- Alerts (in-app + optional email)

> Note: Yahoo Finance is an unofficial data source and "real-time" may be delayed depending on symbol/market.

## Quick start (SQLite, no Docker)

1) Install dependencies (pnpm recommended)
```bash
pnpm i
```

2) Copy env
```bash
cp .env.example .env
```

3) Setup DB (SQLite)
```bash
pnpm db:push
```

4) Run
```bash
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:3000

## Postgres option (Docker)
```bash
docker compose up -d
```
Then set `DATABASE_URL` in `.env` to Postgres and run:
```bash
pnpm db:push
pnpm dev
```

## Symbols (Yahoo)
IDX stocks commonly use `.JK` suffix:
- BBCA.JK, BBRI.JK, BMRI.JK, BBNI.JK, TLKM.JK, ASII.JK, etc.

## API endpoints
- GET  /api/watchlist
- POST /api/watchlist  { symbol }
- DEL  /api/watchlist/:symbol
- GET  /api/history?symbol=BBCA.JK&range=5d&interval=1m
- GET  /api/signals?symbol=BBCA.JK&limit=200
- POST /api/alerts     { symbol, side, email?, inApp? }

## WebSocket
Connect to `ws://localhost:4000/ws` and you’ll receive:
- `{ type:"price", symbol, price, ts }`
- `{ type:"bar", symbol, bar }` (1m bars)
- `{ type:"signal", symbol, side, ts, price, stop }`
- `{ type:"notify", title, body, ts }`

## Phone-only Android app (Capacitor)

This repo supports a **phone-only runtime** mode (no API server) when running inside a Capacitor Android app:

- Fetches Yahoo Finance using **CapacitorHttp** (native HTTP).
- Stores watchlist + signal history locally using **Preferences**.
- Sends in-app device notifications using **Local Notifications**.

> Why: Yahoo Finance endpoints are commonly blocked by browser CORS, so the web-only build typically needs the Node API as a proxy. In the Android app, native HTTP avoids that.

### Build & run (Windows)

1) Install dependencies
```bash
pnpm i
```

2) Build the web app (Next.js static export to `apps/web/out`)
```bash
pnpm --filter web build
```

3) Create Android app (first time only)
```bash
cd apps/web
pnpm exec cap init "UT Bot IDX" "com.utbot.idx"
pnpm exec cap add android
```

4) Sync web build into Android + open Android Studio
```bash
pnpm exec cap sync android
pnpm exec cap open android
```

5) Run on your phone from Android Studio (USB debugging enabled).
