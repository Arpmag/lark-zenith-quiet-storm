import { askAgent, quotePrice, scanMarkets } from "@/lib/desk.functions";
import { BybitError } from "@/lib/trading/bybit";
import { loadTapeBias } from "@/lib/trading/context";
import { observeBoard } from "@/lib/trading/ledger";
import { marketCensus, scanBybit } from "@/lib/trading/scan";
import { closePosition, findLinearPositions, openPosition, readAccount, syncPosition } from "@/lib/trading/trade-exec";
import { utcDay, weekStart } from "@/lib/trading/math";
import { capitalStance, closeReading, fitToBalance, fitToTurnover, netPnl, sizePosition } from "@/lib/trading/risk";
import { localCritic } from "@/lib/trading/strategy";
import { useDesk } from "@/lib/trading/store";
import {
  CALLS_PER_SESSION,
  DAILY_LOSS_PCT,
  LIVE_TIME_STOP_MS,
  REHEARSAL_TIME_STOP_MS,
  TRADES_PER_DAY,
  TRADES_PER_WEEK,
  WEEKLY_LOSS_PCT,
  type AccountResult,
  type ActiveTrade,
  type BoardRow,
  type ClosedTrade,
  type Feed,
  type Lesson,
  type ScanResult,
  type Session,
  type Side,
} from "@/lib/trading/types";

let chain: Promise<void> = Promise.resolve();

function patch(partial: Partial<Session> | ((session: Session) => Session)) {
  useDesk.getState().patchSession(partial);
}

function log(agent: string, text: string) {
  patch((session) => ({
    ...session,
    log: [
      { id: crypto.randomUUID(), t: Date.now(), agent, text: text.slice(0, 320) },
      ...session.log,
    ].slice(0, 80),
  }));
}

function logSpare(agent: string, text: string, minGap: number) {
  const last = useDesk.getState().session.log.find((line) => line.agent === agent);
  if (last && Date.now() - last.t < minGap) return;
  log(agent, text);
}

function rolled(session: Session): Session {
  const day = utcDay();
  const week = weekStart();
  let next = session;
  if (!next.day) next = { ...next, day, week };
  if (next.week && next.week !== week && !next.active) {
    next = { ...next, week, closedWeek: 0, realizedWeek: 0 };
  }
  if (next.day && next.day !== day && !next.active) {
    next = {
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
      haltReason: next.phase === "done" || next.phase === "halted" ? null : next.haltReason,
    };
  }
  return next;
}

async function loadBoard(allowFallback: boolean): Promise<ScanResult> {
  const { settings, session } = useDesk.getState();
  const recent = session.trades
    .filter((trade) => utcDay(new Date(trade.closedAt)) === (session.day || utcDay()))
    .map((trade) => trade.symbol);
  if (settings.venue !== "rehearsal") {
    try {
      const tape = await loadTapeBias().catch(() => null);
      const rows = await scanBybit(
        settings.market,
        session.lessons,
        recent,
        session.threshold,
        tape?.bias ?? null,
      );
      const extra = tape?.line ? ` ${tape.line}` : "";
      const census = await marketCensus().catch(() => "");
      return {
        ok: true,
        feed: "bybit",
        note: `Стрічка Bybit з вашого інтернету.${census ? ` ${census}` : ""}${extra}`,
        rows,
      };
    } catch (error) {
      return {
        ok: false,
        code: error instanceof BybitError ? error.code : undefined,
        error: error instanceof Error ? error.message : "Стрічка Bybit недоступна з цього телефону.",
      };
    }
  }
  return scanMarkets({
    data: {
      market: settings.market,
      lessons: session.lessons,
      recent,
      threshold: session.threshold,
      allowFallback,
    },
  });
}

