import { UNIVERSE, type SymbolName } from "@/lib/trading/types";

export type TapeBias = {
  fear: number | null;
  fearLabel: string;
  longPct: Partial<Record<SymbolName, number>>;
  shockAll: boolean;
  shocked: SymbolName[];
  shockNote: string;
};

const EMPTY: TapeBias = {
  fear: null,
  fearLabel: "",
  longPct: {},
  shockAll: false,
  shocked: [],
  shockNote: "",
};

const COIN: Record<SymbolName, RegExp> = {
  BTCUSDT: /\b(bitcoin|btc)\b/i,
  ETHUSDT: /\b(ethereum|ether|\beth\b)/i,
  SOLUSDT: /\b(solana|\bsol\b)/i,
  XRPUSDT: /\bxrp\b/i,
  LINKUSDT: /\b(chainlink|\blink\b)/i,
  AVAXUSDT: /\b(avalanche|\bavax\b)/i,
  ADAUSDT: /\b(cardano|\bada\b)/i,
  DOGEUSDT: /\b(dogecoin|\bdoge\b)/i,
};

const SHOCK =
  /\b(hacked|exploit|exploited|funds stolen|stolen funds|trading halt|halted withdrawals|withdrawals (paused|suspended)|delisted|delisting|insolvent|bankruptcy|bankrupt|wallet drained|exchange down|depeg|de-peg|unpeg|lost its peg)\b/i;

const DEPEG = /\b(depeg|de-peg|unpeg|lost its peg|stablecoin)\b/i;

const VENUE = /\b(bybit|binance|coinbase|okx|gate\.io|crypto exchange)\b/i;

const MACRO =
  /\b(cpi|core cpi|fomc|federal funds|interest rate|nfp|non-farm|nonfarm|powell|pce|core pce|gdp|unemployment|ppi|retail sales)\b/i;

function macroStop(rows: unknown, now: number): string {
  if (!Array.isArray(rows)) return "";
  for (const row of rows) {
    const event = row as { title?: string; country?: string; date?: string; impact?: string };
    if (event.country !== "USD" || event.impact !== "High") continue;
    const title = String(event.title ?? "");
    if (!MACRO.test(title)) continue;
    const at = Date.parse(String(event.date ?? ""));
    if (!Number.isFinite(at)) continue;
    if (at - now > 45 * 60 * 1000 || now - at > 20 * 60 * 1000) continue;
    return `Макро-стоп: ${title.slice(0, 80)} (USD)`;
  }
  return "";
}

async function grabText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/rss+xml, application/xml, text/xml" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function rssItems(
  xml: string | null,
  source: string,
  credibility: number,
  reputation: number,
): { title: string; pubDate: string; source: string; credibility: number; reputation: number }[] {
  if (!xml) return [];
  return xml
    .split("<item>")
    .slice(1, 13)
    .map((item) => {
      const title = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]?.trim() ?? "";
      return { title, pubDate, source, credibility, reputation };
    })
    .filter((item) => item.title && item.pubDate);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function grab(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function shockFromNews(json: unknown, now: number): Pick<TapeBias, "shockAll" | "shocked" | "shockNote"> {
  const articles = (json as { articles?: unknown })?.articles;
  if (!Array.isArray(articles)) return { shockAll: false, shocked: [], shockNote: "" };
  const hit = new Set<SymbolName>();
  let all = false;
  let note = "";
  for (const row of articles) {
    const item = row as {
      title?: string;
      pubDate?: string;
      source?: string;
      credibility?: number;
      reputation?: number;
    };
    const title = String(item.title ?? "");
    const at = Date.parse(String(item.pubDate ?? ""));
    if (!title || !Number.isFinite(at) || now - at > 3 * 60 * 60 * 1000 || now < at) continue;
    const trust = num(item.credibility);
    const rep = num(item.reputation);
    if (trust > 0 && trust < 0.7 && rep < 60) continue;
    if (!SHOCK.test(title)) continue;
    const names = UNIVERSE.filter((symbol) => COIN[symbol].test(title));
    if ((VENUE.test(title) && names.length === 0) || DEPEG.test(title)) all = true;
    for (const symbol of names) hit.add(symbol);
    if (!note) note = `${title.slice(0, 110)} (${String(item.source ?? "новина").slice(0, 32)})`;
  }
  return {
    shockAll: all,
    shocked: [...hit],
    shockNote: note ? `Новинний стоп: ${note}` : "",
  };
}

export async function loadTapeBias(now = Date.now()): Promise<{ bias: TapeBias; line: string }> {
  const [fearJson, newsJson, coinDesk, theBlock, cointelegraph, calendar, ...stats] = await Promise.all([
    grab("https://api.alternative.me/fng/?limit=1"),
    grab("https://cryptocurrency.cv/api/breaking?limit=20"),
    grabText("https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml"),
    grabText("https://www.theblock.co/rss.xml"),
    grabText("https://cointelegraph.com/rss"),
    grab("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
    ...UNIVERSE.map((symbol) =>
      grab(
        `https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${symbol.replace(/USDT$/, "")}_USDT&limit=1`,
      ),
    ),
  ]);
  const bias: TapeBias = { ...EMPTY, longPct: {} };
  const fearRow = (fearJson as { data?: { value?: string; value_classification?: string }[] } | null)
    ?.data?.[0];
  if (fearRow) {
    const fear = num(fearRow.value);
    if (fear > 0 && fear <= 100) {
      bias.fear = fear;
      bias.fearLabel = String(fearRow.value_classification ?? "");
    }
  }
  const shock = shockFromNews(
    {
      articles: [
        ...(((newsJson as { articles?: unknown[] } | null)?.articles ?? []) as unknown[]),
        ...rssItems(coinDesk, "CoinDesk", 0.95, 90),
        ...rssItems(theBlock, "The Block", 0.9, 85),
        ...rssItems(cointelegraph, "Cointelegraph", 0.8, 75),
      ],
    },
    now,
  );
  bias.shockAll = shock.shockAll;
  bias.shocked = shock.shocked;
  bias.shockNote = shock.shockNote;
  const macro = macroStop(calendar, now);
  if (macro) {
    bias.shockAll = true;
    bias.shockNote = macro;
  }
  UNIVERSE.forEach((symbol, index) => {
    const rows = stats[index];
    const list = Array.isArray(rows) ? rows : [];
    const latest = list[list.length - 1] as { lsr_account?: string | number } | undefined;
    const lsr = num(latest?.lsr_account);
    if (lsr > 0) bias.longPct[symbol] = lsr / (1 + lsr);
  });
  const crowded = UNIVERSE.filter((symbol) => (bias.longPct[symbol] ?? 0) >= 0.68)
    .map((symbol) => symbol.replace("USDT", ""))
    .slice(0, 3);
  const fearBit =
    bias.fear == null ? "Індекс настрою мовчить." : `Настрій ${bias.fear} (${bias.fearLabel || "—"}).`;
  const crowdBit = crowded.length ? ` Натовп у лонгу: ${crowded.join(", ")}.` : "";
  const newsBit = bias.shockNote
    ? ` ${bias.shockNote}`
    : " Новинного стопа немає. Джерела: CoinDesk, The Block, Cointelegraph, календар USD.";
  return { bias, line: `${fearBit}${crowdBit}${newsBit}`.slice(0, 280) };
}

export function emptyBias(): TapeBias {
  return { ...EMPTY, longPct: {} };
}
