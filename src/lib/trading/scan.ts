import { bybitPublic } from "@/lib/trading/bybit";
import type { TapeBias } from "@/lib/trading/context";
import type { Candle } from "@/lib/trading/math";
import { rankMarkets, type RawMarket } from "@/lib/trading/strategy";
import { UNIVERSE, isUsdtName, type BoardRow, type Lesson, type MarketKind } from "@/lib/trading/types";

type BybitTicker = {
  symbol?: string;
  lastPrice?: string;
  price24hPcnt?: string;
  turnover24h?: string;
  fundingRate?: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const MIN_TURNOVER = 15_000_000;
const SCAN_CAP = 24;

function topByTurnover(rows: { symbol: string; turnover: number }[]): string[] {
  const picked = rows
    .filter((row) => isUsdtName(row.symbol) && row.turnover >= MIN_TURNOVER)
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, SCAN_CAP)
    .map((row) => row.symbol);
  return picked.length > 0 ? picked : [...UNIVERSE];
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

function gatePair(symbol: string): string {
  return `${symbol.replace(/USDT$/, "")}_USDT`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`стрічка ${res.status}`);
  return (await res.json()) as T;
}

function parseBybitCandles(list: string[][]): Candle[] {
  return list
    .map((row) => ({
      t: num(row[0]),
      o: num(row[1]),
      h: num(row[2]),
      l: num(row[3]),
      c: num(row[4]),
      v: num(row[5]),
    }))
    .filter((c) => c.c > 0)
    .sort((a, b) => a.t - b.t);
}

export async function scanBybit(
  market: MarketKind,
  lessons: Lesson[],
  recent: string[],
  threshold: number,
  bias?: TapeBias | null,
): Promise<BoardRow[]> {
  const category = market === "linear" ? "linear" : "spot";
  const tickers = await bybitPublic<{ list?: BybitTicker[] }>(
    `/v5/market/tickers?category=${category}`,
  );
  const bySymbol = new Map((tickers.list ?? []).map((t) => [t.symbol, t]));
  const symbols = topByTurnover(
    (tickers.list ?? []).map((ticker) => ({
      symbol: String(ticker.symbol ?? ""),
      turnover: num(ticker.turnover24h),
    })),
  );
  const raw = await mapPool(symbols, 6, async (symbol): Promise<RawMarket | null> => {
      const ticker = bySymbol.get(symbol);
      if (!ticker) return null;
      const kl = await bybitPublic<{ list?: string[][] }>(
        `/v5/market/kline?category=${category}&symbol=${symbol}&interval=15&limit=120`,
      );
      const candles = parseBybitCandles(kl.list ?? []).slice(0, -1);
      return {
        symbol,
        last: num(ticker.lastPrice),
        changePct: num(ticker.price24hPcnt) * 100,
        turnover: num(ticker.turnover24h),
        funding: market === "linear" ? num(ticker.fundingRate) : null,
        candles,
      };
  });
  return rankMarkets(
    raw.filter((x): x is RawMarket => !!x && x.last > 0),
    market,
    lessons,
    recent,
    threshold,
    bias,
  );
}

type GateSpotTicker = {
  currency_pair?: string;
  last?: string;
  change_percentage?: string;
  quote_volume?: string;
};

type GateFutTicker = {
  contract?: string;
  last?: string;
  change_percentage?: string;
  volume_24h_quote?: string;
  funding_rate?: string;
};

function parseGateSpotCandles(rows: string[][]): Candle[] {
  return rows
    .map((row) => ({
      t: num(row[0]) * 1000,
      o: num(row[5]),
      h: num(row[3]),
      l: num(row[4]),
      c: num(row[2]),
      v: num(row[6]),
    }))
    .filter((c) => c.c > 0)
    .sort((a, b) => a.t - b.t);
}

