import { RouteSkeleton } from "@repo/ui/route-skeleton";

export default function Loading() {
  return <RouteSkeleton filters={false} metrics={4} rows={6} />;
}
