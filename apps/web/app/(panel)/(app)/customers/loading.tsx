import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSkeleton, ListSkeleton } from '@/components/shared/skeletons';

export default function CustomersLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <Skeleton className="mb-4 h-11 w-full rounded-lg" />
      <ListSkeleton rows={8} />
    </div>
  );
}
