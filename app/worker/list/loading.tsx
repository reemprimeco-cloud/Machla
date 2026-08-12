import { LoadingRows } from "@/components/ui/States";

/** The review screen is rows, not tiles — overriding the /worker skeleton
 * so the placeholder matches what actually arrives. */
export default function Loading() {
  return <LoadingRows rows={5} />;
}
