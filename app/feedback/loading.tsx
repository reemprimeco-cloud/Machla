import { LoadingRows } from "@/components/ui/States";

/** FeedbackScreen is a short single form, not a list — a couple of
 * blocks is enough shape to avoid a blank screen during its auth +
 * membership lookup (2026-11-04 performance audit). */
export default function Loading() {
  return <LoadingRows rows={2} />;
}
