import { atr, ema, rsi, sma, type Candle } from "@/lib/trading/math";
import type { TapeBias } from "@/lib/trading/context";
import { cryptoFundingBlock } from "@/lib/trading/risk";
import type { BoardRow, Lesson, MarketKind, Side } from "@/lib/trading/types";

export type RawMarket = {
  symbol: string;
  last: number;
  changePct: number;
  turnover: number;
  funding: number | null;
  candles: Candle[];
};

function fingerprint(symbol: string, side: string, atrPct: number, up: boolean): string {
  const heat = atrPct > 0.02 ? "hot" : atrPct < 0.004 ? "quiet" : "normal";
  return `${symbol}|${side}|${up ? "up" : "down"}|${heat}`;
}

function lossPenalty(lessons: Lesson[], fp: string): number {
  const hit = lessons.find((l) => l.fp === fp);
  if (!hit) return 0;
  if (hit.losses >= 2) return 100;
  if (hit.losses === 1) return 14;
  return 0;
}

export function rankMarkets(
  rows: RawMarket[],
  market: MarketKind,
  lessons: Lesson[],
  recent: string[],
  threshold: number,
  bias?: TapeBias | null,
): BoardRow[] {
  const ranked = rows.map((row) => scoreOne(row, market, lessons, recent, threshold, bias));
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function scoreOne(
  row: RawMarket,
  market: MarketKind,
  lessons: Lesson[],
  recent: string[],
  threshold: number,
  bias?: TapeBias | null,
): BoardRow {
  const closed = row.candles.filter((c) => c.c > 0);
  const spark = closed.slice(-36).map((c) => c.c);
  const lastBar = closed[closed.length - 1];
  const base: BoardRow = {
    symbol: row.symbol,
    last: row.last,
    changePct: row.changePct,
    turnover: row.turnover,
    funding: row.funding,
    rsi: 50,
    atrPct: 0,
    side: "flat",
    score: 0,
    tradable: false,
    entry: row.last,
    stop: 0,
    take: 0,
    reasons: [],
    fingerprint: "",
    spark,
    barT: lastBar?.t ?? 0,
    barH: lastBar?.h ?? 0,
    barL: lastBar?.l ?? 0,
    volRatio: 1,
  };
  if (closed.length < 60 || !(row.last > 0)) {
    base.reasons = ["Замало свічок для краю."];
    return base;
  }
  const closes = closed.map((c) => c.c);
  const emaFast = ema(closes, 20);
  const emaSlow = ema(closes, 50);
  const emaPrev = ema(closes.slice(0, -3), 20);
  const rsiNow = rsi(closes, 14);
  const atrNow = atr(closed, 14);
  const atrPct = atrNow / row.last;
  const gap = (emaFast - emaSlow) / row.last;
  const slope = (emaFast - emaPrev) / row.last;
  const vols = closed.map((c) => c.v);
  const volBase = sma(vols.slice(0, -1), 20);
  const volRatio = volBase > 0 ? (vols[vols.length - 1] ?? 0) / volBase : 1;
  const reasons: string[] = [];
  let side: Side | "flat" = "flat";

  const upTrend = emaFast > emaSlow && row.last > emaFast && slope > 0;
  const downTrend = emaFast < emaSlow && row.last < emaFast && slope < 0;
  const pullbackLong =
    emaFast > emaSlow &&
    Math.abs(row.last - emaFast) <= atrNow * 0.45 &&
    rsiNow >= 42 &&
    rsiNow <= 62 &&
    slope >= -0.0002;

  if (upTrend && rsiNow >= 48 && rsiNow <= 72) {
    side = "long";
    reasons.push("EMA20 над EMA50, ціна над швидкою, RSI не перегрітий.");
  } else if (pullbackLong) {
    side = "long";
    reasons.push("Відкат до EMA20 у висхідному краї.");
  } else if (market === "linear" && downTrend && rsiNow >= 28 && rsiNow <= 54) {
    side = "short";
    reasons.push("EMA20 під EMA50, коротке вікно на ф'ючерсі.");
  } else if (market === "spot" && downTrend) {
    reasons.push("Спадний край. На споті шорт не відкриваю.");
  } else {
    reasons.push("Немає чистого краю між EMA.");
  }

  if (volRatio >= 1) reasons.push(`Обсяг ${volRatio.toFixed(1)}× середнього, оборот ${formatTurnover(row.turnover)}.`);
  else reasons.push(`Обсяг тонкий, ${volRatio.toFixed(1)}× середнього. Оборот ${formatTurnover(row.turnover)}.`);

  if (atrPct < 0.0015) reasons.push("Замало ходу для стопа.");
  if (atrPct > 0.045) reasons.push("Заширокий ATR для цього вікна.");

  let score = 0;
  if (side !== "flat") score += 34;
  score += Math.min(18, Math.abs(gap) * 9000);
  score += Math.min(12, Math.abs(slope) * 14000);
  if (side === "long" && rsiNow >= 50 && rsiNow <= 66) score += 12;
  if (side === "short" && rsiNow >= 34 && rsiNow <= 50) score += 12;
  if (volRatio >= 1 && volRatio < 3) score += 8;
  if (atrPct >= 0.003 && atrPct <= 0.02) score += 10;
  if (row.turnover >= 20_000_000) score += 6;

  if (side === "long" && (row.funding ?? 0) > 0.0004) {
    score -= 10;
    reasons.push("Фандинг дорогий для лонга.");
  }
  if (side === "short" && (row.funding ?? 0) < -0.0004) {
    score -= 10;
    reasons.push("Фандинг дорогий для шорта.");
  }
  if (recent.includes(row.symbol)) {
    score -= 10;
    reasons.push("Ця пара вже була в сьогоднішній сесії.");
  }
  const symbol = row.symbol as keyof TapeBias["longPct"];
  const longPct = bias?.longPct?.[symbol];
  if (longPct != null && side === "long" && longPct >= 0.68) {
    score -= 8;
    reasons.push(`Рахунки вже ${Math.round(longPct * 100)}% у лонгу.`);
  }
  if (longPct != null && side === "short" && longPct <= 0.34) {
    score -= 8;
    reasons.push(`Рахунки вже ${Math.round((1 - longPct) * 100)}% у шорті.`);
  }
  if (bias?.fear != null && side === "long" && bias.fear >= 80) {
    score -= 6;
    reasons.push(`Жадібність ${bias.fear}. Лонг без поспіху.`);
  }
  if (bias?.fear != null && side === "short" && bias.fear <= 20) {
    score -= 6;
    reasons.push(`Крайній страх ${bias.fear}. Шорт без поспіху.`);
  }
  const shocked =
    !!bias && (bias.shockAll || bias.shocked.includes(row.symbol as (typeof bias.shocked)[number]));
  if (shocked && bias?.shockNote) reasons.push(bias.shockNote);
  const fundingNote = side === "flat" ? "" : cryptoFundingBlock(market, side, row.funding);
  if (fundingNote) reasons.push(fundingNote);

  const stopDist = Math.max(atrNow * 1.55, row.last * 0.0025);
  const entry = row.last;
  const stop = side === "short" ? entry + stopDist : entry - stopDist;
  const take =
    side === "short" ? entry - stopDist * 1.85 : side === "long" ? entry + stopDist * 1.85 : 0;
  const fp = side === "flat" ? "" : fingerprint(row.symbol, side, atrPct, gap >= 0);
  const pen = fp ? lossPenalty(lessons, fp) : 0;
  if (pen >= 100) reasons.push("Відбиток двічі в мінусі. Пропускаю.");
  else if (pen > 0) reasons.push("Один мінус на цьому відбитку. Штраф до бала.");
  score -= pen;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const geometryOk =
    side !== "flat" &&
    atrPct >= 0.0015 &&
    atrPct <= 0.045 &&
    stop > 0 &&
    Math.abs(entry - stop) / entry >= 0.0015 &&
    Math.abs(entry - stop) / entry <= 0.08;
  const tradable = geometryOk && score >= threshold && pen < 100 && !shocked && !fundingNote;

  return {
    ...base,
    rsi: rsiNow,
    atrPct,
    side,
    score,
    tradable,
    entry,
    stop: side === "flat" ? 0 : stop,
    take: side === "flat" ? 0 : take,
    reasons,
    fingerprint: fp,
    volRatio,
  };
}

export function formatTurnover(n: number): string {
  if (!(n > 0)) return "немає обороту";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} млрд`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} млн`;
  return `${Math.round(n / 1_000)} тис`;
}

