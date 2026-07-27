import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSkeleton, ListSkeleton } from '@/components/shared/skeletons';

export default function DebtorsLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <Skeleton className="mb-4 h-32 w-full rounded-xl" />
      <ListSkeleton rows={6} />
    </div>
  );
}
