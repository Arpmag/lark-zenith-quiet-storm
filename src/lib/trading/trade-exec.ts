import { BybitError, bybitSigned } from "@/lib/trading/bybit";
import { floorToStep, roundToTick } from "@/lib/trading/math";
import type { AccountResult, EntryResult, MarketKind, SyncResult } from "@/lib/trading/types";

type Instrument = {
  lotSizeFilter?: {
    qtyStep?: string;
    minOrderQty?: string;
    minNotionalValue?: string;
    basePrecision?: string;
    quotePrecision?: string;
  };
  priceFilter?: { tickSize?: string };
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function qtyString(q: number, step: number): string {
  return floorToStep(q, step).toFixed(Math.min(8, decimals(step)));
}

function decimals(step: number): number {
  const s = step.toString();
  if (s.includes("e-")) return Number(s.split("e-")[1] ?? 8);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

async function instrument(
  venue: "demo" | "real",
  key: string,
  secret: string,
  market: MarketKind,
  symbol: string,
): Promise<Instrument> {
  const data = await bybitSigned<{ list?: Instrument[] }>({
    venue,
    key,
    secret,
    method: "GET",
    path: "/v5/market/instruments-info",
    query: { category: market, symbol },
  });
  const row = data.list?.[0];
  if (!row) throw new BybitError("Немає специфікації інструмента.");
  return row;
}

export async function readAccount(
  venue: "demo" | "real",
  key: string,
  secret: string,
): Promise<AccountResult> {
  try {
    const data = await bybitSigned<{
      list?: {
        totalEquity?: string;
        totalAvailableBalance?: string;
        coin?: { coin?: string; equity?: string; walletBalance?: string }[];
      }[];
    }>({
      venue,
      key,
      secret,
      method: "GET",
      path: "/v5/account/wallet-balance",
      query: { accountType: "UNIFIED" },
    });
    const acc = data.list?.[0];
    const usdt = acc?.coin?.find((c) => c.coin === "USDT");
    return {
      ok: true,
      equity: num(acc?.totalEquity),
      available: num(acc?.totalAvailableBalance ?? usdt?.walletBalance),
      coin: "USDT",
    };
  } catch (error) {
    return fail(error);
  }
}

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof BybitError) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: false, error: error instanceof Error ? error.message : "невідома помилка" };
}