export async function scanGate(
  market: MarketKind,
  lessons: Lesson[],
  recent: string[],
  threshold: number,
  bias?: TapeBias | null,
): Promise<BoardRow[]> {
  const funding = new Map<string, GateFutTicker>();
  let symbols: string[] = [...UNIVERSE];
  if (market === "linear") {
    const futs = await getJson<GateFutTicker[]>(
      "https://api.gateio.ws/api/v4/futures/usdt/tickers",
    );
    for (const row of futs) {
      if (row.contract) funding.set(row.contract, row);
    }
    symbols = topByTurnover(
      futs.map((row) => ({
        symbol: String(row.contract ?? "").replace("_", ""),
        turnover: num(row.volume_24h_quote),
      })),
    );
  } else {
    const spots = await getJson<GateSpotTicker[]>("https://api.gateio.ws/api/v4/spot/tickers");
    symbols = topByTurnover(
      spots.map((row) => ({
        symbol: String(row.currency_pair ?? "").replace("_", ""),
        turnover: num(row.quote_volume),
      })),
    );
  }
  const raw = await mapPool(symbols, 6, async (symbol): Promise<RawMarket | null> => {
      const pair = gatePair(symbol);
      if (market === "linear") {
        const ticker = funding.get(pair);
        const candlesRaw = await getJson<
          { o: string; h: string; l: string; c: string; v: number; t: number }[]
        >(
          `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${pair}&interval=15m&limit=120`,
        );
        const candles: Candle[] = candlesRaw
          .map((c) => ({
            t: num(c.t) * 1000,
            o: num(c.o),
            h: num(c.h),
            l: num(c.l),
            c: num(c.c),
            v: num(c.v),
          }))
          .sort((a, b) => a.t - b.t);
        const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
        if (!ticker) return null;
        return {
          symbol,
          last: num(ticker.last),
          changePct: num(ticker.change_percentage),
          turnover: num(ticker.volume_24h_quote),
          funding: num(ticker.funding_rate),
          candles: closed,
        };
      }
      const tickers = await getJson<GateSpotTicker[]>(
        `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`,
      );
      const ticker = tickers[0];
      const candleRows = await getJson<string[][]>(
        `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=15m&limit=120`,
      );
      const candles = parseGateSpotCandles(candleRows);
      const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
      if (!ticker) return null;
      return {
        symbol,
        last: num(ticker.last),
        changePct: num(ticker.change_percentage),
        turnover: num(ticker.quote_volume),
        funding: null,
        candles: closed,
      };
  });
  return rankMarkets(
    raw.filter((x): x is RawMarket => !!x && x.last > 0),
    market,
    lessons,
    recent,
    threshold,
    bias,
  );
}

type CensusTicker = { symbol?: string; turnover24h?: string };

let censusCache: { at: number; line: string } | null = null;

function bucket(category: "spot" | "linear" | "inverse", symbol: string): string {
  if (!symbol) return "other";
  if (category === "inverse") return "inverse";
  if (/(UP|DOWN|BULL|BEAR|3L|3S)USDT$/.test(symbol)) return "leveraged";
  if (symbol.includes("-")) return "dated";
  if (symbol.endsWith("USDC") || symbol.endsWith("PERP")) return "usdc";
  if (category === "spot" && isUsdtName(symbol)) return "spot";
  if (category === "linear" && isUsdtName(symbol)) return "perp";
  return "other";
}

export async function marketCensus(): Promise<string> {
  if (censusCache && Date.now() - censusCache.at < 3 * 60 * 1000) return censusCache.line;
  const [spot, linear, inverse] = await Promise.all([
    bybitPublic<{ list?: CensusTicker[] }>("/v5/market/tickers?category=spot").catch(() => null),
    bybitPublic<{ list?: CensusTicker[] }>("/v5/market/tickers?category=linear").catch(() => null),
    bybitPublic<{ list?: CensusTicker[] }>("/v5/market/tickers?category=inverse").catch(() => null),
  ]);
  const counts = { spot: 0, perp: 0, dated: 0, leveraged: 0, inverse: 0, usdc: 0 };
  const liquid = { spot: 0, perp: 0 };
  const take = (category: "spot" | "linear" | "inverse", rows: CensusTicker[] | undefined) => {
    for (const row of rows ?? []) {
      const kind = bucket(category, String(row.symbol ?? ""));
      if (kind in counts) counts[kind as keyof typeof counts] += 1;
      if ((kind === "spot" || kind === "perp") && num(row.turnover24h) >= MIN_TURNOVER) liquid[kind] += 1;
    }
  };
  take("spot", spot?.list);
  take("linear", linear?.list);
  take("inverse", inverse?.list);
  const line = `Усі види Bybit: спот USDT ${counts.spot} (ліквідних ${liquid.spot}), безстрокові ${counts.perp} (ліквідних ${liquid.perp}), строкові ${counts.dated}, inverse ${counts.inverse}, USDC ${counts.usdc}, токени з плечем ${counts.leveraged}. У свічки йдуть лише ліквідні обраного режиму. Строкові, inverse і USDC не торгую.`;
  censusCache = { at: Date.now(), line };
  return line;
}

export async function lastPrice(
  feed: "bybit" | "gate",
  market: MarketKind,
  symbol: string,
): Promise<number> {
  if (feed === "bybit") {
    const category = market === "linear" ? "linear" : "spot";
    const data = await bybitPublic<{ list?: BybitTicker[] }>(
      `/v5/market/tickers?category=${category}&symbol=${symbol}`,
    );
    return num(data.list?.[0]?.lastPrice);
  }
  const pair = gatePair(symbol);
  if (market === "linear") {
    const rows = await getJson<GateFutTicker[]>(
      `https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${pair}`,
    );
    return num(rows[0]?.last);
  }
  const rows = await getJson<GateSpotTicker[]>(
    `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`,
  );
  return num(rows[0]?.last);
}
