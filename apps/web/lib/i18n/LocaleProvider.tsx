"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { writeLocaleCookieClient } from "./cookie";
import type { LocaleCode, Script, TextDirection } from "./config";
import { directionFor, isSupportedLocale, scriptFor } from "./config";
import { getMessage, getMessages } from "./messages";
import type { MessageKey, Messages } from "./messages";

interface LocaleContextValue {
  locale: LocaleCode;
  direction: TextDirection;
  script: Script;
  messages: Messages;
  /** Switches the active locale, persists it (cookie), and updates
   * document direction/lang. No-op for an unsupported code. */
  setLocale: (code: string) => void;
  /** Typed dot-path translation lookup, e.g. t("common.changeLanguage"). */
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

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
    writeLocaleCookieClient(code);
  }, []);

  // The server already rendered the correct <html lang dir data-script>
  // for `initialLocale` (see app/layout.tsx), so this effect only has
  // real work to do after an in-session setLocale() call — it does not
  // cause a mismatch against the server-rendered markup on first paint.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionFor(locale);
    document.documentElement.dataset.script = scriptFor(locale);
  }, [locale]);

  const messages = useMemo(() => getMessages(locale), [locale]);
  const direction = useMemo(() => directionFor(locale), [locale]);
  const script = useMemo(() => scriptFor(locale), [locale]);
  const t = useCallback((key: MessageKey) => getMessage(messages, key), [messages]);

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
