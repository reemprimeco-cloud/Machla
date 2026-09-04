import { notFound } from "next/navigation";

import { ListChecklist } from "@/components/household/ListChecklist";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { markListViewedAction } from "@/lib/list/actions";
import { getHouseholdListDetail } from "@/lib/list/household";

/**
 * The checklist the household shops from.
 *
 * Opening it marks the list viewed — best-effort, and the RPC only ever
 * moves sent → viewed, so re-opening a completed list cannot walk its
 * status backwards.
 */
export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const membership = await requireHouseholdAccess();

  const detail = await getHouseholdListDetail(membership.householdId, id);
  if (!detail) notFound();

  await markListViewedAction(id);

  // Every entry point but the dashboard's own hero card links here
  // without ?from — defaulting to the list inbox keeps their existing
  // behavior unchanged.
  const backHref = from === "home" ? "/home" : "/home/lists";

  return (
    <ListChecklist summary={detail.summary} groups={detail.groups} backHref={backHref} />
  );
}
