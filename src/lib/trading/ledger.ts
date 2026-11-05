import type { BoardRow } from "@/lib/trading/types";

type Status = "open" | "win" | "loss" | "flat";

type PaperCheck = {
  id: string;
  symbol: string;
  side: "long" | "short";
  entry: number;
  stop: number;
  take: number;
  at: number;
  seenT: number;
  status: Status;
  exit?: number;
  r?: number;
};

const KEY = "pyatirka-ledger";
const HORIZON = 4 * 60 * 60 * 1000;
const ROUND_TRIP = 0.0011;

function read(): PaperCheck[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaperCheck[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(rows: PaperCheck[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-48)));
  } catch {
    /* приватний режим */
  }
}

function rOf(side: "long" | "short", entry: number, stop: number, exit: number): number {
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return 0;
  const move = side === "long" ? exit - entry : entry - exit;
  return move / risk;
}

function applyBar(check: PaperCheck, row: BoardRow | undefined, now: number): PaperCheck {
  if (check.status !== "open") return check;
  let next = check;
  const barT = row?.barT ?? 0;
  const barH = row?.barH ?? 0;
  const barL = row?.barL ?? 0;
  if (barT >= check.at && barT > check.seenT && barH > 0 && barL > 0) {
    const stopHit = check.side === "long" ? barL <= check.stop : barH >= check.stop;
    const takeHit = check.side === "long" ? barH >= check.take : barL <= check.take;
    if (stopHit || takeHit) {
      const status: Status = stopHit ? "loss" : "win";
      const exit = stopHit ? check.stop : check.take;
      next = { ...check, seenT: barT, status, exit, r: rOf(check.side, check.entry, check.stop, exit) };
    } else {
      next = { ...check, seenT: barT };
    }
  }
  if (next.status !== "open") return next;
  const last = row?.last ?? 0;
  if (!(last > 0) || now - check.at < HORIZON) return next;
  const move = check.side === "long" ? last - check.entry : check.entry - last;
  const status: Status =
    move > check.entry * ROUND_TRIP ? "win" : move < -check.entry * ROUND_TRIP ? "loss" : "flat";
  return { ...next, status, exit: last, r: rOf(check.side, check.entry, check.stop, last) };
}

export function observeBoard(rows: BoardRow[], now = Date.now()): string {
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
  let checks = read().map((check) => applyBar({ ...check, seenT: check.seenT ?? 0 }, bySymbol.get(check.symbol), now));
  const open = new Set(checks.filter((check) => check.status === "open").map((check) => check.symbol));
  for (const row of rows) {
    if (!row.tradable || (row.side !== "long" && row.side !== "short") || open.has(row.symbol)) continue;
    if (!(row.entry > 0) || !(row.stop > 0) || !(row.take > 0)) continue;
    checks.push({
      id: `${row.symbol}-${now.toString(36)}`,
      symbol: row.symbol,
      side: row.side,
      entry: row.entry,
      stop: row.stop,
      take: row.take,
      at: now,
      seenT: 0,
      status: "open",
    });
    open.add(row.symbol);
  }
  const settled = checks.filter((check) => check.status !== "open");
  const pending = checks.filter((check) => check.status === "open");
  checks = [...settled.slice(-40), ...pending].slice(-48);
  write(checks);
  if (settled.length === 0) {
    return pending.length ? `Перевірка сигналів: ${pending.length} чекають до 4 годин. Поріг не знижую.` : "";
  }
  const wins = settled.filter((check) => check.status === "win").length;
  const avg = settled.reduce((sum, check) => sum + (check.r ?? 0), 0) / settled.length;
  return `Перевірка сигналів: ${settled.length} закритих, ${wins} у плюс після комісії, середнє ${avg.toFixed(2)}R. Ще ${pending.length} відкритих. Рахуються тіні закритих 15-хвилинних свічок. Свічка, де є і стоп, і ціль, іде в мінус. Поріг не знижую.`;
}
