import { Skeleton } from '@/components/ui/skeleton';
import { CardsSkeleton, ListSkeleton } from '@/components/shared/skeletons';

export default function BatchDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-48" />
      <CardsSkeleton cards={2} />
      <ListSkeleton rows={5} />
    </div>
  );
}
