import { i as __toESM } from "../_runtime.mjs";
import { a as AlertDialogDescription, c as AlertDialogTitle, d as require_react, i as AlertDialogContent, n as AlertDialogAction, o as AlertDialogOverlay, r as AlertDialogCancel, s as AlertDialogPortal, t as AlertDialog, u as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { A as utcDay, C as netPnl, E as scanBybit, O as sizePosition, S as marketCensus, T as readAccount, a as WEEKLY_LOSS_PCT, b as localCritic, c as closePosition, d as findLinearPositions, f as fitToBalance, g as formatUsd, h as formatPx, i as REHEARSAL_TIME_STOP_MS, j as weekStart, k as syncPosition, l as closeReading, m as formatHm, n as DAILY_LOSS_PCT, o as breakevenPx, p as fitToTurnover, r as LIVE_TIME_STOP_MS, s as capitalStance, t as BybitError, u as describeBook, v as liquidityLine, w as openPosition, x as marketBrief, y as loadTapeBias } from "./trade-exec-D8Y9Apai.mjs";
import { n as Line, r as ResponsiveContainer, t as LineChart } from "../_libs/recharts+[...].mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-NCwaThnx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var QUOTA = [
	{
		id: "local",
		title: "Локальна рада",
		limit: "Без мережі й без ключа",
		fit: "0 запитів. Вистачить завжди."
	},
	{
		id: "groq",
		title: "Groq, gpt-oss-20b",
		limit: "1000 запитів на день, 30 на хвилину",
		fit: "Сесія бере до 12. Лишається близько 988."
	},
	{
		id: "openrouter",
		title: "OpenRouter, безкоштовні моделі",
		limit: "50 на день, поки не куплено кредитів",
		fit: "12 із 50. Друга сесія того ж дня вже не влізе."
	},
	{
		id: "gemini",
		title: "Gemini Flash / Gemma",
		limit: "Flash часто 20–500 на день, Gemma до 14400",
		fit: "12 тісно, якщо Flash дає лише 20. Тоді Groq."
	},
	{
		id: "grok",
		title: "Grok цього застосунку",
		limit: "Квота власника, не безкоштовний пул",
		fit: "Лише якщо увімкнути вручну. Стеля ті самі 12."
	}
];
var QUOTA_PLAN = `Одна сесія — це 5 угод і не більше 12 викликів моделі: критик перед входом і рецензент після виходу, плюс два запасні вето. Далі рада працює локально і модель не чіпає. Розмір, плече і стоп модель змінити не може.`;
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
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
var scanMarkets = createServerFn({ method: "POST" }).validator(scanInput).handler(createSsrRpc("0958818ceca6ee9d974a8890c9045aec7613de8cf30e7fd93a1c0d0671884e7a"));
var quotePrice = createServerFn({ method: "POST" }).validator((input) => {
	const o = input ?? {};
	return {
		feed: o.feed === "bybit" ? "bybit" : "gate",
		market: o.market === "linear" ? "linear" : "spot",
		symbol: String(o.symbol ?? "")
	};
}).handler(createSsrRpc("8966c83e131fb25fba37298ab0506a0a758b54fba92b14c8d625aafb03bf0f9f"));
createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("dd07af43603dcef780eb9d10fc2eb313834b74da1b688a3c63ae43670d5b8a99"));
createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("465a593b114661d9356d0e3c06af6488ecf5fc15ed8dfc14ba15aacba9ee0cbc"));
createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("2c8ceaf331ff52b4c8b6dab5d7047014dcb77b7429ffa3e23d63f34d2a4f2b19"));
createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("4a789028edc32128267b1f4d65c0c4d4f0f9db381aaaadbece73b12e3b72cb50"));
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
var askAgent = createServerFn({ method: "POST" }).validator(asBrain).handler(createSsrRpc("c2882ee1d3406d498a2c38846931dc27b6fe5c9a43059a791bbc30790301eeb4"));
var KEY = "pyatirka-ledger";
var HORIZON = 144e5;
var ROUND_TRIP = .0011;
function read() {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function write(rows) {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(rows.slice(-48)));
	} catch {}
}
function rOf(side, entry, stop, exit) {
	const risk = Math.abs(entry - stop);
	if (!(risk > 0)) return 0;
	return (side === "long" ? exit - entry : entry - exit) / risk;
}
function applyBar(check, row, now) {
	if (check.status !== "open") return check;
	let next = check;
	const barT = row?.barT ?? 0;
	const barH = row?.barH ?? 0;
	const barL = row?.barL ?? 0;
	if (barT >= check.at && barT > check.seenT && barH > 0 && barL > 0) {
		const stopHit = check.side === "long" ? barL <= check.stop : barH >= check.stop;
		const takeHit = check.side === "long" ? barH >= check.take : barL <= check.take;
		if (stopHit || takeHit) {
			const status = stopHit ? "loss" : "win";
			const exit = stopHit ? check.stop : check.take;
			next = {
				...check,
				seenT: barT,
				status,
				exit,
				r: rOf(check.side, check.entry, check.stop, exit)
			};
		} else next = {
			...check,
			seenT: barT
		};
	}
	if (next.status !== "open") return next;
	const last = row?.last ?? 0;
	if (!(last > 0) || now - check.at < HORIZON) return next;
	const move = check.side === "long" ? last - check.entry : check.entry - last;
	const status = move > check.entry * ROUND_TRIP ? "win" : move < -check.entry * ROUND_TRIP ? "loss" : "flat";
	return {
		...next,
		status,
		exit: last,
		r: rOf(check.side, check.entry, check.stop, last)
	};
}
function observeBoard(rows, now = Date.now()) {
	const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
	let checks = read().map((check) => applyBar({
		...check,
		seenT: check.seenT ?? 0
	}, bySymbol.get(check.symbol), now));
	const open = new Set(checks.filter((check) => check.status === "open").map((check) => check.symbol));
	for (const row of rows) {
		if (!row.tradable || row.side !== "long" && row.side !== "short" || open.has(row.symbol)) continue;
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
			status: "open"
		});
		open.add(row.symbol);
	}
	const settled = checks.filter((check) => check.status !== "open");
	const pending = checks.filter((check) => check.status === "open");
	checks = [...settled.slice(-40), ...pending].slice(-48);
	write(checks);
	if (settled.length === 0) return pending.length ? `Перевірка сигналів: ${pending.length} чекають до 4 годин. Поріг не знижую.` : "";
	const wins = settled.filter((check) => check.status === "win").length;
	const avg = settled.reduce((sum, check) => sum + (check.r ?? 0), 0) / settled.length;
	return `Перевірка сигналів: ${settled.length} закритих, ${wins} у плюс після комісії, середнє ${avg.toFixed(2)}R. Ще ${pending.length} відкритих. Рахуються тіні закритих 15-хвилинних свічок. Свічка, де є і стоп, і ціль, іде в мінус. Поріг не знижую.`;
}
var defaultSettings = {
	venue: "rehearsal",
	market: "spot",
	weeklyUsd: 250,
	riskPct: .008,
	bybitKey: "",
	bybitSecret: "",
	brain: "local",
	llmKeys: {
		groq: "",
		gemini: "",
		openrouter: ""
	}
};
function freshSession() {
	return {
		running: false,
		resumeHint: false,
		phase: "idle",
		day: "",
		week: "",
		closedToday: 0,
		closedWeek: 0,
		realizedToday: 0,
		realizedWeek: 0,
		trades: [],
		lessons: [],
		log: [],
		board: [],
		feed: "gate",
		feedNote: "",
		ledgerNote: "",
		active: null,
		emptyScans: 0,
		llmCalls: 0,
		haltReason: null,
		orderErrors: 0,
		vetoes: 0,
		threshold: 64,
		banned: []
	};
}
var SLOTS = [
	"groq",
	"gemini",
	"openrouter"
];
var BACKUP = "pyatirka-keys";
var STORE = "pyatirka-v1";
var hydrated = false;
var secretEdits = 0;
function noteSecretEdit() {
	secretEdits += 1;
}
function normalizeSettings(raw, base) {
	const llmKeys = {
		...base.llmKeys,
		...raw?.llmKeys
	};
	const legacy = typeof raw?.llmKey === "string" ? raw.llmKey : "";
	const brain = raw?.brain ?? base.brain;
	if (legacy && (brain === "groq" || brain === "gemini" || brain === "openrouter") && !llmKeys[brain]) llmKeys[brain] = legacy;
	return {
		...base,
		...raw,
		llmKeys
	};
}
function readBackup() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(BACKUP);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}
function readPersistSettings() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORE);
		if (!raw) return null;
		return JSON.parse(raw).state?.settings ?? null;
	} catch {
		return null;
	}
}
function pickSecret(next, saved, backup) {
	if (next.trim()) return next;
	if (secretEdits > 0) return "";
	if (saved?.trim()) return saved;
	if (backup?.trim()) return backup;
	return "";
}
function keepStoredSecrets(next) {
	const saved = readPersistSettings();
	const backup = readBackup();
	const llmKeys = { ...next.llmKeys };
	for (const slot of SLOTS) llmKeys[slot] = pickSecret(next.llmKeys[slot] ?? "", saved?.llmKeys?.[slot], backup?.llmKeys?.[slot]);
	return {
		...next,
		bybitKey: pickSecret(next.bybitKey, saved?.bybitKey, backup?.bybitKey),
		bybitSecret: pickSecret(next.bybitSecret, saved?.bybitSecret, backup?.bybitSecret),
		llmKeys
	};
}
function backupSettings(settings) {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(BACKUP, JSON.stringify(keepStoredSecrets(settings)));
	} catch {}
}
var baseStorage = createJSONStorage(() => localStorage);
var useDesk = create()(persist((set) => ({
	settings: defaultSettings,
	session: freshSession(),
	setSettings: (patch) => set((state) => {
		const settings = keepStoredSecrets({
			...state.settings,
			...patch
		});
		backupSettings(settings);
		return { settings };
	}),
	patchSession: (patch) => set((state) => ({ session: typeof patch === "function" ? patch(state.session) : {
		...state.session,
		...patch
	} })),
	resetJournal: () => set((state) => ({ session: {
		...freshSession(),
		board: state.session.board,
		feed: state.session.feed,
		feedNote: state.session.feedNote,
		ledgerNote: state.session.ledgerNote
	} }))
}), {
	name: STORE,
	storage: {
		getItem: (name) => baseStorage?.getItem(name) ?? null,
		setItem: (name, value) => {
			if (!hydrated || !baseStorage) return;
			const record = value;
			if (record.state?.settings) record.state.settings = keepStoredSecrets(record.state.settings);
			baseStorage.setItem(name, value);
		},
		removeItem: (name) => baseStorage?.removeItem(name)
	},
	skipHydration: true,
	onRehydrateStorage: () => () => {
		hydrated = true;
	},
	merge: (persisted, current) => {
		const saved = persisted ?? {};
		const backup = readBackup();
		const base = normalizeSettings(saved.settings, current.settings);
		const settings = keepStoredSecrets({
			...base,
			bybitKey: pickSecret(current.settings.bybitKey, base.bybitKey, backup?.bybitKey),
			bybitSecret: pickSecret(current.settings.bybitSecret, base.bybitSecret, backup?.bybitSecret),
			llmKeys: {
				groq: pickSecret(current.settings.llmKeys.groq, base.llmKeys.groq, backup?.llmKeys?.groq),
				gemini: pickSecret(current.settings.llmKeys.gemini, base.llmKeys.gemini, backup?.llmKeys?.gemini),
				openrouter: pickSecret(current.settings.llmKeys.openrouter, base.llmKeys.openrouter, backup?.llmKeys?.openrouter)
			}
		});
		return {
			...current,
			settings,
			session: {
				...current.session,
				...saved.session,
				running: false
			}
		};
	},
	partialize: (state) => ({
		settings: state.settings,
		session: {
			...state.session,
			running: false,
			log: state.session.log.slice(0, 40),
			trades: state.session.trades.slice(0, 40),
			board: state.session.board.map((row) => ({
				...row,
				spark: row.spark.slice(-16)
			}))
		}
	})
}));
var chain = Promise.resolve();
function patch(partial) {
	useDesk.getState().patchSession(partial);
}
function log(agent, text) {
	patch((session) => ({
		...session,
		log: [{
			id: crypto.randomUUID(),
			t: Date.now(),
			agent,
			text: text.slice(0, 320)
		}, ...session.log].slice(0, 80)
	}));
}
function logSpare(agent, text, minGap) {
	const last = useDesk.getState().session.log.find((line) => line.agent === agent);
	if (last && Date.now() - last.t < minGap) return;
	log(agent, text);
}
function rolled(session) {
	const day = utcDay();
	const week = weekStart();
	let next = session;
	if (!next.day) next = {
		...next,
		day,
		week
	};
	if (next.week && next.week !== week && !next.active) next = {
		...next,
		week,
		closedWeek: 0,
		realizedWeek: 0
	};
	if (next.day && next.day !== day && !next.active) next = {
		...next,
		day,
		closedToday: 0,
		realizedToday: 0,
		emptyScans: 0,
		llmCalls: 0,
		vetoes: 0,
		banned: [],
		threshold: 64,
		orderErrors: 0,
		phase: next.phase === "done" || next.phase === "halted" ? "idle" : next.phase,
		haltReason: next.phase === "done" || next.phase === "halted" ? null : next.haltReason
	};
	return next;
}
async function loadBoard(allowFallback) {
	const { settings, session } = useDesk.getState();
	const recent = session.trades.filter((trade) => utcDay(new Date(trade.closedAt)) === (session.day || utcDay())).map((trade) => trade.symbol);
	if (settings.venue !== "rehearsal") try {
		const tape = await loadTapeBias().catch(() => null);
		const rows = await scanBybit(settings.market, session.lessons, recent, session.threshold, tape?.bias ?? null);
		const extra = tape?.line ? ` ${tape.line}` : "";
		const census = await marketCensus().catch(() => "");
		return {
			ok: true,
			feed: "bybit",
			note: `Стрічка Bybit з вашого інтернету.${census ? ` ${census}` : ""}${extra}`,
			rows
		};
	} catch (error) {
		return {
			ok: false,
			code: error instanceof BybitError ? error.code : void 0,
			error: error instanceof Error ? error.message : "Стрічка Bybit недоступна з цього телефону."
		};
	}
	return scanMarkets({ data: {
		market: settings.market,
		lessons: session.lessons,
		recent,
		threshold: session.threshold,
		allowFallback
	} });
}
function kick() {
	chain = chain.then(() => step()).catch((error) => {
		const raw = error instanceof Error ? error.message : "Крок зірвався.";
		log("Рада", /content-type header|Expected property name|HTTPError/i.test(raw) ? "Сервер не дочитав відповідь. Ключі на місці. Якщо це демо Bybit, біржа з цього сервера не відкривається." : raw);
	});
}
async function refreshBoard() {
	const board = await loadBoard(useDesk.getState().settings.venue === "rehearsal");
	if (!board.ok) {
		patch({ feedNote: board.error });
		return;
	}
	patch({
		board: board.rows,
		feed: board.feed,
		feedNote: board.note,
		ledgerNote: observeBoard(board.rows)
	});
}
async function testKeys() {
	const { settings } = useDesk.getState();
	if (settings.venue === "rehearsal") return {
		ok: false,
		error: "Репетиція не ходить на приватні методи."
	};
	const venue = settings.venue;
	const payload = {
		venue,
		key: settings.bybitKey.trim(),
		secret: settings.bybitSecret.trim()
	};
	if (payload.key.length < 8 || payload.secret.length < 8) return {
		ok: false,
		error: "Впишіть ключ і секрет Bybit."
	};
	return readAccount(venue, payload.key, payload.secret);
}
function startMachine() {
	const { settings } = useDesk.getState();
	let session = rolled(useDesk.getState().session);
	if (!(settings.weeklyUsd >= 30)) return "Тижнева сума — від 30 USDT.";
	if (settings.venue !== "rehearsal") {
		if (settings.bybitKey.trim().length < 8 || settings.bybitSecret.trim().length < 8) return "Для демо і реалу потрібні ключ і секрет Bybit.";
	}
	if (settings.brain !== "local" && settings.brain !== "grok" && settings.llmKeys[settings.brain].trim().length < 8) return "Впишіть безкоштовний ключ моделі або лишіть локальну раду.";
	if (session.day === utcDay() && session.closedToday >= 5 && !session.active) return "Сьогодні п'ять угод уже закрито. Наступний старт — завтра.";
	if (session.closedWeek >= 25 && !session.active) return "Тижневий ліміт 25 угод вичерпано.";
	session = {
		...session,
		running: true,
		resumeHint: false,
		phase: session.active ? "managing" : "scanning",
		day: utcDay(),
		week: weekStart(),
		haltReason: null,
		orderErrors: 0
	};
	patch(session);
	log("Рада", settings.venue === "rehearsal" ? "Старт репетиції. Ордери на біржу не підуть. П'ять угод — і стоп." : `Старт: ${settings.venue === "demo" ? "демо" : "реал"}, ${settings.market === "spot" ? "спот" : "ф'ючерси"}.`);
	kick();
	return null;
}
async function stopMachine() {
	patch({ running: false });
	if (useDesk.getState().session.active) await closeActive("kill");
	patch((session) => ({
		...session,
		running: false,
		phase: session.closedToday >= 5 ? "done" : "halted",
		haltReason: "Зупинено вручну.",
		resumeHint: false
	}));
	log("Рада", "Зупинка. Нових угод не буде, доки не натиснете старт знову.");
}
var tapeAt = Date.now();
async function watchTape() {
	if (Date.now() - tapeAt < 18e4) return;
	tapeAt = Date.now();
	const board = await loadBoard(useDesk.getState().settings.venue === "rehearsal");
	if (!board.ok) return;
	patch({
		board: board.rows,
		feed: board.feed,
		feedNote: board.note,
		ledgerNote: observeBoard(board.rows)
	});
}
async function step() {
	let session = rolled(useDesk.getState().session);
	if (session !== useDesk.getState().session) patch(session);
	const { settings } = useDesk.getState();
	session = useDesk.getState().session;
	if (session.active) {
		patch({ phase: "managing" });
		await steward();
		return;
	}
	if (!session.running) return;
	if (session.closedToday >= 5) {
		end("П'ята угода вже закрита. Машина стоїть.", "done");
		return;
	}
	if (session.closedWeek >= 25) {
		end("Тижневий ліміт 25 угод. Зупинка.", "halted");
		return;
	}
	if (session.realizedToday <= -settings.weeklyUsd * .03) {
		end("Денний ліміт втрат, 3% тижневої суми. Зупинка.", "halted");
		return;
	}
	if (session.realizedWeek <= -settings.weeklyUsd * .06) {
		end("Тижневий ліміт втрат, 6% суми. Зупинка.", "halted");
		return;
	}
	await scanAndEnter();
}
function end(reason, phase) {
	patch({
		running: false,
		phase,
		haltReason: reason,
		resumeHint: false
	});
	log("Рада", reason);
}
async function scanAndEnter() {
	const settings = useDesk.getState().settings;
	const stance = capitalStance(useDesk.getState().session.trades, settings.riskPct);
	if (stance.pause) {
		end(stance.pause, "halted");
		return;
	}
	patch({ phase: "scanning" });
	log("Розвідник", "Знімаю 15-хвилинні свічки ліквідних USDT-пар, не лише вісімки.");
	const board = await loadBoard(settings.venue === "rehearsal");
	if (!useDesk.getState().session.running) return;
	if (!board.ok) {
		log("Розвідник", board.error);
		if (board.code === "geo_blocked" || board.code === "unreachable") {
			end("З цього телефону Bybit не відповів. Ключі збережені. Перевірте, що біржа відкривається в цьому інтернеті, ключ створено в Demo Trading і без чужої IP. Репетиція лишається доступною.", "halted");
			return;
		}
		noteError();
		return;
	}
	patch({
		board: board.rows,
		feed: board.feed,
		feedNote: board.note,
		ledgerNote: observeBoard(board.rows)
	});
	if (settings.venue !== "rehearsal" && board.feed !== "bybit") {
		end("Живий режим вимагає цін Bybit. Зараз біржа недоступна.", "halted");
		return;
	}
	if (settings.venue !== "rehearsal" && settings.market === "linear") {
		const held = await findLinearPositions({
			venue: settings.venue,
			key: settings.bybitKey.trim(),
			secret: settings.bybitSecret.trim()
		});
		if (!useDesk.getState().session.running) return;
		if (!held.ok) {
			log("Виконавець", held.error);
			noteError();
			return;
		}
		if (held.rows.length > 1) {
			end(`На ф'ючерсах уже ${held.rows.length} позиції (${held.rows.map((row) => row.symbol).join(", ")}). Нову не відкриваю.`, "halted");
			return;
		}
		const lone = held.rows[0];
		if (lone && lone.avg > 0 && !useDesk.getState().session.active) {
			patch({
				active: {
					id: crypto.randomUUID(),
					symbol: lone.symbol,
					side: lone.side,
					entry: lone.avg,
					stop: lone.stop,
					take: lone.take,
					qty: lone.size,
					notional: lone.avg * lone.size,
					leverage: lone.leverage,
					margin: lone.avg * lone.size / lone.leverage,
					openedAt: Date.now(),
					thesis: "Позиція вже була на Bybit. Підхопив, щоб не відкрити другу.",
					fingerprint: "",
					feed: "bybit",
					unrealized: lone.unrealised,
					exchangeStop: lone.stop > 0
				},
				phase: "managing",
				emptyScans: 0,
				orderErrors: 0,
				feed: "bybit"
			});
			log("Виконавець", `${lone.symbol} уже відкрита на біржі. Нову не ставлю. ${lone.stop > 0 ? "Стоп на біржі є." : "Стопа на біржі немає, вкладку не закривайте."}`);
			return;
		}
	}
	const session = useDesk.getState().session;
	const cooled = new Set(session.trades.filter((trade) => Date.now() - trade.closedAt < 36e5).map((trade) => trade.symbol));
	const row = board.rows.find((item) => item.tradable && !session.banned.includes(item.symbol) && !cooled.has(item.symbol));
	if (!row || row.side === "flat") {
		const best = board.rows[0];
		const paused = board.rows.find((item) => item.tradable && !session.banned.includes(item.symbol) && cooled.has(item.symbol));
		patch({ emptyScans: session.emptyScans + 1 });
		log("Розвідник", paused ? `Пропуск. ${paused.symbol} на паузі годину після закриття.` : best?.reasons.some((reason) => /новин|макро|CPI|FOMC|NFP|PCE|Фандинг/i.test(reason)) ? `Пропуск. ${best.reasons.find((reason) => /новин|макро|CPI|FOMC|NFP|PCE|Фандинг/i.test(reason))}` : best ? `Кращий бал ${best.score} у ${best.symbol}. Поріг ${session.threshold} не знижую: слабші сетапи на історії не відігравали.` : "Стрічка порожня.");
		return;
	}
	const critic = await criticize(row);
	if (!useDesk.getState().session.running) return;
	if (critic === "veto") return;
	const side = row.side;
	let bank = settings.weeklyUsd;
	let cash = bank;
	if (settings.venue !== "rehearsal") {
		const account = await readAccount(settings.venue, settings.bybitKey.trim(), settings.bybitSecret.trim());
		if (!useDesk.getState().session.running) return;
		if (!account.ok) {
			log("Ризик", account.error);
			noteError();
			return;
		}
		cash = account.available > 0 ? account.available : account.equity;
		if (!(cash >= 10)) {
			end("Вільно менше 10 USDT. Новий ордер не ставлю.", "halted");
			return;
		}
		if (cash < bank) {
			log("Ризик", `Вільно ${cash.toFixed(0)} USDT, тижнева сума ${bank.toFixed(0)}. Рахую від вільного.`);
			bank = cash;
		}
		const sessionNow = useDesk.getState().session;
		if (sessionNow.realizedToday <= -bank * .03) {
			end("Денний ліміт від фактичного балансу. Зупинка.", "halted");
			return;
		}
		if (sessionNow.realizedWeek <= -bank * .06) {
			end("Тижневий ліміт від фактичного балансу. Зупинка.", "halted");
			return;
		}
	}
	const sized = sizePosition({
		market: settings.market,
		side,
		weeklyUsd: bank,
		riskPct: stance.riskPct,
		entry: row.entry,
		stop: row.stop
	});
	if (!sized.ok) {
		log("Ризик", `${row.symbol}: ${sized.error}`);
		patch((current) => ({
			...current,
			banned: [...current.banned, row.symbol].slice(-12)
		}));
		return;
	}
	const fitted = settings.venue === "rehearsal" ? sized : fitToBalance(sized, {
		market: settings.market,
		available: cash,
		entry: row.entry,
		stop: row.stop,
		weeklyUsd: bank
	});
	if (!fitted.ok) {
		log("Ризик", `${row.symbol}: ${fitted.error}`);
		if (/Вільно менше|Після балансу/i.test(fitted.error)) {
			end(fitted.error, "halted");
			return;
		}
		patch((current) => ({
			...current,
			banned: [...current.banned, row.symbol].slice(-12)
		}));
		return;
	}
	const booked = fitToTurnover(fitted, {
		turnover: row.turnover,
		entry: row.entry,
		stop: row.stop
	});
	if (!booked.ok) {
		log("Капітал", `${row.symbol}: ${booked.error}`);
		patch((current) => ({
			...current,
			banned: [...current.banned, row.symbol].slice(-12)
		}));
		return;
	}
	log("Капітал", `${stance.note ? `${stance.note} ` : ""}${row.symbol}: ризик ${booked.riskUsd.toFixed(2)} USDT, номінал ${booked.notional.toFixed(0)}, плече ${booked.leverage}. Стоп незмінний.`);
	if (settings.venue === "rehearsal") {
		openPaper(row, booked);
		return;
	}
	await openLive(row, booked);
}
async function criticize(row) {
	const local = localCritic(row);
	const { settings, session } = useDesk.getState();
	if (local.verdict === "veto") {
		log("Критик", local.note);
		return "veto";
	}
	if (settings.brain === "local" || session.vetoes >= 2 || session.llmCalls >= 12) {
		log("Критик", local.note);
		return "allow";
	}
	const lessons = session.lessons.slice(0, 6).map((lesson) => `${lesson.fp} мінусів ${lesson.losses}: ${lesson.note}`).join("; ");
	const prompt = [
		"Ти критик торгової ради. Не змінюєш розмір, плече, стоп чи ціль.",
		"Відповідай лише JSON {\"verdict\":\"allow\"|\"veto\",\"note\":\"до 160 символів українською\"}.",
		"Veto лише якщо сетап суперечить сам собі або урок прямо забороняє цей відбиток.",
		`Пара ${row.symbol}, ${row.side}, бал ${row.score}, RSI ${row.rsi.toFixed(1)}, ATR ${(row.atrPct * 100).toFixed(2)}%.`,
		`Вхід ${row.entry}, стоп ${row.stop}, ціль ${row.take}.`,
		`Причини: ${row.reasons.join(" ")}`,
		lessons ? `Уроки: ${lessons}` : "Уроків ще немає."
	].join("\n");
	const slot = settings.brain === "groq" || settings.brain === "gemini" || settings.brain === "openrouter" ? settings.brain : "groq";
	const asked = await askAgent({ data: {
		brain: settings.brain,
		llmKey: settings.brain === "grok" ? "" : settings.llmKeys[slot],
		prompt
	} });
	if (asked.spent) patch((current) => ({
		...current,
		llmCalls: current.llmCalls + 1
	}));
	if (!asked.ok) {
		log("Критик", `${local.note} Модель: ${asked.error}`);
		return "allow";
	}
	const parsed = readJson(asked.text);
	const verdict = parsed?.verdict === "veto" ? "veto" : "allow";
	const note = String(parsed?.note ?? local.note).slice(0, 180);
	if (verdict === "veto") {
		patch((current) => ({
			...current,
			vetoes: current.vetoes + 1,
			banned: [...current.banned, row.symbol].slice(-12)
		}));
		log("Критик", `Вето. ${note}`);
		return "veto";
	}
	log("Критик", note || local.note);
	return "allow";
}
function readJson(text) {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]);
	} catch {
		return null;
	}
}
function openPaper(row, sized) {
	const slip = row.side === "long" ? 1.0002 : .9998;
	const entry = row.entry * slip;
	if (!(row.side === "long" ? row.stop < entry && row.take > entry : row.stop > entry && row.take < entry)) {
		log("Виконавець", "Після прослизання геометрія зламалась. Пропуск.");
		return;
	}
	const qty = sized.notional / entry;
	patch({
		active: {
			id: crypto.randomUUID(),
			symbol: row.symbol,
			side: row.side === "short" ? "short" : "long",
			entry,
			stop: row.stop,
			take: row.take,
			qty,
			notional: sized.notional,
			leverage: sized.leverage,
			margin: sized.margin,
			openedAt: Date.now(),
			thesis: row.reasons[0] ?? "Край прийнято радою.",
			fingerprint: row.fingerprint,
			feed: useDesk.getState().session.feed,
			unrealized: 0
		},
		phase: "managing",
		emptyScans: 0,
		orderErrors: 0
	});
	log("Виконавець", `Репетиція ${row.side === "long" ? "лонг" : "шорт"} ${row.symbol} @ ${entry.toFixed(4)}. Супровід до стопа, цілі або 50 секунд.`);
}
async function openLive(row, sized) {
	const { settings } = useDesk.getState();
	const venue = settings.venue === "real" ? "real" : "demo";
	const side = row.side === "short" ? "Sell" : "Buy";
	const payload = {
		venue,
		key: settings.bybitKey.trim(),
		secret: settings.bybitSecret.trim(),
		market: settings.market,
		symbol: row.symbol,
		side,
		notional: sized.notional,
		leverage: sized.leverage,
		stop: row.stop,
		take: row.take,
		weeklyUsd: settings.weeklyUsd
	};
	const result = await openPosition(payload);
	if (!useDesk.getState().session.running) {
		if (result.ok) await forceFlat(row.symbol, side, result.qty);
		return;
	}
	if (!result.ok) {
		log("Виконавець", result.error);
		noteError();
		return;
	}
	patch({
		active: {
			id: crypto.randomUUID(),
			symbol: row.symbol,
			side: row.side === "short" ? "short" : "long",
			entry: result.entry,
			stop: result.stop,
			take: result.take,
			qty: result.qty,
			notional: result.notional,
			leverage: result.leverage,
			margin: result.notional / result.leverage,
			openedAt: Date.now(),
			thesis: row.reasons[0] ?? "Край прийнято радою.",
			fingerprint: row.fingerprint,
			orderId: result.orderId,
			feed: "bybit",
			unrealized: 0,
			exchangeStop: result.exchangeStop === true,
			exchangeTarget: result.exchangeTarget === true
		},
		phase: "managing",
		emptyScans: 0,
		orderErrors: 0,
		feed: "bybit"
	});
	log("Виконавець", `${row.side === "long" ? "Лонг" : "Шорт"} ${row.symbol} @ ${result.entry.toFixed(4)}. ${settings.market === "linear" ? result.exchangeStop ? "Стоп і ціль стоять на біржі." : "Стоп на біржі не став. Цю вкладку не закривайте." : result.exchangeTarget ? "Стоп і ціль стоять на біржі і переживуть закриту вкладку." : result.exchangeStop ? "Стоп на біржі і переживе закриту вкладку. Ціль веде ця вкладка: біржа не прийняла пару стоп+ціль." : "На споті стоп веде ця вкладка, доки вона відкрита."}`);
}
function noteError() {
	const errors = useDesk.getState().session.orderErrors + 1;
	if (errors >= 3) {
		end("Три помилки поспіль. Зупинка, щоб не долбити біржу.", "halted");
		return;
	}
	patch({ orderErrors: errors });
}
async function steward() {
	const { session, settings } = useDesk.getState();
	const active = session.active;
	if (!active) return;
	await watchTape().catch(() => void 0);
	const limit = settings.venue === "rehearsal" ? REHEARSAL_TIME_STOP_MS : LIVE_TIME_STOP_MS;
	if (settings.venue === "rehearsal") {
		const price = await mark(active.feed, active.symbol);
		if (!useDesk.getState().session.running && !useDesk.getState().session.active) return;
		if (!(price > 0)) {
			log("Супровід", "Ціна моргнула. Наступний огляд без дій.");
			return;
		}
		const unrealized = netPnl({
			market: settings.market,
			side: active.side,
			qty: active.qty,
			entry: active.entry,
			exit: price
		});
		patch((current) => current.active ? {
			...current,
			active: {
				...current.active,
				unrealized
			}
		} : current);
		const stopHit = active.side === "long" ? price <= active.stop : price >= active.stop;
		const takeHit = active.side === "long" ? price >= active.take : price <= active.take;
		const timed = Date.now() - active.openedAt >= limit;
		if (stopHit) await settle(worse(active.side, active.stop), "stop");
		else if (takeHit) await settle(active.take, "take");
		else if (timed) await settle(price, "time");
		else logSpare("Супровід", `${active.symbol} ${unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)} USDT. Стоп ${active.stop.toFixed(4)}, ціль ${active.take.toFixed(4)}.`, 12e3);
		return;
	}
	const live = await syncLivePosition(active);
	if (!live.ok) {
		if (useDesk.getState().session.running) {
			log("Супровід", live.error);
			noteError();
		} else logSpare("Супровід", live.error, 6e4);
		return;
	}
	if (live.flat) {
		const exit = live.exitPrice || live.last || active.entry;
		await settle(exit, infer(active, exit), true, live.closedPnl);
		return;
	}
	if (active.exchangeStop !== live.exchangeStop) patch((current) => current.active ? {
		...current,
		active: {
			...current.active,
			exchangeStop: live.exchangeStop
		}
	} : current);
	const price = live.last;
	let unrealized = active.unrealized;
	if (price > 0) {
		unrealized = settings.market === "linear" ? live.unrealisedPnl : netPnl({
			market: settings.market,
			side: active.side,
			qty: active.qty,
			entry: active.entry,
			exit: price
		});
		patch((current) => current.active ? {
			...current,
			active: {
				...current.active,
				unrealized
			}
		} : current);
	}
	const stopHit = active.stop > 0 && price > 0 && (active.side === "long" ? price <= active.stop : price >= active.stop);
	const takeHit = active.take > 0 && price > 0 && (active.side === "long" ? price >= active.take : price <= active.take);
	const timed = Date.now() - active.openedAt >= limit;
	const ownExits = settings.market === "linear" && !!active.exchangeStop || settings.market === "spot" && !!active.exchangeTarget;
	if (!ownExits && (stopHit || takeHit || timed)) {
		await closeActive(stopHit ? "stop" : takeHit ? "take" : "time");
		return;
	}
	if (ownExits && timed) {
		await closeActive("time");
		return;
	}
	logSpare("Супровід", `${useDesk.getState().session.running ? "" : "Старт не натиснуто, нових угод немає. "}${active.symbol} ще відкрита. ${price ? `Остання ${price.toFixed(4)}. ` : ""}${settings.market === "linear" ? `Біржа ${unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}, якщо закрити зараз ${closeReading({
		market: settings.market,
		side: active.side,
		qty: active.qty,
		entry: active.entry,
		stop: active.stop,
		unrealized
	}).net.toFixed(2)}.` : ""}${active.exchangeTarget ? "Стоп і ціль стоять на біржі і переживуть закриту вкладку." : active.exchangeStop && settings.market === "spot" ? "Стоп на біржі. Ціль веде ця вкладка." : active.exchangeStop ? "Стоп стоїть на біржі і переживе закриту вкладку." : "Стоп на біржі не став. Цю вкладку не закривайте: стоп веде вона."}`, 2e4);
}
async function syncLivePosition(active) {
	const { settings } = useDesk.getState();
	const payload = {
		venue: settings.venue === "real" ? "real" : "demo",
		key: settings.bybitKey.trim(),
		secret: settings.bybitSecret.trim(),
		market: settings.market,
		symbol: active.symbol,
		orderId: active.orderId,
		qty: active.qty,
		openedAt: active.openedAt
	};
	return syncPosition(payload);
}
async function mark(feed, symbol) {
	const market = useDesk.getState().settings.market;
	const quoted = await quotePrice({ data: {
		feed,
		market,
		symbol
	} });
	return quoted.ok ? quoted.price : 0;
}
function worse(side, stop) {
	return side === "long" ? stop * .9998 : stop * 1.0002;
}
function infer(active, last) {
	if (!(last > 0)) return "flat";
	if (active.side === "long") {
		if (last <= active.stop) return "stop";
		if (last >= active.take) return "take";
	} else {
		if (last >= active.stop) return "stop";
		if (last <= active.take) return "take";
	}
	return "flat";
}
async function closeActive(reason) {
	const { session, settings } = useDesk.getState();
	const active = session.active;
	if (!active) return;
	if (settings.venue === "rehearsal") {
		await settle(await mark(active.feed, active.symbol) || active.entry, reason);
		return;
	}
	const payload = {
		venue: settings.venue === "real" ? "real" : "demo",
		key: settings.bybitKey.trim(),
		secret: settings.bybitSecret.trim(),
		market: settings.market,
		symbol: active.symbol,
		side: active.side === "short" ? "Sell" : "Buy",
		qty: active.qty
	};
	const closed = await closePosition(payload);
	if (!closed.ok) {
		log("Виконавець", `Не зміг закрити: ${closed.error}`);
		noteError();
		return;
	}
	await settle(closed.exit, reason, true);
}
async function forceFlat(symbol, side, qty) {
	const { settings } = useDesk.getState();
	const payload = {
		venue: settings.venue === "real" ? "real" : "demo",
		key: settings.bybitKey.trim(),
		secret: settings.bybitSecret.trim(),
		market: settings.market,
		symbol,
		side,
		qty
	};
	await closePosition(payload);
}
async function settle(exit, reason, exchange = false, exchangePnl = null) {
	const before = useDesk.getState();
	const active = before.session.active;
	if (!active || !(exit > 0)) return;
	const pnl = exchangePnl != null ? exchangePnl : netPnl({
		market: before.settings.market,
		side: active.side,
		qty: active.qty,
		entry: active.entry,
		exit
	});
	let lesson = pnl < 0 ? `Мінус на ${active.fingerprint}. Наступного разу цей відбиток штрафується.` : `Плюс на ${active.fingerprint}. Відбиток трохи реабілітовано.`;
	const brain = before.settings.brain;
	if (brain !== "local" && before.session.llmCalls < 12) {
		const prompt = [
			"Відповідай лише JSON {\"lesson\":\"до 160 символів українською\"}.",
			"Це урок для наступного відбору. Не пропонуй збільшувати ризик, плече чи прибирати стоп.",
			`${active.symbol} ${active.side}, вхід ${active.entry}, вихід ${exit}, результат ${pnl.toFixed(2)} USDT, причина ${reason}.`,
			active.thesis
		].join("\n");
		const asked = await askAgent({ data: {
			brain,
			llmKey: brain === "grok" ? "" : before.settings.llmKeys[brain],
			prompt
		} });
		if (asked.spent) patch((current) => ({
			...current,
			llmCalls: current.llmCalls + 1
		}));
		const parsed = asked.ok ? readJson(asked.text) : null;
		if (parsed?.lesson) lesson = String(parsed.lesson).slice(0, 180);
	}
	const session = useDesk.getState().session;
	const current = session.active?.id === active.id ? session.active : null;
	if (!current) return;
	const lessons = remember(session.lessons, current.fingerprint, pnl, lesson);
	const trade = {
		id: current.id,
		symbol: current.symbol,
		side: current.side,
		entry: current.entry,
		exit,
		stop: current.stop,
		take: current.take,
		qty: current.qty,
		notional: current.notional,
		pnl,
		reason,
		openedAt: current.openedAt,
		closedAt: Date.now(),
		fingerprint: current.fingerprint,
		lesson,
		venue: before.settings.venue,
		market: before.settings.market
	};
	const closedToday = session.closedToday + 1;
	const done = closedToday >= 5;
	const lossDay = session.realizedToday + pnl <= -before.settings.weeklyUsd * DAILY_LOSS_PCT;
	const lossWeek = session.realizedWeek + pnl <= -before.settings.weeklyUsd * WEEKLY_LOSS_PCT;
	const stopNow = done || lossDay || lossWeek || !session.running;
	const haltReason = done ? "П'ята угода закрита. Машина зупинена." : lossDay ? "Денний ліміт втрат після цієї угоди. Зупинка." : lossWeek ? "Тижневий ліміт втрат після цієї угоди. Зупинка." : !session.running ? "Зупинено вручну." : null;
	patch({
		active: null,
		trades: [trade, ...session.trades].slice(0, 40),
		lessons,
		closedToday,
		closedWeek: session.closedWeek + 1,
		realizedToday: session.realizedToday + pnl,
		realizedWeek: session.realizedWeek + pnl,
		phase: done ? "done" : stopNow ? "halted" : "scanning",
		running: stopNow ? false : session.running,
		haltReason,
		orderErrors: 0
	});
	log("Рецензент", `${exchange ? "біржа" : "репетиція"}, ${reason}, ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT. ${lesson}`);
}
function remember(lessons, fp, pnl, note) {
	const prev = lessons.find((lesson) => lesson.fp === fp);
	return [{
		fp,
		losses: pnl < 0 ? (prev?.losses ?? 0) + 1 : Math.max(0, (prev?.losses ?? 0) - 1),
		note,
		at: Date.now()
	}, ...lessons.filter((lesson) => lesson.fp !== fp)].slice(0, 40);
}
var LAST_STUDY = {
	label: "5 лист. 2026",
	days: 75,
	trades15: 151,
	win15: 41,
	avgR15: -.16,
	pf15: .74,
	tradesShock: 137,
	avgRShock: -.15,
	tradesPull: 71,
	avgRPull: -.22,
	avgRLong: -.31,
	avgRMajors: -.16,
	trades1h: 92,
	avgR1h: -.12,
	tradesHtf: 125,
	avgRHtf: -.23,
	tradesBe: 121,
	avgRBe: -.18,
	tradesTight: 467,
	winTight: 69,
	avgRTight: -.22
};
var MODES = [
	{
		venue: "rehearsal",
		market: "spot",
		title: "Репетиція · спот",
		detail: "Живі ціни, ордерів немає"
	},
	{
		venue: "rehearsal",
		market: "linear",
		title: "Репетиція · ф'ючерси",
		detail: "Ті самі правила, шорт дозволений"
	},
	{
		venue: "demo",
		market: "spot",
		title: "Демо · спот",
		detail: "Окремий демо-рахунок Bybit"
	},
	{
		venue: "demo",
		market: "linear",
		title: "Демо · ф'ючерси",
		detail: "Плече не вище 3"
	},
	{
		venue: "real",
		market: "spot",
		title: "Реал · спот",
		detail: "Справжні гроші"
	},
	{
		venue: "real",
		market: "linear",
		title: "Реал · ф'ючерси",
		detail: "Справжні гроші, плече до 3"
	}
];
var BRAINS = [
	{
		id: "local",
		title: "Локальна рада"
	},
	{
		id: "groq",
		title: "Groq"
	},
	{
		id: "gemini",
		title: "Gemini"
	},
	{
		id: "openrouter",
		title: "OpenRouter"
	},
	{
		id: "grok",
		title: "Grok"
	}
];
var PHASE = {
	idle: "Очікує",
	scanning: "Шукає вхід",
	managing: "Веде угоду",
	done: "П'ять закрито",
	halted: "Зупинено"
};
function DeskApp() {
	const settings = useDesk((state) => state.settings);
	const session = useDesk((state) => state.session);
	const setSettings = useDesk((state) => state.setSettings);
	const resetJournal = useDesk((state) => state.resetJournal);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [confirm, setConfirm] = (0, import_react.useState)(false);
	const [account, setAccount] = (0, import_react.useState)(null);
	const [busyKeys, setBusyKeys] = (0, import_react.useState)(false);
	const [keysOpen, setKeysOpen] = (0, import_react.useState)(false);
	const [clock, setClock] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		let alive = true;
		const boot = () => {
			if (alive) setReady(true);
		};
		if (useDesk.persist.hasHydrated()) boot();
		const unsub = useDesk.persist.onFinishHydration(boot);
		useDesk.persist.rehydrate();
		return () => {
			alive = false;
			unsub();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		refreshBoard();
		let stop = false;
		let timer = 0;
		const tick = () => {
			if (stop) return;
			const phase = useDesk.getState().session.phase;
			const rehearsal = useDesk.getState().settings.venue === "rehearsal";
			const running = useDesk.getState().session.running;
			const active = !!useDesk.getState().session.active;
			if (running || active) kick();
			const ms = !running && !active ? 5e3 : phase === "managing" || active ? rehearsal ? 4e3 : 12e3 : rehearsal ? 7e3 : 25e3;
			timer = window.setTimeout(tick, ms);
		};
		timer = window.setTimeout(tick, 800);
		return () => {
			stop = true;
			window.clearTimeout(timer);
		};
	}, [ready]);
	(0, import_react.useEffect)(() => {
		if (!session.active) return;
		const id = window.setInterval(() => setClock(Date.now()), 1e3);
		setClock(Date.now());
		return () => window.clearInterval(id);
	}, [session.active?.id]);
	const riskUsd = settings.weeklyUsd * settings.riskPct;
	const curve = [...session.trades].reverse().reduce((acc, trade) => {
		const prev = acc[acc.length - 1]?.pnl ?? 0;
		acc.push({
			i: acc.length + 1,
			pnl: prev + trade.pnl
		});
		return acc;
	}, []);
	function press() {
		if (session.running) {
			stopMachine();
			setNotice(null);
			return;
		}
		if (settings.venue !== "rehearsal") {
			setConfirm(true);
			return;
		}
		setNotice(startMachine());
	}
	const today = utcDay();
	const doneToday = session.day === today && session.closedToday >= 5;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen w-full max-w-6xl px-4 py-6 pb-28 lg:pb-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium tracking-wide text-muted",
						children: "Bybit · п'ять угод і стоп"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-4xl italic leading-none tracking-tight text-fg sm:text-5xl",
						children: "П'ятірка"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 max-w-xl text-sm text-muted lg:mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "lg:hidden",
							children: "Обираєте режим і суму, тиснете старт. Рада закриває п'яту угоду і стоїть."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden lg:inline",
							children: "Ви кладете ключі, обираєте демо чи реал, спот чи ф'ючерси, тижневу суму і тиснете старт. Рада сама шукає край, ставить стоп, веде угоду і закриває п'яту — далі стоїть."
						})]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-36 rounded-lg border border-line bg-surface px-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Стан"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium text-fg",
							children: PHASE[session.phase] ?? "Очікує"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-sm tabular-nums text-muted",
							children: [
								session.closedToday,
								"/",
								5,
								" сьогодні"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 flex gap-1",
							"aria-hidden": "true",
							children: Array.from({ length: 5 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 flex-1 rounded-sm ${index < session.closedToday ? "bg-accent" : index === session.closedToday && session.active ? "bg-up" : "bg-line"}` }, index))
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "grid gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-line bg-surface p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium text-fg",
								children: "Режим"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 grid grid-cols-2 gap-2",
								children: MODES.map((mode) => {
									const on = settings.venue === mode.venue && settings.market === mode.market;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										disabled: session.running,
										"aria-pressed": on,
										onClick: () => {
											setSettings({
												venue: mode.venue,
												market: mode.market
											});
											if (mode.venue !== "rehearsal") setKeysOpen(true);
										},
										className: `min-h-11 rounded-sm border px-2 py-2 text-left transition-colors duration-150 ${on ? "border-accent bg-raised text-fg" : "border-line bg-bg text-muted"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block text-sm font-medium",
											children: mode.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-1 block text-xs",
											children: mode.detail
										})]
									}, `${mode.venue}-${mode.market}`);
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-line bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-sm font-medium text-fg",
									htmlFor: "weekly",
									children: "Сума на тиждень, USDT"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "weekly",
									inputMode: "decimal",
									disabled: session.running,
									value: Number.isFinite(settings.weeklyUsd) ? String(settings.weeklyUsd) : "",
									onChange: (event) => setSettings({ weeklyUsd: Number(event.target.value) }),
									className: "mt-2 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm tabular-nums text-fg"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex items-center justify-between text-xs text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										"Ризик угоди ",
										Math.round(settings.riskPct * 1e3) / 10,
										"%"
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono tabular-nums text-fg",
										children: [formatUsd(riskUsd), " USDT"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									"aria-label": "Ризик на угоду",
									type: "range",
									min: .4,
									max: 1.5,
									step: .1,
									disabled: session.running,
									value: settings.riskPct * 100,
									onChange: (event) => setSettings({ riskPct: Number(event.target.value) / 100 }),
									className: "mt-2 w-full accent-accent"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 hidden text-xs text-muted lg:block",
									children: "Це банк, не ставка на одну свічку. Денний стоп 3%, тижневий 6%. П'ять угод на добу, 25 на тиждень."
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "hidden lg:block",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StartBlock, {
								running: session.running,
								hasActive: !!session.active,
								doneToday,
								notice,
								onPress: press
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
							className: "rounded-lg border border-line bg-surface p-3",
							open: keysOpen,
							onToggle: (event) => setKeysOpen(event.currentTarget.open),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
									className: "cursor-pointer text-sm font-medium text-fg",
									children: ["Ключі Bybit", settings.bybitKey && settings.bybitSecret ? " · збережено" : ""]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: "Ключ лишається лише в цьому браузері і не йде на сервер. Оновлення столу більше не затирає вже записаний ключ порожнім полем. Якщо зараз порожньо, вставте ключ і секрет ще раз. Перевірка йде з вашого інтернету. Для демо ключ створюється всередині Demo Trading, без списку IP."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "mt-3 block text-xs text-muted",
									htmlFor: "bkey",
									children: "API key"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "bkey",
									autoComplete: "off",
									spellCheck: false,
									disabled: session.running,
									value: settings.bybitKey,
									onChange: (event) => {
										if (event.target.value === "" && document.activeElement !== event.target) return;
										noteSecretEdit();
										setSettings({ bybitKey: event.target.value });
									},
									className: "mt-1 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm text-fg"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "mt-3 block text-xs text-muted",
									htmlFor: "bsec",
									children: "API secret"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "bsec",
									type: "password",
									autoComplete: "off",
									spellCheck: false,
									disabled: session.running,
									value: settings.bybitSecret,
									onChange: (event) => {
										if (event.target.value === "" && document.activeElement !== event.target) return;
										noteSecretEdit();
										setSettings({ bybitSecret: event.target.value });
									},
									className: "mt-1 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm text-fg"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: busyKeys || settings.venue === "rehearsal",
									onClick: () => {
										setBusyKeys(true);
										setAccount(null);
										testKeys().then((result) => {
											setAccount(result.ok ? `Equity ${formatUsd(result.equity)} · доступно ${formatUsd(result.available)} ${result.coin}` : result.error);
										}).catch((error) => {
											const raw = error instanceof Error ? error.message : "";
											setAccount(/content-type header|Expected property name|HTTPError/i.test(raw) ? "Телефон не дочитав відповідь Bybit. Ключі лишаються в браузері." : raw || "Перевірка не дійшла до Bybit.");
										}).finally(() => setBusyKeys(false));
									},
									className: "mt-3 h-11 rounded-sm border border-line px-3 text-sm text-fg disabled:opacity-40",
									children: busyKeys ? "Перевіряю" : "Перевірити ключі"
								}),
								account ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: account
								}) : null,
								settings.bybitKey && settings.bybitSecret ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: "Ключ і секрет записані в цьому браузері. Після оновлення сторінки поля заповняться самі."
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
							className: "rounded-lg border border-line bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
									className: "cursor-pointer text-sm font-medium text-fg",
									children: ["Мозок ради", [
										"groq",
										"gemini",
										"openrouter"
									].some((id) => settings.llmKeys[id]) ? " · ключі окремо" : ""]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: QUOTA_PLAN
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 flex flex-wrap gap-2",
									children: BRAINS.map((brain) => {
										const on = settings.brain === brain.id;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: session.running,
											"aria-pressed": on,
											onClick: () => setSettings({ brain: brain.id }),
											className: `h-11 rounded-sm border px-3 text-sm ${on ? "border-accent bg-raised text-fg" : "border-line text-muted"}`,
											children: brain.title
										}, brain.id);
									})
								}),
								[
									"groq",
									"gemini",
									"openrouter"
								].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "mt-3 block text-xs text-muted",
									children: [
										"Ключ ",
										id === "groq" ? "Groq" : id === "gemini" ? "Gemini" : "OpenRouter",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "password",
											autoComplete: "off",
											spellCheck: false,
											disabled: session.running,
											value: settings.llmKeys[id],
											onChange: (event) => {
												if (event.target.value === "" && document.activeElement !== event.target) return;
												noteSecretEdit();
												setSettings({ llmKeys: {
													...settings.llmKeys,
													[id]: event.target.value
												} });
											},
											className: "mt-1 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm text-fg"
										})
									]
								}, id)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: "Кожна модель тримає свій ключ. Вставка в OpenRouter не чіпає Groq і Gemini."
								}),
								settings.brain === "grok" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-xs text-muted",
									children: [
										"Grok витрачає квоту власника застосунку. Стеля — ",
										12,
										" викликів на сесію, і лише після старту."
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-3 grid gap-2",
									children: QUOTA.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "rounded-sm border border-line bg-bg px-2 py-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm text-fg",
												children: row.title
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-muted",
												children: row.limit
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-muted",
												children: row.fit
											})
										]
									}, row.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 font-mono text-xs tabular-nums text-muted",
									children: [
										"Викликів у цій сесії: ",
										session.llmCalls,
										"/",
										12
									]
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "grid min-w-0 gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `rounded-lg border border-line bg-surface p-3 ${session.active ? "order-2" : "order-1"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-sm font-medium text-fg",
										children: "Стрічка"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void refreshBoard(),
										className: "h-11 px-2 text-xs text-muted",
										children: "Оновити"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: session.feedNote || "Знімаю ціни…"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted",
									children: describeBook({
										weeklyUsd: settings.weeklyUsd,
										riskPct: settings.riskPct,
										market: settings.market,
										realizedToday: session.realizedToday,
										realizedWeek: session.realizedWeek,
										closedToday: session.closedToday,
										trades: session.trades
									})
								}),
								session.board.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted",
									children: marketBrief(session.board)
								}) : null,
								session.ledgerNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted",
									children: session.ledgerNote
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 grid gap-2",
									children: session.board.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: "Порожньо, доки не прийде перша стрічка."
									}) : session.board.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-sm border border-line bg-bg px-2 py-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm font-medium text-fg",
														children: row.symbol.replace("USDT", "")
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
														className: `text-xs ${row.side === "long" ? "text-up" : row.side === "short" ? "text-down" : "text-subtle"}`,
														children: [row.side === "long" ? "лонг" : row.side === "short" ? "шорт" : "флет", row.tradable ? " · бере" : ""]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, {
														values: row.spark,
														up: row.changePct >= 0
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-right",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "font-mono text-sm tabular-nums text-fg",
															children: formatPx(row.last)
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
															className: `font-mono text-xs tabular-nums ${row.changePct >= 0 ? "text-up" : "text-down"}`,
															children: [
																row.changePct >= 0 ? "+" : "",
																row.changePct.toFixed(2),
																"% · ",
																row.score
															]
														})]
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-1 text-xs text-subtle",
												children: row.reasons[0]
											}),
											liquidityLine(row) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-subtle",
												children: liquidityLine(row)
											}) : null
										]
									}, row.symbol))
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `rounded-lg border border-line bg-surface p-3 ${session.active ? "order-1" : "order-2"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-sm font-medium text-fg",
									children: "Поточна угода"
								}),
								session.active && !session.running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-muted",
									children: "Нових угод немає, доки не натиснете старт. Цю стіл веде далі: стоп, ціль і вихід за часом."
								}) : null,
								session.active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveFacts, {
									active: session.active,
									market: settings.market,
									venue: settings.venue,
									clock
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-muted",
									children: session.haltReason ?? "Немає відкритої позиції. Після старту рада бере лише один сетап за раз."
								}),
								curve.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 h-24",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
										width: "100%",
										height: "100%",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LineChart, {
											data: curve,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
												type: "monotone",
												dataKey: "pnl",
												stroke: "var(--color-accent)",
												strokeWidth: 1.5,
												dot: false,
												isAnimationActive: false
											})
										})
									})
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "order-3 rounded-lg border border-line bg-surface p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium text-fg",
								children: "Журнал ради"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
								className: "mt-3 grid max-h-80 gap-2 overflow-auto",
								children: session.log.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-sm text-muted",
									children: "Тут будуть розвідник, критик, ризик, виконавець і рецензент."
								}) : session.log.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-xs tabular-nums text-subtle",
										children: formatHm(line.t)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-muted",
										children: [line.agent, ". "]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-fg",
										children: line.text
									})] })]
								}, line.id))
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-4 rounded-lg border border-line bg-surface p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-medium text-fg",
							children: "Закриті угоди"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs tabular-nums text-muted",
							children: [
								"сьогодні ",
								formatUsd(session.realizedToday),
								" · тиждень ",
								formatUsd(session.realizedWeek)
							]
						})]
					}),
					session.trades.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Порожньо. Репетиція закриває угоду по стопу, цілі або за 50 секунд, щоб цикл був видимий."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[36rem] text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-xs text-muted",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3 font-medium",
										children: "Пара"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3 font-medium",
										children: "Бік"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3 font-medium",
										children: "Результат"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3 font-medium",
										children: "Чому"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "Урок"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: session.trades.map((trade) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-line",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 pr-3 text-fg",
										children: trade.symbol.replace("USDT", "")
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 pr-3 text-muted",
										children: trade.side === "long" ? "лонг" : "шорт"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: `py-2 pr-3 font-mono tabular-nums ${trade.pnl >= 0 ? "text-up" : "text-down"}`,
										children: [trade.pnl >= 0 ? "+" : "−", formatUsd(Math.abs(trade.pnl))]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 pr-3 text-muted",
										children: trade.reason
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 text-muted",
										children: trade.lesson
									})
								]
							}, trade.id)) })]
						})
					}),
					session.lessons.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium text-fg",
							children: "Пам'ять відбитків"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 grid gap-1",
							children: session.lessons.slice(0, 6).map((lesson) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "text-xs text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-fg",
										children: lesson.fp
									}),
									" · мінусів ",
									lesson.losses,
									". ",
									lesson.note
								]
							}, lesson.fp))
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: session.running,
						onClick: () => {
							if (window.confirm("Стерти журнал і пам'ять уроків у цьому браузері?")) resetJournal();
						},
						className: "mt-3 h-11 text-xs text-muted disabled:opacity-40",
						children: "Стерти журнал"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-4 grid gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium text-fg",
						children: "З чого зібрано"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Підпис ордера — HMAC Bybit v5, у цьому браузері. На ф'ючерсі стоп і ціль ідуть разом із входом. На споті після покупки стіл ставить біржовий стоп; ціль веде відкрита вкладка, бо друга заявка зайняла б ті самі монети. Якщо біржа стоп не прийме, його теж веде вкладка. Демо і реал ходять на Bybit з вашого інтернету (api-demo.bybit.com і api.bybit.com, запасний api.bytick.com). Репетиція лишається на Gate.io і нічого не надсилає." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Край — EMA 20/50, RSI і стоп 1.55 ATR з ціллю 1.85R. Поріг бала не знижується, якщо ринок тихий. Розмір — фіксована частка банку, стеля плеча 3, без мартингейлу. Після двох мінусів на тому самому відбитку сетап більше не береться." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						"Перевірка ",
						LAST_STUDY.label,
						": ",
						LAST_STUDY.trades15,
						" віртуальних угод на 15-хвилинках за ",
						LAST_STUDY.days,
						" діб, ",
						LAST_STUDY.win15,
						"% у плюс, середнє ",
						LAST_STUDY.avgR15,
						"R, profit factor ",
						LAST_STUDY.pf15,
						". Пропуск ударних свічок дав ",
						LAST_STUDY.avgRShock,
						"R на ",
						LAST_STUDY.tradesShock,
						" угодах, лише відкати ",
						LAST_STUDY.avgRPull,
						"R на ",
						LAST_STUDY.tradesPull,
						". Обидві половини вікна в мінусі, тому правило входу не змінював. Лонги окремо ",
						LAST_STUDY.avgRLong,
						"R, лише BTC і ETH ",
						LAST_STUDY.avgRMajors,
						"R. Комісія вже віднята."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Натовп — публічний lsr_account Gate, настрій — Alternative.me. Новини — CoinDesk, The Block, Cointelegraph і календар USD: злом, депег, зупинка виводів, делістинг, банкрутство, CPI, FOMC, NFP, PCE. Преміум-дані TradingView сюди не тягнуться. Якщо заголовок б'є по парі або по всьому ринку, новий вхід блокується. На ф'ючерсі угода не береться, якщо фандинг проти сторони від 0.08% за інтервал. Розбір іде по ліквідних USDT-парах обраного режиму: спот або безстрокові, до 24 назв з оборотом від 15 млн. Строкові ф'ючерси і токени з плечем не беруться. Номінал не більший за 0.02% добового обороту." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Ролі ради (розвідник, критик, ризик, виконавець, супровід, рецензент) розділяють роботу, як у дослідницьких multi-agent столах. Критик може сказати «ні». Ризик-модуль один ставить кількість і стоп." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-fg",
						children: "Це не обіцянка прибутку і не порада. Можна втратити всю тижневу суму: прослизання, дірка, збій біржі, закрита вкладка на споті. Починайте з репетиції, потім з демо."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg px-4 py-3 lg:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StartBlock, {
					running: session.running,
					hasActive: !!session.active,
					doneToday,
					notice,
					onPress: press
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
				open: confirm,
				onOpenChange: setConfirm,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, { className: "fixed inset-0 z-30 bg-bg/80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, {
					className: "fixed top-1/2 left-1/2 z-40 w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, {
							className: "text-lg font-medium text-fg",
							children: settings.venue === "real" ? "Це справжні гроші" : "Підтвердити демо"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogDescription, {
							className: "mt-2 text-sm text-muted",
							children: [
								settings.market === "spot" ? "Спот" : "Ф'ючерси",
								", банк ",
								formatUsd(settings.weeklyUsd, 0),
								" USDT, ризик угоди близько ",
								formatUsd(riskUsd),
								". Не більше п'яти угод, потім стоп. Плече не вище 3.",
								settings.venue === "real" ? ` Збиток до денного ліміта можливий ще до п'ятої угоди. Остання перевірка історії — ${LAST_STUDY.avgR15}R на угоду, не плюс.` : " Демо не чіпає основний баланс, але ключ має бути з демо-рахунку."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, {
								className: "h-11 rounded-sm border border-line text-sm text-fg",
								children: "Назад"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
								className: "h-11 rounded-sm bg-accent text-sm font-medium text-ink",
								onClick: () => setNotice(startMachine()),
								children: "Запустити"
							})]
						})
					]
				})] })
			})
		]
	});
}
function StartBlock({ running, hasActive, doneToday, notice, onPress }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: onPress,
		disabled: !running && doneToday,
		className: `h-12 w-full rounded-sm text-sm font-medium ${running ? "border border-line bg-raised text-fg" : "bg-accent text-ink disabled:opacity-40"}`,
		children: running ? "Зупинити" : hasActive ? "Продовжити супровід" : doneToday ? "Сьогодні вже п'ять" : "Старт"
	}), notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-2 text-xs text-down",
		children: notice
	}) : null] });
}
function ActiveFacts({ active, market, venue, clock }) {
	const exchangeGross = venue !== "rehearsal" && market === "linear";
	const reading = closeReading({
		market,
		side: active.side,
		qty: active.qty,
		entry: active.entry,
		stop: active.stop,
		unrealized: exchangeGross ? active.unrealized : 0
	});
	const net = exchangeGross ? reading.net : active.unrealized;
	const be = breakevenPx({
		market,
		side: active.side,
		entry: active.entry
	});
	const ahead = exchangeGross && active.unrealized > 0 && net < 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 grid gap-2 sm:grid-cols-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Пара",
				value: `${active.symbol} ${active.side === "long" ? "лонг" : "шорт"} · ${active.leverage}×`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Вхід",
				value: formatPx(active.entry)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Стоп",
				value: formatPx(active.stop)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Ціль",
				value: formatPx(active.take)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Захист",
				value: venue === "rehearsal" ? "репетиція" : active.exchangeStop ? market === "spot" ? "стоп на біржі" : "стоп і ціль" : "лише вкладка"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: exchangeGross ? "Біржа" : "Після комісії",
				value: `${active.unrealized >= 0 ? "+" : "−"}${formatUsd(Math.abs(active.unrealized))}`,
				tone: active.unrealized >= 0 ? "up" : "down"
			}),
			exchangeGross ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Якщо закрити",
				value: `${net >= 0 ? "+" : "−"}${formatUsd(Math.abs(net))}`,
				tone: net >= 0 ? "up" : "down"
			}) : venue === "rehearsal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "До тайм-стопу",
				value: `${Math.max(0, Math.ceil((REHEARSAL_TIME_STOP_MS - ((clock || Date.now()) - active.openedAt)) / 1e3))} с`
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Плече",
				value: `${active.leverage}×`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: exchangeGross ? "Беззбитковість" : "Плече",
				value: exchangeGross ? formatPx(be) : `${active.leverage}×`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted sm:col-span-2",
				children: active.thesis
			}),
			exchangeGross ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted sm:col-span-2",
				children: ahead ? `Біржа ще в плюсі на ${formatUsd(active.unrealized)}, але кругова комісія лишає ${formatUsd(Math.abs(net))} мінуса. Беззбитковість ${formatPx(be)}, зараз ${reading.r >= 0 ? "+" : ""}${reading.r.toFixed(2)}R.` : `Після комісії входу і виходу ${net >= 0 ? "+" : "−"}${formatUsd(Math.abs(net))}. Беззбитковість ${formatPx(be)}, ${reading.r >= 0 ? "+" : ""}${reading.r.toFixed(2)}R до стопа.`
			}) : null
		]
	});
}
function Stat({ label, value, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-xs text-muted",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: `font-mono text-sm tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg"}`,
		children: value
	})] });
}
function Spark({ values, up }) {
	if (values.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-8" });
	const min = Math.min(...values);
	const span = Math.max(...values) - min || 1;
	const d = values.map((value, index) => {
		const x = index / (values.length - 1) * 100;
		const y = 28 - (value - min) / span * 24;
		return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 100 32",
		className: "h-8 w-full",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d,
			fill: "none",
			stroke: up ? "var(--color-up)" : "var(--color-down)",
			strokeWidth: "1.6"
		})
	});
}
var SplitComponent = DeskApp;
//#endregion
export { SplitComponent as component };
