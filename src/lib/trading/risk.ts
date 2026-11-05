import { clamp } from "@/lib/trading/math";
import type { MarketKind, Side } from "@/lib/trading/types";

export type Size =
  | {
      ok: true;
      notional: number;
      leverage: number;
      margin: number;
      riskUsd: number;
      qty: number;
    }
  | { ok: false; error: string };

const FEE = { spot: 0.001, linear: 0.00055 } as const;

export function breakevenPx(args: { market: MarketKind; side: Side; entry: number }): number {
  const fee = FEE[args.market];
  if (!(args.entry > 0)) return 0;
  if (args.side === "long") return (args.entry * (1 + fee)) / (1 - fee);
  return (args.entry * (1 - fee)) / (1 + fee);
}

export function closeReading(args: {
  market: MarketKind;
  side: Side;
  qty: number;
  entry: number;
  stop: number;
  unrealized: number;
}): { mark: number; openFee: number; closeFee: number; net: number; r: number } {
  const fee = FEE[args.market];
  const qty = args.qty > 0 ? args.qty : 0;
  const mark =
    qty > 0
      ? args.side === "long"
        ? args.entry + args.unrealized / qty
        : args.entry - args.unrealized / qty
      : args.entry;
  const openFee = qty * args.entry * fee;
  const closeFee = qty * mark * fee;
  const net = args.unrealized - openFee - closeFee;
  const risk = qty * Math.abs(args.entry - args.stop);
  return { mark, openFee, closeFee, net, r: risk > 0 ? args.unrealized / risk : 0 };
}

export function sizePosition(args: {
  market: MarketKind;
  side: Side;
  weeklyUsd: number;
  riskPct: number;
  entry: number;
  stop: number;
}): Size {
  const weekly = args.weeklyUsd;
  if (!(weekly >= 30) || !(args.entry > 0)) {
    return { ok: false, error: "Тижнева сума має бути від 30 USDT." };
  }
  const riskPct = clamp(args.riskPct, 0.004, 0.015);
  const dist = Math.abs(args.entry - args.stop) / args.entry;
  if (dist < 0.0015 || dist > 0.08) {
    return { ok: false, error: "Дистанція стопа непридатна." };
  }
  if (args.side === "long" && !(args.stop < args.entry)) {
    return { ok: false, error: "Стоп лонга вище входу." };
  }
  if (args.side === "short" && !(args.stop > args.entry)) {
    return { ok: false, error: "Стоп шорта нижче входу." };
  }
  const riskBudget = weekly * riskPct;
  let notional = riskBudget / dist;
  const levCap = args.market === "linear" ? 3 : 1;
  const maxNotional = weekly * 0.22 * levCap;
  if (notional > maxNotional) notional = maxNotional;
  let leverage = 1;
  if (args.market === "linear") {
    leverage = clamp(Math.ceil(notional / Math.max(weekly * 0.12, 1)), 1, 3);
    if (notional / leverage > weekly * 0.2) {
      notional = weekly * 0.2 * leverage;
    }
  }
  if (notional < 10) {
    return { ok: false, error: "Після ліміту ризику номінал нижче 10 USDT." };
  }
  const margin = notional / leverage;
  const qty = notional / args.entry;
  const riskUsd = dist * notional;
  if (riskUsd > weekly * 0.016) {
    return { ok: false, error: "Ризик угоди вищий за жорстку стелю 1.6%." };
  }
  return { ok: true, notional, leverage, margin, riskUsd, qty };
}

export function fitToBalance(
  size: Extract<Size, { ok: true }>,
  args: { market: MarketKind; available: number; entry: number; stop: number; weeklyUsd: number },
): Size {
  const cash = args.available;
  if (!(cash >= 10) || !(args.entry > 0)) {
    return { ok: false, error: "Вільно менше 10 USDT. Ордер не ставлю." };
  }
  const dist = Math.abs(args.entry - args.stop) / args.entry;
  if (!(dist > 0)) return { ok: false, error: "Дистанція стопа непридатна." };
  let notional = size.notional;
  let leverage = args.market === "linear" ? size.leverage : 1;
  if (args.market === "spot") {
    notional = Math.min(notional, cash * 0.98);
    leverage = 1;
  } else if (notional / leverage > cash * 0.85) {
    notional = cash * 0.85 * leverage;
  }
  if (notional > args.weeklyUsd * 0.22 * (args.market === "linear" ? 3 : 1)) {
    notional = args.weeklyUsd * 0.22 * (args.market === "linear" ? 3 : 1);
  }
  if (dist * notional > args.weeklyUsd * 0.016) {
    notional = (args.weeklyUsd * 0.015) / dist;
  }
  if (notional < 10) return { ok: false, error: "Після балансу номінал нижче 10 USDT." };
  const riskUsd = dist * notional;
  return {
    ok: true,
    notional,
    leverage,
    margin: notional / leverage,
    riskUsd,
    qty: notional / args.entry,
  };
}

export function capitalStance(
  trades: { pnl: number; reason: string; closedAt: number }[],
  riskPct: number,
  now = Date.now(),
): { riskPct: number; pause: string; note: string } {
  const day = new Date(now).toISOString().slice(0, 10);
  const stops = trades.filter(
    (trade) => trade.reason === "stop" && new Date(trade.closedAt).toISOString().slice(0, 10) === day,
  ).length;
  if (stops >= 2) {
    return { riskPct, pause: "Два стопи сьогодні. Нових угод до завтра немає.", note: "" };
  }
  const last = trades[0];
  if (last && last.pnl < 0) {
    return {
      riskPct: Math.max(0.004, riskPct / 2),
      pause: "",
      note: "Попередня угода в мінусі. Ризик половини, вище не піднімаю.",
    };
  }
  return { riskPct, pause: "", note: "" };
}

export function cryptoFundingBlock(market: MarketKind, side: Side, funding: number | null): string {
  if (market !== "linear" || funding == null) return "";
  if (side === "long" && funding >= 0.0008) {
    return "Фандинг лонга ≥ 0.08% за інтервал. Угоду не беру: плата більша за частку ризику.";
  }
  if (side === "short" && funding <= -0.0008) {
    return "Фандинг шорта ≤ −0.08% за інтервал. Угоду не беру: плата більша за частку ризику.";
  }
  return "";
}

export function netPnl(args: {
  market: MarketKind;
  side: Side;
  qty: number;
  entry: number;
  exit: number;
}): number {
  const gross =
    args.side === "long"
      ? args.qty * (args.exit - args.entry)
      : args.qty * (args.entry - args.exit);
  const feeRate = FEE[args.market];
  const fees = args.qty * args.entry * feeRate + args.qty * args.exit * feeRate;
  return gross - fees;
}
