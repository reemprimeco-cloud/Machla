import { LoadingScreen } from "@/components/ui/States";

/** Covers /home/shop and everything under it — same shape as the worker
 * equivalent (app/worker/loading.tsx), which this route mirrors. */
export default function Loading() {
  return <LoadingScreen tiles={6} />;
}
