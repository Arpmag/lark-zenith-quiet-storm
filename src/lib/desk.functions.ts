import { createServerFn } from "@tanstack/react-start";
import { BybitError } from "@/lib/trading/bybit";
import { loadTapeBias } from "@/lib/trading/context";
import { lastPrice, scanBybit, scanGate } from "@/lib/trading/scan";
import { closePosition, openPosition, readAccount, syncPosition } from "@/lib/trading/trade-exec";
import type { Brain, Feed, Lesson, MarketKind, ScanResult } from "@/lib/trading/types";

function lessonsOf(input: unknown): Lesson[] {
  const raw = (input as { lessons?: unknown })?.lessons;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as { fp?: unknown; losses?: unknown; note?: unknown; at?: unknown };
      return {
        fp: String(item.fp ?? "").slice(0, 80),
        losses: Number(item.losses) || 0,
        note: String(item.note ?? "").slice(0, 180),
        at: Number(item.at) || 0,
      };
    })
    .filter((row) => row.fp)
    .slice(0, 40);
}

function scanInput(input: unknown): {
  market: MarketKind;
  lessons: Lesson[];
  recent: string[];
  threshold: number;
  allowFallback: boolean;
} {
  const o = (input ?? {}) as {
    market?: string;
    recent?: unknown;
    threshold?: number;
    allowFallback?: boolean;
  };
  return {
    market: o.market === "linear" ? "linear" : "spot",
    lessons: lessonsOf(input),
    recent: Array.isArray(o.recent) ? o.recent.map((s) => String(s)).slice(0, 8) : [],
    threshold: Math.min(80, Math.max(48, Number(o.threshold) || 64)),
    allowFallback: o.allowFallback === true,
  };
}

export const scanMarkets = createServerFn({ method: "POST" })
  .validator(scanInput)
  .handler(async ({ data }): Promise<ScanResult> => {
    try {
      const tape = await loadTapeBias().catch(() => null);
      const bias = tape?.bias ?? null;
      const extra = tape?.line ? ` ${tape.line}` : "";
      try {
        const rows = await scanBybit(data.market, data.lessons, data.recent, data.threshold, bias);
        return { ok: true, feed: "bybit", note: `Стрічка Bybit.${extra}`, rows };
      } catch (error) {
        const code = error instanceof BybitError ? error.code : undefined;
        const geo = code === "geo_blocked" || code === "unreachable";
        if (geo && data.allowFallback) {
          try {
            const rows = await scanGate(data.market, data.lessons, data.recent, data.threshold, bias);
            return {
              ok: true,
              feed: "gate",
              note: `Bybit із цього сервера закритий. Репетиція йде на живих цінах Gate.io і не надсилає ордери.${extra}`,
              rows,
            };
          } catch (fallback) {
            return {
              ok: false,
              error: fallback instanceof Error ? fallback.message : "Стрічка недоступна.",
            };
          }
        }
        const message = error instanceof Error ? error.message : "Стрічка недоступна.";
        return code ? { ok: false, code, error: message } : { ok: false, error: message };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Стрічка недоступна.",
      };
    }
  });

export const quotePrice = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const o = (input ?? {}) as { feed?: string; market?: string; symbol?: string };
    return {
      feed: (o.feed === "bybit" ? "bybit" : "gate") as Feed,
      market: (o.market === "linear" ? "linear" : "spot") as MarketKind,
      symbol: String(o.symbol ?? ""),
    };
  })
  .handler(async ({ data }) => {
    try {
      const price = await lastPrice(data.feed, data.market, data.symbol);
      if (!(price > 0)) return { ok: false as const, error: "Порожня ціна." };
      return { ok: true as const, price };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Ціна недоступна.",
        code: error instanceof BybitError ? error.code : undefined,
      };
    }
  });

function keysOf(input: unknown): {
  venue: "demo" | "real";
  key: string;
  secret: string;
} | null {
  const o = (input ?? {}) as { venue?: string; key?: string; secret?: string };
  const key = String(o.key ?? "").trim();
  const secret = String(o.secret ?? "").trim();
  if (key.length < 8 || secret.length < 8) return null;
  return { venue: o.venue === "real" ? "real" : "demo", key, secret };
}

