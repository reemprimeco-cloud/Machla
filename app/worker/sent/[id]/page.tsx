import { notFound } from "next/navigation";

import { SentConfirmation } from "@/components/worker/SentConfirmation";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getListById } from "@/lib/list/queries";

/** Send confirmation. Reads the list by id — `getListById` filters on
 * `created_by_user_id`, on top of RLS scoping the table to the caller's
 * households, so this cannot be used to view anyone else's list. */
export default async function SentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireWorkerAccess();

  const list = await getListById(id);
  if (!list) notFound();

  return (
    <SentConfirmation
      householdName={membership.householdName}
      groups={list.groups}
      itemCount={list.itemCount}
    />
  );
}
