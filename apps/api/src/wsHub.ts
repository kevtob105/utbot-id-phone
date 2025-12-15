import type { WebSocket } from "ws";

export type WSMessage =
  | { type: "price"; symbol: string; price: number; ts: number }
  | { type: "bar"; symbol: string; bar: { t: number; o: number; h: number; l: number; c: number; v?: number } }
  | { type: "signal"; symbol: string; side: "BUY" | "SELL"; ts: number; price: number; stop: number }
  | { type: "notify"; title: string; body: string; ts: number }
  | { type: "snapshot"; watchlist: string[] };

export class WSHub {
  private clients = new Set<WebSocket>();

  add(ws: WebSocket) {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
  }

  broadcast(msg: WSMessage) {
    const payload = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}
