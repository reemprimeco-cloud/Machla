"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { writeLocaleCookieClient } from "./cookie";
import type { LocaleCode, Script, TextDirection } from "./config";
import { directionFor, isSupportedLocale, scriptFor } from "./config";
import { getMessage, getMessages } from "./messages";
import type { MessageKey, Messages } from "./messages";
import { syncPreferredLanguageIfSignedIn } from "@/lib/auth/syncPreferredLanguage";

interface LocaleContextValue {
  locale: LocaleCode;
  direction: TextDirection;
  script: Script;
  messages: Messages;
  /** Switches the active locale, persists it (cookie), and updates
   * document direction/lang. No-op for an unsupported code. */
  setLocale: (code: string) => void;
  /** Typed dot-path translation lookup, e.g. t("common.changeLanguage"),
   * or t("auth.codeSentTo", { phone }) for the handful of keys with a
   * {placeholder}. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * `initialLocale` is computed server-side in app/layout.tsx, which
 * already reconciles the locale cookie against the signed-in user's
 * `users.preferred_language` (Phase 3) before ever rendering — a signed-
 * in user's stored preference wins over a stale/absent device cookie.
 * That keeps this component a plain "sync React state to the DOM/cookie"
 * effect, with no client-side reconciliation logic of its own to fight
 * the hooks linter's set-state-in-effect / refs-during-render rules over.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: LocaleCode;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);

  const setLocale = useCallback((code: string) => {
    if (!isSupportedLocale(code)) return;
    setLocaleState(code);
    // Event-triggered (called from a click handler, e.g. the language
    // picker) — fine to fire an async side effect directly here.
    void syncPreferredLanguageIfSignedIn(code);
  }, []);

  // Syncs every external system that depends on the active locale — the
  // cookie, and the <html> lang/dir/data-script attributes — whenever
  // `locale` changes. The server already rendered the correct <html>
  // attributes for `initialLocale` (see app/layout.tsx), so on first
  // paint this just re-confirms the same values; it runs strictly after
  // hydration, so it can't cause a hydration mismatch.
  useEffect(() => {
    writeLocaleCookieClient(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = directionFor(locale);
    document.documentElement.dataset.script = scriptFor(locale);
  }, [locale]);

  const messages = useMemo(() => getMessages(locale), [locale]);
  const direction = useMemo(() => directionFor(locale), [locale]);
  const script = useMemo(() => scriptFor(locale), [locale]);
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => getMessage(messages, key, params),
    [messages],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, direction, script, messages, setLocale, t }),
    [locale, direction, script, messages, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale() must be used within a <LocaleProvider>");
  }
  return ctx;
}