export function kick() {
  chain = chain
    .then(() => step())
    .catch((error: unknown) => {
      const raw = error instanceof Error ? error.message : "Крок зірвався.";
      const text = /content-type header|Expected property name|HTTPError/i.test(raw)
        ? "Сервер не дочитав відповідь. Ключі на місці. Якщо це демо Bybit, біржа з цього сервера не відкривається."
        : raw;
      log("Рада", text);
    });
}

export async function refreshBoard(): Promise<void> {
  const allow = useDesk.getState().settings.venue === "rehearsal";
  const board = await loadBoard(allow);
  if (!board.ok) {
    patch({ feedNote: board.error });
    return;
  }
  patch({ board: board.rows, feed: board.feed, feedNote: board.note, ledgerNote: observeBoard(board.rows) });
}

export async function testKeys(): Promise<AccountResult> {
  const { settings } = useDesk.getState();
  if (settings.venue === "rehearsal") {
    return { ok: false, error: "Репетиція не ходить на приватні методи." };
  }
  const venue = settings.venue;
  const payload = { venue, key: settings.bybitKey.trim(), secret: settings.bybitSecret.trim() };
  if (payload.key.length < 8 || payload.secret.length < 8) {
    return { ok: false, error: "Впишіть ключ і секрет Bybit." };
  }
  return readAccount(venue, payload.key, payload.secret);
}

export function startMachine(): string | null {
  const { settings } = useDesk.getState();
  let session = rolled(useDesk.getState().session);
  if (!(settings.weeklyUsd >= 30)) return "Тижнева сума — від 30 USDT.";
  if (settings.venue !== "rehearsal") {
    if (settings.bybitKey.trim().length < 8 || settings.bybitSecret.trim().length < 8) {
      return "Для демо і реалу потрібні ключ і секрет Bybit.";
    }
  }
  if (
    settings.brain !== "local" &&
    settings.brain !== "grok" &&
    settings.llmKeys[settings.brain].trim().length < 8
  ) {
    return "Впишіть безкоштовний ключ моделі або лишіть локальну раду.";
  }
  if (session.day === utcDay() && session.closedToday >= TRADES_PER_DAY && !session.active) {
    return "Сьогодні п'ять угод уже закрито. Наступний старт — завтра.";
  }
  if (session.closedWeek >= TRADES_PER_WEEK && !session.active) {
    return "Тижневий ліміт 25 угод вичерпано.";
  }
  session = {
    ...session,
    running: true,
    resumeHint: false,
    phase: session.active ? "managing" : "scanning",
    day: utcDay(),
    week: weekStart(),
    haltReason: null,
    orderErrors: 0,
  };
  patch(session);
  log(
    "Рада",
    settings.venue === "rehearsal"
      ? "Старт репетиції. Ордери на біржу не підуть. П'ять угод — і стоп."
      : `Старт: ${settings.venue === "demo" ? "демо" : "реал"}, ${settings.market === "spot" ? "спот" : "ф'ючерси"}.`,
  );
  kick();
  return null;
}

export async function stopMachine(): Promise<void> {
  patch({ running: false });
  if (useDesk.getState().session.active) {
    await closeActive("kill");
  }
  patch((session) => ({
    ...session,
    running: false,
    phase: session.closedToday >= TRADES_PER_DAY ? "done" : "halted",
    haltReason: "Зупинено вручну.",
    resumeHint: false,
  }));
  log("Рада", "Зупинка. Нових угод не буде, доки не натиснете старт знову.");
}

let tapeAt = Date.now();

