import { notFound } from "next/navigation";

import { ListOutcome } from "@/components/worker/ListOutcome";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getHouseholdListDetail } from "@/lib/list/household";

/**
 * A worker's read-only view of one list she sent, item by item — what
 * WorkerHistory.tsx's aggregate count couldn't show (2026-10-22 critique).
 * `getHouseholdListDetail`'s own RPC already scopes a Worker caller to
 * lists they created (20260904120000_fully_hide_completed_lists.sql), so
 * this needs no extra filtering here beyond the 404 on a miss — the same
 * RPC also excludes an already-completed/archived list, matching how the
 * household side already stops showing a list once it's done.
 */
export default async function WorkerListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireWorkerAccess();

  const detail = await getHouseholdListDetail(membership.householdId, id);
  if (!detail) notFound();

  return <ListOutcome summary={detail.summary} groups={detail.groups} />;
}