export async function openPosition(args: {
  venue: "demo" | "real";
  key: string;
  secret: string;
  market: MarketKind;
  symbol: string;
  side: "Buy" | "Sell";
  notional: number;
  leverage: number;
  stop: number;
  take: number;
  weeklyUsd: number;
}): Promise<EntryResult> {
  try {
    if (args.market === "spot" && args.side !== "Buy") {
      return { ok: false, error: "На споті машина відкриває лише лонг." };
    }
    if (!UNIVERSE_OK(args.symbol)) {
      return { ok: false, error: "Пара поза дозволеним списком." };
    }
    const info = await instrument(args.venue, args.key, args.secret, args.market, args.symbol);
    const tick = num(info.priceFilter?.tickSize) || 0.01;
    const step =
      num(info.lotSizeFilter?.qtyStep) ||
      (args.market === "spot" ? 10 ** -num(info.lotSizeFilter?.basePrecision || "4") : 0.001);
    const minQty = num(info.lotSizeFilter?.minOrderQty);
    const ticker = await bybitSigned<{ list?: { lastPrice?: string }[] }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "GET",
      path: "/v5/market/tickers",
      query: { category: args.market, symbol: args.symbol },
    });
    const last = num(ticker.list?.[0]?.lastPrice);
    if (!(last > 0)) return { ok: false, error: "Немає ціни Bybit для входу." };
    const stop =
      args.side === "Buy"
        ? roundToTick(args.stop, tick, "down")
        : roundToTick(args.stop, tick, "up");
    const take =
      args.side === "Buy"
        ? roundToTick(args.take, tick, "up")
        : roundToTick(args.take, tick, "down");
    const dist = Math.abs(last - stop) / last;
    if (dist < 0.0015 || dist > 0.08) {
      return { ok: false, error: "Стоп після округлення непридатний." };
    }
    let notional = Math.min(args.notional, args.weeklyUsd * 0.22 * (args.market === "linear" ? 3 : 1));
    const riskUsd = dist * notional;
    if (riskUsd > args.weeklyUsd * 0.016) {
      notional = (args.weeklyUsd * 0.015) / dist;
    }
    const leverage = args.market === "linear" ? Math.min(3, Math.max(1, Math.round(args.leverage))) : 1;
    const account = await readAccount(args.venue, args.key, args.secret);
    if (!account.ok) return { ok: false, error: account.error, ...(account.code ? { code: account.code } : {}) };
    const cash = account.available > 0 ? account.available : account.equity;
    if (!(cash >= 10)) return { ok: false, error: "Вільно менше 10 USDT. Ордер не ставлю." };
    if (args.market === "spot") notional = Math.min(notional, cash * 0.98);
    else if (notional / leverage > cash * 0.85) notional = cash * 0.85 * leverage;
    if (notional < 10) return { ok: false, error: "Після балансу номінал нижче 10 USDT." };
    if (args.market === "linear") {
      try {
        await bybitSigned({
          venue: args.venue,
          key: args.key,
          secret: args.secret,
          method: "POST",
          path: "/v5/position/set-leverage",
          body: {
            category: "linear",
            symbol: args.symbol,
            buyLeverage: String(leverage),
            sellLeverage: String(leverage),
          },
        });
      } catch (error) {
        if (!(error instanceof BybitError) || error.code !== "lev_same") {
          const msg = error instanceof Error ? error.message : "";
          if (!/not modified|leverage not modified|110043/i.test(msg)) throw error;
        }
      }
    }
    const orderLinkId = `p5${Date.now().toString(36)}`.slice(0, 32);
    let qty = notional / last;
    qty = floorToStep(qty, step);
    if (minQty && qty < minQty) {
      return {
        ok: false,
        error: `Мінімум ${args.symbol} — ${minQty}. Після ризику виходить ${qty}.`,
      };
    }
    if (!(qty > 0)) return { ok: false, error: "Кількість округлилась до нуля." };
    if (args.market === "spot") {
      const base = args.symbol.replace(/USDT$/, "");
      const wallet = await bybitSigned<{
        list?: { coin?: { coin?: string; walletBalance?: string }[] }[];
      }>({
        venue: args.venue,
        key: args.key,
        secret: args.secret,
        method: "GET",
        path: "/v5/account/wallet-balance",
        query: { accountType: "UNIFIED", coin: base },
      });
      const held = num(wallet.list?.[0]?.coin?.find((coin) => coin.coin === base)?.walletBalance);
      if (held > qty * 0.5) {
        return { ok: false, error: `На споті вже є ${base}. Другу покупку не роблю.` };
      }
    }

    const created =
      args.market === "linear"
        ? await placeLinear(args, qty, step, stop, take, orderLinkId)
        : await placeSpot(args, notional, info, orderLinkId, stop, take);

    return {
      ok: true,
      orderId: created.orderId,
      qty: created.qty,
      entry: created.entry || last,
      stop,
      take,
      notional: (created.entry || last) * created.qty,
      leverage,
      exchangeStop: created.exchangeStop,
      exchangeTarget: created.exchangeTarget,
    };
  } catch (error) {
    return fail(error);
  }
}

function UNIVERSE_OK(symbol: string): boolean {
  return [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "LINKUSDT",
    "AVAXUSDT",
    "ADAUSDT",
    "DOGEUSDT",
  ].includes(symbol);
}

