import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSkeleton } from '@/components/shared/skeletons';

export default function DashboardLoading() {
  return (
    <div className="space-y-2.5">
      <HeaderSkeleton />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
