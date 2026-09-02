import { RouteSkeleton } from "@repo/ui/route-skeleton";

export default function Loading() {
  return <RouteSkeleton filters metrics={3} rows={8} />;
}
