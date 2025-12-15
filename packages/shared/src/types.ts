export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };
export type Timeframe = "1m";
export type SignalSide = "BUY" | "SELL";
export type UTBotParams = { a: number; c: number; useHeikin: boolean };
export type UTBotSignal = { side: SignalSide; t: number; price: number; stop: number };