export const checkAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    try {
      const keys = keysOf(data);
      if (!keys) return { ok: false as const, error: "Впишіть ключ і секрет Bybit." };
      return await readAccount(keys.venue, keys.key, keys.secret);
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Перевірка не дійшла до Bybit.",
      };
    }
  });

export const executeEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const o = (data ?? {}) as {
      venue?: string;
      key?: string;
      secret?: string;
      market?: string;
      symbol?: string;
      side?: string;
      notional?: number;
      leverage?: number;
      stop?: number;
      take?: number;
      weeklyUsd?: number;
    };
    const keys = keysOf(o);
    if (!keys) return { ok: false as const, error: "Немає ключів Bybit." };
    return openPosition({
      venue: keys.venue,
      key: keys.key,
      secret: keys.secret,
      market: o.market === "linear" ? "linear" : "spot",
      symbol: String(o.symbol ?? ""),
      side: o.side === "Sell" ? "Sell" : "Buy",
      notional: Number(o.notional) || 0,
      leverage: Number(o.leverage) || 1,
      stop: Number(o.stop) || 0,
      take: Number(o.take) || 0,
      weeklyUsd: Number(o.weeklyUsd) || 0,
    });
  });

export const syncLive = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const o = (data ?? {}) as {
      venue?: string;
      key?: string;
      secret?: string;
      market?: string;
      symbol?: string;
      orderId?: string;
      qty?: number;
    };
    const keys = keysOf(o);
    if (!keys) return { ok: false as const, error: "Немає ключів Bybit." };
    return syncPosition({
      venue: keys.venue,
      key: keys.key,
      secret: keys.secret,
      market: o.market === "linear" ? "linear" : "spot",
      symbol: String(o.symbol ?? ""),
      orderId: o.orderId ? String(o.orderId) : undefined,
      qty: Number(o.qty) || 0,
    });
  });

export const closeLive = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const o = (data ?? {}) as {
      venue?: string;
      key?: string;
      secret?: string;
      market?: string;
      symbol?: string;
      side?: string;
      qty?: number;
    };
    const keys = keysOf(o);
    if (!keys) return { ok: false as const, error: "Немає ключів Bybit." };
    return closePosition({
      venue: keys.venue,
      key: keys.key,
      secret: keys.secret,
      market: o.market === "linear" ? "linear" : "spot",
      symbol: String(o.symbol ?? ""),
      side: o.side === "Sell" ? "Sell" : "Buy",
      qty: Number(o.qty) || 0,
    });
  });

function stripSecret(text: string, secret: string): string {
  if (!secret || secret.length < 6) return text.slice(0, 400);
  return text.split(secret).join("…").slice(0, 400);
}

async function complete(brain: Brain, llmKey: string, prompt: string): Promise<string> {
  if (brain === "grok") {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("Grok у цьому середовищі недоступний.");
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 160,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Grok відповів ${res.status}.`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? "";
  }
  const key = llmKey.trim();
  if (key.length < 8) throw new Error("Немає безкоштовного ключа моделі.");
  if (brain === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 160, temperature: 0.2 },
        }),
      },
    );
    if (!res.ok) throw new Error(stripSecret(`Gemini відповів ${res.status}.`, key));
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  const url =
    brain === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const model = brain === "groq" ? "openai/gpt-oss-20b" : "openrouter/free";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 160,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(stripSecret(`${brain} відповів ${res.status}.`, key));
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return stripSecret(body.choices?.[0]?.message?.content ?? "", key);
}

function asBrain(input: unknown): { brain: Brain; llmKey: string; prompt: string } {
  const o = (input ?? {}) as { brain?: string; llmKey?: string; prompt?: string };
  const allowed: Brain[] = ["local", "groq", "gemini", "openrouter", "grok"];
  const brain = allowed.includes(o.brain as Brain) ? (o.brain as Brain) : "local";
  return {
    brain,
    llmKey: String(o.llmKey ?? "").slice(0, 500),
    prompt: String(o.prompt ?? "").slice(0, 1800),
  };
}

export const askAgent = createServerFn({ method: "POST" })
  .validator(asBrain)
  .handler(async ({ data }) => {
    if (data.brain === "local") {
      return { ok: false as const, error: "Локальна рада не викликає модель.", spent: false };
    }
    try {
      const text = await complete(data.brain, data.llmKey, data.prompt);
      return { ok: true as const, text: text.slice(0, 800), spent: true };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Модель недоступна.",
        spent: false,
      };
    }
  });
