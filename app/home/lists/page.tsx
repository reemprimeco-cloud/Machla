import { ListsInbox } from "@/components/household/ListsInbox";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdLists } from "@/lib/list/household";

/** Everything the household has received, newest first. Drafts are
 * excluded in the RPC itself — another person's unsent list is not the
 * household's business, whoever is asking. */
export default async function ListsPage() {
  const membership = await requireHouseholdAccess();
  const lists = await getHouseholdLists(membership.householdId);

  return <ListsInbox lists={lists} />;
}
