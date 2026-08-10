import { LoadingScreen } from "@/components/ui/States";

/** Covers /worker and everything under it. Tiles, because that is the
 * shape of the category grid and the product grid alike. */
export default function Loading() {
  return <LoadingScreen tiles={6} />;
}
