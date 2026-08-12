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
export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireHouseholdAccess();

  const detail = await getHouseholdListDetail(membership.householdId, id);
  if (!detail) notFound();

  await markListViewedAction(id);

  return <ListChecklist summary={detail.summary} groups={detail.groups} />;
}
