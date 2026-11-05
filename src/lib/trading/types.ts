export const UNIVERSE = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "ADAUSDT",
  "DOGEUSDT",
] as const;

export type SymbolName = (typeof UNIVERSE)[number];
export type Venue = "rehearsal" | "demo" | "real";
export type MarketKind = "spot" | "linear";
export type Side = "long" | "short";
export type Brain = "local" | "groq" | "gemini" | "openrouter" | "grok";
export type LlmSlot = "groq" | "gemini" | "openrouter";
export type LlmKeys = Record<LlmSlot, string>;
export type Feed = "bybit" | "gate";
export type Phase = "idle" | "scanning" | "managing" | "done" | "halted";

export type BoardRow = {
  symbol: string;
  last: number;
  changePct: number;
  turnover: number;
  funding: number | null;
  rsi: number;
  atrPct: number;
  side: Side | "flat";
  score: number;
  tradable: boolean;
  entry: number;
  stop: number;
  take: number;
  reasons: string[];
  fingerprint: string;
  spark: number[];
  barT: number;
  barH: number;
  barL: number;
};

export type Lesson = {
  fp: string;
  losses: number;
  note: string;
  at: number;
};

export type LogLine = {
  id: string;
  t: number;
  agent: string;
  text: string;
};

export type ActiveTrade = {
  id: string;
  symbol: string;
  side: Side;
  entry: number;
  stop: number;
  take: number;
  qty: number;
  notional: number;
  leverage: number;
  margin: number;
  openedAt: number;
  thesis: string;
  fingerprint: string;
  orderId?: string;
  feed: Feed;
  unrealized: number;
  exchangeStop?: boolean;
  exchangeTarget?: boolean;
};

export type ClosedTrade = {
  id: string;
  symbol: string;
  side: Side;
  entry: number;
  exit: number;
  stop: number;
  take: number;
  qty: number;
  notional: number;
  pnl: number;
  reason: "stop" | "take" | "time" | "kill" | "flat";
  openedAt: number;
  closedAt: number;
  fingerprint: string;
  lesson: string;
  venue: Venue;
  market: MarketKind;
};

export type Settings = {
  venue: Venue;
  market: MarketKind;
  weeklyUsd: number;
  riskPct: number;
  bybitKey: string;
  bybitSecret: string;
  brain: Brain;
  llmKeys: LlmKeys;
};

export type Session = {
  running: boolean;
  resumeHint: boolean;
  phase: Phase;
  day: string;
  week: string;
  closedToday: number;
  closedWeek: number;
  realizedToday: number;
  realizedWeek: number;
  trades: ClosedTrade[];
  lessons: Lesson[];
  log: LogLine[];
  board: BoardRow[];
  feed: Feed;
  feedNote: string;
  ledgerNote: string;
  active: ActiveTrade | null;
  emptyScans: number;
  llmCalls: number;
  haltReason: string | null;
  orderErrors: number;
  vetoes: number;
  threshold: number;
  banned: string[];
};

export const CALLS_PER_SESSION = 12;
export const TRADES_PER_DAY = 5;
export const TRADES_PER_WEEK = 25;
export const DAILY_LOSS_PCT = 0.03;
export const WEEKLY_LOSS_PCT = 0.06;
export const REHEARSAL_TIME_STOP_MS = 50_000;
export const LIVE_TIME_STOP_MS = 4 * 60 * 60 * 1000;

export type ScanResult =
  | { ok: true; feed: Feed; note: string; rows: BoardRow[] }
  | { ok: false; error: string; code?: string };

export type AccountResult =
  | { ok: true; equity: number; available: number; coin: string }
  | { ok: false; error: string; code?: string };

export type EntryResult =
  | {
      ok: true;
      orderId: string;
      qty: number;
      entry: number;
      stop: number;
      take: number;
      notional: number;
      leverage: number;
      exchangeStop?: boolean;
      exchangeTarget?: boolean;
    }
  | { ok: false; error: string; code?: string };

export type SyncResult =
  | {
      ok: true;
      flat: boolean;
      size: number;
      avgPrice: number;
      last: number;
      unrealisedPnl: number;
      orderStatus: string;
      exchangeStop: boolean;
      exitPrice: number;
      closedPnl: number | null;
    }
  | { ok: false; error: string; code?: string };

export type CriticResult = {
  ok: boolean;
  verdict: "allow" | "veto" | "skip";
  note: string;
  spent: boolean;
};
