import { Capacitor } from "@capacitor/core";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export function isNative() {
  return Capacitor.isNativePlatform();
}

export function wsUrl() {
  const u = new URL(API_BASE);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  return u.toString();
}
