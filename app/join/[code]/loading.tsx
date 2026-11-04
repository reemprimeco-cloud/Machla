import { LoadingRows } from "@/components/ui/States";

/** The join flow has two server-side checks (locale cookie, then auth)
 * before it can even render JoinFlow — exactly the kind of invisible
 * stall this was missing a skeleton for (2026-11-04 performance audit). */
export default function Loading() {
  return <LoadingRows rows={2} />;
}
