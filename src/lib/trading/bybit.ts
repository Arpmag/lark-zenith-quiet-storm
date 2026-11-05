const RECV = "5000";

export class BybitError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function isGeoBody(status: number, body: string): boolean {
  if (/cloudfront|block access from your country/i.test(body)) return true;
  if (status !== 403) return false;
  return !/"retCode"\s*:/.test(body);
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type BybitCall = {
  venue: "demo" | "real";
  key: string;
  secret: string;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

const PUBLIC_HOSTS = ["https://api.bybit.com", "https://api.bytick.com"];
const DEMO_HOSTS = ["https://api-demo.bybit.com"];
const pinned = new Map<string, string>();

function hostsOf(kind: "public" | "demo" | "real"): string[] {
  const list = kind === "demo" ? DEMO_HOSTS : PUBLIC_HOSTS;
  const pin = pinned.get(kind);
  if (!pin) return list;
  return [pin, ...list.filter((host) => host !== pin)];
}

function blockedMessage(): string {
  if (typeof window !== "undefined") {
    return "Bybit не відповів з цього телефону. Ключі лишаються у браузері. Відкрийте біржу в цьому ж інтернеті. Ключ Demo Trading створюється в режимі Demo і не має бути прив’язаний до чужої IP.";
  }
  return "Bybit закриває цей сервер (США і Китай). Ключі лишаються в браузері. Перевірка й ордери йдуть з вашого телефону.";
}

async function tryHosts(
  kind: "public" | "demo" | "real",
  path: string,
  init: RequestInit,
): Promise<{ status: number; text: string }> {
  let sawGeo = false;
  let lastNet = "мережа";
  for (const host of hostsOf(kind)) {
    try {
      const res = await fetch(`${host}${path}`, { ...init, signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      if (isGeoBody(res.status, text)) {
        sawGeo = true;
        continue;
      }
      pinned.set(kind, host);
      return { status: res.status, text };
    } catch (error) {
      lastNet = error instanceof Error ? error.message : "мережа";
    }
  }
  if (sawGeo) throw new BybitError(blockedMessage(), "geo_blocked");
  const cors = /failed|network|cors|fetch|abort/i.test(lastNet);
  throw new BybitError(
    cors && typeof window !== "undefined"
      ? "Браузер не дочитав відповідь Bybit. Ключі на місці. Якщо сайт біржі у вас відкривається, оновіть стіл і перевірте ключі ще раз."
      : `Немає відповіді Bybit (${lastNet}).`,
    cors ? "unreachable" : undefined,
  );
}

export async function bybitSigned<T>(call: BybitCall): Promise<T> {
  const qs = call.query ? new URLSearchParams(call.query).toString() : "";
  const body = call.body ? JSON.stringify(call.body) : "";
  const ts = Date.now().toString();
  const signPayload = call.method === "GET" ? qs : body;
  const sign = await hmacHex(call.secret, ts + call.key + RECV + signPayload);
  const path = `${call.path}${qs ? `?${qs}` : ""}`;
  const got = await tryHosts(call.venue, path, {
    method: call.method,
    headers: {
      "X-BAPI-API-KEY": call.key,
      "X-BAPI-SIGN": sign,
      "X-BAPI-SIGN-TYPE": "2",
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": RECV,
      "Content-Type": "application/json",
    },
    body: call.method === "POST" ? body : undefined,
  });
  let json: { retCode?: number; retMsg?: string; result?: T };
  try {
    json = JSON.parse(got.text) as { retCode?: number; retMsg?: string; result?: T };
  } catch {
    throw new BybitError(`Bybit відповів не JSON (${got.status}).`);
  }
  if (json.retCode !== 0) {
    const msg = (json.retMsg ?? "помилка Bybit").replace(call.key, "…").slice(0, 280);
    const code = json.retCode === 110043 ? "lev_same" : String(json.retCode ?? "bybit");
    throw new BybitError(msg, code);
  }
  return json.result as T;
}

export async function bybitPublic<T>(path: string): Promise<T> {
  const got = await tryHosts("public", path, {});
  let json: { retCode?: number; retMsg?: string; result?: T };
  try {
    json = JSON.parse(got.text) as { retCode?: number; retMsg?: string; result?: T };
  } catch {
    throw new BybitError(`Bybit відповів не JSON (${got.status}).`, got.status === 403 ? "geo_blocked" : undefined);
  }
  if (json.retCode !== 0) {
    throw new BybitError(json.retMsg ?? "публічний метод Bybit відхилив запит");
  }
  return json.result as T;
}