async function placeLinear(
  args: {
    venue: "demo" | "real";
    key: string;
    secret: string;
    symbol: string;
    side: "Buy" | "Sell";
  },
  qty: number,
  step: number,
  stop: number,
  take: number,
  orderLinkId: string,
): Promise<{ orderId: string; qty: number; entry: number; exchangeStop?: boolean; exchangeTarget?: boolean }> {
  const qtyStr = qtyString(qty, step);
  const px = (n: number) => n.toString();
  const send = (idx: 0 | 1 | 2, link: string, withStops: boolean) =>
    bybitSigned<{ orderId?: string }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "POST",
      path: "/v5/order/create",
      body: {
        category: "linear",
        symbol: args.symbol,
        side: args.side,
        orderType: "Market",
        qty: qtyStr,
        positionIdx: idx,
        orderLinkId: link,
        ...(withStops
          ? {
              takeProfit: px(take),
              stopLoss: px(stop),
              tpslMode: "Full",
              tpOrderType: "Market",
              slOrderType: "Market",
              tpTriggerBy: "LastPrice",
              slTriggerBy: "LastPrice",
            }
          : {}),
      },
    });
  const armStop = (idx: 0 | 1 | 2) =>
    bybitSigned({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "POST",
      path: "/v5/position/trading-stop",
      body: {
        category: "linear",
        symbol: args.symbol,
        tpslMode: "Full",
        positionIdx: idx,
        takeProfit: px(take),
        stopLoss: px(stop),
        tpTriggerBy: "LastPrice",
        slTriggerBy: "LastPrice",
      },
    });
  let idx: 0 | 1 | 2 = 0;
  let orderId = "";
  let armed = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const link = `${orderLinkId}${attempt}`.slice(0, 36);
    try {
      try {
        const result = await send(idx, link, true);
        orderId = result.orderId ?? "";
        armed = true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (!/tpsl|takeProfit|stopLoss|StopLoss/i.test(msg)) throw error;
        const result = await send(idx, `${link}b`.slice(0, 36), false);
        orderId = result.orderId ?? "";
        armed = false;
        try {
          await armStop(idx);
          armed = true;
        } catch {
          armed = false;
        }
      }
      break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (attempt === 0 && /position idx|position mode/i.test(msg)) {
        idx = args.side === "Buy" ? 1 : 2;
        continue;
      }
      throw error;
    }
  }
  let filled = await readOrder(args.venue, args.key, args.secret, "linear", args.symbol, orderId);
  for (let i = 0; i < 4 && !(num(filled?.avgPrice) > 0 && num(filled?.cumExecQty) > 0); i++) {
    await new Promise((r) => setTimeout(r, 400));
    filled = await readOrder(args.venue, args.key, args.secret, "linear", args.symbol, orderId);
  }
  const qtyFilled = num(filled?.cumExecQty);
  const entry = num(filled?.avgPrice);
  if (!(qtyFilled > 0) || !(entry > 0)) {
    throw new BybitError("Ф'ючерсний ордер не підтвердив виконання. Позицію не записую.");
  }
  return {
    orderId,
    qty: qtyFilled,
    entry,
    exchangeStop: armed,
    exchangeTarget: armed,
  };
}