async function watchTape() {
  if (Date.now() - tapeAt < 3 * 60 * 1000) return;
  tapeAt = Date.now();
  const board = await loadBoard(useDesk.getState().settings.venue === "rehearsal");
  if (!board.ok) return;
  patch({
    board: board.rows,
    feed: board.feed,
    feedNote: board.note,
    ledgerNote: observeBoard(board.rows),
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
  if (session.closedToday >= TRADES_PER_DAY) {
    end("П'ята угода вже закрита. Машина стоїть.", "done");
    return;
  }
  if (session.closedWeek >= TRADES_PER_WEEK) {
    end("Тижневий ліміт 25 угод. Зупинка.", "halted");
    return;
  }
  if (session.realizedToday <= -settings.weeklyUsd * DAILY_LOSS_PCT) {
    end("Денний ліміт втрат, 3% тижневої суми. Зупинка.", "halted");
    return;
  }
  if (session.realizedWeek <= -settings.weeklyUsd * WEEKLY_LOSS_PCT) {
    end("Тижневий ліміт втрат, 6% суми. Зупинка.", "halted");
    return;
  }
  await scanAndEnter();
}

function end(reason: string, phase: "done" | "halted") {
  patch({ running: false, phase, haltReason: reason, resumeHint: false });
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
      end(
        "З цього телефону Bybit не відповів. Ключі збережені. Перевірте, що біржа відкривається в цьому інтернеті, ключ створено в Demo Trading і без чужої IP. Репетиція лишається доступною.",
        "halted",
      );
      return;
    }
    noteError();
    return;
  }
  patch({ board: board.rows, feed: board.feed, feedNote: board.note, ledgerNote: observeBoard(board.rows) });
  if (settings.venue !== "rehearsal" && board.feed !== "bybit") {
    end("Живий режим вимагає цін Bybit. Зараз біржа недоступна.", "halted");
    return;
  }
  if (settings.venue !== "rehearsal" && settings.market === "linear") {
    const held = await findLinearPositions({
      venue: settings.venue,
      key: settings.bybitKey.trim(),
      secret: settings.bybitSecret.trim(),
    });
    if (!useDesk.getState().session.running) return;
    if (!held.ok) {
      log("Виконавець", held.error);
      noteError();
      return;
    }
    if (held.rows.length > 1) {
      end(
        `На ф'ючерсах уже ${held.rows.length} позиції (${held.rows.map((row) => row.symbol).join(", ")}). Нову не відкриваю.`,
        "halted",
      );
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
          margin: (lone.avg * lone.size) / lone.leverage,
          openedAt: Date.now(),
          thesis: "Позиція вже була на Bybit. Підхопив, щоб не відкрити другу.",
          fingerprint: "",
          feed: "bybit",
          unrealized: lone.unrealised,
          exchangeStop: lone.stop > 0,
        },
        phase: "managing",
        emptyScans: 0,
        orderErrors: 0,
        feed: "bybit",
      });
      log(
        "Виконавець",
        `${lone.symbol} уже відкрита на біржі. Нову не ставлю. ${lone.stop > 0 ? "Стоп на біржі є." : "Стопа на біржі немає, вкладку не закривайте."}`,
      );
      return;
    }
  }
  const session = useDesk.getState().session;
  const cooled = new Set(
    session.trades
      .filter((trade) => Date.now() - trade.closedAt < 60 * 60 * 1000)
      .map((trade) => trade.symbol),
  );
  const row = board.rows.find(
    (item) => item.tradable && !session.banned.includes(item.symbol) && !cooled.has(item.symbol),
  );
  if (!row || row.side === "flat") {
    const best = board.rows[0];
    const paused = board.rows.find(
      (item) => item.tradable && !session.banned.includes(item.symbol) && cooled.has(item.symbol),
    );
    const emptyScans = session.emptyScans + 1;
    patch({ emptyScans });
    log(
      "Розвідник",
      paused
        ? `Пропуск. ${paused.symbol} на паузі годину після закриття.`
        : best?.reasons.some((reason) => /новин|макро|CPI|FOMC|NFP|PCE|Фандинг/i.test(reason))
          ? `Пропуск. ${best.reasons.find((reason) => /новин|макро|CPI|FOMC|NFP|PCE|Фандинг/i.test(reason))}`
          : best
            ? `Кращий бал ${best.score} у ${best.symbol}. Поріг ${session.threshold} не знижую: слабші сетапи на історії не відігравали.`
            : "Стрічка порожня.",
    );
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
    if (sessionNow.realizedToday <= -bank * DAILY_LOSS_PCT) {
      end("Денний ліміт від фактичного балансу. Зупинка.", "halted");
      return;
    }
    if (sessionNow.realizedWeek <= -bank * WEEKLY_LOSS_PCT) {
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
    stop: row.stop,
  });
  if (!sized.ok) {
    log("Ризик", `${row.symbol}: ${sized.error}`);
    patch((current) => ({ ...current, banned: [...current.banned, row.symbol].slice(-12) }));
    return;
  }
  const fitted =
    settings.venue === "rehearsal"
      ? sized
      : fitToBalance(sized, {
          market: settings.market,
          available: cash,
          entry: row.entry,
          stop: row.stop,
          weeklyUsd: bank,
        });
  if (!fitted.ok) {
    log("Ризик", `${row.symbol}: ${fitted.error}`);
    if (/Вільно менше|Після балансу/i.test(fitted.error)) {
      end(fitted.error, "halted");
      return;
    }
    patch((current) => ({ ...current, banned: [...current.banned, row.symbol].slice(-12) }));
    return;
  }
  const booked = fitToTurnover(fitted, { turnover: row.turnover, entry: row.entry, stop: row.stop });
  if (!booked.ok) {
    log("Капітал", `${row.symbol}: ${booked.error}`);
    patch((current) => ({ ...current, banned: [...current.banned, row.symbol].slice(-12) }));
    return;
  }
  log(
    "Капітал",
    `${stance.note ? `${stance.note} ` : ""}${row.symbol}: ризик ${booked.riskUsd.toFixed(2)} USDT, номінал ${booked.notional.toFixed(0)}, плече ${booked.leverage}. Стоп незмінний.`,
  );
  if (settings.venue === "rehearsal") {
    openPaper(row, booked);
    return;
  }
  await openLive(row, booked);
}

