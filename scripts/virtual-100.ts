import { ema, type Candle } from "../src/lib/trading/math";
import { rankMarkets, type RawMarket } from "../src/lib/trading/strategy";
import type { Lesson } from "../src/lib/trading/types";

const UNIVERSE = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "ADAUSDT",
  "DOGEUSDT",
] as const;

const FEE = 0.0008;
const HORIZON = 16;
const DAYS = Number(process.env.DAYS || 75);
const INTERVAL = process.env.INTERVAL || "15m";

type Bar = Candle;
type Closed = {
  symbol: string;
  side: "long" | "short";
  r: number;
  reason: "stop" | "take" | "time";
  thin: boolean;
  setup: "pullback" | "chase" | "short";
  t: number;
};

async function load(symbol: string, interval = INTERVAL): Promise<Bar[]> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - DAYS * 86400;
  const pair = `${symbol.replace(/USDT$/, "")}_USDT`;
  const out: Bar[] = [];
  let end = now;
  while (end > start + 60) {
    const from = Math.max(start, end - 18 * 86400);
    const url = `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${pair}&interval=${interval}&from=${from}&to=${end}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${symbol} ${res.status}`);
    const rows = (await res.json()) as { o: string; h: string; l: string; c: string; v: number; t: number }[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const c of rows) {
      const bar = { t: Number(c.t) * 1000, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c), v: Number(c.v) };
      if (bar.c > 0 && bar.h >= bar.l) out.push(bar);
    }
    end = from - 1;
  }
  const map = new Map<number, Bar>();
  for (const bar of out) map.set(bar.t, bar);
  return [...map.values()].sort((a, b) => a.t - b.t);
}

function sliceBefore(bars: Bar[], t: number): Bar[] {
  let hi = bars.length;
  let lo = 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return bars.slice(Math.max(0, lo - 120), lo);
}

function htfBias(bars: Bar[] | undefined, t: number): "up" | "down" | "none" {
  if (!bars) return "none";
  const closes: number[] = [];
  for (const bar of bars) {
    if (bar.t + 4 * 60 * 60 * 1000 <= t) closes.push(bar.c);
  }
  if (closes.length < 60) return "none";
  const window = closes.slice(-80);
  const fast = ema(window, 20);
  const slow = ema(window, 50);
  if (fast > slow) return "up";
  if (fast < slow) return "down";
  return "none";
}

