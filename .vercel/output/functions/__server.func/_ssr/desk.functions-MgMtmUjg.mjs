import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { S as scanGate, b as readAccount, c as closePosition, g as loadTapeBias, h as lastPrice, t as BybitError, w as syncPosition, x as scanBybit, y as openPosition } from "./trade-exec-YtTdjSSY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/desk.functions-MgMtmUjg.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function lessonsOf(input) {
	const raw = input?.lessons;
	if (!Array.isArray(raw)) return [];
	return raw.map((row) => {
		const item = row;
		return {
			fp: String(item.fp ?? "").slice(0, 80),
			losses: Number(item.losses) || 0,
			note: String(item.note ?? "").slice(0, 180),
			at: Number(item.at) || 0
		};
	}).filter((row) => row.fp).slice(0, 40);
}
function scanInput(input) {
	const o = input ?? {};
	return {
		market: o.market === "linear" ? "linear" : "spot",
		lessons: lessonsOf(input),
		recent: Array.isArray(o.recent) ? o.recent.map((s) => String(s)).slice(0, 8) : [],
		threshold: Math.min(80, Math.max(48, Number(o.threshold) || 64)),
		allowFallback: o.allowFallback === true
	};
}
var scanMarkets_createServerFn_handler = createServerRpc({
	id: "0958818ceca6ee9d974a8890c9045aec7613de8cf30e7fd93a1c0d0671884e7a",
	name: "scanMarkets",
	filename: "src/lib/desk.functions.ts"
}, (opts) => scanMarkets.__executeServer(opts));
var scanMarkets = createServerFn({ method: "POST" }).validator(scanInput).handler(scanMarkets_createServerFn_handler, async ({ data }) => {
	try {
		const tape = await loadTapeBias().catch(() => null);
		const bias = tape?.bias ?? null;
		const extra = tape?.line ? ` ${tape.line}` : "";
		try {
			const rows = await scanBybit(data.market, data.lessons, data.recent, data.threshold, bias);
			return {
				ok: true,
				feed: "bybit",
				note: `Стрічка Bybit.${extra}`,
				rows
			};
		} catch (error) {
			const code = error instanceof BybitError ? error.code : void 0;
			if ((code === "geo_blocked" || code === "unreachable") && data.allowFallback) try {
				const rows = await scanGate(data.market, data.lessons, data.recent, data.threshold, bias);
				return {
					ok: true,
					feed: "gate",
					note: `Bybit із цього сервера закритий. Репетиція йде на живих цінах Gate.io і не надсилає ордери.${extra}`,
					rows
				};
			} catch (fallback) {
				return {
					ok: false,
					error: fallback instanceof Error ? fallback.message : "Стрічка недоступна."
				};
			}
			const message = error instanceof Error ? error.message : "Стрічка недоступна.";
			return code ? {
				ok: false,
				code,
				error: message
			} : {
				ok: false,
				error: message
			};
		}
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Стрічка недоступна."
		};
	}
});
var quotePrice_createServerFn_handler = createServerRpc({
	id: "8966c83e131fb25fba37298ab0506a0a758b54fba92b14c8d625aafb03bf0f9f",
	name: "quotePrice",
	filename: "src/lib/desk.functions.ts"
}, (opts) => quotePrice.__executeServer(opts));
var quotePrice = createServerFn({ method: "POST" }).validator((input) => {
	const o = input ?? {};
	return {
		feed: o.feed === "bybit" ? "bybit" : "gate",
		market: o.market === "linear" ? "linear" : "spot",
		symbol: String(o.symbol ?? "")
	};
}).handler(quotePrice_createServerFn_handler, async ({ data }) => {
	try {
		const price = await lastPrice(data.feed, data.market, data.symbol);
		if (!(price > 0)) return {
			ok: false,
			error: "Порожня ціна."
		};
		return {
			ok: true,
			price
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Ціна недоступна.",
			code: error instanceof BybitError ? error.code : void 0
		};
	}
});
function keysOf(input) {
	const o = input ?? {};
	const key = String(o.key ?? "").trim();
	const secret = String(o.secret ?? "").trim();
	if (key.length < 8 || secret.length < 8) return null;
	return {
		venue: o.venue === "real" ? "real" : "demo",
		key,
		secret
	};
}
var checkAccount_createServerFn_handler = createServerRpc({
	id: "dd07af43603dcef780eb9d10fc2eb313834b74da1b688a3c63ae43670d5b8a99",
	name: "checkAccount",
	filename: "src/lib/desk.functions.ts"
}, (opts) => checkAccount.__executeServer(opts));
var checkAccount = createServerFn({ method: "POST" }).validator((input) => input).handler(checkAccount_createServerFn_handler, async ({ data }) => {
	try {
		const keys = keysOf(data);
		if (!keys) return {
			ok: false,
			error: "Впишіть ключ і секрет Bybit."
		};
		return await readAccount(keys.venue, keys.key, keys.secret);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Перевірка не дійшла до Bybit."
		};
	}
});
var executeEntry_createServerFn_handler = createServerRpc({
	id: "465a593b114661d9356d0e3c06af6488ecf5fc15ed8dfc14ba15aacba9ee0cbc",
	name: "executeEntry",
	filename: "src/lib/desk.functions.ts"
}, (opts) => executeEntry.__executeServer(opts));
var executeEntry = createServerFn({ method: "POST" }).validator((input) => input).handler(executeEntry_createServerFn_handler, async ({ data }) => {
	const o = data ?? {};
	const keys = keysOf(o);
	if (!keys) return {
		ok: false,
		error: "Немає ключів Bybit."
	};
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
		weeklyUsd: Number(o.weeklyUsd) || 0
	});
});
var syncLive_createServerFn_handler = createServerRpc({
	id: "2c8ceaf331ff52b4c8b6dab5d7047014dcb77b7429ffa3e23d63f34d2a4f2b19",
	name: "syncLive",
	filename: "src/lib/desk.functions.ts"
}, (opts) => syncLive.__executeServer(opts));
var syncLive = createServerFn({ method: "POST" }).validator((input) => input).handler(syncLive_createServerFn_handler, async ({ data }) => {
	const o = data ?? {};
	const keys = keysOf(o);
	if (!keys) return {
		ok: false,
		error: "Немає ключів Bybit."
	};
	return syncPosition({
		venue: keys.venue,
		key: keys.key,
		secret: keys.secret,
		market: o.market === "linear" ? "linear" : "spot",
		symbol: String(o.symbol ?? ""),
		orderId: o.orderId ? String(o.orderId) : void 0,
		qty: Number(o.qty) || 0
	});
});
var closeLive_createServerFn_handler = createServerRpc({
	id: "4a789028edc32128267b1f4d65c0c4d4f0f9db381aaaadbece73b12e3b72cb50",
	name: "closeLive",
	filename: "src/lib/desk.functions.ts"
}, (opts) => closeLive.__executeServer(opts));
var closeLive = createServerFn({ method: "POST" }).validator((input) => input).handler(closeLive_createServerFn_handler, async ({ data }) => {
	const o = data ?? {};
	const keys = keysOf(o);
	if (!keys) return {
		ok: false,
		error: "Немає ключів Bybit."
	};
	return closePosition({
		venue: keys.venue,
		key: keys.key,
		secret: keys.secret,
		market: o.market === "linear" ? "linear" : "spot",
		symbol: String(o.symbol ?? ""),
		side: o.side === "Sell" ? "Sell" : "Buy",
		qty: Number(o.qty) || 0
	});
});
function stripSecret(text, secret) {
	if (!secret || secret.length < 6) return text.slice(0, 400);
	return text.split(secret).join("…").slice(0, 400);
}
async function complete(brain, llmKey, prompt) {
	if (brain === "grok") {
		const apiKey = process.env.XAI_API_KEY;
		if (!apiKey) throw new Error("Grok у цьому середовищі недоступний.");
		const res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "grok-4.5",
				max_tokens: 160,
				temperature: .2,
				messages: [{
					role: "user",
					content: prompt
				}]
			})
		});
		if (!res.ok) throw new Error(`Grok відповів ${res.status}.`);
		return (await res.json()).choices?.[0]?.message?.content ?? "";
	}
	const key = llmKey.trim();
	if (key.length < 8) throw new Error("Немає безкоштовного ключа моделі.");
	if (brain === "gemini") {
		const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					maxOutputTokens: 160,
					temperature: .2
				}
			})
		});
		if (!res.ok) throw new Error(stripSecret(`Gemini відповів ${res.status}.`, key));
		return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
	}
	const url = brain === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
	const model = brain === "groq" ? "openai/gpt-oss-20b" : "openrouter/free";
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`
		},
		body: JSON.stringify({
			model,
			max_tokens: 160,
			temperature: .2,
			messages: [{
				role: "user",
				content: prompt
			}]
		})
	});
	if (!res.ok) throw new Error(stripSecret(`${brain} відповів ${res.status}.`, key));
	return stripSecret((await res.json()).choices?.[0]?.message?.content ?? "", key);
}
function asBrain(input) {
	const o = input ?? {};
	return {
		brain: [
			"local",
			"groq",
			"gemini",
			"openrouter",
			"grok"
		].includes(o.brain) ? o.brain : "local",
		llmKey: String(o.llmKey ?? "").slice(0, 500),
		prompt: String(o.prompt ?? "").slice(0, 1800)
	};
}
var askAgent_createServerFn_handler = createServerRpc({
	id: "c2882ee1d3406d498a2c38846931dc27b6fe5c9a43059a791bbc30790301eeb4",
	name: "askAgent",
	filename: "src/lib/desk.functions.ts"
}, (opts) => askAgent.__executeServer(opts));
var askAgent = createServerFn({ method: "POST" }).validator(asBrain).handler(askAgent_createServerFn_handler, async ({ data }) => {
	if (data.brain === "local") return {
		ok: false,
		error: "Локальна рада не викликає модель.",
		spent: false
	};
	try {
		return {
			ok: true,
			text: (await complete(data.brain, data.llmKey, data.prompt)).slice(0, 800),
			spent: true
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Модель недоступна.",
			spent: false
		};
	}
});
//#endregion
export { askAgent_createServerFn_handler, checkAccount_createServerFn_handler, closeLive_createServerFn_handler, executeEntry_createServerFn_handler, quotePrice_createServerFn_handler, scanMarkets_createServerFn_handler, syncLive_createServerFn_handler };