async function criticize(row: BoardRow): Promise<"allow" | "veto"> {
  const local = localCritic(row);
  const { settings, session } = useDesk.getState();
  if (local.verdict === "veto") {
    log("Критик", local.note);
    return "veto";
  }
  if (settings.brain === "local" || session.vetoes >= 2 || session.llmCalls >= CALLS_PER_SESSION) {
    log("Критик", local.note);
    return "allow";
  }
  const lessons = session.lessons
    .slice(0, 6)
    .map((lesson) => `${lesson.fp} мінусів ${lesson.losses}: ${lesson.note}`)
    .join("; ");
  const prompt = [
    "Ти критик торгової ради. Не змінюєш розмір, плече, стоп чи ціль.",
    'Відповідай лише JSON {"verdict":"allow"|"veto","note":"до 160 символів українською"}.',
    "Veto лише якщо сетап суперечить сам собі або урок прямо забороняє цей відбиток.",
    `Пара ${row.symbol}, ${row.side}, бал ${row.score}, RSI ${row.rsi.toFixed(1)}, ATR ${(row.atrPct * 100).toFixed(2)}%.`,
    `Вхід ${row.entry}, стоп ${row.stop}, ціль ${row.take}.`,
    `Причини: ${row.reasons.join(" ")}`,
    lessons ? `Уроки: ${lessons}` : "Уроків ще немає.",
  ].join("\n");
  const slot =
    settings.brain === "groq" || settings.brain === "gemini" || settings.brain === "openrouter"
      ? settings.brain
      : "groq";
  const asked = await askAgent({
    data: { brain: settings.brain, llmKey: settings.brain === "grok" ? "" : settings.llmKeys[slot], prompt },
  });
  if (asked.spent) patch((current) => ({ ...current, llmCalls: current.llmCalls + 1 }));
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
      banned: [...current.banned, row.symbol].slice(-12),
    }));
    log("Критик", `Вето. ${note}`);
    return "veto";
  }
  log("Критик", note || local.note);
  return "allow";
}