function replay(
  books: Map<string, Bar[]>,
  threshold: number,
  higher?: Map<string, Bar[]>,
  letWinners = false,
  targetR = 0,
  mode: "base" | "shock" | "pullback" | "long" | "majors" | "longMajors" = "base",
): Closed[] {
  const anchor = books.get("BTCUSDT");
  if (!anchor) return [];
  const trades: Closed[] = [];
  let lessons: Lesson[] = [];
  let recent: string[] = [];
  let recentDay = "";
  let held: {
    symbol: string;
    side: "long" | "short";
    entry: number;
    stop: number;
    take: number;
    dist: number;
    thin: boolean;
    setup: Closed["setup"];
    left: number;
    once: boolean;
    fp: string;
    t: number;
  } | null = null;

  for (const stamp of anchor) {
    const day = new Date(stamp.t).toISOString().slice(0, 10);
    if (day !== recentDay) {
      recentDay = day;
      recent = [];
    }
    if (held) {
      const bar = books.get(held.symbol)?.find((item) => item.t === stamp.t);
      held.left -= 1;
      if (bar) {
        const stopHit = held.side === "long" ? bar.l <= held.stop : bar.h >= held.stop;
        const takeHit = held.side === "long" ? bar.h >= held.take : bar.l <= held.take;
        let exit = 0;
        let reason: Closed["reason"] = "time";
        if (stopHit) {
          exit = held.stop;
          reason = "stop";
        } else if (takeHit) {
          exit = held.take;
          reason = "take";
        } else if (held.left <= 0) {
          const openR = held.side === "long" ? (bar.c - held.entry) / held.dist : (held.entry - bar.c) / held.dist;
          if (letWinners && !held.once && openR >= 0.5) {
            held.stop = held.entry;
            held.once = true;
            held.left = 16;
          } else {
            exit = bar.c;
            reason = "time";
          }
        }
        if (exit > 0) {
          const gross = held.side === "long" ? (exit - held.entry) / held.dist : (held.entry - exit) / held.dist;
          const cost = (held.entry * FEE * 2) / held.dist;
          const r = gross - cost;
          trades.push({ symbol: held.symbol, side: held.side, r, reason, thin: held.thin, setup: held.setup, t: held.t });
          const prev = lessons.find((lesson) => lesson.fp === held.fp);
          const losses = r < 0 ? (prev?.losses ?? 0) + 1 : Math.max(0, (prev?.losses ?? 0) - 1);
          lessons = [{ fp: held.fp, losses, note: "", at: stamp.t }, ...lessons.filter((lesson) => lesson.fp !== held.fp)].slice(0, 40);
          if (!recent.includes(held.symbol)) recent.push(held.symbol);
          held = null;
        }
      } else if (held.left <= 0) {
        held = null;
      }
      continue;
    }

    const raw: RawMarket[] = [];
    for (const symbol of UNIVERSE) {
      const bars = books.get(symbol);
      if (!bars) continue;
      const closed = sliceBefore(bars, stamp.t);
      const last = closed[closed.length - 1];
      const prev = closed[closed.length - 2];
      if (!last || !prev || !(last.c > 0)) continue;
      raw.push({
        symbol,
        last: last.c,
        changePct: ((last.c - prev.c) / prev.c) * 100,
        turnover: 30_000_000,
        funding: null,
        candles: closed,
      });
    }
    const ranked = rankMarkets(raw, "linear", lessons, recent, threshold);
    const pick = ranked.find((row) => {
      if (!row.tradable || row.side === "flat") return false;
      if (mode === "pullback" && !row.reasons.some((reason) => reason.includes("Відкат"))) return false;
      if (mode === "long" || mode === "longMajors") {
        if (row.side !== "long") return false;
      }
      if (mode === "majors" || mode === "longMajors") {
        if (row.symbol !== "BTCUSDT" && row.symbol !== "ETHUSDT") return false;
      }
      if (mode === "shock") {
        const bars = sliceBefore(books.get(row.symbol) ?? [], stamp.t);
        const last = bars[bars.length - 1];
        if (last && row.atrPct > 0 && (last.h - last.l) / last.c > row.atrPct * 2.2) return false;
      }
      if (!higher) return true;
      const bias = htfBias(higher.get(row.symbol), stamp.t);
      return row.side === "long" ? bias === "up" : bias === "down";
    });
    if (!pick) continue;
    const entryBar = books.get(pick.symbol)?.find((item) => item.t === stamp.t);
    if (!entryBar) continue;
    const slip = pick.side === "long" ? 1 + 0.0002 : 1 - 0.0002;
    const entry = entryBar.o * slip;
    const dist = Math.abs(entry - pick.stop);
    if (!(dist > 0) || !(entry > 0)) continue;
    const side = pick.side === "short" ? "short" : "long";
    if (side === "long" && !(pick.stop < entry)) continue;
    if (side === "short" && !(pick.stop > entry)) continue;
    const take =
      targetR > 0 ? (side === "long" ? entry + dist * targetR : entry - dist * targetR) : pick.take;
    if (side === "long" && !(take > entry)) continue;
    if (side === "short" && !(take < entry)) continue;
    const stopHit = side === "long" ? entryBar.l <= pick.stop : entryBar.h >= pick.stop;
    const takeHit = side === "long" ? entryBar.h >= take : entryBar.l <= take;
    const thin = pick.reasons.some((reason) => reason.includes("тонкий"));
    const setup: Closed["setup"] = pick.reasons.some((reason) => reason.includes("Відкат"))
      ? "pullback"
      : pick.side === "short"
        ? "short"
        : "chase";
    if (stopHit || takeHit) {
      const exit = stopHit ? pick.stop : take;
      const gross = side === "long" ? (exit - entry) / dist : (entry - exit) / dist;
      const r = gross - (entry * FEE * 2) / dist;
      trades.push({ symbol: pick.symbol, side, r, reason: stopHit ? "stop" : "take", thin, setup, t: stamp.t });
      const prev = lessons.find((lesson) => lesson.fp === pick.fingerprint);
      const losses = r < 0 ? (prev?.losses ?? 0) + 1 : Math.max(0, (prev?.losses ?? 0) - 1);
      lessons = [{ fp: pick.fingerprint, losses, note: "", at: stamp.t }, ...lessons.filter((lesson) => lesson.fp !== pick.fingerprint)].slice(0, 40);
      if (!recent.includes(pick.symbol)) recent.push(pick.symbol);
      continue;
    }
    held = {
      symbol: pick.symbol,
      side,
      entry,
      stop: pick.stop,
      take,
      dist,
      thin,
      setup,
      left: HORIZON - 1,
      once: false,
      fp: pick.fingerprint,
      t: stamp.t,
    };
  }
  return trades;
}

function pack(trades: Closed[]) {
  const wins = trades.filter((trade) => trade.r > 0);
  const losses = trades.filter((trade) => trade.r <= 0);
  const sum = trades.reduce((acc, trade) => acc + trade.r, 0);
  const gain = wins.reduce((acc, trade) => acc + trade.r, 0);
  const pain = Math.abs(losses.reduce((acc, trade) => acc + trade.r, 0));
  let streak = 0;
  let worst = 0;
  let equity = 0;
  let peak = 0;
  let dd = 0;
  for (const trade of trades) {
    streak = trade.r <= 0 ? streak + 1 : 0;
    worst = Math.max(worst, streak);
    equity += trade.r;
    peak = Math.max(peak, equity);
    dd = Math.max(dd, peak - equity);
  }
  const thin = trades.filter((trade) => trade.thin);
  const thick = trades.filter((trade) => !trade.thin);
  const avg = (rows: Closed[]) => (rows.length ? rows.reduce((acc, trade) => acc + trade.r, 0) / rows.length : 0);
  return {
    n: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    avgR: trades.length ? sum / trades.length : 0,
    profitFactor: pain > 0 ? gain / pain : gain > 0 ? 99 : 0,
    worstStreak: worst,
    maxDdR: dd,
    thinN: thin.length,
    thinAvgR: avg(thin),
    thickAvgR: avg(thick),
  };
}

const books = new Map<string, Bar[]>();
for (const symbol of UNIVERSE) {
  const bars = await load(symbol, "15m");
  books.set(symbol, bars);
  console.error(symbol, bars.length);
}
const all = replay(books, 64);
const longs = replay(books, 64, undefined, false, 0, "long");
const majors = replay(books, 64, undefined, false, 0, "majors");
const longMajors = replay(books, 64, undefined, false, 0, "longMajors");
function half(trades: Closed[]) {
  const cut = Math.floor(trades.length * 0.5);
  return { all: pack(trades), early: pack(trades.slice(0, cut)), late: pack(trades.slice(cut)) };
}
const report = {
  days: DAYS,
  rule: "поріг 64, 15m, стоп 1.55 ATR, комісія 8 б.п. на сторону, половини за порядком угод",
  baseline: half(all),
  longOnly: half(longs),
  majors: half(majors),
  longMajors: half(longMajors),
};
console.log(JSON.stringify(report, null, 2));
