import { RouteSkeleton } from "@repo/ui/route-skeleton";

export default function Loading() {
  return <RouteSkeleton filters={false} metrics={0} rows={4} />;
}