function readJson(text: string): { verdict?: string; note?: string; lesson?: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { verdict?: string; note?: string; lesson?: string };
  } catch {
    return null;
  }
}

function openPaper(
  row: BoardRow,
  sized: { notional: number; leverage: number; margin: number; qty: number; riskUsd: number },
) {
  const slip = row.side === "long" ? 1.0002 : 0.9998;
  const entry = row.entry * slip;
  const distOk =
    row.side === "long" ? row.stop < entry && row.take > entry : row.stop > entry && row.take < entry;
  if (!distOk) {
    log("Виконавець", "Після прослизання геометрія зламалась. Пропуск.");
    return;
  }
  const qty = sized.notional / entry;
  const active: ActiveTrade = {
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
    unrealized: 0,
  };
  patch({ active, phase: "managing", emptyScans: 0, orderErrors: 0 });
  log(
    "Виконавець",
    `Репетиція ${row.side === "long" ? "лонг" : "шорт"} ${row.symbol} @ ${entry.toFixed(4)}. Супровід до стопа, цілі або 50 секунд.`,
  );
}

async function openLive(
  row: BoardRow,
  sized: { notional: number; leverage: number; margin: number; qty: number },
) {
  const { settings } = useDesk.getState();
  const venue: "demo" | "real" = settings.venue === "real" ? "real" : "demo";
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
    weeklyUsd: settings.weeklyUsd,
  } as const;
  const result = await openPosition(payload);
  if (!useDesk.getState().session.running) {
    if (result.ok) {
      await forceFlat(row.symbol, side, result.qty);
    }
    return;
  }
  if (!result.ok) {
    log("Виконавець", result.error);
    noteError();
    return;
  }
  const active: ActiveTrade = {
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
    exchangeTarget: result.exchangeTarget === true,
  };
  patch({ active, phase: "managing", emptyScans: 0, orderErrors: 0, feed: "bybit" });
  log(
    "Виконавець",
    `${row.side === "long" ? "Лонг" : "Шорт"} ${row.symbol} @ ${result.entry.toFixed(4)}. ${
      settings.market === "linear"
        ? result.exchangeStop
          ? "Стоп і ціль стоять на біржі."
          : "Стоп на біржі не став. Цю вкладку не закривайте."
        : result.exchangeTarget
          ? "Стоп і ціль стоять на біржі і переживуть закриту вкладку."
          : result.exchangeStop
            ? "Стоп на біржі і переживе закриту вкладку. Ціль веде ця вкладка: біржа не прийняла пару стоп+ціль."
            : "На споті стоп веде ця вкладка, доки вона відкрита."
    }`,
  );
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
  await watchTape().catch(() => undefined);
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
      exit: price,
    });
    patch((current) =>
      current.active ? { ...current, active: { ...current.active, unrealized } } : current,
    );
    const stopHit = active.side === "long" ? price <= active.stop : price >= active.stop;
    const takeHit = active.side === "long" ? price >= active.take : price <= active.take;
    const timed = Date.now() - active.openedAt >= limit;
    if (stopHit) await settle(worse(active.side, active.stop), "stop");
    else if (takeHit) await settle(active.take, "take");
    else if (timed) await settle(price, "time");
    else {
      logSpare(
        "Супровід",
        `${active.symbol} ${unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)} USDT. Стоп ${active.stop.toFixed(4)}, ціль ${active.take.toFixed(4)}.`,
        12_000,
      );
    }
    return;
  }
  const live = await syncLivePosition(active);
  if (!live.ok) {
    if (useDesk.getState().session.running) {
      log("Супровід", live.error);
      noteError();
    } else {
      logSpare("Супровід", live.error, 60_000);
    }
    return;
  }
  if (live.flat) {
    const exit = live.exitPrice || live.last || active.entry;
    await settle(exit, infer(active, exit), true, live.closedPnl);
    return;
  }
  if (active.exchangeStop !== live.exchangeStop) {
    patch((current) =>
      current.active ? { ...current, active: { ...current.active, exchangeStop: live.exchangeStop } } : current,
    );
  }
  const price = live.last;
  let unrealized = active.unrealized;
  if (price > 0) {
    unrealized =
      settings.market === "linear"
        ? live.unrealisedPnl
        : netPnl({
            market: settings.market,
            side: active.side,
            qty: active.qty,
            entry: active.entry,
            exit: price,
          });
    patch((current) =>
      current.active ? { ...current, active: { ...current.active, unrealized } } : current,
    );
  }
  const stopHit = active.stop > 0 && price > 0 && (active.side === "long" ? price <= active.stop : price >= active.stop);
  const takeHit = active.take > 0 && price > 0 && (active.side === "long" ? price >= active.take : price <= active.take);
  const timed = Date.now() - active.openedAt >= limit;
  const ownExits =
    (settings.market === "linear" && !!active.exchangeStop) ||
    (settings.market === "spot" && !!active.exchangeTarget);
  if (!ownExits && (stopHit || takeHit || timed)) {
    await closeActive(stopHit ? "stop" : takeHit ? "take" : "time");
    return;
  }
  if (ownExits && timed) {
    await closeActive("time");
    return;
  }
  logSpare(
    "Супровід",
    `${useDesk.getState().session.running ? "" : "Старт не натиснуто, нових угод немає. "}${active.symbol} ще відкрита. ${price ? `Остання ${price.toFixed(4)}. ` : ""}${
      settings.market === "linear"
        ? `Біржа ${unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}, якщо закрити зараз ${closeReading({
            market: settings.market,
            side: active.side,
            qty: active.qty,
            entry: active.entry,
            stop: active.stop,
            unrealized,
          }).net.toFixed(2)}.`
        : ""
    }${
      active.exchangeTarget
        ? "Стоп і ціль стоять на біржі і переживуть закриту вкладку."
        : active.exchangeStop && settings.market === "spot"
          ? "Стоп на біржі. Ціль веде ця вкладка."
          : active.exchangeStop
            ? "Стоп стоїть на біржі і переживе закриту вкладку."
            : "Стоп на біржі не став. Цю вкладку не закривайте: стоп веде вона."
    }`,
    20_000,
  );
}

