//#region node_modules/.nitro/vite/services/ssr/assets/trade-exec-YtTdjSSY.js
var RECV = "5000";
var BybitError = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.code = code;
	}
};
function isGeoBody(status, body) {
	if (/cloudfront|block access from your country/i.test(body)) return true;
	if (status !== 403) return false;
	return !/"retCode"\s*:/.test(body);
}
async function hmacHex(secret, payload) {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var PUBLIC_HOSTS = ["https://api.bybit.com", "https://api.bytick.com"];
var DEMO_HOSTS = ["https://api-demo.bybit.com"];
var pinned = /* @__PURE__ */ new Map();
function hostsOf(kind) {
	const list = kind === "demo" ? DEMO_HOSTS : PUBLIC_HOSTS;
	const pin = pinned.get(kind);
	if (!pin) return list;
	return [pin, ...list.filter((host) => host !== pin)];
}
function blockedMessage() {
	if (typeof window !== "undefined") return "Bybit не відповів з цього телефону. Ключі лишаються у браузері. Відкрийте біржу в цьому ж інтернеті. Ключ Demo Trading створюється в режимі Demo і не має бути прив’язаний до чужої IP.";
	return "Bybit закриває цей сервер (США і Китай). Ключі лишаються в браузері. Перевірка й ордери йдуть з вашого телефону.";
}
async function tryHosts(kind, path, init) {
	let sawGeo = false;
	let lastNet = "мережа";
	for (const host of hostsOf(kind)) try {
		const res = await fetch(`${host}${path}`, {
			...init,
			signal: AbortSignal.timeout(8e3)
		});
		const text = await res.text();
		if (isGeoBody(res.status, text)) {
			sawGeo = true;
			continue;
		}
		pinned.set(kind, host);
		return {
			status: res.status,
			text
		};
	} catch (error) {
		lastNet = error instanceof Error ? error.message : "мережа";
	}
	if (sawGeo) throw new BybitError(blockedMessage(), "geo_blocked");
	const cors = /failed|network|cors|fetch|abort/i.test(lastNet);
	throw new BybitError(cors && typeof window !== "undefined" ? "Браузер не дочитав відповідь Bybit. Ключі на місці. Якщо сайт біржі у вас відкривається, оновіть стіл і перевірте ключі ще раз." : `Немає відповіді Bybit (${lastNet}).`, cors ? "unreachable" : void 0);
}
async function bybitSigned(call) {
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
			"Content-Type": "application/json"
		},
		body: call.method === "POST" ? body : void 0
	});
	let json;
	try {
		json = JSON.parse(got.text);
	} catch {
		throw new BybitError(`Bybit відповів не JSON (${got.status}).`);
	}
	if (json.retCode !== 0) throw new BybitError((json.retMsg ?? "помилка Bybit").replace(call.key, "…").slice(0, 280), json.retCode === 110043 ? "lev_same" : String(json.retCode ?? "bybit"));
	return json.result;
}
async function bybitPublic(path) {
	const got = await tryHosts("public", path, {});
	let json;
	try {
		json = JSON.parse(got.text);
	} catch {
		throw new BybitError(`Bybit відповів не JSON (${got.status}).`, got.status === 403 ? "geo_blocked" : void 0);
	}
	if (json.retCode !== 0) throw new BybitError(json.retMsg ?? "публічний метод Bybit відхилив запит");
	return json.result;
}
var UNIVERSE = [
	"BTCUSDT",
	"ETHUSDT",
	"SOLUSDT",
	"XRPUSDT",
	"LINKUSDT",
	"AVAXUSDT",
	"ADAUSDT",
	"DOGEUSDT"
];
var DAILY_LOSS_PCT = .03;
var WEEKLY_LOSS_PCT = .06;
var REHEARSAL_TIME_STOP_MS = 5e4;
var LIVE_TIME_STOP_MS = 144e5;
var EMPTY = {
	fear: null,
	fearLabel: "",
	longPct: {},
	shockAll: false,
	shocked: [],
	shockNote: ""
};
var COIN = {
	BTCUSDT: /\b(bitcoin|btc)\b/i,
	ETHUSDT: /\b(ethereum|ether|\beth\b)/i,
	SOLUSDT: /\b(solana|\bsol\b)/i,
	XRPUSDT: /\bxrp\b/i,
	LINKUSDT: /\b(chainlink|\blink\b)/i,
	AVAXUSDT: /\b(avalanche|\bavax\b)/i,
	ADAUSDT: /\b(cardano|\bada\b)/i,
	DOGEUSDT: /\b(dogecoin|\bdoge\b)/i
};
var SHOCK = /\b(hacked|exploit|exploited|funds stolen|stolen funds|trading halt|halted withdrawals|withdrawals (paused|suspended)|delisted|delisting|insolvent|bankruptcy|bankrupt|wallet drained|exchange down|depeg|de-peg|unpeg|lost its peg)\b/i;
var DEPEG = /\b(depeg|de-peg|unpeg|lost its peg|stablecoin)\b/i;
var VENUE = /\b(bybit|binance|coinbase|okx|gate\.io|crypto exchange)\b/i;
var MACRO = /\b(cpi|core cpi|fomc|federal funds|interest rate|nfp|non-farm|nonfarm|powell|pce|core pce|gdp|unemployment|ppi|retail sales)\b/i;
function macroStop(rows, now) {
	if (!Array.isArray(rows)) return "";
	for (const row of rows) {
		const event = row;
		if (event.country !== "USD" || event.impact !== "High") continue;
		const title = String(event.title ?? "");
		if (!MACRO.test(title)) continue;
		const at = Date.parse(String(event.date ?? ""));
		if (!Number.isFinite(at)) continue;
		if (at - now > 27e5 || now - at > 12e5) continue;
		return `Макро-стоп: ${title.slice(0, 80)} (USD)`;
	}
	return "";
}
async function grabText(url) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 4e3);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: { accept: "application/rss+xml, application/xml, text/xml" }
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
function rssItems(xml, source, credibility, reputation) {
	if (!xml) return [];
	return xml.split("<item>").slice(1, 13).map((item) => {
		return {
			title: item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "",
			pubDate: item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]?.trim() ?? "",
			source,
			credibility,
			reputation
		};
	}).filter((item) => item.title && item.pubDate);
}
function num$2(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
async function grab(url) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 4e3);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: { accept: "application/json" }
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
function shockFromNews(json, now) {
	const articles = json?.articles;
	if (!Array.isArray(articles)) return {
		shockAll: false,
		shocked: [],
		shockNote: ""
	};
	const hit = /* @__PURE__ */ new Set();
	let all = false;
	let note = "";
	for (const row of articles) {
		const item = row;
		const title = String(item.title ?? "");
		const at = Date.parse(String(item.pubDate ?? ""));
		if (!title || !Number.isFinite(at) || now - at > 108e5 || now < at) continue;
		const trust = num$2(item.credibility);
		const rep = num$2(item.reputation);
		if (trust > 0 && trust < .7 && rep < 60) continue;
		if (!SHOCK.test(title)) continue;
		const names = UNIVERSE.filter((symbol) => COIN[symbol].test(title));
		if (VENUE.test(title) && names.length === 0 || DEPEG.test(title)) all = true;
		for (const symbol of names) hit.add(symbol);
		if (!note) note = `${title.slice(0, 110)} (${String(item.source ?? "новина").slice(0, 32)})`;
	}
	return {
		shockAll: all,
		shocked: [...hit],
		shockNote: note ? `Новинний стоп: ${note}` : ""
	};
}
async function loadTapeBias(now = Date.now()) {
	const [fearJson, newsJson, coinDesk, theBlock, cointelegraph, calendar, ...stats] = await Promise.all([
		grab("https://api.alternative.me/fng/?limit=1"),
		grab("https://cryptocurrency.cv/api/breaking?limit=20"),
		grabText("https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml"),
		grabText("https://www.theblock.co/rss.xml"),
		grabText("https://cointelegraph.com/rss"),
		grab("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
		...UNIVERSE.map((symbol) => grab(`https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${symbol.replace(/USDT$/, "")}_USDT&limit=1`))
	]);
	const bias = {
		...EMPTY,
		longPct: {}
	};
	const fearRow = fearJson?.data?.[0];
	if (fearRow) {
		const fear = num$2(fearRow.value);
		if (fear > 0 && fear <= 100) {
			bias.fear = fear;
			bias.fearLabel = String(fearRow.value_classification ?? "");
		}
	}
	const shock = shockFromNews({ articles: [
		...newsJson?.articles ?? [],
		...rssItems(coinDesk, "CoinDesk", .95, 90),
		...rssItems(theBlock, "The Block", .9, 85),
		...rssItems(cointelegraph, "Cointelegraph", .8, 75)
	] }, now);
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
		const latest = list[list.length - 1];
		const lsr = num$2(latest?.lsr_account);
		if (lsr > 0) bias.longPct[symbol] = lsr / (1 + lsr);
	});
	const crowded = UNIVERSE.filter((symbol) => (bias.longPct[symbol] ?? 0) >= .68).map((symbol) => symbol.replace("USDT", "")).slice(0, 3);
	return {
		bias,
		line: `${bias.fear == null ? "Індекс настрою мовчить." : `Настрій ${bias.fear} (${bias.fearLabel || "—"}).`}${crowded.length ? ` Натовп у лонгу: ${crowded.join(", ")}.` : ""}${bias.shockNote ? ` ${bias.shockNote}` : " Новинного стопа немає. Джерела: CoinDesk, The Block, Cointelegraph, календар USD."}`.slice(0, 280)
	};
}
function ema(values, period) {
	if (values.length === 0) return 0;
	const k = 2 / (period + 1);
	let e = values[0] ?? 0;
	for (let i = 1; i < values.length; i++) e = (values[i] ?? e) * k + e * (1 - k);
	return e;
}
function rsi(values, period = 14) {
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
	return 100 - 100 / (1 + avgG / avgL);
}
function atr(candles, period = 14) {
	if (candles.length < 2) return 0;
	const trs = [];
	for (let i = 1; i < candles.length; i++) {
		const prev = candles[i - 1]?.c ?? 0;
		const c = candles[i];
		if (!c) continue;
		trs.push(Math.max(c.h - c.l, Math.abs(c.h - prev), Math.abs(c.l - prev)));
	}
	if (trs.length === 0) return 0;
	if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
	let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
	for (let i = period; i < trs.length; i++) a = (a * (period - 1) + (trs[i] ?? a)) / period;
	return a;
}
function sma(values, period) {
	if (values.length === 0) return 0;
	const slice = values.slice(-period);
	return slice.reduce((a, b) => a + b, 0) / slice.length;
}
function stepDecimals(step) {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const s = step.toString().toLowerCase();
	if (s.includes("e-")) {
		const n = Number(s.split("e-")[1]);
		return Number.isFinite(n) ? n : 0;
	}
	const i = s.indexOf(".");
	return i === -1 ? 0 : s.length - i - 1;
}
function floorToStep(value, step) {
	if (!(step > 0) || !Number.isFinite(value)) return value;
	const n = Math.floor(value / step + 1e-9) * step;
	return Number(n.toFixed(stepDecimals(step)));
}
function roundToTick(value, tick, dir) {
	if (!(tick > 0) || !Number.isFinite(value)) return value;
	const q = value / tick;
	const n = dir === "up" ? Math.ceil(q - 1e-9) : dir === "down" ? Math.floor(q + 1e-9) : Math.round(q);
	return Number((n * tick).toFixed(stepDecimals(tick)));
}
function utcDay(d = /* @__PURE__ */ new Date()) {
	return d.toISOString().slice(0, 10);
}
function weekStart(d = /* @__PURE__ */ new Date()) {
	const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const day = x.getUTCDay() || 7;
	x.setUTCDate(x.getUTCDate() - day + 1);
	return x.toISOString().slice(0, 10);
}
function formatHm(ts) {
	const d = new Date(ts);
	return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}
