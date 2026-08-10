"use client";

import { useEffect } from "react";

import { ErrorScreen } from "@/components/ui/States";

/**
 * Segment error boundary.
 *
 * Next.js 16 passes `retry` (not `reset`, which earlier versions used and
 * which the docs now steer away from): `retry()` re-fetches and re-renders
 * the boundary's children, which is what a transient Supabase or network
 * failure actually needs.
 *
 * Nothing about the error itself is shown to the user — a Postgres message
 * would be meaningless to them and could leak schema detail. It goes to
 * the console for whoever is debugging.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen retry={retry} />;
}
