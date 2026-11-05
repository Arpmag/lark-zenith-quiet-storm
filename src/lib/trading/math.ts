export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0] ?? 0;
  for (let i = 1; i < values.length; i++) {
    const v = values[i] ?? e;
    e = v * k + e * (1 - k);
  }
  return e;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = (values[i] ?? 0) - (values[i - 1] ?? 0);
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]?.c ?? 0;
    const c = candles[i];
    if (!c) continue;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - prev), Math.abs(c.l - prev)));
  }
  if (trs.length === 0) return 0;
  if (trs.length < period) {
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) {
    a = (a * (period - 1) + (trs[i] ?? a)) / period;
  }
  return a;
}

export function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function stepDecimals(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = step.toString().toLowerCase();
  if (s.includes("e-")) {
    const n = Number(s.split("e-")[1]);
    return Number.isFinite(n) ? n : 0;
  }
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

export function floorToStep(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value)) return value;
  const n = Math.floor(value / step + 1e-9) * step;
  return Number(n.toFixed(stepDecimals(step)));
}

export function roundToTick(value: number, tick: number, dir: "up" | "down" | "near"): number {
  if (!(tick > 0) || !Number.isFinite(value)) return value;
  const q = value / tick;
  const n =
    dir === "up" ? Math.ceil(q - 1e-9) : dir === "down" ? Math.floor(q + 1e-9) : Math.round(q);
  return Number((n * tick).toFixed(stepDecimals(tick)));
}

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1);
  return x.toISOString().slice(0, 10);
}

export function formatHm(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m} UTC`;
}

export function formatPx(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(1);
  if (abs >= 100) return n.toFixed(2);
  if (abs >= 1) return n.toFixed(3);
  if (abs >= 0.01) return n.toFixed(5);
  return n.toPrecision(4);
}

export function formatUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
