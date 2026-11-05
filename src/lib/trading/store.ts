import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Session, Settings } from "@/lib/trading/types";

export const defaultSettings: Settings = {
  venue: "rehearsal",
  market: "spot",
  weeklyUsd: 250,
  riskPct: 0.008,
  bybitKey: "",
  bybitSecret: "",
  brain: "local",
  llmKeys: { groq: "", gemini: "", openrouter: "" },
};

export function freshSession(): Session {
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
    banned: [],
  };
}

type DeskState = {
  settings: Settings;
  session: Session;
  setSettings: (patch: Partial<Settings>) => void;
  patchSession: (patch: Partial<Session> | ((session: Session) => Session)) => void;
  resetJournal: () => void;
};

const SLOTS = ["groq", "gemini", "openrouter"] as const;
const BACKUP = "pyatirka-keys";
const STORE = "pyatirka-v1";

let hydrated = false;
let secretEdits = 0;

export function noteSecretEdit() {
  secretEdits += 1;
}

function normalizeSettings(raw: (Partial<Settings> & { llmKey?: string }) | null | undefined, base: Settings): Settings {
  const llmKeys: Settings["llmKeys"] = {
    ...base.llmKeys,
    ...raw?.llmKeys,
  };
  const legacy = typeof raw?.llmKey === "string" ? raw.llmKey : "";
  const brain = raw?.brain ?? base.brain;
  if (legacy && (brain === "groq" || brain === "gemini" || brain === "openrouter") && !llmKeys[brain]) {
    llmKeys[brain] = legacy;
  }
  return {
    ...base,
    ...raw,
    llmKeys,
  };
}

function readBackup(): (Partial<Settings> & { llmKey?: string }) | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(BACKUP);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Settings> & { llmKey?: string };
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readPersistSettings(): (Partial<Settings> & { llmKey?: string }) | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { settings?: Partial<Settings> & { llmKey?: string } } };
    return parsed.state?.settings ?? null;
  } catch {
    return null;
  }
}

function pickSecret(next: string, saved: string | undefined, backup: string | undefined): string {
  if (next.trim()) return next;
  if (secretEdits > 0) return "";
  if (saved?.trim()) return saved;
  if (backup?.trim()) return backup;
  return "";
}

function keepStoredSecrets(next: Settings): Settings {
  const saved = readPersistSettings();
  const backup = readBackup();
  const llmKeys = { ...next.llmKeys };
  for (const slot of SLOTS) {
    llmKeys[slot] = pickSecret(next.llmKeys[slot] ?? "", saved?.llmKeys?.[slot], backup?.llmKeys?.[slot]);
  }
  return {
    ...next,
    bybitKey: pickSecret(next.bybitKey, saved?.bybitKey, backup?.bybitKey),
    bybitSecret: pickSecret(next.bybitSecret, saved?.bybitSecret, backup?.bybitSecret),
    llmKeys,
  };
}

function backupSettings(settings: Settings) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BACKUP, JSON.stringify(keepStoredSecrets(settings)));
  } catch {
    /* приватний режим браузера */
  }
}

const baseStorage = createJSONStorage(() => localStorage);

export const useDesk = create<DeskState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      session: freshSession(),
      setSettings: (patch) =>
        set((state) => {
          const settings = keepStoredSecrets({ ...state.settings, ...patch });
          backupSettings(settings);
          return { settings };
        }),
      patchSession: (patch) =>
        set((state) => ({
          session: typeof patch === "function" ? patch(state.session) : { ...state.session, ...patch },
        })),
      resetJournal: () =>
        set((state) => ({
          session: {
            ...freshSession(),
            board: state.session.board,
            feed: state.session.feed,
            feedNote: state.session.feedNote,
            ledgerNote: state.session.ledgerNote,
          },
        })),
    }),
    {
      name: STORE,
      storage: {
        getItem: (name) => baseStorage?.getItem(name) ?? null,
        setItem: (name, value) => {
          if (!hydrated || !baseStorage) return;
          const record = value as { state?: { settings?: Settings } };
          if (record.state?.settings) record.state.settings = keepStoredSecrets(record.state.settings);
          baseStorage.setItem(name, value);
        },
        removeItem: (name) => baseStorage?.removeItem(name),
      },
      skipHydration: true,
      onRehydrateStorage: () => () => {
        hydrated = true;
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { settings?: Partial<Settings> & { llmKey?: string }; session?: Partial<Session> };
        const backup = readBackup();
        const base = normalizeSettings(saved.settings, current.settings);
        const settings = keepStoredSecrets({
          ...base,
          bybitKey: pickSecret(current.settings.bybitKey, base.bybitKey, backup?.bybitKey),
          bybitSecret: pickSecret(current.settings.bybitSecret, base.bybitSecret, backup?.bybitSecret),
          llmKeys: {
            groq: pickSecret(current.settings.llmKeys.groq, base.llmKeys.groq, backup?.llmKeys?.groq),
            gemini: pickSecret(current.settings.llmKeys.gemini, base.llmKeys.gemini, backup?.llmKeys?.gemini),
            openrouter: pickSecret(current.settings.llmKeys.openrouter, base.llmKeys.openrouter, backup?.llmKeys?.openrouter),
          },
        });
        return {
          ...current,
          settings,
          session: { ...current.session, ...saved.session, running: false },
        };
      },
      partialize: (state) => ({
        settings: state.settings,
        session: {
          ...state.session,
          running: false,
          log: state.session.log.slice(0, 40),
          trades: state.session.trades.slice(0, 40),
          board: state.session.board.map((row) => ({ ...row, spark: row.spark.slice(-16) })),
        },
      }),
    },
  ),
);
