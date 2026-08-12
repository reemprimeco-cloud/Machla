import { PhotoCapture } from "@/components/worker/PhotoCapture";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getDraftList } from "@/lib/list/queries";

/** Mirrors app/worker/photo/page.tsx — see app/home/shop/page.tsx for why
 * this is a thin `basePath` variant rather than a separate build. */
export default async function ShopPhotoPage() {
  const membership = await requireHouseholdAccess();
  const draft = await getDraftList(membership.householdId);

  return (
    <PhotoCapture
      householdId={membership.householdId}
      listId={draft?.list.id ?? null}
      basePath="/home/shop"
    />
  );
}
