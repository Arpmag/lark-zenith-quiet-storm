import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { QUOTA, QUOTA_PLAN } from "@/lib/trading/quota";
import { kick, refreshBoard, startMachine, stopMachine, testKeys } from "@/lib/trading/machine";
import { formatHm, formatPx, formatUsd, utcDay } from "@/lib/trading/math";
import { breakevenPx, closeReading } from "@/lib/trading/risk";
import { noteSecretEdit, useDesk } from "@/lib/trading/store";
import {
  CALLS_PER_SESSION,
  REHEARSAL_TIME_STOP_MS,
  TRADES_PER_DAY,
  type ActiveTrade,
  type Brain,
  type MarketKind,
  type Venue,
} from "@/lib/trading/types";
import { LAST_STUDY } from "@/lib/trading/study";

const MODES: { venue: Venue; market: MarketKind; title: string; detail: string }[] = [
  { venue: "rehearsal", market: "spot", title: "Репетиція · спот", detail: "Живі ціни, ордерів немає" },
  { venue: "rehearsal", market: "linear", title: "Репетиція · ф'ючерси", detail: "Ті самі правила, шорт дозволений" },
  { venue: "demo", market: "spot", title: "Демо · спот", detail: "Окремий демо-рахунок Bybit" },
  { venue: "demo", market: "linear", title: "Демо · ф'ючерси", detail: "Плече не вище 3" },
  { venue: "real", market: "spot", title: "Реал · спот", detail: "Справжні гроші" },
  { venue: "real", market: "linear", title: "Реал · ф'ючерси", detail: "Справжні гроші, плече до 3" },
];

const BRAINS: { id: Brain; title: string }[] = [
  { id: "local", title: "Локальна рада" },
  { id: "groq", title: "Groq" },
  { id: "gemini", title: "Gemini" },
  { id: "openrouter", title: "OpenRouter" },
  { id: "grok", title: "Grok" },
];

const PHASE: Record<string, string> = {
  idle: "Очікує",
  scanning: "Шукає вхід",
  managing: "Веде угоду",
  done: "П'ять закрито",
  halted: "Зупинено",
};

