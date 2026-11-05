import type { Brain } from "@/lib/trading/types";
import { CALLS_PER_SESSION } from "@/lib/trading/types";

export type QuotaRow = {
  id: Brain;
  title: string;
  limit: string;
  fit: string;
};

export const QUOTA: QuotaRow[] = [
  {
    id: "local",
    title: "Локальна рада",
    limit: "Без мережі й без ключа",
    fit: "0 запитів. Вистачить завжди.",
  },
  {
    id: "groq",
    title: "Groq, gpt-oss-20b",
    limit: "1000 запитів на день, 30 на хвилину",
    fit: "Сесія бере до 12. Лишається близько 988.",
  },
  {
    id: "openrouter",
    title: "OpenRouter, безкоштовні моделі",
    limit: "50 на день, поки не куплено кредитів",
    fit: "12 із 50. Друга сесія того ж дня вже не влізе.",
  },
  {
    id: "gemini",
    title: "Gemini Flash / Gemma",
    limit: "Flash часто 20–500 на день, Gemma до 14400",
    fit: "12 тісно, якщо Flash дає лише 20. Тоді Groq.",
  },
  {
    id: "grok",
    title: "Grok цього застосунку",
    limit: "Квота власника, не безкоштовний пул",
    fit: "Лише якщо увімкнути вручну. Стеля ті самі 12.",
  },
];

export const QUOTA_PLAN = `Одна сесія — це 5 угод і не більше ${CALLS_PER_SESSION} викликів моделі: критик перед входом і рецензент після виходу, плюс два запасні вето. Далі рада працює локально і модель не чіпає. Розмір, плече і стоп модель змінити не може.`;
