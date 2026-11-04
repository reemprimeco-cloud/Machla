import { LoadingRows } from "@/components/ui/States";

/** CompleteAccountScreen is a short form behind two awaited lookups
 * (profile, memberships) — same gap as /feedback and /join/[code]
 * (2026-11-04 performance audit). */
export default function Loading() {
  return <LoadingRows rows={2} />;
}
