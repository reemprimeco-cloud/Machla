import { notFound } from "next/navigation";

import { AddToListScreen } from "@/components/household/AddToListScreen";
import { getCategories } from "@/lib/catalog/queries";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdListDetail } from "@/lib/list/household";

/** Category-grid landing for "add an item to this received list" — see
 * AddToListScreen.tsx. The capture tile is excluded: add_item_to_sent_list
 * has no photo-item counterpart (no p_photo_path), so it would be a dead
 * link here. */
export default async function AddToListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireHouseholdAccess();

  const [list, categories] = await Promise.all([
    getHouseholdListDetail(membership.householdId, id),
    getCategories(),
  ]);
  if (!list) notFound();

  return (
    <AddToListScreen
      listId={id}
      categories={categories.filter((category) => !category.is_capture)}
      backHref={`/home/lists/${id}`}
    />
  );
}