async function syncLivePosition(active: ActiveTrade) {
  const { settings } = useDesk.getState();
  const venue: "demo" | "real" = settings.venue === "real" ? "real" : "demo";
  const payload = {
    venue,
    key: settings.bybitKey.trim(),
    secret: settings.bybitSecret.trim(),
    market: settings.market,
    symbol: active.symbol,
    orderId: active.orderId,
    qty: active.qty,
    openedAt: active.openedAt,
  };
  return syncPosition(payload);
}

async function mark(feed: Feed, symbol: string): Promise<number> {
  const market = useDesk.getState().settings.market;
  const quoted = await quotePrice({ data: { feed, market, symbol } });
  return quoted.ok ? quoted.price : 0;
}

function worse(side: Side, stop: number): number {
  return side === "long" ? stop * 0.9998 : stop * 1.0002;
}

function infer(active: ActiveTrade, last: number): ClosedTrade["reason"] {
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

async function closeActive(reason: ClosedTrade["reason"]) {
  const { session, settings } = useDesk.getState();
  const active = session.active;
  if (!active) return;
  if (settings.venue === "rehearsal") {
    const price = await mark(active.feed, active.symbol);
    await settle(price || active.entry, reason);
    return;
  }
  const venue: "demo" | "real" = settings.venue === "real" ? "real" : "demo";
  const payload = {
    venue,
    key: settings.bybitKey.trim(),
    secret: settings.bybitSecret.trim(),
    market: settings.market,
    symbol: active.symbol,
    side: active.side === "short" ? ("Sell" as const) : ("Buy" as const),
    qty: active.qty,
  };
  const closed = await closePosition(payload);
  if (!closed.ok) {
    log("Виконавець", `Не зміг закрити: ${closed.error}`);
    noteError();
    return;
  }
  await settle(closed.exit, reason, true);
}

async function forceFlat(symbol: string, side: "Buy" | "Sell", qty: number) {
  const { settings } = useDesk.getState();
  const venue: "demo" | "real" = settings.venue === "real" ? "real" : "demo";
  const payload = {
    venue,
    key: settings.bybitKey.trim(),
    secret: settings.bybitSecret.trim(),
    market: settings.market,
    symbol,
    side,
    qty,
  };
  await closePosition(payload);
}

async function settle(exit: number, reason: ClosedTrade["reason"], exchange = false, exchangePnl: number | null = null) {
  const before = useDesk.getState();
  const active = before.session.active;
  if (!active || !(exit > 0)) return;
  const pnl =
    exchangePnl != null
      ? exchangePnl
      : netPnl({
          market: before.settings.market,
          side: active.side,
          qty: active.qty,
          entry: active.entry,
          exit,
        });
  let lesson =
    pnl < 0
      ? `Мінус на ${active.fingerprint}. Наступного разу цей відбиток штрафується.`
      : `Плюс на ${active.fingerprint}. Відбиток трохи реабілітовано.`;
  const brain = before.settings.brain;
  if (brain !== "local" && before.session.llmCalls < CALLS_PER_SESSION) {
    const prompt = [
      'Відповідай лише JSON {"lesson":"до 160 символів українською"}.',
      "Це урок для наступного відбору. Не пропонуй збільшувати ризик, плече чи прибирати стоп.",
      `${active.symbol} ${active.side}, вхід ${active.entry}, вихід ${exit}, результат ${pnl.toFixed(2)} USDT, причина ${reason}.`,
      active.thesis,
    ].join("\n");
    const asked = await askAgent({
      data: {
        brain,
        llmKey: brain === "grok" ? "" : before.settings.llmKeys[brain],
        prompt,
      },
    });
    if (asked.spent) patch((current) => ({ ...current, llmCalls: current.llmCalls + 1 }));
    const parsed = asked.ok ? readJson(asked.text) : null;
    if (parsed?.lesson) lesson = String(parsed.lesson).slice(0, 180);
  }
  const session = useDesk.getState().session;
  const current = session.active?.id === active.id ? session.active : null;
  if (!current) return;
  const lessons = remember(session.lessons, current.fingerprint, pnl, lesson);
  const trade: ClosedTrade = {
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
    market: before.settings.market,
  };
  const closedToday = session.closedToday + 1;
  const done = closedToday >= TRADES_PER_DAY;
  const lossDay = session.realizedToday + pnl <= -before.settings.weeklyUsd * DAILY_LOSS_PCT;
  const lossWeek = session.realizedWeek + pnl <= -before.settings.weeklyUsd * WEEKLY_LOSS_PCT;
  const stopNow = done || lossDay || lossWeek || !session.running;
  const haltReason = done
    ? "П'ята угода закрита. Машина зупинена."
    : lossDay
      ? "Денний ліміт втрат після цієї угоди. Зупинка."
      : lossWeek
        ? "Тижневий ліміт втрат після цієї угоди. Зупинка."
        : !session.running
          ? "Зупинено вручну."
          : null;
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
    orderErrors: 0,
  });
  const where = exchange ? "біржа" : "репетиція";
  log(
    "Рецензент",
    `${where}, ${reason}, ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT. ${lesson}`,
  );
}

function remember(lessons: Lesson[], fp: string, pnl: number, note: string): Lesson[] {
  const prev = lessons.find((lesson) => lesson.fp === fp);
  const losses = pnl < 0 ? (prev?.losses ?? 0) + 1 : Math.max(0, (prev?.losses ?? 0) - 1);
  const next: Lesson = { fp, losses, note, at: Date.now() };
  return [next, ...lessons.filter((lesson) => lesson.fp !== fp)].slice(0, 40);
}
