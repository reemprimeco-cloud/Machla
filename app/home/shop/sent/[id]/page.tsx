import { notFound } from "next/navigation";

import { SentConfirmation } from "@/components/worker/SentConfirmation";
import { requireActiveSubscription, requireHouseholdAccess } from "@/lib/household/guard";
import { getListById } from "@/lib/list/queries";

/** Mirrors app/worker/sent/[id]/page.tsx — see app/home/shop/page.tsx for
 * why this is a thin `basePath` variant rather than a separate build. */
export default async function ShopSentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireHouseholdAccess();
  await requireActiveSubscription(membership);

  const list = await getListById(id);
  if (!list) notFound();

  return (
    <SentConfirmation
      householdName={membership.householdName}
      groups={list.groups}
      itemCount={list.itemCount}
      basePath="/home/shop"
    />
  );
}
