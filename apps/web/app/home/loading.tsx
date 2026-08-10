import { LoadingRows } from "@/components/ui/States";

/** Covers /home and everything under it — the household side is rows all
 * the way down. */
export default function Loading() {
  return <LoadingRows rows={4} />;
}