export function liquidityScore(row: { turnover: number; volRatio?: number }): number {
  const depth =
    row.turnover >= 100_000_000 ? 1 : row.turnover >= 30_000_000 ? 0.66 : row.turnover >= 15_000_000 ? 0.4 : 0.18;
  const vol = Math.min(1, Math.max(0, (row.volRatio ?? 1) / 1.6));
  return Math.round(Math.min(100, (depth * 0.72 + vol * 0.28) * 100));
}

export function liquidityLine(row: BoardRow): string {
  const vol = row.volRatio ?? 0;
  if (!(row.turnover > 0)) return "";
  const depth = row.turnover >= 100_000_000 ? "глибока" : row.turnover >= 30_000_000 ? "нормальна" : "тонка";
  const flow = vol >= 1.5 ? "обсяг росте" : vol >= 1 ? "обсяг звичайний" : "обсяг нижче середнього";
  return `${depth}, ${formatTurnover(row.turnover)} за добу, ${flow} (${vol.toFixed(1)}×)`;
}

export function marketBrief(rows: BoardRow[]): string {
  if (!rows.length) return "";
  const up = rows.filter((row) => row.changePct > 0).length;
  const longs = rows.filter((row) => row.side === "long").length;
  const shorts = rows.filter((row) => row.side === "short").length;
  const hot = rows.filter((row) => (row.volRatio ?? 0) >= 1).length;
  const deep = rows.filter((row) => row.turnover >= 100_000_000).length;
  const thin = rows.filter((row) => row.turnover > 0 && row.turnover < 30_000_000).length;
  const turnovers = rows.map((row) => row.turnover).filter((n) => n > 0).sort((a, b) => a - b);
  const mid = turnovers.length ? turnovers[Math.floor(turnovers.length / 2)] : 0;
  const majors = rows
    .filter((row) => row.symbol === "BTCUSDT" || row.symbol === "ETHUSDT")
    .map((row) => `${row.symbol.replace("USDT", "")} ${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(1)}%`)
    .join(", ");
  return `Ринок: ${up} з ${rows.length} у плюсі за добу, лонгів ${longs}, шортів ${shorts}. Обсяг вище середнього в ${hot} з ${rows.length}. Медіана обороту ${formatTurnover(mid)}. Глибоких ${deep}, тонших ${thin}.${majors ? ` ${majors}.` : ""}`;
}

export function localCritic(row: BoardRow): { verdict: "allow" | "veto"; note: string } {
  if (!row.tradable || row.side === "flat") {
    return { verdict: "veto", note: "Сетап не дотягує до порога ради." };
  }
  const risk = Math.abs(row.entry - row.stop);
  const reward = Math.abs(row.take - row.entry);
  if (!(reward / risk >= 1.7)) {
    return { verdict: "veto", note: "Співвідношення прибутку до стопа нижче 1.7." };
  }
  if (row.side === "long" && !(row.stop < row.entry && row.take > row.entry)) {
    return { verdict: "veto", note: "Стоп або ціль стоять не з того боку." };
  }
  if (row.side === "short" && !(row.stop > row.entry && row.take < row.entry)) {
    return { verdict: "veto", note: "Стоп або ціль стоять не з того боку." };
  }
  return {
    verdict: "allow",
    note: `${row.symbol} ${row.side === "long" ? "лонг" : "шорт"}, бал ${row.score}. Стоп і розмір лишаються за ризик-модулем.`,
  };
}