async function placeSpot(
  args: {
    venue: "demo" | "real";
    key: string;
    secret: string;
    symbol: string;
    side: "Buy" | "Sell";
  },
  notional: number,
  info: Instrument,
  orderLinkId: string,
  stop: number,
  take: number,
): Promise<{ orderId: string; qty: number; entry: number; exchangeStop?: boolean; exchangeTarget?: boolean }> {
  const quotePrec = Math.min(8, num(info.lotSizeFilter?.quotePrecision) || 2);
  const quoteQty = floorToStep(notional, 10 ** -quotePrec).toFixed(quotePrec);
  const tick = num(info.priceFilter?.tickSize) || 0.01;
  const px = (n: number) => n.toFixed(Math.min(8, decimals(tick)));
  const protect = stop > 0 && take > stop;
  const sendBuy = (withTargets: boolean, link: string) =>
    bybitSigned<{ orderId?: string }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "POST",
      path: "/v5/order/create",
      body: {
        category: "spot",
        symbol: args.symbol,
        side: "Buy",
        orderType: "Market",
        qty: quoteQty,
        marketUnit: "quoteCoin",
        orderLinkId: link,
        ...(withTargets
          ? {
              takeProfit: px(take),
              stopLoss: px(stop),
              tpOrderType: "Market",
              slOrderType: "Market",
            }
          : {}),
      },
    });
  let result: { orderId?: string };
  let exchangeTarget = false;
  try {
    result = protect ? await sendBuy(true, orderLinkId) : await sendBuy(false, orderLinkId);
    exchangeTarget = protect;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (!protect || !/tpsl|takeProfit|stopLoss|StopLoss/i.test(msg)) throw error;
    result = await sendBuy(false, `${orderLinkId}b`.slice(0, 36));
  }
  const orderId = result.orderId ?? "";
  let filled = await readOrder(args.venue, args.key, args.secret, "spot", args.symbol, orderId);
  for (let i = 0; i < 2 && !(num(filled?.cumExecQty) > 0); i++) {
    await new Promise((r) => setTimeout(r, 400));
    filled = await readOrder(args.venue, args.key, args.secret, "spot", args.symbol, orderId);
  }
  if (!(num(filled?.cumExecQty) > 0)) {
    if (orderId) {
      try {
        await bybitSigned({
          venue: args.venue,
          key: args.key,
          secret: args.secret,
          method: "POST",
          path: "/v5/order/cancel",
          body: { category: "spot", symbol: args.symbol, orderId },
        });
      } catch {
        /* already gone */
      }
    }
    throw new BybitError("Спотовий ордер не підтвердив виконання. Скасовую, якщо він ще висить.");
  }
  const qty = num(filled?.cumExecQty);
  const entry = num(filled?.avgPrice);
  if (exchangeTarget) return { orderId, qty, entry, exchangeStop: true, exchangeTarget: true };
  const baseStep = 10 ** -num(info.lotSizeFilter?.basePrecision || "4");
  const qtyStr = qtyString(qty, baseStep || 0.00000001);
  let exchangeStop = false;
  if (stop > 0 && stop < entry) {
    try {
      await bybitSigned({
        venue: args.venue,
        key: args.key,
        secret: args.secret,
        method: "POST",
        path: "/v5/order/create",
        body: {
          category: "spot",
          symbol: args.symbol,
          side: "Sell",
          orderType: "Market",
          qty: qtyStr,
          triggerPrice: stop.toFixed(Math.min(8, decimals(tick))),
          orderFilter: "tpslOrder",
          orderLinkId: `${orderLinkId}s`.slice(0, 36),
        },
      });
      exchangeStop = true;
    } catch {
      /* стоп на біржі не став — вкладка лишається сторожем */
    }
  }
  return { orderId, qty, entry, exchangeStop };
}

type OrderRow = {
  orderStatus?: string;
  avgPrice?: string;
  cumExecQty?: string;
  cumExecValue?: string;
};

async function readOrder(
  venue: "demo" | "real",
  key: string,
  secret: string,
  market: MarketKind,
  symbol: string,
  orderId: string,
): Promise<OrderRow | null> {
  if (!orderId) return null;
  await new Promise((r) => setTimeout(r, 350));
  for (const path of ["/v5/order/realtime", "/v5/order/history"] as const) {
    try {
      const data = await bybitSigned<{ list?: OrderRow[] }>({
        venue,
        key,
        secret,
        method: "GET",
        path,
        query: { category: market, symbol, orderId },
      });
      const row = data.list?.[0];
      if (row) return row;
    } catch {
      /* try the other book */
    }
  }
  return null;
}

export async function findLinearPositions(args: {
  venue: "demo" | "real";
  key: string;
  secret: string;
}): Promise<
  | {
      ok: true;
      rows: {
        symbol: string;
        side: "long" | "short";
        size: number;
        avg: number;
        stop: number;
        take: number;
        leverage: number;
        unrealised: number;
      }[];
    }
  | { ok: false; error: string; code?: string }
> {
  try {
    const pos = await bybitSigned<{
      list?: {
        symbol?: string;
        size?: string;
        side?: string;
        avgPrice?: string;
        stopLoss?: string;
        takeProfit?: string;
        leverage?: string;
        unrealisedPnl?: string;
      }[];
    }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "GET",
      path: "/v5/position/list",
      query: { category: "linear", settleCoin: "USDT" },
    });
    const rows = (pos.list ?? [])
      .filter((row) => num(row.size) > 0 && UNIVERSE_OK(String(row.symbol ?? "")))
      .map((row) => ({
        symbol: String(row.symbol),
        side: row.side === "Sell" ? ("short" as const) : ("long" as const),
        size: num(row.size),
        avg: num(row.avgPrice),
        stop: num(row.stopLoss),
        take: num(row.takeProfit),
        leverage: Math.min(3, Math.max(1, Math.round(num(row.leverage) || 1))),
        unrealised: num(row.unrealisedPnl),
      }));
    return { ok: true, rows };
  } catch (error) {
    return fail(error);
  }
}