export function DeskApp() {
  const settings = useDesk((state) => state.settings);
  const session = useDesk((state) => state.session);
  const setSettings = useDesk((state) => state.setSettings);
  const resetJournal = useDesk((state) => state.resetJournal);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    let alive = true;
    const boot = () => {
      if (alive) setReady(true);
    };
    if (useDesk.persist.hasHydrated()) boot();
    const unsub = useDesk.persist.onFinishHydration(boot);
    void useDesk.persist.rehydrate();
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refreshBoard();
    let stop = false;
    let timer = 0;
    const tick = () => {
      if (stop) return;
      const phase = useDesk.getState().session.phase;
      const rehearsal = useDesk.getState().settings.venue === "rehearsal";
      const running = useDesk.getState().session.running;
      const active = !!useDesk.getState().session.active;
      if (running || active) kick();
      const ms =
        !running && !active ? 5000 : phase === "managing" || active ? (rehearsal ? 4000 : 12000) : rehearsal ? 7000 : 25000;
      timer = window.setTimeout(tick, ms);
    };
    timer = window.setTimeout(tick, 800);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [ready]);

  useEffect(() => {
    if (!session.active) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    setClock(Date.now());
    return () => window.clearInterval(id);
  }, [session.active?.id]);

  const riskUsd = settings.weeklyUsd * settings.riskPct;
  const curve = [...session.trades].reverse().reduce<{ i: number; pnl: number }[]>((acc, trade) => {
    const prev = acc[acc.length - 1]?.pnl ?? 0;
    acc.push({ i: acc.length + 1, pnl: prev + trade.pnl });
    return acc;
  }, []);

  function press() {
    if (session.running) {
      void stopMachine();
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
  const doneToday = session.day === today && session.closedToday >= TRADES_PER_DAY;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 pb-28 lg:pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted">Bybit · п'ять угод і стоп</p>
          <h1 className="font-display text-4xl italic leading-none tracking-tight text-fg sm:text-5xl">
            П'ятірка
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted lg:mt-3">
            <span className="lg:hidden">Обираєте режим і суму, тиснете старт. Рада закриває п'яту угоду і стоїть.</span>
            <span className="hidden lg:inline">
              Ви кладете ключі, обираєте демо чи реал, спот чи ф'ючерси, тижневу суму і тиснете старт.
              Рада сама шукає край, ставить стоп, веде угоду і закриває п'яту — далі стоїть.
            </span>
          </p>
        </div>
        <div className="min-w-36 rounded-lg border border-line bg-surface px-3 py-2">
          <p className="text-xs text-muted">Стан</p>
          <p className="font-medium text-fg">{PHASE[session.phase] ?? "Очікує"}</p>
          <p className="font-mono text-sm tabular-nums text-muted">
            {session.closedToday}/{TRADES_PER_DAY} сьогодні
          </p>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {Array.from({ length: TRADES_PER_DAY }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-sm ${
                  index < session.closedToday
                    ? "bg-accent"
                    : index === session.closedToday && session.active
                      ? "bg-up"
                      : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="grid gap-3">
          <div className="rounded-lg border border-line bg-surface p-3">
            <h2 className="text-sm font-medium text-fg">Режим</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MODES.map((mode) => {
                const on = settings.venue === mode.venue && settings.market === mode.market;
                return (
                  <button
                    key={`${mode.venue}-${mode.market}`}
                    type="button"
                    disabled={session.running}
                    aria-pressed={on}
                    onClick={() => {
                      setSettings({ venue: mode.venue, market: mode.market });
                      if (mode.venue !== "rehearsal") setKeysOpen(true);
                    }}
                    className={`min-h-11 rounded-sm border px-2 py-2 text-left transition-colors duration-150 ${
                      on ? "border-accent bg-raised text-fg" : "border-line bg-bg text-muted"
                    }`}
                  >
                    <span className="block text-sm font-medium">{mode.title}</span>
                    <span className="mt-1 block text-xs">{mode.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-3">
            <label className="text-sm font-medium text-fg" htmlFor="weekly">
              Сума на тиждень, USDT
            </label>
            <input
              id="weekly"
              inputMode="decimal"
              disabled={session.running}
              value={Number.isFinite(settings.weeklyUsd) ? String(settings.weeklyUsd) : ""}
              onChange={(event) => setSettings({ weeklyUsd: Number(event.target.value) })}
              className="mt-2 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm tabular-nums text-fg"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Ризик угоди {Math.round(settings.riskPct * 1000) / 10}%</span>
              <span className="font-mono tabular-nums text-fg">{formatUsd(riskUsd)} USDT</span>
            </div>
            <input
              aria-label="Ризик на угоду"
              type="range"
              min={0.4}
              max={1.5}
              step={0.1}
              disabled={session.running}
              value={settings.riskPct * 100}
              onChange={(event) => setSettings({ riskPct: Number(event.target.value) / 100 })}
              className="mt-2 w-full accent-accent"
            />
            <p className="mt-2 hidden text-xs text-muted lg:block">
              Це банк, не ставка на одну свічку. Денний стоп 3%, тижневий 6%. П'ять угод на добу, 25 на тиждень.
            </p>
          </div>

          <div className="hidden lg:block">
            <StartBlock
              running={session.running}
              hasActive={!!session.active}
              doneToday={doneToday}
              notice={notice}
              onPress={press}
            />
          </div>

          <details
            className="rounded-lg border border-line bg-surface p-3"
            open={keysOpen}
            onToggle={(event) => setKeysOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer text-sm font-medium text-fg">
              Ключі Bybit
              {settings.bybitKey && settings.bybitSecret ? " · збережено" : ""}
            </summary>
            <p className="mt-2 text-xs text-muted">
              Ключ лишається лише в цьому браузері і не йде на сервер. Оновлення столу більше не затирає вже записаний ключ порожнім полем. Якщо зараз порожньо, вставте ключ і секрет ще раз. Перевірка йде з вашого інтернету. Для демо ключ створюється всередині Demo Trading, без списку IP.
            </p>
            <label className="mt-3 block text-xs text-muted" htmlFor="bkey">
              API key
            </label>
            <input
              id="bkey"
              autoComplete="off"
              spellCheck={false}
              disabled={session.running}
              value={settings.bybitKey}
              onChange={(event) => {
                if (event.target.value === "" && document.activeElement !== event.target) return;
                noteSecretEdit();
                setSettings({ bybitKey: event.target.value });
              }}
              className="mt-1 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm text-fg"
            />
            <label className="mt-3 block text-xs text-muted" htmlFor="bsec">
              API secret
            </label>
            <input
              id="bsec"
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={session.running}
              value={settings.bybitSecret}
              onChange={(event) => {
                if (event.target.value === "" && document.activeElement !== event.target) return;
                noteSecretEdit();
                setSettings({ bybitSecret: event.target.value });
              }}
              className="mt-1 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm text-fg"
            />
            <button
              type="button"
              disabled={busyKeys || settings.venue === "rehearsal"}
              onClick={() => {
                setBusyKeys(true);
                setAccount(null);
                void testKeys()
                  .then((result) => {
                    setAccount(
                      result.ok
                        ? `Equity ${formatUsd(result.equity)} · доступно ${formatUsd(result.available)} ${result.coin}`
                        : result.error,
                    );
                  })
                  .catch((error: unknown) => {
                    const raw = error instanceof Error ? error.message : "";
                    setAccount(
                      /content-type header|Expected property name|HTTPError/i.test(raw)
                        ? "Телефон не дочитав відповідь Bybit. Ключі лишаються в браузері."
                        : raw || "Перевірка не дійшла до Bybit.",
                    );
                  })
                  .finally(() => setBusyKeys(false));
              }}
              className="mt-3 h-11 rounded-sm border border-line px-3 text-sm text-fg disabled:opacity-40"
            >
              {busyKeys ? "Перевіряю" : "Перевірити ключі"}
            </button>
            {account ? <p className="mt-2 text-xs text-muted">{account}</p> : null}
            {settings.bybitKey && settings.bybitSecret ? (
              <p className="mt-2 text-xs text-muted">Ключ і секрет записані в цьому браузері. Після оновлення сторінки поля заповняться самі.</p>
            ) : null}
          </details>

          <details className="rounded-lg border border-line bg-surface p-3">
            <summary className="cursor-pointer text-sm font-medium text-fg">
              Мозок ради
              {( ["groq", "gemini", "openrouter"] as const).some((id) => settings.llmKeys[id]) ? " · ключі окремо" : ""}
            </summary>
            <p className="mt-2 text-xs text-muted">{QUOTA_PLAN}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {BRAINS.map((brain) => {
                const on = settings.brain === brain.id;
                return (
                  <button
                    key={brain.id}
                    type="button"
                    disabled={session.running}
                    aria-pressed={on}
                    onClick={() => setSettings({ brain: brain.id })}
                    className={`h-11 rounded-sm border px-3 text-sm ${
                      on ? "border-accent bg-raised text-fg" : "border-line text-muted"
                    }`}
                  >
                    {brain.title}
                  </button>
                );
              })}
            </div>
            {( ["groq", "gemini", "openrouter"] as const).map((id) => (
              <label key={id} className="mt-3 block text-xs text-muted">
                Ключ {id === "groq" ? "Groq" : id === "gemini" ? "Gemini" : "OpenRouter"}
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={session.running}
                  value={settings.llmKeys[id]}
                  onChange={(event) => {
                    if (event.target.value === "" && document.activeElement !== event.target) return;
                    noteSecretEdit();
                    setSettings({ llmKeys: { ...settings.llmKeys, [id]: event.target.value } });
                  }}
                  className="mt-1 h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm text-fg"
                />
              </label>
            ))}
            <p className="mt-2 text-xs text-muted">Кожна модель тримає свій ключ. Вставка в OpenRouter не чіпає Groq і Gemini.</p>
            {settings.brain === "grok" ? (
              <p className="mt-2 text-xs text-muted">
                Grok витрачає квоту власника застосунку. Стеля — {CALLS_PER_SESSION} викликів на сесію, і лише після старту.
              </p>
            ) : null}
            <ul className="mt-3 grid gap-2">
              {QUOTA.map((row) => (
                <li key={row.id} className="rounded-sm border border-line bg-bg px-2 py-2">
                  <p className="text-sm text-fg">{row.title}</p>
                  <p className="text-xs text-muted">{row.limit}</p>
                  <p className="text-xs text-muted">{row.fit}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-xs tabular-nums text-muted">
              Викликів у цій сесії: {session.llmCalls}/{CALLS_PER_SESSION}
            </p>
          </details>

        </section>

        <section className="grid min-w-0 gap-3">
          <div className={`rounded-lg border border-line bg-surface p-3 ${session.active ? "order-2" : "order-1"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-fg">Стрічка</h2>
              <button
                type="button"
                onClick={() => void refreshBoard()}
                className="h-11 px-2 text-xs text-muted"
              >
                Оновити
              </button>
            </div>
            <p className="text-xs text-muted">{session.feedNote || "Знімаю ціни…"}</p>
            {session.ledgerNote ? <p className="mt-1 text-xs text-muted">{session.ledgerNote}</p> : null}
            <div className="mt-3 grid gap-2">
              {session.board.length === 0 ? (
                <p className="text-sm text-muted">Порожньо, доки не прийде перша стрічка.</p>
              ) : (
                session.board.map((row) => (
                  <div
                    key={row.symbol}
                    className="rounded-sm border border-line bg-bg px-2 py-2"
                  >
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2">
                      <div>
                        <p className="text-sm font-medium text-fg">{row.symbol.replace("USDT", "")}</p>
                        <p className={`text-xs ${row.side === "long" ? "text-up" : row.side === "short" ? "text-down" : "text-subtle"}`}>
                          {row.side === "long" ? "лонг" : row.side === "short" ? "шорт" : "флет"}
                          {row.tradable ? " · бере" : ""}
                        </p>
                      </div>
                      <Spark values={row.spark} up={row.changePct >= 0} />
                      <div className="text-right">
                        <p className="font-mono text-sm tabular-nums text-fg">{formatPx(row.last)}</p>
                        <p className={`font-mono text-xs tabular-nums ${row.changePct >= 0 ? "text-up" : "text-down"}`}>
                          {row.changePct >= 0 ? "+" : ""}
                          {row.changePct.toFixed(2)}% · {row.score}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-subtle">{row.reasons[0]}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`rounded-lg border border-line bg-surface p-3 ${session.active ? "order-1" : "order-2"}`}>
            <h2 className="text-sm font-medium text-fg">Поточна угода</h2>
            {session.active && !session.running ? (
              <p className="mt-2 text-sm text-muted">
                Нових угод немає, доки не натиснете старт. Цю стіл веде далі: стоп, ціль і вихід за часом.
              </p>
            ) : null}
            {session.active ? (
              <ActiveFacts
                active={session.active}
                market={settings.market}
                venue={settings.venue}
                clock={clock}
              />
            ) : (
              <p className="mt-2 text-sm text-muted">
                {session.haltReason ?? "Немає відкритої позиції. Після старту рада бере лише один сетап за раз."}
              </p>
            )}
            {curve.length > 1 ? (
              <div className="mt-3 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve}>
                    <Line
                      type="monotone"
                      dataKey="pnl"
                      stroke="var(--color-accent)"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>

          <div className="order-3 rounded-lg border border-line bg-surface p-3">
            <h2 className="text-sm font-medium text-fg">Журнал ради</h2>
            <ol className="mt-3 grid max-h-80 gap-2 overflow-auto">
              {session.log.length === 0 ? (
                <li className="text-sm text-muted">Тут будуть розвідник, критик, ризик, виконавець і рецензент.</li>
              ) : (
                session.log.map((line) => (
                  <li key={line.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-sm">
                    <span className="font-mono text-xs tabular-nums text-subtle">{formatHm(line.t)}</span>
                    <span>
                      <span className="text-muted">{line.agent}. </span>
                      <span className="text-fg">{line.text}</span>
                    </span>
                  </li>
                ))
              )}
            </ol>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-fg">Закриті угоди</h2>
          <p className="font-mono text-xs tabular-nums text-muted">
            сьогодні {formatUsd(session.realizedToday)} · тиждень {formatUsd(session.realizedWeek)}
          </p>
        </div>
        {session.trades.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Порожньо. Репетиція закриває угоду по стопу, цілі або за 50 секунд, щоб цикл був видимий.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Пара</th>
                  <th className="py-2 pr-3 font-medium">Бік</th>
                  <th className="py-2 pr-3 font-medium">Результат</th>
                  <th className="py-2 pr-3 font-medium">Чому</th>
                  <th className="py-2 font-medium">Урок</th>
                </tr>
              </thead>
              <tbody>
                {session.trades.map((trade) => (
                  <tr key={trade.id} className="border-t border-line">
                    <td className="py-2 pr-3 text-fg">{trade.symbol.replace("USDT", "")}</td>
                    <td className="py-2 pr-3 text-muted">{trade.side === "long" ? "лонг" : "шорт"}</td>
                    <td className={`py-2 pr-3 font-mono tabular-nums ${trade.pnl >= 0 ? "text-up" : "text-down"}`}>
                      {trade.pnl >= 0 ? "+" : "−"}
                      {formatUsd(Math.abs(trade.pnl))}
                    </td>
                    <td className="py-2 pr-3 text-muted">{trade.reason}</td>
                    <td className="py-2 text-muted">{trade.lesson}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {session.lessons.length > 0 ? (
          <div className="mt-3">
            <h3 className="text-sm font-medium text-fg">Пам'ять відбитків</h3>
            <ul className="mt-2 grid gap-1">
              {session.lessons.slice(0, 6).map((lesson) => (
                <li key={lesson.fp} className="text-xs text-muted">
                  <span className="font-mono text-fg">{lesson.fp}</span> · мінусів {lesson.losses}. {lesson.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button
          type="button"
          disabled={session.running}
          onClick={() => {
            if (window.confirm("Стерти журнал і пам'ять уроків у цьому браузері?")) resetJournal();
          }}
          className="mt-3 h-11 text-xs text-muted disabled:opacity-40"
        >
          Стерти журнал
        </button>
      </section>

      <section className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
        <h2 className="text-sm font-medium text-fg">З чого зібрано</h2>
        <p>
          Підпис ордера — HMAC Bybit v5, у цьому браузері. На ф'ючерсі стоп і ціль ідуть разом із входом. На споті після покупки стіл ставить біржовий стоп; ціль веде відкрита вкладка, бо друга заявка зайняла б ті самі монети. Якщо біржа стоп не прийме, його теж веде вкладка. Демо і реал ходять на Bybit з вашого інтернету (api-demo.bybit.com і api.bybit.com, запасний api.bytick.com). Репетиція лишається на Gate.io і нічого не надсилає.
        </p>
        <p>
          Край — EMA 20/50, RSI і стоп 1.55 ATR з ціллю 1.85R. Поріг бала не знижується, якщо ринок тихий. Розмір — фіксована частка банку, стеля плеча 3, без мартингейлу. Після двох мінусів на тому самому відбитку сетап більше не береться.
        </p>
        <p>
          Перевірка {LAST_STUDY.label}: {LAST_STUDY.trades15} віртуальних угод на 15-хвилинках за {LAST_STUDY.days} діб, {LAST_STUDY.win15}% у плюс, середнє {LAST_STUDY.avgR15}R, profit factor {LAST_STUDY.pf15}. Пропуск ударних свічок дав {LAST_STUDY.avgRShock}R на {LAST_STUDY.tradesShock} угодах, лише відкати {LAST_STUDY.avgRPull}R на {LAST_STUDY.tradesPull}. Обидві половини вікна в мінусі, тому правило входу не змінював. Лонги окремо {LAST_STUDY.avgRLong}R, лише BTC і ETH {LAST_STUDY.avgRMajors}R. Комісія вже віднята.
        </p>
        <p>
          Натовп — публічний lsr_account Gate, настрій — Alternative.me. Новини — CoinDesk, The Block, Cointelegraph і календар USD: злом, депег, зупинка виводів, делістинг, банкрутство, CPI, FOMC, NFP, PCE. Преміум-дані TradingView сюди не тягнуться. Якщо заголовок б'є по парі або по всьому ринку, новий вхід блокується. На ф'ючерсі угода не береться, якщо фандинг проти сторони від 0.08% за інтервал.
        </p>
        <p>
          Ролі ради (розвідник, критик, ризик, виконавець, супровід, рецензент) розділяють роботу, як у дослідницьких multi-agent столах. Критик може сказати «ні». Ризик-модуль один ставить кількість і стоп.
        </p>
        <p className="text-fg">
          Це не обіцянка прибутку і не порада. Можна втратити всю тижневу суму: прослизання, дірка, збій біржі, закрита вкладка на споті. Починайте з репетиції, потім з демо.
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg px-4 py-3 lg:hidden">
        <StartBlock
          running={session.running}
          hasActive={!!session.active}
          doneToday={doneToday}
          notice={notice}
          onPress={press}
        />
      </div>

      <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-30 bg-bg/80" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-40 w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface p-5">
            <AlertDialog.Title className="text-lg font-medium text-fg">
              {settings.venue === "real" ? "Це справжні гроші" : "Підтвердити демо"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">
              {settings.market === "spot" ? "Спот" : "Ф'ючерси"}, банк {formatUsd(settings.weeklyUsd, 0)} USDT,
              ризик угоди близько {formatUsd(riskUsd)}. Не більше п'яти угод, потім стоп. Плече не вище 3.
              {settings.venue === "real"
                ? ` Збиток до денного ліміта можливий ще до п'ятої угоди. Остання перевірка історії — ${LAST_STUDY.avgR15}R на угоду, не плюс.`
                : " Демо не чіпає основний баланс, але ключ має бути з демо-рахунку."}
            </AlertDialog.Description>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AlertDialog.Cancel className="h-11 rounded-sm border border-line text-sm text-fg">
                Назад
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className="h-11 rounded-sm bg-accent text-sm font-medium text-ink"
                onClick={() => setNotice(startMachine())}
              >
                Запустити
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </main>
  );
}

function StartBlock({
  running,
  hasActive,
  doneToday,
  notice,
  onPress,
}: {
  running: boolean;
  hasActive: boolean;
  doneToday: boolean;
  notice: string | null;
  onPress: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onPress}
        disabled={!running && doneToday}
        className={`h-12 w-full rounded-sm text-sm font-medium ${
          running ? "border border-line bg-raised text-fg" : "bg-accent text-ink disabled:opacity-40"
        }`}
      >
        {running ? "Зупинити" : hasActive ? "Продовжити супровід" : doneToday ? "Сьогодні вже п'ять" : "Старт"}
      </button>
      {notice ? <p className="mt-2 text-xs text-down">{notice}</p> : null}
    </div>
  );
}

function ActiveFacts({
  active,
  market,
  venue,
  clock,
}: {
  active: ActiveTrade;
  market: MarketKind;
  venue: Venue;
  clock: number;
}) {
  const exchangeGross = venue !== "rehearsal" && market === "linear";
  const reading = closeReading({
    market,
    side: active.side,
    qty: active.qty,
    entry: active.entry,
    stop: active.stop,
    unrealized: exchangeGross ? active.unrealized : 0,
  });
  const net = exchangeGross ? reading.net : active.unrealized;
  const be = breakevenPx({ market, side: active.side, entry: active.entry });
  const ahead = exchangeGross && active.unrealized > 0 && net < 0;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-4">
      <Stat label="Пара" value={`${active.symbol} ${active.side === "long" ? "лонг" : "шорт"} · ${active.leverage}×`} />
      <Stat label="Вхід" value={formatPx(active.entry)} />
      <Stat label="Стоп" value={formatPx(active.stop)} />
      <Stat label="Ціль" value={formatPx(active.take)} />
      <Stat
        label="Захист"
        value={
          venue === "rehearsal"
            ? "репетиція"
            : active.exchangeStop
              ? market === "spot"
                ? "стоп на біржі"
                : "стоп і ціль"
              : "лише вкладка"
        }
      />
      <Stat
        label={exchangeGross ? "Біржа" : "Після комісії"}
        value={`${active.unrealized >= 0 ? "+" : "−"}${formatUsd(Math.abs(active.unrealized))}`}
        tone={active.unrealized >= 0 ? "up" : "down"}
      />
      {exchangeGross ? (
        <Stat
          label="Якщо закрити"
          value={`${net >= 0 ? "+" : "−"}${formatUsd(Math.abs(net))}`}
          tone={net >= 0 ? "up" : "down"}
        />
      ) : venue === "rehearsal" ? (
        <Stat
          label="До тайм-стопу"
          value={`${Math.max(0, Math.ceil((REHEARSAL_TIME_STOP_MS - ((clock || Date.now()) - active.openedAt)) / 1000))} с`}
        />
      ) : (
        <Stat label="Плече" value={`${active.leverage}×`} />
      )}
      <Stat label={exchangeGross ? "Беззбитковість" : "Плече"} value={exchangeGross ? formatPx(be) : `${active.leverage}×`} />
      <p className="text-sm text-muted sm:col-span-2">{active.thesis}</p>
      {exchangeGross ? (
        <p className="text-xs text-muted sm:col-span-2">
          {ahead
            ? `Біржа ще в плюсі на ${formatUsd(active.unrealized)}, але кругова комісія лишає ${formatUsd(Math.abs(net))} мінуса. Беззбитковість ${formatPx(be)}, зараз ${reading.r >= 0 ? "+" : ""}${reading.r.toFixed(2)}R.`
            : `Після комісії входу і виходу ${net >= 0 ? "+" : "−"}${formatUsd(Math.abs(net))}. Беззбитковість ${formatPx(be)}, ${reading.r >= 0 ? "+" : ""}${reading.r.toFixed(2)}R до стопа.`}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-mono text-sm tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}

function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <div className="h-8" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={up ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.6" />
    </svg>
  );
}