function formatPx(n) {
	if (!Number.isFinite(n)) return "—";
	const abs = Math.abs(n);
	if (abs >= 1e3) return n.toFixed(1);
	if (abs >= 100) return n.toFixed(2);
	if (abs >= 1) return n.toFixed(3);
	if (abs >= .01) return n.toFixed(5);
	return n.toPrecision(4);
}
function formatUsd(n, digits = 2) {
	if (!Number.isFinite(n)) return "—";
	return `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;
}
function clamp(n, lo, hi) {
	return Math.min(hi, Math.max(lo, n));
}
var FEE = {
	spot: .001,
	linear: 55e-5
};
function breakevenPx(args) {
	const fee = FEE[args.market];
	if (!(args.entry > 0)) return 0;
	if (args.side === "long") return args.entry * (1 + fee) / (1 - fee);
	return args.entry * (1 - fee) / (1 + fee);
}
function closeReading(args) {
	const fee = FEE[args.market];
	const qty = args.qty > 0 ? args.qty : 0;
	const mark = qty > 0 ? args.side === "long" ? args.entry + args.unrealized / qty : args.entry - args.unrealized / qty : args.entry;
	const openFee = qty * args.entry * fee;
	const closeFee = qty * mark * fee;
	const net = args.unrealized - openFee - closeFee;
	const risk = qty * Math.abs(args.entry - args.stop);
	return {
		mark,
		openFee,
		closeFee,
		net,
		r: risk > 0 ? args.unrealized / risk : 0
	};
}
function sizePosition(args) {
	const weekly = args.weeklyUsd;
	if (!(weekly >= 30) || !(args.entry > 0)) return {
		ok: false,
		error: "Тижнева сума має бути від 30 USDT."
	};
	const riskPct = clamp(args.riskPct, .004, .015);
	const dist = Math.abs(args.entry - args.stop) / args.entry;
	if (dist < .0015 || dist > .08) return {
		ok: false,
		error: "Дистанція стопа непридатна."
	};
	if (args.side === "long" && !(args.stop < args.entry)) return {
		ok: false,
		error: "Стоп лонга вище входу."
	};
	if (args.side === "short" && !(args.stop > args.entry)) return {
		ok: false,
		error: "Стоп шорта нижче входу."
	};
	let notional = weekly * riskPct / dist;
	const levCap = args.market === "linear" ? 3 : 1;
	const maxNotional = weekly * .22 * levCap;
	if (notional > maxNotional) notional = maxNotional;
	let leverage = 1;
	if (args.market === "linear") {
		leverage = clamp(Math.ceil(notional / Math.max(weekly * .12, 1)), 1, 3);
		if (notional / leverage > weekly * .2) notional = weekly * .2 * leverage;
	}
	if (notional < 10) return {
		ok: false,
		error: "Після ліміту ризику номінал нижче 10 USDT."
	};
	const margin = notional / leverage;
	const qty = notional / args.entry;
	const riskUsd = dist * notional;
	if (riskUsd > weekly * .016) return {
		ok: false,
		error: "Ризик угоди вищий за жорстку стелю 1.6%."
	};
	return {
		ok: true,
		notional,
		leverage,
		margin,
		riskUsd,
		qty
	};
}
function fitToBalance(size, args) {
	const cash = args.available;
	if (!(cash >= 10) || !(args.entry > 0)) return {
		ok: false,
		error: "Вільно менше 10 USDT. Ордер не ставлю."
	};
	const dist = Math.abs(args.entry - args.stop) / args.entry;
	if (!(dist > 0)) return {
		ok: false,
		error: "Дистанція стопа непридатна."
	};
	let notional = size.notional;
	let leverage = args.market === "linear" ? size.leverage : 1;
	if (args.market === "spot") {
		notional = Math.min(notional, cash * .98);
		leverage = 1;
	} else if (notional / leverage > cash * .85) notional = cash * .85 * leverage;
	if (notional > args.weeklyUsd * .22 * (args.market === "linear" ? 3 : 1)) notional = args.weeklyUsd * .22 * (args.market === "linear" ? 3 : 1);
	if (dist * notional > args.weeklyUsd * .016) notional = args.weeklyUsd * .015 / dist;
	if (notional < 10) return {
		ok: false,
		error: "Після балансу номінал нижче 10 USDT."
	};
	const riskUsd = dist * notional;
	return {
		ok: true,
		notional,
		leverage,
		margin: notional / leverage,
		riskUsd,
		qty: notional / args.entry
	};
}
function capitalStance(trades, riskPct, now = Date.now()) {
	const day = new Date(now).toISOString().slice(0, 10);
	if (trades.filter((trade) => trade.reason === "stop" && new Date(trade.closedAt).toISOString().slice(0, 10) === day).length >= 2) return {
		riskPct,
		pause: "Два стопи сьогодні. Нових угод до завтра немає.",
		note: ""
	};
	const last = trades[0];
	if (last && last.pnl < 0) return {
		riskPct: Math.max(.004, riskPct / 2),
		pause: "",
		note: "Попередня угода в мінусі. Ризик половини, вище не піднімаю."
	};
	return {
		riskPct,
		pause: "",
		note: ""
	};
}
function cryptoFundingBlock(market, side, funding) {
	if (market !== "linear" || funding == null) return "";
	if (side === "long" && funding >= 8e-4) return "Фандинг лонга ≥ 0.08% за інтервал. Угоду не беру: плата більша за частку ризику.";
	if (side === "short" && funding <= -8e-4) return "Фандинг шорта ≤ −0.08% за інтервал. Угоду не беру: плата більша за частку ризику.";
	return "";
}
function netPnl(args) {
	const gross = args.side === "long" ? args.qty * (args.exit - args.entry) : args.qty * (args.entry - args.exit);
	const feeRate = FEE[args.market];
	return gross - (args.qty * args.entry * feeRate + args.qty * args.exit * feeRate);
}
function fingerprint(symbol, side, atrPct, up) {
	return `${symbol}|${side}|${up ? "up" : "down"}|${atrPct > .02 ? "hot" : atrPct < .004 ? "quiet" : "normal"}`;
}
function lossPenalty(lessons, fp) {
	const hit = lessons.find((l) => l.fp === fp);
	if (!hit) return 0;
	if (hit.losses >= 2) return 100;
	if (hit.losses === 1) return 14;
	return 0;
}
function rankMarkets(rows, market, lessons, recent, threshold, bias) {
	const ranked = rows.map((row) => scoreOne(row, market, lessons, recent, threshold, bias));
	ranked.sort((a, b) => b.score - a.score);
	return ranked;
}
function scoreOne(row, market, lessons, recent, threshold, bias) {
	const closed = row.candles.filter((c) => c.c > 0);
	const spark = closed.slice(-36).map((c) => c.c);
	const lastBar = closed[closed.length - 1];
	const base = {
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
		barL: lastBar?.l ?? 0
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
	const reasons = [];
	let side = "flat";
	const upTrend = emaFast > emaSlow && row.last > emaFast && slope > 0;
	const downTrend = emaFast < emaSlow && row.last < emaFast && slope < 0;
	const pullbackLong = emaFast > emaSlow && Math.abs(row.last - emaFast) <= atrNow * .45 && rsiNow >= 42 && rsiNow <= 62 && slope >= -2e-4;
	if (upTrend && rsiNow >= 48 && rsiNow <= 72) {
		side = "long";
		reasons.push("EMA20 над EMA50, ціна над швидкою, RSI не перегрітий.");
	} else if (pullbackLong) {
		side = "long";
		reasons.push("Відкат до EMA20 у висхідному краї.");
	} else if (market === "linear" && downTrend && rsiNow >= 28 && rsiNow <= 54) {
		side = "short";
		reasons.push("EMA20 під EMA50, коротке вікно на ф'ючерсі.");
	} else if (market === "spot" && downTrend) reasons.push("Спадний край. На споті шорт не відкриваю.");
	else reasons.push("Немає чистого краю між EMA.");
	if (volRatio >= 1) reasons.push("Обсяг не нижче середнього.");
	else reasons.push("Обсяг тонкий.");
	if (atrPct < .0015) reasons.push("Замало ходу для стопа.");
	if (atrPct > .045) reasons.push("Заширокий ATR для цього вікна.");
	let score = 0;
	if (side !== "flat") score += 34;
	score += Math.min(18, Math.abs(gap) * 9e3);
	score += Math.min(12, Math.abs(slope) * 14e3);
	if (side === "long" && rsiNow >= 50 && rsiNow <= 66) score += 12;
	if (side === "short" && rsiNow >= 34 && rsiNow <= 50) score += 12;
	if (volRatio >= 1 && volRatio < 3) score += 8;
	if (atrPct >= .003 && atrPct <= .02) score += 10;
	if (row.turnover >= 2e7) score += 6;
	if (side === "long" && (row.funding ?? 0) > 4e-4) {
		score -= 10;
		reasons.push("Фандинг дорогий для лонга.");
	}
	if (side === "short" && (row.funding ?? 0) < -4e-4) {
		score -= 10;
		reasons.push("Фандинг дорогий для шорта.");
	}
	if (recent.includes(row.symbol)) {
		score -= 10;
		reasons.push("Ця пара вже була в сьогоднішній сесії.");
	}
	const symbol = row.symbol;
	const longPct = bias?.longPct?.[symbol];
	if (longPct != null && side === "long" && longPct >= .68) {
		score -= 8;
		reasons.push(`Рахунки вже ${Math.round(longPct * 100)}% у лонгу.`);
	}
	if (longPct != null && side === "short" && longPct <= .34) {
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
	const shocked = !!bias && (bias.shockAll || bias.shocked.includes(row.symbol));
	if (shocked && bias?.shockNote) reasons.push(bias.shockNote);
	const fundingNote = side === "flat" ? "" : cryptoFundingBlock(market, side, row.funding);
	if (fundingNote) reasons.push(fundingNote);
	const stopDist = Math.max(atrNow * 1.55, row.last * .0025);
	const entry = row.last;
	const stop = side === "short" ? entry + stopDist : entry - stopDist;
	const take = side === "short" ? entry - stopDist * 1.85 : side === "long" ? entry + stopDist * 1.85 : 0;
	const fp = side === "flat" ? "" : fingerprint(row.symbol, side, atrPct, gap >= 0);
	const pen = fp ? lossPenalty(lessons, fp) : 0;
	if (pen >= 100) reasons.push("Відбиток двічі в мінусі. Пропускаю.");
	else if (pen > 0) reasons.push("Один мінус на цьому відбитку. Штраф до бала.");
	score -= pen;
	score = Math.max(0, Math.min(100, Math.round(score)));
	const tradable = side !== "flat" && atrPct >= .0015 && atrPct <= .045 && stop > 0 && Math.abs(entry - stop) / entry >= .0015 && Math.abs(entry - stop) / entry <= .08 && score >= threshold && pen < 100 && !shocked && !fundingNote;
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
		fingerprint: fp
	};
}
function localCritic(row) {
	if (!row.tradable || row.side === "flat") return {
		verdict: "veto",
		note: "Сетап не дотягує до порога ради."
	};
	const risk = Math.abs(row.entry - row.stop);
	if (!(Math.abs(row.take - row.entry) / risk >= 1.7)) return {
		verdict: "veto",
		note: "Співвідношення прибутку до стопа нижче 1.7."
	};
	if (row.side === "long" && !(row.stop < row.entry && row.take > row.entry)) return {
		verdict: "veto",
		note: "Стоп або ціль стоять не з того боку."
	};
	if (row.side === "short" && !(row.stop > row.entry && row.take < row.entry)) return {
		verdict: "veto",
		note: "Стоп або ціль стоять не з того боку."
	};
	return {
		verdict: "allow",
		note: `${row.symbol} ${row.side === "long" ? "лонг" : "шорт"}, бал ${row.score}. Стоп і розмір лишаються за ризик-модулем.`
	};
}
function num$1(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
function gatePair(symbol) {
	return `${symbol.replace(/USDT$/, "")}_USDT`;
}
async function getJson(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`стрічка ${res.status}`);
	return await res.json();
}
function parseBybitCandles(list) {
	return list.map((row) => ({
		t: num$1(row[0]),
		o: num$1(row[1]),
		h: num$1(row[2]),
		l: num$1(row[3]),
		c: num$1(row[4]),
		v: num$1(row[5])
	})).filter((c) => c.c > 0).sort((a, b) => a.t - b.t);
}
async function scanBybit(market, lessons, recent, threshold, bias) {
	const category = market === "linear" ? "linear" : "spot";
	const tickers = await bybitPublic(`/v5/market/tickers?category=${category}`);
	const bySymbol = new Map((tickers.list ?? []).map((t) => [t.symbol, t]));
	return rankMarkets((await Promise.all(UNIVERSE.map(async (symbol) => {
		const ticker = bySymbol.get(symbol);
		if (!ticker) return null;
		const candles = parseBybitCandles((await bybitPublic(`/v5/market/kline?category=${category}&symbol=${symbol}&interval=15&limit=120`)).list ?? []).slice(0, -1);
		return {
			symbol,
			last: num$1(ticker.lastPrice),
			changePct: num$1(ticker.price24hPcnt) * 100,
			turnover: num$1(ticker.turnover24h),
			funding: market === "linear" ? num$1(ticker.fundingRate) : null,
			candles
		};
	}))).filter((x) => !!x && x.last > 0), market, lessons, recent, threshold, bias);
}
function parseGateSpotCandles(rows) {
	return rows.map((row) => ({
		t: num$1(row[0]) * 1e3,
		o: num$1(row[5]),
		h: num$1(row[3]),
		l: num$1(row[4]),
		c: num$1(row[2]),
		v: num$1(row[6])
	})).filter((c) => c.c > 0).sort((a, b) => a.t - b.t);
}
async function scanGate(market, lessons, recent, threshold, bias) {
	const funding = /* @__PURE__ */ new Map();
	if (market === "linear") {
		const futs = await getJson("https://api.gateio.ws/api/v4/futures/usdt/tickers");
		for (const row of futs) if (row.contract) funding.set(row.contract, row);
	}
	return rankMarkets((await Promise.all(UNIVERSE.map(async (symbol) => {
		const pair = gatePair(symbol);
		if (market === "linear") {
			const ticker = funding.get(pair);
			const candles = (await getJson(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${pair}&interval=15m&limit=120`)).map((c) => ({
				t: num$1(c.t) * 1e3,
				o: num$1(c.o),
				h: num$1(c.h),
				l: num$1(c.l),
				c: num$1(c.c),
				v: num$1(c.v)
			})).sort((a, b) => a.t - b.t);
			const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
			if (!ticker) return null;
			return {
				symbol,
				last: num$1(ticker.last),
				changePct: num$1(ticker.change_percentage),
				turnover: num$1(ticker.volume_24h_quote),
				funding: num$1(ticker.funding_rate),
				candles: closed
			};
		}
		const ticker = (await getJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`))[0];
		const candles = parseGateSpotCandles(await getJson(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=15m&limit=120`));
		const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
		if (!ticker) return null;
		return {
			symbol,
			last: num$1(ticker.last),
			changePct: num$1(ticker.change_percentage),
			turnover: num$1(ticker.quote_volume),
			funding: null,
			candles: closed
		};
	}))).filter((x) => !!x && x.last > 0), market, lessons, recent, threshold, bias);
}
async function lastPrice(feed, market, symbol) {
	if (feed === "bybit") return num$1((await bybitPublic(`/v5/market/tickers?category=${market === "linear" ? "linear" : "spot"}&symbol=${symbol}`)).list?.[0]?.lastPrice);
	const pair = gatePair(symbol);
	if (market === "linear") return num$1((await getJson(`https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${pair}`))[0]?.last);
	return num$1((await getJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`))[0]?.last);
}
function num(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
function qtyString(q, step) {
	return floorToStep(q, step).toFixed(Math.min(8, decimals(step)));
}
function decimals(step) {
	const s = step.toString();
	if (s.includes("e-")) return Number(s.split("e-")[1] ?? 8);
	const i = s.indexOf(".");
	return i === -1 ? 0 : s.length - i - 1;
}
async function instrument(venue, key, secret, market, symbol) {
	const row = (await bybitSigned({
		venue,
		key,
		secret,
		method: "GET",
		path: "/v5/market/instruments-info",
		query: {
			category: market,
			symbol
		}
	})).list?.[0];
	if (!row) throw new BybitError("Немає специфікації інструмента.");
	return row;
}
async function readAccount(venue, key, secret) {
	try {
		const acc = (await bybitSigned({
			venue,
			key,
			secret,
			method: "GET",
			path: "/v5/account/wallet-balance",
			query: { accountType: "UNIFIED" }
		})).list?.[0];
		const usdt = acc?.coin?.find((c) => c.coin === "USDT");
		return {
			ok: true,
			equity: num(acc?.totalEquity),
			available: num(acc?.totalAvailableBalance ?? usdt?.walletBalance),
			coin: "USDT"
		};
	} catch (error) {
		return fail(error);
	}
}
function fail(error) {
	if (error instanceof BybitError) return {
		ok: false,
		error: error.message,
		code: error.code
	};
	return {
		ok: false,
		error: error instanceof Error ? error.message : "невідома помилка"
	};
}
async function openPosition(args) {
	try {
		if (args.market === "spot" && args.side !== "Buy") return {
			ok: false,
			error: "На споті машина відкриває лише лонг."
		};
		if (!UNIVERSE_OK(args.symbol)) return {
			ok: false,
			error: "Пара поза дозволеним списком."
		};
		const info = await instrument(args.venue, args.key, args.secret, args.market, args.symbol);
		const tick = num(info.priceFilter?.tickSize) || .01;
		const step = num(info.lotSizeFilter?.qtyStep) || (args.market === "spot" ? 10 ** -num(info.lotSizeFilter?.basePrecision || "4") : .001);
		const minQty = num(info.lotSizeFilter?.minOrderQty);
		const last = num((await bybitSigned({
			venue: args.venue,
			key: args.key,
			secret: args.secret,
			method: "GET",
			path: "/v5/market/tickers",
			query: {
				category: args.market,
				symbol: args.symbol
			}
		})).list?.[0]?.lastPrice);
		if (!(last > 0)) return {
			ok: false,
			error: "Немає ціни Bybit для входу."
		};
		const stop = args.side === "Buy" ? roundToTick(args.stop, tick, "down") : roundToTick(args.stop, tick, "up");
		const take = args.side === "Buy" ? roundToTick(args.take, tick, "up") : roundToTick(args.take, tick, "down");
		const dist = Math.abs(last - stop) / last;
		if (dist < .0015 || dist > .08) return {
			ok: false,
			error: "Стоп після округлення непридатний."
		};
		let notional = Math.min(args.notional, args.weeklyUsd * .22 * (args.market === "linear" ? 3 : 1));
		if (dist * notional > args.weeklyUsd * .016) notional = args.weeklyUsd * .015 / dist;
		const leverage = args.market === "linear" ? Math.min(3, Math.max(1, Math.round(args.leverage))) : 1;
		const account = await readAccount(args.venue, args.key, args.secret);
		if (!account.ok) return {
			ok: false,
			error: account.error,
			...account.code ? { code: account.code } : {}
		};
		const cash = account.available > 0 ? account.available : account.equity;
		if (!(cash >= 10)) return {
			ok: false,
			error: "Вільно менше 10 USDT. Ордер не ставлю."
		};
		if (args.market === "spot") notional = Math.min(notional, cash * .98);
		else if (notional / leverage > cash * .85) notional = cash * .85 * leverage;
		if (notional < 10) return {
			ok: false,
			error: "Після балансу номінал нижче 10 USDT."
		};
		if (args.market === "linear") try {
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
					sellLeverage: String(leverage)
				}
			});
		} catch (error) {
			if (!(error instanceof BybitError) || error.code !== "lev_same") {
				const msg = error instanceof Error ? error.message : "";
				if (!/not modified|leverage not modified|110043/i.test(msg)) throw error;
			}
		}
		const orderLinkId = `p5${Date.now().toString(36)}`.slice(0, 32);
		let qty = notional / last;
		qty = floorToStep(qty, step);
		if (minQty && qty < minQty) return {
			ok: false,
			error: `Мінімум ${args.symbol} — ${minQty}. Після ризику виходить ${qty}.`
		};
		if (!(qty > 0)) return {
			ok: false,
			error: "Кількість округлилась до нуля."
		};
		if (args.market === "spot") {
			const base = args.symbol.replace(/USDT$/, "");
			if (num((await bybitSigned({
				venue: args.venue,
				key: args.key,
				secret: args.secret,
				method: "GET",
				path: "/v5/account/wallet-balance",
				query: {
					accountType: "UNIFIED",
					coin: base
				}
			})).list?.[0]?.coin?.find((coin) => coin.coin === base)?.walletBalance) > qty * .5) return {
				ok: false,
				error: `На споті вже є ${base}. Другу покупку не роблю.`
			};
		}
		const created = args.market === "linear" ? await placeLinear(args, qty, step, stop, take, orderLinkId) : await placeSpot(args, notional, info, orderLinkId, stop, take);
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
			exchangeTarget: created.exchangeTarget
		};
	} catch (error) {
		return fail(error);
	}
}
function UNIVERSE_OK(symbol) {
	return [
		"BTCUSDT",
		"ETHUSDT",
		"SOLUSDT",
		"XRPUSDT",
		"LINKUSDT",
		"AVAXUSDT",
		"ADAUSDT",
		"DOGEUSDT"
	].includes(symbol);
}
async function placeLinear(args, qty, step, stop, take, orderLinkId) {
	const qtyStr = qtyString(qty, step);
	const px = (n) => n.toString();
	const send = (idx, link, withStops) => bybitSigned({
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
			...withStops ? {
				takeProfit: px(take),
				stopLoss: px(stop),
				tpslMode: "Full",
				tpOrderType: "Market",
				slOrderType: "Market",
				tpTriggerBy: "LastPrice",
				slTriggerBy: "LastPrice"
			} : {}
		}
	});
	const armStop = (idx) => bybitSigned({
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
			slTriggerBy: "LastPrice"
		}
	});
	let idx = 0;
	let orderId = "";
	let armed = true;
	for (let attempt = 0; attempt < 2; attempt++) {
		const link = `${orderLinkId}${attempt}`.slice(0, 36);
		try {
			try {
				orderId = (await send(idx, link, true)).orderId ?? "";
				armed = true;
			} catch (error) {
				const msg = error instanceof Error ? error.message : "";
				if (!/tpsl|takeProfit|stopLoss|StopLoss/i.test(msg)) throw error;
				orderId = (await send(idx, `${link}b`.slice(0, 36), false)).orderId ?? "";
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
	if (!(qtyFilled > 0) || !(entry > 0)) throw new BybitError("Ф'ючерсний ордер не підтвердив виконання. Позицію не записую.");
	return {
		orderId,
		qty: qtyFilled,
		entry,
		exchangeStop: armed,
		exchangeTarget: armed
	};
}
async function placeSpot(args, notional, info, orderLinkId, stop, take) {
	const quotePrec = Math.min(8, num(info.lotSizeFilter?.quotePrecision) || 2);
	const quoteQty = floorToStep(notional, 10 ** -quotePrec).toFixed(quotePrec);
	const tick = num(info.priceFilter?.tickSize) || .01;
	const px = (n) => n.toFixed(Math.min(8, decimals(tick)));
	const protect = stop > 0 && take > stop;
	const sendBuy = (withTargets, link) => bybitSigned({
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
			...withTargets ? {
				takeProfit: px(take),
				stopLoss: px(stop),
				tpOrderType: "Market",
				slOrderType: "Market"
			} : {}
		}
	});
	let result;
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
		if (orderId) try {
			await bybitSigned({
				venue: args.venue,
				key: args.key,
				secret: args.secret,
				method: "POST",
				path: "/v5/order/cancel",
				body: {
					category: "spot",
					symbol: args.symbol,
					orderId
				}
			});
		} catch {}
		throw new BybitError("Спотовий ордер не підтвердив виконання. Скасовую, якщо він ще висить.");
	}
	const qty = num(filled?.cumExecQty);
	const entry = num(filled?.avgPrice);
	if (exchangeTarget) return {
		orderId,
		qty,
		entry,
		exchangeStop: true,
		exchangeTarget: true
	};
	const qtyStr = qtyString(qty, 10 ** -num(info.lotSizeFilter?.basePrecision || "4") || 1e-8);
	let exchangeStop = false;
	if (stop > 0 && stop < entry) try {
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
				orderLinkId: `${orderLinkId}s`.slice(0, 36)
			}
		});
		exchangeStop = true;
	} catch {}
	return {
		orderId,
		qty,
		entry,
		exchangeStop
	};
}
async function readOrder(venue, key, secret, market, symbol, orderId) {
	if (!orderId) return null;
	await new Promise((r) => setTimeout(r, 350));
	for (const path of ["/v5/order/realtime", "/v5/order/history"]) try {
		const row = (await bybitSigned({
			venue,
			key,
			secret,
			method: "GET",
			path,
			query: {
				category: market,
				symbol,
				orderId
			}
		})).list?.[0];
		if (row) return row;
	} catch {}
	return null;
}
async function findLinearPositions(args) {
	try {
		return {
			ok: true,
			rows: ((await bybitSigned({
				venue: args.venue,
				key: args.key,
				secret: args.secret,
				method: "GET",
				path: "/v5/position/list",
				query: {
					category: "linear",
					settleCoin: "USDT"
				}
			})).list ?? []).filter((row) => num(row.size) > 0 && UNIVERSE_OK(String(row.symbol ?? ""))).map((row) => ({
				symbol: String(row.symbol),
				side: row.side === "Sell" ? "short" : "long",
				size: num(row.size),
				avg: num(row.avgPrice),
				stop: num(row.stopLoss),
				take: num(row.takeProfit),
				leverage: Math.min(3, Math.max(1, Math.round(num(row.leverage) || 1))),
				unrealised: num(row.unrealisedPnl)
			}))
		};
	} catch (error) {
		return fail(error);
	}
}
async function syncPosition(args) {
	try {
		const last = num((await bybitSigned({
			venue: args.venue,
			key: args.key,
			secret: args.secret,
			method: "GET",
			path: "/v5/market/tickers",
			query: {
				category: args.market,
				symbol: args.symbol
			}
		})).list?.[0]?.lastPrice);
		if (args.market === "linear") {
			const pos = await bybitSigned({
				venue: args.venue,
				key: args.key,
				secret: args.secret,
				method: "GET",
				path: "/v5/position/list",
				query: {
					category: "linear",
					symbol: args.symbol
				}
			});
			const row = pos.list?.find((p) => num(p.size) > 0) ?? pos.list?.[0];
			const size = num(row?.size);
			let exitPrice = 0;
			let closedPnl = null;
			if (!(size > 0)) try {
				const lastClose = (await bybitSigned({
					venue: args.venue,
					key: args.key,
					secret: args.secret,
					method: "GET",
					path: "/v5/position/closed-pnl",
					query: {
						category: "linear",
						symbol: args.symbol,
						limit: "1"
					}
				})).list?.[0];
				const updated = num(lastClose?.updatedTime);
				const fresh = !args.openedAt || updated >= args.openedAt - 12e4;
				const exit = num(lastClose?.avgExitPrice);
				if (fresh && exit > 0) {
					exitPrice = exit;
					closedPnl = num(lastClose?.closedPnl);
				}
			} catch {}
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
				closedPnl
			};
		}
		const base = args.symbol.replace(/USDT$/, "");
		const held = num((await bybitSigned({
			venue: args.venue,
			key: args.key,
			secret: args.secret,
			method: "GET",
			path: "/v5/account/wallet-balance",
			query: {
				accountType: "UNIFIED",
				coin: base
			}
		})).list?.[0]?.coin?.find((coin) => coin.coin === base)?.walletBalance);
		const qty = args.qty ?? 0;
		const flat = qty > 0 ? !(held > qty * .5) : !(held > 0);
		const armed = ((await bybitSigned({
			venue: args.venue,
			key: args.key,
			secret: args.secret,
			method: "GET",
			path: "/v5/order/realtime",
			query: {
				category: "spot",
				symbol: args.symbol,
				orderFilter: "tpslOrder"
			}
		})).list ?? []).some((order) => /untriggered|new|active/i.test(order.orderStatus ?? ""));
		const order = args.orderId ? await readOrder(args.venue, args.key, args.secret, "spot", args.symbol, args.orderId) : null;
		return {
			ok: true,
			flat,
			size: num(order?.cumExecQty) || held,
			avgPrice: num(order?.avgPrice),
			last,
			unrealisedPnl: 0,
			orderStatus: flat ? "flat" : order?.orderStatus ?? "open",
			exchangeStop: armed,
			exitPrice: 0,
			closedPnl: null
		};
	} catch (error) {
		return fail(error);
	}
}
async function closePosition(args) {
	try {
		const info = await instrument(args.venue, args.key, args.secret, args.market, args.symbol);
		const step = num(info.lotSizeFilter?.qtyStep) || (args.market === "spot" ? 10 ** -num(info.lotSizeFilter?.basePrecision || "4") : .001);
		const qty = floorToStep(args.qty, step);
		if (!(qty > 0)) return {
			ok: false,
			error: "Немає кількості для закриття."
		};
		const exitSide = args.side === "Buy" ? "Sell" : "Buy";
		const orderLinkId = `p5c${Date.now().toString(36)}`.slice(0, 32);
		const qtyStr = qtyString(qty, step);
		let created = null;
		if (args.market === "linear") {
			let idx = 0;
			for (let attempt = 0; attempt < 2; attempt++) try {
				created = await bybitSigned({
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
						orderLinkId: `${orderLinkId}${attempt}`.slice(0, 36)
					}
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
		} else {
			try {
				await bybitSigned({
					venue: args.venue,
					key: args.key,
					secret: args.secret,
					method: "POST",
					path: "/v5/order/cancel-all",
					body: {
						category: "spot",
						symbol: args.symbol,
						orderFilter: "tpslOrder"
					}
				});
			} catch {}
			const base = args.symbol.replace(/USDT$/, "");
			const held = num((await bybitSigned({
				venue: args.venue,
				key: args.key,
				secret: args.secret,
				method: "GET",
				path: "/v5/account/wallet-balance",
				query: {
					accountType: "UNIFIED",
					coin: base
				}
			})).list?.[0]?.coin?.find((coin) => coin.coin === base)?.walletBalance);
			if (!(held > 0) || held < qty * .5) return {
				ok: true,
				exit: num((await bybitSigned({
					venue: args.venue,
					key: args.key,
					secret: args.secret,
					method: "GET",
					path: "/v5/market/tickers",
					query: {
						category: "spot",
						symbol: args.symbol
					}
				})).list?.[0]?.lastPrice)
			};
			created = await bybitSigned({
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
					orderLinkId
				}
			});
		}
		const filled = await readOrder(args.venue, args.key, args.secret, args.market, args.symbol, created?.orderId ?? "");
		const ticker = await bybitSigned({
			venue: args.venue,
			key: args.key,
			secret: args.secret,
			method: "GET",
			path: "/v5/market/tickers",
			query: {
				category: args.market,
				symbol: args.symbol
			}
		});
		return {
			ok: true,
			exit: num(filled?.avgPrice) || num(ticker.list?.[0]?.lastPrice)
		};
	} catch (error) {
		return fail(error);
	}
}
//#endregion
export { sizePosition as C, weekStart as E, scanGate as S, utcDay as T, localCritic as _, WEEKLY_LOSS_PCT as a, readAccount as b, closePosition as c, fitToBalance as d, formatHm as f, loadTapeBias as g, lastPrice as h, REHEARSAL_TIME_STOP_MS as i, closeReading as l, formatUsd as m, DAILY_LOSS_PCT as n, breakevenPx as o, formatPx as p, LIVE_TIME_STOP_MS as r, capitalStance as s, BybitError as t, findLinearPositions as u, netPnl as v, syncPosition as w, scanBybit as x, openPosition as y };
