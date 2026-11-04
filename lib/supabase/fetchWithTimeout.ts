const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * A fetch wrapper enforcing a hard timeout — the Supabase clients in this
 * directory never set one, so a hung PostgREST/Storage/Auth call used to
 * rely entirely on the platform's own request-duration ceiling instead of
 * failing fast with a recognizable error (2026-11-04 performance audit;
 * lib/push/apns.ts already does the equivalent for APNs sends). Passed as
 * every client's `global.fetch` option.
 *
 * No `"server-only"` guard: lib/supabase/client.ts runs in the browser,
 * where a hung request on a weak connection is exactly the case this
 * exists for.
 */
export function fetchWithTimeout(timeoutMs = DEFAULT_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;

    return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer));
  };
}