export async function syncPosition(args: {
  venue: "demo" | "real";
  key: string;
  secret: string;
  market: MarketKind;
  symbol: string;
  orderId?: string;
  qty?: number;
  openedAt?: number;
}): Promise<SyncResult> {
  try {
    const ticker = await bybitSigned<{ list?: { lastPrice?: string }[] }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "GET",
      path: "/v5/market/tickers",
      query: { category: args.market, symbol: args.symbol },
    });
    const last = num(ticker.list?.[0]?.lastPrice);
    if (args.market === "linear") {
      const pos = await bybitSigned<{
        list?: { size?: string; avgPrice?: string; unrealisedPnl?: string; side?: string; stopLoss?: string }[];
      }>({
        venue: args.venue,
        key: args.key,
        secret: args.secret,
        method: "GET",
        path: "/v5/position/list",
        query: { category: "linear", symbol: args.symbol },
      });
      const row = pos.list?.find((p) => num(p.size) > 0) ?? pos.list?.[0];
      const size = num(row?.size);
      let exitPrice = 0;
      let closedPnl: number | null = null;
      if (!(size > 0)) {
        try {
          const done = await bybitSigned<{
            list?: { avgExitPrice?: string; closedPnl?: string; updatedTime?: string }[];
          }>({
            venue: args.venue,
            key: args.key,
            secret: args.secret,
            method: "GET",
            path: "/v5/position/closed-pnl",
            query: { category: "linear", symbol: args.symbol, limit: "1" },
          });
          const lastClose = done.list?.[0];
          const updated = num(lastClose?.updatedTime);
          const fresh = !args.openedAt || updated >= args.openedAt - 120_000;
          const exit = num(lastClose?.avgExitPrice);
          if (fresh && exit > 0) {
            exitPrice = exit;
            closedPnl = num(lastClose?.closedPnl);
          }
        } catch {
          /* запасний вихід — остання ціна */
        }
      }
      return {
        ok: true,
        flat: !(size > 0),
        size,
        avgPrice: num(row?.avgPrice),
        last,
        unrealisedPnl: num(row?.unrealisedPnl),
        orderStatus: size > 0 ? "open" : "flat",
        exchangeStop: num(row?.stopLoss) > 0,
        exitPrice,
        closedPnl,
      };
    }
    const base = args.symbol.replace(/USDT$/, "");
    const wallet = await bybitSigned<{
      list?: { coin?: { coin?: string; walletBalance?: string }[] }[];
    }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "GET",
      path: "/v5/account/wallet-balance",
      query: { accountType: "UNIFIED", coin: base },
    });
    const held = num(wallet.list?.[0]?.coin?.find((coin) => coin.coin === base)?.walletBalance);
    const qty = args.qty ?? 0;
    const flat = qty > 0 ? !(held > qty * 0.5) : !(held > 0);
    const open = await bybitSigned<{ list?: { orderStatus?: string }[] }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "GET",
      path: "/v5/order/realtime",
      query: { category: "spot", symbol: args.symbol, orderFilter: "tpslOrder" },
    });
    const armed = (open.list ?? []).some((order) =>
      /untriggered|new|active/i.test(order.orderStatus ?? ""),
    );
    const order = args.orderId
      ? await readOrder(args.venue, args.key, args.secret, "spot", args.symbol, args.orderId)
      : null;
    return {
      ok: true,
      flat,
      size: num(order?.cumExecQty) || held,
      avgPrice: num(order?.avgPrice),
      last,
      unrealisedPnl: 0,
      orderStatus: flat ? "flat" : (order?.orderStatus ?? "open"),
      exchangeStop: armed,
      exitPrice: 0,
      closedPnl: null,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function closePosition(args: {
  venue: "demo" | "real";
  key: string;
  secret: string;
  market: MarketKind;
  symbol: string;
  side: "Buy" | "Sell";
  qty: number;
}): Promise<{ ok: true; exit: number } | { ok: false; error: string; code?: string }> {
  try {
    const info = await instrument(args.venue, args.key, args.secret, args.market, args.symbol);
    const step =
      num(info.lotSizeFilter?.qtyStep) ||
      (args.market === "spot" ? 10 ** -num(info.lotSizeFilter?.basePrecision || "4") : 0.001);
    const qty = floorToStep(args.qty, step);
    if (!(qty > 0)) return { ok: false, error: "Немає кількості для закриття." };
    const exitSide = args.side === "Buy" ? "Sell" : "Buy";
    const orderLinkId = `p5c${Date.now().toString(36)}`.slice(0, 32);
    const qtyStr = qtyString(qty, step);
    let created: { orderId?: string } | null = null;
    if (args.market === "linear") {
      let idx: 0 | 1 | 2 = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          created = await bybitSigned<{ orderId?: string }>({
            venue: args.venue,
            key: args.key,
            secret: args.secret,
            method: "POST",
            path: "/v5/order/create",
            body: {
              category: "linear",
              symbol: args.symbol,
              side: exitSide,
              orderType: "Market",
              qty: qtyStr,
              reduceOnly: true,
              positionIdx: idx,
              orderLinkId: `${orderLinkId}${attempt}`.slice(0, 36),
            },
          });
          break;
        } catch (error) {
          const msg = error instanceof Error ? error.message : "";
          if (attempt === 0 && /position idx|position mode/i.test(msg)) {
            idx = args.side === "Buy" ? 1 : 2;
            continue;
          }
          throw error;
        }
      }
    } else {
      try {
        await bybitSigned({
          venue: args.venue,
          key: args.key,
          secret: args.secret,
          method: "POST",
          path: "/v5/order/cancel-all",
          body: { category: "spot", symbol: args.symbol, orderFilter: "tpslOrder" },
        });
      } catch {
        /* захисних ордерів могло не бути */
      }
      const base = args.symbol.replace(/USDT$/, "");
      const wallet = await bybitSigned<{
        list?: { coin?: { coin?: string; walletBalance?: string }[] }[];
      }>({
        venue: args.venue,
        key: args.key,
        secret: args.secret,
        method: "GET",
        path: "/v5/account/wallet-balance",
        query: { accountType: "UNIFIED", coin: base },
      });
      const held = num(wallet.list?.[0]?.coin?.find((coin) => coin.coin === base)?.walletBalance);
      if (!(held > 0) || held < qty * 0.5) {
        const ticker = await bybitSigned<{ list?: { lastPrice?: string }[] }>({
          venue: args.venue,
          key: args.key,
          secret: args.secret,
          method: "GET",
          path: "/v5/market/tickers",
          query: { category: "spot", symbol: args.symbol },
        });
        return { ok: true, exit: num(ticker.list?.[0]?.lastPrice) };
      }
      created = await bybitSigned<{ orderId?: string }>({
        venue: args.venue,
        key: args.key,
        secret: args.secret,
        method: "POST",
        path: "/v5/order/create",
        body: {
          category: "spot",
          symbol: args.symbol,
          side: "Sell",
          orderType: "Market",
          qty: qtyString(Math.min(qty, held), step),
          marketUnit: "baseCoin",
          orderLinkId,
        },
      });
    }
    const filled = await readOrder(
      args.venue,
      args.key,
      args.secret,
      args.market,
      args.symbol,
      created?.orderId ?? "",
    );
    const ticker = await bybitSigned<{ list?: { lastPrice?: string }[] }>({
      venue: args.venue,
      key: args.key,
      secret: args.secret,
      method: "GET",
      path: "/v5/market/tickers",
      query: { category: args.market, symbol: args.symbol },
    });
    return { ok: true, exit: num(filled?.avgPrice) || num(ticker.list?.[0]?.lastPrice) };
  } catch (error) {
    return fail(error);
  }
}
